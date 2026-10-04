import type { Dependency } from './dependency';

export const TASK_STATUSES = ['A fazer', 'Em andamento', 'Em revisão', 'Concluído'] as const;
/** Único status permitido enquanto a tarefa está bloqueada por dependências. */
export const TASK_NOT_STARTED = 'A fazer';
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ['Alta', 'Média', 'Baixa'] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskComment {
  id: string;
  who: string;
  text: string;
  at: string;
}

export interface TaskLink {
  id: string;
  url: string;
  label: string;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string;
  due: string;
  /** Id da etapa; string vazia quando a tarefa não pertence a nenhuma. */
  branch: string;
  description: string;
  tags: string;
  /** O que precisa acontecer antes de a tarefa poder ser iniciada. */
  dependencies: Dependency[];
  subtasks: Subtask[];
  comments: TaskComment[];
  links: TaskLink[];
}

export type TaskDraft = Pick<Task, 'title' | 'status' | 'priority' | 'assignee' | 'due' | 'branch' | 'description' | 'dependencies' | 'subtasks'>;
