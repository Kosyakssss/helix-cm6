# Keys

Keys come in three layers. Each one goes on top of the one before:

1. **Editing keys.** Helix's keys for commands that edit text, such as `w`, `d` and `x`. They are always on.
2. **App keys.** The `keys` you pass to `helix()`.
3. **User keys.** The `[keys.*]` tables in the user's config.

## Choose your keys

By default your app adds no keys. Your commands run from the command line or `helixRun` until you bind them.

To use Helix's own layout, pass `helixAppKeys`:

```ts
const extension = helix({
  keys: helixAppKeys,
  commands: {
    file_picker: () => openFilePicker(),
  },
});
```

`helixAppKeys` only adds keys for commands you supply. With this code `Space f` works, and `Space b` is not in the key help.

To choose your own layout, pass your own table:

```ts
const extension = helix({
  keys: { normal: { "C-p": "file_picker" } },
  commands: {
    file_picker: () => openFilePicker(),
  },
});
```

To have both, pass a list. Later tables merge into earlier ones:

```ts
const extension = helix({
  keys: [helixAppKeys, { normal: { "C-p": "file_picker" } }],
  commands: {
    file_picker: () => openFilePicker(),
  },
});
```

## Write a key table

A table has the same form as `[keys.*]` in Helix's config:

```ts
const keys = {
  normal: {
    "C-s": ":write",
    D: "@xd",
    "C-q": ["save_selection", "keep_primary_selection"],
    space: {
      t: { name: "Tabs", n: "tabs:new", w: "tabs:close" },
    },
  },
  insert: { "C-t": "notes:date" },
};
```

| Value | Runs |
| --- | --- |
| `"file_picker"` | A command. |
| `":write"` | A typed command. |
| `"@xd"` | A macro: these keys, in order. |
| `["save_selection", "keep_primary_selection"]` | Several, in order. |
| A table | Opens a menu. |

Two fields only work in app keys, because Helix's config does not have them:

| Field | Description |
| --- | --- |
| `name` | The title of a menu in the key help. |
| `sticky` | `true` keeps the menu open after a command. |

A `normal` key also applies in select mode.

## Add the user's keys

The user's config goes on top of everything:

```ts
const extension = helix({
  config: helixToml,
  keys: helixAppKeys,
  commands: {
    file_picker: () => openFilePicker(),
    write: ({ view }) => saveNote(view),
  },
});
```

```toml
[keys.normal.space]
f = ":write"
g = "file_picker"
```

| Your app | The user's config | Result |
| --- | --- | --- |
| Has `helixAppKeys` | No keys | `Space f` opens files. |
| Has `helixAppKeys` | The file above | `Space f` saves. `Space g` opens files. |
| Has `helixAppKeys` | `f = "no_op"` | `Space f` does nothing and leaves the key help. |
| Has no `keys` | `f = "file_picker"` | `Space f` opens files. |
| Binds `C-p` | `C-p = "no_op"` | `Ctrl-p` does nothing. |
| Has no file picker | `f = "file_picker"` | `Space f` is greyed out in the key help. Pressing it says it is not available. |

Users can bind any command your app supplies, even if your app gives it no key.

## Find mistakes

A key for a name that is no command at all gives a warning. `helixConfigWarnings` lists them, and the first one shows as a message. See [Config](config.md).
