import { refreshProject } from '../../app/navigation';
import { filterSelect, registerFilterGroup } from '../../components/filterBar';
import { descendantIds, pathLabel } from '../../services/branchService';
import { isLate } from '../../services/taskService';
import { currentActor, knownPeople } from '../../services/userService';
import { emptyTaskFilters, ui, type QuickTaskFilter } from '../../state/store';
import type { Project } from '../../types/project';
import { PRIORITIES, type Priority, type Task } from '../../types/task';
import { onClick } from '../../utils/actions';
import { today, ymd } from '../../utils/date';

const QUICK: [QuickTaskFilter, string][] = [
  ['all', 'Todas'],
  ['mine', 'Minhas'],
  ['today', 'Hoje'],
  ['late', 'Atrasadas'],
  ['soon', 'Próximas'],
];

function matchesQuick(t: Task, quick: QuickTaskFilter, me: string): boolean {
  const open = t.status !== 'Concluído';
  switch (quick) {
    case 'all':
      return true;
    case 'mine':
      return t.assignee.trim().toLowerCase() === me;
    case 'today':
      return open && t.due === today();
    case 'late':
      return isLate(t);
    case 'soon':
      return open && t.due > today() && t.due <= ymd(7);
  }
}

export function filterTasks(p: Project): Task[] {
  const f = ui.taskFilters;
  const me = currentActor(p.owner).trim().toLowerCase();
  const branchIds = f.branch && f.branch !== 'none' ? new Set(descendantIds(p, f.branch)) : null;
  return p.tasks.filter(
    (t) =>
      matchesQuick(t, f.quick, me) &&
      (!f.priority || t.priority === f.priority) &&
      (!f.assignee || t.assignee.trim() === f.assignee) &&
      (!f.branch || (f.branch === 'none' ? !t.branch : !!branchIds?.has(t.branch))),
  );
}

export function taskFilterChips(p: Project): string {
  const f = ui.taskFilters;
  const quick = QUICK.map(([v, l]) => `<button class="chip ${f.quick === v ? 'on' : ''}" data-action="task-quick" data-value="${v}">${l}</button>`).join('');
  const priority = PRIORITIES.map((v) => `<button class="chip ${f.priority === v ? 'on' : ''}" data-action="task-priority" data-value="${v}">${v}</button>`).join('');
  const branches = p.branches.map((b) => {
    const path = pathLabel(p, b);
    return [b.id, path ? `${path} / ${b.name}` : b.name] as const;
  });
  return `<div class="chips">${quick}<span class="chip-sep"></span>${priority}<span class="chip-sep"></span>${filterSelect(
    'tasks.assignee',
    'Responsável',
    knownPeople().map((n) => [n, n] as const),
    f.assignee,
    'Todos',
  )}${filterSelect('tasks.branch', 'Etapa', [['none', 'Sem etapa'] as const, ...branches], f.branch, 'Todas')}</div>`;
}

export function initTaskFilters(): void {
  registerFilterGroup('tasks', {
    get: () => ui.taskFilters,
    reset: () => {
      ui.taskFilters = emptyTaskFilters();
    },
    render: refreshProject,
  });
  onClick('task-quick', (el) => {
    ui.taskFilters.quick = (el.dataset.value as QuickTaskFilter | undefined) ?? 'all';
    refreshProject();
  });
  onClick('task-priority', (el) => {
    const value = el.dataset.value as Priority | undefined;
    ui.taskFilters.priority = value && ui.taskFilters.priority !== value ? value : '';
    refreshProject();
  });
}
