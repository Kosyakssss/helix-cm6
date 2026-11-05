import { EditorView } from "@codemirror/view";
import { helix } from "helix-cm6";

new EditorView({ parent: document.body, doc: "Press i to type, Esc to stop.\n", extensions: [helix()] }).focus();
