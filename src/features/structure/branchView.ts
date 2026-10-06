/**
 * Etapa aberta: dados da etapa e o Kanban das tarefas dela (A fazer, Em andamento, Concluído).
 * Arrastar muda o status da tarefa; clicar abre a tarefa (subtarefas, checklist, dependências…).
 */
import { openBranch, refreshProject } from '../../app/navigation';
import { avatarStack } from '../../components/avatar';
import { clearButton, filterSearch, filterSelect, registerFilterGroup } from '../../components/filterBar';
import { icon } from '../../components/icons';
import { datesBadge, peopleLine, priorityBadge } from '../../components/itemParts';
import { progressRow } from '../../components/progress';
import { showToast } from '../../components/toast';
import { enableMouseDrag, enableMouseDrop, enableTouchDrag } from '../../components/touchDrag';
import { branchProgress, tasksIn } from '../../services/branchService';
import { db } from '../../services/db';
import { canCreateTask, canEditBranch, canEditTask } from '../../services/permissionService';
import { checklistProgress, dependenciesOf, findTask, setTaskStatus } from '../../services/taskService';
import { findUser } from '../../services/userService';
import { emptyTaskFilters, ui } from '../../state/store';
import type { Branch } from '../../types/branch';
import type { Project } from '../../types/project';
import { PRIORITIES, TASK_STATUSES, type Task, type TaskStatus } from '../../types/task';
import { onClick } from '../../utils/actions';
import { $$, esc, plural } from '../../utils/dom';
import { taskStatusClass } from '../../utils/format';
import { openTaskModal } from '../tasks/taskModal';
import { openEditBranchModal } from './branchModals';

function matches(t: Task): boolean {
  const f = ui.taskFilters;
  const q = f.q.trim().toLowerCase();
  const names = t.assignees.map((id) => findUser(id)?.name ?? '').join(' ');
  if (q && !`${t.title} ${t.description} ${names} ${t.subtasks.map((s) => s.title).join(' ')}`.toLowerCase().includes(q)) return false;
  if (f.person === 'none' && t.assignees.length) return false;
  if (f.person && f.person !== 'none' && !t.assignees.includes(f.person)) return false;
  if (f.priority && t.priority !== (f.priority === 'none' ? '' : f.priority)) return false;
  return true;
}

function filterBar(): string {
  const f = ui.taskFilters;
  const active = !!(f.q.trim() || f.person || f.priority);
  return `<div class="fbar">${filterSearch('tasks.q', 'Filtrar tarefas', f.q)}<div class="fchips">${filterSelect(
    'tasks.person',
    'Responsável',
    [['none', 'Sem responsável'] as const, ...db.users.map((u) => [u.id, u.name] as const)],
    f.person,
    'Todos',
  )}${filterSelect('tasks.priority', 'Prioridade', [...PRIORITIES.map((x) => [x, x] as const), ['none', 'Sem prioridade'] as const], f.priority, 'Todas')}${
    active ? clearButton('tasks') : ''
  }</div></div>`;
}

function taskCard(p: Project, t: Task): string {
  const deps = dependenciesOf(p, t);
  const subDone = t.subtasks.filter((s) => s.status === 'Concluído').length;
  const check = checklistProgress(t);
  const facts = [
    t.subtasks.length ? `<span title="Subtarefas concluídas">${icon('branch')}${subDone}/${t.subtasks.length}</span>` : '',
    check.total ? `<span title="Checklist">${icon('selectOn')}${check.done}/${check.total}</span>` : '',
  ].join('');
  const depLine = deps.length
    ? `<div class="dep-line" title="Depende de: ${esc(deps.map((d) => `${d.title} (${d.status})`).join(', '))}">${icon('link')}<span>Depende de ${deps
        .map((d) => `<b class="${d.status === 'Concluído' ? 'dep-done' : ''}">${esc(d.title)}</b>`)
        .join(', ')}</span></div>`
    : '';
  return `<article class="task-card tcard" draggable="${canEditTask(p, t)}" data-action="task-open" data-id="${t.id}" tabindex="0"><div class="card-top"><h3>${esc(t.title)}</h3>${priorityBadge(
    t.priority,
  )}</div>${depLine}${facts ? `<div class="card-facts">${facts}</div>` : ''}<div class="task-card-footer"><span>${avatarStack(t.assignees) || '<span class="sub flat">Sem responsável</span>'}</span>${datesBadge(
    t.start,
    t.due,
    t.status === 'Concluído',
  )}</div></article>`;
}

function header(p: Project, b: Branch): string {
  const prog = branchProgress(p, b);
  const edit = canEditBranch(p) ? `<button class="ghost" data-action="branch-edit" data-id="${b.id}">${icon('edit')}<span>Editar etapa</span></button>` : '';
  const add = canCreateTask(p, b) ? `<button class="primary" data-action="task-new" data-branch="${b.id}" data-status="A fazer">${icon('plus')}<span>Nova tarefa</span></button>` : '';
  return `<button class="crumb" data-action="branch-back">${icon('chevronLeft')}Etapas</button><div class="etapa-head"><div><h2>${esc(b.name)}</h2><div class="p-meta"><span class="status ${taskStatusClass(
    b.status,
  )}">${esc(b.status)}</span>${priorityBadge(b.priority)}${datesBadge(b.start, b.due, b.status === 'Concluído')}<span class="p-people">${peopleLine(
    b.assignees,
  )}</span><span class="p-prog" title="Tarefas concluídas">${progressRow(prog.pct)}<small>${prog.done}/${prog.total} tarefas</small></span></div>${
    b.description.trim() ? `<p class="desc">${esc(b.description)}</p>` : ''
  }</div><div class="top-actions">${edit}${add}</div></div>`;
}

export function renderBranchView(p: Project, b: Branch): string {
  const all = tasksIn(p, b.id);
  const list = all.filter(matches);
  const canCreate = canCreateTask(p, b);
  const board = all.length
    ? `<div class="board">${TASK_STATUSES.map((status) => {
        const items = list.filter((t) => t.status === status);
        return `<section class="column" data-status="${status}"><div class="column-head"><span>${status.toUpperCase()} · ${items.length}</span>${
          canCreate ? `<button data-action="task-new" data-branch="${b.id}" data-status="${status}" aria-label="Nova tarefa em ${status}">${icon('plus')}</button>` : ''
        }</div><div class="dropzone">${items.map((t) => taskCard(p, t)).join('') || '<p class="col-empty">Nenhuma tarefa</p>'}</div></section>`;
      }).join('')}</div>`
    : `<div class="empty">Nenhuma tarefa nesta etapa.${
        canCreate
          ? `<br><br><button class="primary" data-action="task-new" data-branch="${b.id}" data-status="A fazer">${icon('plus')}<span>Criar primeira tarefa</span></button>`
          : `<br><small>${b.assignees.length ? 'Só os responsáveis pela etapa, coordenadores e administradores criam tarefas aqui.' : 'Defina um responsável pela etapa para que ele possa criar tarefas.'}</small>`
      }</div>`;
  return `${header(p, b)}${all.length ? filterBar() : ''}${board}${all.length && !list.length ? `<p class="sub">${plural(0, 'tarefa encontrada', 'tarefas encontradas')} com esses filtros.</p>` : ''}`;
}

export function mountBranchView(p: Project, container: HTMLElement): void {
  const move = (id: string, column: HTMLElement): void => {
    const t = findTask(p, id);
    const status = column.dataset.status as TaskStatus | undefined;
    if (!t || !status || !TASK_STATUSES.includes(status)) return;
    if (setTaskStatus(p, t, status)) showToast(`Tarefa em “${status}”`);
    refreshProject();
  };
  $$('.tcard[draggable="true"]', container).forEach((card) => {
    enableMouseDrag(card);
    enableTouchDrag(card, (column) => move(card.dataset.id ?? '', column));
  });
  $$('.column', container).forEach((column) => enableMouseDrop(column, '.tcard', move));
}

export function initBranchView(): void {
  registerFilterGroup('tasks', {
    get: () => ui.taskFilters,
    reset: () => {
      ui.taskFilters = emptyTaskFilters();
    },
    render: refreshProject,
  });
  onClick('branch-back', () => openBranch(null));
  onClick('branch-edit', (el) => openEditBranchModal(el.dataset.id ?? ''));
  onClick('task-open', (el) => openTaskModal(el.dataset.id));
  onClick('task-new', (el) => {
    const status = el.dataset.status as TaskStatus | undefined;
    openTaskModal(undefined, status && TASK_STATUSES.includes(status) ? status : 'A fazer', el.dataset.branch ?? ui.branchId ?? '');
  });
}
