/** Formulário da etapa (criar e editar) e exclusão para a lixeira. */
import { NO_ACCESS } from '../../app/access';
import { currentProject, openBranch, refreshProject } from '../../app/navigation';
import { confirmDanger } from '../../components/dialog';
import { icon } from '../../components/icons';
import { commonFields, peopleLine, readCommon, statusSelect } from '../../components/itemParts';
import { closeModal, modalField, openModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import { bindUserPicker, readUserPicker, userPickerHtml } from '../../components/userPicker';
import { createBranch, findBranch, tasksIn, updateBranch, validateBranchDraft } from '../../services/branchService';
import { findDepItem } from '../../services/dependencyService';
import { RuleError } from '../../services/errors';
import { canCreateBranch, canDeleteBranch, canEditBranch, canSetBranchResponsibles } from '../../services/permissionService';
import { currentUser } from '../../services/authService';
import { describeContents, trashBranch } from '../../services/trashService';
import { ui } from '../../state/store';
import { BRANCH_STATUSES, type Branch, type BranchDraft, type BranchStatus } from '../../types/branch';
import { MAX_RESPONSIBLES } from '../../types/task';
import { esc } from '../../utils/dom';
import { bindDepPicker, confirmPendingDependencies, depPickerHtml } from '../dependencies/depPicker';

function formHtml(b: Partial<Branch>, editing: boolean): string {
  const remove = editing && canDeleteBranch(currentProject(), b as Branch) ? `<button class="danger" type="button" id="deleteBranch">${icon('trash')}Excluir etapa</button>` : '<span></span>';
  const p = currentProject();
  const manager = canSetBranchResponsibles(p);
  const me = currentUser()?.id ?? '';
  // Coordenador e Administrador escolhem qualquer pessoa; o Responsável só indica a si mesmo ao criar e não troca depois.
  const people =
    manager || !editing
      ? `<div class="lbl">Responsáveis (até ${MAX_RESPONSIBLES}, opcional)</div>${userPickerHtml('branchPick', b.assignees ?? [], MAX_RESPONSIBLES, manager ? undefined : [me])}${
          manager ? '' : '<p class="sub flat small">Você pode se indicar como responsável. Outras pessoas são definidas por coordenadores e administradores.</p>'
        }`
      : `<div class="lbl">Responsáveis</div><div>${peopleLine(b.assignees ?? [])}</div><p class="sub flat small">Só coordenadores e administradores trocam os responsáveis da etapa.</p>`;
  return `<form id="branchForm" novalidate><div class="form-grid"><div class="form-full"><label>Nome<input class="field" name="name" required value="${esc(b.name ?? '')}"></label></div>${statusSelect(BRANCH_STATUSES, b.status ?? 'Em espera')}${commonFields(b)}</div><div class="form-full">${people}</div>${depPickerHtml(currentProject(), { kind: 'branch', id: b.id ?? '' }, b.dependencies ?? [], true)}<p class="form-error" id="branchErr" role="alert"></p><div class="modal-actions">${remove}<button class="primary">${editing ? 'Salvar' : 'Criar etapa'}</button></div></form>`;
}

function readDraft(form: HTMLFormElement, current: string[] = [], previousDeps: string[] = []): BranchDraft {
  const picker = form.querySelector<HTMLElement>('#branchPick');
  const data = new FormData(form);
  const status = String(data.get('status') ?? '') as BranchStatus;
  return {
    name: String(data.get('name') ?? '').trim(),
    status: BRANCH_STATUSES.includes(status) ? status : 'Em espera',
    // Sem o seletor (quem não pode trocar responsáveis), mantém os atuais.
    assignees: picker ? readUserPicker(picker) : current,
    // Dependências de itens que estão na lixeira não aparecem no formulário, mas continuam guardadas.
    dependencies: [...data.getAll('dep').map(String), ...previousDeps.filter((id) => !findDepItem(currentProject(), id))],
    ...readCommon(data),
  };
}

/** Grava; erros de regra aparecem no formulário em vez de fechá-lo. */
function bindForm(save: (draft: BranchDraft) => void, done: string, editing?: Branch): void {
  const previous = editing?.status;
  const form = modalField<HTMLFormElement>('#branchForm');
  const picker = form.querySelector<HTMLElement>('#branchPick');
  if (picker) bindUserPicker(picker);
  bindDepPicker(form, currentProject(), () => ({ kind: 'branch', id: '' }), true);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const draft = readDraft(form, editing?.assignees, editing?.dependencies);
    // Confere tudo antes de perguntar sobre dependências (só as que serão gravadas).
    let checked: BranchDraft;
    try {
      checked = validateBranchDraft(currentProject(), draft, editing);
    } catch (error) {
      if (!(error instanceof RuleError)) throw error;
      modalField('#branchErr').textContent = error.message;
      return;
    }
    if (!(await confirmPendingDependencies(currentProject(), checked.dependencies, previous ?? 'Em espera', checked.status))) return;
    try {
      save(draft);
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
  bindForm((draft) => updateBranch(p, b, draft), 'Etapa salva', b);
  document.getElementById('deleteBranch')?.addEventListener('click', () => void confirmDeleteEtapa(b.id));
}

/** Pede confirmação dizendo o que vai junto e envia a etapa para a lixeira. */
export async function confirmDeleteEtapa(id: string): Promise<void> {
  const p = currentProject();
  const b = findBranch(p, id);
  if (!b) return;
  if (!canDeleteBranch(p, b)) {
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
