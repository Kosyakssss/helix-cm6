import type { EditorView } from "@codemirror/view";
import type { Context, HelixEditor } from "../core/editor";
import type { Host } from "../core/host";
import type { LayerResult, UiLayer } from "../core/layers";
import type { Matcher } from "../core/matcher";
export type PickerAction = "replace" | "hsplit" | "vsplit" | "load";
export interface PickerColumn<T> {
    name: string;
    format(item: T): string;
    filter?: boolean;
    paths?: boolean;
    hidden?: boolean;
}
export interface PickerPreview {
    path?: string | null;
    text: string | null;
    language?: string | null;
    from?: number;
    to?: number;
    note?: string;
}
export interface PickerOptions<T> {
    columns: readonly PickerColumn<T>[];
    primaryColumn?: number;
    items: readonly T[] | Promise<readonly T[]> | AsyncIterable<readonly T[]>;
    onSelect(cx: Context, item: T, action: PickerAction): void;
    preview?(item: T): PickerPreview | Promise<PickerPreview> | null;
    initialQuery?: string;
    cursor?: number;
    history?: string;
    title?: string;
    dynamic?(query: string): void;
}
export declare class Picker<T> implements UiLayer {
    private readonly editor;
    private readonly host;
    private readonly matcher;
    readonly options: PickerOptions<T>;
    readonly modal = true;
    readonly anchored: null;
    readonly className = "hx-picker";
    private readonly prompt;
    private all;
    private matches;
    private cursor;
    private showPreview;
    private patterns;
    private previewCache;
    private streaming;
    private readonly filtered;
    private readonly names;
    private readonly primary;
    constructor(editor: HelixEditor, host: Host, matcher: Matcher, options: PickerOptions<T>);
    private loadItems;
    private consume;
    private addItems;
    replaceItems(list: readonly T[]): void;
    private requestRender;
    private freePatterns;
    private refilter;
    private move;
    selection(): T | null;
    matchCount(): number;
    itemCount(): number;
    query(): string;
    handleKey(key: string, cx: Context): LayerResult;
    private cellText;
    private renderList;
    private renderPreview;
    render(parent: HTMLElement, view: EditorView): void;
    closed(): void;
}
