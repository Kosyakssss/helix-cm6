export type IndentStyle = {
    kind: "tabs";
} | {
    kind: "spaces";
    width: number;
};
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
    characters: {
        space: string;
        nbsp: string;
        nnbsp: string;
        tab: string;
        newline: string;
        tabpad: string;
    };
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
    smartTab: {
        enable: boolean;
        supersedeMenu: boolean;
    };
    search: {
        smartCase: boolean;
        wrapAround: boolean;
    };
    cursorShape: {
        normal: string;
        insert: string;
        select: string;
    };
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
    gutters: {
        layout: string[];
        lineNumbersMinWidth: number;
    };
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
    wordCompletion: {
        enable: boolean;
        triggerLength: number;
    };
    autoFormat: boolean;
    endOfLineDiagnostics: string;
    inlineDiagnostics: {
        cursorLine: string;
        otherLines: string;
        minDiagnosticWidth: number;
        prefixLen: number;
        maxWrap: number;
        maxDiagnostics: number;
    };
    filePicker: {
        hidden: boolean;
        followSymlinks: boolean;
        deduplicateLinks: boolean;
        parents: boolean;
        ignore: boolean;
        gitIgnore: boolean;
        gitGlobal: boolean;
        gitExclude: boolean;
        maxDepth: number | null;
    };
    bufferPicker: {
        startPosition: "current" | "previous";
    };
    mouse: boolean;
    middleClickPaste: boolean;
    defaultLineEnding: string;
    lsp: {
        enable: boolean;
        displayMessages: boolean;
        displayProgressMessages: boolean;
        autoSignatureHelp: boolean;
        displayInlayHints: boolean;
        displayColorSwatches: boolean;
        displaySignatureHelpDocs: boolean;
        snippets: boolean;
        gotoReferenceIncludeDeclaration: boolean;
    };
}
export declare const DEFAULT_AUTO_PAIRS: [string, string][];
export declare function defaultConfig(): Config;
export declare function indentUnit(config: Config): string;
export declare function indentWidth(config: Config): number;
