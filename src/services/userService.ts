import type { Person, User } from '../types/user';
import { uid } from '../utils/ids';
import { db, persistProjects, persistUsers } from './db';
import { STORAGE_KEYS, readString, removeKey, writeString } from './storage';

const COLORS = ['#3b82f6', '#22c55e', '#fbbf24', '#f87171', '#a78bfa', '#2dd4bf', '#fb923c', '#f472b6'];
const NEUTRAL = '#9aa3b2';

export interface UserFields {
  name: string;
  email: string;
  role: string;
}

function newUser(fields: UserFields, index: number): User {
  return {
    id: uid('u'),
    name: fields.name.trim(),
    email: fields.email.trim(),
    role: fields.role.trim(),
    color: COLORS[index % COLORS.length] ?? COLORS[0]!,
  };
}

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

/** Cria a lista inicial de usuários a partir dos nomes que já aparecem nos projetos. */
export function seedUsersFromNames(names: string[]): User[] {
  const users: User[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (name && !users.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
      users.push(newUser({ name, email: '', role: '' }, users.length));
    }
  }
  return users;
}

export function addUser(fields: UserFields): User {
  const user = newUser(fields, db.users.length);
  db.users.push(user);
  persistUsers();
  return user;
}

/** Atualiza o usuário e renomeia o nome dele onde ele aparece como texto (responsáveis). */
export function updateUser(user: User, fields: UserFields): void {
  const oldName = user.name;
  Object.assign(user, { name: fields.name.trim(), email: fields.email.trim(), role: fields.role.trim() });
  for (const p of db.projects) {
    if (p.owner === oldName) p.owner = user.name;
    for (const t of p.tasks) if (t.assignee === oldName) t.assignee = user.name;
  }
  persistProjects();
  persistUsers();
}

export function removeUser(user: User): void {
  db.users = db.users.filter((u) => u !== user);
  for (const p of db.projects) {
    p.coordinators = p.coordinators.filter((id) => id !== user.id);
    for (const b of p.branches) if (b.designer === user.id) b.designer = null;
  }
  persistProjects();
  persistUsers();
}

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
    designs += p.branches.filter((b) => b.designer === user.id).length;
    tasks += p.tasks.filter((t) => userByName(t.assignee) === user).length;
  }
  return { coordinates, designs, tasks };
}

/** Todos os nomes conhecidos: usuários cadastrados e responsáveis de tarefas. */
export function knownPeople(): string[] {
  const names = new Set(db.users.map((u) => u.name));
  for (const p of db.projects) for (const t of p.tasks) if (t.assignee.trim()) names.add(t.assignee.trim());
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Nome configurado em Configurações ("Seu nome"). */
export function getMyName(): string {
  return readString(STORAGE_KEYS.myName) ?? '';
}

export function setMyName(name: string): void {
  const n = name.trim();
  if (n) writeString(STORAGE_KEYS.myName, n);
  else removeKey(STORAGE_KEYS.myName);
}

/** Quem está agindo: o nome configurado, o responsável do projeto aberto ou "Você". */
export function currentActor(projectOwner?: string): string {
  return getMyName() || projectOwner || 'Você';
}
