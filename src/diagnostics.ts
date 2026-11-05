import { StateEffect, StateField, type Text } from "@codemirror/state";

export type Severity = "hint" | "info" | "warning" | "error";

export interface Diagnostic {
  from: number;
  to: number;
  severity?: Severity | null;
  message: string;
  source?: string;
  code?: string;
  tags?: readonly ("unnecessary" | "deprecated")[];
}

export const setDiagnostics = StateEffect.define<readonly Diagnostic[]>();

function clamp(list: readonly Diagnostic[], doc: Text): Diagnostic[] {
  return list
    .map((d) => ({ ...d, from: Math.min(d.from, doc.length), to: Math.min(Math.max(d.from, d.to), doc.length) }))
    .sort((a, b) => a.from - b.from || a.to - b.to);
}

export const diagnosticsField = StateField.define<readonly Diagnostic[]>({
  create: () => [],
  update(value, tr) {
    let next = value;
    if (tr.docChanged && next.length > 0) {
      next = next.map((d) => ({ ...d, from: tr.changes.mapPos(d.from, 1), to: Math.max(tr.changes.mapPos(d.from, 1), tr.changes.mapPos(d.to, -1)) }));
    }
    for (const effect of tr.effects) if (effect.is(setDiagnostics)) next = clamp(effect.value, tr.newDoc);
    return next;
  },
});

const ORDER: Record<Severity, number> = { hint: 0, info: 1, warning: 2, error: 3 };

export function severityRank(severity: Severity | null | undefined): number {
  return severity == null ? -1 : ORDER[severity];
}

export function diagnosticsOf(state: { field<T>(field: StateField<T>, require: false): T | undefined }): readonly Diagnostic[] {
  return state.field(diagnosticsField, false) ?? [];
}
