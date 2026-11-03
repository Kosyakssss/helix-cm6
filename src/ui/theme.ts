import { parse as parseToml } from "smol-toml";

export type TomlTable = Record<string, unknown>;

export interface ThemeStyle {
  fg?: string;
  bg?: string;
  underlineColor?: string;
  underlineStyle?: string;
  modifiers: string[];
}

export interface Theme {
  name: string;
  styles: Map<string, ThemeStyle>;
  scopes: string[];
  rainbowLength: number;
  warnings: string[];
}

export type ThemeLoader = (name: string) => string | null;

const ANSI: Record<string, string> = {
  default: "inherit",
  black: "#000000",
  red: "#cd3131",
  green: "#0dbc79",
  yellow: "#e5e510",
  blue: "#2472c8",
  magenta: "#bc3fbc",
  cyan: "#11a8cd",
  gray: "#7f7f7f",
  "light-red": "#f14c4c",
  "light-green": "#23d18b",
  "light-yellow": "#f5f543",
  "light-blue": "#3b8eea",
  "light-magenta": "#d670d6",
  "light-cyan": "#29b8db",
  "light-gray": "#c0c0c0",
  white: "#e5e5e5",
};

function indexedColor(index: number): string {
  const basic = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "light-gray", "gray", "light-red", "light-green", "light-yellow", "light-blue", "light-magenta", "light-cyan", "white"];
  if (index < 16) return ANSI[basic[index]!]!;
  if (index >= 232) {
    const level = 8 + (index - 232) * 10;
    return `rgb(${level}, ${level}, ${level})`;
  }
  const n = index - 16;
  const step = (v: number) => (v === 0 ? 0 : 55 + v * 40);
  return `rgb(${step(Math.floor(n / 36))}, ${step(Math.floor(n / 6) % 6)}, ${step(n % 6)})`;
}

function stringToColor(value: string): string | null {
  if (value.startsWith("#")) return /^#[0-9a-fA-F]{6}$/.test(value) ? value : null;
  if (/^\d+$/.test(value) && Number(value) < 256) return indexedColor(Number(value));
  return null;
}

function parseColor(palette: Map<string, string>, value: unknown): string {
  if (typeof value !== "string") throw new Error(`Unrecognized value: ${String(value)}`);
  const color = palette.get(value) ?? stringToColor(value);
  if (color === null) throw new Error(value.startsWith("#") ? `Malformed hexcode: ${value}` : `Malformed ANSI: ${value}`);
  return color;
}

const MODIFIERS = new Set(["bold", "dim", "italic", "underlined", "slow_blink", "rapid_blink", "reversed", "hidden", "crossed_out"]);
const UNDERLINES = new Set(["line", "curl", "dashed", "dotted", "double_line"]);

function parseStyle(palette: Map<string, string>, style: ThemeStyle, value: unknown): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    style.fg = parseColor(palette, value);
    return;
  }
  for (const [name, entry] of Object.entries(value as TomlTable)) {
    if (name === "fg") style.fg = parseColor(palette, entry);
    else if (name === "bg") style.bg = parseColor(palette, entry);
    else if (name === "underline") {
      if (typeof entry !== "object" || entry === null) throw new Error("Underline must be table");
      const table = entry as TomlTable;
      for (const key of Object.keys(table)) if (key !== "color" && key !== "style") throw new Error(`Invalid underline attribute: ${key}`);
      if ("color" in table) style.underlineColor = parseColor(palette, table.color);
      if ("style" in table) {
        if (typeof table.style !== "string" || !UNDERLINES.has(table.style)) throw new Error(`Invalid underline style: ${String(table.style)}`);
        style.underlineStyle = table.style;
      }
    } else if (name === "modifiers") {
      if (!Array.isArray(entry)) throw new Error("Modifiers should be an array");
      for (const modifier of entry) {
        if (modifier === "underlined") style.underlineStyle = "line";
        else if (typeof modifier === "string" && MODIFIERS.has(modifier)) style.modifiers.push(modifier);
        else throw new Error(`Invalid modifier: ${String(modifier)}`);
      }
    } else throw new Error(`Invalid style attribute: ${name}`);
  }
}

function buildPalette(value: unknown, warnings: string[]): Map<string, string> {
  const palette = new Map(Object.entries(ANSI));
  if (typeof value !== "object" || value === null || Array.isArray(value)) return palette;
  try {
    const own = new Map<string, string>();
    for (const [name, entry] of Object.entries(value as TomlTable)) {
      if (typeof entry !== "string") throw new Error(`Unrecognized value: ${String(entry)}`);
      const color = stringToColor(entry);
      if (color === null) throw new Error(entry.startsWith("#") ? `Malformed hexcode: ${entry}` : `Malformed ANSI: ${entry}`);
      own.set(name, color);
    }
    for (const [name, color] of own) palette.set(name, color);
  } catch (err) {
    warnings.push((err as Error).message);
    return new Map(Object.entries(ANSI));
  }
  return palette;
}

function loadValues(name: string, text: string, load: ThemeLoader | null, visited: Set<string>): TomlTable {
  const values = parseToml(text) as TomlTable;
  const parentName = values.inherits;
  if (typeof parentName !== "string") return values;
  if (visited.has(parentName)) throw new Error(`Cycle found in inheriting: ${parentName}`);
  visited.add(parentName);
  const parentText = load?.(parentName);
  if (parentText === null || parentText === undefined) throw new Error(`File not found for: ${parentName}`);
  const parent = loadValues(parentName, parentText, load, visited);
  const palette = { ...((parent.palette as TomlTable | undefined) ?? {}), ...((values.palette as TomlTable | undefined) ?? {}) };
  const merged: TomlTable = { ...parent, ...values, palette };
  return merged;
}

const DEFAULT_RAINBOW = ["red", "yellow", "green", "blue", "cyan", "magenta"];

export function parseTheme(name: string, text: string, load: ThemeLoader | null = null): Theme {
  const values = loadValues(name, text, load, new Set([name]));
  const warnings: string[] = [];
  const palette = buildPalette(values.palette, warnings);
  const styles = new Map<string, ThemeStyle>();
  const scopes: string[] = [];
  let rainbowLength = 0;
  let rainbow: ThemeStyle[] = DEFAULT_RAINBOW.map((color) => ({ fg: ANSI[color]!, modifiers: [] }));
  if (Array.isArray(values.rainbow)) {
    try {
      rainbow = values.rainbow.map((entry) => {
        const style: ThemeStyle = { modifiers: [] };
        parseStyle(palette, style, entry);
        return style;
      });
    } catch (err) {
      warnings.push((err as Error).message);
    }
  } else if (values.rainbow !== undefined) warnings.push(`Could not parse value as an array: '${String(values.rainbow)}'`);
  rainbow.forEach((style, i) => {
    styles.set(`rainbow.${i}`, style);
    scopes.push(`rainbow.${i}`);
    rainbowLength += 1;
  });
  for (const [key, value] of Object.entries(values)) {
    if (key === "palette" || key === "inherits" || key === "rainbow") continue;
    const style: ThemeStyle = { modifiers: [] };
    try {
      parseStyle(palette, style, value);
    } catch (err) {
      warnings.push(`Failed to parse style for key "${key}". ${(err as Error).message}`);
    }
    styles.set(key, style);
    scopes.push(key);
  }
  return { name, styles, scopes, rainbowLength, warnings };
}

export function themeStyle(theme: Theme, scope: string): ThemeStyle | null {
  for (let s: string | null = scope; s !== null; ) {
    const style = theme.styles.get(s);
    if (style) return style;
    const dot: number = s.lastIndexOf(".");
    s = dot < 0 ? null : s.slice(0, dot);
  }
  return null;
}

export function scopeClass(scope: string): string {
  return `hx-s-${scope.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

const UNDERLINE_CSS: Record<string, string> = { line: "solid", curl: "wavy", dashed: "dashed", dotted: "dotted", double_line: "double" };

export function styleCss(style: ThemeStyle): string {
  const parts: string[] = [];
  const reversed = style.modifiers.includes("reversed");
  const fg = reversed ? style.bg : style.fg;
  const bg = reversed ? style.fg : style.bg;
  if (fg) parts.push(`color: ${fg}`);
  if (bg) parts.push(`background-color: ${bg}`);
  const lines: string[] = [];
  if (style.underlineStyle) lines.push("underline");
  if (style.modifiers.includes("crossed_out")) lines.push("line-through");
  if (lines.length > 0) parts.push(`text-decoration-line: ${lines.join(" ")}`);
  if (style.underlineStyle) parts.push(`text-decoration-style: ${UNDERLINE_CSS[style.underlineStyle] ?? "solid"}`);
  if (style.underlineColor) parts.push(`text-decoration-color: ${style.underlineColor}`);
  if (style.modifiers.includes("bold")) parts.push("font-weight: bold");
  if (style.modifiers.includes("italic")) parts.push("font-style: italic");
  if (style.modifiers.includes("dim")) parts.push("opacity: 0.6");
  return parts.join("; ");
}

export const DEFAULT_SCOPES: readonly string[] = [
  "attribute",
  "type",
  "type.builtin",
  "type.enum.variant",
  "constructor",
  "constant",
  "constant.builtin",
  "constant.character",
  "constant.character.escape",
  "constant.numeric",
  "string",
  "string.regexp",
  "string.special",
  "comment",
  "variable",
  "variable.builtin",
  "variable.parameter",
  "variable.other.member",
  "label",
  "punctuation",
  "punctuation.bracket",
  "punctuation.delimiter",
  "punctuation.special",
  "keyword",
  "keyword.control",
  "keyword.directive",
  "operator",
  "function",
  "function.builtin",
  "function.macro",
  "tag",
  "namespace",
  "special",
  "markup.heading",
  "markup.heading.marker",
  "markup.list",
  "markup.bold",
  "markup.italic",
  "markup.strikethrough",
  "markup.link",
  "markup.link.url",
  "markup.link.text",
  "markup.quote",
  "markup.raw",
  "diff.plus",
  "diff.minus",
  "diff.delta",
];
