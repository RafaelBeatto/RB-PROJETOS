import { currentProject, refreshProject } from '../../app/navigation';
import { askFields } from '../../components/dialog';
import { icon } from '../../components/icons';
import { closeModal, modalField, openModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import { DependencyError, NEW_ID, blockedSnapshot, releasedSince, taskRef } from '../../services/dependencyService';
import { addComment, addLink, deleteTask, findTask, removeLink, saveTask } from '../../services/taskService';
import { dependencySection, mountDependencyEditor, type DependencyEditor } from '../dependencies/dependencyEditor';
import { blockersPanel, dependentsLine } from '../dependencies/dependencyView';
import type { Project } from '../../types/project';
import { PRIORITIES, TASK_STATUSES, type Priority, type Subtask, type Task, type TaskDraft, type TaskStatus } from '../../types/task';
import { NO_ACCESS } from '../../app/access';
import { can } from '../../services/permissionService';
import { $$, esc, plural } from '../../utils/dom';
import { uid } from '../../utils/ids';

/** Situação da tarefa: o que a bloqueia (inclusive regras herdadas) e o que ela libera. */
function dependencyStatus(t: Task, p: Project): string {
  const ref = taskRef(p, t);
  return `${blockersPanel(ref, 'Tarefa bloqueada — só pode ficar em “A fazer”')}${dependentsLine(ref)}`;
}

function checklistRow(s: Subtask): string {
  return `<div class="next-task"><input type="checkbox" ${s.done ? 'checked' : ''} data-sub="${s.id}" aria-label="Concluído"><span class="sub-t" title="Toque para renomear">${esc(
    s.title,
  )}</span><button type="button" class="sub-x" aria-label="Remover item">${icon('close')}</button></div>`;
}

function commentsHtml(t: Task): string {
  return t.comments.map((c) => `<div class="cmt"><b>${esc(c.who)}</b>${esc(c.text)}</div>`).join('') || '<div class="cmt"><b>Nenhum comentário.</b></div>';
}

function linksHtml(t: Task, editable = true): string {
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

interface Access {
  editable: boolean;
  canDelete: boolean;
}

function formHtml(p: Project, t: Task | undefined, status: TaskStatus, branch: string, access: Access): string {
  const selectedBranch = t ? t.branch : branch;
  const sel = (on: boolean): string => (on ? 'selected' : '');
  const statusOpts = TASK_STATUSES.map((s) => `<option ${sel((t?.status ?? status) === s)}>${s}</option>`).join('');
  const prioOpts = PRIORITIES.map((x) => `<option ${sel(t?.priority === x)}>${x}</option>`).join('');
  const branchOpts = p.branches.map((b) => `<option value="${b.id}" ${sel(selectedBranch === b.id)}>${esc(b.name)}</option>`).join('');
  return `${t ? dependencyStatus(t, p) : ''}<form id="taskForm"><fieldset class="plain" ${access.editable ? '' : 'disabled'}><div class="form-grid"><label>Título<input class="field" name="title" required value="${esc(
    t?.title ?? '',
  )}"></label><label>Status<select class="field" name="status">${statusOpts}</select></label><label>Responsável<input class="field" name="assignee" list="usersList" value="${esc(
    t?.assignee ?? '',
  )}"></label><label>Prazo<input class="field" type="date" name="due" value="${esc(
    t?.due ?? '',
  )}"></label><label>Prioridade<select class="field" name="priority">${prioOpts}</select></label><label>Etapa<select class="field" name="branch" ${t ? "" : "required"}>${
    // Tarefa nova sempre nasce dentro de uma etapa; "Sem etapa" só aparece para tarefas antigas que já estão assim.
    t && !p.branches.some((b) => b.id === t.branch) ? '<option value="" selected>Sem etapa</option>' : t ? '' : '<option value="">Escolha a etapa</option>'
  }${branchOpts}</select></label></div><div class="form-full"><label>Descrição<textarea class="field" name="description">${esc(
    t?.description ?? '',
  )}</textarea></label></div>${dependencySection()}<div class="form-full"><label>Checklist <span id="subProg"></span></label><div class="pbar" style="margin:8px 0"><i id="subBar"></i></div><div id="subs">${(
    t?.subtasks ?? []
  )
    .map(checklistRow)
    .join('')}</div>${access.editable ? `<button class="ghost" type="button" id="newSub">${icon('plus')}Item</button>` : ''}</div></fieldset><p class="form-error" id="taskErr" role="alert"></p><div class="modal-actions">${
    t && access.canDelete ? `<button type="button" class="danger" id="deleteTask">${icon('trash')}Excluir</button>` : '<span></span>'
  }${access.editable ? '<button class="primary">Salvar</button>' : ''}</div></form>${t ? extrasHtml(t, access.editable) : ''}`;
}

function readChecklist(): Subtask[] {
  return $$<HTMLInputElement>('#subs [data-sub]').map((box) => ({
    id: box.dataset.sub ?? uid('s'),
    title: box.nextElementSibling?.textContent ?? '',
    done: box.checked,
  }));
}

function updateChecklistProgress(): void {
  const items = readChecklist();
  const done = items.filter((s) => s.done).length;
  modalField('#subProg').textContent = items.length ? `${done}/${items.length}` : '';
  modalField('#subBar').style.width = `${items.length ? (done / items.length) * 100 : 0}%`;
}

function bindChecklist(editable: boolean): void {
  const list = modalField<HTMLElement>('#subs');
  if (!editable) {
    updateChecklistProgress();
    return;
  }
  document.getElementById('newSub')?.addEventListener('click', async () => {
    const r = await askFields('Novo item', [{ label: 'Nome do item', required: true }]);
    if (!r?.[0]) return;
    list.insertAdjacentHTML('beforeend', checklistRow({ id: uid('s'), title: r[0], done: false }));
    updateChecklistProgress();
  });
  list.addEventListener('change', updateChecklistProgress);
  list.addEventListener('click', async (e) => {
    const target = e.target as Element;
    const row = target.closest('.next-task');
    if (!row) return;
    if (target.closest('.sub-x')) {
      row.remove();
      updateChecklistProgress();
    } else if (target.closest('.sub-t')) {
      const label = row.querySelector('.sub-t');
      const r = await askFields('Renomear item', [{ label: 'Nome', value: label?.textContent ?? '', required: true }]);
      if (r?.[0] && label) label.textContent = r[0];
    }
  });
  updateChecklistProgress();
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
    links.innerHTML = linksHtml(t);
  });
  links.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLElement>('[data-del-link]');
    if (!button?.dataset.delLink) return;
    removeLink(p, t, button.dataset.delLink);
    links.innerHTML = linksHtml(t);
  });
}

function readDraft(form: HTMLFormElement, deps: DependencyEditor): TaskDraft {
  const data = new FormData(form);
  const text = (name: string): string => String(data.get(name) ?? '').trim();
  const status = text('status') as TaskStatus;
  const priority = text('priority') as Priority;
  return {
    title: text('title'),
    status: TASK_STATUSES.includes(status) ? status : 'A fazer',
    priority: PRIORITIES.includes(priority) ? priority : 'Média',
    assignee: text('assignee'),
    due: text('due'),
    branch: text('branch'),
    description: text('description'),
    dependencies: deps.value(),
    subtasks: readChecklist(),
  };
}

export function openTaskModal(id?: string, status: TaskStatus = 'A fazer', branch = ''): void {
  const p = currentProject();
  const task = findTask(p, id);
  if (!task && !can('tasks', 'create', p.id)) {
    showToast(NO_ACCESS);
    return;
  }
  if (!task && !p.branches.length) {
    showToast('Crie uma etapa primeiro: as tarefas ficam dentro das etapas.');
    return;
  }
  const access = { editable: can('tasks', task ? 'edit' : 'create', p.id), canDelete: can('tasks', 'delete', p.id) };
  openModal(task ? (access.editable ? 'Editar tarefa' : 'Tarefa') : 'Nova tarefa', formHtml(p, task, status, branch, access));
  bindChecklist(access.editable);
  if (task && access.editable) bindExtras(p, task);
  const form = modalField<HTMLFormElement>('#taskForm');
  const deps = mountDependencyEditor(
    modalField('#depEditor'),
    () => ({ ref: { kind: 'task', projectId: p.id, id: task?.id ?? NEW_ID }, parent: String(new FormData(form).get('branch') ?? '') }),
    task?.dependencies ?? [],
    access.editable,
    'O que precisa acontecer antes desta tarefa começar. Enquanto houver condição pendente, ela fica bloqueada em “A fazer”.',
  );

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const before = blockedSnapshot();
    try {
      saveTask(p, task, readDraft(form, deps));
    } catch (error) {
      if (!(error instanceof DependencyError)) throw error;
      modalField('#taskErr').textContent = error.message;
      return;
    }
    closeModal();
    refreshProject();
    const released = releasedSince(before);
    showToast(`${task ? 'Tarefa salva' : 'Tarefa criada'}${released ? ` · ${plural(released, 'item liberado', 'itens liberados')}` : ''}`);
  });
  if (task && access.canDelete) {
    modalField('#deleteTask').addEventListener('click', () => {
      deleteTask(p, task);
      closeModal();
      refreshProject();
      showToast('Tarefa excluída');
    });
  }
}
