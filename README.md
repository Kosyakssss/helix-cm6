# helix-cm6

Not on npm or any other registry yet. If you want it published, [open an issue](https://github.com/Kosyakssss/helix-cm6/issues) and I'll get on it.

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
import { helix, helixDocument } from "helix-cm6";

new EditorView({
  parent: document.body,
  extensions: [helix({ config: helixToml }), helixDocument.of({ path: "notes.md" })],
});
```

This is an editing core: the text, the keys and the command line. An editor is an application, and the application brings the rest. It supplies commands such as `file_picker` and their keys, and draws pickers, gutters, colours and a status bar from the data the core gives. Helix's own key layout for those commands is available as plain data, `helixAppKeys`.

[docs/api.md](docs/api.md) has the whole API.

Languages other than markdown come as wasm modules:

```ts
import { helix, helixDocument } from "helix-cm6";
import { languagesToml } from "helix-cm6/languages";

const extension = helix({
  languages: languagesToml,
  grammars: {
    grammar: async (name) => {
      const response = await fetch(`/grammars/${name}.wasm`);
      return response.ok ? response : null;
    },
    query: async (language, file) => {
      const response = await fetch(`/queries/${language}/${file}`);
      return response.ok ? response.text() : null;
    },
  },
});
new EditorView({ extensions: [extension, helixDocument.of({ path: "src/main.rs" })] });
```

`bun run grammars --out <dir> rust python` builds those grammars as wasm modules into `<dir>/grammars` and copies their Helix queries, with the queries they inherit, into `<dir>/queries`. It takes each grammar from the repository and revision in Helix's `languages.toml`, and needs Git and network access. `--all` builds every grammar. `--themes` copies Helix's themes into `<dir>/themes`. A grammar module shares memory with the tree-sitter module, so it holds only the grammar's tables: JSON is 7 KB, Rust 1.1 MB.

The two wasm modules load on first use, from JS modules with the module inlined, or from where you say with the `regex` and `syntax` options. A wasm source is bytes (`Uint8Array`, `ArrayBuffer`), a `Response`, or a function that returns one of these. The engine makes no network requests itself. The raw modules are exported as `helix-cm6/regex.wasm`, `helix-cm6/tree-sitter.wasm` and `helix-cm6/matcher.wasm`.

## Layout

- `src/core/`: the `Host` interface (`HeadlessHost` runs the engine with no view), the prompt, regex and text helpers.
- `src/commands/`, `src/keymap/`, `src/syntax/`: Helix's commands, keymap and syntax tree, with its highlighter, injections and queries.
- `src/view/`, `src/codemirror.ts`: the view layer for a CodeMirror 6 editor (keys, IME, cursors, panels).
- `src/api.ts`: the data and helpers for apps.
- `src/index.ts`: the stable API. `src/engine.ts`: the internals. `dist/` is their build (`bun run build`).
- `tree-sitter/`, `regex/`: build scripts for the two wasm modules.
- `test/oracle/`: the comparison with real Helix.
- `test/browser/`: the same comparison through `helix()` in a CodeMirror 6 editor in headless Chromium, Firefox and WebKit, and a test with two editors.
- `play/`: the bare editor, to try the engine by hand.

## Try it

`bun run play` serves the bare editor on http://127.0.0.1:4173 (set `PORT` to change it). It is `helix()` in one CodeMirror editor and nothing else, to check that the editing works by itself. `?file=server.go` opens a sample from `play/samples`, and any other name an empty document. A file `play/helix.toml` is used as the config. For syntax-aware commands, run `bun run grammars --out play/languages rust python typescript go` once; the page serves `play/languages`, which Git ignores.

## Tests

`bun test` compares the headless engine and its highlighter with Helix. `bun run browser` runs the hand suite through real key events in headless Chromium, Firefox and WebKit. `bun run views` checks two editors that share one `helix()`, the hooks and every UI component in those browsers. See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/testing.md](docs/testing.md) for setup.

## Helix forks

The engine follows Helix master and nothing else. To port a Helix fork, fork this repo, port the fork's changes, and point `test/oracle/setup.sh` at the fork's commit. The oracle then checks the port against the fork.

## License

[MPL-2.0](LICENSE). The wasm modules contain code under other licenses: see `tree-sitter/NOTICE` and `regex/NOTICE`.
