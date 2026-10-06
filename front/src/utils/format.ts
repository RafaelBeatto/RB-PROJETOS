import type { BranchStatus } from '../types/branch';
import type { ProjectStatus } from '../types/project';
import type { TaskStatus } from '../types/task';

export function currency(value: string | number | undefined): string {
  const n = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isNaN(n) ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Classe visual da etiqueta de status do projeto. */
export function projectStatusClass(status: ProjectStatus): string {
  const map: Partial<Record<ProjectStatus, string>> = {
    'Em análise': 'review',
    'Em pausa': 'paused',
    'Em espera': 'todo',
  };
  return map[status] ?? '';
}

/** Classe da etiqueta de status de etapa, tarefa e subtarefa. */
export function taskStatusClass(status: TaskStatus | BranchStatus): string {
  if (status === 'Concluído') return 'done';
  if (status === 'Em andamento') return '';
  if (status === 'Em pausa') return 'paused';
  return 'todo';
}

/** "Média" → "media", usado como classe CSS. */
export function priorityClass(priority: string): string {
  return priority.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function pct(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0;
}
