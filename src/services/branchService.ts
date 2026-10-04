import type { Branch } from '../types/branch';
import type { Project } from '../types/project';
import type { Task } from '../types/task';
import { uid } from '../utils/ids';
import { logActivity } from './activityService';
import { persistProjects } from './db';
import { findUser } from './userService';

const COLUMN_GAP = 270;
const ROW_GAP = 160;

export function findBranch(p: Project, id: string | null | undefined): Branch | undefined {
  return id ? p.branches.find((b) => b.id === id) : undefined;
}

function depth(p: Project, b: Branch): number {
  let n = 0;
  let cur: Branch | undefined = b;
  for (let guard = 0; cur?.parent && guard < 50; guard++) {
    n++;
    cur = findBranch(p, cur.parent);
  }
  return n;
}

/** Dá posição no mapa ao projeto e às ramificações que ainda não têm. Devolve true se mudou algo. */
export function ensureLayout(p: Project): boolean {
  let changed = false;
  if (!p.root) {
    const roots = p.branches.filter((b) => !b.parent).length;
    p.root = { x: 40, y: Math.max(40, Math.round(roots * 80 - 20)) };
    changed = true;
  }
  const rows = new Map<number, number>();
  for (const b of p.branches) {
    if (Number.isFinite(b.x) && Number.isFinite(b.y)) continue;
    const level = depth(p, b);
    const row = (rows.get(level) ?? -1) + 1;
    rows.set(level, row);
    b.x = 320 + level * COLUMN_GAP;
    b.y = 40 + row * ROW_GAP;
    changed = true;
  }
  return changed;
}

/** Filhas diretas; na raiz inclui ramificações cujo pai não existe mais. */
export function childrenOf(p: Project, parentId: string | null): Branch[] {
  return p.branches.filter((b) => (parentId ? b.parent === parentId : !b.parent || !findBranch(p, b.parent)));
}

/** A própria ramificação e todas as descendentes. */
export function descendantIds(p: Project, id: string): string[] {
  const ids = [id];
  for (let i = 0; i < ids.length; i++) {
    for (const b of p.branches) if (b.parent === ids[i] && !ids.includes(b.id)) ids.push(b.id);
  }
  return ids;
}

/** Ancestrais, da raiz até o pai direto. */
export function ancestorsOf(p: Project, b: Branch): Branch[] {
  const chain: Branch[] = [];
  let parentId = b.parent;
  for (let guard = 0; parentId && guard < 50; guard++) {
    const parent = findBranch(p, parentId);
    if (!parent) break;
    chain.unshift(parent);
    parentId = parent.parent;
  }
  return chain;
}

export function pathLabel(p: Project, b: Branch): string {
  return ancestorsOf(p, b)
    .map((x) => x.name)
    .join(' / ');
}

export function tasksIn(p: Project, branchId: string, includeDescendants = false): Task[] {
  if (!includeDescendants) return p.tasks.filter((t) => t.branch === branchId);
  const ids = new Set(descendantIds(p, branchId));
  return p.tasks.filter((t) => ids.has(t.branch));
}

/** Coloca a nova ramificação à direita do pai, no primeiro espaço livre. */
function freeSpotNear(p: Project, parent: Branch | undefined): { x: number; y: number } {
  ensureLayout(p);
  const base = parent ?? p.root ?? { x: 40, y: 40 };
  const x = base.x + (parent ? 260 : 280);
  let y = base.y;
  while (p.branches.some((o) => Math.abs(o.x - x) < 230 && Math.abs(o.y - y) < 150)) y += ROW_GAP;
  return { x, y };
}

export function createBranch(p: Project, name: string, parentId: string | null, designer: string | null): Branch {
  const parent = findBranch(p, parentId);
  const branch: Branch = { id: uid('b'), name, parent: parent ? parent.id : null, designer, ...freeSpotNear(p, parent) };
  p.branches.push(branch);
  logActivity(p, `criou a ramificação "${branch.name}"`, { kind: 'branch', branch: branch.id });
  persistProjects();
  return branch;
}

function logDesigner(p: Project, b: Branch): void {
  const text = b.designer ? `definiu ${findUser(b.designer)?.name ?? 'alguém'} como projetista de "${b.name}"` : `removeu o projetista de "${b.name}"`;
  logActivity(p, text, { kind: 'branch', branch: b.id });
}

export interface BranchDraft {
  name: string;
  parent: string | null;
  designer: string | null;
}

export function updateBranch(p: Project, b: Branch, draft: BranchDraft): void {
  const old = { name: b.name, parent: b.parent, designer: b.designer };
  Object.assign(b, draft);
  if (old.name !== b.name) logActivity(p, `renomeou a ramificação "${old.name}" para "${b.name}"`, { kind: 'branch', branch: b.id });
  if (old.parent !== b.parent) logActivity(p, `moveu a ramificação "${b.name}"`, { kind: 'branch', branch: b.id });
  if (old.designer !== b.designer) logDesigner(p, b);
  persistProjects();
}

export function setDesigner(p: Project, b: Branch, designer: string | null): void {
  b.designer = designer;
  logDesigner(p, b);
  persistProjects();
}

/** Filhas sobem um nível; tarefas ficam sem ramificação. */
export function deleteBranch(p: Project, b: Branch): void {
  for (const x of p.branches) if (x.parent === b.id) x.parent = b.parent;
  for (const t of p.tasks) if (t.branch === b.id) t.branch = '';
  p.branches = p.branches.filter((x) => x.id !== b.id);
  logActivity(p, `excluiu a ramificação "${b.name}"`, { kind: 'branch' });
  persistProjects();
}

/** Ramificações que podem ser pai de `b` (todas menos ela e suas descendentes). */
export function possibleParents(p: Project, b: Branch): Branch[] {
  const blocked = new Set(descendantIds(p, b.id));
  return p.branches.filter((x) => !blocked.has(x.id));
}
