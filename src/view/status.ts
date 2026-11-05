import { Facet } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { HelixEditor, Status } from "../core/editor";
import type { Host } from "../core/host";
import { nextGraphemeBoundary } from "../graphemes";
import { helixField, type Mode } from "../state";
import { diagnosticsOf, type Severity } from "../diagnostics";
import type { MappableCommand } from "../keymap/trie";

export interface HelixStatus {
  mode: Mode;
  pending: string;
  count: number | null;
  register: string | null;
  recording: string | null;
  selections: number;
  primary: number;
  line: number;
  column: number;
  message: Status | null;
  language: string;
  modified: boolean;
  diagnostics: Record<Severity, number>;
  prompt: HelixPromptStatus | null;
  info: HelixInfo | null;
}

export interface HelixPromptStatus {
  label: string;
  input: string;
  cursor: number;
  completions: readonly string[];
  selected: number | null;
}

export interface HelixInfoRow {
  keys: string;
  doc: string;
  available: boolean;
}

export interface HelixInfo {
  title: string;
  rows: readonly HelixInfoRow[];
}

function describe(editor: HelixEditor, command: MappableCommand): string {
  if (command.kind === "static") return editor.commandDoc(command.name);
  if (command.kind === "typable") return `:${command.raw}`;
  return `@${command.keys}`;
}

export function infoOf(editor: HelixEditor): HelixInfo | null {
  const auto = editor.autoinfo;
  if (!auto) return null;
  if (!("kind" in auto)) return { title: auto.title, rows: auto.body.map(([keys, doc]) => ({ keys, doc, available: true })) };
  const grouped = new Map<string, { keys: string[]; available: boolean }>();
  for (const [key, trie] of auto.map) {
    const doc = trie.kind === "node" ? trie.name : trie.kind === "sequence" ? "[Multiple commands]" : describe(editor, trie.command);
    if (doc === "no_op") continue;
    const available = trie.kind !== "command" || trie.command.kind !== "static" || editor.hasCommand(trie.command.name);
    const row = grouped.get(doc) ?? { keys: [], available };
    row.keys.push(key);
    grouped.set(doc, row);
  }
  return { title: auto.name, rows: [...grouped].map(([doc, row]) => ({ keys: row.keys.join(", "), doc, available: row.available })) };
}

export const onHelixStatus = Facet.define<(status: HelixStatus, view: EditorView) => void>();

export function statusOf(editor: HelixEditor, host: Host, focused: boolean): HelixStatus | null {
  const state = host.state.field(helixField, false);
  if (!state) return null;
  const doc = host.state.doc;
  const cursor = state.selection.primary().cursor(doc);
  const line = doc.lineAt(cursor);
  let column = 1;
  for (let pos = line.from; pos < cursor; pos = nextGraphemeBoundary(doc, pos)) column++;
  const diagnostics: Record<Severity, number> = { hint: 0, info: 0, warning: 0, error: 0 };
  for (const d of diagnosticsOf(host.state)) diagnostics[d.severity ?? "warning"]++;
  const prompt = focused ? editor.activePrompt : null;
  return {
    modified: editor.isModified(host),
    diagnostics,
    prompt: prompt && {
      label: prompt.label,
      input: prompt.line,
      cursor: prompt.cursor,
      completions: prompt.completions.map((c) => c.label),
      selected: prompt.selection,
    },
    info: focused ? infoOf(editor) : null,
    mode: state.mode,
    pending: focused ? editor.pendingDisplay() : "",
    count: focused ? editor.count : null,
    register: focused ? editor.selectedRegister : null,
    recording: editor.macroRecording?.register ?? null,
    selections: state.selection.ranges.length,
    primary: state.selection.primaryIndex,
    line: line.number,
    column,
    message: editor.status,
    language: editor.languageName(host) ?? "text",
  };
}
