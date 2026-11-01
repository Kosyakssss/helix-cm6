import packedTreeSitter from "../../tree-sitter/tree-sitter.wasm";
import { createLoader, SyntaxSessions } from "../syntax/languages";
import { unpack } from "./wasm";

export async function loadSyntax(win: Window): Promise<SyntaxSessions> {
  return new SyntaxSessions(await createLoader(await unpack(packedTreeSitter)), (work) => {
    if (typeof win.requestIdleCallback === "function") win.requestIdleCallback(work, { timeout: 2000 });
    else win.setTimeout(work, 0);
  });
}
