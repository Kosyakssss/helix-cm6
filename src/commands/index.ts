import type { Context } from "../core/editor";
import type { MappableCommand } from "../keymap/trie";
import { motionCommands, type CommandFn } from "./motion";
import { selectCommands } from "./select";
import { editCommands } from "./edit";
import { insertCommands } from "./insert";
import { miscCommands, UNSUPPORTED } from "./misc";
import { shellCommands } from "./shell";
import { syntaxCommands } from "./syntax";
import { gotoCommands } from "./goto";
import { snippetCommands } from "./snippet";
import { isAppCommandName } from "./app";
import { executeCommandLine } from "./typed";
import { hooksOf } from "../hooks";

export const STATIC_COMMANDS: Record<string, CommandFn> = {
  ...motionCommands,
  ...selectCommands,
  ...editCommands,
  ...insertCommands,
  ...miscCommands,
  ...syntaxCommands,
  ...shellCommands,
  ...gotoCommands,
  ...snippetCommands,
};

export function isKnownCommand(name: string): boolean {
  return name in STATIC_COMMANDS || UNSUPPORTED.includes(name) || isAppCommandName(name);
}

export function executeCommand(cx: Context, command: MappableCommand, arg?: string): void {
  switch (command.kind) {
    case "static": {
      if (hooksOf(cx.host).command?.(command.name, cx)) return;
      if (cx.editor.runApp(cx, command.name)) return;
      const fn = STATIC_COMMANDS[command.name];
      if (fn) fn(cx, arg);
      else if (UNSUPPORTED.includes(command.name) || isAppCommandName(command.name)) cx.editor.setStatus(`${command.name} is not available in this editor`);
      else cx.editor.setError(`no such command: '${command.name}'`);
      return;
    }
    case "typable":
      runTypable(cx, command.raw);
      return;
    case "macro": {
      if (cx.editor.macroReplaying.includes("@")) {
        cx.editor.setError("Cannot execute macro because the [@] register is already playing a macro");
        return;
      }
      let keys: string[];
      try {
        keys = cx.editor.parseMacro(command.keys);
      } catch (err) {
        cx.editor.setError(`Invalid macro: ${(err as Error).message}`);
        return;
      }
      cx.editor.macroReplaying.push("@");
      cx.callbacks.push(() => {
        for (const key of keys) cx.editor.handleKey(cx.editor.focusedHost(cx.host), key);
        cx.editor.macroReplaying.pop();
      });
    }
  }
}

export function runTypable(cx: Context, input: string): void {
  executeCommandLine(cx, input, "validate");
}
