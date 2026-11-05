# API reference

Everything `helix-cm6` exports. Each function takes the `view` first. A view without `helix()` is an error, and `helixEnabled(view)` checks for one.

`helix-cm6/engine` holds the internals that a custom host needs. It can change between versions. See [How it works](how-it-works.md).

## helix

`helix(options)` returns a CodeMirror extension. One extension can serve many editors. They share registers, the prompt, the config and the commands.

| Option | Type | Description |
| --- | --- | --- |
| `config` | `string \| object \| null` | A Helix `config.toml`. See [Config](config.md). |
| `commands` | `object` | Your app's commands. See [Commands](commands.md). |
| `keys` | `object \| object[]` | Your app's keys. See [Keys](keys.md). |
| `onStatus` | `(status, view) => void` | Runs when the status changes. See [Draw your UI](ui.md). |
| `grammars` | `string \| object` | Where to load grammars. See [Languages](languages.md). |
| `languages` | `string \| string[]` | The text of `languages.toml` files. |
| `regex` | Wasm source | Where to load the regex module. |
| `syntax` | Wasm source `\| false` | Where to load the syntax module. `false` turns it off. |
| `shell` | `(command, input, shell) => output` | Runs shell commands. |
| `completePath` | `(prefix) => paths` | Completes paths in the command line. |
| `openJump` | `(jump, view) => unknown` | `C-o` or `C-i` reached another document. |
| `variable` | `(name, view) => string \| null` | The value of a `%{name}` expansion. |
| `panel` | `boolean` | `false` leaves out the key help and the command line. |

## helixDocument

`helixDocument.of({ path, name, language })` says what an editor holds. All fields are optional.

| Field | Description |
| --- | --- |
| `path` | Picks the language, and tells documents apart in the jumplist. |
| `name` | The name in the status. The default is the path. |
| `language` | Sets the language. `text` means none. |

Pass a new state to `view.setState` to change the document in an editor.

## helixAppKeys

Helix's own key layout for app commands, as plain data. See [Keys](keys.md).

## Run

| Function | Description |
| --- | --- |
| `helixRun(view, command)` | Runs a command, a typed command (`":sort"`) or a macro (`"@ggdd"`). Returns `false` if nobody provides it. |
| `helixType(view, keys)` | Types keys. `<space>` and `<C-x>` name special keys. |
| `helixCommands(view)` | Lists every command. See [Commands](commands.md#list-commands). |

## Edit

| Function | Description |
| --- | --- |
| `helixEdit(view, edits)` | Applies `{ from, to?, insert? }`, or a list, as one undo step. |
| `helixSelect(view, target, options?)` | Sets the selections. A target is a position, `{ anchor, head }` or a list. Options are `jump` and `primaryIndex`. |
| `helixSnippet(view, text, options?)` | Inserts a snippet at each cursor. Options are `removeBefore` and `variables`. |
| `helixSetRegister(view, name, values)` | Writes a register. |

## Talk to the user

| Function | Description |
| --- | --- |
| `helixPrompt(view, request)` | Opens the command line. Returns a promise of the input, or `null`. The request has `label`, `initial?`, `history?`, `complete?` and `onChange?`. |
| `helixMessage(view, text, severity?)` | Shows a message. `null` clears it. Severity is `info` or `error`. |

## Read

| Function | Returns |
| --- | --- |
| `helixEnabled(view)` | Whether the view has `helix()`. |
| `helixStatus(view)` | The status. See [Draw your UI](ui.md#status-bar). |
| `helixSelection(view)` | `ranges`, `primary` and `primaryIndex`. |
| `helixRegister(view, name)` | The values, or an empty list. |
| `helixTabstops(view)` | The ranges of the active snippet, with `from`, `to` and `choices`. |
| `helixGutter(view, fromLine, toLine)` | One object per line. See [Draw your UI](ui.md#gutters). |
| `helixHighlights(view, from, to, scopes?)` | Spans with `from`, `to` and `scopes`. |
| `helixRainbow(view, from, to, levels?)` | Spans with `from`, `to` and `level`. |

## Save

| Function | Description |
| --- | --- |
| `helixMarkSaved(view)` | The document is saved, so `status.modified` is `false` until the next edit. |

## Configure

| Function | Description |
| --- | --- |
| `helixConfigure(view, { config, commands, keys })` | Replaces what you pass, reloads, and returns the warnings. |
| `helixConfig(view)` | Every option. It follows `:set`. |
| `helixConfigWarnings(view)` | What was wrong with the config, your keys and their commands. |

## Feed data

| Function | Description |
| --- | --- |
| `helixSetDiagnostics(view, list)` | Feeds `]d`, `[d`, `:yank-diagnostic`, the status and the gutter. Each has `from`, `to`, `message`, and can have `severity`, `source`, `code` and `tags`. |
| `helixDiagnostics(view)` | The list, mapped through edits since you set it. |
| `helixSetChanges(view, { base, hunks })` | Feeds `]g`, `[g`, `:reset-diff-change` and the gutter. Each hunk has `beforeStart`, `beforeEnd`, `afterStart` and `afterEnd`, in lines. |
| `helixChanges(view)` | What you set. |

## Watch

| Function | Description |
| --- | --- |
| `helixSyntaxChanged(update)` | From a CodeMirror `ViewUpdate`: a language loaded, so redraw colors. |

## helixHooks

A facet for apps where a document is more than plain text. See [Hooks](hooks.md).

## Types

Every type is exported with a `Helix` prefix, such as `HelixStatus`, `HelixCommand` and `HelixKeys`. `HelixCommandName` and `HelixRunnable` are the types of command names, so an editor completes them.
