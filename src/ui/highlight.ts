import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { highlightSpans, rainbowSpans } from "../syntax/highlight";
import type { Syntax } from "../syntax/syntax";
import { helixEnv } from "../view/view";
import { DEFAULT_SCOPES, scopeClass } from "./theme";

function syntaxOf(view: EditorView): Syntax | null {
  const env = view.state.facet(helixEnv);
  if (!env?.editor.syntax) return null;
  return env.editor.syntax(env.hostFor(view));
}

function scopesOf(view: EditorView): readonly string[] {
  return view.state.facet(helixEnv)?.editor.theme?.scopes ?? DEFAULT_SCOPES;
}

const marks = new Map<string, Decoration>();

function mark(cls: string): Decoration {
  let deco = marks.get(cls);
  if (!deco) {
    deco = Decoration.mark({ class: cls, inclusive: true });
    marks.set(cls, deco);
  }
  return deco;
}

function build(view: EditorView, syntax: Syntax | null): DecorationSet {
  if (!syntax) return Decoration.none;
  const scopes = scopesOf(view);
  const builder = new RangeSetBuilder<Decoration>();
  for (const { from, to } of view.visibleRanges) {
    for (const span of highlightSpans(syntax, scopes, syntax.byteOf(from), syntax.byteOf(to))) {
      const start = syntax.posOf(span.from);
      const end = syntax.posOf(span.to);
      if (end > start) builder.add(start, end, mark(span.scopes.map((h) => scopeClass(scopes[h]!)).join(" ")));
    }
  }
  return builder.finish();
}

const highlightPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    syntax: Syntax | null;
    scopes: readonly string[];
    constructor(view: EditorView) {
      this.syntax = syntaxOf(view);
      this.scopes = scopesOf(view);
      this.decorations = build(view, this.syntax);
    }
    update(update: ViewUpdate) {
      const syntax = syntaxOf(update.view);
      const scopes = scopesOf(update.view);
      if (update.docChanged || update.viewportChanged || syntax !== this.syntax || scopes !== this.scopes) {
        this.syntax = syntax;
        this.scopes = scopes;
        this.decorations = build(update.view, syntax);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

function rainbowEnabled(view: EditorView): boolean {
  const env = view.state.facet(helixEnv);
  if (!env) return false;
  const language = env.editor.languageConfig(env.hostFor(view));
  return language?.rainbowBrackets ?? env.editor.config.rainbowBrackets;
}

function buildRainbow(view: EditorView, syntax: Syntax | null): DecorationSet {
  if (!syntax || !rainbowEnabled(view)) return Decoration.none;
  const length = view.state.facet(helixEnv)?.editor.theme?.rainbowLength ?? 6;
  const decorations: { from: number; to: number; value: Decoration }[] = [];
  for (const { from, to } of view.visibleRanges) {
    for (const span of rainbowSpans(syntax, length, syntax.byteOf(from), syntax.byteOf(to))) {
      const start = syntax.posOf(span.from);
      const end = syntax.posOf(span.to);
      if (end > start) decorations.push({ from: start, to: end, value: mark(scopeClass(`rainbow.${span.highlight}`)) });
    }
  }
  decorations.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(decorations.map((d) => d.value.range(d.from, d.to)));
}

const rainbowPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    syntax: Syntax | null;
    enabled: boolean;
    constructor(view: EditorView) {
      this.syntax = syntaxOf(view);
      this.enabled = rainbowEnabled(view);
      this.decorations = buildRainbow(view, this.syntax);
    }
    update(update: ViewUpdate) {
      const syntax = syntaxOf(update.view);
      const enabled = rainbowEnabled(update.view);
      if (update.docChanged || update.viewportChanged || syntax !== this.syntax || enabled !== this.enabled) {
        this.syntax = syntax;
        this.enabled = enabled;
        this.decorations = buildRainbow(update.view, syntax);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

const syntaxTheme = EditorView.baseTheme({
  "&light .hx-s-attribute": { color: "#7c5e10" },
  "&dark .hx-s-attribute": { color: "#d7ba7d" },
  "&light .hx-s-keyword": { color: "#7a3e9d" },
  "&dark .hx-s-keyword": { color: "#c586c0" },
  "&light .hx-s-keyword-control": { color: "#7a3e9d" },
  "&dark .hx-s-keyword-control": { color: "#c586c0" },
  "&light .hx-s-operator": { color: "#5f6368" },
  "&dark .hx-s-operator": { color: "#b0b0b0" },
  "&light .hx-s-string": { color: "#2a7f3f" },
  "&dark .hx-s-string": { color: "#9ece6a" },
  "&light .hx-s-comment": { color: "#6e7781", fontStyle: "italic" },
  "&dark .hx-s-comment": { color: "#7f8c98", fontStyle: "italic" },
  "&light .hx-s-function": { color: "#1f5fbf" },
  "&dark .hx-s-function": { color: "#7aa2f7" },
  "&light .hx-s-function-macro": { color: "#a0522d" },
  "&dark .hx-s-function-macro": { color: "#e0af68" },
  "&light .hx-s-type": { color: "#00708a" },
  "&dark .hx-s-type": { color: "#4ec9b0" },
  "&light .hx-s-constructor": { color: "#00708a" },
  "&dark .hx-s-constructor": { color: "#4ec9b0" },
  "&light .hx-s-constant": { color: "#a0522d" },
  "&dark .hx-s-constant": { color: "#ff9e64" },
  "&light .hx-s-constant-numeric": { color: "#a0522d" },
  "&dark .hx-s-constant-numeric": { color: "#ff9e64" },
  "&light .hx-s-variable-builtin": { color: "#a0522d" },
  "&dark .hx-s-variable-builtin": { color: "#ff9e64" },
  "&light .hx-s-variable-parameter": { color: "#8a4b08" },
  "&dark .hx-s-variable-parameter": { color: "#e0c090" },
  "&light .hx-s-tag": { color: "#b0301e" },
  "&dark .hx-s-tag": { color: "#f7768e" },
  "&light .hx-s-namespace": { color: "#00708a" },
  "&dark .hx-s-namespace": { color: "#4ec9b0" },
  "&light .hx-s-label": { color: "#a0522d" },
  "&dark .hx-s-label": { color: "#e0af68" },
  "&light .hx-s-special": { color: "#b0301e" },
  "&dark .hx-s-special": { color: "#f7768e" },
  ".hx-s-markup-heading": { fontWeight: "bold" },
  ".hx-s-markup-bold": { fontWeight: "bold" },
  ".hx-s-markup-italic": { fontStyle: "italic" },
  ".hx-s-markup-strikethrough": { textDecoration: "line-through" },
  ".hx-s-markup-link-url": { textDecoration: "underline" },
  "&light .hx-s-markup-link-text": { color: "#1f5fbf" },
  "&dark .hx-s-markup-link-text": { color: "#7aa2f7" },
  "&light .hx-s-markup-raw": { color: "#2a7f3f" },
  "&dark .hx-s-markup-raw": { color: "#9ece6a" },
  "&light .hx-s-markup-quote": { color: "#6e7781" },
  "&dark .hx-s-markup-quote": { color: "#7f8c98" },
  ".hx-s-rainbow-0": { color: "#cd3131" },
  ".hx-s-rainbow-1": { color: "#b58900" },
  ".hx-s-rainbow-2": { color: "#0dbc79" },
  ".hx-s-rainbow-3": { color: "#2472c8" },
  ".hx-s-rainbow-4": { color: "#11a8cd" },
  ".hx-s-rainbow-5": { color: "#bc3fbc" },
});

export function helixHighlighting(): Extension {
  return [highlightPlugin, rainbowPlugin, syntaxTheme];
}
