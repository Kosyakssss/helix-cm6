import type { Extension } from "@codemirror/state";
import type { HelixEditor } from "../core/editor";
import { type Theme, type ThemeLoader } from "./theme";
export declare function themeCss(theme: Theme, root: string): string;
export interface ThemeOptions {
    theme?: string;
    themes?: Record<string, string>;
    load?: ThemeLoader;
    names?: () => string[];
}
export declare function setEditorThemes(editor: HelixEditor, options: ThemeOptions): void;
export declare function helixThemes(options?: ThemeOptions): Extension;
