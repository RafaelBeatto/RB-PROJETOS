import { PROJECT_RUNNING, PROJECT_STATUSES, type Milestone, type MilestoneStatus, type Project, type ProjectDraft, type ProjectStatus } from '../types/project';
import { today } from '../utils/date';
import { pct } from '../utils/format';
import { uid } from '../utils/ids';
import { logActivity } from './activityService';
import { db, persistProjects } from './db';
import { RuleError } from './errors';
import { canCreateProject, canEditProject, ensure } from './permissionService';
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

/** Progresso do projeto: só a quantidade de etapas concluídas (sem peso, sem contar tarefas). */
export function projectProgress(p: Project): Progress {
  const done = p.branches.filter((b) => b.status === 'Concluído').length;
  return { total: p.branches.length, done, pct: pct(done, p.branches.length) };
}

export function lateTaskCount(p: Project): number {
  return p.tasks.filter(isLate).length;
}

export function isProjectOverdue(p: Project): boolean {
  return !!p.due && p.due < today() && !p.archived;
}

/** Para iniciar a execução, o projeto precisa de pelo menos uma etapa. */
function assertCanRun(p: Pick<Project, 'branches'>, status: ProjectStatus, previous?: ProjectStatus): void {
  if (status === PROJECT_RUNNING && previous !== PROJECT_RUNNING && !p.branches.length) {
    throw new RuleError('Para iniciar o projeto (Em andamento), crie pelo menos uma etapa.');
  }
}

/** O antigo campo "Responsável" passa a acompanhar o primeiro coordenador. */
const ownerFrom = (coordinators: string[], fallback: string): string => findUser(coordinators[0])?.name ?? fallback;

const cleanCoordinators = (ids: string[]): string[] => ids.filter((id, i, all) => !!findUser(id) && all.indexOf(id) === i);

export function createProject(draft: ProjectDraft): Project {
  ensure(canCreateProject());
  if (!draft.name.trim()) throw new RuleError('Informe o nome do projeto.');
  assertCanRun({ branches: [] }, draft.status);
  const coordinators = cleanCoordinators(draft.coordinators);
  const project: Project = { id: uid('p'), ...draft, coordinators, owner: ownerFrom(coordinators, ''), archived: false, branches: [], tasks: [], milestones: [], activity: [], chat: [] };
  // Ordem de criação: o mais novo fica por último.
  db.projects.push(project);
  logActivity(project, 'criou o projeto', { kind: 'project' });
  persistProjects();
  return project;
}

export function updateProject(p: Project, draft: ProjectDraft): void {
  ensure(canEditProject(p));
  if (!draft.name.trim()) throw new RuleError('Informe o nome do projeto.');
  assertCanRun(p, draft.status, p.status);
  const coordinators = cleanCoordinators(draft.coordinators);
  if (p.status !== draft.status) logActivity(p, `mudou o status do projeto para ${draft.status}`, { kind: 'project' });
  if (String(p.coordinators) !== String(coordinators)) logActivity(p, 'alterou a coordenação do projeto', { kind: 'project' });
  if (p.contratanteId !== draft.contratanteId) logActivity(p, 'alterou a contratante do projeto', { kind: 'project' });
  Object.assign(p, draft, { coordinators, owner: ownerFrom(coordinators, p.owner) });
  persistProjects();
}

/** Encerrar (arquivar) e reabrir: quem edita o projeto. Não exige etapas concluídas. */
export function toggleArchived(p: Project): void {
  ensure(canEditProject(p));
  p.archived = !p.archived;
  logActivity(p, p.archived ? 'encerrou o projeto' : 'reabriu o projeto', { kind: 'project' });
  persistProjects();
}

export function setProjectStatus(p: Project, status: ProjectStatus): boolean {
  ensure(canEditProject(p));
  if (p.status === status || !PROJECT_STATUSES.includes(status)) return false;
  assertCanRun(p, status, p.status);
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
  ensure(canEditProject(p));
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
  ensure(canEditProject(p));
  p.milestones = p.milestones.filter((m) => m.id !== id);
  persistProjects();
}
