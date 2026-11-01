import type { Context } from "../core/editor";
import { type UndoKind } from "../history";
import type { CommandFn } from "./motion";
export declare function undo(cx: Context): void;
export declare function redo(cx: Context): void;
export declare function earlier(cx: Context, uk: UndoKind): boolean;
export declare function later(cx: Context, uk: UndoKind): boolean;
export declare const miscCommands: Record<string, CommandFn>;
export declare const UNSUPPORTED: string[];
