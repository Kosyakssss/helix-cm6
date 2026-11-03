import { Matcher } from "../core/matcher";
import { RustRegexEngine } from "../core/rx";

export type WasmBytes = Uint8Array | ArrayBuffer | Response;
export type WasmSource = WasmBytes | (() => WasmBytes | Promise<WasmBytes>);

const base64 = Uint8Array as unknown as { fromBase64?(data: string): ReturnType<typeof Uint8Array.from> };

export async function unpack(data: string): Promise<Uint8Array> {
  const bytes = base64.fromBase64 ? base64.fromBase64(data) : Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function wasmBytes(source: WasmSource): Promise<Uint8Array> {
  const value = typeof source === "function" ? await source() : source;
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (!value.ok) throw new Error(`cannot load ${value.url}: ${value.status}`);
  return new Uint8Array(await value.arrayBuffer());
}

export async function loadRegex(source?: WasmSource): Promise<RustRegexEngine> {
  const bytes = source === undefined ? await unpack((await import("../../regex/regex.wasm")).default) : await wasmBytes(source);
  return RustRegexEngine.load(bytes);
}

export async function loadMatcher(source?: WasmSource): Promise<Matcher> {
  const bytes = source === undefined ? await unpack((await import("../../matcher/matcher.wasm")).default) : await wasmBytes(source);
  return Matcher.load(bytes);
}
