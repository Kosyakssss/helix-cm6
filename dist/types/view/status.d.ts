import { Facet } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { HelixEditor, Status } from "../core/editor";
import type { Host } from "../core/host";
import { type Mode } from "../state";
import { type Severity } from "../diagnostics";
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
export declare function infoOf(editor: HelixEditor): HelixInfo | null;
export declare const onHelixStatus: Facet<(status: HelixStatus, view: EditorView) => void, readonly ((status: HelixStatus, view: EditorView) => void)[]>;
export declare function statusOf(editor: HelixEditor, host: Host, focused: boolean): HelixStatus | null;
