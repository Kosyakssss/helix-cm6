import type { ChangeDesc, Text } from "@codemirror/state";
import { Range, Selection } from "./selection";
import type { IndentStyle } from "./syntax/indent";

const LAST_TABSTOP = Number.MAX_SAFE_INTEGER;

type CaseChange = "upcase" | "downcase" | "capitalize" | "pascalcase" | "camelcase";

type FormatItem =
  | { kind: "text"; text: string }
  | { kind: "capture"; group: number }
  | { kind: "case"; group: number; change: CaseChange }
  | { kind: "conditional"; group: number; ifSet: string; ifUnset: string };

interface ParsedTransform {
  regex: string;
  replacement: FormatItem[];
  options: string;
}

type Parsed =
  | { kind: "tabstop"; tabstop: number; transform: ParsedTransform | null }
  | { kind: "placeholder"; tabstop: number; value: Parsed[] }
  | { kind: "choice"; tabstop: number; choices: string[] }
  | { kind: "variable"; name: string; fallback: Parsed[] | null; transform: ParsedTransform | null }
  | { kind: "text"; text: string };

type Result<T> = [string, T] | null;
type Parser<T> = (input: string) => Result<T>;

const TEXT_ESCAPES = ["\\", "}", "$"];
const CHOICE_ESCAPES = ["\\", "|", ","];

function text(escapes: readonly string[], terms: readonly string[]): Parser<string> {
  return (input) => {
    let out = "";
    for (let i = 0; i < input.length; ) {
      const c = String.fromCodePoint(input.codePointAt(i)!);
      if (c === "\\") {
        const next = input[i + 1];
        if (next !== undefined && escapes.includes(next)) {
          out += next;
          i += 2;
          continue;
        }
        out += "\\";
        i += 1;
        continue;
      }
      if (terms.includes(c)) return [input.slice(i), out];
      out += c;
      i += c.length;
    }
    return ["", out];
  };
}

function lit(input: string, value: string): string | null {
  return input.startsWith(value) ? input.slice(value.length) : null;
}

function digit(input: string): Result<number> {
  const match = /^[0-9]+/.exec(input);
  return match ? [input.slice(match[0].length), Number(match[0])] : null;
}

function name(input: string): Result<string> {
  const match = /^[_a-zA-Z][_a-zA-Z0-9]*/.exec(input);
  return match ? [input.slice(match[0].length), match[0]] : null;
}

function first<T>(input: string, parsers: readonly Parser<T>[]): Result<T> {
  for (const parser of parsers) {
    const result = parser(input);
    if (result) return result;
  }
  return null;
}

function many<T>(parser: Parser<T>, input: string): [string, T[]] {
  const out: T[] = [];
  let rest = input;
  for (;;) {
    const result = parser(rest);
    if (!result || result[0].length === rest.length) return [rest, out];
    rest = result[0];
    out.push(result[1]);
  }
}

function format(input: string): Result<FormatItem> {
  return first<FormatItem>(input, [
    (s) => {
      const r = lit(s, "$");
      const d = r === null ? null : digit(r);
      return d && [d[0], { kind: "capture", group: d[1] }];
    },
    (s) => {
      const r = lit(s, "${");
      const d = r === null ? null : digit(r);
      const e = d && lit(d[0], "}");
      return d && e !== null && e !== undefined ? [e, { kind: "capture", group: d[1] }] : null;
    },
    (s) => {
      const r = lit(s, "${");
      const d = r === null ? null : digit(r);
      const c = d && lit(d[0], ":/");
      if (!d || c === null || c === undefined) return null;
      for (const change of ["upcase", "downcase", "capitalize", "pascalcase", "camelcase"] as const) {
        const after = lit(c, change);
        const e = after === null ? null : lit(after, "}");
        if (e !== null) return [e, { kind: "case", group: d[1], change }];
      }
      return null;
    },
    (s) => {
      const r = lit(s, "${");
      const d = r === null ? null : digit(r);
      const c = d && lit(d[0], ":+");
      if (!d || c === null || c === undefined) return null;
      const [after, value] = text(TEXT_ESCAPES, ["}"])(c)!;
      const e = lit(after, "}");
      return e === null ? null : [e, { kind: "conditional", group: d[1], ifSet: value, ifUnset: "" }];
    },
    (s) => {
      const r = lit(s, "${");
      const d = r === null ? null : digit(r);
      const c = d && lit(d[0], ":?");
      if (!d || c === null || c === undefined) return null;
      const [after, ifSet] = text(TEXT_ESCAPES, [":"])(c)!;
      const colon = lit(after, ":");
      if (colon === null) return null;
      const [end, ifUnset] = text(TEXT_ESCAPES, ["}"])(colon)!;
      const e = lit(end, "}");
      return e === null ? null : [e, { kind: "conditional", group: d[1], ifSet, ifUnset }];
    },
    (s) => {
      const r = lit(s, "${");
      const d = r === null ? null : digit(r);
      const c = d && lit(d[0], ":");
      if (!d || c === null || c === undefined) return null;
      const [after, value] = text(TEXT_ESCAPES, ["}"])(lit(c, "-") ?? c)!;
      const e = lit(after, "}");
      return e === null ? null : [e, { kind: "conditional", group: d[1], ifSet: "", ifUnset: value }];
    },
  ]);
}

function regex(input: string): Result<ParsedTransform> {
  const open = lit(input, "/");
  if (open === null) return null;
  const [afterRegex, value] = text(["/"], ["/"])(open)!;
  const middle = lit(afterRegex, "/");
  if (middle === null) return null;
  const [afterFormat, replacement] = many<FormatItem>(
    (s) =>
      first<FormatItem>(s, [
        format,
        (t) => {
          const r = lit(t, "$");
          return r === null ? null : [r, { kind: "text", text: "$" }];
        },
        (t) => {
          const [r, v] = text(["\\", "/"], ["/", "$"])(t)!;
          return [r, { kind: "text", text: v }];
        },
      ]),
    middle,
  );
  const close = lit(afterFormat, "/");
  if (close === null) return null;
  const [rest, options] = text([], ["}"])(close)!;
  return [rest, { regex: value, replacement, options }];
}

function tabstop(input: string): Result<Parsed> {
  const plain = lit(input, "$");
  const d = plain === null ? null : digit(plain);
  if (d) return [d[0], { kind: "tabstop", tabstop: d[1], transform: null }];
  const open = lit(input, "${");
  const n = open === null ? null : digit(open);
  if (!n) return null;
  const transform = regex(n[0]);
  const close = lit(transform ? transform[0] : n[0], "}");
  return close === null ? null : [close, { kind: "tabstop", tabstop: n[1], transform: transform ? transform[1] : null }];
}

function placeholder(input: string): Result<Parsed> {
  const open = lit(input, "${");
  const n = open === null ? null : digit(open);
  const colon = n && lit(n[0], ":");
  if (!n || colon === null || colon === undefined) return null;
  const [rest, value] = many(anything(TEXT_ESCAPES, true), colon);
  const close = lit(rest, "}");
  return close === null ? null : [close, { kind: "placeholder", tabstop: n[1], value }];
}

function choice(input: string): Result<Parsed> {
  const open = lit(input, "${");
  const n = open === null ? null : digit(open);
  const bar = n && lit(n[0], "|");
  if (!n || bar === null || bar === undefined) return null;
  const part = text(CHOICE_ESCAPES, ["|", ","]);
  const choices: string[] = [];
  let [rest, value] = part(bar)!;
  choices.push(value);
  for (;;) {
    const next = lit(rest, ",");
    if (next === null) break;
    [rest, value] = part(next)!;
    choices.push(value);
  }
  const close = lit(rest, "|}");
  return close === null ? null : [close, { kind: "choice", tabstop: n[1], choices }];
}

function variable(input: string): Result<Parsed> {
  return first<Parsed>(input, [
    (s) => {
      const r = lit(s, "$");
      const v = r === null ? null : name(r);
      return v && [v[0], { kind: "variable", name: v[1], fallback: null, transform: null }];
    },
    (s) => {
      const r = lit(s, "${");
      const v = r === null ? null : name(r);
      const e = v && lit(v[0], "}");
      return v && e !== null && e !== undefined ? [e, { kind: "variable", name: v[1], fallback: null, transform: null }] : null;
    },
    (s) => {
      const r = lit(s, "${");
      const v = r === null ? null : name(r);
      const c = v && lit(v[0], ":");
      if (!v || c === null || c === undefined) return null;
      const [rest, fallback] = many(anything(TEXT_ESCAPES, true), c);
      const e = lit(rest, "}");
      return e === null ? null : [e, { kind: "variable", name: v[1], fallback, transform: null }];
    },
    (s) => {
      const r = lit(s, "${");
      const v = r === null ? null : name(r);
      const t = v && regex(v[0]);
      const e = t && lit(t[0], "}");
      return v && t && e !== null && e !== undefined ? [e, { kind: "variable", name: v[1], fallback: null, transform: t[1] }] : null;
    },
  ]);
}

function anything(escapes: readonly string[], endAtBrace: boolean): Parser<Parsed> {
  const terms = endAtBrace ? ["$", "}"] : ["$"];
  return (input) =>
    first<Parsed>(input, [
      tabstop,
      placeholder,
      choice,
      variable,
      (s) => {
        const r = lit(s, "$");
        return r === null ? null : [r, { kind: "text", text: "$" }];
      },
      (s) => {
        const [r, v] = text(escapes, terms)(s)!;
        return [r, { kind: "text", text: v }];
      },
    ]);
}

function parse(source: string): Parsed[] | null {
  const [rest, elements] = many(anything(TEXT_ESCAPES, false), source);
  return rest === "" && elements.length > 0 ? elements : null;
}

type SnippetElement =
  | { kind: "tabstop"; idx: number }
  | { kind: "variable"; name: string; fallback: SnippetElement[] | null; transform: Transform | null }
  | { kind: "text"; text: string };

type TabstopKind =
  | { kind: "choice"; choices: readonly string[] }
  | { kind: "placeholder"; fallback: SnippetElement[] }
  | { kind: "empty" }
  | { kind: "transform"; transform: Transform };

interface SourceTabstop {
  idx: number;
  parent: number | null;
  kind: TabstopKind;
}

function casePart(value: string, change: CaseChange): string {
  switch (change) {
    case "upcase":
      return value.toUpperCase();
    case "downcase":
      return value.toLowerCase();
    case "capitalize": {
      const [head, ...tail] = [...value];
      return `${(head ?? "").toUpperCase()}${tail.join("")}`;
    }
    case "pascalcase":
    case "camelcase": {
      const pascal = change === "pascalcase";
      let out = "";
      let start = pascal;
      let isFirst = true;
      for (const c of value) {
        if (!/[\p{Alphabetic}\p{N}]/u.test(c)) {
          start = true;
          continue;
        }
        if (!pascal && isFirst) out += c.toLowerCase();
        else out += start ? c.toUpperCase() : c;
        isFirst = false;
        start = false;
      }
      return out;
    }
  }
}

class Transform {
  private constructor(
    private readonly regex: RegExp,
    private readonly global: boolean,
    private readonly replacement: readonly FormatItem[],
  ) {}

  static create(parsed: ParsedTransform): Transform | null {
    const flags = [...parsed.options].filter((c) => c === "i" || c === "m").join("");
    try {
      return new Transform(new RegExp(parsed.regex, `${flags}gu`), parsed.options.includes("g"), parsed.replacement);
    } catch {
      return null;
    }
  }

  apply(value: string): string {
    let out = "";
    let last = 0;
    this.regex.lastIndex = 0;
    for (const match of value.matchAll(this.regex)) {
      out += value.slice(last, match.index);
      last = match.index + match[0].length;
      for (const item of this.replacement) {
        if (item.kind === "text") out += item.text;
        else if (item.kind === "capture") out += match[item.group] ?? "";
        else if (item.kind === "case") {
          const group = match[item.group];
          if (group) out += casePart(group, item.change);
        } else out += match[item.group] ? item.ifSet : item.ifUnset;
      }
      if (!this.global) break;
    }
    return out + value.slice(last);
  }
}

export class Snippet {
  readonly elements: SnippetElement[];
  readonly tabstops: SourceTabstop[] = [];

  static parse(source: string): Snippet | null {
    const parsed = parse(source);
    return parsed ? new Snippet(parsed) : null;
  }

  private constructor(parsed: Parsed[]) {
    this.elements = this.elaborate(parsed, null);
    this.fixup();
    const last = this.tabstops[this.tabstops.length - 1];
    if (!last || last.idx !== LAST_TABSTOP) {
      this.tabstops.push({ idx: LAST_TABSTOP, parent: null, kind: { kind: "empty" } });
      this.elements.push({ kind: "tabstop", idx: LAST_TABSTOP });
    }
    this.renumber();
  }

  private place(idx: number): number {
    return idx === 0 ? LAST_TABSTOP : idx - 1;
  }

  private elaborate(parsed: readonly Parsed[], parent: number | null): SnippetElement[] {
    return parsed.map((element): SnippetElement => {
      switch (element.kind) {
        case "tabstop": {
          const idx = this.place(element.tabstop);
          if (!element.transform) {
            this.tabstops.push({ idx, parent, kind: { kind: "placeholder", fallback: [] } });
          } else {
            const transform = Transform.create(element.transform);
            this.tabstops.push({ idx, parent, kind: transform ? { kind: "transform", transform } : { kind: "empty" } });
          }
          return { kind: "tabstop", idx };
        }
        case "placeholder": {
          const idx = this.place(element.tabstop);
          const fallback = this.elaborate(idx === LAST_TABSTOP ? [] : element.value, idx);
          this.tabstops.push({ idx, parent, kind: { kind: "placeholder", fallback } });
          return { kind: "tabstop", idx };
        }
        case "choice": {
          const idx = this.place(element.tabstop);
          this.tabstops.push({ idx, parent, kind: { kind: "choice", choices: element.choices } });
          return { kind: "tabstop", idx };
        }
        case "variable":
          return {
            kind: "variable",
            name: element.name,
            fallback: element.fallback ? this.elaborate(element.fallback, parent) : null,
            transform: element.transform ? Transform.create(element.transform) : null,
          };
        case "text":
          return { kind: "text", text: element.text };
      }
    });
  }

  private fixup(): void {
    const sorted = this.tabstops.map((tabstop, i) => [tabstop, i] as const).sort((a, b) => a[0].idx - b[0].idx || a[1] - b[1]);
    this.tabstops.length = 0;
    for (const [tabstop] of sorted) {
      const previous = this.tabstops[this.tabstops.length - 1];
      if (!previous || previous.idx !== tabstop.idx) this.tabstops.push(tabstop);
      else if (previous.kind.kind === "empty") this.tabstops[this.tabstops.length - 1] = tabstop;
    }
  }

  private renumber(): void {
    const index = new Map(this.tabstops.map((tabstop, i) => [tabstop.idx, i]));
    const walk = (elements: readonly SnippetElement[]) => {
      for (const element of elements) {
        if (element.kind === "tabstop") element.idx = index.get(element.idx)!;
        else if (element.kind === "variable" && element.fallback) walk(element.fallback);
      }
    };
    walk(this.elements);
    for (const tabstop of this.tabstops) {
      if (tabstop.parent !== null) tabstop.parent = index.get(tabstop.parent)!;
      if (tabstop.kind.kind === "placeholder") walk(tabstop.kind.fallback);
    }
  }
}

export interface Span {
  start: number;
  end: number;
}

export interface RenderedTabstop {
  ranges: Span[];
  parent: number | null;
  placeholder: boolean;
  choices: readonly string[] | null;
}

export interface RenderedSnippet {
  tabstops: RenderedTabstop[];
  ranges: Span[];
}

export interface SnippetContext {
  variable(name: string): string | null;
  tabWidth: number;
  indentStyle: IndentStyle;
}

function tabstopSelection(tabstop: RenderedTabstop, backward: boolean, primary: number, snippetRanges: number): Selection {
  return new Selection(
    tabstop.ranges.map((span) => (backward ? new Range(span.end, span.start) : new Range(span.start, span.end))),
    primary * Math.floor(tabstop.ranges.length / snippetRanges),
  );
}

function normalizeIndentation(prefix: string, line: string, style: IndentStyle, tabWidth: number): [string, number] {
  let off = 0;
  for (const c of prefix) off += c === "\t" ? tabWidth - (off % tabWidth) : 1;
  let width = 0;
  let original = 0;
  for (const c of line) {
    if (c === "\t") width += tabWidth - ((width + off) % tabWidth);
    else if (c === " ") width += 1;
    else break;
    original++;
  }
  if (style.kind === "tabs") return ["\t".repeat(Math.floor(width / tabWidth)) + " ".repeat(width % tabWidth), original];
  return [" ".repeat(width), original];
}

class Renderer {
  text = "";

  constructor(
    private readonly context: SnippetContext,
    private readonly source: Snippet,
    private readonly target: RenderedSnippet,
    private readonly indent: string,
    public off: number,
    private atNewline: boolean,
  ) {}

  elements(elements: readonly SnippetElement[]): void {
    for (const element of elements) {
      if (element.kind === "tabstop") this.tabstop(element.idx);
      else if (element.kind === "text") this.multiline(element.text);
      else {
        const value = this.context.variable(element.name);
        if (value !== null) this.multiline(element.transform ? element.transform.apply(value) : value);
        else if (element.fallback) this.elements(element.fallback);
      }
    }
  }

  private multiline(text: string): void {
    const lines = text.split("\n").map((line) => (line.endsWith("\r") ? line.slice(0, -1) : line));
    this.push(lines[0]!, this.atNewline);
    for (const line of lines.slice(1)) {
      this.off += 1 + this.indent.length;
      this.text += `\n${this.indent}`;
      this.push(line, true);
    }
  }

  private push(text: string, atNewline: boolean): void {
    let rest = text;
    if (atNewline) {
      const [indent, used] = normalizeIndentation(this.indent, rest, this.context.indentStyle, this.context.tabWidth);
      this.text += indent;
      this.off += indent.length;
      rest = rest.slice(used);
      if (rest === "") {
        this.atNewline = true;
        return;
      }
    }
    this.text += rest;
    this.off += rest.length;
  }

  private tabstop(index: number): void {
    const start = this.off;
    const kind = this.source.tabstops[index]!.kind;
    let end = start;
    if (kind.kind === "placeholder" && kind.fallback.length > 0) {
      this.elements(kind.fallback);
      this.target.tabstops[index]!.placeholder = true;
      end = this.off;
    }
    this.target.tabstops[index]!.ranges.push({ start, end });
  }
}

export function prepareRender(snippet: Snippet): RenderedSnippet {
  return {
    ranges: [],
    tabstops: snippet.tabstops.map((tabstop) => ({
      ranges: [],
      parent: tabstop.parent,
      placeholder: tabstop.kind.kind === "choice",
      choices: tabstop.kind.kind === "choice" ? tabstop.kind.choices : null,
    })),
  };
}

export function renderSnippet(
  snippet: Snippet,
  doc: Text,
  selection: Selection,
  changeRange: (range: Range) => [number, number],
  context: SnippetContext,
): { changes: [number, number, string][]; rendered: RenderedSnippet; primary: number } {
  const rendered = prepareRender(snippet);
  const changes: [number, number, string][] = [];
  let off = 0;
  let lastEnd = 0;
  let primary = 0;
  selection.ranges.forEach((range, i) => {
    const [from, to] = changeRange(range);
    if (changes.length > 0 && from < lastEnd) {
      if (i === selection.primaryIndex) primary = changes.length - 1;
      return;
    }
    lastEnd = to;
    if (i === selection.primaryIndex) primary = changes.length;
    const line = doc.lineAt(from);
    const prefix = doc.sliceString(line.from, from);
    const indentLength = prefix.length - prefix.trimStart().length;
    const indent = prefix.slice(0, indentLength);
    const position = from + off;
    const renderer = new Renderer(context, snippet, rendered, indent, position, indentLength === from - line.from);
    renderer.elements(snippet.elements);
    rendered.ranges.push({ start: position, end: renderer.off });
    off += from - to + (renderer.off - position);
    changes.push([from, to, renderer.text]);
  });
  return { changes, rendered, primary };
}

export function firstSelection(rendered: RenderedSnippet, backward: boolean, primary: number): Selection {
  return tabstopSelection(rendered.tabstops[0]!, backward, primary, rendered.ranges.length);
}

export class ActiveSnippet {
  private readonly active = new Set<number>();
  private current = 0;

  private constructor(
    private readonly ranges: Span[],
    private readonly tabstops: RenderedTabstop[],
  ) {}

  static create(rendered: RenderedSnippet): ActiveSnippet | null {
    return rendered.tabstops.length === 1 ? null : new ActiveSnippet(rendered.ranges, rendered.tabstops);
  }

  isValid(selection: Selection): boolean {
    let index = 0;
    for (const range of selection.ranges) {
      const from = range.from();
      const to = range.to();
      for (;;) {
        const outer = this.ranges[index];
        if (!outer) return false;
        if (outer.end <= from) {
          index++;
          continue;
        }
        if (outer.start <= from && to <= outer.end) break;
        return false;
      }
    }
    return true;
  }

  allTabstops(): readonly RenderedTabstop[] {
    return this.tabstops;
  }

  deletePlaceholder(): [number, number, string][] {
    return this.tabstops[this.current]!.ranges.map((span) => [span.start, span.end, ""]);
  }

  map(changes: ChangeDesc): boolean {
    for (const range of this.ranges) {
      range.start = changes.mapPos(range.start, 1);
      range.end = changes.mapPos(range.end, 1);
    }
    this.tabstops.forEach((tabstop, i) => {
      const live = this.active.has(i);
      for (const range of tabstop.ranges) {
        const empty = range.start === range.end;
        range.start = changes.mapPos(range.start, 1);
        range.end = changes.mapPos(range.end, live || empty ? 1 : -1);
      }
      const perSnippet = Math.floor(tabstop.ranges.length / this.ranges.length);
      let snippet = 0;
      let inSnippet = 0;
      let previous: Span = { start: 0, end: 0 };
      tabstop.ranges = tabstop.ranges.filter((range) => {
        if (inSnippet === perSnippet) {
          snippet++;
          inSnippet = 0;
        }
        inSnippet++;
        const outer = this.ranges[snippet]!;
        const keep = outer.start <= outer.end;
        if (keep) {
          if (previous.end > range.start) {
            range.start = previous.end;
            range.end = Math.max(range.end, range.start);
          }
          previous = range;
        }
        return keep;
      });
    });
    return this.ranges.every((range) => range.end <= range.start);
  }

  next(selection: Selection): [Selection, boolean] {
    const primary = this.primaryIndex(selection);
    while (this.current + 1 < this.tabstops.length) {
      this.current++;
      if (this.activate()) return [this.selection(primary), this.current + 1 === this.tabstops.length];
    }
    return [this.selection(primary), true];
  }

  previous(selection: Selection): Selection | null {
    const primary = this.primaryIndex(selection);
    while (this.current !== 0) {
      this.current--;
      if (this.activate()) return this.selection(primary);
    }
    return null;
  }

  insertSubsnippet(rendered: RenderedSnippet): ActiveSnippet | null {
    const fits = rendered.ranges.length % this.ranges.length === 0 && this.ranges.every((outer) => rendered.ranges.some((inner) => outer.start <= inner.start && inner.end <= outer.end));
    if (!fits) return ActiveSnippet.create(rendered);
    const parent = this.tabstops[this.current]!.parent;
    const tabstops = rendered.tabstops.map((tabstop) => ({ ...tabstop, parent: tabstop.parent !== null ? tabstop.parent + this.current : parent }));
    this.tabstops.splice(this.current, 1, ...tabstops);
    this.activate();
    return this;
  }

  private selection(primary: number): Selection {
    return tabstopSelection(this.tabstops[this.current]!, false, primary, this.ranges.length);
  }

  private primaryIndex(selection: Selection): number {
    const primary = selection.primary();
    return Math.max(
      this.ranges.findIndex((range) => range.start <= primary.from() && primary.to() <= range.end + 1),
      0,
    );
  }

  private activate(): boolean {
    if (this.current === this.tabstops.length - 1) return false;
    this.active.clear();
    this.active.add(this.current);
    let parent = this.tabstops[this.current]!.parent;
    while (parent !== null) {
      this.active.add(parent);
      parent = this.tabstops[parent]!.parent;
    }
    return true;
  }
}
