import type { EditorView } from "@codemirror/view";
export declare function make<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K];
export declare function add<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K];
export declare function setProps(node: HTMLElement, props: Record<string, string>): void;
export declare function windowOf(view: EditorView): Window | null;
export declare function styleOf(el: Element): CSSStyleDeclaration;
