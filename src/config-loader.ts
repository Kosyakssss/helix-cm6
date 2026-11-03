import { parse } from "smol-toml";
import { defaultConfig, type Config, type WhitespaceConfig } from "./config";
import type { KeyNode, RawTrie } from "./keymap/trie";
import { parseCommand } from "./keymap/trie";
import { normalizeKeyString } from "./keys";
import { isKnownCommand } from "./commands";
import { TYPABLE_MAP, splitCommandLine } from "./commands/typed";

export interface LoadedConfig {
  config: Config;
  keys: Partial<Record<"normal" | "select" | "insert", KeyNode>>;
  warnings: string[];
}

const IGNORED_EDITOR = new Set(["true-color", "undercurl", "workspace-lsp-roots", "atomic-save", "clipboard-provider", "editor-config", "kitty-keyboard-protocol", "auto-save", "workspace-trust", "terminal"]);

function table(value: unknown, key: string, warnings: string[]): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  warnings.push(`editor.${key}: expected a table`);
  return {};
}

function chars(v: unknown): boolean {
  return typeof v === "string" && [...v].length === 1;
}

function asBool(v: unknown, key: string, warnings: string[]): boolean | undefined {
  if (typeof v === "boolean") return v;
  warnings.push(`editor.${key}: expected a boolean`);
  return undefined;
}

function asNum(v: unknown, key: string, warnings: string[]): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  warnings.push(`editor.${key}: expected a number`);
  return undefined;
}

function asStr(v: unknown, key: string, warnings: string[]): string | undefined {
  if (typeof v === "string") return v;
  warnings.push(`editor.${key}: expected a string`);
  return undefined;
}

function applyEditor(config: Config, editor: Record<string, unknown>, warnings: string[]): void {
  for (const [key, value] of Object.entries(editor)) {
    switch (key) {
      case "scrolloff": {
        const n = asNum(value, key, warnings);
        if (n !== undefined) config.scrolloff = n;
        break;
      }
      case "scroll-lines": {
        const n = asNum(value, key, warnings);
        if (n !== undefined) config.scrollLines = n;
        break;
      }
      case "default-yank-register": {
        const s = asStr(value, key, warnings);
        if (s !== undefined) config.defaultYankRegister = s;
        break;
      }
      case "mouse-yank-register": {
        const s = asStr(value, key, warnings);
        if (s !== undefined) config.mouseYankRegister = s;
        break;
      }
      case "jump-label-alphabet": {
        const s = asStr(value, key, warnings);
        if (s !== undefined) config.jumpLabelAlphabet = [...s];
        break;
      }
      case "indent-heuristic": {
        if (value === "simple" || value === "tree-sitter" || value === "hybrid") config.indentHeuristic = value;
        else warnings.push("editor.indent-heuristic: expected simple, tree-sitter or hybrid");
        break;
      }
      case "shell": {
        if (Array.isArray(value) && value.every((v) => typeof v === "string")) config.shell = value;
        else warnings.push("editor.shell: expected a list of strings");
        break;
      }
      case "text-width": {
        const n = asNum(value, key, warnings);
        if (n !== undefined) config.textWidth = n;
        break;
      }
      case "auto-info": {
        const b = asBool(value, key, warnings);
        if (b !== undefined) config.autoInfo = b;
        break;
      }
      case "color-modes": {
        const b = asBool(value, key, warnings);
        if (b !== undefined) config.colorModes = b;
        break;
      }
      case "cursorline": {
        const b = asBool(value, key, warnings);
        if (b !== undefined) config.cursorline = b;
        break;
      }
      case "continue-comments": {
        const b = asBool(value, key, warnings);
        if (b !== undefined) config.continueComments = b;
        break;
      }
      case "trim-trailing-whitespace": {
        const b = asBool(value, key, warnings);
        if (b !== undefined) config.trimTrailingWhitespace = b;
        break;
      }
      case "trim-final-newlines": {
        const b = asBool(value, key, warnings);
        if (b !== undefined) config.trimFinalNewlines = b;
        break;
      }
      case "insert-final-newline": {
        const b = asBool(value, key, warnings);
        if (b !== undefined) config.insertFinalNewline = b;
        break;
      }
      case "line-number":
        if (value === "absolute" || value === "relative") config.lineNumber = value;
        else warnings.push(`editor.line-number: expected "absolute" or "relative"`);
        break;
      case "gutters": {
        const layout = Array.isArray(value) ? value : (value as Record<string, unknown> | null)?.layout;
        if (Array.isArray(layout)) {
          config.gutterLineNumbers = layout.includes("line-numbers");
          config.gutters.layout = layout.map(String);
        }
        const options = !Array.isArray(value) && value && typeof value === "object" ? (value as Record<string, unknown>) : null;
        const numbers = options?.["line-numbers"] as Record<string, unknown> | undefined;
        const min = numbers?.["min-width"];
        if (typeof min === "number" || typeof min === "bigint") config.gutters.lineNumbersMinWidth = Number(min);
        if (!options && !Array.isArray(layout)) warnings.push("editor.gutters: expected a list or a table with layout");
        break;
      }
      case "indent-guides": {
        const guides = (value as Record<string, unknown> | null) ?? {};
        if (typeof guides.render === "boolean") config.indentGuides = guides.render;
        if (chars(guides.character)) config.indentGuideCharacter = guides.character as string;
        if (typeof guides["skip-levels"] === "number" || typeof guides["skip-levels"] === "bigint") config.indentGuideSkipLevels = Number(guides["skip-levels"]);
        break;
      }
      case "auto-pairs":
        if (value === false) config.autoPairs = false;
        else if (value === true) break;
        else if (value && typeof value === "object") {
          config.autoPairs = Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => typeof v === "string")
            .map(([o, c]) => [o, c as string]);
        } else warnings.push("editor.auto-pairs: expected a boolean or a table");
        break;
      case "search": {
        const s = value as Record<string, unknown>;
        for (const [k, v] of Object.entries(s ?? {})) {
          if (k === "smart-case" && typeof v === "boolean") config.search.smartCase = v;
          else if (k === "wrap-around" && typeof v === "boolean") config.search.wrapAround = v;
          else warnings.push(`editor.search.${k}: not supported`);
        }
        break;
      }
      case "smart-tab": {
        const s = value as Record<string, unknown>;
        for (const [k, v] of Object.entries(s ?? {})) {
          if (k === "enable" && typeof v === "boolean") config.smartTab.enable = v;
          else if (k === "supersede-menu" && typeof v === "boolean") config.smartTab.supersedeMenu = v;
          else warnings.push(`editor.smart-tab.${k}: not supported`);
        }
        break;
      }
      case "cursor-shape": {
        const s = value as Record<string, unknown>;
        for (const [k, v] of Object.entries(s ?? {})) {
          if ((k === "normal" || k === "insert" || k === "select") && typeof v === "string") config.cursorShape[k] = v;
          else warnings.push(`editor.cursor-shape.${k}: not supported`);
        }
        break;
      }
      case "whitespace": {
        const w = table(value, key, warnings);
        const render = w.render;
        const names = ["space", "nbsp", "nnbsp", "tab", "newline"] as const;
        if (render === "all" || render === "none") for (const n of names) config.whitespace.render[n] = render === "all";
        else if (render && typeof render === "object") {
          const r = render as Record<string, unknown>;
          if (r.default === "all" || r.default === "none") for (const n of names) config.whitespace.render[n] = r.default === "all";
          for (const n of names) if (r[n] === "all" || r[n] === "none") config.whitespace.render[n] = r[n] === "all";
        } else if (render !== undefined) warnings.push("editor.whitespace.render: expected all, none or a table");
        const c = w.characters;
        if (c && typeof c === "object") {
          for (const [k, v] of Object.entries(c as Record<string, unknown>)) {
            if (k in config.whitespace.characters && chars(v)) config.whitespace.characters[k as keyof WhitespaceConfig["characters"]] = v as string;
            else warnings.push(`editor.whitespace.characters.${k}: expected one character`);
          }
        }
        break;
      }
      case "rulers":
        if (Array.isArray(value) && value.every((v) => typeof v === "number" || typeof v === "bigint")) config.rulers = value.map(Number);
        else warnings.push("editor.rulers: expected a list of numbers");
        break;
      case "cursorcolumn":
      case "rainbow-brackets":
      case "auto-completion":
      case "completion-replace":
      case "preview-completion-insert":
      case "path-completion":
      case "auto-format":
      case "mouse":
      case "middle-click-paste": {
        const b = asBool(value, key, warnings);
        if (b === undefined) break;
        const field = { cursorcolumn: "cursorcolumn", "rainbow-brackets": "rainbowBrackets", "auto-completion": "autoCompletion", "completion-replace": "completionReplace", "preview-completion-insert": "previewCompletionInsert", "path-completion": "pathCompletion", "auto-format": "autoFormat", mouse: "mouse", "middle-click-paste": "middleClickPaste" } as const;
        config[field[key]] = b;
        break;
      }
      case "idle-timeout":
      case "completion-timeout":
      case "completion-trigger-len": {
        const n = asNum(value, key, warnings);
        if (n === undefined) break;
        const field = { "idle-timeout": "idleTimeout", "completion-timeout": "completionTimeout", "completion-trigger-len": "completionTriggerLen" } as const;
        config[field[key]] = n;
        break;
      }
      case "bufferline":
        if (value === "never" || value === "always" || value === "multiple") config.bufferline = value;
        else warnings.push("editor.bufferline: expected never, always or multiple");
        break;
      case "popup-border":
        if (value === "none" || value === "all" || value === "popup" || value === "menu") config.popupBorder = value;
        else warnings.push("editor.popup-border: expected none, all, popup or menu");
        break;
      case "default-line-ending": {
        const s = asStr(value, key, warnings);
        if (s !== undefined) config.defaultLineEnding = s;
        break;
      }
      case "end-of-line-diagnostics": {
        const s = asStr(value, key, warnings);
        if (s !== undefined) config.endOfLineDiagnostics = s;
        break;
      }
      case "inline-diagnostics": {
        const d = table(value, key, warnings);
        if (typeof d["cursor-line"] === "string") config.inlineDiagnostics.cursorLine = d["cursor-line"];
        if (typeof d["other-lines"] === "string") config.inlineDiagnostics.otherLines = d["other-lines"];
        for (const [k, field] of [["min-diagnostic-width", "minDiagnosticWidth"], ["prefix-len", "prefixLen"], ["max-wrap", "maxWrap"], ["max-diagnostics", "maxDiagnostics"]] as const) {
          if (typeof d[k] === "number" || typeof d[k] === "bigint") config.inlineDiagnostics[field] = Number(d[k]);
        }
        break;
      }
      case "word-completion": {
        const d = table(value, key, warnings);
        if (typeof d.enable === "boolean") config.wordCompletion.enable = d.enable;
        if (typeof d["trigger-length"] === "number" || typeof d["trigger-length"] === "bigint") config.wordCompletion.triggerLength = Number(d["trigger-length"]);
        break;
      }
      case "soft-wrap": {
        const d = table(value, key, warnings);
        if (typeof d.enable === "boolean") config.softWrap.enable = d.enable;
        if (typeof d["max-wrap"] === "number" || typeof d["max-wrap"] === "bigint") config.softWrap.maxWrap = Number(d["max-wrap"]);
        if (typeof d["max-indent-retain"] === "number" || typeof d["max-indent-retain"] === "bigint") config.softWrap.maxIndentRetain = Number(d["max-indent-retain"]);
        if (typeof d["wrap-indicator"] === "string") config.softWrap.wrapIndicator = d["wrap-indicator"];
        if (typeof d["wrap-at-text-width"] === "boolean") config.softWrap.wrapAtTextWidth = d["wrap-at-text-width"];
        break;
      }
      case "file-picker": {
        const d = table(value, key, warnings);
        const names = { hidden: "hidden", "follow-symlinks": "followSymlinks", "deduplicate-links": "deduplicateLinks", parents: "parents", ignore: "ignore", "git-ignore": "gitIgnore", "git-global": "gitGlobal", "git-exclude": "gitExclude" } as const;
        for (const [k, field] of Object.entries(names)) if (typeof d[k] === "boolean") config.filePicker[field] = d[k];
        if (typeof d["max-depth"] === "number" || typeof d["max-depth"] === "bigint") config.filePicker.maxDepth = Number(d["max-depth"]);
        break;
      }
      case "file-explorer":
        break;
      case "buffer-picker": {
        const d = table(value, key, warnings);
        if (d["start-position"] === "current" || d["start-position"] === "previous") config.bufferPicker.startPosition = d["start-position"];
        break;
      }
      case "lsp": {
        const d = table(value, key, warnings);
        const names = { enable: "enable", "display-messages": "displayMessages", "display-progress-messages": "displayProgressMessages", "auto-signature-help": "autoSignatureHelp", "display-inlay-hints": "displayInlayHints", "display-color-swatches": "displayColorSwatches", "display-signature-help-docs": "displaySignatureHelpDocs", snippets: "snippets", "goto-reference-include-declaration": "gotoReferenceIncludeDeclaration" } as const;
        for (const [k, field] of Object.entries(names)) if (typeof d[k] === "boolean") config.lsp[field] = d[k];
        break;
      }
      case "statusline": {
        const s = value as Record<string, unknown>;
        for (const [k, v] of Object.entries(s ?? {})) {
          if ((k === "left" || k === "center" || k === "right") && Array.isArray(v)) config.statusline[k] = v.map(String);
          else if (k === "separator" && typeof v === "string") config.statusline.separator = v;
          else if (k === "mode" && v && typeof v === "object") {
            const m = v as Record<string, unknown>;
            if (typeof m.normal === "string") config.statusline.modeNormal = m.normal;
            if (typeof m.insert === "string") config.statusline.modeInsert = m.insert;
            if (typeof m.select === "string") config.statusline.modeSelect = m.select;
          } else if ((k === "diagnostics" || k === "workspace-diagnostics") && Array.isArray(v)) {
            config.statusline[k === "diagnostics" ? "diagnostics" : "workspaceDiagnostics"] = v.map(String);
          } else warnings.push(`editor.statusline.${k}: not supported`);
        }
        break;
      }
      default:
        if (!IGNORED_EDITOR.has(key)) warnings.push(`editor.${key}: unknown key`);
    }
  }
}

function checkCommand(raw: string, path: string, warnings: string[]): boolean {
  const cmd = parseCommand(raw);
  if (cmd.kind === "static" && !isKnownCommand(cmd.name)) {
    warnings.push(`${path}: unknown command "${cmd.name}"`);
    return false;
  }
  if (cmd.kind === "typable") {
    const [name] = splitCommandLine(cmd.raw);
    if (!/^\d+$/.test(name) && !TYPABLE_MAP.has(name)) {
      warnings.push(`${path}: typed command ":${name}" is not supported`);
      return false;
    }
  }
  return true;
}

function convertTrie(value: unknown, path: string, warnings: string[]): RawTrie | null {
  if (typeof value === "string") return checkCommand(value, path, warnings) ? value : null;
  if (Array.isArray(value)) {
    const cmds = value.map(String);
    if (cmds.some((c) => c.startsWith("@"))) {
      warnings.push(`${path}: macro keybindings may not be used in command sequences`);
      return null;
    }
    const ok = cmds.filter((c) => checkCommand(c, path, warnings));
    return ok.length > 0 ? ok : null;
  }
  if (value && typeof value === "object") {
    const map: Record<string, RawTrie> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      try {
        normalizeKeyString(k);
      } catch (err) {
        warnings.push(`${path}.${k}: ${(err as Error).message}`);
        continue;
      }
      const t = convertTrie(v, `${path}.${k}`, warnings);
      if (t !== null) map[k] = t;
    }
    return { name: "", map };
  }
  warnings.push(`${path}: expected a command, list of commands, or sub-keymap`);
  return null;
}

export function loadConfig(source: string | null, base: Config = defaultConfig()): LoadedConfig {
  const config: Config = structuredClone(base);
  const warnings: string[] = [];
  const keys: LoadedConfig["keys"] = {};
  if (source === null) return { config, keys, warnings };
  let doc: Record<string, unknown>;
  try {
    doc = parse(source);
  } catch (err) {
    warnings.push(`config.toml: ${(err as Error).message}`);
    return { config, keys, warnings };
  }
  for (const [section, value] of Object.entries(doc)) {
    if (section === "editor") applyEditor(config, value as Record<string, unknown>, warnings);
    else if (section === "keys") {
      for (const [mode, table] of Object.entries(value as Record<string, unknown>)) {
        if (mode !== "normal" && mode !== "select" && mode !== "insert") {
          warnings.push(`keys.${mode}: unknown mode`);
          continue;
        }
        const t = convertTrie(table, `keys.${mode}`, warnings);
        if (t && typeof t === "object" && !Array.isArray(t)) keys[mode] = t;
      }
    } else if (section === "theme") {
      continue;
    } else warnings.push(`${section}: unknown section`);
  }
  return { config, keys, warnings };
}
