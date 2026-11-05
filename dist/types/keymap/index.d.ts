import type { HelixKeys } from "../config-loader";
import { Keymaps, type KeyNode, type TrieNode } from "./trie";
export type ModeName = "normal" | "select" | "insert";
export type KeyLayer = Partial<Record<ModeName, KeyNode>>;
export declare const appKeyLayer: KeyLayer;
export declare const helixAppKeys: HelixKeys;
export declare function defaultKeymaps(): Record<ModeName, TrieNode>;
export interface KeymapOptions {
    app?: KeyLayer;
    available?: (name: string) => boolean;
}
export declare function buildKeymaps(user?: KeyLayer, options?: KeymapOptions): Keymaps;
