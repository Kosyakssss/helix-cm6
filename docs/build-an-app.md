# Build an app

This guide builds a small notes app, one step at a time. The finished app is [`examples/notes`](../examples/notes/app.ts). To run it:

```sh
bun run example notes
```

## Add Helix to an editor

`helix()` is a CodeMirror extension. Add it to your editor, and Helix's editing works:

```ts
import { EditorView } from "@codemirror/view";
import { helix } from "helix-cm6";

const view = new EditorView({ parent: document.body, extensions: [helix()] });
view.focus();
```

Try `w`, `d`, `x`, `s` and `%`. These keys need nothing from your app.

## Add a command

Some Helix commands need something only an app has, such as files. Supply them in `commands`, using Helix's name:

```ts
const extension = helix({
  commands: {
    file_picker: async ({ view }) => {
      const name = await helixPrompt(view, { label: "open: " });
      if (name) openNote(view, name);
    },
  },
});
```

A command has no key until you give it one. This command runs if you call `helixRun(view, "file_picker")`, but `Space f` does nothing yet.

## Use Helix's keys

Add `keys: helixAppKeys` to use Helix's own keys:

```ts
const extension = helix({
  keys: helixAppKeys,
  commands: {
    file_picker: async ({ view }) => {
      const name = await helixPrompt(view, { label: "open: " });
      if (name) openNote(view, name);
    },
  },
});
```

Now `Space f` opens the prompt. The key help lists it too, along with the editing commands. It does not list commands you left out, such as the buffer picker.

## Add your own keys

To add your own keys, pass a list. Later tables merge into earlier ones:

```ts
const extension = helix({
  keys: [
    helixAppKeys,
    {
      normal: {
        "C-s": ":write",
        space: {
          n: { name: "Notes", n: "notes:new", t: "notes:task" },
        },
      },
    },
  ],
  commands: {
    "notes:new": {
      doc: "New note",
      run: async ({ view, args }) => {
        const name = args[0] ?? (await helixPrompt(view, { label: "new note: " }));
        if (name) openNote(view, name);
      },
    },
    "notes:task": { doc: "Tick or untick the selected tasks", run: ({ view }) => void toggleTasks(view) },
  },
});
```

`Space n` now opens a menu called Notes, and each row shows the command's `doc`. Your own commands also work in the command line: `:notes:new shopping` makes a note called "shopping".

## Load the user's config

Pass the text of the user's `helix.toml` as `config`. Their keys go on top of yours:

```ts
const extension = helix({
  config: localStorage.getItem("helix.toml"),
  keys: helixAppKeys,
});
```

Helix's own `config.toml` works as it is. See [Config](config.md).

## Save a note

`:write` is a Helix command that only an app can run. Call `helixMarkSaved` when the save is done:

```ts
const extension = helix({
  commands: {
    write: ({ view }) => {
      notes.set(current, view.state.doc.toString());
      helixMarkSaved(view);
      helixMessage(view, `saved ${current}`);
    },
  },
});
```

`helixMarkSaved` clears the document's modified state until the next edit.

## Show the status

helix-cm6 does not draw a status bar. `onStatus` gives you the data to draw your own:

```ts
const extension = helix({
  onStatus: (status) => {
    const changed = status.modified ? "[+]" : "";
    statusBar.textContent = `${status.mode}  ${status.name} ${changed}  ${status.line}:${status.column}`;
  },
});
```

See [Draw your UI](ui.md) for everything the status has.

## Switch notes

An editor state holds a document with its selections and its undo history. To switch notes, keep the old state and set a new one:

```ts
function newTab(name: string) {
  return EditorState.create({
    doc: notes.get(name) ?? "",
    extensions: [extension, helixDocument.of({ name, path: `${name}.md` })],
  });
}

function openNote(view: EditorView, name: string) {
  tabs.set(current, view.state);
  current = name;
  view.setState(tabs.get(name) ?? newTab(name));
  view.focus();
}
```

`helixDocument` tells Helix the note's name and path. The status shows the name, the path picks the language, and the jumplist uses the path to tell notes apart.

## Change a Helix command

A command with the name of a core command replaces it. Return `false` to run Helix's version instead.

Here `Ctrl-a` ticks a task. On anything else, it adds one to a number as usual:

```ts
const extension = helix({
  commands: {
    increment: ({ view }) => toggleTasks(view),
  },
});
```

`toggleTasks` returns `false` when the selected lines have no tasks.

## Next steps

- [Commands](commands.md): what a command gets and can return.
- [Keys](keys.md): how keys combine, and the user's config.
- [Draw your UI](ui.md): pickers, gutters and the rest.
- [`examples/code`](../examples/code): a code editor with a language server.
