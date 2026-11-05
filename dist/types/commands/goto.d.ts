import type { Context } from "../core/editor";
import type { CommandFn } from "./motion";
export interface TextEdit {
    from: number;
    to: number;
    insert: string;
}
export declare function applyTextEdits(cx: Context, edits: readonly TextEdit[]): void;
export declare const gotoCommands: Record<string, CommandFn>;
