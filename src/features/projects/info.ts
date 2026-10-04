import { icon } from '../../components/icons';
import { agreementName, agreementTotal, hasAgreement, projectProgress } from '../../services/projectService';
import type { Project } from '../../types/project';
import { formatDate } from '../../utils/date';
import { esc } from '../../utils/dom';
import { currency, projectStatusClass } from '../../utils/format';
import { registerTab } from './projectView';

const row = (label: string, value: string, cls = ''): string => `<div class="info-row ${cls}"><label>${label}</label><div>${value}</div></div>`;
const text = (v: string): string => esc(v.trim() || '—');

function renderInfo(p: Project): string {
  const prog = projectProgress(p);
  return `<div class="sec-head"><h3>Identificação</h3><button class="ghost" data-action="project-edit">${icon('edit')}Editar informações</button></div><div class="info">${row(
    'Nome',
    text(p.name),
  )}${row('Processo', text(p.processo))}${row('Descrição', text(p.description))}</div><div class="sec-head"><h3>Andamento</h3></div><div class="info">${row(
    'Status',
    `<span class="status ${projectStatusClass(p.status)}">${esc(p.status)}</span>`,
  )}${row('Responsável', text(p.owner))}${row('Prazo', formatDate(p.due))}${row(
    'Progresso',
    `${prog.done} de ${prog.total} tarefas concluídas (${prog.pct}%)`,
  )}</div><div class="sec-head"><h3>Convênio</h3></div><div class="info">${row('Convênio', text(agreementName(p)))}${row('Origem do convênio', text(p.convOrgao))}${row(
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
