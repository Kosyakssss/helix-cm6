import { add, make, setProps } from "../view/dom";

function inline(parent: HTMLElement, text: string): void {
  const pattern = /(`+)(.+?)\1|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|\[([^\]]+)\]\(([^)]+)\)/g;
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) parent.append(text.slice(last, m.index));
    if (m[2] !== undefined) add(parent, "code", "hx-s-markup-raw-inline", m[2]);
    else if (m[3] !== undefined || m[4] !== undefined) add(parent, "strong", "hx-s-markup-bold", m[3] ?? m[4]);
    else if (m[5] !== undefined || m[6] !== undefined) add(parent, "em", "hx-s-markup-italic", m[5] ?? m[6]);
    else add(parent, "span", "hx-s-markup-link-text", m[7]);
    last = m.index + m[0].length;
  }
  if (last < text.length) parent.append(text.slice(last));
}

export function renderMarkdown(parent: HTMLElement, text: string): void {
  const doc = parent.ownerDocument;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const fence = /^\s*(```+|~~~+)(.*)$/.exec(line);
    if (fence) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trimStart().startsWith(fence[1]!)) code.push(lines[i++]!);
      i++;
      const pre = make(doc, "pre", "hx-md-code hx-s-markup-raw-block");
      pre.textContent = code.join("\n");
      parent.appendChild(pre);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const h = make(doc, "div", `hx-md-heading hx-s-markup-heading hx-s-markup-heading-${heading[1]!.length}`);
      inline(h, heading[2]!);
      parent.appendChild(h);
      i++;
      continue;
    }
    const list = /^(\s*)([-*+]|\d+\.)\s+(.*)$/.exec(line);
    if (list) {
      const row = make(doc, "div", "hx-md-item");
      setProps(row, { "padding-inline-start": `${list[1]!.length + 2}ch`, "text-indent": "-2ch" });
      add(row, "span", "hx-s-markup-list", `${/\d/.test(list[2]!) ? list[2]! : "•"} `);
      inline(row, list[3]!);
      parent.appendChild(row);
      i++;
      continue;
    }
    if (/^\s*$/.test(line)) {
      parent.appendChild(make(doc, "div", "hx-md-gap"));
      i++;
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]!) && !/^(#{1,6}\s|\s*```|\s*~~~|\s*([-*+]|\d+\.)\s)/.test(lines[i]!)) paragraph.push(lines[i++]!);
    const p = make(doc, "div", "hx-md-paragraph");
    inline(p, paragraph.join(" "));
    parent.appendChild(p);
  }
}
