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
  ".hx-s-attribute": { color: "light-dark(#7c5e10, #d7ba7d)" },
  ".hx-s-keyword": { color: "light-dark(#7a3e9d, #c586c0)" },
  ".hx-s-keyword-control": { color: "light-dark(#7a3e9d, #c586c0)" },
  ".hx-s-operator": { color: "light-dark(#5f6368, #b0b0b0)" },
  ".hx-s-string": { color: "light-dark(#2a7f3f, #9ece6a)" },
  ".hx-s-comment": { color: "light-dark(#6e7781, #7f8c98)", fontStyle: "italic" },
  ".hx-s-function": { color: "light-dark(#1f5fbf, #7aa2f7)" },
  ".hx-s-function-macro": { color: "light-dark(#a0522d, #e0af68)" },
  ".hx-s-type": { color: "light-dark(#00708a, #4ec9b0)" },
  ".hx-s-constructor": { color: "light-dark(#00708a, #4ec9b0)" },
  ".hx-s-constant": { color: "light-dark(#a0522d, #ff9e64)" },
  ".hx-s-constant-numeric": { color: "light-dark(#a0522d, #ff9e64)" },
  ".hx-s-variable-builtin": { color: "light-dark(#a0522d, #ff9e64)" },
  ".hx-s-variable-parameter": { color: "light-dark(#8a4b08, #e0c090)" },
  ".hx-s-tag": { color: "light-dark(#b0301e, #f7768e)" },
  ".hx-s-namespace": { color: "light-dark(#00708a, #4ec9b0)" },
  ".hx-s-label": { color: "light-dark(#a0522d, #e0af68)" },
  ".hx-s-special": { color: "light-dark(#b0301e, #f7768e)" },
  ".hx-s-markup-heading": { fontWeight: "bold" },
  ".hx-s-markup-bold": { fontWeight: "bold" },
  ".hx-s-markup-italic": { fontStyle: "italic" },
  ".hx-s-markup-strikethrough": { textDecoration: "line-through" },
  ".hx-s-markup-link-url": { textDecoration: "underline" },
  ".hx-s-markup-link-text": { color: "light-dark(#1f5fbf, #7aa2f7)" },
  ".hx-s-markup-raw": { color: "light-dark(#2a7f3f, #9ece6a)" },
  ".hx-s-markup-quote": { color: "light-dark(#6e7781, #7f8c98)" },
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
