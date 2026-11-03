export type TomlTable = Record<string, unknown>;
export interface ThemeStyle {
    fg?: string;
    bg?: string;
    underlineColor?: string;
    underlineStyle?: string;
    modifiers: string[];
}
export interface Theme {
    name: string;
    styles: Map<string, ThemeStyle>;
    scopes: string[];
    rainbowLength: number;
    warnings: string[];
}
export type ThemeLoader = (name: string) => string | null;
export declare function parseTheme(name: string, text: string, load?: ThemeLoader | null): Theme;
export declare function themeStyle(theme: Theme, scope: string): ThemeStyle | null;
export declare function scopeClass(scope: string): string;
export declare function styleCss(style: ThemeStyle): string;
export declare const DEFAULT_SCOPES: readonly string[];
