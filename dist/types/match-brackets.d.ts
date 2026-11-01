import type { Text } from "@codemirror/state";
export declare const BRACKETS: [string, string][];
export declare const PAIRS: [string, string][];
export declare function getPair(ch: string): [string, string];
export declare function isOpenBracket(ch: string): boolean;
export declare function isCloseBracket(ch: string): boolean;
export declare function isValidBracket(ch: string): boolean;
export declare function findMatchingBracketPlaintext(doc: Text, cursorPos: number): number | null;
