/** Perfis de acesso, guardados em `rb-access-v1` e editáveis pela interface. */
import {
  MODULE_KEYS,
  PERMISSION_MODULES,
  ROLES,
  type AccessData,
  type PermissionAction,
  type PermissionModule,
  type PermissionSet,
  type Profile,
  type Role,
} from '../types/access';
import { uid } from '../utils/ids';
import { db } from './db';
import { authorize } from './permissionService';
import { STORAGE_KEYS, readJSON, writeJSON } from './storage';

export const ADMIN_PROFILE_ID = 'perfil-admin';
const COORDINATOR_ID = 'perfil-gerente';
const RESPONSIBLE_ID = 'perfil-colaborador';
const VIEWER_ID = 'perfil-visualizador';
/** Perfil dado a quem é adicionado rapidamente (ex.: "Novo usuário" no formulário do projeto). */
export const DEFAULT_PROFILE_ID = RESPONSIBLE_ID;

const all = (m: PermissionModule): PermissionAction[] => [...PERMISSION_MODULES[m].actions];
const fullOf = (modules: PermissionModule[]): PermissionSet => Object.fromEntries(modules.map((m) => [m, all(m)]));

export function fullPermissions(): PermissionSet {
  return fullOf(MODULE_KEYS);
}

const WORK: PermissionModule[] = ['projects', 'structure', 'tasks'];

/** Permissões iniciais de cada função (a matriz pode ser ajustada depois). */
function defaultPermissions(role: Role): PermissionSet {
  switch (role) {
    case 'admin':
      return fullPermissions();
    case 'coordinator':
      return { ...fullOf([...WORK, 'trash', 'collaborators', 'users']), settings: ['view'] };
    case 'responsible':
      return { projects: ['view'], structure: all('structure'), tasks: all('tasks') };
    case 'viewer':
      return Object.fromEntries(WORK.map((m) => [m, ['view']]));
  }
}

function defaultProfiles(): Profile[] {
  return [
    { id: ADMIN_PROFILE_ID, name: 'Administrador', description: 'Acesso completo ao sistema.', role: 'admin', admin: true, permissions: defaultPermissions('admin') },
    {
      id: COORDINATOR_ID,
      name: 'Coordenador',
      description: 'Amplo acesso operacional: projetos, etapas, tarefas, usuários e lixeira.',
      role: 'coordinator',
      admin: false,
      permissions: defaultPermissions('coordinator'),
    },
    {
      id: RESPONSIBLE_ID,
      name: 'Responsável',
      description: 'Trabalha nas etapas, tarefas e subtarefas dos projetos.',
      role: 'responsible',
      admin: false,
      permissions: defaultPermissions('responsible'),
    },
    { id: VIEWER_ID, name: 'Visualizador', description: 'Somente visualização.', role: 'viewer', admin: false, permissions: defaultPermissions('viewer') },
  ];
}

export const access: AccessData = { version: 1, profiles: [], projectRoles: {} };

/** Mantém só ações válidas para cada módulo e garante "visualizar" quando há outra ação. */
export function normalizePermissions(raw: unknown): PermissionSet {
  const set: PermissionSet = {};
  if (typeof raw !== 'object' || raw === null) return set;
  for (const m of MODULE_KEYS) {
    const record = raw as Record<string, unknown>;
    // O módulo "Contratantes" se chamava "prefeituras".
    const value = record[m] ?? (m === 'contratantes' ? record.prefeituras : undefined);
    if (!Array.isArray(value)) continue;
    const allowed = PERMISSION_MODULES[m].actions as readonly PermissionAction[];
    const actions = allowed.filter((a) => value.includes(a));
    if (actions.length && !actions.includes('view')) actions.unshift('view');
    if (actions.length) set[m] = actions;
  }
  return set;
}

/** Perfis salvos antes das funções: nomes e permissões padrão viram as funções novas. */
const LEGACY_NAMES: Record<string, { from: string; to: string; role: Role }> = {
  [COORDINATOR_ID]: { from: 'Gerente', to: 'Coordenador', role: 'coordinator' },
  [RESPONSIBLE_ID]: { from: 'Colaborador', to: 'Responsável', role: 'responsible' },
  [VIEWER_ID]: { from: 'Visualizador', to: 'Visualizador', role: 'viewer' },
};

/** Função de um perfil antigo: pelos ids padrão; perfis criados pelo usuário, pelo que a matriz permite. */
function inferRole(id: string, raw: Record<string, unknown>, permissions: PermissionSet): Role {
  if (raw.admin === true) return 'admin';
  const legacy = LEGACY_NAMES[id];
  if (legacy) return legacy.role;
  const works = WORK.some((m) => permissions[m]?.some((a) => a !== 'view'));
  return works ? 'responsible' : 'viewer';
}

function migrateProfile(raw: Record<string, unknown>): Profile {
  const id = raw.id as string;
  const stored = normalizePermissions(raw.permissions);
  const hasRole = ROLES.includes(raw.role as Role);
  const role = hasRole ? (raw.role as Role) : inferRole(id, raw, stored);
  let name = raw.name as string;
  let permissions = stored;
  if (!hasRole) {
    const legacy = LEGACY_NAMES[id];
    if (legacy && name === legacy.from) name = legacy.to;
    // As novas regras dão ao Coordenador usuários e lixeira; ao Responsável, criar e editar no trabalho.
    if (role === 'coordinator' || role === 'responsible') permissions = normalizePermissions({ ...stored, ...defaultPermissions(role) });
  }
  return {
    id,
    name,
    description: typeof raw.description === 'string' ? raw.description : '',
    role,
    admin: role === 'admin',
    permissions: role === 'admin' ? fullPermissions() : permissions,
  };
}

export function loadAccess(): void {
  const raw = readJSON(STORAGE_KEYS.access) as Partial<AccessData> | undefined;
  const stored = Array.isArray(raw?.profiles) ? (raw.profiles as unknown[]) : [];
  const valid = stored.filter((p): p is Record<string, unknown> => typeof p === 'object' && p !== null && typeof (p as Profile).id === 'string' && typeof (p as Profile).name === 'string');
  const profiles = valid.map(migrateProfile);
  if (!profiles.length) profiles.push(...defaultProfiles());
  // Sempre existe um perfil administrador.
  if (!profiles.some((p) => p.admin)) profiles.unshift(defaultProfiles()[0]!);
  access.profiles = profiles;
  access.projectRoles = typeof raw?.projectRoles === 'object' && raw.projectRoles !== null ? raw.projectRoles : {};
  if (JSON.stringify(raw?.profiles) !== JSON.stringify(profiles)) persistAccess();
}

export function persistAccess(): void {
  writeJSON(STORAGE_KEYS.access, access);
}

export function findProfile(id: string | undefined): Profile | undefined {
  return id ? access.profiles.find((p) => p.id === id) : undefined;
}

export function adminProfileId(): string {
  return access.profiles.find((p) => p.admin)?.id ?? ADMIN_PROFILE_ID;
}

/** Perfil padrão de cada função, usado para converter usuários antigos. */
export function profileForRole(role: Role): string {
  return access.profiles.find((p) => p.role === role)?.id ?? adminProfileId();
}

export function usersWithProfile(profileId: string): number {
  return db.users.filter((u) => u.profileId === profileId).length;
}

export interface ProfileDraft {
  name: string;
  description: string;
  role: Role;
  permissions: PermissionSet;
}

export function createProfile(draft: ProfileDraft): Profile {
  authorize('profiles', 'create');
  // O perfil Administrador é único; perfis novos escolhem entre as outras funções.
  const role = draft.role === 'admin' ? 'viewer' : draft.role;
  const profile: Profile = { id: uid('perfil-'), name: draft.name, description: draft.description, role, admin: false, permissions: normalizePermissions(draft.permissions) };
  access.profiles.push(profile);
  persistAccess();
  return profile;
}

export function updateProfile(profile: Profile, draft: ProfileDraft): void {
  authorize('profiles', 'edit');
  profile.name = draft.name;
  profile.description = draft.description;
  // A função do Administrador não muda, e nenhum outro perfil vira Administrador.
  if (!profile.admin && draft.role !== 'admin') profile.role = draft.role;
  // As permissões do administrador são sempre completas.
  profile.permissions = profile.admin ? fullPermissions() : normalizePermissions(draft.permissions);
  persistAccess();
}

export type ProfileDeleteBlock = 'admin' | 'in-use' | null;

export function profileDeleteBlock(profile: Profile): ProfileDeleteBlock {
  if (profile.admin) return 'admin';
  if (usersWithProfile(profile.id)) return 'in-use';
  return null;
}

export function deleteProfile(profile: Profile): void {
  authorize('profiles', 'delete');
  if (profileDeleteBlock(profile)) throw new Error('Este perfil não pode ser excluído.');
  access.profiles = access.profiles.filter((p) => p !== profile);
  for (const roles of Object.values(access.projectRoles)) {
    for (const [userId, profileId] of Object.entries(roles)) if (profileId === profile.id) delete roles[userId];
  }
  persistAccess();
}
