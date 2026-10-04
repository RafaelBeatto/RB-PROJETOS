import type { Project } from '../types/project';
import type { Task, TaskDraft, TaskStatus } from '../types/task';
import { today } from '../utils/date';
import { uid } from '../utils/ids';
import { logActivity, logTaskStatus } from './activityService';
import { persistProjects } from './db';
import { currentActor } from './userService';

export function findTask(p: Project, id: string | null | undefined): Task | undefined {
  return id ? p.tasks.find((t) => t.id === id) : undefined;
}

export function isLate(t: Task): boolean {
  return t.status !== 'Concluído' && !!t.due && t.due < today();
}

/** Bloqueada quando alguma dependência ainda não foi concluída. */
export function isBlocked(t: Task, p: Project): boolean {
  return t.dependencies.some((id) => findTask(p, id)?.status !== 'Concluído');
}

export function dependenciesOf(t: Task, p: Project): Task[] {
  return t.dependencies.map((id) => findTask(p, id)).filter((x): x is Task => !!x);
}

export function dependentsOf(t: Task, p: Project): Task[] {
  return p.tasks.filter((x) => x.dependencies.includes(t.id));
}

export function moveTask(p: Project, t: Task, status: TaskStatus): void {
  if (t.status !== status) {
    t.status = status;
    logTaskStatus(p, t);
  }
  persistProjects();
}

/** Cria ou atualiza; registra mudança de status e itens de checklist concluídos. */
export function saveTask(p: Project, task: Task | undefined, draft: TaskDraft): Task {
  if (!task) {
    const created: Task = { id: uid('t'), tags: '', comments: [], links: [], ...draft };
    p.tasks.push(created);
    logActivity(p, `criou "${created.title}"`, { kind: 'task', task: created.id, branch: created.branch });
    persistProjects();
    return created;
  }
  const oldStatus = task.status;
  const doneBefore = new Set(task.subtasks.filter((s) => s.done).map((s) => s.id));
  Object.assign(task, draft);
  if (oldStatus !== task.status) logTaskStatus(p, task);
  for (const s of task.subtasks) {
    if (s.done && !doneBefore.has(s.id)) {
      logActivity(p, `concluiu o item "${s.title}" em "${task.title}"`, { kind: 'checklist', task: task.id, branch: task.branch });
    }
  }
  persistProjects();
  return task;
}

export function deleteTask(p: Project, task: Task): void {
  logActivity(p, `excluiu a tarefa "${task.title}"`, { kind: 'task', branch: task.branch });
  p.tasks = p.tasks.filter((x) => x.id !== task.id);
  for (const x of p.tasks) x.dependencies = x.dependencies.filter((d) => d !== task.id);
  persistProjects();
}

export function setSubtaskDone(p: Project, task: Task, subtaskId: string, done: boolean): void {
  const s = task.subtasks.find((x) => x.id === subtaskId);
  if (!s) return;
  s.done = done;
  if (done) logActivity(p, `concluiu o item "${s.title}" em "${task.title}"`, { kind: 'checklist', task: task.id, branch: task.branch });
  persistProjects();
}

export function addComment(p: Project, task: Task, text: string): void {
  task.comments.push({ id: uid('c'), who: currentActor(p.owner), text, at: new Date().toISOString() });
  logActivity(p, `comentou em "${task.title}"`, { kind: 'comment', task: task.id, branch: task.branch });
  persistProjects();
}

export function addLink(task: Task, url: string, label: string): void {
  task.links.push({ id: uid('l'), url, label });
  persistProjects();
}

export function removeLink(task: Task, linkId: string): void {
  task.links = task.links.filter((l) => l.id !== linkId);
  persistProjects();
}

export function checklistProgress(t: Task): { done: number; total: number } {
  return { done: t.subtasks.filter((s) => s.done).length, total: t.subtasks.length };
}
