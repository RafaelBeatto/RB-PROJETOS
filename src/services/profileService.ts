/** Perfis de acesso, guardados em `rb-access-v1` e editáveis pela interface. */
import { MODULE_KEYS, PERMISSION_MODULES, type AccessData, type PermissionAction, type PermissionModule, type PermissionSet, type Profile } from '../types/access';
import { uid } from '../utils/ids';
import { db } from './db';
import { authorize } from './permissionService';
import { STORAGE_KEYS, readJSON, writeJSON } from './storage';

export const ADMIN_PROFILE_ID = 'perfil-admin';
const MANAGER_ID = 'perfil-gerente';
const COLLABORATOR_ID = 'perfil-colaborador';
const VIEWER_ID = 'perfil-visualizador';
/** Perfil dado a quem é adicionado rapidamente (ex.: "Novo usuário" no formulário do projeto). */
export const DEFAULT_PROFILE_ID = COLLABORATOR_ID;

const all = (m: PermissionModule): PermissionAction[] => [...PERMISSION_MODULES[m].actions];

export function fullPermissions(): PermissionSet {
  return Object.fromEntries(MODULE_KEYS.map((m) => [m, all(m)])) as PermissionSet;
}

function defaultProfiles(): Profile[] {
  const work: PermissionModule[] = ['projects', 'kanban', 'tasks', 'structure', 'map', 'list', 'timeline'];
  return [
    { id: ADMIN_PROFILE_ID, name: 'Administrador', description: 'Acesso completo, incluindo usuários e perfis.', admin: true, permissions: fullPermissions() },
    {
      id: MANAGER_ID,
      name: 'Gerente',
      description: 'Acesso amplo a projetos e tarefas, sem gerenciar usuários e configurações.',
      admin: false,
      permissions: Object.fromEntries(work.map((m) => [m, all(m)])),
    },
    {
      id: COLLABORATOR_ID,
      name: 'Colaborador',
      description: 'Trabalha nas tarefas e na estrutura dos projetos.',
      admin: false,
      permissions: {
        projects: ['view'],
        kanban: ['view', 'edit'],
        tasks: ['view', 'create', 'edit'],
        structure: ['view', 'create', 'edit'],
        map: ['view', 'edit'],
        list: ['view'],
        timeline: ['view'],
      },
    },
    {
      id: VIEWER_ID,
      name: 'Visualizador',
      description: 'Somente visualização.',
      admin: false,
      permissions: Object.fromEntries(work.map((m) => [m, ['view']])),
    },
  ];
}

export const access: AccessData = { version: 1, profiles: [], projectRoles: {} };

/** Mantém só ações válidas para cada módulo e garante "visualizar" quando há outra ação. */
export function normalizePermissions(raw: unknown): PermissionSet {
  const set: PermissionSet = {};
  if (typeof raw !== 'object' || raw === null) return set;
  for (const m of MODULE_KEYS) {
    const value = (raw as Record<string, unknown>)[m];
    if (!Array.isArray(value)) continue;
    const allowed = PERMISSION_MODULES[m].actions as readonly PermissionAction[];
    const actions = allowed.filter((a) => value.includes(a));
    if (actions.length && !actions.includes('view')) actions.unshift('view');
    if (actions.length) set[m] = actions;
  }
  return set;
}

export function loadAccess(): void {
  const raw = readJSON(STORAGE_KEYS.access) as Partial<AccessData> | undefined;
  const stored = Array.isArray(raw?.profiles) ? raw.profiles : [];
  const profiles: Profile[] = stored
    .filter((p): p is Profile => typeof p === 'object' && p !== null && typeof p.id === 'string' && typeof p.name === 'string')
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: typeof p.description === 'string' ? p.description : '',
      admin: p.admin === true,
      permissions: p.admin === true ? fullPermissions() : normalizePermissions(p.permissions),
    }));
  if (!profiles.length) profiles.push(...defaultProfiles());
  // Sempre existe um perfil administrador.
  if (!profiles.some((p) => p.admin)) profiles.unshift(defaultProfiles()[0]!);
  access.profiles = profiles;
  access.projectRoles = typeof raw?.projectRoles === 'object' && raw.projectRoles !== null ? raw.projectRoles : {};
  if (!raw || stored.length !== profiles.length) persistAccess();
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

export function usersWithProfile(profileId: string): number {
  return db.users.filter((u) => u.profileId === profileId).length;
}

export interface ProfileDraft {
  name: string;
  description: string;
  permissions: PermissionSet;
}

export function createProfile(draft: ProfileDraft): Profile {
  authorize('profiles', 'create');
  const profile: Profile = { id: uid('perfil-'), name: draft.name, description: draft.description, admin: false, permissions: normalizePermissions(draft.permissions) };
  access.profiles.push(profile);
  persistAccess();
  return profile;
}

export function updateProfile(profile: Profile, draft: ProfileDraft): void {
  authorize('profiles', 'edit');
  profile.name = draft.name;
  profile.description = draft.description;
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
