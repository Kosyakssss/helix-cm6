import { Prec, type Extension } from "@codemirror/state";
import { EditorView, showPanel, type Panel } from "@codemirror/view";
import type { HelixEditor } from "../core/editor";
import type { Host } from "../core/host";
import { diagnosticsOf, type Severity } from "../diagnostics";
import { nextGraphemeBoundary } from "../graphemes";
import { helixField } from "../state";
import { add, make } from "../view/dom";
import { helixEnv } from "../view/view";
import { scopeClass } from "./theme";

export interface StatusPart {
  text: string;
  scope: string | null;
}

const SCRATCH = "[scratch]";

function counts(severities: readonly string[], list: readonly { severity: Severity | null }[]): StatusPart[] {
  const totals: Record<string, number> = { hint: 0, info: 0, warning: 0, error: 0 };
  for (const d of list) totals[d.severity ?? "hint"] = (totals[d.severity ?? "hint"] ?? 0) + 1;
  const parts: StatusPart[] = [];
  for (const severity of severities) {
    const n = totals[severity] ?? 0;
    if (n > 0) parts.push({ text: "●", scope: severity }, { text: ` ${n} `, scope: null });
  }
  return parts;
}

export function statuslineElement(name: string, editor: HelixEditor, host: Host, focused: boolean): StatusPart[] {
  const value = host.state.field(helixField);
  const doc = host.state.doc;
  const sl = editor.config.statusline;
  const cursor = value.selection.primary().cursor(doc);
  const plain = (text: string): StatusPart[] => [{ text, scope: null }];
  const path = host.path ?? null;
  switch (name) {
    case "mode": {
      const mode = value.mode === "insert" ? sl.modeInsert : value.mode === "select" ? sl.modeSelect : sl.modeNormal;
      if (!focused) return plain(" ".repeat([...mode].length + 2));
      return [{ text: ` ${mode} `, scope: editor.config.colorModes ? `ui.statusline.${value.mode}` : null }];
    }
    case "spinner":
      return plain(editor.busyFrame() ?? " ");
    case "file-name":
      return plain(` ${host.name} `);
    case "file-absolute-path":
      return plain(` ${path ?? SCRATCH} `);
    case "file-base-name": {
      const name_ = path ?? host.name;
      return plain(` ${name_.slice(name_.lastIndexOf("/") + 1)} `);
    }
    case "file-modification-indicator":
      return plain(editor.isModified(host) ? "[+]" : "   ");
    case "read-only-indicator":
      return plain(host.state.readOnly ? " [readonly] " : "");
    case "file-encoding":
      return [];
    case "file-line-ending":
      return plain(" LF ");
    case "file-indent-style": {
      const style = editor.indent(host).style;
      return plain(style.kind === "tabs" ? " tabs " : ` ${style.width} space${style.width === 1 ? "" : "s"} `);
    }
    case "file-type":
      return plain(` ${editor.languageName(host) ?? "text"} `);
    case "diagnostics":
      return counts(sl.diagnostics, diagnosticsOf(host.state));
    case "workspace-diagnostics": {
      const parts = counts(sl.workspaceDiagnostics, editor.workspaceDiagnostics(host));
      return parts.length > 0 ? [{ text: " W ", scope: null }, ...parts] : [];
    }
    case "selections": {
      const n = value.selection.ranges.length;
      return plain(n === 1 ? " 1 sel " : ` ${value.selection.primaryIndex + 1}/${n} sels `);
    }
    case "primary-selection-length": {
      const r = value.selection.primary();
      const chars = [...doc.sliceString(r.from(), r.to())].length;
      return plain(` ${chars} char${chars === 1 ? "" : "s"} `);
    }
    case "position": {
      const line = doc.lineAt(cursor);
      let col = 1;
      for (let pos = line.from; pos < cursor; pos = nextGraphemeBoundary(doc, pos)) col++;
      return plain(` ${line.number}:${col} `);
    }
    case "position-percentage":
      return plain(`${Math.floor((doc.lineAt(cursor).number * 100) / doc.lines)}%`);
    case "total-line-numbers":
      return plain(` ${doc.lines} `);
    case "separator":
      return [{ text: sl.separator, scope: "ui.statusline.separator" }];
    case "spacer":
      return plain(" ");
    case "version-control":
      return plain(editor.versionControlHead(host));
    case "register":
      return focused && editor.selectedRegister ? plain(` reg=${editor.selectedRegister} `) : [];
    case "current-working-directory":
      return plain(editor.workingDirectory(host));
    case "code-action-hint":
      return [];
    default:
      return [];
  }
}

export interface Statusline {
  left: StatusPart[];
  center: StatusPart[];
  right: StatusPart[];
}

export function statuslineOf(editor: HelixEditor, host: Host, focused: boolean): Statusline {
  const sl = editor.config.statusline;
  const group = (names: readonly string[]) => names.flatMap((name) => statuslineElement(name, editor, host, focused));
  return { left: group(sl.left), center: group(sl.center), right: group(sl.right) };
}

function renderGroup(parent: HTMLElement, cls: string, parts: readonly StatusPart[]): void {
  const box = add(parent, "span", cls);
  for (const part of parts) add(box, "span", part.scope ? scopeClass(part.scope) : undefined, part.text);
}

export function helixStatusline(): Extension {
  const panel = showPanel.of((view): Panel => {
    const dom = make(view.dom.ownerDocument, "div", "hx-statusline");
    let last = "";
    const render = () => {
      const env = view.state.facet(helixEnv);
      if (!env) return;
      const host = env.hostFor(view);
      if (!host.state.field(helixField, false)) return;
      const focused = view.hasFocus;
      const line = statuslineOf(env.editor, host, focused);
      const pending = focused ? (env.editor.count !== null ? String(env.editor.count) : "") + env.editor.pendingDisplay() : "";
      const macro = env.editor.macroRecording ? `[${env.editor.macroRecording.register}]` : "";
      const key = JSON.stringify([line, pending, macro, focused]);
      if (key === last) return;
      last = key;
      dom.replaceChildren();
      dom.classList.toggle("hx-statusline-inactive", !focused);
      renderGroup(dom, "hx-statusline-left", line.left);
      renderGroup(dom, "hx-statusline-center", line.center);
      const right = add(dom, "span", "hx-statusline-right");
      if (macro) add(right, "span", "hx-statusline-macro", macro);
      if (pending) add(right, "span", "hx-statusline-pending", pending);
      for (const part of line.right) add(right, "span", part.scope ? scopeClass(part.scope) : undefined, part.text);
    };
    render();
    return { dom, top: false, update: render };
  });
  return Prec.high(panel);
}

export const statuslineTheme = EditorView.baseTheme({
  ".hx-statusline": {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    whiteSpace: "pre",
    fontFamily: "var(--hx-panel-font, monospace)",
    fontSize: "var(--hx-panel-font-size, 0.85em)",
    background: "var(--hx-statusline-bg, color-mix(in srgb, CanvasText 8%, Canvas))",
    color: "var(--hx-statusline-fg, CanvasText)",
    overflow: "hidden",
  },
  ".hx-statusline-inactive": { background: "var(--hx-statusline-inactive-bg, color-mix(in srgb, CanvasText 4%, Canvas))", color: "var(--hx-statusline-inactive-fg, CanvasText)" },
  ".hx-statusline-right": { justifySelf: "end" },
  ".hx-statusline-pending, .hx-statusline-macro": { padding: "0 0.5em" },
  ".hx-statusline .hx-s-ui-statusline-normal": { fontWeight: "600" },
  ".hx-statusline .hx-s-ui-statusline-insert": { fontWeight: "600" },
  ".hx-statusline .hx-s-ui-statusline-select": { fontWeight: "600" },
  ".hx-statusline .hx-s-error": { color: "var(--hx-error, #d32f2f)" },
  ".hx-statusline .hx-s-warning": { color: "var(--hx-warning, #b58900)" },
  ".hx-statusline .hx-s-info": { color: "var(--hx-info, #268bd2)" },
  ".hx-statusline .hx-s-hint": { color: "var(--hx-hint, #2aa198)" },
});
