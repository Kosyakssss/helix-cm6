import { Annotation, Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { helix, helixEditor, helixField, type Context, type HelixEditor } from "../src/index";
import notes from "./samples/notes.md.txt" with { type: "text" };
import markdownEdges from "./samples/markdown-edges.md.txt" with { type: "text" };
import app from "./samples/app.ts.txt" with { type: "text" };
import lib from "./samples/lib.rs.txt" with { type: "text" };
import script from "./samples/script.py.txt" with { type: "text" };
import server from "./samples/server.go.txt" with { type: "text" };
import style from "./samples/style.css.txt" with { type: "text" };
import data from "./samples/data.json.txt" with { type: "text" };
import config from "./samples/helix.toml.txt" with { type: "text" };
import unicode from "./samples/unicode.txt" with { type: "text" };
import whitespace from "./samples/whitespace.txt" with { type: "text" };
import pairs from "./samples/pairs.txt" with { type: "text" };
import prose from "./samples/prose.txt" with { type: "text" };

interface Buffer {
  name: string;
  group: string;
  initial: string;
}

interface Pane {
  root: HTMLElement;
  editor: HTMLElement;
  status: HTMLElement;
  buffer: string;
}

function big(): string {
  const lines: string[] = [];
  for (let i = 1; i <= 20000; i++) {
    if (i % 500 === 1) lines.push(`## Section ${Math.ceil(i / 500)}`);
    else if (i % 7 === 0) lines.push("");
    else lines.push(`Line ${i}: the quick brown fox jumps over the lazy dog (${i % 13}) [${"x".repeat(i % 40)}]`);
  }
  return lines.join("\n") + "\n";
}

const buffers: Buffer[] = [
  { name: "notes.md", group: "Markdown", initial: notes },
  { name: "markdown-edges.md", group: "Markdown", initial: markdownEdges },
  { name: "big.md", group: "Markdown", initial: big() },
  { name: "app.ts", group: "Code", initial: app },
  { name: "lib.rs", group: "Code", initial: lib },
  { name: "script.py", group: "Code", initial: script },
  { name: "server.go", group: "Code", initial: server },
  { name: "style.css", group: "Code", initial: style },
  { name: "data.json", group: "Code", initial: data },
  { name: "unicode.txt", group: "Edge cases", initial: unicode },
  { name: "whitespace.txt", group: "Edge cases", initial: whitespace },
  { name: "pairs.txt", group: "Edge cases", initial: pairs },
  { name: "prose.txt", group: "Edge cases", initial: prose },
  { name: "empty.txt", group: "Edge cases", initial: "" },
  { name: "no-final-newline.txt", group: "Edge cases", initial: "the last line has no newline" },
  { name: "helix.toml", group: "Config", initial: config },
];

const doc = document;
const root = doc.documentElement;
const panesEl = doc.getElementById("panes")!;
const filesEl = doc.getElementById("files")!;
const hx = new Compartment();
const wrap = new Compartment();
const sync = Annotation.define<boolean>();
const views = new Map<string, EditorView>();
const panes: Pane[] = [];
let focused = 0;
let extension: Extension = helix();
let scratch = 0;
let editor: HelixEditor | null = null;

const setting = (key: string, fallback: string) => localStorage.getItem(`helix-cm6-play:${key}`) ?? fallback;
const remember = (key: string, value: string) => localStorage.setItem(`helix-cm6-play:${key}`, value);

function bufferOf(name: string): Buffer {
  let buffer = buffers.find((b) => b.name === name);
  if (!buffer) {
    buffer = { name, group: "New", initial: "" };
    buffers.push(buffer);
    drawFiles();
  }
  return buffer;
}

function viewsOf(name: string): EditorView[] {
  return panes.map((_, i) => views.get(`${i}:${name}`)).filter((v): v is EditorView => !!v);
}

function textOf(name: string): string {
  return viewsOf(name)[0]?.state.doc.toString() ?? bufferOf(name).initial;
}

function viewFor(pane: number, name: string): EditorView {
  const key = `${pane}:${name}`;
  let view = views.get(key);
  if (view) return view;
  const twin = viewsOf(name)[0];
  view = new EditorView({
    state: EditorState.create({
      doc: twin ? twin.state.doc : bufferOf(name).initial,
      extensions: [
        hx.of(extension),
        wrap.of(setting("wrap", "1") === "1" ? EditorView.lineWrapping : []),
        EditorView.updateListener.of((update) => {
          if (update.focusChanged && update.view.hasFocus) focus(pane);
          if (update.docChanged && !update.transactions.some((tr) => tr.annotation(sync))) {
            for (const other of viewsOf(name)) {
              if (other === update.view) continue;
              for (const tr of update.transactions) if (tr.docChanged) other.dispatch({ changes: tr.changes, annotations: sync.of(true) });
            }
          }
          drawStatus();
        }),
      ],
    }),
  });
  views.set(key, view);
  if (!editor) {
    editor = view.state.facet(helixEditor);
    if (editor) setup(editor);
  }
  return view;
}

function show(pane: number, name: string): void {
  const p = panes[pane]!;
  p.buffer = name;
  const view = viewFor(pane, name);
  p.editor.replaceChildren(view.dom);
  view.requestMeasure();
  if (pane === focused) view.focus();
  drawFiles();
  drawStatus();
}

function focus(pane: number): void {
  focused = pane;
  panes.forEach((p, i) => p.root.classList.toggle("focused", i === pane));
  drawFiles();
  drawStatus();
}

function current(): EditorView {
  return viewFor(focused, panes[focused]!.buffer);
}

function makePane(): Pane {
  const rootEl = doc.createElement("section");
  rootEl.className = "pane";
  const editorEl = doc.createElement("div");
  editorEl.className = "editor";
  const statusEl = doc.createElement("div");
  statusEl.className = "status";
  rootEl.append(editorEl, statusEl);
  panesEl.append(rootEl);
  const index = panes.length;
  rootEl.addEventListener("mousedown", () => focus(index));
  const pane = { root: rootEl, editor: editorEl, status: statusEl, buffer: "" };
  panes.push(pane);
  return pane;
}

function split(direction: "vertical" | "horizontal", name: string): void {
  panesEl.classList.toggle("horizontal", direction === "horizontal");
  if (panes.length === 1) makePane();
  (doc.getElementById("split") as HTMLInputElement).checked = true;
  focus(1);
  show(1, name);
}

function unsplit(keep: number): void {
  if (panes.length === 1) return;
  const name = panes[keep]!.buffer;
  for (const [key, view] of views) {
    if (!key.startsWith("1:")) continue;
    view.destroy();
    views.delete(key);
  }
  panes.pop()!.root.remove();
  (doc.getElementById("split") as HTMLInputElement).checked = false;
  focus(0);
  show(0, name);
}

function open(name: string): void {
  show(focused, name);
}

function cycle(step: number): void {
  const names = buffers.map((b) => b.name);
  const at = names.indexOf(panes[focused]!.buffer);
  open(names[(at + step + names.length) % names.length]!);
}

function reconfigure(): void {
  for (const view of views.values()) view.dispatch({ effects: hx.reconfigure(extension) });
  editor = current().state.facet(helixEditor);
  if (editor) setup(editor);
}

function setup(ed: HelixEditor): void {
  ed.pathCompleter = (prefix) => buffers.map((b) => b.name).filter((n) => n.startsWith(prefix));
  ed.workspace = {
    run(cx: Context, name: string, args: string[]) {
      switch (name) {
        case "open":
          if (args[0]) open(args[0]);
          else cx.editor.setError("open: give a file name");
          return;
        case "new":
          open(`scratch-${++scratch}`);
          return;
        case "write":
        case "write-all":
          cx.editor.setStatus(`"${panes[focused]!.buffer}" kept in memory; the playground writes nothing to disk`);
          return;
        case "reload": {
          const view = current();
          view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: bufferOf(panes[focused]!.buffer).initial } });
          return;
        }
        case "goto_next_buffer":
          cycle(1);
          return;
        case "goto_previous_buffer":
          cycle(-1);
          return;
        case "file_picker":
        case "file_picker_in_current_buffer_directory":
        case "buffer_picker":
          cx.editor.prompt(cx, {
            label: "open:",
            complete: (input) =>
              buffers.filter((b) => b.name.includes(input)).map((b) => ({ start: 0, text: b.name, label: b.name })),
            onAccept: (input) => open(input),
          });
          return;
        case "vsplit":
        case "hsplit":
          split(name === "vsplit" ? "vertical" : "horizontal", panes[focused]!.buffer);
          return;
        case "vsplit_new":
        case "hsplit_new":
          split(name === "vsplit_new" ? "vertical" : "horizontal", `scratch-${++scratch}`);
          return;
        case "wclose":
        case "quit":
          unsplit(focused === 0 ? 1 : 0);
          return;
        case "wonly":
          unsplit(focused);
          return;
        case "jump_view_left":
        case "jump_view_right":
        case "jump_view_up":
        case "jump_view_down":
        case "rotate_view":
        case "rotate_view_reverse":
          if (panes.length > 1) {
            focus(1 - focused);
            current().focus();
          }
          return;
        case "config-open":
          open("helix.toml");
          return;
        case "config-reload":
          extension = helix({ config: textOf("helix.toml") });
          reconfigure();
          current().focus();
          return;
        default:
          cx.editor.setError(`${name} is not available in the playground`);
      }
    },
  };
}

function drawFiles(): void {
  const groups = [...new Set(buffers.map((b) => b.group))];
  filesEl.replaceChildren(
    ...groups.flatMap((group) => {
      const title = doc.createElement("h2");
      title.textContent = group;
      return [
        title,
        ...buffers
          .filter((b) => b.group === group)
          .map((b) => {
            const button = doc.createElement("button");
            button.textContent = b.name;
            button.classList.toggle("open", panes[focused]?.buffer === b.name);
            button.addEventListener("click", () => open(b.name));
            return button;
          }),
      ];
    }),
  );
}

function drawStatus(): void {
  panes.forEach((pane, i) => {
    const view = views.get(`${i}:${pane.buffer}`);
    if (!view) return;
    const state = view.state.field(helixField, false);
    const mode = state ? { normal: "NOR", insert: "INS", select: "SEL" }[state.mode] : "";
    const ranges = state?.selection.ranges ?? [];
    const head = state ? state.selection.primary().cursor(view.state.doc) : 0;
    const line = view.state.doc.lineAt(head);
    const pending = i === focused ? (editor?.pendingDisplay() ?? "") : "";
    const parts = [
      ["mode", mode],
      ["", pane.buffer],
      ["", pending],
      ["right", `${ranges.length > 1 ? `${ranges.length} sels  ` : ""}${line.number}:${head - line.from + 1}`],
    ];
    pane.status.replaceChildren(
      ...parts.map(([cls, text]) => {
        const span = doc.createElement("span");
        if (cls) span.className = cls;
        span.textContent = text ?? "";
        return span;
      }),
    );
  });
}

function applyLook(): void {
  const theme = setting("theme", "");
  if (theme) root.dataset.theme = theme;
  else delete root.dataset.theme;
  root.style.setProperty("--play-font", setting("font", "ui-monospace, Menlo, monospace"));
  root.style.fontSize = setting("size", "15px");
  for (const view of views.values()) view.requestMeasure();
}

function control(id: string, key: string, onChange: (value: string) => void): void {
  const el = doc.getElementById(id) as HTMLInputElement | HTMLSelectElement;
  if (el instanceof HTMLInputElement && el.type === "checkbox") {
    if (key) el.checked = setting(key, el.checked ? "1" : "0") === "1";
    el.addEventListener("change", () => {
      if (key) remember(key, el.checked ? "1" : "0");
      onChange(el.checked ? "1" : "0");
    });
    return;
  }
  el.value = setting(key, el.value);
  el.addEventListener("change", () => {
    remember(key, el.value);
    onChange(el.value);
  });
}

control("theme", "theme", applyLook);
control("font", "font", applyLook);
control("size", "size", applyLook);
control("wrap", "wrap", (on) => {
  for (const view of views.values()) view.dispatch({ effects: wrap.reconfigure(on === "1" ? EditorView.lineWrapping : []) });
});
control("split", "", (on) => (on === "1" ? split("vertical", panes[focused]!.buffer) : unsplit(focused)));
doc.addEventListener("keyup", () => drawStatus(), true);
doc.addEventListener("keydown", () => queueMicrotask(drawStatus), true);

applyLook();
makePane();
focus(0);
show(0, "notes.md");
