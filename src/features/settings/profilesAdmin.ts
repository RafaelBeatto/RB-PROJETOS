/**
 * Configurações → Perfis e permissões: lista de perfis, a função de cada um e a matriz de permissões.
 * A função traz as regras de negócio; a matriz restringe por cima (as duas precisam liberar).
 */
import { refresh } from '../../app/navigation';
import { askFields, confirmDanger } from '../../components/dialog';
import { icon } from '../../components/icons';
import { showToast } from '../../components/toast';
import { canManageProfiles } from '../../services/permissionService';
import { access, createProfile, deleteProfile, findProfile, profileDeleteBlock, updateProfile, usersWithProfile } from '../../services/profileService';
import { ui } from '../../state/store';
import { ROLES, ROLE_HINTS, ROLE_LABELS, type Profile, type Role } from '../../types/access';
import { onClick } from '../../utils/actions';
import { $, $maybe, esc, plural } from '../../utils/dom';
import { bindMatrix, permissionMatrix, readMatrix } from './permissionMatrix';

const DELETE_BLOCK: Record<'admin' | 'in-use', string> = {
  admin: 'O perfil Administrador não pode ser excluído.',
  'in-use': 'Há usuários com este perfil. Troque o perfil deles antes de excluir.',
};

function selectedProfile(): Profile | undefined {
  return findProfile(ui.profileId ?? undefined) ?? access.profiles[0];
}

function profileList(current: Profile | undefined): string {
  return access.profiles
    .map(
      (p) =>
        `<button class="prof-item ${p === current ? 'on' : ''}" data-action="profile-select" data-id="${p.id}"><b>${esc(p.name)}${
          p.admin ? ' <span class="tag">acesso total</span>' : ''
        }</b><small>Função: ${ROLE_LABELS[p.role]}</small><small>${esc(p.description || 'Sem descrição')}</small><small>${plural(usersWithProfile(p.id), 'usuário', 'usuários')}</small></button>`,
    )
    .join('');
}

function editor(p: Profile): string {
  const editable = canManageProfiles('edit');
  const lockMatrix = p.admin || !editable;
  const block = profileDeleteBlock(p);
  const roles = ROLES.filter((r) => (p.admin ? r === 'admin' : r !== 'admin'));
  const roleField = `<label>Função<select class="field" name="role" ${editable && !p.admin ? '' : 'disabled'}>${roles
    .map((r) => `<option value="${r}" ${r === p.role ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`)
    .join('')}</select><small class="field-hint">${esc(ROLE_HINTS[p.role])}</small></label>`;
  const remove = canManageProfiles('delete')
    ? `<button class="danger" type="button" id="profileDelete" ${block ? `disabled title="${esc(DELETE_BLOCK[block])}"` : ''}>${icon('trash')}Excluir perfil</button>`
    : '<span></span>';
  const note = p.admin
    ? '<p class="sub small">O Administrador sempre tem acesso total; as permissões dele não podem ser reduzidas.</p>'
    : '<p class="sub small">A função define quem cria e edita o quê (por vínculo com o item); a matriz restringe por cima. Marcar Criar, Editar ou Excluir libera também Visualizar. "–" indica ação que não existe naquele módulo.</p>';
  return `<form id="profileForm" class="prof-editor"><div class="form-grid"><label>Nome do perfil<input class="field" name="name" required value="${esc(p.name)}" ${
    editable ? '' : 'disabled'
  }></label><label>Descrição<input class="field" name="description" value="${esc(p.description)}" ${editable ? '' : 'disabled'}></label>${roleField}</div>${note}<div id="matrix">${permissionMatrix(
    p.permissions,
    !lockMatrix,
  )}</div><div class="modal-actions">${remove}${editable ? '<button class="primary">Salvar perfil</button>' : ''}</div></form>`;
}

export function renderProfilesTab(): string {
  const current = selectedProfile();
  const add = canManageProfiles('create') ? `<button class="primary" data-action="profile-new">${icon('plus')}<span>Novo perfil</span></button>` : '';
  return `<div class="settings-bar"><p class="sub">Usuário → Perfil → Permissões → Módulos e ações.</p>${add}</div><div class="prof-layout"><nav class="prof-list" aria-label="Perfis">${profileList(
    current,
  )}</nav><section>${current ? editor(current) : '<div class="empty">Nenhum perfil.</div>'}</section></div>`;
}

/** Liga o formulário do perfil depois de a aba ser desenhada. */
export function mountProfilesTab(): void {
  const form = $maybe<HTMLFormElement>('#profileForm');
  const p = selectedProfile();
  if (!form || !p) return;
  bindMatrix($('#matrix', form));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    if (!name) {
      showToast('Informe o nome do perfil.');
      return;
    }
    const role = (String(data.get('role') ?? '') || p.role) as Role;
    updateProfile(p, { name, description: String(data.get('description') ?? '').trim(), role: ROLES.includes(role) ? role : p.role, permissions: readMatrix(form) });
    refresh();
    showToast('Perfil salvo');
  });
  $maybe('#profileDelete', form)?.addEventListener('click', async () => {
    if (profileDeleteBlock(p)) return;
    if (!(await confirmDanger(`Excluir o perfil ${p.name}?`, 'Esta ação não pode ser desfeita.'))) return;
    deleteProfile(p);
    ui.profileId = null;
    refresh();
    showToast('Perfil excluído');
  });
}

export function initProfilesAdmin(): void {
  onClick('profile-select', (el) => {
    ui.profileId = el.dataset.id ?? null;
    refresh();
  });
  onClick('profile-new', async () => {
    const r = await askFields('Novo perfil', [{ label: 'Nome', required: true }, { label: 'Descrição (opcional)' }], 'Criar perfil');
    if (!r?.[0]) return;
    const profile = createProfile({ name: r[0], description: r[1] ?? '', role: 'viewer', permissions: {} });
    ui.profileId = profile.id;
    refresh();
    showToast('Perfil criado. Escolha a função, marque as permissões e salve.');
  });
}
