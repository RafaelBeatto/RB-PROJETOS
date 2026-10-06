import type { Person, User } from '../types/user';
import { randomSalt, sha256 } from '../utils/hash';
import { uid } from '../utils/ids';
import { currentUser } from './authService';
import { db, persistProjects, persistUsers } from './db';
import { PermissionDeniedError, canManageUsers } from './permissionService';
import { DEFAULT_PROFILE_ID, findProfile } from './profileService';

const COLORS = ['#3b82f6', '#22c55e', '#fbbf24', '#f87171', '#a78bfa', '#2dd4bf', '#fb923c', '#f472b6'];
const NEUTRAL = '#9aa3b2';
export const MIN_PASSWORD = 4;

export interface UserFields {
  name: string;
  email: string;
  phone: string;
  /** Foto em data URL; vazio = sem foto. */
  photo: string;
  role: string;
  profileId: string;
  active: boolean;
  /** Projetos do Visualizador; null = todos. */
  projectIds: string[] | null;
  /** Obrigatória ao criar; ao editar, vazia mantém a senha atual. */
  password: string;
}

// Senha

export function hashPassword(password: string, salt: string): string {
  return sha256(`${salt}:${password}`);
}

export function passwordMatches(user: User, password: string): boolean {
  return !!user.passwordHash && hashPassword(password, user.passwordSalt) === user.passwordHash;
}

function applyPassword(user: User, password: string): void {
  user.passwordSalt = randomSalt();
  user.passwordHash = hashPassword(password, user.passwordSalt);
}

// Consulta

export function findUser(id: string | null | undefined): User | undefined {
  return id ? db.users.find((u) => u.id === id) : undefined;
}

export function userByName(name: string | null | undefined): User | undefined {
  const n = (name ?? '').trim().toLowerCase();
  return n ? db.users.find((u) => u.name.trim().toLowerCase() === n) : undefined;
}

/** Usuário cadastrado com esse nome ou, se não houver, uma pessoa neutra para exibição. */
export function personByName(name: string): Person {
  return userByName(name) ?? { name, color: NEUTRAL };
}

export function isAdminProfile(profileId: string): boolean {
  return findProfile(profileId)?.admin === true;
}

function isActiveAdmin(u: User): boolean {
  return u.active && isAdminProfile(u.profileId);
}

// Regras de proteção

/**
 * Impede ficar sem administrador ativo. Devolve o motivo do bloqueio ou null.
 * `next` descreve o estado do usuário depois da mudança; 'delete' para exclusão.
 */
export function adminBlock(user: User, next: { active: boolean; profileId: string } | 'delete'): string | null {
  if (!isActiveAdmin(user)) return null;
  const stillAdmin = next !== 'delete' && next.active && isAdminProfile(next.profileId);
  if (stillAdmin) return null;
  const others = db.users.some((u) => u !== user && isActiveAdmin(u));
  return others ? null : 'Este é o único administrador ativo. Defina outro administrador antes de continuar.';
}

/**
 * Hierarquia: só um administrador dá o perfil Administrador e mexe em contas de administrador.
 * Sem isso, um Coordenador (que gerencia usuários) poderia se promover ou tomar a conta de um administrador.
 */
export function hierarchyBlock(user: User | undefined, nextProfileId?: string): string | null {
  if (isAdminProfile(currentUser()?.profileId ?? '')) return null;
  if (user && isAdminProfile(user.profileId)) return 'Só um administrador pode alterar a conta de outro administrador.';
  if (nextProfileId && isAdminProfile(nextProfileId)) return 'Só um administrador pode dar o perfil Administrador.';
  return null;
}

/** Ninguém exclui ou desativa a própria conta (evita se trancar fora). */
export function selfBlock(user: User, next: { active: boolean } | 'delete'): string | null {
  if (currentUser()?.id !== user.id) return null;
  if (next === 'delete') return 'Você não pode excluir a própria conta.';
  return next.active ? null : 'Você não pode desativar a própria conta.';
}

/** Valida os campos do formulário; devolve a mensagem de erro ou null. */
export function validateUser(fields: UserFields, user?: User): string | null {
  const name = fields.name.trim();
  if (!name) return 'Informe o nome.';
  const sameName = userByName(name);
  if (sameName && sameName !== user) return 'Já existe um usuário com esse nome.';
  if (!findProfile(fields.profileId)) return 'Escolha um perfil.';
  const hierarchy = hierarchyBlock(user, fields.profileId);
  if (hierarchy) return hierarchy;
  if (!user && fields.password.length < MIN_PASSWORD) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  if (user && fields.password && fields.password.length < MIN_PASSWORD) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  if (user) return adminBlock(user, fields) ?? selfBlock(user, fields);
  return null;
}

// Criação e migração

function newUser(fields: Omit<UserFields, 'password'>, index: number, password: string): User {
  const user: User = {
    id: uid('u'),
    name: fields.name.trim(),
    email: fields.email.trim(),
    phone: fields.phone.trim(),
    photo: fields.photo,
    role: fields.role.trim(),
    color: COLORS[index % COLORS.length] ?? COLORS[0]!,
    profileId: fields.profileId,
    active: fields.active,
    projectIds: fields.projectIds,
    createdAt: new Date().toISOString(),
    passwordHash: '',
    passwordSalt: '',
  };
  applyPassword(user, password);
  return user;
}

/**
 * Cria a lista inicial de usuários a partir dos nomes que já aparecem nos projetos.
 * Mantém a regra de login anterior: a senha inicial é o próprio nome.
 */
export function seedUsersFromNames(names: string[], profileId: string): User[] {
  const users: User[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (name && !users.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
      users.push(newUser({ name, email: '', phone: '', photo: '', role: '', profileId, active: true, projectIds: null }, users.length, name));
    }
  }
  return users;
}

/** Completa usuários salvos antes do controle de acesso (todos viram administradores, como era o acesso deles). */
export function upgradeLegacyUser(user: User, adminProfileId: string): boolean {
  let changed = false;
  if (!findProfile(user.profileId)) {
    user.profileId = adminProfileId;
    changed = true;
  }
  if (!user.createdAt) {
    user.createdAt = new Date().toISOString();
    changed = true;
  }
  if (!user.passwordHash) {
    applyPassword(user, user.name);
    changed = true;
  }
  return changed;
}

// Operações (protegidas por permissão)

function authorizeUsers(action: 'create' | 'edit' | 'delete'): void {
  if (!canManageUsers(action)) throw new PermissionDeniedError();
}

export function addUser(fields: UserFields): User {
  authorizeUsers('create');
  const error = validateUser(fields);
  if (error) throw new Error(error);
  const user = newUser(fields, db.users.length, fields.password);
  db.users.push(user);
  persistUsers();
  return user;
}

/** Cadastro rápido (ex.: formulário do projeto) com o perfil padrão. */
export function quickAddUser(name: string, email: string, role: string, password: string): User {
  return addUser({ name, email, phone: '', photo: '', role, profileId: DEFAULT_PROFILE_ID, active: true, projectIds: null, password });
}

/** Atualiza o usuário e renomeia o nome dele onde ele aparece como texto (responsáveis). */
export function updateUser(user: User, fields: UserFields): void {
  authorizeUsers('edit');
  const error = validateUser(fields, user);
  if (error) throw new Error(error);
  const oldName = user.name;
  Object.assign(user, {
    name: fields.name.trim(),
    email: fields.email.trim(),
    phone: fields.phone.trim(),
    photo: fields.photo,
    role: fields.role.trim(),
    profileId: fields.profileId,
    active: fields.active,
    projectIds: fields.projectIds,
  });
  if (fields.password) applyPassword(user, fields.password);
  if (oldName !== user.name) {
    for (const p of db.projects) {
      if (p.owner === oldName) p.owner = user.name;
    }
    persistProjects();
  }
  persistUsers();
}

export function setUserActive(user: User, active: boolean): void {
  authorizeUsers('edit');
  const error = hierarchyBlock(user) ?? adminBlock(user, { active, profileId: user.profileId }) ?? selfBlock(user, { active });
  if (error) throw new Error(error);
  user.active = active;
  persistUsers();
}

/**
 * Exclui o usuário. Projetos, etapas, tarefas e subtarefas continuam; onde ele era
 * coordenador ou responsável, o item fica sem ele (nada é transferido automaticamente).
 */
export function removeUser(user: User): void {
  authorizeUsers('delete');
  const error = hierarchyBlock(user) ?? adminBlock(user, 'delete') ?? selfBlock(user, 'delete');
  if (error) throw new Error(error);
  db.users = db.users.filter((u) => u !== user);
  for (const p of db.projects) {
    p.coordinators = p.coordinators.filter((id) => id !== user.id);
    for (const b of p.branches) b.assignees = b.assignees.filter((id) => id !== user.id);
    for (const t of p.tasks) t.assignees = t.assignees.filter((id) => id !== user.id);
  }
  persistProjects();
  persistUsers();
}

/** Troca da própria senha (qualquer usuário logado). */
export function changeOwnPassword(current: string, next: string): string | null {
  const user = currentUser();
  if (!user) return 'Sessão expirada. Entre novamente.';
  if (!passwordMatches(user, current)) return 'A senha atual está incorreta.';
  if (next.length < MIN_PASSWORD) return `A nova senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  applyPassword(user, next);
  persistUsers();
  return null;
}

// Vínculos e nomes

export interface UserLinks {
  coordinates: number;
  designs: number;
  tasks: number;
}

export function userLinks(user: User): UserLinks {
  let coordinates = 0;
  let designs = 0;
  let tasks = 0;
  for (const p of db.projects) {
    if (!p.archived && p.coordinators.includes(user.id)) coordinates++;
    designs += p.branches.filter((b) => b.assignees.includes(user.id)).length;
    tasks += p.tasks.filter((t) => t.assignees.includes(user.id)).length;
  }
  return { coordinates, designs, tasks };
}

/** Pessoas da tarefa para exibição: colaboradores cadastrados e, se houver, o nome antigo sem cadastro. */
export function taskPeople(t: { assignees: string[]; assignee: string }): Person[] {
  const users: Person[] = t.assignees.map((id) => findUser(id)).filter((u): u is User => !!u);
  return t.assignee.trim() ? [...users, personByName(t.assignee.trim())] : users;
}

export function taskPeopleNames(t: { assignees: string[]; assignee: string }): string {
  return taskPeople(t)
    .map((x) => x.name)
    .join(', ');
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Quem está agindo: o usuário logado (ou o responsável do projeto, se não houver sessão). */
export function currentActor(projectOwner?: string): string {
  return currentUser()?.name || projectOwner || 'Você';
}
