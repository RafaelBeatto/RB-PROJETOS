import { refreshPage, resetFilterBar } from '../../app/navigation';
import { clearButton, filterSearch, filterSelect, filterToggle, registerFilterGroup } from '../../components/filterBar';
import { db } from '../../services/db';
import { agreementName, lateTaskCount, projectProgress } from '../../services/projectService';
import { emptyProjectFilters, ui } from '../../state/store';
import { PROJECT_STATUSES, type Project } from '../../types/project';

export function projectFiltersActive(): boolean {
  const f = ui.projectFilters;
  return !!(f.q || f.status || f.coordinator || f.late);
}

export function matchesProjectFilters(p: Project): boolean {
  const f = ui.projectFilters;
  const q = f.q.trim().toLowerCase();
  if (q && ![p.name, p.description, p.processo, p.owner, agreementName(p), p.convPolitico].join(' ').toLowerCase().includes(q)) return false;
  if (f.status && p.status !== f.status) return false;
  if (f.coordinator && !p.coordinators.includes(f.coordinator)) return false;
  if (f.late && !lateTaskCount(p)) return false;
  return true;
}

export function sortProjects(list: Project[]): Project[] {
  switch (ui.projectFilters.sort) {
    case 'name':
      return list.sort((a, b) => a.name.localeCompare(b.name));
    case 'due':
      return list.sort((a, b) => ((a.due || '9') > (b.due || '9') ? 1 : -1));
    case 'prog':
      return list.sort((a, b) => projectProgress(b).pct - projectProgress(a).pct);
    default:
      return list;
  }
}

export function projectFilterBar(): string {
  const f = ui.projectFilters;
  return `<div class="fbar">${filterSearch('projects.q', 'Buscar projeto, processo ou convênio', f.q)}<div class="fchips">${filterSelect(
    'projects.status',
    'Status',
    PROJECT_STATUSES.map((s) => [s, s] as const),
    f.status,
    'Todos',
  )}${filterSelect(
    'projects.coordinator',
    'Coordenador',
    db.users.map((u) => [u.id, u.name] as const),
    f.coordinator,
    'Todos',
  )}${filterToggle('projects.late', 'Com atraso', f.late)}${filterSelect(
    'projects.sort',
    'Ordenar',
    [
      ['name', 'Nome'],
      ['due', 'Prazo'],
      ['prog', 'Progresso'],
    ],
    f.sort,
    'Recentes',
  )}${clearButton('projects')}</div></div>`;
}

export function initProjectFilters(): void {
  registerFilterGroup('projects', {
    get: () => ui.projectFilters,
    reset: () => {
      ui.projectFilters = emptyProjectFilters();
      resetFilterBar();
    },
    render: refreshPage,
  });
}
