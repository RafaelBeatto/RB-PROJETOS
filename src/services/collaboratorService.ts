/**
 * Atividades de cada colaborador (módulo Colaboradores).
 *
 * Vínculos considerados (sem misturar com a coordenação do projeto):
 * - Tarefa: o usuário está entre os colaboradores da tarefa (`task.assignees`).
 * - Etapa: o usuário é o responsável pela etapa (`branch.designer`).
 * Projetos arquivados ficam de fora: não são trabalho em andamento.
 *
 * O agrupamento usa só os estados que já existem no sistema:
 * - Concluídas: status "Concluído".
 * - Em espera ou bloqueadas: dependência pendente (própria ou herdada) ou projeto "Em espera"/"Em pausa".
 * - Em andamento: "Em andamento" ou "Em revisão".
 * - A fazer: "A fazer".
 */
import type { Branch } from '../types/branch';
import type { Project } from '../types/project';
import type { Priority, Task, TaskStatus } from '../types/task';
import type { User } from '../types/user';
import { today } from '../utils/date';
import { ancestorsOf } from './branchService';
import { db } from './db';
import { blockersOf, branchRef, taskRef, type Blocker } from './dependencyService';
import { authorize } from './permissionService';

export type ActivityGroup = 'todo' | 'doing' | 'waiting' | 'done';

export const GROUP_LABELS: Record<ActivityGroup, string> = {
  todo: 'A fazer',
  doing: 'Em andamento',
  waiting: 'Em espera ou bloqueadas',
  done: 'Concluídas',
};
export const GROUP_ORDER: ActivityGroup[] = ['todo', 'doing', 'waiting', 'done'];

export interface PathStep {
  /** "Projeto", "Etapa", "Subetapa" ou "Tarefa". */
  label: string;
  name: string;
}

export interface CollaboratorActivity {
  kind: 'task' | 'branch';
  project: Project;
  branch?: Branch;
  task?: Task;
  name: string;
  status: TaskStatus;
  due: string;
  priority?: Priority;
  group: ActivityGroup;
  blockers: Blocker[];
  /** Motivo da espera que não é dependência (ex.: projeto em pausa). */
  waitingReason: string;
  late: boolean;
  /** Caminho completo: Projeto → Etapa → (Subetapas) → Tarefa. */
  path: PathStep[];
  /** Outros colaboradores da mesma tarefa. */
  others: string[];
}

const PROJECT_WAITING = ['Em espera', 'Em pausa'];

function etapaSteps(p: Project, b: Branch): PathStep[] {
  return [...ancestorsOf(p, b), b].map((x, i) => ({ label: i === 0 ? 'Etapa' : 'Subetapa', name: x.name }));
}

function classify(status: TaskStatus, blockers: Blocker[], p: Project): { group: ActivityGroup; waitingReason: string } {
  if (status === 'Concluído') return { group: 'done', waitingReason: '' };
  if (blockers.length) return { group: 'waiting', waitingReason: '' };
  if (PROJECT_WAITING.includes(p.status)) return { group: 'waiting', waitingReason: `Projeto “${p.name}” está ${p.status.toLowerCase()}` };
  return { group: status === 'A fazer' ? 'todo' : 'doing', waitingReason: '' };
}

function taskActivity(p: Project, t: Task, user: User): CollaboratorActivity {
  const branch = p.branches.find((b) => b.id === t.branch);
  const blockers = t.status === 'Concluído' ? [] : blockersOf(taskRef(p, t));
  const path: PathStep[] = [{ label: 'Projeto', name: p.name }, ...(branch ? etapaSteps(p, branch) : []), { label: 'Tarefa', name: t.title }];
  const others = t.assignees
    .filter((id) => id !== user.id)
    .map((id) => db.users.find((u) => u.id === id)?.name ?? '')
    .filter(Boolean);
  return {
    kind: 'task',
    project: p,
    ...(branch ? { branch } : {}),
    task: t,
    name: t.title,
    status: t.status,
    due: t.due,
    priority: t.priority,
    blockers,
    late: t.status !== 'Concluído' && !!t.due && t.due < today(),
    path,
    others,
    ...classify(t.status, blockers, p),
  };
}

function branchActivity(p: Project, b: Branch): CollaboratorActivity {
  const blockers = b.status === 'Concluído' ? [] : blockersOf(branchRef(p, b));
  return {
    kind: 'branch',
    project: p,
    branch: b,
    name: b.name,
    status: b.status,
    due: '',
    blockers,
    late: false,
    path: [{ label: 'Projeto', name: p.name }, ...etapaSteps(p, b)],
    others: [],
    ...classify(b.status, blockers, p),
  };
}

/** Tudo o que está vinculado ao usuário, só dele (nunca de outros colaboradores). */
export function activitiesOf(user: User): CollaboratorActivity[] {
  const out: CollaboratorActivity[] = [];
  for (const p of db.projects) {
    if (p.archived) continue;
    for (const b of p.branches) if (b.designer === user.id) out.push(branchActivity(p, b));
    for (const t of p.tasks) if (t.assignees.includes(user.id)) out.push(taskActivity(p, t, user));
  }
  // Atrasadas e bloqueadas primeiro; depois por prazo.
  const weight = (a: CollaboratorActivity): number => (a.late ? 0 : a.blockers.length ? 1 : 2);
  return out.sort((a, b) => weight(a) - weight(b) || (a.due || '9').localeCompare(b.due || '9') || a.name.localeCompare(b.name, 'pt-BR'));
}

export interface CollaboratorSummary {
  tasks: number;
  etapas: number;
  done: number;
  pending: number;
  blocked: number;
  late: number;
  /** Atrasadas ou bloqueadas (sem contar duas vezes). */
  attention: number;
}

export function summarize(list: CollaboratorActivity[]): CollaboratorSummary {
  const pending = list.filter((a) => a.group !== 'done');
  return {
    tasks: list.filter((a) => a.kind === 'task').length,
    etapas: list.filter((a) => a.kind === 'branch').length,
    done: list.length - pending.length,
    pending: pending.length,
    blocked: pending.filter((a) => a.blockers.length).length,
    late: pending.filter((a) => a.late).length,
    attention: pending.filter((a) => a.late || a.blockers.length).length,
  };
}

/** Leitura administrativa: exige a permissão do módulo. */
export function collaboratorData(user: User): { activities: CollaboratorActivity[]; summary: CollaboratorSummary } {
  authorize('collaborators', 'view');
  const activities = activitiesOf(user);
  return { activities, summary: summarize(activities) };
}
