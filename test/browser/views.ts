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
  page.on("pageerror", (err) => { errors.push(String(err)); if (process.env.VIEWS_DEBUG) console.error(String(err), err.stack); });
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
  for (const combo of ["Control+End", "Control+Home", "Control+Shift+PageDown"]) {
    await page.keyboard.press(combo);
    const ctrl = await page.evaluate(() => (window as unknown as { helixLastKeydown(): { prevented: boolean } | null }).helixLastKeydown());
    if (!ctrl || ctrl.prevented) fails.push(`unbound ${combo} in normal mode reaches the OS: got ${JSON.stringify(ctrl)}`);
  }
  const beforeCtrlK = await doc();
  await page.keyboard.press("Control+k");
  if ((await doc()) !== beforeCtrlK) fails.push("unbound Ctrl-k in normal mode changed the text");
  await page.keyboard.press("g");
  await page.keyboard.press("Control+End");
  const cancelled = await page.evaluate(() => (window as unknown as { helixLastKeydown(): { key: string } | null }).helixLastKeydown());
  if (cancelled?.key === "End") fails.push(`an unbound Ctrl key after a pending g cancels it as in Helix: got ${JSON.stringify(cancelled)}`);
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

  type Extra = { doc: string; head: number; anchor: number; edges: { direction: string; count: number; extend: boolean }[]; entered: string[]; status: string | null };
  const extra = (name: string, keys: string) => page.evaluate(([n, k]) => (window as unknown as { helixExtra(a: string, b: string): Extra }).helixExtra(n!, k!), [name, keys]);
  const check = (what: string, got: unknown, want: unknown) => {
    if (JSON.stringify(got) !== JSON.stringify(want)) fails.push(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  };
  check("edge up at the first line", (await extra("edges", "k")).edges.map((e) => [e.direction, e.count]), [["up", 1]]);
  check("edge left at the start", (await extra("edges", "h")).edges.map((e) => [e.direction, e.count]), [["left", 1]]);
  check("edge down with the rest of a count", (await extra("edges", "5j")).edges.map((e) => [e.direction, e.count]), [["down", 3]]);
  check("edge right stops before the end of the document", (await extra("cell", "5l")).edges.map((e) => [e.direction, e.count, e.extend]), [["right", 3, false]]);
  const skipped = await extra("ranges", "j");
  check("j skips a skip range", skipped.head, 18);
  check("j lands on the start of a row range", (await extra("ranges", "j")).head, 22);
  check("j leaves a row range in one step", (await extra("ranges", "j")).head, 38);
  const stopped = await extra("ranges", "j");
  check("j stops before an enter range and asks the app", [stopped.head, stopped.entered], [38, ["44-50:down:1"]]);
  check("k from a row range's next line lands on its start", (await extra("ranges", "k")).head, 22);
  check("k skips backward over a skip range", (await extra("ranges", "kk")).head, 0);
  check("a command hook replaces a command", await extra("command", "l").then((r) => [r.head, r.status]), [0, "overridden"]);
  await page.evaluate(() => (window as unknown as { helixRunIn(a: string, b: string): boolean }).helixRunIn("command", "move_line_down"));
  check("helixRun runs a command", (await extra("command", "")).head, 4);
  check("x on a last line without a newline pastes above as a line", (await extra("final1", "jxyP")).doc, "one\ntwo\ntwo");
  check("x and p on a last line without a newline pastes below as a line", (await extra("final2", "jxyp")).doc, "one\ntwo\ntwo");
  check("p of a line after a last line without a newline adds a line", (await extra("final3", "xyjp")).doc, "one\ntwo\none");
  check("e on a whole last line stays charwise", (await extra("final4", "jeyP")).doc, "one\ntwotwo");

  type UiState = { status: string; numbers: string[]; diagnostics: number; underline: number; diff: number; heading: string | null; headingColor: string | null; spaces: number; guides: number; rulers: number; column: number; wrap: boolean | null; picker: number; pickerRows: number; preview: string | null; popup: string | null; menu: string[]; theme: boolean; message: string | null; doc: string; cursor: number };
  const uiState = () => page.evaluate(() => (window as unknown as { helixUiState(): UiState }).helixUiState());
  const uiKeys = async (keys: string) => {
    await extra("ui", keys);
    await page.waitForTimeout(150);
  };
  await page.click("#ui .cm-content");
  await page.evaluate(() => (window as unknown as { helixFocusUi(): void }).helixFocusUi());
  await page.waitForTimeout(400);
  await uiKeys("gg");
  await page.waitForFunction(() => document.querySelector("#ui .cm-content .hx-s-markup-heading") !== null, undefined, { timeout: 5000 }).catch(() => undefined);
  let ui = await uiState();
  if (!ui.status.includes("NOR") || !ui.status.includes("doc.md") || !ui.status.includes("markdown")) fails.push(`statusline: got ${JSON.stringify(ui.status)}`);
  check("gutter line numbers", ui.numbers.filter((n) => n !== "000").slice(0, 3), ["1", "2", "3"]);
  check("diagnostic gutter and underline", [ui.diagnostics, ui.underline], [1, 1]);
  if (ui.diff !== 1) {
    await page.waitForTimeout(500);
    ui = await uiState();
  }
  check("diff gutter", ui.diff, 1);
  check("markdown heading highlight", ui.heading !== null, true);
  await uiKeys(":set line-number relative<ret>");
  ui = await uiState();
  check("relative line numbers", ui.numbers.filter((n) => n !== "000").slice(0, 3), ["1", "1", "2"]);
  await uiKeys(":set whitespace.render all<ret>");
  check("whitespace is drawn", (await uiState()).spaces > 0, true);
  await uiKeys(":set whitespace.render none<ret>:set indent-guides.render true<ret>");
  check("indent guides are drawn", (await uiState()).guides > 0, true);
  await uiKeys(":set rulers [40]<ret>");
  check("a ruler is drawn", (await uiState()).rulers, 1);
  await uiKeys(":set cursorcolumn true<ret>");
  check("the cursor column is drawn", (await uiState()).column, 1);
  await uiKeys(":set soft-wrap.enable true<ret>");
  await page.waitForTimeout(300);
  check("the wrap indicator sits beside the wrapped text", (await uiState()).wrap, true);
  await uiKeys(":set soft-wrap.enable false<ret>");
  await page.waitForTimeout(100);
  await uiKeys(":theme demo<ret>");
  ui = await uiState();
  check("a theme applies", [ui.theme, ui.headingColor], [true, "rgb(68, 85, 102)"]);
  await extra("ui", "<space>f");
  await page.waitForTimeout(600);
  ui = await uiState();
  check("the file picker opens with its items", [ui.picker, ui.pickerRows], [1, 3]);
  await uiKeys("gam");
  ui = await uiState();
  check("the picker filters with nucleo", ui.pickerRows, 1);
  check("the picker previews", ui.preview?.includes("contents of gamma.txt"), true);
  await uiKeys("<ret>");
  ui = await uiState();
  check("the picker closes and opens the file", [ui.picker, ui.message], [0, "opened gamma.txt"]);
  await extra("ui", "<space>?");
  await page.waitForTimeout(400);
  await uiKeys("move_char_left");
  check("the command palette lists commands", (await uiState()).pickerRows >= 1, true);
  await uiKeys("<esc>");
  await extra("ui", "<space>k");
  await page.waitForTimeout(200);
  check("hover shows a popup", (await uiState()).popup, "hover text");
  await uiKeys("<esc>");
  check("esc closes the popup", (await uiState()).popup, null);
  await uiKeys("ggi");
  await page.keyboard.type("al");
  await page.waitForTimeout(100);
  await extra("ui", "<C-x>");
  await page.waitForTimeout(300);
  check("completion lists the provider's items", (await uiState()).menu, ["alphabet", "alpine"]);
  await uiKeys("<tab>");
  check("completion previews the selected item", (await uiState()).doc.startsWith("alphabet"), true);
  await uiKeys("<ret>");
  ui = await uiState();
  check("completion accepts and closes", [ui.doc.startsWith("alphabet"), ui.menu], [true, []]);
  await uiKeys("<esc>");
  await uiKeys("]g");
  check("]g goes to the next change", (await uiState()).status.includes("6:1"), true);

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
