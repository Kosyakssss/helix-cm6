import type { Context } from "../core/editor";
import { Tokenizer, type Token } from "./command-line";
import { nextGraphemeBoundary } from "../graphemes";
import { docOf, selOf } from "./util";

export type Variable =
  | "cursor_line"
  | "cursor_column"
  | "buffer_name"
  | "file_path_absolute"
  | "line_ending"
  | "workspace_directory"
  | "current_working_directory"
  | "language"
  | "selection"
  | "selection_line_start"
  | "selection_line_end";

const VARIABLES = new Set<string>([
  "cursor_line",
  "cursor_column",
  "buffer_name",
  "file_path_absolute",
  "line_ending",
  "workspace_directory",
  "current_working_directory",
  "language",
  "selection",
  "selection_line_start",
  "selection_line_end",
]);

type Expanded = string | Promise<string>;

function then(value: Expanded, f: (text: string) => Expanded): Expanded {
  return value instanceof Promise ? value.then(f) : f(value);
}

export function expand(cx: Context, token: Token): Expanded {
  const k = token.kind;
  switch (k.kind) {
    case "unquoted":
    case "quoted":
      return token.content;
    case "expand":
      return expandInner(cx, token.content);
    case "expansion-kind":
      throw new Error("expansion name tokens cannot be emitted when command line validation is enabled");
    case "expansion":
      switch (k.expansion) {
        case "variable":
          if (!VARIABLES.has(token.content)) throw new Error(`unknown variable '${token.content}'`);
          return expandVariable(cx, token.content as Variable);
        case "unicode": {
          const code = /^[0-9a-fA-F]+$/.test(token.content) ? parseInt(token.content, 16) : NaN;
          if (!Number.isNaN(code) && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)) return String.fromCodePoint(code);
          throw new Error(`could not interpret '${token.content}' as a Unicode character code`);
        }
        case "shell":
          return expandShell(cx, token.content);
        case "register":
          return expandRegister(cx, token.content);
      }
  }
}

function expandShell(cx: Context, content: string): Expanded {
  return then(expandInner(cx, content), (command) => {
    const run = cx.editor.shell;
    const shell = cx.editor.config.shell;
    if (!run || shell.length === 0) throw new Error("Failed to start shell: No shell set");
    const finish = (output: { stdout: string }) => {
      let text = output.stdout;
      if (text.endsWith("\n")) {
        text = text.slice(0, -1);
        if (text.endsWith("\r")) text = text.slice(0, -1);
      }
      return text;
    };
    const output = run(command, null, shell);
    return output instanceof Promise ? output.then(finish) : finish(output);
  });
}

function expandRegister(cx: Context, content: string): string {
  const chars = [...content];
  if (chars.length === 0) throw new Error("Missing register name");
  if (chars.length > 1) throw new Error(`Invalid register \`${content}\`: should only be a single character`);
  const values = cx.editor.registers.read(chars[0]!, cx.editor.registerEnv(cx.host));
  return values ? values.join("") : "";
}

function expandInner(cx: Context, content: string): Expanded {
  const step = (start: number, escaped: string): Expanded => {
    for (;;) {
      const idx = content.indexOf("%", start);
      if (idx < 0) return escaped === "" ? content : escaped + content.slice(start);
      if (content[idx + 1] === "%") {
        escaped += content.slice(start, idx + 1);
        start = idx + 2;
        continue;
      }
      escaped += content.slice(start, idx);
      const tokenizer = new Tokenizer(content.slice(idx), true);
      const token = tokenizer.parsePercentToken();
      const next = idx + tokenizer.pos;
      const expanded = expand(cx, token);
      if (expanded instanceof Promise) {
        const before = escaped;
        return expanded.then((text) => step(next, before + text));
      }
      escaped += expanded;
      start = next;
    }
  };
  return step(0, "");
}

function expandVariable(cx: Context, variable: Variable): string {
  const doc = docOf(cx);
  const primary = selOf(cx).primary();
  const app = cx.editor.workspace?.variable?.(cx, variable);
  if (app !== undefined && app !== null) return app;
  switch (variable) {
    case "cursor_line":
      return String(doc.lineAt(primary.cursor(doc)).number);
    case "cursor_column": {
      const cursor = primary.cursor(doc);
      let col = 0;
      for (let pos = doc.lineAt(cursor).from; pos < cursor; pos = nextGraphemeBoundary(doc, pos)) col++;
      return String(col + 1);
    }
    case "buffer_name":
      return cx.host.name;
    case "file_path_absolute":
      return cx.host.name;
    case "line_ending":
      return "\n";
    case "current_working_directory":
    case "workspace_directory":
      return "";
    case "language":
      return "text";
    case "selection":
      return doc.sliceString(primary.from(), primary.to());
    case "selection_line_start":
      return String(doc.lineAt(primary.from()).number);
    case "selection_line_end": {
      const end = primary.to() > primary.from() && doc.lineAt(primary.to()).from === primary.to() ? primary.to() - 1 : primary.to();
      return String(doc.lineAt(end).number);
    }
  }
}
