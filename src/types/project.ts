import type { Activity } from './activity';
import type { Branch, Point } from './branch';
import type { Task } from './task';

/** Ordem usada no formulário do projeto. */
export const PROJECT_STATUSES = ['Planejamento', 'Em andamento', 'Em pausa', 'Concluído', 'Atrasado'] as const;
/** Ordem das colunas no Kanban de projetos. */
export const PROJECT_BOARD_COLUMNS = ['Planejamento', 'Em andamento', 'Em pausa', 'Atrasado', 'Concluído'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

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
  description: string;
  status: ProjectStatus;
  owner: string;
  due: string;
  archived: boolean;
  coordinators: string[];
  /** Prefeitura cadastrada pelo administrador (vazio = nenhuma). */
  prefeituraId: string;
  branches: Branch[];
  tasks: Task[];
  milestones: Milestone[];
  activity: Activity[];
  /** Posição do cartão do projeto no mapa. */
  root?: Point;
  view?: MapView;
}

export type ProjectDraft = Pick<Project, 'name' | 'owner' | 'status' | 'due' | 'description' | 'coordinators' | 'prefeituraId'> & Agreement;
