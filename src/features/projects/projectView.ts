import { applyPerms } from '../../app/access';
import { currentProject, registerProjectView } from '../../app/navigation';
import { ui, type ProjectTab } from '../../state/store';
import { contratanteName } from '../../services/contratanteService';
import type { Project } from '../../types/project';
import { formatDate } from '../../utils/date';
import { $, $$ } from '../../utils/dom';

export interface TabView {
  render: (p: Project) => string;
  /** Liga comportamentos que precisam do DOM já montado (canvas, arrastar…). */
  mount?: (p: Project, container: HTMLElement) => void;
}

const tabs = new Map<ProjectTab, TabView>();

export function registerTab(tab: ProjectTab, view: TabView): void {
  tabs.set(tab, view);
}

function renderProjectView(): void {
  const p = currentProject();
  $('#pName').textContent = p.name;
  // Subtítulo: dados de identificação (a descrição saiu da interface).
  $('#pDescription').textContent =
    [p.processo && `Processo ${p.processo}`, contratanteName(p), p.due && `Prazo ${formatDate(p.due)}`].filter(Boolean).join(' · ') || p.status;
  $$('[data-action="tab"]').forEach((t) => {
    const active = t.dataset.tab === ui.tab;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', String(active));
  });
  const view = tabs.get(ui.tab);
  const container = $('#viewContent');
  container.innerHTML = view ? view.render(p) : '';
  view?.mount?.(p, container);
  applyPerms(container, p.id);
}

export function initProjectView(): void {
  registerProjectView(renderProjectView);
}
