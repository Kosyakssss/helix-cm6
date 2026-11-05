# Language servers

helix-cm6 does not talk to a language server. Your app has the client, and connects it through commands and data. [`examples/code`](../examples/code) does this with rust-analyzer.

## Show diagnostics

`helixSetDiagnostics` feeds `]d`, `[d`, `:yank-diagnostic`, the counts in the status and the gutter data. Diagnostics follow edits.

```ts
server.onDiagnostics((diagnostics) => {
  helixSetDiagnostics(
    view,
    diagnostics.map((item) => ({ from: item.from, to: item.to, message: item.message, severity: "error" })),
  );
});
```

Each has `from`, `to` and `message`, and can have `severity`, `source`, `code` and `tags`.

## Go to a definition

Supply `goto_definition`. For one result, select it with `jump: true` so that `C-o` comes back:

```ts
const extension = helix({
  commands: {
    goto_definition: async ({ view }) => {
      const target = await server.definition(helixSelection(view).primary.cursor);
      if (target) helixSelect(view, target, { jump: true });
    },
  },
});
```

If the result is in another document, call `helixRun(view, "save_selection")` before you switch. For several results, open your picker.

## Rename a symbol

```ts
const extension = helix({
  commands: {
    rename_symbol: async ({ view }) => {
      const name = await helixPrompt(view, { label: "rename: " });
      if (name) helixEdit(view, await server.rename(helixSelection(view).primary.cursor, name));
    },
  },
});
```

## Connect the rest

| Helix feature | How |
| --- | --- |
| `hover`, `signature_help`, `code_action`, `completion` | App commands that draw the result. `helixEdit` applies edits, and `helixSnippet` inserts a snippet from a completion. |
| `format_selections`, `:format` | App commands that call `helixEdit`. |
| `select_references_to_symbol_under_cursor` | An app command that calls `helixSelect` with a list. |
