import type { Project } from '../types/project';
import { TASK_STATUSES, type ChecklistItem, type Subtask, type SubtaskDraft, type Task, type TaskDraft, type TaskLink, type TaskStatus } from '../types/task';
import type { User } from '../types/user';
import { today } from '../utils/date';
import { uid } from '../utils/ids';
import { logActivity, logTaskStatus } from './activityService';
import { cleanResponsibles, findBranch } from './branchService';
import { cleanDependencies } from './dependencyService';
import { deleteFile, formatBytes, MAX_FILE_BYTES, putFile } from './fileStore';
import { persistProjects } from './db';
import { RuleError } from './errors';
import { canCreateSubtask, canCreateTask, canEditChecklist, canEditSubtask, canEditTask, ensure } from './permissionService';
import { currentActor, findUser } from './userService';

export function findTask(p: Project, id: string | null | undefined): Task | undefined {
  return id ? p.tasks.find((t) => t.id === id) : undefined;
}

export function isLate(t: { status: TaskStatus; due: string }): boolean {
  return t.status !== 'Concluído' && !!t.due && t.due < today();
}

// Tarefas

function validate(p: Project, draft: TaskDraft, task: Task | undefined): TaskDraft {
  if (!draft.title.trim()) throw new RuleError('Informe o título da tarefa.');
  if (!TASK_STATUSES.includes(draft.status)) throw new RuleError('Status inválido.');
  if (!findBranch(p, draft.branch)) throw new RuleError('Escolha a etapa da tarefa.');
  return {
    ...draft,
    title: draft.title.trim(),
    assignees: cleanResponsibles(draft.assignees),
    dependencies: cleanDependencies(p, { kind: 'task', id: task?.id ?? '', branch: draft.branch }, draft.dependencies, task?.dependencies),
  };
}

const peopleNames = (ids: string[]): string =>
  ids
    .map((id) => findUser(id)?.name)
    .filter(Boolean)
    .join(' e ');

export function createTask(p: Project, input: TaskDraft): Task {
  ensure(canCreateTask(p, findBranch(p, input.branch)));
  const draft = validate(p, input, undefined);
  const task: Task = { id: uid('t'), tags: '', checklist: [], subtasks: [], comments: [], links: [], ...draft };
  p.tasks.push(task);
  logActivity(p, `criou "${task.title}"`, { kind: 'task', task: task.id, branch: task.branch });
  persistProjects();
  return task;
}

export function updateTask(p: Project, task: Task, input: TaskDraft): void {
  ensure(canEditTask(p, task));
  const draft = validate(p, input, task);
  // Levar a tarefa para outra etapa exige poder criar tarefas lá.
  if (draft.branch !== task.branch) ensure(canCreateTask(p, findBranch(p, draft.branch)));
  const old = { ...task };
  Object.assign(task, draft);
  if (old.status !== task.status) logTaskStatus(p, task);
  if (String(old.dependencies) !== String(task.dependencies)) logActivity(p, `alterou as dependências de "${task.title}"`, { kind: 'task', task: task.id, branch: task.branch });
  if (String(old.assignees) !== String(task.assignees)) {
    const who = peopleNames(task.assignees);
    logActivity(p, who ? `definiu ${who} como responsável por "${task.title}"` : `removeu os responsáveis de "${task.title}"`, { kind: 'task', task: task.id, branch: task.branch });
  }
  if (old.branch !== task.branch) logActivity(p, `moveu "${task.title}" para a etapa "${findBranch(p, task.branch)?.name ?? ''}"`, { kind: 'task', task: task.id, branch: task.branch });
  persistProjects();
}

/** Muda o status (Kanban). Pode ser concluída livremente: subtarefas, checklist e dependências não impedem. */
export function setTaskStatus(p: Project, t: Task, status: TaskStatus): boolean {
  ensure(canEditTask(p, t));
  if (!TASK_STATUSES.includes(status) || t.status === status) return false;
  t.status = status;
  logTaskStatus(p, t);
  persistProjects();
  return true;
}

// Subtarefas: herdam os responsáveis da tarefa (não têm responsável próprio).

/** Responsáveis da subtarefa = responsáveis atuais da tarefa pai (sempre calculado, nunca copiado). */
export function subtaskResponsibles(t: Task): User[] {
  return t.assignees.map((id) => findUser(id)).filter((u): u is User => !!u);
}

export function findSubtask(t: Task, id: string | null | undefined): Subtask | undefined {
  return id ? t.subtasks.find((s) => s.id === id) : undefined;
}

function validateSubtask(draft: SubtaskDraft): SubtaskDraft {
  if (!draft.title.trim()) throw new RuleError('Informe o título da subtarefa.');
  if (!TASK_STATUSES.includes(draft.status)) throw new RuleError('Status inválido.');
  return { ...draft, title: draft.title.trim() };
}

export function createSubtask(p: Project, t: Task, input: SubtaskDraft): Subtask {
  ensure(canCreateSubtask(p, t));
  const subtask: Subtask = { id: uid('s'), ...validateSubtask(input) };
  t.subtasks.push(subtask);
  logActivity(p, `criou a subtarefa "${subtask.title}" em "${t.title}"`, { kind: 'subtask', task: t.id, branch: t.branch });
  persistProjects();
  return subtask;
}

export function updateSubtask(p: Project, t: Task, s: Subtask, input: SubtaskDraft): void {
  ensure(canEditSubtask(p, t));
  const draft = validateSubtask(input);
  const oldStatus = s.status;
  Object.assign(s, draft);
  if (oldStatus !== s.status) logActivity(p, `moveu a subtarefa "${s.title}" (${t.title}) para ${s.status}`, { kind: 'subtask', task: t.id, branch: t.branch });
  persistProjects();
}

export function setSubtaskStatus(p: Project, t: Task, s: Subtask, status: TaskStatus): void {
  ensure(canEditSubtask(p, t));
  if (!TASK_STATUSES.includes(status) || s.status === status) return;
  s.status = status;
  logActivity(p, `moveu a subtarefa "${s.title}" (${t.title}) para ${status}`, { kind: 'subtask', task: t.id, branch: t.branch });
  persistProjects();
}

// Checklist: só o responsável pela tarefa (ver canEditChecklist). Não é subtarefa.

export function addChecklistItem(p: Project, t: Task, text: string): ChecklistItem {
  ensure(canEditChecklist(p, t));
  if (!text.trim()) throw new RuleError('Escreva o texto do item.');
  const item: ChecklistItem = { id: uid('ck'), text: text.trim(), done: false };
  t.checklist.push(item);
  persistProjects();
  return item;
}

export function renameChecklistItem(p: Project, t: Task, id: string, text: string): void {
  ensure(canEditChecklist(p, t));
  const item = t.checklist.find((x) => x.id === id);
  if (!item || !text.trim()) return;
  item.text = text.trim();
  persistProjects();
}

export function setChecklistItemDone(p: Project, t: Task, id: string, done: boolean): void {
  ensure(canEditChecklist(p, t));
  const item = t.checklist.find((x) => x.id === id);
  if (!item) return;
  item.done = done;
  if (done) logActivity(p, `concluiu o item "${item.text}" em "${t.title}"`, { kind: 'checklist', task: t.id, branch: t.branch });
  persistProjects();
}

export function removeChecklistItem(p: Project, t: Task, id: string): void {
  ensure(canEditChecklist(p, t));
  t.checklist = t.checklist.filter((x) => x.id !== id);
  persistProjects();
}

export function checklistProgress(t: Task): { done: number; total: number } {
  return { done: t.checklist.filter((s) => s.done).length, total: t.checklist.length };
}

// Comentários e anexos: quem edita a tarefa.

export function addComment(p: Project, task: Task, text: string): void {
  ensure(canEditTask(p, task));
  task.comments.push({ id: uid('c'), who: currentActor(p.owner), text, at: new Date().toISOString() });
  logActivity(p, `comentou em "${task.title}"`, { kind: 'comment', task: task.id, branch: task.branch });
  persistProjects();
}

export function addLink(p: Project, task: Task, url: string, label: string): void {
  ensure(canEditTask(p, task));
  task.links.push({ id: uid('l'), url, label });
  persistProjects();
}

export function removeLink(p: Project, task: Task, linkId: string): void {
  ensure(canEditTask(p, task));
  const link = task.links.find((l) => l.id === linkId);
  task.links = task.links.filter((l) => l.id !== linkId);
  persistProjects();
  if (link?.fileId) void deleteFile(link.fileId);
}

/** Anexa um arquivo de verdade (guardado no navegador, ver fileStore). */
export async function addFile(p: Project, task: Task, file: File): Promise<TaskLink> {
  ensure(canEditTask(p, task));
  if (file.size > MAX_FILE_BYTES) throw new RuleError(`“${file.name}” passa de ${formatBytes(MAX_FILE_BYTES)}, o limite por arquivo.`);
  const fileId = uid('f');
  try {
    await putFile(fileId, file);
  } catch {
    throw new RuleError(`Não foi possível guardar “${file.name}” neste navegador (espaço cheio ou bloqueado).`);
  }
  const link: TaskLink = { id: uid('l'), url: '', label: file.name, fileId, size: file.size, mime: file.type };
  task.links.push(link);
  logActivity(p, `anexou "${file.name}" em "${task.title}"`, { kind: 'task', task: task.id, branch: task.branch });
  persistProjects();
  return link;
}
