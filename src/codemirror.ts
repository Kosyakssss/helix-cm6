import { Facet, type Extension, type TransactionSpec } from "@codemirror/state";
import { EditorView, drawSelection } from "@codemirror/view";
import { Context, HelixEditor } from "./core/editor";
import type { AppCommand, AppCommandInfo, HelixApp } from "./commands/app";
import type { Host } from "./core/host";
import type { ShellRunner } from "./commands/shell";
import { loadConfig } from "./config-loader";
import { executeCommand, runTypable } from "./commands";
import { buildKeymaps, type KeyLayer } from "./keymap";
import { Registers } from "./registers";
import type { SyntaxSessions } from "./syntax/languages";
import type { LanguageId } from "./syntax/injections";
import type { LanguageLoader, LanguageSource, QueryFile } from "./syntax/loader";
import { SystemClipboard } from "./view/clipboard";
import { loadSyntax } from "./view/syntax";
import { onHelixStatus, statusOf, type HelixStatus } from "./view/status";
import { nativeSelectionTheme } from "./view/theme";
import { helixExtension, uiRefresher } from "./view/view";
import { makeViewOps } from "./view/viewops";
import { loadRegex, wasmBytes, type WasmBytes, type WasmSource } from "./view/wasm";

export interface GrammarSource {
  grammar(name: string): WasmBytes | null | Promise<WasmBytes | null>;
  query(language: string, file: QueryFile): string | null | Promise<string | null>;
}

export interface HelixOptions {
  config?: string;
  languages?: string | readonly string[];
  grammars?: GrammarSource;
  regex?: WasmSource;
  syntax?: WasmSource | false;
  shell?: ShellRunner;
  commands?: Record<string, AppCommand | AppCommandInfo> | ((name: string) => AppCommand | AppCommandInfo | null);
  keys?: KeyLayer;
  openJump?: HelixApp["openJump"];
  variable?: HelixApp["variable"];
  panel?: boolean;
}

export interface HelixDocument {
  path?: string | null;
  name?: string | null;
  language?: string | null;
}

export function helixStatus(view: EditorView): HelixStatus | null {
  const editor = view.state.facet(helixEditor);
  const host = editor ? hostOf.get(view) : undefined;
  return editor && host ? statusOf(editor, host, view.hasFocus) : null;
}

export function helixRun(view: EditorView, command: string): boolean {
  const editor = view.state.facet(helixEditor);
  const host = editor ? hostOf.get(view) : undefined;
  if (!editor || !host) return false;
  const cx = new Context(editor, host, null, null);
  if (command.startsWith(":")) runTypable(cx, command.slice(1));
  else if (command.startsWith("@")) executeCommand(cx, { kind: "macro", keys: command.slice(1) });
  else executeCommand(cx, { kind: "static", name: command });
  for (const callback of cx.callbacks) callback();
  editor.ui.render?.(host);
  return true;
}

export function helixKeys(view: EditorView, keys: string): boolean {
  const editor = view.state.facet(helixEditor);
  const host = editor ? hostOf.get(view) : undefined;
  if (!editor || !host) return false;
  editor.feedKeys(host, keys);
  return true;
}

const hostOf = new WeakMap<EditorView, Host>();

export function helixHost(view: EditorView): Host | null {
  return hostOf.get(view) ?? null;
}

export const helixEditor = Facet.define<HelixEditor, HelixEditor | null>({ combine: (values) => values[0] ?? null });

export const helixDocument = Facet.define<HelixDocument, HelixDocument>({
  combine: (values) => Object.assign({}, ...values) as HelixDocument,
});

function languageSource(grammars: GrammarSource | undefined): LanguageSource | null {
  if (!grammars) return null;
  return {
    grammar: async (name) => {
      const bytes = await grammars.grammar(name);
      return bytes === null ? null : wasmBytes(bytes);
    },
    query: (language, file) => grammars.query(language, file),
  };
}

function detectLanguage(loader: LanguageLoader, view: EditorView): LanguageId | null {
  const document = view.state.facet(helixDocument);
  if (document.language) return document.language === "text" ? null : loader.languageForName(document.language);
  if (!document.path) return null;
  return loader.languageForFilename(document.path) ?? loader.languageForShebang(view.state.doc.sliceString(0, 1024));
}

export function helix(options: HelixOptions = {}): Extension {
  const commands = options.commands;
  const lookup = (name: string): AppCommand | AppCommandInfo | null => (typeof commands === "function" ? commands(name) : (commands?.[name] ?? null));
  const loaded = loadConfig(options.config ?? null, undefined, (name) => lookup(name) !== null);
  const editor = new HelixEditor(buildKeymaps(loaded.keys), loaded.config);
  editor.visualLines = true;
  editor.shell = options.shell ?? null;
  editor.app = {
    command: lookup,
    commandNames: () => (typeof commands === "object" ? Object.keys(commands) : []),
    openJump: options.openJump,
    variable: options.variable,
  };
  editor.keymaps = buildKeymaps(loaded.keys, { app: options.keys, available: (name) => editor.hasCommand(name) });
  const clipboard = new SystemClipboard();
  editor.registers = new Registers(clipboard);
  editor.viewOps = makeViewOps(() => editor.config.scrolloff);

  const hosts = new WeakMap<EditorView, Host>();
  let count = 0;
  const hostFor = (view: EditorView): Host => {
    let host = hosts.get(view);
    if (!host) {
      const id = `editor-${++count}`;
      host = {
        get state() {
          return view.state;
        },
        dispatch: (...specs: TransactionSpec[]) => view.dispatch(...specs),
        view,
        id,
        get name() {
          const document = view.state.facet(helixDocument);
          return document.name ?? document.path ?? "[scratch]";
        },
        get path() {
          return view.state.facet(helixDocument).path ?? null;
        },
        paneId: id,
      };
      hosts.set(view, host);
      hostOf.set(view, host);
    }
    return host;
  };

  let started = false;
  let sessions: SyntaxSessions | null = null;
  const views = new Set<EditorView>();
  const lastStatus = new WeakMap<EditorView, string>();
  const start = (view: EditorView) => {
    if (started) return;
    started = true;
    const win = view.dom.ownerDocument.defaultView ?? window;
    const regex = loadRegex(options.regex).then((engine) => {
      editor.regex = engine;
      return engine;
    });
    regex.catch(() => editor.setError("the regex engine failed to load"));
    const syntax = options.syntax;
    if (syntax === false) return;
    void regex
      .catch(() => null)
      .then((engine) =>
        loadSyntax(win, syntax, {
          regex: engine,
          languages: typeof options.languages === "string" ? [options.languages] : options.languages,
          source: languageSource(options.grammars),
        }),
      )
      .then((loadedSessions) => {
        sessions = loadedSessions;
        editor.languages = loadedSessions.loader;
        for (const open of views) loadedSessions.open(open, open.state.doc, detectLanguage(loadedSessions.loader, open));
        editor.documentLanguage = {
          get: (host) => (host.view ? loadedSessions.languageOf(host.view) : null),
          set: (host, language) => {
            if (host.view) loadedSessions.setLanguage(host.view, language);
            editor.detectIndent(host);
            rerender();
          },
        };
        editor.syntax = (host) => (host.view ? loadedSessions.get(host.view, host.state.doc) : null);
        for (const open of views) editor.detectIndent(hostFor(open));
        loadedSessions.loader.onLoad(() => {
          for (const open of views) open.dispatch({});
        });
        for (const open of views) open.dispatch({});
      })
      .catch(() => editor.setError("the syntax tree failed to load"));
  };

  let active: EditorView | null = null;
  const refresh = uiRefresher(editor);
  const rerender = () => {
    if (active?.dom.isConnected) refresh(hostFor(active));
  };
  editor.ui = {
    notify: () =>
      queueMicrotask(() => {
        if (active?.dom.isConnected) refresh(hostFor(active));
      }),
    render: refresh,
    promptChanged: refresh,
    jumpLabels: refresh,
  };

  const clipboardReader = EditorView.domEventObservers({
    keydown: () => {
      queueMicrotask(() => {
        const pending = editor.keymaps.pending();
        const register = editor.selectedRegister;
        if (register === "+" || register === "*" || (pending.length === 1 && pending[0] === "space")) clipboard.refresh();
      });
    },
  });

  const nativeUndo = EditorView.domEventHandlers({
    beforeinput: (event) => {
      if (event.inputType !== "historyUndo" && event.inputType !== "historyRedo") return false;
      event.preventDefault();
      return true;
    },
  });

  const extension = helixExtension({
    editor,
    hostFor,
    insertKeysHelix: () => true,
    physicalKeys: () => false,
    noPanel: options.panel === false,
    suggestTakes: () => false,
    onFocusChange: (view) => {
      active = view;
    },
    onRender: (view) => {
      if (view.hasFocus) active = view;
      const listeners = view.state.facet(onHelixStatus);
      if (listeners.length === 0) return;
      const status = statusOf(editor, hostFor(view), view === active);
      const key = JSON.stringify(status);
      if (!status || lastStatus.get(view) === key) return;
      lastStatus.set(view, key);
      for (const listener of listeners) listener(status, view);
    },
    onChanges: (view, changes) => editor.docChanged(hostFor(view), changes),
    onDocTransaction: (view, tr) => sessions?.change(view, tr.startState.doc, tr.changes, tr.newDoc),
    onViewOpen: (view) => {
      views.add(view);
      start(view);
      if (sessions) sessions.open(view, view.state.doc, detectLanguage(sessions.loader, view));
      editor.detectIndent(hostFor(view));
    },
    onViewClose: (view) => {
      views.delete(view);
      sessions?.close(view);
      editor.indentStyles.delete(hostFor(view).id);
      if (active === view) active = null;
    },
  });
  return [extension, helixEditor.of(editor), drawSelection(), nativeSelectionTheme, nativeUndo, clipboardReader];
}
