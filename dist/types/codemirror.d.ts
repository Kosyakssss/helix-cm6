import { Facet, type Extension } from "@codemirror/state";
import { HelixEditor } from "./core/editor";
import { type WasmSource } from "./view/wasm";
export interface HelixOptions {
    config?: string;
    regex?: WasmSource;
    syntax?: WasmSource | false;
}
export declare const helixEditor: Facet<HelixEditor, HelixEditor | null>;
export declare function helix(options?: HelixOptions): Extension;
