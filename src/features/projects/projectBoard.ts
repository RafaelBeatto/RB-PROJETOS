import { pageContent, registerPage, setFilterBar, setPageHeader } from '../../app/navigation';
import { avatarStack } from '../../components/avatar';
import { progressRow } from '../../components/progress';
import { showToast } from '../../components/toast';
import { enableMouseDrag, enableMouseDrop, enableTouchDrag } from '../../components/touchDrag';
import { db } from '../../services/db';
import { findProject, isProjectOverdue, projectProgress, setProjectStatus } from '../../services/projectService';
import { PROJECT_BOARD_COLUMNS, PROJECT_STATUSES, type Project, type ProjectStatus } from '../../types/project';
import { formatShortDate } from '../../utils/date';
import { $$, esc } from '../../utils/dom';
import { matchesProjectFilters, projectFilterBar, sortProjects } from './projectFilters';

function card(p: Project): string {
  const footerLeft = avatarStack(p.coordinators) || esc(p.owner || 'Sem coordenador');
  return `<article class="task-card pcard" draggable="true" data-action="project-open" data-id="${p.id}"><h3>${esc(p.name)}</h3>${
    p.processo ? `<small class="pc-sub">Processo ${esc(p.processo)}</small>` : ''
  }${progressRow(projectProgress(p).pct)}<div class="task-card-footer"><span>${footerLeft}</span><span class="${isProjectOverdue(p) ? 'late-txt' : ''}">${formatShortDate(
    p.due,
  )}</span></div></article>`;
}

function move(id: string, column: HTMLElement): void {
  const p = findProject(id);
  const status = column.dataset.status as ProjectStatus | undefined;
  if (!p || !status || !PROJECT_STATUSES.includes(status)) return;
  if (setProjectStatus(p, status)) showToast('Projeto movido');
  renderBoard();
}

function renderBoard(): void {
  setPageHeader('Kanban de projetos', 'Arraste um projeto para mudar o status.', false);
  setFilterBar('projects', projectFilterBar);
  const list = sortProjects(db.projects.filter((p) => !p.archived && matchesProjectFilters(p)));
  if (!list.length) {
    pageContent().innerHTML = '<div class="empty">Ainda não existem projetos ativos.</div>';
    return;
  }
  const columnOf = (p: Project): ProjectStatus => ((PROJECT_BOARD_COLUMNS as readonly string[]).includes(p.status) ? p.status : 'Planejamento');
  pageContent().innerHTML = `<div class="board pboard">${PROJECT_BOARD_COLUMNS.map((status) => {
    const items = list.filter((p) => columnOf(p) === status);
    return `<section class="column" data-status="${status}"><div class="column-head"><span>${status.toUpperCase()} · ${items.length}</span></div><div class="dropzone">${items
      .map(card)
      .join('')}</div></section>`;
  }).join('')}</div>`;

  $$('.pboard .pcard').forEach((el) => {
    enableMouseDrag(el);
    enableTouchDrag(el, (column) => move(el.dataset.id ?? '', column));
  });
  $$('.pboard .column').forEach((column) => enableMouseDrop(column, '.pcard', move));
}

export function initProjectBoard(): void {
  registerPage('board', renderBoard);
}
