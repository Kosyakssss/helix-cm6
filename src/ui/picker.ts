import type { EditorView } from "@codemirror/view";
import type { Context, HelixEditor } from "../core/editor";
import type { Host } from "../core/host";
import type { LayerResult, UiLayer } from "../core/layers";
import type { FuzzyPattern, Matcher } from "../core/matcher";
import { Prompt } from "../core/prompt";
import { highlightSpans } from "../syntax/highlight";
import { Syntax } from "../syntax/syntax";
import { add, make } from "../view/dom";
import { DEFAULT_SCOPES, scopeClass } from "./theme";

export type PickerAction = "replace" | "hsplit" | "vsplit" | "load";

export interface PickerColumn<T> {
  name: string;
  format(item: T): string;
  filter?: boolean;
  paths?: boolean;
  hidden?: boolean;
}

export interface PickerPreview {
  path?: string | null;
  text: string | null;
  language?: string | null;
  from?: number;
  to?: number;
  note?: string;
}

export interface PickerOptions<T> {
  columns: readonly PickerColumn<T>[];
  primaryColumn?: number;
  items: readonly T[] | Promise<readonly T[]> | AsyncIterable<readonly T[]>;
  onSelect(cx: Context, item: T, action: PickerAction): void;
  preview?(item: T): PickerPreview | Promise<PickerPreview> | null;
  initialQuery?: string;
  cursor?: number;
  history?: string;
  title?: string;
  dynamic?(query: string): void;
}

function columnQueries(names: readonly string[], primary: number, input: string): Map<string, string> {
  const fields = new Map<string, string>();
  const primaryField = names[primary]!;
  let escaped = false;
  let inField = false;
  let field: string | null = null;
  let text = "";
  const finish = () => {
    const key = field ?? primaryField;
    field = null;
    const pat = text.endsWith(" ") ? text.slice(0, -1) : text;
    const existing = fields.get(key);
    fields.set(key, existing === undefined ? pat : `${existing} ${pat}`);
    text = "";
  };
  for (const ch of input) {
    if (escaped) {
      if (ch !== "%") text += "\\";
      text += ch;
      escaped = false;
    } else if (ch === "\\") escaped = !escaped;
    else if (ch === "%") {
      if (text !== "") finish();
      inField = true;
    } else if (ch === " " && inField) {
      text = "";
      inField = false;
    } else if (inField) {
      text += ch;
      let best: string | null = null;
      for (const name of names) if (name.startsWith(text) && (best === null || name.length < best.length)) best = name;
      field = best;
    } else text += ch;
  }
  if (!inField && text !== "") finish();
  return fields;
}

const PAGE_SIZE = 20;

interface Matched<T> {
  item: T;
  index: number;
  score: number;
  length: number;
}

export class Picker<T> implements UiLayer {
  readonly modal = true;
  readonly anchored = null;
  readonly className = "hx-picker";
  private readonly prompt: Prompt;
  private all: T[] = [];
  private matches: Matched<T>[] = [];
  private cursor = 0;
  private showPreview = true;
  private patterns = new Map<number, FuzzyPattern>();
  private previewCache = new Map<T, PickerPreview | null>();
  private streaming = false;
  private readonly filtered: { column: PickerColumn<T>; index: number }[];
  private readonly names: string[];
  private readonly primary: number;

  constructor(
    private readonly editor: HelixEditor,
    private readonly host: Host,
    private readonly matcher: Matcher,
    readonly options: PickerOptions<T>,
  ) {
    this.prompt = new Prompt(editor, host, { label: "", initial: options.initialQuery ?? "", onAccept: () => {} });
    this.filtered = options.columns.flatMap((column, index) => (column.filter === false ? [] : [{ column, index }]));
    this.names = options.columns.map((c) => c.name);
    this.primary = options.primaryColumn ?? 0;
    this.cursor = options.cursor ?? 0;
    this.loadItems();
    this.refilter();
    if (options.cursor !== undefined) this.cursor = Math.min(options.cursor, Math.max(this.matches.length - 1, 0));
  }

  private loadItems(): void {
    const items = this.options.items;
    if (Array.isArray(items)) {
      this.all = [...(items as readonly T[])];
    } else if (items instanceof Promise) {
      this.streaming = true;
      void items.then((list) => this.addItems(list, true)).catch(() => this.addItems([], true));
    } else {
      this.streaming = true;
      void this.consume(items as AsyncIterable<readonly T[]>);
    }
  }

  private async consume(items: AsyncIterable<readonly T[]>): Promise<void> {
    for await (const batch of items) this.addItems(batch, false);
    this.addItems([], true);
  }

  private addItems(list: readonly T[], finished: boolean): void {
    this.all.push(...list);
    if (finished) this.streaming = false;
    this.refilter();
    this.requestRender();
  }

  replaceItems(list: readonly T[]): void {
    this.all = [...list];
    this.refilter();
    this.requestRender();
  }

  private requestRender(): void {
    this.editor.renderLayers(this.host);
  }

  private freePatterns(): void {
    for (const pattern of this.patterns.values()) pattern.free();
    this.patterns.clear();
  }

  private refilter(): void {
    this.freePatterns();
    const queries = columnQueries(this.names, this.primary, this.prompt.line);
    for (const { column, index } of this.filtered) {
      const query = queries.get(column.name);
      if (query) this.patterns.set(index, this.matcher.pattern(query));
    }
    const out: Matched<T>[] = [];
    this.all.forEach((item, index) => {
      let score = 0;
      let length = 0;
      for (const { column, index: c } of this.filtered) {
        const text = column.format(item);
        length += text.length;
        const pattern = this.patterns.get(c);
        if (!pattern) continue;
        const s = pattern.score(text, column.paths === true);
        if (s === null) return;
        score += s;
      }
      out.push({ item, index, score, length });
    });
    if (this.patterns.size > 0) out.sort((a, b) => b.score - a.score || a.length - b.length || a.index - b.index);
    this.matches = out;
    this.cursor = 0;
  }

  private move(delta: number): void {
    const n = this.matches.length;
    if (n === 0) return;
    this.cursor = (this.cursor + delta + n * 1024) % n;
  }

  selection(): T | null {
    return this.matches[this.cursor]?.item ?? null;
  }

  matchCount(): number {
    return this.matches.length;
  }

  itemCount(): number {
    return this.all.length;
  }

  query(): string {
    return this.prompt.line;
  }

  handleKey(key: string, cx: Context): LayerResult {
    switch (key) {
      case "S-tab":
      case "up":
      case "C-p":
        this.move(-1);
        return "consumed";
      case "tab":
      case "down":
      case "C-n":
        this.move(1);
        return "consumed";
      case "pagedown":
      case "C-d":
        this.cursor = Math.min(this.matches.length - 1, this.cursor + PAGE_SIZE);
        if (this.cursor < 0) this.cursor = 0;
        return "consumed";
      case "pageup":
      case "C-u":
        this.cursor = Math.max(0, this.cursor - PAGE_SIZE);
        return "consumed";
      case "home":
        this.cursor = 0;
        return "consumed";
      case "end":
        this.cursor = Math.max(0, this.matches.length - 1);
        return "consumed";
      case "esc":
      case "C-c":
        return "close";
      case "A-ret": {
        const item = this.selection();
        if (item !== null) this.options.onSelect(cx, item, "load");
        return "consumed";
      }
      case "ret": {
        const item = this.selection();
        if (item !== null) this.options.onSelect(cx, item, "replace");
        return "close";
      }
      case "C-s": {
        const item = this.selection();
        if (item !== null) this.options.onSelect(cx, item, "hsplit");
        return "close";
      }
      case "C-v": {
        const item = this.selection();
        if (item !== null) this.options.onSelect(cx, item, "vsplit");
        return "close";
      }
      case "C-t":
        this.showPreview = !this.showPreview;
        return "consumed";
      default: {
        const before = this.prompt.line;
        const result = this.prompt.handleKey(key);
        if (result === "closed") return "close";
        if (this.prompt.line !== before) {
          this.options.dynamic?.(this.prompt.line);
          this.refilter();
        }
        return "consumed";
      }
    }
  }

  private cellText(parent: HTMLElement, column: PickerColumn<T>, index: number, item: T): void {
    const text = column.format(item);
    const pattern = this.patterns.get(index);
    if (!pattern) {
      parent.textContent = text;
      return;
    }
    const hits = new Set(pattern.indices(text, column.paths === true));
    let run = "";
    let runHit = false;
    let i = 0;
    const flush = () => {
      if (run === "") return;
      if (runHit) add(parent, "span", "hx-picker-hit hx-s-special", run);
      else parent.append(run);
      run = "";
    };
    for (const ch of text) {
      const hit = hits.has(i++);
      if (hit !== runHit) flush();
      runHit = hit;
      run += ch;
    }
    flush();
  }

  private renderList(parent: HTMLElement): void {
    const left = add(parent, "div", "hx-picker-list");
    const head = add(left, "div", "hx-picker-prompt");
    add(head, "span", undefined, this.prompt.line.slice(0, this.prompt.cursor));
    add(head, "span", "hx-prompt-cursor", this.prompt.line.slice(this.prompt.cursor, this.prompt.cursor + 1) || " ");
    add(head, "span", undefined, this.prompt.line.slice(this.prompt.cursor + 1));
    add(head, "span", "hx-picker-count hx-s-ui-text-inactive", `${this.matches.length ? this.cursor + 1 : 0}/${this.matches.length}${this.all.length !== this.matches.length ? ` (${this.all.length})` : ""}${this.streaming ? " …" : ""}`);
    const columns = this.options.columns.filter((c) => !c.hidden);
    const table = add(left, "div", "hx-picker-rows");
    table.style.setProperty("--hx-picker-columns", columns.map((_, i) => (i === columns.length - 1 ? "1fr" : "auto")).join(" "));
    if (columns.length > 1) {
      const header = add(table, "div", "hx-picker-row hx-picker-header hx-s-ui-picker-header");
      for (const column of columns) add(header, "span", "hx-picker-cell hx-s-ui-picker-header-column", column.name);
    }
    const rows = 256;
    const start = Math.max(0, Math.min(this.cursor - Math.floor(rows / 2), this.matches.length - rows));
    for (let i = start; i < Math.min(this.matches.length, start + rows); i++) {
      const row = add(table, "div", i === this.cursor ? "hx-picker-row hx-picker-selected hx-s-ui-text-focus" : "hx-picker-row");
      const item = this.matches[i]!.item;
      for (const column of columns) this.cellText(add(row, "span", "hx-picker-cell"), column, this.options.columns.indexOf(column), item);
    }
    table.querySelector(".hx-picker-selected")?.scrollIntoView({ block: "nearest" });
  }

  private renderPreview(parent: HTMLElement): void {
    const box = add(parent, "div", "hx-picker-preview");
    const item = this.selection();
    if (item === null || !this.options.preview) return;
    if (!this.previewCache.has(item)) {
      const result = this.options.preview(item);
      if (result instanceof Promise) {
        this.previewCache.set(item, null);
        void result.then((preview) => {
          this.previewCache.set(item, preview);
          this.requestRender();
        });
      } else this.previewCache.set(item, result);
    }
    const preview = this.previewCache.get(item);
    if (!preview) {
      add(box, "div", "hx-picker-note", "<File not found>");
      return;
    }
    if (preview.note) add(box, "div", "hx-picker-note", preview.note);
    if (preview.text === null) return;
    const body = add(box, "div", "hx-picker-preview-body");
    renderPreviewText(body, this.editor, preview);
    body.querySelector(".hx-picker-focus")?.scrollIntoView({ block: "center" });
  }

  render(parent: HTMLElement, view: EditorView): void {
    this.renderList(parent);
    if (this.showPreview && this.options.preview && parent.getBoundingClientRect().width / view.defaultCharacterWidth > 72) this.renderPreview(parent);
  }

  closed(): void {
    this.freePatterns();
  }
}

const MAX_PREVIEW_LINES = 2000;

function renderPreviewText(parent: HTMLElement, editor: HelixEditor, preview: PickerPreview): void {
  const doc = parent.ownerDocument;
  const text = preview.text!;
  const language = preview.language ? editor.languages?.languageForName(preview.language) : preview.path ? editor.languages?.languageForFilename(preview.path) : null;
  const scopes = editor.theme?.scopes ?? DEFAULT_SCOPES;
  let spans: { from: number; to: number; cls: string }[] = [];
  const clipped = text.split("\n").slice(0, MAX_PREVIEW_LINES).join("\n");
  if (language !== null && language !== undefined && editor.languages?.isLoaded(language) && editor.languages.getConfig(language)) {
    try {
      const syntax = new Syntax(editor.languages, clipped, language);
      spans = highlightSpans(syntax, scopes, 0, syntax.byteLength).map((s) => ({ from: syntax.posOf(s.from), to: syntax.posOf(s.to), cls: s.scopes.map((h) => scopeClass(scopes[h]!)).join(" ") }));
      syntax.delete();
    } catch {
      spans = [];
    }
  } else if (language !== null && language !== undefined) void editor.languages?.load(language);
  let pos = 0;
  let spanIndex = 0;
  const lines = clipped.split("\n");
  for (const line of lines) {
    const lineEnd = pos + line.length;
    const focused = preview.from !== undefined && preview.to !== undefined && lineEnd >= preview.from && pos <= preview.to;
    const row = make(doc, "div", focused ? "hx-picker-preview-line hx-picker-focus hx-s-ui-highlight" : "hx-picker-preview-line");
    let at = pos;
    while (spanIndex < spans.length && spans[spanIndex]!.to <= pos) spanIndex++;
    for (let i = spanIndex; i < spans.length && spans[i]!.from < lineEnd; i++) {
      const span = spans[i]!;
      const from = Math.max(span.from, pos);
      const to = Math.min(span.to, lineEnd);
      if (from > at) row.append(text.slice(at, from));
      if (to > from) add(row, "span", span.cls, text.slice(from, to));
      at = Math.max(at, to);
    }
    if (at < lineEnd) row.append(text.slice(at, lineEnd));
    if (line === "") row.append("​");
    parent.appendChild(row);
    pos = lineEnd + 1;
  }
}
