export const ACTIVITY_KINDS = {
  status: 'Status de tarefa',
  task: 'Tarefas',
  checklist: 'Checklist',
  comment: 'Comentários',
  branch: 'Ramificações',
  milestone: 'Marcos',
  project: 'Projetos',
} as const;

export type ActivityKind = keyof typeof ACTIVITY_KINDS;

export interface Activity {
  id: string;
  /** Data e hora ISO. */
  at: string;
  /** Frase completa, já com o autor no início. */
  text: string;
  who?: string;
  kind?: ActivityKind;
  task?: string;
  branch?: string;
}
