/**
 * Aplica as permissões do usuário logado à interface fixa (menu, botões do cabeçalho)
 * e define a qual página/aba cada permissão dá acesso.
 */
import { avatar } from '../components/avatar';
import { currentUser } from '../services/authService';
import { can } from '../services/permissionService';
import { findProfile } from '../services/profileService';
import type { Page, ProjectTab } from '../state/store';
import { PERMISSION_ACTIONS, type PermissionAction, type PermissionModule } from '../types/access';
import { $$, $maybe, esc } from '../utils/dom';

export const NO_ACCESS = 'Você não possui permissão para acessar este módulo.';

const PAGE_ACCESS: Record<Page, PermissionModule> = {
  home: 'projects',
  archive: 'projects',
  today: 'projects',
  history: 'projects',
  board: 'kanban',
  collaborators: 'collaborators',
  settings: 'settings',
};

/** Permissões que abrem cada aba ("|" = qualquer uma delas). */
const TAB_ACCESS: Record<ProjectTab, string> = {
  overview: 'projects.view',
  info: 'projects.view',
  // Etapas reúne o Kanban e a Estrutura (mapa e cartões): basta ver um dos dois.
  kanban: 'kanban.view|structure.view',
  // Quem vê o projeto participa do chat dele.
  chat: 'projects.view',
};

export const PAGE_ORDER: Page[] = ['home', 'board', 'today', 'history', 'collaborators', 'archive', 'settings'];
export const TAB_ORDER: ProjectTab[] = ['kanban', 'overview', 'info', 'chat'];

export function canOpenPage(page: Page): boolean {
  return can(PAGE_ACCESS[page], 'view');
}

export function canOpenTab(tab: ProjectTab, projectId?: string): boolean {
  return canAny(TAB_ACCESS[tab], projectId);
}

/** Lê "modulo.acao" (ex.: "projects.create"); várias opções separadas por "|" valem como "ou". */
export function canAny(spec: string, projectId?: string): boolean {
  return spec.split('|').some((part) => {
    const [module, action] = part.split('.') as [PermissionModule, PermissionAction | undefined];
    const act = action && (PERMISSION_ACTIONS as readonly string[]).includes(action) ? action : 'view';
    return can(module, act, projectId);
  });
}

function renderAccount(): void {
  const slot = $maybe('#accountSlot');
  if (!slot) return;
  const user = currentUser();
  const profile = findProfile(user?.profileId);
  slot.innerHTML = user
    ? `<button class="nav-item account-chip" data-action="account" title="Minha conta">${avatar(user, true)}<span><b>${esc(user.name)}</b><small>${esc(
        profile?.name ?? '',
      )}</small></span></button>`
    : '';
}

/** Esconde, dentro de `root`, os elementos marcados com `data-perm` que o usuário não pode usar. */
export function applyPerms(root: ParentNode, projectId?: string): void {
  $$('[data-perm]', root).forEach((el) => {
    el.hidden = !canAny(el.dataset.perm ?? '', projectId);
  });
}

/** Aplica as permissões à interface fixa (menu, cabeçalhos, abas). */
export function applyAccess(projectId?: string): void {
  applyPerms(document, projectId);
  $$('[data-action="tab"]').forEach((el) => {
    el.hidden = !canOpenTab(el.dataset.tab as ProjectTab, projectId);
  });
  renderAccount();
}
