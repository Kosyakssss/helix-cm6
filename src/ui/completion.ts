import type { Extension, Text } from "@codemirror/state";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { Context, type HelixEditor } from "../core/editor";
import type { Host } from "../core/host";
import { helixField } from "../state";
import type { CompletionItem } from "../commands/workspace";
import { nextGraphemeBoundary } from "../graphemes";
import { helixEnv } from "../view/view";
import { Menu } from "./menu";
import { apply, changeSetOf, docOf, selOf } from "../commands/util";
import { commitHistoryNow } from "../commands/jumps";

const WORD = /[\p{Alphabetic}\p{N}_-]/u;

function wordStart(doc: Text, pos: number): number {
  const line = doc.lineAt(pos);
  let at = pos - line.from;
  while (at > 0 && WORD.test(line.text[at - 1]!)) at--;
  return line.from + at;
}

function buffersWords(doc: Text, minLength: number, skipFrom: number, skipTo: number): CompletionItem[] {
  const seen = new Set<string>();
  const text = doc.toString();
  for (const m of text.matchAll(/[\p{Alphabetic}\p{N}_][\p{Alphabetic}\p{N}_-]*/gu)) {
    if (m[0].length < minLength) continue;
    if (m.index >= skipFrom && m.index < skipTo) continue;
    seen.add(m[0]);
    if (seen.size >= 512) break;
  }
  return [...seen].map((label) => ({ label, detail: "word" }));
}

export class CompletionController {
  menu: Menu<CompletionItem> | null = null;
  private start = 0;
  private items: readonly CompletionItem[] = [];
  private cx: Context | null = null;
  private applying = false;
  private previewed: { from: number; to: number; original: string } | null = null;
  private timer: number | null = null;
  private request = 0;

  constructor(
    readonly editor: HelixEditor,
    readonly host: Host,
  ) {}

  close(): void {
    this.request++;
    if (this.timer !== null) this.window()?.clearTimeout(this.timer);
    this.timer = null;
    if (this.menu) this.editor.removeLayer(this.menu, this.host);
    this.menu = null;
    this.previewed = null;
  }

  private cursor(): number {
    return selOf({ host: this.host } as Context).primary().cursor(docOf({ host: this.host } as Context));
  }

  private filtered(prefix: string): CompletionItem[] {
    const matcher = this.editor.matcher;
    if (!matcher) return this.items.filter((i) => (i.filterText ?? i.label).startsWith(prefix));
    if (prefix === "") return [...this.items];
    const pattern = matcher.pattern(prefix);
    try {
      const scored: { item: CompletionItem; score: number; index: number }[] = [];
      this.items.forEach((item, index) => {
        const score = pattern.score(item.filterText ?? item.label);
        if (score !== null) scored.push({ item, score, index });
      });
      scored.sort((a, b) => b.score - a.score || a.index - b.index);
      return scored.map((s) => s.item);
    } finally {
      pattern.free();
    }
  }

  private show(prefix: string): void {
    const items = this.filtered(prefix);
    if (this.menu) this.editor.removeLayer(this.menu, this.host);
    this.menu = null;
    if (items.length === 0) return;
    this.menu = new Menu<CompletionItem>({
      items,
      anchor: this.start,
      row: (item) => ({ label: item.label, detail: item.detail, documentation: item.documentation }),
      onSelect: (cx, item) => this.accept(cx, item),
      onPreview: (item, cx) => this.preview(item, cx),
      onClose: () => {
        this.menu = null;
      },
    });
    this.editor.pushLayer(this.menu, this.host);
  }

  private replaceWord(cx: Context, text: string, from: number, to: number): void {
    const doc = docOf(cx);
    const sel = selOf(cx);
    const primary = sel.primary();
    const cursor = primary.cursor(doc);
    const before = cursor - from;
    const after = to - cursor;
    const changes: [number, number, string][] = sel.ranges.map((range) => {
      const at = range.cursor(doc);
      return [Math.max(0, at - before), Math.min(doc.length, at + after), text];
    });
    this.applying = true;
    try {
      apply(cx, changeSetOf(doc, changes));
    } finally {
      this.applying = false;
    }
  }

  private preview(item: CompletionItem | null, cx: Context): void {
    if (!this.editor.config.previewCompletionInsert) return;
    const cursor = this.cursor();
    const current = this.previewed;
    const from = current?.from ?? item?.from ?? this.start;
    const to = current?.to ?? item?.to ?? cursor;
    const original = current?.original ?? docOf(cx).sliceString(from, to);
    const text = item === null ? original : (item.insertText ?? item.label);
    this.replaceWord(cx, text, from, to);
    this.previewed = item === null ? null : { from, to: from + text.length, original };
  }

  private accept(cx: Context, item: CompletionItem): void {
    const cursor = this.cursor();
    const span = this.previewed ?? { from: item.from ?? this.start, to: item.to ?? cursor };
    this.replaceWord(cx, item.insertText ?? item.label, span.from, span.to);
    this.previewed = null;
    this.menu = null;
    if (item.edits && item.edits.length > 0) {
      const doc = docOf(cx);
      this.applying = true;
      try {
        apply(cx, changeSetOf(doc, [...item.edits].sort((a, b) => a.from - b.from).map((e) => [e.from, e.to, e.insert])));
      } finally {
        this.applying = false;
      }
    }
    if (this.host.state.field(helixField).mode !== "insert") commitHistoryNow(cx.host);
  }

  async trigger(cx: Context, manual: boolean): Promise<void> {
    const request = ++this.request;
    await this.editor.withMatcher(() => {});
    if (request !== this.request) return;
    this.cx = cx;
    const doc = docOf(cx);
    const pos = selOf(cx).primary().cursor(doc);
    const start = wordStart(doc, pos);
    const prefix = doc.sliceString(start, pos);
    const config = this.editor.config;
    const items: CompletionItem[] = [];
    const language = this.editor.workspace?.language;
    if (language?.completions) {
      try {
        items.push(...(await language.completions(cx, pos)));
      } catch {
        this.editor.setError("completion failed");
      }
      if (request !== this.request) return;
    }
    const wordLength = this.editor.languageConfig(cx.host)?.wordCompletion?.triggerLength ?? config.wordCompletion.triggerLength;
    const enabled = this.editor.languageConfig(cx.host)?.wordCompletion?.enable ?? config.wordCompletion.enable;
    if (enabled && (manual || [...prefix].length >= wordLength)) items.push(...buffersWords(doc, Math.max(prefix.length, 2), start, pos));
    this.start = start;
    this.items = items;
    this.previewed = null;
    this.show(prefix);
    if (!this.menu && manual) this.editor.setStatus("No completion available");
    this.editor.ui.render?.(cx.host);
  }

  documentChanged(): void {
    if (this.applying) return;
    const state = this.host.state.field(helixField);
    if (state.mode !== "insert") {
      this.close();
      return;
    }
    const doc = this.host.state.doc;
    const pos = state.selection.primary().cursor(doc);
    if (this.menu || this.items.length > 0) {
      const start = wordStart(doc, pos);
      if (this.menu && start === this.start && pos >= start) {
        this.previewed = null;
        this.show(doc.sliceString(start, pos));
        return;
      }
      this.close();
      this.items = [];
    }
    this.schedule(pos);
  }

  private window(): Window | null {
    return this.host.view?.dom.ownerDocument.defaultView ?? null;
  }

  private schedule(pos: number): void {
    const win = this.window();
    if (!win) return;
    if (this.timer !== null) win.clearTimeout(this.timer);
    const config = this.editor.config;
    if (!config.autoCompletion) return;
    const doc = this.host.state.doc;
    const start = wordStart(doc, pos);
    if (pos < nextGraphemeBoundary(doc, start) || pos - start < config.completionTriggerLen) return;
    this.timer = win.setTimeout(() => {
      this.timer = null;
      if (this.host.state.field(helixField).mode !== "insert") return;
      void this.trigger(new Context(this.editor, this.host, null, null), false);
    }, config.completionTimeout);
  }
}

const controllers = new WeakMap<Host, CompletionController>();

export function completionController(editor: HelixEditor, host: Host): CompletionController {
  let controller = controllers.get(host);
  if (!controller) {
    controller = new CompletionController(editor, host);
    controllers.set(host, controller);
  }
  return controller;
}

const completionPlugin = ViewPlugin.fromClass(
  class {
    constructor(readonly view: EditorView) {}
    update(update: ViewUpdate): void {
      const env = update.view.state.facet(helixEnv);
      if (!env) return;
      const before = update.startState.field(helixField, false)?.mode;
      const after = update.state.field(helixField, false)?.mode;
      const controller = completionController(env.editor, env.hostFor(update.view));
      if (after !== "insert" && before === "insert") controller.close();
      else if (update.docChanged && after === "insert") controller.documentChanged();
      else if (update.selectionSet && after === "insert" && controller.menu) controller.documentChanged();
    }
  },
);

export function helixCompletion(): Extension {
  return [completionPlugin];
}
