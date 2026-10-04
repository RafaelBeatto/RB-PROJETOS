import { refreshPage, resetFilterBar } from '../../app/navigation';
import { clearButton, filterSearch, filterSelect, filterToggle, registerFilterGroup } from '../../components/filterBar';
import { db } from '../../services/db';
import { contratanteCidade, contratanteCidades, contratanteName, sortedContratantes } from '../../services/contratanteService';
import { agreementName, isProjectOverdue, lateTaskCount, projectProgress } from '../../services/projectService';
import { emptyProjectFilters, ui } from '../../state/store';
import { PROJECT_STATUSES, type Project } from '../../types/project';

export function projectFiltersActive(): boolean {
  const f = ui.projectFilters;
  return !!(f.q || f.status || f.coordinator || f.contratante || f.cidade || f.late || f.overdue);
}

export function matchesProjectFilters(p: Project): boolean {
  const f = ui.projectFilters;
  const q = f.q.trim().toLowerCase();
  if (q && ![p.name, p.description, p.processo, p.owner, agreementName(p), p.convPolitico, contratanteName(p), contratanteCidade(p)].join(' ').toLowerCase().includes(q)) return false;
  if (f.status && p.status !== f.status) return false;
  if (f.coordinator && !p.coordinators.includes(f.coordinator)) return false;
  if (f.contratante && p.contratanteId !== f.contratante) return false;
  if (f.cidade && contratanteCidade(p).trim().toLowerCase() !== f.cidade.toLowerCase()) return false;
  if (f.late && !lateTaskCount(p)) return false;
  if (f.overdue && !isProjectOverdue(p)) return false;
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
  return `<div class="fbar">${filterSearch('projects.q', 'Buscar projeto, processo, convênio, contratante ou cidade', f.q)}<div class="fchips">${filterSelect(
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
  )}${filterSelect(
    'projects.contratante',
    'Contratante',
    sortedContratantes().map((x) => [x.id, x.name] as const),
    f.contratante,
    'Todas',
  )}${filterSelect(
    'projects.cidade',
    'Cidade',
    contratanteCidades().map((c) => [c, c] as const),
    f.cidade,
    'Todas',
  )}${filterToggle('projects.overdue', 'Prazo vencido', f.overdue)}${filterToggle('projects.late', 'Tarefas atrasadas', f.late)}${filterSelect(
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
