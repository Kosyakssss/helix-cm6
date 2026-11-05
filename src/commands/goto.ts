import type { Context } from "../core/editor";
import { changesOf } from "../changes";
import { diagnosticsOf, type Diagnostic } from "../diagnostics";
import { Range, Selection } from "../selection";
import type { CommandFn } from "./motion";
import { commitHistoryNow, pushJump } from "./jumps";
import { apply, changeSetOf, docOf, selOf, setSel } from "./util";

export interface TextEdit {
  from: number;
  to: number;
  insert: string;
}

function gotoDiagnostic(cx: Context, find: (list: readonly Diagnostic[], cursor: number) => Diagnostic | undefined, reversed = false): void {
  const list = diagnosticsOf(cx.host.state);
  const doc = docOf(cx);
  const diag = find(list, selOf(cx).primary().cursor(doc));
  if (!diag) return;
  pushJump(cx);
  setSel(cx, reversed ? Selection.single(diag.to, diag.from) : Selection.single(diag.from, diag.to));
}

function gotoChange(cx: Context, which: "next" | "prev" | "first" | "last"): void {
  const hunks = changesOf(cx.host.state).hunks;
  if (!hunks || hunks.length === 0) return;
  const doc = docOf(cx);
  const count = cx.count();
  const moved = selOf(cx).transform((range) => {
    let line = doc.lineAt(range.cursor(doc)).number - 1;
    let target = range;
    for (let i = 0; i < count; i++) {
      let index: number;
      if (which === "first") index = 0;
      else if (which === "last") index = hunks.length - 1;
      else if (which === "next") {
        index = hunks.findIndex((h) => h.afterStart > line);
      } else {
        index = -1;
        for (let k = hunks.length - 1; k >= 0; k--) {
          if (hunks[k]!.afterEnd <= line || (hunks[k]!.afterStart === hunks[k]!.afterEnd && hunks[k]!.afterEnd <= line)) {
            index = k;
            break;
          }
        }
      }
      const hunk = hunks[index];
      if (!hunk) break;
      const startLine = Math.min(hunk.afterStart + 1, doc.lines);
      const start = doc.line(startLine).from;
      const end = hunk.afterEnd >= doc.lines ? doc.length : doc.line(hunk.afterEnd + 1).from;
      line = hunk.afterStart;
      target = hunk.afterStart === hunk.afterEnd ? new Range(start, start) : new Range(start, end);
    }
    return target;
  });
  pushJump(cx);
  setSel(cx, moved);
}

export function applyTextEdits(cx: Context, edits: readonly TextEdit[]): void {
  const doc = docOf(cx);
  if (edits.length === 0) return;
  const sorted = [...edits].sort((a, b) => a.from - b.from);
  commitHistoryNow(cx.host);
  apply(cx, changeSetOf(doc, sorted.map((e) => [e.from, e.to, e.insert])));
  commitHistoryNow(cx.host);
}

export const gotoCommands: Record<string, CommandFn> = {
  goto_first_diag: (cx) => gotoDiagnostic(cx, (list) => list[0]),
  goto_last_diag: (cx) => gotoDiagnostic(cx, (list) => list[list.length - 1]),
  goto_next_diag: (cx) => gotoDiagnostic(cx, (list, cursor) => list.find((d) => d.from > cursor)),
  goto_prev_diag: (cx) => gotoDiagnostic(cx, (list, cursor) => [...list].reverse().find((d) => d.from < cursor), true),
  goto_next_change: (cx) => gotoChange(cx, "next"),
  goto_prev_change: (cx) => gotoChange(cx, "prev"),
  goto_first_change: (cx) => gotoChange(cx, "first"),
  goto_last_change: (cx) => gotoChange(cx, "last"),
};
