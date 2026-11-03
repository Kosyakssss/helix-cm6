import type { RustRegexEngine } from "../core/rx";
import { Node, type Language, type Runtime } from "./ts";
export type PredicateArg = {
    kind: "capture";
    capture: number;
} | {
    kind: "string";
    value: string;
};
export interface Predicate {
    name: string;
    args: PredicateArg[];
}
export type UserPredicate = {
    kind: "is-property-set";
    negate: boolean;
    key: string;
    val: string | null;
} | {
    kind: "set-property";
    key: string;
    val: string | null;
} | {
    kind: "other";
    predicate: Predicate;
};
export declare class InvalidPredicateError extends Error {
}
export declare function unknownPredicate(predicate: UserPredicate): InvalidPredicateError;
export declare class QueryParseError extends Error {
}
export interface MatchedNode {
    node: Node;
    capture: number;
}
export interface QueryInput {
    readonly utf8: Uint8Array;
}
export declare class Query {
    readonly rt: Runtime;
    readonly language: Language;
    private readonly regex;
    readonly ptr: number;
    readonly captureNames: string[];
    private readonly strings;
    private readonly textPredicates;
    private readonly regexes;
    constructor(rt: Runtime, language: Language, source: string, custom: (pattern: number, predicate: UserPredicate) => void, regex?: RustRegexEngine | null);
    private read;
    stringValue(id: number): string;
    captureName(capture: number): string;
    getCapture(name: string): number | null;
    get patternCount(): number;
    startByteForPattern(pattern: number): number;
    disableCapture(name: string): void;
    delete(): void;
    private compileRegex;
    private parsePatternPredicates;
    satisfies(pattern: number, nodes: MatchedNode[], input: QueryInput): boolean;
    private satisfied;
}
export interface QueryMatch {
    id: number;
    pattern: number;
    nodes: MatchedNode[];
}
export declare const TREE_SITTER_MATCH_LIMIT = 256;
export declare class QueryCursor {
    readonly query: Query;
    private readonly input;
    private ptr;
    private readonly out;
    constructor(query: Query, node: Node, input: QueryInput, range?: [number, number], limit?: number);
    private readMatch;
    nextMatch(): QueryMatch | null;
    nextMatchedNode(): [QueryMatch, number] | null;
    removeMatch(id: number): void;
    didExceedMatchLimit(): boolean;
    delete(): void;
}
