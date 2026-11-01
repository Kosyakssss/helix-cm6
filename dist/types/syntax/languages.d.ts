import type { ChangeSet, Text } from "@codemirror/state";
import { Syntax, type Loader } from "./syntax";
export declare function createLoader(binary: Uint8Array): Promise<Loader>;
export declare function markdownSyntax(loader: Loader, text: string): Syntax;
export declare class SyntaxSessions {
    private readonly loader;
    private readonly schedule;
    private entries;
    private idle;
    constructor(loader: Loader, schedule?: ((work: () => void) => void) | null);
    open(key: unknown, doc: Text): void;
    change(key: unknown, oldDoc: Text, changes: ChangeSet, newDoc: Text): void;
    get(key: unknown, doc: Text): Syntax;
    close(key: unknown): void;
    clear(): void;
    private flush;
    private scheduleIdle;
}
