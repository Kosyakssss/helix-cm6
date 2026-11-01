import { EditorSelection, Facet, StateField, type Text, type Transaction } from "@codemirror/state";
import { Selection } from "./selection";
export type Mode = "normal" | "insert" | "select";
export interface HelixState {
    readonly mode: Mode;
    readonly selection: Selection;
    readonly restoreCursor: boolean;
}
export declare const setHelix: import("@codemirror/state").StateEffectType<Partial<HelixState>>;
export declare const helixOwned: import("@codemirror/state").AnnotationType<boolean>;
export declare const helixField: StateField<HelixState>;
export declare function derive(value: HelixState, tr: Transaction): HelixState;
export declare function fromNative(native: EditorSelection, mode: Mode, mapped: Selection | null, doc: Text): Selection;
export declare function toNative(value: HelixState, doc: Text): EditorSelection;
export declare const dropSelectionChange: Facet<(tr: Transaction) => boolean, readonly ((tr: Transaction) => boolean)[]>;
export declare const syncNativeSelection: import("@codemirror/state").Extension;
export declare const historyField: StateField<import("./history").HistoryState>;
