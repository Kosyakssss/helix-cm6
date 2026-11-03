import type { Extension } from "@codemirror/state";
import type { ThemeOptions } from "./themes";
import { helixBufferline } from "./bufferline";
import { helixCompletion } from "./completion";
import { helixDecorations } from "./decorations";
import { helixDiagnostics } from "./diagnostics";
import { helixDiff } from "./diff";
import { gutterExtension, gutterTheme } from "./gutters";
import { helixHighlighting } from "./highlight";
import { helixOverlays } from "./overlay";
import { helixStatusline, statuslineTheme } from "./statusline";
import { helixThemes } from "./themes";

export function helixGutters(layout: readonly string[] = ["diagnostics", "spacer", "line-numbers", "spacer", "diff"]): Extension {
  return [gutterExtension(layout), gutterTheme];
}

export interface HelixUiOptions extends ThemeOptions {
  gutters?: readonly string[] | false;
  statusline?: boolean;
  bufferline?: boolean;
}

export function helixUi(options: HelixUiOptions = {}): Extension {
  return [
    helixThemes(options),
    helixHighlighting(),
    helixDecorations(),
    helixOverlays(),
    helixCompletion(),
    helixDiagnostics(),
    helixDiff(),
    options.gutters === false ? [] : helixGutters(options.gutters),
    options.statusline === false ? [] : [helixStatusline(), statuslineTheme],
    options.bufferline === false ? [] : helixBufferline(),
  ];
}

export { helixBufferline, helixCompletion, helixDecorations, helixDiagnostics, helixDiff, helixHighlighting, helixOverlays, helixStatusline, helixThemes };
export { helixSetDiffBase } from "./diff";
export { parseTheme, type Theme, type ThemeStyle } from "./theme";
export type { ThemeOptions } from "./themes";
export { statuslineOf, type StatusPart, type Statusline } from "./statusline";
export { Picker, type PickerAction, type PickerColumn, type PickerOptions, type PickerPreview } from "./picker";
export { Menu, Popup, type MenuItem, type MenuOptions } from "./menu";
