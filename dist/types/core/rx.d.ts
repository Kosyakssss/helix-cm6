import type { Text } from "@codemirror/state";
export declare class RustRegexEngine {
    private readonly x;
    private haystack;
    private readonly out;
    private buffer;
    private capacity;
    private constructor();
    static load(binary: Uint8Array): Promise<RustRegexEngine>;
    compile(pattern: string, caseInsensitive: boolean): number;
    drop(regex: number): void;
    private hay;
    private result;
    find(regex: number, doc: Text, from: number, to: number): [number, number] | null;
    findLast(regex: number, doc: Text, from: number, to: number): [number, number] | null;
    findAll(regex: number, doc: Text, from: number, to: number): [number, number][];
    isMatch(regex: number, doc: Text, from: number, to: number): boolean;
}
