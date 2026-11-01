import type { ChangeDesc } from "@codemirror/state";
import type { Context } from "../core/editor";
import type { Host } from "../core/host";
import { historyApply } from "../history";
import type { Selection } from "../selection";
export interface Jump {
    docId: string;
    selection: Selection;
}
export declare class JumpList {
    jumps: Jump[];
    current: number;
    constructor(initial: Jump);
    private pushImpl;
    push(jump: Jump): void;
    forward(count: number): Jump | null;
    backward(here: Jump, count: number): Jump | null;
    remove(docId: string): void;
    map(docId: string, changes: ChangeDesc): void;
}
export declare function commitHistoryNow(host: Host): void;
export declare function jumplistFor(cx: Context): JumpList;
export declare function pushJump(cx: Context): void;
export { historyApply };
