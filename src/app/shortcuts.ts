/**
 * Atalhos de teclado: Ctrl+K ou / pesquisa; N novo (projeto ou tarefa); T tarefa; R etapa;
 * K e C trocam para Etapas e Chat. Ignorados enquanto se digita ou com login aberto.
 */
import { closeModal, isModalOpen } from '../components/modal';
import { isLoginVisible } from '../features/auth/login';
import { openProjectModal } from '../features/projects/projectModal';
import { openSearch } from '../features/search/search';
import { openNewBranchModal } from '../features/structure/branchModals';
import { openTaskModal } from '../features/tasks/taskModal';
import { ui, type ProjectTab } from '../state/store';
import { can } from '../services/permissionService';
import { canOpenTab } from './access';
import { isProjectOpen, refreshProject } from './navigation';

const TAB_KEYS: Record<string, ProjectTab> = { k: 'kanban', c: 'chat' };

export function installShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    if (isLoginVisible()) return;
    if (e.key === 'Escape') closeModal();
    const typing = e.target instanceof Element && !!e.target.closest('input, textarea, select, [contenteditable]');
    const plain = !typing && !e.ctrlKey && !e.metaKey && !e.altKey;
    const key = e.key.toLowerCase();

    if ((e.ctrlKey && key === 'k') || (plain && e.key === '/')) {
      e.preventDefault();
      openSearch();
      return;
    }
    if (!plain || isModalOpen()) return;

    const inProject = isProjectOpen();
    const projectId = ui.projectId ?? undefined;
    if (key === 'n') {
      if (inProject) openTaskModal();
      else if (can('projects', 'create')) openProjectModal();
    } else if (inProject && key === 't') openTaskModal();
    else if (inProject && key === 'r') openNewBranchModal(null);
    else if (inProject && TAB_KEYS[key] && canOpenTab(TAB_KEYS[key], projectId)) {
      ui.tab = TAB_KEYS[key];
      refreshProject();
    }
  });
}
