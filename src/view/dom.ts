import type { EditorView } from "@codemirror/view";

export function make<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = doc.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function add<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  return parent.appendChild(make(parent.ownerDocument, tag, cls, text));
}

export function setProps(node: HTMLElement, props: Record<string, string>): void {
  for (const [name, value] of Object.entries(props)) node.style.setProperty(name, value);
}

export function windowOf(view: EditorView): Window | null {
  return view.dom.ownerDocument.defaultView;
}

export function styleOf(el: Element): CSSStyleDeclaration {
  return el.ownerDocument.defaultView!.getComputedStyle(el);
}
