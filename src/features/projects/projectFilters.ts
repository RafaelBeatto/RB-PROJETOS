import { refreshPage, resetFilterBar } from '../../app/navigation';
import { clearButton, filterSearch, filterSelect, registerFilterGroup } from '../../components/filterBar';
import { db } from '../../services/db';
import { contratanteCidade, contratanteName, sortedContratantes } from '../../services/contratanteService';
import { agreementName, projectProgress } from '../../services/projectService';
import { emptyProjectFilters, ui } from '../../state/store';
import type { Project } from '../../types/project';
import { PRIORITIES } from '../../types/task';

export function projectFiltersActive(): boolean {
  const f = ui.projectFilters;
  return !!(f.q.trim() || f.coordinator || f.priority || f.contratante || f.sort);
}

export function matchesProjectFilters(p: Project): boolean {
  const f = ui.projectFilters;
  const q = f.q.trim().toLowerCase();
  if (q && ![p.name, p.description, p.processo, agreementName(p), p.convPolitico, contratanteName(p), contratanteCidade(p)].join(' ').toLowerCase().includes(q)) return false;
  if (f.coordinator === 'none' && p.coordinators.length) return false;
  if (f.coordinator && f.coordinator !== 'none' && !p.coordinators.includes(f.coordinator)) return false;
  if (f.priority && p.priority !== (f.priority === 'none' ? '' : f.priority)) return false;
  if (f.contratante && p.contratanteId !== f.contratante) return false;
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
  return `<div class="fbar">${filterSearch('projects.q', 'Buscar projeto, processo, convênio ou contratante', f.q)}<div class="fchips">${filterSelect(
    'projects.coordinator',
    'Coordenador',
    [['none', 'Sem coordenador'] as const, ...db.users.map((u) => [u.id, u.name] as const)],
    f.coordinator,
    'Todos',
  )}${filterSelect(
    'projects.priority',
    'Prioridade',
    [...PRIORITIES.map((x) => [x, x] as const), ['none', 'Sem prioridade'] as const],
    f.priority,
    'Todas',
  )}${filterSelect(
    'projects.contratante',
    'Contratante',
    sortedContratantes().map((x) => [x.id, x.name] as const),
    f.contratante,
    'Todas',
  )}${filterSelect(
    'projects.sort',
    'Ordenar',
    [
      ['name', 'Nome'],
      ['due', 'Prazo'],
      ['prog', 'Progresso'],
    ],
    f.sort,
    'Criação',
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
