# Contributing

## Rule

This is a port. Behavior follows Helix master at commit `ba40e54742`. If Helix does not have a command or an option, this engine does not have it either.

## Setup

```sh
bun install
bun run check            # TypeScript
bun run lint             # ESLint
bun run build            # dist/, committed; CI checks that it matches the source
sh tree-sitter/build.sh  # rebuild tree-sitter.wasm (downloads wasi-sdk once)
sh regex/build.sh        # rebuild regex.wasm (needs rustup; installs Rust 1.99.1 with the wasm target)
```

## Tests

- `sh test/oracle/setup.sh` puts Helix next to this repo (or into `$HELIX_DIR`) with the oracle test and the markdown grammars. Then `bun test` compares the headless engine with real Helix.
- `bun test/oracle/diff.ts hand|fuzz|md|mdfuzz [filter]` lists failures in a readable form.

- `bun run play` opens the bare editor, to try changes by hand.

See `docs/testing.md` for details.

## Pull requests

Add a case to `test/oracle/suites.ts` for engine changes. After adding a command, run `bun run names`, which updates the command name types. Run `bun run build` and commit `dist/` with the change. Keep `bun run check`, `bun run lint`, `bun test`, `bun run browser` and `bun run views` passing.
