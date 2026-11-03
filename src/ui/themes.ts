import type { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";
import type { HelixEditor } from "../core/editor";
import { helixEnv } from "../view/view";
import { parseTheme, scopeClass, styleCss, themeStyle, type Theme, type ThemeLoader, type ThemeStyle } from "./theme";

const UI_SCOPES = [
  "ui.linenr",
  "ui.linenr.selected",
  "ui.statusline.normal",
  "ui.statusline.insert",
  "ui.statusline.select",
  "ui.statusline.separator",
  "ui.virtual.whitespace",
  "ui.virtual.indent-guide",
  "ui.virtual.ruler",
  "ui.virtual.wrap",
  "ui.virtual.jump-label",
  "ui.virtual.inlay-hint",
  "ui.cursorcolumn.primary",
  "ui.cursorcolumn.secondary",
  "ui.popup",
  "ui.popup.info",
  "ui.window",
  "ui.help",
  "ui.menu",
  "ui.menu.selected",
  "ui.menu.scroll",
  "ui.text",
  "ui.text.focus",
  "ui.text.inactive",
  "ui.text.info",
  "ui.text.directory",
  "ui.picker.header",
  "ui.picker.header.column",
  "ui.picker.header.column.active",
  "ui.highlight",
  "ui.bufferline",
  "ui.bufferline.active",
  "ui.bufferline.background",
  "error",
  "warning",
  "info",
  "hint",
  "diagnostic",
  "diagnostic.hint",
  "diagnostic.info",
  "diagnostic.warning",
  "diagnostic.error",
  "diagnostic.unnecessary",
  "diagnostic.deprecated",
  "diff.plus.gutter",
  "diff.minus.gutter",
  "diff.delta.gutter",
  "markup.heading",
  "markup.raw.inline",
];

function variables(theme: Theme): string {
  const get = (scope: string): ThemeStyle | null => themeStyle(theme, scope);
  const out: string[] = [];
  const set = (name: string, value: string | undefined) => {
    if (value) out.push(`--hx-${name}: ${value}`);
  };
  const background = get("ui.background");
  const text = get("ui.text");
  set("bg", background?.bg);
  set("fg", text?.fg ?? background?.fg);
  set("selection", get("ui.selection")?.bg);
  set("selection-primary", get("ui.selection.primary")?.bg);
  set("cursor-bg", get("ui.cursor")?.bg);
  set("cursor-fg", get("ui.cursor")?.fg);
  set("cursor-primary-bg", get("ui.cursor.primary")?.bg);
  set("cursor-primary-fg", get("ui.cursor.primary")?.fg);
  set("cursorline", get("ui.cursorline.primary")?.bg ?? get("ui.cursorline")?.bg);
  set("panel", get("ui.popup")?.bg ?? get("ui.statusline")?.bg);
  set("border", get("ui.window")?.fg ?? get("ui.popup")?.fg);
  set("muted", get("ui.text.inactive")?.fg);
  set("error", get("error")?.fg);
  set("warning", get("warning")?.fg);
  set("info", get("info")?.fg);
  set("hint", get("hint")?.fg);
  set("linenr", get("ui.linenr")?.fg);
  set("linenr-selected", get("ui.linenr.selected")?.fg);
  set("statusline-bg", get("ui.statusline")?.bg);
  set("statusline-fg", get("ui.statusline")?.fg);
  set("statusline-inactive-bg", get("ui.statusline.inactive")?.bg);
  set("statusline-inactive-fg", get("ui.statusline.inactive")?.fg);
  set("whitespace", get("ui.virtual.whitespace")?.fg);
  set("indent-guide", (get("ui.virtual.indent-guide") ?? get("ui.virtual.whitespace"))?.fg);
  set("ruler", get("ui.virtual.ruler")?.bg);
  set("cursorcolumn", get("ui.cursorcolumn.primary")?.bg ?? get("ui.cursorcolumn")?.bg);
  set("wrap", get("ui.virtual.wrap")?.fg);
  set("menu-bg", get("ui.menu")?.bg);
  set("menu-fg", get("ui.menu")?.fg);
  set("menu-selected-bg", get("ui.menu.selected")?.bg);
  set("menu-selected-fg", get("ui.menu.selected")?.fg);
  set("popup-bg", get("ui.popup")?.bg);
  set("popup-fg", get("ui.popup")?.fg);
  set("help-bg", get("ui.help")?.bg);
  set("help-fg", get("ui.help")?.fg);
  set("diff-plus", get("diff.plus.gutter")?.fg);
  set("diff-minus", get("diff.minus.gutter")?.fg);
  set("diff-delta", get("diff.delta.gutter")?.fg);
  return out.join("; ");
}

export function themeCss(theme: Theme, root: string): string {
  const rules: string[] = [];
  rules.push(`.${root}.cm-editor { ${variables(theme)}; background-color: var(--hx-bg, inherit); color: var(--hx-fg, inherit) }`);
  rules.push(`.${root} .cm-gutters { background-color: var(--hx-bg, inherit); border: none }`);
  rules.push(`.${root} .cm-content { caret-color: var(--hx-fg, inherit) }`);
  for (const scope of theme.scopes) {
    if (scope.startsWith("ui.")) continue;
    const css = styleCss(theme.styles.get(scope)!);
    if (css) rules.push(`.${root} .${scopeClass(scope)} { ${css} }`);
  }
  for (const scope of UI_SCOPES) {
    const style = themeStyle(theme, scope);
    if (!style) continue;
    const css = styleCss(style);
    if (css) rules.push(`.${root} .${scopeClass(scope)} { ${css} }`);
  }
  return rules.join("\n");
}

const ids = new WeakMap<Theme, string>();
let nextId = 0;

function classOf(theme: Theme, doc: Document): string {
  let id = ids.get(theme);
  if (!id) {
    id = `hx-theme-${++nextId}`;
    ids.set(theme, id);
  }
  if (!doc.getElementById(id)) {
    const style = doc.createElement("style");
    style.id = id;
    style.textContent = themeCss(theme, id);
    doc.head.appendChild(style);
  }
  return id;
}

export interface ThemeOptions {
  theme?: string;
  themes?: Record<string, string>;
  load?: ThemeLoader;
  names?: () => string[];
}

export function setEditorThemes(editor: HelixEditor, options: ThemeOptions): void {
  const load: ThemeLoader = (name) => options.themes?.[name] ?? options.load?.(name) ?? null;
  editor.themes = {
    names: () => options.names?.() ?? Object.keys(options.themes ?? {}),
    load: (name) => {
      const text = load(name);
      return text === null ? null : parseTheme(name, text, load);
    },
  };
  if (options.theme) {
    const theme = editor.themes.load(options.theme);
    if (theme) editor.theme = theme;
  }
}

export function helixThemes(options: ThemeOptions = {}): Extension {
  return [
    ViewPlugin.fromClass(
      class {
        constructor(view: EditorView) {
          const editor = view.state.facet(helixEnv)?.editor;
          if (editor && !editor.themes) setEditorThemes(editor, options);
        }
      },
    ),
    EditorView.editorAttributes.of((view) => {
      const theme = view.state.facet(helixEnv)?.editor.theme;
      return theme ? { class: classOf(theme, view.dom.ownerDocument) } : null;
    }),
  ];
}
