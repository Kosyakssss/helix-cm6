import { spawn } from "bun";
import { readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import type { ServerWebSocket } from "bun";

const root = resolve(import.meta.dir, "sample");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    if (name === "target" || name.startsWith(".")) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [relative(root, path)];
  });

const safe = (path: string) => {
  const full = resolve(root, path);
  if (!full.startsWith(`${root}/`)) throw new Error("outside the project");
  return full;
};

export async function route(path: string, request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (path === "root") return Response.json({ root });
  if (path === "files") return Response.json({ files: walk(root) });
  if (path === "read") {
    const file = Bun.file(safe(url.searchParams.get("path") ?? ""));
    return Response.json({ text: (await file.exists()) ? await file.text() : "" });
  }
  if (path === "write") {
    const body = (await request.json()) as { path: string; text: string };
    await Bun.write(safe(body.path), body.text);
    return Response.json({});
  }
  if (path === "shell") {
    const body = (await request.json()) as { command: string; input: string | null };
    const process = spawn(["sh", "-c", body.command], { cwd: root, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    if (body.input !== null) process.stdin.write(body.input);
    await process.stdin.end();
    const [stdout, stderr, code] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);
    return Response.json({ code, stdout, stderr });
  }
  return new Response("not found", { status: 404 });
}

type Server = ReturnType<typeof spawn<"pipe", "pipe", "ignore">>;
const servers = new WeakMap<ServerWebSocket<unknown>, Server>();

async function pump(process: Server, socket: ServerWebSocket<unknown>) {
  let buffer = new Uint8Array(0);
  for await (const chunk of process.stdout) {
    const merged = new Uint8Array(buffer.length + chunk.length);
    merged.set(buffer);
    merged.set(chunk, buffer.length);
    buffer = merged;
    for (;;) {
      const text = new TextDecoder().decode(buffer.slice(0, 64));
      const header = /^Content-Length: (\d+)\r\n(?:.*\r\n)*?\r\n/.exec(text);
      if (!header) break;
      const start = header[0].length;
      const end = start + Number(header[1]);
      if (buffer.length < end) break;
      socket.send(new TextDecoder().decode(buffer.slice(start, end)));
      buffer = buffer.slice(end);
    }
  }
}

export const websocket = {
  open(socket: ServerWebSocket<unknown>) {
    const process = spawn(["rust-analyzer"], { cwd: root, stdin: "pipe", stdout: "pipe", stderr: "ignore" });
    servers.set(socket, process);
    void pump(process, socket).catch(() => socket.close());
  },
  message(socket: ServerWebSocket<unknown>, message: string | Buffer) {
    const body = new TextEncoder().encode(String(message));
    const stdin = servers.get(socket)!.stdin;
    try {
      void stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
      void stdin.write(body);
      void stdin.flush();
    } catch {
      socket.close();
    }
  },
  close(socket: ServerWebSocket<unknown>) {
    servers.get(socket)?.kill();
  },
};
