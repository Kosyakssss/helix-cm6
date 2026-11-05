# Roadmap

The goal is all of Helix that makes sense in CodeMirror 6, ported from Helix's source, with a public API that apps can build on. `docs/parity.md` lists every Helix command, option and UI part and its state. Nothing goes to npm until the maintainer has checked the result.

The engine became an editing core after Phase 5: the UI components from Phase 3 and the reference app from Phase 4 are gone, and apps supply them. `docs/api.md` says how. What is left in the core: snippets with their tabstops, `mouse = false`, and IME input in normal mode and prompts. Phase 6 is the maintainer's check before npm.

The engine work lands on `main` here. The Obsidian work lands on helix-motions' `on-helix-cm6` branch, which pins a commit of this repo. Each phase ends with all tests green in Chromium, Firefox and WebKit, a report, and a push.

## Phase 0: audit

- Find the root cause of each known bug in the engine, the view layer, the playground and the plugin.
- Write `docs/parity.md` from the pinned Helix source: every static command, typed command, option, default key, statusline element, gutter and UI component, marked done, partial, missing or out of scope.
- Run the browser tests in Firefox and WebKit as well as Chromium.

## Phase 1: fix what exists

- Fix the bugs from Phase 0. Each fix gets an oracle case or a browser case.
- Read the system clipboard before a paste from `+` or `*`.
- In normal and select mode, a Ctrl key that the keymap does not bind goes to the browser and the OS.

## Phase 2: core foundations

- Languages: each document has a language. Grammars load as wasm through the app. Helix's highlight, textobject, indent and injection queries apply per language.
- Per-language settings from a `languages.toml` like Helix's.
- Commands that need an outside source (LSP, formatter, shell, diff base, snippets) go to the app as commands, with async results that become selections, jumps and one undo step.
- A public state API: mode, pending keys, count, register, selections and messages, with events.
- Hooks for apps: a motion that reaches the edge of a range hands off to the app; ranges that motions skip or treat as one row; per-editor command overrides; macros and `.` that follow focus.
- A stable public API, separate from internals, with API docs.

## Phase 5: Obsidian

On `on-helix-cm6`, each with an e2e scenario: the known bugs, frontmatter and properties, embeds, tables.

## Phase 6: hardening

Fuzzing, mouse, IME, the 20,000-line case, a last API review. Then the maintainer checks the result, and the package goes to npm.

## Out of scope

The debugger (DAP), `suspend`, terminal drawing and key protocols, Helix's grammar fetching and building, clipboard providers, `:log-open`, LSP server management, workspace trust and `:encoding` other than UTF-8.
