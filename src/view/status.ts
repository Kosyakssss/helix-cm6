import { Facet } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { HelixEditor, Status } from "../core/editor";
import type { Host } from "../core/host";
import { nextGraphemeBoundary } from "../graphemes";
import { helixField, type Mode } from "../state";

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
  return {
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
