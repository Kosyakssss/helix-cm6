import type { Context } from "../core/editor";
import { ActiveSnippet, firstSelection, renderSnippet, Snippet, type SnippetContext } from "../snippets";
import { insertChar } from "./insert";
import type { CommandFn } from "./motion";
import { apply, changeSetOf, docOf, modeOf, selOf, setSel } from "./util";

export function snippetContext(cx: Context, variables: Readonly<Record<string, string>> = {}): SnippetContext {
  const { style, tabWidth } = cx.editor.indent(cx.host);
  return { variable: (name) => variables[name] ?? null, tabWidth, indentStyle: style };
}

export function insertSnippet(cx: Context, source: string, options: { removeBefore?: number; variables?: Readonly<Record<string, string>> } = {}): boolean {
  const snippet = Snippet.parse(source);
  if (!snippet) {
    cx.editor.setError("could not parse the snippet");
    return false;
  }
  const doc = docOf(cx);
  const sel = selOf(cx);
  const remove = options.removeBefore ?? 0;
  const { changes, rendered, primary } = renderSnippet(
    snippet,
    doc,
    sel,
    (range) => {
      const cursor = range.cursor(doc);
      return [Math.max(cursor - remove, 0), cursor];
    },
    snippetContext(cx, options.variables),
  );
  const backward = sel.primary().anchor > sel.primary().head;
  apply(cx, changeSetOf(doc, changes), firstSelection(rendered, backward, primary));
  const active = cx.editor.snippets.get(cx.host.id);
  const next = active ? active.insertSubsnippet(rendered) : ActiveSnippet.create(rendered);
  if (next) cx.editor.snippets.set(cx.host.id, next);
  else cx.editor.snippets.delete(cx.host.id);
  return true;
}

function gotoTabstop(cx: Context, forward: boolean): void {
  const snippet = cx.editor.snippets.get(cx.host.id);
  if (!snippet) {
    cx.editor.setError("no snippet is currently active");
    return;
  }
  cx.editor.snippets.delete(cx.host.id);
  const selection = selOf(cx);
  const [target, last] = forward ? snippet.next(selection) : [snippet.previous(selection), false];
  if (!target) return;
  setSel(cx, target);
  if (!last) cx.editor.snippets.set(cx.host.id, snippet);
  if (modeOf(cx) === "insert") {
    cx.onNextKey((inner, key) => {
      const ch = inner.editor.keyChar(key);
      if (ch === null) return;
      const active = inner.editor.snippets.get(inner.host.id);
      if (active) apply(inner, changeSetOf(docOf(inner), active.deletePlaceholder()));
      insertChar(inner, ch);
    }, "fallback");
  }
}

export const snippetCommands: Record<string, CommandFn> = {
  goto_next_tabstop: (cx) => gotoTabstop(cx, true),
  goto_prev_tabstop: (cx) => gotoTabstop(cx, false),
};
