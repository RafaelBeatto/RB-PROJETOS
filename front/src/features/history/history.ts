import { openBranch, openProject, pageContent, registerPage, resetFilterBar, setFilterBar, setPageHeader } from '../../app/navigation';
import { avatar } from '../../components/avatar';
import { clearButton, filterSearch, filterSelect, registerFilterGroup } from '../../components/filterBar';
import { icon } from '../../components/icons';
import { allEvents, kindOf, whoOf, type ProjectEvent } from '../../services/activityService';
import { findBranch } from '../../services/branchService';
import { db } from '../../services/db';
import { visibleProjects } from '../../services/permissionService';
import { findProject } from '../../services/projectService';
import { findTask } from '../../services/taskService';
import { personByName } from '../../services/userService';
import { emptyHistoryFilters, ui } from '../../state/store';
import { ACTIVITY_KINDS } from '../../types/activity';
import { onClick } from '../../utils/actions';
import { dayLabel, formatTime, ymd, ymdOf } from '../../utils/date';
import { esc, plural } from '../../utils/dom';
import { openTaskModal } from '../tasks/taskModal';

const PAGE_SIZE = 100;

function filterBar(): string {
  const f = ui.historyFilters;
  const people = [...new Set([...db.users.map((u) => u.name), ...allEvents().map(whoOf)])].sort((a, b) => a.localeCompare(b));
  return `<div class="fbar">${filterSearch('history.q', 'Buscar no histórico', f.q)}<div class="fchips">${filterSelect(
    'history.project',
    'Projeto',
    visibleProjects().map((p) => [p.id, p.name + (p.archived ? ' (arquivado)' : '')] as const),
    f.project,
    'Todos',
  )}${filterSelect(
    'history.person',
    'Pessoa',
    people.map((n) => [n, n] as const),
    f.person,
    'Todas',
  )}${filterSelect('history.kind', 'Tipo', Object.entries(ACTIVITY_KINDS), f.kind, 'Todos')}${filterSelect(
    'history.period',
    'Período',
    [
      ['1', 'Hoje'],
      ['7', '7 dias'],
      ['30', '30 dias'],
      ['90', '90 dias'],
    ],
    f.period,
    'Tudo',
  )}${clearButton('history')}</div></div>`;
}

function filteredEvents(): ProjectEvent[] {
  const f = ui.historyFilters;
  const since = f.period ? ymd(1 - Number(f.period)) : '';
  const q = f.q.trim().toLowerCase();
  const visible = new Set(visibleProjects());
  return allEvents().filter(
    (a) =>
      visible.has(a.project) &&
      (!f.project || a.project.id === f.project) &&
      (!f.person || whoOf(a) === f.person) &&
      (!f.kind || kindOf(a) === f.kind) &&
      (!since || ymdOf(new Date(a.at)) >= since) &&
      (!q || `${a.text} ${a.project.name}`.toLowerCase().includes(q)),
  );
}

function eventRow(a: ProjectEvent): string {
  const who = whoOf(a);
  const rest = a.text.startsWith(who) ? a.text.slice(who.length) : ` ${a.text}`;
  const branch = findBranch(a.project, a.branch);
  return `<div class="hist-i" data-action="history-open" data-project="${a.project.id}" data-task="${a.task ?? ''}" data-branch="${a.branch ?? ''}" tabindex="0">${avatar(
    personByName(who),
  )}<div class="hist-body"><div><b>${esc(who)}</b>${esc(rest)}</div><div class="hist-meta"><span class="hist-tag">${ACTIVITY_KINDS[kindOf(a)]}</span><span>${esc(a.project.name)}</span>${
    branch ? `<span>${icon('branch')} ${esc(branch.name)}</span>` : ''
  }<span>${formatTime(a.at)}</span></div></div></div>`;
}

function renderHistory(): void {
  setPageHeader('Histórico', 'Tudo o que aconteceu nos projetos.', false);
  setFilterBar('history', filterBar);
  const events = filteredEvents();
  const limit = ui.historyFilters.limit;
  let lastDay = '';
  let rows = '';
  for (const a of events.slice(0, limit)) {
    const day = dayLabel(a.at);
    if (day !== lastDay) {
      lastDay = day;
      rows += `<div class="hist-day">${day}</div>`;
    }
    rows += eventRow(a);
  }
  const projects = new Set(events.map((a) => a.project.id)).size;
  const people = new Set(events.map(whoOf)).size;
  const summary = `<div class="hist-sum"><span>${plural(events.length, 'evento', 'eventos')}</span><span>${plural(people, 'pessoa', 'pessoas')}</span><span>${plural(
    projects,
    'projeto',
    'projetos',
  )}</span></div>`;
  const more =
    events.length > limit
      ? `<button class="ghost wide-btn" data-action="history-more">Carregar mais (${events.length - limit} restantes)</button>`
      : '';
  pageContent().innerHTML = `${summary}${rows || '<div class="empty">Nenhum evento encontrado com esses filtros.</div>'}${more}`;
}

export function initHistory(): void {
  registerPage('history', renderHistory);
  registerFilterGroup('history', {
    get: () => ui.historyFilters,
    reset: () => {
      ui.historyFilters = emptyHistoryFilters();
      resetFilterBar();
    },
    render: () => {
      ui.historyFilters.limit = PAGE_SIZE;
      renderHistory();
    },
  });
  onClick('history-more', () => {
    ui.historyFilters.limit += PAGE_SIZE;
    renderHistory();
  });
  onClick('history-open', (el) => {
    const p = findProject(el.dataset.project);
    if (!p) return;
    openProject(p.id);
    const t = findTask(p, el.dataset.task);
    if (t) {
      openBranch(t.branch);
      openTaskModal(t.id);
    } else if (findBranch(p, el.dataset.branch)) openBranch(el.dataset.branch ?? null);
  });
}
