import { icon } from '../../components/icons';
import { canEditProject } from '../../services/permissionService';
import { contratanteCidade, contratanteName } from '../../services/contratanteService';
import { findUser } from '../../services/userService';
import { agreementName, agreementTotal, hasAgreement, isProjectOverdue, projectProgress } from '../../services/projectService';
import type { Project } from '../../types/project';
import { formatDate } from '../../utils/date';
import { esc } from '../../utils/dom';
import { currency, projectStatusClass } from '../../utils/format';
import { registerTab } from './projectView';

const row = (label: string, value: string, cls = ''): string => `<div class="info-row ${cls}"><label>${label}</label><div>${value}</div></div>`;
const text = (v: string): string => esc(v.trim() || '—');

const coordinatorNames = (p: Project): string =>
  p.coordinators
    .map((id) => findUser(id)?.name)
    .filter(Boolean)
    .join(', ');

function renderInfo(p: Project): string {
  const prog = projectProgress(p);
  return `<div class="sec-head"><h3>Identificação</h3>${
    canEditProject(p) ? `<button class="ghost" data-action="project-edit">${icon('edit')}Editar informações</button>` : ''
  }</div><div class="info">${row(
    'Nome',
    text(p.name),
  )}${row('Descrição', text(p.description))}${row('Processo', text(p.processo))}${row('Contratante', text(contratanteName(p)))}${row('Cidade', text(contratanteCidade(p)))}</div><div class="sec-head"><h3>Andamento</h3></div><div class="info">${row(
    'Status',
    `<span class="status ${projectStatusClass(p.status)}">${esc(p.status)}</span>`,
  )}${p.archived ? row('Situação', 'Encerrado (arquivado)') : ''}${row('Prioridade', text(p.priority))}${row('Coordenação', text(coordinatorNames(p)))}${row('Data de início', formatDate(p.start))}${row(
    'Data de término',
    `${formatDate(p.due)}${isProjectOverdue(p) ? ' <span class="status late">Vencida</span>' : ''}`,
  )}${row('Progresso', `${prog.done} de ${prog.total} etapas concluídas (${prog.pct}%)`)}</div><div class="sec-head"><h3>Convênio</h3></div><div class="info">${row('Convênio', text(agreementName(p)))}${row('Origem do convênio', text(p.convOrgao))}${row(
    'Número do convênio',
    text(p.convNumero),
  )}${row('Origem do recurso', text(p.convPolitico))}${row('Valor do convênio', currency(p.convValor))}${row('Contrapartida', currency(p.convContra))}${row(
    'Valor total',
    hasAgreement(p) ? currency(agreementTotal(p)) : '—',
    'total',
  )}</div>`;
}

export function initInfo(): void {
  registerTab('info', { render: renderInfo });
}
