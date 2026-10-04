/** Menu suspenso de ações (botão ⋮). Fecha ao escolher, clicar fora, rolar ou apertar Esc. */
import { esc } from '../utils/dom';
import { icon, type IconName } from './icons';

export interface MenuItem {
  label: string;
  icon?: IconName;
  danger?: boolean;
  /** Motivo pelo qual a ação está indisponível; o item aparece desativado com essa dica. */
  disabledReason?: string | null;
  run: () => void;
}

let closeCurrent: (() => void) | null = null;

export function closeMenu(): void {
  closeCurrent?.();
}

export function openMenu(anchor: HTMLElement, items: MenuItem[]): void {
  closeMenu();
  if (!items.length) return;
  const menu = document.createElement('div');
  menu.className = 'popmenu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = items
    .map(
      (item, i) =>
        `<button role="menuitem" data-menu-item="${i}" class="${item.danger ? 'danger-item' : ''}" ${item.disabledReason ? `disabled title="${esc(item.disabledReason)}"` : ''}>${
          item.icon ? icon(item.icon) : ''
        }<span>${esc(item.label)}</span></button>`,
    )
    .join('');
  document.body.appendChild(menu);

  const r = anchor.getBoundingClientRect();
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const left = Math.max(8, Math.min(r.right - width, innerWidth - width - 8));
  const top = r.bottom + 6 + height > innerHeight ? r.top - height - 6 : r.bottom + 6;
  Object.assign(menu.style, { left: `${left}px`, top: `${Math.max(8, top)}px` });

  const onDocClick = (e: MouseEvent): void => {
    if (!menu.contains(e.target as Node) && e.target !== anchor) close();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') close();
  };
  const close = (): void => {
    menu.remove();
    document.removeEventListener('mousedown', onDocClick);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('scroll', close, true);
    closeCurrent = null;
  };
  closeCurrent = close;
  menu.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>('[data-menu-item]');
    if (!button || button.disabled) return;
    const item = items[Number(button.dataset.menuItem)];
    close();
    item?.run();
  });
  setTimeout(() => {
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
  });
  menu.querySelector<HTMLButtonElement>('button:not([disabled])')?.focus();
}
