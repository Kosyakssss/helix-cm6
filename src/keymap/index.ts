import { isAppCommandName } from "../commands/app";
import { defaultInsert, defaultNormal, selectOverrides } from "./default";
import { buildTrie, cloneTrie, Keymaps, mergeNodes, type KeyNode, type RawTrie, type TrieNode } from "./trie";

export type ModeName = "normal" | "select" | "insert";
export type KeyLayer = Partial<Record<ModeName, KeyNode>>;

function prune(node: KeyNode, keep: (name: string) => boolean): KeyNode | null {
  const map: Record<string, RawTrie> = {};
  for (const [key, value] of Object.entries(node.map)) {
    if (typeof value === "string") {
      if (keep(value)) map[key] = value;
    } else if (Array.isArray(value)) {
      if (value.every(keep)) map[key] = value;
    } else {
      const inner = prune(value, keep);
      if (inner) map[key] = inner;
    }
  }
  return Object.keys(map).length > 0 ? { ...node, map } : null;
}

const editing = (name: string) => !isAppCommandName(name);

function layer(normal: KeyNode, select: KeyNode, insert: KeyNode, keep: (name: string) => boolean): KeyLayer {
  const out: KeyLayer = {};
  const n = prune(normal, keep);
  const s = prune(select, keep);
  const i = prune(insert, keep);
  if (n) out.normal = n;
  if (s) out.select = s;
  if (i) out.insert = i;
  return out;
}

export const helixAppKeys: KeyLayer = layer(defaultNormal, selectOverrides, defaultInsert, isAppCommandName);

function reorder(node: TrieNode, like: TrieNode): void {
  const entries = [...node.map];
  const rank = new Map([...like.map.keys()].map((key, i) => [key, i]));
  entries.sort(([a], [b]) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity));
  node.map.clear();
  for (const [key, value] of entries) {
    node.map.set(key, value);
    const other = like.map.get(key);
    if (value.kind === "node" && other?.kind === "node") reorder(value, other);
  }
}

function fullKeymaps(): Record<ModeName, TrieNode> {
  const normal = buildTrie(defaultNormal) as TrieNode;
  const select = cloneTrie(normal) as TrieNode;
  mergeNodes(select, buildTrie(selectOverrides) as TrieNode);
  select.name = "Select mode";
  return { normal, select, insert: buildTrie(defaultInsert) as TrieNode };
}

export function defaultKeymaps(): Record<ModeName, TrieNode> {
  const base = layer(defaultNormal, selectOverrides, defaultInsert, editing);
  const normal = buildTrie(base.normal!) as TrieNode;
  const select = cloneTrie(normal) as TrieNode;
  mergeNodes(select, buildTrie(base.select!) as TrieNode);
  select.name = "Select mode";
  return { normal, select, insert: buildTrie(base.insert!) as TrieNode };
}

export interface KeymapOptions {
  app?: KeyLayer;
  available?: (name: string) => boolean;
}

export function buildKeymaps(user: KeyLayer = {}, options: KeymapOptions = {}): Keymaps {
  const maps = defaultKeymaps();
  const full = fullKeymaps();
  const available = options.available ?? (() => true);
  const keep = (name: string) => name.startsWith(":") || name.startsWith("@") || available(name);
  for (const mode of ["normal", "select", "insert"] as const) {
    const app = options.app?.[mode];
    const provided = app ? prune(app, keep) : null;
    if (mode === "select" && options.app?.normal) {
      const shared = prune(options.app.normal, keep);
      if (shared) mergeNodes(maps.select, buildTrie(shared) as TrieNode);
    }
    if (provided) mergeNodes(maps[mode], buildTrie(provided) as TrieNode);
    reorder(maps[mode], full[mode]);
    const delta = user[mode];
    if (delta) mergeNodes(maps[mode], buildTrie(delta) as TrieNode);
  }
  return new Keymaps(maps);
}
