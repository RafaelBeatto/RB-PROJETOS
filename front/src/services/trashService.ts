/**
 * Lixeira. Excluir nunca apaga direto: o item vai para a lixeira com tudo o que está dentro dele.
 * - Projeto → com etapas, tarefas e subtarefas.
 * - Etapa → com as tarefas (e subtarefas delas).
 * - Tarefa → com as subtarefas.
 * - Subtarefa → sozinha.
 *
 * Restaurar devolve o item ao lugar original (mesma posição na ordem de criação).
 * Um item cujo "pai" também está na lixeira só volta junto com ele ou depois dele,
 * para preservar a hierarquia. Excluir permanentemente leva junto o que dependia
 * do item na lixeira (ex.: tarefas excluídas antes de uma etapa excluída).
 */
import type { Project } from '../types/project';
import type { Subtask, Task } from '../types/task';
import { dropDependencies } from './dependencyService';
import { deleteFile } from './fileStore';
import { TRASH_LABELS, type TrashEntry, type TrashKind } from '../types/trash';
import { uid } from '../utils/ids';
import { logActivity } from './activityService';
import { findBranch, tasksIn } from './branchService';
import { db, persistProjects, persistTrash } from './db';
import {
  PermissionDeniedError,
  canDeleteBranch,
  canDeleteProject,
  canDeleteSubtask,
  canDeleteTask,
  canPurge,
  canRestore,
  ensure,
} from './permissionService';
import { findProject } from './projectService';
import { findTask } from './taskService';
import { currentActor, findUser } from './userService';

function add(entry: TrashEntry): void {
  db.trash.push(entry);
  persistTrash();
  persistProjects();
}

function base(p: Project, index: number): Pick<TrashEntry, 'id' | 'deletedAt' | 'deletedBy' | 'projectId' | 'projectName' | 'index'> {
  return { id: uid('lx'), deletedAt: new Date().toISOString(), deletedBy: currentActor(), projectId: p.id, projectName: p.name, index };
}

const indexOf = <T>(list: T[], item: T): number => Math.max(0, list.indexOf(item));

// Enviar para a lixeira

export function trashProject(p: Project): void {
  ensure(canDeleteProject(p));
  const index = indexOf(db.projects, p);
  db.projects = db.projects.filter((x) => x !== p);
  add({ ...base(p, index), kind: 'project', project: p });
}

export function trashBranch(p: Project, branchId: string): void {
  const b = findBranch(p, branchId);
  if (!b) return;
  ensure(canDeleteBranch(p));
  const tasks = tasksIn(p, b.id).map((t) => ({ ...t, index: indexOf(p.tasks, t) }));
  const index = indexOf(p.branches, b);
  p.branches = p.branches.filter((x) => x !== b);
  p.tasks = p.tasks.filter((t) => t.branch !== b.id);
  logActivity(p, `enviou a etapa "${b.name}" para a lixeira`, { kind: 'trash' });
  add({ ...base(p, index), kind: 'branch', branch: b, tasks });
}

export function trashTask(p: Project, taskId: string): void {
  const t = findTask(p, taskId);
  if (!t) return;
  ensure(canDeleteTask(p, t));
  const index = indexOf(p.tasks, t);
  p.tasks = p.tasks.filter((x) => x !== t);
  logActivity(p, `enviou a tarefa "${t.title}" para a lixeira`, { kind: 'trash', branch: t.branch });
  add({ ...base(p, index), kind: 'task', task: t });
}

export function trashSubtask(p: Project, t: Task, subtaskId: string): void {
  const s = t.subtasks.find((x) => x.id === subtaskId);
  if (!s) return;
  ensure(canDeleteSubtask(p, t));
  const index = indexOf(t.subtasks, s);
  t.subtasks = t.subtasks.filter((x) => x !== s);
  logActivity(p, `enviou a subtarefa "${s.title}" (${t.title}) para a lixeira`, { kind: 'trash', task: t.id, branch: t.branch });
  add({ ...base(p, index), kind: 'subtask', taskId: t.id, taskTitle: t.title, subtask: s });
}

// Leitura

const position = (e: TrashEntry): number => (Number.isFinite(e.index) ? e.index : Number.MAX_SAFE_INTEGER);

export function entryName(e: TrashEntry): string {
  switch (e.kind) {
    case 'project':
      return e.project.name;
    case 'branch':
      return e.branch.name;
    case 'task':
      return e.task.title;
    case 'subtask':
      return e.subtask.title;
  }
}

/** Onde o item estava: "Projeto / Etapa / Tarefa". */
export function entryPath(e: TrashEntry): string {
  if (e.kind === 'project') return '';
  const p = findProject(e.projectId);
  const projectName = p?.name ?? e.projectName;
  if (e.kind === 'branch') return projectName;
  if (e.kind === 'task') {
    const branch = p ? findBranch(p, e.task.branch) : undefined;
    return [projectName, branch?.name].filter(Boolean).join(' / ');
  }
  return [projectName, e.taskTitle].join(' / ');
}

/** "2 etapas, 5 tarefas, 3 subtarefas": o que vai (ou foi) junto para a lixeira. */
export function describeContents(branches: number, tasks: Task[], subtasks = tasks.reduce((n, t) => n + t.subtasks.length, 0)): string {
  const count = (n: number, one: string, many: string): string => (n ? `${n} ${n === 1 ? one : many}` : '');
  return [count(branches, 'etapa', 'etapas'), count(tasks.length, 'tarefa', 'tarefas'), count(subtasks, 'subtarefa', 'subtarefas')].filter(Boolean).join(', ');
}

export function entryContents(e: TrashEntry): string {
  if (e.kind === 'project') return describeContents(e.project.branches.length, e.project.tasks);
  if (e.kind === 'branch') return describeContents(0, e.tasks);
  if (e.kind === 'task') return describeContents(0, [], e.task.subtasks.length);
  return '';
}

export function kindLabel(kind: TrashKind): string {
  return TRASH_LABELS[kind];
}

/** Lixeira da exclusão mais recente para a mais antiga. */
export function trashEntries(): TrashEntry[] {
  return [...db.trash].reverse();
}

export function findEntry(id: string): TrashEntry | undefined {
  return db.trash.find((e) => e.id === id);
}

/** Entrada da lixeira que contém o "pai" do item (projeto, etapa ou tarefa), se houver. */
function parentEntry(e: TrashEntry, pool: TrashEntry[] = db.trash): TrashEntry | undefined {
  if (e.kind === 'project') return undefined;
  const sameProject = pool.filter((x) => x !== e && x.projectId === e.projectId);
  const project = sameProject.find((x) => x.kind === 'project');
  if (project) return project;
  if (e.kind === 'task') return sameProject.find((x) => x.kind === 'branch' && x.branch.id === e.task.branch);
  if (e.kind === 'subtask') {
    return sameProject.find((x) => (x.kind === 'task' && x.task.id === e.taskId) || (x.kind === 'branch' && x.tasks.some((t) => t.id === e.taskId)));
  }
  return undefined;
}

/**
 * Por que o item não pode ser restaurado agora (null = pode).
 * `alsoRestoring` são as entradas restauradas junto, na mesma operação.
 */
export function restoreBlock(e: TrashEntry, alsoRestoring: Set<string> = new Set()): string | null {
  const parent = parentEntry(e);
  if (parent) {
    return alsoRestoring.has(parent.id) ? null : `Restaure antes ${parent.kind === 'project' ? 'o projeto' : parent.kind === 'branch' ? 'a etapa' : 'a tarefa'} “${entryName(parent)}”, que também está na lixeira.`;
  }
  if (e.kind === 'project') return null;
  const p = findProject(e.projectId);
  if (!p) return 'O projeto de origem não existe mais.';
  if (e.kind === 'task' && !findBranch(p, e.task.branch)) return 'A etapa de origem não existe mais.';
  if (e.kind === 'subtask' && !findTask(p, e.taskId)) return 'A tarefa de origem não existe mais.';
  return null;
}

// Restaurar

const LEVEL: Record<TrashKind, number> = { project: 0, branch: 1, task: 2, subtask: 3 };

const insertAt = <T>(list: T[], item: T, index: number): void => {
  list.splice(Math.min(Math.max(0, index), list.length), 0, item);
};

/** Pessoas excluídas enquanto o item estava na lixeira não voltam como responsáveis. */
const existing = (ids: string[]): string[] => ids.filter((id) => !!findUser(id));

function cleanTask(t: Task & { index?: number }): Task {
  const { index: _index, ...task } = t;
  return { ...task, assignees: existing(task.assignees) };
}

function restoreOne(e: TrashEntry): void {
  if (e.kind === 'project') {
    const project = e.project;
    project.coordinators = existing(project.coordinators);
    for (const b of project.branches) b.assignees = existing(b.assignees);
    project.tasks = project.tasks.map(cleanTask);
    insertAt(db.projects, project, position(e));
    logActivity(project, 'restaurou o projeto da lixeira', { kind: 'trash' });
    return;
  }
  const p = findProject(e.projectId);
  if (!p) return;
  if (e.kind === 'branch') {
    insertAt(p.branches, { ...e.branch, assignees: existing(e.branch.assignees) }, position(e));
    const tasks = [...e.tasks].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const t of tasks) insertAt(p.tasks, cleanTask(t), t.index ?? p.tasks.length);
    logActivity(p, `restaurou a etapa "${e.branch.name}" da lixeira`, { kind: 'trash', branch: e.branch.id });
  } else if (e.kind === 'task') {
    insertAt(p.tasks, cleanTask(e.task), position(e));
    logActivity(p, `restaurou a tarefa "${e.task.title}" da lixeira`, { kind: 'trash', task: e.task.id, branch: e.task.branch });
  } else {
    const t = findTask(p, e.taskId);
    if (!t) return;
    const subtask: Subtask = e.subtask;
    insertAt(t.subtasks, subtask, position(e));
    logActivity(p, `restaurou a subtarefa "${subtask.title}" (${t.title}) da lixeira`, { kind: 'trash', task: t.id, branch: t.branch });
  }
}

/** Restaura as entradas escolhidas (pais antes dos filhos). Devolve quantas voltaram e as que ficaram. */
export function restoreEntries(ids: string[]): { restored: number; skipped: string[] } {
  if (!canRestore()) throw new PermissionDeniedError();
  const chosen = new Set(ids);
  const entries = db.trash.filter((e) => chosen.has(e.id)).sort((a, b) => LEVEL[a.kind] - LEVEL[b.kind]);
  let restored = 0;
  const skipped: string[] = [];
  const done = new Set<string>();
  for (const e of entries) {
    // O pai precisa já ter voltado (nesta mesma operação ou antes).
    if (restoreBlock(e, done)) {
      skipped.push(entryName(e));
      continue;
    }
    restoreOne(e);
    db.trash = db.trash.filter((x) => x !== e);
    done.add(e.id);
    restored++;
  }
  persistTrash();
  persistProjects();
  return { restored, skipped };
}

// Excluir permanentemente

/** A entrada e as que só fazem sentido com ela (filhos excluídos antes do pai). */
export function withDependents(ids: string[]): TrashEntry[] {
  const out = new Set(db.trash.filter((e) => ids.includes(e.id)));
  for (let grew = true; grew; ) {
    grew = false;
    for (const e of db.trash) {
      const parent = parentEntry(e);
      if (!out.has(e) && parent && out.has(parent)) {
        out.add(e);
        grew = true;
      }
    }
  }
  return [...out];
}

/** Ids das etapas e tarefas que deixam de existir de vez com essas entradas. */
function itemIdsIn(entries: TrashEntry[]): Set<string> {
  const ids = new Set<string>();
  for (const e of entries) {
    if (e.kind === 'branch') {
      ids.add(e.branch.id);
      for (const t of e.tasks) ids.add(t.id);
    }
    if (e.kind === 'task') ids.add(e.task.id);
  }
  return ids;
}

/** Arquivos anexados às tarefas que deixam de existir de vez. */
function fileIdsIn(entries: TrashEntry[]): string[] {
  const tasks = entries.flatMap((e) => (e.kind === 'project' ? e.project.tasks : e.kind === 'branch' ? e.tasks : e.kind === 'task' ? [e.task] : []));
  return tasks.flatMap((t) => t.links.map((l) => l.fileId ?? '')).filter(Boolean);
}

export function purgeEntries(ids: string[]): number {
  if (!canPurge()) throw new PermissionDeniedError();
  const gone = withDependents(ids);
  const goneSet = new Set(gone);
  db.trash = db.trash.filter((e) => !goneSet.has(e));
  // Dependências que apontavam para etapas e tarefas apagadas de vez deixam de existir.
  const itemIds = itemIdsIn(gone);
  if (itemIds.size) {
    for (const p of db.projects) dropDependencies(p, itemIds);
    for (const e of db.trash) {
      const tasks = e.kind === 'project' ? e.project.tasks : e.kind === 'branch' ? e.tasks : e.kind === 'task' ? [e.task] : [];
      for (const t of tasks) t.dependencies = t.dependencies.filter((d) => !itemIds.has(d));
      if (e.kind === 'branch') e.branch.dependencies = e.branch.dependencies.filter((d) => !itemIds.has(d));
      if (e.kind === 'project') dropDependencies(e.project, itemIds);
    }
  }
  persistTrash();
  persistProjects();
  for (const fileId of fileIdsIn(gone)) void deleteFile(fileId);
  return gone.length;
}

export function emptyTrash(): number {
  return purgeEntries(db.trash.map((e) => e.id));
}
