import type { EditorView } from "@codemirror/view";
import { type TextEdit } from "./commands/goto";
import { type PromptRequest } from "./core/editor";
import { type Severity } from "./diagnostics";
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
export declare function helixEdit(view: EditorView, edits: readonly TextEdit[]): void;
export declare function helixSelect(view: EditorView, ranges: readonly {
    anchor: number;
    head: number;
}[], primary?: number): void;
export declare function helixSnippet(view: EditorView, source: string, options?: {
    removeBefore?: number;
    variables?: Readonly<Record<string, string>>;
}): boolean;
export declare function helixTabstops(view: EditorView): {
    from: number;
    to: number;
    choices: readonly string[] | null;
}[];
export declare function helixMessage(view: EditorView, text: string, severity?: "info" | "error"): void;
export declare function helixPrompt(view: EditorView, request: PromptRequest): void;
export interface HelixHighlight {
    from: number;
    to: number;
    scopes: readonly string[];
}
export declare function helixHighlights(view: EditorView, from: number, to: number, scopes?: readonly string[]): HelixHighlight[];
export declare function helixRainbow(view: EditorView, from: number, to: number, levels?: number): {
    from: number;
    to: number;
    level: number;
}[];
export interface HelixGutterLine {
    line: number;
    number: number;
    selected: boolean;
    diagnostic: Severity | null;
    change: "added" | "removed" | "changed" | null;
}
export declare function helixGutter(view: EditorView, fromLine: number, toLine: number): HelixGutterLine[];
