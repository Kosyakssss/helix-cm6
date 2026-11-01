import { EditorView } from "@codemirror/view";
import { helix, helixEditor } from "../../src/codemirror";

const extension = helix({ syntax: false });
const make = (id: string, doc: string) => {
  const parent = document.createElement("div");
  parent.id = id;
  parent.style.height = "200px";
  document.body.appendChild(parent);
  return new EditorView({ parent, doc, extensions: [extension, EditorView.theme({ "&": { height: "200px" } })] });
};
const views = { a: make("a", "alpha beta gamma\n"), b: make("b", "delta epsilon zeta\n") };

function panel(name: "a" | "b") {
  const dom = views[name].dom;
  const shown = (sel: string) => dom.querySelector(`${sel}:not(.hx-hidden)`)?.textContent ?? null;
  const prompt = dom.querySelector(".hx-prompt:not(.hx-hidden)");
  const line = prompt ? [...prompt.children].filter((c) => !c.classList.contains("hx-completions")).map((c) => c.textContent).join("").trimEnd() : null;
  return { prompt: line, message: shown(".hx-message"), focused: views[name].hasFocus };
}

Object.assign(window, {
  helixReady: () => views.a.state.facet(helixEditor)?.regex != null,
  helixPanel: panel,
  helixFocus: (name: "a" | "b") => views[name].focus(),
  helixMoveToLineEnd: (name: "a" | "b") => {
    const view = views[name];
    view.dispatch({ selection: { anchor: view.state.doc.line(1).to } });
    const range = view.state.facet(helixEditor) ? view.state.selection.main : null;
    return range ? [range.anchor, range.head, view.state.doc.line(1).to] : null;
  },
});
