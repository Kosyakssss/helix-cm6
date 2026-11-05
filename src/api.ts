import type { EditorView } from "@codemirror/view";
import { APP_COMMANDS, isAppCommandName } from "./commands/app";
import type { HelixCommandContext } from "./commands/app";
import { COMMAND_DOCS } from "./commands/docs";
import type { HelixRunnable } from "./commands/names";
import { applyTextEdits } from "./commands/goto";
import { pushJump } from "./commands/jumps";
import { insertSnippet } from "./commands/snippet";
import { executeCommand, runTypable, STATIC_COMMANDS } from "./commands";
import { splitCommandLine, TYPABLE, TYPABLE_MAP } from "./commands/typed";
import { setSel } from "./commands/util";
import { Context, type HelixEditor } from "./core/editor";
import { helixEditor, helixHost, selectionInfo, type HelixSelection } from "./codemirror";
import type { Host } from "./core/host";
import { changesOf, setChanges, type Changes } from "./changes";
import { diagnosticsOf, setDiagnostics, severityRank, type Diagnostic, type Severity } from "./diagnostics";
import { Range, Selection } from "./selection";
import { helixField } from "./state";
import { DEFAULT_SCOPES, highlightSpans, rainbowSpans } from "./syntax/highlight";
import { statusOf, type HelixStatus } from "./view/status";

function parts(view: EditorView): { editor: HelixEditor; host: Host } {
  const editor = view.state.facet(helixEditor);
  const host = editor ? helixHost(view) : null;
  if (!editor || !host) throw new Error("helix-cm6: this view has no helix() extension");
  return { editor, host };
}

function context(view: EditorView): Context {
  const { editor, host } = parts(view);
  return new Context(editor, host, null, null);
}

export function helixEnabled(view: EditorView): boolean {
  return view.state.facet(helixEditor) !== null;
}

export function helixRun(view: EditorView, command: HelixRunnable): boolean {
  const cx = context(view);
  const { editor, host } = cx;
  if (command.startsWith(":")) {
    const [name] = splitCommandLine(command.slice(1));
    const typed = TYPABLE_MAP.get(name);
    const provided = typed ? !typed.app || editor.appCommand(typed.app) !== null : editor.appCommand(name) !== null;
    runTypable(cx, command.slice(1));
    for (const callback of cx.callbacks) callback();
    editor.ui.render?.(host);
    return provided;
  }
  if (command.startsWith("@")) executeCommand(cx, { kind: "macro", keys: command.slice(1) });
  else executeCommand(cx, { kind: "static", name: command });
  for (const callback of cx.callbacks) callback();
  editor.ui.render?.(host);
  return command.startsWith("@") || editor.hasCommand(command);
}

export function helixType(view: EditorView, keys: string): void {
  const { editor, host } = parts(view);
  editor.feedKeys(host, keys);
}

export interface HelixTextEdit {
  from: number;
  to?: number;
  insert?: string;
}

export function helixEdit(view: EditorView, edits: HelixTextEdit | readonly HelixTextEdit[]): void {
  const list: readonly HelixTextEdit[] = "from" in edits ? [edits] : edits;
  applyTextEdits(context(view), list.map((e) => ({ from: e.from, to: e.to ?? e.from, insert: e.insert ?? "" })));
}

export type HelixSelectTarget = number | { anchor: number; head: number };

export interface HelixSelectOptions {
  primaryIndex?: number;
  jump?: boolean;
}

export function helixSelect(view: EditorView, target: HelixSelectTarget | readonly HelixSelectTarget[], options: HelixSelectOptions = {}): void {
  const cx = context(view);
  const list: readonly HelixSelectTarget[] = typeof target === "number" || "anchor" in target ? [target] : target;
  if (list.length === 0) return;
  const ranges = list.map((t) => (typeof t === "number" ? new Range(t, t) : new Range(t.anchor, t.head)));
  const primary = Math.max(0, Math.min(options.primaryIndex ?? 0, ranges.length - 1));
  if (options.jump) pushJump(cx);
  setSel(cx, new Selection(ranges, primary).ensureInvariants(view.state.doc));
}

export function helixSelection(view: EditorView): HelixSelection {
  parts(view);
  return selectionInfo(view.state.field(helixField).selection, view.state.doc);
}

export function helixSnippet(view: EditorView, source: string, options: { removeBefore?: number; variables?: Readonly<Record<string, string>> } = {}): boolean {
  return insertSnippet(context(view), source, options);
}

export interface HelixTabstop {
  from: number;
  to: number;
  choices: readonly string[] | null;
}

export function helixTabstops(view: EditorView): HelixTabstop[] {
  const { editor, host } = parts(view);
  const snippet = editor.snippets.get(host.id);
  if (!snippet) return [];
  return snippet.allTabstops().flatMap((tabstop) => tabstop.ranges.map((span) => ({ from: span.start, to: span.end, choices: tabstop.choices })));
}

export function helixMessage(view: EditorView, text: string | null, severity: "info" | "error" = "info"): void {
  const { editor, host } = parts(view);
  if (text === null) editor.status = null;
  else if (severity === "error") editor.setError(text);
  else editor.setStatus(text);
  editor.ui.render?.(host);
}

export interface HelixPromptRequest {
  label: string;
  initial?: string;
  history?: string;
  complete?: (input: string) => readonly string[];
  onChange?: (input: string) => void;
}

export function helixPrompt(view: EditorView, request: HelixPromptRequest): Promise<string | null> {
  const cx = context(view);
  const complete = request.complete;
  return new Promise((resolve) => {
    cx.editor.prompt(cx, {
      label: request.label,
      initial: request.initial,
      history: request.history,
      complete: complete && ((input) => complete(input).map((text) => ({ start: 0, text, label: text }))),
      onChange: request.onChange,
      onAccept: resolve,
      onCancel: () => resolve(null),
    });
  });
}

export function helixMarkSaved(view: EditorView): void {
  const { editor, host } = parts(view);
  editor.markSaved(host);
  editor.ui.render?.(host);
}

export function helixStatus(view: EditorView): HelixStatus {
  const { editor, host } = parts(view);
  return statusOf(editor, host, view.hasFocus)!;
}

export function helixRegister(view: EditorView, name: string): readonly string[] {
  const { editor, host } = parts(view);
  return editor.registers.read(name, editor.registerEnv(host)) ?? [];
}

export function helixSetRegister(view: EditorView, name: string, values: readonly string[]): void {
  parts(view).editor.registers.write(name, [...values]);
}

export function helixDiagnostics(view: EditorView): readonly Diagnostic[] {
  parts(view);
  return diagnosticsOf(view.state);
}

export function helixSetDiagnostics(view: EditorView, diagnostics: readonly Diagnostic[]): void {
  parts(view);
  view.dispatch({ effects: setDiagnostics.of(diagnostics) });
}

export function helixChanges(view: EditorView): Changes {
  parts(view);
  return changesOf(view.state);
}

export function helixSetChanges(view: EditorView, changes: Changes): void {
  parts(view);
  view.dispatch({ effects: setChanges.of(changes) });
}

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

export interface HelixHighlight {
  from: number;
  to: number;
  scopes: readonly string[];
}

export function helixHighlights(view: EditorView, from: number, to: number, scopes: readonly string[] = DEFAULT_SCOPES): HelixHighlight[] {
  const { editor, host } = parts(view);
  const syntax = editor.syntax?.(host);
  if (!syntax) return [];
  return highlightSpans(syntax, scopes, syntax.byteOf(from), syntax.byteOf(to)).map((span) => ({
    from: syntax.posOf(span.from),
    to: syntax.posOf(span.to),
    scopes: span.scopes.map((h) => scopes[h]!),
  }));
}

export interface HelixRainbowSpan {
  from: number;
  to: number;
  level: number;
}

export function helixRainbow(view: EditorView, from: number, to: number, levels = 6): HelixRainbowSpan[] {
  const { editor, host } = parts(view);
  const syntax = editor.syntax?.(host);
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
  const { editor } = parts(view);
  const value = view.state.field(helixField);
  const doc = view.state.doc;
  const cursorLines = new Set(value.selection.ranges.map((r) => doc.lineAt(r.cursor(doc)).number));
  const primary = doc.lineAt(value.selection.primary().cursor(doc)).number;
  const relative = editor.config.lineNumber === "relative" && value.mode !== "insert" && view.hasFocus;
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

export type { HelixCommandContext };
