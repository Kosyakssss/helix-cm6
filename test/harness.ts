import { Text } from "@codemirror/state";
import { commitHistoryNow } from "../src/commands/jumps";
import { HeadlessHost } from "../src/core/host";
import { Context, HelixEditor } from "../src/core/editor";
import { insertSnippet } from "../src/commands/snippet";
import { buildKeymaps, appKeyLayer } from "../src/keymap";
import { helixField, historyField, setHelix, syncNativeSelection, toNative, helixOwned } from "../src/state";
import { defaultConfig, type Config } from "../src/config";
import { print, plain } from "../src/core/markup";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createLoader, SyntaxSessions } from "../src/syntax/languages";
import { RustRegexEngine } from "../src/core/rx";
import { HIGHLIGHT_LANGUAGES } from "./oracle/suites";
import type { LanguageLoader } from "../src/syntax/loader";
import type { LanguageId } from "../src/syntax/injections";
import { Syntax } from "../src/syntax/syntax";

const root = resolve(import.meta.dir, "..");
const regexEngine = await RustRegexEngine.load(readFileSync(resolve(root, "regex/regex.wasm")));
const treeSitter = readFileSync(resolve(root, "tree-sitter/tree-sitter.wasm"));
const languagesToml = readFileSync(resolve(root, "languages/languages.toml"), "utf8");
const grammarDir = resolve(root, "test/oracle/languages");
const syntaxSessions = new SyntaxSessions(await createLoader(treeSitter, { regex: regexEngine }));
const codeSessions = new Map<string, SyntaxSessions>();

async function sessionsFor(lang: string): Promise<SyntaxSessions> {
  if (lang === "markdown") return syntaxSessions;
  let sessions = codeSessions.get(lang);
  if (!sessions) {
    const loader = await createLoader(treeSitter, {
      regex: regexEngine,
      languages: [languagesToml],
      only: [lang],
      source: {
        grammar: (name) => {
          const file = resolve(grammarDir, "grammars", `${name}.wasm`);
          return existsSync(file) ? readFileSync(file) : null;
        },
        query: (language, file) => {
          const path = resolve(grammarDir, "queries", language, file);
          return existsSync(path) ? readFileSync(path, "utf8") : null;
        },
      },
    });
    const id = loader.languageForName(lang);
    if (id === null) throw new Error(`unknown language ${lang}`);
    await loader.load(id);
    sessions = new SyntaxSessions(loader);
    codeSessions.set(lang, sessions);
  }
  return sessions;
}

export async function highlightLoader(): Promise<LanguageLoader> {
  return createLoader(treeSitter, {
    regex: regexEngine,
    languages: [languagesToml],
    only: HIGHLIGHT_LANGUAGES,
    source: {
      grammar: (name) => {
        const file = resolve(grammarDir, "grammars", `${name}.wasm`);
        return existsSync(file) ? readFileSync(file) : null;
      },
      query: (language, file) => {
        const path = resolve(grammarDir, "queries", language, file);
        return existsSync(path) ? readFileSync(path, "utf8") : null;
      },
    },
  });
}

export async function loadLayers(loader: LanguageLoader, text: string, id: LanguageId): Promise<void> {
  for (let pass = 0; pass < 5; pass++) {
    const pending = new Set<LanguageId>();
    const syntax = new Syntax(loader, text, id);
    for (const layer of syntax.allLayers()) if (!loader.isLoaded(layer.language)) pending.add(layer.language);
    syntax.delete();
    if (pending.size === 0) return;
    for (const language of pending) await loader.load(language);
  }
}

export async function prepareLanguages(langs: Iterable<string>): Promise<void> {
  for (const lang of langs) await sessionsFor(lang);
}

export interface RunResult {
  text?: string;
  ranges?: [number, number][];
  primary?: number;
  out: string;
  mode: string;
  register: string[] | null;
  error?: string;
}

export function makeEditor(config?: Partial<Config>) {
  const editor = new HelixEditor(buildKeymaps({}, { app: appKeyLayer }), { ...defaultConfig(), ...config });
  editor.regex = regexEngine;
  editor.shell = (command, input, shell) => {
    const proc = Bun.spawnSync([...shell, command], { stdin: input === null ? "ignore" : Buffer.from(input), stdout: "pipe", stderr: "pipe" });
    return { code: proc.exitCode, stdout: proc.stdout.toString(), stderr: proc.stderr.toString() };
  };
  return editor;
}

export function makeHost(markup: string) {
  const { text, selection } = print(markup);
  const host = new HeadlessHost("\n", [helixField, historyField, syncNativeSelection]);
  const value = host.state.field(helixField);
  const next = { ...value, selection };
  host.dispatch({
    changes: { from: 0, to: 1, insert: text },
    selection: toNative(next, Text.of(text.split("\n"))),
    effects: setHelix.of(next),
    annotations: helixOwned.of(true),
  });
  commitHistoryNow(host);
  return host;
}

export function run(markup: string, keys: string, editor = makeEditor(), lang?: string): RunResult {
  const host = makeHost(markup);
  const sessions = lang === undefined || lang === "markdown" ? syntaxSessions : codeSessions.get(lang);
  if (!sessions) throw new Error(`call prepareLanguages for ${lang} first`);
  sessions.clear();
  if (lang) {
    const id = sessions.loader.languageForName(lang);
    sessions.open(host, host.state.doc, id);
    editor.languages = sessions.loader;
    editor.documentLanguage = { get: (h) => sessions.languageOf(h), set: (h, language) => sessions.setLanguage(h, language) };
    editor.syntax = (h) => sessions.get(h, h.state.doc);
  }
  host.onChanges = (changes, oldDoc) => {
    if (lang) sessions.change(host, oldDoc, changes, host.state.doc);
    editor.docChanged(host, changes);
  };
  try {
    const snippet = /^<snippet>([\s\S]*?)<\/snippet>/.exec(keys);
    if (snippet) {
      insertSnippet(new Context(editor, host, null, null), snippet[1]!);
      commitHistoryNow(host);
    }
    editor.feedKeys(host, snippet ? keys.slice(snippet[0].length) : keys);
  } catch (err) {
    return { out: "", mode: "", register: null, error: String((err as Error).stack ?? err) };
  }
  const value = host.state.field(helixField);
  const text = host.state.doc.toString();
  const toChar = (pos: number) => [...text.slice(0, pos)].length;
  return {
    text,
    ranges: value.selection.ranges.map((r) => [toChar(r.anchor), toChar(r.head)] as [number, number]),
    primary: value.selection.primaryIndex,
    out: plain(text, value.selection),
    mode: value.mode,
    register: editor.registers.read('"', editor.registerEnv(host)),
  };
}
