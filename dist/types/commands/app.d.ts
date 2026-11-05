import type { EditorView } from "@codemirror/view";
import type { Context } from "../core/editor";
import type { Jump } from "./jumps";
import type { Variable } from "./expansion";
export type AppCommand = (cx: Context, args: readonly string[]) => unknown;
export interface AppCommandInfo {
    run: AppCommand;
    doc?: string;
    complete?: (input: string) => readonly string[];
}
export interface HelixCommandContext {
    readonly view: EditorView;
    readonly args: readonly string[];
    readonly count: number | null;
    readonly register: string | null;
}
export type HelixCommand = (cx: HelixCommandContext) => unknown;
export interface HelixCommandSpec {
    run: HelixCommand;
    doc?: string;
    complete?: (input: string) => readonly string[];
}
export declare function commandContext(cx: Context, args?: readonly string[]): HelixCommandContext;
export interface HelixApp {
    command(name: string): AppCommand | AppCommandInfo | null;
    commandNames?(): Iterable<string>;
    openJump?(cx: Context, jump: Jump): void;
    variable?(cx: Context, name: Variable): string | null;
}
export declare const APP_COMMANDS: Record<string, string | null>;
export declare function isAppCommandName(name: string): boolean;
export declare function appFallback(name: string): string | null;
