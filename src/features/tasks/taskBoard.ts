import { refreshProject } from '../../app/navigation';
import { icon } from '../../components/icons';
import { showToast } from '../../components/toast';
import { enableMouseDrag, enableMouseDrop, enableTouchDrag } from '../../components/touchDrag';
import { can } from '../../services/permissionService';
import { DependencyError, blockedSnapshot, releasedSince, taskRef } from '../../services/dependencyService';
import { findTask, isLate, moveTask } from '../../services/taskService';
import { blockedBadge } from '../dependencies/dependencyView';
import type { Project } from '../../types/project';
import { TASK_STATUSES, type Task, type TaskStatus } from '../../types/task';
import { formatShortDate } from '../../utils/date';
import { $$, esc, plural } from '../../utils/dom';
import { priorityClass } from '../../utils/format';
import { registerTab } from '../projects/projectView';
import { filterTasks, taskFilterChips } from './taskFilters';

/** Mover cartões muda o status da tarefa: exige Kanban e Tarefas → Editar. */
const canMove = (p: Project): boolean => can('kanban', 'edit', p.id) && can('tasks', 'edit', p.id);

export function taskCard(t: Task, p: Project): string {
  const badge = t.status === 'Concluído' ? '' : blockedBadge(taskRef(p, t));
  const blocked = badge ? ` · ${badge}` : '';
  return `<article class="task-card${badge ? ' is-blocked' : ''}" draggable="${canMove(p)}" data-action="task-open" data-id="${t.id}"><h3>${esc(t.title)}</h3><div class="task-card-footer"><span><i class="priority ${priorityClass(
    t.priority,
  )}"></i> ${esc(t.assignee || 'Sem responsável')}${blocked}</span><span class="${isLate(t) ? 'late-txt' : ''}">${formatShortDate(t.due)}</span></div></article>`;
}

function renderBoard(p: Project): string {
  const tasks = filterTasks(p);
  const canCreate = can('tasks', 'create', p.id);
  const columns = TASK_STATUSES.map((status) => {
    const items = tasks.filter((t) => t.status === status);
    return `<section class="column" data-status="${status}"><div class="column-head"><span>${status.toUpperCase()} · ${items.length}</span>${
      canCreate ? `<button data-action="task-new" data-status="${status}" aria-label="Adicionar tarefa em ${status}">${icon('plus')}</button>` : ''
    }</div><div class="dropzone">${items.map((t) => taskCard(t, p)).join('')}</div></section>`;
  }).join('');
  return `${taskFilterChips(p)}<div class="board">${columns}</div>`;
}

function mountBoard(p: Project, container: HTMLElement): void {
  if (!canMove(p)) return;
  const move = (id: string, column: HTMLElement): void => {
    const task = findTask(p, id);
    const status = column.dataset.status as TaskStatus | undefined;
    if (!task || !status || !TASK_STATUSES.includes(status)) return;
    const before = blockedSnapshot();
    try {
      moveTask(p, task, status);
    } catch (error) {
      if (!(error instanceof DependencyError)) throw error;
      refreshProject();
      showToast(error.message);
      return;
    }
    refreshProject();
    const released = releasedSince(before);
    showToast(`Tarefa movida${released ? ` · ${plural(released, 'item liberado', 'itens liberados')}` : ''}`);
  };
  $$('.task-card', container).forEach((card) => {
    enableMouseDrag(card);
    enableTouchDrag(card, (column) => move(card.dataset.id ?? '', column));
  });
  $$('.column', container).forEach((column) => enableMouseDrop(column, '.task-card', move));
}

export function initTaskBoard(): void {
  registerTab('kanban', { render: renderBoard, mount: mountBoard });
}
