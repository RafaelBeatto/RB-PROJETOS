import type { OptionalPriority } from './task';

/** Status da etapa (colunas do Kanban de etapas, nesta ordem). */
export const BRANCH_STATUSES = ['Em espera', 'Em pausa', 'Em andamento', 'Concluído'] as const;
export type BranchStatus = (typeof BRANCH_STATUSES)[number];

/** Etapa do projeto (no código, "branch" por compatibilidade com os dados salvos). */
export interface Branch {
  id: string;
  name: string;
  description: string;
  priority: OptionalPriority;
  start: string;
  due: string;
  status: BranchStatus;
  /** Responsáveis (ids de usuários), no máximo MAX_RESPONSIBLES. */
  assignees: string[];
  /** Ids de etapas ou tarefas (do mesmo projeto) das quais esta etapa depende. Informativo. */
  dependencies: string[];
}

export type BranchDraft = Omit<Branch, 'id'>;
