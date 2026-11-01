# helix-cm6

[Helix](https://helix-editor.com) for [CodeMirror 6](https://codemirror.net): a port of Helix's editing, made from Helix's source and checked against real Helix.

- **Helix's editing commands.** The keymap, selections and multiple cursors, registers, macros, the undo tree, text objects, surround, jump labels and typed commands.
- **Helix's config.** It reads the format of Helix's `config.toml`: `[keys.*]` and `[editor]`.
- **Helix's own engines.** Search runs Helix's regex crates, compiled to WebAssembly. Syntax-aware commands use tree-sitter with the same grammars as Helix. Grapheme clusters follow the same Unicode rules.
- **Tested against Helix.** About 34,000 key sequences run in real Helix and in this engine. The text, the selections and the mode after each one must match exactly.

The port follows Helix master at commit `ba40e54742`.

## Status

This is the engine from [helix-motions](https://github.com/Kosyakssss/helix-motions), the Obsidian plugin, split out so that other CodeMirror 6 apps can use it. The plugin is built on it.

Not ready to install yet:

- Loader hooks for the wasm modules, package exports and an npm release come next.
- The tree-sitter build has only the markdown grammars.

## Layout

- `src/core/`: the `Host` interface (`HeadlessHost` runs the engine with no view), the `Workspace` interface for things the app must supply (files, pickers, buffers), text, regex and options.
- `src/commands/`, `src/keymap/`, `src/syntax/`: Helix's commands, keymap and syntax tree.
- `src/view/`, `src/codemirror.ts`: the view layer for a CodeMirror 6 editor (keys, IME, cursors, panels). `helix({ config })` returns its extension; `config` is the text of a Helix `config.toml`.
- `tree-sitter/`, `regex/`: build scripts for the two wasm modules.
- `test/oracle/`: the comparison with real Helix.
- `test/browser/`: the same comparison through `helix()` in a CodeMirror 6 editor in headless Chromium.

## Tests

`bun test` compares the headless engine with Helix. `bun run browser` runs the hand suite through real key events in headless Chromium. See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/testing.md](docs/testing.md) for setup.

## Helix forks

The engine follows Helix master and nothing else. To port a Helix fork, fork this repo, port the fork's changes, and point `test/oracle/setup.sh` at the fork's commit. The oracle then checks the port against the fork.

## License

[MPL-2.0](LICENSE). The wasm modules contain code under other licenses: see `tree-sitter/NOTICE` and `regex/NOTICE`.
