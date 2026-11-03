import type { Completion } from "../core/prompt";
import type { Context } from "../core/editor";
import { nextGraphemeBoundary } from "../graphemes";
import { parseUndoKind } from "../history";
import { refill } from "../core/textwrap";
import { OPTIONS } from "../core/options";
import { apply, changeSetOf, docOf, selOf, setSel } from "./util";
import { earlier, later } from "./misc";
import { yankJoinedTo, paste, replaceSelectionsWithRegister } from "./edit";
import { gotoLineWithoutJumplist } from "./motion";
import { commitHistoryNow, jumplistFor } from "./jumps";
import { shell } from "./shell";
import { Args, SHELL_SIGNATURE, split, Tokenizer, type Flag, type Signature } from "./command-line";
import { expand } from "./expansion";

export type PromptEvent = "update" | "validate" | "abort";

export interface TypableCommand {
  name: string;
  aliases: string[];
  doc: string;
  signature: Signature;
  fun: (cx: Context, args: Args, event: PromptEvent) => void;
}

const sig = (min: number, max: number | null, extra: Partial<Signature> = {}): Signature => ({ positionals: [min, max], ...extra });
const WRITE_FLAGS: Flag[] = [
  { name: "no-format", doc: "skip auto-formatting" },
  { name: "no-code-actions", doc: "skip code actions on save" },
];

const SIGNATURES: Record<string, Signature> = {
  exit: sig(0, 1, { flags: WRITE_FLAGS }), "exit!": sig(0, 1, { flags: WRITE_FLAGS }),
  quit: sig(0, 0), "quit!": sig(0, 0), open: sig(1, null),
  "buffer-close": sig(0, null), "buffer-close!": sig(0, null),
  "buffer-close-others": sig(0, 0, { flags: [{ name: "skip-visible", alias: "s", doc: "don't close buffers that are visible" }] }),
  "buffer-close-others!": sig(0, 0, { flags: [{ name: "skip-visible", alias: "s", doc: "don't close buffers that are visible" }] }),
  "buffer-close-all": sig(0, 0), "buffer-close-all!": sig(0, 0), "buffer-next": sig(0, 0), "buffer-previous": sig(0, 0),
  write: sig(0, 1, { flags: WRITE_FLAGS }), "write!": sig(0, 1, { flags: WRITE_FLAGS }),
  "write-buffer-close": sig(0, 1, { flags: WRITE_FLAGS }), "write-buffer-close!": sig(0, 1, { flags: WRITE_FLAGS }),
  new: sig(0, 0), format: sig(0, 0), "indent-style": sig(0, 1), "line-ending": sig(0, 1), earlier: sig(0, 1), later: sig(0, 1),
  "write-quit": sig(0, 1, { flags: WRITE_FLAGS }), "write-quit!": sig(0, 1, { flags: WRITE_FLAGS }),
  "write-all": sig(0, 0, { flags: WRITE_FLAGS }), "write-all!": sig(0, 0, { flags: WRITE_FLAGS }),
  "write-quit-all": sig(0, 0, { flags: WRITE_FLAGS }), "write-quit-all!": sig(0, 0, { flags: WRITE_FLAGS }),
  "quit-all": sig(0, 0), "quit-all!": sig(0, 0), cquit: sig(0, 1), "cquit!": sig(0, 1), theme: sig(0, 1),
  "yank-join": sig(0, 1), "clipboard-yank": sig(0, 0), "clipboard-yank-join": sig(0, 1), "primary-clipboard-yank": sig(0, 0), "primary-clipboard-yank-join": sig(0, 1),
  "clipboard-paste-after": sig(0, 0), "clipboard-paste-before": sig(0, 0), "clipboard-paste-replace": sig(0, 0),
  "primary-clipboard-paste-after": sig(0, 0), "primary-clipboard-paste-before": sig(0, 0), "primary-clipboard-paste-replace": sig(0, 0),
  "show-clipboard-provider": sig(0, 0), "change-current-directory": sig(1, 1), "show-directory-stack": sig(0, 0), "push-directory": sig(1, 1),
  "pop-directory": sig(0, 0), "show-directory": sig(0, 0), encoding: sig(0, 1), "character-info": sig(0, 0), reload: sig(0, 0), "reload-all": sig(0, 0),
  update: sig(0, 0, { flags: [WRITE_FLAGS[0]!] }), "lsp-workspace-command": sig(0, null, { rawAfter: 1 }), "lsp-restart": sig(0, null), "lsp-stop": sig(0, null),
  "tree-sitter-scopes": sig(0, 0), "tree-sitter-highlight-name": sig(0, 0), "tree-sitter-layers": sig(0, 0),
  vsplit: sig(0, null), "vsplit-new": sig(0, 0), hsplit: sig(0, null), "hsplit-new": sig(0, 0), tutor: sig(0, 0), goto: sig(1, 1), "set-language": sig(0, 1),
  "set-option": sig(2, 2, { rawAfter: 1 }), "toggle-option": sig(1, null, { rawAfter: 1 }), "get-option": sig(1, 1),
  sort: sig(0, 0, { flags: [{ name: "insensitive", alias: "i", doc: "sort the ranges case-insensitively" }, { name: "reverse", alias: "r", doc: "sort ranges in reverse order" }] }),
  reflow: sig(0, 1), "tree-sitter-subtree": sig(0, 0), "config-reload": sig(0, 0), "config-open": sig(0, 0), "config-open-workspace": sig(0, 0), "log-open": sig(0, 0),
  "insert-output": SHELL_SIGNATURE, "append-output": SHELL_SIGNATURE, pipe: SHELL_SIGNATURE, "pipe-to": SHELL_SIGNATURE, "run-shell-command": SHELL_SIGNATURE,
  "reset-diff-change": sig(0, 0), "clear-register": sig(0, 1), "set-register": sig(2, 2, { rawAfter: 1 }), redraw: sig(0, 0), move: sig(1, 1), "move!": sig(1, 1),
  "yank-diagnostic": sig(0, 1), read: sig(1, 1), echo: sig(1, null), noop: sig(0, null),
};

function setLanguage(cx: Context, args: Args): void {
  const editor = cx.editor;
  if (args.positional.length === 0) {
    editor.setStatus(editor.languageName(cx.host) ?? "text");
    return;
  }
  const name = args.positional[0]!;
  const documents = editor.documentLanguage;
  if (!documents) throw new Error("languages are not available");
  if (name === "text") {
    documents.set(cx.host, null);
    return;
  }
  const id = editor.languages?.languageForName(name) ?? null;
  if (id === null) throw new Error(`invalid language id: ${name}`);
  documents.set(cx.host, id);
}

function validateOnly(fun: (cx: Context, args: Args) => void): TypableCommand["fun"] {
  return (cx, args, event) => {
    if (event === "validate") fun(cx, args);
  };
}

function characterInfo(cx: Context): void {
  const doc = docOf(cx);
  const start = selOf(cx).primary().cursor(doc);
  const end = nextGraphemeBoundary(doc, start);
  if (start === end) return;
  const g = doc.sliceString(start, end);
  let printable = "";
  for (const c of g) printable += c === "\0" ? "\\0" : c === "\t" ? "\\t" : c === "\n" ? "\\n" : c === "\r" ? "\\r" : c;
  const cps = [...g].map((c) => "U+" + c.codePointAt(0)!.toString(16).padStart(4, "0")).join(" ");
  const bytes = new TextEncoder().encode(g);
  const hex = bytes.length > 1 ? " Hex: " + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join(" ") : "";
  const dec = bytes.length === 1 ? ` Dec ${bytes[0]} Hex ${bytes[0]!.toString(16).padStart(2, "0")}` : hex;
  cx.editor.setStatus(`"${printable}" (${cps})${dec}`);
}

function sortCommand(cx: Context, args: Args): void {
  const doc = docOf(cx);
  const sel = selOf(cx);
  if (sel.ranges.length === 1) {
    cx.editor.setError("'sort': Sorting requires multiple selections. Hint: split selection first");
    return;
  }
  const frags = sel.ranges.map((r) => doc.sliceString(r.from(), r.to()));
  const insensitive = args.flags.has("insensitive");
  const reverse = args.flags.has("reverse");
  const key = (s: string) => (insensitive ? s.toLowerCase() : s);
  const cmp = (a: string, b: string) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
  frags.sort((a, b) => (reverse ? cmp(b, a) : cmp(a, b)));
  apply(cx, changeSetOf(doc, sel.ranges.map((r, i) => [r.from(), r.to(), frags[i]!])));
  commitHistoryNow(cx.host);
}

function gotoLineNumber(cx: Context, args: Args, event: PromptEvent): void {
  const update = () => {
    const n = Number(args.positional[0]);
    if (!Number.isInteger(n) || n <= 0) {
      cx.editor.setError("'goto': invalid line number");
      return false;
    }
    if (cx.editor.gotoPreview === null) cx.editor.gotoPreview = selOf(cx);
    gotoLineWithoutJumplist(cx, n, "move");
    return true;
  };
  if (event === "abort" || (event === "update" && args.positional.length === 0)) {
    if (cx.editor.gotoPreview) setSel(cx, cx.editor.gotoPreview);
    cx.editor.gotoPreview = null;
    return;
  }
  if (event === "update") {
    update();
    return;
  }
  if (!update()) return;
  const last = cx.editor.gotoPreview!;
  cx.editor.gotoPreview = null;
  jumplistFor(cx).push({ docId: cx.host.id, selection: last });
}

function ws(name: string, extra: Partial<TypableCommand> = {}): Pick<TypableCommand, "fun"> & Partial<TypableCommand> {
  return { ...extra, fun: validateOnly((cx, args) => cx.editor.workspaceCommand(cx, name, args.positional)) };
}

const DEFS: Omit<TypableCommand, "signature">[] = [
  { name: "exit", aliases: ["x", "xit"], doc: "Write changes to disk if the buffer is modified and then quit.", ...ws("write-quit") },
  { name: "exit!", aliases: ["x!", "xit!"], doc: "Force write and quit.", ...ws("write-quit") },
  { name: "quit", aliases: ["q"], doc: "Close the current view.", ...ws("quit") },
  { name: "quit!", aliases: ["q!"], doc: "Force close the current view.", ...ws("quit") },
  { name: "open", aliases: ["o", "edit", "e"], doc: "Open a file from disk into the current view.", ...ws("open") },
  { name: "buffer-close", aliases: ["bc", "bclose"], doc: "Close the current buffer.", ...ws("buffer-close") },
  { name: "buffer-close!", aliases: ["bc!", "bclose!"], doc: "Close the current buffer forcefully.", ...ws("buffer-close") },
  { name: "buffer-close-others", aliases: ["bco", "bcloseother"], doc: "Close all buffers but the focused one.", ...ws("buffer-close-others") },
  { name: "buffer-close-others!", aliases: ["bco!", "bcloseother!"], doc: "Force close all buffers but the focused one.", ...ws("buffer-close-others") },
  { name: "buffer-close-all", aliases: ["bca", "bcloseall"], doc: "Close all buffers without quitting.", ...ws("buffer-close-all") },
  { name: "buffer-close-all!", aliases: ["bca!", "bcloseall!"], doc: "Force close all buffers.", ...ws("buffer-close-all") },
  { name: "buffer-next", aliases: ["bn", "bnext"], doc: "Goto next buffer.", ...ws("goto_next_buffer") },
  { name: "buffer-previous", aliases: ["bp", "bprev"], doc: "Goto previous buffer.", ...ws("goto_previous_buffer") },
  { name: "write", aliases: ["w"], doc: "Write changes to disk.", ...ws("write") },
  { name: "write!", aliases: ["w!"], doc: "Force write changes to disk.", ...ws("write") },
  { name: "write-buffer-close", aliases: ["wbc"], doc: "Write changes and close the buffer.", ...ws("write-buffer-close") },
  { name: "write-buffer-close!", aliases: ["wbc!"], doc: "Force write changes and close the buffer.", ...ws("write-buffer-close") },
  { name: "new", aliases: ["n"], doc: "Create a new scratch buffer.", ...ws("new") },
  { name: "write-quit", aliases: ["wq"], doc: "Write changes and close the view.", ...ws("write-quit") },
  { name: "write-quit!", aliases: ["wq!"], doc: "Write changes and close the view forcefully.", ...ws("write-quit") },
  { name: "write-all", aliases: ["wa"], doc: "Write changes from all buffers.", ...ws("write-all") },
  { name: "write-all!", aliases: ["wa!"], doc: "Forcefully write changes from all buffers.", ...ws("write-all") },
  { name: "write-quit-all", aliases: ["wqa", "xa"], doc: "Write all buffers and close all views.", ...ws("write-quit-all") },
  { name: "write-quit-all!", aliases: ["wqa!", "xa!"], doc: "Forcefully write all buffers and close all views.", ...ws("write-quit-all") },
  { name: "quit-all", aliases: ["qa"], doc: "Close all views.", ...ws("quit-all") },
  { name: "quit-all!", aliases: ["qa!"], doc: "Force close all views.", ...ws("quit-all") },
  { name: "cquit", aliases: ["cq"], doc: "Quit with exit code (default 1). Accepts an optional integer exit code (:cq 2).", ...ws("cquit") },
  { name: "cquit!", aliases: ["cq!"], doc: "Force quit with exit code (default 1) ignoring unsaved changes. Accepts an optional integer exit code (:cq! 2).", ...ws("cquit!") },
  { name: "format", aliases: ["fmt"], doc: "Format the file using an external formatter or language server.", ...ws("format") },
  { name: "change-current-directory", aliases: ["cd"], doc: "Change the current working directory.", ...ws("change-current-directory") },
  { name: "show-directory-stack", aliases: [], doc: "Show the directory stack as a <space> delimited string.", ...ws("show-directory-stack") },
  { name: "push-directory", aliases: ["pushd"], doc: "Save and then change the current directory.", ...ws("push-directory") },
  { name: "pop-directory", aliases: ["popd"], doc: "Remove the top entry from the directory stack, and cd to the new top directory..", ...ws("pop-directory") },
  { name: "show-directory", aliases: ["pwd"], doc: "Show the current working directory.", ...ws("show-directory") },
  { name: "config-open-workspace", aliases: [], doc: "Open the workspace config.toml file.", ...ws("config-open-workspace") },
  { name: "lsp-workspace-command", aliases: [], doc: "Open workspace command picker", ...ws("lsp-workspace-command") },
  { name: "update", aliases: ["u"], doc: "Write changes only if the file has been modified.", ...ws("write") },
  { name: "vsplit", aliases: ["vs"], doc: "Open the file in a vertical split.", ...ws("vsplit") },
  { name: "vsplit-new", aliases: ["vnew"], doc: "Open a scratch buffer in a vertical split.", ...ws("vsplit_new") },
  { name: "hsplit", aliases: ["hs", "sp"], doc: "Open the file in a horizontal split.", ...ws("hsplit") },
  { name: "hsplit-new", aliases: ["hnew"], doc: "Open a scratch buffer in a horizontal split.", ...ws("hsplit_new") },
  { name: "reload", aliases: ["rl"], doc: "Discard changes and reload from the source file.", ...ws("reload") },
  { name: "reload-all", aliases: ["rla"], doc: "Discard changes and reload all documents.", ...ws("reload-all") },
  { name: "move", aliases: ["mv"], doc: "Move the current buffer and its file to a different path.", ...ws("move") },
  { name: "move!", aliases: ["mv!"], doc: "Move the current buffer, creating subdirectories.", ...ws("move") },
  { name: "read", aliases: ["r"], doc: "Load a file into buffer.", ...ws("read") },
  { name: "config-reload", aliases: [], doc: "Refresh user config.", ...ws("config-reload") },
  { name: "config-open", aliases: [], doc: "Open the user config.toml file.", ...ws("config-open") },
  { name: "tutor", aliases: [], doc: "Open the tutorial.", ...ws("tutor") },
  {
    name: "goto",
    aliases: ["g"],
    doc: "Goto line number.",
    fun: gotoLineNumber,
  },
  {
    name: "earlier",
    aliases: ["ear"],
    doc: "Jump back to an earlier point in edit history.",
    fun: validateOnly((cx, args) => {
      let uk;
      try {
        uk = parseUndoKind(args.positional.join(" "));
      } catch (err) {
        cx.editor.setError(`'earlier': ${(err as Error).message}`);
        return;
      }
      if (!earlier(cx, uk)) cx.editor.setStatus("Already at oldest change");
    }),
  },
  {
    name: "later",
    aliases: ["lat"],
    doc: "Jump to a later point in edit history.",
    fun: validateOnly((cx, args) => {
      let uk;
      try {
        uk = parseUndoKind(args.positional.join(" "));
      } catch (err) {
        cx.editor.setError(`'later': ${(err as Error).message}`);
        return;
      }
      if (!later(cx, uk)) cx.editor.setStatus("Already at newest change");
    }),
  },
  {
    name: "yank-join",
    aliases: [],
    doc: "Yank joined selections.",
    fun: validateOnly((cx, args) =>
      yankJoinedTo(cx, args.positional[0] ?? "\n", cx.editor.selectedRegister ?? cx.editor.config.defaultYankRegister),
    ),
  },
  { name: "clipboard-yank", aliases: [], doc: "Yank main selection into system clipboard.", fun: validateOnly((cx) => cx.editor.runStatic(cx, "yank_main_selection_to_clipboard")) },
  { name: "clipboard-yank-join", aliases: [], doc: "Yank joined selections into system clipboard.", fun: validateOnly((cx, args) => yankJoinedTo(cx, args.positional[0] ?? "\n", "+")) },
  { name: "primary-clipboard-yank", aliases: [], doc: "Yank main selection into system primary clipboard.", fun: validateOnly((cx) => cx.editor.runStatic(cx, "yank_main_selection_to_primary_clipboard")) },
  { name: "primary-clipboard-yank-join", aliases: [], doc: "Yank joined selections into system primary clipboard.", fun: validateOnly((cx, args) => yankJoinedTo(cx, args.positional[0] ?? "\n", "*")) },
  { name: "clipboard-paste-after", aliases: [], doc: "Paste system clipboard after selections.", fun: validateOnly((cx) => paste(cx, "+", "after", 1)) },
  { name: "clipboard-paste-before", aliases: [], doc: "Paste system clipboard before selections.", fun: validateOnly((cx) => paste(cx, "+", "before", 1)) },
  { name: "clipboard-paste-replace", aliases: [], doc: "Replace selections with content of system clipboard.", fun: validateOnly((cx) => replaceSelectionsWithRegister(cx, "+", 1)) },
  { name: "primary-clipboard-paste-after", aliases: [], doc: "Paste primary clipboard after selections.", fun: validateOnly((cx) => paste(cx, "*", "after", 1)) },
  { name: "primary-clipboard-paste-before", aliases: [], doc: "Paste primary clipboard before selections.", fun: validateOnly((cx) => paste(cx, "*", "before", 1)) },
  { name: "primary-clipboard-paste-replace", aliases: [], doc: "Replace selections with content of system primary clipboard.", fun: validateOnly((cx) => replaceSelectionsWithRegister(cx, "*", 1)) },
  { name: "character-info", aliases: ["char"], doc: "Get info about the character under the primary cursor.", fun: validateOnly(characterInfo) },
  { name: "insert-output", aliases: [], doc: "Run shell command, inserting output before each selection.", fun: validateOnly((cx, args) => void shell(cx, args.join(" "), "insert")) },
  { name: "append-output", aliases: [], doc: "Run shell command, appending output after each selection.", fun: validateOnly((cx, args) => void shell(cx, args.join(" "), "append")) },
  { name: "pipe", aliases: ["|"], doc: "Pipe each selection to the shell command.", fun: validateOnly((cx, args) => void shell(cx, args.join(" "), "replace")) },
  { name: "pipe-to", aliases: [], doc: "Pipe each selection to the shell command, ignoring output.", fun: validateOnly((cx, args) => void shell(cx, args.join(" "), "ignore")) },
  {
    name: "sort",
    aliases: [],
    doc: "Sort ranges in selection.",
    fun: validateOnly(sortCommand),
  },
  {
    name: "reflow",
    aliases: [],
    doc: "Hard-wrap the current selection of lines to a given width.",
    fun: validateOnly((cx, args) => {
      const width = args.positional[0] !== undefined ? Number(args.positional[0]) : cx.editor.config.textWidth;
      if (!Number.isInteger(width)) {
        cx.editor.setError("'reflow': invalid digit found in string");
        return;
      }
      const doc = docOf(cx);
      apply(cx, changeSetOf(doc, selOf(cx).ranges.map((r) => [r.from(), r.to(), refill(doc.sliceString(r.from(), r.to()), width)])));
      commitHistoryNow(cx.host);
    }),
  },
  {
    name: "clear-register",
    aliases: [],
    doc: "Clear given register. If no argument is provided, clear all registers.",
    fun: validateOnly((cx, args) => {
      const r = args.positional[0];
      if (r === undefined) {
        cx.editor.registers.clear();
        cx.editor.setStatus("All registers cleared");
        return;
      }
      if ([...r].length !== 1) {
        cx.editor.setError(`'clear-register': Invalid register ${r}`);
        return;
      }
      if (cx.editor.registers.remove(r)) cx.editor.setStatus(`Register ${r} cleared`);
      else cx.editor.setError(`Register ${r} not found`);
    }),
  },
  {
    name: "set-register",
    aliases: [],
    doc: "Set contents of the given register.",
    fun: validateOnly((cx, args) => {
      const [r, v] = args.positional;
      if (r === undefined || v === undefined || [...r].length !== 1) {
        cx.editor.setError(`'set-register': Invalid register ${r ?? ""}`);
        return;
      }
      try {
        cx.editor.registers.write(r, [v]);
      } catch (err) {
        cx.editor.setError(`'set-register': ${(err as Error).message}`);
      }
    }),
  },
  {
    name: "indent-style",
    aliases: [],
    doc: "Set the indentation style for editing. ('t' for tabs or 1-16 for number of spaces.)",
    fun: validateOnly((cx, args) => {
      const a = args.positional[0];
      if (a === undefined) {
        const s = cx.editor.config.indentStyle;
        cx.editor.setStatus(s.kind === "tabs" ? "tabs" : `${s.width} ${s.width === 1 ? "space" : "spaces"}`);
        return;
      }
      if (a === "t" || a === "tabs") cx.editor.config.indentStyle = { kind: "tabs" };
      else if (/^\d+$/.test(a) && Number(a) >= 1 && Number(a) <= 16) cx.editor.config.indentStyle = { kind: "spaces", width: Number(a) };
      else cx.editor.setError("'indent-style': invalid indent style");
    }),
  },
  { name: "set-option", aliases: ["set"], doc: "Set a config option at runtime.", fun: validateOnly((cx, args) => cx.editor.setOption(cx, args.positional)) },
  { name: "toggle-option", aliases: ["toggle"], doc: "Toggle a config option at runtime.", fun: validateOnly((cx, args) => cx.editor.toggleOption(cx, args.positional)) },
  { name: "get-option", aliases: ["get"], doc: "Get the current value of a config option.", fun: validateOnly((cx, args) => cx.editor.getOption(cx, args.positional)) },
  { name: "set-language", aliases: ["lang"], doc: "Set the language of current buffer (show current language if no value specified).", fun: validateOnly(setLanguage) },
  { name: "echo", aliases: [], doc: "Prints the given arguments to the statusline.", fun: validateOnly((cx, args) => cx.editor.setStatus(args.positional.join(" "))) },
  { name: "noop", aliases: [], doc: "Does nothing.", fun: () => {} },
  { name: "redraw", aliases: [], doc: "Clear and re-render the whole UI", fun: validateOnly((cx) => cx.host.view?.requestMeasure()) },
];

export const TYPABLE: TypableCommand[] = DEFS.map((def) => ({ ...def, signature: SIGNATURES[def.name] ?? sig(0, null) }));

export const TYPABLE_MAP = new Map<string, TypableCommand>();
for (const cmd of TYPABLE) {
  TYPABLE_MAP.set(cmd.name, cmd);
  for (const a of cmd.aliases) TYPABLE_MAP.set(a, cmd);
}

export function splitCommandLine(input: string): [string, string] {
  const [command, rest] = split(input);
  return [command, rest];
}

export function executeCommand(cx: Context, cmd: TypableCommand, input: string, event: PromptEvent): void {
  if (event !== "validate") {
    cmd.fun(cx, Args.parse(input, cmd.signature, false, (token) => token.content), event);
    return;
  }
  const fail = (err: unknown) => cx.editor.setError(`'${cmd.name}': ${err instanceof Error ? err.message : String(err)}`);
  let parsed: Args | Promise<Args>;
  try {
    parsed = Args.parseAsync(input, cmd.signature, (token) => expand(cx, token));
  } catch (err) {
    fail(err);
    return;
  }
  const run = (args: Args) => {
    try {
      cmd.fun(cx, args, event);
    } catch (err) {
      fail(err);
    }
  };
  if (!(parsed instanceof Promise)) {
    run(parsed);
    return;
  }
  void cx.editor.whileBusy(parsed.then(run, fail));
}

export function executeCommandLine(cx: Context, input: string, event: PromptEvent): void {
  const [command, rest] = split(input);
  if (command === "") return;
  if (/^\d+$/.test(command) && rest.trim() === "") {
    executeCommand(cx, TYPABLE_MAP.get("goto")!, command, event);
    return;
  }
  const cmd = TYPABLE_MAP.get(command);
  if (!cmd) {
    if (event === "validate") cx.editor.setError(`no such command: '${command}'`);
    return;
  }
  executeCommand(cx, cmd, rest, event);
}

const PATH_COMMANDS = new Set(["open", "vsplit", "hsplit", "read", "move", "move!", "write", "write!"]);
const OPTION_COMMANDS = new Set(["set-option", "toggle-option", "get-option"]);


interface CompletionToken {
  start: number;
  contentStart: number;
  content: string;
  quote: string | null;
  terminated: boolean;
}

function completionTokens(input: string): CompletionToken[] {
  const tokenizer = new Tokenizer(input, false);
  const out: CompletionToken[] = [];
  for (let token = tokenizer.next(); token !== null; token = tokenizer.next()) {
    const quote = token.kind.kind === "quoted" ? token.kind.quote : token.kind.kind === "expand" && input[token.contentStart - 1] === '"' ? '"' : null;
    out.push({ start: quote === null ? token.contentStart : token.contentStart - 1, contentStart: token.contentStart, content: token.content, quote, terminated: token.isTerminated });
  }
  return out;
}

function quoteCompletion(token: CompletionToken, candidate: string): Completion {
  if (token.quote === null) {
    const text = /[ \t%]/.test(candidate) ? `'${candidate.replace(/'/g, "''")}'` : candidate;
    return { start: token.start, text, label: candidate };
  }
  return { start: token.contentStart, text: candidate.split(token.quote).join(token.quote + token.quote), label: candidate };
}

export interface CommandLineCompleters {
  path: ((prefix: string) => string[]) | null;
  languages: () => string[];
}

export function completeCommandLine(input: string, completers: CommandLineCompleters): Completion[] {
  const pathCompleter = completers.path;
  const [command, rest] = splitCommandLine(input);
  if (rest !== "" || input.endsWith(" ")) {
    const cmd = TYPABLE_MAP.get(command);
    if (!cmd) return [];
    const tokens = completionTokens(input).slice(1);
    let token = tokens[tokens.length - 1];
    if (!token || (token.quote === null && /\s$/.test(input)) || token.terminated) {
      if (token?.terminated) return [];
      token = { start: input.length, contentStart: input.length, content: "", quote: null, terminated: false };
    }
    const tok = token;
    if (PATH_COMMANDS.has(cmd.name) && pathCompleter) return pathCompleter(tok.content).slice(0, 200).map((c) => quoteCompletion(tok, c));
    if (cmd.name === "set-language" && tokens.length <= 1) {
      return [...completers.languages(), "text"]
        .filter((k) => k.startsWith(tok.content))
        .sort()
        .map((k) => quoteCompletion(tok, k));
    }
    if (OPTION_COMMANDS.has(cmd.name) && tokens.length <= 1) {
      return Object.keys(OPTIONS)
        .filter((k) => k.startsWith(tok.content))
        .sort()
        .map((k) => ({ start: tok.start, text: k, label: k }));
    }
    return [];
  }
  const start = input.length - input.replace(/^\s+/, "").length;
  const names = new Set<string>();
  for (const cmd of TYPABLE) {
    if (cmd.name.startsWith(command)) names.add(cmd.name);
    for (const a of cmd.aliases) if (a.startsWith(command)) names.add(cmd.name);
  }
  return [...names].sort().map((n) => ({ start, text: n, label: n }));
}
