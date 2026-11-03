import type { ChangeSet, Text } from "@codemirror/state";
import type { RustRegexEngine } from "../core/rx";
import { parseLanguagesToml } from "./config";
import type { LanguageId } from "./injections";
import { LanguageLoader, type LanguageSource } from "./loader";
import { Syntax } from "./syntax";
import { Language, Runtime } from "./ts";

export const MARKDOWN_LANGUAGES = `[[language]]
name = "markdown"
scope = "source.md"
injection-regex = "md|markdown"
file-types = ["md", "livemd", "markdown", "mdx", "mkd", "mkdn", "mdwn", "mdown", "markdn", "mdtxt", "mdtext", "workbook", { glob = "PULLREQ_EDITMSG" }]
indent = { tab-width = 2, unit = "  " }
block-comment-tokens = { start = "<!--", end = "-->" }
word-completion.trigger-length = 4

[language.auto-pairs]
'(' = ')'
'{' = '}'
'[' = ']'
'"' = '"'
"'" = "'"
'\`' = '\`'
'‘' = '’'
'«' = '»'
'“' = '”'

[[grammar]]
name = "markdown"
source = { git = "https://github.com/tree-sitter-grammars/tree-sitter-markdown", rev = "f969cd3ae3f9fbd4e43205431d0ae286014c05b5", subpath = "tree-sitter-markdown" }

[[language]]
name = "markdown.inline"
scope = "source.markdown.inline"
injection-regex = "markdown\\\\.inline"
file-types = []
grammar = "markdown_inline"

[[grammar]]
name = "markdown_inline"
source = { git = "https://github.com/tree-sitter-grammars/tree-sitter-markdown", rev = "f969cd3ae3f9fbd4e43205431d0ae286014c05b5", subpath = "tree-sitter-markdown-inline" }
`;

export const MARKDOWN_HIGHLIGHTS = "\n(setext_heading (paragraph) @markup.heading.1 (setext_h1_underline) @markup.heading.marker)\n(setext_heading (paragraph) @markup.heading.2 (setext_h2_underline) @markup.heading.marker)\n\n(atx_heading (atx_h1_marker) @markup.heading.marker) @markup.heading.1\n(atx_heading (atx_h2_marker) @markup.heading.marker) @markup.heading.2\n(atx_heading (atx_h3_marker) @markup.heading.marker) @markup.heading.3\n(atx_heading (atx_h4_marker) @markup.heading.marker) @markup.heading.4\n(atx_heading (atx_h5_marker) @markup.heading.marker) @markup.heading.5\n(atx_heading (atx_h6_marker) @markup.heading.marker) @markup.heading.6\n\n[\n  (indented_code_block)\n  (fenced_code_block)\n] @markup.raw.block\n\n(info_string) @label\n\n[\n  (fenced_code_block_delimiter)\n] @punctuation.bracket\n\n[\n  (link_destination)\n] @markup.link.url\n\n[\n  (link_label)\n] @markup.link.label\n\n[\n  (list_marker_plus)\n  (list_marker_minus)\n  (list_marker_star)\n] @markup.list.unnumbered\n\n[\n  (list_marker_dot)\n  (list_marker_parenthesis)\n] @markup.list.numbered\n\n(task_list_marker_checked) @markup.list.checked\n(task_list_marker_unchecked) @markup.list.unchecked\n\n(thematic_break) @punctuation.special\n\n[\n  (block_continuation)\n  (block_quote_marker)\n] @punctuation.special\n\n[\n  (backslash_escape)\n] @string.escape\n\n(block_quote) @markup.quote\n\n(pipe_table_row\n  \"|\" @punctuation.special)\n(pipe_table_header\n  \"|\" @punctuation.special)\n(pipe_table_delimiter_row) @punctuation.special\n";

export const MARKDOWN_INLINE_HIGHLIGHTS = ";; From nvim-treesitter/nvim-treesitter\n[\n  (code_span)\n  (link_title)\n] @markup.raw.inline\n\n[\n  (emphasis_delimiter)\n  (code_span_delimiter)\n] @punctuation.bracket\n\n(emphasis) @markup.italic\n\n(strong_emphasis) @markup.bold\n\n(strikethrough) @markup.strikethrough\n\n[\n  (link_destination)\n  (uri_autolink)\n] @markup.link.url\n\n[\n  (link_text)\n  (image_description)\n] @markup.link.text\n\n(link_label) @markup.link.label\n\n[\n  (backslash_escape)\n  (hard_line_break)\n] @constant.character.escape\n\n(image [\"[\" \"]\" \"(\" \")\"] @punctuation.bracket)\n(image \"!\" @punctuation.special)\n(inline_link [\"[\" \"]\" \"(\" \")\"] @punctuation.bracket)\n(shortcut_link [\"[\" \"]\"] @punctuation.bracket)\n\n";

const MARKDOWN_INJECTIONS = `(fenced_code_block
  (code_fence_content) @injection.shebang @injection.content
  (#set! injection.include-unnamed-children))

(fenced_code_block
  (info_string
    (language) @injection.language)
  (code_fence_content) @injection.content (#set! injection.include-unnamed-children))

((html_block) @injection.content
 (#set! injection.language "html")
 (#set! injection.include-unnamed-children)
 (#set! injection.combined))

((pipe_table_cell) @injection.content (#set! injection.language "markdown.inline") (#set! injection.include-unnamed-children))

((minus_metadata) @injection.content (#set! injection.language "yaml") (#set! injection.include-unnamed-children))
((plus_metadata) @injection.content (#set! injection.language "toml") (#set! injection.include-unnamed-children))

((inline) @injection.content (#set! injection.language "markdown.inline") (#set! injection.include-unnamed-children))
`;

const MARKDOWN_INLINE_INJECTIONS = `((html_tag) @injection.content
  (#set! injection.language "html")
  (#set! injection.include-unnamed-children)
  (#set! injection.combined))

((latex_block) @injection.content (#set! injection.language "latex") (#set! injection.include-children))
`;

export interface LoaderOptions {
  regex?: RustRegexEngine | null;
  languages?: readonly string[];
  only?: readonly string[];
  source?: LanguageSource | null;
}

export async function createLoader(binary: Uint8Array, options: LoaderOptions = {}): Promise<LanguageLoader> {
  const rt = await Runtime.load(binary);
  const config = parseLanguagesToml(...(options.languages ?? [MARKDOWN_LANGUAGES]));
  const only = options.only;
  if (only) config.languages = config.languages.filter((l) => only.includes(l.languageId));
  const grammars = new Map([
    ["markdown", new Language(rt, rt.x.hm_language(0))],
    ["markdown_inline", new Language(rt, rt.x.hm_language(1))],
  ]);
  const queries = new Map([
    ["markdown", { "injections.scm": MARKDOWN_INJECTIONS, "highlights.scm": MARKDOWN_HIGHLIGHTS }],
    ["markdown.inline", { "injections.scm": MARKDOWN_INLINE_INJECTIONS, "highlights.scm": MARKDOWN_INLINE_HIGHLIGHTS }],
  ]);
  return new LanguageLoader(rt, options.regex ?? null, config, { grammars, queries }, options.source ?? null);
}

interface Pending {
  changes: ChangeSet;
  newDoc: Text;
}

interface Session {
  doc: Text;
  language: LanguageId | null;
  syntax: Syntax | null;
  failed: boolean;
  pending: Pending[];
}

export class SyntaxSessions {
  private entries = new Map<unknown, Session>();
  private idle = false;

  constructor(
    readonly loader: LanguageLoader,
    private readonly schedule: ((work: () => void) => void) | null = null,
  ) {
    loader.onLoad(() => {
      for (const entry of this.entries.values()) {
        this.latest(entry);
        entry.syntax?.delete();
        entry.syntax = null;
        entry.failed = false;
      }
      this.scheduleIdle();
    });
  }

  private latest(entry: Session): void {
    const last = entry.pending[entry.pending.length - 1];
    if (last) entry.doc = last.newDoc;
    entry.pending = [];
  }

  private defaultLanguage(): LanguageId | null {
    return this.loader.languageForName("markdown");
  }

  open(key: unknown, doc: Text, language: LanguageId | null = this.defaultLanguage()): void {
    if (this.entries.has(key)) return;
    this.entries.set(key, { doc, language, syntax: null, failed: false, pending: [] });
    this.scheduleIdle();
  }

  languageOf(key: unknown): LanguageId | null {
    return this.entries.get(key)?.language ?? null;
  }

  setLanguage(key: unknown, language: LanguageId | null): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.latest(entry);
    entry.syntax?.delete();
    entry.syntax = null;
    entry.failed = false;
    entry.language = language;
    this.scheduleIdle();
  }

  change(key: unknown, oldDoc: Text, changes: ChangeSet, newDoc: Text): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    const last = entry.pending.length > 0 ? entry.pending[entry.pending.length - 1]!.newDoc : entry.doc;
    if (last !== oldDoc) {
      const language = entry.language;
      this.close(key);
      this.open(key, newDoc, language);
      return;
    }
    if (!entry.syntax && (entry.language === null || entry.failed)) {
      entry.doc = newDoc;
      return;
    }
    entry.pending.push({ changes, newDoc });
    this.scheduleIdle();
  }

  get(key: unknown, doc: Text): Syntax | null {
    let entry = this.entries.get(key);
    if (entry) this.flush(entry);
    if (!entry || entry.doc !== doc) {
      const language = entry ? entry.language : this.defaultLanguage();
      this.close(key);
      this.open(key, doc, language);
      entry = this.entries.get(key)!;
      this.flush(entry);
    }
    return entry.syntax;
  }

  close(key: unknown): void {
    this.entries.get(key)?.syntax?.delete();
    this.entries.delete(key);
  }

  clear(): void {
    for (const entry of this.entries.values()) entry.syntax?.delete();
    this.entries.clear();
  }

  private flush(entry: Session): Syntax | null {
    if (!entry.syntax) {
      if (entry.language === null || entry.failed) {
        this.latest(entry);
        return null;
      }
      try {
        entry.syntax = new Syntax(this.loader, entry.doc.toString(), entry.language);
      } catch {
        entry.failed = true;
        this.latest(entry);
        return null;
      }
    }
    for (const { changes, newDoc } of entry.pending.splice(0)) {
      entry.syntax.applyChanges(changes, newDoc);
      entry.doc = newDoc;
    }
    return entry.syntax;
  }

  private scheduleIdle(): void {
    if (!this.schedule || this.idle) return;
    this.idle = true;
    this.schedule(() => {
      this.idle = false;
      for (const entry of this.entries.values()) this.flush(entry);
    });
  }
}
