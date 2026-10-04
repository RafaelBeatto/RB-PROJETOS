import { currentProject, refreshProject } from '../../app/navigation';
import { options } from '../../components/filterBar';
import { confirmDanger } from '../../components/dialog';
import { closeModal, modalField, openModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import { createBranch, deleteBranch, findBranch, possibleParents, updateBranch } from '../../services/branchService';
import { db } from '../../services/db';
import { DependencyError, NEW_ID, blockedSnapshot, releasedSince } from '../../services/dependencyService';
import { dependencySection, mountDependencyEditor } from '../dependencies/dependencyEditor';
import { NO_ACCESS } from '../../app/access';
import { can } from '../../services/permissionService';
import { esc, plural } from '../../utils/dom';

const BRANCH_INTRO = 'O que precisa acontecer antes desta ramificação avançar. Enquanto houver condição pendente, todas as tarefas dentro dela (e das sub-ramificações) ficam bloqueadas.';

/** Executa a gravação; erros de dependência aparecem no formulário em vez de fechá-lo. */
function trySave(errorBox: string, save: () => void): boolean {
  try {
    save();
    return true;
  } catch (error) {
    if (!(error instanceof DependencyError)) throw error;
    modalField(errorBox).textContent = error.message;
    return false;
  }
}

function designerField(selected: string | null): string {
  return `<div class="form-full"><label>Projetista<select class="field" name="designer">${options(
    db.users.map((u) => [u.id, u.name] as const),
    selected ?? '',
    'Sem projetista',
  )}</select></label></div>`;
}

export function openNewBranchModal(parentId: string | null): void {
  if (!can('structure', 'create', currentProject().id)) {
    showToast(NO_ACCESS);
    return;
  }
  openModal(
    'Nova ramificação',
    `<form id="branchForm"><div class="form-full"><label>Nome<input class="field" name="name" required autofocus></label></div>${designerField(
      null,
    )}${dependencySection()}<p class="form-error" id="branchErr" role="alert"></p><div class="modal-actions"><span></span><button class="primary">Criar ramificação</button></div></form>`,
  );
  const p = currentProject();
  const deps = mountDependencyEditor(modalField('#depEditor'), () => ({ ref: { kind: 'branch', projectId: p.id, id: NEW_ID }, parent: parentId }), [], true, BRANCH_INTRO);
  modalField<HTMLFormElement>('#branchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget as HTMLFormElement);
    const ok = trySave('#branchErr', () =>
      createBranch(p, String(data.get('name') ?? '').trim(), parentId, String(data.get('designer') ?? '') || null, deps.value()),
    );
    if (!ok) return;
    closeModal();
    refreshProject();
    showToast('Ramificação criada');
  });
  modalField<HTMLInputElement>('[name="name"]').focus();
}

export function openEditBranchModal(id: string): void {
  const p = currentProject();
  const b = findBranch(p, id);
  if (!b) return;
  const parents = possibleParents(p, b).map((x) => [x.id, x.name] as const);
  const editable = can('structure', 'edit', p.id);
  const removable = can('structure', 'delete', p.id);
  if (!editable && !removable) return;
  openModal(
    editable ? 'Editar ramificação' : 'Ramificação',
    `<form id="branchEditForm"><fieldset class="plain" ${editable ? '' : 'disabled'}><div class="form-full"><label>Nome<input class="field" name="name" required value="${esc(
      b.name,
    )}"></label></div><div class="form-full"><label>Ramificação pai<select class="field" name="parent">${options(parents, b.parent ?? '', 'Projeto (raiz)')}</select></label></div>${designerField(
      b.designer,
    )}${dependencySection()}</fieldset><p class="form-error" id="branchErr" role="alert"></p><div class="modal-actions">${removable ? '<button class="danger" type="button" id="deleteBranch">Excluir</button>' : '<span></span>'}${
      editable ? '<button class="primary">Salvar</button>' : ''
    }</div></form>`,
  );
  const form = modalField<HTMLFormElement>('#branchEditForm');
  const deps = mountDependencyEditor(
    modalField('#depEditor'),
    () => ({ ref: { kind: 'branch', projectId: p.id, id: b.id }, parent: String(new FormData(form).get('parent') ?? '') || null }),
    b.dependencies,
    editable,
    BRANCH_INTRO,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const before = blockedSnapshot();
    const ok = trySave('#branchErr', () =>
      updateBranch(p, b, {
        name: String(data.get('name') ?? '').trim(),
        parent: String(data.get('parent') ?? '') || null,
        designer: String(data.get('designer') ?? '') || null,
        dependencies: deps.value(),
      }),
    );
    if (!ok) return;
    closeModal();
    refreshProject();
    const released = releasedSince(before);
    showToast(`Ramificação salva${released ? ` · ${plural(released, 'item liberado', 'itens liberados')}` : ''}`);
  });
  if (!removable) return;
  modalField('#deleteBranch').addEventListener('click', async () => {
    const ok = await confirmDanger('Excluir ramificação?', 'Subramificações sobem um nível e as tarefas ficam sem ramificação.');
    if (!ok) return;
    deleteBranch(p, b);
    closeModal();
    refreshProject();
    showToast('Ramificação excluída');
  });
}
