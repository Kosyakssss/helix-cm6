#include <stdlib.h>
#include "tree_sitter/api.h"

#define EXPORT(name) __attribute__((export_name(#name)))

const TSLanguage *tree_sitter_markdown(void);
const TSLanguage *tree_sitter_markdown_inline(void);

static TSParser *parser;

EXPORT(hm_malloc) void *hm_malloc(size_t size) { return malloc(size); }
EXPORT(hm_free) void hm_free(void *ptr) { free(ptr); }

EXPORT(hm_language) const TSLanguage *hm_language(uint32_t which) {
  return which == 0 ? tree_sitter_markdown() : tree_sitter_markdown_inline();
}

EXPORT(hm_symbol_name) const char *hm_symbol_name(const TSLanguage *language, uint32_t symbol) {
  return ts_language_symbol_name(language, (TSSymbol)symbol);
}

EXPORT(hm_parse)
TSTree *hm_parse(const TSLanguage *language, const char *text, uint32_t length, const TSRange *ranges, uint32_t count, const TSTree *old_tree) {
  if (!parser) parser = ts_parser_new();
  if (!ts_parser_set_language(parser, language)) return NULL;
  if (!ts_parser_set_included_ranges(parser, count ? ranges : NULL, count)) return NULL;
  return ts_parser_parse_string(parser, old_tree, text, length);
}

EXPORT(hm_tree_edit) void hm_tree_edit(TSTree *tree, uint32_t start, uint32_t old_end, uint32_t new_end) {
  TSInputEdit edit = {start, old_end, new_end, {0, 0}, {0, 0}, {0, 0}};
  ts_tree_edit(tree, &edit);
}

EXPORT(hm_tree_delete) void hm_tree_delete(TSTree *tree) { ts_tree_delete(tree); }
EXPORT(hm_tree_copy) TSTree *hm_tree_copy(const TSTree *tree) { return ts_tree_copy(tree); }
EXPORT(hm_tree_root) void hm_tree_root(const TSTree *tree, TSNode *out) { *out = ts_tree_root_node(tree); }

EXPORT(hm_node_start) uint32_t hm_node_start(const TSNode *node) { return ts_node_start_byte(*node); }
EXPORT(hm_node_end) uint32_t hm_node_end(const TSNode *node) { return ts_node_end_byte(*node); }
EXPORT(hm_node_symbol) uint32_t hm_node_symbol(const TSNode *node) { return ts_node_symbol(*node); }
EXPORT(hm_node_is_named) uint32_t hm_node_is_named(const TSNode *node) { return ts_node_is_named(*node); }
EXPORT(hm_node_child_count) uint32_t hm_node_child_count(const TSNode *node) { return ts_node_child_count(*node); }
EXPORT(hm_node_child) void hm_node_child(const TSNode *node, uint32_t index, TSNode *out) { *out = ts_node_child(*node, index); }
EXPORT(hm_node_parent) void hm_node_parent(const TSNode *node, TSNode *out) { *out = ts_node_parent(*node); }
EXPORT(hm_node_next_sibling) void hm_node_next_sibling(const TSNode *node, TSNode *out) { *out = ts_node_next_sibling(*node); }
EXPORT(hm_node_prev_sibling) void hm_node_prev_sibling(const TSNode *node, TSNode *out) { *out = ts_node_prev_sibling(*node); }

EXPORT(hm_node_descendant)
void hm_node_descendant(const TSNode *node, uint32_t start, uint32_t end, uint32_t named, TSNode *out) {
  *out = named ? ts_node_named_descendant_for_byte_range(*node, start, end)
               : ts_node_descendant_for_byte_range(*node, start, end);
}

EXPORT(hm_cursor_new) TSTreeCursor *hm_cursor_new(const TSNode *node) {
  TSTreeCursor *cursor = malloc(sizeof(TSTreeCursor));
  *cursor = ts_tree_cursor_new(*node);
  return cursor;
}

EXPORT(hm_cursor_delete) void hm_cursor_delete(TSTreeCursor *cursor) {
  ts_tree_cursor_delete(cursor);
  free(cursor);
}

EXPORT(hm_cursor_field_name) const char *hm_cursor_field_name(const TSTreeCursor *cursor) { return ts_tree_cursor_current_field_name(cursor); }
EXPORT(hm_node_is_missing) uint32_t hm_node_is_missing(const TSNode *node) { return ts_node_is_missing(*node); }
EXPORT(hm_node_symbol_type) uint32_t hm_node_symbol_type(const TSNode *node) { return ts_language_symbol_type(ts_node_language(*node), ts_node_symbol(*node)); }
EXPORT(hm_node_kind) const char *hm_node_kind(const TSNode *node) { return ts_node_type(*node); }
EXPORT(hm_cursor_node) void hm_cursor_node(const TSTreeCursor *cursor, TSNode *out) { *out = ts_tree_cursor_current_node(cursor); }
EXPORT(hm_cursor_parent) uint32_t hm_cursor_parent(TSTreeCursor *cursor) { return ts_tree_cursor_goto_parent(cursor); }
EXPORT(hm_cursor_first_child) uint32_t hm_cursor_first_child(TSTreeCursor *cursor) { return ts_tree_cursor_goto_first_child(cursor); }
EXPORT(hm_cursor_next_sibling) uint32_t hm_cursor_next_sibling(TSTreeCursor *cursor) { return ts_tree_cursor_goto_next_sibling(cursor); }
EXPORT(hm_cursor_prev_sibling) uint32_t hm_cursor_prev_sibling(TSTreeCursor *cursor) { return ts_tree_cursor_goto_previous_sibling(cursor); }

EXPORT(hm_cursor_first_child_for_byte) uint32_t hm_cursor_first_child_for_byte(TSTreeCursor *cursor, uint32_t goal) {
  return ts_tree_cursor_goto_first_child_for_byte(cursor, goal) >= 0;
}

EXPORT(hm_query_new) TSQuery *hm_query_new(const TSLanguage *language, const char *source, uint32_t length, uint32_t *error) {
  return ts_query_new(language, source, length, &error[0], (TSQueryError *)&error[1]);
}

EXPORT(hm_query_delete) void hm_query_delete(TSQuery *query) { ts_query_delete(query); }
EXPORT(hm_query_capture_count) uint32_t hm_query_capture_count(const TSQuery *query) { return ts_query_capture_count(query); }
EXPORT(hm_query_pattern_count) uint32_t hm_query_pattern_count(const TSQuery *query) { return ts_query_pattern_count(query); }
EXPORT(hm_query_string_count) uint32_t hm_query_string_count(const TSQuery *query) { return ts_query_string_count(query); }
EXPORT(hm_query_start_byte) uint32_t hm_query_start_byte(const TSQuery *query, uint32_t pattern) { return ts_query_start_byte_for_pattern(query, pattern); }
EXPORT(hm_query_disable_capture) void hm_query_disable_capture(TSQuery *query, const char *name, uint32_t length) { ts_query_disable_capture(query, name, length); }

EXPORT(hm_query_capture_name) const char *hm_query_capture_name(const TSQuery *query, uint32_t index, uint32_t *length) {
  return ts_query_capture_name_for_id(query, index, length);
}

EXPORT(hm_query_string) const char *hm_query_string(const TSQuery *query, uint32_t index, uint32_t *length) {
  return ts_query_string_value_for_id(query, index, length);
}

EXPORT(hm_query_predicates) const TSQueryPredicateStep *hm_query_predicates(const TSQuery *query, uint32_t pattern, uint32_t *length) {
  return ts_query_predicates_for_pattern(query, pattern, length);
}

EXPORT(hm_qc_new) TSQueryCursor *hm_qc_new(void) { return ts_query_cursor_new(); }
EXPORT(hm_qc_delete) void hm_qc_delete(TSQueryCursor *cursor) { ts_query_cursor_delete(cursor); }

EXPORT(hm_qc_exec)
void hm_qc_exec(TSQueryCursor *cursor, const TSQuery *query, const TSNode *node, uint32_t start, uint32_t end, uint32_t limit) {
  ts_query_cursor_set_byte_range(cursor, start, end);
  ts_query_cursor_set_match_limit(cursor, limit);
  ts_query_cursor_exec(cursor, query, *node);
}

static void write_match(const TSQueryMatch *match, uint32_t *out) {
  out[0] = match->id;
  out[1] = match->pattern_index;
  out[2] = match->capture_count;
  out[3] = (uint32_t)(uintptr_t)match->captures;
}

EXPORT(hm_qc_next_match) uint32_t hm_qc_next_match(TSQueryCursor *cursor, uint32_t *out) {
  TSQueryMatch match;
  if (!ts_query_cursor_next_match(cursor, &match)) return 0;
  write_match(&match, out);
  return 1;
}

EXPORT(hm_qc_next_capture) uint32_t hm_qc_next_capture(TSQueryCursor *cursor, uint32_t *out) {
  TSQueryMatch match;
  uint32_t index;
  if (!ts_query_cursor_next_capture(cursor, &match, &index)) return 0;
  write_match(&match, out);
  out[4] = index;
  return 1;
}

EXPORT(hm_qc_remove_match) void hm_qc_remove_match(TSQueryCursor *cursor, uint32_t id) { ts_query_cursor_remove_match(cursor, id); }
EXPORT(hm_qc_exceeded) uint32_t hm_qc_exceeded(const TSQueryCursor *cursor) { return ts_query_cursor_did_exceed_match_limit(cursor); }
