import { Context } from "../core/editor";
import type { CommandFn } from "./motion";
export interface ShellOutput {
    code: number | null;
    stdout: string;
    stderr: string;
}
export type ShellRunner = (command: string, input: string | null, shell: readonly string[]) => ShellOutput | Promise<ShellOutput>;
export type ShellBehavior = "replace" | "ignore" | "insert" | "append";
export declare function shell(cx: Context, command: string, behavior: ShellBehavior): void | Promise<void>;
export declare function shellKeepPipe(cx: Context, command: string): void | Promise<void>;
export declare const shellCommands: Record<string, CommandFn>;
