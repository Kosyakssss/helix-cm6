import { type MotionRange } from "./hooks";
import { type Text } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { Range, type Direction } from "./selection";
export type Movement = "move" | "extend";
export declare function moveHorizontally(doc: Text, range: Range, dir: Direction, count: number, behaviour: Movement): Range;
export declare function graphemeWidth(g: string): number;
export declare function tabWidthAt(visualX: number, tabWidth: number): number;
export declare function visualColumn(doc: Text, lineFrom: number, pos: number, tabWidth: number): number;
export declare function moveVertically(doc: Text, range: Range, dir: Direction, count: number, behaviour: Movement, tabWidth: number): Range;
export interface VerticalProgress {
    left: number;
    stoppedAt: MotionRange | null;
}
export declare function moveVisualVertically(view: EditorView, range: Range, dir: Direction, count: number, behaviour: Movement, ranges?: readonly MotionRange[], progress?: VerticalProgress | null): Range;
export interface Aim {
    range: Range;
    offset: number | null;
    span: readonly [number, number] | null;
}
export declare function aimAt(view: EditorView, range: Range, behaviour: Movement): Aim;
export declare function visualRowOffset(view: EditorView, pos: number): number | null;
export declare function restoreVisualRows(view: EditorView, ranges: readonly Range[], aims: readonly Aim[], behaviour: Movement, apply: (ranges: Range[]) => void): void;
export type WordMotionTarget = "nextWordStart" | "nextWordEnd" | "prevWordStart" | "prevWordEnd" | "nextLongWordStart" | "nextLongWordEnd" | "prevLongWordStart" | "prevLongWordEnd" | "nextSubWordStart" | "nextSubWordEnd" | "prevSubWordStart" | "prevSubWordEnd";
export declare function wordMove(doc: Text, range: Range, count: number, target: WordMotionTarget): Range;
export declare function rangeToTarget(doc: Text, target: WordMotionTarget, origin: Range): Range;
export declare function cursorLine(doc: Text, range: Range): number;
export declare function movePrevParagraph(doc: Text, range: Range, count: number, behaviour: Movement): Range;
export declare function moveNextParagraph(doc: Text, range: Range, count: number, behaviour: Movement): Range;
