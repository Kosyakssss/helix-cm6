# Colors

What helix-cm6 draws follows CSS variables. Each has a default from the system colors, so light and dark mode work with no setup.

## Set the variables

Set them on the editor or any parent:

```css
.cm-editor {
  --hx-selection: #cde6f7;
  --hx-cursor-primary-bg: #205ea6;
  --hx-cursor-primary-fg: #fffcf0;
}

@media (prefers-color-scheme: dark) {
  .cm-editor {
    --hx-selection: #1a4f8c;
    --hx-cursor-primary-bg: #4385be;
    --hx-cursor-primary-fg: #100f0f;
  }
}
```

| Variable | Used for |
| --- | --- |
| `--hx-fg`, `--hx-bg` | Text and background. |
| `--hx-selection` | Selections. |
| `--hx-cursor-primary-bg`, `--hx-cursor-primary-fg` | The primary block cursor. |
| `--hx-cursor-bg` | Other cursors. |
| `--hx-cursor-radius` | The corners of a cursor. |
| `--hx-panel`, `--hx-border`, `--hx-muted`, `--hx-hover`, `--hx-accent`, `--hx-error` | The command line and the key help. |
| `--hx-panel-font`, `--hx-panel-font-size` | Their font. |

## Style by mode

The editor has these classes:

| Class | When |
| --- | --- |
| `hx` | Always. |
| `hx-normal`, `hx-select`, `hx-insert` | In that mode. |
| `hx-shape-block`, `hx-shape-bar`, `hx-shape-underline` | The cursor shape. |

For syntax colors, see [Languages](languages.md).
