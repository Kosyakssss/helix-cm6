import type { Completion } from "../core/prompt";
import type { Context } from "../core/editor";
import { Args, type Signature } from "./command-line";
export type PromptEvent = "update" | "validate" | "abort";
export interface TypableCommand {
    name: string;
    aliases: string[];
    doc: string;
    signature: Signature;
    fun: (cx: Context, args: Args, event: PromptEvent) => void;
}
export declare const TYPABLE: TypableCommand[];
export declare const TYPABLE_MAP: Map<string, TypableCommand>;
export declare function splitCommandLine(input: string): [string, string];
export declare function executeCommand(cx: Context, cmd: TypableCommand, input: string, event: PromptEvent): void;
export declare function executeCommandLine(cx: Context, input: string, event: PromptEvent): void;
export interface CommandLineCompleters {
    path: ((prefix: string) => string[]) | null;
    languages: () => string[];
}
export declare function completeCommandLine(input: string, completers: CommandLineCompleters): Completion[];
