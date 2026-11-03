import { StateField, type Extension } from "@codemirror/state";
export interface DiffHunk {
    beforeStart: number;
    beforeEnd: number;
    afterStart: number;
    afterEnd: number;
}
export declare const setDiffHunks: import("@codemirror/state").StateEffectType<readonly DiffHunk[]>;
export declare const diffHunksField: StateField<readonly DiffHunk[]>;
export declare function gutterExtension(layout: readonly string[]): Extension;
export declare const gutterTheme: Extension;
