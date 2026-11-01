import { ChangeSet, StateField, type Text, type Transaction } from "@codemirror/state";
import type { Selection } from "./selection";
export interface Revision {
    parent: number;
    lastChild: number | null;
    changes: ChangeSet;
    inversion: ChangeSet;
    selectionAfter: Selection | null;
    selectionBefore: Selection | null;
    timestamp: number;
}
export interface Pending {
    changes: ChangeSet;
    oldDoc: Text;
    oldSelection: Selection;
}
export interface HistoryState {
    revisions: Revision[];
    current: number;
    pending: Pending | null;
}
export declare const commitHistory: import("@codemirror/state").StateEffectType<{
    selection: Selection;
    timestamp: number;
}>;
export declare const setHistoryCurrent: import("@codemirror/state").StateEffectType<number>;
export declare const historyApply: import("@codemirror/state").StateEffectType<null>;
export declare const startPending: import("@codemirror/state").StateEffectType<Selection>;
export declare function createHistory(doc: Text): HistoryState;
export declare function makeHistoryField(selectionOf: (state: Transaction["startState"]) => Selection): StateField<HistoryState>;
export interface Step {
    changes: ChangeSet;
    selection: Selection | null;
}
export declare function undoStep(value: HistoryState): {
    current: number;
    step: Step;
} | null;
export declare function redoStep(value: HistoryState): {
    current: number;
    step: Step;
} | null;
export declare function jumpTo(value: HistoryState, to: number): Step[];
export type UndoKind = {
    kind: "steps";
    n: number;
} | {
    kind: "time";
    ms: number;
};
export declare function earlierTarget(value: HistoryState, uk: UndoKind): number;
export declare function laterTarget(value: HistoryState, uk: UndoKind): number;
export declare function parseUndoKind(input: string): UndoKind;
export declare function lastEditPos(value: HistoryState): number | null;
