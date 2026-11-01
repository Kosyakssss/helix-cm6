import { chromium, type Browser } from "playwright-core";
import { parseKey, parseMacro } from "../../src/keys";
import { oracleAsync, type Case } from "../oracle/oracle";
import { handSuite } from "../oracle/suites";

const SHIFTED: Record<string, string> = {
  "~": "`", "!": "1", "@": "2", "#": "3", $: "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
  _: "-", "+": "=", "{": "[", "}": "]", "|": "\\", ":": ";", '"': "'", "<": ",", ">": ".", "?": "/",
};

const PUNCTUATION: Record<string, [string, number]> = {
  "`": ["Backquote", 192], "-": ["Minus", 189], "=": ["Equal", 187], "[": ["BracketLeft", 219], "]": ["BracketRight", 221],
  "\\": ["Backslash", 220], ";": ["Semicolon", 186], "'": ["Quote", 222], ",": ["Comma", 188], ".": ["Period", 190],
  "/": ["Slash", 191], " ": ["Space", 32],
};

const NAMED: Record<string, [string, number]> = {
  esc: ["Escape", 27],
  ret: ["Enter", 13],
  tab: ["Tab", 9],
  backspace: ["Backspace", 8],
  del: ["Delete", 46],
  home: ["Home", 36],
  end: ["End", 35],
};

function domKey(helixKey: string) {
  const k = parseKey(helixKey);
  let modifiers = (k.alt ? 1 : 0) | (k.ctrl ? 2 : 0) | (k.meta ? 4 : 0) | (k.shift ? 8 : 0);
  const plain = !k.ctrl && !k.alt && !k.meta;
  const named = NAMED[k.code];
  if (named) return { key: named[0], code: named[0], keyCode: named[1], modifiers, text: k.code === "ret" && plain ? "\r" : undefined };
  const ch = k.code;
  if ([...ch].length > 1) throw new Error(`no DOM key for <${helixKey}>`);
  const base = SHIFTED[ch] ?? (/^[A-Z]$/.test(ch) ? ch.toLowerCase() : ch);
  if (base !== ch) modifiers |= 8;
  const [code, keyCode] = /^[a-z]$/.test(base)
    ? [`Key${base.toUpperCase()}`, base.toUpperCase().charCodeAt(0)]
    : /^[0-9]$/.test(base)
      ? [`Digit${base}`, base.charCodeAt(0)]
      : (PUNCTUATION[base] ?? ["", 0]);
  return { key: ch, code, keyCode, modifiers, text: plain ? ch : undefined };
}

interface State {
  text: string;
  ranges: [number, number][];
  primary: number;
  out: string;
  mode: string;
  focused: boolean;
}

const filter = process.argv[2];
const all = handSuite().filter((c) => !filter || c.keys.includes(filter) || c.id.startsWith(filter));
if (all.length === 0) throw new Error(`no cases match ${JSON.stringify(filter)}`);
const jobs = Number(process.env.BROWSER_JOBS ?? 8);
if (!Number.isSafeInteger(jobs) || jobs < 1) throw new Error("BROWSER_JOBS must be a positive integer");
const expected = await oracleAsync(all);
const cases = all.filter((c) => !expected.get(c.id)!.error && expected.get(c.id)!.out !== undefined);

const built = await Bun.build({
  entrypoints: [`${import.meta.dir}/page.ts`],
  target: "browser",
  format: "esm",
  plugins: [
    {
      name: "wasm",
      setup(build) {
        build.onLoad({ filter: /\.wasm$/ }, async (args) => ({
          contents: `export default ${JSON.stringify(Buffer.from(Bun.deflateSync(await Bun.file(args.path).bytes())).toString("base64"))};`,
          loader: "js",
        }));
      },
    },
  ],
});
if (!built.success) throw new AggregateError(built.logs, "cannot build the test page");
const script = await built.outputs[0]!.text();
const html = '<!doctype html><meta charset="utf-8"><body style="margin:0;width:800px"><script type="module" src="/page.js"></script>';

async function runShard(browser: Browser, shard: Case[]): Promise<string[]> {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  await context.route("http://helix.test/**", (route) => {
    const js = new URL(route.request().url()).pathname === "/page.js";
    return route.fulfill({ contentType: js ? "text/javascript" : "text/html", body: js ? script : html });
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  const cdp = await context.newCDPSession(page);
  const fails: string[] = [];
  for (const c of shard) {
    const want = expected.get(c.id)!;
    errors.length = 0;
    await page.goto(`http://helix.test/?markup=${encodeURIComponent(c.in)}`);
    await page.waitForFunction(() => (window as unknown as { helixReady(): boolean }).helixReady());
    for (const k of parseMacro(c.keys)) {
      const d = domKey(k);
      const base = { key: d.key, code: d.code, windowsVirtualKeyCode: d.keyCode, nativeVirtualKeyCode: d.keyCode, modifiers: d.modifiers };
      await cdp.send("Input.dispatchKeyEvent", d.text ? { ...base, type: "keyDown", text: d.text, unmodifiedText: d.text } : { ...base, type: "rawKeyDown" });
      await cdp.send("Input.dispatchKeyEvent", { ...base, type: "keyUp" });
    }
    const got = await page.evaluate(() => (window as unknown as { helixState(): State }).helixState());
    const ok =
      errors.length === 0 &&
      got.focused &&
      got.text === want.text &&
      JSON.stringify(got.ranges) === JSON.stringify(want.ranges) &&
      got.primary === want.primary &&
      got.mode === want.mode;
    if (!ok) {
      fails.push(
        `${c.id}: ${JSON.stringify(c.keys)} in ${JSON.stringify(c.in)}\n  want ${JSON.stringify(want.out)} ${want.mode} ranges=${JSON.stringify(want.ranges)} primary=${want.primary}\n  got  ${JSON.stringify(got.out)} ${got.mode} ranges=${JSON.stringify(got.ranges)} primary=${got.primary}${got.focused ? "" : " unfocused"}${errors.length ? ` errors ${errors.join(" | ")}` : ""}`,
      );
    }
  }
  await context.close();
  return fails;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const shardCount = Math.min(jobs, cases.length);
const shards = Array.from({ length: shardCount }, (_, s) => cases.filter((_, i) => i % shardCount === s));
const fails = (await Promise.all(shards.map((shard) => runShard(browser, shard))).finally(() => browser.close())).flat();
console.log(fails.slice(0, Number(process.env.SHOW ?? 40)).join("\n"));
console.log(`\n${cases.length} cases, ${fails.length} failures, ${all.length - cases.length} skipped (oracle error)`);
process.exit(fails.length > 0 || cases.length !== all.length ? 1 : 0);
