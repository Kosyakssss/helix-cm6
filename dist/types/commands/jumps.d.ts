import type { Context } from "../core/editor";
import type { Host } from "../core/host";
import { historyApply } from "../history";
import type { Selection } from "../selection";
export interface Jump {
    docId: string;
    selection: Selection;
    revision: number;
    history: object | null;
}
export declare function makeJump(host: Host, selection: Selection): Jump;
export declare function jumpSelection(jump: Jump, host: Host): Selection;
export declare class JumpList {
    jumps: Jump[];
    current: number;
    constructor(initial: Jump);
    private pushImpl;
    push(jump: Jump): void;
    forward(count: number): Jump | null;
    backward(host: Host, count: number): Jump | null;
    remove(docId: string): void;
}
export declare function commitHistoryNow(host: Host): void;
export declare function jumplistFor(cx: Context): JumpList;
export declare function pushJump(cx: Context): void;
export { historyApply };
