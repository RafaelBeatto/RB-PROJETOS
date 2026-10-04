/**
 * Dependências entre projetos, ramificações e tarefas.
 * Um item (projeto, ramificação ou tarefa) pode depender de qualquer outro item,
 * inclusive de outro projeto, com uma condição a cumprir.
 */
export const DEP_KINDS = ['project', 'branch', 'task'] as const;
export type DepKind = (typeof DEP_KINDS)[number];

export const DEP_CONDITIONS = ['done', 'started'] as const;
export type DepCondition = (typeof DEP_CONDITIONS)[number];

export const CONDITION_LABELS: Record<DepCondition, string> = {
  done: 'Concluído',
  started: 'Iniciado',
};

export const KIND_LABELS: Record<DepKind, string> = {
  project: 'Projeto',
  branch: 'Ramificação',
  task: 'Tarefa',
};

/** Referência a um item. Para projetos, `id` é o próprio `projectId`. */
export interface ItemRef {
  kind: DepKind;
  projectId: string;
  id: string;
}

export interface Dependency {
  id: string;
  kind: DepKind;
  projectId: string;
  /** Id do item exigido (para projetos, igual a projectId). */
  targetId: string;
  condition: DepCondition;
}
