import type { ClipboardProvider, ClipboardType } from "../registers";
export declare class SystemClipboard implements ClipboardProvider {
    private cache;
    name(): string;
    get(type: ClipboardType): string;
    set(contents: string, type: ClipboardType): void;
    refresh(): void;
}
