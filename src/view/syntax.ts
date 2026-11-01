import { createLoader, SyntaxSessions } from "../syntax/languages";
import { unpack, wasmBytes, type WasmSource } from "./wasm";

export async function loadSyntax(win: Window, source?: WasmSource): Promise<SyntaxSessions> {
  const bytes = source === undefined ? await unpack((await import("../../tree-sitter/tree-sitter.wasm")).default) : await wasmBytes(source);
  return new SyntaxSessions(await createLoader(bytes), (work) => {
    if (typeof win.requestIdleCallback === "function") win.requestIdleCallback(work, { timeout: 2000 });
    else win.setTimeout(work, 0);
  });
}
