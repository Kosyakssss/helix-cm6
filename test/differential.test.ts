import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { highlightSpans, rainbowSpans } from "../src/syntax/highlight";
import { Syntax } from "../src/syntax/syntax";
import { parse } from "smol-toml";
import { oracleAsync } from "./oracle/oracle";
import { highlightSuite } from "./oracle/suites";
import { highlightLoader, loadLayers } from "./harness";
import { expect, test } from "bun:test";
import { compare } from "./oracle/diff";
import { codeSuite, handSuite, markdownSuite, snippetSuite } from "./oracle/suites";
import { fuzzSuite, markdownFuzzSuite } from "./oracle/fuzz";
import { oracleGraphemes } from "./oracle/oracle";
import { segmentGraphemes } from "../src/graphemes";
import { run } from "./harness";
import { STATIC_COMMANDS } from "../src/commands";
import { APP_COMMANDS } from "../src/commands/app";
import { STATIC_COMMAND_NAMES, TYPED_COMMAND_NAMES } from "../src/commands/names";
import { TYPABLE } from "../src/commands/typed";

const describe = (f: { c: { keys: string; in: string }; expected: { out?: string }; actual: { out: string; error?: string } }) =>
  `${JSON.stringify(f.c.keys)} in ${JSON.stringify(f.c.in)}: want ${JSON.stringify(f.expected.out)} got ${JSON.stringify(f.actual.out)} ${f.actual.error ?? ""}`;

test("hand suite matches Helix", async () => {
  const { failures } = await compare(handSuite());
  expect(failures.map(describe)).toEqual([]);
}, 1_800_000);

for (const seed of [1, 2, 3, 4, 5]) {
  test(`fuzz seed ${seed} matches Helix`, async () => {
    const { failures } = await compare(fuzzSuite(3000, seed));
    expect(failures.map(describe)).toEqual([]);
  }, 1_800_000);
}

test("markdown suite matches Helix with the markdown syntax tree", async () => {
  const { failures } = await compare(markdownSuite());
  expect(failures.map(describe)).toEqual([]);
}, 1_800_000);

test("code suite matches Helix with each language's grammar and queries", async () => {
  const { failures } = await compare(codeSuite());
  expect(failures.map(describe)).toEqual([]);
}, 1_800_000);

test("snippets match Helix", async () => {
  const { failures, skipped } = await compare(snippetSuite());
  expect(skipped).toBe(0);
  expect(failures.map(describe)).toEqual([]);
}, 1_800_000);

test("syntax highlighting matches Helix", async () => {
  const theme = parse(readFileSync(resolve(process.env.HELIX_DIR ?? resolve(import.meta.dir, "../../helix"), "theme.toml"), "utf8"));
  const rainbow = Array.isArray(theme.rainbow) ? theme.rainbow.length : 6;
  const scopes = [...Array.from({ length: rainbow }, (_, i) => `rainbow.${i}`), ...Object.keys(theme).filter((key) => key !== "palette" && key !== "inherits" && key !== "rainbow")];
  const cases = highlightSuite(scopes);
  const results = await oracleAsync(cases);
  const loader = await highlightLoader();
  const wrong: string[] = [];
  for (const c of cases) {
    const want = results.get(c.id)!;
    expect(want.error).toBeUndefined();
    const id = loader.languageForName(c.lang!)!;
    await loader.load(id);
    await loadLayers(loader, c.in, id);
    const syntax = new Syntax(loader, c.in, id);
    const got = highlightSpans(syntax, scopes, 0, syntax.byteLength).map((s) => [s.from, s.to, s.scopes]);
    const toChar = (byte: number) => [...c.in.slice(0, syntax.posOf(byte))].length;
    const rainbow = rainbowSpans(syntax, 6, 0, syntax.byteLength).map((s) => [toChar(s.from), toChar(s.to), s.highlight]);
    syntax.delete();
    if (JSON.stringify(rainbow) !== JSON.stringify(want.rainbow)) wrong.push(`${c.id} rainbow: got ${JSON.stringify(rainbow).slice(0, 200)}, want ${JSON.stringify(want.rainbow).slice(0, 200)}`);
    if (JSON.stringify(got) !== JSON.stringify(want.spans)) {
      const at = got.findIndex((g, i) => JSON.stringify(g) !== JSON.stringify(want.spans![i]));
      wrong.push(`${c.id}: span ${at}: got ${JSON.stringify(got[at])} ${JSON.stringify((got[at]?.[2] as number[] | undefined)?.map((h) => scopes[h]))}, want ${JSON.stringify(want.spans![at])} ${JSON.stringify(want.spans![at]?.[2].map((h) => scopes[h]))}`);
    }
  }
  expect(wrong).toEqual([]);
}, 1_800_000);

for (const seed of [1, 2, 3]) {
  test(`markdown fuzz seed ${seed} matches Helix`, async () => {
    const { failures } = await compare(markdownFuzzSuite(2000, seed));
    expect(failures.map(describe)).toEqual([]);
  }, 1_800_000);
}

test("grapheme clusters match unicode-segmentation", () => {
  const samples = [
    0x41, 0x0d, 0x0a, 0x00, 0x0301, 0x1f600, 0x0915, 0x1100, 0x1161, 0x11a8, 0xac00, 0xac01, 0x0600, 0x1f1ec, 0x0903,
    0x200d, 0x094d, 0x09cd, 0x0e33, 0x0e40, 0x1f3fb, 0x2764, 0xfe0f, 0x0995, 0x0930,
  ];
  const strings: string[] = [];
  for (const a of samples) for (const b of samples) for (const c of samples) strings.push(String.fromCodePoint(a, b, c));
  for (const a of samples) {
    for (const b of samples) {
      for (const c of samples) for (const d of [0x094d, 0x200d, 0x1f1ec, 0x0301]) strings.push(String.fromCodePoint(a, b, d, c));
    }
  }
  const want = oracleGraphemes(strings);
  const failures = strings.filter((s, i) => JSON.stringify(segmentGraphemes(s).map((g) => [...g].length)) !== JSON.stringify(want[i]));
  expect(failures.map((s) => [...s].map((c) => c.codePointAt(0)!.toString(16)).join(" "))).toEqual([]);
}, 600_000);

test("an expansion that gives an empty string still expands the rest of the argument", () => {
  expect(run("#[a|]#", ':set-register b %reg{c}x<ret>"bp').out).toBe("a#[x|]#");
  expect(run("#[a|]#", ':set-register b %reg{c}%%<ret>"bp').out).toBe("a#[%|]#");
});

test("the command name types are up to date; bun run names rebuilds them", () => {
  expect<string[]>([...STATIC_COMMAND_NAMES]).toEqual([...new Set([...Object.keys(STATIC_COMMANDS), ...Object.keys(APP_COMMANDS)])].sort());
  expect<string[]>([...TYPED_COMMAND_NAMES]).toEqual([...new Set(TYPABLE.map((c) => c.name))].sort());
});
