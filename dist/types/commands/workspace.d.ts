import type { Context } from "../core/editor";
import { type PickerAction } from "../ui/picker";
export interface WorkspaceBuffer {
    id: string;
    path: string | null;
    name: string;
    modified: boolean;
}
export interface FileTarget {
    from?: number;
    to?: number;
    line?: number;
    column?: number;
}
export interface SearchMatch {
    path: string;
    line: number;
    text: string;
    from?: number;
    to?: number;
}
export interface Location extends FileTarget {
    path?: string | null;
    label?: string;
}
export interface TextEdit {
    from: number;
    to: number;
    insert: string;
}
export interface CodeAction {
    title: string;
    kind?: string;
    run(cx: Context): void | Promise<void>;
}
export interface SymbolInfo extends Location {
    name: string;
    kind: string;
    detail?: string;
}
export interface SignatureHelp {
    signatures: {
        label: string;
        documentation?: string;
        activeParameter?: string;
    }[];
    active?: number;
}
export interface CompletionItem {
    label: string;
    detail?: string;
    documentation?: string;
    filterText?: string;
    insertText?: string;
    from?: number;
    to?: number;
    edits?: readonly TextEdit[];
}
export type LocationKind = "definition" | "declaration" | "typeDefinition" | "implementation" | "references";
export interface LanguageFeatures {
    locations?(cx: Context, kind: LocationKind): Promise<readonly Location[]>;
    hover?(cx: Context): Promise<string | null>;
    signatureHelp?(cx: Context): Promise<SignatureHelp | null>;
    completions?(cx: Context, pos: number): Promise<readonly CompletionItem[]>;
    codeActions?(cx: Context): Promise<readonly CodeAction[]>;
    symbols?(cx: Context): Promise<readonly SymbolInfo[]>;
    workspaceSymbols?(cx: Context, query: string): Promise<readonly SymbolInfo[]>;
    rename?(cx: Context, name: string): Promise<readonly TextEdit[] | void>;
    format?(cx: Context): Promise<readonly TextEdit[] | void>;
    highlights?(cx: Context): Promise<readonly {
        from: number;
        to: number;
    }[]>;
}
export interface WorkspaceProviders {
    buffers?(cx: Context): readonly WorkspaceBuffer[];
    openBuffer?(cx: Context, id: string, action: PickerAction): void;
    files?(cx: Context, root: string | null): readonly string[] | Promise<readonly string[]> | AsyncIterable<readonly string[]>;
    openFile?(cx: Context, path: string, target: FileTarget | null, action: PickerAction): void;
    readFile?(path: string): string | null | Promise<string | null>;
    search?(cx: Context, pattern: string, root: string | null): AsyncIterable<readonly SearchMatch[]> | Promise<readonly SearchMatch[]>;
    changedFiles?(cx: Context): readonly {
        path: string;
        status: string;
    }[] | Promise<readonly {
        path: string;
        status: string;
    }[]>;
    language?: LanguageFeatures;
}
type Available = (cx: Context) => boolean;
interface Builtin {
    available: Available;
    run(cx: Context, args: string[]): void | Promise<void>;
}
export declare function applyTextEdits(cx: Context, edits: readonly TextEdit[]): void;
export declare const WORKSPACE_BUILTINS: Record<string, Builtin>;
export {};
