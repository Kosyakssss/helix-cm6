import {
  hostHooks2,
  parseKey2,
  formatKey2,
  parseMacro2,
  keyFromDom2,
  MemoryClipboard2,
  Registers2,
  defaultConfig2,
  segmentGraphemes,
  nextGraphemeBoundary2,
  prevGraphemeBoundary2,
  charAt2,
  charBefore2,
  Range2,
  Selection2,
  setHelix2,
  helixOwned2,
  helixField2,
  fromNative2,
  toNative2,
  dropSelectionChange2,
  syncNativeSelection2,
  historyField2,
  HeadlessHost2,
  setMode2,
  docOf2,
  selOf2,
  setSel2,
  commitHistoryNow2,
  jumplistFor2,
  pushJump2,
  gotoLineWithoutJumplist2,
  escapeRegex2,
  compilePattern2,
  pasteImpl2,
  setChanges2,
  changesField2,
  changesOf2,
  setDiagnostics2,
  diagnosticsField2,
  applyTextEdits2,
  APP_COMMANDS2,
  Context2,
  HelixEditor2,
  loadConfig2,
  appKeyLayer2,
  buildKeymaps2,
  SystemClipboard2,
  parseLanguagesToml2,
  LanguageLoader2,
  MARKDOWN_LANGUAGES2,
  createLoader2,
  SyntaxSessions2,
  RustRegexEngine2,
  wasmBytes2,
  loadRegex2,
  loadSyntax2,
  infoOf2,
  statusOf2,
  helixEnv2,
  helixExtension2,
  uiRefresher2,
  uiSignature2,
  makeViewOps2,
  helixHost2,
  helixEditor2
} from "./chunk-0fvx8rg7.js";
// src/core/markup.ts
function print(s) {
  const gs = segmentGraphemes(s);
  let primary = null;
  const ranges = [];
  let left = "";
  let i = 0;
  outer:
    while (i < gs.length) {
      const c = gs[i++];
      const start = left.length;
      if (c !== "#") {
        left += c;
        continue;
      }
      const n = gs[i++];
      let isPrimary;
      let close;
      if (n === "[") {
        isPrimary = true;
        close = "]";
      } else if (n === "(") {
        isPrimary = false;
        close = ")";
      } else if (n === undefined) {
        break;
      } else {
        left += "#" + n;
        continue;
      }
      if (isPrimary && primary !== null)
        throw new Error(`primary already appeared: ${s}`);
      const headAtBeg = gs[i] === "|";
      if (headAtBeg)
        i++;
      while (i < gs.length) {
        const ch = gs[i++];
        const next = gs[i];
        if (!(ch === close && next === "#")) {
          left += ch;
          continue;
        }
        let prev = segmentGraphemes(left).pop();
        if (!headAtBeg) {
          if (prev !== "|") {
            left += ch;
            continue;
          }
          left = left.slice(0, -1);
          prev = segmentGraphemes(left).pop();
        }
        i++;
        if ((prev === `
` || prev === `\r
`) && gs[i] === prev)
          i++;
        if (isPrimary)
          primary = ranges.length;
        ranges.push(headAtBeg ? new Range2(left.length, start) : new Range2(start, left.length));
        continue outer;
      }
      throw new Error(`missing end in ${s}`);
    }
  if (primary === null)
    throw new Error(`missing primary in ${s}`);
  return { text: left, selection: new Selection2(ranges, primary) };
}
function plain(text, selection) {
  const ins = [];
  selection.ranges.forEach((r, i) => {
    const p = i === selection.primaryIndex;
    if (r.anchor < r.head) {
      ins.push([r.anchor, 0, p ? "#[" : "#("], [r.head, 1, p ? "|]#" : "|)#"]);
    } else {
      ins.push([r.anchor, 0, p ? "]#" : ")#"], [r.head, 1, p ? "#[|" : "#(|"]);
    }
  });
  ins.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  let out = text;
  for (const [pos, , m] of ins)
    out = out.slice(0, pos) + m + out.slice(pos);
  return out;
}
export {
  APP_COMMANDS2 as APP_COMMANDS,
  Context2 as Context,
  HeadlessHost2 as HeadlessHost,
  HelixEditor2 as HelixEditor,
  LanguageLoader2 as LanguageLoader,
  MARKDOWN_LANGUAGES2 as MARKDOWN_LANGUAGES,
  MemoryClipboard2 as MemoryClipboard,
  Range2 as Range,
  Registers2 as Registers,
  RustRegexEngine2 as RustRegexEngine,
  Selection2 as Selection,
  SyntaxSessions2 as SyntaxSessions,
  SystemClipboard2 as SystemClipboard,
  appKeyLayer2 as appKeyLayer,
  applyTextEdits2 as applyTextEdits,
  buildKeymaps2 as buildKeymaps,
  changesField2 as changesField,
  changesOf2 as changesOf,
  charAt2 as charAt,
  charBefore2 as charBefore,
  commitHistoryNow2 as commitHistoryNow,
  compilePattern2 as compilePattern,
  createLoader2 as createLoader,
  defaultConfig2 as defaultConfig,
  diagnosticsField2 as diagnosticsField,
  docOf2 as docOf,
  dropSelectionChange2 as dropSelectionChange,
  escapeRegex2 as escapeRegex,
  formatKey2 as formatKey,
  fromNative2 as fromNative,
  gotoLineWithoutJumplist2 as gotoLineWithoutJumplist,
  helixEditor2 as helixEditor,
  helixEnv2 as helixEnv,
  helixExtension2 as helixExtension,
  helixField2 as helixField,
  helixHost2 as helixHost,
  helixOwned2 as helixOwned,
  historyField2 as historyField,
  hostHooks2 as hostHooks,
  infoOf2 as infoOf,
  jumplistFor2 as jumplistFor,
  keyFromDom2 as keyFromDom,
  loadConfig2 as loadConfig,
  loadRegex2 as loadRegex,
  loadSyntax2 as loadSyntax,
  makeViewOps2 as makeViewOps,
  nextGraphemeBoundary2 as nextGraphemeBoundary,
  parseKey2 as parseKey,
  parseLanguagesToml2 as parseLanguagesToml,
  parseMacro2 as parseMacro,
  pasteImpl2 as pasteImpl,
  plain,
  prevGraphemeBoundary2 as prevGraphemeBoundary,
  print,
  pushJump2 as pushJump,
  selOf2 as selOf,
  setChanges2 as setChanges,
  setDiagnostics2 as setDiagnostics,
  setHelix2 as setHelix,
  setMode2 as setMode,
  setSel2 as setSel,
  statusOf2 as statusOf,
  syncNativeSelection2 as syncNativeSelection,
  toNative2 as toNative,
  uiRefresher2 as uiRefresher,
  uiSignature2 as uiSignature,
  wasmBytes2 as wasmBytes
};
