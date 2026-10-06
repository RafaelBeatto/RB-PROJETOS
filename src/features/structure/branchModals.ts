/** Formulário da etapa (criar e editar) e exclusão para a lixeira. */
import { NO_ACCESS } from '../../app/access';
import { currentProject, openBranch, refreshProject } from '../../app/navigation';
import { confirmDanger } from '../../components/dialog';
import { icon } from '../../components/icons';
import { commonFields, readCommon, statusSelect } from '../../components/itemParts';
import { closeModal, modalField, openModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import { bindUserPicker, readUserPicker, userPickerHtml } from '../../components/userPicker';
import { createBranch, findBranch, tasksIn, updateBranch } from '../../services/branchService';
import { RuleError } from '../../services/errors';
import { canCreateBranch, canDeleteBranch, canEditBranch } from '../../services/permissionService';
import { describeContents, trashBranch } from '../../services/trashService';
import { ui } from '../../state/store';
import { BRANCH_STATUSES, type Branch, type BranchDraft, type BranchStatus } from '../../types/branch';
import { MAX_RESPONSIBLES } from '../../types/task';
import { esc } from '../../utils/dom';

function formHtml(b: Partial<Branch>, editing: boolean): string {
  const remove = editing && canDeleteBranch(currentProject()) ? `<button class="danger" type="button" id="deleteBranch">${icon('trash')}Excluir etapa</button>` : '<span></span>';
  return `<form id="branchForm" novalidate><div class="form-grid"><div class="form-full"><label>Nome<input class="field" name="name" required value="${esc(b.name ?? '')}"></label></div>${statusSelect(BRANCH_STATUSES, b.status ?? 'Em espera')}${commonFields(b)}</div><div class="form-full"><div class="lbl">Responsáveis (até ${MAX_RESPONSIBLES}, opcional)</div>${userPickerHtml(
    'branchPick',
    b.assignees ?? [],
    MAX_RESPONSIBLES,
  )}</div><p class="form-error" id="branchErr" role="alert"></p><div class="modal-actions">${remove}<button class="primary">${editing ? 'Salvar' : 'Criar etapa'}</button></div></form>`;
}

function readDraft(form: HTMLFormElement): BranchDraft {
  const data = new FormData(form);
  const status = String(data.get('status') ?? '') as BranchStatus;
  return {
    name: String(data.get('name') ?? '').trim(),
    status: BRANCH_STATUSES.includes(status) ? status : 'Em espera',
    assignees: readUserPicker(modalField('#branchPick')),
    ...readCommon(data),
  };
}

/** Grava; erros de regra aparecem no formulário em vez de fechá-lo. */
function bindForm(save: (draft: BranchDraft) => void, done: string): void {
  const form = modalField<HTMLFormElement>('#branchForm');
  bindUserPicker(modalField('#branchPick'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      save(readDraft(form));
    } catch (error) {
      if (!(error instanceof RuleError)) throw error;
      modalField('#branchErr').textContent = error.message;
      return;
    }
    closeModal();
    refreshProject();
    showToast(done);
  });
  modalField<HTMLInputElement>('[name="name"]').focus();
}

export function openNewBranchModal(status: BranchStatus = 'Em espera'): void {
  const p = currentProject();
  if (!canCreateBranch(p)) {
    showToast(NO_ACCESS);
    return;
  }
  openModal('Nova etapa', formHtml({ status }, false));
  bindForm((draft) => createBranch(p, draft), 'Etapa criada');
}

export function openEditBranchModal(id: string): void {
  const p = currentProject();
  const b = findBranch(p, id);
  if (!b || !canEditBranch(p)) return;
  openModal('Editar etapa', formHtml(b, true));
  bindForm((draft) => updateBranch(p, b, draft), 'Etapa salva');
  document.getElementById('deleteBranch')?.addEventListener('click', () => void confirmDeleteEtapa(b.id));
}

/** Pede confirmação dizendo o que vai junto e envia a etapa para a lixeira. */
export async function confirmDeleteEtapa(id: string): Promise<void> {
  const p = currentProject();
  const b = findBranch(p, id);
  if (!b) return;
  if (!canDeleteBranch(p)) {
    showToast(NO_ACCESS);
    return;
  }
  const inside = describeContents(0, tasksIn(p, b.id));
  const ok = await confirmDanger(
    `Excluir a etapa “${b.name}”?`,
    `A etapa${inside ? ` e o que está dentro dela (${inside})` : ''} vai para a lixeira. Administradores e coordenadores podem restaurar.`,
    'Enviar para a lixeira',
  );
  if (!ok) return;
  trashBranch(p, b.id);
  closeModal();
  if (ui.branchId === b.id) openBranch(null);
  else refreshProject();
  showToast('Etapa enviada para a lixeira');
}
