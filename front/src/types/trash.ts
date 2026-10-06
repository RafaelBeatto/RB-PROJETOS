import type { Branch } from './branch';
import type { Project } from './project';
import type { Subtask, Task } from './task';

export const TRASH_KINDS = ['project', 'branch', 'task', 'subtask'] as const;
export type TrashKind = (typeof TRASH_KINDS)[number];

export const TRASH_LABELS: Record<TrashKind, string> = {
  project: 'Projeto',
  branch: 'Etapa',
  task: 'Tarefa',
  subtask: 'Subtarefa',
};

interface TrashBase {
  /** Id da entrada na lixeira. */
  id: string;
  deletedAt: string;
  deletedBy: string;
  /** Projeto de origem (para projetos, o próprio). */
  projectId: string;
  /** Nome do projeto no momento da exclusão, para exibir mesmo se ele não existir mais. */
  projectName: string;
  /** Posição original na lista (ordem de criação), para restaurar no mesmo lugar. */
  index: number;
}

/**
 * Cada entrada guarda o item com tudo o que estava dentro dele no momento da exclusão:
 * projeto com etapas, tarefas e subtarefas; etapa com as tarefas dela; tarefa com as subtarefas.
 */
export type TrashEntry = TrashBase &
  (
    | { kind: 'project'; project: Project }
    /** Cada tarefa guarda também a posição original dela na lista de tarefas do projeto. */
    | { kind: 'branch'; branch: Branch; tasks: (Task & { index?: number })[] }
    | { kind: 'task'; task: Task }
    | { kind: 'subtask'; taskId: string; taskTitle: string; subtask: Subtask }
  );
