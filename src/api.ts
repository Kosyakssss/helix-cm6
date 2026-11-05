import type { EditorView } from "@codemirror/view";
import { APP_COMMANDS, isAppCommandName } from "./commands/app";
import { COMMAND_DOCS } from "./commands/docs";
import { applyTextEdits, type TextEdit } from "./commands/goto";
import { STATIC_COMMANDS } from "./commands";
import { TYPABLE } from "./commands/typed";
import { setSel } from "./commands/util";
import { Context, type HelixEditor, type PromptRequest } from "./core/editor";
import { helixEditor, helixHost } from "./codemirror";
import type { Host } from "./core/host";
import { changesOf } from "./changes";
import { diagnosticsOf, severityRank, type Severity } from "./diagnostics";
import { Range, Selection } from "./selection";
import { helixField } from "./state";
import { DEFAULT_SCOPES, highlightSpans, rainbowSpans } from "./syntax/highlight";

export interface HelixCommandInfo {
  name: string;
  doc: string;
  app: boolean;
}

export interface HelixTypedCommandInfo {
  name: string;
  aliases: readonly string[];
  doc: string;
  app: string | null;
}

export function helixCommandList(): HelixCommandInfo[] {
  const names = new Set([...Object.keys(STATIC_COMMANDS), ...Object.keys(APP_COMMANDS)]);
  return [...names].sort().map((name) => ({ name, doc: COMMAND_DOCS[name] ?? name, app: isAppCommandName(name) }));
}

export function helixTypedCommandList(): HelixTypedCommandInfo[] {
  return TYPABLE.map((c) => ({ name: c.name, aliases: c.aliases, doc: c.doc, app: c.app ?? null }));
}

function parts(view: EditorView): { editor: HelixEditor; host: Host } | null {
  const editor = view.state.facet(helixEditor);
  const host = editor ? helixHost(view) : null;
  return editor && host ? { editor, host } : null;
}

function context(view: EditorView): Context | null {
  const found = parts(view);
  return found ? new Context(found.editor, found.host, null, null) : null;
}

export function helixEdit(view: EditorView, edits: readonly TextEdit[]): void {
  const cx = context(view);
  if (cx) applyTextEdits(cx, edits);
}

export function helixSelect(view: EditorView, ranges: readonly { anchor: number; head: number }[], primary = 0): void {
  const cx = context(view);
  if (!cx || ranges.length === 0) return;
  setSel(cx, new Selection(ranges.map((r) => new Range(r.anchor, r.head)), primary).ensureInvariants(view.state.doc));
}

export function helixMessage(view: EditorView, text: string, severity: "info" | "error" = "info"): void {
  const found = parts(view);
  if (!found) return;
  if (severity === "error") found.editor.setError(text);
  else found.editor.setStatus(text);
  found.editor.ui.render?.(found.host);
}

export function helixPrompt(view: EditorView, request: PromptRequest): void {
  const cx = context(view);
  if (cx) cx.editor.prompt(cx, request);
}

export interface HelixHighlight {
  from: number;
  to: number;
  scopes: readonly string[];
}

export function helixHighlights(view: EditorView, from: number, to: number, scopes: readonly string[] = DEFAULT_SCOPES): HelixHighlight[] {
  const found = parts(view);
  const syntax = found?.editor.syntax?.(found.host);
  if (!syntax) return [];
  return highlightSpans(syntax, scopes, syntax.byteOf(from), syntax.byteOf(to)).map((span) => ({
    from: syntax.posOf(span.from),
    to: syntax.posOf(span.to),
    scopes: span.scopes.map((h) => scopes[h]!),
  }));
}

export function helixRainbow(view: EditorView, from: number, to: number, levels = 6): { from: number; to: number; level: number }[] {
  const found = parts(view);
  const syntax = found?.editor.syntax?.(found.host);
  if (!syntax) return [];
  return rainbowSpans(syntax, levels, syntax.byteOf(from), syntax.byteOf(to)).map((span) => ({
    from: syntax.posOf(span.from),
    to: syntax.posOf(span.to),
    level: span.highlight,
  }));
}

export interface HelixGutterLine {
  line: number;
  number: number;
  selected: boolean;
  diagnostic: Severity | null;
  change: "added" | "removed" | "changed" | null;
}

export function helixGutter(view: EditorView, fromLine: number, toLine: number): HelixGutterLine[] {
  const found = parts(view);
  const value = view.state.field(helixField, false);
  if (!found || !value) return [];
  const doc = view.state.doc;
  const cursorLines = new Set(value.selection.ranges.map((r) => doc.lineAt(r.cursor(doc)).number));
  const primary = doc.lineAt(value.selection.primary().cursor(doc)).number;
  const relative = found.editor.config.lineNumber === "relative" && value.mode !== "insert" && view.hasFocus;
  const severities = new Map<number, Severity>();
  for (const d of diagnosticsOf(view.state)) {
    const line = doc.lineAt(d.from).number;
    const severity = d.severity ?? "warning";
    const known = severities.get(line);
    if (!known || severityRank(severity) >= severityRank(known)) severities.set(line, severity);
  }
  const { hunks } = changesOf(view.state);
  const out: HelixGutterLine[] = [];
  for (let line = Math.max(1, fromLine); line <= Math.min(doc.lines, toLine); line++) {
    const index = line - 1;
    const hunk = hunks.find((h) => (h.afterStart === h.afterEnd ? h.afterStart === index : h.afterStart <= index && index < h.afterEnd));
    out.push({
      line,
      number: relative && line !== primary ? Math.abs(primary - line) : line,
      selected: cursorLines.has(line),
      diagnostic: severities.get(line) ?? null,
      change: !hunk ? null : hunk.beforeStart === hunk.beforeEnd ? "added" : hunk.afterStart === hunk.afterEnd ? "removed" : "changed",
    });
  }
  return out;
}
