/** Janela da subtarefa. Não tem responsável próprio: mostra os responsáveis herdados da tarefa. */
import { completionText } from '../../services/completionService';
import { currentProject, refreshProject } from '../../app/navigation';
import { confirmDanger } from '../../components/dialog';
import { icon } from '../../components/icons';
import { commonFields, peopleLine, readCommon, statusSelect } from '../../components/itemParts';
import { modalField, openModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import { RuleError } from '../../services/errors';
import { canCreateSubtask, canDeleteSubtask, canEditSubtask } from '../../services/permissionService';
import { createSubtask, findSubtask, findTask, updateSubtask } from '../../services/taskService';
import { trashSubtask } from '../../services/trashService';
import { TASK_STATUSES, type SubtaskDraft, type TaskStatus } from '../../types/task';
import { esc } from '../../utils/dom';
import { openTaskModal } from './taskModal';

function readDraft(form: HTMLFormElement): SubtaskDraft {
  const data = new FormData(form);
  const status = String(data.get('status') ?? '') as TaskStatus;
  return { title: String(data.get('title') ?? '').trim(), status: TASK_STATUSES.includes(status) ? status : 'A fazer', ...readCommon(data) };
}

export function openSubtaskModal(taskId: string, subtaskId?: string): void {
  const p = currentProject();
  const t = findTask(p, taskId);
  if (!t) return;
  const s = findSubtask(t, subtaskId);
  const editable = s ? canEditSubtask(p, t) : canCreateSubtask(p, t);
  if (!s && !editable) return;
  const remove = s && canDeleteSubtask(p, t) ? `<button type="button" class="danger" id="deleteSub">${icon('trash')}Excluir</button>` : '<span></span>';
  openModal(
    s ? (editable ? 'Editar subtarefa' : 'Subtarefa') : 'Nova subtarefa',
    `<button class="crumb" type="button" id="backToTask">${icon('chevronLeft')}${esc(t.title)}</button>${s?.status === 'Concluído' && s.doneAt ? `<p class="done-by-line">${icon('check')}${esc(completionText(s))}</p>` : ''}<form id="subForm" novalidate><fieldset class="plain" ${
      editable ? '' : 'disabled'
    }><div class="form-grid"><div class="form-full"><label>Título<input class="field" name="title" required value="${esc(s?.title ?? '')}"></label></div>${statusSelect(
      TASK_STATUSES,
      s?.status ?? 'A fazer',
    )}${commonFields(s)}</div></fieldset><div class="form-full"><div class="lbl">Responsáveis (herdados da tarefa)</div><div>${peopleLine(
      t.assignees,
    )}</div></div><p class="form-error" id="subErr" role="alert"></p><div class="modal-actions">${remove}${editable ? `<button class="primary">${s ? 'Salvar' : 'Criar subtarefa'}</button>` : ''}</div></form>`,
  );
  modalField('#backToTask').addEventListener('click', () => openTaskModal(t.id));
  const form = modalField<HTMLFormElement>('#subForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      if (s) updateSubtask(p, t, s, readDraft(form));
      else createSubtask(p, t, readDraft(form));
    } catch (error) {
      if (!(error instanceof RuleError)) throw error;
      modalField('#subErr').textContent = error.message;
      return;
    }
    refreshProject();
    openTaskModal(t.id);
    showToast(s ? 'Subtarefa salva' : 'Subtarefa criada');
  });
  document.getElementById('deleteSub')?.addEventListener('click', async () => {
    if (!s) return;
    const ok = await confirmDanger(`Excluir a subtarefa “${s.title}”?`, 'A subtarefa vai para a lixeira. Administradores e coordenadores podem restaurar.', 'Enviar para a lixeira');
    if (!ok) return;
    trashSubtask(p, t, s.id);
    refreshProject();
    openTaskModal(t.id);
    showToast('Subtarefa enviada para a lixeira');
  });
  if (editable) modalField<HTMLInputElement>('[name="title"]').focus();
}
