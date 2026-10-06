import { applyPerms } from '../../app/access';
import { currentProject, registerProjectView } from '../../app/navigation';
import { ui, type ProjectTab } from '../../state/store';
import { datesBadge, peopleLine, priorityBadge } from '../../components/itemParts';
import { progressRow } from '../../components/progress';
import { contratanteName } from '../../services/contratanteService';
import { projectProgress } from '../../services/projectService';
import type { Project } from '../../types/project';
import { $, $$, $maybe, esc } from '../../utils/dom';
import { projectStatusClass } from '../../utils/format';

export interface TabView {
  render: (p: Project) => string;
  /** Liga comportamentos que precisam do DOM já montado (canvas, arrastar…). */
  mount?: (p: Project, container: HTMLElement) => void;
  /** Número exibido ao lado do nome da aba (0 esconde). */
  badge?: (p: Project) => number;
}

const tabs = new Map<ProjectTab, TabView>();

export function registerTab(tab: ProjectTab, view: TabView): void {
  tabs.set(tab, view);
}

function renderProjectView(): void {
  const p = currentProject();
  $('#pName').textContent = p.name;
  $('#pDescription').textContent = [p.processo && `Processo ${p.processo}`, contratanteName(p)].filter(Boolean).join(' · ');
  const prog = projectProgress(p);
  $('#pMeta').innerHTML = `<span class="status ${projectStatusClass(p.status)}">${esc(p.status)}</span>${p.archived ? '<span class="status todo">Arquivado</span>' : ''}${priorityBadge(
    p.priority,
  )}${datesBadge(p.start, p.due, p.archived)}<span class="p-people">${peopleLine(p.coordinators, 'Sem coordenador')}</span><span class="p-prog" title="Etapas concluídas">${progressRow(
    prog.pct,
  )}<small>${prog.done}/${prog.total} etapas</small></span>`;
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
  // Depois do mount: abrir a aba pode zerar o próprio contador (ex.: chat lido).
  $$('[data-action="tab"]').forEach((t) => {
    const badge = $maybe('.tab-badge', t);
    if (!badge) return;
    const n = tabs.get(t.dataset.tab as ProjectTab)?.badge?.(p) ?? 0;
    badge.hidden = n <= 0;
    badge.textContent = n <= 0 ? '' : n > 99 ? '99+' : String(n);
    badge.title = n > 0 ? 'Mensagens que marcaram você' : '';
  });
}

export function initProjectView(): void {
  registerProjectView(renderProjectView);
}
