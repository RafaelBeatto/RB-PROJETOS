/** Seletor de usuários em pílulas (responsáveis e coordenadores), com limite opcional. */
import { showToast } from './toast';
import { db } from '../services/db';
import type { User } from '../types/user';
import { $$, esc } from '../utils/dom';
import { avatar } from './avatar';

function pill(u: User, on: boolean): string {
  return `<button type="button" class="pick-u ${on ? 'on' : ''}" data-user="${u.id}" aria-pressed="${on}">${avatar(u)}<span>${esc(u.name)}${u.active ? '' : ' (inativo)'}</span></button>`;
}

/** Usuários ativos e, mesmo inativos, os que já estão escolhidos. `max` limita quantos podem ser marcados. */
export function userPickerHtml(id: string, selected: string[], max = 0): string {
  const users = db.users.filter((u) => u.active || selected.includes(u.id));
  return `<div class="pick" id="${id}" data-max="${max}">${users.map((u) => pill(u, selected.includes(u.id))).join('') || '<span class="sub flat">Nenhum usuário cadastrado.</span>'}</div>`;
}

export function bindUserPicker(root: HTMLElement): void {
  root.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLElement>('.pick-u');
    if (!button || (button.closest('fieldset') as HTMLFieldSetElement | null)?.disabled) return;
    const max = Number(root.dataset.max) || 0;
    if (!button.classList.contains('on') && max && readUserPicker(root).length >= max) {
      showToast(`No máximo ${max} ${max === 1 ? 'pessoa' : 'pessoas'}.`);
      return;
    }
    const on = button.classList.toggle('on');
    button.setAttribute('aria-pressed', String(on));
  });
}

export function readUserPicker(root: HTMLElement): string[] {
  return $$('.pick-u.on', root).map((b) => b.dataset.user ?? '').filter(Boolean);
}
