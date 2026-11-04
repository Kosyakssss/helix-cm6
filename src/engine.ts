export { helix, helixDocument, helixEditor, helixKeys, helixRun, helixStatus, type GrammarSource, type HelixDocument, type HelixOptions } from "./codemirror";
export { helixExtension, uiRefresher, uiSignature, type ViewEnv } from "./view/view";
export { loadRegex, wasmBytes, type WasmBytes, type WasmSource } from "./view/wasm";
export { loadSyntax } from "./view/syntax";
export { onHelixStatus, statusOf, type HelixStatus } from "./view/status";
export { makeViewOps } from "./view/viewops";
export { SystemClipboard } from "./view/clipboard";

export {
  HelixEditor,
  Context,
  type HandleKeyOptions,
  type JumpLabel,
  type OnKeyCallback,
  type OnKeyKind,
  type PromptRequest,
  type Status,
  type UiHooks,
  type ViewOps,
  type Workspace,
} from "./core/editor";
export { HeadlessHost, type Host } from "./core/host";
export { helixHooks, type EdgeDirection, type HelixEdge, type HelixHooks, type MotionRange } from "./hooks";
export { compilePattern, escapeRegex, type Pattern } from "./core/regex";
export { RustRegexEngine } from "./core/rx";
export { charAt, charBefore } from "./core/text";
export { print, plain } from "./core/markup";

export {
  dropSelectionChange,
  fromNative,
  helixField,
  helixOwned,
  historyField,
  setHelix,
  syncNativeSelection,
  toNative,
  type HelixState,
  type Mode,
} from "./state";
export { Range, Selection, type Direction } from "./selection";
export { MemoryClipboard, Registers, type ClipboardProvider, type ClipboardType, type RegisterEnv } from "./registers";
export { buildKeymaps } from "./keymap";
export { formatKey, keyFromDom, parseKey, parseMacro, type KeyEvent } from "./keys";
export { defaultConfig, type Config } from "./config";
export { loadConfig, type LoadedConfig } from "./config-loader";
export { nextGraphemeBoundary, prevGraphemeBoundary } from "./graphemes";

export { commitHistoryNow, jumplistFor, pushJump, type Jump } from "./commands/jumps";
export { gotoLineWithoutJumplist } from "./commands/motion";
export { docOf, selOf, setSel } from "./commands/util";
export { pasteImpl } from "./commands/edit";
export type { CommentTokens } from "./commands/comments";
export type { ShellBehavior, ShellOutput, ShellRunner } from "./commands/shell";
export { createLoader, MARKDOWN_LANGUAGES, SyntaxSessions, type LoaderOptions } from "./syntax/languages";
export { LanguageLoader, type LanguageSource, type QueryFile } from "./syntax/loader";
export { parseLanguagesToml, type LanguageConfiguration } from "./syntax/config";
export type { LanguageId } from "./syntax/injections";
export type { Syntax } from "./syntax/syntax";
export * from "./ui";
export { setDiagnostics, diagnosticsField, type Diagnostic, type Severity } from "./diagnostics";
export { Matcher, FuzzyPattern, type Hunk } from "./core/matcher";
export type { CodeAction, CompletionItem, FileTarget, LanguageFeatures, Location, LocationKind, SearchMatch, SignatureHelp, SymbolInfo, TextEdit, WorkspaceBuffer, WorkspaceProviders } from "./commands/workspace";
export type { UiLayer, LayerResult } from "./core/layers";
export { helixEnv } from "./view/view";
