import type { Text } from "@codemirror/state";
import type { Context } from "../core/editor";
import { Range, Selection } from "../selection";
import { type Change } from "./util";
export interface BlockToken {
    start: string;
    end: string;
}
export interface CommentTokens {
    line: string[] | null;
    block: BlockToken[] | null;
}
export declare function getCommentToken(doc: Text, tokens: string[], line: number): string | null;
export declare function toggleLineComments(doc: Text, sel: Selection, token: string | null): Change[];
type CommentChange = {
    kind: "commented";
    range: Range;
    startPos: number;
    endPos: number;
    startMargin: boolean;
    endMargin: boolean;
    startToken: string;
    endToken: string;
} | {
    kind: "uncommented";
    range: Range;
    startPos: number;
    endPos: number;
    startToken: string;
    endToken: string;
} | {
    kind: "whitespace";
    range: Range;
};
export declare function findBlockComments(tokens: BlockToken[], doc: Text, sel: Selection): [boolean, CommentChange[]];
export declare function createBlockCommentTransaction(sel: Selection, commented: boolean, comments: CommentChange[]): [Change[], Range[]];
export declare function splitLinesOfSelection(doc: Text, sel: Selection): Selection;
export declare function continuedLineCommentToken(cx: Context, doc: Text, line: number): string | null;
export declare function runComments(cx: Context, kind: "toggle" | "line" | "block"): void;
export {};
