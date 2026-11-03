import type { RustRegexEngine } from "../core/rx";
import { Query, QueryCursor, TREE_SITTER_MATCH_LIMIT, unknownPredicate, type QueryInput, type QueryMatch } from "./query";
import type { Language, Node } from "./ts";

export type LanguageId = number;

export type InjectionLanguageMarker =
  | { kind: "name"; name: string }
  | { kind: "match"; text: string }
  | { kind: "filename"; text: string }
  | { kind: "shebang"; text: string };

export interface SyntaxConfig {
  grammar: Language;
  injectionQuery: InjectionsQuery;
}

export interface InjectionLoader {
  languageForMarker(marker: InjectionLanguageMarker): LanguageId | null;
  getConfig(language: LanguageId): SyntaxConfig | null;
}

export type IncludedChildren = "none" | "all" | "unnamed";

interface InjectionProperties {
  includeChildren: IncludedChildren;
  language: string | null;
  combined: boolean;
}

export type InjectionScope = string;

export interface InjectionQueryMatch {
  includeChildren: IncludedChildren;
  language: LanguageId;
  scope: InjectionScope | null;
  node: Node;
  range: [number, number];
  lastMatch: boolean;
  pattern: number;
}

const SHEBANG = /#!\p{White_Space}*(?:\P{White_Space}*[/\\](?:env\p{White_Space}+(?:-\P{White_Space}+\p{White_Space}+)*)?)?([^\p{White_Space}.\p{Nd}]+)/u;

export function shebangMarker(text: string): string | null {
  return SHEBANG.exec(text)?.[1] ?? null;
}

function firstLines(text: string, count: number): string {
  let end = 0;
  for (let line = 0; line < count; line++) {
    const next = text.indexOf("\n", end);
    if (next < 0) return text;
    end = next + 1;
  }
  return text.slice(0, end);
}

export class InjectionsQuery {
  readonly query: Query;
  private readonly properties = new Map<number, InjectionProperties>();
  readonly contentCapture: number | null;
  private readonly languageCapture: number | null;
  private readonly filenameCapture: number | null;
  private readonly shebangCapture: number | null;

  constructor(grammar: Language, injectionQueryText: string, regex: RustRegexEngine | null) {
    const props = (pattern: number) => {
      let p = this.properties.get(pattern);
      if (!p) {
        p = { includeChildren: "none", language: null, combined: false };
        this.properties.set(pattern, p);
      }
      return p;
    };
    this.query = new Query(
      grammar.rt,
      grammar,
      injectionQueryText,
      (pattern, predicate) => {
        if (predicate.kind === "set-property") {
          if (predicate.key === "injection.include-unnamed-children" && predicate.val === null) {
            props(pattern).includeChildren = "unnamed";
            return;
          }
          if (predicate.key === "injection.include-children" && predicate.val === null) {
            props(pattern).includeChildren = "all";
            return;
          }
          if (predicate.key === "injection.language" && predicate.val !== null) {
            props(pattern).language = predicate.val;
            return;
          }
          if (predicate.key === "injection.combined" && predicate.val === null) {
            props(pattern).combined = true;
            return;
          }
        }
        throw unknownPredicate(predicate);
      },
      regex,
    );
    this.contentCapture = this.query.getCapture("injection.content");
    this.languageCapture = this.query.getCapture("injection.language");
    this.filenameCapture = this.query.getCapture("injection.filename");
    this.shebangCapture = this.query.getCapture("injection.shebang");
  }

  private processMatch(match: QueryMatch, nodeIdx: number, input: QueryInput & { slice(start: number, end: number): string }, loader: InjectionLoader): InjectionQueryMatch | null {
    const properties = this.properties.get(match.pattern);
    let marker: InjectionLanguageMarker | null = null;
    let lastContentNode = 0;
    let contentNodes = 0;
    match.nodes.forEach((matched, i) => {
      const capture = matched.capture;
      if (capture === this.languageCapture) {
        marker = { kind: "match", text: input.slice(matched.node.startByte, matched.node.endByte) };
      } else if (capture === this.filenameCapture) {
        marker = { kind: "filename", text: input.slice(matched.node.startByte, matched.node.endByte) };
      } else if (capture === this.shebangCapture) {
        const lines = firstLines(input.slice(matched.node.startByte, matched.node.endByte), 2);
        const found = shebangMarker(lines);
        marker = found === null ? null : { kind: "shebang", text: found };
      } else if (capture === this.contentCapture) {
        contentNodes++;
        lastContentNode = i;
      }
    });
    const resolved: InjectionLanguageMarker | null = marker ?? (properties?.language ? { kind: "name", name: properties.language } : null);
    if (!resolved) return null;
    const language = loader.languageForMarker(resolved);
    if (language === null) return null;
    let scope: InjectionScope | null = null;
    if (properties?.combined) scope = `pattern:${match.pattern}:${language}`;
    else if (contentNodes !== 1) scope = `match:${match.id}`;
    const node = match.nodes[nodeIdx]!.node;
    return {
      language,
      scope,
      includeChildren: properties?.includeChildren ?? "none",
      node,
      range: [node.startByte, node.endByte],
      lastMatch: lastContentNode === nodeIdx,
      pattern: match.pattern,
    };
  }

  *execute(node: Node, input: QueryInput & { slice(start: number, end: number): string }, loader: InjectionLoader): Generator<InjectionQueryMatch> {
    const content = this.contentCapture!;
    const cursor = new QueryCursor(this.query, node, input, [0, 0xffffffff], TREE_SITTER_MATCH_LIMIT);
    const processMatch = this.processMatch.bind(this);
    function* raw(): Generator<InjectionQueryMatch> {
      for (;;) {
        const next = cursor.nextMatchedNode();
        if (!next) return;
        const [match, nodeIdx] = next;
        if (match.nodes[nodeIdx]!.capture !== content) continue;
        const mat = processMatch(match, nodeIdx, input, loader);
        if (!mat) {
          cursor.removeMatch(match.id);
          continue;
        }
        if (mat.lastMatch) cursor.removeMatch(match.id);
        if (mat.range[0] === mat.range[1]) continue;
        yield mat;
      }
    }
    const iter = raw();
    let peeked: InjectionQueryMatch | null | undefined;
    const peek = (): InjectionQueryMatch | null => {
      if (peeked === undefined) {
        const r = iter.next();
        peeked = r.done ? null : r.value;
      }
      return peeked;
    };
    const take = (): InjectionQueryMatch | null => {
      const value = peek();
      peeked = undefined;
      return value;
    };
    const nextIf = (f: (m: InjectionQueryMatch) => boolean): InjectionQueryMatch | null => {
      const value = peek();
      if (value && f(value)) return take();
      return null;
    };
    const buf: InjectionQueryMatch[] = [];
    try {
      for (;;) {
        const pending = buf.pop();
        if (pending) {
          yield pending;
          continue;
        }
        let res = take();
        if (!res) return;
        if (res.includeChildren === "none") {
          let fastReturn = true;
          for (;;) {
            const current = res;
            const overlap = nextIf((m) => m.range[0] === current.range[0] && m.range[1] === current.range[1]);
            if (!overlap) break;
            if (overlap.includeChildren !== "none") {
              buf.push(overlap);
              fastReturn = false;
              break;
            }
            res = overlap;
          }
          if (fastReturn) {
            yield res;
            continue;
          }
        }
        for (;;) {
          const end = res.range[1];
          const overlap = nextIf((m) => m.range[1] <= end);
          if (!overlap) break;
          buf.push(overlap);
        }
        if (buf.length === 0) {
          yield res;
          continue;
        }
        buf.push(res);
        buf.sort((a, b) => a.pattern - b.pattern || b.range[0] - a.range[0]);
        yield buf.pop()!;
      }
    } finally {
      cursor.delete();
    }
  }
}
