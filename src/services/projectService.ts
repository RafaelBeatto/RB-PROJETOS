import { PROJECT_STARTED_STATUSES, type Milestone, type MilestoneStatus, type Project, type ProjectDraft, type ProjectStatus } from '../types/project';
import { today } from '../utils/date';
import { pct } from '../utils/format';
import { uid } from '../utils/ids';
import { logActivity } from './activityService';
import { db, persistProjects } from './db';
import { DependencyError, NEW_ID, blockedMessage, blockersOf, draftBlockers, projectRef, sameDependencies, validateDependencies } from './dependencyService';
import { authorize } from './permissionService';
import { findUser } from './userService';
import { isLate } from './taskService';

export function findProject(id: string | null | undefined): Project | undefined {
  return id ? db.projects.find((p) => p.id === id) : undefined;
}

export interface Progress {
  total: number;
  done: number;
  pct: number;
}

export function projectProgress(p: Project): Progress {
  const done = p.tasks.filter((t) => t.status === 'Concluído').length;
  return { total: p.tasks.length, done, pct: pct(done, p.tasks.length) };
}

export function lateTaskCount(p: Project): number {
  return p.tasks.filter(isLate).length;
}

export function isProjectOverdue(p: Project): boolean {
  return !!p.due && p.due < today() && p.status !== 'Concluído';
}

/** Projeto bloqueado por dependências não pode ser iniciado nem concluído. */
function assertCanEnter(status: ProjectStatus, previous: ProjectStatus | undefined, blockers: ReturnType<typeof blockersOf>): void {
  if (status === previous || !PROJECT_STARTED_STATUSES.includes(status) || !blockers.length) return;
  throw new DependencyError(blockedMessage('O projeto está bloqueado e não pode ser iniciado nem concluído', blockers));
}

/** O antigo campo "Responsável" passa a acompanhar o primeiro coordenador. */
const ownerFrom = (coordinators: string[], fallback: string): string => findUser(coordinators[0])?.name ?? fallback;

export function createProject(draft: ProjectDraft): Project {
  authorize('projects', 'create');
  const owner = { ref: { kind: 'project' as const, projectId: NEW_ID, id: NEW_ID }, dependencies: draft.dependencies };
  const dependencies = validateDependencies(owner);
  assertCanEnter(draft.status, undefined, draftBlockers({ ...owner, dependencies }));
  const project: Project = { id: uid('p'), ...draft, dependencies, owner: ownerFrom(draft.coordinators, ''), archived: false, branches: [], tasks: [], milestones: [], activity: [], chat: [] };
  db.projects.unshift(project);
  logActivity(project, 'criou o projeto', { kind: 'project' });
  persistProjects();
  return project;
}

export function updateProject(p: Project, draft: ProjectDraft): void {
  authorize('projects', 'edit', p.id);
  const owner = { ref: projectRef(p), dependencies: draft.dependencies };
  const dependencies = validateDependencies(owner);
  assertCanEnter(draft.status, p.status, draftBlockers({ ...owner, dependencies }));
  if (p.status !== draft.status) logActivity(p, `mudou o status do projeto para ${draft.status}`, { kind: 'project' });
  if (!sameDependencies(p.dependencies, dependencies)) logActivity(p, 'alterou as dependências do projeto', { kind: 'project' });
  if (String(p.coordinators) !== String(draft.coordinators)) logActivity(p, 'alterou a coordenação do projeto', { kind: 'project' });
  if (p.contratanteId !== draft.contratanteId) logActivity(p, 'alterou a contratante do projeto', { kind: 'project' });
  Object.assign(p, draft, { dependencies, owner: ownerFrom(draft.coordinators, p.owner) });
  persistProjects();
}

/** Arquivar/desarquivar usa a permissão "excluir" de Projetos. */
export function toggleArchived(p: Project): void {
  authorize('projects', 'delete', p.id);
  p.archived = !p.archived;
  persistProjects();
}

export function setProjectStatus(p: Project, status: ProjectStatus): boolean {
  authorize('projects', 'edit', p.id);
  authorize('kanban', 'edit', p.id);
  if (p.status === status) return false;
  assertCanEnter(status, p.status, blockersOf(projectRef(p)));
  p.status = status;
  logActivity(p, `mudou o status do projeto para ${status}`, { kind: 'project' });
  persistProjects();
  return true;
}

// Convênio

export function agreementName(p: Project): string {
  const text = [p.convOrgao, p.convNumero].map((x) => x.trim()).filter(Boolean).join(' ');
  return text ? `Convênio ${text}` : '';
}

export function hasAgreement(p: Project): boolean {
  return [p.convOrgao, p.convNumero, p.convValor, p.convContra, p.convPolitico].some((v) => v.trim());
}

export function agreementTotal(p: Project): number {
  return (Number.parseFloat(p.convValor) || 0) + (Number.parseFloat(p.convContra) || 0);
}

// Marcos

export interface MilestoneDraft {
  name: string;
  due: string;
  status: MilestoneStatus;
}

export function sortedMilestones(p: Project): Milestone[] {
  return [...p.milestones].sort((a, b) => ((a.due || '9') > (b.due || '9') ? 1 : -1));
}

export function saveMilestone(p: Project, milestone: Milestone | undefined, draft: MilestoneDraft): void {
  authorize('projects', 'edit', p.id);
  if (milestone) {
    const wasDone = milestone.status === 'Concluído';
    Object.assign(milestone, draft);
    if (!wasDone && draft.status === 'Concluído') logActivity(p, `concluiu o marco "${milestone.name}"`, { kind: 'milestone' });
  } else {
    p.milestones.push({ id: uid('m'), ...draft });
    logActivity(p, `criou o marco "${draft.name}"`, { kind: 'milestone' });
  }
  persistProjects();
}

export function deleteMilestone(p: Project, id: string): void {
  authorize('projects', 'edit', p.id);
  p.milestones = p.milestones.filter((m) => m.id !== id);
  persistProjects();
}
