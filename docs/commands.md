# Commands

Commands connect Helix to your app. helix-cm6 runs the commands that edit text. Your app supplies the ones that need something else, such as files or windows.

Helix has about 300 commands. [parity.md](parity.md) marks the ones an app supplies as `app`.

## Supply a command

Pass a function, or an object with a `run` function:

```ts
const extension = helix({
  commands: {
    file_picker: () => openFilePicker(),
    "tabs:close": {
      doc: "Close a tab",
      complete: (input) => tabNames().filter((name) => name.startsWith(input)),
      run: ({ args }) => closeTab(args[0]),
    },
  },
});
```

| Field | Description |
| --- | --- |
| `run` | Runs the command. |
| `doc` | Shows in the key help and in `helixCommands`. |
| `complete` | Completes the arguments in the command line: `(input) => strings`. |

## Read the context

Each command gets an object:

| Field | Type | Description |
| --- | --- | --- |
| `view` | `EditorView` | The editor the command runs in. |
| `args` | `readonly string[]` | The arguments of a typed command. |
| `count` | `number \| null` | The count, such as `3` in `3gn`. |
| `register` | `string \| null` | The register, such as `a` in `"a3gn`. |

```ts
const extension = helix({
  commands: {
    goto_next_buffer: ({ view, count }) => nextTab(view, count ?? 1),
  },
});
```

## Return a value

A command can return anything. Two results have a meaning:

- **A promise.** If it rejects, the error shows as a message. A thrown error does too.
- **`false`.** Helix's own version of the command runs instead.

```ts
const extension = helix({
  commands: {
    goto_next_diag: ({ view }) => {
      if (!hasServerDiagnostics(view)) return false;
      jumpToServerDiagnostic(view);
    },
  },
});
```

## Name a command

Helix's names give you Helix's behavior:

| Name | Effect |
| --- | --- |
| `file_picker` | Runs on `Space f` if you use `helixAppKeys`. |
| `write` | Runs for `:write` and `:w`. |
| `increment` | Replaces the core command. |
| `tabs:close` | Your own command. Use it in keys, or type `:tabs:close`. |

A name with a colon in the middle is always your own. TypeScript completes Helix's names in `commands`, `keys` and `helixRun`.

## Run a command

`helixRun` runs any command, for a toolbar button or a menu:

```ts
button.onclick = () => helixRun(view, "file_picker");
```

| Value | Runs |
| --- | --- |
| `"file_picker"` | A command. |
| `":sort"` | A typed command. |
| `"@ggdd"` | A macro: these keys, in order. |

It returns `false` if nobody provides the command.

## List commands

`helixCommands` gives what a command palette needs:

```ts
const available = helixCommands(view).filter((command) => command.available);
```

| Field | Description |
| --- | --- |
| `name` | The name. Typed commands start with a colon. |
| `doc` | What it does. |
| `aliases` | Other names, such as `:w` for `:write`. |
| `keys` | Its keys in the current mode. |
| `available` | `false` when a command needs an app and nobody provides it. |

Pass any `name` to `helixRun`.
