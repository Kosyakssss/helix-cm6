import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { add, make } from "../view/dom";
import { helixEnv } from "../view/view";

const overlayPlugin = ViewPlugin.fromClass(
  class {
    private readonly dom: HTMLElement;
    private frame: number | null = null;
    private readonly unsubscribe: () => void;

    constructor(readonly view: EditorView) {
      this.dom = make(view.dom.ownerDocument, "div", "hx-overlays");
      view.dom.appendChild(this.dom);
      const env = view.state.facet(helixEnv);
      this.unsubscribe = env?.editor.onLayersChanged(() => this.schedule()) ?? (() => {});
      this.schedule();
    }

    update(): void {
      this.schedule();
    }

    private schedule(): void {
      if (this.frame !== null) return;
      this.frame = 0;
      this.view.requestMeasure({
        read: () => null,
        write: () => {
          this.frame = null;
          this.draw();
        },
      });
    }

    private draw(): void {
      const env = this.view.state.facet(helixEnv);
      const dom = this.dom;
      dom.replaceChildren();
      if (!env || !this.view.hasFocus) return;
      for (const layer of env.editor.layers) {
        const box = add(dom, "div", `hx-layer ${layer.className ?? ""}`);
        if (layer.anchored !== null && layer.anchored !== undefined) {
          const coords = this.view.coordsAtPos(Math.min(layer.anchored, this.view.state.doc.length), 1);
          const parent = this.view.dom.getBoundingClientRect();
          if (coords) {
            box.style.setProperty("--hx-anchor-left", `${coords.left - parent.left}px`);
            box.style.setProperty("--hx-anchor-top", `${coords.bottom - parent.top}px`);
            box.style.setProperty("--hx-anchor-bottom", `${parent.bottom - coords.top}px`);
            box.classList.add(coords.bottom - parent.top > parent.height * 0.6 ? "hx-layer-above" : "hx-layer-below");
          }
        }
        layer.render(box, this.view);
      }
    }

    destroy(): void {
      this.unsubscribe();
      this.dom.remove();
    }
  },
);

const overlayTheme = EditorView.baseTheme({
  ".hx-overlays": { position: "absolute", inset: "0", pointerEvents: "none", zIndex: "300", fontFamily: "var(--hx-panel-font, monospace)", fontSize: "var(--hx-panel-font-size, 0.85em)" },
  ".hx-layer": { pointerEvents: "auto" },
  ".hx-picker": {
    position: "absolute",
    inset: "5%",
    display: "flex",
    gap: "1px",
    background: "var(--hx-border, color-mix(in srgb, currentColor 20%, Canvas))",
    border: "1px solid var(--hx-border, color-mix(in srgb, currentColor 20%, transparent))",
    borderRadius: "var(--hx-radius, 4px)",
    overflow: "hidden",
    boxShadow: "var(--hx-shadow, 0 4px 16px rgb(0 0 0 / 0.2))",
  },
  ".hx-picker-list, .hx-picker-preview": { flex: "1 1 50%", minWidth: "0", display: "flex", flexDirection: "column", background: "var(--hx-bg, Canvas)", color: "var(--hx-fg, CanvasText)" },
  ".hx-picker-prompt": { display: "flex", padding: "3px 8px", whiteSpace: "pre", borderBottom: "1px solid var(--hx-border, color-mix(in srgb, currentColor 20%, transparent))" },
  ".hx-picker-count": { marginLeft: "auto", paddingLeft: "1em", color: "var(--hx-muted, color-mix(in srgb, currentColor 60%, transparent))" },
  ".hx-picker-rows": { display: "grid", gridTemplateColumns: "var(--hx-picker-columns, 1fr)", alignContent: "start", overflow: "auto", flex: "1", columnGap: "1.5em", padding: "2px 0" },
  ".hx-picker-row": { display: "contents" },
  ".hx-picker-cell": { whiteSpace: "pre", overflow: "hidden", textOverflow: "ellipsis", padding: "0 8px" },
  ".hx-picker-header .hx-picker-cell": { fontWeight: "600", color: "var(--hx-muted, color-mix(in srgb, currentColor 60%, transparent))" },
  ".hx-picker-selected .hx-picker-cell": { background: "var(--hx-hover, color-mix(in srgb, currentColor 10%, transparent))" },
  ".hx-picker-hit": { fontWeight: "bold", color: "var(--hx-accent, LinkText)" },
  ".hx-picker-preview-body": { overflow: "auto", flex: "1", padding: "2px 8px", whiteSpace: "pre" },
  ".hx-picker-focus": { background: "var(--hx-hover, color-mix(in srgb, currentColor 10%, transparent))" },
  ".hx-picker-note": { padding: "2px 8px", color: "var(--hx-muted, color-mix(in srgb, currentColor 60%, transparent))" },
  ".hx-popup, .hx-menu": { position: "absolute", left: "var(--hx-anchor-left, 0)", maxWidth: "min(80ch, 80%)", display: "flex", gap: "1px", alignItems: "flex-start" },
  ".hx-layer-below": { top: "var(--hx-anchor-top, 0)" },
  ".hx-layer-above": { bottom: "var(--hx-anchor-bottom, 0)" },
  ".hx-popup-body, .hx-menu-list, .hx-menu-doc": {
    background: "var(--hx-popup-bg, var(--hx-panel, color-mix(in srgb, currentColor 5%, Canvas)))",
    color: "var(--hx-popup-fg, inherit)",
    border: "1px solid var(--hx-border, color-mix(in srgb, currentColor 20%, transparent))",
    borderRadius: "var(--hx-radius, 4px)",
    boxShadow: "var(--hx-shadow, 0 2px 8px rgb(0 0 0 / 0.15))",
    maxHeight: "16em",
    overflow: "auto",
  },
  ".hx-popup-body, .hx-menu-doc": { padding: "4px 8px", maxWidth: "60ch" },
  ".hx-menu-list": { minWidth: "16ch", whiteSpace: "pre" },
  ".hx-menu-row": { display: "flex", gap: "2em", justifyContent: "space-between", padding: "0 8px" },
  ".hx-menu-selected": { background: "var(--hx-menu-selected-bg, var(--hx-hover, color-mix(in srgb, currentColor 12%, transparent)))", color: "var(--hx-menu-selected-fg, inherit)" },
  ".hx-menu-detail": { color: "var(--hx-muted, color-mix(in srgb, currentColor 60%, transparent))" },
  ".hx-md-code": { margin: "0.25em 0", whiteSpace: "pre-wrap" },
  ".hx-md-heading": { fontWeight: "bold" },
  ".hx-md-gap": { height: "0.5em" },
  ".cm-editor": { position: "relative" },
});

export function helixOverlays(): Extension {
  return [overlayPlugin, overlayTheme];
}
