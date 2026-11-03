import type { Context } from "../core/editor";
import type { LayerResult, UiLayer } from "../core/layers";
import { add } from "../view/dom";
import { renderMarkdown } from "./markdown";

export class Popup implements UiLayer {
  readonly modal = false;
  readonly className = "hx-popup";
  anchored: number | null;

  constructor(
    readonly contents: string,
    anchor: number,
    readonly scope: string = "ui.popup",
    readonly auto = true,
  ) {
    this.anchored = anchor;
  }

  handleKey(key: string): LayerResult {
    if (key === "esc" || key === "C-c") return "close";
    return this.auto ? "close-ignored" : "ignored";
  }

  render(parent: HTMLElement): void {
    renderMarkdown(add(parent, "div", "hx-popup-body hx-s-ui-popup-info"), this.contents);
  }
}

export interface MenuItem {
  label: string;
  detail?: string;
  documentation?: string;
}

export interface MenuOptions<T> {
  items: readonly T[];
  row(item: T): MenuItem;
  onSelect(cx: Context, item: T): void;
  onPreview?(item: T | null, cx: Context): void;
  onClose?(cx: Context | null): void;
  anchor: number;
}

export class Menu<T> implements UiLayer {
  readonly modal = true;
  readonly className = "hx-menu";
  cursor: number | null = null;
  readonly anchored: number;

  constructor(readonly options: MenuOptions<T>) {
    this.anchored = options.anchor;
  }

  selected(): T | null {
    return this.cursor === null ? null : (this.options.items[this.cursor] ?? null);
  }

  private move(delta: number, cx: Context): void {
    const n = this.options.items.length;
    if (n === 0) return;
    this.cursor = this.cursor === null ? (delta > 0 ? 0 : n - 1) : (this.cursor + delta + n) % n;
    this.options.onPreview?.(this.selected(), cx);
  }

  handleKey(key: string, cx: Context): LayerResult {
    switch (key) {
      case "esc":
      case "C-c":
        this.options.onPreview?.(null, cx);
        this.options.onClose?.(cx);
        return "close";
      case "up":
      case "C-p":
      case "S-tab":
        this.move(-1, cx);
        return "consumed";
      case "down":
      case "C-n":
      case "tab":
        this.move(1, cx);
        return "consumed";
      case "ret": {
        const item = this.selected();
        if (item === null) return "ignored";
        this.options.onSelect(cx, item);
        return "close";
      }
      default:
        return "ignored";
    }
  }

  render(parent: HTMLElement): void {
    const list = add(parent, "div", "hx-menu-list hx-s-ui-menu");
    const items = this.options.items;
    const rows = items.map((item) => this.options.row(item));
    rows.forEach((row, i) => {
      const dom = add(list, "div", i === this.cursor ? "hx-menu-row hx-menu-selected hx-s-ui-menu-selected" : "hx-menu-row");
      add(dom, "span", "hx-menu-label", row.label);
      if (row.detail) add(dom, "span", "hx-menu-detail hx-s-ui-text-inactive", row.detail);
    });
    list.querySelector(".hx-menu-selected")?.scrollIntoView({ block: "nearest" });
    const documentation = this.cursor === null ? null : rows[this.cursor]?.documentation;
    if (documentation) renderMarkdown(add(parent, "div", "hx-menu-doc hx-s-ui-popup"), documentation);
  }
}
