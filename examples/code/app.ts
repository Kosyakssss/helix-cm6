import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  helix,
  helixAppKeys,
  helixCommands,
  helixConfigure,
  helixDocument,
  helixEdit,
  helixHooks,
  helixMarkSaved,
  helixMessage,
  helixPrompt,
  helixRun,
  helixSelect,
  helixSelection,
  helixSetDiagnostics,
  helixSnippet,
  type HelixDiagnostic,
  type HelixSeverity,
} from "helix-cm6";
import { LspClient, toEdit, toOffset, toPosition, type LspRange, type LspTextEdit } from "./lsp";
import { picker, type PickerItem } from "./picker";
import { lineNumbers, popup, syntaxColours } from "./ui";

const api = async <T>(path: string, init?: RequestInit) => (await (await fetch(`/api/${path}`, init)).json()) as T;
const { root } = await api<{ root: string }>("root");
const uriOf = (path: string) => `file://${root}/${path}`;
const pathOf = (uri: string) => uri.replace(`file://${root}/`, "");

const lsp = new LspClient(`ws://${location.host}/lsp`, `file://${root}`);
const diagnostics = new Map<string, HelixDiagnostic[]>();
const severities: Record<number, HelixSeverity> = { 1: "error", 2: "warning", 3: "info", 4: "hint" };

interface Pane {
  view: EditorView;
  path: string;
  states: Map<string, EditorState>;
}

const panes: Pane[] = [];
const paneOf = (view: EditorView) => panes.find((p) => p.view === view)!;
const opened: string[] = [];
const bar = document.querySelector("footer")!;
const editors = document.querySelector("main")!;

const hoverText = (contents: unknown): string => {
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents)) return contents.map(hoverText).join("\n");
  return (contents as { value?: string } | null)?.value ?? "";
};

const here = (view: EditorView) => ({
  textDocument: { uri: uriOf(paneOf(view).path) },
  position: toPosition(view.state.doc, helixSelection(view).primary.cursor),
});

async function stateFor(pane: Pane, path: string): Promise<EditorState> {
  const held = pane.states.get(path);
  if (held) return held;
  const other = panes.find((p) => p !== pane && p.path === path);
  const { text } = other ? { text: other.view.state.doc.toString() } : await api<{ text: string }>(`read?path=${encodeURIComponent(path)}`);
  return EditorState.create({ doc: text, extensions: extensionsFor(path) });
}

async function show(view: EditorView, path: string): Promise<void> {
  const pane = paneOf(view);
  if (pane.path === path) return;
  pane.states.set(pane.path, view.state);
  const state = await stateFor(pane, path);
  pane.path = path;
  view.setState(state);
  if (!opened.includes(path)) opened.push(path);
  lsp.opened(uriOf(path), "rust", state.doc.toString());
  helixSetDiagnostics(view, diagnostics.get(path) ?? []);
  view.focus();
}

interface Location {
  uri?: string;
  targetUri?: string;
  range?: LspRange;
  targetSelectionRange?: LspRange;
}

async function go(view: EditorView, location: Location): Promise<void> {
  const path = pathOf(location.uri ?? location.targetUri!);
  const range = (location.range ?? location.targetSelectionRange)!;
  helixRun(view, "save_selection");
  await show(view, path);
  helixSelect(view, toOffset(view.state.doc, range.start));
}

const gotoLsp = (method: string, title: string) => async ({ view }: { view: EditorView }) => {
  const found = await lsp.request<Location | Location[] | null>(`textDocument/${method}`, { ...here(view), context: { includeDeclaration: true } });
  const list = Array.isArray(found) ? found : found ? [found] : [];
  if (list.length === 0) return helixMessage(view, `No ${title} found`, "error");
  const target = list.length === 1 ? list[0]! : await picker(title, list.map((value) => ({ label: `${pathOf(value.uri ?? value.targetUri!)}:${(value.range ?? value.targetSelectionRange)!.start.line + 1}`, value })));
  if (target) await go(view, target);
};

interface WorkspaceEdit {
  changes?: Record<string, LspTextEdit[]>;
  documentChanges?: { textDocument: { uri: string }; edits: LspTextEdit[] }[];
}

const applyWorkspaceEdit = async (view: EditorView, edit: WorkspaceEdit | null) => {
  const changes = [...Object.entries(edit?.changes ?? {}), ...(edit?.documentChanges ?? []).map((c) => [c.textDocument.uri, c.edits] as const)];
  for (const [uri, edits] of changes) {
    await show(view, pathOf(uri));
    helixEdit(view, edits.map((e) => toEdit(view.state.doc, e)));
  }
};

const openFile = async (view: EditorView, path: string) => {
  await show(view, path);
};

let menu: { items: { label: string; insertText?: string; textEdit?: { newText: string } }[]; index: number; dom: HTMLElement; view: EditorView; prefix: number } | null = null;

const closeMenu = () => {
  menu?.dom.remove();
  menu = null;
};

const drawMenu = () => {
  if (!menu) return;
  menu.dom.replaceChildren(...menu.items.slice(0, 10).map((item, i) => {
    const row = document.createElement("div");
    row.textContent = item.label;
    row.className = i === menu!.index ? "selected" : "";
    return row;
  }));
};

const acceptMenu = () => {
  if (!menu) return;
  const item = menu.items[menu.index]!;
  const { view, prefix } = menu;
  closeMenu();
  helixSnippet(view, item.textEdit?.newText ?? item.insertText ?? item.label, { removeBefore: prefix });
};

const hooks = helixHooks.of({
  intercept: (key) => {
    if (!menu) return false;
    if (key === "C-n" || key === "down") menu.index = Math.min(menu.index + 1, menu.items.length - 1);
    else if (key === "C-p" || key === "up") menu.index = Math.max(menu.index - 1, 0);
    else if (key === "ret" || key === "tab") acceptMenu();
    else if (key === "esc") closeMenu();
    else {
      closeMenu();
      return false;
    }
    drawMenu();
    return true;
  },
});

const extension = helix({
  config: (await api<{ text: string }>("read?path=helix.toml")).text,
  grammars: "/languages",
  keys: helixAppKeys,
  shell: (command, input) => api("shell", { method: "POST", body: JSON.stringify({ command, input }) }),
  completePath: (prefix) => files.filter((f) => f.startsWith(prefix)),
  variable: (name, view) => (name === "file_path_absolute" ? `${root}/${paneOf(view).path}` : null),
  openJump: async (jump, view) => {
    await show(view, jump.path);
    helixSelect(view, jump.ranges, { primaryIndex: jump.primaryIndex });
  },
  onStatus: (status, view) => {
    if (!view.hasFocus) return;
    const counts = `${status.diagnostics.error}E ${status.diagnostics.warning}W`;
    bar.textContent = `${status.mode} ${status.name}${status.modified ? " [+]" : ""} ${status.selections} sel ${status.line}:${status.column} ${counts} ${status.language} ${status.pending} ${status.message?.text ?? ""}`;
  },
  commands: {
    file_picker: async ({ view }) => {
      const path = await picker("Open file", files.map((f) => ({ label: f, value: f })));
      if (path) await openFile(view, path);
    },
    buffer_picker: async ({ view }) => {
      const path = await picker("Open buffer", opened.map((f) => ({ label: f, value: f })));
      if (path) await openFile(view, path);
    },
    goto_next_buffer: ({ view }) => openFile(view, opened[(opened.indexOf(paneOf(view).path) + 1) % opened.length]!),
    goto_previous_buffer: ({ view }) => openFile(view, opened[(opened.indexOf(paneOf(view).path) - 1 + opened.length) % opened.length]!),
    open: async ({ view, args }) => {
      for (const path of args) await openFile(view, path);
    },
    write: async ({ view, args }) => {
      const path = args[0] ?? paneOf(view).path;
      await api("write", { method: "POST", body: JSON.stringify({ path, text: view.state.doc.toString() }) });
      helixMarkSaved(view);
      lsp.notify("textDocument/didSave", { textDocument: { uri: uriOf(path) } });
      helixMessage(view, `written ${path}`);
    },
    "config-reload": async ({ view }) => {
      const warnings = helixConfigure(view, { config: (await api<{ text: string }>("read?path=helix.toml")).text });
      helixMessage(view, warnings.length === 0 ? "config reloaded" : warnings.join("; "), warnings.length === 0 ? "info" : "error");
    },
    goto_definition: gotoLsp("definition", "definition"),
    goto_declaration: gotoLsp("declaration", "declaration"),
    goto_type_definition: gotoLsp("typeDefinition", "type definition"),
    goto_implementation: gotoLsp("implementation", "implementation"),
    goto_reference: gotoLsp("references", "reference"),
    hover: async ({ view }) => {
      const result = await lsp.request<{ contents: unknown } | null>("textDocument/hover", here(view));
      const text = result ? hoverText(result.contents) : "";
      if (text) popup(view, helixSelection(view).primary.cursor, text);
      else helixMessage(view, "No hover information");
    },
    signature_help: async ({ view }) => {
      const result = await lsp.request<{ signatures: { label: string }[] } | null>("textDocument/signatureHelp", here(view));
      if (result?.signatures[0]) popup(view, helixSelection(view).primary.cursor, result.signatures[0].label);
    },
    rename_symbol: async ({ view }) => {
      const name = await helixPrompt(view, { label: "rename-to: ", initial: view.state.sliceDoc(helixSelection(view).primary.from, helixSelection(view).primary.to) });
      if (!name) return;
      await applyWorkspaceEdit(view, await lsp.request("textDocument/rename", { ...here(view), newName: name }));
    },
    format_selections: async ({ view }) => {
      const edits = await lsp.request<LspTextEdit[] | null>("textDocument/formatting", { textDocument: here(view).textDocument, options: { tabSize: 4, insertSpaces: true } });
      if (edits) helixEdit(view, edits.map((e) => toEdit(view.state.doc, e)));
    },
    code_action: async ({ view }) => {
      const { from, to } = helixSelection(view).primary;
      const range = { start: toPosition(view.state.doc, from), end: toPosition(view.state.doc, to) };
      const actions = await lsp.request<{ title: string; edit?: WorkspaceEdit }[] | null>("textDocument/codeAction", { textDocument: here(view).textDocument, range, context: { diagnostics: [] } });
      const chosen = await picker("Code action", (actions ?? []).map((value) => ({ label: value.title, value })));
      if (!chosen) return;
      const resolved = chosen.edit ? chosen : await lsp.request<typeof chosen>("codeAction/resolve", chosen);
      await applyWorkspaceEdit(view, resolved.edit ?? null);
    },
    diagnostics_picker: async ({ view }) => {
      const list = diagnostics.get(paneOf(view).path) ?? [];
      const chosen = await picker("Diagnostics", list.map((value) => ({ label: `${view.state.doc.lineAt(value.from).number}: ${value.message}`, value })));
      if (chosen) helixSelect(view, chosen.from, { jump: true });
    },
    symbol_picker: async ({ view }) => {
      const symbols = await lsp.request<{ name: string; range?: LspRange; location?: { range: LspRange } }[] | null>("textDocument/documentSymbol", { textDocument: here(view).textDocument });
      const items: PickerItem<number>[] = (symbols ?? []).map((s) => ({ label: s.name, value: toOffset(view.state.doc, (s.range ?? s.location!.range).start) }));
      const chosen = await picker("Symbols", items);
      if (chosen !== null) helixSelect(view, chosen, { jump: true });
    },
    command_palette: async ({ view }) => {
      const chosen = await picker("Commands", helixCommands(view).filter((c) => c.available).map((c) => ({ label: `${c.name}  ${c.keys.join(" ")}  ${c.doc}`, value: c.name })));
      if (chosen) helixRun(view, chosen);
    },
    completion: async ({ view }) => {
      closeMenu();
      const cursor = helixSelection(view).primary.head;
      const result = await lsp.request<{ items: NonNullable<typeof menu>["items"] } | NonNullable<typeof menu>["items"] | null>("textDocument/completion", { textDocument: here(view).textDocument, position: toPosition(view.state.doc, cursor) });
      const items = Array.isArray(result) ? result : (result?.items ?? []);
      if (items.length === 0) return;
      const line = view.state.doc.lineAt(cursor);
      const prefix = /\w*$/.exec(line.text.slice(0, cursor - line.from))?.[0].length ?? 0;
      const dom = document.createElement("div");
      dom.className = "menu";
      const coords = view.coordsAtPos(cursor);
      dom.style.left = `${coords?.left ?? 0}px`;
      dom.style.top = `${(coords?.bottom ?? 0) + 2}px`;
      document.body.append(dom);
      menu = { items, index: 0, dom, view, prefix };
      drawMenu();
    },
    vsplit: async ({ view, args }) => {
      const pane = await addPane(args[0] ?? paneOf(view).path);
      pane.view.focus();
    },
    hsplit: async ({ view, args }) => {
      const pane = await addPane(args[0] ?? paneOf(view).path);
      pane.view.focus();
    },
    wclose: ({ view }) => {
      if (panes.length === 1) return;
      panes.splice(panes.indexOf(paneOf(view)), 1);
      view.dom.parentElement!.remove();
      view.destroy();
      panes[0]!.view.focus();
    },
    jump_view_right: ({ view }) => panes[(panes.indexOf(paneOf(view)) + 1) % panes.length]!.view.focus(),
    jump_view_left: ({ view }) => panes[(panes.indexOf(paneOf(view)) - 1 + panes.length) % panes.length]!.view.focus(),
  },
});

const sync = EditorView.updateListener.of((update) => {
  if (!update.docChanged) return;
  const pane = paneOf(update.view);
  if (update.transactions.some((tr) => tr.isUserEvent("sync"))) return;
  lsp.changed(uriOf(pane.path), update.state.doc.toString());
  for (const other of panes) {
    if (other !== pane && other.path === pane.path) other.view.dispatch({ changes: update.changes, userEvent: "sync" });
  }
});

function extensionsFor(path: string) {
  return [extension, helixDocument.of({ path }), hooks, sync, syntaxColours, lineNumbers];
}

async function addPane(path: string): Promise<Pane> {
  const parent = document.createElement("section");
  editors.append(parent);
  const pane: Pane = { view: new EditorView({ parent }), path, states: new Map() };
  panes.push(pane);
  pane.view.setState(await stateFor(pane, path));
  if (!opened.includes(path)) opened.push(path);
  lsp.opened(uriOf(path), "rust", pane.view.state.doc.toString());
  helixSetDiagnostics(pane.view, diagnostics.get(path) ?? []);
  return pane;
}

lsp.onDiagnostics = (uri, list) => {
  const path = pathOf(uri);
  for (const pane of panes.filter((p) => p.path === path)) {
    const doc = pane.view.state.doc;
    const mapped = list.map((d) => ({ from: toOffset(doc, d.range.start), to: toOffset(doc, d.range.end), severity: severities[d.severity ?? 2], message: d.message, source: d.source }));
    diagnostics.set(path, mapped);
    helixSetDiagnostics(pane.view, mapped);
  }
};

const { files } = await api<{ files: string[] }>("files");
await lsp.ready;
const first = await addPane("src/main.rs");
first.view.focus();
Object.assign(window, { panes });
