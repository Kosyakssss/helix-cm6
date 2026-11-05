# Hooks

Hooks are for apps where a document is more than plain text, such as tables or hidden ranges. Most apps do not need them. Use [commands](commands.md) first.

## Add a hook

`helixHooks` is a facet, set per editor:

```ts
const tableHooks = helixHooks.of({
  key: (key, { view }) => {
    if (key !== "o" || !inTable(view)) return false;
    addRow(view);
    return true;
  },
});

new EditorView({ extensions: [extension, tableHooks] });
```

A hook returns `true` when it took over.

## Available hooks

| Hook | Runs | Arguments |
| --- | --- | --- |
| `intercept` | Before anything else, in any mode, even with a prompt open. | `key, view` |
| `key` | In normal and select mode, before the keymap, when no keys are pending. | `key, { view, count, register, args }` |
| `command` | Before a command. | `name, { view, count, register, args }` |
| `textObject` | When `mi` or `ma` gets its character. | `kind, ch, { view, count, register, args }` |
| `edge` | When `h`, `j`, `k` or `l` cannot move further. | `edge, view` |
| `motionRanges` | When `h`, `j`, `k` or `l` moves. Returns ranges to treat specially. | `view` |
| `enter` | When a motion reaches an `enter` range. | `range, edge, view` |
| `focused` | When a macro or `.` replays. Returns the editor to use, if focus moved. | `view` |

`edge` gets the direction, whether it extends, the steps left in the count and the goal column.

`stopBeforeEnd` is an option. When `true`, `l` stops on the last character and calls `edge` there. It is for small editors such as table cells.

## Treat ranges specially

`motionRanges` returns a list of `{ from, to, kind }`:

| Kind | `h`, `j`, `k` and `l` |
| --- | --- |
| `skip` | Jump over the range. |
| `row` | Treat the range as one row. |
| `enter` | Call `enter`. |

```ts
const hooks = helixHooks.of({
  motionRanges: (view) => hiddenRanges(view).map(({ from, to }) => ({ from, to, kind: "skip" })),
});
```
