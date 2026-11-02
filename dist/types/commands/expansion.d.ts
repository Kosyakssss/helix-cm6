import type { Context } from "../core/editor";
import { type Token } from "./command-line";
export type Variable = "cursor_line" | "cursor_column" | "buffer_name" | "file_path_absolute" | "line_ending" | "workspace_directory" | "current_working_directory" | "language" | "selection" | "selection_line_start" | "selection_line_end";
type Expanded = string | Promise<string>;
export declare function expand(cx: Context, token: Token): Expanded;
export {};
