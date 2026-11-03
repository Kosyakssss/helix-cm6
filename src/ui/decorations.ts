import { RangeSetBuilder, StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, layer, type DecorationSet, type LayerMarker, type ViewUpdate } from "@codemirror/view";
import { helixEnv } from "../view/view";
import { helixField } from "../state";
import { make } from "../view/dom";

function configOf(view: EditorView) {
  return view.state.facet(helixEnv)?.editor.config ?? null;
}

const MARKS = {
  space: Decoration.mark({ class: "hx-ws hx-ws-space" }),
  tab: Decoration.mark({ class: "hx-ws hx-ws-tab" }),
  nbsp: Decoration.mark({ class: "hx-ws hx-ws-nbsp" }),
  nnbsp: Decoration.mark({ class: "hx-ws hx-ws-nnbsp" }),
};

class NewlineWidget extends WidgetType {
  override eq(): boolean {
    return true;
  }
  toDOM(view: EditorView): HTMLElement {
    return make(view.dom.ownerDocument, "span", "hx-ws-newline");
  }
  override ignoreEvent(): boolean {
    return true;
  }
}

const newlineDecoration = Decoration.widget({ widget: new NewlineWidget(), side: 1 });

function whitespaceDecorations(view: EditorView): DecorationSet {
  const config = configOf(view);
  if (!config) return Decoration.none;
  const { render } = config.whitespace;
  if (!render.space && !render.tab && !render.nbsp && !render.nnbsp && !render.newline) return Decoration.none;
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  for (const { from, to } of view.visibleRanges) {
    for (let pos = from; pos <= to; ) {
      const line = doc.lineAt(pos);
      const text = line.text;
      const start = Math.max(pos, line.from) - line.from;
      const end = Math.min(to, line.to) - line.from;
      for (let i = start; i < end; i++) {
        const c = text.charCodeAt(i);
        const at = line.from + i;
        if (c === 32 && render.space) builder.add(at, at + 1, MARKS.space);
        else if (c === 9 && render.tab) builder.add(at, at + 1, MARKS.tab);
        else if (c === 160 && render.nbsp) builder.add(at, at + 1, MARKS.nbsp);
        else if (c === 0x202f && render.nnbsp) builder.add(at, at + 1, MARKS.nnbsp);
      }
      if (render.newline && line.to <= to && line.number < doc.lines) builder.add(line.to, line.to, newlineDecoration);
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const whitespacePlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    signature: string;
    constructor(view: EditorView) {
      this.decorations = whitespaceDecorations(view);
      this.signature = JSON.stringify(configOf(view)?.whitespace.render);
    }
    update(update: ViewUpdate) {
      const signature = JSON.stringify(configOf(update.view)?.whitespace.render);
      if (update.docChanged || update.viewportChanged || signature !== this.signature) {
        this.signature = signature;
        this.decorations = whitespaceDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

const whitespaceChars = EditorView.editorAttributes.of((view) => {
  const config = configOf(view);
  if (!config) return null;
  const c = config.whitespace.characters;
  const quote = (s: string) => JSON.stringify(s);
  return { style: `--hx-ws-space: ${quote(c.space)}; --hx-ws-tab: ${quote(c.tab)}; --hx-ws-nbsp: ${quote(c.nbsp)}; --hx-ws-nnbsp: ${quote(c.nnbsp)}; --hx-ws-newline: ${quote(c.newline)};` };
});

class GuidesWidget extends WidgetType {
  constructor(
    readonly levels: readonly number[],
    readonly character: string,
  ) {
    super();
  }
  override eq(other: GuidesWidget): boolean {
    return other.character === this.character && other.levels.length === this.levels.length && other.levels.every((l, i) => l === this.levels[i]);
  }
  toDOM(view: EditorView): HTMLElement {
    const doc = view.dom.ownerDocument;
    const dom = make(doc, "span", "hx-indent-guides");
    dom.setAttribute("aria-hidden", "true");
    for (const column of this.levels) {
      const guide = make(doc, "span", "hx-indent-guide hx-s-ui-virtual-indent-guide", this.character);
      guide.style.setProperty("--hx-guide-column", String(column));
      dom.appendChild(guide);
    }
    return dom;
  }
  override ignoreEvent(): boolean {
    return true;
  }
}

function indentColumns(text: string, tabWidth: number): number | null {
  let column = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === " ") column += 1;
    else if (c === "\t") column += tabWidth - (column % tabWidth);
    else return column;
  }
  return null;
}

function guideDecorations(view: EditorView): DecorationSet {
  const env = view.state.facet(helixEnv);
  if (!env?.editor.config.indentGuides) return Decoration.none;
  const { editor } = env;
  const indent = editor.indent(env.hostFor(view));
  const width = indent.style.kind === "tabs" ? indent.tabWidth : indent.style.width;
  if (width <= 0) return Decoration.none;
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  for (const { from, to } of view.visibleRanges) {
    let last = 0;
    const first = doc.lineAt(from);
    for (let n = first.number - 1; n >= 1; n--) {
      const level = indentColumns(doc.line(n).text, indent.tabWidth);
      if (level !== null) {
        last = level;
        break;
      }
    }
    for (let pos = from; pos <= to; ) {
      const line = doc.lineAt(pos);
      const own = indentColumns(line.text, indent.tabWidth);
      const level = own ?? last;
      if (own !== null) last = own;
      const levels: number[] = [];
      const end = Math.floor(level / width);
      for (let i = editor.config.indentGuideSkipLevels; i < end; i++) levels.push(i * width);
      if (levels.length > 0) builder.add(line.from, line.from, Decoration.widget({ widget: new GuidesWidget(levels, editor.config.indentGuideCharacter), side: -1 }));
      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const guidesPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    signature: string;
    constructor(view: EditorView) {
      this.decorations = guideDecorations(view);
      this.signature = guideSignature(view);
    }
    update(update: ViewUpdate) {
      const signature = guideSignature(update.view);
      if (update.docChanged || update.viewportChanged || signature !== this.signature) {
        this.signature = signature;
        this.decorations = guideDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

function guideSignature(view: EditorView): string {
  const env = view.state.facet(helixEnv);
  if (!env) return "";
  const config = env.editor.config;
  return JSON.stringify([config.indentGuides, config.indentGuideCharacter, config.indentGuideSkipLevels, env.editor.indent(env.hostFor(view))]);
}

class BoxMarker implements LayerMarker {
  constructor(
    readonly doc: Document,
    readonly cls: string,
    readonly left: number,
    readonly top: number,
    readonly width: number,
    readonly height: number,
    readonly text: string | null = null,
  ) {}
  eq(other: LayerMarker): boolean {
    return other instanceof BoxMarker && other.cls === this.cls && other.left === this.left && other.top === this.top && other.width === this.width && other.height === this.height && other.text === this.text;
  }
  draw(): HTMLElement {
    const dom = this.doc.createElement("div");
    this.apply(dom);
    return dom;
  }
  update(dom: HTMLElement): boolean {
    this.apply(dom);
    return true;
  }
  private apply(dom: HTMLElement): void {
    dom.className = this.cls;
    dom.textContent = this.text;
    dom.style.left = `${this.left}px`;
    dom.style.top = `${this.top}px`;
    dom.style.width = `${this.width}px`;
    dom.style.height = `${this.height}px`;
  }
}

function contentLeft(view: EditorView): number {
  const scroller = view.scrollDOM.getBoundingClientRect();
  const line = view.contentDOM.querySelector(".cm-line");
  const padding = line ? parseFloat(view.dom.ownerDocument.defaultView?.getComputedStyle(line).paddingLeft ?? "0") : 0;
  return (view.contentDOM.getBoundingClientRect().left - scroller.left) / view.scaleX + view.scrollDOM.scrollLeft + padding;
}

function rulersOf(view: EditorView): number[] {
  const env = view.state.facet(helixEnv);
  if (!env) return [];
  const host = env.hostFor(view);
  return env.editor.languageConfig(host)?.rulers ?? env.editor.config.rulers;
}

const rulersLayer = layer({
  above: false,
  class: "hx-rulers",
  update: (update) => update.geometryChanged || update.transactions.length > 0,
  markers(view) {
    const left = contentLeft(view);
    const height = view.contentHeight / view.scaleY;
    return rulersOf(view).map((column) => new BoxMarker(view.dom.ownerDocument, "hx-ruler hx-s-ui-virtual-ruler", left + (column - 1) * view.defaultCharacterWidth, 0, view.defaultCharacterWidth, height));
  },
});

const cursorColumnLayer = layer({
  above: false,
  class: "hx-cursorcolumns",
  update: () => true,
  markers(view) {
    const env = view.state.facet(helixEnv);
    const value = view.state.field(helixField, false);
    if (!env?.editor.config.cursorcolumn || !value || !view.hasFocus) return [];
    const scroller = view.scrollDOM.getBoundingClientRect();
    const height = view.contentHeight / view.scaleY;
    const seen = new Set<number>();
    const markers: LayerMarker[] = [];
    value.selection.ranges.forEach((range, i) => {
      const coords = view.coordsAtPos(range.cursor(view.state.doc), 1);
      if (!coords) return;
      const left = (coords.left - scroller.left) / view.scaleX + view.scrollDOM.scrollLeft;
      if (seen.has(left)) return;
      seen.add(left);
      const primary = i === value.selection.primaryIndex;
      markers.push(new BoxMarker(view.dom.ownerDocument, `hx-cursorcolumn hx-s-ui-cursorcolumn-${primary ? "primary" : "secondary"}`, left, 0, view.defaultCharacterWidth, height));
    });
    return markers;
  },
});

const setSoftWrap = StateEffect.define<boolean>();

const softWrapField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setSoftWrap)) return effect.value;
    return value;
  },
  provide: (field) => EditorView.contentAttributes.compute([field], (state): Record<string, string> => (state.field(field) ? { class: "cm-lineWrapping" } : {})),
});

function softWrapOf(view: EditorView) {
  const env = view.state.facet(helixEnv);
  if (!env) return null;
  const { editor } = env;
  const language = editor.languageConfig(env.hostFor(view));
  const base = editor.config.softWrap;
  const own = language?.softWrap;
  return {
    enable: own?.enable ?? base.enable,
    maxWrap: own?.maxWrap ?? base.maxWrap,
    maxIndentRetain: own?.maxIndentRetain ?? base.maxIndentRetain,
    wrapIndicator: own?.wrapIndicator ?? base.wrapIndicator,
    wrapAtTextWidth: own?.wrapAtTextWidth ?? base.wrapAtTextWidth,
    textWidth: language?.textWidth ?? editor.config.textWidth,
  };
}

const softWrapSync = ViewPlugin.fromClass(
  class {
    constructor(readonly view: EditorView) {
      this.sync();
    }
    update(): void {
      this.sync();
    }
    private sync(): void {
      const wanted = softWrapOf(this.view)?.enable ?? false;
      if (this.view.state.field(softWrapField, false) === wanted) return;
      queueMicrotask(() => {
        if (this.view.dom.isConnected && this.view.state.field(softWrapField, false) !== wanted) this.view.dispatch({ effects: setSoftWrap.of(wanted) });
      });
    }
  },
);

const softWrapStyle = EditorView.contentAttributes.of((view) => {
  const wrap = softWrapOf(view);
  if (!wrap?.enable || !wrap.wrapAtTextWidth) return null;
  return { style: `max-width: ${wrap.textWidth}ch` };
});

const hangingIndent = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.transactions.length > 0) this.decorations = this.build(update.view);
    }
    build(view: EditorView): DecorationSet {
      const wrap = softWrapOf(view);
      if (!wrap?.enable) return Decoration.none;
      const env = view.state.facet(helixEnv)!;
      const tabWidth = env.editor.indent(env.hostFor(view)).tabWidth;
      const indicator = [...wrap.wrapIndicator].length;
      const builder = new RangeSetBuilder<Decoration>();
      const doc = view.state.doc;
      for (const { from, to } of view.visibleRanges) {
        for (let pos = from; pos <= to; ) {
          const line = doc.lineAt(pos);
          const indent = indentColumns(line.text, tabWidth) ?? 0;
          const hang = (indent <= wrap.maxIndentRetain ? indent : 0) + indicator;
          if (hang > 0) builder.add(line.from, line.from, Decoration.line({ attributes: { style: `padding-inline-start: ${hang}ch; text-indent: -${hang}ch` } }));
          pos = line.to + 1;
        }
      }
      return builder.finish();
    }
  },
  { decorations: (v) => v.decorations },
);

const wrapIndicatorLayer = layer({
  above: false,
  class: "hx-wrap-indicators",
  update: (update) => update.geometryChanged || update.viewportChanged || update.docChanged,
  markers(view) {
    const wrap = softWrapOf(view);
    if (!wrap?.enable || !wrap.wrapIndicator) return [];
    const env = view.state.facet(helixEnv)!;
    const tabWidth = env.editor.indent(env.hostFor(view)).tabWidth;
    const lineHeight = view.defaultLineHeight;
    const left = contentLeft(view);
    const markers: LayerMarker[] = [];
    const paddingTop = view.documentPadding.top;
    for (const block of view.viewportLineBlocks) {
      const rows = Math.round(block.height / lineHeight);
      if (rows <= 1) continue;
      const line = view.state.doc.lineAt(block.from);
      const indent = indentColumns(line.text, tabWidth) ?? 0;
      const retained = indent <= wrap.maxIndentRetain ? indent : 0;
      for (let row = 1; row < rows; row++) {
        markers.push(new BoxMarker(view.dom.ownerDocument, "hx-wrap-indicator hx-s-ui-virtual-wrap", left + retained * view.defaultCharacterWidth, paddingTop + block.top + row * lineHeight, [...wrap.wrapIndicator].length * view.defaultCharacterWidth, lineHeight, wrap.wrapIndicator));
      }
    }
    return markers;
  },
});

export function helixDecorations(): Extension {
  return [whitespacePlugin, whitespaceChars, guidesPlugin, rulersLayer, cursorColumnLayer, softWrapField, softWrapSync, softWrapStyle, hangingIndent, wrapIndicatorLayer, decorationTheme];
}

const decorationTheme = EditorView.baseTheme({
  ".hx-ws": { position: "relative" },
  ".hx-ws::before": {
    position: "absolute",
    left: "0",
    color: "var(--hx-whitespace, color-mix(in srgb, CanvasText 35%, transparent))",
    pointerEvents: "none",
  },
  ".hx-ws-space::before": { content: "var(--hx-ws-space)" },
  ".hx-ws-tab::before": { content: "var(--hx-ws-tab)" },
  ".hx-ws-nbsp::before": { content: "var(--hx-ws-nbsp)" },
  ".hx-ws-nnbsp::before": { content: "var(--hx-ws-nnbsp)" },
  ".hx-ws-newline": { display: "inline-block", width: "0", overflow: "visible" },
  ".hx-ws-newline::before": { content: "var(--hx-ws-newline)", color: "var(--hx-whitespace, color-mix(in srgb, CanvasText 35%, transparent))" },
  ".hx-indent-guides": { display: "inline-block", width: "0", position: "relative", pointerEvents: "none", textIndent: "0" },
  ".hx-indent-guide": { position: "absolute", left: "calc(var(--hx-guide-column) * 1ch)", color: "var(--hx-indent-guide, color-mix(in srgb, CanvasText 20%, transparent))" },
  ".hx-ruler": { position: "absolute", background: "var(--hx-ruler, color-mix(in srgb, CanvasText 6%, transparent))" },
  ".hx-cursorcolumn": { position: "absolute", background: "var(--hx-cursorcolumn, color-mix(in srgb, CanvasText 5%, transparent))" },
  ".hx-wrap-indicator": { position: "absolute", whiteSpace: "pre", color: "var(--hx-wrap, color-mix(in srgb, CanvasText 40%, transparent))", pointerEvents: "none" },
});
