import type { ChangeSet, Text } from "@codemirror/state";
import type { InjectionQuery, Language, Node, Parser, Runtime, Tree, TreeCursor as TSCursor } from "./ts";
export interface LanguageConfig {
    id: string;
    injectionRegex: RegExp | null;
    grammar: Language;
    injections: InjectionQuery | null;
}
export interface Loader {
    rt: Runtime;
    parser: Parser;
    languages: LanguageConfig[];
}
type ByteRange = [number, number];
interface Injection {
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
    readonly language: LanguageConfig;
    readonly parent: Layer | null;
    tree: Tree | null;
    injections: Injection[];
    ranges: ByteRange[];
    flags: Flags;
    constructor(language: LanguageConfig, parent: Layer | null);
}
export declare class Syntax {
    private readonly loader;
    readonly root: Layer;
    private readonly layers;
    private readonly cursors;
    private source;
    constructor(loader: Loader, text: string, language: LanguageConfig);
    byteOf(pos: number): number;
    posOf(byte: number): number;
    slice(start: number, end: number): string;
    get byteLength(): number;
    applyChanges(changes: ChangeSet, newDoc: Text): void;
    private update;
    private parse;
    treeOf(layer: Layer): Tree;
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
    private matches;
    private resolve;
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
