/**
 * Estado da interface (o que está aberto e quais filtros estão ativos).
 * Não é salvo: ao recarregar, a aplicação volta para a lista de projetos.
 */
export type Page = 'home' | 'archive' | 'board' | 'today' | 'history' | 'collaborators' | 'settings';
export type SettingsTab = 'users' | 'profiles' | 'contratantes';
export type ProjectTab = 'overview' | 'info' | 'kanban' | 'structure';
export type StructureMode = 'map' | 'cards';
export type QuickTaskFilter = 'all' | 'mine' | 'today' | 'late' | 'soon';

export interface ProjectFilters {
  q: string;
  coordinator: string;
  contratante: string;
  sort: '' | 'name' | 'due' | 'prog';
}

export interface BranchFilters {
  q: string;
  designer: string;
  state: '' | 'late' | 'open' | 'done' | 'empty';
}

export interface TodayFilters {
  project: string;
  person: string;
}

export interface UserFilters {
  q: string;
  role: '' | 'coord' | 'designer' | 'none';
  profile: string;
  status: '' | 'active' | 'inactive';
}

export interface CollaboratorFilters {
  q: string;
  /** Só quem tem atividade atrasada ou bloqueada. */
  attention: boolean;
  /** Inclui usuários desativados. */
  inactive: boolean;
}

export interface HistoryFilters {
  q: string;
  project: string;
  person: string;
  kind: string;
  period: '' | '1' | '7' | '30' | '90';
  limit: number;
}

export const emptyProjectFilters = (): ProjectFilters => ({ q: '', coordinator: '', contratante: '', sort: '' });
export const emptyBranchFilters = (): BranchFilters => ({ q: '', designer: '', state: '' });
export const emptyUserFilters = (): UserFilters => ({ q: '', role: '', profile: '', status: '' });
export const emptyCollaboratorFilters = (): CollaboratorFilters => ({ q: '', attention: false, inactive: false });
export const emptyHistoryFilters = (): HistoryFilters => ({ q: '', project: '', person: '', kind: '', period: '', limit: 100 });

export const ui = {
  page: 'home' as Page,
  projectId: null as string | null,
  tab: 'overview' as ProjectTab,
  structureMode: 'map' as StructureMode,
  /** Nível aberto na visão Cartões (null = raiz do projeto). */
  cardLevel: null as string | null,
  projectFilters: emptyProjectFilters(),
  branchFilters: emptyBranchFilters(),
  todayFilters: { project: '', person: '' } as TodayFilters,
  userFilters: emptyUserFilters(),
  settingsTab: 'users' as SettingsTab,
  /** Perfil aberto no editor de permissões. */
  profileId: null as string | null,
  collaboratorFilters: emptyCollaboratorFilters(),
  /** Colaborador aberto no painel individual (null = lista). */
  collaboratorId: null as string | null,
  historyFilters: { ...emptyHistoryFilters(), period: '30' } as HistoryFilters,
};
