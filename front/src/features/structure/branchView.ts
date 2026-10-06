/**
 * Etapa aberta: dados da etapa e as tarefas dela em forma de checklist.
 * Marcar a caixa conclui a tarefa (desmarcar volta para "A fazer"); clicar no nome abre a
 * tarefa (subtarefas, checklist, dependências…). Tarefas novas são criadas digitando o nome.
 */
import { openBranch, refreshProject } from '../../app/navigation';
import { avatarStack } from '../../components/avatar';
import { clearButton, filterSearch, filterSelect, registerFilterGroup } from '../../components/filterBar';
import { icon } from '../../components/icons';
import { datesBadge, peopleLine, priorityBadge } from '../../components/itemParts';
import { progressRow } from '../../components/progress';
import { showToast } from '../../components/toast';
import { branchProgress, tasksIn } from '../../services/branchService';
import { db } from '../../services/db';
import { canCreateSubtask, canCreateTask, canEditBranch, canEditSubtask, canEditTask } from '../../services/permissionService';
import { RuleError } from '../../services/errors';
import { dependencyItems } from '../../services/dependencyService';
import { checklistProgress, createSubtask, createTask, findSubtask, findTask, setSubtaskStatus, setTaskStatus } from '../../services/taskService';
import { findUser } from '../../services/userService';
import { emptyTaskFilters, ui } from '../../state/store';
import type { Branch } from '../../types/branch';
import type { Project } from '../../types/project';
import { PRIORITIES, TASK_STATUSES, type Task, type TaskStatus } from '../../types/task';
import { onClick } from '../../utils/actions';
import { $$, esc, plural } from '../../utils/dom';
import { taskStatusClass } from '../../utils/format';
import { relationsHtml } from '../dependencies/depPicker';
import { attachmentsHtml, bindAttachments } from '../tasks/attachments';
import { openSubtaskModal } from '../tasks/subtaskModal';
import { openTaskModal } from '../tasks/taskModal';
import { openEditBranchModal } from './branchModals';

function matches(t: Task): boolean {
  const f = ui.taskFilters;
  const q = f.q.trim().toLowerCase();
  const names = t.assignees.map((id) => findUser(id)?.name ?? '').join(' ');
  if (q && !`${t.title} ${t.description} ${names} ${t.subtasks.map((s) => s.title).join(' ')}`.toLowerCase().includes(q)) return false;
  if (f.person === 'none' && t.assignees.length) return false;
  if (f.person && f.person !== 'none' && !t.assignees.includes(f.person)) return false;
  if (f.priority && t.priority !== (f.priority === 'none' ? '' : f.priority)) return false;
  return true;
}

function filterBar(): string {
  const f = ui.taskFilters;
  const active = !!(f.q.trim() || f.person || f.priority);
  return `<div class="fbar">${filterSearch('tasks.q', 'Filtrar tarefas', f.q)}<div class="fchips">${filterSelect(
    'tasks.person',
    'Responsável',
    [['none', 'Sem responsável'] as const, ...db.users.map((u) => [u.id, u.name] as const)],
    f.person,
    'Todos',
  )}${filterSelect('tasks.priority', 'Prioridade', [...PRIORITIES.map((x) => [x, x] as const), ['none', 'Sem prioridade'] as const], f.priority, 'Todas')}${
    active ? clearButton('tasks') : ''
  }</div></div>`;
}

/** Tarefas com subtarefas e anexos abertos (continua aberto ao redesenhar a tela). */
const expanded = new Set<string>();

/** Parte expandida da linha: subtarefas (com caixas) e anexos. */
function detailHtml(p: Project, t: Task): string {
  const canSub = canEditSubtask(p, t);
  const subs = t.subtasks
    .map((st) => {
      const done = st.status === 'Concluído';
      return `<li class="srow${done ? ' done' : ''}"><input type="checkbox" data-sub-done="${t.id}|${st.id}" ${done ? 'checked' : ''} ${canSub ? '' : 'disabled'} aria-label="Concluir subtarefa ${esc(
        st.title,
      )}"><button class="sname" data-sub-open="${t.id}|${st.id}">${esc(st.title)}</button>${st.status === 'Em andamento' ? `<span class="status ${taskStatusClass(st.status)}">Em andamento</span>` : ''}${datesBadge(
        st.start,
        st.due,
        done,
      )}</li>`;
    })
    .join('');
  const addSub = canCreateSubtask(p, t)
    ? `<form class="tadd sadd" data-sub-add="${t.id}"><span class="tadd-ico">${icon('plus')}</span><input class="field" name="title" placeholder="Adicionar subtarefa e apertar Enter" aria-label="Nova subtarefa" autocomplete="off"></form>`
    : '';
  return `<div class="tdetail"><div class="tdetail-col"><div class="lbl">Subtarefas</div>${subs ? `<ul class="slist">${subs}</ul>` : '<span class="sub flat small">Nenhuma subtarefa.</span>'}${addSub}</div><div class="tdetail-col"><div class="lbl">Anexos</div><div data-att-root="${
    t.id
  }">${attachmentsHtml(t, canEditTask(p, t))}</div></div></div>`;
}

/** Uma linha do checklist: caixa (concluída ou não), nome e os detalhes principais. */
function taskRow(p: Project, t: Task): string {
  const done = t.status === 'Concluído';
  const editable = canEditTask(p, t);
  const open = expanded.has(t.id);
  const deps = dependencyItems(p, t.dependencies);
  const subDone = t.subtasks.filter((s) => s.status === 'Concluído').length;
  const check = checklistProgress(t);
  const facts = [
    t.status === 'Em andamento' ? `<span class="status ${taskStatusClass(t.status)}">Em andamento</span>` : '',
    priorityBadge(t.priority),
    t.subtasks.length ? `<span class="tfact" title="Subtarefas concluídas">${icon('branch')}${subDone}/${t.subtasks.length}</span>` : '',
    check.total ? `<span class="tfact" title="Itens do checklist">${icon('selectOn')}${check.done}/${check.total}</span>` : '',
    t.links.length ? `<span class="tfact" title="Anexos">${icon('paperclip')}${t.links.length}</span>` : '',
    deps.length
      ? `<span class="tfact" title="Depende de: ${esc(deps.map((d) => `${d.kind === 'branch' ? 'etapa ' : ''}${d.name} (${d.status})`).join(', '))}">${icon('link')}${esc(deps.map((d) => d.name).join(', '))}</span>`
      : '',
    datesBadge(t.start, t.due, done),
  ].join('');
  return `<li class="trow${done ? ' done' : ''}"><label class="tcheck" title="${
    editable ? (done ? 'Marcar como não concluída' : 'Marcar como concluída') : 'Sem permissão para alterar esta tarefa'
  }"><input type="checkbox" data-task-done="${t.id}" ${done ? 'checked' : ''} ${editable ? '' : 'disabled'} aria-label="Concluir ${esc(t.title)}"></label><div class="tmain"><button class="tname" data-action="task-open" data-id="${
    t.id
  }">${esc(t.title)}</button>${facts ? `<div class="tfacts">${facts}</div>` : ''}${open ? detailHtml(p, t) : ''}</div><span class="tpeople">${avatarStack(
    t.assignees,
  )}</span><button class="texp" data-expand="${t.id}" aria-expanded="${open}" title="${open ? 'Recolher' : 'Subtarefas e anexos'}" aria-label="${
    open ? 'Recolher' : 'Ver subtarefas e anexos'
  } de ${esc(t.title)}">${icon(open ? 'chevronDown' : 'chevronRight')}</button></li>`;
}

function header(p: Project, b: Branch): string {
  const prog = branchProgress(p, b);
  const edit = canEditBranch(p) ? `<button class="ghost" data-action="branch-edit" data-id="${b.id}">${icon('edit')}<span>Editar etapa</span></button>` : '';
  const add = canCreateTask(p, b) ? `<button class="primary" data-action="task-new" data-branch="${b.id}" data-status="A fazer">${icon('plus')}<span>Nova tarefa</span></button>` : '';
  return `<button class="crumb" data-action="branch-back">${icon('chevronLeft')}Etapas</button><div class="etapa-head"><div><h2>${esc(b.name)}</h2><div class="p-meta"><span class="status ${taskStatusClass(
    b.status,
  )}">${esc(b.status)}</span>${priorityBadge(b.priority)}${datesBadge(b.start, b.due, b.status === 'Concluído')}<span class="p-people">${peopleLine(
    b.assignees,
  )}</span><span class="p-prog" title="Tarefas concluídas">${progressRow(prog.pct)}<small>${prog.done}/${prog.total} tarefas</small></span></div>${
    b.description.trim() ? `<p class="desc">${esc(b.description)}</p>` : ''
  }${relationsHtml(p, b.id, b.dependencies)}</div><div class="top-actions">${edit}${add}</div></div>`;
}

export function renderBranchView(p: Project, b: Branch): string {
  const all = tasksIn(p, b.id);
  const list = all.filter(matches);
  const canCreate = canCreateTask(p, b);
  const pending = list.filter((t) => t.status !== 'Concluído');
  const done = list.filter((t) => t.status === 'Concluído');
  const add = canCreate
    ? `<form class="tadd" id="taskQuickAdd"><span class="tadd-ico">${icon('plus')}</span><input class="field" name="title" placeholder="Adicionar tarefa e apertar Enter" aria-label="Nova tarefa" autocomplete="off"><button class="ghost">Adicionar</button></form>`
    : '';
  const empty = all.length
    ? ''
    : `<p class="sub tlist-empty">${
        canCreate
          ? 'Nenhuma tarefa nesta etapa ainda. Digite acima para criar a primeira.'
          : b.assignees.length
            ? 'Nenhuma tarefa nesta etapa. Só os responsáveis pela etapa, coordenadores e administradores criam tarefas aqui.'
            : 'Nenhuma tarefa nesta etapa. Defina um responsável pela etapa para que ele possa criar tarefas.'
      }</p>`;
  const pendingList = pending.length ? `<ul class="tlist">${pending.map((t) => taskRow(p, t)).join('')}</ul>` : all.length && list.length ? '<p class="sub tlist-empty">Tudo concluído nesta etapa.</p>' : '';
  const doneList = done.length
    ? `<details class="tdone" ${pending.length ? '' : 'open'}><summary>${plural(done.length, 'tarefa concluída', 'tarefas concluídas')}</summary><ul class="tlist">${done.map((t) => taskRow(p, t)).join('')}</ul></details>`
    : '';
  const filtered = all.length && !list.length ? '<p class="sub">Nenhuma tarefa encontrada com esses filtros.</p>' : '';
  return `${header(p, b)}${all.length ? filterBar() : ''}<div class="tchecklist">${add}${empty}${pendingList}${doneList}${filtered}</div>`;
}

export function mountBranchView(p: Project, container: HTMLElement): void {
  $$('[data-expand]', container).forEach((el) =>
    el.addEventListener('click', () => {
      const id = el.dataset.expand ?? '';
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      refreshProject();
    }),
  );
  $$<HTMLInputElement>('[data-sub-done]', container).forEach((box) =>
    box.addEventListener('change', () => {
      const [tid, sid] = (box.dataset.subDone ?? '').split('|');
      const t = findTask(p, tid);
      const st = t && findSubtask(t, sid);
      if (!t || !st) return;
      setSubtaskStatus(p, t, st, box.checked ? 'Concluído' : 'A fazer');
      refreshProject();
    }),
  );
  $$('[data-sub-open]', container).forEach((el) =>
    el.addEventListener('click', () => {
      const [tid, sid] = (el.dataset.subOpen ?? '').split('|');
      openSubtaskModal(tid ?? '', sid);
    }),
  );
  $$<HTMLFormElement>('[data-sub-add]', container).forEach((f) =>
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = findTask(p, f.dataset.subAdd);
      const input = f.elements.namedItem('title') as HTMLInputElement;
      const title = input.value.trim();
      if (!t || !title) return;
      try {
        createSubtask(p, t, { title, description: '', priority: '', start: '', due: '', status: 'A fazer' });
      } catch (error) {
        if (!(error instanceof RuleError)) throw error;
        showToast(error.message);
        return;
      }
      refreshProject();
      document.querySelector<HTMLInputElement>(`[data-sub-add="${t.id}"] input`)?.focus();
    }),
  );
  $$('[data-att-root]', container).forEach((root) => {
    const t = findTask(p, root.dataset.attRoot);
    if (t) bindAttachments(root, p, t, refreshProject);
  });
  $$('[data-goto-task]', container).forEach((el) => el.addEventListener('click', () => openTaskModal(el.dataset.gotoTask)));
  $$('[data-goto-branch]', container).forEach((el) => el.addEventListener('click', () => openBranch(el.dataset.gotoBranch ?? null)));
  $$<HTMLInputElement>('[data-task-done]', container).forEach((box) =>
    box.addEventListener('change', () => {
      const t = findTask(p, box.dataset.taskDone);
      if (!t) return;
      const status: TaskStatus = box.checked ? 'Concluído' : 'A fazer';
      if (setTaskStatus(p, t, status)) showToast(box.checked ? `“${t.title}” concluída` : `“${t.title}” reaberta`);
      refreshProject();
    }),
  );
  const form = container.querySelector<HTMLFormElement>('#taskQuickAdd');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.elements.namedItem('title') as HTMLInputElement;
    const title = input.value.trim();
    const b = ui.branchId;
    if (!title || !b) return;
    try {
      createTask(p, { title, status: 'A fazer', priority: '', assignees: [], assignee: '', start: '', due: '', branch: b, description: '', dependencies: [] });
    } catch (error) {
      if (!(error instanceof RuleError)) throw error;
      showToast(error.message);
      return;
    }
    refreshProject();
    // Continua no campo para adicionar a próxima em sequência.
    document.querySelector<HTMLInputElement>('#taskQuickAdd input')?.focus();
  });
}

export function initBranchView(): void {
  registerFilterGroup('tasks', {
    get: () => ui.taskFilters,
    reset: () => {
      ui.taskFilters = emptyTaskFilters();
    },
    render: refreshProject,
  });
  onClick('branch-back', () => openBranch(null));
  onClick('branch-edit', (el) => openEditBranchModal(el.dataset.id ?? ''));
  onClick('task-open', (el) => openTaskModal(el.dataset.id));
  onClick('task-new', (el) => {
    const status = el.dataset.status as TaskStatus | undefined;
    openTaskModal(undefined, status && TASK_STATUSES.includes(status) ? status : 'A fazer', el.dataset.branch ?? ui.branchId ?? '');
  });
}
