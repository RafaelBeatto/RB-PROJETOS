/**
 * Aba "Etapas": Kanban das etapas (etapas) do projeto. É a tela inicial do projeto.
 * Mostra só as etapas; as tarefas ficam dentro de cada etapa (janela de detalhes).
 */
import { currentProject, refreshProject } from '../../app/navigation';
import { openModal } from '../../components/modal';
import { taskStatusClass } from '../../utils/format';
import { avatar } from '../../components/avatar';
import { icon } from '../../components/icons';
import { showToast } from '../../components/toast';
import { enableMouseDrag, enableMouseDrop, enableTouchDrag } from '../../components/touchDrag';
import { findBranch, pathLabel, setBranchStatus, tasksIn } from '../../services/branchService';
import { DependencyError, blockedSnapshot, branchRef, releasedSince } from '../../services/dependencyService';
import { can } from '../../services/permissionService';
import { isLate } from '../../services/taskService';
import { findUser } from '../../services/userService';
import type { Branch } from '../../types/branch';
import type { Project } from '../../types/project';
import { TASK_STATUSES, type TaskStatus } from '../../types/task';
import { onClick } from '../../utils/actions';
import { $$, esc, plural } from '../../utils/dom';
import { blockedBadge } from '../dependencies/dependencyView';
import { registerTab } from '../projects/projectView';
import { branchFilterBar, matchesBranchFilters } from './branchFilters';
import { openNewBranchModal } from './branchModals';

/** Mover etapas muda o status: exige Kanban → Editar e Estrutura → Editar. */
const canMove = (p: Project): boolean => can('kanban', 'edit', p.id) && can('structure', 'edit', p.id);

function etapaCard(p: Project, b: Branch): string {
  const path = pathLabel(p, b);
  const designer = findUser(b.designer);
  // Só um aviso de atraso; as tarefas em si aparecem dentro da etapa.
  const late = b.status !== 'Concluído' && tasksIn(p, b.id, true).some(isLate);
  const badge = b.status === 'Concluído' ? '' : blockedBadge(branchRef(p, b));
  return `<article class="task-card ecard${badge ? ' is-blocked' : ''}" draggable="${canMove(p)}" data-action="branch-detail" data-id="${b.id}" tabindex="0"><h3>${esc(
    b.name,
  )}</h3>${path ? `<small class="pc-sub">Dentro de ${esc(path)}</small>` : ''}${badge}<div class="task-card-footer"><span>${
    designer ? `${avatar(designer, true)} ${esc(designer.name)}` : '<span class="sub flat">Sem projetista</span>'
  }</span>${late ? '<span class="late-txt">Com atraso</span>' : ''}</div></article>`;
}

function looseNotice(p: Project): string {
  const loose = p.tasks.filter((t) => !findBranch(p, t.branch)).length;
  if (!loose) return '';
  return `<div class="loose-note">${icon('info')}<span>${plural(loose, 'tarefa está', 'tarefas estão')} sem etapa.</span><button class="ghost" data-action="loose-tasks">Escolher etapa</button></div>`;
}

function renderBoard(p: Project): string {
  const list = p.branches.filter((b) => matchesBranchFilters(p, b));
  const canCreate = can('structure', 'create', p.id);
  const columns = TASK_STATUSES.map((status) => {
    const items = list.filter((b) => b.status === status);
    return `<section class="column" data-status="${status}"><div class="column-head"><span>${status.toUpperCase()} · ${items.length}</span>${
      canCreate && status !== 'Concluído' ? `<button data-action="etapa-new" data-status="${status}" aria-label="Nova etapa em ${status}">${icon('plus')}</button>` : ''
    }</div><div class="dropzone">${items.map((b) => etapaCard(p, b)).join('')}</div></section>`;
  }).join('');
  const empty = p.branches.length
    ? ''
    : `<div class="empty">Nenhuma etapa ainda.${canCreate ? `<br><br><button class="primary" data-action="etapa-new" data-status="A fazer">${icon('plus')}<span>Criar primeira etapa</span></button>` : ''}</div>`;
  return `${branchFilterBar(p)}${looseNotice(p)}${empty || `<div class="board">${columns}</div>`}`;
}

function mountBoard(p: Project, container: HTMLElement): void {
  if (!canMove(p)) return;
  const move = (id: string, column: HTMLElement): void => {
    const b = findBranch(p, id);
    const status = column.dataset.status as TaskStatus | undefined;
    if (!b || !status || !TASK_STATUSES.includes(status)) return;
    const before = blockedSnapshot();
    try {
      if (!setBranchStatus(p, b, status)) return;
    } catch (error) {
      if (!(error instanceof DependencyError)) throw error;
      refreshProject();
      showToast(error.message);
      return;
    }
    refreshProject();
    const released = releasedSince(before);
    showToast(`Etapa movida${released ? ` · ${plural(released, 'item liberado', 'itens liberados')}` : ''}`);
  };
  $$('.ecard', container).forEach((card) => {
    enableMouseDrag(card);
    enableTouchDrag(card, (column) => move(card.dataset.id ?? '', column));
  });
  $$('.column', container).forEach((column) => enableMouseDrop(column, '.ecard', move));
}

/** Tarefas antigas sem etapa: lista para abrir cada uma e escolher a etapa. */
function openLooseTasks(p: Project): void {
  const loose = p.tasks.filter((t) => !findBranch(p, t.branch));
  if (!loose.length) return;
  openModal(
    'Tarefas sem etapa',
    `<p class="sub flat">Abra cada tarefa e escolha a etapa em que ela deve ficar.</p><div class="next-list">${loose
      .map((t) => `<div class="next-task" data-action="task-open" data-id="${t.id}" tabindex="0">${esc(t.title)}<span class="status ${taskStatusClass(t.status)}">${esc(t.status)}</span></div>`)
      .join('')}</div>`,
  );
}

export function initEtapaBoard(): void {
  registerTab('kanban', { render: renderBoard, mount: mountBoard });
  onClick('etapa-new', (el) => {
    const status = el.dataset.status as TaskStatus | undefined;
    openNewBranchModal(null, status && TASK_STATUSES.includes(status) ? status : 'A fazer');
  });
  onClick('loose-tasks', () => openLooseTasks(currentProject()));
}
