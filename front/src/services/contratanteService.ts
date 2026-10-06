/** Contratantes, guardadas em `rb-contratantes-v1`. Só quem tem o módulo "Contratantes" cadastra. */
import type { Contratante } from '../types/contratante';
import type { Project } from '../types/project';
import { uid } from '../utils/ids';
import { db } from './db';
import { authorize } from './permissionService';
import { STORAGE_KEYS, readJSON, writeJSON } from './storage';

export const contratantes: Contratante[] = [];

export function loadContratantes(): void {
  let raw = readJSON(STORAGE_KEYS.contratantes);
  const legacy = raw === undefined;
  if (legacy) raw = readJSON(STORAGE_KEYS.legacyPrefeituras);
  const list = Array.isArray(raw) ? raw : [];
  contratantes.splice(
    0,
    contratantes.length,
    ...list
      .filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null && typeof r.id === 'string' && typeof r.name === 'string')
      // "uf" era o campo "Cidade / UF" do cadastro antigo de prefeituras.
      .map((r) => ({ id: r.id as string, name: r.name as string, cidade: typeof r.cidade === 'string' ? r.cidade : typeof r.uf === 'string' ? r.uf : '' })),
  );
  if (legacy && contratantes.length) persist();
}

function persist(): void {
  writeJSON(STORAGE_KEYS.contratantes, contratantes);
}

export function sortedContratantes(): Contratante[] {
  return [...contratantes].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function findContratante(id: string | undefined): Contratante | undefined {
  return id ? contratantes.find((p) => p.id === id) : undefined;
}

export function contratanteName(p: Project): string {
  return findContratante(p.contratanteId)?.name ?? '';
}

export function contratanteCidade(p: Project): string {
  return findContratante(p.contratanteId)?.cidade ?? '';
}

/** Cidades das contratantes cadastradas, sem repetição, para o filtro. */
export function contratanteCidades(): string[] {
  const seen = new Map<string, string>();
  for (const c of contratantes) if (c.cidade.trim()) seen.set(c.cidade.trim().toLowerCase(), c.cidade.trim());
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function projectsWithContratante(id: string): number {
  return db.projects.filter((p) => p.contratanteId === id).length;
}

/** Mensagem de erro, ou null se o nome pode ser usado. */
export function validateContratante(name: string, cidade: string, current?: Contratante): string | null {
  if (!name.trim()) return 'Informe o nome da contratante.';
  if (!cidade.trim()) return 'Informe a cidade da contratante.';
  const key = name.trim().toLowerCase();
  if (contratantes.some((p) => p !== current && p.name.trim().toLowerCase() === key)) return 'Já existe uma contratante com esse nome.';
  return null;
}

export function createContratante(name: string, cidade: string): Contratante {
  authorize('contratantes', 'create');
  const error = validateContratante(name, cidade);
  if (error) throw new Error(error);
  const item: Contratante = { id: uid('ct'), name: name.trim(), cidade: cidade.trim() };
  contratantes.push(item);
  persist();
  return item;
}

export function updateContratante(item: Contratante, name: string, cidade: string): void {
  authorize('contratantes', 'edit');
  const error = validateContratante(name, cidade, item);
  if (error) throw new Error(error);
  item.name = name.trim();
  item.cidade = cidade.trim();
  persist();
}

export function deleteContratante(item: Contratante): void {
  authorize('contratantes', 'delete');
  if (projectsWithContratante(item.id)) throw new Error('Contratante em uso por projetos.');
  contratantes.splice(contratantes.indexOf(item), 1);
  persist();
}
