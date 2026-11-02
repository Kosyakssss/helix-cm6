import { resolve } from "node:path";

const root = import.meta.dir;
const port = Number(process.env.PORT ?? 4173);

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
  return new Response(await built.outputs[0]!.text(), { headers: { "content-type": "text/javascript", "cache-control": "no-store" } });
}

const server = Bun.serve({
  port,
  hostname: "127.0.0.1",
  routes: {
    "/": () => new Response(Bun.file(resolve(root, "index.html")), { headers: { "cache-control": "no-store" } }),
    "/play.js": bundle,
  },
  fetch: () => new Response("not found", { status: 404 }),
});

process.stdout.write(`helix-cm6 playground: ${server.url.href}\nIt rebuilds from src on every reload.\n`);
