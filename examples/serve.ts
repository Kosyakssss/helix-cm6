import { resolve } from "node:path";
import { route, websocket } from "./code/backend";

const name = process.argv[2] ?? "minimal";
const port = Number(process.env.PORT ?? 4174);
const here = import.meta.dir;
const languages = resolve(here, "../play/languages");

async function bundle(): Promise<Response> {
  const built = await Bun.build({
    entrypoints: [resolve(here, name, "app.ts")],
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
  if (!built.success) return new Response(`document.body.textContent = ${JSON.stringify(built.logs.map(String).join("\n"))};`, { headers: { "content-type": "text/javascript" } });
  return new Response(await built.outputs[0]!.text(), { headers: { "content-type": "text/javascript" } });
}

const server = Bun.serve({
  port,
  hostname: "127.0.0.1",
  async fetch(request, server) {
    const { pathname } = new URL(request.url);
    if (pathname === "/lsp" && server.upgrade(request, { data: undefined })) return undefined;
    if (pathname === "/app.js") return bundle();
    if (pathname.startsWith("/api/")) return route(pathname.slice(5), request);
    if (pathname.startsWith("/languages/") && !pathname.includes("..")) {
      const file = Bun.file(resolve(languages, pathname.slice(11)));
      return (await file.exists()) ? new Response(file) : new Response("not found", { status: 404 });
    }
    const page = Bun.file(resolve(here, name, "index.html"));
    return new Response((await page.exists()) ? page : '<!doctype html><meta charset="utf-8" /><style>:root { color-scheme: light dark; } html, body, .cm-editor { height: 100%; margin: 0; }</style><script type="module" src="/app.js"></script>', { headers: { "content-type": "text/html" } });
  },
  websocket,
});

process.stdout.write(`${name}: ${server.url.href}\n`);
