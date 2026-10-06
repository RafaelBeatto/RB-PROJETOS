/**
 * Converte o que estiver salvo (versões antigas do RB Projects) para o formato atual.
 * Campos ausentes recebem valores padrão e valores inválidos são corrigidos para o mais
 * próximo válido. A função é idempotente.
 *
 * Conversões das regras atuais (dados de versões anteriores):
 * - Projeto "Concluído" vira projeto encerrado (arquivado) com status "Em análise".
 * - Etapas deixam de ter subníveis: subetapas viram etapas do projeto, com as mesmas tarefas.
 * - Etapa: "A fazer" → "Em espera"; "Em revisão" → "Em andamento". Tarefa: "Em revisão" → "Em andamento".
 * - O antigo "checklist" das tarefas (guardado em `subtasks`) passa para `checklist`.
 * - Dependências: ficam só as de tarefa para tarefa do mesmo projeto; as demais são descartadas.
 * - Responsáveis de etapa e de tarefa: no máximo dois (ficam os primeiros).
 */
import { ACTIVITY_KINDS, type Activity, type ActivityKind } from '../types/activity';
import { BRANCH_STATUSES, type Branch, type BranchStatus } from '../types/branch';
import type { ChatMessage } from '../types/chat';
import { MILESTONE_STATUSES, PROJECT_STATUSES, type Milestone, type MilestoneStatus, type Project, type ProjectStatus } from '../types/project';
import {
  MAX_RESPONSIBLES,
  PRIORITIES,
  TASK_STATUSES,
  type ChecklistItem,
  type OptionalPriority,
  type Subtask,
  type Task,
  type TaskComment,
  type TaskStatus,
} from '../types/task';
import type { User } from '../types/user';
import { uid } from '../utils/ids';

type Raw = Record<string, unknown>;

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const objs = (v: unknown): Raw[] => list(v).filter(isObj);
const ids = (v: unknown): string[] => list(v).map((x) => str(x)).filter((x, i, all) => !!x && all.indexOf(x) === i);
const oneOf = <T extends string>(options: readonly T[], v: unknown, fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
const priority = (v: unknown): OptionalPriority => oneOf<OptionalPriority>(['', ...PRIORITIES], v, '');

function migrateTaskStatus(v: unknown): TaskStatus {
  if (v === 'Em revisão') return 'Em andamento';
  return oneOf<TaskStatus>(TASK_STATUSES, v, 'A fazer');
}

function migrateBranchStatus(v: unknown): BranchStatus {
  if (v === 'A fazer') return 'Em espera';
  if (v === 'Em revisão') return 'Em andamento';
  return oneOf<BranchStatus>(BRANCH_STATUSES, v, 'Em espera');
}

/** Registro de conclusão (quem e quando), se existir e tiver uma data válida. */
function completion(r: Raw): { doneBy?: string; doneByName?: string; doneAt?: string } {
  const at = str(r.doneAt);
  return at && !Number.isNaN(Date.parse(at)) ? { doneBy: str(r.doneBy), doneByName: str(r.doneByName), doneAt: at } : {};
}

/** Só itens concluídos guardam o registro de conclusão. */
const completionIfDone = (r: Raw, status: string): ReturnType<typeof completion> => (status === 'Concluído' ? completion(r) : {});

function migrateChecklistItem(r: Raw): ChecklistItem {
  // Formato antigo: { title, done }.
  return { id: str(r.id) || uid('ck'), text: str(r.text) || str(r.title), done: r.done === true, ...(r.done === true ? completion(r) : {}) };
}

function migrateSubtask(r: Raw): Subtask {
  return {
    id: str(r.id) || uid('s'),
    title: str(r.title),
    description: str(r.description),
    priority: priority(r.priority),
    start: str(r.start),
    due: str(r.due),
    status: migrateTaskStatus(r.status),
    ...completionIfDone(r, migrateTaskStatus(r.status)),
  };
}

function migrateComment(r: Raw): TaskComment {
  return { id: str(r.id) || uid('c'), who: str(r.who), text: str(r.text), at: str(r.at) };
}

function migrateChatMessage(r: Raw): ChatMessage {
  return {
    id: str(r.id) || uid('m'),
    userId: str(r.userId),
    who: str(r.who),
    text: str(r.text),
    at: str(r.at),
    mentions: ids(r.mentions),
    everyone: r.everyone === true,
  };
}

/**
 * Dependências de tarefa: o formato mais antigo era uma lista de ids de tarefas do mesmo projeto;
 * o seguinte guardava tipo, projeto e alvo. Só tarefa → tarefa do mesmo projeto continua valendo.
 */
function migrateTaskDependencies(v: unknown, projectId: string): string[] {
  const out: string[] = [];
  for (const item of list(v)) {
    let target = '';
    if (typeof item === 'string') target = item;
    // Formato com objetos: só etapa ou tarefa do mesmo projeto (dependência de projeto inteiro não existe mais).
    else if (isObj(item) && ['task', 'branch'].includes(str(item.kind) || 'task') && (str(item.projectId) || projectId) === projectId) target = str(item.targetId);
    if (target && !out.includes(target)) out.push(target);
  }
  return out;
}

function migrateTask(r: Raw, projectId: string): Task {
  // Antes de existirem subtarefas, `subtasks` guardava o checklist ({ title, done }).
  const hasChecklist = Array.isArray(r.checklist);
  return {
    id: str(r.id) || uid('t'),
    title: str(r.title),
    status: migrateTaskStatus(r.status),
    priority: priority(r.priority),
    assignees: ids(r.assignees).slice(0, MAX_RESPONSIBLES),
    assignee: str(r.assignee),
    start: str(r.start),
    due: str(r.due),
    branch: str(r.branch),
    description: str(r.description),
    tags: str(r.tags),
    dependencies: migrateTaskDependencies(r.dependencies, projectId),
    checklist: objs(hasChecklist ? r.checklist : r.subtasks).map(migrateChecklistItem),
    subtasks: hasChecklist ? objs(r.subtasks).map(migrateSubtask) : [],
    comments: objs(r.comments).map(migrateComment),
    ...completionIfDone(r, migrateTaskStatus(r.status)),
  };
}

function migrateBranch(r: Raw, tasks: Task[], raw: Raw[], projectId: string): Branch {
  const id = str(r.id) || uid('b');
  // Antes havia um único responsável, em `designer`.
  const assignees = Array.isArray(r.assignees) ? ids(r.assignees) : ids([r.designer]);
  const status = typeof r.status === 'string' ? migrateBranchStatus(r.status) : statusFromTasks(id, tasks, raw);
  return {
    id,
    name: str(r.name),
    description: str(r.description),
    priority: priority(r.priority),
    start: str(r.start),
    due: str(r.due),
    status,
    assignees: assignees.slice(0, MAX_RESPONSIBLES),
    dependencies: migrateTaskDependencies(r.dependencies, projectId),
    ...completionIfDone(r, status),
  };
}

/** Etapas muito antigas (sem status) começam na coluna que as tarefas de dentro (e das subetapas) indicam. */
function statusFromTasks(id: string, tasks: Task[], raw: Raw[]): BranchStatus {
  const inside = new Set([id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const b of raw) {
      const parent = str(b.parent);
      if (parent && inside.has(parent) && !inside.has(str(b.id))) grew = !!inside.add(str(b.id));
    }
  }
  const own = tasks.filter((t) => inside.has(t.branch));
  if (own.length && own.every((t) => t.status === 'Concluído')) return 'Concluído';
  if (own.some((t) => t.status !== 'A fazer')) return 'Em andamento';
  return 'Em espera';
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

/** "Planejamento" virou "Em espera"; "Atrasado" deixou de ser status (o atraso vem da data de término). */
function migrateProjectStatus(v: unknown): ProjectStatus {
  if (v === 'Planejamento') return 'Em espera';
  if (v === 'Atrasado') return 'Em andamento';
  if (v === 'Concluído') return 'Em análise';
  return oneOf<ProjectStatus>(PROJECT_STATUSES, v, 'Em espera');
}

export function migrateProject(r: Raw): Project {
  const id = str(r.id) || uid('p');
  const rawBranches = objs(r.branches);
  const tasks = objs(r.tasks).map((t) => migrateTask(t, id));
  const branches = rawBranches.map((b) => migrateBranch(b, tasks, rawBranches, id));
  // Dependência só de etapas e tarefas que existem neste projeto, e nunca do item com ele mesmo.
  const known = new Set([...tasks.map((t) => t.id), ...branches.map((b) => b.id)]);
  for (const t of tasks) t.dependencies = t.dependencies.filter((d) => d !== t.id && d !== t.branch && known.has(d));
  for (const b of branches) b.dependencies = b.dependencies.filter((d) => d !== b.id && known.has(d) && !tasks.some((t) => t.id === d && t.branch === b.id));
  return {
    id,
    name: str(r.name),
    description: str(r.description),
    status: migrateProjectStatus(r.status),
    priority: priority(r.priority),
    start: str(r.start),
    due: str(r.due),
    owner: str(r.owner),
    // Projeto concluído na versão anterior = projeto encerrado.
    archived: r.archived === true || r.status === 'Concluído',
    processo: str(r.processo),
    convOrgao: str(r.convOrgao),
    convNumero: str(r.convNumero),
    convValor: str(r.convValor),
    convContra: str(r.convContra),
    convPolitico: str(r.convPolitico),
    coordinators: ids(r.coordinators),
    // Antes se chamava prefeituraId.
    contratanteId: str(r.contratanteId) || str(r.prefeituraId),
    branches,
    tasks,
    milestones: objs(r.milestones).map(migrateMilestone),
    activity: objs(r.activity).map(migrateActivity),
    chat: objs(r.chat).map(migrateChatMessage),
  };
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
    phone: str(r.phone),
    photo: str(r.photo),
    role: str(r.role),
    color: str(r.color) || '#3b82f6',
    // Campos de acesso: vazios em dados antigos; completados em userService.upgradeLegacyUser.
    profileId: str(r.profileId),
    active: r.active !== false,
    projectIds: Array.isArray(r.projectIds) ? ids(r.projectIds) : null,
    createdAt: str(r.createdAt),
    passwordHash: str(r.passwordHash),
    passwordSalt: str(r.passwordSalt),
  }));
}
