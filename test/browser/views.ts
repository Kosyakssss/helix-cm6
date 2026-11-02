import { chromium, firefox, webkit, type BrowserType } from "playwright-core";

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

async function run(type: BrowserType): Promise<string[]> {
  const fails: string[] = [];
  const browser = await type.launch({ executablePath: (type === chromium && process.env.CHROMIUM_PATH) || undefined });
  const context = await browser.newContext({ viewport: { width: 800, height: 600 } });
  await context.route("https://helix.test/**", (route) => {
    const js = new URL(route.request().url()).pathname === "/page.js";
    return route.fulfill({ contentType: js ? "text/javascript" : "text/html", body: js ? script : html });
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  await page.goto("https://helix.test/");
  await page.waitForFunction(() => (window as unknown as { helixReady(): boolean }).helixReady());

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

  await focus("b");
  const doc = () => page.evaluate(() => (window as unknown as { helixDoc(n: string): string }).helixDoc("b"));
  const before = await doc();
  await page.keyboard.type("%d");
  const deleted = await doc();
  await page.keyboard.press("Meta+z");
  const undone = await doc();
  if (deleted !== "" || undone !== before) fails.push(`configured Meta-z undoes: got ${JSON.stringify([before, deleted, undone])}`);
  await page.keyboard.press("Meta+b");
  const unbound = await page.evaluate(() => (window as unknown as { helixLastKeydown(): unknown }).helixLastKeydown());
  if (JSON.stringify(unbound) !== JSON.stringify({ key: "b", meta: true, prevented: false })) fails.push(`unbound Meta-b reaches the page untouched: got ${JSON.stringify(unbound)}`);
  if ((await doc()) !== undone) fails.push("unbound Meta-b changed the text");
  for (const combo of ["Control+ArrowLeft", "Control+Home"]) {
    await page.keyboard.press(combo);
    const ctrl = await page.evaluate(() => (window as unknown as { helixLastKeydown(): { prevented: boolean } | null }).helixLastKeydown());
    if (!ctrl || ctrl.prevented) fails.push(`unbound ${combo} in normal mode reaches the OS: got ${JSON.stringify(ctrl)}`);
  }
  await page.keyboard.press("g");
  await page.keyboard.press("Control+ArrowLeft");
  const cancelled = await page.evaluate(() => (window as unknown as { helixLastKeydown(): { key: string } | null }).helixLastKeydown());
  if (cancelled?.key === "ArrowLeft") fails.push(`an unbound Ctrl key after a pending g cancels it as in Helix: got ${JSON.stringify(cancelled)}`);
  if (type === chromium) {
    const cdp = await context.newCDPSession(page);
    const metaShiftZ = { key: "z", code: "KeyZ", windowsVirtualKeyCode: 90, nativeVirtualKeyCode: 90, modifiers: 12 };
    await cdp.send("Input.dispatchKeyEvent", { ...metaShiftZ, type: "rawKeyDown" });
    await cdp.send("Input.dispatchKeyEvent", { ...metaShiftZ, type: "keyUp" });
    const redone = await doc();
    if (redone !== "") fails.push(`Meta+Shift+z reported with a lowercase key runs the configured Meta-Z redo: got ${JSON.stringify(redone)}`);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate(() => navigator.clipboard.writeText("from another app"));
    await page.keyboard.press("Space");
    await page.waitForTimeout(100);
    await page.keyboard.press("p");
    const pasted = await doc();
    if (!pasted.includes("from another app")) fails.push(`space p pastes text copied outside the editor: got ${JSON.stringify(pasted)}`);
  }

  await browser.close();
  if (errors.length > 0) fails.push(...errors.map((e) => `page error: ${e}`));
  return fails.map((f) => `${type.name()}: ${f}`);
}

const types = { chromium, firefox, webkit };
const names = (process.env.BROWSERS ?? "chromium,firefox,webkit").split(",") as (keyof typeof types)[];
const fails: string[] = [];
for (const name of names) {
  if (!types[name]) throw new Error(`unknown browser ${JSON.stringify(name)}`);
  fails.push(...(await run(types[name])));
}
console.log(fails.join("\n"));
console.log(`\ntwo editors: ${fails.length} failures`);
process.exit(fails.length > 0 ? 1 : 0);
