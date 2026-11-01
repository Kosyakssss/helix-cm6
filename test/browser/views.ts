import { chromium } from "playwright-core";

const built = await Bun.build({
  entrypoints: [`${import.meta.dir}/views-page.ts`],
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

interface Panel {
  prompt: string | null;
  message: string | null;
  focused: boolean;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
await context.route("http://helix.test/**", (route) => {
  const js = new URL(route.request().url()).pathname === "/page.js";
  return route.fulfill({ contentType: js ? "text/javascript" : "text/html", body: js ? script : html });
});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (err) => errors.push(String(err)));
await page.goto("http://helix.test/");
await page.waitForFunction(() => (window as unknown as { helixReady(): boolean }).helixReady());

const fails: string[] = [];
const panelOf = (name: "a" | "b") => page.evaluate((n) => (window as unknown as { helixPanel(n: string): Panel }).helixPanel(n), name);
const focus = async (name: "a" | "b") => {
  await page.click(`#${name} .cm-content`);
  await page.evaluate((n) => (window as unknown as { helixFocus(n: string): void }).helixFocus(n), name);
  await page.waitForTimeout(100);
};
const expect = async (step: string, name: "a" | "b", want: Partial<Panel>) => {
  const got = await panelOf(name);
  for (const [key, value] of Object.entries(want)) {
    if (got[key as keyof Panel] !== value) fails.push(`${step}: editor ${name} ${key} is ${JSON.stringify(got[key as keyof Panel])}, want ${JSON.stringify(value)}`);
  }
};

await focus("a");
await page.keyboard.type(":");
await expect("prompt in a", "a", { prompt: ":", focused: true });
await focus("b");
await expect("focus b after prompt in a", "a", { prompt: null });
await page.keyboard.type(":");
await expect("prompt in b after prompt in a", "b", { prompt: ":", focused: true });
await page.keyboard.press("Escape");
await expect("escape in b", "b", { prompt: null });

await focus("a");
await page.keyboard.type(":echo one");
await page.keyboard.press("Enter");
await expect("message in a", "a", { message: "one" });
await focus("b");
await expect("message hidden in a after focus b", "a", { message: null });
await page.keyboard.type(":echo one");
await page.keyboard.press("Enter");
await expect("same message in b", "b", { message: "one" });

await page.keyboard.press("Escape");
await focus("a");
await page.keyboard.type("gw");
const labelsA = await page.locator("#a .hx-jump-label").count();
await page.keyboard.press("Escape");
await focus("b");
await page.keyboard.type("gw");
const labelsB = await page.locator("#b .hx-jump-label").count();
if (labelsA === 0 || labelsB === 0) fails.push(`jump labels: a has ${labelsA}, b has ${labelsB}`);
await page.keyboard.press("Escape");

await focus("a");
const moved = await page.evaluate(() => (window as unknown as { helixMoveToLineEnd(n: string): number[] | null }).helixMoveToLineEnd("a"));
if (!moved || moved[1] !== moved[2]) fails.push(`programmatic cursor move to the line end: got ${JSON.stringify(moved)}`);

await browser.close();
if (errors.length > 0) fails.push(...errors.map((e) => `page error: ${e}`));
console.log(fails.join("\n"));
console.log(`\ntwo editors: ${fails.length} failures`);
process.exit(fails.length > 0 ? 1 : 0);
