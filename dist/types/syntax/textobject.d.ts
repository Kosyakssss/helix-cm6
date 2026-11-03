import type { Text } from "@codemirror/state";
import { Range, type Direction } from "../selection";
import type { TextObject } from "../textobject";
import { type Query, type QueryInput } from "./query";
import type { Syntax } from "./syntax";
import type { Node } from "./ts";
export interface CapturedNode {
    start: number;
    end: number;
}
export declare function captureNodesAny(query: Query, names: readonly string[], node: Node, input: QueryInput): CapturedNode[] | null;
export declare function textobjectTreesitter(syntax: Syntax, doc: Text, range: Range, textobject: TextObject, objectName: string): Range;
export declare function gotoTreesitterObject(syntax: Syntax, doc: Text, range: Range, objectName: string, dir: Direction, count: number): Range;
