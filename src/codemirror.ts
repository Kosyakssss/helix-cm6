import { EditorState, Facet, type Extension, type TransactionSpec } from "@codemirror/state";
import { EditorView, drawSelection } from "@codemirror/view";
import { HelixEditor } from "./core/editor";
import type { Host } from "./core/host";
import { loadConfig } from "./config-loader";
import { buildKeymaps } from "./keymap";
import { Registers } from "./registers";
import type { SyntaxSessions } from "./syntax/languages";
import { SystemClipboard } from "./view/clipboard";
import { loadSyntax } from "./view/syntax";
import { helixExtension, uiRefresher } from "./view/view";
import { makeViewOps } from "./view/viewops";
import { loadRegex, type WasmSource } from "./view/wasm";

export interface HelixOptions {
  config?: string;
  regex?: WasmSource;
  syntax?: WasmSource | false;
}

export const helixEditor = Facet.define<HelixEditor, HelixEditor | null>({ combine: (values) => values[0] ?? null });

export function helix(options: HelixOptions = {}): Extension {
  const loaded = loadConfig(options.config ?? null);
  const editor = new HelixEditor(buildKeymaps(loaded.keys), loaded.config);
  editor.visualLines = true;
  editor.registers = new Registers(new SystemClipboard());
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
        name: "[scratch]",
        paneId: id,
      };
      hosts.set(view, host);
    }
    return host;
  };

  let started = false;
  let sessions: SyntaxSessions | null = null;
  const views = new Set<EditorView>();
  const start = (view: EditorView) => {
    if (started) return;
    started = true;
    const win = view.dom.ownerDocument.defaultView ?? window;
    void loadRegex(options.regex)
      .then((engine) => {
        editor.regex = engine;
      })
      .catch(() => editor.setError("the regex engine failed to load"));
    if (options.syntax === false) return;
    void loadSyntax(win, options.syntax)
      .then((loadedSessions) => {
        sessions = loadedSessions;
        for (const open of views) loadedSessions.open(open, open.state.doc);
        editor.syntax = (host) => (host.view ? loadedSessions.get(host.view, host.state.doc) : null);
      })
      .catch(() => editor.setError("the syntax tree failed to load"));
  };

  let active: EditorView | null = null;
  const refresh = uiRefresher(editor);
  editor.ui = {
    notify: () =>
      queueMicrotask(() => {
        if (active?.dom.isConnected) refresh(hostFor(active));
      }),
    render: refresh,
    promptChanged: refresh,
    jumpLabels: refresh,
  };

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
    suggestTakes: () => false,
    onFocusChange: (view) => {
      active = view;
    },
    onRender: (view) => {
      if (view.hasFocus) active = view;
    },
    onChanges: (view, changes) => editor.docChanged(hostFor(view), changes),
    onDocTransaction: (view, tr) => sessions?.change(view, tr.startState.doc, tr.changes, tr.newDoc),
    onViewOpen: (view) => {
      views.add(view);
      start(view);
      sessions?.open(view, view.state.doc);
    },
    onViewClose: (view) => {
      views.delete(view);
      sessions?.close(view);
      if (active === view) active = null;
    },
  });
  return [extension, helixEditor.of(editor), drawSelection(), EditorState.allowMultipleSelections.of(true), nativeUndo];
}
