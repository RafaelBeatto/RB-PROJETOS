/** Visão "Cartões": navegação por níveis da estrutura do projeto. */
import { icon } from '../../components/icons';
import { progressBar } from '../../components/progress';
import { branchRef, taskRef } from '../../services/dependencyService';
import { blockedBadge } from '../dependencies/dependencyView';
import { ancestorsOf, childrenOf, findBranch, pathLabel, tasksIn } from '../../services/branchService';
import { ui } from '../../state/store';
import type { Branch } from '../../types/branch';
import type { Project } from '../../types/project';
import type { Task } from '../../types/task';
import { esc, plural } from '../../utils/dom';
import { pct, priorityClass, taskStatusClass } from '../../utils/format';
import { branchFiltersActive, matchesBranchFilters } from './branchFilters';
import { designerLine } from './mapView';

function branchCard(p: Project, b: Branch, showPath: boolean): string {
  const kids = childrenOf(p, b.id).length;
  const tasks = tasksIn(p, b.id, true);
  const done = tasks.filter((t) => t.status === 'Concluído').length;
  const path = showPath ? pathLabel(p, b) : '';
  return `<article class="bcard" data-action="cards-enter" data-id="${b.id}" tabindex="0"><div class="bcard-name">${icon('branch')} ${esc(b.name)}</div><span class="status ${taskStatusClass(
    b.status,
  )} node-status">${esc(b.status)}</span>${b.status === 'Concluído' ? '' : blockedBadge(branchRef(p, b))}${
    path ? `<div class="node-meta bcard-path">${esc(path)}</div>` : ''
  }${designerLine(b)}<div class="node-meta bcard-stats">${kids ? `${plural(kids, 'etapa', 'etapas')}<br>` : ''}${plural(tasks.length, 'tarefa', 'tarefas')}<br>${plural(
    done,
    'concluída',
    'concluídas',
  )}</div>${progressBar(pct(done, tasks.length))}<div class="bcard-foot"><span class="bcard-go">Abrir ${icon('arrowRight')}</span><button class="bcard-info" data-action="branch-detail" data-id="${
    b.id
  }">Detalhes</button></div></article>`;
}

function taskCard(p: Project, t: Task): string {
  return `<article class="bcard task" data-action="task-open" data-id="${t.id}" tabindex="0"><div class="bcard-name">${esc(t.title)}</div>${
    t.status === 'Concluído' ? '' : blockedBadge(taskRef(p, t))
  }<div class="node-meta">${esc(
    t.status,
  )}<br><i class="priority ${priorityClass(t.priority)}"></i> ${esc(t.priority)}</div></article>`;
}

export function renderCards(p: Project): string {
  if (ui.cardLevel && !findBranch(p, ui.cardLevel)) ui.cardLevel = null;
  const level = findBranch(p, ui.cardLevel);
  const path = level ? [...ancestorsOf(p, level), level] : [];
  const filtering = branchFiltersActive();
  const branches = filtering ? p.branches.filter((b) => matchesBranchFilters(p, b)) : childrenOf(p, ui.cardLevel);
  const ownTasks = p.tasks.filter((t) => (level ? t.branch === level.id : !t.branch));

  const crumbs = `<nav class="crumbs" aria-label="Caminho"><button data-action="cards-level" data-id="">${esc(p.name)}</button>${path
    .map((b) => ` / <button data-action="cards-level" data-id="${b.id}">${esc(b.name)}</button>`)
    .join('')}</nav>`;
  const head = `<div class="cards-head">${level ? `<button class="ghost" data-action="cards-back">${icon('chevronLeft')}Voltar</button>` : ''}${crumbs}${
    level ? `<button class="ghost" data-action="branch-detail" data-id="${level.id}">${icon('info')}Detalhes</button>` : ''
  }</div>`;
  const empty = filtering
    ? 'Nenhuma etapa encontrada com esses filtros.'
    : `Nenhuma etapa dentro de ${esc(level ? level.name : p.name)}.`;
  const grid = branches.length ? `<div class="cards">${branches.map((b) => branchCard(p, b, filtering)).join('')}</div>` : `<p class="sub">${empty}</p>`;
  const tasks = ownTasks.length ? `<h3>Tarefas</h3><div class="cards">${ownTasks.map((t) => taskCard(p, t)).join('')}</div>` : '';
  return `<div class="cards-wrap">${head}${grid}${tasks}</div>`;
}
