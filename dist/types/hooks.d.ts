import { Facet } from "@codemirror/state";
import type { Context } from "./core/editor";
import type { Host } from "./core/host";
export type EdgeDirection = "left" | "right" | "up" | "down";
export interface HelixEdge {
    direction: EdgeDirection;
    extend: boolean;
    count: number;
    goalColumn: number | undefined;
}
export interface MotionRange {
    from: number;
    to: number;
    kind: "skip" | "row" | "enter";
}
export interface HelixHooks {
    edge?(edge: HelixEdge, host: Host): boolean;
    motionRanges?(host: Host): readonly MotionRange[];
    enter?(range: MotionRange, edge: HelixEdge, host: Host): boolean;
    command?(name: string, cx: Context): boolean;
    focused?(host: Host): Host | null;
    stopBeforeEnd?: boolean;
}
export declare const helixHooks: Facet<HelixHooks, HelixHooks>;
export declare function hooksOf(host: Host): HelixHooks;
export declare function rangeAt(ranges: readonly MotionRange[], pos: number): MotionRange | null;
