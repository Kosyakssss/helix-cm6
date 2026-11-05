import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, GutterMarker, ViewPlugin, gutter, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { helixDiagnostics, helixGutter, helixHighlights, helixSyntaxChanged, type HelixDiagnostic, type HelixGutterLine } from "helix-cm6";

const scopeClass = (scope: string) => `tok-${scope.split(".")[0]}`;

export const syntaxColors = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;
    stale = false;
    timer = 0;
    diagnostics: readonly HelixDiagnostic[] = [];
    constructor(view: EditorView) {
      this.decorations = this.build(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged) {
        this.decorations = this.decorations.map(update.changes);
        this.diagnostics = helixDiagnostics(update.view);
        window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => {
          this.stale = true;
          update.view.dispatch({});
        }, 300);
      } else if (this.stale || update.viewportChanged || helixSyntaxChanged(update) || helixDiagnostics(update.view) !== this.diagnostics) {
        this.stale = false;
        this.decorations = this.build(update.view);
      }
    }
    destroy() {
      window.clearTimeout(this.timer);
    }
    build(view: EditorView): DecorationSet {
      this.diagnostics = helixDiagnostics(view);
      const marks: { from: number; to: number; mark: Decoration }[] = [];
      for (const { from, to } of view.visibleRanges) {
        for (const span of helixHighlights(view, from, to)) {
          const scope = span.scopes[span.scopes.length - 1];
          if (scope && span.from < span.to) marks.push({ from: span.from, to: span.to, mark: Decoration.mark({ class: scopeClass(scope) }) });
        }
      }
      for (const d of this.diagnostics) {
        if (d.from < d.to) marks.push({ from: d.from, to: d.to, mark: Decoration.mark({ class: `diagnostic-${d.severity ?? "warning"}` }) });
      }
      marks.sort((a, b) => a.from - b.from || a.to - b.to);
      const builder = new RangeSetBuilder<Decoration>();
      for (const m of marks) builder.add(m.from, m.to, m.mark);
      return builder.finish();
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

class LineMarker extends GutterMarker {
  constructor(readonly line: HelixGutterLine) {
    super();
  }
  override eq(other: LineMarker) {
    return JSON.stringify(other.line) === JSON.stringify(this.line);
  }
  override toDOM() {
    const dom = document.createElement("span");
    dom.textContent = String(this.line.number);
    dom.className = [this.line.selected ? "gutter-selected" : "", this.line.diagnostic ? `gutter-${this.line.diagnostic}` : "", this.line.change ? `gutter-${this.line.change}` : ""].join(" ");
    return dom;
  }
}

export const lineNumbers = gutter({
  class: "line-numbers",
  lineMarker(view, block) {
    const number = view.state.doc.lineAt(block.from).number;
    const line = helixGutter(view, number, number)[0];
    return line ? new LineMarker(line) : null;
  },
  lineMarkerChange: () => true,
});

export function popup(view: EditorView, pos: number, text: string): void {
  const coords = view.coordsAtPos(pos);
  const box = document.createElement("pre");
  box.className = "popup";
  box.textContent = text;
  box.style.left = `${coords?.left ?? 0}px`;
  box.style.top = `${(coords?.bottom ?? 0) + 4}px`;
  document.body.append(box);
  const close = () => {
    box.remove();
    view.dom.removeEventListener("keydown", close, true);
  };
  view.dom.addEventListener("keydown", close, true);
}
