import type { Text } from "@codemirror/state";
import type { LanguageId } from "./injections";
import type { LanguageLoader } from "./loader";
import { Query } from "./query";
import type { Syntax } from "./syntax";
import type { Language } from "./ts";
export type IndentStyle = {
    kind: "tabs";
} | {
    kind: "spaces";
    width: number;
};
export type IndentHeuristic = "simple" | "tree-sitter" | "hybrid";
export declare function indentStyleStr(style: IndentStyle): string;
export declare function indentStyleWidth(style: IndentStyle, tabWidth: number): number;
export declare function indentStyleFromStr(indent: string): IndentStyle;
export declare function autoDetectIndentStyle(doc: Text): IndentStyle | null;
export declare function indentLevelForLine(line: string, tabWidth: number, indentWidth: number): number;
interface IndentQueryPredicates {
    notKindEq: [number, string][];
    sameLine: [number, number, boolean] | null;
    oneLine: [number, boolean] | null;
}
export declare class IndentQuery {
    readonly query: Query;
    readonly headerPatterns: Set<number>;
    readonly predicates: Map<number, IndentQueryPredicates>;
    readonly captures: Record<"indent" | "indentAlways" | "outdent" | "outdentAlways" | "align" | "anchor" | "extend" | "extendPreventOnce" | "opaque", number | null>;
    constructor(grammar: Language, source: string, regex: ConstructorParameters<typeof Query>[4]);
}
export interface Indentation {
    indent: number;
    indentAlways: number;
    outdent: number;
    outdentAlways: number;
    align: string | null;
}
export declare function indentQueryFor(loader: LanguageLoader, language: LanguageId): IndentQuery | null;
export declare function treesitterIndentForPos(query: IndentQuery, syntax: Syntax, tabWidth: number, indentWidth: number, doc: Text, line: number, pos: number, newLine: boolean): Indentation | null;
export declare function indentForNewline(syntax: Syntax | null, heuristic: IndentHeuristic, style: IndentStyle, tabWidth: number, doc: Text, lineBefore: number, lineBeforeEndPos: number, currentLine: number): string;
export {};
