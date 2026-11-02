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
}
export declare const DEFAULT_AUTO_PAIRS: [string, string][];
export declare function defaultConfig(): Config;
export declare function indentUnit(config: Config): string;
export declare function indentWidth(config: Config): number;
