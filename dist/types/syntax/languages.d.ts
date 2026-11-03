import type { ChangeSet, Text } from "@codemirror/state";
import type { RustRegexEngine } from "../core/rx";
import type { LanguageId } from "./injections";
import { LanguageLoader, type LanguageSource } from "./loader";
import { Syntax } from "./syntax";
export declare const MARKDOWN_LANGUAGES = "[[language]]\nname = \"markdown\"\nscope = \"source.md\"\ninjection-regex = \"md|markdown\"\nfile-types = [\"md\", \"livemd\", \"markdown\", \"mdx\", \"mkd\", \"mkdn\", \"mdwn\", \"mdown\", \"markdn\", \"mdtxt\", \"mdtext\", \"workbook\", { glob = \"PULLREQ_EDITMSG\" }]\nindent = { tab-width = 2, unit = \"  \" }\nblock-comment-tokens = { start = \"<!--\", end = \"-->\" }\nword-completion.trigger-length = 4\n\n[language.auto-pairs]\n'(' = ')'\n'{' = '}'\n'[' = ']'\n'\"' = '\"'\n\"'\" = \"'\"\n'`' = '`'\n'\u2018' = '\u2019'\n'\u00AB' = '\u00BB'\n'\u201C' = '\u201D'\n\n[[grammar]]\nname = \"markdown\"\nsource = { git = \"https://github.com/tree-sitter-grammars/tree-sitter-markdown\", rev = \"f969cd3ae3f9fbd4e43205431d0ae286014c05b5\", subpath = \"tree-sitter-markdown\" }\n\n[[language]]\nname = \"markdown.inline\"\nscope = \"source.markdown.inline\"\ninjection-regex = \"markdown\\\\.inline\"\nfile-types = []\ngrammar = \"markdown_inline\"\n\n[[grammar]]\nname = \"markdown_inline\"\nsource = { git = \"https://github.com/tree-sitter-grammars/tree-sitter-markdown\", rev = \"f969cd3ae3f9fbd4e43205431d0ae286014c05b5\", subpath = \"tree-sitter-markdown-inline\" }\n";
export interface LoaderOptions {
    regex?: RustRegexEngine | null;
    languages?: readonly string[];
    source?: LanguageSource | null;
}
export declare function createLoader(binary: Uint8Array, options?: LoaderOptions): Promise<LanguageLoader>;
export declare class SyntaxSessions {
    readonly loader: LanguageLoader;
    private readonly schedule;
    private entries;
    private idle;
    constructor(loader: LanguageLoader, schedule?: ((work: () => void) => void) | null);
    private latest;
    private defaultLanguage;
    open(key: unknown, doc: Text, language?: LanguageId | null): void;
    languageOf(key: unknown): LanguageId | null;
    setLanguage(key: unknown, language: LanguageId | null): void;
    change(key: unknown, oldDoc: Text, changes: ChangeSet, newDoc: Text): void;
    get(key: unknown, doc: Text): Syntax | null;
    close(key: unknown): void;
    clear(): void;
    private flush;
    private scheduleIdle;
}
