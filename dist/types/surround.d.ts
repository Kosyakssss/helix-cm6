import type { Text } from "@codemirror/state";
import { Range, type Selection } from "./selection";
import type { Syntax } from "./syntax/syntax";
export declare class SurroundError extends Error {
}
export declare const ERRORS: {
    pairNotFound: string;
    cursorOverlap: string;
    rangeExceedsText: string;
    cursorOnAmbiguousPair: string;
};
export declare function findNthClosestPairsPos(doc: Text, range: Range, skip: number, syntax?: Syntax | null): [number, number];
export declare function findNthPairsPos(doc: Text, ch: string, range: Range, n: number, syntax?: Syntax | null): [number, number];
export declare function findNthOpenPair(doc: Text, open: string, close: string, pos: number, n: number): number | null;
export declare function findNthClosePair(doc: Text, open: string, close: string, pos: number, n: number): number | null;
export declare function getSurroundPos(doc: Text, selection: Selection, ch: string | null, skip: number, syntax?: Syntax | null): number[];
