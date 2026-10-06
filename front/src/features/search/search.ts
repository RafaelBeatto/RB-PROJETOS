/**
 * Busca geral: projetos, etapas, tarefas, subtarefas e pessoas.
 * Só procura nos projetos que o usuário logado pode ver (Visualizadores com acesso
 * limitado não encontram os outros projetos).
 */
import { openBranch, openProject } from '../../app/navigation';
import { avatar } from '../../components/avatar';
import { closeModal, modalField, openModal } from '../../components/modal';
import { db } from '../../services/db';
import { visibleProjects } from '../../services/permissionService';
import { findProfile } from '../../services/profileService';
import { agreementName, hasAgreement } from '../../services/projectService';
import { findTask } from '../../services/taskService';
import { findUser, taskPeopleNames } from '../../services/userService';
import type { Project } from '../../types/project';
import type { User } from '../../types/user';
import { onClick } from '../../utils/actions';
import { esc } from '../../utils/dom';
import { openSubtaskModal } from '../tasks/subtaskModal';
import { openTaskModal } from '../tasks/taskModal';

type Kind = 'project' | 'branch' | 'task' | 'subtask' | 'person';

interface Result {
  kind: Kind;
  label: string;
  where: string;
  projectId?: string;
  branchId?: string;
  taskId?: string;
  subtaskId?: string;
  userId?: string;
}

const KIND_LABELS: Record<Kind, string> = { project: 'Projeto', branch: 'Etapa', task: 'Tarefa', subtask: 'Subtarefa', person: 'Pessoa' };
const MAX_RESULTS = 60;

function searchProject(p: Project, q: string, out: Result[]): void {
  const has = (text: string): boolean => text.toLowerCase().includes(q);
  const extra = [p.processo && `processo ${p.processo}`, hasAgreement(p) && `${agreementName(p)} ${p.convPolitico}`].filter(Boolean).join(' ');
  if (has(`${p.name} ${p.description} ${extra}`)) out.push({ kind: 'project', label: p.name, where: p.archived ? 'Arquivado' : p.status, projectId: p.id });
  for (const b of p.branches) {
    if (has(`${b.name} ${b.description}`)) out.push({ kind: 'branch', label: b.name, where: p.name, projectId: p.id, branchId: b.id });
  }
  for (const t of p.tasks) {
    const etapa = p.branches.find((b) => b.id === t.branch)?.name ?? '';
    if (has(`${t.title} ${t.description} ${taskPeopleNames(t)}`)) out.push({ kind: 'task', label: t.title, where: [p.name, etapa].filter(Boolean).join(' / '), projectId: p.id, taskId: t.id });
    for (const s of t.subtasks) {
      if (has(`${s.title} ${s.description}`)) out.push({ kind: 'subtask', label: s.title, where: `${p.name} / ${t.title}`, projectId: p.id, taskId: t.id, subtaskId: s.id });
    }
  }
}

function search(query: string): Result[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: Result[] = [];
  for (const u of db.users) {
    if (`${u.name} ${u.email} ${u.role} ${u.phone}`.toLowerCase().includes(q)) {
      results.push({ kind: 'person', label: u.name, where: [u.role, u.active ? '' : 'Inativo'].filter(Boolean).join(' · ') || 'Usuário', userId: u.id });
    }
  }
  for (const p of visibleProjects()) searchProject(p, q, results);
  return results.slice(0, MAX_RESULTS);
}

function resultsHtml(query: string): string {
  if (!query.trim()) return '';
  const found = search(query);
  if (!found.length) return '<div class="result">Nenhum resultado.</div>';
  return found
    .map(
      (r) =>
        `<div class="result" data-action="search-open" data-kind="${r.kind}" data-project="${r.projectId ?? ''}" data-branch="${r.branchId ?? ''}" data-task="${r.taskId ?? ''}" data-subtask="${
          r.subtaskId ?? ''
        }" data-user="${r.userId ?? ''}" tabindex="0"><strong>${esc(r.label)}</strong><small>${KIND_LABELS[r.kind]} · ${esc(r.where)}</small></div>`,
    )
    .join('');
}

/** Ficha da pessoa: contato e o que ela tem nos projetos que o usuário logado vê. */
function openPerson(u: User): void {
  const rows: string[] = [];
  for (const p of visibleProjects()) {
    if (p.coordinators.includes(u.id)) rows.push(`<div class="result" data-action="search-open" data-kind="project" data-project="${p.id}" tabindex="0"><strong>${esc(p.name)}</strong><small>Coordena o projeto</small></div>`);
    for (const b of p.branches) {
      if (b.assignees.includes(u.id))
        rows.push(`<div class="result" data-action="search-open" data-kind="branch" data-project="${p.id}" data-branch="${b.id}" tabindex="0"><strong>${esc(b.name)}</strong><small>Responsável pela etapa · ${esc(p.name)}</small></div>`);
    }
    for (const t of p.tasks) {
      if (t.assignees.includes(u.id))
        rows.push(`<div class="result" data-action="search-open" data-kind="task" data-project="${p.id}" data-task="${t.id}" tabindex="0"><strong>${esc(t.title)}</strong><small>Responsável pela tarefa · ${esc(t.status)} · ${esc(p.name)}</small></div>`);
    }
  }
  const contact = [u.role, findProfile(u.profileId)?.name, u.email, u.phone, u.active ? '' : 'Inativo'].filter(Boolean).map(esc).join(' · ');
  openModal(
    u.name,
    `<div class="account-head">${avatar(u)}<div><b>${esc(u.name)}</b><small>${contact}</small></div></div><div class="search-results">${rows.join('') || '<div class="result">Nenhum vínculo nos projetos que você vê.</div>'}</div>`,
  );
}

export function openSearch(): void {
  openModal(
    'Pesquisar',
    `<input id="globalSearch" class="field search-input" placeholder="Projetos, etapas, tarefas, subtarefas ou pessoas" aria-label="Pesquisar" autocomplete="off"><div class="search-results" id="results"></div>`,
  );
  const input = modalField<HTMLInputElement>('#globalSearch');
  const results = modalField<HTMLElement>('#results');
  input.addEventListener('input', () => {
    results.innerHTML = resultsHtml(input.value);
  });
  input.focus();
}

export function initSearch(): void {
  onClick('search', openSearch);
  onClick('search-open', (el) => {
    const d = el.dataset;
    if (d.kind === 'person') {
      const u = findUser(d.user);
      if (u) openPerson(u);
      return;
    }
    closeModal();
    openProject(d.project ?? '');
    if (d.kind === 'branch') openBranch(d.branch ?? null);
    if (d.kind === 'task' || d.kind === 'subtask') {
      const p = visibleProjects().find((x) => x.id === d.project);
      const t = p ? findTask(p, d.task) : undefined;
      if (!t) return;
      openBranch(t.branch);
      if (d.kind === 'subtask') openSubtaskModal(t.id, d.subtask);
      else openTaskModal(t.id);
    }
  });
}
