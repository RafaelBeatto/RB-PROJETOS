/**
 * Única porta de acesso ao localStorage. Nenhuma outra parte do código deve
 * chamar localStorage diretamente. Todas as operações toleram navegação
 * privada e armazenamento bloqueado.
 */
export const STORAGE_KEYS = {
  projects: 'rb-projects-v1',
  users: 'rb-users-v1',
  auth: 'rb-projects-auth',
  /** Perfis e permissões (controle de acesso). */
  access: 'rb-access-v1',
  /** Prefeituras cadastradas pelo administrador. */
  prefeituras: 'rb-prefeituras-v1',
  /** Cópia de segurança de um conteúdo de projetos ilegível, guardada antes de usar os dados de exemplo. */
  projectsBackup: 'rb-projects-v1-backup',
} as const;

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function readString(key: StorageKey): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeString(key: StorageKey, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: StorageKey): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* armazenamento indisponível: nada a remover */
  }
}

/** Lê JSON; devolve `undefined` quando a chave não existe ou o conteúdo é inválido. */
export function readJSON(key: StorageKey): unknown {
  const raw = readString(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    console.warn(`RB Projects: conteúdo inválido em "${key}", usando valores padrão.`);
    return undefined;
  }
}

export function writeJSON(key: StorageKey, value: unknown): boolean {
  return writeString(key, JSON.stringify(value));
}
