/**
 * Controle de acesso: Usuário → Perfil → Permissões → Módulos/Ações.
 * Cada módulo só aceita as ações que fazem sentido para ele.
 */
export const PERMISSION_ACTIONS = ['view', 'create', 'edit', 'delete'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'Visualizar',
  create: 'Criar',
  edit: 'Editar',
  delete: 'Excluir',
};

export const PERMISSION_MODULES = {
  projects: { label: 'Projetos', actions: ['view', 'create', 'edit', 'delete'], hint: 'Excluir = arquivar e desarquivar projetos; Editar inclui marcos.' },
  kanban: { label: 'Kanban / Etapas', actions: ['view', 'edit'], hint: 'Editar = mover cartões entre colunas (etapas e projetos).' },
  tasks: { label: 'Tarefas', actions: ['view', 'create', 'edit', 'delete'], hint: 'Editar inclui checklist, comentários e anexos.' },
  structure: { label: 'Etapas e Estrutura', actions: ['view', 'create', 'edit', 'delete'], hint: 'Criar, editar e excluir etapas; Visualizar libera o Mapa e os Cartões na aba Etapas.' },
  map: { label: 'Mapa', actions: ['view', 'edit'], hint: 'Editar = mover cartões no mapa.' },
  collaborators: { label: 'Colaboradores', actions: ['view'], hint: 'Acompanhamento administrativo das atividades de cada colaborador.' },
  users: { label: 'Usuários', actions: ['view', 'create', 'edit', 'delete'], hint: 'Editar inclui ativar e desativar.' },
  contratantes: { label: 'Contratantes', actions: ['view', 'create', 'edit', 'delete'], hint: 'Cadastro das contratantes escolhidas nos projetos.' },
  profiles: { label: 'Perfis', actions: ['view', 'create', 'edit', 'delete'], hint: 'Inclui alterar permissões.' },
  settings: { label: 'Configurações', actions: ['view'], hint: 'Acesso à área de Configurações.' },
} as const satisfies Record<string, { label: string; actions: readonly PermissionAction[]; hint: string }>;

export type PermissionModule = keyof typeof PERMISSION_MODULES;
export const MODULE_KEYS = Object.keys(PERMISSION_MODULES) as PermissionModule[];

/** Ações liberadas por módulo. Módulos ausentes = sem acesso. */
export type PermissionSet = Partial<Record<PermissionModule, PermissionAction[]>>;

export interface Profile {
  id: string;
  name: string;
  description: string;
  /** Administrador: acesso total, permissões travadas e não pode ser excluído. */
  admin: boolean;
  permissions: PermissionSet;
}

export interface AccessData {
  version: 1;
  profiles: Profile[];
  /**
   * Reservado para permissões por projeto (projectId → userId → profileId).
   * Quando houver, o perfil do projeto substitui o perfil geral do usuário naquele projeto.
   */
  projectRoles: Record<string, Record<string, string>>;
}
