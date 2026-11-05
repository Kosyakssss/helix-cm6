import {
  helixHooks2,
  Range2,
  Selection2,
  helixField2,
  setSel2,
  pushJump2,
  setChanges2,
  changesOf2,
  setDiagnostics2,
  severityRank,
  diagnosticsOf,
  applyTextEdits2,
  insertSnippet,
  APP_COMMANDS2,
  isAppCommandName,
  rainbowSpans,
  highlightSpans,
  DEFAULT_SCOPES,
  TYPABLE,
  TYPABLE_MAP,
  splitCommandLine,
  STATIC_COMMANDS,
  executeCommand,
  runTypable,
  COMMAND_DOCS,
  Context2,
  helixAppKeys2,
  statusOf2,
  helixHost2,
  helixEditor2,
  helixDocument2,
  selectionInfo,
  helix2
} from "./chunk-h55c6tcr.js";
// src/api.ts
function parts(view) {
  const editor = view.state.facet(helixEditor2);
  const host = editor ? helixHost2(view) : null;
  if (!editor || !host)
    throw new Error("helix-cm6: this view has no helix() extension");
  return { editor, host };
}
function context(view) {
  const { editor, host } = parts(view);
  return new Context2(editor, host, null, null);
}
function helixEnabled(view) {
  return view.state.facet(helixEditor2) !== null;
}
function helixRun(view, command) {
  const cx = context(view);
  const { editor, host } = cx;
  if (command.startsWith(":")) {
    const [name] = splitCommandLine(command.slice(1));
    const typed = TYPABLE_MAP.get(name);
    const provided = typed ? !typed.app || editor.appCommand(typed.app) !== null : editor.appCommand(name) !== null;
    runTypable(cx, command.slice(1));
    for (const callback of cx.callbacks)
      callback();
    editor.ui.render?.(host);
    return provided;
  }
  if (command.startsWith("@"))
    executeCommand(cx, { kind: "macro", keys: command.slice(1) });
  else
    executeCommand(cx, { kind: "static", name: command });
  for (const callback of cx.callbacks)
    callback();
  editor.ui.render?.(host);
  return command.startsWith("@") || editor.hasCommand(command);
}
function helixType(view, keys) {
  const { editor, host } = parts(view);
  editor.feedKeys(host, keys);
}
function helixEdit(view, edits) {
  const list = "from" in edits ? [edits] : edits;
  applyTextEdits2(context(view), list.map((e) => ({ from: e.from, to: e.to ?? e.from, insert: e.insert ?? "" })));
}
function helixSelect(view, target, options = {}) {
  const cx = context(view);
  const list = typeof target === "number" || "anchor" in target ? [target] : target;
  if (list.length === 0)
    return;
  const ranges = list.map((t) => typeof t === "number" ? new Range2(t, t) : new Range2(t.anchor, t.head));
  const primary = Math.max(0, Math.min(options.primaryIndex ?? 0, ranges.length - 1));
  if (options.jump)
    pushJump2(cx);
  setSel2(cx, new Selection2(ranges, primary).ensureInvariants(view.state.doc));
}
function helixSelection(view) {
  parts(view);
  return selectionInfo(view.state.field(helixField2).selection, view.state.doc);
}
function helixSnippet(view, source, options = {}) {
  return insertSnippet(context(view), source, options);
}
function helixTabstops(view) {
  const { editor, host } = parts(view);
  const snippet = editor.snippets.get(host.id);
  if (!snippet)
    return [];
  return snippet.allTabstops().flatMap((tabstop) => tabstop.ranges.map((span) => ({ from: span.start, to: span.end, choices: tabstop.choices })));
}
function helixMessage(view, text, severity = "info") {
  const { editor, host } = parts(view);
  if (text === null)
    editor.status = null;
  else if (severity === "error")
    editor.setError(text);
  else
    editor.setStatus(text);
  editor.ui.render?.(host);
}
function helixPrompt(view, request) {
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
      onCancel: () => resolve(null)
    });
  });
}
function helixMarkSaved(view) {
  const { editor, host } = parts(view);
  editor.markSaved(host);
  editor.ui.render?.(host);
}
function helixStatus(view) {
  const { editor, host } = parts(view);
  return statusOf2(editor, host, view.hasFocus);
}
function helixRegister(view, name) {
  const { editor, host } = parts(view);
  return editor.registers.read(name, editor.registerEnv(host)) ?? [];
}
function helixSetRegister(view, name, values) {
  parts(view).editor.registers.write(name, [...values]);
}
function helixDiagnostics(view) {
  parts(view);
  return diagnosticsOf(view.state);
}
function helixSetDiagnostics(view, diagnostics) {
  parts(view);
  view.dispatch({ effects: setDiagnostics2.of(diagnostics) });
}
function helixChanges(view) {
  parts(view);
  return changesOf2(view.state);
}
function helixSetChanges(view, changes) {
  parts(view);
  view.dispatch({ effects: setChanges2.of(changes) });
}
function helixCommandList() {
  const names = new Set([...Object.keys(STATIC_COMMANDS), ...Object.keys(APP_COMMANDS2)]);
  return [...names].sort().map((name) => ({ name, doc: COMMAND_DOCS[name] ?? name, app: isAppCommandName(name) }));
}
function helixTypedCommandList() {
  return TYPABLE.map((c) => ({ name: c.name, aliases: c.aliases, doc: c.doc, app: c.app ?? null }));
}
function helixHighlights(view, from, to, scopes = DEFAULT_SCOPES) {
  const { editor, host } = parts(view);
  const syntax = editor.syntax?.(host);
  if (!syntax)
    return [];
  return highlightSpans(syntax, scopes, syntax.byteOf(from), syntax.byteOf(to)).map((span) => ({
    from: syntax.posOf(span.from),
    to: syntax.posOf(span.to),
    scopes: span.scopes.map((h) => scopes[h])
  }));
}
function helixRainbow(view, from, to, levels = 6) {
  const { editor, host } = parts(view);
  const syntax = editor.syntax?.(host);
  if (!syntax)
    return [];
  return rainbowSpans(syntax, levels, syntax.byteOf(from), syntax.byteOf(to)).map((span) => ({
    from: syntax.posOf(span.from),
    to: syntax.posOf(span.to),
    level: span.highlight
  }));
}
function helixGutter(view, fromLine, toLine) {
  const { editor } = parts(view);
  const value = view.state.field(helixField2);
  const doc = view.state.doc;
  const cursorLines = new Set(value.selection.ranges.map((r) => doc.lineAt(r.cursor(doc)).number));
  const primary = doc.lineAt(value.selection.primary().cursor(doc)).number;
  const relative = editor.config.lineNumber === "relative" && value.mode !== "insert" && view.hasFocus;
  const severities = new Map;
  for (const d of diagnosticsOf(view.state)) {
    const line = doc.lineAt(d.from).number;
    const severity = d.severity ?? "warning";
    const known = severities.get(line);
    if (!known || severityRank(severity) >= severityRank(known))
      severities.set(line, severity);
  }
  const { hunks } = changesOf2(view.state);
  const out = [];
  for (let line = Math.max(1, fromLine);line <= Math.min(doc.lines, toLine); line++) {
    const index = line - 1;
    const hunk = hunks.find((h) => h.afterStart === h.afterEnd ? h.afterStart === index : h.afterStart <= index && index < h.afterEnd);
    out.push({
      line,
      number: relative && line !== primary ? Math.abs(primary - line) : line,
      selected: cursorLines.has(line),
      diagnostic: severities.get(line) ?? null,
      change: !hunk ? null : hunk.beforeStart === hunk.beforeEnd ? "added" : hunk.afterStart === hunk.afterEnd ? "removed" : "changed"
    });
  }
  return out;
}
export {
  helix2 as helix,
  helixAppKeys2 as helixAppKeys,
  helixChanges,
  helixCommandList,
  helixDiagnostics,
  helixDocument2 as helixDocument,
  helixEdit,
  helixEnabled,
  helixGutter,
  helixHighlights,
  helixHooks2 as helixHooks,
  helixMarkSaved,
  helixMessage,
  helixPrompt,
  helixRainbow,
  helixRegister,
  helixRun,
  helixSelect,
  helixSelection,
  helixSetChanges,
  helixSetDiagnostics,
  helixSetRegister,
  helixSnippet,
  helixStatus,
  helixTabstops,
  helixType,
  helixTypedCommandList
};
