import { EditorView } from "@codemirror/view";
import { helix, helixDocument } from "../src";

async function text(url: string): Promise<string | null> {
  const response = await fetch(url);
  return response.ok ? response.text() : null;
}

const file = new URLSearchParams(location.search).get("file") ?? "notes.md";
const [doc, config] = await Promise.all([text(`/samples/${encodeURIComponent(file)}`), text("/helix.toml")]);

new EditorView({
  parent: document.body,
  doc: doc ?? "",
  extensions: [helix({ config, grammars: "/languages" }), helixDocument.of({ path: file }), EditorView.lineWrapping],
}).focus();
