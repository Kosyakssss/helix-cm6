import type { TransactionSpec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { helix } from "../../src/codemirror";
import { commitHistoryNow } from "../../src/commands/jumps";
import { plain, print } from "../../src/core/markup";
import { compilePattern } from "../../src/core/regex";
import { helixField, helixOwned, setHelix, toNative } from "../../src/state";

const { text, selection } = print(new URLSearchParams(location.search).get("markup") ?? "");
const view = new EditorView({ parent: document.body, doc: "\n", extensions: helix() });
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
  try {
    compilePattern("a", false);
    return true;
  } catch {
    return false;
  }
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

Object.assign(window, { helixReady: regexLoaded, helixState: state });
