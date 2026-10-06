import type { Activity } from './activity';
import type { Branch } from './branch';
import type { ChatMessage } from './chat';
import type { OptionalPriority, Task } from './task';

/**
 * Status do projeto (formulário e colunas do Kanban, nesta ordem).
 * Encerrar um projeto = arquivar (ver toggleArchived). Atraso não é status: vem da data de término.
 */
export const PROJECT_STATUSES = ['Em espera', 'Em pausa', 'Em andamento', 'Em análise'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
/** Iniciar a execução (ir para "Em andamento") exige pelo menos uma etapa. */
export const PROJECT_RUNNING: ProjectStatus = 'Em andamento';

export const MILESTONE_STATUSES = ['Pendente', 'Concluído'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export interface Milestone {
  id: string;
  name: string;
  due: string;
  status: MilestoneStatus;
}

export interface Agreement {
  processo: string;
  convOrgao: string;
  convNumero: string;
  convValor: string;
  convContra: string;
  convPolitico: string;
}

export interface Project extends Agreement {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: OptionalPriority;
  start: string;
  /** Data de término (o campo se chama due por compatibilidade). */
  due: string;
  /** Campo antigo "Responsável": substituído pelos coordenadores; mantido por compatibilidade. */
  owner: string;
  /** Projeto encerrado. */
  archived: boolean;
  coordinators: string[];
  /** Contratante cadastrada pelo administrador (vazio = nenhuma). */
  contratanteId: string;
  branches: Branch[];
  tasks: Task[];
  milestones: Milestone[];
  activity: Activity[];
  /** Chat do projeto, da mensagem mais antiga para a mais nova. */
  chat: ChatMessage[];
}

export type ProjectDraft = Pick<Project, 'name' | 'status' | 'priority' | 'start' | 'due' | 'description' | 'coordinators' | 'contratanteId'> & Agreement;
