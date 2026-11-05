import type { RustRegexEngine } from "../core/rx";
import { createLoader, SyntaxSessions } from "../syntax/languages";
import type { LanguageSource } from "../syntax/loader";
import { unpack, wasmBytes, type WasmSource } from "./wasm";

export interface SyntaxOptions {
  regex?: RustRegexEngine | null;
  languages?: readonly string[];
  source?: LanguageSource | null;
}

export async function loadSyntax(win: Window, wasm?: WasmSource, options: SyntaxOptions = {}): Promise<SyntaxSessions> {
  const bytes = wasm === undefined ? await unpack((await import("../../tree-sitter/tree-sitter.wasm")).default) : await wasmBytes(wasm);
  return new SyntaxSessions(await createLoader(bytes, options), (work) => {
    win.setTimeout(() => {
      if (typeof win.requestIdleCallback === "function") win.requestIdleCallback(work, { timeout: 2000 });
      else work();
    }, 100);
  });
}
