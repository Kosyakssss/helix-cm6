export function split(line: string): [string, string, boolean] {
  const m = /[ \t]/.exec(line);
  const command = m ? line.slice(0, m.index) : line;
  const rest = m ? line.slice(m.index + 1) : "";
  const completeCommand = command === "" || (rest.trim() === "" && !/[ \t]$/.test(line));
  return [command, rest, completeCommand];
}

export interface Flag {
  name: string;
  alias?: string;
  doc: string;
  completions?: readonly string[];
}

export interface Signature {
  positionals: [number, number | null];
  rawAfter?: number;
  flags?: readonly Flag[];
}

export class ParseArgsError extends Error {}

export const SHELL_SIGNATURE: Signature = { positionals: [1, 2], rawAfter: 1 };

function wrongPositionalCount(min: number, max: number | null, actual: number): ParseArgsError {
  const plural = (n: number) => (n === 1 ? "" : "s");
  let expected: string;
  if (min === 0 && max === 0) expected = "no arguments";
  else if (max !== null && min === max) expected = `exactly ${min} argument${plural(min)}`;
  else if (actual < min) expected = `at least ${min} argument${plural(min)}`;
  else expected = `at most ${max} argument${plural(max!)}`;
  return new ParseArgsError(`expected ${expected}, got ${actual}`);
}

export type ExpansionKind = "variable" | "unicode" | "shell" | "register";

const EXPANSION_KINDS: Record<string, ExpansionKind> = { "": "variable", u: "unicode", sh: "shell", reg: "register" };

export type TokenKind =
  | { kind: "unquoted" }
  | { kind: "quoted"; quote: "'" | "`" }
  | { kind: "expand" }
  | { kind: "expansion"; expansion: ExpansionKind }
  | { kind: "expansion-kind" };

export interface Token {
  kind: TokenKind;
  contentStart: number;
  content: string;
  isTerminated: boolean;
}

export class Tokenizer {
  pos = 0;

  constructor(
    private readonly input: string,
    private readonly validate: boolean,
  ) {}

  rest(): Token | null {
    this.skipBlanks();
    if (this.pos === this.input.length) return null;
    const contentStart = this.pos;
    this.pos = this.input.length;
    return { kind: { kind: "expand" }, contentStart, content: this.input.slice(contentStart), isTerminated: false };
  }

  private byte(): string | undefined {
    return this.input[this.pos];
  }

  private prevByte(): string | undefined {
    return this.pos > 0 ? this.input[this.pos - 1] : undefined;
  }

  private skipBlanks(): void {
    while (this.byte() === " " || this.byte() === "\t") this.pos++;
  }

  private parseUnquoted(): string {
    let escaped = "";
    let hasEscape = false;
    let start = this.pos;
    for (let byte = this.byte(); byte !== undefined; byte = this.byte()) {
      if (byte === " " || byte === "\t") {
        if (this.prevByte() === "\\") {
          escaped += this.input.slice(start, this.pos - 1) + byte;
          hasEscape = true;
          start = this.pos + 1;
        } else if (!hasEscape) {
          return this.input.slice(start, this.pos);
        } else {
          break;
        }
      }
      this.pos++;
    }
    const end = this.prevByte() === "\\" ? this.pos - 1 : this.pos;
    if (!hasEscape) return this.input.slice(start, end);
    return escaped + this.input.slice(start, end);
  }

  private parseQuoted(quote: string): [string, boolean] {
    this.pos++;
    let escaped = "";
    for (;;) {
      const idx = this.input.indexOf(quote, this.pos);
      if (idx < 0) break;
      if (this.input[idx + 1] === quote) {
        escaped += this.input.slice(this.pos, idx + 1);
        this.pos = idx + 2;
      } else {
        const quoted = escaped + this.input.slice(this.pos, idx);
        this.pos = idx + 1;
        return [quoted, true];
      }
    }
    const quoted = escaped + this.input.slice(this.pos);
    this.pos = this.input.length;
    return [quoted, false];
  }

  parsePercentToken(): Token {
    this.pos++;
    const kindStart = this.pos;
    while (/^[a-z]$/.test(this.byte() ?? "")) this.pos++;
    const kindName = this.input.slice(kindStart, this.pos);
    const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}", "<": ">", "'": "'", '"': '"', "|": "|" };
    const open = this.byte();
    const close = open !== undefined ? pairs[open] : undefined;
    if (open === undefined || close === undefined) {
      if (this.validate) {
        throw new ParseArgsError(kindName === "" ? "'%' was not properly escaped. Please use '%%'" : `missing a string delimiter after '%${kindName}'`);
      }
      return { kind: { kind: "expansion-kind" }, contentStart: kindStart, content: kindName, isTerminated: false };
    }
    const contentStart = this.pos + 1;
    const expansion = EXPANSION_KINDS[kindName];
    if (expansion === undefined && this.validate) throw new ParseArgsError(`unknown expansion '${kindName}'`);
    const kind: TokenKind = expansion === undefined ? { kind: "expand" } : { kind: "expansion", expansion };
    const [content, isTerminated] = open === close ? this.parseQuoted(open) : this.parseQuotedBalanced(open, close);
    if (this.validate && !isTerminated) throw new ParseArgsError(`unterminated token ${content}`);
    return { kind, contentStart, content, isTerminated };
  }

  private parseQuotedBalanced(open: string, close: string): [string, boolean] {
    this.pos++;
    const start = this.pos;
    let level = 1;
    for (;;) {
      let idx = -1;
      for (let i = this.pos; i < this.input.length; i++) {
        if (this.input[i] === open || this.input[i] === close) {
          idx = i;
          break;
        }
      }
      if (idx < 0) break;
      this.pos = idx + 1;
      if (this.input[idx] === open) level++;
      else {
        level--;
        if (level === 0) break;
      }
    }
    const isTerminated = level === 0;
    let end: number;
    if (isTerminated) end = this.pos - 1;
    else {
      this.pos = this.input.length;
      end = this.pos;
    }
    return [this.input.slice(start, end), isTerminated];
  }

  next(): Token | null {
    this.skipBlanks();
    const byte = this.byte();
    if (byte === undefined) return null;
    if (byte === '"' || byte === "'" || byte === "`") {
      const contentStart = this.pos + 1;
      const [content, isTerminated] = this.parseQuoted(byte);
      const kind: TokenKind = byte === '"' ? { kind: "expand" } : { kind: "quoted", quote: byte };
      if (this.validate && !isTerminated) throw new ParseArgsError(`unterminated token ${content}`);
      return { kind, contentStart, content, isTerminated };
    }
    if (byte === "%") return this.parsePercentToken();
    const contentStart = this.pos;
    const peek = this.input[this.pos + 1];
    if (byte === "\\" && (peek === '"' || peek === "'" || peek === "`" || peek === "%")) this.pos++;
    return { kind: { kind: "unquoted" }, contentStart, content: this.parseUnquoted(), isTerminated: false };
  }
}

export type CompletionState = { kind: "positional" } | { kind: "flag"; flag: Flag | null } | { kind: "flag-argument"; flag: Flag };

export class Args {
  private onlyPositionals = false;
  state: CompletionState = { kind: "positional" };
  readonly positional: string[] = [];
  readonly flags = new Map<string, string>();

  constructor(
    readonly signature: Signature,
    private readonly validate: boolean,
  ) {}

  readToken(parser: Tokenizer): Token | null {
    if (this.signature.rawAfter !== undefined && this.positional.length >= this.signature.rawAfter) {
      this.onlyPositionals = true;
      return parser.rest();
    }
    return parser.next();
  }

  static parse(line: string, signature: Signature, validate: boolean, map: (token: Token) => string): Args {
    const tokenizer = new Tokenizer(line, validate);
    const args = new Args(signature, validate);
    for (let token = args.readToken(tokenizer); token !== null; token = args.readToken(tokenizer)) args.push(map(token));
    args.finish();
    return args;
  }

  static parseAsync(line: string, signature: Signature, map: (token: Token) => string | Promise<string>): Args | Promise<Args> {
    const tokenizer = new Tokenizer(line, true);
    const args = new Args(signature, true);
    const loop = (): Args | Promise<Args> => {
      for (let token = args.readToken(tokenizer); token !== null; token = args.readToken(tokenizer)) {
        const arg = map(token);
        if (arg instanceof Promise) {
          return arg.then((value) => {
            args.push(value);
            return loop();
          });
        }
        args.push(arg);
      }
      args.finish();
      return args;
    };
    return loop();
  }

  push(arg: string): void {
    const awaiting = this.flagAwaitingArgument();
    if (!this.onlyPositionals && arg === "--") {
      this.onlyPositionals = true;
      this.state = { kind: "flag", flag: null };
    } else if (awaiting) {
      this.flags.set(awaiting.name, arg);
      this.state = { kind: "flag-argument", flag: awaiting };
    } else if (!this.onlyPositionals && arg.startsWith("-")) {
      const flags = this.signature.flags ?? [];
      const flag = arg.startsWith("--") ? flags.find((f) => f.name === arg.slice(2)) : flags.find((f) => f.alias !== undefined && f.alias === arg.slice(1));
      if (!flag) {
        if (this.validate) throw new ParseArgsError(`unknown flag '${arg}'`);
        this.positional.push(arg);
        this.state = { kind: "flag", flag: null };
        return;
      }
      if (this.validate && this.flags.has(flag.name)) throw new ParseArgsError(`flag '--${flag.name}' specified more than once`);
      this.flags.set(flag.name, "");
      this.state = { kind: "flag", flag };
    } else {
      this.positional.push(arg);
      this.state = { kind: "positional" };
    }
  }

  private finish(): void {
    if (!this.validate) return;
    const awaiting = this.flagAwaitingArgument();
    if (awaiting) throw new ParseArgsError(`flag '--${awaiting.name}' missing an argument`);
    const [min, max] = this.signature.positionals;
    const actual = this.positional.length;
    if (actual < min || (max !== null && actual > max)) throw wrongPositionalCount(min, max, actual);
  }

  private flagAwaitingArgument(): Flag | null {
    return this.state.kind === "flag" && this.state.flag?.completions ? this.state.flag : null;
  }

  join(sep: string): string {
    return this.positional.join(sep);
  }

  hasFlag(name: string): boolean {
    return this.flags.has(name);
  }

  getFlag(name: string): string | undefined {
    return this.flags.get(name);
  }
}
