import type { Project } from '../types/project';
import { TASK_NOT_STARTED, type Task, type TaskDraft, type TaskStatus } from '../types/task';
import { today } from '../utils/date';
import { uid } from '../utils/ids';
import { logActivity, logTaskStatus } from './activityService';
import { ancestorsOf, findBranch } from './branchService';
import { persistProjects } from './db';
import {
  DependencyError,
  NEW_ID,
  blockedMessage,
  blockersOf,
  draftBlockers,
  dropDependenciesOn,
  sameDependencies,
  taskRef,
  validateDependencies,
} from './dependencyService';
import { authorize } from './permissionService';
import { currentActor, findUser } from './userService';

export function findTask(p: Project, id: string | null | undefined): Task | undefined {
  return id ? p.tasks.find((t) => t.id === id) : undefined;
}

export function isLate(t: Task): boolean {
  return t.status !== 'Concluído' && !!t.due && t.due < today();
}

/** Bloqueada quando alguma dependência (própria, da etapa ou do projeto) não foi atendida. */
export function isBlocked(t: Task, p: Project): boolean {
  return blockersOf(taskRef(p, t)).length > 0;
}

/** Tarefa bloqueada só pode ficar em "A fazer". */
function assertCanEnter(status: TaskStatus, previous: TaskStatus | undefined, blockers: ReturnType<typeof blockersOf>): void {
  if (status === TASK_NOT_STARTED || status === previous || !blockers.length) return;
  throw new DependencyError(blockedMessage('A tarefa está bloqueada e só pode ficar em “A fazer”', blockers));
}

/**
 * A etapa acompanha as tarefas de dentro: tarefa iniciada tira a etapa de "A fazer",
 * e tarefa aberta numa etapa concluída a reabre ("Em andamento").
 */
function syncEtapas(p: Project, t: Task): void {
  const b = findBranch(p, t.branch);
  if (!b) return;
  for (const etapa of [b, ...ancestorsOf(p, b)]) {
    const reopen = etapa.status === 'Concluído' && t.status !== 'Concluído';
    const start = etapa.status === TASK_NOT_STARTED && t.status !== TASK_NOT_STARTED;
    if (!reopen && !start) continue;
    etapa.status = 'Em andamento';
    logActivity(p, `moveu a etapa "${etapa.name}" para Em andamento (acompanhando "${t.title}")`, { kind: 'branch', branch: etapa.id });
  }
}

export function moveTask(p: Project, t: Task, status: TaskStatus): void {
  authorize('kanban', 'edit', p.id);
  authorize('tasks', 'edit', p.id);
  assertCanEnter(status, t.status, blockersOf(taskRef(p, t)));
  if (t.status !== status) {
    t.status = status;
    logTaskStatus(p, t);
    syncEtapas(p, t);
  }
  persistProjects();
}

/** Cria ou atualiza; registra mudança de status e itens de checklist concluídos. */
export function saveTask(p: Project, task: Task | undefined, draft: TaskDraft): Task {
  authorize('tasks', task ? 'edit' : 'create', p.id);
  // Tarefas vivem dentro das etapas: uma tarefa nova precisa de etapa.
  if (!task && !p.branches.some((b) => b.id === draft.branch)) throw new DependencyError('Escolha a etapa da tarefa: as tarefas ficam dentro das etapas.');
  const owner = { ref: { kind: 'task' as const, projectId: p.id, id: task?.id ?? NEW_ID }, parent: draft.branch, dependencies: draft.dependencies };
  const dependencies = validateDependencies(owner);
  assertCanEnter(draft.status, task?.status, draftBlockers({ ...owner, dependencies }));
  // Só usuários cadastrados, sem repetição.
  const assignees = draft.assignees.filter((id, i, all) => !!findUser(id) && all.indexOf(id) === i);
  draft = { ...draft, dependencies, assignees };
  if (!task) {
    const created: Task = { id: uid('t'), tags: '', comments: [], links: [], ...draft };
    p.tasks.push(created);
    logActivity(p, `criou "${created.title}"`, { kind: 'task', task: created.id, branch: created.branch });
    syncEtapas(p, created);
    persistProjects();
    return created;
  }
  const oldStatus = task.status;
  if (!sameDependencies(task.dependencies, dependencies)) logActivity(p, `alterou as dependências de "${task.title}"`, { kind: 'task', task: task.id, branch: draft.branch });
  if (String([...task.assignees].sort()) !== String([...assignees].sort())) {
    const names = assignees.map((id) => findUser(id)?.name).filter(Boolean).join(', ');
    logActivity(p, names ? `definiu ${names} em "${task.title}"` : `removeu os colaboradores de "${task.title}"`, { kind: 'task', task: task.id, branch: draft.branch });
  }
  const doneBefore = new Set(task.subtasks.filter((s) => s.done).map((s) => s.id));
  Object.assign(task, draft);
  if (oldStatus !== task.status) logTaskStatus(p, task);
  syncEtapas(p, task);
  for (const s of task.subtasks) {
    if (s.done && !doneBefore.has(s.id)) {
      logActivity(p, `concluiu o item "${s.title}" em "${task.title}"`, { kind: 'checklist', task: task.id, branch: task.branch });
    }
  }
  persistProjects();
  return task;
}

export function deleteTask(p: Project, task: Task): void {
  authorize('tasks', 'delete', p.id);
  logActivity(p, `excluiu a tarefa "${task.title}"`, { kind: 'task', branch: task.branch });
  p.tasks = p.tasks.filter((x) => x.id !== task.id);
  for (const other of dropDependenciesOn(taskRef(p, task))) {
    logActivity(other, `excluiu a tarefa "${task.title}" (${p.name}); ela foi retirada das dependências deste projeto`, { kind: 'task' });
  }
  persistProjects();
}

export function setSubtaskDone(p: Project, task: Task, subtaskId: string, done: boolean): void {
  authorize('tasks', 'edit', p.id);
  const s = task.subtasks.find((x) => x.id === subtaskId);
  if (!s) return;
  s.done = done;
  if (done) logActivity(p, `concluiu o item "${s.title}" em "${task.title}"`, { kind: 'checklist', task: task.id, branch: task.branch });
  persistProjects();
}

export function addComment(p: Project, task: Task, text: string): void {
  authorize('tasks', 'edit', p.id);
  task.comments.push({ id: uid('c'), who: currentActor(p.owner), text, at: new Date().toISOString() });
  logActivity(p, `comentou em "${task.title}"`, { kind: 'comment', task: task.id, branch: task.branch });
  persistProjects();
}

export function addLink(p: Project, task: Task, url: string, label: string): void {
  authorize('tasks', 'edit', p.id);
  task.links.push({ id: uid('l'), url, label });
  persistProjects();
}

export function removeLink(p: Project, task: Task, linkId: string): void {
  authorize('tasks', 'edit', p.id);
  task.links = task.links.filter((l) => l.id !== linkId);
  persistProjects();
}

export function checklistProgress(t: Task): { done: number; total: number } {
  return { done: t.subtasks.filter((s) => s.done).length, total: t.subtasks.length };
}
