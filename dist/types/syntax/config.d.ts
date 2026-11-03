export type FileType = {
    kind: "extension";
    extension: string;
} | {
    kind: "glob";
    glob: string;
};
export interface BlockCommentToken {
    start: string;
    end: string;
}
export interface IndentationConfiguration {
    tabWidth: number;
    unit: string;
}
export interface SoftWrapConfiguration {
    enable: boolean | null;
    maxWrap: number | null;
    maxIndentRetain: number | null;
    wrapIndicator: string | null;
    wrapAtTextWidth: boolean | null;
}
export interface WordCompletionConfiguration {
    enable: boolean | null;
    triggerLength: number | null;
}
export interface LanguageConfiguration {
    languageId: string;
    scope: string;
    fileTypes: FileType[];
    shebangs: string[];
    commentTokens: string[] | null;
    blockCommentTokens: BlockCommentToken[] | null;
    textWidth: number | null;
    softWrap: SoftWrapConfiguration | null;
    autoFormat: boolean;
    pathCompletion: boolean | null;
    wordCompletion: WordCompletionConfiguration | null;
    grammar: string | null;
    injectionRegex: string | null;
    indent: IndentationConfiguration | null;
    autoPairs: [string, string][] | null;
    rulers: number[] | null;
    rainbowBrackets: boolean | null;
}
export interface GrammarConfiguration {
    name: string;
    git: string | null;
    rev: string | null;
    subpath: string | null;
    path: string | null;
}
export interface LanguagesConfiguration {
    languages: LanguageConfiguration[];
    grammars: GrammarConfiguration[];
}
type Value = unknown;
export declare function mergeTomlValues(left: Value, right: Value, depth: number): Value;
export declare function parseLanguagesToml(...sources: string[]): LanguagesConfiguration;
export {};
