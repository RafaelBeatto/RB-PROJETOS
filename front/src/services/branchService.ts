import { BRANCH_STATUSES, type Branch, type BranchDraft, type BranchStatus } from '../types/branch';
import type { Project } from '../types/project';
import { MAX_RESPONSIBLES, type Task } from '../types/task';
import { pct } from '../utils/format';
import { uid } from '../utils/ids';
import { logActivity } from './activityService';
import { persistProjects } from './db';
import { canCreateBranch, canEditBranch, ensure } from './permissionService';
import { stampCompletion } from './completionService';
import { cleanDependencies } from './dependencyService';
import { RuleError } from './errors';
import type { Progress } from './projectService';
import { findUser } from './userService';

export function findBranch(p: Project, id: string | null | undefined): Branch | undefined {
  return id ? p.branches.find((b) => b.id === id) : undefined;
}

/** Tarefas da etapa, na ordem de criação. */
export function tasksIn(p: Project, branchId: string): Task[] {
  return p.tasks.filter((t) => t.branch === branchId);
}

/** Progresso da etapa: só a quantidade de tarefas concluídas ("Em andamento" não conta como parcial). */
export function branchProgress(p: Project, b: Branch): Progress {
  const tasks = tasksIn(p, b.id);
  const done = tasks.filter((t) => t.status === 'Concluído').length;
  return { total: tasks.length, done, pct: pct(done, tasks.length) };
}

/** Só usuários cadastrados, sem repetição, até o limite. */
export function cleanResponsibles(ids: string[]): string[] {
  const clean = ids.filter((id, i, all) => !!findUser(id) && all.indexOf(id) === i);
  if (clean.length > MAX_RESPONSIBLES) throw new RuleError(`Escolha no máximo ${MAX_RESPONSIBLES} responsáveis.`);
  return clean;
}

const names = (ids: string[]): string =>
  ids
    .map((id) => findUser(id)?.name)
    .filter(Boolean)
    .join(' e ');

function validate(p: Project, draft: BranchDraft, b?: Branch): BranchDraft {
  if (!draft.name.trim()) throw new RuleError('Informe o nome da etapa.');
  if (!BRANCH_STATUSES.includes(draft.status)) throw new RuleError('Status inválido.');
  return {
    ...draft,
    name: draft.name.trim(),
    assignees: cleanResponsibles(draft.assignees),
    dependencies: cleanDependencies(p, { kind: 'branch', id: b?.id ?? '' }, draft.dependencies, b?.dependencies),
  };
}

export function createBranch(p: Project, input: BranchDraft): Branch {
  ensure(canCreateBranch(p));
  const branch: Branch = { id: uid('b'), ...validate(p, input) };
  stampCompletion(branch, branch.status === 'Concluído');
  p.branches.push(branch);
  logActivity(p, `criou a etapa "${branch.name}"`, { kind: 'branch', branch: branch.id });
  persistProjects();
  return branch;
}

export function updateBranch(p: Project, b: Branch, input: BranchDraft): void {
  ensure(canEditBranch(p));
  const draft = validate(p, input, b);
  const old = { ...b };
  Object.assign(b, draft);
  stampCompletion(b, b.status === 'Concluído');
  if (old.name !== b.name) logActivity(p, `renomeou a etapa "${old.name}" para "${b.name}"`, { kind: 'branch', branch: b.id });
  if (old.status !== b.status) logActivity(p, `moveu a etapa "${b.name}" para ${b.status}`, { kind: 'branch', branch: b.id });
  if (String(old.dependencies) !== String(b.dependencies)) logActivity(p, `alterou as dependências da etapa "${b.name}"`, { kind: 'branch', branch: b.id });
  if (String(old.assignees) !== String(b.assignees)) {
    const who = names(b.assignees);
    logActivity(p, who ? `definiu ${who} como responsável pela etapa "${b.name}"` : `removeu os responsáveis da etapa "${b.name}"`, { kind: 'branch', branch: b.id });
  }
  persistProjects();
}

/** Muda o status (Kanban). A etapa pode ser concluída livremente, mesmo com tarefas abertas. */
export function setBranchStatus(p: Project, b: Branch, status: BranchStatus): boolean {
  ensure(canEditBranch(p));
  if (!BRANCH_STATUSES.includes(status) || b.status === status) return false;
  b.status = status;
  stampCompletion(b, status === 'Concluído');
  logActivity(p, `moveu a etapa "${b.name}" para ${status}`, { kind: 'branch', branch: b.id });
  persistProjects();
  return true;
}
