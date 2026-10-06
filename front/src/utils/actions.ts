/**
 * Delegação de eventos: um único listener por tipo no documento.
 * Elementos declaram `data-action="nome"` (clique), `data-change="nome"` ou `data-input="nome"`,
 * e os módulos registram o que fazer. Assim a tela pode ser redesenhada à vontade
 * sem acumular listeners.
 */
type Handler<E extends Event> = (el: HTMLElement, event: E) => void;

const clickHandlers = new Map<string, Handler<MouseEvent>>();
const changeHandlers = new Map<string, Handler<Event>>();
const inputHandlers = new Map<string, Handler<Event>>();

export function onClick(action: string, handler: Handler<MouseEvent>): void {
  clickHandlers.set(action, handler);
}

export function onChange(action: string, handler: Handler<Event>): void {
  changeHandlers.set(action, handler);
}

export function onInput(action: string, handler: Handler<Event>): void {
  inputHandlers.set(action, handler);
}

function dispatch<E extends Event>(event: E, attr: string, handlers: Map<string, Handler<E>>): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const el = target.closest<HTMLElement>(`[${attr}]`);
  const name = el?.getAttribute(attr);
  if (!el || !name) return;
  handlers.get(name)?.(el, event);
}

export function installActions(): void {
  document.addEventListener('click', (e) => dispatch(e, 'data-action', clickHandlers));
  document.addEventListener('change', (e) => dispatch(e, 'data-change', changeHandlers));
  document.addEventListener('input', (e) => dispatch(e, 'data-input', inputHandlers));
  // Itens clicáveis que não são <button> (ex.: linhas do histórico) também respondem ao Enter.
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key === 'Enter' && t instanceof HTMLElement && t.dataset.action && !t.matches('button, a, input, select, textarea')) {
      e.preventDefault();
      t.click();
    }
  });
}
