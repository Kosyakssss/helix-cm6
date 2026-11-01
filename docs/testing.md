# Testing

## Against real Helix

`test/oracle/oracle.rs` is a Helix integration test that runs key sequences in real Helix and returns text, selections and mode. A case with `lang: "markdown"` opens the text as markdown, with only the markdown and markdown.inline languages loaded (the tree-sitter build has no other grammars) and tab indentation. `sh test/oracle/setup.sh` clones Helix at `ba40e54742` next to this repo (or into `$HELIX_DIR`), copies the test in and builds the two markdown grammars. Building it needs `cargo` and `cc`.

- `bun test`: runs the hand suite (4,464 cases), 5 fuzz seeds (~15,000 cases), the markdown suite (9,768 cases) and 3 markdown fuzz seeds (~6,000 cases) through the headless engine and compares with Helix. Results from Helix are cached per Helix commit in `test/oracle/cache-<commit>.json` (not committed). Missing cases call Helix.
- `bun test/oracle/diff.ts hand|fuzz|md|mdfuzz [filter]`: same, with a readable failure list.
- Grapheme clusters: `src/graphemes.ts` ports Helix's `unicode-segmentation` 1.13.3 (Unicode 17). `bun scripts/grapheme-table.ts` regenerates `src/core/grapheme-table.ts` from the crate in the cargo registry. `bun test` compares about 78,000 strings with the crate itself.
- `bun test/oracle/one.ts cases.json`: check a few `[markup, keys]` pairs.

## In an editor

The oracle checks the engine, not a view: keys, IME and drawing need tests in a real editor. helix-motions runs the same Helix cases as real key events in Obsidian (`test/e2e/differential.ts`).

- `bun run browser [filter]`: opens each hand suite case in a plain CodeMirror 6 editor with `helix()` in headless Chromium, types the keys as CDP key events and compares text, selections, primary selection and mode with Helix. It needs the oracle (or a filled cache) and Chromium: `bun x playwright-core install chromium-headless-shell`. `BROWSER_JOBS` sets the number of pages (a positive integer, default 8). Oracle errors fail the run.
