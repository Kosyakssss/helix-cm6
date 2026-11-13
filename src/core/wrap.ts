import type { Text } from "@codemirror/state";
import { segmentGraphemes } from "../graphemes";
import { graphemeWidth, tabWidthAt } from "../movement";

export interface ReflowOptions {
  textWidth: number;
  tabWidth: number;
  lineEnding: string;
  commentTokens: readonly string[];
}

interface Word {
  start: number;
  end: number;
  width: number;
}

const encoder = new TextEncoder();
const WHITESPACE = /^\p{White_Space}$/u;

function isWhitespace(ch: string): boolean {
  return WHITESPACE.test(ch);
}

function trimStart(s: string): string {
  let i = 0;
  for (const ch of s) {
    if (!isWhitespace(ch)) break;
    i += ch.length;
  }
  return s.slice(i);
}

function trim(s: string): string {
  const start = trimStart(s);
  const chars = [...start];
  while (chars.length > 0 && isWhitespace(chars.at(-1)!)) chars.pop();
  return chars.join("");
}

function displayWidth(s: string, tabWidth: number): number {
  let col = 0;
  for (const g of segmentGraphemes(s)) col += g === "\t" ? tabWidthAt(col, tabWidth) : graphemeWidth(g);
  return col;
}

function isSeparator(line: string, commentTokens: readonly string[]): boolean {
  const trimmed = trim(line);
  return trimmed === "" || commentTokens.includes(trimmed);
}

function commentToken(line: string, commentTokens: readonly string[]): string | null {
  const trimmed = trimStart(line);
  let best: string | null = null;
  for (const token of commentTokens) {
    if (!trimmed.startsWith(token)) continue;
    if (best === null || encoder.encode(token).length >= encoder.encode(best).length) best = token;
  }
  return best;
}

function lineContent(text: Text, line: number): string {
  return text.line(line + 1).text;
}

function collectWords(text: Text, startLine: number, endLine: number, opts: ReflowOptions): Word[] {
  const words: Word[] = [];
  for (let line = startLine; line <= endLine; line++) {
    const lineStart = text.line(line + 1).from;
    const content = lineContent(text, line);
    const trimmed = trimStart(content);
    const body = content.length - trimmed.length + (commentToken(content, opts.commentTokens)?.length ?? 0);
    let word: number | null = null;
    const pushWord = (start: number, end: number) => {
      words.push({ start: lineStart + start, end: lineStart + end, width: displayWidth(content.slice(start, end), opts.tabWidth) });
    };
    let i = 0;
    for (const ch of content) {
      if (i >= body && !isWhitespace(ch)) word ??= i;
      else if (word !== null) {
        pushWord(word, i);
        word = null;
      }
      i += ch.length;
    }
    if (word !== null) pushWord(word, content.length);
  }
  return words;
}

export function reflow(text: Text, startLine: number, endLine: number, opts: ReflowOptions): [number, number, string][] {
  const separator = (line: number) => isSeparator(lineContent(text, line), opts.commentTokens);
  const changes: [number, number, string][] = [];
  let line = startLine;
  while (line <= endLine) {
    if (separator(line)) {
      line++;
      continue;
    }
    const paragraphStart = line;
    while (line <= endLine && !separator(line)) line++;
    const words = collectWords(text, paragraphStart, line - 1, opts);
    const firstWord = words[0];
    if (!firstWord) continue;
    const firstLine = lineContent(text, paragraphStart);
    const indent = firstLine.slice(0, firstLine.length - trimStart(firstLine).length);
    const token = commentToken(firstLine, opts.commentTokens);
    const prefix = token !== null ? `${indent}${token} ` : indent;
    const prefixWidth = displayWidth(prefix, opts.tabWidth);
    const lineBreak = `${opts.lineEnding}${prefix}`;
    let col = prefixWidth + firstWord.width;
    for (let i = 1; i < words.length; i++) {
      const prev = words[i - 1]!;
      const word = words[i]!;
      let gap: string;
      if (col + 1 + word.width > opts.textWidth) {
        col = prefixWidth + word.width;
        gap = lineBreak;
      } else {
        col += 1 + word.width;
        gap = " ";
      }
      if (text.sliceString(prev.end, word.start) !== gap) changes.push([prev.end, word.start, gap]);
    }
  }
  return changes;
}
