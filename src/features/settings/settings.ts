/** Página Configurações (Usuários | Perfis e permissões | Prefeituras), Minha conta e menu "Mais" do celular. */
import { canOpenPage } from '../../app/access';
import { pageContent, registerPage, setFilterBar, setPageHeader } from '../../app/navigation';
import { avatar } from '../../components/avatar';
import { icon } from '../../components/icons';
import { closeModal, modalField, openModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import { currentUser } from '../../services/authService';
import { can } from '../../services/permissionService';
import { findProfile } from '../../services/profileService';
import { MIN_PASSWORD, changeOwnPassword } from '../../services/userService';
import { ui, type SettingsTab } from '../../state/store';
import { onClick } from '../../utils/actions';
import { esc } from '../../utils/dom';
import { initPrefeiturasAdmin, renderPrefeiturasTab } from './prefeiturasAdmin';
import { initProfilesAdmin, mountProfilesTab, renderProfilesTab } from './profilesAdmin';
import { initUsersAdmin, renderUsersTab, usersFilterBar } from './usersAdmin';

const TABS: { tab: SettingsTab; label: string; module: 'users' | 'profiles' | 'prefeituras' }[] = [
  { tab: 'users', label: 'Usuários', module: 'users' },
  { tab: 'profiles', label: 'Perfis e permissões', module: 'profiles' },
  { tab: 'prefeituras', label: 'Prefeituras', module: 'prefeituras' },
];

function renderSettings(): void {
  setPageHeader('Configurações', 'Usuários, perfis, permissões de acesso e prefeituras.', false);
  const allowed = TABS.filter((t) => can(t.module, 'view'));
  if (!allowed.some((t) => t.tab === ui.settingsTab) && allowed[0]) ui.settingsTab = allowed[0].tab;
  const tabs = `<nav class="tabs settings-tabs" aria-label="Configurações">${allowed
    .map((t) => `<button class="tab ${t.tab === ui.settingsTab ? 'active' : ''}" data-action="settings-tab" data-tab="${t.tab}">${t.label}</button>`)
    .join('')}</nav>`;
  if (!allowed.length) {
    setFilterBar('settings-empty', () => '');
    pageContent().innerHTML = '<div class="empty">Seu perfil não tem acesso a usuários, perfis nem prefeituras.</div>';
    return;
  }
  if (ui.settingsTab === 'users') {
    setFilterBar('users', () => tabs + usersFilterBar());
    pageContent().innerHTML = renderUsersTab();
  } else if (ui.settingsTab === 'prefeituras') {
    setFilterBar('prefeituras', () => tabs);
    pageContent().innerHTML = renderPrefeiturasTab();
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
  const archive = canOpenPage('archive') ? `<button class="ghost" data-action="nav" data-page="archive">${icon('archive')}Arquivados</button>` : '';
  openModal(
    'Mais',
    `<div class="more-list">${archive}${settings}<button class="ghost" data-action="account">${icon('users')}Minha conta</button><button class="ghost" data-action="logout">${icon(
      'logout',
    )}Sair</button></div>`,
  );
}

export function initSettings(): void {
  initUsersAdmin();
  initProfilesAdmin();
  initPrefeiturasAdmin();
  registerPage('settings', renderSettings);
  onClick('settings-tab', (el) => {
    const tab = el.dataset.tab;
    ui.settingsTab = tab === 'profiles' || tab === 'prefeituras' ? tab : 'users';
    renderSettings();
  });
  onClick('account', openAccount);
  onClick('more', openMore);
}
