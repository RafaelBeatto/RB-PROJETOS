/** Página Configurações (Usuários | Perfis e permissões | Contratantes), Minha conta e menu "Mais" do celular. */
import { canOpenPage } from '../../app/access';
import { pageContent, registerPage, setFilterBar, setPageHeader } from '../../app/navigation';
import { avatar } from '../../components/avatar';
import { icon } from '../../components/icons';
import { closeModal, modalField, openModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import { currentUser } from '../../services/authService';
import { can, canManageProfiles, canManageUsers } from '../../services/permissionService';
import { findProfile } from '../../services/profileService';
import { MIN_PASSWORD, changeOwnPassword } from '../../services/userService';
import { ui, type SettingsTab } from '../../state/store';
import { onClick } from '../../utils/actions';
import { esc } from '../../utils/dom';
import { initContratantesAdmin, renderContratantesTab } from './contratantesAdmin';
import { initProfilesAdmin, mountProfilesTab, renderProfilesTab } from './profilesAdmin';
import { initUsersAdmin, renderUsersTab, usersFilterBar } from './usersAdmin';

const TABS: { tab: SettingsTab; label: string; allowed: () => boolean }[] = [
  { tab: 'users', label: 'Usuários', allowed: () => canManageUsers('view') },
  { tab: 'profiles', label: 'Perfis e permissões', allowed: () => canManageProfiles('view') },
  { tab: 'contratantes', label: 'Contratantes', allowed: () => can('contratantes', 'view') },
];

function renderSettings(): void {
  setPageHeader('Configurações', 'Usuários, perfis, permissões de acesso e contratantes.', false);
  const allowed = TABS.filter((t) => t.allowed());
  if (!allowed.some((t) => t.tab === ui.settingsTab) && allowed[0]) ui.settingsTab = allowed[0].tab;
  const tabs = `<nav class="tabs settings-tabs" aria-label="Configurações">${allowed
    .map((t) => `<button class="tab ${t.tab === ui.settingsTab ? 'active' : ''}" data-action="settings-tab" data-tab="${t.tab}">${t.label}</button>`)
    .join('')}</nav>`;
  if (!allowed.length) {
    setFilterBar('settings-empty', () => '');
    pageContent().innerHTML = '<div class="empty">Seu perfil não tem acesso a usuários, perfis nem contratantes.</div>';
    return;
  }
  if (ui.settingsTab === 'users') {
    setFilterBar('users', () => tabs + usersFilterBar());
    pageContent().innerHTML = renderUsersTab();
  } else if (ui.settingsTab === 'contratantes') {
    setFilterBar('contratantes', () => tabs);
    pageContent().innerHTML = renderContratantesTab();
  } else {
    setFilterBar('profiles', () => tabs);
    pageContent().innerHTML = renderProfilesTab();
    mountProfilesTab();
  }
}

function openAccount(): void {
  const user = currentUser();
  if (!user) return;
  const profile = findProfile(user.profileId);
  openModal(
    'Minha conta',
    `<div class="account-head">${avatar(user)}<div><b>${esc(user.name)}</b><small>${esc(profile?.name ?? 'Sem perfil')}${
      user.role ? ` · ${esc(user.role)}` : ''
    }</small></div></div><form id="pwForm" class="sec" novalidate><h3>Alterar senha</h3><div class="form-grid"><label>Senha atual<input class="field" name="current" type="password" autocomplete="current-password"></label><span></span><label>Nova senha<input class="field" name="next" type="password" autocomplete="new-password" placeholder="Mínimo ${MIN_PASSWORD} caracteres"></label><label>Confirmar nova senha<input class="field" name="confirm" type="password" autocomplete="new-password"></label></div><p class="form-error" id="pwErr" role="alert"></p><div class="modal-actions"><button class="ghost" type="button" data-action="logout">${icon(
      'logout',
    )}Sair</button><button class="primary">Alterar senha</button></div></form>`,
  );
  const form = modalField<HTMLFormElement>('#pwForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const next = String(data.get('next') ?? '');
    const error = next !== String(data.get('confirm') ?? '') ? 'As senhas não conferem.' : changeOwnPassword(String(data.get('current') ?? ''), next);
    if (error) {
      modalField('#pwErr').textContent = error;
      return;
    }
    closeModal();
    showToast('Senha alterada');
  });
}

/** Menu "Mais" do celular: itens que não cabem na barra inferior. */
function openMore(): void {
  const settings = canOpenPage('settings')
    ? `<button class="ghost" data-action="nav" data-page="settings">${icon('settings')}Configurações</button>`
    : '';
  const collaborators = canOpenPage('collaborators')
    ? `<button class="ghost" data-action="nav" data-page="collaborators">${icon('collaborators')}Colaboradores</button>`
    : '';
  const archive = canOpenPage('archive') ? `<button class="ghost" data-action="nav" data-page="archive">${icon('archive')}Arquivados</button>` : '';
  const trash = canOpenPage('trash') ? `<button class="ghost" data-action="nav" data-page="trash">${icon('trash')}Lixeira</button>` : '';
  openModal(
    'Mais',
    `<div class="more-list">${collaborators}${archive}${trash}${settings}<button class="ghost" data-action="account">${icon('users')}Minha conta</button><button class="ghost" data-action="logout">${icon(
      'logout',
    )}Sair</button></div>`,
  );
}

export function initSettings(): void {
  initUsersAdmin();
  initProfilesAdmin();
  initContratantesAdmin();
  registerPage('settings', renderSettings);
  onClick('settings-tab', (el) => {
    const tab = el.dataset.tab;
    ui.settingsTab = tab === 'profiles' || tab === 'contratantes' ? tab : 'users';
    renderSettings();
  });
  onClick('account', openAccount);
  onClick('more', openMore);
}
