/**
 * Camada central de autorização.
 *
 * Importante: no GitHub Pages tudo roda no navegador, então isto é controle de acesso
 * da interface e da lógica do frontend, não segurança de servidor. Quem tiver acesso
 * técnico ao navegador consegue alterar os dados locais. Quando houver API, as mesmas
 * regras (módulo + ação) devem ser verificadas também no servidor.
 */
import type { PermissionAction, PermissionModule, Profile } from '../types/access';
import type { User } from '../types/user';
import { currentUser } from './authService';
import { access, findProfile } from './profileService';

export class PermissionDeniedError extends Error {
  constructor(
    readonly module: PermissionModule,
    readonly action: PermissionAction,
  ) {
    super('Você não possui permissão para esta ação.');
    this.name = 'PermissionDeniedError';
  }
}

/** Perfil efetivo do usuário; num projeto, um perfil específico (se definido) tem prioridade. */
export function effectiveProfile(user: User, projectId?: string): Profile | undefined {
  const projectProfile = projectId ? access.projectRoles[projectId]?.[user.id] : undefined;
  return findProfile(projectProfile) ?? findProfile(user.profileId);
}

export function hasPermission(user: User | undefined, module: PermissionModule, action: PermissionAction, projectId?: string): boolean {
  if (!user?.active) return false;
  const profile = effectiveProfile(user, projectId);
  if (!profile) return false;
  if (profile.admin) return true;
  return profile.permissions[module]?.includes(action) ?? false;
}

/** Atalho para o usuário logado. */
export function can(module: PermissionModule, action: PermissionAction = 'view', projectId?: string): boolean {
  return hasPermission(currentUser(), module, action, projectId);
}

/** Interrompe a operação se o usuário logado não tiver a permissão. */
export function authorize(module: PermissionModule, action: PermissionAction, projectId?: string): void {
  if (!can(module, action, projectId)) throw new PermissionDeniedError(module, action);
}

export function isAdmin(user: User | undefined): boolean {
  return !!user && findProfile(user.profileId)?.admin === true;
}
