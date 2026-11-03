import { StateEffect, StateField, type Extension } from "@codemirror/state";
import { EditorView, GutterMarker, gutter, type ViewUpdate } from "@codemirror/view";
import type { HelixEditor } from "../core/editor";
import { diagnosticsOf, severityRank, type Severity } from "../diagnostics";
import { helixField } from "../state";
import { helixEnv } from "../view/view";
import { scopeClass } from "./theme";

class TextMarker extends GutterMarker {
  constructor(
    readonly text: string,
    readonly cls: string,
  ) {
    super();
  }
  override eq(other: GutterMarker): boolean {
    return other instanceof TextMarker && other.text === this.text && other.cls === this.cls;
  }
  override toDOM(view: EditorView): Node {
    const span = view.dom.ownerDocument.createElement("span");
    span.className = this.cls;
    span.textContent = this.text;
    return span;
  }
}

function editorOf(view: EditorView): HelixEditor | null {
  return view.state.facet(helixEnv)?.editor ?? null;
}

function selectedLines(view: EditorView): { primary: number; lines: Set<number> } {
  const value = view.state.field(helixField, false);
  const doc = view.state.doc;
  const lines = new Set<number>();
  if (!value) return { primary: 1, lines };
  for (const range of value.selection.ranges) lines.add(doc.lineAt(range.cursor(doc)).number);
  return { primary: doc.lineAt(value.selection.primary().cursor(doc)).number, lines };
}

function lineNumbersWidth(view: EditorView, minWidth: number): number {
  const doc = view.state.doc;
  const lastLine = doc.line(doc.lines);
  const lastDrawn = lastLine.length > 0 ? doc.lines : doc.lines - 1;
  return Math.max(String(Math.max(lastDrawn, 1)).length, minWidth);
}

const relevantChange = (update: ViewUpdate): boolean => update.docChanged || update.selectionSet || update.focusChanged || update.transactions.length > 0;

const lineNumbersGutter = gutter({
  class: "hx-gutter-line-numbers",
  lineMarker(view, line) {
    const editor = editorOf(view);
    if (!editor) return null;
    const doc = view.state.doc;
    const number = doc.lineAt(line.from).number;
    const width = lineNumbersWidth(view, editor.config.gutters.lineNumbersMinWidth);
    if (number === doc.lines && line.from === doc.length && doc.lines > 1) return new TextMarker("~".padStart(width), scopeClass("ui.linenr"));
    const { primary, lines } = selectedLines(view);
    const value = view.state.field(helixField, false);
    const focused = view.hasFocus;
    const relative = editor.config.lineNumber === "relative" && value?.mode !== "insert" && focused && number !== primary;
    const display = relative ? Math.abs(primary - number) : number;
    const selected = lines.has(number) && focused;
    return new TextMarker(String(display).padStart(width), scopeClass(selected ? "ui.linenr.selected" : "ui.linenr"));
  },
  lineMarkerChange: relevantChange,
  initialSpacer(view) {
    const editor = editorOf(view);
    return new TextMarker("0".repeat(lineNumbersWidth(view, editor?.config.gutters.lineNumbersMinWidth ?? 3)), "");
  },
  updateSpacer(_spacer, update) {
    const editor = editorOf(update.view);
    return new TextMarker("0".repeat(lineNumbersWidth(update.view, editor?.config.gutters.lineNumbersMinWidth ?? 3)), "");
  },
});

const diagnosticsGutter = gutter({
  class: "hx-gutter-diagnostics",
  lineMarker(view, line) {
    const list = diagnosticsOf(view.state);
    if (list.length === 0) return null;
    const doc = view.state.doc;
    const lineNumber = doc.lineAt(line.from).number;
    let best: { severity: Severity | null } | null = null;
    for (const d of list) {
      if (doc.lineAt(d.from).number !== lineNumber) continue;
      if (!best || severityRank(d.severity) >= severityRank(best.severity)) best = d;
    }
    if (!best) return null;
    return new TextMarker("●", scopeClass(best.severity ?? "warning"));
  },
  lineMarkerChange: (update) => update.docChanged || update.startState.field(helixField, false) !== update.state.field(helixField, false) || diagnosticsOf(update.startState) !== diagnosticsOf(update.state),
  initialSpacer: () => new TextMarker("●", ""),
});

const spacerGutter = gutter({
  class: "hx-gutter-spacer",
  initialSpacer: () => new TextMarker(" ", ""),
});

export interface DiffHunk {
  beforeStart: number;
  beforeEnd: number;
  afterStart: number;
  afterEnd: number;
}

export const setDiffHunks = StateEffect.define<readonly DiffHunk[]>();

export const diffHunksField = StateField.define<readonly DiffHunk[]>({
  create: () => [],
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setDiffHunks)) return effect.value;
    return value;
  },
});

const diffGutter = gutter({
  class: "hx-gutter-diff",
  lineMarker(view, line) {
    const hunks = view.state.field(diffHunksField, false);
    if (!hunks || hunks.length === 0) return null;
    const lineIndex = view.state.doc.lineAt(line.from).number - 1;
    let lo = 0;
    let hi = hunks.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const hunk = hunks[mid]!;
      if (hunk.afterEnd < lineIndex || (hunk.afterStart !== hunk.afterEnd && lineIndex === hunk.afterEnd)) lo = mid + 1;
      else hi = mid;
    }
    const hunk = hunks[lo];
    if (!hunk || hunk.afterStart > lineIndex) return null;
    if (hunk.beforeStart === hunk.beforeEnd) return new TextMarker("▍", scopeClass("diff.plus.gutter"));
    if (hunk.afterStart === hunk.afterEnd) return new TextMarker("▔", scopeClass("diff.minus.gutter"));
    return new TextMarker("▍", scopeClass("diff.delta.gutter"));
  },
  lineMarkerChange: (update) => update.docChanged || update.startState.field(diffHunksField, false) !== update.state.field(diffHunksField, false),
  initialSpacer: () => new TextMarker("▍", ""),
});

const KINDS: Record<string, Extension> = {
  diagnostics: diagnosticsGutter,
  "line-numbers": lineNumbersGutter,
  spacer: spacerGutter,
  diff: diffGutter,
};

export function gutterExtension(layout: readonly string[]): Extension {
  return layout.map((kind) => KINDS[kind] ?? []);
}

export const gutterTheme = EditorView.baseTheme({
  "&.hx .cm-gutters": { whiteSpace: "pre", background: "var(--hx-bg, Canvas)", color: "var(--hx-fg, CanvasText)", border: "none" },
  ".hx-gutter-spacer .cm-gutterElement, .hx-gutter-line-numbers .cm-gutterElement, .hx-gutter-diagnostics .cm-gutterElement, .hx-gutter-diff .cm-gutterElement": { padding: "0" },
  ".hx-s-ui-linenr": { color: "var(--hx-linenr, color-mix(in srgb, CanvasText 45%, transparent))" },
  ".hx-s-ui-linenr-selected": { color: "var(--hx-linenr-selected, CanvasText)" },
  ".hx-gutter-diagnostics .hx-s-error": { color: "var(--hx-error, #d32f2f)" },
  ".hx-gutter-diagnostics .hx-s-warning": { color: "var(--hx-warning, #b58900)" },
  ".hx-gutter-diagnostics .hx-s-info": { color: "var(--hx-info, #268bd2)" },
  ".hx-gutter-diagnostics .hx-s-hint": { color: "var(--hx-hint, #2aa198)" },
  ".hx-s-diff-plus-gutter": { color: "var(--hx-diff-plus, #2e9f55)" },
  ".hx-s-diff-minus-gutter": { color: "var(--hx-diff-minus, #d0443c)" },
  ".hx-s-diff-delta-gutter": { color: "var(--hx-diff-delta, #c28a1c)" },
});
