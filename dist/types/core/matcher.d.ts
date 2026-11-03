export interface Hunk {
    beforeStart: number;
    beforeEnd: number;
    afterStart: number;
    afterEnd: number;
}
export declare class FuzzyPattern {
    private readonly matcher;
    readonly ptr: number;
    constructor(matcher: Matcher, ptr: number);
    score(text: string, paths?: boolean): number | null;
    indices(text: string, paths?: boolean): number[];
    free(): void;
}
export declare class Matcher {
    private readonly x;
    private constructor();
    static load(bytes: Uint8Array): Promise<Matcher>;
    private withText;
    pattern(text: string): FuzzyPattern;
    freePattern(pattern: FuzzyPattern): void;
    score(pattern: FuzzyPattern, text: string, paths: boolean): number | null;
    indices(pattern: FuzzyPattern, text: string, paths: boolean): number[];
    diff(before: string, after: string): Hunk[];
}
