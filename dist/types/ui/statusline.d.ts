import { type Extension } from "@codemirror/state";
import type { HelixEditor } from "../core/editor";
import type { Host } from "../core/host";
export interface StatusPart {
    text: string;
    scope: string | null;
}
export declare function statuslineElement(name: string, editor: HelixEditor, host: Host, focused: boolean): StatusPart[];
export interface Statusline {
    left: StatusPart[];
    center: StatusPart[];
    right: StatusPart[];
}
export declare function statuslineOf(editor: HelixEditor, host: Host, focused: boolean): Statusline;
export declare function helixStatusline(): Extension;
export declare const statuslineTheme: Extension;
