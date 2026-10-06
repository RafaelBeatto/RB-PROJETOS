/**
 * Atividades de cada colaborador (módulo Colaboradores).
 *
 * Vínculos considerados (sem misturar com a coordenação do projeto):
 * - Tarefa: o usuário está entre os responsáveis da tarefa (`task.assignees`).
 * - Etapa: o usuário está entre os responsáveis da etapa (`branch.assignees`).
 * Projetos encerrados (arquivados) e os que o usuário logado não vê ficam de fora.
 *
 * O agrupamento usa só os estados que já existem no sistema:
 * - Concluídas: status "Concluído".
 * - Em espera: etapa "Em espera"/"Em pausa" ou projeto "Em espera"/"Em pausa".
 * - Em andamento: "Em andamento".
 * - A fazer: "A fazer".
 * Dependências são informativas e não colocam nada em espera.
 */
import type { Branch, BranchStatus } from '../types/branch';
import type { Project } from '../types/project';
import type { OptionalPriority, Task, TaskStatus } from '../types/task';
import type { User } from '../types/user';
import { today } from '../utils/date';
import { authorize, visibleProjects } from './permissionService';
import { findUser } from './userService';

export type ActivityGroup = 'todo' | 'doing' | 'waiting' | 'done';

export const GROUP_LABELS: Record<ActivityGroup, string> = {
  todo: 'A fazer',
  doing: 'Em andamento',
  waiting: 'Em espera',
  done: 'Concluídas',
};
export const GROUP_ORDER: ActivityGroup[] = ['todo', 'doing', 'waiting', 'done'];

export interface PathStep {
  /** "Projeto", "Etapa" ou "Tarefa". */
  label: string;
  name: string;
}

export interface CollaboratorActivity {
  kind: 'task' | 'branch';
  project: Project;
  branch?: Branch;
  task?: Task;
  name: string;
  status: TaskStatus | BranchStatus;
  due: string;
  priority?: OptionalPriority;
  group: ActivityGroup;
  /** Motivo da espera (ex.: projeto em pausa). */
  waitingReason: string;
  late: boolean;
  /** Caminho completo: Projeto → Etapa → Tarefa. */
  path: PathStep[];
  /** Outros colaboradores da mesma tarefa. */
  others: string[];
}

const WAITING = ['Em espera', 'Em pausa'];

function etapaSteps(b: Branch): PathStep[] {
  return [{ label: 'Etapa', name: b.name }];
}

function classify(status: TaskStatus | BranchStatus, p: Project, b: Branch | undefined): { group: ActivityGroup; waitingReason: string } {
  if (status === 'Concluído') return { group: 'done', waitingReason: '' };
  if (WAITING.includes(p.status)) return { group: 'waiting', waitingReason: `Projeto “${p.name}” está ${p.status.toLowerCase()}` };
  if (b && WAITING.includes(b.status)) return { group: 'waiting', waitingReason: `Etapa “${b.name}” está ${b.status.toLowerCase()}` };
  if (WAITING.includes(status)) return { group: 'waiting', waitingReason: '' };
  return { group: status === 'A fazer' ? 'todo' : 'doing', waitingReason: '' };
}

function taskActivity(p: Project, t: Task, user: User): CollaboratorActivity {
  const branch = p.branches.find((b) => b.id === t.branch);
  const path: PathStep[] = [{ label: 'Projeto', name: p.name }, ...(branch ? etapaSteps(branch) : []), { label: 'Tarefa', name: t.title }];
  const others = t.assignees
    .filter((id) => id !== user.id)
    .map((id) => findUser(id)?.name ?? '')
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
    late: t.status !== 'Concluído' && !!t.due && t.due < today(),
    path,
    others,
    ...classify(t.status, p, branch),
  };
}

function branchActivity(p: Project, b: Branch): CollaboratorActivity {
  return {
    kind: 'branch',
    project: p,
    branch: b,
    name: b.name,
    status: b.status,
    due: b.due,
    priority: b.priority,
    late: b.status !== 'Concluído' && !!b.due && b.due < today(),
    path: [{ label: 'Projeto', name: p.name }, ...etapaSteps(b)],
    others: [],
    ...classify(b.status, p, undefined),
  };
}

/** Tudo o que está vinculado ao usuário, só dele (nunca de outros colaboradores). */
export function activitiesOf(user: User): CollaboratorActivity[] {
  const out: CollaboratorActivity[] = [];
  for (const p of visibleProjects()) {
    if (p.archived) continue;
    for (const b of p.branches) if (b.assignees.includes(user.id)) out.push(branchActivity(p, b));
    for (const t of p.tasks) if (t.assignees.includes(user.id)) out.push(taskActivity(p, t, user));
  }
  // Atrasadas primeiro; depois por prazo.
  const weight = (a: CollaboratorActivity): number => (a.late ? 0 : 1);
  return out.sort((a, b) => weight(a) - weight(b) || (a.due || '9').localeCompare(b.due || '9') || a.name.localeCompare(b.name, 'pt-BR'));
}

export interface CollaboratorSummary {
  tasks: number;
  etapas: number;
  done: number;
  pending: number;
  waiting: number;
  late: number;
  /** Atrasadas. */
  attention: number;
}

export function summarize(list: CollaboratorActivity[]): CollaboratorSummary {
  const pending = list.filter((a) => a.group !== 'done');
  return {
    tasks: list.filter((a) => a.kind === 'task').length,
    etapas: list.filter((a) => a.kind === 'branch').length,
    done: list.length - pending.length,
    pending: pending.length,
    waiting: pending.filter((a) => a.group === 'waiting').length,
    late: pending.filter((a) => a.late).length,
    attention: pending.filter((a) => a.late).length,
  };
}

/** Leitura administrativa: exige a permissão do módulo. */
export function collaboratorData(user: User): { activities: CollaboratorActivity[]; summary: CollaboratorSummary } {
  authorize('collaborators', 'view');
  const activities = activitiesOf(user);
  return { activities, summary: summarize(activities) };
}
