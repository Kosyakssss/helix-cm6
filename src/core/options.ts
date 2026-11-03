import type { Config } from "../config";
import type { HelixEditor } from "./editor";

type Getter = (c: Config) => unknown;
type Setter = (c: Config, v: unknown) => void;

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error("invalid number");
  return n;
}

function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  throw new Error("invalid boolean");
}

export const OPTIONS: Record<string, [Getter, Setter]> = {
  scrolloff: [(c) => c.scrolloff, (c, v) => (c.scrolloff = num(v))],
  "scroll-lines": [(c) => c.scrollLines, (c, v) => (c.scrollLines = num(v))],
  "default-yank-register": [(c) => c.defaultYankRegister, (c, v) => (c.defaultYankRegister = String(v))],
  "mouse-yank-register": [(c) => c.mouseYankRegister, (c, v) => (c.mouseYankRegister = String(v))],
  "text-width": [(c) => c.textWidth, (c, v) => (c.textWidth = num(v))],
  "auto-info": [(c) => c.autoInfo, (c, v) => (c.autoInfo = bool(v))],
  "color-modes": [(c) => c.colorModes, (c, v) => (c.colorModes = bool(v))],
  cursorline: [(c) => c.cursorline, (c, v) => (c.cursorline = bool(v))],
  "indent-heuristic": [
    (c) => c.indentHeuristic,
    (c, v) => {
      if (v !== "simple" && v !== "tree-sitter" && v !== "hybrid") throw new Error("invalid indent-heuristic");
      c.indentHeuristic = v;
    },
  ],
  "continue-comments": [(c) => c.continueComments, (c, v) => (c.continueComments = bool(v))],
  "line-number": [
    (c) => c.lineNumber ?? "absolute",
    (c, v) => {
      if (v !== "absolute" && v !== "relative") throw new Error("invalid line-number");
      c.lineNumber = v;
    },
  ],
  "trim-trailing-whitespace": [(c) => c.trimTrailingWhitespace, (c, v) => (c.trimTrailingWhitespace = bool(v))],
  "trim-final-newlines": [(c) => c.trimFinalNewlines, (c, v) => (c.trimFinalNewlines = bool(v))],
  "insert-final-newline": [(c) => c.insertFinalNewline, (c, v) => (c.insertFinalNewline = bool(v))],
  "search.smart-case": [(c) => c.search.smartCase, (c, v) => (c.search.smartCase = bool(v))],
  "search.wrap-around": [(c) => c.search.wrapAround, (c, v) => (c.search.wrapAround = bool(v))],
  "smart-tab.enable": [(c) => c.smartTab.enable, (c, v) => (c.smartTab.enable = bool(v))],
  "cursor-shape.normal": [(c) => c.cursorShape.normal, (c, v) => (c.cursorShape.normal = String(v))],
  "cursor-shape.insert": [(c) => c.cursorShape.insert, (c, v) => (c.cursorShape.insert = String(v))],
  "cursor-shape.select": [(c) => c.cursorShape.select, (c, v) => (c.cursorShape.select = String(v))],
  "jump-label-alphabet": [
    (c) => c.jumpLabelAlphabet.join(""),
    (c, v) => (c.jumpLabelAlphabet = [...String(v)]),
  ],
  "indent-guides.render": [(c) => c.indentGuides ?? false, (c, v) => (c.indentGuides = bool(v))],
  "indent-guides.character": [(c) => c.indentGuideCharacter, (c, v) => (c.indentGuideCharacter = String(v))],
  "indent-guides.skip-levels": [(c) => c.indentGuideSkipLevels, (c, v) => (c.indentGuideSkipLevels = num(v))],
  cursorcolumn: [(c) => c.cursorcolumn, (c, v) => (c.cursorcolumn = bool(v))],
  "rainbow-brackets": [(c) => c.rainbowBrackets, (c, v) => (c.rainbowBrackets = bool(v))],
  "soft-wrap.enable": [(c) => c.softWrap.enable, (c, v) => (c.softWrap.enable = bool(v))],
  "soft-wrap.max-wrap": [(c) => c.softWrap.maxWrap, (c, v) => (c.softWrap.maxWrap = num(v))],
  "soft-wrap.max-indent-retain": [(c) => c.softWrap.maxIndentRetain, (c, v) => (c.softWrap.maxIndentRetain = num(v))],
  "soft-wrap.wrap-indicator": [(c) => c.softWrap.wrapIndicator, (c, v) => (c.softWrap.wrapIndicator = String(v))],
  "soft-wrap.wrap-at-text-width": [(c) => c.softWrap.wrapAtTextWidth, (c, v) => (c.softWrap.wrapAtTextWidth = bool(v))],
  rulers: [(c) => c.rulers, (c, v) => (c.rulers = (Array.isArray(v) ? v : JSON.parse(String(v)) as unknown[]).map(num))],
  bufferline: [
    (c) => c.bufferline,
    (c, v) => {
      if (v !== "never" && v !== "always" && v !== "multiple") throw new Error("invalid bufferline");
      c.bufferline = v;
    },
  ],
  "statusline.separator": [(c) => c.statusline.separator, (c, v) => (c.statusline.separator = String(v))],
  "whitespace.render": [
    (c) => (c.whitespace.render.space ? "all" : "none"),
    (c, v) => {
      if (v !== "all" && v !== "none") throw new Error("invalid whitespace.render");
      for (const key of ["space", "nbsp", "nnbsp", "tab", "newline"] as const) c.whitespace.render[key] = v === "all";
    },
  ],
  "auto-completion": [(c) => c.autoCompletion, (c, v) => (c.autoCompletion = bool(v))],
  "completion-trigger-len": [(c) => c.completionTriggerLen, (c, v) => (c.completionTriggerLen = num(v))],
  "idle-timeout": [(c) => c.idleTimeout, (c, v) => (c.idleTimeout = num(v))],
  "popup-border": [(c) => c.popupBorder, (c, v) => (c.popupBorder = String(v) as "none" | "all" | "popup" | "menu")],
  "end-of-line-diagnostics": [(c) => c.endOfLineDiagnostics, (c, v) => (c.endOfLineDiagnostics = String(v))],
  "inline-diagnostics.cursor-line": [(c) => c.inlineDiagnostics.cursorLine, (c, v) => (c.inlineDiagnostics.cursorLine = String(v))],
  "inline-diagnostics.other-lines": [(c) => c.inlineDiagnostics.otherLines, (c, v) => (c.inlineDiagnostics.otherLines = String(v))],
};

function parseValue(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function setOption(editor: HelixEditor, args: string[]): void {
  const [key, ...rest] = args;
  if (!key || rest.length === 0) {
    editor.setError("'set-option': Bad arguments. Usage: `:set key field`");
    return;
  }
  const opt = OPTIONS[key.toLowerCase()];
  if (!opt) {
    editor.setError(`'set-option': Unknown key \`${key}\``);
    return;
  }
  try {
    opt[1](editor.config, parseValue(rest.join(" ")));
    editor.onConfigChanged?.();
  } catch (err) {
    editor.setError(`'set-option': Could not parse field \`${rest.join(" ")}\`: ${(err as Error).message}`);
  }
}

export function toggleOption(editor: HelixEditor, args: string[]): void {
  const [key, ...values] = args;
  if (!key) {
    editor.setError("'toggle-option': Bad arguments");
    return;
  }
  const opt = OPTIONS[key.toLowerCase()];
  if (!opt) {
    editor.setError(`'toggle-option': Unknown key \`${key}\``);
    return;
  }
  const current = opt[0](editor.config);
  let next: unknown;
  if (typeof current === "boolean" && values.length === 0) next = !current;
  else if (values.length > 0) {
    const parsed = values.map(parseValue);
    const idx = parsed.findIndex((v) => JSON.stringify(v) === JSON.stringify(current));
    next = parsed[(idx + 1) % parsed.length];
  } else {
    editor.setError(`'toggle-option': Needs additional arguments to toggle \`${key}\``);
    return;
  }
  try {
    opt[1](editor.config, next);
    editor.setStatus(`'${key}' is now set to ${JSON.stringify(next)}`);
    editor.onConfigChanged?.();
  } catch (err) {
    editor.setError(`'toggle-option': ${(err as Error).message}`);
  }
}

export function getOption(editor: HelixEditor, args: string[]): void {
  const key = args[0]?.toLowerCase();
  const opt = key ? OPTIONS[key] : undefined;
  if (!key || !opt) {
    editor.setError(`'get-option': Unknown key \`${args[0] ?? ""}\``);
    return;
  }
  editor.setStatus(JSON.stringify(opt[0](editor.config)));
}
