import type { LanguageId } from "./injections";
import type { LanguageLoader } from "./loader";
import { QueryCursor, TREE_SITTER_MATCH_LIMIT, type Query, type QueryMatch } from "./query";
import { unknownPredicate } from "./query";
import type { Layer, Syntax, Injection } from "./syntax";
import type { Language, Node } from "./ts";

const MAX = 0xffffffff;

export type Highlight = number;

interface Definition {
  capture: number;
  start: number;
  end: number;
}

interface ScopeData {
  definitions: Map<string, Definition>;
  start: number;
  end: number;
  inherit: boolean;
  children: number[];
  parent: number | null;
}

export class Locals {
  readonly scopes: ScopeData[] = [{ definitions: new Map(), start: 0, end: MAX, inherit: false, children: [], parent: null }];

  push(scope: ScopeData): number {
    const id = this.scopes.length;
    this.scopes[scope.parent!]!.children.push(id);
    this.scopes.push(scope);
    return id;
  }

  lookupReference(scope: number, name: string): Definition | null {
    for (let current: number | null = scope; current !== null; ) {
      const data: ScopeData = this.scopes[current]!;
      const definition = data.definitions.get(name);
      if (definition) return definition;
      if (!data.inherit) break;
      current = data.parent;
    }
    return null;
  }

  scopeCursor(pos: number): ScopeCursor {
    let scope = 0;
    const stack: [number, number][] = [];
    for (;;) {
      const data = this.scopes[scope]!;
      let childIdx = 0;
      while (childIdx < data.children.length && this.scopes[data.children[childIdx]!]!.end < pos) childIdx++;
      stack.push([scope, childIdx]);
      const child = data.children[childIdx];
      if (child === undefined || pos < this.scopes[child]!.start) break;
      scope = child;
    }
    return new ScopeCursor(this, stack);
  }
}

export class ScopeCursor {
  constructor(
    readonly locals: Locals,
    private readonly stack: [number, number][],
  ) {}

  advance(to: number): number {
    let [active, childIdx] = this.stack.pop()!;
    for (;;) {
      if (to < this.locals.scopes[active]!.end) break;
      [active, childIdx] = this.stack.pop()!;
      childIdx += 1;
    }
    outer: for (;;) {
      const data = this.locals.scopes[active]!;
      for (;;) {
        const child = data.children[childIdx];
        if (child === undefined) break outer;
        const childData = this.locals.scopes[child]!;
        if (childData.start > to) break outer;
        if (to < childData.end) {
          this.stack.push([active, childIdx]);
          active = child;
          childIdx = 0;
          break;
        }
        childIdx += 1;
      }
    }
    this.stack.push([active, childIdx]);
    return active;
  }

  currentScope(): number {
    return this.stack[this.stack.length - 1]![0];
  }
}

export function configureScope(captureName: string, scopes: readonly string[]): Highlight | null {
  const parts = captureName.split(".");
  let best: number | null = null;
  let bestLength = 0;
  scopes.forEach((name, i) => {
    let length = 0;
    let matches = true;
    const recognized = name.split(".");
    for (let k = 0; k < recognized.length; k++) {
      if (parts[k] === recognized[k]) length += 1;
      else {
        matches = false;
        break;
      }
    }
    if (matches && length > bestLength) {
      best = i;
      bestLength = length;
    }
  });
  return best;
}

export class LocalsQuery {
  readonly query: Query;
  readonly scopeCapture: number | null;
  readonly notScopeInherits = new Set<number>();
  readonly definitionCaptures = new Map<number, string>();

  constructor(loader: LanguageLoader, grammar: Language, text: string) {
    this.query = loader.newQuery(grammar, text, (pattern, predicate) => {
      if (predicate.kind === "set-property" && predicate.key === "local.scope-inherits") {
        if (predicate.val === "false") this.notScopeInherits.add(pattern);
        return;
      }
      throw unknownPredicate(predicate);
    });
    this.query.disableCapture("local.reference");
    this.scopeCapture = this.query.getCapture("local.scope");
    this.query.captureNames.forEach((name, capture) => {
      if (name.startsWith("local.definition.")) this.definitionCaptures.set(capture, name.slice("local.definition.".length));
    });
  }
}

export class HighlightQuery {
  readonly query: Query;
  readonly nonLocalPatterns = new Set<number>();
  readonly localReferenceCapture: number | null;
  readonly firstLocalsPattern: number;

  constructor(loader: LanguageLoader, grammar: Language, highlights: string, locals: string) {
    this.query = loader.newQuery(grammar, highlights + locals, (pattern, predicate) => {
      if (predicate.kind === "set-property" && predicate.key === "local.scope-inherits") return;
      if (predicate.kind === "is-property-set" && predicate.negate && predicate.key === "local" && predicate.val === null) {
        this.nonLocalPatterns.add(pattern);
        return;
      }
      throw unknownPredicate(predicate);
    });
    const length = new TextEncoder().encode(highlights).length;
    let first = MAX;
    for (let pattern = 0; pattern < this.query.patternCount; pattern++) {
      if (this.query.startByteForPattern(pattern) >= length) {
        first = pattern;
        break;
      }
    }
    this.firstLocalsPattern = first;
    this.query.disableCapture("local.scope");
    for (const name of this.query.captureNames) if (name.startsWith("local.definition.")) this.query.disableCapture(name);
    this.localReferenceCapture = this.query.getCapture("local.reference");
  }
}

export class RainbowQuery {
  readonly query: Query;
  readonly includeChildrenPatterns = new Set<number>();
  readonly scopeCapture: number | null;
  readonly bracketCapture: number | null;

  constructor(loader: LanguageLoader, grammar: Language, text: string) {
    this.query = loader.newQuery(grammar, text, (pattern, predicate) => {
      if (predicate.kind === "set-property" && predicate.key === "rainbow.include-children") {
        if (predicate.val !== null) throw new Error("property 'rainbow.include-children' does not take an argument");
        this.includeChildrenPatterns.add(pattern);
        return;
      }
      throw unknownPredicate(predicate);
    });
    this.scopeCapture = this.query.getCapture("rainbow.scope");
    this.bracketCapture = this.query.getCapture("rainbow.bracket");
  }
}

export interface RainbowSpan {
  from: number;
  to: number;
  highlight: number;
}

export function rainbowSpans(syntax: Syntax, rainbowLength: number, start: number, end: number): RainbowSpan[] {
  const stack: { end: number; node: Node | null; highlight: number }[] = [];
  const spans: RainbowSpan[] = [];
  const loader = syntax.loader;
  const iter = new QueryIter(syntax, start, end, (language) => loader.rainbowQuery(language)?.query ?? null, () => true);
  try {
    for (let event = iter.next(); event; event = iter.next()) {
      if (event.kind !== "match") continue;
      const query = loader.rainbowQuery(iter.currentLayer.language);
      if (!query) continue;
      const from = event.node.startByte;
      while (stack.length > 0 && from >= stack[stack.length - 1]!.end) stack.pop();
      if (event.capture === query.scopeCapture) {
        stack.push({ end: event.node.endByte, node: query.includeChildrenPatterns.has(event.pattern) ? null : event.node, highlight: stack.length % rainbowLength });
      } else if (event.capture === query.bracketCapture) {
        const scope = stack[stack.length - 1];
        if (!scope) continue;
        if (scope.node && !sameNode(event.node.parent, scope.node)) continue;
        spans.push({ from, to: event.node.endByte, highlight: scope.highlight });
      }
    }
  } finally {
    iter.dispose();
  }
  return spans;
}

function sameNode(a: Node | null, b: Node): boolean {
  return a !== null && a.id === b.id;
}

export function runLocalQuery(syntax: Syntax, layer: Layer): Locals {
  const locals = new Locals();
  const query = syntax.loader.localsQuery(layer.language);
  if (!query || query.definitionCaptures.size === 0 || !layer.tree) return locals;
  const cursor = new QueryCursor(query.query, layer.tree.rootNode, syntax.input, [0, MAX], TREE_SITTER_MATCH_LIMIT);
  let scope = 0;
  try {
    for (let next = cursor.nextMatchedNode(); next; next = cursor.nextMatchedNode()) {
      const [match, index] = next;
      const matched = match.nodes[index]!;
      const start = matched.node.startByte;
      const end = matched.node.endByte;
      while (start >= locals.scopes[scope]!.end) scope = locals.scopes[scope]!.parent!;
      if (matched.capture === query.scopeCapture) {
        scope = locals.push({ definitions: new Map(), start, end, inherit: !query.notScopeInherits.has(match.pattern), children: [], parent: scope });
      } else if (query.definitionCaptures.has(matched.capture)) {
        locals.scopes[scope]!.definitions.set(syntax.slice(start, end), { capture: matched.capture, start, end });
      }
    }
  } finally {
    cursor.delete();
  }
  return locals;
}

interface MatchEvent {
  kind: "match";
  node: Node;
  capture: number;
  pattern: number;
  scope: number;
  startByte: number;
}

interface EnterEvent {
  kind: "enter";
  injection: Injection;
  startByte: number;
}

interface ExitEvent {
  kind: "exit";
  injection: Injection;
  finished: boolean;
  startByte: number;
}

type QueryIterEvent = MatchEvent | EnterEvent | ExitEvent;

interface Peeked {
  match: QueryMatch;
  node: Node;
  capture: number;
  scope: number;
  startByte: number;
  endByte: number;
}

interface ActiveLayer {
  cursor: QueryCursor | null;
  peeked: Peeked | null;
  language: LanguageId;
  scopeCursor: ScopeCursor;
  injections: readonly Injection[];
  next: number;
}

class QueryIter {
  private readonly activeLayers = new Map<Layer, ActiveLayer>();
  private readonly activeInjections: Injection[] = [];
  private readonly finished = new Set<Layer>();
  private readonly cursors: QueryCursor[] = [];
  private currentLayerState: ActiveLayer;
  currentInjection: Injection;

  constructor(
    readonly syntax: Syntax,
    private readonly start: number,
    private readonly end: number,
    private readonly queryFor: (language: LanguageId) => Query | null = (language) => syntax.loader.highlightQuery(language)?.query ?? null,
    private readonly satisfied: ((active: ActiveLayer, match: QueryMatch) => boolean) | null = null,
  ) {
    const root = syntax.root.tree!.rootNode;
    this.currentInjection = { range: [root.startByte, root.endByte], layer: syntax.root, matchedNodeRange: [root.startByte, root.endByte] };
    this.currentLayerState = this.initLayer(this.currentInjection);
  }

  get currentLayer(): Layer {
    return this.currentInjection.layer;
  }

  dispose(): void {
    for (const cursor of this.cursors) cursor.delete();
  }

  private initLayer(injection: Injection): ActiveLayer {
    const existing = this.activeLayers.get(injection.layer);
    if (existing) {
      this.activeLayers.delete(injection.layer);
      return existing;
    }
    const layer = injection.layer;
    const startPoint = Math.max(injection.range[0], this.start);
    let injectionStart = 0;
    while (injectionStart < layer.injections.length && layer.injections[injectionStart]!.range[1] < startPoint) injectionStart++;
    let cursor: QueryCursor | null = null;
    if (!this.finished.has(layer)) {
      const query = this.queryFor(layer.language);
      if (query && layer.tree) {
        cursor = new QueryCursor(query, layer.tree.rootNode, this.syntax.input, [this.start, this.end], TREE_SITTER_MATCH_LIMIT);
        this.cursors.push(cursor);
      }
    }
    return {
      cursor,
      peeked: null,
      language: layer.language,
      scopeCursor: this.syntax.localsOf(layer).scopeCursor(this.start),
      injections: layer.injections,
      next: injectionStart,
    };
  }

  private peek(active: ActiveLayer): Peeked | null {
    if (active.peeked) return active.peeked;
    const cursor = active.cursor;
    if (!cursor) return null;
    for (;;) {
      const next = cursor.nextMatchedNode();
      if (!next) {
        active.cursor = null;
        return null;
      }
      const [match, index] = next;
      const matched = match.nodes[index]!;
      const startByte = matched.node.startByte;
      const scope = active.scopeCursor.advance(startByte);
      if (!this.predicates(active, match)) {
        cursor.removeMatch(match.id);
        continue;
      }
      active.peeked = { match, node: matched.node, capture: matched.capture, scope, startByte, endByte: matched.node.endByte };
      return active.peeked;
    }
  }

  private predicates(active: ActiveLayer, match: QueryMatch): boolean {
    if (this.satisfied) return this.satisfied(active, match);
    const query = this.syntax.loader.highlightQuery(active.language);
    if (!query || query.localReferenceCapture === null || !query.nonLocalPatterns.has(match.pattern)) return true;
    const scope = active.scopeCursor.currentScope();
    for (const n of match.nodes) {
      const start = n.node.startByte;
      const definition = active.scopeCursor.locals.lookupReference(scope, this.syntax.slice(start, n.node.endByte));
      if (definition && start >= definition.start) return false;
    }
    return true;
  }

  private enterInjection(injection: Injection): void {
    const active = this.initLayer(injection);
    const old = this.currentInjection;
    this.currentInjection = injection;
    this.activeLayers.set(old.layer, this.currentLayerState);
    this.currentLayerState = active;
    this.activeInjections.push(old);
  }

  private exitInjection(): ExitEvent | null {
    const parent = this.activeInjections.pop();
    if (!parent) return null;
    const injection = this.currentInjection;
    this.currentInjection = parent;
    const layer = this.currentLayerState;
    const next = this.activeLayers.get(parent.layer);
    if (!next) return null;
    this.activeLayers.delete(parent.layer);
    this.currentLayerState = next;
    const unfinished = layer.peeked !== null || layer.next < layer.injections.length;
    if (unfinished) {
      this.activeLayers.set(injection.layer, layer);
      return { kind: "exit", injection, finished: false, startByte: injection.range[1] };
    }
    this.finished.add(injection.layer);
    return { kind: "exit", injection, finished: true, startByte: injection.range[1] };
  }

  next(): QueryIterEvent | null {
    for (;;) {
      const active = this.currentLayerState;
      const end = this.currentInjection.range[1];
      const candidate = active.injections[active.next];
      const nextInjection = candidate && candidate.range[0] <= end ? candidate : null;
      const peeked = this.peek(active);
      const nextItem = peeked && peeked.startByte <= end ? peeked : null;
      if (!nextItem && !nextInjection) return this.exitInjection();
      if (nextItem && nextItem.startByte === nextItem.endByte) {
        active.peeked = null;
        continue;
      }
      if (nextItem && !nextInjection) {
        active.peeked = null;
        return this.matchEvent(nextItem);
      }
      if (nextItem && nextInjection && nextItem.startByte < nextInjection.range[1]) {
        active.peeked = null;
        if (nextItem.startByte <= nextInjection.range[0] || nextInjection.range[1] < nextItem.endByte) return this.matchEvent(nextItem);
        continue;
      }
      active.next += 1;
      this.enterInjection(nextInjection!);
      return { kind: "enter", injection: nextInjection!, startByte: nextInjection!.range[0] };
    }
  }

  private matchEvent(item: Peeked): MatchEvent {
    return { kind: "match", node: item.node, capture: item.capture, pattern: item.match.pattern, scope: item.scope, startByte: item.startByte };
  }
}

interface HighlightedNode {
  end: number;
  highlight: Highlight;
}

interface LayerData {
  parentHighlights: number;
  dormant: HighlightedNode[];
}

export class Highlighter {
  private readonly query: QueryIter;
  private nextQueryEvent: QueryIterEvent | null = null;
  private active: HighlightedNode[] = [];
  private nextHighlightEnd = MAX;
  private nextHighlightStart = 0;
  private activeConfig: HighlightQuery | null;
  private currentLayer: Layer;
  private readonly layerStates = new Map<Layer, LayerData>();
  private readonly captureHighlights = new Map<HighlightQuery, (Highlight | null)[]>();
  private readonly definitionHighlights = new Map<LocalsQuery, Map<number, Highlight | null>>();

  constructor(
    private readonly syntax: Syntax,
    private readonly scopes: readonly string[],
    start: number,
    end: number,
  ) {
    this.query = new QueryIter(syntax, start, end);
    this.activeConfig = syntax.loader.highlightQuery(this.query.currentLayer.language);
    this.currentLayer = this.query.currentLayer;
    this.advanceQueryIter();
  }

  dispose(): void {
    this.query.dispose();
  }

  activeHighlights(): Highlight[] {
    return this.active.map((n) => n.highlight);
  }

  nextEventOffset(): number {
    return Math.min(this.nextHighlightStart, this.nextHighlightEnd);
  }

  private indices(config: HighlightQuery): (Highlight | null)[] {
    let list = this.captureHighlights.get(config);
    if (!list) {
      list = config.query.captureNames.map((name) => configureScope(name, this.scopes));
      this.captureHighlights.set(config, list);
    }
    return list;
  }

  private definitionHighlight(language: LanguageId, capture: number): Highlight | null {
    const locals = this.syntax.loader.localsQuery(language);
    if (!locals) return null;
    let map = this.definitionHighlights.get(locals);
    if (!map) {
      map = new Map();
      for (const [c, name] of locals.definitionCaptures) map.set(c, configureScope(name, this.scopes));
      this.definitionHighlights.set(locals, map);
    }
    return map.get(capture) ?? null;
  }

  advance(): void {
    const pos = this.nextEventOffset();
    if (this.nextHighlightEnd === pos) this.processHighlightEnd(pos);
    const prevStackSize = this.active.length;
    const state = { first: true, candidate: null as { end: number; highlight: Highlight } | null };
    while (this.nextHighlightStart === pos) {
      const event = this.advanceQueryIter();
      if (!event) break;
      if (event.kind === "enter") this.enterInjection(event.injection.layer);
      else if (event.kind === "match") this.startHighlight(event, state, prevStackSize);
      else {
        const finished = event.finished && this.currentLayerHighlights().every((h) => h.end <= event.injection.range[1]);
        if (finished) this.layerStates.delete(event.injection.layer);
        else this.deactivateLayer(event.injection);
        this.activeConfig = this.syntax.loader.highlightQuery(this.currentLayer.language);
      }
    }
    if (state.candidate) {
      const { end, highlight } = state.candidate;
      const node = { end, highlight };
      const searchStart = Math.min(prevStackSize, this.active.length);
      let idx: number | null = null;
      for (let i = this.active.length - 1; i >= searchStart; i--) {
        if (this.active[i]!.end <= end) {
          idx = i;
          break;
        }
      }
      if (idx === null) this.active.push(node);
      else if (this.active[idx]!.end === end) this.active[idx] = node;
      else this.active.splice(idx, 0, node);
    }
    const last = this.active[this.active.length - 1];
    this.nextHighlightEnd = last ? last.end : MAX;
  }

  private advanceQueryIter(): QueryIterEvent | null {
    this.currentLayer = this.query.currentLayer;
    const event = this.nextQueryEvent;
    this.nextQueryEvent = this.query.next();
    this.nextHighlightStart = this.nextQueryEvent ? this.nextQueryEvent.startByte : MAX;
    return event;
  }

  private processHighlightEnd(pos: number): void {
    let i = this.active.length;
    while (i > 0 && this.active[i - 1]!.end === pos) i--;
    this.active.length = i;
  }

  private currentLayerHighlights(): HighlightedNode[] {
    const parentStart = Math.min(this.layerStates.get(this.currentLayer)?.parentHighlights ?? 0, this.active.length);
    return this.active.slice(parentStart);
  }

  private enterInjection(layer: Layer): void {
    this.activeConfig = this.syntax.loader.highlightQuery(layer.language);
    let state = this.layerStates.get(layer);
    if (!state) {
      state = { parentHighlights: 0, dormant: [] };
      this.layerStates.set(layer, state);
    }
    state.parentHighlights = this.active.length;
    this.active.push(...state.dormant);
    state.dormant = [];
  }

  private deactivateLayer(injection: Injection): void {
    const state = this.layerStates.get(injection.layer)!;
    const parent = Math.min(state.parentHighlights, this.active.length);
    state.dormant.push(...this.active.splice(parent));
    this.processHighlightEnd(injection.range[1]);
  }

  private startHighlight(event: MatchEvent, state: { first: boolean; candidate: { end: number; highlight: Highlight } | null }, prevStackSize: number): void {
    const config = this.activeConfig;
    if (!config) return;
    const start = event.node.startByte;
    const end = event.node.endByte;
    const isLocalReference = event.capture === config.localReferenceCapture;
    if (event.pattern >= config.firstLocalsPattern && !isLocalReference) {
      if (state.candidate?.end === end) state.candidate = null;
      return;
    }
    if (isLocalReference) {
      const locals = this.syntax.localsOf(this.currentLayer);
      const definition = locals.lookupReference(event.scope, this.syntax.slice(start, end));
      if (!definition || start < definition.end) return;
      const highlight = this.definitionHighlight(this.currentLayer.language, definition.capture);
      if (highlight !== null) state.candidate = { end, highlight };
      return;
    }
    const highlight = this.indices(config)[event.capture] ?? null;
    const node = highlight === null ? null : { end, highlight };
    if (!state.first) {
      const searchStart = Math.min(prevStackSize, this.active.length);
      let idx: number | null = null;
      for (let i = this.active.length - 1; i >= searchStart; i--) {
        if (this.active[i]!.end <= end) {
          idx = i;
          break;
        }
      }
      if (idx === null) {
        if (node) this.active.push(node);
      } else if (this.active[idx]!.end === end) {
        if (node) this.active[idx] = node;
        else this.active.splice(idx, 1);
      } else if (node) this.active.splice(idx, 0, node);
    } else if (node) {
      this.active.push(node);
      state.first = false;
    }
  }
}

export interface HighlightSpan {
  from: number;
  to: number;
  scopes: Highlight[];
}

export function highlightSpans(syntax: Syntax, scopes: readonly string[], start: number, end: number): HighlightSpan[] {
  const highlighter = new Highlighter(syntax, scopes, start, end);
  const spans: HighlightSpan[] = [];
  try {
    let pos = start;
    while (pos < end) {
      const next = Math.min(highlighter.nextEventOffset(), end);
      if (next > pos) {
        const active = highlighter.activeHighlights();
        if (active.length > 0) spans.push({ from: pos, to: next, scopes: active });
        pos = next;
      }
      if (next >= end) break;
      highlighter.advance();
    }
  } finally {
    highlighter.dispose();
  }
  return spans;
}
