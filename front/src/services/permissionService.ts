/**
 * Camada central de autorização.
 *
 * Duas camadas, as duas precisam liberar:
 * 1. A matriz do perfil (módulo + ação), editável em Configurações.
 * 2. As regras da função do perfil (Administrador, Coordenador, Responsável, Visualizador),
 *    que dependem do vínculo da pessoa com o item (ex.: responsável pela etapa).
 *
 * Importante: no GitHub Pages tudo roda no navegador, então isto é controle de acesso
 * da interface e da lógica do frontend, não segurança de servidor. Quem tiver acesso
 * técnico ao navegador consegue alterar os dados locais. Quando houver API, as mesmas
 * regras devem ser verificadas também no servidor.
 */
import type { PermissionAction, PermissionModule, Profile, Role } from '../types/access';
import type { Project } from '../types/project';
import type { Task } from '../types/task';
import type { Branch } from '../types/branch';
import type { User } from '../types/user';
import { currentUser } from './authService';
import { db } from './db';
import { access, findProfile } from './profileService';

export class PermissionDeniedError extends Error {
  constructor(message = 'Você não possui permissão para esta ação.') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

/** Perfil efetivo do usuário; num projeto, um perfil específico (se definido) tem prioridade. */
export function effectiveProfile(user: User, projectId?: string): Profile | undefined {
  const projectProfile = projectId ? access.projectRoles[projectId]?.[user.id] : undefined;
  return findProfile(projectProfile) ?? findProfile(user.profileId);
}

/** Matriz de permissões do perfil. */
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

/** Interrompe a operação se o usuário logado não tiver a permissão da matriz. */
export function authorize(module: PermissionModule, action: PermissionAction, projectId?: string): void {
  if (!can(module, action, projectId)) throw new PermissionDeniedError();
}

/** Interrompe a operação quando a regra não libera. */
export function ensure(allowed: boolean): void {
  if (!allowed) throw new PermissionDeniedError();
}

export function isAdmin(user: User | undefined): boolean {
  return !!user && findProfile(user.profileId)?.admin === true;
}

export function roleOf(user: User | undefined, projectId?: string): Role | undefined {
  return user?.active ? effectiveProfile(user, projectId)?.role : undefined;
}

const manages = (role: Role | undefined): boolean => role === 'admin' || role === 'coordinator';

// Acesso a projetos

/**
 * Por padrão, todo usuário ativo vê todos os projetos.
 * Exceção: o Visualizador pode ter o acesso limitado a projetos específicos.
 */
export function canSeeProject(p: Project, user: User | undefined = currentUser()): boolean {
  if (!user || !hasPermission(user, 'projects', 'view', p.id)) return false;
  if (roleOf(user, p.id) !== 'viewer' || user.projectIds === null) return true;
  return user.projectIds.includes(p.id);
}

export function visibleProjects(): Project[] {
  const user = currentUser();
  return db.projects.filter((p) => canSeeProject(p, user));
}

/** Contexto comum: usuário logado, função no projeto e se ele vê o projeto. */
function context(p: Project): { user: User; role: Role } | null {
  const user = currentUser();
  const role = roleOf(user, p.id);
  if (!user || !role || !canSeeProject(p, user)) return null;
  return { user, role };
}

const matrix = (module: PermissionModule, action: PermissionAction, p: Project): boolean => can(module, action, p.id);
const branchOf = (p: Project, t: Task): Branch | undefined => p.branches.find((b) => b.id === t.branch);

// Projeto: Administrador e Coordenador criam e editam; quem edita também exclui.

export function canCreateProject(): boolean {
  return manages(roleOf(currentUser())) && can('projects', 'create');
}

export function canEditProject(p: Project): boolean {
  const c = context(p);
  return !!c && manages(c.role) && matrix('projects', 'edit', p);
}

export function canDeleteProject(p: Project): boolean {
  return canEditProject(p) && matrix('projects', 'delete', p);
}

// Etapa: Administrador, Coordenador e Responsável.

export function canCreateBranch(p: Project): boolean {
  const c = context(p);
  return !!c && c.role !== 'viewer' && matrix('structure', 'create', p);
}

export function canEditBranch(p: Project): boolean {
  const c = context(p);
  return !!c && c.role !== 'viewer' && matrix('structure', 'edit', p);
}

export function canDeleteBranch(p: Project): boolean {
  return canEditBranch(p) && matrix('structure', 'delete', p);
}

// Tarefa: Administrador, Coordenador ou o responsável pela etapa; o responsável pela tarefa edita a própria tarefa.

export function canCreateTask(p: Project, b: Branch | undefined): boolean {
  const c = context(p);
  if (!c || !b || !matrix('tasks', 'create', p)) return false;
  return manages(c.role) || (c.role === 'responsible' && b.assignees.includes(c.user.id));
}

export function canEditTask(p: Project, t: Task): boolean {
  const c = context(p);
  if (!c || !matrix('tasks', 'edit', p)) return false;
  if (manages(c.role)) return true;
  return c.role === 'responsible' && (t.assignees.includes(c.user.id) || !!branchOf(p, t)?.assignees.includes(c.user.id));
}

export function canDeleteTask(p: Project, t: Task): boolean {
  return canEditTask(p, t) && matrix('tasks', 'delete', p);
}

// Subtarefa: Administrador, Coordenador ou o responsável pela tarefa.

function subtaskRule(p: Project, t: Task, action: PermissionAction): boolean {
  const c = context(p);
  if (!c || !matrix('tasks', action, p)) return false;
  return manages(c.role) || (c.role === 'responsible' && t.assignees.includes(c.user.id));
}

export const canCreateSubtask = (p: Project, t: Task): boolean => subtaskRule(p, t, 'create');
export const canEditSubtask = (p: Project, t: Task): boolean => subtaskRule(p, t, 'edit');
export const canDeleteSubtask = (p: Project, t: Task): boolean => subtaskRule(p, t, 'edit') && matrix('tasks', 'delete', p);

/**
 * Checklist: só o responsável pela tarefa cria, edita, marca e exclui itens.
 * O Administrador mantém o acesso completo. Tarefa sem responsável não passa a ninguém automaticamente.
 */
export function canEditChecklist(p: Project, t: Task): boolean {
  const c = context(p);
  if (!c || !matrix('tasks', 'edit', p)) return false;
  return c.role === 'admin' || (c.role !== 'viewer' && t.assignees.includes(c.user.id));
}

// Lixeira: Administrador e Coordenador.

export function canUseTrash(): boolean {
  return manages(roleOf(currentUser())) && can('trash', 'view');
}

export function canRestore(): boolean {
  return canUseTrash() && can('trash', 'edit');
}

export function canPurge(): boolean {
  return canUseTrash() && can('trash', 'delete');
}

// Usuários: Administrador e Coordenador. Perfis e permissões: só o Administrador.

export function canManageUsers(action: PermissionAction): boolean {
  return manages(roleOf(currentUser())) && can('users', action);
}

export function canManageProfiles(action: PermissionAction): boolean {
  return roleOf(currentUser()) === 'admin' && can('profiles', action);
}

/** Configurações: quem gerencia usuários, perfis ou contratantes. */
export function canOpenSettings(): boolean {
  return can('settings', 'view') && (canManageUsers('view') || canManageProfiles('view') || can('contratantes', 'view'));
}
