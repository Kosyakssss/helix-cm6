import { StateEffect, StateField } from "@codemirror/state";

export interface Hunk {
  beforeStart: number;
  beforeEnd: number;
  afterStart: number;
  afterEnd: number;
}

export interface Changes {
  base: string | null;
  hunks: readonly Hunk[];
}

export const setChanges = StateEffect.define<Changes>();

export const changesField = StateField.define<Changes>({
  create: () => ({ base: null, hunks: [] }),
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(setChanges)) return effect.value;
    return value;
  },
});

export function changesOf(state: { field<T>(field: StateField<T>, require: false): T | undefined }): Changes {
  return state.field(changesField, false) ?? { base: null, hunks: [] };
}
