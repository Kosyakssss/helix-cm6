import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { helix, helixAppKeys, helixDocument, helixMarkSaved, helixMessage, helixPrompt } from "helix-cm6";

const notes = new Map<string, string>(Object.entries(JSON.parse(localStorage.getItem("notes") ?? '{"welcome":"Hello.\\n"}') as Record<string, string>));
const open = new Map<string, EditorState>();
const persist = () => localStorage.setItem("notes", JSON.stringify(Object.fromEntries(notes)));
let current = [...notes.keys()][0]!;

const bar = document.createElement("footer");

function show(name: string, view: EditorView) {
  open.set(current, view.state);
  current = name;
  view.setState(open.get(name) ?? EditorState.create({ doc: notes.get(name) ?? "", extensions: [extension, helixDocument.of({ name, path: `${name}.md` })] }));
  view.focus();
}

const pick = async (view: EditorView, label: string) => {
  const name = await helixPrompt(view, { label, complete: (input) => [...notes.keys()].filter((n) => n.startsWith(input)) });
  return name || null;
};

const extension = helix({
  config: localStorage.getItem("helix.toml"),
  keys: [helixAppKeys, { normal: { space: { n: "notes:new", x: "notes:delete" } } }],
  commands: {
    file_picker: async ({ view }) => {
      const name = await pick(view, "open: ");
      if (name) show(name, view);
    },
    write: ({ view }) => {
      notes.set(current, view.state.doc.toString());
      persist();
      helixMarkSaved(view);
    },
    "notes:new": async ({ view }) => {
      const name = await pick(view, "new note: ");
      if (!name) return;
      notes.set(name, "");
      show(name, view);
    },
    "notes:delete": { doc: "Delete this note", run: ({ view }) => {
      notes.delete(current);
      open.delete(current);
      persist();
      helixMessage(view, `deleted ${current}`);
      show([...notes.keys()][0] ?? "welcome", view);
    } },
  },
  onStatus: (status) => {
    bar.textContent = `${status.mode}  ${status.name}${status.modified ? " [+]" : ""}  ${status.line}:${status.column}  ${status.message?.text ?? ""}`;
  },
});

const view = new EditorView({ parent: document.body, doc: notes.get(current) ?? "", extensions: [extension, helixDocument.of({ name: current, path: `${current}.md` })] });
document.body.append(bar);
view.focus();
