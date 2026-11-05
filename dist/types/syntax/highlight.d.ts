import type { LanguageLoader } from "./loader";
import { type Query } from "./query";
import type { Layer, Syntax } from "./syntax";
import type { Language } from "./ts";
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
export declare class Locals {
    readonly scopes: ScopeData[];
    push(scope: ScopeData): number;
    lookupReference(scope: number, name: string): Definition | null;
    scopeCursor(pos: number): ScopeCursor;
}
export declare class ScopeCursor {
    readonly locals: Locals;
    private readonly stack;
    constructor(locals: Locals, stack: [number, number][]);
    advance(to: number): number;
    currentScope(): number;
}
export declare function configureScope(captureName: string, scopes: readonly string[]): Highlight | null;
export declare class LocalsQuery {
    readonly query: Query;
    readonly scopeCapture: number | null;
    readonly notScopeInherits: Set<number>;
    readonly definitionCaptures: Map<number, string>;
    constructor(loader: LanguageLoader, grammar: Language, text: string);
}
export declare class HighlightQuery {
    readonly query: Query;
    readonly nonLocalPatterns: Set<number>;
    readonly localReferenceCapture: number | null;
    readonly firstLocalsPattern: number;
    constructor(loader: LanguageLoader, grammar: Language, highlights: string, locals: string);
}
export declare class RainbowQuery {
    readonly query: Query;
    readonly includeChildrenPatterns: Set<number>;
    readonly scopeCapture: number | null;
    readonly bracketCapture: number | null;
    constructor(loader: LanguageLoader, grammar: Language, text: string);
}
export interface RainbowSpan {
    from: number;
    to: number;
    highlight: number;
}
export declare function rainbowSpans(syntax: Syntax, rainbowLength: number, start: number, end: number): RainbowSpan[];
export declare function runLocalQuery(syntax: Syntax, layer: Layer): Locals;
export declare class Highlighter {
    private readonly syntax;
    private readonly scopes;
    private readonly query;
    private nextQueryEvent;
    private active;
    private nextHighlightEnd;
    private nextHighlightStart;
    private activeConfig;
    private currentLayer;
    private readonly layerStates;
    private readonly captureHighlights;
    private readonly definitionHighlights;
    constructor(syntax: Syntax, scopes: readonly string[], start: number, end: number);
    dispose(): void;
    activeHighlights(): Highlight[];
    nextEventOffset(): number;
    private indices;
    private definitionHighlight;
    advance(): void;
    private advanceQueryIter;
    private processHighlightEnd;
    private currentLayerHighlights;
    private enterInjection;
    private deactivateLayer;
    private startHighlight;
}
export interface HighlightSpan {
    from: number;
    to: number;
    scopes: Highlight[];
}
export declare function highlightSpans(syntax: Syntax, scopes: readonly string[], start: number, end: number): HighlightSpan[];
export declare const DEFAULT_SCOPES: readonly string[];
export {};
