import { type Config } from "./config";
import type { HelixRunnable } from "./commands/names";
import type { KeyNode } from "./keymap/trie";
export interface LoadedConfig {
    config: Config;
    keys: Partial<Record<"normal" | "select" | "insert", KeyNode>>;
    warnings: string[];
}
type Known = (name: string) => boolean;
export type HelixKeyBinding = HelixRunnable | readonly HelixRunnable[] | HelixKeyTable;
export interface HelixKeyTable {
    [key: string]: HelixKeyBinding | boolean | undefined;
    name?: string;
    sticky?: boolean;
}
export type HelixKeys = Partial<Record<"normal" | "select" | "insert", HelixKeyTable>>;
export declare function loadKeys(layers: HelixKeys | readonly HelixKeys[] | undefined, known: Known): Pick<LoadedConfig, "keys" | "warnings">;
export declare function loadConfig(source: string | Record<string, unknown> | null, base?: Config, known?: Known): LoadedConfig;
export {};
