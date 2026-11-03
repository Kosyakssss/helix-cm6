import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { diagnosticsOf, severityRank, setDiagnostics, type Diagnostic, type Severity } from "../diagnostics";
import { helixField } from "../state";
import { make } from "../view/dom";
import { helixEnv } from "../view/view";
import { scopeClass } from "./theme";

const LEVELS: Record<string, number> = { hint: 0, info: 1, warning: 2, error: 3 };

function shows(filter: string, severity: Severity | null): boolean {
  if (filter === "disable") return false;
  const level = LEVELS[filter];
  return level !== undefined && severityRank(severity ?? "hint") >= level;
}

class MessageWidget extends WidgetType {
  constructor(
    readonly message: string,
    readonly severity: Severity,
    readonly block: boolean,
  ) {
    super();
  }
  override eq(other: MessageWidget): boolean {
    return other.message === this.message && other.severity === this.severity && other.block === this.block;
  }
  toDOM(view: EditorView): HTMLElement {
    const dom = make(view.dom.ownerDocument, this.block ? "div" : "span", `${this.block ? "hx-inline-diagnostic" : "hx-eol-diagnostic"} ${scopeClass(this.severity)}`);
    dom.textContent = this.message;
    return dom;
  }
  override ignoreEvent(): boolean {
    return true;
  }
}

const underline = new Map<string, Decoration>();

function mark(d: Diagnostic): Decoration {
  const tags = d.tags ?? [];
  const cls = [`hx-diagnostic ${scopeClass(`diagnostic.${d.severity ?? "warning"}`)}`, tags.includes("unnecessary") ? scopeClass("diagnostic.unnecessary") : "", tags.includes("deprecated") ? scopeClass("diagnostic.deprecated") : ""].filter(Boolean).join(" ");
  let deco = underline.get(cls);
  if (!deco) {
    deco = Decoration.mark({ class: cls });
    underline.set(cls, deco);
  }
  return deco;
}

function build(view: EditorView): DecorationSet {
  const list = diagnosticsOf(view.state);
  const env = view.state.facet(helixEnv);
  if (list.length === 0 || !env) return Decoration.none;
  const config = env.editor.config;
  const value = view.state.field(helixField, false);
  const doc = view.state.doc;
  const cursorLine = value ? doc.lineAt(value.selection.primary().cursor(doc)).number : -1;
  const items: { from: number; to: number; deco: Decoration }[] = [];
  const perLine = new Map<number, Diagnostic[]>();
  for (const d of list) {
    if (d.to > d.from) items.push({ from: d.from, to: d.to, deco: mark(d) });
    const line = doc.lineAt(d.from).number;
    const group = perLine.get(line);
    if (group) group.push(d);
    else perLine.set(line, [d]);
  }
  for (const [lineNumber, group] of perLine) {
    const line = doc.line(lineNumber);
    const onCursor = lineNumber === cursorLine;
    const inline = group.filter((d) => shows(onCursor ? config.inlineDiagnostics.cursorLine : config.inlineDiagnostics.otherLines, d.severity)).slice(0, config.inlineDiagnostics.maxDiagnostics);
    for (const d of inline) items.push({ from: line.to, to: line.to, deco: Decoration.widget({ widget: new MessageWidget(d.message, d.severity ?? "warning", true), block: true, side: 1 }) });
    const eol = group.filter((d) => !inline.includes(d) && shows(config.endOfLineDiagnostics, d.severity));
    const worst = eol.reduce<Diagnostic | null>((best, d) => (!best || severityRank(d.severity) > severityRank(best.severity) ? d : best), null);
    if (worst) items.push({ from: line.to, to: line.to, deco: Decoration.widget({ widget: new MessageWidget(worst.message.split("\n")[0]!, worst.severity ?? "warning", false), side: 1 }) });
  }
  items.sort((a, b) => a.from - b.from || a.deco.startSide - b.deco.startSide || a.to - b.to);
  const builder = new RangeSetBuilder<Decoration>();
  for (const item of items) builder.add(item.from, item.to, item.deco);
  return builder.finish();
}

const decorations = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.transactions.some((tr) => tr.effects.some((e) => e.is(setDiagnostics)))) this.decorations = build(update.view);
    }
  },
  { decorations: (v) => v.decorations },
);

const theme = EditorView.baseTheme({
  ".hx-diagnostic": { textDecorationLine: "underline", textDecorationStyle: "wavy", textDecorationSkipInk: "none" },
  ".hx-s-diagnostic-error": { textDecorationColor: "var(--hx-error, #d32f2f)" },
  ".hx-s-diagnostic-warning": { textDecorationColor: "var(--hx-warning, #b58900)" },
  ".hx-s-diagnostic-info": { textDecorationColor: "var(--hx-info, #268bd2)" },
  ".hx-s-diagnostic-hint": { textDecorationColor: "var(--hx-hint, #2aa198)" },
  ".hx-s-diagnostic-unnecessary": { opacity: "0.6", textDecorationLine: "none" },
  ".hx-s-diagnostic-deprecated": { textDecorationLine: "line-through" },
  ".hx-inline-diagnostic, .hx-eol-diagnostic": { fontSize: "0.9em", whiteSpace: "pre-wrap" },
  ".hx-eol-diagnostic": { paddingInlineStart: "2ch", whiteSpace: "pre" },
  ".hx-inline-diagnostic.hx-s-error, .hx-eol-diagnostic.hx-s-error": { color: "var(--hx-error, #d32f2f)" },
  ".hx-inline-diagnostic.hx-s-warning, .hx-eol-diagnostic.hx-s-warning": { color: "var(--hx-warning, #b58900)" },
  ".hx-inline-diagnostic.hx-s-info, .hx-eol-diagnostic.hx-s-info": { color: "var(--hx-info, #268bd2)" },
  ".hx-inline-diagnostic.hx-s-hint, .hx-eol-diagnostic.hx-s-hint": { color: "var(--hx-hint, #2aa198)" },
});

export function helixDiagnostics(): Extension {
  return [decorations, theme];
}
