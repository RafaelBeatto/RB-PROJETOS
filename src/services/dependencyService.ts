/**
 * Regras de dependência entre projetos, etapas e tarefas.
 *
 * - Cada item guarda as próprias dependências (o que precisa acontecer antes dele).
 * - Um item herda os bloqueios de onde está: a tarefa, os da sua etapa (e das
 *   etapas acima) e os do projeto; a etapa, os das etapas acima e do projeto.
 * - Condições: "Concluído" e "Iniciado". Para projeto e etapa, o estado vem das
 *   tarefas que estão dentro deles (incluindo subetapas).
 * - Enquanto bloqueada, a tarefa só pode ficar em "A fazer"; o projeto bloqueado não
 *   pode ir para "Em andamento" nem "Concluído".
 *
 * Tudo é calculado na hora a partir dos dados, então qualquer mudança de status
 * libera ou bloqueia os itens dependentes na próxima renderização.
 * Como o sistema roda no navegador, estas funções são a camada de regras ("backend"):
 * os serviços de gravação chamam as validações daqui antes de alterar os dados.
 */
import type { Branch } from '../types/branch';
import { CONDITION_LABELS, KIND_LABELS, type DepCondition, type DepKind, type Dependency, type ItemRef } from '../types/dependency';
import { PROJECT_STARTED_STATUSES, type Project } from '../types/project';
import { TASK_NOT_STARTED, type Task } from '../types/task';
import { plural } from '../utils/dom';
import { uid } from '../utils/ids';
import { db } from './db';

/** Id provisório de um item que ainda está sendo criado (usado nas simulações). */
export const NEW_ID = '__novo__';

export class DependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DependencyError';
  }
}

// Localizar itens

export interface ResolvedItem {
  ref: ItemRef;
  project: Project;
  branch?: Branch;
  task?: Task;
  name: string;
}

const projectIn = (world: Project[], id: string): Project | undefined => world.find((p) => p.id === id);

export function resolveRef(ref: ItemRef, world: Project[] = db.projects): ResolvedItem | undefined {
  const project = projectIn(world, ref.projectId);
  if (!project) return undefined;
  if (ref.kind === 'project') return ref.id === project.id ? { ref, project, name: project.name } : undefined;
  if (ref.kind === 'branch') {
    const branch = project.branches.find((b) => b.id === ref.id);
    return branch ? { ref, project, branch, name: branch.name } : undefined;
  }
  const task = project.tasks.find((t) => t.id === ref.id);
  return task ? { ref, project, task, name: task.title } : undefined;
}

export const depRef = (d: Dependency): ItemRef => ({ kind: d.kind, projectId: d.projectId, id: d.targetId });
export const refKey = (r: ItemRef): string => `${r.kind}|${r.projectId}|${r.id}`;
export const projectRef = (p: Project): ItemRef => ({ kind: 'project', projectId: p.id, id: p.id });
export const branchRef = (p: Project, b: Branch): ItemRef => ({ kind: 'branch', projectId: p.id, id: b.id });
export const taskRef = (p: Project, t: Task): ItemRef => ({ kind: 'task', projectId: p.id, id: t.id });

function dependenciesOfItem(item: ResolvedItem): Dependency[] {
  return (item.task ?? item.branch ?? item.project).dependencies;
}

function branchById(p: Project, id: string | null | undefined): Branch | undefined {
  return id ? p.branches.find((b) => b.id === id) : undefined;
}

/** Etapas que contêm o item, da mais próxima até a raiz. */
function containerBranches(p: Project, startId: string | null | undefined): Branch[] {
  const chain: Branch[] = [];
  let cur = branchById(p, startId);
  for (let guard = 0; cur && guard < 100 && !chain.includes(cur); guard++) {
    chain.push(cur);
    cur = branchById(p, cur.parent);
  }
  return chain;
}

/** Tarefas dentro da etapa e de todas as subetapas. */
function tasksUnder(p: Project, branchId: string): Task[] {
  const ids = new Set([branchId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const b of p.branches) {
      if (b.parent && ids.has(b.parent) && !ids.has(b.id)) {
        ids.add(b.id);
        grew = true;
      }
    }
  }
  return p.tasks.filter((t) => ids.has(t.branch));
}

/** Caminho legível: "Projeto / Etapa / Sub". */
export function itemPath(item: ResolvedItem): string {
  const p = item.project;
  if (item.ref.kind === 'project') return '';
  const start = item.branch ? item.branch.parent : item.task?.branch;
  const names = containerBranches(p, start)
    .reverse()
    .map((b) => b.name);
  return [p.name, ...names].join(' / ');
}

// Estado e condições

export const isTaskStarted = (t: Task): boolean => t.status !== TASK_NOT_STARTED;
export const isTaskDone = (t: Task): boolean => t.status === 'Concluído';

export interface ConditionState {
  met: boolean;
  /** Situação atual do item, em texto curto (ex.: "3 de 5 tarefas concluídas"). */
  detail: string;
}

function tasksState(tasks: Task[], condition: DepCondition, emptyText: string): ConditionState {
  if (!tasks.length) return { met: false, detail: emptyText };
  const done = tasks.filter(isTaskDone).length;
  const started = tasks.filter(isTaskStarted).length;
  if (condition === 'done') return { met: done === tasks.length, detail: `${done} de ${plural(tasks.length, 'tarefa concluída', 'tarefas concluídas')}` };
  return { met: started > 0, detail: started ? `${plural(started, 'tarefa iniciada', 'tarefas iniciadas')}` : 'nenhuma tarefa iniciada' };
}

/** Avalia uma condição sobre um item já localizado. */
export function evaluate(item: ResolvedItem, condition: DepCondition): ConditionState {
  if (item.task) {
    const t = item.task;
    return { met: condition === 'done' ? isTaskDone(t) : isTaskStarted(t), detail: `status atual: ${t.status}` };
  }
  if (item.branch) {
    // A etapa segue a coluna do Kanban "Etapas"; as tarefas de dentro só complementam o "iniciada".
    const b = item.branch;
    const tasks = tasksUnder(item.project, b.id);
    if (condition === 'done') return { met: b.status === 'Concluído', detail: `etapa em “${b.status}”` };
    const started = b.status !== TASK_NOT_STARTED || tasks.some(isTaskStarted);
    return { met: started, detail: `etapa em “${b.status}”${tasks.some(isTaskStarted) ? ' · com tarefas iniciadas' : ''}` };
  }
  const p = item.project;
  // Projeto: o status "Concluído" (ou "Em andamento") vale; senão, olha as tarefas.
  if (condition === 'done' && p.status === 'Concluído') return { met: true, detail: 'projeto concluído' };
  if (condition === 'started' && PROJECT_STARTED_STATUSES.includes(p.status)) return { met: true, detail: `status: ${p.status}` };
  const state = tasksState(p.tasks, condition, `status: ${p.status}, sem tarefas`);
  return { ...state, detail: `status: ${p.status} · ${state.detail}` };
}

export interface DependencyState extends ConditionState {
  dep: Dependency;
  /** Undefined quando o item exigido não existe mais. */
  target?: ResolvedItem;
  invalid: boolean;
}

export function dependencyState(dep: Dependency, world: Project[] = db.projects): DependencyState {
  const target = resolveRef(depRef(dep), world);
  if (!target) return { dep, invalid: true, met: true, detail: 'item não existe mais' };
  return { dep, target, invalid: false, ...evaluate(target, dep.condition) };
}

// Bloqueios

export interface Blocker extends DependencyState {
  target: ResolvedItem;
  /** Onde a dependência foi configurada: no próprio item ou num item que o contém. */
  source: ResolvedItem;
  inherited: boolean;
}

/** O item e os itens que o contêm (etapas acima e projeto), do mais próximo ao mais distante. */
function gateChain(item: ResolvedItem): ResolvedItem[] {
  const p = item.project;
  if (item.ref.kind === 'project') return [item];
  const start = item.branch ? item.branch.parent : item.task?.branch;
  const branches = containerBranches(p, start).map((b) => ({ ref: branchRef(p, b), project: p, branch: b, name: b.name }));
  return [item, ...branches, { ref: projectRef(p), project: p, name: p.name }];
}

/** Dependências não atendidas que impedem o item de avançar (próprias e herdadas). */
export function blockersOf(ref: ItemRef, world: Project[] = db.projects): Blocker[] {
  const item = resolveRef(ref, world);
  if (!item) return [];
  const out: Blocker[] = [];
  for (const source of gateChain(item)) {
    for (const dep of dependenciesOfItem(source)) {
      const state = dependencyState(dep, world);
      if (state.invalid || state.met || !state.target) continue;
      out.push({ ...state, target: state.target, source, inherited: source !== item });
    }
  }
  return out;
}

export const isRefBlocked = (ref: ItemRef, world: Project[] = db.projects): boolean => blockersOf(ref, world).length > 0;
export const isTaskBlocked = (p: Project, t: Task): boolean => isRefBlocked(taskRef(p, t));

/** "concluída", "iniciado"…: tarefa e etapa são femininas; projeto, masculino. */
export function conditionWord(kind: DepKind, condition: DepCondition): string {
  const base = CONDITION_LABELS[condition].toLowerCase();
  return kind === 'project' ? base : `${base.slice(0, -1)}a`;
}

const sourceLabel = (r: ResolvedItem): string => (r.ref.kind === 'project' ? `no projeto “${r.name}”` : `na etapa “${r.name}”`);

/** Frase curta para um bloqueio: "Tarefa “Criar API” precisa estar concluída (status atual: A fazer)". */
export function blockerText(b: Blocker): string {
  const via = b.inherited ? ` — regra definida ${sourceLabel(b.source)}` : '';
  return `${KIND_LABELS[b.target.ref.kind]} “${b.target.name}” precisa estar ${conditionWord(b.target.ref.kind, b.dep.condition)} (${b.detail})${via}`;
}

/** Itens que dependem diretamente do item (o que ele libera). */
export function dependentsOf(ref: ItemRef, world: Project[] = db.projects): ResolvedItem[] {
  const key = refKey(ref);
  const out: ResolvedItem[] = [];
  for (const p of world) {
    const candidates: ResolvedItem[] = [
      { ref: projectRef(p), project: p, name: p.name },
      ...p.branches.map((b) => ({ ref: branchRef(p, b), project: p, branch: b, name: b.name })),
      ...p.tasks.map((t) => ({ ref: taskRef(p, t), project: p, task: t, name: t.title })),
    ];
    for (const c of candidates) if (dependenciesOfItem(c).some((d) => refKey(depRef(d)) === key)) out.push(c);
  }
  return out;
}

/** Chaves de todos os itens bloqueados agora; usado para avisar o que foi liberado. */
export function blockedSnapshot(world: Project[] = db.projects): Set<string> {
  const keys = new Set<string>();
  for (const p of world) {
    if (isRefBlocked(projectRef(p), world)) keys.add(refKey(projectRef(p)));
    for (const b of p.branches) if (b.status !== 'Concluído' && isRefBlocked(branchRef(p, b), world)) keys.add(refKey(branchRef(p, b)));
    for (const t of p.tasks) if (t.status !== 'Concluído' && isRefBlocked(taskRef(p, t), world)) keys.add(refKey(taskRef(p, t)));
  }
  return keys;
}

/** Quantos itens deixaram de estar bloqueados desde `before`. */
export function releasedSince(before: Set<string>): number {
  const now = blockedSnapshot();
  let n = 0;
  for (const k of before) if (!now.has(k)) n++;
  return n;
}

// Ciclos

/**
 * Grafo de espera. Cada item tem dois nós:
 *   G (portão: o item pode avançar) e S (estado: a condição sobre o item pode ser cumprida).
 * Arestas "A → B" significam "A espera B":
 *   G(item) → S(alvo) para cada dependência;
 *   S(item) → G(item): o item só se cumpre se puder avançar;
 *   G(filho) → G(contêiner): tarefa e etapa herdam os bloqueios de onde estão;
 *   S(contêiner) → S(filhos): projeto e etapa dependem do que têm dentro.
 * Um ciclo nesse grafo é uma espera impossível (dependência circular, direta ou indireta).
 */
type Graph = Map<string, string[]>;

const gKey = (r: ItemRef): string => `G|${refKey(r)}`;
const sKey = (r: ItemRef): string => `S|${refKey(r)}`;

function buildGraph(world: Project[]): Graph {
  const g: Graph = new Map();
  const add = (from: string, to: string): void => {
    const list = g.get(from);
    if (list) list.push(to);
    else g.set(from, [to]);
  };
  for (const p of world) {
    const pr = projectRef(p);
    add(sKey(pr), gKey(pr));
    for (const d of p.dependencies) add(gKey(pr), sKey(depRef(d)));
    for (const b of p.branches) {
      const br = branchRef(p, b);
      const parent = branchById(p, b.parent);
      const container = parent ? branchRef(p, parent) : pr;
      add(sKey(br), gKey(br));
      add(gKey(br), gKey(container));
      add(sKey(container), sKey(br));
      for (const d of b.dependencies) add(gKey(br), sKey(depRef(d)));
    }
    for (const t of p.tasks) {
      const tr = taskRef(p, t);
      const branch = branchById(p, t.branch);
      const container = branch ? branchRef(p, branch) : pr;
      add(sKey(tr), gKey(tr));
      add(gKey(tr), gKey(container));
      add(sKey(container), sKey(tr));
      for (const d of t.dependencies) add(gKey(tr), sKey(depRef(d)));
    }
  }
  return g;
}

/** Existe caminho de `from` até `to`? */
function reaches(g: Graph, from: string, to: string): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === to) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of g.get(cur) ?? []) stack.push(next);
  }
  return false;
}

/** Nós a partir dos quais se chega a `target` (busca reversa). */
function reachingSet(g: Graph, target: string): Set<string> {
  const reverse: Graph = new Map();
  for (const [from, tos] of g) for (const to of tos) reverse.set(to, [...(reverse.get(to) ?? []), from]);
  const seen = new Set<string>([target]);
  const stack = [target];
  while (stack.length) {
    for (const prev of reverse.get(stack.pop()!) ?? []) {
      if (!seen.has(prev)) {
        seen.add(prev);
        stack.push(prev);
      }
    }
  }
  return seen;
}

// Simulação: como ficaria o mundo com o item editado

export interface OwnerDraft {
  /** Item que recebe as dependências; para um item novo, use `id: NEW_ID`. */
  ref: ItemRef;
  /** Tarefa: id da etapa; etapa: id da etapa pai. Ignorado para projetos. */
  parent?: string | null;
  dependencies: Dependency[];
}

/** Cópia dos dados com o item no estado do formulário (criando um provisório se for novo). */
function simulate(owner: OwnerDraft): Project[] {
  const world = structuredClone(db.projects) as Project[];
  const { ref } = owner;
  const deps = owner.dependencies.map((d) => ({ ...d }));
  if (ref.kind === 'project') {
    let p = projectIn(world, ref.projectId);
    if (!p) {
      p = {
        id: ref.projectId, name: 'Novo projeto', description: '', status: 'Em espera', owner: '', due: '', archived: false, coordinators: [], contratanteId: '',
        processo: '', convOrgao: '', convNumero: '', convValor: '', convContra: '', convPolitico: '',
        dependencies: [], branches: [], tasks: [], milestones: [], activity: [], chat: [],
      };
      world.push(p);
    }
    p.dependencies = deps;
    return world;
  }
  const p = projectIn(world, ref.projectId);
  if (!p) return world;
  if (ref.kind === 'branch') {
    let b = p.branches.find((x) => x.id === ref.id);
    if (!b) {
      b = { id: ref.id, name: 'Nova etapa', parent: null, designer: null, status: 'A fazer', x: 0, y: 0, dependencies: [] };
      p.branches.push(b);
    }
    if (owner.parent !== undefined) b.parent = owner.parent;
    b.dependencies = deps;
    return world;
  }
  let t = p.tasks.find((x) => x.id === ref.id);
  if (!t) {
    t = { id: ref.id, title: 'Nova tarefa', status: 'A fazer', priority: 'Média', assignees: [], assignee: '', due: '', branch: '', description: '', tags: '', dependencies: [], subtasks: [], comments: [], links: [] };
    p.tasks.push(t);
  }
  if (owner.parent !== undefined) t.branch = owner.parent ?? '';
  t.dependencies = deps;
  return world;
}

/** Itens que não podem ser escolhidos como dependência do item (o próprio item e os que criariam ciclo). */
export function forbiddenTargets(owner: OwnerDraft): Set<string> {
  const world = simulate({ ...owner, dependencies: [] });
  const reach = reachingSet(buildGraph(world), gKey(owner.ref));
  const out = new Set<string>([refKey(owner.ref)]);
  for (const node of reach) if (node.startsWith('S|')) out.add(node.slice(2));
  return out;
}

/**
 * Valida as dependências de um item antes de gravar.
 * Devolve as dependências limpas (sem duplicadas) ou lança DependencyError.
 */
export function validateDependencies(owner: OwnerDraft): Dependency[] {
  const seen = new Set<string>();
  const clean: Dependency[] = [];
  for (const d of owner.dependencies) {
    const ref = depRef(d);
    const key = refKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    if (key === refKey(owner.ref)) throw new DependencyError('Um item não pode depender de si mesmo.');
    clean.push({ ...d, id: d.id || uid('d'), projectId: d.kind === 'project' ? d.targetId : d.projectId });
  }
  // Item escolhido agora precisa existir; um que já estava salvo e sumiu é mantido (aparece como inválido e não bloqueia).
  const saved = new Set((resolveRef(owner.ref) ? dependenciesOfItem(resolveRef(owner.ref)!) : []).map((d) => refKey(depRef(d))));
  for (const d of clean) {
    if (!resolveRef(depRef(d)) && !saved.has(refKey(depRef(d)))) throw new DependencyError('Um dos itens escolhidos como dependência não existe mais.');
  }
  const g = buildGraph(simulate({ ...owner, dependencies: clean }));
  for (const d of clean) {
    if (reaches(g, sKey(depRef(d)), gKey(owner.ref))) {
      const target = resolveRef(depRef(d));
      throw new DependencyError(`Dependência circular: “${target?.name ?? 'item'}” depende, direta ou indiretamente, deste item.`);
    }
  }
  // Mudar a etapa (ou o pai) também pode fechar um ciclo com dependências de outros itens.
  const onCycle = (key: string): boolean => (g.get(key) ?? []).some((next) => reaches(g, next, key));
  if (onCycle(gKey(owner.ref)) || onCycle(sKey(owner.ref))) {
    throw new DependencyError('Essa posição criaria uma dependência circular com outros itens.');
  }
  return clean;
}

/** Bloqueios que o item teria no estado do formulário. */
export function draftBlockers(owner: OwnerDraft): Blocker[] {
  return blockersOf(owner.ref, simulate(owner));
}

/** Mensagem para quando o avanço é impedido; `what` já vem com o artigo e o gênero ("A tarefa está bloqueada"). */
export function blockedMessage(what: string, blockers: Blocker[]): string {
  const first = blockers[0];
  if (!first) return '';
  const more = blockers.length > 1 ? ` (e mais ${plural(blockers.length - 1, 'condição pendente', 'condições pendentes')})` : '';
  return `${what}: ${blockerText(first)}${more}.`;
}

// Limpeza quando um item deixa de existir

/** Remove de todos os itens as dependências que apontam para `ref`. Devolve os projetos afetados. */
export function dropDependenciesOn(ref: ItemRef): Project[] {
  const key = refKey(ref);
  const touched = new Set<Project>();
  const keep = (list: Dependency[], p: Project): Dependency[] => {
    const next = list.filter((d) => refKey(depRef(d)) !== key);
    if (next.length !== list.length) touched.add(p);
    return next;
  };
  for (const p of db.projects) {
    p.dependencies = keep(p.dependencies, p);
    for (const b of p.branches) b.dependencies = keep(b.dependencies, p);
    for (const t of p.tasks) t.dependencies = keep(t.dependencies, p);
  }
  return [...touched];
}

/** Dependências iguais (mesmos alvos e condições)? Usado para registrar alterações no histórico. */
export function sameDependencies(a: Dependency[], b: Dependency[]): boolean {
  const sig = (l: Dependency[]): string =>
    l
      .map((d) => `${refKey(depRef(d))}:${d.condition}`)
      .sort()
      .join(',');
  return sig(a) === sig(b);
}
