import type { HelixEditor, PromptRequest } from "./editor";
import type { Host } from "./host";
export interface Completion {
    start: number;
    text: string;
    label: string;
}
export declare class Prompt {
    readonly editor: HelixEditor;
    readonly host: Host;
    readonly request: PromptRequest;
    line: string;
    cursor: number;
    completions: Completion[];
    selection: number | null;
    historyPos: number | null;
    private nextCharHandler;
    private original;
    constructor(editor: HelixEditor, host: Host, request: PromptRequest);
    get label(): string;
    recalculateCompletion(): void;
    private update;
    insertStr(s: string): void;
    private prevBoundary;
    private nextBoundary;
    private wordBackward;
    private wordForward;
    private changeHistory;
    private changeCompletion;
    handleKey(key: string): "consumed" | "closed";
}
