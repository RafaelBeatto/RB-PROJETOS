/** Prefeituras, guardadas em `rb-prefeituras-v1`. Só quem tem o módulo "Prefeituras" cadastra. */
import type { Prefeitura } from '../types/prefeitura';
import type { Project } from '../types/project';
import { uid } from '../utils/ids';
import { db } from './db';
import { authorize } from './permissionService';
import { STORAGE_KEYS, readJSON, writeJSON } from './storage';

export const prefeituras: Prefeitura[] = [];

export function loadPrefeituras(): void {
  const raw = readJSON(STORAGE_KEYS.prefeituras);
  const list = Array.isArray(raw) ? raw : [];
  prefeituras.splice(
    0,
    prefeituras.length,
    ...list
      .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null && typeof r.id === 'string' && typeof r.name === 'string')
      .map((r) => ({ id: r.id as string, name: r.name as string, uf: typeof r.uf === 'string' ? r.uf : '' })),
  );
}

function persist(): void {
  writeJSON(STORAGE_KEYS.prefeituras, prefeituras);
}

export function sortedPrefeituras(): Prefeitura[] {
  return [...prefeituras].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function findPrefeitura(id: string | undefined): Prefeitura | undefined {
  return id ? prefeituras.find((p) => p.id === id) : undefined;
}

export function prefeituraName(p: Project): string {
  return findPrefeitura(p.prefeituraId)?.name ?? '';
}

export function projectsWithPrefeitura(id: string): number {
  return db.projects.filter((p) => p.prefeituraId === id).length;
}

/** Mensagem de erro, ou null se o nome pode ser usado. */
export function validatePrefeitura(name: string, current?: Prefeitura): string | null {
  if (!name.trim()) return 'Informe o nome da prefeitura.';
  const key = name.trim().toLowerCase();
  if (prefeituras.some((p) => p !== current && p.name.trim().toLowerCase() === key)) return 'Já existe uma prefeitura com esse nome.';
  return null;
}

export function createPrefeitura(name: string, uf: string): Prefeitura {
  authorize('prefeituras', 'create');
  const item: Prefeitura = { id: uid('pref'), name: name.trim(), uf: uf.trim() };
  prefeituras.push(item);
  persist();
  return item;
}

export function updatePrefeitura(item: Prefeitura, name: string, uf: string): void {
  authorize('prefeituras', 'edit');
  item.name = name.trim();
  item.uf = uf.trim();
  persist();
}

export function deletePrefeitura(item: Prefeitura): void {
  authorize('prefeituras', 'delete');
  if (projectsWithPrefeitura(item.id)) throw new Error('Prefeitura em uso por projetos.');
  prefeituras.splice(prefeituras.indexOf(item), 1);
  persist();
}
