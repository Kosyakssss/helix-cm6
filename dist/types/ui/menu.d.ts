import type { Context } from "../core/editor";
import type { LayerResult, UiLayer } from "../core/layers";
export declare class Popup implements UiLayer {
    readonly contents: string;
    readonly scope: string;
    readonly auto: boolean;
    readonly modal = false;
    readonly className = "hx-popup";
    anchored: number | null;
    constructor(contents: string, anchor: number, scope?: string, auto?: boolean);
    handleKey(key: string): LayerResult;
    render(parent: HTMLElement): void;
}
export interface MenuItem {
    label: string;
    detail?: string;
    documentation?: string;
}
export interface MenuOptions<T> {
    items: readonly T[];
    row(item: T): MenuItem;
    onSelect(cx: Context, item: T): void;
    onPreview?(item: T | null, cx: Context): void;
    onClose?(cx: Context | null): void;
    anchor: number;
}
export declare class Menu<T> implements UiLayer {
    readonly options: MenuOptions<T>;
    readonly modal = true;
    readonly className = "hx-menu";
    cursor: number | null;
    readonly anchored: number;
    constructor(options: MenuOptions<T>);
    selected(): T | null;
    private move;
    handleKey(key: string, cx: Context): LayerResult;
    render(parent: HTMLElement): void;
}
