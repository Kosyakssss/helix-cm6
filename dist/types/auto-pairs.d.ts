import type { Text } from "@codemirror/state";
import { Range } from "./selection";
export interface Pair {
    open: string;
    close: string;
}
export type AutoPairs = Map<string, Pair>;
export declare function makeAutoPairs(pairs: [string, string][]): AutoPairs;
export type Change = [number, number, string | null];
export declare function hookInsert(doc: Text, range: Range, ch: string, pairs: AutoPairs): [Change, Range] | null;
export declare function hookDelete(doc: Text, range: Range, pairs: AutoPairs): [[number, number], Range] | null;
export declare function handleDelete(doc: Text, range: Range): [[number, number], Range];
