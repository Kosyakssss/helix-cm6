import type { ChangeDesc, Text } from "@codemirror/state";
import { Range, Selection } from "./selection";
import type { IndentStyle } from "./syntax/indent";
type CaseChange = "upcase" | "downcase" | "capitalize" | "pascalcase" | "camelcase";
type FormatItem = {
    kind: "text";
    text: string;
} | {
    kind: "capture";
    group: number;
} | {
    kind: "case";
    group: number;
    change: CaseChange;
} | {
    kind: "conditional";
    group: number;
    ifSet: string;
    ifUnset: string;
};
interface ParsedTransform {
    regex: string;
    replacement: FormatItem[];
    options: string;
}
type SnippetElement = {
    kind: "tabstop";
    idx: number;
} | {
    kind: "variable";
    name: string;
    fallback: SnippetElement[] | null;
    transform: Transform | null;
} | {
    kind: "text";
    text: string;
};
type TabstopKind = {
    kind: "choice";
    choices: readonly string[];
} | {
    kind: "placeholder";
    fallback: SnippetElement[];
} | {
    kind: "empty";
} | {
    kind: "transform";
    transform: Transform;
};
interface SourceTabstop {
    idx: number;
    parent: number | null;
    kind: TabstopKind;
}
declare class Transform {
    private readonly regex;
    private readonly global;
    private readonly replacement;
    private constructor();
    static create(parsed: ParsedTransform): Transform | null;
    apply(value: string): string;
}
export declare class Snippet {
    readonly elements: SnippetElement[];
    readonly tabstops: SourceTabstop[];
    static parse(source: string): Snippet | null;
    private constructor();
    private place;
    private elaborate;
    private fixup;
    private renumber;
}
export interface Span {
    start: number;
    end: number;
}
export interface RenderedTabstop {
    ranges: Span[];
    parent: number | null;
    placeholder: boolean;
    choices: readonly string[] | null;
}
export interface RenderedSnippet {
    tabstops: RenderedTabstop[];
    ranges: Span[];
}
export interface SnippetContext {
    variable(name: string): string | null;
    tabWidth: number;
    indentStyle: IndentStyle;
}
export declare function prepareRender(snippet: Snippet): RenderedSnippet;
export declare function renderSnippet(snippet: Snippet, doc: Text, selection: Selection, changeRange: (range: Range) => [number, number], context: SnippetContext): {
    changes: [number, number, string][];
    rendered: RenderedSnippet;
    primary: number;
};
export declare function firstSelection(rendered: RenderedSnippet, backward: boolean, primary: number): Selection;
export declare class ActiveSnippet {
    private readonly ranges;
    private readonly tabstops;
    private readonly active;
    private current;
    private constructor();
    static create(rendered: RenderedSnippet): ActiveSnippet | null;
    isValid(selection: Selection): boolean;
    allTabstops(): readonly RenderedTabstop[];
    deletePlaceholder(): [number, number, string][];
    map(changes: ChangeDesc): boolean;
    next(selection: Selection): [Selection, boolean];
    previous(selection: Selection): Selection | null;
    insertSubsnippet(rendered: RenderedSnippet): ActiveSnippet | null;
    private selection;
    private primaryIndex;
    private activate;
}
export {};
