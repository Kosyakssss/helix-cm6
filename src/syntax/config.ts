import { parse } from "smol-toml";

export type FileType = { kind: "extension"; extension: string } | { kind: "glob"; glob: string };

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
type Table = Record<string, Value>;

function isTable(v: Value): v is Table {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

function nameOf(v: Value): string | undefined {
  return isTable(v) && typeof v.name === "string" ? v.name : undefined;
}

export function mergeTomlValues(left: Value, right: Value, depth: number): Value {
  if (Array.isArray(left) && Array.isArray(right)) {
    if (depth === 0) return right;
    const items: Value[] = [...(left as Value[])];
    for (const rvalue of right as Value[]) {
      const rname = nameOf(rvalue);
      const lpos = rname === undefined ? -1 : items.findIndex((v) => nameOf(v) === rname);
      const lvalue = lpos < 0 ? undefined : items.splice(lpos, 1)[0];
      items.push(lvalue === undefined ? rvalue : mergeTomlValues(lvalue, rvalue, depth - 1));
    }
    return items;
  }
  if (isTable(left) && isTable(right)) {
    if (depth === 0) return right;
    const out: Table = { ...left };
    for (const [key, rvalue] of Object.entries(right)) {
      out[key] = key in left ? mergeTomlValues(left[key], rvalue, depth - 1) : rvalue;
    }
    return out;
  }
  return right;
}

class ConfigError extends Error {}

function str(v: Value, what: string): string {
  if (typeof v !== "string") throw new ConfigError(`${what}: expected a string`);
  return v;
}

function optStr(v: Value, what: string): string | null {
  return v === undefined ? null : str(v, what);
}

function optNum(v: Value, what: string): number | null {
  if (v === undefined) return null;
  if (typeof v !== "number" && typeof v !== "bigint") throw new ConfigError(`${what}: expected an integer`);
  return Number(v);
}

function optBool(v: Value, what: string): boolean | null {
  if (v === undefined) return null;
  if (typeof v !== "boolean") throw new ConfigError(`${what}: expected a boolean`);
  return v;
}

function strList(v: Value, what: string): string[] {
  if (!Array.isArray(v)) throw new ConfigError(`${what}: expected a list`);
  return v.map((x) => str(x, what));
}

function fileType(v: Value, what: string): FileType {
  if (typeof v === "string") return { kind: "extension", extension: v };
  if (isTable(v)) {
    const keys = Object.keys(v);
    if (keys.length === 0) throw new ConfigError("expected a `suffix` key in the `file-types` entry");
    if (keys[0] !== "glob") throw new ConfigError(`unknown key in \`file-types\` list: ${keys[0]}`);
    let glob = str(v.glob, what);
    if (!glob.startsWith("/") && !glob.startsWith("*/")) glob = `*/${glob}`;
    return { kind: "glob", glob };
  }
  throw new ConfigError(`${what}: expected string or table`);
}

function blockToken(v: Value, what: string): BlockCommentToken {
  if (!isTable(v)) throw new ConfigError(`${what}: expected a table`);
  return { start: str(v.start, what), end: str(v.end, what) };
}

function autoPairs(v: Value, what: string): [string, string][] | null {
  if (v === undefined || v === false) return null;
  if (v === true) return null;
  if (!isTable(v)) throw new ConfigError(`${what}: expected a boolean or a table`);
  return Object.entries(v).map(([open, close]) => [open, str(close, what)]);
}

const DEFAULT_PAIRS: [string, string][] = [
  ["(", ")"],
  ["{", "}"],
  ["[", "]"],
  ["'", "'"],
  ['"', '"'],
  ["`", "`"],
];

function languageConfig(v: Value): LanguageConfiguration {
  if (!isTable(v)) throw new ConfigError("language: expected a table");
  const name = str(v.name, "language.name");
  const at = (key: string) => `language '${name}': ${key}`;
  const comment = v["comment-tokens"] ?? v["comment-token"];
  const block = v["block-comment-tokens"];
  const indent = v.indent;
  const soft = v["soft-wrap"];
  const word = v["word-completion"];
  let pairs = autoPairs(v["auto-pairs"], at("auto-pairs"));
  if (v["auto-pairs"] === true) pairs = DEFAULT_PAIRS;
  let tabWidth: number | null = null;
  if (isTable(indent)) {
    tabWidth = optNum(indent["tab-width"], at("indent.tab-width"));
    if (tabWidth === null || tabWidth < 1 || tabWidth > 16) throw new ConfigError(`${at("indent.tab-width")}: tab width must be between 1 and 16`);
  }
  return {
    languageId: name,
    scope: str(v.scope, at("scope")),
    fileTypes: (Array.isArray(v["file-types"]) ? v["file-types"] : []).map((x) => fileType(x, at("file-types"))),
    shebangs: v.shebangs === undefined ? [] : strList(v.shebangs, at("shebangs")),
    commentTokens: comment === undefined ? null : typeof comment === "string" ? [comment] : strList(comment, at("comment-tokens")),
    blockCommentTokens: block === undefined ? null : Array.isArray(block) ? block.map((b) => blockToken(b, at("block-comment-tokens"))) : [blockToken(block, at("block-comment-tokens"))],
    textWidth: optNum(v["text-width"], at("text-width")),
    softWrap: isTable(soft)
      ? {
          enable: optBool(soft.enable, at("soft-wrap.enable")),
          maxWrap: optNum(soft["max-wrap"], at("soft-wrap.max-wrap")),
          maxIndentRetain: optNum(soft["max-indent-retain"], at("soft-wrap.max-indent-retain")),
          wrapIndicator: optStr(soft["wrap-indicator"], at("soft-wrap.wrap-indicator")),
          wrapAtTextWidth: optBool(soft["wrap-at-text-width"], at("soft-wrap.wrap-at-text-width")),
        }
      : null,
    autoFormat: optBool(v["auto-format"], at("auto-format")) ?? false,
    pathCompletion: optBool(v["path-completion"], at("path-completion")),
    wordCompletion: isTable(word)
      ? { enable: optBool(word.enable, at("word-completion.enable")), triggerLength: optNum(word["trigger-length"], at("word-completion.trigger-length")) }
      : null,
    grammar: optStr(v.grammar, at("grammar")),
    injectionRegex: optStr(v["injection-regex"], at("injection-regex")),
    indent: isTable(indent) ? { tabWidth: tabWidth!, unit: str(indent.unit, at("indent.unit")) } : null,
    autoPairs: pairs,
    rulers: v.rulers === undefined ? null : (v.rulers as Value[]).map((r) => optNum(r, at("rulers"))!),
    rainbowBrackets: optBool(v["rainbow-brackets"], at("rainbow-brackets")),
  };
}

function grammarConfig(v: Value): GrammarConfiguration {
  if (!isTable(v)) throw new ConfigError("grammar: expected a table");
  const name = str(v.name, "grammar.name");
  const source = isTable(v.source) ? v.source : {};
  return {
    name,
    git: optStr(source.git, `grammar '${name}': source.git`),
    rev: optStr(source.rev, `grammar '${name}': source.rev`),
    subpath: optStr(source.subpath, `grammar '${name}': source.subpath`),
    path: optStr(source.path, `grammar '${name}': source.path`),
  };
}

export function parseLanguagesToml(...sources: string[]): LanguagesConfiguration {
  let merged: Value = {};
  sources.forEach((source, i) => {
    const value = parse(source);
    merged = i === 0 ? value : mergeTomlValues(merged, value, 3);
  });
  const table = merged as Table;
  const languages = Array.isArray(table.language) ? table.language.map(languageConfig) : [];
  const grammars = Array.isArray(table.grammar) ? table.grammar.map(grammarConfig) : [];
  return { languages, grammars };
}
