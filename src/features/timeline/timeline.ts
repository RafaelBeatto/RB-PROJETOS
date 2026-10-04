import type { Project } from '../../types/project';
import type { Task } from '../../types/task';
import { formatDate } from '../../utils/date';
import { esc } from '../../utils/dom';
import { registerTab } from '../projects/projectView';

/** Janela fixa de três meses exibida pela timeline (out–dez). */
const WINDOW_START = new Date('2026-10-01');
const WINDOW_DAYS = 90;
const DAY = 86_400_000;

interface Group {
  name: string;
  tasks: Task[];
}

function groups(p: Project): Group[] {
  const top = p.branches
    .filter((b) => !b.parent)
    .map((b) => ({
      name: b.name,
      tasks: p.tasks.filter((t) => t.branch === b.id || p.branches.some((x) => x.parent === b.id && t.branch === x.id)),
    }));
  return top.length ? top : [{ name: 'Tarefas', tasks: p.tasks }];
}

function bar(g: Group): string {
  const dates = g.tasks.map((t) => new Date(t.due || '2026-10-01')).sort((a, b) => a.getTime() - b.getTime());
  const start = dates[0] ?? WINDOW_START;
  const end = dates.at(-1) ?? start;
  const left = Math.max(0, Math.min(86, ((start.getTime() - WINDOW_START.getTime()) / DAY / WINDOW_DAYS) * 100));
  const width = Math.max(10, Math.min(90 - left, (((end.getTime() - start.getTime()) / DAY + 12) / WINDOW_DAYS) * 100));
  const title = `${formatDate(start.toISOString().slice(0, 10))} – ${formatDate(end.toISOString().slice(0, 10))}`;
  return `<div class="time-row"><strong>${esc(g.name)}</strong><div class="bar-area"><span class="bar" style="left:${left}%;width:${width}%" title="${title}"></span></div></div>`;
}

function renderTimeline(p: Project): string {
  return `<div class="timeline"><div class="months"><span>OUT</span><span>NOV</span><span>DEZ</span></div>${groups(p).map(bar).join('')}</div>`;
}

export function initTimeline(): void {
  registerTab('timeline', { render: renderTimeline });
}
