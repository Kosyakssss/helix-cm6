import type { Context } from "../core/editor";
import type { MappableCommand } from "../keymap/trie";
import { type CommandFn } from "./motion";
export declare const STATIC_COMMANDS: Record<string, CommandFn>;
export declare function isKnownCommand(name: string): boolean;
export declare function executeCommand(cx: Context, command: MappableCommand, arg?: string): void;
export declare function runTypable(cx: Context, input: string): void;
