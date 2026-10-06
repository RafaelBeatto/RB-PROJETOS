/**
 * Controle de acesso: Usuário → Perfil → (Função + Permissões) → Módulos/Ações.
 * A função define as regras de negócio (quem cria e edita o quê, por vínculo);
 * a matriz de permissões continua editável e restringe por cima: uma ação só
 * é liberada quando a função E a matriz permitem.
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
  projects: { label: 'Projetos', actions: ['view', 'create', 'edit', 'delete'], hint: 'Editar inclui status, marcos e encerrar (arquivar); Excluir envia para a lixeira.' },
  structure: { label: 'Etapas', actions: ['view', 'create', 'edit', 'delete'], hint: 'Editar inclui status, responsáveis, prioridade e datas; Excluir envia para a lixeira.' },
  tasks: { label: 'Tarefas e subtarefas', actions: ['view', 'create', 'edit', 'delete'], hint: 'Editar inclui status, dependências, checklist, comentários e anexos.' },
  trash: { label: 'Lixeira', actions: ['view', 'edit', 'delete'], hint: 'Editar = restaurar; Excluir = excluir permanentemente e esvaziar.' },
  collaborators: { label: 'Colaboradores', actions: ['view'], hint: 'Acompanhamento administrativo das atividades de cada colaborador.' },
  users: { label: 'Usuários', actions: ['view', 'create', 'edit', 'delete'], hint: 'Editar inclui ativar, desativar, trocar o perfil e os projetos do Visualizador.' },
  contratantes: { label: 'Contratantes', actions: ['view', 'create', 'edit', 'delete'], hint: 'Cadastro das contratantes escolhidas nos projetos.' },
  profiles: { label: 'Perfis', actions: ['view', 'create', 'edit', 'delete'], hint: 'Inclui alterar permissões.' },
  settings: { label: 'Configurações', actions: ['view'], hint: 'Acesso à área de Configurações.' },
} as const satisfies Record<string, { label: string; actions: readonly PermissionAction[]; hint: string }>;

export type PermissionModule = keyof typeof PERMISSION_MODULES;
export const MODULE_KEYS = Object.keys(PERMISSION_MODULES) as PermissionModule[];

/** Ações liberadas por módulo. Módulos ausentes = sem acesso. */
export type PermissionSet = Partial<Record<PermissionModule, PermissionAction[]>>;

/** As quatro funções do sistema. Cada perfil tem exatamente uma. */
export const ROLES = ['admin', 'coordinator', 'responsible', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  coordinator: 'Coordenador',
  responsible: 'Responsável',
  viewer: 'Visualizador',
};

export const ROLE_HINTS: Record<Role, string> = {
  admin: 'Acesso completo ao sistema.',
  coordinator: 'Cria e edita projetos, etapas, tarefas e subtarefas; gerencia usuários; acessa a lixeira.',
  responsible: 'Cria e edita etapas; tarefas nas etapas em que é responsável; subtarefas nas tarefas em que é responsável. Edita as próprias tarefas. Sem lixeira e sem usuários.',
  viewer: 'Somente leitura. Pode ter o acesso limitado a projetos específicos.',
};

export interface Profile {
  id: string;
  name: string;
  description: string;
  /** Função do perfil: define as regras de negócio. */
  role: Role;
  /** Administrador (role === 'admin'): acesso total, permissões travadas e não pode ser excluído. */
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
