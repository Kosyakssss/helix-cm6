export type ClipboardType = "clipboard" | "selection";
export interface ClipboardProvider {
    name(): string;
    get(type: ClipboardType): string;
    set(contents: string, type: ClipboardType): void;
}
export declare class MemoryClipboard implements ClipboardProvider {
    private readonly hasPrimary;
    private contents;
    constructor(hasPrimary?: boolean);
    name(): string;
    get(type: ClipboardType): string;
    set(contents: string, type: ClipboardType): void;
}
export interface RegisterEnv {
    selectionCount(): number;
    selectionFragments(): string[];
    documentName(): string;
}
export declare class Registers {
    clipboard: ClipboardProvider;
    private inner;
    lastSearchRegister: string;
    constructor(clipboard: ClipboardProvider);
    read(name: string, env: RegisterEnv): string[] | null;
    write(name: string, values: string[]): void;
    push(name: string, value: string): void;
    first(name: string, env: RegisterEnv): string | null;
    last(name: string, env: RegisterEnv): string | null;
    remove(name: string): boolean;
    clear(): void;
    preview(): [string, string][];
    private readClipboard;
}
