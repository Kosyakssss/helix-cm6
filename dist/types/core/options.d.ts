import type { Config } from "../config";
import type { HelixEditor } from "./editor";
type Getter = (c: Config) => unknown;
type Setter = (c: Config, v: unknown) => void;
export declare const OPTIONS: Record<string, [Getter, Setter]>;
export declare function setOption(editor: HelixEditor, args: string[]): void;
export declare function toggleOption(editor: HelixEditor, args: string[]): void;
export declare function getOption(editor: HelixEditor, args: string[]): void;
export {};
