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

export function commandContext(cx: Context, args: readonly string[] = []): HelixCommandContext {
  return { view: cx.host.view!, args, count: cx.countRaw, register: cx.register };
}

export interface HelixApp {
  command(name: string): AppCommand | AppCommandInfo | null;
  commandNames?(): Iterable<string>;
  openJump?(cx: Context, jump: Jump): void;
  variable?(cx: Context, name: Variable): string | null;
}

export const APP_COMMANDS: Record<string, string | null> = {
  file_picker: null,
  file_picker_in_current_directory: "file_picker",
  file_picker_in_current_buffer_directory: null,
  file_explorer: null,
  file_explorer_in_current_directory: "file_explorer",
  file_explorer_in_current_buffer_directory: null,
  buffer_picker: null,
  jumplist_picker: null,
  last_picker: null,
  symbol_picker: null,
  syntax_symbol_picker: "symbol_picker",
  lsp_or_syntax_symbol_picker: "symbol_picker",
  workspace_symbol_picker: null,
  syntax_workspace_symbol_picker: "workspace_symbol_picker",
  lsp_or_syntax_workspace_symbol_picker: "workspace_symbol_picker",
  command_palette: null,
  code_action: null,
  diagnostics_picker: null,
  workspace_diagnostics_picker: null,
  global_search: null,
  goto_file: null,
  goto_file_hsplit: null,
  goto_file_vsplit: null,
  goto_definition: null,
  goto_declaration: null,
  goto_type_definition: null,
  goto_implementation: null,
  changed_file_picker: null,
  select_references_to_symbol_under_cursor: null,
  signature_help: null,
  format_selections: null,
  transpose_view: null,
  goto_reference: null,
  hover: null,
  rename_symbol: null,
  goto_last_accessed_file: null,
  goto_last_modified_file: null,
  goto_next_buffer: null,
  goto_previous_buffer: null,
  jump_view_left: null,
  jump_view_right: null,
  jump_view_up: null,
  jump_view_down: null,
  swap_view_left: null,
  swap_view_right: null,
  swap_view_up: null,
  swap_view_down: null,
  rotate_view: null,
  rotate_view_reverse: null,
  hsplit: null,
  vsplit: null,
  hsplit_new: null,
  vsplit_new: null,
  wclose: null,
  wonly: null,
  suspend: null,
  dap_launch: null,
  dap_restart: null,
  dap_toggle_breakpoint: null,
  dap_continue: null,
  dap_pause: null,
  dap_step_in: null,
  dap_step_out: null,
  dap_next: null,
  dap_variables: null,
  dap_terminate: null,
  dap_edit_condition: null,
  dap_edit_log: null,
  dap_switch_thread: null,
  dap_switch_stack_frame: null,
  dap_enable_exceptions: null,
  dap_disable_exceptions: null,
  completion: null,
};

export function isAppCommandName(name: string): boolean {
  return name in APP_COMMANDS || name.includes(":");
}

export function appFallback(name: string): string | null {
  return APP_COMMANDS[name] ?? null;
}
