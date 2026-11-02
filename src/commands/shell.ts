import { Context } from "../core/editor";
import type { CommandFn } from "./motion";
import { Range, Selection } from "../selection";
import { commitHistoryNow } from "./jumps";
import { apply, changeSetOf, docOf, selOf } from "./util";
import { Args, SHELL_SIGNATURE } from "./command-line";
import { expand } from "./expansion";

export interface ShellOutput {
  code: number | null;
  stdout: string;
  stderr: string;
}

export type ShellRunner = (command: string, input: string | null, shell: readonly string[]) => ShellOutput | Promise<ShellOutput>;

export type ShellBehavior = "replace" | "ignore" | "insert" | "append";

type Result = { ok: true; text: string } | { ok: false; error: string };

function interpret(output: ShellOutput): Result {
  if (output.code !== 0) {
    if (output.stderr === "") return { ok: false, error: output.code === null ? "Shell command failed" : `Shell command failed: status ${output.code}` };
    return { ok: true, text: output.stderr };
  }
  return { ok: true, text: output.stderr !== "" ? output.stderr : output.stdout };
}

function failure(err: unknown): Result {
  return { ok: false, error: err instanceof Error ? err.message : String(err) };
}

function shellImpl(cx: Context, command: string, input: string | null): Result | Promise<Result> {
  const run = cx.editor.shell;
  const argv = cx.editor.config.shell;
  if (!run || argv.length === 0) return { ok: false, error: "No shell set" };
  try {
    const output = run(command, input, argv);
    return output instanceof Promise ? output.then(interpret, failure) : interpret(output);
  } catch (err) {
    return failure(err);
  }
}

function each<T>(items: readonly T[], f: (item: T, index: number) => boolean | Promise<boolean>, index = 0): void | Promise<void> {
  for (let i = index; i < items.length; i++) {
    const next = f(items[i]!, i);
    if (next instanceof Promise) return next.then((go) => (go ? each(items, f, i + 1) : undefined));
    if (!next) return;
  }
}

function after(work: void | Promise<void>, f: () => void): void | Promise<void> {
  return work instanceof Promise ? work.then(f) : f();
}

function stillCurrent(cx: Context, doc: unknown, selection: Selection): boolean {
  if (docOf(cx) === doc && selOf(cx).eq(selection)) return true;
  cx.editor.setError("The document changed while the shell command ran");
  return false;
}

export function shell(cx: Context, command: string, behavior: ShellBehavior): void | Promise<void> {
  const pipe = behavior === "replace" || behavior === "ignore";
  const doc = docOf(cx);
  const selection = selOf(cx);
  const outputs: string[] = [];
  let shared: string | null = null;
  let failed = false;
  const work = each(selection.ranges, (range) => {
    if (shared !== null) {
      outputs.push(shared);
      return true;
    }
    const input = doc.sliceString(range.from(), range.to());
    const take = (result: Result): boolean => {
      if (!result.ok) {
        cx.editor.setError(result.error);
        failed = true;
        return false;
      }
      let output = result.text;
      if (!input.endsWith("\n") && output.endsWith("\n")) {
        output = output.slice(0, -1);
        if (output.endsWith("\r")) output = output.slice(0, -1);
      }
      if (!pipe) shared = output;
      outputs.push(output);
      return true;
    };
    const result = shellImpl(cx, command, pipe ? input : null);
    return result instanceof Promise ? result.then(take) : take(result);
  });
  return cx.editor.whileBusy(
    after(work, () => {
      if (failed || behavior === "ignore" || !stillCurrent(cx, doc, selection)) return;
      const changes: [number, number, string][] = [];
      const ranges: Range[] = [];
      let offset = 0;
      selection.ranges.forEach((range, i) => {
        const output = outputs[i]!;
        const [from, to, deleted] =
          behavior === "replace"
            ? [range.from(), range.to(), range.to() - range.from()]
            : behavior === "insert"
              ? [range.from(), range.from(), 0]
              : [range.to(), range.to(), 0];
        const anchor = to + offset - deleted;
        ranges.push(new Range(anchor, anchor + output.length).withDirection(range.direction()));
        offset += output.length - deleted;
        changes.push([from, to, output]);
      });
      apply(cx, changeSetOf(doc, changes), new Selection(ranges, selection.primaryIndex));
      commitHistoryNow(cx.host);
    }),
  );
}

export function shellKeepPipe(cx: Context, command: string): void | Promise<void> {
  const doc = docOf(cx);
  const selection = selOf(cx);
  const ranges: Range[] = [];
  const oldIndex = selection.primaryIndex;
  let index: number | null = null;
  const work = each(selection.ranges, (range, i) => {
    const keep = (result: Result): boolean => {
      if (!result.ok) return true;
      ranges.push(range);
      if (i >= oldIndex && index === null) index = ranges.length - 1;
      return true;
    };
    const result = shellImpl(cx, command, doc.sliceString(range.from(), range.to()));
    return result instanceof Promise ? result.then(keep) : keep(result);
  });
  return cx.editor.whileBusy(
    after(work, () => {
      if (ranges.length === 0) {
        cx.editor.setError("No selections remaining");
        return;
      }
      if (!stillCurrent(cx, doc, selection)) return;
      apply(cx, changeSetOf(doc, []), new Selection(ranges, index ?? ranges.length - 1));
    }),
  );
}

function shellPrompt(cx: Context, label: string, run: (cx: Context, command: string) => void | Promise<void>): void {
  const editor = cx.editor;
  const host = cx.host;
  editor.prompt(cx, {
    label,
    history: "|",
    onAccept: (input) => {
      if (input === "") return;
      const pcx = new Context(editor, host, null, null);
      let parsed: Args | Promise<Args>;
      try {
        parsed = Args.parseAsync(input, SHELL_SIGNATURE, (token) => expand(pcx, token));
      } catch (err) {
        editor.setError(err instanceof Error ? err.message : String(err));
        return;
      }
      if (!(parsed instanceof Promise)) {
        void run(pcx, parsed.join(" "));
        return;
      }
      void editor.whileBusy(
        parsed.then(
          (args) => void run(pcx, args.join(" ")),
          (err: unknown) => editor.setError(err instanceof Error ? err.message : String(err)),
        ),
      );
    },
  });
}

export const shellCommands: Record<string, CommandFn> = {
  shell_pipe: (cx) => shellPrompt(cx, "pipe:", (c, cmd) => shell(c, cmd, "replace")),
  shell_pipe_to: (cx) => shellPrompt(cx, "pipe-to:", (c, cmd) => shell(c, cmd, "ignore")),
  shell_insert_output: (cx) => shellPrompt(cx, "insert-output:", (c, cmd) => shell(c, cmd, "insert")),
  shell_append_output: (cx) => shellPrompt(cx, "append-output:", (c, cmd) => shell(c, cmd, "append")),
  shell_keep_pipe: (cx) => shellPrompt(cx, "keep-pipe:", shellKeepPipe),
};
