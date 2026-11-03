import type { RustRegexEngine } from "../core/rx";
import { SyntaxSessions } from "../syntax/languages";
import type { LanguageSource } from "../syntax/loader";
import { type WasmSource } from "./wasm";
export interface SyntaxOptions {
    regex?: RustRegexEngine | null;
    languages?: readonly string[];
    source?: LanguageSource | null;
}
export declare function loadSyntax(win: Window, wasm?: WasmSource, options?: SyntaxOptions): Promise<SyntaxSessions>;
