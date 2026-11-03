import { Annotation, Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { helix, helixDocument, helixEditor, helixRun, helixSetDiffBase, helixUi, setDiagnostics, type CompletionItem, type Context, type Diagnostic, type GrammarSource, type HelixEditor, type LanguageFeatures, type ShellRunner, type WorkspaceBuffer } from "../src/engine";
import { languagesToml } from "../src/languages";
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
  buffer: string;
}

declare const HELIX_PLAY_TOKEN: string;

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
const sync = Annotation.define<boolean>();
const views = new Map<string, EditorView>();
const panes: Pane[] = [];
let focused = 0;
const grammars: GrammarSource = {
  grammar: async (name) => {
    const response = await fetch(`/grammars/${name}.wasm`);
    return response.ok ? response : null;
  },
  query: async (language, file) => {
    const response = await fetch(`/queries/${language}/${file}`);
    return response.ok ? response.text() : null;
  },
};
const shell: ShellRunner = async (command, input, argv) => {
  const response = await fetch("/shell", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${HELIX_PLAY_TOKEN}` },
    body: JSON.stringify({ command, input, shell: argv }),
  });
  return (await response.json()) as { code: number; stdout: string; stderr: string };
};

const themeTexts: Record<string, string> = (await (await fetch("/themes")).json()) as Record<string, string>;
const uiOptions = {
  themes: themeTexts,
  theme: setting("helix-theme", "") || undefined,
};

function configText(extra = ""): string {
  return `[editor]\nline-number = "${setting("relative", "0") === "1" ? "relative" : "absolute"}"\nbufferline = "multiple"\ncursorline = true\ncolor-modes = true\nauto-info = true\nend-of-line-diagnostics = "hint"\nrainbow-brackets = ${setting("rainbow", "0") === "1"}\nrulers = [${setting("ruler", "0") === "1" ? "80" : ""}]\n\n[editor.soft-wrap]\nenable = ${setting("wrap", "1") === "1"}\n\n[editor.indent-guides]\nrender = ${setting("guides", "1") === "1"}\n\n[editor.whitespace.render]\ntab = "${setting("whitespace", "0") === "1" ? "all" : "none"}"\nspace = "${setting("whitespace", "0") === "1" ? "all" : "none"}"\nnewline = "${setting("whitespace", "0") === "1" ? "all" : "none"}"\n\n[editor.statusline]\nleft = ["mode", "spinner", "file-name", "read-only-indicator", "file-modification-indicator"]\nright = ["diagnostics", "selections", "register", "position", "file-type", "position-percentage"]\n${extra}`;
}

function setting(key: string, fallback: string): string {
  return localStorage.getItem(`helix-cm6-play:${key}`) ?? fallback;
}

function buildExtension(extra = ""): Extension {
  return [helix({ languages: languagesToml, grammars, shell, workspace: workspace(), config: configText(extra) }), helixUi(uiOptions)];
}

let extension: Extension = [];
let scratch = 0;
let editor: HelixEditor | null = null;

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
        helixDocument.of({ path: name }),
        EditorView.updateListener.of((update) => {
          if (update.focusChanged && update.view.hasFocus) focus(pane);
          if (update.docChanged && !update.transactions.some((tr) => tr.annotation(sync))) {
            for (const other of viewsOf(name)) {
              if (other === update.view) continue;
              for (const tr of update.transactions) if (tr.docChanged) other.dispatch({ changes: tr.changes, annotations: sync.of(true) });
            }
          }
        }),
      ],
    }),
  });
  views.set(key, view);
  helixSetDiffBase(view, bufferOf(name).initial);
  lint(view, name);
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
}

function focus(pane: number): void {
  focused = pane;
  panes.forEach((p, i) => p.root.classList.toggle("focused", i === pane));
  drawFiles();
}

function current(): EditorView {
  return viewFor(focused, panes[focused]!.buffer);
}

function makePane(): Pane {
  const rootEl = doc.createElement("section");
  rootEl.className = "pane";
  const editorEl = doc.createElement("div");
  editorEl.className = "editor";
  rootEl.append(editorEl);
  panesEl.append(rootEl);
  const index = panes.length;
  rootEl.addEventListener("mousedown", () => focus(index));
  const pane = { root: rootEl, editor: editorEl, buffer: "" };
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
}

function lint(view: EditorView, name: string): void {
  const out: Diagnostic[] = [];
  const text = view.state.doc.toString();
  for (const m of text.matchAll(/\b(TODO|FIXME)\b.*/g)) {
    out.push({ from: m.index, to: m.index + m[0].length, severity: m[1] === "FIXME" ? "error" : "warning", message: `${m[1]} in ${name}`, source: "play" });
  }
  for (const m of text.matchAll(/[ \t]+$/gm)) out.push({ from: m.index, to: m.index + m[0].length, severity: "hint", message: "trailing whitespace", source: "play" });
  view.dispatch({ effects: setDiagnostics.of(out) });
}

function wordAt(cx: Context): { word: string; from: number; to: number } | null {
  const doc = cx.host.state.doc;
  const pos = cx.host.state.selection.main.head;
  const line = doc.lineAt(pos);
  let from = pos - line.from;
  let to = from;
  const isWord = (ch: string | undefined) => ch !== undefined && /[\p{L}\p{N}_]/u.test(ch);
  while (from > 0 && isWord(line.text[from - 1])) from--;
  while (to < line.length && isWord(line.text[to])) to++;
  return to > from ? { word: line.text.slice(from, to), from: line.from + from, to: line.from + to } : null;
}

const features: LanguageFeatures = {
  hover: (cx) => {
    const word = wordAt(cx);
    if (!word) return Promise.resolve(null);
    const count = [...cx.host.state.doc.toString().matchAll(new RegExp(`\\b${word.word.replace(/[^\p{L}\p{N}_]/gu, "")}\\b`, "gu"))].length;
    return Promise.resolve(`## \`${word.word}\`\n\n${count} use${count === 1 ? "" : "s"} in this buffer. This hover comes from the playground, as an app's LSP client would give it.`);
  },
  signatureHelp: () => Promise.resolve({ signatures: [{ label: "example(first: string, second: number): void", documentation: "A signature from the playground." }] }),
  completions: (_cx, _pos) => {
    const items: CompletionItem[] = ["helix", "selection", "register", "macro", "picker"].map((label) => ({ label, detail: "play", documentation: `**${label}** comes from the playground's completion provider.` }));
    return Promise.resolve(items);
  },
  highlights: (cx) => {
    const word = wordAt(cx);
    if (!word) return Promise.resolve([]);
    const text = cx.host.state.doc.toString();
    return Promise.resolve([...text.matchAll(new RegExp(`\\b${word.word.replace(/[^\p{L}\p{N}_]/gu, "")}\\b`, "gu"))].map((m) => ({ from: m.index, to: m.index + m[0].length })));
  },
  locations: (cx, kind) => {
    const word = wordAt(cx);
    if (!word) return Promise.resolve([]);
    const text = cx.host.state.doc.toString();
    const uses = [...text.matchAll(new RegExp(`\\b${word.word.replace(/[^\p{L}\p{N}_]/gu, "")}\\b`, "gu"))];
    const list = kind === "references" ? uses : uses.slice(0, 1);
    return Promise.resolve(list.map((m) => ({ from: m.index, to: m.index + m[0].length, label: text.slice(text.lastIndexOf("\n", m.index) + 1, text.indexOf("\n", m.index)).trim() })));
  },
  codeActions: (cx) =>
    Promise.resolve([
      {
        title: "Upper-case the selection",
        run: () => void helixRun(cx.host.view as EditorView, "switch_to_uppercase"),
      },
      {
        title: "Sort the selections",
        run: () => void helixRun(cx.host.view as EditorView, ":sort"),
      },
    ]),
  rename: (cx, name) => {
    const word = wordAt(cx);
    if (!word) return Promise.resolve([]);
    const text = cx.host.state.doc.toString();
    return Promise.resolve([...text.matchAll(new RegExp(`\\b${word.word.replace(/[^\p{L}\p{N}_]/gu, "")}\\b`, "gu"))].map((m) => ({ from: m.index, to: m.index + m[0].length, insert: name })));
  },
};

function workspace() {
  return {
    language: features,
    buffers: (): WorkspaceBuffer[] => buffers.map((b) => ({ id: b.name, path: b.name, name: b.name, modified: textOf(b.name) !== b.initial })),
    openBuffer: (_cx: Context, id: string) => open(id),
    files: () => buffers.map((b) => b.name),
    openFile: (_cx: Context, path: string, target: { line?: number; from?: number; to?: number } | null) => {
      open(path);
      if (target?.line !== undefined) helixRun(current(), `:goto ${target.line + 1}`);
    },
    readFile: (path: string) => (buffers.some((b) => b.name === path) ? textOf(path) : null),
    search: (_cx: Context, pattern: string) => {
      const regex = new RegExp(pattern, "gmu");
      const out: { path: string; line: number; text: string }[] = [];
      for (const b of buffers) {
        const lines = textOf(b.name).split("\n");
        if (b.name === "big.md") continue;
        lines.forEach((text, line) => {
          regex.lastIndex = 0;
          if (regex.test(text)) out.push({ path: b.name, line, text });
        });
      }
      return Promise.resolve(out);
    },
    changedFiles: () => buffers.filter((b) => textOf(b.name) !== b.initial).map((b) => ({ path: b.name, status: "modified" })),
    cwd: () => "play",
    versionControlHead: () => "",
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
          cx.editor.markSaved(cx.host);
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
          extension = buildExtension(textOf("helix.toml"));
          reconfigure();
          current().focus();
          return;
        default:
          return false;
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

function rebuild(): void {
  extension = buildExtension();
  reconfigure();
  current().focus();
}

const themeSelect = doc.getElementById("helix-theme") as HTMLSelectElement;
for (const name of Object.keys(themeTexts).sort()) {
  const option = doc.createElement("option");
  option.value = name;
  option.textContent = name;
  themeSelect.append(option);
}
control("theme", "theme", applyLook);
control("helix-theme", "helix-theme", (name) => {
  helixRun(current(), name ? `:theme ${name}` : ":noop");
  if (!name) location.reload();
  current().focus();
});
control("relative", "relative", rebuild);
control("rainbow", "rainbow", rebuild);
control("ruler", "ruler", rebuild);
control("guides", "guides", rebuild);
control("whitespace", "whitespace", rebuild);
control("font", "font", applyLook);
control("size", "size", applyLook);
control("wrap", "wrap", rebuild);
control("split", "", (on) => (on === "1" ? split("vertical", panes[focused]!.buffer) : unsplit(focused)));

applyLook();
extension = buildExtension();
makePane();
focus(0);
show(0, "notes.md");
