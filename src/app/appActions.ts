/** Ações globais da interface: navegação, abas e botões do cabeçalho do projeto. */
import { icon } from '../components/icons';
import { closeModal, modalField, openModal } from '../components/modal';
import { openMilestoneModal } from '../features/projects/milestoneModal';
import { openProjectModal } from '../features/projects/projectModal';
import { openNewBranchModal } from '../features/structure/branchModals';
import { openTaskModal } from '../features/tasks/taskModal';
import { findProject } from '../services/projectService';
import { ui, type Page, type ProjectTab } from '../state/store';
import { onClick } from '../utils/actions';
import { currentProject, goTo, openProject, refreshProject } from './navigation';

const PAGES: Page[] = ['home', 'archive', 'board', 'today', 'users', 'history'];
const TABS: ProjectTab[] = ['overview', 'info', 'kanban', 'structure', 'list', 'timeline'];

function openAddMenu(): void {
  openModal(
    'Adicionar',
    `<div class="form-grid"><button class="ghost" id="chooseTask">${icon('plus')}Tarefa</button><button class="ghost" id="chooseBranch">${icon(
      'branch',
    )}Ramificação</button><button class="ghost" id="chooseMs">${icon('milestone')}Marco</button></div>`,
  );
  modalField('#chooseTask').addEventListener('click', () => openTaskModal());
  modalField('#chooseBranch').addEventListener('click', () => openNewBranchModal(null));
  modalField('#chooseMs').addEventListener('click', () => openMilestoneModal());
}

export function installAppActions(): void {
  onClick('nav', (el) => {
    const page = el.dataset.page as Page | undefined;
    if (!page || !PAGES.includes(page)) return;
    closeModal();
    goTo(page);
  });
  onClick('back', () => goTo('home'));
  onClick('tab', (el) => {
    const tab = el.dataset.tab as ProjectTab | undefined;
    if (!tab || !TABS.includes(tab)) return;
    ui.tab = tab;
    refreshProject();
  });
  onClick('modal-close', closeModal);
  onClick('project-new', () => openProjectModal());
  onClick('project-edit', () => openProjectModal(currentProject()));
  onClick('project-open', (el) => {
    if (findProject(el.dataset.id)) openProject(el.dataset.id ?? '');
  });
  onClick('add-menu', openAddMenu);
}
