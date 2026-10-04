/** Ações globais da interface: navegação, abas e botões do cabeçalho do projeto. */
import { icon } from '../components/icons';
import { closeModal, modalField, openModal } from '../components/modal';
import { showToast } from '../components/toast';
import { openMilestoneModal } from '../features/projects/milestoneModal';
import { openProjectModal } from '../features/projects/projectModal';
import { openNewBranchModal } from '../features/structure/branchModals';
import { can } from '../services/permissionService';
import { findProject } from '../services/projectService';
import { ui, type Page, type ProjectTab } from '../state/store';
import { onClick } from '../utils/actions';
import { NO_ACCESS, PAGE_ORDER, TAB_ORDER, canOpenTab } from './access';
import { currentProject, goTo, openProject, refreshProject } from './navigation';

function openAddMenu(): void {
  const p = currentProject().id;
  const options = [
    // Tarefas são criadas dentro de cada etapa.
    can('structure', 'create', p) ? `<button class="ghost" id="chooseBranch">${icon('branch')}Etapa</button>` : '',
    can('projects', 'edit', p) ? `<button class="ghost" id="chooseMs">${icon('milestone')}Marco</button>` : '',
  ].join('');
  if (!options) return;
  openModal('Adicionar', `<div class="form-grid">${options}</div>`);
  document.getElementById('chooseBranch')?.addEventListener('click', () => openNewBranchModal(null));
  if (can('projects', 'edit', p)) modalField('#chooseMs').addEventListener('click', () => openMilestoneModal());
}

export function installAppActions(): void {
  onClick('nav', (el) => {
    const page = el.dataset.page as Page | undefined;
    if (!page || !PAGE_ORDER.includes(page)) return;
    closeModal();
    // O menu Colaboradores sempre abre a lista (não o último painel aberto).
    if (page === 'collaborators') ui.collaboratorId = null;
    goTo(page);
  });
  onClick('back', () => goTo('home'));
  onClick('tab', (el) => {
    const tab = el.dataset.tab as ProjectTab | undefined;
    if (!tab || !TAB_ORDER.includes(tab)) return;
    if (!canOpenTab(tab, ui.projectId ?? undefined)) {
      showToast(NO_ACCESS);
      return;
    }
    ui.tab = tab;
    refreshProject();
  });
  onClick('modal-close', closeModal);
  onClick('project-new', () => {
    if (can('projects', 'create')) openProjectModal();
  });
  onClick('project-edit', () => {
    if (can('projects', 'edit', ui.projectId ?? undefined)) openProjectModal(currentProject());
  });
  onClick('project-open', (el) => {
    if (findProject(el.dataset.id)) openProject(el.dataset.id ?? '');
  });
  onClick('add-menu', openAddMenu);
}
