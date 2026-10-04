import { goTo, isProjectOpen, refreshProject } from '../../app/navigation';
import { avatar } from '../../components/avatar';
import { icon } from '../../components/icons';
import { closeModal, modalField, openModal } from '../../components/modal';
import { showToast } from '../../components/toast';
import { db } from '../../services/db';
import { DependencyError, NEW_ID, blockedSnapshot, releasedSince } from '../../services/dependencyService';
import { can } from '../../services/permissionService';
import { findContratante, sortedContratantes } from '../../services/contratanteService';
import { createProject, toggleArchived, updateProject } from '../../services/projectService';
import { ui } from '../../state/store';
import { PROJECT_STATUSES, type Project, type ProjectDraft, type ProjectStatus } from '../../types/project';
import type { User } from '../../types/user';
import { $$, esc, plural } from '../../utils/dom';
import { dependencySection, mountDependencyEditor, type DependencyEditor } from '../dependencies/dependencyEditor';
import { promptNewUser } from '../settings/usersAdmin';

function pickButton(u: User, selected: boolean): string {
  return `<button type="button" class="pick-u ${selected ? 'on' : ''}" data-user="${u.id}" aria-pressed="${selected}">${avatar(u)}<span>${esc(u.name)}</span></button>`;
}

function coordinatorPicker(selected: string[]): string {
  return `<div class="form-full coord-field"><div class="lbl">Quem coordena o projeto</div><div class="pick" id="coordPick">${db.users
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

/** Só lista contratantes cadastradas pelo administrador; não aceita texto livre. */
function contratanteSelect(selected: string): string {
  const list = sortedContratantes();
  // Mantém a atual visível mesmo se ela tiver sido removida da lista.
  const missing = selected && !findContratante(selected) ? `<option value="${esc(selected)}" selected>(contratante removida)</option>` : '';
  const opts = list.map((x) => `<option value="${esc(x.id)}" ${x.id === selected ? 'selected' : ''}>${esc(x.cidade ? `${x.name} — ${x.cidade}` : x.name)}</option>`).join('');
  const hint = list.length
    ? ''
    : `<small class="field-hint">Nenhuma contratante cadastrada. ${
        can('contratantes', 'create') ? 'Cadastre em Configurações → Contratantes.' : 'Peça ao administrador para cadastrar.'
      }</small>`;
  return `<label>Contratante<select class="field" name="contratanteId"><option value="">Sem contratante</option>${missing}${opts}</select>${hint}</label>`;
}

const PROJECT_INTRO =
  'O que precisa acontecer antes deste projeto avançar. Enquanto houver condição pendente, o projeto não pode ir para “Em andamento” ou “Concluído” e todas as suas tarefas ficam bloqueadas.';

function formHtml(p: Project | undefined): string {
  const statusOptions = PROJECT_STATUSES.map((s) => `<option ${p?.status === s ? 'selected' : ''}>${s}</option>`).join('');
  const archive = !p || !can('projects', 'delete', p.id)
    ? '<span></span>'
    : p.archived
      ? '<button class="ghost" type="button" id="archiveProject">Desarquivar</button>'
      : `<button class="danger" type="button" id="archiveProject">${icon('archive')}Arquivar</button>`;
  // A descrição saiu do formulário; só aparece para quem já tinha uma, para poder editar ou apagar.
  const legacyDescription = p?.description.trim()
    ? `<div class="form-full"><label>Descrição (campo antigo — apague o texto para removê-lo)<textarea class="field" name="description">${esc(p.description)}</textarea></label></div>`
    : '';
  return `<form id="projectForm" class="pform"><div class="sec first"><h3>Identificação</h3><div class="form-full">${input('name', 'Nome do projeto', p?.name ?? '', 'required')}</div><div class="form-full form-grid">${input(
    'processo',
    'Processo',
    p?.processo ?? '',
    'placeholder="Ex: 12345/2026"',
  )}${contratanteSelect(p?.contratanteId ?? '')}</div>${legacyDescription}</div><div class="sec"><h3>Andamento</h3><div class="form-grid"><label>Status<select class="field" name="status">${statusOptions}</select></label>${input(
    'due',
    'Prazo',
    p?.due ?? '',
    'type="date"',
  )}</div><small class="field-hint">O atraso é indicado pelo prazo, independente do status.</small></div><div class="sec"><h3>Coordenação</h3>${coordinatorPicker(
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
  )}</div><div class="form-full">${input('convPolitico', 'Origem do recurso (político / emenda)', p?.convPolitico ?? '', 'placeholder="Ex: Emenda do Dep. Fulano de Tal"')}</div></div>${dependencySection()}<p class="form-error" id="projectErr" role="alert"></p><div class="modal-actions">${archive}<button class="primary">${
    p ? 'Salvar' : 'Criar projeto'
  }</button></div></form>`;
}

function readDraft(form: HTMLFormElement, project: Project | undefined, deps: DependencyEditor): ProjectDraft {
  const data = new FormData(form);
  const text = (name: string): string => String(data.get(name) ?? '').trim();
  const status = text('status') as ProjectStatus;
  return {
    name: text('name'),
    status: PROJECT_STATUSES.includes(status) ? status : 'Em espera',
    due: text('due'),
    // Sem o campo na tela, a descrição antiga é mantida como está.
    description: data.has('description') ? text('description') : (project?.description ?? ''),
    processo: text('processo'),
    contratanteId: text('contratanteId'),
    convOrgao: text('convOrgao'),
    convNumero: text('convNumero'),
    convValor: text('convValor'),
    convContra: text('convContra'),
    convPolitico: text('convPolitico'),
    coordinators: $$('#coordPick .pick-u.on').map((b) => b.dataset.user ?? '').filter(Boolean),
    dependencies: deps.value(),
  };
}

export function openProjectModal(project?: Project): void {
  openModal(project ? 'Editar projeto' : 'Novo projeto', formHtml(project));
  bindPicker();
  const form = modalField<HTMLFormElement>('#projectForm');
  const deps = mountDependencyEditor(
    modalField('#depEditor'),
    () => ({ ref: project ? { kind: 'project', projectId: project.id, id: project.id } : { kind: 'project', projectId: NEW_ID, id: NEW_ID } }),
    project?.dependencies ?? [],
    true,
    PROJECT_INTRO,
  );
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const draft = readDraft(form, project, deps);
    const before = blockedSnapshot();
    try {
      if (project) updateProject(project, draft);
      else createProject(draft);
    } catch (error) {
      if (!(error instanceof DependencyError)) throw error;
      modalField('#projectErr').textContent = error.message;
      return;
    }
    closeModal();
    const released = releasedSince(before);
    const extra = released ? ` · ${plural(released, 'item liberado', 'itens liberados')}` : '';
    if (project) {
      if (isProjectOpen() && ui.projectId === project.id) refreshProject();
      else goTo(ui.page);
      showToast(`Projeto salvo${extra}`);
    } else {
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
