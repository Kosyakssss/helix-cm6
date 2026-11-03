import { type Extension } from "@codemirror/state";
import { type EditorView } from "@codemirror/view";
import type { Host } from "../core/host";
import type { Hunk } from "../core/matcher";
export declare const setDiffBase: import("@codemirror/state").StateEffectType<string | null>;
export declare function lastDiffHunks(host: Host): readonly Hunk[] | null;
export declare function helixSetDiffBase(view: EditorView, base: string | null): void;
export declare function helixDiff(): Extension;
export declare function diffBaseOf(view: EditorView): string | null;
