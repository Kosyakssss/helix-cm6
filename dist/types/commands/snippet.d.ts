import type { Context } from "../core/editor";
import { type SnippetContext } from "../snippets";
import type { CommandFn } from "./motion";
export declare function snippetContext(cx: Context, variables?: Readonly<Record<string, string>>): SnippetContext;
export declare function insertSnippet(cx: Context, source: string, options?: {
    removeBefore?: number;
    variables?: Readonly<Record<string, string>>;
}): boolean;
export declare const snippetCommands: Record<string, CommandFn>;
