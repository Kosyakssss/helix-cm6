# API

`helix-cm6` is the stable API. `helix-cm6/engine` holds the internals that a custom host needs (helix-motions uses it). It can change between versions.

## The editor

```ts
import { EditorView } from "@codemirror/view";
import { helix, helixDocument, helixUi } from "helix-cm6";

const extension = [helix({ config: helixToml }), helixUi()];
new EditorView({ parent, extensions: [extension, helixDocument.of({ path: "notes.md" })] });
```

One `helix()` extension can serve many editors. They share registers, the prompt and the jumplists.

`helix(options)`:

| Option | What it is |
| --- | --- |
| `config` | The text of a Helix `config.toml`. |
| `languages` | The text of one or more `languages.toml` files. `helix-cm6/languages` exports Helix's. |
| `grammars` | `grammar(name)` and `query(language, file)`, which load a language when the editor first meets it. |
| `regex`, `syntax`, `matcher` | Where to get each wasm module. The default is an inlined JS module, loaded on first use. `syntax: false` turns the syntax tree off. |
| `shell` | Runs shell commands for `\|`, `!`, `$` and the rest. |
| `workspace` | The app's side of everything the engine cannot do alone. See below. |

`helixDocument` is a facet with each editor's `path`, `name` and `language`.

## Reading and driving the editor

- `helixStatus(view)` returns the mode, pending keys, count, register, macro recording, selections, cursor position, message and language.
- `onHelixStatus.of((status, view) => …)` calls back when any of them changes.
- `helixKeys(view, "ggdd")` types keys.
- `helixRun(view, "goto_file_start")` runs a command, `helixRun(view, ":sort")` a typed command and `helixRun(view, "@ggdd")` a macro.
- `setDiagnostics.of(list)` is an effect that sets the diagnostics of a document.
- `helixSetDiffBase(view, text)` sets the text the diff gutter compares with. `null` turns it off.

## Components

Each is an extension. `helixUi(options)` adds them all; options `gutters`, `statusline` and `bufferline` can turn those off, and `theme`, `themes` and `load` choose themes.

| Function | What it draws | Helix options it reads |
| --- | --- | --- |
| `helixHighlighting()` | Syntax and rainbow brackets. | `rainbow-brackets` |
| `helixThemes(options)` | Helix themes, with `:theme`. | |
| `helixStatusline()` | The statusline. | `statusline`, `color-modes` |
| `helixGutters(layout?)` | Line numbers, diagnostics, spacer, diff. | `line-number`, `gutters` |
| `helixDecorations()` | Whitespace, indent guides, rulers, cursor column, soft wrap. | `whitespace`, `indent-guides`, `rulers`, `cursorcolumn`, `soft-wrap` |
| `helixOverlays()` | Pickers, menus and popups. Needed for all three. | `popup-border` |
| `helixCompletion()` | Completion as you type. | `auto-completion`, `completion-trigger-len`, `word-completion`, `preview-completion-insert` |
| `helixDiagnostics()` | Underlines and inline messages. | `inline-diagnostics`, `end-of-line-diagnostics` |
| `helixDiff()` | The state behind the diff gutter and `]g`. | |
| `helixBufferline()` | The bufferline. Needs `workspace.buffers`. | `bufferline` |

Colours come from Helix theme scopes. An element for a scope has the class `hx-s-` plus the scope with dots as dashes, for example `hx-s-ui-linenr`. Without a theme, they use `Canvas`, `CanvasText` and the app's `--hx-*` variables, so they follow light and dark mode. Without `helixStatusline()` an app can draw its own from `statuslineOf(editor, host, focused)`.

## Workspace

`workspace` is optional, and so is each member. A command whose member is missing goes to `run`, and then says it is not available.

| Member | Used by |
| --- | --- |
| `run(cx, name, args)` | Any workspace command. Return `false` to let the engine's own version run. |
| `buffers(cx)`, `openBuffer(cx, id, action)` | `buffer_picker`, the bufferline, `:bn`-style commands in `run`. |
| `files(cx, root)`, `openFile(cx, path, target, action)`, `readFile(path)` | `file_picker` and every preview. `files` may return a list, a promise or an async iterable of batches, which stream into the picker. |
| `search(cx, pattern, root)` | `global_search`. |
| `changedFiles(cx)` | `changed_file_picker`. |
| `diagnostics(host)` | `workspace_diagnostics_picker` and the statusline. |
| `cwd(host)`, `versionControlHead(host)`, `variable(cx, name)` | The statusline and `%{…}` expansions. |
| `language` | LSP-style features, from a language server client or anything else. Results become jumps, selections, pickers, popups and one undo step. |

`language` has `locations(cx, kind)`, `hover(cx)`, `signatureHelp(cx)`, `completions(cx, pos)`, `codeActions(cx)`, `symbols(cx)`, `workspaceSymbols(cx, query)`, `rename(cx, name)`, `format(cx)` and `highlights(cx)`. All return promises. Without `symbols`, `symbol_picker` uses the language's `tags.scm`, as Helix's syntax symbol picker does.

## Hooks

`helixHooks` is a facet for each editor, for apps where a document is more than plain text.

```ts
helixHooks.of({
  edge(edge, host) { return false; },
  motionRanges(host) { return []; },
  enter(range, edge, host) { return false; },
  key(key, cx) { return false; },
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
| `command` | Runs before a static command. Return `true` to replace it. |
| `focused` | The editor that macros and `.` should replay in now, if focus moved. |

`HelixEditor.finalLineIsLine` (engine API) treats a last line with no newline as a whole line: `x` then `y` and `P` pastes above, as in a file with a final newline.
