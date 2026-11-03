import { EditorState, type Extension, type Text, type TransactionSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { type HelixState, type Mode } from "../state";
import type { Selection } from "../selection";
export interface Host {
    readonly state: EditorState;
    dispatch(...specs: TransactionSpec[]): void;
    readonly view: EditorView | null;
    readonly id: string;
    readonly name: string;
    readonly path?: string | null;
    readonly paneId: string;
}
export declare class HeadlessHost implements Host {
    readonly id: string;
    state: EditorState;
    readonly view: null;
    readonly name: string;
    readonly paneId = "pane";
    constructor(doc: string, extensions: Extension, id?: string);
    onChanges: ((changes: import("@codemirror/state").ChangeSet, oldDoc: Text) => void) | null;
    dispatch(...specs: TransactionSpec[]): void;
}
export declare function helix(host: Host): HelixState;
export declare function mode(host: Host): Mode;
export declare function doc(host: Host): Text;
export declare function selection(host: Host): Selection;
export declare function setSelection(host: Host, sel: Selection, extra?: TransactionSpec): void;
export declare function setMode(host: Host, mode: Mode, sel?: Selection, extra?: Partial<HelixState>): void;
export declare function patchHelix(host: Host, patch: Partial<HelixState>): void;
