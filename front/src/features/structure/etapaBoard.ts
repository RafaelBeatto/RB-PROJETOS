/**
 * Kanban de etapas (a tela inicial do projeto): colunas por status.
 * Arrastar muda o status; clicar abre a etapa com o Kanban das tarefas.
 * A ordem dentro da coluna é a ordem de criação (não há ordenação manual).
 */
import { dependencyItems } from '../../services/dependencyService';
import { currentProject, openBranch, refreshProject } from '../../app/navigation';
import { avatarStack } from '../../components/avatar';
import { icon } from '../../components/icons';
import { openModal } from '../../components/modal';
import { datesBadge, priorityBadge } from '../../components/itemParts';
import { progressRow } from '../../components/progress';
import { showToast } from '../../components/toast';
import { enableMouseDrag, enableMouseDrop, enableTouchDrag } from '../../components/touchDrag';
import { branchProgress, findBranch, setBranchStatus, tasksIn } from '../../services/branchService';
import { canCreateBranch, canEditBranch } from '../../services/permissionService';
import { isLate } from '../../services/taskService';
import { BRANCH_STATUSES, type Branch, type BranchStatus } from '../../types/branch';
import type { Project } from '../../types/project';
import { onClick } from '../../utils/actions';
import { $$, esc, plural } from '../../utils/dom';
import { taskStatusClass } from '../../utils/format';
import { matchesBranchFilters } from './branchFilters';
import { openNewBranchModal } from './branchModals';

function etapaCard(p: Project, b: Branch, movable: boolean): string {
  const prog = branchProgress(p, b);
  const lateTasks = b.status === 'Concluído' ? 0 : tasksIn(p, b.id).filter(isLate).length;
  const deps = dependencyItems(p, b.dependencies);
  const depLine = deps.length
    ? `<small class="card-sub dep-sub" title="Depende de: ${esc(deps.map((d) => `${d.name} (${d.status})`).join(', '))}">${icon('link')}Depende de ${esc(deps.map((d) => d.name).join(', '))}</small>`
    : '';
  return `<article class="task-card ecard" draggable="${movable}" data-action="branch-open" data-id="${b.id}" tabindex="0"><div class="card-top"><h3>${esc(b.name)}</h3>${priorityBadge(
    b.priority,
  )}</div>${progressRow(prog.pct)}<small class="card-sub">${prog.total ? `${prog.done} de ${plural(prog.total, 'tarefa concluída', 'tarefas concluídas')}` : 'Nenhuma tarefa'}${
    lateTasks ? ` · <span class="late-txt">${plural(lateTasks, 'atrasada', 'atrasadas')}</span>` : ''
  }</small>${depLine}<div class="task-card-footer"><span>${avatarStack(b.assignees) || '<span class="sub flat">Sem responsável</span>'}</span>${datesBadge(
    b.start,
    b.due,
    b.status === 'Concluído',
  )}</div></article>`;
}

/** Tarefas de versões antigas que ficaram sem etapa: aviso para abrir cada uma e escolher a etapa. */
function looseNotice(p: Project): string {
  const loose = p.tasks.filter((t) => !findBranch(p, t.branch)).length;
  if (!loose) return '';
  return `<div class="loose-note">${icon('info')}<span>${plural(loose, 'tarefa está', 'tarefas estão')} sem etapa.</span><button class="ghost" data-action="loose-tasks">Escolher etapa</button></div>`;
}

function openLooseTasks(p: Project): void {
  const loose = p.tasks.filter((t) => !findBranch(p, t.branch));
  if (!loose.length) return;
  openModal(
    'Tarefas sem etapa',
    `<p class="sub flat">Abra cada tarefa e escolha a etapa em que ela deve ficar.</p><div class="next-list">${loose
      .map((t) => `<div class="next-task" data-action="task-open" data-id="${t.id}" tabindex="0">${esc(t.title)}<span class="status ${taskStatusClass(t.status)}">${esc(t.status)}</span></div>`)
      .join('')}</div>`,
  );
}

export function renderEtapaBoard(p: Project): string {
  const list = p.branches.filter((b) => matchesBranchFilters(p, b));
  const canCreate = canCreateBranch(p);
  const movable = canEditBranch(p);
  if (!p.branches.length) {
    return `${looseNotice(p)}<div class="empty">Nenhuma etapa ainda.${
      canCreate ? `<br><br><button class="primary" data-action="etapa-new" data-status="Em espera">${icon('plus')}<span>Criar primeira etapa</span></button>` : ''
    }</div>`;
  }
  const columns = BRANCH_STATUSES.map((status) => {
    const items = list.filter((b) => b.status === status);
    return `<section class="column" data-status="${status}"><div class="column-head"><span>${status.toUpperCase()} · ${items.length}</span>${
      canCreate ? `<button data-action="etapa-new" data-status="${status}" aria-label="Nova etapa em ${status}">${icon('plus')}</button>` : ''
    }</div><div class="dropzone">${items.map((b) => etapaCard(p, b, movable)).join('') || '<p class="col-empty">Nenhuma etapa</p>'}</div></section>`;
  }).join('');
  return `${looseNotice(p)}<div class="board">${columns}</div>`;
}

export function mountEtapaBoard(p: Project, container: HTMLElement): void {
  if (!canEditBranch(p)) return;
  const move = (id: string, column: HTMLElement): void => {
    const b = findBranch(p, id);
    const status = column.dataset.status as BranchStatus | undefined;
    if (!b || !status || !BRANCH_STATUSES.includes(status)) return;
    if (setBranchStatus(p, b, status)) showToast(`Etapa em “${status}”`);
    refreshProject();
  };
  $$('.ecard', container).forEach((card) => {
    enableMouseDrag(card);
    enableTouchDrag(card, (column) => move(card.dataset.id ?? '', column));
  });
  $$('.column', container).forEach((column) => enableMouseDrop(column, '.ecard', move));
}

export function initEtapaBoard(): void {
  onClick('etapa-new', (el) => {
    const status = el.dataset.status as BranchStatus | undefined;
    openNewBranchModal(status && BRANCH_STATUSES.includes(status) ? status : 'Em espera');
  });
  onClick('branch-open', (el) => openBranch(el.dataset.id ?? null));
  onClick('loose-tasks', () => openLooseTasks(currentProject()));
}
