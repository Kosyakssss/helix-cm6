import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseLanguagesToml, type GrammarConfiguration } from "../src/syntax/config";

const HELIX_REV = "ba40e547426b0f9896c8bdc699a4ab11f2b37dbc";
const QUERY_FILES = ["highlights.scm", "injections.scm", "locals.scm", "textobjects.scm", "indents.scm", "rainbows.scm", "tags.scm"];

const here = import.meta.dir;
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
if (outIndex < 0 || !args[outIndex + 1]) {
  process.stderr.write("usage: bun languages/build.ts --out <dir> (--all | <language>...)\n");
  process.exit(2);
}
const out = resolve(args[outIndex + 1]!);
const wanted = args.filter((a, i) => i !== outIndex && i !== outIndex + 1);
const all = wanted.includes("--all");

const config = parseLanguagesToml(readFileSync(join(here, "languages.toml"), "utf8"));
const cache = join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "helix-cm6");

function run(cmd: string[], cwd?: string): string {
  const proc = Bun.spawnSync(cmd, { cwd, stdout: "pipe", stderr: "pipe" });
  if (proc.exitCode !== 0) throw new Error(`${cmd.join(" ")}: ${proc.stderr.toString().trim()}`);
  return proc.stdout.toString();
}

function sdk(): string {
  return run(["sh", join(here, "..", "tree-sitter", "sdk.sh")]).trim();
}

function helixRepo(): string {
  const local = process.env.HELIX_DIR ?? resolve(here, "..", "..", "helix");
  if (existsSync(join(local, ".git"))) {
    try {
      run(["git", "-C", local, "cat-file", "-e", `${HELIX_REV}^{commit}`]);
      return local;
    } catch {
      process.stderr.write(`${local} does not have Helix ${HELIX_REV}, using a cached clone\n`);
    }
  }
  const dir = join(cache, "helix");
  if (!existsSync(join(dir, ".git"))) run(["git", "clone", "-q", "--filter=blob:none", "--no-checkout", "https://github.com/helix-editor/helix", dir]);
  try {
    run(["git", "-C", dir, "cat-file", "-e", `${HELIX_REV}^{commit}`]);
  } catch {
    run(["git", "-C", dir, "fetch", "-q", "--filter=blob:none", "https://github.com/helix-editor/helix", HELIX_REV]);
  }
  return dir;
}

function query(repo: string, language: string, file: string): string | null {
  const proc = Bun.spawnSync(["git", "-C", repo, "show", `${HELIX_REV}:runtime/queries/${language}/${file}`], { stdout: "pipe", stderr: "pipe" });
  return proc.exitCode === 0 ? proc.stdout.toString() : null;
}

function inherited(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/;+\s*inherits\s*:?\s*([a-z_,()-]+)\s*/g)) out.push(...m[1]!.split(","));
  return out;
}

function fetchGrammar(grammar: GrammarConfiguration): string {
  if (grammar.path) return resolve(grammar.path);
  if (!grammar.git || !grammar.rev) throw new Error(`grammar ${grammar.name} has no git source`);
  const dir = join(cache, "grammars", grammar.name);
  const head = existsSync(join(dir, ".git")) ? Bun.spawnSync(["git", "-C", dir, "rev-parse", "HEAD"], { stdout: "pipe" }).stdout.toString().trim() : "";
  if (head !== grammar.rev) {
    mkdirSync(dir, { recursive: true });
    if (!existsSync(join(dir, ".git"))) run(["git", "init", "-q", dir]);
    run(["git", "-C", dir, "fetch", "-q", "--depth", "1", grammar.git, grammar.rev]);
    run(["git", "-C", dir, "checkout", "-q", "FETCH_HEAD"]);
  }
  return grammar.subpath ? join(dir, grammar.subpath) : dir;
}

function buildGrammar(grammar: GrammarConfiguration, wasi: string): void {
  const src = join(fetchGrammar(grammar), "src");
  const tmp = join(tmpdir(), `helix-cm6-grammar-${grammar.name}-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  const cc = [join(wasi, "bin", "clang"), "--target=wasm32-wasip1", "-O2", "-DNDEBUG", "-fPIC", `-ffile-prefix-map=${src}=.`, "-I", src];
  const objects: string[] = [];
  for (const file of ["parser.c", "scanner.c"]) {
    if (!existsSync(join(src, file))) continue;
    const object = join(tmp, file.replace(/\.c$/, ".o"));
    run([...cc, "-std=c11", "-c", join(src, file), "-o", object]);
    objects.push(object);
  }
  if (objects.length === 0) throw new Error(`grammar ${grammar.name} has no parser.c`);
  const symbol = `tree_sitter_${grammar.name.replace(/[-.]/g, "_")}`;
  mkdirSync(join(out, "grammars"), { recursive: true });
  run([
    join(wasi, "bin", "clang"),
    "--target=wasm32-wasip1",
    "-shared",
    "-nostdlib",
    "-Wl,--experimental-pic",
    "-Wl,--allow-undefined",
    "-Wl,--no-entry",
    `-Wl,--export=${symbol}`,
    "-Wl,--strip-all",
    ...objects,
    "-o",
    join(out, "grammars", `${grammar.name}.wasm`),
  ]);
}

const languages = all ? config.languages : config.languages.filter((l) => wanted.includes(l.languageId));
const unknown = wanted.filter((w) => w !== "--all" && !config.languages.some((l) => l.languageId === w));
if (unknown.length > 0) {
  process.stderr.write(`unknown languages: ${unknown.join(", ")}\n`);
  process.exit(2);
}

const repo = helixRepo();
const queryLanguages = new Set<string>();
const pending = languages.map((l) => l.languageId);
while (pending.length > 0) {
  const language = pending.pop()!;
  if (queryLanguages.has(language)) continue;
  queryLanguages.add(language);
  for (const file of QUERY_FILES) {
    const text = query(repo, language, file);
    if (text === null) continue;
    mkdirSync(join(out, "queries", language), { recursive: true });
    writeFileSync(join(out, "queries", language, file), text);
    pending.push(...inherited(text));
  }
}

const wasi = sdk();
const grammarNames = new Set(languages.map((l) => l.grammar ?? l.languageId));
const failed: string[] = [];
for (const name of [...grammarNames].sort()) {
  const grammar = config.grammars.find((g) => g.name === name);
  if (!grammar) continue;
  try {
    buildGrammar(grammar, wasi);
    process.stdout.write(`built ${name}\n`);
  } catch (err) {
    failed.push(name);
    process.stderr.write(`failed ${name}: ${err instanceof Error ? err.message : String(err)}\n`);
  }
}
const built = existsSync(join(out, "grammars")) ? readdirSync(join(out, "grammars")).length : 0;
process.stdout.write(`${built} grammars and the queries of ${queryLanguages.size} languages in ${out}\n`);
if (failed.length > 0) process.exit(1);
