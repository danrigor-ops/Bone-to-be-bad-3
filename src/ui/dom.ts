type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, unknown> & { class?: string; onclick?: (e: MouseEvent) => void };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'class') el.className = String(v);
      else if (k === 'text') el.textContent = String(v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function btn(label: Child | Child[], onClick: () => void, opts: { cls?: string; disabled?: boolean; key?: string; title?: string; aria?: string } = {}) {
  const b = h('button', {
    class: `btn ${opts.cls ?? ''}`, type: 'button', 'data-key': opts.key, title: opts.title, 'aria-label': opts.aria,
    'aria-disabled': opts.disabled ? 'true' : undefined,
  }, label);
  b.addEventListener('click', (e) => {
    e.preventDefault();
    if (opts.disabled) return;
    onClick();
  });
  return b;
}

/** Re-render while keeping keyboard focus on the element with the same data-key. */
export function replaceKeepingFocus(container: HTMLElement, content: Node[]) {
  const active = document.activeElement as HTMLElement | null;
  const key = active && container.contains(active) ? active.getAttribute('data-key') : null;
  const scroll = container.querySelector('.body')?.scrollTop ?? 0;
  container.replaceChildren(...content);
  const body = container.querySelector('.body');
  if (body) body.scrollTop = scroll;
  if (key) (container.querySelector(`[data-key="${CSS.escape(key)}"]`) as HTMLElement | null)?.focus();
}

let txCounter = 0;
export function txId(prefix: string) {
  txCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${txCounter}`;
}
