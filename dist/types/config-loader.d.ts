import { type Config } from "./config";
import type { KeyNode } from "./keymap/trie";
export interface LoadedConfig {
    config: Config;
    keys: Partial<Record<"normal" | "select" | "insert", KeyNode>>;
    warnings: string[];
}
type Known = (name: string) => boolean;
export declare function loadConfig(source: string | null, base?: Config, known?: Known): LoadedConfig;
export {};
