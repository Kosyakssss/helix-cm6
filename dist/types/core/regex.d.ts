import type { Text } from "@codemirror/state";
import type { RustRegexEngine } from "./rx";
export declare function escapeRegex(s: string): string;
export interface Pattern {
    find(doc: Text, from: number, to: number): [number, number] | null;
    findLast(doc: Text, from: number, to: number): [number, number] | null;
    findAll(doc: Text, from: number, to: number): [number, number][];
    isMatch(doc: Text, from: number, to: number): boolean;
}
export declare function compilePattern(engine: RustRegexEngine | null, pattern: string, caseInsensitive: boolean): Pattern;
