export interface KeyEvent {
    readonly code: string;
    readonly ctrl: boolean;
    readonly alt: boolean;
    readonly shift: boolean;
    readonly meta: boolean;
}
export declare function parseKey(input: string): KeyEvent;
export declare function formatKey(key: KeyEvent): string;
export declare function canonicalizeKey(key: KeyEvent): KeyEvent;
export declare function normalizeKeyString(input: string): string;
export declare function isCharCode(code: string): boolean;
export declare function keyChar(key: string): string | null;
export declare function keyCharUnmodified(key: string): string | null;
export declare function parseMacro(input: string): string[];
export declare function keySequenceFormat(key: string): string;
export interface DomKeyLike {
    readonly key: string;
    readonly code: string;
    readonly ctrlKey: boolean;
    readonly altKey: boolean;
    readonly shiftKey: boolean;
    readonly metaKey: boolean;
}
export declare function keyFromDom(e: DomKeyLike, literal: boolean, physical?: boolean): string | null;
