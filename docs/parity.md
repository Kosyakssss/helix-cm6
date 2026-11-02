# Parity with Helix

Helix commit `ba40e547`, the oracle's pin. This list is the backlog of `docs/roadmap.md`. Update it with each change.

States:

- **ported**: in the engine, from Helix's source.
- **app**: the engine hands the command to the app's `Workspace`. A plain `helix()` editor says it is not available.
- **partial**: ported, with the gap named in the row.
- **missing**: not in the engine yet.
- **out of scope**: see `docs/roadmap.md`.

## Open bugs

- An IME composition in normal or select mode, or in a prompt, is cancelled, so composed text (for example Japanese in a search) cannot be typed there. Text input without a composition, such as the emoji picker or dictation, works.

## Helix bugs the port keeps

- An expansion that gives an empty string at the start of a quoted or raw argument leaves the argument unexpanded: with register `a` empty, `:set-register b %reg{a}x` stores `%reg{a}x`, not `x` (`expand_inner` in `helix-view/src/expansion.rs`). Not filed upstream yet.

## Commands

Static: ported 206, app 51, partial 24, out of scope 17, missing 15. Typed: app 39, ported 30, missing 20, out of scope 11.

### Static commands

| Command | State |
| --- | --- |
| `add_newline_above` | ported |
| `add_newline_below` | ported |
| `align_selections` | ported |
| `align_view_bottom` | ported |
| `align_view_center` | ported |
| `align_view_middle` | ported |
| `align_view_top` | ported |
| `append_char_interactive` | ported |
| `append_mode` | ported |
| `buffer_picker` | app |
| `change_selection` | ported |
| `change_selection_noyank` | ported |
| `changed_file_picker` | missing |
| `code_action` | app |
| `collapse_selection` | ported |
| `command_mode` | ported |
| `command_palette` | app |
| `commit_undo_checkpoint` | ported |
| `completion` | missing |
| `copy_between_registers` | ported |
| `copy_selection_on_next_line` | ported |
| `copy_selection_on_prev_line` | ported |
| `dap_continue` | out of scope |
| `dap_disable_exceptions` | out of scope |
| `dap_edit_condition` | out of scope |
| `dap_edit_log` | out of scope |
| `dap_enable_exceptions` | out of scope |
| `dap_launch` | out of scope |
| `dap_next` | out of scope |
| `dap_pause` | out of scope |
| `dap_restart` | out of scope |
| `dap_step_in` | out of scope |
| `dap_step_out` | out of scope |
| `dap_switch_stack_frame` | out of scope |
| `dap_switch_thread` | out of scope |
| `dap_terminate` | out of scope |
| `dap_toggle_breakpoint` | out of scope |
| `dap_variables` | out of scope |
| `decrement` | ported |
| `delete_char_backward` | ported |
| `delete_char_forward` | ported |
| `delete_selection` | ported |
| `delete_selection_noyank` | ported |
| `delete_word_backward` | ported |
| `delete_word_forward` | ported |
| `diagnostics_picker` | app |
| `earlier` | ported |
| `ensure_selections_forward` | ported |
| `exit_select_mode` | ported |
| `expand_selection` | partial: markdown only |
| `extend_char_left` | ported |
| `extend_char_right` | ported |
| `extend_line` | ported |
| `extend_line_above` | ported |
| `extend_line_below` | ported |
| `extend_line_down` | ported |
| `extend_line_up` | ported |
| `extend_next_char` | ported |
| `extend_next_long_word_end` | ported |
| `extend_next_long_word_start` | ported |
| `extend_next_sub_word_end` | ported |
| `extend_next_sub_word_start` | ported |
| `extend_next_word_end` | ported |
| `extend_next_word_start` | ported |
| `extend_parent_node_end` | partial: markdown only |
| `extend_parent_node_start` | partial: markdown only |
| `extend_prev_char` | ported |
| `extend_prev_long_word_end` | ported |
| `extend_prev_long_word_start` | ported |
| `extend_prev_sub_word_end` | ported |
| `extend_prev_sub_word_start` | ported |
| `extend_prev_word_end` | ported |
| `extend_prev_word_start` | ported |
| `extend_search_next` | ported |
| `extend_search_prev` | ported |
| `extend_till_char` | ported |
| `extend_till_prev_char` | ported |
| `extend_to_column` | ported |
| `extend_to_file_end` | ported |
| `extend_to_file_start` | ported |
| `extend_to_first_nonwhitespace` | ported |
| `extend_to_last_line` | ported |
| `extend_to_line_bounds` | ported |
| `extend_to_line_end` | ported |
| `extend_to_line_end_newline` | ported |
| `extend_to_line_start` | ported |
| `extend_to_word` | ported |
| `extend_visual_line_down` | ported |
| `extend_visual_line_up` | ported |
| `file_explorer` | app |
| `file_explorer_in_current_buffer_directory` | app |
| `file_explorer_in_current_directory` | app |
| `file_picker` | app |
| `file_picker_in_current_buffer_directory` | app |
| `file_picker_in_current_directory` | app |
| `find_next_char` | ported |
| `find_prev_char` | ported |
| `find_till_char` | ported |
| `flip_selections` | ported |
| `format_selections` | missing |
| `global_search` | app |
| `goto_column` | ported |
| `goto_declaration` | missing |
| `goto_definition` | app |
| `goto_file` | app |
| `goto_file_end` | ported |
| `goto_file_hsplit` | app |
| `goto_file_start` | ported |
| `goto_file_vsplit` | app |
| `goto_first_change` | missing |
| `goto_first_diag` | app |
| `goto_first_nonwhitespace` | ported |
| `goto_implementation` | missing |
| `goto_last_accessed_file` | app |
| `goto_last_change` | missing |
| `goto_last_diag` | app |
| `goto_last_line` | ported |
| `goto_last_modification` | ported |
| `goto_last_modified_file` | app |
| `goto_line` | ported |
| `goto_line_end` | ported |
| `goto_line_end_newline` | ported |
| `goto_line_start` | ported |
| `goto_next_buffer` | app |
| `goto_next_change` | missing |
| `goto_next_class` | partial: markdown only |
| `goto_next_comment` | partial: markdown only |
| `goto_next_diag` | app |
| `goto_next_entry` | partial: markdown only |
| `goto_next_function` | partial: markdown only |
| `goto_next_paragraph` | ported |
| `goto_next_parameter` | partial: markdown only |
| `goto_next_tabstop` | missing |
| `goto_next_test` | partial: markdown only |
| `goto_next_xml_element` | partial: markdown only |
| `goto_prev_change` | missing |
| `goto_prev_class` | partial: markdown only |
| `goto_prev_comment` | partial: markdown only |
| `goto_prev_diag` | app |
| `goto_prev_entry` | partial: markdown only |
| `goto_prev_function` | partial: markdown only |
| `goto_prev_paragraph` | ported |
| `goto_prev_parameter` | partial: markdown only |
| `goto_prev_tabstop` | missing |
| `goto_prev_test` | partial: markdown only |
| `goto_prev_xml_element` | partial: markdown only |
| `goto_previous_buffer` | app |
| `goto_reference` | app |
| `goto_type_definition` | missing |
| `goto_window_bottom` | ported |
| `goto_window_center` | ported |
| `goto_window_top` | ported |
| `goto_word` | ported |
| `half_page_down` | ported |
| `half_page_up` | ported |
| `hover` | app |
| `hsplit` | app |
| `hsplit_new` | app |
| `increment` | ported |
| `indent` | ported |
| `insert_at_line_end` | ported |
| `insert_at_line_start` | ported |
| `insert_char_interactive` | ported |
| `insert_mode` | ported |
| `insert_newline` | ported |
| `insert_register` | ported |
| `insert_tab` | ported |
| `join_selections` | ported |
| `join_selections_space` | ported |
| `jump_backward` | ported |
| `jump_forward` | ported |
| `jump_view_down` | app |
| `jump_view_left` | app |
| `jump_view_right` | app |
| `jump_view_up` | app |
| `jumplist_picker` | app |
| `keep_primary_selection` | ported |
| `keep_selections` | ported |
| `kill_to_line_end` | ported |
| `kill_to_line_start` | ported |
| `last_picker` | app |
| `later` | ported |
| `lsp_or_syntax_symbol_picker` | app |
| `lsp_or_syntax_workspace_symbol_picker` | app |
| `make_search_word_bounded` | ported |
| `match_brackets` | ported |
| `merge_consecutive_selections` | ported |
| `merge_selections` | ported |
| `move_char_left` | ported |
| `move_char_right` | ported |
| `move_line_down` | ported |
| `move_line_up` | ported |
| `move_next_long_word_end` | ported |
| `move_next_long_word_start` | ported |
| `move_next_sub_word_end` | ported |
| `move_next_sub_word_start` | ported |
| `move_next_word_end` | ported |
| `move_next_word_start` | ported |
| `move_parent_node_end` | partial: markdown only |
| `move_parent_node_start` | partial: markdown only |
| `move_prev_long_word_end` | ported |
| `move_prev_long_word_start` | ported |
| `move_prev_sub_word_end` | ported |
| `move_prev_sub_word_start` | ported |
| `move_prev_word_end` | ported |
| `move_prev_word_start` | ported |
| `move_visual_line_down` | ported |
| `move_visual_line_up` | ported |
| `no_op` | ported |
| `normal_mode` | ported |
| `open_above` | ported |
| `open_below` | ported |
| `page_cursor_down` | ported |
| `page_cursor_half_down` | ported |
| `page_cursor_half_up` | ported |
| `page_cursor_up` | ported |
| `page_down` | ported |
| `page_up` | ported |
| `paste_after` | ported |
| `paste_before` | ported |
| `paste_clipboard_after` | ported |
| `paste_clipboard_before` | ported |
| `paste_primary_clipboard_after` | ported |
| `paste_primary_clipboard_before` | ported |
| `record_macro` | ported |
| `redo` | ported |
| `remove_primary_selection` | ported |
| `remove_selections` | ported |
| `rename_symbol` | app |
| `repeat_last_motion` | ported |
| `replace` | ported |
| `replace_selections_with_clipboard` | ported |
| `replace_selections_with_primary_clipboard` | ported |
| `replace_with_yanked` | ported |
| `replay_macro` | ported |
| `reverse_selection_contents` | ported |
| `rotate_selection_contents_backward` | ported |
| `rotate_selection_contents_forward` | ported |
| `rotate_selections_backward` | ported |
| `rotate_selections_first` | ported |
| `rotate_selections_forward` | ported |
| `rotate_selections_last` | ported |
| `rotate_view` | app |
| `rotate_view_reverse` | app |
| `rsearch` | ported |
| `save_selection` | ported |
| `scroll_down` | ported |
| `scroll_up` | ported |
| `search` | ported |
| `search_next` | ported |
| `search_prev` | ported |
| `search_selection` | ported |
| `search_selection_detect_word_boundaries` | ported |
| `select_all` | ported |
| `select_all_children` | partial: markdown only |
| `select_all_siblings` | partial: markdown only |
| `select_line_above` | ported |
| `select_line_below` | ported |
| `select_mode` | ported |
| `select_next_sibling` | partial: markdown only |
| `select_prev_sibling` | partial: markdown only |
| `select_references_to_symbol_under_cursor` | missing |
| `select_regex` | ported |
| `select_register` | ported |
| `select_textobject_around` | ported |
| `select_textobject_inner` | ported |
| `shell_append_output` | ported |
| `shell_insert_output` | ported |
| `shell_keep_pipe` | ported |
| `shell_pipe` | ported |
| `shell_pipe_to` | ported |
| `shrink_selection` | partial: markdown only |
| `shrink_to_line_bounds` | ported |
| `signature_help` | missing |
| `smart_tab` | ported |
| `split_selection` | ported |
| `split_selection_on_newline` | ported |
| `surround_add` | ported |
| `surround_delete` | ported |
| `surround_replace` | ported |
| `suspend` | out of scope |
| `swap_view_down` | app |
| `swap_view_left` | app |
| `swap_view_right` | app |
| `swap_view_up` | app |
| `switch_case` | ported |
| `switch_to_lowercase` | ported |
| `switch_to_uppercase` | ported |
| `symbol_picker` | app |
| `syntax_symbol_picker` | app |
| `syntax_workspace_symbol_picker` | app |
| `till_prev_char` | ported |
| `toggle_block_comments` | ported |
| `toggle_comments` | ported |
| `toggle_line_comments` | ported |
| `transpose_view` | missing |
| `trim_selections` | ported |
| `undo` | ported |
| `unindent` | ported |
| `vsplit` | app |
| `vsplit_new` | app |
| `wclose` | app |
| `wonly` | app |
| `workspace_diagnostics_picker` | app |
| `workspace_symbol_picker` | app |
| `yank` | ported |
| `yank_joined` | ported |
| `yank_joined_to_clipboard` | ported |
| `yank_joined_to_primary_clipboard` | ported |
| `yank_main_selection_to_clipboard` | ported |
| `yank_main_selection_to_primary_clipboard` | ported |
| `yank_to_clipboard` | ported |
| `yank_to_primary_clipboard` | ported |

### Typed commands

| Command | State |
| --- | --- |
| `:exit` | app |
| `:exit!` | app |
| `:quit` | app |
| `:quit!` | app |
| `:open` | app |
| `:buffer-close` | app |
| `:buffer-close!` | app |
| `:buffer-close-others` | app |
| `:buffer-close-others!` | app |
| `:buffer-close-all` | app |
| `:buffer-close-all!` | app |
| `:buffer-next` | app |
| `:buffer-previous` | app |
| `:write` | app |
| `:write!` | app |
| `:write-buffer-close` | app |
| `:write-buffer-close!` | app |
| `:new` | app |
| `:format` | missing |
| `:indent-style` | ported |
| `:line-ending` | missing |
| `:earlier` | ported |
| `:later` | ported |
| `:write-quit` | app |
| `:write-quit!` | app |
| `:write-all` | app |
| `:write-all!` | app |
| `:write-quit-all` | app |
| `:write-quit-all!` | app |
| `:quit-all` | app |
| `:quit-all!` | app |
| `:cquit` | missing |
| `:cquit!` | missing |
| `:theme` | missing |
| `:yank-join` | ported |
| `:clipboard-yank` | ported |
| `:clipboard-yank-join` | ported |
| `:primary-clipboard-yank` | ported |
| `:primary-clipboard-yank-join` | ported |
| `:clipboard-paste-after` | ported |
| `:clipboard-paste-before` | ported |
| `:clipboard-paste-replace` | ported |
| `:primary-clipboard-paste-after` | ported |
| `:primary-clipboard-paste-before` | ported |
| `:primary-clipboard-paste-replace` | ported |
| `:show-clipboard-provider` | out of scope |
| `:change-current-directory` | missing |
| `:show-directory-stack` | missing |
| `:push-directory` | missing |
| `:pop-directory` | missing |
| `:show-directory` | missing |
| `:encoding` | out of scope |
| `:character-info` | ported |
| `:reload` | app |
| `:reload-all` | app |
| `:update` | app |
| `:lsp-workspace-command` | missing |
| `:lsp-restart` | out of scope |
| `:lsp-stop` | out of scope |
| `:tree-sitter-scopes` | missing |
| `:tree-sitter-highlight-name` | missing |
| `:tree-sitter-layers` | missing |
| `:debug-start` | out of scope |
| `:debug-remote` | out of scope |
| `:debug-eval` | out of scope |
| `:vsplit` | app |
| `:vsplit-new` | app |
| `:hsplit` | app |
| `:hsplit-new` | app |
| `:tutor` | app |
| `:goto` | ported |
| `:set-language` | missing |
| `:set-option` | ported |
| `:toggle-option` | ported |
| `:get-option` | ported |
| `:sort` | ported |
| `:reflow` | ported |
| `:tree-sitter-subtree` | missing |
| `:config-reload` | app |
| `:config-open` | app |
| `:config-open-workspace` | missing |
| `:log-open` | out of scope |
| `:insert-output` | ported |
| `:append-output` | ported |
| `:pipe` | ported |
| `:pipe-to` | ported |
| `:run-shell-command` | missing |
| `:reset-diff-change` | missing |
| `:clear-register` | ported |
| `:set-register` | ported |
| `:redraw` | ported |
| `:move` | app |
| `:move!` | app |
| `:yank-diagnostic` | missing |
| `:read` | app |
| `:echo` | ported |
| `:noop` | ported |
| `:workspace-trust` | out of scope |
| `:workspace-untrust` | out of scope |
| `:workspace-exclude` | out of scope |

## Options (`[editor]`)

| Option | State |
| --- | --- |
| `scrolloff` | ported |
| `scroll-lines` | ported |
| `mouse` | missing |
| `mouse-yank-register` | ported |
| `shell` | ported: passed to the app's runner, `helix({ shell })` |
| `line-number` | partial: parsed, relative numbers not drawn |
| `cursorline` | ported |
| `cursorcolumn` | missing |
| `gutters` | partial: parsed, not drawn |
| `middle-click-paste` | missing |
| `auto-pairs` | ported |
| `auto-completion` | missing: completion |
| `path-completion` | partial: prompt only |
| `word-completion` | missing: completion |
| `auto-format` | missing: formatter |
| `default-yank-register` | ported |
| `auto-save` | app |
| `text-width` | ported |
| `idle-timeout` | missing |
| `completion-timeout` | missing |
| `preview-completion-insert` | missing |
| `completion-trigger-len` | missing |
| `completion-replace` | missing |
| `continue-comments` | ported |
| `auto-info` | ported |
| `file-picker` | missing: picker |
| `file-explorer` | missing: picker |
| `statusline` | partial: parsed, not drawn |
| `cursor-shape` | ported |
| `true-color` | out of scope |
| `undercurl` | out of scope |
| `search` | ported |
| `lsp` | missing: LSP API |
| `terminal` | missing, and it warns as an unknown key |
| `rulers` | missing |
| `whitespace` | missing: not drawn |
| `bufferline` | missing |
| `indent-guides` | partial: parsed, not drawn |
| `color-modes` | ported |
| `soft-wrap` | missing |
| `workspace-lsp-roots` | out of scope |
| `default-line-ending` | missing |
| `insert-final-newline` | ported |
| `atomic-save` | out of scope |
| `trim-final-newlines` | ported |
| `trim-trailing-whitespace` | ported |
| `smart-tab` | ported |
| `popup-border` | missing: popups |
| `indent-heuristic` | missing: indent queries |
| `jump-label-alphabet` | ported |
| `inline-diagnostics` | missing |
| `end-of-line-diagnostics` | missing |
| `clipboard-provider` | out of scope |
| `editor-config` | missing |
| `rainbow-brackets` | missing: highlighting |
| `kitty-keyboard-protocol` | out of scope |
| `buffer-picker` | missing: picker |
| `workspace-trust` | out of scope |

## Statusline elements

All 24 elements are parsed. The engine draws none; helix-motions draws them in Obsidian's status bar.

`mode`, `spinner`, `file-base-name`, `file-name`, `file-absolute-path`, `file-modification-indicator`, `read-only-indicator`, `file-encoding`, `file-line-ending`, `file-indent-style`, `file-type`, `diagnostics`, `workspace-diagnostics`, `selections`, `primary-selection-length`, `position`, `separator`, `position-percentage`, `total-line-numbers`, `spacer`, `version-control`, `register`, `current-working-directory`, `code-action-hint`

## Gutters

`diagnostics`, `line-numbers`, `spacer`, `diff` and `code-action-hint` are parsed and not drawn.

## UI components

From Helix's `helix-term/src/ui`.

| Component | State |
| --- | --- |
| prompt with history, completion and registers | ported |
| infobox (`auto-info`) | ported |
| jump labels | ported |
| cursors, selections, cursorline, color modes | ported, with the bugs above |
| statusline | missing |
| gutters | missing |
| syntax highlighting, themes | missing |
| picker with preview | missing |
| completion menu | missing |
| popup, hover, signature help | missing |
| inline decorations (inlay hints, diagnostics) | missing |
| bufferline | missing |
| whitespace, indent guides, rulers, soft-wrap indicators | missing |

## Languages

Only the markdown grammar loads, and every document parses as markdown. Tree-sitter commands and textobjects work only on markdown. Indent, comment tokens and auto-pairs are global. Helix's `languages.toml` has no equivalent yet.
