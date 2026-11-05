import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { helix, helixAppKeys, helixCommands, helixDocument, helixEdit, helixMarkSaved, helixMessage, helixPrompt, helixRun, helixSelection } from "helix-cm6";

const saved = localStorage.getItem("notes") ?? '{"inbox":"- [ ] Buy milk\\n- [ ] Call Sam\\n"}';
const notes = new Map<string, string>(Object.entries(JSON.parse(saved)));
const tabs = new Map<string, EditorState>();
let current = "inbox";

function open(view: EditorView, name: string) {
  tabs.set(current, view.state);
  current = name;
  view.setState(tabs.get(name) ?? newTab(name));
  view.focus();
}

function step(view: EditorView, by: number) {
  const names = [...notes.keys()];
  open(view, names[(names.indexOf(current) + by + names.length) % names.length]!);
}

function selectedLines(view: EditorView) {
  const { doc } = view.state;
  const numbers = new Set<number>();
  for (const { from, to } of helixSelection(view).ranges) {
    for (let n = doc.lineAt(from).number; n <= doc.lineAt(Math.max(from, to - 1)).number; n++) numbers.add(n);
  }
  return [...numbers].map((n) => doc.line(n));
}

function toggleTasks(view: EditorView) {
  const edits = selectedLines(view).flatMap((line) => {
    const box = /^- \[( |x)\]/.exec(line.text);
    return box ? [{ from: line.from + 3, to: line.from + 4, insert: box[1] === "x" ? " " : "x" }] : [];
  });
  helixEdit(view, edits);
  return edits.length > 0;
}

const extension = helix({
  config: localStorage.getItem("helix.toml"),

  keys: [
    helixAppKeys,
    {
      normal: {
        "C-s": [":write", "collapse_selection"],
        D: "@xd",
        space: {
          n: {
            name: "Notes",
            n: "notes:new",
            t: "notes:task",
            d: "notes:date",
            c: "notes:count",
          },
        },
      },
      insert: { "C-t": "notes:date" },
    },
  ],

  commands: {
    file_picker: async ({ view }) => {
      const complete = (input: string) => [...notes.keys()].filter((name) => name.startsWith(input));
      const name = await helixPrompt(view, { label: "open: ", complete });
      if (name) open(view, name);
    },
    goto_next_buffer: ({ view, count }) => step(view, count ?? 1),
    goto_previous_buffer: ({ view, count }) => step(view, -(count ?? 1)),
    command_palette: async ({ view }) => {
      const names = helixCommands(view).filter((c) => c.available).map((c) => c.name);
      const complete = (input: string) => names.filter((name) => name.includes(input));
      const name = await helixPrompt(view, { label: "run: ", complete });
      if (name) helixRun(view, name);
    },

    write: ({ view }) => {
      notes.set(current, view.state.doc.toString());
      localStorage.setItem("notes", JSON.stringify(Object.fromEntries(notes)));
      helixMarkSaved(view);
      helixMessage(view, `saved ${current}`);
    },
    increment: ({ view }) => toggleTasks(view),

    "notes:new": {
      doc: "New note",
      run: async ({ view, args }) => {
        const name = args[0] ?? (await helixPrompt(view, { label: "new note: " }));
        if (!name) return;
        notes.set(name, "");
        open(view, name);
      },
    },
    "notes:task": { doc: "Tick or untick the selected tasks", run: ({ view }) => void toggleTasks(view) },
    "notes:date": {
      doc: "Insert today's date",
      run: ({ view }) => {
        const today = new Date().toLocaleDateString("en-CA");
        helixEdit(view, helixSelection(view).ranges.map((range) => ({ from: range.cursor, insert: today })));
      },
    },
    "notes:count": {
      doc: "Count the words in this note",
      run: ({ view }) => {
        const words = view.state.doc.toString().split(/\s+/).filter(Boolean).length;
        helixMessage(view, `${words} words`);
      },
    },
  },

  onStatus: (status) => {
    const changed = status.modified ? "[+]" : "";
    statusBar.textContent = `${status.mode}  ${status.name} ${changed}  ${status.line}:${status.column}  ${status.message?.text ?? ""}`;
  },
});

function newTab(name: string) {
  return EditorState.create({
    doc: notes.get(name) ?? "",
    extensions: [extension, helixDocument.of({ name, path: `${name}.md` })],
  });
}

const statusBar = document.createElement("footer");
const button = document.createElement("button");
button.textContent = "New note";
button.onclick = () => helixRun(view, "notes:new");

const view = new EditorView({ parent: document.body, state: newTab(current) });
document.body.prepend(button);
document.body.append(statusBar);
view.focus();
