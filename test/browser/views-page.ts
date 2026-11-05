import { EditorView } from "@codemirror/view";
import { helix, helixDocument, helixEditor, helixKeys, helixRun, helixStatus } from "../../src/codemirror";
import { setDiagnostics } from "../../src/diagnostics";
import { setChanges } from "../../src/changes";
import { helixAppKeys } from "../../src/keymap";
import { helixGutter, helixHighlights, helixSnippet, helixTabstops } from "../../src/api";
import { helixField } from "../../src/state";
import { helixHooks, type HelixEdge } from "../../src/hooks";

const extension = helix({ syntax: false, config: '[keys.normal]\nMeta-z = "undo"\nMeta-Z = "redo"\n' });
const make = (id: string, doc: string) => {
  const parent = document.createElement("div");
  parent.id = id;
  parent.style.height = "200px";
  document.body.appendChild(parent);
  return new EditorView({ parent, doc, extensions: [extension, EditorView.theme({ "&": { height: "200px" } })] });
};
const views = { a: make("a", "alpha beta gamma\n"), b: make("b", "delta epsilon zeta\n") };

const edges: HelixEdge[] = [];
const entered: string[] = [];
const hooked = (id: string, doc: string, ...hooks: Parameters<typeof helixHooks.of>[0][]) => {
  const parent = document.createElement("div");
  parent.id = id;
  document.body.appendChild(parent);
  return new EditorView({ parent, doc, extensions: [helix({ syntax: false }), ...hooks.map((h) => helixHooks.of(h)), EditorView.theme({ "&": { height: "200px" } })] });
};
const edgeView = hooked("edges", "abc\ndef\n", { stopBeforeEnd: true, edge: (edge) => (edges.push(edge), true) });
const cellView = hooked("cell", "abc", { stopBeforeEnd: true, edge: (edge) => (edges.push(edge), true) });
const rangesView = hooked("ranges", "one\nhidden\nhidden\ntwo\nrow one\nrow two\nthree\nblock\nfour\n", {
  motionRanges: () => [
    { from: 4, to: 18, kind: "skip" },
    { from: 22, to: 38, kind: "row" },
    { from: 44, to: 50, kind: "enter" },
  ],
  enter: (range, edge) => (entered.push(`${range.from}-${range.to}:${edge.direction}:${edge.count}`), true),
});
const commandView = hooked("command", "abc\n", {
  key: (key, cx) => {
    if (key !== "A-O") return false;
    cx.editor.setStatus("took the key");
    return true;
  },
  command: (name, cx) => {
    if (name !== "move_char_right") return false;
    cx.editor.setStatus("overridden");
    return true;
  },
});
const finalLine = (id: string) => {
  const view = hooked(id, "one\ntwo");
  view.state.facet(helixEditor)!.finalLineIsLine = true;
  return view;
};
const place = (id: string) => {
  const parent = document.createElement("div");
  parent.id = id;
  document.body.appendChild(parent);
  return parent;
};
const opened: string[] = [];
const appView = new EditorView({
  parent: place("app"),
  doc: "alpha\nbeta\n",
  extensions: [
    helix({
      syntax: false,
      keys: helixAppKeys,
      config: '[keys.normal]\nQ = "my:thing"\nW = "hover"\nE = ":my:thing one two"\n',
      commands: {
        file_picker: () => void opened.push("file_picker"),
        "my:thing": { doc: "Do my thing", run: ({ args }) => void opened.push(`my:thing ${args.join(" ")}`.trim()) },
        write: () => void opened.push("write"),
      },
    }),
    EditorView.theme({ "&": { height: "120px" } }),
  ],
});
const bareText = "# Title\n\ntext\nmore\nend\n";
const bareView = new EditorView({
  parent: place("bare"),
  doc: bareText,
  extensions: [helix(), helixDocument.of({ path: "doc.md" }), EditorView.theme({ "&": { height: "160px" } })],
});
bareView.dispatch({ effects: setDiagnostics.of([{ from: 9, to: 13, severity: "error", message: "a problem" }]) });
bareView.dispatch({ effects: setChanges.of({ base: "# Title\n\ntext\nold\nend\n", hunks: [{ beforeStart: 3, beforeEnd: 4, afterStart: 3, afterEnd: 4 }] }) });
const snippetView = new EditorView({ parent: place("snippet"), doc: "\n", extensions: [helix({ syntax: false })] });
helixSnippet(snippetView, "foo(${1:bar}, ${2:baz})$0");
const mouseView = new EditorView({ parent: place("mouse"), doc: "some words in this line\n", extensions: [helix({ syntax: false, config: "[editor]\nmouse = false\n" })] });
const noPanelView = new EditorView({ parent: place("nopanel"), doc: "abc\n", extensions: [helix({ syntax: false, panel: false })] });
const extra = { snippet: snippetView, mouse: mouseView, app: appView, bare: bareView, nopanel: noPanelView, edges: edgeView, cell: cellView, ranges: rangesView, command: commandView, final1: finalLine("final1"), final2: finalLine("final2"), final3: finalLine("final3"), final4: finalLine("final4") };

function panel(name: "a" | "b") {
  const dom = views[name].dom;
  const shown = (sel: string) => dom.querySelector(`${sel}:not(.hx-hidden)`)?.textContent ?? null;
  const prompt = dom.querySelector(".hx-prompt:not(.hx-hidden)");
  const line = prompt ? [...prompt.children].filter((c) => !c.classList.contains("hx-completions")).map((c) => c.textContent).join("").trimEnd() : null;
  return { prompt: line, message: shown(".hx-message"), focused: views[name].hasFocus };
}

let lastKeydown: { key: string; meta: boolean; prevented: boolean } | null = null;
window.addEventListener("keydown", (e) => {
  lastKeydown = { key: e.key, meta: e.metaKey, prevented: e.defaultPrevented };
});

Object.assign(window, {
  helixExtra: (name: keyof typeof extra, keys: string) => {
    const view = extra[name];
    view.dom.scrollIntoView();
    edges.length = 0;
    entered.length = 0;
    helixKeys(view, keys);
    const value = view.state.field(helixField).selection.primary();
    return { doc: view.state.doc.toString(), head: value.cursor(view.state.doc), anchor: value.anchor, edges: [...edges], entered: [...entered], status: view.state.facet(helixEditor)!.status?.message ?? null };
  },
  helixOpened: () => [...opened],
  helixStatusOf: (name: keyof typeof extra) => helixStatus(extra[name]),
  helixHighlightsOf: () => helixHighlights(bareView, 0, bareText.length).map((h) => [bareView.state.sliceDoc(h.from, h.to), h.scopes.join(" ")]),
  helixGutterOf: () => helixGutter(bareView, 1, 5),
  helixTabstopsOf: () => helixTabstops(snippetView),
  helixPanelCount: () => noPanelView.dom.querySelectorAll(".hx-panel").length,
  helixRunIn: (name: keyof typeof extra, command: string) => helixRun(extra[name], command),
  helixDoc: (name: "a" | "b") => views[name].state.doc.toString(),
  helixLastKeydown: () => lastKeydown,
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
