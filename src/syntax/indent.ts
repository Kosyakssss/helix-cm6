import type { Text } from "@codemirror/state";
import { segmentGraphemes } from "../graphemes";
import { graphemeWidth } from "../movement";
import type { LanguageId } from "./injections";
import type { LanguageLoader } from "./loader";
import { InvalidPredicateError, Query, QueryCursor, TREE_SITTER_MATCH_LIMIT, unknownPredicate, type QueryMatch } from "./query";
import type { Syntax } from "./syntax";
import type { Language, Node } from "./ts";

export type IndentStyle = { kind: "tabs" } | { kind: "spaces"; width: number };
export type IndentHeuristic = "simple" | "tree-sitter" | "hybrid";

const MAX_INDENT = 16;

export function indentStyleStr(style: IndentStyle): string {
  return style.kind === "tabs" ? "\t" : " ".repeat(Math.min(Math.max(style.width, 1), MAX_INDENT));
}

export function indentStyleWidth(style: IndentStyle, tabWidth: number): number {
  return style.kind === "tabs" ? tabWidth : style.width;
}

export function indentStyleFromStr(indent: string): IndentStyle {
  return indent.startsWith(" ") ? { kind: "spaces", width: Math.min(Math.max(indent.length, 1), MAX_INDENT) } : { kind: "tabs" };
}

function isLineEnding(c: string): boolean {
  return c === "\n" || c === "\r" || c === "\u000b" || c === "\u000c" || c === "\u0085" || c === " " || c === " ";
}

function isWhitespaceChar(c: string): boolean {
  return /^\p{White_Space}$/u.test(c) && !isLineEnding(c);
}

export function autoDetectIndentStyle(doc: Text): IndentStyle | null {
  const histogram = new Array<number>(MAX_INDENT + 1).fill(0);
  let prevIsTabs = false;
  let prevCount = 0;
  const lines = Math.min(doc.lines, 1000);
  outer: for (let n = 1; n <= lines; n++) {
    const line = doc.line(n);
    const text = n < doc.lines ? `${line.text}\n` : line.text;
    const chars = [...text];
    const first = chars[0];
    let isTabs: boolean;
    if (first === "\t") isTabs = true;
    else if (first === " ") isTabs = false;
    else if (first !== undefined && isLineEnding(first)) continue;
    else {
      prevIsTabs = false;
      prevCount = 0;
      continue;
    }
    let count = 1;
    let done = false;
    for (let i = 1; i < chars.length; i++) {
      const c = chars[i]!;
      if (c === "\t" && isTabs && !done) count++;
      else if (c === " " && !isTabs && !done) count++;
      else if (isWhitespaceChar(c)) done = true;
      else if (isLineEnding(c)) continue outer;
      else break;
      if (count > 256) continue outer;
    }
    if ((prevIsTabs === isTabs || prevCount === 0) && prevCount < count) {
      if (isTabs) histogram[0]!++;
      else {
        const amount = count - prevCount;
        if (amount <= MAX_INDENT) histogram[amount]!++;
      }
    }
    prevIsTabs = isTabs;
    prevCount = count;
  }
  histogram[0]! *= 2;
  if (histogram[1]! > 1) histogram[1] = Math.floor(histogram[1]! / 2);
  let indent = 0;
  for (let i = 0; i < histogram.length; i++) if (histogram[i]! >= histogram[indent]!) indent = i;
  const freq = histogram[indent]!;
  let freq2 = 0;
  for (let i = 0; i < histogram.length; i++) if (i !== indent) freq2 = Math.max(freq2, histogram[i]!);
  if (freq >= 1 && freq2 / freq < 0.66) return indent === 0 ? { kind: "tabs" } : { kind: "spaces", width: indent };
  return null;
}

function tabWidthAt(col: number, tabWidth: number): number {
  return tabWidth - (col % tabWidth);
}

export function indentLevelForLine(line: string, tabWidth: number, indentWidth: number): number {
  let len = 0;
  for (const ch of line) {
    if (ch === "\t") len += tabWidthAt(len, tabWidth);
    else if (ch === " ") len += 1;
    else break;
  }
  return Math.floor(len / indentWidth);
}

function whitespaceWithSameWidth(text: string): string {
  let s = "";
  for (const g of segmentGraphemes(text)) s += g === "\t" ? "\t" : " ".repeat(graphemeWidth(g));
  return s;
}

function visualCol(text: string, tabWidth: number): number {
  let col = 0;
  for (const g of segmentGraphemes(text)) col += g === "\t" ? tabWidth - (col % tabWidth) : graphemeWidth(g);
  return col;
}

function posAtVisualCol(text: string, col: number, tabWidth: number): number {
  let offset = 0;
  let remaining = col;
  for (const g of segmentGraphemes(text)) {
    const w = g === "\t" ? tabWidth - ((col - remaining) % tabWidth) : graphemeWidth(g);
    if (w > remaining) break;
    remaining -= w;
    offset += g.length;
  }
  return offset;
}

function addIndentLevel(base: string, added: number, style: IndentStyle, tabWidth: number): string {
  if (added >= 0) return base + indentStyleStr(style).repeat(added);
  const width = visualCol(base, tabWidth);
  const target = Math.max(0, width - -added * indentStyleWidth(style, tabWidth));
  return base.slice(0, posAtVisualCol(base, target, tabWidth));
}

interface IndentQueryPredicates {
  notKindEq: [number, string][];
  sameLine: [number, number, boolean] | null;
  oneLine: [number, boolean] | null;
}

export class IndentQuery {
  readonly query: Query;
  readonly headerPatterns = new Set<number>();
  readonly predicates = new Map<number, IndentQueryPredicates>();
  readonly captures: Record<"indent" | "indentAlways" | "outdent" | "outdentAlways" | "align" | "anchor" | "extend" | "extendPreventOnce" | "opaque", number | null>;

  constructor(grammar: Language, source: string, regex: ConstructorParameters<typeof Query>[4]) {
    const entry = (pattern: number) => {
      let p = this.predicates.get(pattern);
      if (!p) {
        p = { notKindEq: [], sameLine: null, oneLine: null };
        this.predicates.set(pattern, p);
      }
      return p;
    };
    this.query = new Query(
      grammar.rt,
      grammar,
      source,
      (pattern, predicate) => {
        if (predicate.kind === "set-property" && predicate.key === "scope") {
          if (predicate.val === "header") this.headerPatterns.add(pattern);
          else if (predicate.val !== null) throw new InvalidPredicateError(`unknown scope (#set! scope "${predicate.val}")`);
          else throw new InvalidPredicateError("missing scope value (#set! scope ...)");
          return;
        }
        if (predicate.kind !== "other") throw unknownPredicate(predicate);
        const p = predicate.predicate;
        const capture = (i: number) => {
          const arg = p.args[i]!;
          if (arg.kind !== "capture") throw new InvalidPredicateError(`${i}. argument to #${p.name} expected a capture, got literal ${JSON.stringify(arg.value)}`);
          return arg.capture;
        };
        const count = (n: number) => {
          if (p.args.length !== n) throw new InvalidPredicateError(`expected ${n} arguments for #${p.name}, got ${p.args.length}`);
        };
        switch (p.name) {
          case "not-kind-eq?": {
            count(2);
            const arg = p.args[1]!;
            if (arg.kind !== "string") throw new InvalidPredicateError(`1. argument to #${p.name} must be a literal`);
            entry(pattern).notKindEq.push([capture(0), arg.value]);
            return;
          }
          case "same-line?":
          case "not-same-line?":
            count(2);
            entry(pattern).sameLine = [capture(0), capture(1), p.name === "not-same-line?"];
            return;
          case "one-line?":
          case "not-one-line?":
            count(1);
            entry(pattern).oneLine = [capture(0), p.name === "not-one-line?"];
            return;
          default:
            throw unknownPredicate(predicate);
        }
      },
      regex,
    );
    const q = this.query;
    this.captures = {
      indent: q.getCapture("indent"),
      indentAlways: q.getCapture("indent.always"),
      outdent: q.getCapture("outdent"),
      outdentAlways: q.getCapture("outdent.always"),
      align: q.getCapture("align"),
      anchor: q.getCapture("anchor"),
      extend: q.getCapture("extend"),
      extendPreventOnce: q.getCapture("extend.prevent-once"),
      opaque: q.getCapture("opaque"),
    };
  }
}

export interface Indentation {
  indent: number;
  indentAlways: number;
  outdent: number;
  outdentAlways: number;
  align: string | null;
}

function emptyIndentation(): Indentation {
  return { indent: 0, indentAlways: 0, outdent: 0, outdentAlways: 0, align: null };
}

function netIndent(i: Indentation): number {
  return i.indent + i.indentAlways - (i.outdent + i.outdentAlways);
}

function relativeIndent(self: Indentation, other: Indentation, otherLeading: string, style: IndentStyle, tabWidth: number): string | null {
  if (self.align !== other.align) return null;
  return addIndentLevel(otherLeading, netIndent(self) - netIndent(other), style, tabWidth);
}

function indentationString(i: Indentation, style: IndentStyle, tabWidth: number): string {
  return addIndentLevel(i.align === null ? "" : whitespaceWithSameWidth(i.align), netIndent(i), style, tabWidth);
}

type CaptureType = { kind: "indent" | "indent-always" | "outdent" | "outdent-always" } | { kind: "align"; text: string };

interface IndentCapture {
  type: CaptureType;
  header: boolean;
}

type ExtendCapture = "extend" | "prevent-once";

class DocText {
  constructor(
    readonly doc: Text,
    readonly syntax: Syntax,
  ) {}

  byteToLine(byte: number): number {
    return this.doc.lineAt(this.syntax.posOf(byte)).number - 1;
  }

  lineToByte(line: number): number {
    return this.syntax.byteOf(this.doc.line(line + 1).from);
  }

  line(line: number): string {
    const l = this.doc.line(line + 1);
    return line + 1 < this.doc.lines ? `${l.text}\n` : l.text;
  }

  get lines(): number {
    return this.doc.lines;
  }
}

function firstNonWhitespace(line: string): number | null {
  let off = 0;
  for (const ch of line) {
    if (!/^\p{White_Space}$/u.test(ch)) return off;
    off += ch.length;
  }
  return null;
}

function nodeStartLine(text: DocText, node: Node, newLineBytePos: number | null): number {
  let line = text.byteToLine(node.startByte);
  if (newLineBytePos !== null && node.startByte >= newLineBytePos) line++;
  return line;
}

function nodeEndLine(text: DocText, node: Node, newLineBytePos: number | null): number {
  let line = text.byteToLine(node.endByte);
  if (newLineBytePos !== null && node.endByte > newLineBytePos) line++;
  return line;
}

function areSatisfied(preds: IndentQueryPredicates, m: QueryMatch, text: DocText, newLineBytePos: number | null, grammar: Language): boolean {
  const first = (capture: number) => m.nodes.find((n) => n.capture === capture)?.node ?? null;
  for (const [capture, kind] of preds.notKindEq) {
    const node = first(capture);
    if (node && grammar.symbolName(node.symbol) === kind) return false;
  }
  if (preds.sameLine) {
    const [c1, c2, negated] = preds.sameLine;
    const n1 = first(c1);
    const n2 = first(c2);
    const ok = !!n1 && !!n2 && (nodeStartLine(text, n1, newLineBytePos) === nodeStartLine(text, n2, newLineBytePos)) !== negated;
    if (!ok) return false;
  }
  if (preds.oneLine) {
    const [capture, negated] = preds.oneLine;
    const node = first(capture);
    const ok = !!node && (nodeEndLine(text, node, newLineBytePos) === nodeStartLine(text, node, newLineBytePos)) !== negated;
    if (!ok) return false;
  }
  return true;
}

interface QueryResult {
  indentCaptures: Map<number, IndentCapture[]>;
  extendCaptures: Map<number, ExtendCapture[]>;
  opaqueRanges: [number, number][];
}

function queryIndents(query: IndentQuery, root: Node, text: DocText, range: [number, number], newLineBytePos: number | null): QueryResult {
  const indentCaptures = new Map<number, IndentCapture[]>();
  const extendCaptures = new Map<number, ExtendCapture[]>();
  const opaqueRanges: [number, number][] = [];
  const push = <T>(map: Map<number, T[]>, id: number, value: T) => {
    const list = map.get(id);
    if (list) list.push(value);
    else map.set(id, [value]);
  };
  const c = query.captures;
  const cursor = new QueryCursor(query.query, root, text.syntax.input, range, TREE_SITTER_MATCH_LIMIT);
  try {
    for (let m = cursor.nextMatch(); m; m = cursor.nextMatch()) {
      const preds = query.predicates.get(m.pattern);
      if (preds && !areSatisfied(preds, m, text, newLineBytePos, query.query.language)) continue;
      const added: [number, IndentCapture][] = [];
      let anchor: Node | null = null;
      for (const matched of m.nodes) {
        const id = matched.node.id;
        const capture = matched.capture;
        let type: CaptureType;
        if (capture === c.indent) type = { kind: "indent" };
        else if (capture === c.indentAlways) type = { kind: "indent-always" };
        else if (capture === c.outdent) type = { kind: "outdent" };
        else if (capture === c.outdentAlways) type = { kind: "outdent-always" };
        else if (capture === c.align) type = { kind: "align", text: "" };
        else if (capture === c.anchor) {
          anchor ??= matched.node;
          continue;
        } else if (capture === c.extend) {
          push(extendCaptures, id, "extend");
          continue;
        } else if (capture === c.extendPreventOnce) {
          push(extendCaptures, id, "prevent-once");
          continue;
        } else if (capture === c.opaque) {
          opaqueRanges.push([matched.node.startByte, matched.node.endByte]);
          continue;
        } else continue;
        added.push([id, { type, header: query.headerPatterns.has(m.pattern) }]);
      }
      for (const [id, capture] of added) {
        if (capture.type.kind === "align") {
          if (!anchor) continue;
          const line = text.byteToLine(anchor.startByte);
          capture.type = { kind: "align", text: text.syntax.slice(text.lineToByte(line), anchor.startByte) };
        }
        push(indentCaptures, id, capture);
      }
    }
  } finally {
    cursor.delete();
  }
  return { indentCaptures, extendCaptures, opaqueRanges };
}

function extendNodes(node: { value: Node }, deepestPreceding: Node, extendCaptures: Map<number, ExtendCapture[]>, text: DocText, line: number, tabWidth: number, indentWidth: number): void {
  let stopExtend = false;
  let deepest: Node | null = deepestPreceding;
  while (deepest && !deepest.equals(node.value)) {
    let extendNode = false;
    let nodeCaptured = false;
    const captures = extendCaptures.get(deepest.id);
    if (captures) {
      for (const capture of captures) {
        if (capture === "prevent-once") stopExtend = true;
        else {
          nodeCaptured = true;
          if (text.byteToLine(deepest.endByte) === line) extendNode = true;
          else {
            const cursorIndent = indentLevelForLine(text.line(line), tabWidth, indentWidth);
            const nodeIndent = indentLevelForLine(text.line(text.byteToLine(deepest.startByte)), tabWidth, indentWidth);
            if (cursorIndent > nodeIndent) extendNode = true;
          }
        }
      }
    }
    if (nodeCaptured && stopExtend) stopExtend = false;
    else if (extendNode && !stopExtend) {
      node.value = deepest;
      break;
    }
    deepest = deepest.parent;
  }
}

function candidateBodyForNewLine(deepestPreceding: Node, bytePos: number): Node | null {
  let node = deepestPreceding;
  for (let parent = node.parent; parent; parent = node.parent) {
    if (node.endByte > bytePos) break;
    const cursor = parent.walk();
    try {
      if (cursor.gotoFirstChild()) {
        for (;;) {
          if (cursor.currentNode.id === node.id) {
            if (cursor.gotoNextSibling()) {
              const child = cursor.currentNode;
              if (child.startByte >= bytePos) return child;
            }
            break;
          }
          if (!cursor.gotoNextSibling()) break;
        }
      }
    } finally {
      cursor.delete();
    }
    node = parent;
  }
  return null;
}

function initIndentQuery(
  query: IndentQuery,
  root: Node,
  text: DocText,
  tabWidth: number,
  indentWidth: number,
  line: number,
  bytePos: number,
  newLineBytePos: number | null,
): [Node, Map<number, IndentCapture[]>, [number, number][]] | null {
  const start = root.descendantForByteRange(bytePos, bytePos);
  if (!start) return null;
  const node = { value: start };
  let deepestPreceding: Node | null = null;
  for (const child of start.children) if (child.endByte <= bytePos) deepestPreceding = child;
  if (deepestPreceding) {
    let prec: Node = deepestPreceding;
    while (prec.childCount > 0) prec = prec.child(prec.childCount - 1)!;
    deepestPreceding = prec;
  }
  const candidateBody = newLineBytePos !== null && deepestPreceding ? candidateBodyForNewLine(deepestPreceding, bytePos) : null;
  const upper = candidateBody ? candidateBody.endByte : bytePos + 1;
  const range: [number, number] = deepestPreceding ? [deepestPreceding.endByte - 1, upper] : [bytePos, upper];
  const result = queryIndents(query, root, text, range, newLineBytePos);
  let descended = false;
  if (candidateBody && result.indentCaptures.get(candidateBody.id)?.some((c) => c.header)) {
    node.value = candidateBody;
    descended = true;
  }
  if (deepestPreceding && !descended) extendNodes(node, deepestPreceding, result.extendCaptures, text, line, tabWidth, indentWidth);
  return [node.value, result.indentCaptures, result.opaqueRanges];
}

function opaqueHit(start: number, end: number, bytePos: number, text: DocText): boolean {
  return start <= bytePos && bytePos < end && text.byteToLine(start) < text.byteToLine(bytePos);
}

function containmentAccounting(
  query: IndentQuery,
  root: Node,
  text: DocText,
  tabWidth: number,
  indentWidth: number,
  line: number,
  bytePos: number,
  newLine: boolean,
): [Indentation, boolean] | null {
  const newLineBytePos = newLine ? bytePos : null;
  const init = initIndentQuery(query, root, text, tabWidth, indentWidth, line, bytePos, newLineBytePos);
  if (!init) return null;
  const [startNode, captures, opaqueRanges] = init;
  if (opaqueRanges.some(([s, e]) => opaqueHit(s, e, bytePos, text))) return [emptyIndentation(), true];
  const targetLine = line + (newLine ? 1 : 0);
  let indentLevels = 0;
  let indentAlways = 0;
  let outdent = 0;
  let outdentAlways = 0;
  let align: string | null = null;
  const countedStartLines: number[] = [];
  for (let node: Node | null = startNode; node; node = node.parent) {
    const defs = captures.get(node.id);
    if (!defs) continue;
    let hasIndent = false;
    let hasIndentAlways = false;
    let hasOutdent = false;
    let hasOutdentAlways = false;
    let headerScoped = false;
    let nodeAlign: string | null = null;
    for (const def of defs) {
      switch (def.type.kind) {
        case "indent":
          hasIndent = true;
          headerScoped ||= def.header;
          break;
        case "indent-always":
          hasIndentAlways = true;
          headerScoped ||= def.header;
          break;
        case "outdent":
          hasOutdent = true;
          break;
        case "outdent-always":
          hasOutdentAlways = true;
          break;
        case "align":
          nodeAlign = def.type.text;
      }
    }
    const nodeStart = nodeStartLine(text, node, newLineBytePos);
    const end = nodeEndLine(text, node, newLineBytePos);
    const parent = headerScoped ? node.parent : null;
    const start = parent ? nodeStartLine(text, parent, newLineBytePos) : nodeStart;
    const contains = start < targetLine && targetLine <= end;
    const opensTarget = nodeStart === targetLine;
    if (!((hasIndent || hasIndentAlways) && (hasOutdent || hasOutdentAlways))) {
      if (hasIndent && contains && !countedStartLines.includes(start)) {
        countedStartLines.push(start);
        indentLevels++;
      }
      if (hasIndentAlways && contains) indentAlways++;
      if (hasOutdent && opensTarget) outdent++;
      if (hasOutdentAlways && opensTarget) outdentAlways++;
    }
    if (nodeAlign !== null && contains && align === null) align = nodeAlign;
  }
  if (align !== null) {
    indentLevels = 0;
    indentAlways = 0;
  }
  return [{ indent: indentLevels, indentAlways, outdent, outdentAlways, align }, false];
}

function injectionBaseLevel(syntax: Syntax, text: DocText, bytePos: number, tabWidth: number, indentWidth: number): number {
  const layer = syntax.layerForByteRange(bytePos, bytePos);
  const inLayer = (line: number) => {
    const fnw = firstNonWhitespace(text.line(line));
    if (fnw === null) return false;
    const b = syntax.byteOf(text.doc.line(line + 1).from + fnw);
    return syntax.layerForByteRange(b, b) === layer;
  };
  const bl = text.byteToLine(bytePos);
  let first: number;
  if (inLayer(bl)) {
    first = bl;
    while (first > 0 && inLayer(first - 1)) first--;
  } else {
    const total = text.lines;
    first = bl + 1;
    while (first + 1 < total && !inLayer(first)) first++;
  }
  return indentLevelForLine(text.line(first), tabWidth, indentWidth);
}

export function indentQueryFor(loader: LanguageLoader, language: LanguageId): IndentQuery | null {
  return loader.indentQuery(language, (grammar, source) => new IndentQuery(grammar, source, loader.regex));
}

export function treesitterIndentForPos(
  query: IndentQuery,
  syntax: Syntax,
  tabWidth: number,
  indentWidth: number,
  doc: Text,
  line: number,
  pos: number,
  newLine: boolean,
): Indentation | null {
  const text = new DocText(doc, syntax);
  const bytePos = syntax.byteOf(pos);
  const layer = syntax.layerForByteRange(bytePos, bytePos);
  const injected = layer !== syntax.root && layer.language !== syntax.root.language ? indentQueryFor(syntax.loader, layer.language) : null;
  const active = injected ?? query;
  const tree = injected ? syntax.treeForByteRange(bytePos, bytePos) : syntax.root.tree!;
  const result = containmentAccounting(active, tree.rootNode, text, tabWidth, indentWidth, line, bytePos, newLine);
  if (!result) return null;
  const [indentation, opaque] = result;
  if (opaque) {
    const lineText = text.line(line);
    const first = firstNonWhitespace(lineText) ?? lineText.length;
    return { ...emptyIndentation(), align: lineText.slice(0, first) };
  }
  if (injected) indentation.indent += injectionBaseLevel(syntax, text, bytePos, tabWidth, indentWidth);
  return indentation;
}

export function indentForNewline(
  syntax: Syntax | null,
  heuristic: IndentHeuristic,
  style: IndentStyle,
  tabWidth: number,
  doc: Text,
  lineBefore: number,
  lineBeforeEndPos: number,
  currentLine: number,
): string {
  const indentWidth = indentStyleWidth(style, tabWidth);
  const query = syntax && heuristic !== "simple" ? indentQueryFor(syntax.loader, syntax.root.language) : null;
  if (syntax && query) {
    const indent = treesitterIndentForPos(query, syntax, tabWidth, indentWidth, doc, lineBefore, lineBeforeEndPos, true);
    if (indent) {
      if (heuristic === "hybrid") {
        let attempts = 0;
        for (let lineIdx = lineBefore; lineIdx >= 0; lineIdx--) {
          const line = doc.line(lineIdx + 1);
          const fnw = firstNonWhitespace(line.text);
          if (fnw === null) continue;
          const computed = treesitterIndentForPos(query, syntax, tabWidth, indentWidth, doc, lineIdx, line.from + fnw, false);
          const relative = computed ? relativeIndent(indent, computed, line.text.slice(0, fnw), style, tabWidth) : null;
          if (relative !== null) return relative;
          attempts++;
          if (attempts === 4) break;
        }
      }
      return indentationString(indent, style, tabWidth);
    }
  }
  const lineText = doc.line(currentLine + 1).text;
  return indentStyleStr(style).repeat(indentLevelForLine(lineText, tabWidth, indentWidth));
}
