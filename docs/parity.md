# Parity with Helix

Helix commit `ba40e547`, the oracle's pin. This list is the backlog of `docs/roadmap.md`. Update it with each change.

States:

- **ported**: in the engine, from Helix's source.
- **app**: the app supplies it as a command. Without one, the key is left out and the command says it is not available.
- **data**: the core reads the option and gives the data. The app draws it.
- **partial**: ported, with the gap named in the row.
- **missing**: not in the engine yet.
- **out of scope**: see `docs/roadmap.md`.

## Partial

- `:line-ending crlf` says so instead of changing the document: CodeMirror keeps line feeds, and the app writes the ending it wants.

## Open bugs

None.

## Helix bugs the port fixes

- An expansion that gives an empty string at the start of a quoted or raw argument leaves the argument unexpanded in Helix: with register `a` empty, `:set-register b %reg{a}x` stores `%reg{a}x`, not `x` (`expand_inner` in `helix-view/src/expansion.rs`). The port stores `x`.

## Commands

Static: ported 231, app 63, out of scope 17, missing 2. Typed: app 49, ported 40, out of scope 11.

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
| `changed_file_picker` | app |
| `code_action` | app |
| `collapse_selection` | ported |
| `command_mode` | ported |
| `command_palette` | app |
| `commit_undo_checkpoint` | ported |
| `completion` | app |
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
| `expand_selection` | ported |
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
| `extend_parent_node_end` | ported |
| `extend_parent_node_start` | ported |
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
| `format_selections` | app |
| `global_search` | app |
| `goto_column` | ported |
| `goto_declaration` | app |
| `goto_definition` | app |
| `goto_file` | app |
| `goto_file_end` | ported |
| `goto_file_hsplit` | app |
| `goto_file_start` | ported |
| `goto_file_vsplit` | app |
| `goto_first_change` | app |
| `goto_first_diag` | app |
| `goto_first_nonwhitespace` | ported |
| `goto_implementation` | app |
| `goto_last_accessed_file` | app |
| `goto_last_change` | app |
| `goto_last_diag` | app |
| `goto_last_line` | ported |
| `goto_last_modification` | ported |
| `goto_last_modified_file` | app |
| `goto_line` | ported |
| `goto_line_end` | ported |
| `goto_line_end_newline` | ported |
| `goto_line_start` | ported |
| `goto_next_buffer` | app |
| `goto_next_change` | app |
| `goto_next_class` | ported |
| `goto_next_comment` | ported |
| `goto_next_diag` | app |
| `goto_next_entry` | ported |
| `goto_next_function` | ported |
| `goto_next_paragraph` | ported |
| `goto_next_parameter` | ported |
| `goto_next_tabstop` | ported |
| `goto_next_test` | ported |
| `goto_next_xml_element` | ported |
| `goto_prev_change` | app |
| `goto_prev_class` | ported |
| `goto_prev_comment` | ported |
| `goto_prev_diag` | app |
| `goto_prev_entry` | ported |
| `goto_prev_function` | ported |
| `goto_prev_paragraph` | ported |
| `goto_prev_parameter` | ported |
| `goto_prev_tabstop` | ported |
| `goto_prev_test` | ported |
| `goto_prev_xml_element` | ported |
| `goto_previous_buffer` | app |
| `goto_reference` | app |
| `goto_type_definition` | app |
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
| `move_parent_node_end` | ported |
| `move_parent_node_start` | ported |
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
| `select_all_children` | ported |
| `select_all_siblings` | ported |
| `select_line_above` | ported |
| `select_line_below` | ported |
| `select_mode` | ported |
| `select_next_sibling` | ported |
| `select_prev_sibling` | ported |
| `select_references_to_symbol_under_cursor` | app |
| `select_regex` | ported |
| `select_register` | ported |
| `select_textobject_around` | ported |
| `select_textobject_inner` | ported |
| `shell_append_output` | ported |
| `shell_insert_output` | ported |
| `shell_keep_pipe` | ported |
| `shell_pipe` | ported |
| `shell_pipe_to` | ported |
| `shrink_selection` | ported |
| `shrink_to_line_bounds` | ported |
| `signature_help` | app |
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
| `transpose_view` | app |
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
| `:format` | app |
| `:indent-style` | ported |
| `:line-ending` | ported |
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
| `:cquit` | app |
| `:cquit!` | app |
| `:theme` | app |
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
| `:change-current-directory` | app |
| `:show-directory-stack` | app |
| `:push-directory` | app |
| `:pop-directory` | app |
| `:show-directory` | app |
| `:encoding` | out of scope |
| `:character-info` | ported |
| `:reload` | app |
| `:reload-all` | app |
| `:update` | app |
| `:lsp-workspace-command` | app |
| `:lsp-restart` | out of scope |
| `:lsp-stop` | out of scope |
| `:tree-sitter-scopes` | ported |
| `:tree-sitter-highlight-name` | ported |
| `:tree-sitter-layers` | ported |
| `:debug-start` | out of scope |
| `:debug-remote` | out of scope |
| `:debug-eval` | out of scope |
| `:vsplit` | app |
| `:vsplit-new` | app |
| `:hsplit` | app |
| `:hsplit-new` | app |
| `:tutor` | app |
| `:goto` | ported |
| `:set-language` | ported |
| `:set-option` | ported |
| `:toggle-option` | ported |
| `:get-option` | ported |
| `:sort` | ported |
| `:reflow` | ported |
| `:tree-sitter-subtree` | ported |
| `:config-reload` | app |
| `:config-open` | app |
| `:config-open-workspace` | app |
| `:log-open` | out of scope |
| `:insert-output` | ported |
| `:append-output` | ported |
| `:pipe` | ported |
| `:pipe-to` | ported |
| `:run-shell-command` | ported |
| `:reset-diff-change` | ported |
| `:clear-register` | ported |
| `:set-register` | ported |
| `:redraw` | ported |
| `:move` | app |
| `:move!` | app |
| `:yank-diagnostic` | ported |
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
| `mouse` | ported |
| `mouse-yank-register` | ported |
| `shell` | ported |
| `line-number` | data |
| `cursorline` | ported |
| `cursorcolumn` | data |
| `gutters` | data |
| `middle-click-paste` | ported |
| `auto-pairs` | ported |
| `auto-completion` | data |
| `path-completion` | data |
| `word-completion` | data |
| `auto-format` | app |
| `default-yank-register` | ported |
| `auto-save` | app |
| `text-width` | ported |
| `idle-timeout` | ported |
| `completion-timeout` | data |
| `preview-completion-insert` | data |
| `completion-trigger-len` | data |
| `completion-replace` | data |
| `continue-comments` | ported |
| `auto-info` | ported |
| `file-picker` | app |
| `file-explorer` | app |
| `statusline` | data |
| `cursor-shape` | ported |
| `true-color` | out of scope |
| `undercurl` | out of scope |
| `search` | ported |
| `lsp` | app |
| `terminal` | out of scope |
| `rulers` | data |
| `whitespace` | data |
| `bufferline` | data |
| `indent-guides` | data |
| `color-modes` | ported |
| `soft-wrap` | data |
| `workspace-lsp-roots` | out of scope |
| `default-line-ending` | ported |
| `insert-final-newline` | ported |
| `atomic-save` | out of scope |
| `trim-final-newlines` | ported |
| `trim-trailing-whitespace` | ported |
| `smart-tab` | ported |
| `popup-border` | data |
| `indent-heuristic` | ported |
| `jump-label-alphabet` | ported |
| `inline-diagnostics` | data |
| `end-of-line-diagnostics` | data |
| `clipboard-provider` | out of scope |
| `editor-config` | app |
| `rainbow-brackets` | data |
| `kitty-keyboard-protocol` | out of scope |
| `buffer-picker` | data |
| `workspace-trust` | out of scope |

## Statusline elements

Not drawn. `helixStatus` gives the data. See `docs/api.md`.

## Gutters

Not drawn. `helixGutter` gives line numbers, diagnostics and changes. See `docs/api.md`.

## UI components

The core draws these:

| Component | State |
| --- | --- |
| prompt with history, completion and registers | ported |
| infobox (`auto-info`) | ported, also as data |
| jump labels | ported |
| cursors, selections, cursorline, color modes | ported |

Everything else in Helix's `helix-term/src/ui` belongs to the app: picker, completion menu, popups, statusline, gutters, bufferline, themes, whitespace, indent guides, rulers, soft-wrap indicators, inlay hints, diagnostics drawing and the diff gutter. Syntax highlighting is ported and checked against Helix, and given as data by `helixHighlights`.

## Languages

The registry is Helix's `languages.toml` (`helix-cm6/languages`), merged with the app's files as Helix merges a user's file. A document's language comes from its path and shebang, or from `:set-language`. Injections, textobjects, the `]f`-style motions, the syntax tree commands, comment tokens, auto-pairs, indent queries, highlights, locals, rainbows and tags follow the language at the cursor, as in Helix. The indent style is detected from the text when a document opens or changes language, else taken from the language; the tab width comes from the language. Markdown is built in; other grammars are wasm modules that `bun run grammars` builds from the revisions in `languages.toml`, with Helix's queries.
