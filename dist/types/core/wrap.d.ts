import type { Text } from "@codemirror/state";
export interface ReflowOptions {
    textWidth: number;
    tabWidth: number;
    lineEnding: string;
    commentTokens: readonly string[];
}
export declare function reflow(text: Text, startLine: number, endLine: number, opts: ReflowOptions): [number, number, string][];
