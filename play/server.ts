import { resolve } from "node:path";

const root = import.meta.dir;
const port = Number(process.env.PORT ?? 4173);
const NAME = /^[A-Za-z0-9_.-]+$/;
const headers = { "cache-control": "no-store" };

async function bundle(): Promise<Response> {
  const built = await Bun.build({
    entrypoints: [resolve(root, "play.ts")],
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
  if (!built.success) {
    const message = built.logs.map((log) => String(log)).join("\n");
    return new Response(`document.body.textContent = ${JSON.stringify(message)};`, { headers: { "content-type": "text/javascript" } });
  }
  return new Response(await built.outputs[0]!.text(), { headers: { "content-type": "text/javascript", ...headers } });
}

async function serve(path: string, ...parts: string[]): Promise<Response> {
  if (!parts.every((part) => NAME.test(part) && part !== "." && part !== "..")) return new Response("not found", { status: 404 });
  const file = Bun.file(resolve(root, path, ...parts.slice(0, -1), parts[parts.length - 1]!));
  if (!(await file.exists())) return new Response("not found", { status: 404 });
  return new Response(file, { headers });
}

const server = Bun.serve({
  port,
  hostname: "127.0.0.1",
  routes: {
    "/": () => new Response(Bun.file(resolve(root, "index.html")), { headers }),
    "/play.js": bundle,
    "/helix.toml": () => serve(".", "helix.toml"),
    "/samples/:file": (req) => serve("samples", `${req.params.file}.txt`),
    "/grammars/:file": (req) => serve("languages/grammars", req.params.file),
    "/queries/:language/:file": (req) => serve("languages/queries", req.params.language, req.params.file),
  },
  fetch: () => new Response("not found", { status: 404 }),
});

process.stdout.write(`helix-cm6 playground: ${server.url.href}\nOpen a sample with ?file=server.go. It rebuilds from src on every reload.\n`);
