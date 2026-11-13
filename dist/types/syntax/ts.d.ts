interface Exports {
    memory: WebAssembly.Memory;
    __indirect_function_table: WebAssembly.Table;
    __stack_pointer: WebAssembly.Global;
    calloc(count: number, size: number): number;
    _initialize(): void;
    hm_malloc(size: number): number;
    hm_free(ptr: number): void;
    hm_language(which: number): number;
    hm_symbol_name(language: number, symbol: number): number;
    hm_parse(language: number, text: number, length: number, ranges: number, count: number, oldTree: number): number;
    hm_tree_edit(tree: number, start: number, oldEnd: number, newEnd: number): void;
    hm_tree_delete(tree: number): void;
    hm_tree_copy(tree: number): number;
    hm_tree_root(tree: number, out: number): void;
    hm_node_start(node: number): number;
    hm_node_end(node: number): number;
    hm_node_symbol(node: number): number;
    hm_node_is_named(node: number): number;
    hm_node_child_count(node: number): number;
    hm_node_child(node: number, index: number, out: number): void;
    hm_node_parent(node: number, out: number): void;
    hm_cursor_field_name(cursor: number): number;
    hm_node_is_missing(node: number): number;
    hm_node_is_extra(node: number): number;
    hm_node_kind(node: number): number;
    hm_node_symbol_type(node: number): number;
    hm_node_next_sibling(node: number, out: number): void;
    hm_node_prev_sibling(node: number, out: number): void;
    hm_node_descendant(node: number, start: number, end: number, named: number, out: number): void;
    hm_cursor_new(node: number): number;
    hm_cursor_delete(cursor: number): void;
    hm_cursor_node(cursor: number, out: number): void;
    hm_cursor_parent(cursor: number): number;
    hm_cursor_first_child(cursor: number): number;
    hm_cursor_next_sibling(cursor: number): number;
    hm_cursor_prev_sibling(cursor: number): number;
    hm_cursor_first_child_for_byte(cursor: number, goal: number): number;
    hm_query_new(language: number, source: number, length: number, error: number): number;
    hm_query_delete(query: number): void;
    hm_query_string_count(query: number): number;
    hm_query_start_byte(query: number, pattern: number): number;
    hm_query_disable_capture(query: number, name: number, length: number): void;
    hm_qc_new(): number;
    hm_qc_delete(cursor: number): void;
    hm_qc_exec(cursor: number, query: number, node: number, start: number, end: number, limit: number): void;
    hm_qc_next_match(cursor: number, out: number): number;
    hm_qc_next_capture(cursor: number, out: number): number;
    hm_qc_remove_match(cursor: number, id: number): void;
    hm_qc_exceeded(cursor: number): number;
    hm_query_capture_count(query: number): number;
    hm_query_pattern_count(query: number): number;
    hm_query_capture_name(query: number, index: number, length: number): number;
    hm_query_string(query: number, index: number, length: number): number;
    hm_query_predicates(query: number, pattern: number, length: number): number;
}
export declare class Runtime {
    readonly x: Exports;
    private readonly scratch;
    private words;
    private bytes;
    private constructor();
    loadLanguage(binary: Uint8Array, name: string): Promise<number>;
    static load(binary: Uint8Array): Promise<Runtime>;
    u32(): Uint32Array;
    u8(): Uint8Array;
    get inPtr(): number;
    get outPtr(): number;
    get lenPtr(): number;
    writeNode(ptr: number, node: Node): void;
    readNode(ptr: number): Node | null;
    string(ptr: number, length: number): string;
    cString(ptr: number): string;
    alloc(data: Uint8Array): number;
    nodeCall(node: Node, f: (inPtr: number, outPtr: number) => void): Node | null;
    nodeValue(node: Node, f: (inPtr: number) => number): number;
}
export declare class Language {
    readonly rt: Runtime;
    readonly ptr: number;
    private readonly names;
    constructor(rt: Runtime, ptr: number);
    symbolName(symbol: number): string;
}
export declare class Node {
    readonly rt: Runtime;
    readonly raw: Uint32Array;
    constructor(rt: Runtime, raw: Uint32Array);
    get id(): number;
    walk(): TreeCursor;
    get startByte(): number;
    get endByte(): number;
    get symbol(): number;
    get isMissing(): boolean;
    get isExtra(): boolean;
    get isVisible(): boolean;
    get kind(): string;
    get isNamed(): boolean;
    get childCount(): number;
    child(index: number): Node | null;
    get children(): Node[];
    get parent(): Node | null;
    get nextSibling(): Node | null;
    get previousSibling(): Node | null;
    descendantForByteRange(start: number, end: number): Node | null;
    namedDescendantForByteRange(start: number, end: number): Node | null;
    equals(other: Node): boolean;
}
export interface ByteRange {
    start: number;
    end: number;
}
export declare class Tree {
    readonly rt: Runtime;
    readonly ptr: number;
    constructor(rt: Runtime, ptr: number);
    edit(start: number, oldEnd: number, newEnd: number): void;
    copy(): Tree;
    get rootNode(): Node;
    walk(): TreeCursor;
    delete(): void;
}
export declare class TreeCursor {
    readonly rt: Runtime;
    private ptr;
    constructor(rt: Runtime, node: Node);
    get currentNode(): Node;
    get fieldName(): string | null;
    gotoParent(): boolean;
    gotoFirstChild(): boolean;
    gotoNextSibling(): boolean;
    gotoPreviousSibling(): boolean;
    gotoFirstChildForByte(goal: number): boolean;
    delete(): void;
}
export declare class Parser {
    readonly rt: Runtime;
    constructor(rt: Runtime);
    parse(language: Language, text: number, length: number, ranges: ByteRange[] | null, oldTree?: Tree | null): Tree | null;
}
export {};
