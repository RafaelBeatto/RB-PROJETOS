import { currentProject, refreshProject } from '../../app/navigation';
import { options } from '../../components/filterBar';
import { confirmDanger } from '../../components/dialog';
import { closeModal, modalField, openModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import { createBranch, deleteBranch, findBranch, possibleParents, updateBranch } from '../../services/branchService';
import { db } from '../../services/db';
import { NO_ACCESS } from '../../app/access';
import { can } from '../../services/permissionService';
import { esc } from '../../utils/dom';

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
    )}<div class="modal-actions"><span></span><button class="primary">Criar ramificação</button></div></form>`,
  );
  modalField<HTMLFormElement>('#branchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget as HTMLFormElement);
    createBranch(currentProject(), String(data.get('name') ?? '').trim(), parentId, String(data.get('designer') ?? '') || null);
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
    )}</fieldset><div class="modal-actions">${removable ? '<button class="danger" type="button" id="deleteBranch">Excluir</button>' : '<span></span>'}${
      editable ? '<button class="primary">Salvar</button>' : ''
    }</div></form>`,
  );
  modalField<HTMLFormElement>('#branchEditForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget as HTMLFormElement);
    updateBranch(p, b, {
      name: String(data.get('name') ?? '').trim(),
      parent: String(data.get('parent') ?? '') || null,
      designer: String(data.get('designer') ?? '') || null,
    });
    closeModal();
    refreshProject();
    showToast('Ramificação salva');
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
