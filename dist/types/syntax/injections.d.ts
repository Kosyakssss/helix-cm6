import type { RustRegexEngine } from "../core/rx";
import { Query, type QueryInput } from "./query";
import type { Language, Node } from "./ts";
export type LanguageId = number;
export type InjectionLanguageMarker = {
    kind: "name";
    name: string;
} | {
    kind: "match";
    text: string;
} | {
    kind: "filename";
    text: string;
} | {
    kind: "shebang";
    text: string;
};
export interface SyntaxConfig {
    grammar: Language;
    injectionQuery: InjectionsQuery;
}
export interface InjectionLoader {
    languageForMarker(marker: InjectionLanguageMarker): LanguageId | null;
    getConfig(language: LanguageId): SyntaxConfig | null;
}
export type IncludedChildren = "none" | "all" | "unnamed";
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
export declare function shebangMarker(text: string): string | null;
export declare class InjectionsQuery {
    readonly query: Query;
    private readonly properties;
    readonly contentCapture: number | null;
    private readonly languageCapture;
    private readonly filenameCapture;
    private readonly shebangCapture;
    constructor(grammar: Language, injectionQueryText: string, regex: RustRegexEngine | null);
    private processMatch;
    execute(node: Node, input: QueryInput & {
        slice(start: number, end: number): string;
    }, loader: InjectionLoader): Generator<InjectionQueryMatch>;
}
