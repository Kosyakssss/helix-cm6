import type { ChangeDesc, Text } from "@codemirror/state";
export type Direction = "forward" | "backward";
export declare class Range {
    readonly anchor: number;
    readonly head: number;
    readonly goalColumn?: number | undefined;
    readonly oldVisual?: readonly [number, number] | undefined;
    constructor(anchor: number, head: number, goalColumn?: number | undefined, oldVisual?: readonly [number, number] | undefined);
    static point(head: number): Range;
    from(): number;
    to(): number;
    isEmpty(): boolean;
    direction(): Direction;
    flip(): Range;
    withDirection(direction: Direction): Range;
    withGoal(goalColumn: number | undefined): Range;
    withOldVisual(oldVisual: readonly [number, number] | undefined): Range;
    eq(other: Range): boolean;
    overlaps(other: Range): boolean;
    merge(other: Range): Range;
    map(changes: ChangeDesc): Range;
    graphemeAligned(doc: Text): Range;
    minWidth1(doc: Text): Range;
    cursor(doc: Text): number;
    putCursor(doc: Text, pos: number, extend: boolean): Range;
}
export declare class Selection {
    readonly ranges: readonly Range[];
    readonly primaryIndex: number;
    constructor(ranges: readonly Range[], primaryIndex: number);
    static single(anchor: number, head: number): Selection;
    primary(): Range;
    transform(f: (range: Range, index: number) => Range): Selection;
    map(changes: ChangeDesc): Selection;
    ensureInvariants(doc: Text): Selection;
    eq(other: Selection): boolean;
}
