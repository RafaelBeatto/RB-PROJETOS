/** Tela inicial: Kanban de projetos por status. Também desenha a lista de projetos arquivados (encerrados). */
import { pageContent, registerPage, setFilterBar, setPageHeader } from '../../app/navigation';
import { avatarStack } from '../../components/avatar';
import { icon } from '../../components/icons';
import { datesBadge, priorityBadge } from '../../components/itemParts';
import { progressRow } from '../../components/progress';
import { showToast } from '../../components/toast';
import { enableMouseDrag, enableMouseDrop, enableTouchDrag } from '../../components/touchDrag';
import { RuleError } from '../../services/errors';
import { canCreateProject, canEditProject, visibleProjects } from '../../services/permissionService';
import { findProject, projectProgress, setProjectStatus } from '../../services/projectService';
import { PROJECT_STATUSES, type Project, type ProjectStatus } from '../../types/project';
import { $$, esc, plural } from '../../utils/dom';
import { matchesProjectFilters, projectFilterBar, projectFiltersActive, sortProjects } from './projectFilters';

function card(p: Project): string {
  const prog = projectProgress(p);
  const movable = !p.archived && canEditProject(p);
  const coordinators = avatarStack(p.coordinators) || '<span class="sub flat">Sem coordenador</span>';
  return `<article class="task-card pcard" draggable="${movable}" data-action="project-open" data-id="${p.id}" tabindex="0"><div class="card-top"><h3>${esc(p.name)}</h3>${priorityBadge(
    p.priority,
  )}</div>${p.archived ? `<span class="status todo">${esc(p.status)}</span>` : ''}${progressRow(prog.pct)}<small class="card-sub">${
    prog.total ? `${prog.done} de ${plural(prog.total, 'etapa concluída', 'etapas concluídas')}` : 'Nenhuma etapa'
  }</small><div class="task-card-footer"><span>${coordinators}</span>${datesBadge(p.start, p.due, p.archived)}</div></article>`;
}

function move(id: string, column: HTMLElement): void {
  const p = findProject(id);
  const status = column.dataset.status as ProjectStatus | undefined;
  if (!p || !status || !PROJECT_STATUSES.includes(status)) return;
  try {
    if (setProjectStatus(p, status)) showToast(`Projeto em “${status}”`);
  } catch (error) {
    if (!(error instanceof RuleError)) throw error;
    showToast(error.message);
  }
  renderBoard();
}

function emptyText(archived: boolean): string {
  if (projectFiltersActive()) return '<div class="empty">Nenhum projeto encontrado com esses filtros.</div>';
  if (archived) return '<div class="empty">Nenhum projeto arquivado.</div>';
  if (!canCreateProject()) return '<div class="empty">Ainda não existem projetos.</div>';
  return `<div class="empty">Ainda não existem projetos.<br><br><button class="primary" data-action="project-new">${icon('plus')}<span>Criar primeiro projeto</span></button></div>`;
}

function renderBoard(): void {
  setPageHeader('Projetos', 'Abra um projeto para ver as etapas. Arraste um cartão para mudar o status.', true);
  setFilterBar('projects', projectFilterBar);
  const list = sortProjects(visibleProjects().filter((p) => !p.archived && matchesProjectFilters(p)));
  if (!list.length) {
    pageContent().innerHTML = emptyText(false);
    return;
  }
  pageContent().innerHTML = `<div class="board pboard">${PROJECT_STATUSES.map((status) => {
    const items = list.filter((p) => p.status === status);
    return `<section class="column" data-status="${status}"><div class="column-head"><span>${status.toUpperCase()} · ${items.length}</span></div><div class="dropzone">${
      items.map(card).join('') || '<p class="col-empty">Nenhum projeto</p>'
    }</div></section>`;
  }).join('')}</div>`;

  $$('.pboard .pcard[draggable="true"]').forEach((el) => {
    enableMouseDrag(el);
    enableTouchDrag(el, (column) => move(el.dataset.id ?? '', column));
  });
  $$('.pboard .column').forEach((column) => enableMouseDrop(column, '.pcard', move));
}

function renderArchive(): void {
  setPageHeader('Arquivados', 'Projetos encerrados. Abra um projeto para reabrir.', false);
  setFilterBar('projects', projectFilterBar);
  const list = sortProjects(visibleProjects().filter((p) => p.archived && matchesProjectFilters(p)));
  pageContent().innerHTML = list.length ? `<div class="card-grid">${list.map(card).join('')}</div>` : emptyText(true);
}

export function initProjectBoard(): void {
  registerPage('home', renderBoard);
  registerPage('archive', renderArchive);
}
