import { findUser, initials } from '../services/userService';
import type { Person } from '../types/user';
import { esc } from '../utils/dom';

/** Foto do usuário, ou as iniciais sobre a cor dele. */
export function avatar(person: Person | undefined, small = false): string {
  if (!person) return '';
  const cls = `av${small ? ' sm' : ''}`;
  if (person.photo) return `<img class="${cls} photo" src="${esc(person.photo)}" alt="" title="${esc(person.name)}">`;
  return `<span class="${cls}" style="--c:${esc(person.color)}" title="${esc(person.name)}">${esc(initials(person.name))}</span>`;
}

/** Avatares sobrepostos de até quatro usuários, com "+N" para o restante. */
export function avatarStack(userIds: string[]): string {
  const users = userIds.map(findUser).filter((u): u is NonNullable<typeof u> => !!u);
  if (!users.length) return '';
  const extra = users.length > 4 ? `<span class="av sm more">+${users.length - 4}</span>` : '';
  return `<span class="av-stack">${users
    .slice(0, 4)
    .map((u) => avatar(u, true))
    .join('')}${extra}</span>`;
}
