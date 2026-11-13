import type { Context } from "../core/editor";
import type { Host } from "../core/host";
import { changesSince, commitHistory, historyApply } from "../history";
import type { Selection } from "../selection";
import { helixField, historyField } from "../state";

export interface Jump {
  docId: string;
  selection: Selection;
  revision: number;
  history: object | null;
}

function sameJump(a: Jump, b: Jump): boolean {
  return a.docId === b.docId && a.revision === b.revision && a.history === b.history && a.selection.eq(b.selection);
}

export function makeJump(host: Host, selection: Selection): Jump {
  commitHistoryNow(host);
  const history = host.state.field(historyField);
  return { docId: host.id, selection, revision: history.current, history: history.id };
}

export function jumpSelection(jump: Jump, host: Host): Selection {
  if (jump.docId !== host.id) return jump.selection;
  const history = host.state.field(historyField);
  let selection = jump.selection;
  if (jump.history === history.id && jump.revision < history.revisions.length) {
    const committed = changesSince(history, jump.revision);
    if (committed) selection = selection.map(committed);
    if (history.pending) selection = selection.map(history.pending.changes);
  }
  return selection.ensureInvariants(host.state.doc);
}

const CAPACITY = 30;

export class JumpList {
  jumps: Jump[] = [];
  current = 0;

  constructor(initial: Jump) {
    this.jumps.push(initial);
  }

  private pushImpl(jump: Jump): number {
    let removed = 0;
    this.jumps.length = Math.min(this.jumps.length, this.current);
    const back = this.jumps[this.jumps.length - 1];
    if (!back || !sameJump(back, jump)) {
      while (this.jumps.length >= CAPACITY) {
        this.jumps.shift();
        removed++;
      }
      this.jumps.push(jump);
      this.current = this.jumps.length;
    }
    return removed;
  }

  push(jump: Jump): void {
    this.pushImpl(jump);
  }

  forward(count: number): Jump | null {
    if (this.current + count < this.jumps.length) {
      this.current += count;
      return this.jumps[this.current] ?? null;
    }
    return null;
  }

  backward(host: Host, count: number): Jump | null {
    let current = this.current - count;
    if (current < 0) return null;
    const here = host.state.field(helixField).selection;
    if (this.current === this.jumps.length) {
      const removed = this.pushImpl(makeJump(host, here));
      current = Math.max(0, current - removed);
    }
    this.current = current;
    const entry = this.jumps[this.current];
    if (!entry) return null;
    if (entry.docId === host.id && here.eq(jumpSelection(entry, host))) {
      if (this.current === 0) return null;
      this.current -= 1;
    }
    return this.jumps[this.current] ?? null;
  }

  remove(docId: string): void {
    const before = this.jumps.slice(0, this.current).filter((j) => j.docId === docId).length;
    this.jumps = this.jumps.filter((j) => j.docId !== docId);
    this.current = Math.min(Math.max(0, this.current - before), this.jumps.length);
  }
}

export function commitHistoryNow(host: Host): void {
  const pending = host.state.field(historyField).pending;
  if (!pending) return;
  host.dispatch({
    effects: commitHistory.of({ selection: host.state.field(helixField).selection, timestamp: Date.now() }),
  });
}

export function jumplistFor(cx: Context): JumpList {
  return cx.editor.jumplist(cx.host);
}

export function pushJump(cx: Context): void {
  jumplistFor(cx).push(makeJump(cx.host, cx.host.state.field(helixField).selection));
}

export { historyApply };
