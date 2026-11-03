import { Facet } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { HelixEditor, Status } from "../core/editor";
import type { Host } from "../core/host";
import { type Mode } from "../state";
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
export declare const onHelixStatus: Facet<(status: HelixStatus, view: EditorView) => void, readonly ((status: HelixStatus, view: EditorView) => void)[]>;
export declare function statusOf(editor: HelixEditor, host: Host, focused: boolean): HelixStatus | null;
