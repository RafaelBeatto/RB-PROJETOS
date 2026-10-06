/**
 * Página Colaboradores: lista de todos os usuários com um resumo do trabalho e,
 * ao abrir um colaborador, o painel com cada tarefa e etapa vinculada a ele,
 * o caminho no projeto (Projeto → Etapa → Tarefa) e o que está impedindo o avanço.
 */
import { canOpenTab } from '../../app/access';
import { openBranch, openProject, pageContent, refreshPage, registerPage, resetFilterBar, setFilterBar, setPageHeader } from '../../app/navigation';
import { avatar } from '../../components/avatar';
import { clearButton, filterSearch, filterToggle, registerFilterGroup } from '../../components/filterBar';
import { icon } from '../../components/icons';
import { showToast } from '../../components/toast';
import {
  GROUP_LABELS,
  GROUP_ORDER,
  collaboratorData,
  type ActivityGroup,
  type CollaboratorActivity,
  type CollaboratorSummary,
} from '../../services/collaboratorService';
import { db } from '../../services/db';
import { findProfile } from '../../services/profileService';
import { findUser } from '../../services/userService';
import { emptyCollaboratorFilters, ui } from '../../state/store';
import type { User } from '../../types/user';
import { onClick } from '../../utils/actions';
import { formatDate } from '../../utils/date';
import { esc, plural } from '../../utils/dom';
import { priorityClass, taskStatusClass } from '../../utils/format';
import { openTaskModal } from '../tasks/taskModal';

// Lista

function filterBar(): string {
  const f = ui.collaboratorFilters;
  return `<div class="fbar">${filterSearch('collaborators.q', 'Buscar colaborador, função ou e-mail', f.q)}<div class="fchips">${filterToggle(
    'collaborators.attention',
    'Exige atenção',
    f.attention,
  )}${filterToggle('collaborators.inactive', 'Mostrar inativos', f.inactive)}${clearButton('collaborators')}</div></div>`;
}

function identity(u: User): string {
  return [u.role, findProfile(u.profileId)?.name, u.active ? '' : 'Inativo'].filter(Boolean).join(' · ');
}

function stat(value: number, label: string, cls = ''): string {
  return `<div class="cstat ${cls}"><b>${value}</b><span>${label}</span></div>`;
}

function card(u: User, s: CollaboratorSummary): string {
  const linked = s.tasks + s.etapas;
  return `<article class="collab-card${u.active ? '' : ' inactive'}" data-action="collab-open" data-id="${u.id}" tabindex="0"><div class="collab-who">${avatar(u)}<div><b>${esc(
    u.name,
  )}</b><small>${esc(identity(u) || '—')}</small></div>${s.attention ? `<span class="status late">${icon('warning')}${s.attention}</span>` : ''}</div><div class="collab-linked">${
    linked ? `${plural(s.tasks, 'tarefa', 'tarefas')} · ${plural(s.etapas, 'etapa', 'etapas')}` : 'Nenhuma atividade vinculada'
  }</div><div class="cstats">${stat(s.pending, 'pendentes')}${stat(s.done, 'concluídas', 'ok')}${stat(s.waiting, 'em espera', s.waiting ? 'warn' : '')}</div></article>`;
}

function renderList(): void {
  setPageHeader('Colaboradores', 'Acompanhe o que cada colaborador precisa fazer. Abra um colaborador para ver os detalhes.', false);
  setFilterBar('collaborators', filterBar);
  const f = ui.collaboratorFilters;
  const q = f.q.trim().toLowerCase();
  const rows = db.users
    .filter((u) => f.inactive || u.active)
    .filter((u) => !q || [u.name, u.role, u.email, findProfile(u.profileId)?.name].join(' ').toLowerCase().includes(q))
    .map((u) => ({ u, s: collaboratorData(u).summary }))
    .filter((r) => !f.attention || r.s.attention > 0)
    // Quem exige atenção primeiro, depois quem tem mais pendências.
    .sort((a, b) => b.s.attention - a.s.attention || b.s.pending - a.s.pending || a.u.name.localeCompare(b.u.name, 'pt-BR'));
  pageContent().innerHTML = rows.length
    ? `<div class="collab-grid">${rows.map((r) => card(r.u, r.s)).join('')}</div>`
    : '<div class="empty">Nenhum colaborador encontrado com esses filtros.</div>';
}

// Painel individual

function pathHtml(a: CollaboratorActivity): string {
  return `<div class="ca-path" aria-label="Caminho: ${esc(a.path.map((s) => s.name).join(' → '))}">${a.path
    .map((s) => `<span class="ca-step"><small>${s.label}</small>${esc(s.name)}</span>`)
    .join('<i class="ca-arrow">→</i>')}</div>`;
}

function activityHtml(a: CollaboratorActivity): string {
  const meta = [
    a.due ? `<span class="${a.late ? 'late-txt' : ''}">Prazo ${formatDate(a.due)}${a.late ? ' · atrasada' : ''}</span>` : '',
    a.priority ? `<span><i class="priority ${priorityClass(a.priority)}"></i> Prioridade ${esc(a.priority.toLowerCase())}</span>` : '',
    a.others.length ? `<span>Com ${esc(a.others.join(', '))}</span>` : '',
  ]
    .filter(Boolean)
    .join('');
  const blocked = a.waitingReason ? `<div class="ca-block">${icon('lock')}<div><b>Em espera</b><ul><li>${esc(a.waitingReason)}</li></ul></div></div>` : '';
  return `<article class="ca${a.late ? ' late' : ''}" data-action="collab-activity" data-project="${a.project.id}" data-kind="${a.kind}" data-id="${
    a.task?.id ?? a.branch?.id ?? ''
  }" tabindex="0" title="Abrir no projeto"><div class="ca-top"><span class="ca-kind">${icon(a.kind === 'task' ? 'done' : 'branch')}${a.kind === 'task' ? 'Tarefa' : 'Etapa'}</span><b class="ca-name">${esc(
    a.name,
  )}</b><span class="status ${taskStatusClass(a.status)}">${esc(a.status)}</span></div>${pathHtml(a)}${meta ? `<div class="ca-meta">${meta}</div>` : ''}${blocked}</article>`;
}

function groupHtml(group: ActivityGroup, list: CollaboratorActivity[]): string {
  const items = list.filter((a) => a.group === group);
  const body = items.length ? items.map(activityHtml).join('') : '<div class="ca-empty">Nada aqui.</div>';
  // Concluídas ficam recolhidas para não competir com o que ainda precisa ser feito.
  const open = group !== 'done' ? 'open' : '';
  return `<details class="ca-group g-${group}" ${open}><summary><span>${GROUP_LABELS[group]}</span><span class="ca-count">${items.length}</span></summary><div class="ca-list">${body}</div></details>`;
}

function renderPanel(u: User): void {
  setPageHeader(u.name, [identity(u), u.email].filter(Boolean).join(' · ') || 'Colaborador', false);
  setFilterBar('collaborator-panel', () => '');
  const { activities, summary: s } = collaboratorData(u);
  const tiles = `<div class="cstats big">${stat(s.tasks, 'tarefas')}${stat(s.etapas, 'etapas')}${stat(s.pending, 'pendentes')}${stat(s.done, 'concluídas', 'ok')}${stat(
    s.waiting,
    'em espera',
    s.waiting ? 'warn' : '',
  )}${stat(s.late, 'atrasadas', s.late ? 'bad' : '')}</div>`;
  const attention = s.attention
    ? `<div class="ca-attention">${icon('warning')}<span>${plural(s.attention, 'atividade exige', 'atividades exigem')} atenção (atrasada). Elas aparecem primeiro em cada grupo.</span></div>`
    : '';
  const body = activities.length
    ? GROUP_ORDER.map((g) => groupHtml(g, activities)).join('')
    : '<div class="empty">Nenhuma tarefa ou etapa vinculada a este colaborador.</div>';
  pageContent().innerHTML = `<button class="crumb" data-action="collab-back">${icon('chevronLeft')}Todos os colaboradores</button>${tiles}${attention}${body}`;
}

function renderCollaborators(): void {
  const user = findUser(ui.collaboratorId);
  if (ui.collaboratorId && !user) ui.collaboratorId = null;
  if (user) renderPanel(user);
  else renderList();
}

/** Etapa da tarefa, para abrir a tarefa dentro dela. */
function branchOfTask(projectId: string, taskId: string): string | null {
  return db.projects.find((p) => p.id === projectId)?.tasks.find((t) => t.id === taskId)?.branch ?? null;
}

/** Abre a atividade no lugar dela: o projeto e a etapa ou a tarefa. */
function openActivity(projectId: string, kind: string, id: string): void {
  if (!canOpenTab('overview', projectId)) {
    showToast('Você não tem acesso a este projeto.');
    return;
  }
  openProject(projectId);
  if (kind === 'task') {
    openBranch(branchOfTask(projectId, id));
    openTaskModal(id);
  } else openBranch(id);
}

export function initCollaborators(): void {
  registerPage('collaborators', renderCollaborators);
  registerFilterGroup('collaborators', {
    get: () => ui.collaboratorFilters,
    reset: () => {
      ui.collaboratorFilters = emptyCollaboratorFilters();
      resetFilterBar();
    },
    render: refreshPage,
  });
  onClick('collab-open', (el) => {
    ui.collaboratorId = el.dataset.id ?? null;
    window.scrollTo(0, 0);
    refreshPage();
  });
  onClick('collab-back', () => {
    ui.collaboratorId = null;
    refreshPage();
  });
  onClick('collab-activity', (el) => openActivity(el.dataset.project ?? '', el.dataset.kind ?? '', el.dataset.id ?? ''));
}
