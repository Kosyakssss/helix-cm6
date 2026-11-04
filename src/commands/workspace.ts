import type { Context, HelixEditor } from "../core/editor";
import type { Host } from "../core/host";
import { diagnosticsOf, type Diagnostic } from "../diagnostics";
import { Range, Selection } from "../selection";
import { helixField } from "../state";
import { QueryCursor } from "../syntax/query";
import { Picker, type PickerAction, type PickerColumn, type PickerOptions, type PickerPreview } from "../ui/picker";
import { Popup } from "../ui/menu";
import { COMMAND_DOCS } from "./docs";
import { commitHistoryNow, jumplistFor, pushJump, type Jump } from "./jumps";
import { apply, changeSetOf, docOf, selOf, setSel } from "./util";
import { lastDiffHunks } from "../ui/diff";

export interface WorkspaceBuffer {
  id: string;
  path: string | null;
  name: string;
  modified: boolean;
}

export interface FileTarget {
  from?: number;
  to?: number;
  line?: number;
  column?: number;
}

export interface SearchMatch {
  path: string;
  line: number;
  text: string;
  from?: number;
  to?: number;
}

export interface Location extends FileTarget {
  path?: string | null;
  label?: string;
}

export interface TextEdit {
  from: number;
  to: number;
  insert: string;
}

export interface CodeAction {
  title: string;
  kind?: string;
  run(cx: Context): void | Promise<void>;
}

export interface SymbolInfo extends Location {
  name: string;
  kind: string;
  detail?: string;
}

export interface SignatureHelp {
  signatures: { label: string; documentation?: string; activeParameter?: string }[];
  active?: number;
}

export interface CompletionItem {
  label: string;
  detail?: string;
  documentation?: string;
  filterText?: string;
  insertText?: string;
  from?: number;
  to?: number;
  edits?: readonly TextEdit[];
}

export type LocationKind = "definition" | "declaration" | "typeDefinition" | "implementation" | "references";

export interface LanguageFeatures {
  locations?(cx: Context, kind: LocationKind): Promise<readonly Location[]>;
  hover?(cx: Context): Promise<string | null>;
  signatureHelp?(cx: Context): Promise<SignatureHelp | null>;
  completions?(cx: Context, pos: number): Promise<readonly CompletionItem[]>;
  codeActions?(cx: Context): Promise<readonly CodeAction[]>;
  symbols?(cx: Context): Promise<readonly SymbolInfo[]>;
  workspaceSymbols?(cx: Context, query: string): Promise<readonly SymbolInfo[]>;
  rename?(cx: Context, name: string): Promise<readonly TextEdit[] | void>;
  format?(cx: Context): Promise<readonly TextEdit[] | void>;
  highlights?(cx: Context): Promise<readonly { from: number; to: number }[]>;
}

export interface WorkspaceProviders {
  buffers?(cx: Context): readonly WorkspaceBuffer[];
  openBuffer?(cx: Context, id: string, action: PickerAction): void;
  files?(cx: Context, root: string | null): readonly string[] | Promise<readonly string[]> | AsyncIterable<readonly string[]>;
  openFile?(cx: Context, path: string, target: FileTarget | null, action: PickerAction): void;
  readFile?(path: string): string | null | Promise<string | null>;
  search?(cx: Context, pattern: string, root: string | null): AsyncIterable<readonly SearchMatch[]> | Promise<readonly SearchMatch[]>;
  changedFiles?(cx: Context): readonly { path: string; status: string }[] | Promise<readonly { path: string; status: string }[]>;
  language?: LanguageFeatures;
}

type Available = (cx: Context) => boolean;

interface Builtin {
  available: Available;
  run(cx: Context, args: string[]): void | Promise<void>;
}

function picker<T>(cx: Context, options: PickerOptions<T>): void {
  void cx.editor.withMatcher((matcher) => {
    cx.editor.pushLayer(new Picker<T>(cx.editor, cx.host, matcher, options), cx.host);
  });
}

function filePreview(editor: HelixEditor, path: string, target: FileTarget | null): PickerPreview | Promise<PickerPreview> {
  const read = editor.workspace?.readFile?.(path) ?? null;
  const make = (text: string | null): PickerPreview => {
    if (text === null) return { text: null, note: "<File not found>", path };
    const span = targetSpan(text, target);
    return { text, path, from: span?.[0], to: span?.[1] };
  };
  return read instanceof Promise ? read.then(make) : make(read);
}

function targetSpan(text: string, target: FileTarget | null): [number, number] | null {
  if (!target) return null;
  if (target.from !== undefined) return [target.from, target.to ?? target.from];
  if (target.line === undefined) return null;
  let at = 0;
  for (let n = 0; n < target.line; n++) {
    const next = text.indexOf("\n", at);
    if (next < 0) return null;
    at = next + 1;
  }
  return [at, at];
}

function openLocation(cx: Context, location: Location, action: PickerAction = "replace"): void {
  const path = location.path;
  const isHere = !path || path === (cx.host.path ?? null);
  if (isHere) {
    const doc = docOf(cx);
    let from = location.from;
    let to = location.to;
    if (from === undefined && location.line !== undefined) {
      const line = doc.line(Math.min(location.line + 1, doc.lines));
      from = line.from + Math.min(location.column ?? 0, line.length);
      to = from;
    }
    if (from === undefined) return;
    pushJump(cx);
    setSel(cx, Selection.single(Math.min(from, doc.length), Math.min(to ?? from, doc.length)));
    return;
  }
  cx.editor.workspace?.openFile?.(cx, path, location, action);
}

function diagnosticColumns(): PickerColumn<Diagnostic & { line: number; path?: string | null }>[] {
  return [
    { name: "severity", format: (d) => (d.severity ?? "warning").toUpperCase() },
    { name: "code", format: (d) => d.code ?? "" },
    { name: "source", format: (d) => d.source ?? "" },
    { name: "message", format: (d) => d.message.replace(/\n/g, " ") },
  ];
}

function diagnosticsPicker(cx: Context, list: readonly Diagnostic[]): void {
  const doc = docOf(cx);
  const items = list.map((d) => ({ ...d, line: doc.lineAt(d.from).number }));
  picker(cx, {
    columns: diagnosticColumns(),
    primaryColumn: 3,
    items,
    onSelect: (cx, d, action) => openLocation(cx, { from: d.from, to: d.to }, action),
    preview: (d) => ({ text: doc.toString(), path: cx.host.path, from: d.from, to: d.to }),
  });
}

function gotoDiagnostic(cx: Context, find: (list: readonly Diagnostic[], cursor: number) => Diagnostic | undefined, reversed = false): void {
  const list = diagnosticsOf(cx.host.state);
  const doc = docOf(cx);
  const diag = find(list, selOf(cx).primary().cursor(doc));
  if (!diag) return;
  pushJump(cx);
  setSel(cx, reversed ? Selection.single(diag.to, diag.from) : Selection.single(diag.from, diag.to));
}

function gotoChange(cx: Context, which: "next" | "prev" | "first" | "last"): void {
  const hunks = lastDiffHunks(cx.host);
  if (!hunks || hunks.length === 0) return;
  const doc = docOf(cx);
  const count = cx.count();
  const moved = selOf(cx).transform((range) => {
    let line = doc.lineAt(range.cursor(doc)).number - 1;
    let target = range;
    for (let i = 0; i < count; i++) {
      let index: number;
      if (which === "first") index = 0;
      else if (which === "last") index = hunks.length - 1;
      else if (which === "next") {
        index = hunks.findIndex((h) => h.afterStart > line);
      } else {
        index = -1;
        for (let k = hunks.length - 1; k >= 0; k--) {
          if (hunks[k]!.afterEnd <= line || (hunks[k]!.afterStart === hunks[k]!.afterEnd && hunks[k]!.afterEnd <= line)) {
            index = k;
            break;
          }
        }
      }
      const hunk = hunks[index];
      if (!hunk) break;
      const startLine = Math.min(hunk.afterStart + 1, doc.lines);
      const start = doc.line(startLine).from;
      const end = hunk.afterEnd >= doc.lines ? doc.length : doc.line(hunk.afterEnd + 1).from;
      line = hunk.afterStart;
      target = hunk.afterStart === hunk.afterEnd ? new Range(start, start) : new Range(start, end);
    }
    return target;
  });
  pushJump(cx);
  setSel(cx, moved);
}

interface Tag {
  kind: string;
  name: string;
  from: number;
  to: number;
}

function syntaxTags(cx: Context): Tag[] | null {
  const syntax = cx.editor.syntax?.(cx.host);
  if (!syntax) return null;
  const loader = syntax.loader;
  const tags: Tag[] = [];
  for (const layer of syntax.allLayers()) {
    const query = loader.tagsQuery(layer.language);
    if (!query || !layer.tree) continue;
    const cursor = new QueryCursor(query, layer.tree.rootNode, syntax.input);
    try {
      for (let match = cursor.nextMatch(); match; match = cursor.nextMatch()) {
        for (const node of match.nodes) {
          const name = query.captureName(node.capture);
          if (!name.startsWith("definition.")) continue;
          const start = node.node.startByte;
          const end = node.node.endByte;
          tags.push({ kind: name.slice("definition.".length), name: syntax.slice(start, end), from: syntax.posOf(start), to: syntax.posOf(end) });
        }
      }
    } finally {
      cursor.delete();
    }
  }
  return tags.sort((a, b) => a.from - b.from);
}

function symbolColumns(): PickerColumn<SymbolInfo>[] {
  return [
    { name: "kind", format: (s) => s.kind },
    { name: "name", format: (s) => s.name },
    { name: "path", format: (s) => s.path ?? "", filter: true, paths: true },
  ];
}

function symbolPicker(cx: Context): void {
  const language = cx.editor.workspace?.language;
  if (language?.symbols) {
    const pending = language.symbols(cx);
    picker(cx, { columns: symbolColumns().slice(0, 2), primaryColumn: 1, items: pending, onSelect: (cx, s, action) => openLocation(cx, s, action), preview: (s) => previewLocation(cx, s) });
    return;
  }
  const tags = syntaxTags(cx);
  if (!tags) {
    cx.editor.setError("Syntax tree is not available on this buffer");
    return;
  }
  picker(cx, {
    columns: [
      { name: "kind", format: (t: Tag) => t.kind },
      { name: "name", format: (t: Tag) => t.name },
    ],
    primaryColumn: 1,
    items: tags,
    onSelect: (cx, t, action) => openLocation(cx, { from: t.from, to: t.to }, action),
    preview: (t) => ({ text: docOf(cx).toString(), path: cx.host.path, from: t.from, to: t.to }),
  });
}

function previewLocation(cx: Context, location: Location): PickerPreview | Promise<PickerPreview> {
  const path = location.path;
  if (!path || path === (cx.host.path ?? null)) {
    const text = docOf(cx).toString();
    const span = targetSpan(text, location);
    return { text, path: cx.host.path, from: span?.[0], to: span?.[1] };
  }
  return filePreview(cx.editor, path, location);
}

function locationCommand(kind: LocationKind, empty: string): Builtin {
  return {
    available: (cx) => cx.editor.workspace?.language?.locations !== undefined,
    run: async (cx) => {
      const list = await cx.editor.workspace!.language!.locations!(cx, kind);
      if (list.length === 0) {
        cx.editor.setError(empty);
        cx.editor.ui.render?.(cx.host);
        return;
      }
      if (list.length === 1) {
        openLocation(cx, list[0]!);
        return;
      }
      picker(cx, {
        columns: [
          { name: "path", format: (l: Location) => l.path ?? cx.host.name, paths: true },
          { name: "label", format: (l: Location) => l.label ?? "" },
        ],
        items: list,
        onSelect: (cx, l, action) => openLocation(cx, l, action),
        preview: (l) => previewLocation(cx, l),
      });
    },
  };
}

export function applyTextEdits(cx: Context, edits: readonly TextEdit[]): void {
  const doc = docOf(cx);
  if (edits.length === 0) return;
  const sorted = [...edits].sort((a, b) => a.from - b.from);
  commitHistoryNow(cx.host);
  apply(cx, changeSetOf(doc, sorted.map((e) => [e.from, e.to, e.insert])));
  commitHistoryNow(cx.host);
}

function popup(cx: Context, text: string, scope?: string): void {
  const value = cx.host.state.field(helixField);
  const anchor = value.selection.primary().cursor(cx.host.state.doc);
  cx.editor.pushLayer(new Popup(text, anchor, scope), cx.host);
}

function signatureText(help: SignatureHelp): string {
  const signature = help.signatures[help.active ?? 0];
  if (!signature) return "";
  const lines = [`\`${signature.label}\``];
  if (signature.documentation) lines.push("", signature.documentation);
  return lines.join("\n");
}

function jumpLabel(jump: Jump, host: Host): string {
  return jump.docId === host.id ? host.name : jump.docId;
}

function jumplistPicker(cx: Context): void {
  const list = jumplistFor(cx);
  const doc = docOf(cx);
  const items = [...list.jumps].reverse().map((jump) => {
    const inDoc = jump.docId === cx.host.id;
    const contents = inDoc
      ? jump.selection.ranges
          .map((r) => doc.sliceString(r.from(), Math.min(r.to(), doc.length)))
          .join(" ")
          .replace(/\s+/g, " ")
      : "";
    return { jump, contents };
  });
  picker(cx, {
    columns: [
      { name: "id", format: (i: (typeof items)[number]) => jumpLabel(i.jump, cx.host), paths: true },
      { name: "path", format: () => cx.host.path ?? "", filter: false, hidden: true },
      { name: "flags", format: () => "", filter: false, hidden: true },
      { name: "contents", format: (i: (typeof items)[number]) => i.contents },
    ],
    primaryColumn: 3,
    items,
    onSelect: (cx, i) => {
      pushJump(cx);
      cx.editor.jumpTo(cx, i.jump);
    },
    preview: (i) => (i.jump.docId === cx.host.id ? { text: doc.toString(), path: cx.host.path, from: i.jump.selection.primary().from(), to: i.jump.selection.primary().to() } : null),
  });
}

function keyBindings(editor: HelixEditor): Map<string, string[]> {
  const bindings = new Map<string, string[]>();
  const visit = (node: { kind: string; map?: Map<string, unknown>; command?: { kind: string; name?: string } }, prefix: string) => {
    if (node.kind === "node" && node.map) {
      for (const [key, child] of node.map) visit(child as Parameters<typeof visit>[0], prefix + key);
    } else if (node.kind === "command" && node.command?.kind === "static") {
      const list = bindings.get(node.command.name!) ?? [];
      list.push(prefix);
      bindings.set(node.command.name!, list);
    }
  };
  const mode = "normal";
  visit(editor.keymaps.map[mode], "");
  return bindings;
}

function commandPalette(cx: Context): void {
  const bindings = keyBindings(cx.editor);
  const items = Object.entries(COMMAND_DOCS).map(([name, doc]) => ({ name, doc, keys: (bindings.get(name) ?? []).join(", ") }));
  picker(cx, {
    columns: [
      { name: "name", format: (i: (typeof items)[number]) => i.name },
      { name: "bindings", format: (i: (typeof items)[number]) => i.keys },
      { name: "doc", format: (i: (typeof items)[number]) => i.doc },
    ],
    items,
    onSelect: (cx, i) => cx.editor.runStatic(cx, i.name),
  });
}

function bufferPicker(cx: Context): void {
  const buffers = cx.editor.workspace!.buffers!(cx);
  const current = buffers.findIndex((b) => b.id === cx.host.id || (b.path !== null && b.path === (cx.host.path ?? null)));
  const start = cx.editor.config.bufferPicker.startPosition === "previous" ? Math.min(1, buffers.length - 1) : Math.max(current, 0);
  picker(cx, {
    columns: [
      { name: "id", format: (b: WorkspaceBuffer) => b.id, filter: false, hidden: true },
      { name: "flags", format: (b: WorkspaceBuffer) => (b.modified ? "+" : "") + (b.id === cx.host.id ? "*" : ""), filter: false },
      { name: "path", format: (b: WorkspaceBuffer) => b.path ?? b.name, paths: true },
    ],
    primaryColumn: 2,
    items: buffers,
    cursor: start,
    onSelect: (cx, b, action) => cx.editor.workspace?.openBuffer?.(cx, b.id, action),
    preview: (b) => (b.path ? filePreview(cx.editor, b.path, null) : null),
  });
}

function filePicker(cx: Context, root: string | null): void {
  const workspace = cx.editor.workspace!;
  const files = workspace.files!(cx, root);
  const items: PickerOptions<string>["items"] = Array.isArray(files) || files instanceof Promise ? (files as readonly string[] | Promise<readonly string[]>) : (files);
  picker(cx, {
    columns: [{ name: "path", format: (p: string) => p, paths: true }],
    items,
    onSelect: (cx, path, action) => workspace.openFile?.(cx, path, null, action),
    preview: (path) => filePreview(cx.editor, path, null),
  });
}

function globalSearch(cx: Context): void {
  const workspace = cx.editor.workspace!;
  cx.editor.prompt(cx, {
    label: "global-search:",
    history: "/",
    onAccept: (pattern) => {
      if (!pattern) return;
      const results = workspace.search!(cx, pattern, null);
      picker(cx, {
        columns: [
          { name: "path", format: (m: SearchMatch) => `${m.path}:${m.line + 1}`, paths: true },
          { name: "contents", format: (m: SearchMatch) => m.text.trim() },
        ],
        primaryColumn: 1,
        items: results,
        onSelect: (cx, m, action) => openLocation(cx, { path: m.path, line: m.line }, action),
        preview: (m) => filePreview(cx.editor, m.path, { line: m.line }),
      });
    },
  });
}

const always: Available = () => true;
const hasLanguage = (name: keyof LanguageFeatures): Available => (cx) => cx.editor.workspace?.language?.[name] !== undefined;

export const WORKSPACE_BUILTINS: Record<string, Builtin> = {
  goto_first_diag: { available: always, run: (cx) => gotoDiagnostic(cx, (list) => list[0]) },
  goto_last_diag: { available: always, run: (cx) => gotoDiagnostic(cx, (list) => list[list.length - 1]) },
  goto_next_diag: { available: always, run: (cx) => gotoDiagnostic(cx, (list, cursor) => list.find((d) => d.from > cursor)) },
  goto_prev_diag: { available: always, run: (cx) => gotoDiagnostic(cx, (list, cursor) => [...list].reverse().find((d) => d.from < cursor), true) },
  goto_next_change: { available: always, run: (cx) => gotoChange(cx, "next") },
  goto_prev_change: { available: always, run: (cx) => gotoChange(cx, "prev") },
  goto_first_change: { available: always, run: (cx) => gotoChange(cx, "first") },
  goto_last_change: { available: always, run: (cx) => gotoChange(cx, "last") },
  diagnostics_picker: { available: always, run: (cx) => diagnosticsPicker(cx, diagnosticsOf(cx.host.state)) },
  workspace_diagnostics_picker: { available: always, run: (cx) => diagnosticsPicker(cx, cx.editor.workspaceDiagnostics(cx.host)) },
  jumplist_picker: { available: always, run: jumplistPicker },
  command_palette: { available: always, run: commandPalette },
  last_picker: {
    available: (cx) => cx.editor.lastPicker !== null,
    run: (cx) => {
      if (cx.editor.lastPicker) cx.editor.pushLayer(cx.editor.lastPicker, cx.host);
    },
  },
  symbol_picker: { available: always, run: symbolPicker },
  workspace_symbol_picker: {
    available: hasLanguage("workspaceSymbols"),
    run: (cx) => {
      const language = cx.editor.workspace!.language!;
      let current: Picker<SymbolInfo> | null = null;
      let latest = 0;
      void cx.editor.withMatcher((matcher) => {
        const options: PickerOptions<SymbolInfo> = {
          columns: symbolColumns(),
          primaryColumn: 1,
          items: [],
          onSelect: (cx, s, action) => openLocation(cx, s, action),
          preview: (s) => previewLocation(cx, s),
          dynamic: (query) => {
            const request = ++latest;
            void language.workspaceSymbols!(cx, query).then((list) => {
              if (request === latest) current?.replaceItems(list);
            });
          },
        };
        current = new Picker<SymbolInfo>(cx.editor, cx.host, matcher, options);
        cx.editor.pushLayer(current, cx.host);
        options.dynamic!("");
      });
    },
  },
  buffer_picker: { available: (cx) => cx.editor.workspace?.buffers !== undefined, run: bufferPicker },
  file_picker: { available: (cx) => cx.editor.workspace?.files !== undefined, run: (cx, args) => filePicker(cx, args[0] ?? null) },
  file_picker_in_current_buffer_directory: {
    available: (cx) => cx.editor.workspace?.files !== undefined,
    run: (cx) => {
      const path = cx.host.path ?? null;
      filePicker(cx, path && path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : null);
    },
  },
  global_search: { available: (cx) => cx.editor.workspace?.search !== undefined, run: globalSearch },
  changed_file_picker: {
    available: (cx) => cx.editor.workspace?.changedFiles !== undefined,
    run: (cx) => {
      const workspace = cx.editor.workspace!;
      const files = workspace.changedFiles!(cx);
      picker(cx, {
        columns: [
          { name: "change", format: (f: { path: string; status: string }) => f.status },
          { name: "path", format: (f: { path: string; status: string }) => f.path, paths: true },
        ],
        primaryColumn: 1,
        items: files,
        onSelect: (cx, f, action) => workspace.openFile?.(cx, f.path, null, action),
        preview: (f) => filePreview(cx.editor, f.path, null),
      });
    },
  },
  goto_definition: locationCommand("definition", "No definition found."),
  goto_declaration: locationCommand("declaration", "No declaration found."),
  goto_type_definition: locationCommand("typeDefinition", "No type definition found."),
  goto_implementation: locationCommand("implementation", "No implementation found."),
  goto_reference: locationCommand("references", "No references found."),
  hover: {
    available: hasLanguage("hover"),
    run: async (cx) => {
      const text = await cx.editor.workspace!.language!.hover!(cx);
      if (text) popup(cx, text);
      else {
        cx.editor.setStatus("No hover results available.");
        cx.editor.ui.render?.(cx.host);
      }
    },
  },
  signature_help: {
    available: hasLanguage("signatureHelp"),
    run: async (cx) => {
      const help = await cx.editor.workspace!.language!.signatureHelp!(cx);
      if (help) popup(cx, signatureText(help));
    },
  },
  code_action: {
    available: hasLanguage("codeActions"),
    run: async (cx) => {
      const actions = await cx.editor.workspace!.language!.codeActions!(cx);
      if (actions.length === 0) {
        cx.editor.setStatus("No code actions available");
        cx.editor.ui.render?.(cx.host);
        return;
      }
      picker(cx, {
        columns: [{ name: "action", format: (a: CodeAction) => a.title }],
        items: actions,
        onSelect: (cx, action) => void action.run(cx),
      });
    },
  },
  rename_symbol: {
    available: hasLanguage("rename"),
    run: (cx) => {
      cx.editor.prompt(cx, {
        label: "rename-to:",
        wordUnderCursor: undefined,
        onAccept: (name) => {
          void cx.editor.workspace!.language!.rename!(cx, name).then((edits) => {
            if (edits) applyTextEdits(cx, edits);
          });
        },
      });
    },
  },
  format_selections: {
    available: hasLanguage("format"),
    run: async (cx) => {
      const edits = await cx.editor.workspace!.language!.format!(cx);
      if (edits) applyTextEdits(cx, edits);
    },
  },
  select_references_to_symbol_under_cursor: {
    available: hasLanguage("highlights"),
    run: async (cx) => {
      const spans = await cx.editor.workspace!.language!.highlights!(cx);
      if (spans.length === 0) return;
      const doc = docOf(cx);
      const cursor = selOf(cx).primary().cursor(doc);
      const ranges = spans.map((s) => new Range(s.from, s.to));
      const primary = Math.max(ranges.findIndex((r) => r.from() <= cursor && cursor < r.to()), 0);
      setSel(cx, new Selection(ranges, primary));
    },
  },
};

