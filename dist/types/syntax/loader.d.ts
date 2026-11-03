import type { RustRegexEngine } from "../core/rx";
import type { LanguageConfiguration, LanguagesConfiguration } from "./config";
import { type InjectionLoader, type InjectionLanguageMarker, type LanguageId, type SyntaxConfig } from "./injections";
import { HighlightQuery, LocalsQuery, RainbowQuery } from "./highlight";
import { Query, type UserPredicate } from "./query";
import { Language, Parser, type Runtime } from "./ts";
export type QueryFile = "highlights.scm" | "injections.scm" | "locals.scm" | "textobjects.scm" | "indents.scm" | "rainbows.scm" | "tags.scm";
export interface LanguageSource {
    grammar(name: string): Uint8Array | null | Promise<Uint8Array | null>;
    query(language: string, file: QueryFile): string | null | Promise<string | null>;
}
export declare function readQuery(language: string, read: (language: string) => string | Promise<string>): Promise<string>;
export declare class LanguageData {
    readonly id: LanguageId;
    readonly config: LanguageConfiguration;
    syntax: SyntaxConfig | null | undefined;
    loading: Promise<void> | null;
    readonly queries: Map<QueryFile, string>;
    private compiled;
    constructor(id: LanguageId, config: LanguageConfiguration);
    query<T>(file: QueryFile, compile: (text: string) => T): T | null;
}
export interface Builtins {
    grammars: Map<string, Language>;
    queries: Map<string, Partial<Record<QueryFile, string>>>;
}
export declare class LanguageLoader implements InjectionLoader {
    readonly rt: Runtime;
    readonly regex: RustRegexEngine | null;
    private readonly builtins;
    private readonly source;
    readonly parser: Parser;
    readonly languages: LanguageData[];
    private readonly byExtension;
    private readonly byShebang;
    private readonly globs;
    private readonly injectionRegexes;
    private readonly listeners;
    readonly errors: string[];
    constructor(rt: Runtime, regex: RustRegexEngine | null, config: LanguagesConfiguration, builtins: Builtins, source: LanguageSource | null);
    onLoad(listener: (language: LanguageId) => void): () => void;
    language(id: LanguageId): LanguageData;
    languageForName(name: string): LanguageId | null;
    languageForScope(scope: string): LanguageId | null;
    private injectionRegex;
    languageForMatch(text: string): LanguageId | null;
    languageForFilename(path: string): LanguageId | null;
    languageForShebang(text: string): LanguageId | null;
    languageForMarker(marker: InjectionLanguageMarker): LanguageId | null;
    getConfig(id: LanguageId): SyntaxConfig | null;
    isLoaded(id: LanguageId): boolean;
    private compileSyntax;
    load(id: LanguageId): Promise<void>;
    private loadData;
    newQuery(grammar: Language, text: string, custom: (pattern: number, predicate: UserPredicate) => void): Query;
    highlightQuery(id: LanguageId): HighlightQuery | null;
    localsQuery(id: LanguageId): LocalsQuery | null;
    tagsQuery(id: LanguageId): Query | null;
    rainbowQuery(id: LanguageId): RainbowQuery | null;
    textobjectQuery(id: LanguageId): Query | null;
    indentQuery<T>(id: LanguageId, compile: (grammar: Language, text: string) => T): T | null;
    private compile;
}
