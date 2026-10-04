import { pageContent, registerPage, resetFilterBar, setFilterBar, setPageHeader } from '../../app/navigation';
import { avatar } from '../../components/avatar';
import { askFields, confirmDanger } from '../../components/dialog';
import { clearButton, filterSearch, filterSelect, registerFilterGroup } from '../../components/filterBar';
import { icon } from '../../components/icons';
import { showToast } from '../../components/toast';
import { db } from '../../services/db';
import { addUser, findUser, removeUser, updateUser, userByName, userLinks, type UserFields } from '../../services/userService';
import { ui } from '../../state/store';
import type { User } from '../../types/user';
import { onClick } from '../../utils/actions';
import { $, esc, plural } from '../../utils/dom';

/** Sugestões de nomes nos campos de responsável. */
export function syncUsersDatalist(): void {
  $('#usersList').innerHTML = db.users.map((u) => `<option value="${esc(u.name)}">`).join('');
}

/** Pede os dados de um novo usuário; devolve o existente se o nome já estiver cadastrado. */
export async function promptNewUser(): Promise<User | undefined> {
  const r = await askFields('Novo usuário', [{ label: 'Nome', required: true }, { label: 'E-mail (opcional)' }, { label: 'Função (opcional)' }]);
  if (!r?.[0]) return undefined;
  const existing = userByName(r[0]);
  if (existing) return existing;
  const user = addUser({ name: r[0], email: r[1] ?? '', role: r[2] ?? '' });
  syncUsersDatalist();
  return user;
}

async function editUser(user: User | undefined): Promise<void> {
  const r = await askFields(user ? 'Editar usuário' : 'Novo usuário', [
    { label: 'Nome', value: user?.name, required: true },
    { label: 'E-mail (opcional)', value: user?.email },
    { label: 'Função (opcional)', value: user?.role },
  ]);
  if (!r?.[0]) return;
  const fields: UserFields = { name: r[0], email: r[1] ?? '', role: r[2] ?? '' };
  if (user) updateUser(user, fields);
  else addUser(fields);
  syncUsersDatalist();
  renderUsers();
  showToast(user ? 'Usuário salvo' : 'Usuário criado');
}

function matches(u: User): boolean {
  const f = ui.userFilters;
  const q = f.q.trim().toLowerCase();
  if (q && ![u.name, u.email, u.role].join(' ').toLowerCase().includes(q)) return false;
  if (!f.role) return true;
  const coordinates = db.projects.some((p) => p.coordinators.includes(u.id));
  const designs = db.projects.some((p) => p.branches.some((b) => b.designer === u.id));
  if (f.role === 'coord') return coordinates;
  if (f.role === 'designer') return designs;
  return !coordinates && !designs;
}

function userCard(u: User): string {
  const links = userLinks(u);
  const meta = [u.role, u.email].filter(Boolean).join(' · ');
  return `<article class="user-card">${avatar(u)}<div class="user-info"><strong>${esc(u.name)}</strong>${meta ? `<small>${esc(meta)}</small>` : ''}<div class="user-tags">${
    links.coordinates ? `<span class="status">Coordena ${plural(links.coordinates, 'projeto', 'projetos')}</span>` : ''
  }${links.designs ? `<span class="status todo">Projetista · ${plural(links.designs, 'ramificação', 'ramificações')}</span>` : ''}${
    links.tasks ? `<span class="status todo">${plural(links.tasks, 'tarefa', 'tarefas')}</span>` : ''
  }</div></div><div class="user-acts"><button class="ghost" data-action="user-edit" data-id="${u.id}" aria-label="Editar ${esc(u.name)}">${icon('edit')}</button><button class="ghost" data-action="user-remove" data-id="${u.id}" aria-label="Remover ${esc(u.name)}">${icon('trash')}</button></div></article>`;
}

function filterBar(): string {
  const f = ui.userFilters;
  return `<div class="fbar">${filterSearch('users.q', 'Buscar por nome, e-mail ou função', f.q)}<div class="fchips">${filterSelect(
    'users.role',
    'Vínculo',
    [
      ['coord', 'Coordenadores'],
      ['designer', 'Projetistas'],
      ['none', 'Sem vínculo'],
    ],
    f.role,
    'Todos',
  )}${clearButton('users')}</div></div>`;
}

export function renderUsers(): void {
  setPageHeader('Usuários', 'Coordenadores, projetistas e responsáveis.', false);
  setFilterBar('users', filterBar);
  const list = db.users.filter(matches);
  const body = !db.users.length
    ? '<div class="empty">Nenhum usuário cadastrado.</div>'
    : list.length
      ? `<div class="users">${list.map(userCard).join('')}</div>`
      : '<div class="empty">Nenhum usuário encontrado com esses filtros.</div>';
  pageContent().innerHTML = `<div class="toolbar"><button class="primary" data-action="user-new">${icon('plus')}<span>Novo usuário</span></button></div>${body}`;
}

export function initUsers(): void {
  syncUsersDatalist();
  registerPage('users', renderUsers);
  registerFilterGroup('users', {
    get: () => ui.userFilters,
    reset: () => {
      ui.userFilters = { q: '', role: '' };
      resetFilterBar();
    },
    render: renderUsers,
  });
  onClick('user-new', () => void editUser(undefined));
  onClick('user-edit', (el) => void editUser(findUser(el.dataset.id)));
  onClick('user-remove', async (el) => {
    const user = findUser(el.dataset.id);
    if (!user) return;
    const ok = await confirmDanger(
      `Remover ${user.name}?`,
      'A pessoa sai da coordenação dos projetos e das ramificações. As tarefas continuam com o nome no campo Responsável.',
    );
    if (!ok) return;
    removeUser(user);
    syncUsersDatalist();
    renderUsers();
    showToast('Usuário removido');
  });
}
