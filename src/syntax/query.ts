import type { RustRegexEngine } from "../core/rx";
import { Node, type Language, type Runtime } from "./ts";

export type PredicateArg = { kind: "capture"; capture: number } | { kind: "string"; value: string };

export interface Predicate {
  name: string;
  args: PredicateArg[];
}

export type UserPredicate =
  | { kind: "is-property-set"; negate: boolean; key: string; val: string | null }
  | { kind: "set-property"; key: string; val: string | null }
  | { kind: "other"; predicate: Predicate };

export class InvalidPredicateError extends Error {}

export function unknownPredicate(predicate: UserPredicate): InvalidPredicateError {
  if (predicate.kind === "other") return new InvalidPredicateError(`unknown predicate #${predicate.predicate.name}`);
  return new InvalidPredicateError(`unknown property '${predicate.key}'`);
}

export class QueryParseError extends Error {}

type TextPredicateKind =
  | { kind: "eq-string"; value: Uint8Array }
  | { kind: "eq-capture"; capture: number }
  | { kind: "match-string"; regex: number }
  | { kind: "any-string"; values: Uint8Array[] };

interface TextPredicate {
  capture: number;
  kind: TextPredicateKind;
  negated: boolean;
  matchAll: boolean;
}

export interface MatchedNode {
  node: Node;
  capture: number;
}

export interface QueryInput {
  readonly utf8: Uint8Array;
}

const ERROR_KINDS = ["none", "syntax", "node-type", "field", "capture", "structure", "language"] as const;

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function argOf(query: Query, type: number, value: number): PredicateArg {
  return type === 1 ? { kind: "capture", capture: value } : { kind: "string", value: query.stringValue(value) };
}

function checkArgCount(p: Predicate, n: number): void {
  if (p.args.length !== n) throw new InvalidPredicateError(`expected ${n} arguments for #${p.name}, got ${p.args.length}`);
}

function checkMinArgCount(p: Predicate, n: number): void {
  if (n > p.args.length) throw new InvalidPredicateError(`expected at least ${n} arguments for #${p.name}, got ${p.args.length}`);
}

function checkMaxArgCount(p: Predicate, n: number): void {
  if (p.args.length > n) throw new InvalidPredicateError(`expected at most ${n} arguments for #${p.name}, got ${p.args.length}`);
}

function strArg(query: Query, p: Predicate, i: number): string {
  const arg = p.args[i]!;
  if (arg.kind === "string") return arg.value;
  throw new InvalidPredicateError(`${i}. argument to #${p.name} must be a literal, got capture @${JSON.stringify(query.captureName(arg.capture))}`);
}

function captureArg(p: Predicate, i: number): number {
  const arg = p.args[i]!;
  if (arg.kind === "capture") return arg.capture;
  throw new InvalidPredicateError(`${i}. argument to #${p.name} expected a capture, got literal ${JSON.stringify(arg.value)}`);
}

function parseProperty(query: Query, p: Predicate): { key: string; val: string | null } {
  checkMinArgCount(p, 1);
  checkMaxArgCount(p, 2);
  const key = strArg(query, p, 0);
  const val = p.args.length === 2 ? strArg(query, p, 1) : null;
  return { key, val };
}

export class Query {
  readonly ptr: number;
  readonly captureNames: string[] = [];
  private readonly strings: string[] = [];
  private readonly textPredicates: TextPredicate[][] = [];
  private readonly regexes: number[] = [];

  constructor(
    readonly rt: Runtime,
    readonly language: Language,
    source: string,
    custom: (pattern: number, predicate: UserPredicate) => void,
    private readonly regex: RustRegexEngine | null = null,
  ) {
    const bytes = new TextEncoder().encode(source);
    const src = rt.alloc(bytes);
    const error = rt.lenPtr;
    this.ptr = rt.x.hm_query_new(language.ptr, src, bytes.length, error);
    rt.x.hm_free(src);
    if (!this.ptr) {
      const words = rt.u32();
      const offset = new TextDecoder().decode(bytes.subarray(0, words[error >> 2])).length;
      const kind = ERROR_KINDS[words[(error >> 2) + 1]!] ?? "syntax";
      throw new QueryParseError(`invalid ${kind} in query at ${offset}`);
    }
    const captureCount = rt.x.hm_query_capture_count(this.ptr);
    for (let i = 0; i < captureCount; i++) this.captureNames.push(this.read(rt.x.hm_query_capture_name(this.ptr, i, rt.lenPtr)));
    const stringCount = rt.x.hm_query_string_count(this.ptr);
    for (let i = 0; i < stringCount; i++) this.strings.push(this.read(rt.x.hm_query_string(this.ptr, i, rt.lenPtr)));
    const patternCount = rt.x.hm_query_pattern_count(this.ptr);
    try {
      for (let pattern = 0; pattern < patternCount; pattern++) this.textPredicates.push(this.parsePatternPredicates(pattern, custom));
    } catch (err) {
      this.delete();
      if (err instanceof InvalidPredicateError) {
        const start = new TextDecoder().decode(bytes.subarray(0, rt.x.hm_query_start_byte(this.ptr, this.textPredicates.length))).length;
        throw new QueryParseError(`${err.message} in the pattern at ${start}`);
      }
      throw err;
    }
  }

  private read(ptr: number): string {
    return this.rt.string(ptr, this.rt.u32()[this.rt.lenPtr >> 2]!);
  }

  stringValue(id: number): string {
    return this.strings[id]!;
  }

  captureName(capture: number): string {
    return this.captureNames[capture]!;
  }

  getCapture(name: string): number | null {
    const i = this.captureNames.indexOf(name);
    return i < 0 ? null : i;
  }

  get patternCount(): number {
    return this.textPredicates.length;
  }

  startByteForPattern(pattern: number): number {
    return this.rt.x.hm_query_start_byte(this.ptr, pattern);
  }

  disableCapture(name: string): void {
    const bytes = new TextEncoder().encode(name);
    const ptr = this.rt.alloc(bytes);
    this.rt.x.hm_query_disable_capture(this.ptr, ptr, bytes.length);
    this.rt.x.hm_free(ptr);
  }

  delete(): void {
    for (const regex of this.regexes) this.regex?.drop(regex);
    this.regexes.length = 0;
    this.rt.x.hm_query_delete(this.ptr);
  }

  private compileRegex(pattern: string): number {
    if (!this.regex) throw new InvalidPredicateError(`invalid regex '${pattern}', no regex engine`);
    try {
      const regex = this.regex.compile(`(?-m)${pattern}`, false);
      this.regexes.push(regex);
      return regex;
    } catch (err) {
      throw new InvalidPredicateError(`invalid regex '${pattern}', ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private parsePatternPredicates(pattern: number, custom: (pattern: number, predicate: UserPredicate) => void): TextPredicate[] {
    const rt = this.rt;
    const steps = rt.x.hm_query_predicates(this.ptr, pattern, rt.lenPtr);
    const count = rt.u32()[rt.lenPtr >> 2]!;
    const words = rt.u32().slice(steps >> 2, (steps >> 2) + count * 2);
    const out: TextPredicate[] = [];
    let current: [number, number][] = [];
    const predicates: [number, number][][] = [];
    for (let i = 0; i < count; i++) {
      const type = words[i * 2]!;
      const value = words[i * 2 + 1]!;
      if (type === 0) {
        if (current.length > 0) predicates.push(current);
        current = [];
      } else current.push([type, value]);
    }
    if (current.length > 0) predicates.push(current);
    const encode = (s: string) => new TextEncoder().encode(s);
    for (const steps of predicates) {
      const [headType, headValue] = steps[0]!;
      if (headType !== 2) {
        throw new InvalidPredicateError(`expected predicate to start with a function name. Got @${this.captureName(headValue)}.`);
      }
      const p: Predicate = { name: this.stringValue(headValue), args: steps.slice(1).map(([t, v]) => argOf(this, t, v)) };
      switch (p.name) {
        case "eq?":
        case "not-eq?":
        case "any-eq?":
        case "any-not-eq?": {
          checkArgCount(p, 2);
          const capture = captureArg(p, 0);
          const arg2 = p.args[1]!;
          const negated = ["not-eq?", "not-any-eq?"].includes(p.name);
          const matchAll = p.name === "eq?" || p.name === "not-eq?";
          const kind: TextPredicateKind =
            arg2.kind === "capture" ? { kind: "eq-capture", capture: arg2.capture } : { kind: "eq-string", value: encode(arg2.value) };
          out.push({ capture, kind, negated, matchAll });
          break;
        }
        case "match?":
        case "not-match?":
        case "any-match?":
        case "any-not-match?": {
          checkArgCount(p, 2);
          const capture = captureArg(p, 0);
          const source = strArg(this, p, 1);
          const negated = p.name === "not-match?" || p.name === "any-not-match?";
          const matchAll = p.name === "match?" || p.name === "not-match?";
          out.push({ capture, kind: { kind: "match-string", regex: this.compileRegex(source) }, negated, matchAll });
          break;
        }
        case "set!": {
          const { key, val } = parseProperty(this, p);
          custom(pattern, { kind: "set-property", key, val });
          break;
        }
        case "is-not?":
        case "is?": {
          const { key, val } = parseProperty(this, p);
          custom(pattern, { kind: "is-property-set", negate: p.name === "is-not?", key, val });
          break;
        }
        case "any-of?":
        case "not-any-of?": {
          checkMinArgCount(p, 1);
          const capture = captureArg(p, 0);
          const values: Uint8Array[] = [];
          for (let i = 1; i < p.args.length; i++) values.push(encode(strArg(this, p, i)));
          out.push({ capture, kind: { kind: "any-string", values }, negated: p.name === "not-any-of?", matchAll: false });
          break;
        }
        default:
          custom(pattern, { kind: "other", predicate: p });
      }
    }
    return out;
  }

  satisfies(pattern: number, nodes: MatchedNode[], input: QueryInput): boolean {
    const predicates = this.textPredicates[pattern]!;
    for (const predicate of predicates) if (!this.satisfied(predicate, nodes, input)) return false;
    return true;
  }

  private satisfied(p: TextPredicate, nodes: MatchedNode[], input: QueryInput): boolean {
    const text = (node: Node) => input.utf8.subarray(node.startByte, node.endByte);
    const helper = (results: Iterable<boolean>) => {
      if (p.matchAll) {
        for (const matched of results) if (matched === p.negated) return false;
        return true;
      }
      for (const matched of results) if (matched !== p.negated) return true;
      return false;
    };
    const captured = nodes.filter((n) => n.capture === p.capture);
    const kind = p.kind;
    switch (kind.kind) {
      case "eq-string":
        return helper(captured.map((n) => bytesEqual(text(n.node), kind.value)));
      case "eq-capture": {
        const others = nodes.filter((n) => n.capture === kind.capture);
        const pairs = Math.min(captured.length, others.length);
        const results: boolean[] = [];
        for (let i = 0; i < pairs; i++) results.push(bytesEqual(text(captured[i]!.node), text(others[i]!.node)));
        const res = helper(results);
        if (!p.matchAll) return res;
        return res && captured.length - pairs <= 1 && others.length === pairs;
      }
      case "match-string":
        return helper(captured.map((n) => this.regex!.isMatchBytes(kind.regex, text(n.node))));
      case "any-string":
        return helper(
          captured.map((n) => {
            const bytes = text(n.node);
            return kind.values.some((value) => bytesEqual(value, bytes));
          }),
        );
    }
  }
}

export interface QueryMatch {
  id: number;
  pattern: number;
  nodes: MatchedNode[];
}

export const TREE_SITTER_MATCH_LIMIT = 256;
const MAX = 0xffffffff;

export class QueryCursor {
  private ptr: number;
  private readonly out: number;

  constructor(
    readonly query: Query,
    node: Node,
    private readonly input: QueryInput,
    range: [number, number] = [0, MAX],
    limit = MAX,
  ) {
    const rt = query.rt;
    this.ptr = rt.x.hm_qc_new();
    this.out = rt.x.hm_malloc(24);
    rt.writeNode(rt.inPtr, node);
    rt.x.hm_qc_exec(this.ptr, query.ptr, rt.inPtr, range[0], range[1], limit);
  }

  private readMatch(): QueryMatch {
    const rt = this.query.rt;
    const words = rt.u32();
    const base = this.out >> 2;
    const id = words[base]!;
    const pattern = words[base + 1]!;
    const count = words[base + 2]!;
    const captures = words[base + 3]! >> 2;
    const nodes: MatchedNode[] = [];
    for (let i = 0; i < count; i++) {
      const at = captures + i * 7;
      nodes.push({ node: new Node(rt, words.slice(at, at + 6)), capture: words[at + 6]! });
    }
    return { id, pattern, nodes };
  }

  nextMatch(): QueryMatch | null {
    const rt = this.query.rt;
    for (;;) {
      if (!rt.x.hm_qc_next_match(this.ptr, this.out)) return null;
      const match = this.readMatch();
      if (this.query.satisfies(match.pattern, match.nodes, this.input)) return match;
    }
  }

  nextMatchedNode(): [QueryMatch, number] | null {
    const rt = this.query.rt;
    for (;;) {
      if (!rt.x.hm_qc_next_capture(this.ptr, this.out)) return null;
      const match = this.readMatch();
      const index = rt.u32()[(this.out >> 2) + 4]!;
      if (this.query.satisfies(match.pattern, match.nodes, this.input)) return [match, index];
      rt.x.hm_qc_remove_match(this.ptr, match.id);
    }
  }

  removeMatch(id: number): void {
    this.query.rt.x.hm_qc_remove_match(this.ptr, id);
  }

  didExceedMatchLimit(): boolean {
    return this.query.rt.x.hm_qc_exceeded(this.ptr) !== 0;
  }

  delete(): void {
    if (!this.ptr) return;
    this.query.rt.x.hm_qc_delete(this.ptr);
    this.query.rt.x.hm_free(this.out);
    this.ptr = 0;
  }
}
