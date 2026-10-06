import { avatar } from '../../components/avatar';
import { icon } from '../../components/icons';
import { progressRow } from '../../components/progress';
import { canEditProject } from '../../services/permissionService';
import { projectProgress, sortedMilestones } from '../../services/projectService';
import { contratanteCidade, contratanteName } from '../../services/contratanteService';
import { isLate } from '../../services/taskService';
import { findUser, taskPeople } from '../../services/userService';
import type { Project } from '../../types/project';
import { dayLabel, formatDate, formatShortDate, today } from '../../utils/date';
import { esc, plural } from '../../utils/dom';
import { projectStatusClass } from '../../utils/format';
import { registerTab } from './projectView';

function coordination(p: Project): string {
  const users = p.coordinators.map(findUser).filter((u): u is NonNullable<typeof u> => !!u);
  if (!users.length) return '';
  return `<div class="coord"><span class="lbl">Coordenação</span>${users
    .map((u) => `<span class="coord-u">${avatar(u)}<span>${esc(u.name)}${u.role ? `<small>${esc(u.role)}</small>` : ''}</span></span>`)
    .join('')}</div>`;
}

function milestones(p: Project): string {
  const editable = canEditProject(p);
  const list = sortedMilestones(p);
  const next = list.find((m) => m.status !== 'Concluído');
  const rows = list
    .map((m) => {
      const done = m.status === 'Concluído';
      const late = !done && !!m.due && m.due < today();
      const mark = done ? icon('done') : m === next ? icon('arrowRight') : icon('milestone');
      return `<div class="ms ${done ? 'done' : m === next ? 'next' : ''} ${late ? 'late' : ''} ${editable ? '' : 'readonly'}" ${editable ? `data-action="milestone-edit" data-id="${m.id}" tabindex="0"` : ''}><span class="ms-s">${mark}</span>${esc(
        m.name,
      )}<span class="ms-d">${formatShortDate(m.due)}</span></div>`;
    })
    .join('');
  return `<div class="next-list">${rows || '<div class="next-task">Nenhum marco definido.</div>'}</div>`;
}

function nextTasks(p: Project): string {
  const pending = p.tasks.filter((t) => t.status !== 'Concluído').slice(0, 4);
  if (!pending.length) return '<div class="next-task">Nenhuma tarefa pendente.</div>';
  return pending
    .map(
      (t) =>
        `<div class="next-task" data-action="task-open" data-id="${t.id}" tabindex="0"><span class="check"></span>${esc(t.title)}${
          isLate(t) ? '<span class="status late">Atrasada</span>' : ''
        }</div>`,
    )
    .join('');
}

function workload(p: Project): string {
  const counts = new Map<string, number>();
  for (const t of p.tasks) {
    for (const person of taskPeople(t)) counts.set(person.name, (counts.get(person.name) ?? 0) + 1);
  }
  const rows = [...counts].sort((a, b) => b[1] - a[1]);
  if (!rows.length) return '';
  return `<h3 class="sec-title">Colaboradores</h3><div class="people">${rows
    .map(([name, n]) => `<div class="person">${esc(name)}<small>${plural(n, 'tarefa', 'tarefas')}</small></div>`)
    .join('')}</div>`;
}

function recentActivity(p: Project): string {
  let lastDay = '';
  let html = '';
  for (const a of p.activity.slice(0, 8)) {
    const day = dayLabel(a.at);
    if (day !== lastDay) {
      lastDay = day;
      html += `<div class="act-day">${day}</div>`;
    }
    html += `<div class="act-i">${esc(a.text)}</div>`;
  }
  return html ? `<h3 class="sec-title">Atividade</h3><div class="act">${html}</div>` : '';
}

function renderOverview(p: Project): string {
  const prog = projectProgress(p);
  return `<div class="overview">${p.description.trim() ? `<p class="desc">${esc(p.description)}</p>` : ''}<div class="facts"><div class="fact"><label>Status</label><span class="status ${projectStatusClass(p.status)}">${esc(
    p.status,
  )}</span></div><div class="fact"><label>Contratante</label>${esc([contratanteName(p), contratanteCidade(p)].filter(Boolean).join(' · ') || '—')}</div><div class="fact"><label>Término</label>${formatDate(
    p.due,
  )}</div><div class="fact"><label>Progresso</label>${prog.done} de ${plural(prog.total, 'etapa concluída', 'etapas concluídas')}</div></div>${progressRow(prog.pct)}${coordination(
    p,
  )}<div class="sec-head"><h3>Marcos</h3>${canEditProject(p) ? `<button class="ghost" data-action="milestone-new">${icon('plus')}Marco</button>` : ''}</div>${milestones(
    p,
  )}<h3 class="sec-title">Próximas tarefas</h3><div class="next-list">${nextTasks(p)}</div>${workload(p)}${recentActivity(p)}</div>`;
}

export function initOverview(): void {
  registerTab('overview', { render: renderOverview });
}
