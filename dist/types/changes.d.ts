import { StateField } from "@codemirror/state";
export interface Hunk {
    beforeStart: number;
    beforeEnd: number;
    afterStart: number;
    afterEnd: number;
}
export interface Changes {
    base?: string | null;
    hunks: readonly Hunk[];
}
export declare const setChanges: import("@codemirror/state").StateEffectType<Changes>;
export declare const changesField: StateField<Changes>;
export declare function changesOf(state: {
    field<T>(field: StateField<T>, require: false): T | undefined;
}): Changes;
