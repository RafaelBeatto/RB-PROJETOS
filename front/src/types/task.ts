/** Status de tarefas e subtarefas (colunas do Kanban de tarefas, nesta ordem). */
export const TASK_STATUSES = ['A fazer', 'Em andamento', 'Concluído'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Prioridade é opcional em todos os níveis: string vazia = sem prioridade. Só organiza e filtra. */
export const PRIORITIES = ['Baixa', 'Média', 'Alta', 'Urgente'] as const;
export type Priority = (typeof PRIORITIES)[number];
export type OptionalPriority = Priority | '';

/** Tarefa e etapa aceitam no máximo dois responsáveis. */
export const MAX_RESPONSIBLES = 2;

/** Quem concluiu e quando (preenchido ao concluir, apagado ao reabrir). */
export interface Completion {
  doneBy?: string;
  /** Nome no momento da conclusão, para exibir mesmo se o usuário for excluído. */
  doneByName?: string;
  doneAt?: string;
}

/** Item do checklist: só texto e marcado/desmarcado. */
export interface ChecklistItem extends Completion {
  id: string;
  text: string;
  done: boolean;
}

/** Subtarefa: não tem responsável próprio; herda os responsáveis da tarefa. */
export interface Subtask extends Completion {
  id: string;
  title: string;
  description: string;
  priority: OptionalPriority;
  start: string;
  due: string;
  status: TaskStatus;
}

export interface TaskComment {
  id: string;
  who: string;
  text: string;
  at: string;
}

export interface Task extends Completion {
  id: string;
  title: string;
  status: TaskStatus;
  priority: OptionalPriority;
  /** Responsáveis (ids de usuários cadastrados), no máximo MAX_RESPONSIBLES. */
  assignees: string[];
  /** Nome antigo digitado à mão que não corresponde a nenhum usuário; só exibição. */
  assignee: string;
  start: string;
  due: string;
  /** Id da etapa. */
  branch: string;
  description: string;
  tags: string;
  /** Ids de etapas ou tarefas (do mesmo projeto) das quais esta depende. Informativo: não bloqueia nada. */
  dependencies: string[];
  checklist: ChecklistItem[];
  subtasks: Subtask[];
  comments: TaskComment[];
}

export type TaskDraft = Pick<Task, 'title' | 'status' | 'priority' | 'assignees' | 'assignee' | 'start' | 'due' | 'branch' | 'description' | 'dependencies'>;
export type SubtaskDraft = Omit<Subtask, 'id'>;
