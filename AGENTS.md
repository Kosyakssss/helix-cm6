# AGENTS.md

Helix for CodeMirror 6, ported from Helix's source. Read `CONTRIBUTING.md` and `docs/testing.md` first. The Obsidian plugin [helix-motions](https://github.com/Kosyakssss/helix-motions) is built on this engine; its `docs/scope.md` lists every Helix command and option and what the plugin does with it.

## Philosophy

- Helix is the spec. Behaviour follows the pinned Helix master commit in `CONTRIBUTING.md`, and the oracle decides. If Helix does not have a command, object or option, we do not have it.
- Helix master only. Helix forks fork this repo and point the oracle at their own commit.
- Port, do not invent. Find the Rust code in Helix and port it close to line by line, so later Helix changes are easy to port too.
- App-specific behaviour (pickers, files, buffers, a status bar, workarounds for one editor) goes behind an interface or a hook that the app supplies. Not into the engine.
- Think of a 20,000-line document. Measure with `test/perf.ts`.

## Architecture

- Plain CodeMirror 6 and DOM. No imports from an app (`obsidian` or other).
- `@codemirror/*` are peer dependencies. The only runtime dependency is `smol-toml`. Ask before you add one.
- Tree-sitter and regex are our own wasm builds (`tree-sitter/build.sh`, `regex/build.sh`). CI checks that they rebuild byte for byte.

## Code that runs inside Obsidian

helix-motions bundles this code into its `main.js`, so it must stay safe there. Obsidian's community review checks plugins with `eslint-plugin-obsidianmd`. That linter runs in the plugin repo, not here, but these rules apply to this code too:

- Obsidian has popout windows, each with its own `window` and `document`. Create DOM nodes with the `ownerDocument` of the editor or the parent node, not the global `document`. Use the timers of the right window, for example `view.dom.ownerDocument.defaultView` or `window.setTimeout`, not bare `setTimeout`.
- No console logging.
- No Node or Electron APIs. Use `navigator.clipboard`.
- No `:has` in CSS.

## How to work

- If the request is to diagnose, find the root cause and report it. Do not fix until asked.
- Discuss large changes and API choices before you make them.
- An engine change gets a case in `test/oracle/suites.ts`. Run `bun run check`, `bun run lint` and `bun test`.
- A change that the oracle cannot see (keys, IME, drawing) needs a test in a real editor. See `docs/testing.md`.
- If Helix itself has a bug, find or file a short upstream issue, and write down what the port does.

## Releases

Only the maintainer tags and releases.

## Style

- No code comments.
- A commit message is one sentence that says what changed for the user of the engine. See `git log`.
- Docs: plain, short sentences. Do not sell Helix; readers know it.

## Repository

- Treat everything committed as public. No personal data, machine-local state or home paths.
