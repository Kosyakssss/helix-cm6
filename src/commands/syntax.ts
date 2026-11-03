import type { Context } from "../core/editor";
import { Range, type Direction, type Selection } from "../selection";
import {
  expandSelection,
  moveParentNodeEnd,
  selectAllChildren,
  selectAllSiblings,
  selectNextSibling,
  selectPrevSibling,
  shrinkSelection,
} from "../syntax/object";
import type { Syntax } from "../syntax/syntax";
import { gotoTreesitterObject } from "../syntax/textobject";
import { applyMotion, type CommandFn } from "./motion";
import { pushJump } from "./jumps";
import { docOf, modeOf, selOf, setSel, syntaxOf } from "./util";

function contains(superSet: Selection, subSet: Selection): boolean {
  const supers = superSet.ranges;
  const subs = subSet.ranges;
  let i = 0;
  let j = 0;
  for (;;) {
    const a = supers[i];
    const b = subs[j];
    if (!b) return true;
    if (!a) return false;
    if (a.to() <= b.from() && a.from() !== b.from()) {
      i++;
    } else if (a.from() <= b.from() && b.to() <= a.to()) {
      j++;
    } else {
      return false;
    }
  }
}

function expand(cx: Context): void {
  applyMotion(cx, (cx) => {
    const syntax = syntaxOf(cx);
    if (!syntax) return;
    const current = selOf(cx);
    const next = expandSelection(syntax, current);
    if (!current.eq(next)) {
      cx.editor.objectSelections(cx.host).push(current);
      setSel(cx, next);
    }
  });
}

function shrink(cx: Context): void {
  applyMotion(cx, (cx) => {
    const stack = cx.editor.objectSelections(cx.host);
    const current = selOf(cx);
    const prev = stack.pop();
    if (prev) {
      if (contains(current, prev)) {
        setSel(cx, prev);
        return;
      }
      stack.length = 0;
    }
    const syntax = syntaxOf(cx);
    if (syntax) setSel(cx, shrinkSelection(syntax, current));
  });
}

function selectWith(f: (syntax: Syntax, selection: Selection) => Selection): CommandFn {
  return (cx) =>
    applyMotion(cx, (cx) => {
      const syntax = syntaxOf(cx);
      if (syntax) setSel(cx, f(syntax, selOf(cx)));
    });
}

function moveNodeBound(dir: Direction, movement: "move" | "extend"): CommandFn {
  return (cx) =>
    applyMotion(cx, (cx) => {
      const syntax = syntaxOf(cx);
      if (syntax) setSel(cx, moveParentNodeEnd(syntax, docOf(cx), selOf(cx), dir, movement));
    });
}

function gotoTsObject(object: string, dir: Direction): CommandFn {
  return (cx) => {
    const count = cx.count();
    applyMotion(cx, (cx) => {
      const syntax = syntaxOf(cx);
      if (!syntax) {
        cx.editor.setStatus("Syntax-tree is not available in current buffer");
        return;
      }
      const doc = docOf(cx);
      const isSelect = modeOf(cx) === "select";
      const selection = selOf(cx).transform((range) => {
        const next = gotoTreesitterObject(syntax, doc, range, object, dir, count);
        if (!isSelect) return next.withDirection(dir);
        return new Range(range.anchor, next.head < range.anchor ? next.anchor : next.head);
      });
      pushJump(cx);
      setSel(cx, selection);
    });
  };
}

export const syntaxCommands: Record<string, CommandFn> = {
  expand_selection: expand,
  shrink_selection: shrink,
  select_next_sibling: selectWith(selectNextSibling),
  select_prev_sibling: selectWith(selectPrevSibling),
  select_all_siblings: selectWith(selectAllSiblings),
  select_all_children: selectWith(selectAllChildren),
  move_parent_node_end: moveNodeBound("forward", "move"),
  move_parent_node_start: moveNodeBound("backward", "move"),
  extend_parent_node_end: moveNodeBound("forward", "extend"),
  extend_parent_node_start: moveNodeBound("backward", "extend"),
  goto_next_function: gotoTsObject("function", "forward"),
  goto_prev_function: gotoTsObject("function", "backward"),
  goto_next_class: gotoTsObject("class", "forward"),
  goto_prev_class: gotoTsObject("class", "backward"),
  goto_next_parameter: gotoTsObject("parameter", "forward"),
  goto_prev_parameter: gotoTsObject("parameter", "backward"),
  goto_next_comment: gotoTsObject("comment", "forward"),
  goto_prev_comment: gotoTsObject("comment", "backward"),
  goto_next_test: gotoTsObject("test", "forward"),
  goto_prev_test: gotoTsObject("test", "backward"),
  goto_next_xml_element: gotoTsObject("xml-element", "forward"),
  goto_prev_xml_element: gotoTsObject("xml-element", "backward"),
  goto_next_entry: gotoTsObject("entry", "forward"),
  goto_prev_entry: gotoTsObject("entry", "backward"),
};
