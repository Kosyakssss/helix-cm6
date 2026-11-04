import { EditorView } from "@codemirror/view";
import { helix, helixDocument, helixEditor, helixKeys, helixRun } from "../../src/codemirror";
import { setDiagnostics } from "../../src/diagnostics";
import { helixSetDiffBase, helixUi } from "../../src/ui";
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
const uiParent = document.createElement("div");
uiParent.id = "ui";
document.body.appendChild(uiParent);
const uiText = `# Title *em*\n\nsome  text\n\tindented line\n\nsecond word second\n\n${"long wrapped line ".repeat(40)}\n`;
const uiView = new EditorView({
  parent: uiParent,
  doc: uiText,
  extensions: [
    helix({
      config: '[editor.statusline]\nleft = ["mode", "file-name", "file-modification-indicator"]\nright = ["diagnostics", "selections", "position", "file-type"]\n',
      workspace: {
        run: () => false,
        files: () => ["alpha.md", "beta.md", "gamma.txt"],
        readFile: (path) => `contents of ${path}\n`,
        openFile: (cx, path) => cx.editor.setStatus(`opened ${path}`),
        language: {
          hover: () => Promise.resolve("**hover text**"),
          completions: () => Promise.resolve([{ label: "alphabet", detail: "test" }, { label: "alpine" }]),
        },
      },
    }),
    helixDocument.of({ path: "doc.md", name: "doc.md" }),
    helixUi({ themes: { demo: 'keyword = "#112233"\n"markup.heading" = { fg = "#445566", modifiers = ["bold"] }\n"ui.background" = { bg = "#fafafa" }\n"ui.text" = "#222222"\n' } }),
    EditorView.theme({ "&": { height: "300px" } }),
  ],
});
helixSetDiffBase(uiView, uiText.replace("second word second", "first word first"));
uiView.dispatch({ effects: setDiagnostics.of([{ from: 2, to: 7, severity: "error", message: "a problem" }]) });
const extra = { ui: uiView, edges: edgeView, cell: cellView, ranges: rangesView, command: commandView, final1: finalLine("final1"), final2: finalLine("final2"), final3: finalLine("final3"), final4: finalLine("final4") };

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
  helixUiState: () => {
    const dom = uiView.dom;
    const text = (sel: string) => dom.querySelector(sel)?.textContent ?? null;
    const all = (sel: string) => dom.querySelectorAll(sel).length;
    const heading = dom.querySelector(".cm-content .hx-s-markup-heading");
    return {
      status: text(".hx-statusline"),
      numbers: [...dom.querySelectorAll(".hx-gutter-line-numbers .cm-gutterElement")].map((e) => e.textContent!.trim()).filter(Boolean).slice(0, 8),
      diagnostics: all(".hx-gutter-diagnostics .hx-s-error"),
      underline: all(".cm-content .hx-diagnostic"),
      diff: all(".hx-gutter-diff .hx-s-diff-delta-gutter"),
      heading: heading?.textContent ?? null,
      headingColor: heading ? getComputedStyle(heading).color : null,
      spaces: all(".hx-ws-space"),
      guides: all(".hx-indent-guide"),
      rulers: all(".hx-ruler"),
      column: all(".hx-cursorcolumn"),
      picker: all(".hx-picker"),
      pickerRows: all(".hx-picker-row:not(.hx-picker-header)"),
      preview: text(".hx-picker-preview-body"),
      popup: text(".hx-popup-body"),
      menu: [...dom.querySelectorAll(".hx-menu-label")].map((e) => e.textContent),
      theme: [...dom.classList].some((c) => c.startsWith("hx-theme-")),
      wrap: (() => {
        const indicator = dom.querySelector(".hx-wrap-indicator")?.getBoundingClientRect();
        const line = [...dom.querySelectorAll(".cm-line")].find((l) => l.textContent!.startsWith("long wrapped"));
        if (!indicator || !line) return null;
        const style = getComputedStyle(line);
        return indicator.right <= line.getBoundingClientRect().left + parseFloat(style.paddingLeft) + 1;
      })(),
      message: dom.querySelector(".hx-message:not(.hx-hidden)")?.textContent ?? null,
      doc: uiView.state.doc.toString(),
      cursor: uiView.state.field(helixField).selection.primary().cursor(uiView.state.doc),
    };
  },
  helixFocusUi: () => uiView.focus(),
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
