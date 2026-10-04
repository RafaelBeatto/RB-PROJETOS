/** Busca um elemento obrigatório; falha cedo se o HTML esperado não existir. */
export function $<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T & Element>(selector);
  if (!el) throw new Error(`Elemento não encontrado: ${selector}`);
  return el;
}

export function $maybe<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector<T & Element>(selector);
}

export function $$<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T & Element>(selector));
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para uso seguro dentro de HTML e atributos. */
export function esc(value: unknown = ''): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Devolve o foco a um campo depois de uma nova renderização, com o cursor no fim. */
export function refocus(selector: string): void {
  const input = $maybe<HTMLInputElement>(selector);
  if (!input) return;
  input.focus();
  const end = input.value.length;
  try {
    input.setSelectionRange(end, end);
  } catch {
    /* campos como type=date não aceitam seleção */
  }
}
