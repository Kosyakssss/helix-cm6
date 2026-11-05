import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import {
  helix,
  helixAppKeys,
  helixChanges,
  helixCommands,
  helixConfig,
  helixConfigure,
  helixConfigWarnings,
  helixDiagnostics,
  helixDocument,
  helixEdit,
  helixEnabled,
  helixGutter,
  helixHighlights,
  helixHooks,
  helixMarkSaved,
  helixMessage,
  helixPrompt,
  helixRegister,
  helixRun,
  helixSelect,
  helixSelection,
  helixSetChanges,
  helixSetDiagnostics,
  helixSetRegister,
  helixSnippet,
  helixStatus,
  helixTabstops,
  helixType,
  type HelixEdge,
  type HelixJump,
  type HelixStatus,
} from "../../src";
import { helixEditor } from "../../src/codemirror";
import { helixField } from "../../src/state";

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
  key: (key, { view }) => {
    if (key !== "A-O") return false;
    helixMessage(view, "took the key");
    return true;
  },
  command: (name, { view }) => {
    if (name !== "move_char_right") return false;
    helixMessage(view, "overridden");
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
helixSetDiagnostics(bareView, [{ from: 9, to: 13, severity: "error", message: "a problem" }]);
helixSetChanges(bareView, { base: "# Title\n\ntext\nold\nend\n", hunks: [{ beforeStart: 3, beforeEnd: 4, afterStart: 3, afterEnd: 4 }] });
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

async function apiChecks(): Promise<[string, unknown, unknown][]> {
  const out: [string, unknown, unknown][] = [];
  const check = (what: string, got: unknown, want: unknown) => out.push([what, got, want]);
  const calls: string[] = [];
  const statuses: HelixStatus[] = [];
  const jumps: HelixJump[] = [];
  const extension = helix({
    syntax: false,
    config: '[editor]\nscrolloff = 9\nnot-a-key = 1\n[keys.normal]\nX = "nope_no"\n',
    keys: [helixAppKeys, { normal: { space: { t: { name: "Tabs", c: "tabs:close" } }, "C-s": ":write", Y: "fle_picker", Z: ["tabs:close", "tabs:close"] } }],
    commands: {
      file_picker: () => "any value is fine",
      goto_definition: ({ view }) => helixSelect(view, 10, { jump: true }),
      write: { doc: "Save it", run: ({ view }) => helixMarkSaved(view) },
      "tabs:close": { doc: "Close a tab", complete: (input) => ["one", "two"].filter((c) => c.startsWith(input)), run: ({ args, count, register }) => void calls.push(`close ${args.join(" ")} ${count} ${register}`) },
      broken: () => {
        throw new Error("it broke");
      },
      slow_broken: async () => {
        throw new Error("it broke later");
      },
    },
    onStatus: (status) => void statuses.push(status),
    openJump: (jump) => void jumps.push(jump),
    completePath: (prefix) => ["alpha.md", "beta.md"].filter((c) => c.startsWith(prefix)),
  });
  const view = new EditorView({ parent: place("api"), doc: "one two three\nfour five\nsix\n", extensions: [extension, helixDocument.of({ path: "a.md" })] });
  view.focus();

  check("helixEnabled", helixEnabled(view), true);
  const plain = new EditorView({ parent: place("plain"), doc: "x" });
  check("helixEnabled on a plain view", helixEnabled(plain), false);
  let thrown = "";
  try {
    helixStatus(plain);
  } catch (err) {
    thrown = (err as Error).message;
  }
  check("a plain view is a clear error", thrown, "helix-cm6: this view has no helix() extension");
  plain.destroy();

  const warnings = helixConfigWarnings(view);
  check("a mistyped option warns", warnings.some((w) => w.includes("not-a-key")), true);
  check("a mistyped key in the config warns", warnings.some((w) => w.includes("nope_no")), true);
  check("a mistyped command in the app's keys warns", warnings.some((w) => w.includes("fle_picker")), true);
  check("warnings show as a message", helixStatus(view).message?.text.startsWith("config: "), true);
  check("options are data", helixConfig(view).scrolloff, 9);
  check("reload returns warnings", helixConfigure(view, { config: '[editor]\nscrolloff = 3\ncolor-modes = true\n[keys.normal]\nQ = "file_picker"\n', keys: helixAppKeys }), []);
  check("reload changes options", helixConfig(view).scrolloff, 3);
  check("reload changes keys", helixCommands(view).find((c) => c.name === "file_picker")?.keys.includes("Q"), true);
  helixMessage(view, null);
  check("a message clears", helixStatus(view).message, null);
  helixConfigure(view, { config: null, keys: [helixAppKeys, { normal: { space: { t: { name: "Tabs", c: "tabs:close" } }, "C-s": ":write" } }] });
  check("a null config resets options", helixConfig(view).scrolloff, 5);

  const list = helixCommands(view);
  const entry = (name: string) => list.find((c) => c.name === name);
  check("the list has core commands", entry("move_char_left")?.available, true);
  check("the list has their keys", entry("move_char_left")?.keys.includes("h"), true);
  check("the list has app commands with keys", [entry("file_picker")?.available, entry("file_picker")?.keys], [true, ["<space>f"]]);
  check("the list marks what nobody provides", entry("buffer_picker")?.available, false);
  check("the list has typed commands", [entry(":write")?.doc, entry(":write")?.keys, entry(":write")?.aliases], ["Save it", ["<C-s>"], [":w"]]);
  check("the list has the app's own commands", [entry("tabs:close")?.doc, entry("tabs:close")?.keys], ["Close a tab", ["<space>tc"]]);

  helixType(view, "gd");
  check("a jump selects a position", [helixSelection(view).primary.cursor, helixStatus(view).line], [10, 1]);
  helixType(view, "<C-o>");
  check("a jump goes on the jumplist", helixSelection(view).primary.cursor, 0);

  helixSelect(view, [{ anchor: 0, head: 3 }, 8, { anchor: 14, head: 18 }], { primaryIndex: 2 });
  const selection = helixSelection(view);
  check("selection is data", [selection.ranges.length, selection.primaryIndex, selection.primary.from, selection.primary.to], [3, 2, 14, 18]);
  check("a position is a one-character cursor", [selection.ranges[1]!.from, selection.ranges[1]!.to], [8, 9]);
  helixSelect(view, selection.ranges, { primaryIndex: selection.primaryIndex });
  check("selection goes back in as it came", helixSelection(view).ranges.map((r) => r.head), selection.ranges.map((r) => r.head));
  helixSelect(view, 9999);
  check("a position past the end stays in the document", helixSelection(view).primary.to, view.state.doc.length);

  helixSelect(view, 0);
  helixEdit(view, { from: 0, insert: "zero " });
  check("one edit", view.state.doc.line(1).text, "zero one two three");
  helixEdit(view, [{ from: 0, to: 5 }, { from: 8, to: 9, insert: "_" }]);
  check("several edits", view.state.doc.line(1).text, "one_two three");
  helixType(view, "u");
  check("edits are one undo step", view.state.doc.line(1).text, "zero one two three");
  helixType(view, "u");

  helixSetDiagnostics(view, [{ from: 4, to: 7, message: "no severity" }]);
  helixEdit(view, { from: 0, insert: "ab" });
  check("diagnostics follow edits", helixDiagnostics(view)[0], { from: 6, to: 9, message: "no severity", severity: undefined });
  helixType(view, "u");
  helixSetDiagnostics(view, []);
  helixSetChanges(view, { hunks: [{ beforeStart: 0, beforeEnd: 1, afterStart: 0, afterEnd: 1 }] });
  check("changes are data", helixChanges(view).hunks.length, 1);
  helixSetChanges(view, { hunks: [] });

  helixSetRegister(view, "q", ["one", "two"]);
  check("registers are data", helixRegister(view, "q"), ["one", "two"]);
  check("an empty register is empty", helixRegister(view, "w"), []);

  check("a document starts unmodified once saved", (helixMarkSaved(view), helixStatus(view).modified), false);
  helixEdit(view, { from: 0, insert: "x" });
  check("an edit modifies", helixStatus(view).modified, true);
  helixRun(view, ":write");
  check(":write through the app marks saved", helixStatus(view).modified, false);
  helixType(view, "u");
  helixMarkSaved(view);

  check("helixRun runs a core command", helixRun(view, "move_char_right"), true);
  check("helixRun says when nobody provides a command", helixRun(view, "buffer_picker"), false);
  check("helixRun says when a command does not exist", helixRun(view, "nope"), false);
  check("helixRun runs a typed command", helixRun(view, ":set-register k hello"), true);
  check("a typed command ran", helixRegister(view, "k"), ["hello"]);
  check("helixRun says when a typed command is missing", helixRun(view, ":nope"), false);
  check("helixRun says when a typed command needs the app", helixRun(view, ":open x"), false);
  check("helixRun runs a macro", helixRun(view, "@gg"), true);

  helixConfigure(view, { config: '[keys.normal]\nT = "tabs:close"\nB = "broken"\nS = "slow_broken"\n' });
  helixType(view, '"a3T');
  check("a command gets the count and register", calls.at(-1), "close  3 a");
  helixRun(view, ":tabs:close x y");
  check("a typed app command gets arguments", calls.at(-1), "close x y null null");
  helixType(view, "B");
  check("a thrown error is a message", helixStatus(view).message, { text: "it broke", severity: "error" });
  helixType(view, "S");
  await new Promise((resolve) => window.setTimeout(resolve, 10));
  check("a rejected promise is a message", helixStatus(view).message, { text: "it broke later", severity: "error" });

  const accepted = helixPrompt(view, { label: "name: ", initial: "a", complete: (input) => [`${input}1`] });
  check("a prompt is data", helixStatus(view).prompt?.label, "name: ");
  check("prompt completions are strings", helixStatus(view).prompt?.completions, ["a1"]);
  helixType(view, "b<ret>");
  check("a prompt resolves with the input", await accepted, "ab");
  const cancelled = helixPrompt(view, { label: "name: " });
  helixType(view, "<esc>");
  check("a cancelled prompt resolves with null", await cancelled, null);
  const displaced = helixPrompt(view, { label: "one: " });
  const second = helixPrompt(view, { label: "two: " });
  check("a replaced prompt resolves with null", await displaced, null);
  helixType(view, "<esc>");
  await second;

  helixType(view, ":tabs:close t");
  check("an app command completes its arguments", helixStatus(view).prompt?.completions, ["two"]);
  helixType(view, "<esc>");
  helixType(view, ":w a");
  check("a path completer completes :write", helixStatus(view).prompt?.completions, ["alpha.md"]);
  helixType(view, "<esc>");

  check("status reaches the listener", statuses.length > 0, true);

  helixEdit(view, { from: 0, insert: "y" });
  helixMarkSaved(view);
  helixType(view, "x");
  helixType(view, "ge");
  const before = helixSelection(view).primary.cursor;
  check("the jump is away from the start", before > 0, true);
  view.setState(EditorState.create({ doc: "other\n", extensions: [extension, helixDocument.of({ path: "b.md" })] }));
  check("a new state in the same view starts fresh", [helixStatus(view).modified, helixSelection(view).primary.cursor], [false, 0]);
  helixType(view, "<C-o>");
  check("a jump to another document goes to the app", jumps.at(-1)?.path, "a.md");
  helixEdit(view, { from: 0, insert: "q" });
  helixMarkSaved(view);
  const clean = view.state;
  helixEdit(view, { from: 0, insert: "q" });
  const dirty = view.state;
  const away = EditorState.create({ doc: "away\n", extensions: [extension, helixDocument.of({ path: "c.md" })] });
  view.setState(away);
  view.setState(clean);
  check("a saved document stays saved after a switch", helixStatus(view).modified, false);
  await new Promise((resolve) => window.setTimeout(resolve, 10));
  check("a new document reaches the status listener", [statuses.at(-1)?.path, statuses.at(-1)?.name], ["b.md", "b.md"]);
  view.setState(away);
  view.setState(dirty);
  check("an unsaved document stays unsaved after a switch", helixStatus(view).modified, true);

  view.destroy();
  check("the app layout is plain data", typeof (helixAppKeys.normal?.space as { name?: string }).name, "string");
  check("the app layout reads like the config", (helixAppKeys.normal?.space as Record<string, unknown>).f, "file_picker");
  return out;
}

Object.assign(window, {
  helixApiChecks: apiChecks,
  helixExtra: (name: keyof typeof extra, keys: string) => {
    const view = extra[name];
    view.dom.scrollIntoView();
    edges.length = 0;
    entered.length = 0;
    helixType(view, keys);
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
