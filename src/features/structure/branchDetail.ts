/** Janela larga com tudo sobre uma etapa: tarefas, checklist, projetista, filhas e histórico. */
import { applyPerms } from '../../app/access';
import { currentProject, refreshProject } from '../../app/navigation';
import { can } from '../../services/permissionService';
import { avatar } from '../../components/avatar';
import { options } from '../../components/filterBar';
import { icon } from '../../components/icons';
import { closeModal, modalField, openModal } from '../../components/modal';
import { progressBar, progressRow } from '../../components/progress';
import { showToast } from '../../components/toast';
import { childrenOf, findBranch, pathLabel, setDesigner, tasksIn } from '../../services/branchService';
import { db } from '../../services/db';
import { branchRef, taskRef } from '../../services/dependencyService';
import { findTask, isLate, setSubtaskDone } from '../../services/taskService';
import { blockedBadge, blockersPanel, dependentsLine } from '../dependencies/dependencyView';
import { findUser, personByName } from '../../services/userService';
import { ui } from '../../state/store';
import type { Project } from '../../types/project';
import type { Task } from '../../types/task';
import { dayLabel, formatShortDate, formatTime } from '../../utils/date';
import { $, $$, esc, plural } from '../../utils/dom';
import { pct, priorityClass, taskStatusClass } from '../../utils/format';
import { openTaskModal } from '../tasks/taskModal';
import { openEditBranchModal, openNewBranchModal } from './branchModals';

function taskBlock(t: Task, p: Project): string {
  const items = t.subtasks;
  const done = items.filter((s) => s.done).length;
  const who = t.assignee ? `<span class="bd-who">${avatar(personByName(t.assignee), true)} ${esc(t.assignee)}</span>` : '';
  const checklist = items.length
    ? `${progressBar(pct(done, items.length), true)}<div class="bd-check">${items
        .map(
          (s) =>
            `<label class="bd-ci ${s.done ? 'done' : ''}"><input type="checkbox" data-check="${t.id}|${s.id}" ${s.done ? 'checked' : ''} ${can('tasks', 'edit', p.id) ? '' : 'disabled'}><span>${esc(s.title)}</span></label>`,
        )
        .join('')}</div>`
    : '';
  return `<div class="bd-task"><div class="bd-task-top"><button class="bd-title" data-open-task="${t.id}">${esc(t.title)}</button><span class="status ${taskStatusClass(
    t.status,
  )}">${esc(t.status)}</span></div><div class="bd-task-meta"><span><i class="priority ${priorityClass(t.priority)}"></i> ${esc(t.priority)}</span>${who}${
    t.due ? `<span class="${isLate(t) ? 'late-txt' : ''}">Prazo ${formatShortDate(t.due)}</span>` : ''
  }${t.status === 'Concluído' ? '' : blockedBadge(taskRef(p, t))}${items.length ? `<span>Checklist ${done}/${items.length}</span>` : ''}</div>${checklist}</div>`;
}

function render(p: Project, id: string): void {
  const b = findBranch(p, id);
  if (!b) return;
  const parent = findBranch(p, b.parent);
  const kids = childrenOf(p, id);
  const own = tasksIn(p, id);
  const all = tasksIn(p, id, true);
  const done = all.filter((t) => t.status === 'Concluído').length;
  const late = all.filter(isLate).length;
  const items = own.flatMap((t) => t.subtasks);
  const itemsDone = items.filter((s) => s.done).length;
  const designer = findUser(b.designer);
  const history = p.activity.filter((a) => a.branch === id || (a.task && own.some((t) => t.id === a.task))).slice(0, 40);
  const path = pathLabel(p, b);

  const stats = `<div class="bd-stats"><div><b>${all.length}</b><span>tarefas</span></div><div><b>${done}</b><span>concluídas</span></div><div><b class="${
    late ? 'late-txt' : ''
  }">${late}</b><span>atrasadas</span></div><div><b>${itemsDone}/${items.length}</b><span>itens de checklist</span></div></div>`;
  const tasksSection = `<section><div class="sec-head" style="margin-top:0"><h3>Tarefas e checklist</h3><button class="ghost" id="bdNewTask" data-perm="tasks.create">${icon('plus')}Nova tarefa</button></div>${
    own.length ? own.map((t) => taskBlock(t, p)).join('') : '<p class="sub">Nenhuma tarefa nesta etapa.</p>'
  }${all.length > own.length ? `<p class="sub small">Mais ${plural(all.length - own.length, 'tarefa', 'tarefas')} nas subetapas.</p>` : ''}</section>`;
  const designerBox = `<div class="bd-box"><div class="lbl">Projetista</div><div class="bd-owner">${
    designer
      ? `${avatar(designer)}<div><b>${esc(designer.name)}</b>${designer.role || designer.email ? `<small>${esc([designer.role, designer.email].filter(Boolean).join(' · '))}</small>` : ''}</div>`
      : '<span class="sub flat">Sem projetista</span>'
  }</div><select class="field" id="bdDesigner" aria-label="Trocar projetista" ${can('structure', 'edit', p.id) ? '' : 'disabled'}>${options(
    db.users.map((u) => [u.id, u.name] as const),
    b.designer ?? '',
    'Sem projetista',
  )}</select></div>`;
  const kidsBox = `<div class="bd-box"><div class="lbl">Subetapas</div><div class="bd-kids">${
    kids.map((k) => `<button class="chip" data-detail="${k.id}">${icon('branch')} ${esc(k.name)}</button>`).join('') || '<span class="sub flat">Nenhuma</span>'
  }</div><button class="ghost" id="bdNewKid" data-perm="structure.create">${icon('plus')}Subetapa</button>${
    parent ? `<div class="lbl" style="margin-top:14px">Dentro de</div><button class="chip" data-detail="${parent.id}">${icon('branch')} ${esc(parent.name)}</button>` : ''
  }</div>`;
  const historyBox = `<div class="bd-box"><div class="lbl">Histórico</div>${
    history.length
      ? `<div class="act">${history.map((a) => `<div class="act-i">${esc(a.text)}<small class="act-t">${dayLabel(a.at)} · ${formatTime(a.at)}</small></div>`).join('')}</div>`
      : '<span class="sub flat">Sem registros ainda.</span>'
  }</div>`;

  openModal(
    b.name,
    `<div class="bd">${blockersPanel(branchRef(p, b), 'Etapa bloqueada — as tarefas dentro dela não podem ser iniciadas')}${dependentsLine(
      branchRef(p, b),
    )}<div class="bd-head"><div class="bd-path">${esc(p.name)}${path ? ` / ${esc(path)}` : ''} · <span class="status ${taskStatusClass(b.status)}">${esc(
      b.status,
    )}</span></div>${stats}${progressRow(
      pct(done, all.length),
    )}</div><div class="bd-grid">${tasksSection}<aside>${designerBox}${kidsBox}${historyBox}</aside></div><div class="modal-actions"><button class="ghost" id="bdCards">${icon(
      'cards',
    )}Abrir em Cartões</button><button class="primary" id="bdEdit" data-perm="structure.edit|structure.delete">${icon('edit')}Editar etapa</button></div></div>`,
    { wide: true },
  );
  applyPerms($('#modal'), p.id);
  bind(p, id);
}

function bind(p: Project, id: string): void {
  const modal = $('#modal');
  $$('[data-open-task]', modal).forEach((el) => el.addEventListener('click', () => openTaskModal(el.dataset.openTask)));
  $$('[data-detail]', modal).forEach((el) =>
    el.addEventListener('click', () => {
      openBranchDetail(el.dataset.detail ?? '');
      modal.scrollTop = 0;
    }),
  );
  $$<HTMLInputElement>('[data-check]', modal).forEach((box) =>
    box.addEventListener('change', () => {
      const [taskId, subId] = (box.dataset.check ?? '').split('|');
      const task = findTask(p, taskId);
      if (!task || !subId) return;
      setSubtaskDone(p, task, subId, box.checked);
      const scroll = modal.scrollTop;
      render(p, id);
      modal.scrollTop = scroll;
    }),
  );
  modalField<HTMLSelectElement>('#bdDesigner').addEventListener('change', (e) => {
    const b = findBranch(p, id);
    if (!b) return;
    setDesigner(p, b, (e.target as HTMLSelectElement).value || null);
    refreshProject();
    render(p, id);
    showToast('Projetista atualizado');
  });
  modalField('#bdNewTask').addEventListener('click', () => openTaskModal(undefined, 'A fazer', id));
  modalField('#bdNewKid').addEventListener('click', () => openNewBranchModal(id));
  modalField('#bdEdit').addEventListener('click', () => openEditBranchModal(id));
  modalField('#bdCards').addEventListener('click', () => {
    closeModal();
    ui.tab = 'structure';
    ui.structureMode = 'cards';
    ui.cardLevel = id;
    refreshProject();
  });
}

export function openBranchDetail(id: string): void {
  render(currentProject(), id);
}
