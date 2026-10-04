import { STORAGE_KEYS, readString, removeKey, writeString } from './storage';

export type LoginResult = { ok: true } | { ok: false; field: 'name' | 'password'; message: string };

export function isAuthenticated(): boolean {
  return readString(STORAGE_KEYS.auth) === 'true';
}

/**
 * Login local, sem servidor. Regra atual: a senha é igual ao nome de usuário.
 * A mensagem de erro é genérica para não revelar a regra.
 */
export function login(name: string, password: string): LoginResult {
  const user = name.trim();
  if (!user) return { ok: false, field: 'name', message: 'Informe o nome de usuário.' };
  if (!password) return { ok: false, field: 'password', message: 'Informe a senha.' };
  if (password !== user) return { ok: false, field: 'password', message: 'Nome de usuário ou senha incorretos.' };
  writeString(STORAGE_KEYS.auth, 'true');
  return { ok: true };
}

/** Encerra só a sessão; projetos e demais dados continuam salvos. */
export function logout(): void {
  removeKey(STORAGE_KEYS.auth);
}
