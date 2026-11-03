import { resolve } from "node:path";

const root = import.meta.dir;
const port = Number(process.env.PORT ?? 4173);
const token = crypto.randomUUID();
const allowedOrigin = `http://127.0.0.1:${port}`;

async function shell(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  if (req.method !== "POST" || origin !== allowedOrigin || req.headers.get("authorization") !== `Bearer ${token}`) return new Response("forbidden", { status: 403 });
  const { command, input, shell: argv } = (await req.json()) as { command: string; input: string | null; shell: string[] };
  const proc = Bun.spawn([...argv, command], { stdin: input === null ? "ignore" : Buffer.from(input), stdout: "pipe", stderr: "pipe", cwd: root });
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return Response.json({ code, stdout, stderr });
}

async function allThemes(): Promise<Response> {
  const dir = resolve(root, "languages", "themes");
  const out: Record<string, string> = {};
  const glob = new Bun.Glob("*.toml");
  try {
    for await (const file of glob.scan(dir)) out[file.slice(0, -5)] = await Bun.file(resolve(dir, file)).text();
  } catch {
    return Response.json({});
  }
  return Response.json(out, { headers: { "cache-control": "no-store" } });
}

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
  return new Response(`const HELIX_PLAY_TOKEN = ${JSON.stringify(token)};\n${await built.outputs[0]!.text()}`, { headers: { "content-type": "text/javascript", "cache-control": "no-store" } });
}

const languages = resolve(root, "languages");
const NAME = /^[A-Za-z0-9_.-]+$/;

async function languageFile(dir: string, ...parts: string[]): Promise<Response> {
  if (!parts.every((part) => NAME.test(part) && part !== "." && part !== "..")) return new Response("not found", { status: 404 });
  const file = Bun.file(resolve(languages, dir, ...parts));
  if (!(await file.exists())) return new Response("not found", { status: 404 });
  return new Response(file, { headers: { "cache-control": "no-store" } });
}

const server = Bun.serve({
  port,
  hostname: "127.0.0.1",
  routes: {
    "/": () => new Response(Bun.file(resolve(root, "index.html")), { headers: { "cache-control": "no-store" } }),
    "/play.js": bundle,
    "/shell": shell,
    "/themes": allThemes,
    "/grammars/:file": (req) => languageFile("grammars", req.params.file),
    "/queries/:language/:file": (req) => languageFile("queries", req.params.language, req.params.file),
  },
  fetch: () => new Response("not found", { status: 404 }),
});

process.stdout.write(`helix-cm6 playground: ${server.url.href}\nIt rebuilds from src on every reload.\n`);
