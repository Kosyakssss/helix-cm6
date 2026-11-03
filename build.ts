import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

const root = import.meta.dir;
const out = resolve(root, "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const file of ["regex/regex.wasm", "tree-sitter/tree-sitter.wasm"]) {
  const packed = Buffer.from(Bun.deflateSync(await Bun.file(resolve(root, file)).bytes(), { level: 9 })).toString("base64");
  writeFileSync(resolve(out, `${basename(file, ".wasm")}-wasm.js`), `export default ${JSON.stringify(packed)};\n`);
  writeFileSync(resolve(out, `${basename(file, ".wasm")}-wasm.d.ts`), "declare const packed: string;\nexport default packed;\n");
}

const result = await Bun.build({
  entrypoints: [resolve(root, "src/index.ts"), resolve(root, "src/engine.ts"), resolve(root, "src/languages.ts")],
  outdir: out,
  format: "esm",
  target: "browser",
  splitting: true,
  naming: { entry: "[name].js", chunk: "chunk-[hash].js" },
  external: ["@codemirror/state", "@codemirror/view", "@codemirror/commands", "smol-toml"],
  minify: false,
  plugins: [
    {
      name: "wasm",
      setup(build) {
        build.onResolve({ filter: /\.wasm$/ }, (args) => ({ path: `./${basename(args.path, ".wasm")}-wasm.js`, external: true }));
      },
    },
  ],
});
if (!result.success) {
  for (const log of result.logs) process.stderr.write(`${log.message}\n`);
  process.exit(1);
}
const types = Bun.spawnSync(["bun", "x", "tsc", "-p", "tsconfig.build.json"], { cwd: root, stdout: "inherit", stderr: "inherit" });
if (types.exitCode !== 0) process.exit(1);
writeFileSync(resolve(out, "types/languages.d.ts"), "export declare const languagesToml: string;\n");
process.stdout.write("built dist\n");
