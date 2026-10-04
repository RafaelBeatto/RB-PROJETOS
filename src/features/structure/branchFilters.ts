import { refreshProject } from '../../app/navigation';
import { clearButton, filterSearch, filterSelect, registerFilterGroup } from '../../components/filterBar';
import { tasksIn } from '../../services/branchService';
import { db } from '../../services/db';
import { isLate } from '../../services/taskService';
import { findUser } from '../../services/userService';
import { emptyBranchFilters, ui } from '../../state/store';
import type { Branch } from '../../types/branch';
import type { Project } from '../../types/project';
import { plural } from '../../utils/dom';

export function branchFiltersActive(): boolean {
  const f = ui.branchFilters;
  return !!(f.q.trim() || f.designer || f.state);
}

export function matchesBranchFilters(p: Project, b: Branch): boolean {
  const f = ui.branchFilters;
  const q = f.q.trim().toLowerCase();
  if (q && !`${b.name} ${findUser(b.designer)?.name ?? ''}`.toLowerCase().includes(q)) return false;
  if (f.designer === 'none' && b.designer) return false;
  if (f.designer && f.designer !== 'none' && b.designer !== f.designer) return false;
  const tasks = tasksIn(p, b.id);
  switch (f.state) {
    case 'late':
      return tasks.some(isLate);
    case 'open':
      return tasks.some((t) => t.status !== 'Concluído');
    case 'done':
      return tasks.length > 0 && tasks.every((t) => t.status === 'Concluído');
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
  return `<div class="fbar">${filterSearch('branches.q', 'Filtrar ramificações ou projetista', f.q)}<div class="fchips">${filterSelect(
    'branches.designer',
    'Projetista',
    [['none', 'Sem projetista'] as const, ...db.users.map((u) => [u.id, u.name] as const)],
    f.designer,
    'Todos',
  )}${filterSelect(
    'branches.state',
    'Situação',
    [
      ['late', 'Com atraso'],
      ['open', 'Com pendências'],
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
