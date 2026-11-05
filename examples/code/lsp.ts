import type { Text } from "@codemirror/state";

export interface LspPosition {
  line: number;
  character: number;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface LspTextEdit {
  range: LspRange;
  newText: string;
}

export const toOffset = (doc: Text, p: LspPosition) => {
  const line = doc.line(Math.min(p.line + 1, doc.lines));
  return Math.min(line.from + p.character, line.to);
};

export const toPosition = (doc: Text, offset: number): LspPosition => {
  const line = doc.lineAt(offset);
  return { line: line.number - 1, character: offset - line.from };
};

export const toEdit = (doc: Text, e: LspTextEdit) => ({ from: toOffset(doc, e.range.start), to: toOffset(doc, e.range.end), insert: e.newText });

export class LspClient {
  private socket: WebSocket;
  private next = 1;
  private pending = new Map<number, (result: unknown) => void>();
  private versions = new Map<string, number>();
  ready: Promise<void>;
  onDiagnostics: (uri: string, list: { range: LspRange; severity?: number; message: string; source?: string }[]) => void = () => {};

  constructor(url: string, rootUri: string) {
    this.socket = new WebSocket(url);
    this.socket.onmessage = (event) => this.receive(JSON.parse(event.data as string) as { id?: number; method?: string; result?: unknown; params?: unknown });
    this.ready = new Promise((resolve) => {
      this.socket.onopen = () => {
        void this.request("initialize", {
          processId: null,
          rootUri,
          capabilities: {
            textDocument: {
              hover: { contentFormat: ["plaintext"] },
              completion: { completionItem: { snippetSupport: true } },
              publishDiagnostics: {},
              codeAction: { codeActionLiteralSupport: { codeActionKind: { valueSet: ["quickfix", "refactor", "source"] } }, resolveSupport: { properties: ["edit"] } },
              rename: {},
            },
            workspace: { workspaceEdit: { documentChanges: false } },
          },
        }).then(() => {
          this.notify("initialized", {});
          resolve();
        });
      };
    });
  }

  private receive(message: { id?: number; method?: string; result?: unknown; params?: unknown }) {
    if (message.method === "textDocument/publishDiagnostics") {
      const params = message.params as { uri: string; diagnostics: Parameters<LspClient["onDiagnostics"]>[1] };
      this.onDiagnostics(params.uri, params.diagnostics);
    } else if (message.method && message.id !== undefined) {
      this.socket.send(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: null }));
    } else if (message.id !== undefined) {
      this.pending.get(message.id)?.(message.result ?? null);
      this.pending.delete(message.id);
    }
  }

  request<T>(method: string, params: unknown): Promise<T> {
    const id = this.next++;
    this.socket.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    return new Promise((resolve) => this.pending.set(id, resolve as (result: unknown) => void));
  }

  notify(method: string, params: unknown) {
    this.socket.send(JSON.stringify({ jsonrpc: "2.0", method, params }));
  }

  opened(uri: string, languageId: string, text: string) {
    if (this.versions.has(uri)) return this.changed(uri, text);
    this.versions.set(uri, 1);
    this.notify("textDocument/didOpen", { textDocument: { uri, languageId, version: 1, text } });
  }

  changed(uri: string, text: string) {
    const version = (this.versions.get(uri) ?? 0) + 1;
    this.versions.set(uri, version);
    this.notify("textDocument/didChange", { textDocument: { uri, version }, contentChanges: [{ text }] });
  }
}
