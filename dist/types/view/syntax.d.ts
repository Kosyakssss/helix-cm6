import { SyntaxSessions } from "../syntax/languages";
import { type WasmSource } from "./wasm";
export declare function loadSyntax(win: Window, source?: WasmSource): Promise<SyntaxSessions>;
