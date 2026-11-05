# API

`helix-cm6` is an editing core. It holds what Helix does to text: keys, modes, selections, registers, macros, text objects, search, indentation, the syntax tree and the command line. It draws cursors, selections, jump labels and a small command line, and nothing else.

Everything else belongs to the app: pickers, menus, popups, file trees, tabs, a status bar, gutters, colours, language servers, a shell. The core gives the data for these and takes the app's commands.

`helix-cm6` is the stable API. `helix-cm6/engine` holds the internals that a custom host needs (helix-motions uses it). It can change between versions.

## The editor

```ts
import { EditorView } from "@codemirror/view";
import { helix, helixDocument } from "helix-cm6";

new EditorView({ parent, extensions: [helix({ config: helixToml }), helixDocument.of({ path: "notes.md" })] });
```

One `helix()` extension can serve many editors. They share registers, the prompt and the jumplists.

`helix(options)`:

| Option | What it is |
| --- | --- |
| `config` | The text of a Helix `config.toml`. |
| `commands` | The app's commands: an object, or a function from a name to a command. See below. |
| `keys` | The app's default keys. `helixAppKeys` is Helix's own layout for app commands. |
| `languages` | The text of one or more `languages.toml` files. `helix-cm6/languages` exports Helix's. |
| `grammars` | `grammar(name)` and `query(language, file)`, which load a language when the editor first meets it. |
| `shell` | Runs shell commands for `\|`, `!`, `$` and the rest. Without it they say "No shell set". |
| `openJump`, `variable` | Open a jump in another document, and give `%{…}` expansions their values. |
| `regex`, `syntax` | Where to get each wasm module. The default is an inlined JS module, loaded on first use. `syntax: false` turns the syntax tree off. |
| `panel` | `false` leaves out the built-in command line. `helixStatus` has all of its content, so an app can draw its own. |

`helixDocument` is a facet with each editor's `path`, `name` and `language`.

## Commands and keys

Helix has about 300 commands. The core runs the ones that edit text. The rest need something only an app has, such as files or windows: `docs/parity.md` marks them `app`, and `helixCommandList()` and `helixTypedCommandList()` list them all, with their docs.

An app supplies what it has:

```ts
helix({
  keys: helixAppKeys,
  commands: {
    file_picker: (cx) => myPicker.open(),
    write: async (cx, args) => save(cx.host.state.doc.toString(), args[0]),
    "tabs:close-others": { doc: "Close the other tabs", run: () => tabs.closeOthers() },
  },
});
```

- A command gets a `Context` and the arguments of a typed command. It can return a promise. It returns `false` to let the core's own version run.
- An app command with the name of a core command replaces it, for example `goto_next_diag`.
- A name of the app's own can go in `[keys.*]`, and runs on the command line as `:tabs:close-others`. A name with a colon in the middle is always taken for an app command.
- Keys come in three layers: the editing keys, then the app's `keys`, then the user's config. Keys for a command nobody provides are left out, so the key help lists only what works. A user's key for such a command says it is not available.
- Typed commands work the same way: `:write` runs the app's `write`. Commands the app does not provide are not offered on the command line.

To let the user keep their Helix keys, pass `keys: helixAppKeys`. To choose your own, pass your own table, or nothing. `helixAppKeys` is plain data in the same form as the keymap.

From a command, or from anywhere else:

| Function | What it does |
| --- | --- |
| `helixEdit(view, edits)` | Applies text edits as one undo step. |
| `helixSelect(view, ranges, primary?)` | Sets the selections. |
| `helixPrompt(view, request)` | Opens the command line with a label, and calls back on each change and on accept. |
| `helixMessage(view, text, severity?)` | Shows a message. |
| `helixKeys(view, "ggdd")` | Types keys. |
| `helixRun(view, name)` | Runs a command, `":sort"` a typed command, `"@ggdd"` a macro. |

## Data for the app's UI

| Data | How to get it |
| --- | --- |
| Status line | `helixStatus(view)`: mode, pending keys, count, register, recording, selections, cursor position, message, language, modified, diagnostic counts. `onHelixStatus.of((status, view) => …)` calls back on a change. |
| Key help | `status.info`: a title and rows of keys, doc and availability. |
| Command line | `status.prompt`: label, input, cursor, completions, selected completion. |
| Gutters | `helixGutter(view, fromLine, toLine)`: per line, the number to show (relative if set), whether a cursor is on it, the worst diagnostic, and the change. |
| Syntax colours | `helixHighlights(view, from, to, scopes?)`: spans with their Helix scopes. `helixRainbow(view, from, to, levels?)`: bracket levels. Checked against real Helix. |
| Options | `view.state.facet(helixEditor).config`: every `[editor]` option from the config, including those only an app draws, such as `rulers` and `statusline`. |

## Data from the app

| Effect | What it feeds |
| --- | --- |
| `setDiagnostics.of(list)` | `]d`, `[d`, `:yank-diagnostic`, the counts in the status and the gutter data. |
| `setChanges.of({ base, hunks })` | `]g`, `[g`, `:reset-diff-change` and the gutter data. `hunks` have line ranges before and after. |

## Language servers

The core does not talk to a language server. It has no client and no UI for one. An app that has a client connects it through the parts above:

| Helix feature | How |
| --- | --- |
| Diagnostics | `setDiagnostics` |
| `goto_definition` and the rest | An app command. One result: `helixSelect` in this document. More: the app's picker. |
| `hover`, `signature_help`, `code_action`, `completion` | App commands that draw the result. `helixEdit` applies edits. |
| `rename_symbol` | An app command: `helixPrompt`, then `helixEdit`. |
| `format_selections`, `:format` | App commands: `helixEdit`. |
| `select_references_to_symbol_under_cursor` | An app command: `helixSelect`. |

## Grammars

`bun run grammars --out <dir> rust python` builds grammars as wasm modules from the repositories and revisions in Helix's `languages.toml`, and copies their Helix queries. The app serves them through `grammars`. Each loads when a document first needs it. Markdown is built in.

## Hooks

`helixHooks` is a facet for each editor, for apps where a document is more than plain text.

```ts
helixHooks.of({
  edge(edge, host) { return false; },
  motionRanges(host) { return []; },
  enter(range, edge, host) { return false; },
  key(key, cx) { return false; },
  intercept(key, host) { return false; },
  textObject(kind, ch, cx) { return false; },
  command(name, cx) { return false; },
  focused(host) { return null; },
  stopBeforeEnd: false,
});
```

| Hook | What it does |
| --- | --- |
| `edge` | `h`, `j`, `k` or `l` cannot move further. It gets the direction, whether it extends, the steps left in the count and the goal column. Return `true` if the app took the key. |
| `stopBeforeEnd` | `l` stops on the last character instead of the cell after it, and calls `edge` there. For small editors such as table cells. |
| `motionRanges` | Ranges that `h`, `j`, `k` and `l` treat specially: `skip` jumps over the range, `row` is one row, and `enter` calls `enter`. |
| `enter` | A motion reached an `enter` range. Return `true` if the app handled it. |
| `key` | Runs in normal and select mode before the keymap, when no keys are pending. Return `true` if the app took the key. |
| `intercept` | Runs before anything else in any mode, including an open prompt. Return `true` if the app took the key. |
| `textObject` | Runs when `mi` or `ma` gets its character. Return `true` if the app selected it. |
| `command` | Runs before a static command. Return `true` to replace it. |
| `focused` | The editor that macros and `.` should replay in now, if focus moved. |

`HelixEditor.finalLineIsLine` (engine API) treats a last line with no newline as a whole line: `x` then `y` and `P` pastes above, as in a file with a final newline.
