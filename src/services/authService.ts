/**
 * Login local (sem servidor). A sessão guarda apenas o id do usuário em `rb-projects-auth`.
 * Quando houver backend, este módulo é o ponto a trocar por autenticação real (token da API).
 */
import type { User } from '../types/user';
import { db } from './db';
import { STORAGE_KEYS, readString, removeKey, writeString } from './storage';
import { findUser, passwordMatches, userByName } from './userService';

export type LoginResult = { ok: true; user: User } | { ok: false; field: 'name' | 'password'; message: string };

const GENERIC_ERROR = 'Nome de usuário ou senha incorretos.';

/** Usuário da sessão atual, se a sessão for válida (existe e está ativo). */
export function currentUser(): User | undefined {
  const user = findUser(readString(STORAGE_KEYS.auth));
  return user?.active ? user : undefined;
}

export function isAuthenticated(): boolean {
  return !!currentUser();
}

export function login(name: string, password: string): LoginResult {
  const typed = name.trim();
  if (!typed) return { ok: false, field: 'name', message: 'Informe o nome de usuário.' };
  if (!password) return { ok: false, field: 'password', message: 'Informe a senha.' };
  const user = userByName(typed);
  if (!user || !passwordMatches(user, password)) return { ok: false, field: 'password', message: GENERIC_ERROR };
  // Só depois de a senha conferir, para não revelar quais nomes existem.
  if (!user.active) return { ok: false, field: 'name', message: 'Este usuário está desativado. Entre em contato com um administrador.' };
  writeString(STORAGE_KEYS.auth, user.id);
  return { ok: true, user };
}

/** Encerra só a sessão; projetos, usuários e perfis continuam salvos. */
export function logout(): void {
  removeKey(STORAGE_KEYS.auth);
}

/** Usado ao remover usuários: confere se ainda há alguém para entrar. */
export function hasAnyActiveUser(): boolean {
  return db.users.some((u) => u.active);
}
