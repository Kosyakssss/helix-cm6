import type { TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { helix, helixEditor } from "../../src/codemirror";
import { commitHistoryNow } from "../../src/commands/jumps";
import { plain, print } from "../../src/core/markup";
import { helixField, helixOwned, setHelix, toNative } from "../../src/state";

const { text, selection } = print(new URLSearchParams(location.search).get("markup") ?? "");
const runShell = (window as unknown as { helixShell(command: string, input: string | null, shell: readonly string[]): Promise<{ code: number | null; stdout: string; stderr: string }> }).helixShell;
const view = new EditorView({ parent: document.body, doc: "\n", extensions: helix({ syntax: false, shell: (command, input, shell) => runShell(command, input, shell) }) });
const next = { ...view.state.field(helixField), selection };
view.dispatch({
  changes: { from: 0, to: 1, insert: text },
  selection: toNative(next, view.state.toText(text)),
  effects: setHelix.of(next),
  annotations: helixOwned.of(true),
});
commitHistoryNow({
  get state() {
    return view.state;
  },
  dispatch: (...specs: TransactionSpec[]) => view.dispatch(...specs),
  view,
  id: "page",
  name: "page",
  paneId: "page",
});
view.focus();

function regexLoaded(): boolean {
  return view.state.facet(helixEditor)?.regex != null;
}

function idle(): boolean {
  return !view.state.facet(helixEditor)?.isBusy();
}

function state() {
  const value = view.state.field(helixField);
  const doc = view.state.doc.toString();
  const toChar = (pos: number) => [...doc.slice(0, pos)].length;
  return {
    text: doc,
    ranges: value.selection.ranges.map((r) => [toChar(r.anchor), toChar(r.head)]),
    primary: value.selection.primaryIndex,
    out: plain(doc, value.selection),
    mode: value.mode,
    focused: view.hasFocus,
  };
}

Object.assign(window, { helixReady: regexLoaded, helixIdle: idle, helixState: state });
