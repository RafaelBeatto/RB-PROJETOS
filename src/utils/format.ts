import type { ProjectStatus } from '../types/project';
import type { TaskStatus } from '../types/task';

export function currency(value: string | number | undefined): string {
  const n = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isNaN(n) ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Classe visual da etiqueta de status do projeto. */
export function projectStatusClass(status: ProjectStatus): string {
  const map: Partial<Record<ProjectStatus, string>> = {
    Concluído: 'done',
    Atrasado: 'late',
    'Em pausa': 'review',
    Planejamento: 'todo',
  };
  return map[status] ?? '';
}

export function taskStatusClass(status: TaskStatus): string {
  if (status === 'Concluído') return 'done';
  if (status === 'Em revisão') return 'review';
  return 'todo';
}

/** "Média" → "media", usado como classe CSS. */
export function priorityClass(priority: string): string {
  return priority.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function pct(part: number, total: number): number {
  return total ? Math.round((part / total) * 100) : 0;
}
