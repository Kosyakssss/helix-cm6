import { Facet, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { HelixEditor } from "../core/editor";
import type { Host } from "../core/host";
export interface ViewEnv {
    editor: HelixEditor;
    hostFor(view: EditorView): Host;
    insertKeysHelix(): boolean;
    physicalKeys(): boolean;
    suggestTakes(event: KeyboardEvent): boolean;
    onFocusChange(view: EditorView): void;
    onRender(view: EditorView): void;
    onChanges(view: EditorView, changes: import("@codemirror/state").ChangeSet): void;
    onDocTransaction(view: EditorView, tr: import("@codemirror/state").Transaction): void;
    onViewOpen(view: EditorView): void;
    onViewClose(view: EditorView): void;
    statusBar?(view: EditorView): HTMLElement | null;
    joinStatus?(view: EditorView, joined: boolean): void;
    panelOwner?(view: EditorView): EditorView | null;
    panelGuest?(view: EditorView): EditorView | null;
    noPanel?: boolean;
    composeAside?(view: EditorView): boolean;
}
export declare const helixEnv: Facet<ViewEnv, ViewEnv | null>;
export declare function helixExtension(env: ViewEnv): Extension;
export declare function uiRefresher(editor: HelixEditor): (host: Host) => void;
export declare function uiSignature(editor: HelixEditor, host: Host): string;
