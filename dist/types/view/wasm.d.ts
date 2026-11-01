import { RustRegexEngine } from "../core/rx";
export type WasmBytes = Uint8Array | ArrayBuffer | Response;
export type WasmSource = WasmBytes | (() => WasmBytes | Promise<WasmBytes>);
export declare function unpack(data: string): Promise<Uint8Array>;
export declare function wasmBytes(source: WasmSource): Promise<Uint8Array>;
export declare function loadRegex(source?: WasmSource): Promise<RustRegexEngine>;
