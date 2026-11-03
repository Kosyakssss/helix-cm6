import type { RustRegexEngine } from "../core/rx";
import type { LanguageConfiguration, LanguagesConfiguration } from "./config";
import { InjectionsQuery, type InjectionLoader, type InjectionLanguageMarker, type LanguageId, type SyntaxConfig } from "./injections";
import { HighlightQuery, LocalsQuery, RainbowQuery } from "./highlight";
import { Query, type UserPredicate } from "./query";
import { Language, Parser, type Runtime } from "./ts";

export type QueryFile = "highlights.scm" | "injections.scm" | "locals.scm" | "textobjects.scm" | "indents.scm" | "rainbows.scm" | "tags.scm";

export interface LanguageSource {
  grammar(name: string): Uint8Array | null | Promise<Uint8Array | null>;
  query(language: string, file: QueryFile): string | null | Promise<string | null>;
}

const INHERITS = /;+\s*inherits\s*:?\s*([a-z_,()-]+)\s*/g;

export async function readQuery(language: string, read: (language: string) => string | Promise<string>): Promise<string> {
  const query = await read(language);
  const parts: Promise<string>[] = [];
  let last = 0;
  for (const m of query.matchAll(INHERITS)) {
    parts.push(Promise.resolve(query.slice(last, m.index)));
    const inherited = m[1]!.split(",").map(async (lang) => `\n${await readQuery(lang, read)}\n`);
    parts.push(Promise.all(inherited).then((texts) => texts.join("")));
    last = m.index + m[0].length;
  }
  parts.push(Promise.resolve(query.slice(last)));
  return (await Promise.all(parts)).join("");
}

function globRegex(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*") {
      out += ".*";
      while (glob[i + 1] === "*") i++;
    } else if (c === "?") out += ".";
    else if (c === "[") {
      const end = glob.indexOf("]", i + 2);
      if (end < 0) out += "\\[";
      else {
        let body = glob.slice(i + 1, end);
        if (body.startsWith("!")) body = `^${body.slice(1)}`;
        out += `[${body.replace(/\\/g, "\\\\")}]`;
        i = end;
      }
    } else if (c === "{") {
      const end = glob.indexOf("}", i);
      if (end < 0) out += "\\{";
      else {
        out += `(?:${glob
          .slice(i + 1, end)
          .split(",")
          .map((alt) => globRegex(alt).source.slice(1, -1))
          .join("|")})`;
        i = end;
      }
    } else out += c.replace(/[.+^$()|\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`, "u");
}

function extensionOf(path: string): string | null {
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (name === "..") return null;
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return null;
  return name.slice(dot + 1);
}

const SHEBANG = /^#!\p{White_Space}*(?:\P{White_Space}*[/\\](?:env\p{White_Space}+(?:-\P{White_Space}+\p{White_Space}+)*)?)?([^\p{White_Space}.\p{Nd}]+)/u;

export class LanguageData {
  syntax: SyntaxConfig | null | undefined = undefined;
  loading: Promise<void> | null = null;
  readonly queries = new Map<QueryFile, string>();
  private compiled = new Map<QueryFile, unknown>();

  constructor(
    readonly id: LanguageId,
    readonly config: LanguageConfiguration,
  ) {}

  query<T>(file: QueryFile, compile: (text: string) => T): T | null {
    if (this.compiled.has(file)) return this.compiled.get(file) as T | null;
    const text = this.queries.get(file) ?? "";
    let query: T | null = null;
    if (text !== "" && this.syntax) {
      try {
        query = compile(text);
      } catch {
        query = null;
      }
    }
    this.compiled.set(file, query);
    return query;
  }
}

export interface Builtins {
  grammars: Map<string, Language>;
  queries: Map<string, Partial<Record<QueryFile, string>>>;
}

export class LanguageLoader implements InjectionLoader {
  readonly parser: Parser;
  readonly languages: LanguageData[];
  private readonly byExtension = new Map<string, LanguageId>();
  private readonly byShebang = new Map<string, LanguageId>();
  private readonly globs: { glob: string; regex: RegExp; language: LanguageId }[] = [];
  private readonly injectionRegexes = new Map<LanguageId, number>();
  private readonly listeners = new Set<(language: LanguageId) => void>();
  readonly errors: string[] = [];

  constructor(
    readonly rt: Runtime,
    readonly regex: RustRegexEngine | null,
    config: LanguagesConfiguration,
    private readonly builtins: Builtins,
    private readonly source: LanguageSource | null,
  ) {
    this.parser = new Parser(rt);
    this.languages = config.languages.map((c, i) => new LanguageData(i, c));
    for (const data of this.languages) {
      for (const fileType of data.config.fileTypes) {
        if (fileType.kind === "extension") this.byExtension.set(fileType.extension, data.id);
        else this.globs.push({ glob: fileType.glob, regex: globRegex(fileType.glob), language: data.id });
      }
      for (const shebang of data.config.shebangs) this.byShebang.set(shebang, data.id);
    }
  }

  onLoad(listener: (language: LanguageId) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  language(id: LanguageId): LanguageData {
    return this.languages[id]!;
  }

  languageForName(name: string): LanguageId | null {
    return this.languages.find((l) => l.config.languageId === name)?.id ?? null;
  }

  languageForScope(scope: string): LanguageId | null {
    return this.languages.find((l) => l.config.scope === scope)?.id ?? null;
  }

  private injectionRegex(data: LanguageData): number | null {
    const source = data.config.injectionRegex;
    if (source === null || !this.regex) return null;
    let regex = this.injectionRegexes.get(data.id);
    if (regex === undefined) {
      regex = this.regex.compile(`(?-m)${source}`, false);
      this.injectionRegexes.set(data.id, regex);
    }
    return regex;
  }

  languageForMatch(text: string): LanguageId | null {
    const exact = this.languageForName(text);
    if (exact !== null) return exact;
    const bytes = new TextEncoder().encode(text);
    let bestLength = 0;
    let best: LanguageId | null = null;
    for (const data of this.languages) {
      const regex = this.injectionRegex(data);
      if (regex === null) continue;
      const found = this.regex!.findBytes(regex, bytes);
      if (found && found[1] - found[0] > bestLength) {
        best = data.id;
        bestLength = found[1] - found[0];
      }
    }
    return best;
  }

  languageForFilename(path: string): LanguageId | null {
    const absolute = path.startsWith("/") ? path : `/${path}`;
    let best: { glob: string; language: LanguageId } | null = null;
    for (const glob of this.globs) {
      if (glob.regex.test(absolute) && (!best || glob.glob.length > best.glob.length)) best = glob;
    }
    if (best) return best.language;
    const extension = extensionOf(path);
    return extension === null ? null : (this.byExtension.get(extension) ?? null);
  }

  languageForShebang(text: string): LanguageId | null {
    const marker = SHEBANG.exec(text)?.[1];
    return marker === undefined ? null : (this.byShebang.get(marker) ?? null);
  }

  languageForMarker(marker: InjectionLanguageMarker): LanguageId | null {
    switch (marker.kind) {
      case "name":
        return this.languageForName(marker.name);
      case "match":
        return this.languageForMatch(marker.text);
      case "filename":
        return this.languageForFilename(marker.text);
      case "shebang":
        return this.byShebang.get(marker.text) ?? null;
    }
  }

  getConfig(id: LanguageId): SyntaxConfig | null {
    const data = this.language(id);
    if (data.syntax === undefined) {
      const grammar = this.builtins.grammars.get(data.config.grammar ?? data.config.languageId);
      const queries = this.builtins.queries.get(data.config.languageId);
      if (grammar && queries) {
        for (const [file, text] of Object.entries(queries)) data.queries.set(file as QueryFile, text);
        this.compileSyntax(data, grammar);
      } else void this.load(id);
    }
    return data.syntax ?? null;
  }

  isLoaded(id: LanguageId): boolean {
    return this.language(id).syntax !== undefined;
  }

  private compileSyntax(data: LanguageData, grammar: Language): void {
    try {
      data.syntax = { grammar, injectionQuery: new InjectionsQuery(grammar, data.queries.get("injections.scm") ?? "", this.regex) };
    } catch (err) {
      this.errors.push(`Failed to compile highlights for '${data.config.languageId}': ${err instanceof Error ? err.message : String(err)}`);
      data.syntax = null;
    }
  }

  load(id: LanguageId): Promise<void> {
    const data = this.language(id);
    if (data.loading) return data.loading;
    data.loading = this.loadData(data).then(() => {
      for (const listener of this.listeners) listener(id);
    });
    return data.loading;
  }

  private async loadData(data: LanguageData): Promise<void> {
    const name = data.config.grammar ?? data.config.languageId;
    if (this.builtins.queries.has(data.config.languageId) && this.builtins.grammars.has(name)) {
      this.getConfig(data.id);
      return;
    }
    let grammar: Language | null = this.builtins.grammars.get(name) ?? null;
    if (!grammar && this.source) {
      try {
        const bytes = await this.source.grammar(name);
        if (bytes) grammar = new Language(this.rt, await this.rt.loadLanguage(bytes, name));
      } catch (err) {
        this.errors.push(`Failed to load grammar '${name}': ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (!grammar) {
      data.syntax = null;
      return;
    }
    const files: QueryFile[] = ["highlights.scm", "injections.scm", "locals.scm", "textobjects.scm", "indents.scm", "rainbows.scm", "tags.scm"];
    const source = this.source;
    await Promise.all(
      files.map(async (file) => {
        const text = await readQuery(data.config.languageId, async (language) => (await source?.query(language, file)) ?? "");
        data.queries.set(file, text);
      }),
    );
    this.compileSyntax(data, grammar);
  }

  newQuery(grammar: Language, text: string, custom: (pattern: number, predicate: UserPredicate) => void): Query {
    return new Query(this.rt, grammar, text, custom, this.regex);
  }

  highlightQuery(id: LanguageId): HighlightQuery | null {
    const data = this.language(id);
    return data.query("highlights.scm", (text) => {
      try {
        return new HighlightQuery(this, data.syntax!.grammar, text, data.queries.get("locals.scm") ?? "");
      } catch (err) {
        this.errors.push(`Failed to compile highlights queries for '${data.config.languageId}': ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    });
  }

  localsQuery(id: LanguageId): LocalsQuery | null {
    const data = this.language(id);
    return data.query("locals.scm", (text) => {
      try {
        return new LocalsQuery(this, data.syntax!.grammar, text);
      } catch (err) {
        this.errors.push(`Failed to compile locals queries for '${data.config.languageId}': ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    });
  }

  rainbowQuery(id: LanguageId): RainbowQuery | null {
    const data = this.language(id);
    return data.query("rainbows.scm", (text) => {
      try {
        return new RainbowQuery(this, data.syntax!.grammar, text);
      } catch (err) {
        this.errors.push(`Failed to compile rainbows queries for '${data.config.languageId}': ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    });
  }

  textobjectQuery(id: LanguageId): Query | null {
    const data = this.language(id);
    return data.query("textobjects.scm", (text) => this.compile(data, text, "textobjects.scm"));
  }

  indentQuery<T>(id: LanguageId, compile: (grammar: Language, text: string) => T): T | null {
    const data = this.language(id);
    return data.query("indents.scm", (text) => {
      try {
        return compile(data.syntax!.grammar, text);
      } catch (err) {
        this.errors.push(`Failed to compile indents.scm query for '${data.config.languageId}': ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    });
  }

  private compile(data: LanguageData, text: string, file: QueryFile): Query {
    try {
      return new Query(this.rt, data.syntax!.grammar, text, () => {}, this.regex);
    } catch (err) {
      this.errors.push(`Failed to compile ${file} queries for '${data.config.languageId}': ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }
}
