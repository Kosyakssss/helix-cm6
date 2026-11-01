import { Keymaps, type KeyNode, type TrieNode } from "./trie";
export type ModeName = "normal" | "select" | "insert";
export declare function defaultKeymaps(): Record<ModeName, TrieNode>;
export declare function buildKeymaps(user?: Partial<Record<ModeName, KeyNode>>): Keymaps;
