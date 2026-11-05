import type { EditorView } from "@codemirror/view";
import type { HelixCommandContext } from "./commands/app";
import type { HelixRunnable } from "./commands/names";
import { type HelixSelection } from "./codemirror";
import { type Changes } from "./changes";
import { type Diagnostic, type Severity } from "./diagnostics";
import { type HelixStatus } from "./view/status";
export declare function helixEnabled(view: EditorView): boolean;
export declare function helixRun(view: EditorView, command: HelixRunnable): boolean;
export declare function helixType(view: EditorView, keys: string): void;
export interface HelixTextEdit {
    from: number;
    to?: number;
    insert?: string;
}
export declare function helixEdit(view: EditorView, edits: HelixTextEdit | readonly HelixTextEdit[]): void;
export type HelixSelectTarget = number | {
    anchor: number;
    head: number;
};
export interface HelixSelectOptions {
    primaryIndex?: number;
    jump?: boolean;
}
export declare function helixSelect(view: EditorView, target: HelixSelectTarget | readonly HelixSelectTarget[], options?: HelixSelectOptions): void;
export declare function helixSelection(view: EditorView): HelixSelection;
export declare function helixSnippet(view: EditorView, source: string, options?: {
    removeBefore?: number;
    variables?: Readonly<Record<string, string>>;
}): boolean;
export interface HelixTabstop {
    from: number;
    to: number;
    choices: readonly string[] | null;
}
export declare function helixTabstops(view: EditorView): HelixTabstop[];
export declare function helixMessage(view: EditorView, text: string | null, severity?: "info" | "error"): void;
export interface HelixPromptRequest {
    label: string;
    initial?: string;
    history?: string;
    complete?: (input: string) => readonly string[];
    onChange?: (input: string) => void;
}
export declare function helixPrompt(view: EditorView, request: HelixPromptRequest): Promise<string | null>;
export declare function helixMarkSaved(view: EditorView): void;
export declare function helixStatus(view: EditorView): HelixStatus;
export declare function helixRegister(view: EditorView, name: string): readonly string[];
export declare function helixSetRegister(view: EditorView, name: string, values: readonly string[]): void;
export declare function helixDiagnostics(view: EditorView): readonly Diagnostic[];
export declare function helixSetDiagnostics(view: EditorView, diagnostics: readonly Diagnostic[]): void;
export declare function helixChanges(view: EditorView): Changes;
export declare function helixSetChanges(view: EditorView, changes: Changes): void;
export interface HelixCommandInfo {
    name: string;
    doc: string;
    app: boolean;
}
export interface HelixTypedCommandInfo {
    name: string;
    aliases: readonly string[];
    doc: string;
    app: string | null;
}
export declare function helixCommandList(): HelixCommandInfo[];
export declare function helixTypedCommandList(): HelixTypedCommandInfo[];
export interface HelixHighlight {
    from: number;
    to: number;
    scopes: readonly string[];
}
export declare function helixHighlights(view: EditorView, from: number, to: number, scopes?: readonly string[]): HelixHighlight[];
export interface HelixRainbowSpan {
    from: number;
    to: number;
    level: number;
}
export declare function helixRainbow(view: EditorView, from: number, to: number, levels?: number): HelixRainbowSpan[];
export interface HelixGutterLine {
    line: number;
    number: number;
    selected: boolean;
    diagnostic: Severity | null;
    change: "added" | "removed" | "changed" | null;
}
export declare function helixGutter(view: EditorView, fromLine: number, toLine: number): HelixGutterLine[];
export type { HelixCommandContext };
