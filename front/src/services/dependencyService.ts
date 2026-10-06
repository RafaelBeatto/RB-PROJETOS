/**
 * Dependências (informativas: não impedem iniciar nem concluir nada).
 *
 * Tarefas e etapas podem depender de qualquer etapa ou tarefa do MESMO projeto.
 * A lista guarda só ids: os ids de etapa ("b…") e de tarefa ("t…") nunca se repetem,
 * então o tipo é descoberto procurando o id no projeto.
 *
 * Regras de consistência:
 * - nunca depender de si mesmo;
 * - a tarefa não depende da própria etapa, e a etapa não depende das próprias tarefas;
 * - sem ciclos (A depende de B que depende de A, direta ou indiretamente).
 */
import type { Branch } from '../types/branch';
import type { Project } from '../types/project';
import type { Task } from '../types/task';
import { RuleError } from './errors';

export type DepItem = { kind: 'branch'; id: string; name: string; status: string; branch: Branch } | { kind: 'task'; id: string; name: string; status: string; task: Task };

/** Quem tem dependências: uma tarefa ou uma etapa (id vazio = ainda sendo criada). */
export interface DepOwner {
  kind: 'branch' | 'task';
  id: string;
  /** Para tarefas: a etapa em que ela está (ou estará). */
  branch?: string;
}

export function findDepItem(p: Project, id: string): DepItem | undefined {
  const b = p.branches.find((x) => x.id === id);
  if (b) return { kind: 'branch', id, name: b.name, status: b.status, branch: b };
  const t = p.tasks.find((x) => x.id === id);
  if (t) return { kind: 'task', id, name: t.title, status: t.status, task: t };
  return undefined;
}

const depsOfId = (p: Project, id: string): string[] => p.branches.find((b) => b.id === id)?.dependencies ?? p.tasks.find((t) => t.id === id)?.dependencies ?? [];

/** Itens de que o dono depende (só os que ainda existem). */
export function dependencyItems(p: Project, ids: string[]): DepItem[] {
  return ids.map((id) => findDepItem(p, id)).filter((x): x is DepItem => !!x);
}

/** Itens que dependem diretamente de `id`. */
export function dependentItems(p: Project, id: string): DepItem[] {
  return [...p.branches.filter((b) => b.dependencies.includes(id)).map((b) => b.id), ...p.tasks.filter((t) => t.dependencies.includes(id)).map((t) => t.id)]
    .map((x) => findDepItem(p, x))
    .filter((x): x is DepItem => !!x);
}

/** `from` chega em `to` seguindo as dependências? */
function reaches(p: Project, from: string, to: string): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === to) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    stack.push(...depsOfId(p, cur));
  }
  return false;
}

/** Por que `id` não pode ser escolhido (ou vazio se pode). */
export function dependencyBlock(p: Project, owner: DepOwner, id: string): string {
  if (owner.id && id === owner.id) return 'É o próprio item';
  if (owner.kind === 'task' && id === owner.branch) return 'É a etapa desta tarefa';
  if (owner.kind === 'branch' && owner.id && p.tasks.some((t) => t.id === id && t.branch === owner.id)) return 'É uma tarefa desta etapa';
  if (owner.id && reaches(p, id, owner.id)) return 'Criaria dependência circular';
  return '';
}

/** Opções para escolher: etapas e tarefas do projeto, com o motivo quando não podem ser escolhidas. */
export function dependencyOptions(p: Project, owner: DepOwner): { item: DepItem; block: string }[] {
  const items: DepItem[] = [
    ...p.branches.map((b) => ({ kind: 'branch' as const, id: b.id, name: b.name, status: b.status, branch: b })),
    ...p.tasks.map((t) => ({ kind: 'task' as const, id: t.id, name: t.title, status: t.status, task: t })),
  ];
  return items.filter((x) => !(owner.id && x.id === owner.id)).map((item) => ({ item, block: dependencyBlock(p, owner, item.id) }));
}

/**
 * Valida antes de gravar: só itens existentes do projeto, sem repetição.
 * Itens inválidos já salvos (ex.: depois de mover a tarefa de etapa) são descartados;
 * um ciclo novo é recusado com a explicação.
 */
export function cleanDependencies(p: Project, owner: DepOwner, ids: string[], previous: string[] = []): string[] {
  const out: string[] = [];
  for (const id of ids) {
    if (out.includes(id) || !findDepItem(p, id)) continue;
    const block = dependencyBlock(p, owner, id);
    if (block === 'Criaria dependência circular' && !previous.includes(id)) {
      throw new RuleError(`“${findDepItem(p, id)?.name}” já depende, direta ou indiretamente, deste item: isso criaria uma dependência circular.`);
    }
    if (block) continue;
    out.push(id);
  }
  return out;
}

/** Remove de todo o projeto as dependências que apontam para os ids informados. */
export function dropDependencies(p: Project, ids: Set<string>): void {
  for (const b of p.branches) b.dependencies = b.dependencies.filter((d) => !ids.has(d));
  for (const t of p.tasks) t.dependencies = t.dependencies.filter((d) => !ids.has(d));
}
