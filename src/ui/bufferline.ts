import { Prec, type Extension } from "@codemirror/state";
import { EditorView, showPanel, type Panel } from "@codemirror/view";
import { Context } from "../core/editor";
import { add, make } from "../view/dom";
import { helixEnv } from "../view/view";

export function helixBufferline(): Extension {
  const panel = showPanel.of((view): Panel => {
    const dom = make(view.dom.ownerDocument, "div", "hx-bufferline hx-s-ui-bufferline");
    let last = "";
    const render = () => {
      const env = view.state.facet(helixEnv);
      const workspace = env?.editor.workspace;
      if (!env || !workspace?.buffers) return;
      const host = env.hostFor(view);
      const cx = new Context(env.editor, host, null, null);
      const buffers = workspace.buffers(cx);
      const mode = env.editor.config.bufferline;
      const visible = mode === "always" || (mode === "multiple" && buffers.length > 1);
      const key = JSON.stringify([visible, buffers, host.id]);
      if (key === last) return;
      last = key;
      dom.replaceChildren();
      dom.classList.toggle("hx-hidden", !visible);
      if (!visible) return;
      for (const buffer of buffers) {
        const active = buffer.id === host.id;
        const name = buffer.path?.slice(buffer.path.lastIndexOf("/") + 1) ?? buffer.name;
        add(dom, "span", active ? "hx-bufferline-item hx-bufferline-active hx-s-ui-bufferline-active" : "hx-bufferline-item", ` ${name}${buffer.modified ? "[+]" : ""} `);
      }
    };
    render();
    return { dom, top: true, update: render };
  });
  return [Prec.high(panel), bufferlineTheme];
}

const bufferlineTheme = EditorView.baseTheme({
  ".hx-bufferline": { display: "flex", overflow: "hidden", whiteSpace: "pre", fontFamily: "var(--hx-panel-font, monospace)", fontSize: "var(--hx-panel-font-size, 0.85em)", background: "var(--hx-panel, color-mix(in srgb, currentColor 5%, Canvas))" },
  ".hx-bufferline.hx-hidden": { display: "none" },
  ".hx-bufferline-active": { fontWeight: "600", background: "var(--hx-bg, Canvas)" },
});
