/**
 * Aba "Etapas": o Kanban de etapas do projeto ou, com uma etapa aberta, o Kanban das tarefas dela.
 */
import { registerTab } from '../projects/projectView';
import { findBranch } from '../../services/branchService';
import { ui } from '../../state/store';
import type { Project } from '../../types/project';
import { branchFilterBar, initBranchFilters } from './branchFilters';
import { initBranchView, mountBranchView, renderBranchView } from './branchView';
import { mountEtapaBoard, renderEtapaBoard } from './etapaBoard';

function openEtapa(p: Project): ReturnType<typeof findBranch> {
  const b = findBranch(p, ui.branchId);
  // A etapa pode ter ido para a lixeira: volta para o Kanban de etapas.
  if (!b) ui.branchId = null;
  return b;
}

function renderEtapas(p: Project): string {
  const b = openEtapa(p);
  if (b) return renderBranchView(p, b);
  return `${p.branches.length ? branchFilterBar(p) : ''}${renderEtapaBoard(p)}`;
}

function mountEtapas(p: Project, container: HTMLElement): void {
  if (openEtapa(p)) mountBranchView(p, container);
  else mountEtapaBoard(p, container);
}

export function initStructure(): void {
  initBranchFilters();
  initBranchView();
  registerTab('kanban', { render: renderEtapas, mount: mountEtapas });
}
