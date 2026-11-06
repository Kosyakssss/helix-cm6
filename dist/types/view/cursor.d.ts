import { type Extension, type Text } from "@codemirror/state";
import { type LayerMarker } from "@codemirror/view";
import type { HelixEditor } from "../core/editor";
import type { Range as HelixRange } from "../selection";
export interface Box {
    left: number;
    top: number;
    right: number;
    bottom: number;
}
export interface Glyph {
    text: string;
    top: number;
    height: number;
    font: string;
    spacing: string;
    features: string;
    variations: string;
}
export interface Backdrop {
    color: string;
    image: string;
}
export declare class CellMarker implements LayerMarker {
    readonly doc: Document;
    readonly cls: string;
    readonly box: Box;
    readonly glyph: Glyph | null;
    readonly backdrop: Backdrop | null;
    constructor(doc: Document, cls: string, box: Box, glyph: Glyph | null, backdrop: Backdrop | null);
    eq(other: LayerMarker): boolean;
    draw(): HTMLElement;
    update(dom: HTMLElement, prev: LayerMarker): boolean;
    private apply;
}
export declare function backdropOf(start: Element): Backdrop;
export declare function cellWidth(el: Element): number;
export declare function isOpaque(color: string): boolean;
export declare function cornerClasses(box: Box, near: Box[]): string[];
export type CursorShape = HelixEditor["config"]["cursorShape"]["normal"];
export interface RangeParts {
    from: number;
    to: number;
    pos: number;
    end: number;
    eol: boolean;
}
export declare function rangeParts(doc: Text, range: HelixRange, primary: boolean, insert: boolean, shape: CursorShape): RangeParts;
export declare function setHighlight(owner: object, doc: Document, ranges: Range[]): void;
export declare function glyphFor(el: Element | null, text: string, top: number, coords: {
    top: number;
    bottom: number;
}): Glyph | null;
export declare function cursorLayers(editor: HelixEditor): Extension;
