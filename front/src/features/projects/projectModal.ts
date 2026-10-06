import { goTo, isProjectOpen, refreshProject } from '../../app/navigation';
import { avatar } from '../../components/avatar';
import { confirmDanger } from '../../components/dialog';
import { icon } from '../../components/icons';
import { commonFields, readCommon, statusSelect } from '../../components/itemParts';
import { closeModal, modalField, openModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import { db } from '../../services/db';
import { RuleError } from '../../services/errors';
import { canCreateProject, canDeleteProject, canEditProject, canManageUsers, can } from '../../services/permissionService';
import { findContratante, sortedContratantes } from '../../services/contratanteService';
import { createProject, toggleArchived, updateProject } from '../../services/projectService';
import { describeContents, trashProject } from '../../services/trashService';
import { ui } from '../../state/store';
import { PROJECT_STATUSES, type Project, type ProjectDraft, type ProjectStatus } from '../../types/project';
import type { User } from '../../types/user';
import { $$, esc } from '../../utils/dom';
import { promptNewUser } from '../settings/usersAdmin';

function pickButton(u: User, selected: boolean): string {
  return `<button type="button" class="pick-u ${selected ? 'on' : ''}" data-user="${u.id}" aria-pressed="${selected}">${avatar(u)}<span>${esc(u.name)}</span></button>`;
}

function coordinatorPicker(selected: string[]): string {
  const users = db.users.filter((u) => u.active || selected.includes(u.id));
  return `<div class="form-full coord-field"><div class="lbl">Coordenadores (opcional, podem ser definidos depois)</div><div class="pick" id="coordPick">${users
    .map((u) => pickButton(u, selected.includes(u.id)))
    .join('')}${canManageUsers('create') ? `<button type="button" class="pick-add" id="coordAdd">${icon('plus')}Novo usuário</button>` : ''}</div></div>`;
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

/** Só lista contratantes cadastradas pelo administrador; não aceita texto livre. */
function contratanteSelect(selected: string): string {
  const list = sortedContratantes();
  // Mantém a atual visível mesmo se ela tiver sido removida da lista.
  const missing = selected && !findContratante(selected) ? `<option value="${esc(selected)}" selected>(contratante removida)</option>` : '';
  const opts = list.map((x) => `<option value="${esc(x.id)}" ${x.id === selected ? 'selected' : ''}>${esc(x.cidade ? `${x.name} — ${x.cidade}` : x.name)}</option>`).join('');
  const hint = list.length
    ? ''
    : `<small class="field-hint">Nenhuma contratante cadastrada. ${can('contratantes', 'create') ? 'Cadastre em Configurações → Contratantes.' : 'Peça ao administrador para cadastrar.'}</small>`;
  return `<label>Contratante<select class="field" name="contratanteId"><option value="">Sem contratante</option>${missing}${opts}</select>${hint}</label>`;
}

function actionsHtml(p: Project | undefined): string {
  if (!p) return '<span></span>';
  const archive = canEditProject(p)
    ? p.archived
      ? `<button class="ghost" type="button" id="archiveProject">${icon('reset')}Reabrir projeto</button>`
      : `<button class="ghost" type="button" id="archiveProject">${icon('archive')}Encerrar (arquivar)</button>`
    : '';
  const remove = canDeleteProject(p) ? `<button class="danger" type="button" id="deleteProject">${icon('trash')}Excluir</button>` : '';
  return `<span class="bd-actions">${remove}${archive}</span>`;
}

function formHtml(p: Project | undefined): string {
  return `<form id="projectForm" class="pform" novalidate><div class="sec first"><h3>Identificação</h3><div class="form-full">${input(
    'name',
    'Nome do projeto',
    p?.name ?? '',
    'required',
  )}</div><div class="form-grid">${input('processo', 'Processo', p?.processo ?? '', 'placeholder="Ex: 12345/2026"')}${contratanteSelect(
    p?.contratanteId ?? '',
  )}</div></div><div class="sec"><h3>Andamento</h3><div class="form-grid">${statusSelect(PROJECT_STATUSES, p?.status ?? 'Em espera')}${commonFields(
    p,
  )}</div><small class="field-hint">Para ir para “Em andamento” o projeto precisa de pelo menos uma etapa.</small></div><div class="sec"><h3>Coordenação</h3>${coordinatorPicker(
    p?.coordinators ?? [],
  )}</div><div class="sec"><h3>Convênio</h3><div class="form-grid">${input('convOrgao', 'Origem do convênio', p?.convOrgao ?? '', 'placeholder="Ex: Caixa"')}${input(
    'convNumero',
    'Número do convênio',
    p?.convNumero ?? '',
    'placeholder="Ex: 1234/2026"',
  )}${input('convValor', 'Valor do convênio (R$)', p?.convValor ?? '', 'type="number" min="0" step="0.01" placeholder="0,00"')}${input(
    'convContra',
    'Contrapartida (R$)',
    p?.convContra ?? '',
    'type="number" min="0" step="0.01" placeholder="0,00"',
  )}</div><div class="form-full">${input('convPolitico', 'Origem do recurso (político / emenda)', p?.convPolitico ?? '', 'placeholder="Ex: Emenda do Dep. Fulano de Tal"')}</div></div><p class="form-error" id="projectErr" role="alert"></p><div class="modal-actions">${actionsHtml(
    p,
  )}<button class="primary">${p ? 'Salvar' : 'Criar projeto'}</button></div></form>`;
}

function readDraft(form: HTMLFormElement): ProjectDraft {
  const data = new FormData(form);
  const text = (name: string): string => String(data.get(name) ?? '').trim();
  const status = text('status') as ProjectStatus;
  return {
    name: text('name'),
    status: PROJECT_STATUSES.includes(status) ? status : 'Em espera',
    ...readCommon(data),
    processo: text('processo'),
    contratanteId: text('contratanteId'),
    convOrgao: text('convOrgao'),
    convNumero: text('convNumero'),
    convValor: text('convValor'),
    convContra: text('convContra'),
    convPolitico: text('convPolitico'),
    coordinators: $$('#coordPick .pick-u.on').map((b) => b.dataset.user ?? '').filter(Boolean),
  };
}

/** Pergunta e envia o projeto (com etapas, tarefas e subtarefas) para a lixeira. */
async function confirmTrash(project: Project): Promise<void> {
  const inside = describeContents(project.branches.length, project.tasks);
  const ok = await confirmDanger(
    `Excluir o projeto “${project.name}”?`,
    `O projeto${inside ? ` e o que está dentro dele (${inside})` : ''} vai para a lixeira. Administradores e coordenadores podem restaurar.`,
    'Enviar para a lixeira',
  );
  if (!ok) return;
  trashProject(project);
  closeModal();
  goTo('home');
  showToast('Projeto enviado para a lixeira');
}

export function openProjectModal(project?: Project): void {
  if (project ? !canEditProject(project) : !canCreateProject()) return;
  openModal(project ? 'Editar projeto' : 'Novo projeto', formHtml(project));
  bindPicker();
  const form = modalField<HTMLFormElement>('#projectForm');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const draft = readDraft(form);
    try {
      if (project) updateProject(project, draft);
      else createProject(draft);
    } catch (error) {
      if (!(error instanceof RuleError)) throw error;
      modalField('#projectErr').textContent = error.message;
      return;
    }
    closeModal();
    if (project) {
      if (isProjectOpen() && ui.projectId === project.id) refreshProject();
      else goTo(ui.page);
      showToast('Projeto salvo');
    } else {
      goTo('home');
      showToast('Projeto criado');
    }
  });
  modalField<HTMLInputElement>('[name="name"]').focus();
  if (!project) return;
  document.getElementById('archiveProject')?.addEventListener('click', () => {
    toggleArchived(project);
    closeModal();
    if (isProjectOpen()) refreshProject();
    else goTo(ui.page);
    showToast(project.archived ? 'Projeto encerrado (arquivado)' : 'Projeto reaberto');
  });
  document.getElementById('deleteProject')?.addEventListener('click', () => void confirmTrash(project));
}
