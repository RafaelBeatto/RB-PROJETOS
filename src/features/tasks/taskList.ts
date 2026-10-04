import { isBlocked } from '../../services/taskService';
import type { Project } from '../../types/project';
import { TASK_STATUSES, type Task } from '../../types/task';
import { formatShortDate } from '../../utils/date';
import { $, esc } from '../../utils/dom';
import { taskStatusClass } from '../../utils/format';
import { registerTab } from '../projects/projectView';
import { filterTasks, taskFilterChips } from './taskFilters';

function rows(tasks: Task[], p: Project): string {
  if (!tasks.length) return '<div class="next-task">Nenhuma tarefa encontrada.</div>';
  return tasks
    .map(
      (t) =>
        `<div class="list-row" data-action="task-open" data-id="${t.id}" tabindex="0"><strong>${esc(t.title)} ${
          isBlocked(t, p) ? '<small class="status todo">Bloqueada</small>' : ''
        }</strong><span class="status ${taskStatusClass(t.status)}">${t.status}</span><span>${esc(t.assignee || '—')}</span><span>${formatShortDate(t.due) || '—'}</span></div>`,
    )
    .join('');
}

function renderList(p: Project): string {
  const statusOptions = TASK_STATUSES.map((s) => `<option>${s}</option>`).join('');
  return `${taskFilterChips(p)}<div class="toolbar"><input class="field" id="taskSearch" placeholder="Pesquisar tarefas" aria-label="Pesquisar tarefas"><select class="field" id="statusFilter" aria-label="Status"><option value="">Todos os status</option>${statusOptions}</select></div><div class="list"><div class="list-row head"><span>Tarefa</span><span>Status</span><span>Responsável</span><span>Prazo</span></div><div id="listTasks">${rows(
    filterTasks(p),
    p,
  )}</div></div>`;
}

/** Busca e status da lista filtram só as linhas, sem redesenhar a aba. */
function mountList(p: Project, container: HTMLElement): void {
  const search = $<HTMLInputElement>('#taskSearch', container);
  const status = $<HTMLSelectElement>('#statusFilter', container);
  const update = (): void => {
    const q = search.value.toLowerCase();
    const list = filterTasks(p).filter((t) => t.title.toLowerCase().includes(q) && (!status.value || t.status === status.value));
    $('#listTasks', container).innerHTML = rows(list, p);
  };
  search.addEventListener('input', update);
  status.addEventListener('change', update);
}

export function initTaskList(): void {
  registerTab('list', { render: renderList, mount: mountList });
}
