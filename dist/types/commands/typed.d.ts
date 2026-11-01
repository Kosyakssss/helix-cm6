import type { Completion } from "../core/prompt";
import type { Context } from "../core/editor";
export type PromptEvent = "update" | "validate" | "abort";
export interface TypableCommand {
    name: string;
    aliases: string[];
    doc: string;
    flags?: Record<string, string>;
    fun: (cx: Context, args: Args, event: PromptEvent) => void;
}
export interface Args {
    positional: string[];
    flags: Set<string>;
    raw: string;
}
export declare function tokenize(input: string): string[];
export declare const TYPABLE: TypableCommand[];
export declare const TYPABLE_MAP: Map<string, TypableCommand>;
export declare function splitCommandLine(input: string): [string, string];
export declare function executeCommandLine(cx: Context, input: string, event: PromptEvent): void;
export declare function completeCommandLine(input: string, pathCompleter: ((prefix: string) => string[]) | null): Completion[];
