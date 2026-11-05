# AGENTS.md

Helix for CodeMirror 6, ported from Helix's source. Read `CONTRIBUTING.md` and `docs/testing.md` first. The Obsidian plugin [helix-motions](https://github.com/Kosyakssss/helix-motions) is built on this engine; its `docs/scope.md` lists every Helix command and option and what the plugin does with it.

## Philosophy

- Helix is the spec. Behaviour follows the pinned Helix master commit in `CONTRIBUTING.md`, and the oracle decides. If Helix does not have a command, object or option, we do not have it.
- Helix master only. Helix forks fork this repo and point the oracle at their own commit.
- Port, do not invent. Find the Rust code in Helix and port it close to line by line, so later Helix changes are easy to port too.
- This is an editing core, not an editor. UI belongs to the app: pickers, menus, popups, gutters, colours, a status bar. The core gives their data and takes the app's commands. Files, buffers, language servers, a shell and workarounds for one editor go behind a command or a hook that the app supplies.
- An app may add commands that Helix does not have. The core itself has none.
- Think of a 20,000-line document. Measure with `test/perf.ts`.

## Architecture

- Plain CodeMirror 6 and DOM. No imports from an app (`obsidian` or other).
- `@codemirror/*` are peer dependencies. The only runtime dependency is `smol-toml`. Ask before you add one.
- Tree-sitter and regex are our own wasm builds (`tree-sitter/build.sh`, `regex/build.sh`). CI checks that they rebuild byte for byte.
- `src/index.ts` is the public API. Apps import only from it. Add an export there instead of a deep import. helix-motions also uses `src/engine.ts`, the internals.
- `dist/` is committed so a git install needs no build. Run `bun run build` and commit `dist/` with each source change. CI checks that it matches.
- No module-level state. State lives on `HelixEditor`, in editor state, or in the extension that `helix()` returns, so one page can have many editors.
- No app workarounds in the engine. Use a hook, such as the `dropSelectionChange` facet, and let the app supply it.

## Code that runs inside Obsidian

helix-motions bundles this code into its `main.js`, so it must stay safe there. Obsidian's community review checks plugins with `eslint-plugin-obsidianmd`. The plugin's `bun run lint` also runs it on this package's `src`, so a change here can fail the plugin's lint. Its rule `prefer-create-el` is off for this code: `createEl` exists only in Obsidian, and the rule's concern, nodes made in the wrong window, is covered by the first rule below. These rules apply:

- Obsidian has popout windows, each with its own `window` and `document`. Create DOM nodes with the `ownerDocument` of the editor or the parent node, not the global `document`. Use the timers of the right window, for example `view.dom.ownerDocument.defaultView` or `window.setTimeout`, not bare `setTimeout`.
- No console logging.
- No Node or Electron APIs. Use `navigator.clipboard`.
- No `:has` in CSS.

## How to work

- If the request is to diagnose, find the root cause and report it. Do not fix until asked.
- Discuss large changes and API choices before you make them.
- An engine change gets a case in `test/oracle/suites.ts`. Run `bun run check`, `bun run lint`, `bun test`, `bun run browser` and `bun run views`.
- A change that the oracle cannot see (keys, IME, drawing) needs a test in a real editor. See `docs/testing.md`.
- If Helix itself has a bug, find or file a short upstream issue, and write down what the port does.

## Releases

Only the maintainer tags and releases.

## Style

- No code comments.
- A commit message is one sentence that says what changed for the user of the engine. See `git log`.
- Docs: write like the Obsidian docs and kepano's projects (pele, knap, defuddle). Start with one plain sentence that says what the thing does. Then show the smallest code that works. Keep sections short, and link to a focused page instead of adding detail. Use imperative, sentence-case headings, common words, American English and realistic examples. Do not sell Helix; readers know it.

## Repository

- Treat everything committed as public. No personal data, machine-local state or home paths.
