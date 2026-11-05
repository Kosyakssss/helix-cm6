import type { ChangeSet, Text } from "@codemirror/state";
import type { RustRegexEngine } from "../core/rx";
import type { LanguageId } from "./injections";
import { LanguageLoader, type LanguageSource } from "./loader";
import { Syntax } from "./syntax";
export declare const MARKDOWN_LANGUAGES = "[[language]]\nname = \"markdown\"\nscope = \"source.md\"\ninjection-regex = \"md|markdown\"\nfile-types = [\"md\", \"livemd\", \"markdown\", \"mdx\", \"mkd\", \"mkdn\", \"mdwn\", \"mdown\", \"markdn\", \"mdtxt\", \"mdtext\", \"workbook\", { glob = \"PULLREQ_EDITMSG\" }]\nindent = { tab-width = 2, unit = \"  \" }\nblock-comment-tokens = { start = \"<!--\", end = \"-->\" }\nword-completion.trigger-length = 4\n\n[language.auto-pairs]\n'(' = ')'\n'{' = '}'\n'[' = ']'\n'\"' = '\"'\n\"'\" = \"'\"\n'`' = '`'\n'\u2018' = '\u2019'\n'\u00AB' = '\u00BB'\n'\u201C' = '\u201D'\n\n[[grammar]]\nname = \"markdown\"\nsource = { git = \"https://github.com/tree-sitter-grammars/tree-sitter-markdown\", rev = \"f969cd3ae3f9fbd4e43205431d0ae286014c05b5\", subpath = \"tree-sitter-markdown\" }\n\n[[language]]\nname = \"markdown.inline\"\nscope = \"source.markdown.inline\"\ninjection-regex = \"markdown\\\\.inline\"\nfile-types = []\ngrammar = \"markdown_inline\"\n\n[[grammar]]\nname = \"markdown_inline\"\nsource = { git = \"https://github.com/tree-sitter-grammars/tree-sitter-markdown\", rev = \"f969cd3ae3f9fbd4e43205431d0ae286014c05b5\", subpath = \"tree-sitter-markdown-inline\" }\n";
export declare const MARKDOWN_HIGHLIGHTS = "\n(setext_heading (paragraph) @markup.heading.1 (setext_h1_underline) @markup.heading.marker)\n(setext_heading (paragraph) @markup.heading.2 (setext_h2_underline) @markup.heading.marker)\n\n(atx_heading (atx_h1_marker) @markup.heading.marker) @markup.heading.1\n(atx_heading (atx_h2_marker) @markup.heading.marker) @markup.heading.2\n(atx_heading (atx_h3_marker) @markup.heading.marker) @markup.heading.3\n(atx_heading (atx_h4_marker) @markup.heading.marker) @markup.heading.4\n(atx_heading (atx_h5_marker) @markup.heading.marker) @markup.heading.5\n(atx_heading (atx_h6_marker) @markup.heading.marker) @markup.heading.6\n\n[\n  (indented_code_block)\n  (fenced_code_block)\n] @markup.raw.block\n\n(info_string) @label\n\n[\n  (fenced_code_block_delimiter)\n] @punctuation.bracket\n\n[\n  (link_destination)\n] @markup.link.url\n\n[\n  (link_label)\n] @markup.link.label\n\n[\n  (list_marker_plus)\n  (list_marker_minus)\n  (list_marker_star)\n] @markup.list.unnumbered\n\n[\n  (list_marker_dot)\n  (list_marker_parenthesis)\n] @markup.list.numbered\n\n(task_list_marker_checked) @markup.list.checked\n(task_list_marker_unchecked) @markup.list.unchecked\n\n(thematic_break) @punctuation.special\n\n[\n  (block_continuation)\n  (block_quote_marker)\n] @punctuation.special\n\n[\n  (backslash_escape)\n] @string.escape\n\n(block_quote) @markup.quote\n\n(pipe_table_row\n  \"|\" @punctuation.special)\n(pipe_table_header\n  \"|\" @punctuation.special)\n(pipe_table_delimiter_row) @punctuation.special\n";
export declare const MARKDOWN_INLINE_HIGHLIGHTS = ";; From nvim-treesitter/nvim-treesitter\n[\n  (code_span)\n  (link_title)\n] @markup.raw.inline\n\n[\n  (emphasis_delimiter)\n  (code_span_delimiter)\n] @punctuation.bracket\n\n(emphasis) @markup.italic\n\n(strong_emphasis) @markup.bold\n\n(strikethrough) @markup.strikethrough\n\n[\n  (link_destination)\n  (uri_autolink)\n] @markup.link.url\n\n[\n  (link_text)\n  (image_description)\n] @markup.link.text\n\n(link_label) @markup.link.label\n\n[\n  (backslash_escape)\n  (hard_line_break)\n] @constant.character.escape\n\n(image [\"[\" \"]\" \"(\" \")\"] @punctuation.bracket)\n(image \"!\" @punctuation.special)\n(inline_link [\"[\" \"]\" \"(\" \")\"] @punctuation.bracket)\n(shortcut_link [\"[\" \"]\"] @punctuation.bracket)\n\n";
export interface LoaderOptions {
    regex?: RustRegexEngine | null;
    languages?: readonly string[];
    only?: readonly string[];
    source?: LanguageSource | null;
}
export declare function createLoader(binary: Uint8Array, options?: LoaderOptions): Promise<LanguageLoader>;
export declare class SyntaxSessions {
    readonly loader: LanguageLoader;
    private readonly schedule;
    private entries;
    private idle;
    private lastChange;
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
