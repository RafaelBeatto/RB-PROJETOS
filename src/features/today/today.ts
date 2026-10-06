import { openBranch, openProject, pageContent, registerPage, setFilterBar, setPageHeader } from '../../app/navigation';
import { filterSelect, registerFilterGroup } from '../../components/filterBar';
import { icon, type IconName } from '../../components/icons';
import { db } from '../../services/db';
import { visibleProjects } from '../../services/permissionService';
import { isLate } from '../../services/taskService';
import { ui } from '../../state/store';
import type { Project } from '../../types/project';
import { onClick } from '../../utils/actions';
import { formatShortDate, today, ymd } from '../../utils/date';
import { esc, plural } from '../../utils/dom';
import { openTaskModal } from '../tasks/taskModal';

interface Item {
  project: Project;
  title: string;
  due: string;
  taskId?: string;
}

function group(ic: IconName, label: string, items: Item[]): string {
  if (!items.length) return '';
  return `<div class="today-g"><h3>${icon(ic)} ${label}</h3>${items
    .map(
      (i) =>
        `<div class="today-i" data-action="today-open" data-project="${i.project.id}" data-task="${i.taskId ?? ''}" tabindex="0"><span>${esc(i.title)}<br><small>${esc(
          i.project.name,
        )}</small></span><small>${formatShortDate(i.due)}</small></div>`,
    )
    .join('')}</div>`;
}

function filterBar(): string {
  const f = ui.todayFilters;
  return `<div class="fbar"><div class="fchips">${filterSelect(
    'today.project',
    'Projeto',
    visibleProjects().filter((p) => !p.archived).map((p) => [p.id, p.name] as const),
    f.project,
    'Todos',
  )}${filterSelect(
    'today.person',
    'Responsável',
    db.users.map((u) => [u.id, u.name] as const),
    f.person,
    'Todas',
  )}</div></div>`;
}

function renderToday(): void {
  setPageHeader('Hoje', 'O que exige atenção.', false);
  setFilterBar('today', filterBar);
  const f = ui.todayFilters;
  const late: Item[] = [];
  const due: Item[] = [];
  const milestones: Item[] = [];
  const soon = ymd(7);
  for (const project of visibleProjects()) {
    if (project.archived || (f.project && project.id !== f.project)) continue;
    for (const t of project.tasks) {
      if (f.person && !t.assignees.includes(f.person)) continue;
      const item = { project, title: t.title, due: t.due, taskId: t.id };
      if (isLate(t)) late.push(item);
      else if (t.status !== 'Concluído' && t.due === today()) due.push(item);
    }
    for (const m of project.milestones) {
      if (m.status !== 'Concluído' && m.due && m.due <= soon) milestones.push({ project, title: m.name, due: m.due });
    }
  }
  const html =
    group('warning', plural(late.length, 'tarefa atrasada', 'tarefas atrasadas'), late) +
    group('arrowRight', plural(due.length, 'tarefa para hoje', 'tarefas para hoje'), due) +
    group('milestone', plural(milestones.length, 'marco próximo', 'marcos próximos'), milestones);
  pageContent().innerHTML = html || '<div class="empty">Nada exige atenção hoje.</div>';
}

export function initToday(): void {
  registerPage('today', renderToday);
  registerFilterGroup('today', { get: () => ui.todayFilters, reset: () => undefined, render: renderToday });
  onClick('today-open', (el) => {
    openProject(el.dataset.project ?? '');
    const p = visibleProjects().find((x) => x.id === el.dataset.project);
    const t = p?.tasks.find((x) => x.id === el.dataset.task);
    if (!t) return;
    openBranch(t.branch);
    openTaskModal(t.id);
  });
}
