import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { STATIC_COMMANDS } from "../src/commands";
import { APP_COMMANDS } from "../src/commands/app";
import { TYPABLE } from "../src/commands/typed";

const list = (names: Iterable<string>) => [...new Set(names)].sort().map((name) => `  ${JSON.stringify(name)},`).join("\n");

writeFileSync(
  resolve(import.meta.dir, "../src/commands/names.ts"),
  `export const STATIC_COMMAND_NAMES = [
${list([...Object.keys(STATIC_COMMANDS), ...Object.keys(APP_COMMANDS)])}
] as const;

export const TYPED_COMMAND_NAMES = [
${list(TYPABLE.map((command) => command.name))}
] as const;

export type HelixStaticCommandName = (typeof STATIC_COMMAND_NAMES)[number];
export type HelixTypedCommandName = (typeof TYPED_COMMAND_NAMES)[number];
export type HelixCommandName = HelixStaticCommandName | HelixTypedCommandName;
export type HelixRunnable = HelixStaticCommandName | \`:\${HelixTypedCommandName}\` | (string & {});
`,
);
