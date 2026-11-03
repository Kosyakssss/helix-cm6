import type { Text } from "@codemirror/state";
import { Range, type Direction } from "../selection";
import type { TextObject } from "../textobject";
import type { LanguageLoader } from "./loader";
import { QueryCursor, TREE_SITTER_MATCH_LIMIT, type Query, type QueryInput } from "./query";
import type { Syntax } from "./syntax";
import type { Node } from "./ts";

export interface CapturedNode {
  start: number;
  end: number;
}

export function captureNodesAny(query: Query, names: readonly string[], node: Node, input: QueryInput): CapturedNode[] | null {
  let capture: number | null = null;
  for (const name of names) {
    capture = query.getCapture(name);
    if (capture !== null) break;
  }
  if (capture === null) return null;
  const cursor = new QueryCursor(query, node, input, [0, 0xffffffff], TREE_SITTER_MATCH_LIMIT);
  const out: CapturedNode[] = [];
  try {
    for (let next = cursor.nextMatch(); next; next = cursor.nextMatch()) {
      const nodes = next.nodes.filter((n) => n.capture === capture).map((n) => n.node);
      if (nodes.length === 0) continue;
      out.push({ start: nodes[0]!.startByte, end: nodes[nodes.length - 1]!.endByte });
    }
  } finally {
    cursor.delete();
  }
  return out;
}

function queryAt(syntax: Syntax, loader: LanguageLoader, bytePos: number): [Query | null, Node] {
  const layer = syntax.layerForByteRange(bytePos, bytePos);
  const root = syntax.treeForByteRange(bytePos, bytePos).rootNode;
  return [loader.textobjectQuery(layer.language), root];
}

export function textobjectTreesitter(syntax: Syntax, doc: Text, range: Range, textobject: TextObject, objectName: string): Range {
  const bytePos = syntax.byteOf(range.cursor(doc));
  const [query, root] = queryAt(syntax, syntax.loader, bytePos);
  if (!query) return range;
  const nodes = captureNodesAny(query, [`${objectName}.${textobject}`], root, syntax.input);
  if (!nodes) return range;
  let best: CapturedNode | null = null;
  for (const node of nodes) {
    if (!(node.start <= bytePos && bytePos < node.end)) continue;
    if (!best || node.end - node.start < best.end - best.start) best = node;
  }
  if (!best) return range;
  const len = syntax.byteLength;
  if (best.start >= len || best.end >= len) return range;
  return new Range(syntax.posOf(best.start), syntax.posOf(best.end));
}

export function gotoTreesitterObject(syntax: Syntax, doc: Text, range: Range, objectName: string, dir: Direction, count: number): Range {
  const getRange = (range: Range): Range | null => {
    const bytePos = syntax.byteOf(range.cursor(doc));
    const [query, root] = queryAt(syntax, syntax.loader, bytePos);
    if (!query) return null;
    const nodes = captureNodesAny(query, [`${objectName}.movement`, `${objectName}.around`, `${objectName}.inside`], root, syntax.input);
    if (!nodes) return null;
    let node: CapturedNode | null = null;
    if (dir === "forward") {
      for (const n of nodes) {
        if (!(n.start > bytePos)) continue;
        if (!node || n.start < node.start || (n.start === node.start && n.end > node.end)) node = n;
      }
    } else {
      for (const n of nodes) {
        if (!(n.end < bytePos)) continue;
        if (!node || n.end > node.end || (n.end === node.end && n.start <= node.start)) node = n;
      }
    }
    if (!node) return null;
    const len = syntax.byteLength;
    if (node.start >= len || node.end >= len) return null;
    return new Range(syntax.posOf(node.start), syntax.posOf(node.end));
  };
  let last = range;
  for (let i = 0; i < count; i++) {
    const next = getRange(last);
    if (!next || next.eq(last)) break;
    last = next;
  }
  return last;
}
