import { Facet, type Extension, type TransactionSpec } from "@codemirror/state";
import { EditorView, drawSelection } from "@codemirror/view";
import { HelixEditor } from "./core/editor";
import { commandContext, type AppCommand, type HelixCommand, type HelixCommandSpec } from "./commands/app";
import type { Jump } from "./commands/jumps";
import type { Variable } from "./commands/expansion";
import type { Host } from "./core/host";
import type { ShellRunner } from "./commands/shell";
import { defaultConfig } from "./config";
import { loadConfig, loadKeys, type HelixKeys } from "./config-loader";
import { buildKeymaps } from "./keymap";
import { Registers } from "./registers";
import type { HelixCommandName } from "./commands/names";
import type { SyntaxSessions } from "./syntax/languages";
import type { LanguageId } from "./syntax/injections";
import type { LanguageLoader, LanguageSource, QueryFile } from "./syntax/loader";
import { SystemClipboard } from "./view/clipboard";
import { loadSyntax } from "./view/syntax";
import { statusOf, type HelixStatus } from "./view/status";
import { nativeSelectionTheme } from "./view/theme";
import { helixExtension, uiRefresher } from "./view/view";
import { makeViewOps } from "./view/viewops";
import { loadRegex, wasmBytes, type WasmBytes, type WasmSource } from "./view/wasm";

export interface HelixGrammars {
  grammar(name: string): WasmBytes | null | Promise<WasmBytes | null>;
  query(language: string, file: QueryFile): string | null | Promise<string | null>;
}

export type HelixCommands = { [name in HelixCommandName]?: HelixCommand | HelixCommandSpec } & { [name: string]: HelixCommand | HelixCommandSpec | undefined };

export interface HelixRange {
  anchor: number;
  head: number;
  from: number;
  to: number;
  cursor: number;
}

export interface HelixSelection {
  ranges: readonly HelixRange[];
  primary: HelixRange;
  primaryIndex: number;
}

export interface HelixJump extends HelixSelection {
  path: string;
}

export interface HelixConfiguration {
  config?: string | Record<string, unknown> | null;
  commands?: HelixCommands;
  keys?: HelixKeys | readonly HelixKeys[];
}

export interface HelixOptions extends HelixConfiguration {
  languages?: string | readonly string[];
  grammars?: string | HelixGrammars;
  regex?: WasmSource;
  syntax?: WasmSource | false;
  shell?: ShellRunner;
  completePath?: (prefix: string) => readonly string[];
  openJump?: (jump: HelixJump, view: EditorView) => unknown;
  variable?: (name: Variable, view: EditorView) => string | null;
  onStatus?: (status: HelixStatus, view: EditorView) => void;
  panel?: boolean;
}

export interface HelixDocument {
  path?: string | null;
  name?: string | null;
  language?: string | null;
}

const hostOf = new WeakMap<EditorView, Host>();

export function helixHost(view: EditorView): Host | null {
  return hostOf.get(view) ?? null;
}

export const helixEditor = Facet.define<HelixEditor, HelixEditor | null>({ combine: (values) => values[0] ?? null });

export interface HelixInstance {
  configure(changes: HelixConfiguration): readonly string[];
  warnings(): readonly string[];
}

export const helixInstance = Facet.define<HelixInstance, HelixInstance | null>({ combine: (values) => values[0] ?? null });

export const helixDocument = Facet.define<HelixDocument, HelixDocument>({
  combine: (values) => Object.assign({}, ...values) as HelixDocument,
});

export function selectionInfo(selection: Jump["selection"], doc: EditorView["state"]["doc"]): HelixSelection {
  const ranges = selection.ranges.map((r) => ({ anchor: r.anchor, head: r.head, from: r.from(), to: r.to(), cursor: r.cursor(doc) }));
  return { ranges, primary: ranges[selection.primaryIndex]!, primaryIndex: selection.primaryIndex };
}

function grammarsAt(base: string): HelixGrammars {
  const root = base.replace(/\/+$/, "");
  const get = async (path: string) => {
    const response = await fetch(`${root}/${path}`);
    return response.ok ? response : null;
  };
  return {
    grammar: (name) => get(`grammars/${name}.wasm`),
    query: async (language, file) => (await get(`queries/${language}/${file}`))?.text() ?? null,
  };
}

function languageSource(option: HelixOptions["grammars"]): LanguageSource | null {
  if (!option) return null;
  const grammars = typeof option === "string" ? grammarsAt(option) : option;
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

function adapted(command: HelixCommand | HelixCommandSpec): AppCommand | { run: AppCommand; doc?: string; complete?: (input: string) => readonly string[] } {
  const wrap = (run: HelixCommand): AppCommand => (cx, args) => run(commandContext(cx, args));
  return typeof command === "function" ? wrap(command) : { ...command, run: wrap(command.run) };
}

export function helix(options: HelixOptions = {}): Extension {
  let source = options.config ?? null;
  let commands = options.commands ?? {};
  let keys = options.keys;
  let warnings: readonly string[] = [];
  const lookup = (name: string) => {
    const found = Object.prototype.hasOwnProperty.call(commands, name) ? commands[name] : undefined;
    return found ? adapted(found) : null;
  };
  const known = (name: string) => lookup(name) !== null;
  const editor = new HelixEditor(buildKeymaps(), defaultConfig());
  editor.visualLines = true;
  editor.shell = options.shell ?? null;
  editor.app = {
    command: lookup,
    commandNames: () => Object.keys(commands),
    openJump: (cx, jump) => {
      if (cx.host.view) options.openJump?.({ path: jump.docId, ...selectionInfo(jump.selection, cx.host.state.doc) }, cx.host.view);
    },
    variable: (cx, name) => (cx.host.view ? (options.variable?.(name, cx.host.view) ?? null) : null),
  };
  if (options.completePath) {
    const complete = options.completePath;
    editor.pathCompleter = (prefix) => [...complete(prefix)];
  }
  const load = () => {
    const loaded = loadConfig(source, undefined, known);
    const app = loadKeys(keys, known);
    editor.config = loaded.config;
    editor.keymaps = buildKeymaps(loaded.keys, { app: app.keys, available: (name) => editor.hasCommand(name) });
    editor.autoinfo = null;
    warnings = [...loaded.warnings, ...app.warnings];
    if (warnings.length > 0) editor.setError(`config: ${warnings[0]}${warnings.length > 1 ? ` (and ${warnings.length - 1} more)` : ""}`);
  };
  load();
  const clipboard = new SystemClipboard();
  editor.registers = new Registers(clipboard);
  editor.viewOps = makeViewOps(() => editor.config.scrolloff);

  const hosts = new WeakMap<EditorView, Host>();
  let count = 0;
  const hostFor = (view: EditorView): Host => {
    let host = hosts.get(view);
    if (!host) {
      const pane = `editor-${++count}`;
      host = {
        get state() {
          return view.state;
        },
        dispatch: (...specs: TransactionSpec[]) => view.dispatch(...specs),
        view,
        get id() {
          return view.state.facet(helixDocument).path ?? pane;
        },
        get name() {
          const document = view.state.facet(helixDocument);
          return document.name ?? document.path ?? "[scratch]";
        },
        get path() {
          return view.state.facet(helixDocument).path ?? null;
        },
        paneId: pane,
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
      .then(async (engine) => {
        const languages = options.languages ?? (options.grammars ? ((await import("./languages")).languagesToml as string) : undefined);
        return loadSyntax(win, syntax, {
          regex: engine,
          languages: typeof languages === "string" ? [languages] : languages,
          source: languageSource(options.grammars),
        });
      })
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
      if (!options.onStatus) return;
      const status = statusOf(editor, hostFor(view), view === active);
      const key = JSON.stringify(status);
      if (!status || lastStatus.get(view) === key) return;
      lastStatus.set(view, key);
      options.onStatus(status, view);
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
      editor.forgetSaved(hostFor(view));
      if (active === view) active = null;
    },
  });
  const instance: HelixInstance = {
    configure(changes) {
      if (changes.config !== undefined) source = changes.config;
      if (changes.commands) commands = changes.commands;
      if (changes.keys) keys = changes.keys;
      load();
      for (const open of views) {
        editor.detectIndent(hostFor(open));
        open.dispatch({});
      }
      rerender();
      return warnings;
    },
    warnings: () => warnings,
  };
  return [extension, helixEditor.of(editor), helixInstance.of(instance), drawSelection(), nativeSelectionTheme, nativeUndo, clipboardReader];
}
