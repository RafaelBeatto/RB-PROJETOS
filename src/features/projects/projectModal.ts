import { goTo, isProjectOpen, refreshProject } from '../../app/navigation';
import { avatar } from '../../components/avatar';
import { icon } from '../../components/icons';
import { closeModal, modalField, openModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import { db } from '../../services/db';
import { can } from '../../services/permissionService';
import { createProject, toggleArchived, updateProject } from '../../services/projectService';
import { ui } from '../../state/store';
import { PROJECT_STATUSES, type Project, type ProjectDraft, type ProjectStatus } from '../../types/project';
import type { User } from '../../types/user';
import { $$, esc } from '../../utils/dom';
import { promptNewUser } from '../settings/usersAdmin';

function pickButton(u: User, selected: boolean): string {
  return `<button type="button" class="pick-u ${selected ? 'on' : ''}" data-user="${u.id}" aria-pressed="${selected}">${avatar(u)}<span>${esc(u.name)}</span></button>`;
}

function coordinatorPicker(selected: string[]): string {
  return `<div class="form-full"><div class="lbl">Coordenadores</div><div class="pick" id="coordPick">${db.users
    .map((u) => pickButton(u, selected.includes(u.id)))
    .join('')}${
    can('users', 'create') ? `<button type="button" class="pick-add" id="coordAdd">${icon('plus')}Novo usuário</button>` : ''
  }</div></div>`;
}

function bindPicker(): void {
  const picker = modalField<HTMLElement>('#coordPick');
  picker.addEventListener('click', async (e) => {
    const target = e.target as Element;
    const button = target.closest<HTMLElement>('.pick-u');
    if (button) {
      const on = button.classList.toggle('on');
      button.setAttribute('aria-pressed', String(on));
      return;
    }
    if (!target.closest('#coordAdd')) return;
    const user = await promptNewUser();
    if (!user) return;
    const existing = picker.querySelector<HTMLElement>(`[data-user="${user.id}"]`);
    if (existing) {
      existing.classList.add('on');
      existing.setAttribute('aria-pressed', 'true');
    } else {
      modalField('#coordAdd').insertAdjacentHTML('beforebegin', pickButton(user, true));
    }
  });
}

const input = (name: string, label: string, value: string, extra = ''): string =>
  `<label>${label}<input class="field" name="${name}" value="${esc(value)}" ${extra}></label>`;

function formHtml(p: Project | undefined): string {
  const statusOptions = PROJECT_STATUSES.map((s) => `<option ${p?.status === s ? 'selected' : ''}>${s}</option>`).join('');
  const archive = !p || !can('projects', 'delete', p.id)
    ? '<span></span>'
    : p.archived
      ? '<button class="ghost" type="button" id="archiveProject">Desarquivar</button>'
      : `<button class="danger" type="button" id="archiveProject">${icon('archive')}Arquivar</button>`;
  return `<form id="projectForm"><div class="form-grid">${input('name', 'Nome', p?.name ?? '', 'required')}${input('owner', 'Responsável', p?.owner ?? '', 'list="usersList"')}<label>Status<select class="field" name="status">${statusOptions}</select></label>${input(
    'due',
    'Prazo',
    p?.due ?? '',
    'type="date"',
  )}</div>${coordinatorPicker(p?.coordinators ?? [])}<div class="form-full">${input('processo', 'Processo', p?.processo ?? '', 'placeholder="Ex: 12345/2026"')}</div><div class="form-full"><label>Descrição<textarea class="field" name="description">${esc(
    p?.description ?? '',
  )}</textarea></label></div><div class="sec"><h3>Convênio</h3><div class="form-grid">${input('convOrgao', 'Origem do convênio', p?.convOrgao ?? '', 'placeholder="Ex: Caixa"')}${input(
    'convNumero',
    'Número do convênio',
    p?.convNumero ?? '',
    'placeholder="Ex: 1234/2026"',
  )}${input('convValor', 'Valor do convênio (R$)', p?.convValor ?? '', 'type="number" min="0" step="0.01" placeholder="0,00"')}${input(
    'convContra',
    'Contrapartida (R$)',
    p?.convContra ?? '',
    'type="number" min="0" step="0.01" placeholder="0,00"',
  )}</div><div class="form-full">${input('convPolitico', 'Origem do recurso (político / emenda)', p?.convPolitico ?? '', 'placeholder="Ex: Emenda do Dep. Fulano de Tal"')}</div></div><div class="modal-actions">${archive}<button class="primary">Salvar</button></div></form>`;
}

function readDraft(form: HTMLFormElement): ProjectDraft {
  const data = new FormData(form);
  const text = (name: string): string => String(data.get(name) ?? '').trim();
  const status = text('status') as ProjectStatus;
  return {
    name: text('name'),
    owner: text('owner'),
    status: PROJECT_STATUSES.includes(status) ? status : 'Planejamento',
    due: text('due'),
    description: text('description'),
    processo: text('processo'),
    convOrgao: text('convOrgao'),
    convNumero: text('convNumero'),
    convValor: text('convValor'),
    convContra: text('convContra'),
    convPolitico: text('convPolitico'),
    coordinators: $$('#coordPick .pick-u.on').map((b) => b.dataset.user ?? '').filter(Boolean),
  };
}

export function openProjectModal(project?: Project): void {
  openModal(project ? 'Editar projeto' : 'Novo projeto', formHtml(project));
  bindPicker();
  modalField<HTMLFormElement>('#projectForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const draft = readDraft(e.currentTarget as HTMLFormElement);
    closeModal();
    if (project) {
      updateProject(project, draft);
      if (isProjectOpen() && ui.projectId === project.id) refreshProject();
      else goTo(ui.page);
      showToast('Projeto salvo');
    } else {
      createProject(draft);
      goTo('home');
      showToast('Projeto criado');
    }
  });
  if (!project || !can('projects', 'delete', project.id)) return;
  modalField('#archiveProject').addEventListener('click', () => {
    toggleArchived(project);
    closeModal();
    goTo(project.archived ? 'archive' : 'home');
    showToast(project.archived ? 'Projeto arquivado' : 'Projeto desarquivado');
  });
}
