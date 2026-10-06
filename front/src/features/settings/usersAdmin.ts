/** Configurações → Usuários: lista, cadastro, ativação e exclusão. */
import { refresh, resetFilterBar } from '../../app/navigation';
import { avatar } from '../../components/avatar';
import { askFields, confirmDanger } from '../../components/dialog';
import { clearButton, filterSearch, filterSelect, options, registerFilterGroup } from '../../components/filterBar';
import { icon } from '../../components/icons';
import { openMenu, type MenuItem } from '../../components/menu';
import { closeModal, modalField, openModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import { currentUser } from '../../services/authService';
import { db } from '../../services/db';
import { canManageUsers } from '../../services/permissionService';
import { access, findProfile } from '../../services/profileService';
import { ROLE_LABELS } from '../../types/access';
import { photoFromFile } from '../../utils/image';
import {
  MIN_PASSWORD,
  addUser,
  adminBlock,
  findUser,
  quickAddUser,
  removeUser,
  selfBlock,
  setUserActive,
  updateUser,
  userByName,
  userLinks,
  validateUser,
  type UserFields,
} from '../../services/userService';
import { emptyUserFilters, ui } from '../../state/store';
import type { User } from '../../types/user';
import { onClick } from '../../utils/actions';
import { formatDate } from '../../utils/date';
import { $, esc, plural } from '../../utils/dom';
import { permissionMatrix } from './permissionMatrix';

/** Sugestões de nomes nos campos de responsável. */
export function syncUsersDatalist(): void {
  $('#usersList').innerHTML = db.users.map((u) => `<option value="${esc(u.name)}">`).join('');
}

/** Cadastro rápido usado no formulário do projeto; devolve o existente se o nome já estiver cadastrado. */
export async function promptNewUser(): Promise<User | undefined> {
  const r = await askFields('Novo usuário', [
    { label: 'Nome', required: true },
    { label: 'E-mail (opcional)', type: 'email' },
    { label: 'Função (opcional)' },
    { label: `Senha inicial (mín. ${MIN_PASSWORD} caracteres)`, type: 'password', required: true },
  ]);
  if (!r?.[0]) return undefined;
  const existing = userByName(r[0]);
  if (existing) return existing;
  if ((r[3] ?? '').length < MIN_PASSWORD) {
    showToast(`A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`);
    return undefined;
  }
  const user = quickAddUser(r[0], r[1] ?? '', r[2] ?? '', r[3] ?? '');
  syncUsersDatalist();
  showToast(`Usuário criado com o perfil ${findProfile(user.profileId)?.name ?? ''}`);
  return user;
}

function matches(u: User): boolean {
  const f = ui.userFilters;
  const q = f.q.trim().toLowerCase();
  if (q && ![u.name, u.email, u.phone, u.role, findProfile(u.profileId)?.name].join(' ').toLowerCase().includes(q)) return false;
  if (f.profile && u.profileId !== f.profile) return false;
  if (f.status === 'active' && !u.active) return false;
  if (f.status === 'inactive' && u.active) return false;
  if (!f.role) return true;
  const coordinates = db.projects.some((p) => p.coordinators.includes(u.id));
  const designs = db.projects.some((p) => p.branches.some((b) => b.assignees.includes(u.id)));
  if (f.role === 'coord') return coordinates;
  if (f.role === 'designer') return designs;
  return !coordinates && !designs;
}

export function usersFilterBar(): string {
  const f = ui.userFilters;
  return `<div class="fbar">${filterSearch('users.q', 'Pesquisar usuário…', f.q)}<div class="fchips">${filterSelect(
    'users.profile',
    'Perfil',
    access.profiles.map((p) => [p.id, p.name] as const),
    f.profile,
    'Todos',
  )}${filterSelect(
    'users.status',
    'Status',
    [
      ['active', 'Ativos'],
      ['inactive', 'Inativos'],
    ],
    f.status,
    'Todos',
  )}${filterSelect(
    'users.role',
    'Vínculo',
    [
      ['coord', 'Coordenadores'],
      ['designer', 'Responsáveis de etapa'],
      ['none', 'Sem vínculo'],
    ],
    f.role,
    'Todos',
  )}${clearButton('users')}</div></div>`;
}

function linksText(u: User): string {
  const l = userLinks(u);
  return [
    l.coordinates ? `Coordena ${plural(l.coordinates, 'projeto', 'projetos')}` : '',
    l.designs ? `Responsável por ${plural(l.designs, 'etapa', 'etapas')}` : '',
    l.tasks ? plural(l.tasks, 'tarefa', 'tarefas') : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function userRow(u: User): string {
  const profile = findProfile(u.profileId);
  const meta = [u.role, u.email, u.phone].filter(Boolean).join(' · ');
  const limited = profile?.role === 'viewer' && u.projectIds !== null ? ` · ${plural(u.projectIds.length, 'projeto', 'projetos')}` : '';
  const links = linksText(u);
  const me = currentUser()?.id === u.id ? '<span class="tag">você</span>' : '';
  return `<tr class="${u.active ? '' : 'inactive'}"><td data-label="Nome"><div class="u-cell">${avatar(u)}<div><b>${esc(u.name)}</b>${me}${
    meta ? `<small>${esc(meta)}</small>` : ''
  }${links ? `<small class="u-links">${esc(links)}</small>` : ''}</div></div></td><td data-label="Perfil"><span class="status ${profile?.admin ? '' : 'todo'}">${esc(
    profile?.name ?? 'Sem perfil',
  )}</span>${profile ? `<small>${ROLE_LABELS[profile.role]}${limited}</small>` : ''}</td><td data-label="Status"><span class="status ${u.active ? 'done' : 'late'}">${u.active ? 'Ativo' : 'Inativo'}</span></td><td data-label="Criado em">${formatDate(
    u.createdAt.slice(0, 10),
  )}</td><td class="ta-r"><button class="ghost icon-only" data-action="user-menu" data-id="${u.id}" aria-label="Ações de ${esc(u.name)}">${icon(
    'moreVertical',
  )}</button></td></tr>`;
}

export function renderUsersTab(): string {
  const list = db.users.filter(matches);
  const table = list.length
    ? `<div class="table-wrap"><table class="utable"><thead><tr><th>Nome</th><th>Perfil</th><th>Status</th><th>Criado em</th><th class="ta-r">Ações</th></tr></thead><tbody>${list
        .map(userRow)
        .join('')}</tbody></table></div>`
    : '<div class="empty">Nenhum usuário encontrado com esses filtros.</div>';
  const add = canManageUsers('create') ? `<button class="primary" data-action="user-new">${icon('plus')}<span>Novo usuário</span></button>` : '';
  return `<div class="settings-bar"><p class="sub">${plural(db.users.length, 'usuário', 'usuários')} · ${plural(
    db.users.filter((u) => u.active).length,
    'ativo',
    'ativos',
  )}</p>${add}</div>${table}`;
}

/** Projetos que um Visualizador pode ver: todos (padrão) ou só os escolhidos. */
function projectAccessField(u: User | undefined): string {
  const limited = !!u && u.projectIds !== null;
  const chosen = new Set(u?.projectIds ?? []);
  const list = db.projects
    .map((p) => `<label class="dep-opt"><input type="checkbox" name="projectIds" value="${p.id}" ${chosen.has(p.id) ? 'checked' : ''}><span>${esc(p.name)}${p.archived ? '<small>Arquivado</small>' : ''}</span></label>`)
    .join('');
  return `<fieldset class="plain form-full viewer-access" id="viewerAccess"><div class="lbl">Projetos que este Visualizador pode ver</div><label class="check-row"><input type="radio" name="access" value="all" ${
    limited ? '' : 'checked'
  }> Todos os projetos</label><label class="check-row"><input type="radio" name="access" value="some" ${limited ? 'checked' : ''}> Só os projetos escolhidos</label><div class="dep-pick" id="viewerProjects" ${
    limited ? '' : 'hidden'
  }>${list || '<span class="sub flat">Nenhum projeto.</span>'}</div></fieldset>`;
}

function userForm(u: User | undefined): string {
  const profiles = access.profiles.map((p) => [p.id, `${p.name} (${ROLE_LABELS[p.role]})`] as const);
  const selected = u?.profileId ?? access.profiles.find((p) => !p.admin)?.id ?? '';
  return `<form id="userForm" novalidate><div class="photo-field">${avatar(u ?? { name: '?', color: '#9aa3b2' })}<div><label class="ghost file-btn">Escolher foto<input type="file" accept="image/*" id="photoInput" hidden></label><button type="button" class="ghost" id="photoClear" ${
    u?.photo ? '' : 'hidden'
  }>Remover foto</button></div></div><div class="form-grid"><label>Nome<input class="field" name="name" required value="${esc(u?.name ?? '')}" autocomplete="off"></label><label>Perfil<select class="field" name="profileId">${options(
    profiles,
    selected,
    'Escolha um perfil',
  )}</select></label><label>E-mail<input class="field" name="email" type="email" value="${esc(u?.email ?? '')}"></label><label>Telefone<input class="field" name="phone" type="tel" value="${esc(
    u?.phone ?? '',
  )}"></label><label>Cargo<input class="field" name="role" value="${esc(u?.role ?? '')}" placeholder="Ex.: Engenheira"></label><span></span><label>${
    u ? 'Nova senha' : 'Senha'
  }<input class="field" name="password" type="password" autocomplete="new-password" placeholder="${
    u ? 'Deixe em branco para manter' : `Mínimo ${MIN_PASSWORD} caracteres`
  }"></label><label>Confirmar senha<input class="field" name="confirm" type="password" autocomplete="new-password"></label>${projectAccessField(u)}</div><label class="check-row"><input type="checkbox" name="active" ${
    u?.active === false ? '' : 'checked'
  }> Usuário ativo (pode entrar no sistema)</label><p class="form-error" id="userErr" role="alert"></p><div class="modal-actions"><span></span><button class="primary">${u ? 'Salvar' : 'Criar usuário'}</button></div></form>`;
}

/** Foto escolhida, campo de projetos do Visualizador e o perfil escolhido (que mostra ou esconde esse campo). */
function bindUserForm(form: HTMLFormElement, user: User | undefined): () => string {
  let photo = user?.photo ?? '';
  const preview = (): void => {
    const current = form.querySelector('.photo-field .av');
    current?.insertAdjacentHTML('afterend', avatar({ name: String(new FormData(form).get('name') ?? '') || '?', color: user?.color ?? '#9aa3b2', photo }));
    current?.remove();
    modalField('#photoClear').hidden = !photo;
  };
  modalField<HTMLInputElement>('#photoInput').addEventListener('change', async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      photo = await photoFromFile(file);
      preview();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Não foi possível ler a imagem.');
    }
  });
  modalField('#photoClear').addEventListener('click', () => {
    photo = '';
    preview();
  });
  const accessBox = modalField<HTMLElement>('#viewerAccess');
  const syncAccess = (): void => {
    const profile = findProfile(String(new FormData(form).get('profileId') ?? ''));
    accessBox.hidden = profile?.role !== 'viewer';
    modalField('#viewerProjects').hidden = new FormData(form).get('access') !== 'some';
  };
  form.addEventListener('change', syncAccess);
  syncAccess();
  return () => photo;
}

function openUserModal(user?: User): void {
  openModal(user ? 'Editar usuário' : 'Novo usuário', userForm(user));
  const form = modalField<HTMLFormElement>('#userForm');
  const currentPhoto = bindUserForm(form, user);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const text = (k: string): string => String(data.get(k) ?? '');
    const viewer = findProfile(text('profileId'))?.role === 'viewer';
    const fields: UserFields = {
      name: text('name').trim(),
      email: text('email').trim(),
      phone: text('phone').trim(),
      photo: currentPhoto(),
      role: text('role').trim(),
      profileId: text('profileId'),
      active: data.get('active') === 'on',
      // Só o Visualizador pode ter acesso limitado; os demais veem todos os projetos.
      projectIds: viewer && data.get('access') === 'some' ? data.getAll('projectIds').map(String) : null,
      password: text('password'),
    };
    const error = text('password') !== text('confirm') ? 'As senhas não conferem.' : validateUser(fields, user);
    if (error) {
      modalField('#userErr').textContent = error;
      return;
    }
    if (user) updateUser(user, fields);
    else addUser(fields);
    syncUsersDatalist();
    closeModal();
    refresh();
    showToast(user ? 'Usuário salvo' : 'Usuário criado');
  });
  modalField<HTMLInputElement>('[name="name"]').focus();
}

function openPermissionsView(user: User): void {
  const profile = findProfile(user.profileId);
  openModal(
    `Permissões de ${user.name}`,
    `<p class="sub">Perfil: <b>${esc(profile?.name ?? 'Sem perfil')}</b>${profile ? ` · Função: <b>${ROLE_LABELS[profile.role]}</b>` : ''}${profile?.admin ? ' — acesso total.' : ''}</p>${permissionMatrix(
      profile?.permissions ?? {},
      false,
    )}`,
    { wide: true },
  );
}

function menuFor(user: User): MenuItem[] {
  const items: MenuItem[] = [];
  if (canManageUsers('edit')) items.push({ label: 'Editar', icon: 'edit', run: () => openUserModal(user) });
  items.push({ label: 'Ver permissões', icon: 'lock', run: () => openPermissionsView(user) });
  if (canManageUsers('edit')) {
    const next = !user.active;
    items.push({
      label: user.active ? 'Desativar' : 'Ativar',
      icon: user.active ? 'close' : 'check',
      disabledReason: adminBlock(user, { active: next, profileId: user.profileId }) ?? selfBlock(user, { active: next }),
      run: () => {
        setUserActive(user, next);
        refresh();
        showToast(next ? 'Usuário ativado' : 'Usuário desativado');
      },
    });
  }
  if (canManageUsers('delete')) {
    items.push({
      label: 'Excluir',
      icon: 'trash',
      danger: true,
      disabledReason: adminBlock(user, 'delete') ?? selfBlock(user, 'delete'),
      run: async () => {
        const ok = await confirmDanger(
          `Excluir ${user.name}?`,
          'O usuário é removido. Projetos, etapas, tarefas e subtarefas continuam; onde ele era coordenador ou responsável, o item fica sem ele. Para apenas bloquear o acesso (mantendo os vínculos), use Desativar.',
        );
        if (!ok) return;
        removeUser(user);
        syncUsersDatalist();
        refresh();
        showToast('Usuário excluído');
      },
    });
  }
  return items;
}

export function initUsersAdmin(): void {
  syncUsersDatalist();
  registerFilterGroup('users', {
    get: () => ui.userFilters,
    reset: () => {
      ui.userFilters = emptyUserFilters();
      resetFilterBar();
    },
    render: refresh,
  });
  onClick('user-new', () => openUserModal());
  onClick('user-menu', (el) => {
    const user = findUser(el.dataset.id);
    if (user) openMenu(el, menuFor(user));
  });
}
