import type { EditorView } from "@codemirror/view";
import type { Context } from "./editor";

export type LayerResult = "consumed" | "ignored" | "close" | "close-ignored";

export interface UiLayer {
  handleKey(key: string, cx: Context): LayerResult;
  render(parent: HTMLElement, view: EditorView): void;
  closed?(): void;
  readonly modal?: boolean;
  readonly anchored?: number | null;
  readonly className?: string;
}
