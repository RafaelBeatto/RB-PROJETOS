import { pageContent, registerPage, setFilterBar, setPageHeader } from '../../app/navigation';
import { avatar } from '../../components/avatar';
import { icon } from '../../components/icons';
import { db } from '../../services/db';
import { can } from '../../services/permissionService';
import { projectRef } from '../../services/dependencyService';
import { contratanteCidade, contratanteName } from '../../services/contratanteService';
import { blockedBadge } from '../dependencies/dependencyView';
import { agreementName, agreementTotal, hasAgreement, lateTaskCount } from '../../services/projectService';
import { findUser } from '../../services/userService';
import type { Project } from '../../types/project';
import { daysUntil, formatDate } from '../../utils/date';
import { esc, plural } from '../../utils/dom';
import { currency, projectStatusClass } from '../../utils/format';
import { matchesProjectFilters, projectFilterBar, projectFiltersActive, sortProjects } from './projectFilters';

/** "Faltam 12 dias", "Vence hoje", "Atrasado há 3 dias"; vazio sem prazo ou se concluído. */
function dueBadge(p: Project): string {
  if (!p.due || p.status === 'Concluído') return '';
  const d = daysUntil(p.due);
  const [cls, label] =
    d < 0
      ? ['late', `Atrasado há ${plural(-d, 'dia', 'dias')}`]
      : d === 0
        ? ['soon', 'Vence hoje']
        : [d <= 7 ? 'soon' : 'ok', `${d === 1 ? 'Falta' : 'Faltam'} ${plural(d, 'dia', 'dias')}`];
  return `<span class="due-badge ${cls}">${label}</span>`;
}

const fact = (label: string, value: string, extra = ''): string =>
  `<div class="pc-fact"><small>${label}</small><b>${value}</b>${extra}</div>`;

/** Coordenadores com foto e nome ao lado (até três; o restante vira "+N"). */
function coordinators(p: Project): string {
  const users = p.coordinators.map(findUser).filter((u): u is NonNullable<typeof u> => !!u);
  if (!users.length) return '<span class="pc-coord none">Sem coordenador</span>';
  const extra = users.length > 3 ? `<span class="pc-coord more">+${users.length - 3}</span>` : '';
  return `${users
    .slice(0, 3)
    .map((u) => `<span class="pc-coord">${avatar(u, true)}<span>${esc(u.name)}</span></span>`)
    .join('')}${extra}`;
}

function projectCard(p: Project): string {
  const late = lateTaskCount(p);
  const agreement = agreementName(p);
  const contratante = contratanteName(p);
  const cidade = contratanteCidade(p);
  const facts = [
    fact('Processo', esc(p.processo.trim() || '—')),
    fact('Contratante', esc(contratante || '—'), cidade ? `<span class="pc-city">${esc(cidade)}</span>` : ''),
    fact('Prazo', formatDate(p.due), dueBadge(p)),
  ].join('');
  // Informação secundária: valor, convênio e quem enviou o recurso.
  const secondary = [
    hasAgreement(p) ? `<span>Valor total <b>${currency(agreementTotal(p))}</b></span>` : '',
    agreement ? `<span>${esc(agreement)}</span>` : '',
    p.convPolitico ? `<span>Enviado por ${esc(p.convPolitico)}</span>` : '',
    late ? `<span class="late-txt">${plural(late, 'tarefa atrasada', 'tarefas atrasadas')}</span>` : '',
  ]
    .filter(Boolean)
    .join('');
  return `<article class="project-card" data-action="project-open" data-id="${p.id}" tabindex="0"><div><h2>${esc(p.name)}</h2>${blockedBadge(projectRef(p), 'Bloqueado')}<div class="pc-coords">${coordinators(
    p,
  )}</div><div class="pc-facts">${facts}</div>${secondary ? `<div class="meta pc-secondary">${secondary}</div>` : ''}</div><span class="status ${projectStatusClass(
    p.status,
  )}">${esc(p.status)}</span></article>`;
}

function renderList(archived: boolean): void {
  setPageHeader(archived ? 'Arquivados' : 'Projetos', archived ? 'Projetos guardados.' : 'Seus projetos em andamento.', !archived);
  setFilterBar('projects', projectFilterBar);
  const list = sortProjects(db.projects.filter((p) => p.archived === archived && matchesProjectFilters(p)));
  let html: string;
  if (list.length) html = list.map(projectCard).join('');
  else if (projectFiltersActive()) html = '<div class="empty">Nenhum projeto encontrado com esses filtros.</div>';
  else if (archived) html = '<div class="empty">Ainda não existem projetos arquivados.</div>';
  else if (!can('projects', 'create')) html = '<div class="empty">Ainda não existem projetos.</div>';
  else html = `<div class="empty">Ainda não existem projetos.<br><br><button class="primary" data-action="project-new">${icon('plus')}<span>Criar primeiro projeto</span></button></div>`;
  pageContent().innerHTML = html;
}

export function initHome(): void {
  registerPage('home', () => renderList(false));
  registerPage('archive', () => renderList(true));
}
