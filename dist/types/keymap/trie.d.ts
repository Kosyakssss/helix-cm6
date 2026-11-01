export type RawTrie = string | string[] | KeyNode;
export interface KeyNode {
    name: string;
    sticky?: boolean;
    map: Record<string, RawTrie>;
}
export type MappableCommand = {
    kind: "static";
    name: string;
} | {
    kind: "typable";
    name: string;
    args: string;
    raw: string;
} | {
    kind: "macro";
    keys: string;
};
export type Trie = {
    kind: "command";
    command: MappableCommand;
} | {
    kind: "sequence";
    commands: MappableCommand[];
} | TrieNode;
export interface TrieNode {
    kind: "node";
    name: string;
    sticky: boolean;
    map: Map<string, Trie>;
}
export declare function parseCommand(input: string): MappableCommand;
export declare function commandName(command: MappableCommand): string;
export declare function buildTrie(raw: RawTrie): Trie;
export declare function cloneTrie(trie: Trie): Trie;
export declare function mergeNodes(dst: TrieNode, other: TrieNode): void;
export declare function search(trie: Trie, keys: readonly string[]): Trie | undefined;
export type KeymapResult = {
    kind: "pending";
    node: TrieNode;
} | {
    kind: "matched";
    command: MappableCommand;
} | {
    kind: "matchedSequence";
    commands: MappableCommand[];
} | {
    kind: "notFound";
} | {
    kind: "cancelled";
    keys: string[];
};
export declare class Keymaps {
    map: Record<"normal" | "select" | "insert", TrieNode>;
    private state;
    sticky: TrieNode | null;
    constructor(map: Record<"normal" | "select" | "insert", TrieNode>);
    pending(): readonly string[];
    reset(): void;
    containsKey(mode: "normal" | "select" | "insert", key: string): boolean;
    get(mode: "normal" | "select" | "insert", key: string): KeymapResult;
}
