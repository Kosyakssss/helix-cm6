# Draw your UI

helix-cm6 draws cursors, selections, jump labels, the key help and a small command line. Your app draws the rest, and helix-cm6 gives you the data.

## Status bar

`onStatus` runs when the status changes. `helixStatus(view)` reads it at any time.

```ts
const extension = helix({
  onStatus: (status) => {
    statusBar.textContent = `${status.mode}  ${status.name}  ${status.line}:${status.column}`;
  },
});
```

| Field | Type | Description |
| --- | --- | --- |
| `mode` | `"normal" \| "select" \| "insert"` | The mode. |
| `name` | `string` | The document's name. |
| `path` | `string \| null` | The document's path. |
| `modified` | `boolean` | There are edits since `helixMarkSaved`. |
| `language` | `string` | The language, or `text`. |
| `line`, `column` | `number` | The primary cursor, from 1. |
| `selections` | `number` | How many selections there are. |
| `primaryIndex` | `number` | Which selection is primary, from 0. |
| `pending` | `string` | Keys typed so far, such as `g`. |
| `count` | `number \| null` | The count typed so far. |
| `register` | `string \| null` | The selected register. |
| `recording` | `string \| null` | The register a macro is recording to. |
| `message` | `{ text, severity } \| null` | The latest message. |
| `diagnostics` | `Record<severity, number>` | Diagnostics by severity. |
| `prompt` | Object or `null` | The open command line. See below. |
| `info` | Object or `null` | The key help. See below. |

## Key help and command line

To draw these yourself, pass `panel: false`. helix-cm6 then draws no key help, command line or messages, and the status has all of their content.

`status.info` has a `title` and `rows`. Each row has `keys`, `doc` and `available`.

`status.prompt` has `label`, `input`, `cursor`, `completions` and `selected`.

## Pickers

A picker is your own UI. Open it from a command:

```ts
const extension = helix({
  commands: {
    file_picker: () => openFilePicker(),
  },
});
```

For a simple one, use `helixPrompt`. It opens the command line and returns a promise of the input, or `null` if the user cancels:

```ts
const name = await helixPrompt(view, {
  label: "open: ",
  complete: (input) => noteNames().filter((note) => note.startsWith(input)),
});
```

`history` keeps past input in a register. `initial` fills the line. `onChange` runs on each change.

## Messages

```ts
helixMessage(view, "Saved");
helixMessage(view, "Could not save", "error");
helixMessage(view, null);
```

## Selections

`helixSelection(view)` gives `ranges`, `primary` and `primaryIndex`.

| Field | Description |
| --- | --- |
| `anchor`, `head` | The two ends. |
| `from`, `to` | The start and the end. |
| `cursor` | The position of the character the block cursor is on. |

In Helix a cursor is a selection of one character, so `to` is `from + 1`. A range can go back into `helixSelect`:

```ts
const { ranges, primaryIndex } = helixSelection(view);
helixSelect(view, ranges, { primaryIndex });
```

`helixSelect` also takes one position or `{ anchor, head }`. `jump: true` first adds the current selection to the jumplist:

```ts
helixSelect(view, definition.from, { jump: true });
```

## Gutters

`helixGutter(view, fromLine, toLine)` gives one object per line:

| Field | Description |
| --- | --- |
| `line` | The line. |
| `number` | The number to show, relative if the config says so. |
| `selected` | A cursor is on this line. |
| `diagnostic` | The worst severity on this line, or `null`. |
| `change` | `added`, `removed`, `changed` or `null`. |

Feed the data with `helixSetDiagnostics` and `helixSetChanges`.

## Change the text

`helixEdit` applies one edit or a list as one undo step:

```ts
helixEdit(view, { from: 0, insert: "# Title\n" });
helixEdit(view, [
  { from: 0, to: 2 },
  { from: 10, to: 12, insert: "done" },
]);
```

`helixType` types keys. `<space>` and `<C-x>` name special keys, as in a macro:

```ts
helixType(view, "ggdd");
```

`helixSnippet` inserts an LSP-style snippet at each cursor and selects its first tabstop. `helixTabstops` gives the ranges of the active snippet. `Tab` moves to the next tabstop in insert mode.

```ts
helixSnippet(view, "for ${1:item} of ${2:items}");
```

## Registers

```ts
helixSetRegister(view, "a", ["first", "second"]);
const values = helixRegister(view, "a");
```

## Open a file from the jumplist

`C-o` and `C-i` can reach a selection in another document. `openJump` gets its path and ranges:

```ts
const extension = helix({
  openJump: async (jump, view) => {
    await openFile(view, jump.path);
    helixSelect(view, jump.ranges, { primaryIndex: jump.primaryIndex });
  },
});
```

## Connect the rest

| Option | Description |
| --- | --- |
| `shell` | Runs shell commands for `\|`, `!` and `$`: `(command, input, shell) => { code, stdout, stderr }`, or a promise. Without it they say "No shell set". |
| `completePath` | Completes paths for `:open`, `:write` and the rest: `(prefix) => paths`. |
| `variable` | Gives the value of a `%{name}` expansion the core does not know: `(name, view) => string`. |

For syntax colors, see [Languages](languages.md).
