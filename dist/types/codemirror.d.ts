import { Facet, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HelixEditor } from "./core/editor";
import { type HelixApp, type HelixCommand, type HelixCommandSpec } from "./commands/app";
import type { HelixCommandName } from "./commands/names";
import type { Host } from "./core/host";
import type { ShellRunner } from "./commands/shell";
import { type HelixKeys } from "./config-loader";
import type { QueryFile } from "./syntax/loader";
import { type HelixStatus } from "./view/status";
import { type WasmBytes, type WasmSource } from "./view/wasm";
export interface GrammarSource {
    grammar(name: string): WasmBytes | null | Promise<WasmBytes | null>;
    query(language: string, file: QueryFile): string | null | Promise<string | null>;
}
export type HelixCommands = {
    [name in HelixCommandName]?: HelixCommand | HelixCommandSpec;
} & {
    [name: string]: HelixCommand | HelixCommandSpec | undefined;
};
export interface HelixOptions {
    config?: string | Record<string, unknown> | null;
    languages?: string | readonly string[];
    grammars?: GrammarSource;
    regex?: WasmSource;
    syntax?: WasmSource | false;
    shell?: ShellRunner;
    commands?: HelixCommands;
    keys?: HelixKeys | readonly HelixKeys[];
    openJump?: HelixApp["openJump"];
    variable?: HelixApp["variable"];
    panel?: boolean;
}
export interface HelixDocument {
    path?: string | null;
    name?: string | null;
    language?: string | null;
}
export declare function helixStatus(view: EditorView): HelixStatus | null;
export declare function helixRun(view: EditorView, command: string): boolean;
export declare function helixKeys(view: EditorView, keys: string): boolean;
export declare function helixHost(view: EditorView): Host | null;
export declare const helixEditor: Facet<HelixEditor, HelixEditor | null>;
export declare const helixDocument: Facet<HelixDocument, HelixDocument>;
export declare function helix(options?: HelixOptions): Extension;
