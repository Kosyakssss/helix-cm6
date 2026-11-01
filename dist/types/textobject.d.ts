import type { Text } from "@codemirror/state";
import { Range } from "./selection";
import type { Syntax } from "./syntax/syntax";
export type TextObject = "around" | "inside";
export declare function textobjectWord(doc: Text, range: Range, textobject: TextObject, _count: number, long: boolean): Range;
export declare function textobjectParagraph(doc: Text, range: Range, textobject: TextObject, count: number): Range;
export declare function textobjectPairSurround(doc: Text, range: Range, textobject: TextObject, ch: string, count: number, syntax?: Syntax | null): Range;
export declare function textobjectPairSurroundClosest(doc: Text, range: Range, textobject: TextObject, count: number, syntax?: Syntax | null): Range;
