import { Keymaps, type MappableCommand, type TrieNode } from "../keymap/trie";
import { Registers, type RegisterEnv } from "../registers";
import { type Config } from "../config";
import { type Host } from "./host";
import { Prompt, type Completion } from "./prompt";
import { JumpList, type Jump } from "../commands/jumps";
import type { ShellRunner } from "../commands/shell";
import { type CommentTokens } from "../commands/comments";
import type { Syntax } from "../syntax/syntax";
import type { LanguageConfiguration } from "../syntax/config";
import type { LanguageId } from "../syntax/injections";
import type { LanguageLoader } from "../syntax/loader";
import { type IndentStyle } from "../syntax/indent";
import type { Selection } from "../selection";
import type { RustRegexEngine } from "./rx";
import type { ActiveSnippet } from "../snippets";
import { type AppCommand, type HelixApp } from "../commands/app";
export type OnKeyCallback = (cx: Context, key: string) => void;
export type OnKeyKind = "pseudoPending" | "fallback";
export interface Status {
    message: string;
    severity: "info" | "error";
}
export declare class Context {
    readonly editor: HelixEditor;
    readonly host: Host;
    countRaw: number | null;
    register: string | null;
    onNextKeyCallback: {
        cb: OnKeyCallback;
        kind: OnKeyKind;
    } | null;
    readonly callbacks: (() => void)[];
    constructor(editor: HelixEditor, host: Host, countRaw: number | null, register: string | null);
    count(): number;
    onNextKey(cb: OnKeyCallback, kind?: OnKeyKind): void;
}
export interface HandleKeyOptions {
    nativeInsert?: boolean;
    passThrough?: (key: string) => boolean;
}
export interface PromptRequest {
    label: string;
    initial?: string;
    history?: string;
    complete?: (input: string) => Completion[];
    onChange?: (input: string) => void;
    onAccept: (input: string) => void;
    onCancel?: () => void;
    wordUnderCursor?: () => string;
}
export interface JumpLabel {
    pos: number;
    text: string;
}
export interface UiHooks {
    notify?(status: Status): void;
    render?(host: Host): void;
    promptChanged?(host: Host, prompt: Prompt | null): void;
    jumpLabels?(host: Host, labels: JumpLabel[]): void;
}
export interface ViewOps {
    scroll(cx: Context, amount: number | "page" | "half", dir: "forward" | "backward", syncCursor: boolean): void;
    alignView(cx: Context, align: "top" | "center" | "bottom"): void;
    gotoWindow(cx: Context, align: "top" | "center" | "bottom"): void;
    visibleRange(host: Host): [number, number];
}
export declare class HelixEditor {
    keymaps: Keymaps;
    registers: Registers;
    config: Config;
    count: number | null;
    selectedRegister: string | null;
    onNextKeyState: {
        cb: OnKeyCallback;
        kind: OnKeyKind;
    } | null;
    pseudoPending: string[];
    lastInsert: {
        command: MappableCommand;
        keys: string[];
    };
    macroRecording: {
        register: string;
        keys: string[];
    } | null;
    macroReplaying: string[];
    lastMotion: ((cx: Context) => void) | null;
    status: Status | null;
    autoinfo: TrieNode | {
        title: string;
        body: [string, string][];
    } | null;
    ui: UiHooks;
    app: HelixApp | null;
    snippets: Map<string, ActiveSnippet>;
    viewOps: ViewOps | null;
    activePrompt: Prompt | null;
    visualLines: boolean;
    finalLineIsLine: boolean;
    wholeLineSelection: Selection | null;
    helixAutoPairs: boolean;
    continueLists: boolean;
    jumpLabels: Map<string, JumpLabel[]>;
    commentTokens: ((host: Host, pos: number) => CommentTokens) | null;
    syntax: ((host: Host) => Syntax | null) | null;
    languages: LanguageLoader | null;
    documentLanguage: {
        get(host: Host): LanguageId | null;
        set(host: Host, language: LanguageId | null): void;
    } | null;
    regex: RustRegexEngine | null;
    pathCompleter: ((prefix: string) => string[]) | null;
    shell: ShellRunner | null;
    private busy;
    private queuedKeys;
    gotoPreview: Selection | null;
    onConfigChanged: (() => void) | null;
    replayKeyHook: ((host: Host, key: string) => boolean) | null;
    onNextKeyCleanup: (() => void)[];
    private jumplists;
    private objectSelectionStacks;
    constructor(keymaps: Keymaps, config?: Config);
    setStatus(message: string): void;
    setError(message: string): void;
    keyChar(key: string): string | null;
    parseMacro(keys: string): string[];
    registerEnv(host: Host): RegisterEnv;
    autoinfoRegisters(title: string): void;
    objectSelections(host: Host): Selection[];
    jumplist(host: Host): JumpList;
    docChanged(host: Host, changes: import("@codemirror/state").ChangeDesc): void;
    checkSnippet(host: Host): void;
    resetJumplists(): void;
    allJumplists(): Iterable<JumpList>;
    jumpTo(cx: Context, jump: Jump): void;
    runStatic(cx: Context, name: string): void;
    appCommand(name: string): AppCommand | null;
    runApp(cx: Context, name: string, args?: readonly string[]): boolean;
    scroll(cx: Context, amount: number | "page" | "half", dir: "forward" | "backward", sync: boolean): void;
    alignView(cx: Context, align: "top" | "center" | "bottom"): void;
    gotoWindow(cx: Context, align: "top" | "center" | "bottom"): void;
    visibleRange(host: Host): [number, number];
    setJumpLabels(host: Host, labels: JumpLabel[]): void;
    runComments(cx: Context, kind: "toggle" | "line" | "block"): void;
    setOption(cx: Context, args: string[]): void;
    toggleOption(cx: Context, args: string[]): void;
    getOption(cx: Context, args: string[]): void;
    prompt(cx: Context, request: PromptRequest): void;
    commandMode(cx: Context): void;
    languageConfig(host: Host): LanguageConfiguration | null;
    indentStyles: Map<string, IndentStyle>;
    indent(host: Host): {
        style: IndentStyle;
        tabWidth: number;
    };
    detectIndent(host: Host): void;
    languageName(host: Host): string | null;
    private savedRevisions;
    isModified(host: Host): boolean;
    markSaved(host: Host): void;
    focusedHost(host: Host): Host;
    isBusy(): boolean;
    whileBusy(work: void | Promise<void>): void | Promise<void>;
    handleKey(host: Host, key: string, options?: HandleKeyOptions): boolean;
    feedKeys(host: Host, keys: string, options?: HandleKeyOptions): void;
    pendingDisplay(): string;
    private onNextKey;
    private handleKeymapEvent;
    private insertMode;
    insertChar(cx: Context, ch: string): void;
    private commandMode_;
    runTypable(cx: Context, input: string): void;
    commandDoc(name: string): string;
    hasCommand(name: string): boolean;
}
