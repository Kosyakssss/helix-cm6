export interface PickerItem<T> {
  label: string;
  value: T;
}

export function picker<T>(title: string, items: readonly PickerItem<T>[]): Promise<T | null> {
  return new Promise((resolve) => {
    const previous = document.activeElement as HTMLElement | null;
    const box = document.createElement("div");
    box.className = "picker";
    const input = document.createElement("input");
    input.placeholder = title;
    const list = document.createElement("ul");
    box.append(input, list);
    document.body.append(box);
    let shown: readonly PickerItem<T>[] = items;
    let index = 0;
    const draw = () => {
      list.replaceChildren(...shown.slice(0, 20).map((item, i) => {
        const row = document.createElement("li");
        row.textContent = item.label;
        row.className = i === index ? "selected" : "";
        return row;
      }));
    };
    const finish = (value: T | null) => {
      box.remove();
      previous?.focus();
      resolve(value);
    };
    input.oninput = () => {
      const query = input.value.toLowerCase();
      shown = items.filter((item) => item.label.toLowerCase().includes(query));
      index = 0;
      draw();
    };
    input.onkeydown = (event) => {
      if (event.key === "Escape") finish(null);
      else if (event.key === "Enter") finish(shown[index]?.value ?? null);
      else if (event.key === "ArrowDown" || (event.ctrlKey && event.key === "n")) index = Math.min(index + 1, shown.length - 1);
      else if (event.key === "ArrowUp" || (event.ctrlKey && event.key === "p")) index = Math.max(index - 1, 0);
      else return;
      event.preventDefault();
      draw();
    };
    draw();
    input.focus();
  });
}
