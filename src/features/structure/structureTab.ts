import { currentProject, refreshProject } from '../../app/navigation';
import { icon } from '../../components/icons';
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
import { mountMap } from './mapCanvas';
import { mapToolbar, renderMap } from './mapView';

function modeSwitch(): string {
  const button = (mode: StructureMode, label: string, ic: 'map' | 'cards'): string =>
    `<button data-action="structure-mode" data-mode="${mode}" class="${ui.structureMode === mode ? 'on' : ''}" aria-pressed="${ui.structureMode === mode}">${icon(ic)}${label}</button>`;
  const map = can('map', 'view', ui.projectId ?? undefined) ? button('map', 'Mapa', 'map') : '';
  return `<div class="seg" role="group" aria-label="Visualização">${map}${button('cards', 'Cartões', 'cards')}</div>`;
}

function renderStructure(p: Project): string {
  if (ensureLayout(p)) persistProjects();
  // Sem acesso ao Mapa, a Estrutura abre direto em Cartões.
  if (!can('map', 'view', p.id)) ui.structureMode = 'cards';
  if (ui.structureMode === 'cards') return `<div class="toolbar">${modeSwitch()}<span class="sub flat struct-note">Só visualização — edite pela aba Etapas</span></div>${branchFilterBar(p)}${renderCards(p)}`;
  return `<div class="toolbar">${modeSwitch()}<span class="sub flat struct-note">Só visualização — edite pela aba Etapas</span>${mapToolbar()}</div>${branchFilterBar(
    p,
  )}${renderMap(p)}`;
}

function mountStructure(p: Project, container: HTMLElement): void {
  if (ui.structureMode === 'map') mountMap(p, container, openBranchDetail);
}

export function initStructure(): void {
  initBranchFilters();
  registerTab('structure', { render: renderStructure, mount: mountStructure });

  onClick('structure-mode', (el) => {
    ui.structureMode = el.dataset.mode === 'cards' ? 'cards' : 'map';
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
