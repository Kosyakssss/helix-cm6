# helix-cm6

[Helix](https://helix-editor.com) for [CodeMirror 6](https://codemirror.net): a port of Helix's editing, made from Helix's source and checked against real Helix.

- **Helix's editing commands.** The keymap, selections and multiple cursors, registers, macros, the undo tree, text objects, surround, jump labels and typed commands.
- **Helix's config.** It reads the format of Helix's `config.toml`: `[keys.*]` and `[editor]`.
- **Helix's own engines.** Search runs Helix's regex crates, compiled to WebAssembly. Syntax-aware commands use tree-sitter with the same grammars as Helix. Grapheme clusters follow the same Unicode rules.
- **Tested against Helix.** About 34,000 key sequences run in real Helix and in this engine. The text, the selections and the mode after each one must match exactly.

The port follows Helix master at commit `ba40e54742`.

## Status

This is the engine from [helix-motions](https://github.com/Kosyakssss/helix-motions), the Obsidian plugin, split out so that other CodeMirror 6 apps can use it. The plugin is built on it. There is no npm release yet, and the API can change.

## Install

From a git commit:

```sh
bun add github:Kosyakssss/helix-cm6#<commit>
```

`dist/` is committed, so no build step runs on install. `@codemirror/state`, `@codemirror/view` and `@codemirror/commands` are peer dependencies.

## Use

```ts
import { EditorView } from "@codemirror/view";
import { helix } from "helix-cm6";

new EditorView({ parent: document.body, extensions: helix({ config: helixToml }) });
```

`helix()` options:

- `config`: the text of a Helix `config.toml`. Default: Helix's defaults.
- `regex`: where to get the regex wasm module. Default: a lazily imported JS module with the module inlined (`dist/regex-wasm.js`, 370 KB).
- `syntax`: the same for the tree-sitter module (`dist/tree-sitter-wasm.js`, 250 KB), or `false` for no syntax tree. Without a tree, text objects and surround use plain text, and tree commands do nothing.

A wasm source is bytes (`Uint8Array`, `ArrayBuffer`), a `Response`, or a function that returns one of these. The engine makes no network requests itself. The raw modules are exported as `helix-cm6/regex.wasm` and `helix-cm6/tree-sitter.wasm`, for example with Vite:

```ts
import regexUrl from "helix-cm6/regex.wasm?url";

helix({ regex: () => fetch(regexUrl), syntax: false });
```

Both modules load when the first editor opens. One `helix()` extension can serve many editors: they share registers and the prompt.

The engine has no files, pickers or buffers. Commands that need them call `HelixEditor.workspace` (the `Workspace` interface), which the app supplies. `helixEditor` is a facet that gives the `HelixEditor` of an editor state. For a custom host, `helixExtension` takes a `ViewEnv`; helix-motions uses it.

## Layout

- `src/core/`: the `Host` interface (`HeadlessHost` runs the engine with no view), the `Workspace` interface for things the app must supply (files, pickers, buffers), text, regex and options.
- `src/commands/`, `src/keymap/`, `src/syntax/`: Helix's commands, keymap and syntax tree.
- `src/view/`, `src/codemirror.ts`: the view layer for a CodeMirror 6 editor (keys, IME, cursors, panels).
- `src/index.ts`: the public API. `dist/` is its build (`bun run build`).
- `tree-sitter/`, `regex/`: build scripts for the two wasm modules.
- `test/oracle/`: the comparison with real Helix.
- `test/browser/`: the same comparison through `helix()` in a CodeMirror 6 editor in headless Chromium, and a test with two editors.

## Tests

`bun test` compares the headless engine with Helix. `bun run browser` runs the hand suite through real key events in headless Chromium. `bun run views` checks two editors that share one `helix()`. See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/testing.md](docs/testing.md) for setup.

## Helix forks

The engine follows Helix master and nothing else. To port a Helix fork, fork this repo, port the fork's changes, and point `test/oracle/setup.sh` at the fork's commit. The oracle then checks the port against the fork.

## License

[MPL-2.0](LICENSE). The wasm modules contain code under other licenses: see `tree-sitter/NOTICE` and `regex/NOTICE`.
