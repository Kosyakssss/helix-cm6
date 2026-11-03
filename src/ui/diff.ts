import { StateEffect, type Extension, type Text } from "@codemirror/state";
import { ViewPlugin, type EditorView, type ViewUpdate } from "@codemirror/view";
import type { Host } from "../core/host";
import type { Hunk } from "../core/matcher";
import { helixEnv } from "../view/view";
import { diffHunksField, setDiffHunks } from "./gutters";

export const setDiffBase = StateEffect.define<string | null>();

export function lastDiffHunks(host: Host): readonly Hunk[] | null {
  return host.state.field(diffHunksField, false) ?? null;
}

const bases = new WeakMap<EditorView, string | null>();

export function helixSetDiffBase(view: EditorView, base: string | null): void {
  view.dispatch({ effects: setDiffBase.of(base) });
}

const diffPlugin = ViewPlugin.fromClass(
  class {
    private timer: number | null = null;
    private doc: Text | null = null;

    constructor(readonly view: EditorView) {}

    update(update: ViewUpdate): void {
      let changed = update.docChanged;
      for (const tr of update.transactions) {
        for (const effect of tr.effects) {
          if (effect.is(setDiffBase)) {
            bases.set(this.view, effect.value);
            changed = true;
          }
        }
      }
      if (changed) this.schedule();
    }

    private schedule(): void {
      const win = this.view.dom.ownerDocument.defaultView;
      if (!win) return;
      if (this.timer !== null) win.clearTimeout(this.timer);
      this.timer = win.setTimeout(() => {
        this.timer = null;
        this.compute();
      }, 50);
    }

    private compute(): void {
      const view = this.view;
      if (!view.dom.isConnected) return;
      const editor = view.state.facet(helixEnv)?.editor;
      const base = bases.get(view) ?? null;
      if (!editor) return;
      if (base === null) {
        view.dispatch({ effects: setDiffHunks.of([]) });
        return;
      }
      void editor.withMatcher((matcher) => {
        if (!view.dom.isConnected) return;
        const doc = view.state.doc;
        if (this.doc === doc) return;
        this.doc = doc;
        view.dispatch({ effects: setDiffHunks.of(matcher.diff(base, doc.toString())) });
        this.doc = null;
      });
    }

    destroy(): void {
      if (this.timer !== null) this.view.dom.ownerDocument.defaultView?.clearTimeout(this.timer);
    }
  },
);

export function helixDiff(): Extension {
  return [diffHunksField, diffPlugin];
}

export function diffBaseOf(view: EditorView): string | null {
  return bases.get(view) ?? null;
}
