import { StateField } from "@codemirror/state";
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
export declare const setDiagnostics: import("@codemirror/state").StateEffectType<readonly Diagnostic[]>;
export declare const diagnosticsField: StateField<readonly Diagnostic[]>;
export declare function severityRank(severity: Severity | null | undefined): number;
export declare function diagnosticsOf(state: {
    field<T>(field: StateField<T>, require: false): T | undefined;
}): readonly Diagnostic[];
