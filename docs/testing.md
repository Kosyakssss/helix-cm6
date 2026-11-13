# Testing

## Against real Helix

`test/oracle/oracle.rs` is a Helix integration test that runs key sequences in real Helix and returns text, selections and mode. A case with `lang` opens the text in that language, with only that language loaded (markdown also loads markdown.inline). `sh test/oracle/setup.sh` clones Helix at `a714a818a3` next to this repo (or into `$HELIX_DIR`), copies the test in, builds the two markdown grammars, and builds the languages in `test/oracle/languages.txt` twice from the same sources: as native libraries for Helix and as wasm modules for the engine, into `test/oracle/languages` (not committed). Building it needs `cargo`, `cc`, Git and network access.

- `bun test`: runs the hand suite (4,464 cases), 5 fuzz seeds (~15,000 cases), the markdown suite (9,768 cases), the code suite (8 languages, ~8,600 cases) and 3 markdown fuzz seeds (~6,000 cases) through the headless engine and compares with Helix. It also compares syntax highlighting and rainbow brackets, span by span with Helix's default theme scopes, on samples of each language and on injections. Results from Helix are cached per Helix commit in `test/oracle/cache-<commit>.json` (not committed). Missing cases call Helix.
- `bun test/oracle/diff.ts hand|fuzz|md|mdfuzz|code [filter]`: same, with a readable failure list.
- Grapheme clusters: `src/graphemes.ts` ports Helix's `unicode-segmentation` 1.13.3 (Unicode 17). `bun scripts/grapheme-table.ts` regenerates `src/core/grapheme-table.ts` from the crate in the cargo registry. `bun test` compares about 78,000 strings with the crate itself.
- `bun test/oracle/one.ts cases.json`: check a few `[markup, keys]` pairs.

## In an editor

The oracle checks the engine, not a view: keys, IME and drawing need tests in a real editor. helix-motions runs the same Helix cases as real key events in Obsidian (`test/e2e/differential.ts`).

- `bun run browser [filter]`: opens each hand suite case in a plain CodeMirror 6 editor with `helix()` in headless Chromium, Firefox and WebKit, types the keys as key events (CDP in Chromium, Playwright's keyboard in the others) and compares text, selections, primary selection and mode with Helix. It needs the oracle (or a filled cache) and the browsers: `bun x playwright-core install chromium-headless-shell firefox webkit`. `BROWSERS` picks some of them, for example `BROWSERS=firefox`. `BROWSER_JOBS` sets the number of pages (a positive integer, default 8). Oracle errors fail the run.
- `bun run views`: two editors that share one `helix()` extension: prompts, messages and jump labels show in the focused editor, and a key in one editor cancels a prompt open in the other. It also checks that a selection set by the app stays, that a Meta key bound in the config runs its command, that an unbound Meta key goes to the browser, the `helixHooks` motions, the app commands and keys, and every function of the stable API.
- `bun run play`: not a test. The bare editor, to try the engine by hand.
- Both scripts run in all three browsers unless `BROWSERS` says otherwise. To use another Chromium build, set `CHROMIUM_PATH` to its executable.
