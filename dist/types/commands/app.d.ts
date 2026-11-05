import type { Context } from "../core/editor";
import type { Jump } from "./jumps";
import type { Variable } from "./expansion";
export type AppCommand = (cx: Context, args: readonly string[]) => void | false | Promise<void>;
export interface AppCommandInfo {
    run: AppCommand;
    doc?: string;
}
export interface HelixApp {
    command(name: string): AppCommand | AppCommandInfo | null;
    commandNames?(): Iterable<string>;
    openJump?(cx: Context, jump: Jump): void;
    variable?(cx: Context, name: Variable): string | null;
}
export declare const APP_COMMANDS: Record<string, string | null>;
export declare function isAppCommandName(name: string): boolean;
export declare function appFallback(name: string): string | null;
