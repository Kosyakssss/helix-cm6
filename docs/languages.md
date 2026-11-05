# Languages

Syntax-aware commands such as `Alt-o` and `mm` use a syntax tree. Markdown is built in. Other languages come as wasm modules, and load when a document first needs them.

## Add a language

Build the grammars you need:

```sh
bun run grammars --out public/languages rust python
```

This builds each grammar from the repository and revision in Helix's `languages.toml`, and copies its Helix queries. It needs Git and network access. `--all` builds every grammar. `--themes` also copies Helix's themes.

Serve the folder, and pass its URL as `grammars`:

```ts
const extension = helix({ grammars: "/languages" });

new EditorView({
  parent: document.body,
  extensions: [extension, helixDocument.of({ path: "src/main.rs" })],
});
```

The path picks the language. To set it yourself, use `helixDocument.of({ language: "rust" })`.

## Load grammars your own way

Pass an object if the files do not come from a URL:

```ts
const extension = helix({
  grammars: {
    grammar: (name) => readGrammar(name),
    query: (language, file) => readQuery(language, file),
  },
});
```

`languages` takes the text of one or more `languages.toml` files. With `grammars`, the default is Helix's.

## Add syntax colors

helix-cm6 does not color text. `helixHighlights` gives spans with their Helix scopes, and your app decides how they look:

```ts
const spans = helixHighlights(view, view.viewport.from, view.viewport.to);
```

Each span has `from`, `to` and `scopes`. `helixRainbow(view, from, to)` gives bracket levels, with `from`, `to` and `level`.

On a long file, each call after an edit parses the file again, so wait until typing pauses. `helixSyntaxChanged(update)` says a language has loaded, so you can redraw. [`examples/code/ui.ts`](../examples/code/ui.ts) does both.

## Load the wasm modules

Search and the syntax tree each use a wasm module, built into the package and loaded on first use. helix-cm6 makes no network requests of its own.

To load them from elsewhere, use the `regex` and `syntax` options. Each takes a `Uint8Array`, an `ArrayBuffer`, a `Response`, or a function that returns one. The raw modules are exported as `helix-cm6/regex.wasm` and `helix-cm6/tree-sitter.wasm`.

```ts
const extension = helix({
  regex: () => fetch("/wasm/regex.wasm"),
  syntax: () => fetch("/wasm/tree-sitter.wasm"),
});
```

`syntax: false` turns the syntax tree off.
