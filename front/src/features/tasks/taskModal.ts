/**
 * Janela da tarefa: dados da tarefa (formulário) e, para tarefas já criadas,
 * dependências, subtarefas, checklist, comentários e anexos.
 *
 * Cada seção segue a própria regra de permissão:
 * - Formulário, dependências, comentários e anexos: quem edita a tarefa.
 * - Subtarefas: Administrador, Coordenador ou o responsável pela tarefa.
 * - Checklist: só o responsável pela tarefa (e o Administrador).
 */
import { NO_ACCESS } from '../../app/access';
import { currentProject, refreshProject } from '../../app/navigation';
import { askFields, confirmDanger } from '../../components/dialog';
import { icon } from '../../components/icons';
import { commonFields, datesBadge, peopleLine, priorityBadge, readCommon, statusSelect } from '../../components/itemParts';
import { closeModal, modalField, openModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import { bindUserPicker, readUserPicker, userPickerHtml } from '../../components/userPicker';
import { findBranch } from '../../services/branchService';
import { RuleError } from '../../services/errors';
import {
  canCreateSubtask,
  canCreateTask,
  canDeleteTask,
  canEditChecklist,
  canEditSubtask,
  canEditTask,
} from '../../services/permissionService';
import {
  addChecklistItem,
  addComment,
  addLink,
  checklistProgress,
  createTask,
  dependencyOptions,
  dependenciesOf,
  dependentsOf,
  findSubtask,
  findTask,
  removeChecklistItem,
  removeLink,
  renameChecklistItem,
  setChecklistItemDone,
  setSubtaskStatus,
  updateTask,
} from '../../services/taskService';
import { describeContents, trashTask } from '../../services/trashService';
import type { Project } from '../../types/project';
import { MAX_RESPONSIBLES, TASK_STATUSES, type Task, type TaskDraft, type TaskStatus } from '../../types/task';
import { $, $$, $maybe, esc } from '../../utils/dom';
import { taskStatusClass } from '../../utils/format';
import { openSubtaskModal } from './subtaskModal';

// Formulário

/** Etapas em que a tarefa pode ficar: as que o usuário pode usar para criar tarefas (e a atual). */
function branchOptions(p: Project, t: Task | undefined, selected: string): string {
  return p.branches
    .filter((b) => b.id === t?.branch || canCreateTask(p, b))
    .map((b) => `<option value="${b.id}" ${b.id === selected ? 'selected' : ''}>${esc(b.name)}</option>`)
    .join('');
}

function dependencyPicker(p: Project, t: Task | undefined, editable: boolean): string {
  const options = dependencyOptions(p, t);
  if (!options.length) return '<p class="sub flat small">Nenhuma outra tarefa neste projeto.</p>';
  const selected = new Set(t?.dependencies ?? []);
  return `<div class="dep-pick">${options
    .map(
      (x) =>
        `<label class="dep-opt"><input type="checkbox" name="dep" value="${x.id}" ${selected.has(x.id) ? 'checked' : ''} ${editable ? '' : 'disabled'}><span>${esc(x.title)}<small>${esc(
          findBranch(p, x.branch)?.name ?? '',
        )} · ${esc(x.status)}</small></span></label>`,
    )
    .join('')}</div>`;
}

function formHtml(p: Project, t: Task | undefined, status: TaskStatus, branch: string, editable: boolean): string {
  const canRemove = !!t && canDeleteTask(p, t);
  return `<form id="taskForm" novalidate><fieldset class="plain" ${editable ? '' : 'disabled'}><div class="form-grid"><div class="form-full"><label>Título<input class="field" name="title" required value="${esc(
    t?.title ?? '',
  )}"></label></div>${statusSelect(TASK_STATUSES, t?.status ?? status)}<label>Etapa<select class="field" name="branch">${branchOptions(p, t, t?.branch ?? branch)}</select></label>${commonFields(
    t,
  )}</div><div class="form-full"><div class="lbl">Responsáveis (até ${MAX_RESPONSIBLES}, opcional)</div>${userPickerHtml('assigneePick', t?.assignees ?? [], MAX_RESPONSIBLES)}${
    t?.assignee.trim()
      ? `<label class="check-row legacy-assignee"><input type="checkbox" name="keepLegacy" checked> Manter também o nome antigo “${esc(t.assignee)}” (sem cadastro de usuário)</label>`
      : ''
  }</div><details class="form-full deps-box" ${t?.dependencies.length ? 'open' : ''}><summary>${icon('link')}Depende de <small>(informativo: não impede iniciar nem concluir)</small></summary>${dependencyPicker(
    p,
    t,
    editable,
  )}</details></fieldset><p class="form-error" id="taskErr" role="alert"></p><div class="modal-actions">${
    canRemove ? `<button type="button" class="danger" id="deleteTask">${icon('trash')}Excluir</button>` : '<span></span>'
  }${editable ? `<button class="primary">${t ? 'Salvar' : 'Criar tarefa'}</button>` : ''}</div></form>`;
}

function readDraft(form: HTMLFormElement, task: Task | undefined): TaskDraft {
  const data = new FormData(form);
  const text = (name: string): string => String(data.get(name) ?? '').trim();
  const status = text('status') as TaskStatus;
  return {
    title: text('title'),
    status: TASK_STATUSES.includes(status) ? status : 'A fazer',
    ...readCommon(data),
    assignees: readUserPicker(modalField('#assigneePick')),
    // O nome antigo (sem cadastro) só continua se a caixa ficar marcada.
    assignee: data.get('keepLegacy') === 'on' ? (task?.assignee ?? '') : '',
    branch: text('branch'),
    dependencies: data.getAll('dep').map(String),
  };
}

// Seções da tarefa já criada (cada uma se redesenha sozinha, sem perder o que está no formulário)

function relationsHtml(p: Project, t: Task): string {
  const deps = dependenciesOf(p, t);
  const dependents = dependentsOf(p, t);
  if (!deps.length && !dependents.length) return '';
  const list = (items: Task[]): string =>
    items.map((x) => `<button type="button" class="chip dep-chip" data-goto-task="${x.id}">${esc(x.title)} <span class="status ${taskStatusClass(x.status)}">${esc(x.status)}</span></button>`).join('');
  return `<div class="deps-view">${deps.length ? `<div><span class="lbl">${icon('link')} Depende de</span>${list(deps)}</div>` : ''}${
    dependents.length ? `<div><span class="lbl">${icon('arrowRight')} Outras tarefas dependem desta</span>${list(dependents)}</div>` : ''
  }</div>`;
}

function subtasksHtml(p: Project, t: Task): string {
  const editable = canEditSubtask(p, t);
  const rows = t.subtasks
    .map((s) => {
      const status = editable
        ? `<select class="field mini" data-sub-status="${s.id}" aria-label="Status de ${esc(s.title)}">${TASK_STATUSES.map((x) => `<option ${x === s.status ? 'selected' : ''}>${x}</option>`).join('')}</select>`
        : `<span class="status ${taskStatusClass(s.status)}">${esc(s.status)}</span>`;
      return `<div class="sub-row ${s.status === 'Concluído' ? 'done' : ''}"><button type="button" class="sub-title" data-sub-open="${s.id}">${esc(s.title)}</button>${priorityBadge(s.priority)}${datesBadge(
        s.start,
        s.due,
        s.status === 'Concluído',
      )}${status}</div>`;
    })
    .join('');
  const add = canCreateSubtask(p, t) ? `<button class="ghost" type="button" data-sub-new>${icon('plus')}Subtarefa</button>` : '';
  return `<div class="sec-head"><h3>Subtarefas</h3>${add}</div><p class="sub small">Responsáveis (herdados da tarefa): ${peopleLine(t.assignees)}</p>${
    rows ? `<div class="sub-list">${rows}</div>` : '<p class="sub flat small">Nenhuma subtarefa.</p>'
  }`;
}

function checklistHtml(p: Project, t: Task): string {
  const editable = canEditChecklist(p, t);
  const { done, total } = checklistProgress(t);
  const rows = t.checklist
    .map(
      (c) =>
        `<div class="ck-row ${c.done ? 'done' : ''}"><input type="checkbox" data-ck="${c.id}" ${c.done ? 'checked' : ''} ${editable ? '' : 'disabled'} aria-label="Marcar ${esc(c.text)}"><span class="ck-text" ${
          editable ? `data-ck-rename="${c.id}" title="Clique para editar"` : ''
        }>${esc(c.text)}</span>${editable ? `<button type="button" class="sub-x" data-ck-remove="${c.id}" aria-label="Excluir item">${icon('close')}</button>` : ''}</div>`,
    )
    .join('');
  const add = editable
    ? '<div class="cmt-add"><input class="field" id="ckText" placeholder="Novo item do checklist" aria-label="Novo item"><button class="ghost" type="button" id="ckAdd">Adicionar</button></div>'
    : `<p class="sub flat small">${t.assignees.length ? 'Só o responsável pela tarefa altera o checklist.' : 'A tarefa está sem responsável: o checklist fica só para leitura.'}</p>`;
  return `<div class="sec-head"><h3>Checklist ${total ? `<small>${done}/${total}</small>` : ''}</h3></div>${rows ? `<div class="ck-list">${rows}</div>` : ''}${add}`;
}

function commentsHtml(t: Task): string {
  return t.comments.map((c) => `<div class="cmt"><b>${esc(c.who)}</b>${esc(c.text)}</div>`).join('') || '<div class="cmt"><b>Nenhum comentário.</b></div>';
}

function linksHtml(t: Task, editable: boolean): string {
  return t.links
    .map((l) => {
      const isUrl = /^https?:\/\//i.test(l.url);
      const label = esc(l.label || l.url);
      const content = isUrl ? `${icon('link')} <a href="${esc(l.url)}" target="_blank" rel="noopener">${label}</a>` : `${icon('paperclip')} ${label}`;
      return `<div class="lnk"><span>${content}</span>${editable ? `<button type="button" data-del-link="${l.id}" aria-label="Remover">${icon('close')}</button>` : ''}</div>`;
    })
    .join('');
}

function extrasHtml(t: Task, editable: boolean): string {
  const addComment = editable
    ? '<div class="cmt-add"><input class="field" id="cmtText" placeholder="Escrever comentário" aria-label="Comentário"><button class="ghost" type="button" id="cmtBtn">Enviar</button></div>'
    : '';
  const addLink = editable ? `<button class="ghost" type="button" id="lnkBtn">${icon('plus')}Link ou arquivo</button>` : '';
  return `<div class="sec"><h3>Comentários</h3><div id="cmts">${commentsHtml(t)}</div>${addComment}</div><div class="sec"><h3>Anexos</h3><div id="lnks">${
    linksHtml(t, editable) || (editable ? '' : '<span class="sub flat">Nenhum anexo.</span>')
  }</div>${addLink}</div>`;
}

// Ligações

/** Executa a ação; erros de regra viram aviso. */
function attempt(run: () => void): boolean {
  try {
    run();
    return true;
  } catch (error) {
    if (!(error instanceof RuleError)) throw error;
    showToast(error.message);
    return false;
  }
}

function bindSubtasks(p: Project, t: Task): void {
  const box = modalField<HTMLElement>('#subBox');
  const redraw = (): void => {
    box.innerHTML = subtasksHtml(p, t);
    refreshProject();
  };
  box.addEventListener('change', (e) => {
    const select = (e.target as Element).closest<HTMLSelectElement>('[data-sub-status]');
    const s = findSubtask(t, select?.dataset.subStatus);
    if (!select || !s) return;
    setSubtaskStatus(p, t, s, select.value as TaskStatus);
    redraw();
  });
  box.addEventListener('click', (e) => {
    const target = e.target as Element;
    const open = target.closest<HTMLElement>('[data-sub-open]');
    if (open) openSubtaskModal(t.id, open.dataset.subOpen);
    else if (target.closest('[data-sub-new]')) openSubtaskModal(t.id);
  });
}

function bindChecklist(p: Project, t: Task): void {
  const box = modalField<HTMLElement>('#ckBox');
  const redraw = (): void => {
    box.innerHTML = checklistHtml(p, t);
    refreshProject();
    $maybe<HTMLInputElement>('#ckText', box)?.focus();
  };
  const add = (): void => {
    const input = $maybe<HTMLInputElement>('#ckText', box);
    if (!input?.value.trim()) return;
    if (attempt(() => addChecklistItem(p, t, input.value))) redraw();
  };
  box.addEventListener('change', (e) => {
    const check = (e.target as Element).closest<HTMLInputElement>('[data-ck]');
    if (!check?.dataset.ck) return;
    setChecklistItemDone(p, t, check.dataset.ck, check.checked);
    redraw();
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.target as Element).id === 'ckText') {
      e.preventDefault();
      add();
    }
  });
  box.addEventListener('click', async (e) => {
    const target = e.target as Element;
    if (target.closest('#ckAdd')) return add();
    const remove = target.closest<HTMLElement>('[data-ck-remove]');
    if (remove?.dataset.ckRemove) {
      removeChecklistItem(p, t, remove.dataset.ckRemove);
      return redraw();
    }
    const rename = target.closest<HTMLElement>('[data-ck-rename]');
    const item = t.checklist.find((c) => c.id === rename?.dataset.ckRename);
    if (!item) return;
    const r = await askFields('Editar item', [{ label: 'Texto', value: item.text, required: true }]);
    if (!r?.[0]) return;
    renameChecklistItem(p, t, item.id, r[0]);
    redraw();
  });
}

function bindExtras(p: Project, t: Task): void {
  const input = modalField<HTMLInputElement>('#cmtText');
  const send = (): void => {
    const text = input.value.trim();
    if (!text) return;
    addComment(p, t, text);
    input.value = '';
    modalField('#cmts').innerHTML = commentsHtml(t);
  };
  modalField('#cmtBtn').addEventListener('click', send);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  });
  const links = modalField<HTMLElement>('#lnks');
  modalField('#lnkBtn').addEventListener('click', async () => {
    const r = await askFields('Adicionar anexo', [{ label: 'Link (https://…) ou nome do arquivo', required: true }, { label: 'Nome de exibição (opcional)' }]);
    if (!r?.[0]) return;
    addLink(p, t, r[0], r[1] ?? '');
    links.innerHTML = linksHtml(t, true);
  });
  links.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLElement>('[data-del-link]');
    if (!button?.dataset.delLink) return;
    removeLink(p, t, button.dataset.delLink);
    links.innerHTML = linksHtml(t, true);
  });
}

async function confirmTrash(p: Project, t: Task): Promise<void> {
  const inside = describeContents(0, [], t.subtasks.length);
  const ok = await confirmDanger(
    `Excluir a tarefa “${t.title}”?`,
    `A tarefa${inside ? ` e as subtarefas dela (${inside})` : ''} vai para a lixeira. Administradores e coordenadores podem restaurar.`,
    'Enviar para a lixeira',
  );
  if (!ok) return;
  trashTask(p, t.id);
  closeModal();
  refreshProject();
  showToast('Tarefa enviada para a lixeira');
}

export function openTaskModal(id?: string, status: TaskStatus = 'A fazer', branch = ''): void {
  const p = currentProject();
  const task = findTask(p, id);
  if (!task && !canCreateTask(p, findBranch(p, branch))) {
    showToast(NO_ACCESS);
    return;
  }
  const editable = task ? canEditTask(p, task) : true;
  const etapa = findBranch(p, task?.branch ?? branch);
  const path = `<p class="bd-path">${esc(p.name)}${etapa ? ` / ${esc(etapa.name)}` : ''}</p>`;
  const sections = task
    ? `${relationsHtml(p, task)}<div class="sec" id="subBox">${subtasksHtml(p, task)}</div><div class="sec" id="ckBox">${checklistHtml(p, task)}</div>${extrasHtml(task, editable)}`
    : '';
  openModal(task ? (editable ? 'Editar tarefa' : 'Tarefa') : 'Nova tarefa', `${path}${formHtml(p, task, status, branch, editable)}${sections}`);
  bindUserPicker(modalField('#assigneePick'));
  if (task) {
    bindSubtasks(p, task);
    bindChecklist(p, task);
    if (editable) bindExtras(p, task);
    $$('[data-goto-task]', $('#modalBody')).forEach((el) => el.addEventListener('click', () => openTaskModal(el.dataset.gotoTask)));
  }

  const form = modalField<HTMLFormElement>('#taskForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      const draft = readDraft(form, task);
      if (task) updateTask(p, task, draft);
      else createTask(p, draft);
    } catch (error) {
      if (!(error instanceof RuleError)) throw error;
      modalField('#taskErr').textContent = error.message;
      return;
    }
    closeModal();
    refreshProject();
    showToast(task ? 'Tarefa salva' : 'Tarefa criada');
  });
  if (task) document.getElementById('deleteTask')?.addEventListener('click', () => void confirmTrash(p, task));
  if (!task) modalField<HTMLInputElement>('[name="title"]').focus();
}
