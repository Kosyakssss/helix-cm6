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
  key?(key: string, cx: Context): boolean;
  intercept?(key: string, host: Host): boolean;
  textObject?(kind: "inside" | "around", ch: string, cx: Context): boolean;
  command?(name: string, cx: Context): boolean;
  focused?(host: Host): Host | null;
  stopBeforeEnd?: boolean | ((host: Host) => boolean);
}

function first<A extends unknown[]>(calls: ((...args: A) => boolean)[]): (...args: A) => boolean {
  return (...args) => calls.some((call) => call(...args));
}

export const helixHooks = Facet.define<HelixHooks, HelixHooks>({
  combine(values) {
    if (values.length <= 1) return values[0] ?? {};
    const edge = values.flatMap((v) => (v.edge ? [v.edge.bind(v)] : []));
    const enter = values.flatMap((v) => (v.enter ? [v.enter.bind(v)] : []));
    const command = values.flatMap((v) => (v.command ? [v.command.bind(v)] : []));
    const key = values.flatMap((v) => (v.key ? [v.key.bind(v)] : []));
    const intercept = values.flatMap((v) => (v.intercept ? [v.intercept.bind(v)] : []));
    const textObject = values.flatMap((v) => (v.textObject ? [v.textObject.bind(v)] : []));
    const ranges = values.flatMap((v) => (v.motionRanges ? [v.motionRanges.bind(v)] : []));
    const focused = values.flatMap((v) => (v.focused ? [v.focused.bind(v)] : []));
    return {
      edge: edge.length > 0 ? first(edge) : undefined,
      enter: enter.length > 0 ? first(enter) : undefined,
      command: command.length > 0 ? first(command) : undefined,
      key: key.length > 0 ? first(key) : undefined,
      intercept: intercept.length > 0 ? first(intercept) : undefined,
      textObject: textObject.length > 0 ? first(textObject) : undefined,
      motionRanges: ranges.length > 0 ? (host) => ranges.flatMap((r) => r(host)) : undefined,
      focused: focused.length > 0 ? (host) => focused.reduce<Host | null>((found, f) => found ?? f(host), null) : undefined,
      stopBeforeEnd: (host) => values.some((v) => (typeof v.stopBeforeEnd === "function" ? v.stopBeforeEnd(host) : v.stopBeforeEnd === true)),
    };
  },
});

export function hooksOf(host: Host): HelixHooks {
  return host.state.facet(helixHooks);
}

export function stopsBeforeEnd(hooks: HelixHooks, host: Host): boolean {
  const stop = hooks.stopBeforeEnd;
  return typeof stop === "function" ? stop(host) : stop === true;
}

export function rangeAt(ranges: readonly MotionRange[], pos: number): MotionRange | null {
  for (const r of ranges) if (pos >= r.from && pos < r.to) return r;
  return null;
}
