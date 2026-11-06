# Examples

Three apps, from the smallest to the largest. Run one with `bun run example <name>` and open the address it prints.

| Example | What it shows | Lines |
| --- | --- | --- |
| `minimal` | Helix keys in an editor, nothing else. | 4 |
| `notes` | An app with its own features: notes you open, save and tick off, its own keys and menu, a command palette, a toolbar button and a status bar. [Build an app](../docs/build-an-app.md) goes through it. | 133 |
| `code` | A code editor with a real language server: go to definition, hover, rename, completion, code actions, diagnostics, formatting, tabs, splits, a file picker, a command palette, a shell, syntax colors and line numbers. | 560, plus 90 on the server |

`code` needs `rust-analyzer` and the Rust grammar: `bun run grammars --out play/languages rust`.

For an Obsidian plugin, see [helix-motions](https://github.com/Kosyakssss/helix-motions). It handles tables, properties and Live Preview, so it also uses `helix-cm6/engine`.
