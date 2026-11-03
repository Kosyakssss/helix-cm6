export type IndentStyle = { kind: "tabs" } | { kind: "spaces"; width: number };

export interface StatuslineConfig {
  left: string[];
  center: string[];
  right: string[];
  separator: string;
  diagnostics: string[];
  workspaceDiagnostics: string[];
  modeNormal: string;
  modeInsert: string;
  modeSelect: string;
}

export interface WhitespaceRender {
  space: boolean;
  nbsp: boolean;
  nnbsp: boolean;
  tab: boolean;
  newline: boolean;
}

export interface WhitespaceConfig {
  render: WhitespaceRender;
  characters: { space: string; nbsp: string; nnbsp: string; tab: string; newline: string; tabpad: string };
}

export interface SoftWrapConfig {
  enable: boolean;
  maxWrap: number;
  maxIndentRetain: number;
  wrapIndicator: string;
  wrapAtTextWidth: boolean;
}

export interface Config {
  scrolloff: number;
  shell: string[];
  scrollLines: number;
  defaultYankRegister: string;
  mouseYankRegister: string;
  jumpLabelAlphabet: string[];
  textWidth: number;
  tabWidth: number;
  indentStyle: IndentStyle;
  indentHeuristic: "simple" | "tree-sitter" | "hybrid";
  autoPairs: [string, string][] | false;
  autoInfo: boolean;
  smartTab: { enable: boolean; supersedeMenu: boolean };
  search: { smartCase: boolean; wrapAround: boolean };
  cursorShape: { normal: string; insert: string; select: string };
  colorModes: boolean;
  lineNumber: "absolute" | "relative" | null;
  gutterLineNumbers: boolean | null;
  indentGuides: boolean | null;
  cursorline: boolean;
  trimTrailingWhitespace: boolean;
  trimFinalNewlines: boolean;
  insertFinalNewline: boolean;
  statusline: StatuslineConfig;
  continueComments: boolean;
  gutters: { layout: string[]; lineNumbersMinWidth: number };
  whitespace: WhitespaceConfig;
  indentGuideCharacter: string;
  indentGuideSkipLevels: number;
  softWrap: SoftWrapConfig;
  rulers: number[];
  cursorcolumn: boolean;
  bufferline: "never" | "always" | "multiple";
  rainbowBrackets: boolean;
  popupBorder: "none" | "all" | "popup" | "menu";
  autoCompletion: boolean;
  completionTriggerLen: number;
  completionReplace: boolean;
  previewCompletionInsert: boolean;
  idleTimeout: number;
  completionTimeout: number;
  pathCompletion: boolean;
  wordCompletion: { enable: boolean; triggerLength: number };
  autoFormat: boolean;
  endOfLineDiagnostics: string;
  inlineDiagnostics: { cursorLine: string; otherLines: string; minDiagnosticWidth: number; prefixLen: number; maxWrap: number; maxDiagnostics: number };
  filePicker: { hidden: boolean; followSymlinks: boolean; deduplicateLinks: boolean; parents: boolean; ignore: boolean; gitIgnore: boolean; gitGlobal: boolean; gitExclude: boolean; maxDepth: number | null };
  bufferPicker: { startPosition: "current" | "previous" };
  mouse: boolean;
  middleClickPaste: boolean;
  defaultLineEnding: string;
  lsp: { enable: boolean; displayMessages: boolean; displayProgressMessages: boolean; autoSignatureHelp: boolean; displayInlayHints: boolean; displayColorSwatches: boolean; displaySignatureHelpDocs: boolean; snippets: boolean; gotoReferenceIncludeDeclaration: boolean };
}

export const DEFAULT_AUTO_PAIRS: [string, string][] = [
  ["(", ")"],
  ["{", "}"],
  ["[", "]"],
  ["'", "'"],
  ['"', '"'],
  ["`", "`"],
];

export function defaultConfig(): Config {
  return {
    scrolloff: 5,
    shell: ["sh", "-c"],
    scrollLines: 3,
    defaultYankRegister: '"',
    mouseYankRegister: "*",
    jumpLabelAlphabet: [..."abcdefghijklmnopqrstuvwxyz"],
    textWidth: 80,
    tabWidth: 4,
    indentStyle: { kind: "tabs" },
    indentHeuristic: "hybrid",
    autoPairs: DEFAULT_AUTO_PAIRS,
    autoInfo: true,
    smartTab: { enable: true, supersedeMenu: false },
    search: { smartCase: true, wrapAround: true },
    cursorShape: { normal: "block", insert: "block", select: "block" },
    colorModes: false,
    lineNumber: null,
    gutterLineNumbers: null,
    indentGuides: null,
    cursorline: false,
    trimTrailingWhitespace: false,
    trimFinalNewlines: false,
    insertFinalNewline: true,
    statusline: {
      left: ["mode", "spinner", "file-name", "read-only-indicator", "file-modification-indicator"],
      center: [],
      right: ["diagnostics", "selections", "register", "position", "file-encoding"],
      separator: "│",
      diagnostics: ["warning", "error"],
      workspaceDiagnostics: ["warning", "error"],
      modeNormal: "NOR",
      modeInsert: "INS",
      modeSelect: "SEL",
    },
    continueComments: true,
    gutters: { layout: ["diagnostics", "spacer", "line-numbers", "spacer", "diff"], lineNumbersMinWidth: 3 },
    whitespace: {
      render: { space: false, nbsp: false, nnbsp: false, tab: false, newline: false },
      characters: { space: "·", nbsp: "⍽", nnbsp: "␣", tab: "→", newline: "⏎", tabpad: " " },
    },
    indentGuideCharacter: "│",
    indentGuideSkipLevels: 0,
    softWrap: { enable: false, maxWrap: 20, maxIndentRetain: 40, wrapIndicator: "↪ ", wrapAtTextWidth: false },
    rulers: [],
    cursorcolumn: false,
    bufferline: "never",
    rainbowBrackets: false,
    popupBorder: "none",
    autoCompletion: true,
    completionTriggerLen: 2,
    completionReplace: false,
    previewCompletionInsert: true,
    idleTimeout: 250,
    completionTimeout: 250,
    pathCompletion: true,
    wordCompletion: { enable: true, triggerLength: 7 },
    autoFormat: true,
    endOfLineDiagnostics: "hint",
    inlineDiagnostics: { cursorLine: "warning", otherLines: "disable", minDiagnosticWidth: 40, prefixLen: 1, maxWrap: 20, maxDiagnostics: 10 },
    filePicker: { hidden: true, followSymlinks: true, deduplicateLinks: true, parents: true, ignore: true, gitIgnore: true, gitGlobal: true, gitExclude: true, maxDepth: null },
    bufferPicker: { startPosition: "current" },
    mouse: true,
    middleClickPaste: true,
    defaultLineEnding: "native",
    lsp: { enable: true, displayMessages: true, displayProgressMessages: false, autoSignatureHelp: true, displayInlayHints: false, displayColorSwatches: true, displaySignatureHelpDocs: true, snippets: true, gotoReferenceIncludeDeclaration: true },
  };
}

export function indentUnit(config: Config): string {
  return config.indentStyle.kind === "tabs" ? "\t" : " ".repeat(config.indentStyle.width);
}

export function indentWidth(config: Config): number {
  return config.indentStyle.kind === "tabs" ? config.tabWidth : config.indentStyle.width;
}
