import type { ChangeDesc } from "@codemirror/state";
export type Assoc = "before" | "after" | "beforeWord" | "afterWord" | "beforeSticky" | "afterSticky";
export declare function mapPos(desc: ChangeDesc, pos: number, assoc: Assoc): number;
