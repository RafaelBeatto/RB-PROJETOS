import type { Activity, ActivityKind } from '../types/activity';
import type { Project } from '../types/project';
import type { Task } from '../types/task';
import { uid } from '../utils/ids';
import { db } from './db';
import { currentActor } from './userService';

const MAX_PER_PROJECT = 500;

interface LogMeta {
  kind: ActivityKind;
  task?: string;
  branch?: string;
}

/** Registra um evento relevante. `text` é a ação sem o autor, ex.: 'criou "Login"'. */
export function logActivity(project: Project, text: string, meta: LogMeta): void {
  const who = currentActor(project.owner);
  const entry: Activity = { id: uid('a'), at: new Date().toISOString(), text: `${who} ${text}`, who, kind: meta.kind };
  if (meta.task) entry.task = meta.task;
  if (meta.branch) entry.branch = meta.branch;
  project.activity.unshift(entry);
  if (project.activity.length > MAX_PER_PROJECT) project.activity.length = MAX_PER_PROJECT;
}

export function logTaskStatus(project: Project, task: Task): void {
  const text = task.status === 'Concluído' ? `concluiu "${task.title}"` : `moveu "${task.title}" para ${task.status}`;
  logActivity(project, text, { kind: 'status', task: task.id, branch: task.branch });
}

/** Tipo do evento; registros antigos sem `kind` são classificados pelo texto. */
export function kindOf(a: Activity): ActivityKind {
  if (a.kind) return a.kind;
  if (/concluiu o marco/.test(a.text)) return 'milestone';
  if (/ comentou /.test(a.text)) return 'comment';
  if (/ (moveu|concluiu) "/.test(a.text)) return 'status';
  if (/ criou "/.test(a.text)) return 'task';
  return 'project';
}

/** Autor do evento; registros antigos sem `who` são deduzidos pelo início do texto. */
export function whoOf(a: Activity): string {
  if (a.who) return a.who;
  const match = db.users
    .filter((u) => a.text.startsWith(`${u.name} `))
    .sort((x, y) => y.name.length - x.name.length)[0];
  return match ? match.name : (a.text.split(' ')[0] ?? '');
}

export interface ProjectEvent extends Activity {
  project: Project;
}

export function allEvents(): ProjectEvent[] {
  return db.projects
    .flatMap((project) => project.activity.map((a) => ({ ...a, project })))
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}
