import type { Activity } from './activity';
import type { Branch, Point } from './branch';
import type { Dependency } from './dependency';
import type { Task } from './task';

/**
 * Status do projeto (formulário e colunas do Kanban, nesta ordem).
 * Atraso não é status: é calculado pelo prazo (ver isProjectOverdue).
 */
export const PROJECT_STATUSES = ['Em espera', 'Em andamento', 'Em pausa', 'Concluído'] as const;
export const PROJECT_BOARD_COLUMNS = PROJECT_STATUSES;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
/** Status que contam como "projeto iniciado"; exigem as dependências do projeto atendidas. */
export const PROJECT_STARTED_STATUSES: readonly ProjectStatus[] = ['Em andamento', 'Concluído'];

export const MILESTONE_STATUSES = ['Pendente', 'Concluído'] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export interface Milestone {
  id: string;
  name: string;
  due: string;
  status: MilestoneStatus;
}

/** Posição e zoom do canvas do mapa. */
export interface MapView extends Point {
  z: number;
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
  /** Campo antigo: não é mais pedido no formulário; mantido para não perder dados. */
  description: string;
  status: ProjectStatus;
  /** Campo antigo "Responsável": substituído pelos coordenadores; mantido por compatibilidade. */
  owner: string;
  due: string;
  archived: boolean;
  coordinators: string[];
  /** Contratante cadastrada pelo administrador (vazio = nenhuma). */
  contratanteId: string;
  /** O que precisa acontecer antes de o projeto (e tudo dentro dele) poder avançar. */
  dependencies: Dependency[];
  branches: Branch[];
  tasks: Task[];
  milestones: Milestone[];
  activity: Activity[];
  /** Posição do cartão do projeto no mapa. */
  root?: Point;
  view?: MapView;
}

export type ProjectDraft = Pick<Project, 'name' | 'status' | 'due' | 'description' | 'coordinators' | 'contratanteId' | 'dependencies'> & Agreement;
