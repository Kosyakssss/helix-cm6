import type { ChangeSet, Text } from "@codemirror/state";
import { type Locals } from "./highlight";
import type { LanguageId } from "./injections";
import type { LanguageLoader } from "./loader";
import type { Node, Runtime, Tree, TreeCursor as TSCursor } from "./ts";
type ByteRange = [number, number];
export interface Injection {
    range: ByteRange;
    layer: Layer;
    matchedNodeRange: ByteRange;
}
interface Flags {
    reused: boolean;
    modified: boolean;
    moved: boolean;
    touched: boolean;
}
export interface Edit {
    start: number;
    oldEnd: number;
    newEnd: number;
}
export declare class Layer {
    readonly language: LanguageId;
    readonly parent: Layer | null;
    tree: Tree | null;
    injections: Injection[];
    ranges: ByteRange[];
    flags: Flags;
    locals: Locals | null;
    constructor(language: LanguageId, parent: Layer | null);
}
declare class Source {
    private readonly rt;
    readonly text: string;
    readonly utf8: Uint8Array;
    private readonly decoder;
    readonly ptr: number;
    private maps;
    constructor(rt: Runtime, text: string);
    private build;
    byteOf(pos: number): number;
    posOf(byte: number): number;
    slice(start: number, end: number): string;
    free(): void;
}
export declare class Syntax {
    readonly loader: LanguageLoader;
    readonly root: Layer;
    private readonly layers;
    private readonly cursors;
    private source;
    constructor(loader: LanguageLoader, text: string, language: LanguageId);
    get input(): Source;
    byteOf(pos: number): number;
    posOf(byte: number): number;
    slice(start: number, end: number): string;
    get byteLength(): number;
    applyChanges(changes: ChangeSet, newDoc: Text): void;
    private update;
    private parse;
    allLayers(): Iterable<Layer>;
    localsOf(layer: Layer): Locals;
    treeOf(layer: Layer): Tree;
    layerAndTreeForByteRange(start: number, end: number): [Layer, Tree];
    injectionAtByteIdx(layer: Layer, idx: number): Injection | null;
    layersForByteRange(start: number, end: number): Generator<Layer>;
    layerForByteRange(start: number, end: number): Layer;
    treeForByteRange(start: number, end: number): Tree;
    namedDescendantForByteRange(start: number, end: number): Node | null;
    descendantForByteRange(start: number, end: number): Node | null;
    walk(): SyntaxCursor;
    newCursor(tree: Tree): TSCursor;
    dropCursor(cursor: TSCursor): void;
    delete(): void;
    private mapInjections;
    private runInjectionQuery;
    private initInjection;
}
export declare class SyntaxCursor {
    private readonly syntax;
    private current;
    private cursor;
    constructor(syntax: Syntax);
    private use;
    node(): Node;
    gotoParent(): boolean;
    gotoParentWith(predicate: (node: Node) => boolean): boolean;
    gotoFirstChild(): boolean;
    gotoNextSibling(): boolean;
    gotoPreviousSibling(): boolean;
    resetToByteRange(start: number, end: number): void;
    children(): Node[];
    dispose(): void;
}
export {};
