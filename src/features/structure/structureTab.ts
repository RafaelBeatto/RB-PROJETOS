/**
 * Aba "Etapas": as etapas do projeto em três modos de visualização.
 * Kanban (mover etapas entre colunas), Mapa e Cartões (a estrutura em níveis).
 */
import { currentProject, refreshProject } from '../../app/navigation';
import { icon, type IconName } from '../../components/icons';
import { ensureLayout, findBranch } from '../../services/branchService';
import { persistProjects } from '../../services/db';
import { can } from '../../services/permissionService';
import { ui, type StructureMode } from '../../state/store';
import type { Project } from '../../types/project';
import { onClick } from '../../utils/actions';
import { registerTab } from '../projects/projectView';
import { openBranchDetail } from './branchDetail';
import { branchFilterBar, initBranchFilters } from './branchFilters';
import { openEditBranchModal, openNewBranchModal } from './branchModals';
import { renderCards } from './cardsView';
import { mountEtapaBoard, renderEtapaBoard } from './etapaBoard';
import { mountMap } from './mapCanvas';
import { mapToolbar, renderMap } from './mapView';

const MODES: { mode: StructureMode; label: string; icon: IconName }[] = [
  { mode: 'board', label: 'Kanban', icon: 'board' },
  { mode: 'map', label: 'Mapa', icon: 'map' },
  { mode: 'cards', label: 'Cartões', icon: 'cards' },
];

/** O Kanban segue a permissão de Kanban; Mapa e Cartões, a de Estrutura (o Mapa também a de Mapa). */
function canUseMode(mode: StructureMode, projectId: string): boolean {
  if (mode === 'board') return can('kanban', 'view', projectId);
  if (mode === 'map') return can('structure', 'view', projectId) && can('map', 'view', projectId);
  return can('structure', 'view', projectId);
}

function availableModes(p: Project): StructureMode[] {
  return MODES.map((m) => m.mode).filter((m) => canUseMode(m, p.id));
}

function modeSwitch(modes: StructureMode[]): string {
  if (modes.length < 2) return '';
  return `<div class="seg" role="group" aria-label="Modo de visualização">${MODES.filter((m) => modes.includes(m.mode))
    .map(
      (m) =>
        `<button data-action="structure-mode" data-mode="${m.mode}" class="${ui.structureMode === m.mode ? 'on' : ''}" aria-pressed="${ui.structureMode === m.mode}">${icon(m.icon)}${m.label}</button>`,
    )
    .join('')}</div>`;
}

function renderEtapas(p: Project): string {
  const modes = availableModes(p);
  if (!modes.includes(ui.structureMode)) ui.structureMode = modes[0] ?? 'board';
  const mode = ui.structureMode;
  if (mode !== 'board' && ensureLayout(p)) persistProjects();
  const tools = mode === 'map' ? mapToolbar() : '';
  const body = mode === 'board' ? renderEtapaBoard(p) : mode === 'cards' ? renderCards(p) : renderMap(p);
  const toolbar = modeSwitch(modes) || tools ? `<div class="toolbar">${modeSwitch(modes)}${tools}</div>` : '';
  return `${toolbar}${branchFilterBar(p)}${body}`;
}

function mountEtapas(p: Project, container: HTMLElement): void {
  if (ui.structureMode === 'board') mountEtapaBoard(p, container);
  else if (ui.structureMode === 'map') mountMap(p, container, openBranchDetail);
}

export function initStructure(): void {
  initBranchFilters();
  registerTab('kanban', { render: renderEtapas, mount: mountEtapas });

  onClick('structure-mode', (el) => {
    const mode = MODES.find((m) => m.mode === el.dataset.mode)?.mode;
    if (!mode) return;
    ui.structureMode = mode;
    refreshProject();
  });
  onClick('cards-enter', (el) => {
    ui.cardLevel = el.dataset.id ?? null;
    refreshProject();
  });
  onClick('cards-level', (el) => {
    ui.cardLevel = el.dataset.id || null;
    refreshProject();
  });
  onClick('cards-back', () => {
    ui.cardLevel = findBranch(currentProject(), ui.cardLevel)?.parent ?? null;
    refreshProject();
  });
  onClick('branch-new', (el) => openNewBranchModal(el.dataset.parent || null));
  onClick('branch-edit', (el) => openEditBranchModal(el.dataset.id ?? ''));
  onClick('branch-detail', (el) => openBranchDetail(el.dataset.id ?? ''));
}
