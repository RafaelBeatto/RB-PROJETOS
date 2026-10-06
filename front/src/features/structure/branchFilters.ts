import { refreshProject } from '../../app/navigation';
import { clearButton, filterSearch, filterSelect, registerFilterGroup } from '../../components/filterBar';
import { tasksIn } from '../../services/branchService';
import { db } from '../../services/db';
import { isLate } from '../../services/taskService';
import { findUser } from '../../services/userService';
import { emptyBranchFilters, ui } from '../../state/store';
import type { Branch } from '../../types/branch';
import type { Project } from '../../types/project';
import { PRIORITIES } from '../../types/task';
import { plural } from '../../utils/dom';

export function branchFiltersActive(): boolean {
  const f = ui.branchFilters;
  return !!(f.q.trim() || f.designer || f.priority || f.state);
}

export function matchesBranchFilters(p: Project, b: Branch): boolean {
  const f = ui.branchFilters;
  const q = f.q.trim().toLowerCase();
  const names = b.assignees.map((id) => findUser(id)?.name ?? '').join(' ');
  if (q && !`${b.name} ${b.description} ${names}`.toLowerCase().includes(q)) return false;
  if (f.designer === 'none' && b.assignees.length) return false;
  if (f.designer && f.designer !== 'none' && !b.assignees.includes(f.designer)) return false;
  if (f.priority && b.priority !== (f.priority === 'none' ? '' : f.priority)) return false;
  const tasks = tasksIn(p, b.id);
  switch (f.state) {
    case 'late':
      return tasks.some(isLate) || isLate({ status: b.status === 'Concluído' ? 'Concluído' : 'A fazer', due: b.due });
    case 'open':
      return b.status !== 'Concluído';
    case 'done':
      return b.status === 'Concluído';
    case 'empty':
      return !tasks.length;
    default:
      return true;
  }
}

export function branchFilterBar(p: Project): string {
  const f = ui.branchFilters;
  const active = branchFiltersActive();
  const found = active ? p.branches.filter((b) => matchesBranchFilters(p, b)).length : 0;
  return `<div class="fbar">${filterSearch('branches.q', 'Filtrar etapas ou responsável', f.q)}<div class="fchips">${filterSelect(
    'branches.designer',
    'Responsável',
    [['none', 'Sem responsável'] as const, ...db.users.map((u) => [u.id, u.name] as const)],
    f.designer,
    'Todos',
  )}${filterSelect('branches.priority', 'Prioridade', [...PRIORITIES.map((x) => [x, x] as const), ['none', 'Sem prioridade'] as const], f.priority, 'Todas')}${filterSelect(
    'branches.state',
    'Situação',
    [
      ['late', 'Com atraso'],
      ['open', 'Não concluídas'],
      ['done', 'Concluídas'],
      ['empty', 'Sem tarefas'],
    ],
    f.state,
    'Todas',
  )}${active ? `<span class="fcount">${plural(found, 'encontrada', 'encontradas')}</span>${clearButton('branches')}` : ''}</div></div>`;
}

export function initBranchFilters(): void {
  registerFilterGroup('branches', {
    get: () => ui.branchFilters,
    reset: () => {
      ui.branchFilters = emptyBranchFilters();
    },
    render: refreshProject,
  });
}
