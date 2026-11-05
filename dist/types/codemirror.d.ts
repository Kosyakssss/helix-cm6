import { Facet, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { HelixEditor } from "./core/editor";
import { type HelixCommand, type HelixCommandSpec } from "./commands/app";
import type { Jump } from "./commands/jumps";
import type { Variable } from "./commands/expansion";
import type { Host } from "./core/host";
import type { ShellRunner } from "./commands/shell";
import { type HelixKeys } from "./config-loader";
import type { HelixCommandName } from "./commands/names";
import type { QueryFile } from "./syntax/loader";
import { type HelixStatus } from "./view/status";
import { type WasmBytes, type WasmSource } from "./view/wasm";
export interface HelixGrammars {
    grammar(name: string): WasmBytes | null | Promise<WasmBytes | null>;
    query(language: string, file: QueryFile): string | null | Promise<string | null>;
}
export type HelixCommands = {
    [name in HelixCommandName]?: HelixCommand | HelixCommandSpec;
} & {
    [name: string]: HelixCommand | HelixCommandSpec | undefined;
};
export interface HelixRange {
    anchor: number;
    head: number;
    from: number;
    to: number;
    cursor: number;
}
export interface HelixSelection {
    ranges: readonly HelixRange[];
    primary: HelixRange;
    primaryIndex: number;
}
export interface HelixJump extends HelixSelection {
    path: string;
}
export interface HelixConfiguration {
    config?: string | Record<string, unknown> | null;
    commands?: HelixCommands;
    keys?: HelixKeys | readonly HelixKeys[];
}
export interface HelixOptions extends HelixConfiguration {
    languages?: string | readonly string[];
    grammars?: string | HelixGrammars;
    regex?: WasmSource;
    syntax?: WasmSource | false;
    shell?: ShellRunner;
    completePath?: (prefix: string) => readonly string[];
    openJump?: (jump: HelixJump, view: EditorView) => unknown;
    variable?: (name: Variable, view: EditorView) => string | null;
    onStatus?: (status: HelixStatus, view: EditorView) => void;
    panel?: boolean;
}
export interface HelixDocument {
    path?: string | null;
    name?: string | null;
    language?: string | null;
}
export declare function helixHost(view: EditorView): Host | null;
export declare const helixEditor: Facet<HelixEditor, HelixEditor | null>;
export interface HelixInstance {
    configure(changes: HelixConfiguration): readonly string[];
    warnings(): readonly string[];
}
export declare const helixInstance: Facet<HelixInstance, HelixInstance | null>;
export declare const syntaxLoaded: import("@codemirror/state").AnnotationType<boolean>;
export declare const helixDocument: Facet<HelixDocument, HelixDocument>;
export declare function selectionInfo(selection: Jump["selection"], doc: EditorView["state"]["doc"]): HelixSelection;
export declare function helix(options?: HelixOptions): Extension;
