import { icon } from '../../components/icons';
import { tasksIn } from '../../services/branchService';
import { branchRef, projectRef } from '../../services/dependencyService';
import { blockedBadge } from '../dependencies/dependencyView';
import { findUser } from '../../services/userService';
import type { Branch } from '../../types/branch';
import type { Project } from '../../types/project';
import { esc, plural } from '../../utils/dom';
import { taskStatusClass } from '../../utils/format';
import { avatar } from '../../components/avatar';
import { branchFiltersActive, matchesBranchFilters } from './branchFilters';

export function designerLine(b: Branch): string {
  const u = findUser(b.designer);
  return u ? `<div class="node-owner">${avatar(u, true)}<span>${esc(u.name)}</span></div>` : '';
}

function node(p: Project, b: Branch, dim: boolean): string {
  const tasks = tasksIn(p, b.id);
  const done = tasks.filter((t) => t.status === 'Concluído').length;
  // Só visualização: a etapa é editada pela aba Etapas (clique abre os detalhes).
  return `<article class="map-node${dim ? ' dim' : ''}" data-node="${b.id}" style="left:${b.x}px;top:${b.y}px"><div class="node-top">${icon(
    'branch',
  )}<span class="node-name">${esc(b.name)}</span></div><span class="status ${taskStatusClass(b.status)} node-status">${esc(b.status)}</span>${designerLine(b)}${
    b.status === 'Concluído' ? '' : blockedBadge(branchRef(p, b))
  }<div class="node-meta">${plural(tasks.length, 'tarefa', 'tarefas')}<br>${plural(done, 'concluída', 'concluídas')}</div></article>`;
}

export function renderMap(p: Project): string {
  const root = p.root ?? { x: 40, y: 40 };
  const filtering = branchFiltersActive();
  const loose = p.tasks.filter((t) => !t.branch);
  const maxY = Math.max(root.y, ...p.branches.map((b) => b.y));
  const looseNode = loose.length
    ? `<article class="map-node" style="left:${root.x}px;top:${maxY + 190}px"><div class="node-top"><span class="node-name">Sem etapa</span></div><div class="node-tasks">${loose
        .map((t) => `<button class="map-task" data-action="task-open" data-id="${t.id}">${esc(t.title)}</button>`)
        .join('')}</div></article>`
    : '';
  return `<div class="branch-map" id="branchMap"><div class="map-world" id="mapWorld"><svg class="map-lines">${p.branches
    .map((b) => `<path data-line="${b.id}"/>`)
    .join('')}</svg><article class="map-node root" data-node="root" style="left:${root.x}px;top:${root.y}px"><div class="node-top">${icon(
    'projects',
  )}<span class="node-name">${esc(p.name)}</span></div>${blockedBadge(projectRef(p), 'Bloqueado')}<div class="node-meta">${p.tasks.length} tarefas · ${p.branches.length} etapas</div></article>${p.branches
    .map((b) => node(p, b, filtering && !matchesBranchFilters(p, b)))
    .join('')}${looseNode}</div><span class="map-help">Só visualização · arraste o fundo para navegar · Ctrl+roda ou pinça para zoom · clique numa etapa para ver os detalhes</span></div>`;
}

export function mapToolbar(): string {
  return `<div class="map-tools"><button class="ghost" data-map="zoom-out" aria-label="Diminuir zoom">${icon('zoomOut')}</button><button class="ghost" data-map="zoom-reset" id="zoomReset" title="Resetar zoom">100%</button><button class="ghost" data-map="zoom-in" aria-label="Aumentar zoom">${icon(
    'zoomIn',
  )}</button><button class="ghost" data-map="fit" title="Centralizar">${icon('scan')}<span>Centralizar</span></button><button class="ghost" data-map="reset" title="Voltar à posição inicial">${icon(
    'reset',
  )}<span>Resetar</span></button></div>`;
}
