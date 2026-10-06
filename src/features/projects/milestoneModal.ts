import { currentProject, refreshProject } from '../../app/navigation';
import { closeModal, modalField, openModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import { deleteMilestone, saveMilestone } from '../../services/projectService';
import { MILESTONE_STATUSES, type MilestoneStatus } from '../../types/project';
import { onClick } from '../../utils/actions';
import { canEditProject } from '../../services/permissionService';
import { esc } from '../../utils/dom';

export function openMilestoneModal(id?: string): void {
  const p = currentProject();
  if (!canEditProject(p)) return;
  const m = id ? p.milestones.find((x) => x.id === id) : undefined;
  const statusOptions = MILESTONE_STATUSES.map((s) => `<option ${m?.status === s ? 'selected' : ''}>${s}</option>`).join('');
  openModal(
    m ? 'Editar marco' : 'Novo marco',
    `<form id="msForm"><div class="form-grid"><label>Nome<input class="field" name="name" required value="${esc(m?.name ?? '')}"></label><label>Data<input class="field" type="date" name="due" value="${esc(
      m?.due ?? '',
    )}"></label><label>Status<select class="field" name="status">${statusOptions}</select></label></div><div class="modal-actions">${
      m ? '<button type="button" class="danger" id="delMs">Excluir</button>' : '<span></span>'
    }<button class="primary">Salvar</button></div></form>`,
  );
  modalField<HTMLFormElement>('#msForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget as HTMLFormElement);
    const status = String(data.get('status')) as MilestoneStatus;
    saveMilestone(p, m, {
      name: String(data.get('name') ?? '').trim(),
      due: String(data.get('due') ?? ''),
      status: MILESTONE_STATUSES.includes(status) ? status : 'Pendente',
    });
    closeModal();
    refreshProject();
    showToast('Marco salvo');
  });
  if (m) {
    modalField('#delMs').addEventListener('click', () => {
      deleteMilestone(p, m.id);
      closeModal();
      refreshProject();
      showToast('Marco excluído');
    });
  }
}

export function initMilestones(): void {
  onClick('milestone-new', () => openMilestoneModal());
  onClick('milestone-edit', (el) => openMilestoneModal(el.dataset.id));
}
