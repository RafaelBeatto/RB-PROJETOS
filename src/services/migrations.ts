/**
 * Converte o que estiver salvo (versões antigas do RB Projects) para o formato atual.
 * Nada é descartado: campos ausentes recebem valores padrão e valores inválidos
 * são corrigidos para o mais próximo válido. A função é idempotente.
 */
import { ACTIVITY_KINDS, type Activity, type ActivityKind } from '../types/activity';
import type { Branch } from '../types/branch';
import { DEP_CONDITIONS, DEP_KINDS, type DepCondition, type DepKind, type Dependency } from '../types/dependency';
import { MILESTONE_STATUSES, PROJECT_STATUSES, type Milestone, type MilestoneStatus, type Project, type ProjectStatus } from '../types/project';
import { PRIORITIES, TASK_STATUSES, type Priority, type Subtask, type Task, type TaskComment, type TaskLink, type TaskStatus } from '../types/task';
import type { User } from '../types/user';
import { uid } from '../utils/ids';

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objs = (v: unknown): Raw[] => list(v).filter(isObj);
const oneOf = <T extends string>(options: readonly T[], v: unknown, fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;

function migrateSubtask(r: Raw): Subtask {
  return { id: str(r.id) || uid('s'), title: str(r.title), done: r.done === true };
}

function migrateComment(r: Raw): TaskComment {
  return { id: str(r.id) || uid('c'), who: str(r.who), text: str(r.text), at: str(r.at) };
}

function migrateLink(r: Raw): TaskLink {
  return { id: str(r.id) || uid('l'), url: str(r.url), label: str(r.label) };
}

/**
 * Dependências: o formato antigo era uma lista de ids de tarefas do mesmo projeto
 * (condição implícita "concluída"); o atual guarda tipo, projeto, alvo e condição.
 */
function migrateDependencies(v: unknown, projectId: string): Dependency[] {
  const seen = new Set<string>();
  const out: Dependency[] = [];
  for (const item of list(v)) {
    let dep: Dependency | undefined;
    if (typeof item === 'string' && item) {
      dep = { id: uid('d'), kind: 'task', projectId, targetId: item, condition: 'done' };
    } else if (isObj(item)) {
      const kind = oneOf<DepKind>(DEP_KINDS, item.kind, 'task');
      const pid = str(item.projectId) || projectId;
      const targetId = kind === 'project' ? str(item.targetId) || pid : str(item.targetId);
      if (targetId) dep = { id: str(item.id) || uid('d'), kind, projectId: kind === 'project' ? targetId : pid, targetId, condition: oneOf<DepCondition>(DEP_CONDITIONS, item.condition, 'done') };
    }
    const key = dep && `${dep.kind}|${dep.projectId}|${dep.targetId}`;
    if (dep && key && !seen.has(key)) {
      seen.add(key);
      out.push(dep);
    }
  }
  return out;
}

/** "Planejamento" virou "Em espera"; "Atrasado" deixou de ser status (o atraso vem do prazo). */
function migrateProjectStatus(v: unknown): ProjectStatus {
  if (v === 'Planejamento') return 'Em espera';
  if (v === 'Atrasado') return 'Em andamento';
  return oneOf<ProjectStatus>(PROJECT_STATUSES, v, 'Em espera');
}

function migrateTask(r: Raw, projectId: string): Task {
  return {
    id: str(r.id) || uid('t'),
    title: str(r.title),
    status: oneOf<TaskStatus>(TASK_STATUSES, r.status, 'A fazer'),
    priority: oneOf<Priority>(PRIORITIES, r.priority, 'Média'),
    assignee: str(r.assignee),
    due: str(r.due),
    branch: str(r.branch),
    description: str(r.description),
    tags: str(r.tags),
    dependencies: migrateDependencies(r.dependencies, projectId),
    subtasks: objs(r.subtasks).map(migrateSubtask),
    comments: objs(r.comments).map(migrateComment),
    links: objs(r.links).map(migrateLink),
  };
}

function migrateBranch(r: Raw, projectId: string): Branch {
  return {
    id: str(r.id) || uid('b'),
    name: str(r.name),
    parent: str(r.parent) || null,
    designer: str(r.designer) || null,
    dependencies: migrateDependencies(r.dependencies, projectId),
    // NaN marca "sem posição"; ensureLayout calcula depois.
    x: num(r.x) ?? Number.NaN,
    y: num(r.y) ?? Number.NaN,
  };
}

function migrateMilestone(r: Raw): Milestone {
  return {
    id: str(r.id) || uid('m'),
    name: str(r.name),
    due: str(r.due),
    status: oneOf<MilestoneStatus>(MILESTONE_STATUSES, r.status, 'Pendente'),
  };
}

function migrateActivity(r: Raw): Activity {
  const a: Activity = { id: str(r.id) || uid('a'), at: str(r.at) || new Date(0).toISOString(), text: str(r.text) };
  if (typeof r.who === 'string') a.who = r.who;
  if (typeof r.kind === 'string' && r.kind in ACTIVITY_KINDS) a.kind = r.kind as ActivityKind;
  if (typeof r.task === 'string' && r.task) a.task = r.task;
  if (typeof r.branch === 'string' && r.branch) a.branch = r.branch;
  return a;
}

function migrateProject(r: Raw): Project {
  const root = isObj(r.root) && num(r.root.x) !== undefined && num(r.root.y) !== undefined ? { x: num(r.root.x)!, y: num(r.root.y)! } : undefined;
  const view =
    isObj(r.view) && num(r.view.x) !== undefined && num(r.view.y) !== undefined && num(r.view.z) !== undefined
      ? { x: num(r.view.x)!, y: num(r.view.y)!, z: num(r.view.z)! }
      : undefined;
  const id = str(r.id) || uid('p');
  const project: Project = {
    id,
    name: str(r.name),
    description: str(r.description),
    status: migrateProjectStatus(r.status),
    owner: str(r.owner),
    due: str(r.due),
    archived: r.archived === true,
    processo: str(r.processo),
    convOrgao: str(r.convOrgao),
    convNumero: str(r.convNumero),
    convValor: str(r.convValor),
    convContra: str(r.convContra),
    convPolitico: str(r.convPolitico),
    coordinators: list(r.coordinators).map((c) => str(c)).filter(Boolean),
    // Antes se chamava prefeituraId.
    contratanteId: str(r.contratanteId) || str(r.prefeituraId),
    dependencies: migrateDependencies(r.dependencies, id),
    branches: objs(r.branches).map((b) => migrateBranch(b, id)),
    tasks: objs(r.tasks).map((t) => migrateTask(t, id)),
    milestones: objs(r.milestones).map(migrateMilestone),
    activity: objs(r.activity).map(migrateActivity),
  };
  if (root) project.root = root;
  if (view) project.view = view;
  return project;
}

export interface MigratedProjects {
  projects: Project[];
  /** Projetos salvos antes de existirem coordenadores; recebem o responsável como coordenador. */
  withoutCoordinators: Set<string>;
}

export function migrateProjects(raw: unknown): MigratedProjects {
  const withoutCoordinators = new Set<string>();
  const projects = objs(raw).map((r) => {
    const p = migrateProject(r);
    if (!Array.isArray(r.coordinators)) withoutCoordinators.add(p.id);
    return p;
  });
  return { projects, withoutCoordinators };
}

export function migrateUsers(raw: unknown): User[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return objs(raw).map((r) => ({
    id: str(r.id) || uid('u'),
    name: str(r.name),
    email: str(r.email),
    role: str(r.role),
    color: str(r.color) || '#3b82f6',
    // Campos de acesso: vazios em dados antigos; completados em userService.upgradeLegacyUser.
    profileId: str(r.profileId),
    active: r.active !== false,
    createdAt: str(r.createdAt),
    passwordHash: str(r.passwordHash),
    passwordSalt: str(r.passwordSalt),
  }));
}
