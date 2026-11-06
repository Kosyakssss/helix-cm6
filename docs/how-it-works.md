# How it works

helix-cm6 has two layers. Your app sits on top of them.

```
Your app      files, tabs, pickers, status bar, language server
                 ↕  helix() and the helix functions
View layer    keys in; cursors, selections, key help, command line out
                 ↕
Core          what Helix does to text
```

## Core

The core holds Helix's logic: keys, modes, selections, registers, macros, search, text objects and the syntax tree. It works on CodeMirror's document, but it needs no screen. That is how the tests compare it with real Helix: both get the same keys, and the text, the selections and the mode must match.

Search and the syntax tree run Helix's own engines, compiled to WebAssembly: the regex crates and tree-sitter. Grapheme clusters follow the same Unicode rules as Helix.

The code is in `src/core`, `src/commands`, `src/keymap` and `src/syntax`.

## View layer

The view layer connects the core to CodeMirror. It reads keys, the mouse, the clipboard and input methods, and draws what the core decides.

The code is in `src/view` and `src/codemirror.ts`.

## Where they meet

`helix()` builds both layers and connects your commands, keys and config to them. The functions in `src/api.ts`, such as `helixSelect` and `helixStatus`, are how your app talks to them afterward.

## Two entry points

| Import | Contents |
| --- | --- |
| `helix-cm6` | The stable API. Use this. |
| `helix-cm6/engine` | The internals, for a custom host. It can change between versions. |

[helix-motions](https://github.com/Kosyakssss/helix-motions) uses the engine, because tables, properties and Live Preview in Obsidian need more than the stable API gives.

## Tests

See [Testing](testing.md).

| Layer | Checked by |
| --- | --- |
| Core | About 44,000 key sequences against real Helix. |
| View layer | The hand cases as real key events in Chromium, Firefox and WebKit, tests of the UI parts, and helix-motions in real Obsidian. |
