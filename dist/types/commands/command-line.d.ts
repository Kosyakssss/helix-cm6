export declare function split(line: string): [string, string, boolean];
export interface Flag {
    name: string;
    alias?: string;
    doc: string;
    completions?: readonly string[];
}
export interface Signature {
    positionals: [number, number | null];
    rawAfter?: number;
    flags?: readonly Flag[];
}
export declare class ParseArgsError extends Error {
}
export declare const SHELL_SIGNATURE: Signature;
export type ExpansionKind = "variable" | "unicode" | "shell" | "register";
export type TokenKind = {
    kind: "unquoted";
} | {
    kind: "quoted";
    quote: "'" | "`";
} | {
    kind: "expand";
} | {
    kind: "expansion";
    expansion: ExpansionKind;
} | {
    kind: "expansion-kind";
};
export interface Token {
    kind: TokenKind;
    contentStart: number;
    content: string;
    isTerminated: boolean;
}
export declare class Tokenizer {
    private readonly input;
    private readonly validate;
    pos: number;
    constructor(input: string, validate: boolean);
    rest(): Token | null;
    private byte;
    private prevByte;
    private skipBlanks;
    private parseUnquoted;
    private parseQuoted;
    parsePercentToken(): Token;
    private parseQuotedBalanced;
    next(): Token | null;
}
export type CompletionState = {
    kind: "positional";
} | {
    kind: "flag";
    flag: Flag | null;
} | {
    kind: "flag-argument";
    flag: Flag;
};
export declare class Args {
    readonly signature: Signature;
    private readonly validate;
    private onlyPositionals;
    state: CompletionState;
    readonly positional: string[];
    readonly flags: Map<string, string>;
    constructor(signature: Signature, validate: boolean);
    readToken(parser: Tokenizer): Token | null;
    static parse(line: string, signature: Signature, validate: boolean, map: (token: Token) => string): Args;
    static parseAsync(line: string, signature: Signature, map: (token: Token) => string | Promise<string>): Args | Promise<Args>;
    push(arg: string): void;
    private finish;
    private flagAwaitingArgument;
    join(sep: string): string;
    hasFlag(name: string): boolean;
    getFlag(name: string): string | undefined;
}
