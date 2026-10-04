import { pageContent, registerPage, setFilterBar, setPageHeader } from '../../app/navigation';
import { avatarStack } from '../../components/avatar';
import { icon } from '../../components/icons';
import { progressRow } from '../../components/progress';
import { db } from '../../services/db';
import { agreementName, lateTaskCount, projectProgress } from '../../services/projectService';
import type { Project } from '../../types/project';
import { formatDate } from '../../utils/date';
import { esc } from '../../utils/dom';
import { projectStatusClass } from '../../utils/format';
import { matchesProjectFilters, projectFilterBar, projectFiltersActive, sortProjects } from './projectFilters';

function projectCard(p: Project): string {
  const prog = projectProgress(p);
  const late = lateTaskCount(p);
  const agreement = agreementName(p);
  const meta = [
    avatarStack(p.coordinators),
    `<span>${prog.total} tarefas</span>`,
    `<span>${prog.done} concluídas</span>`,
    late ? `<span class="late-txt">${late} atrasadas</span>` : '',
    p.processo ? `<span>Processo ${esc(p.processo)}</span>` : '',
    `<span>Prazo: ${formatDate(p.due)}</span>`,
    agreement ? `<span>${esc(agreement)}</span>` : '',
    p.convPolitico ? `<span>${esc(p.convPolitico)}</span>` : '',
  ].join('');
  return `<article class="project-card" data-action="project-open" data-id="${p.id}" tabindex="0"><div><h2>${esc(p.name)}</h2><p>${esc(
    p.description || 'Sem descrição',
  )}</p>${progressRow(prog.pct)}<div class="meta">${meta}</div></div><span class="status ${projectStatusClass(p.status)}">${esc(p.status)}</span></article>`;
}

function renderList(archived: boolean): void {
  setPageHeader(archived ? 'Arquivados' : 'Projetos', archived ? 'Projetos guardados.' : 'Seus projetos em andamento.', !archived);
  setFilterBar('projects', projectFilterBar);
  const list = sortProjects(db.projects.filter((p) => p.archived === archived && matchesProjectFilters(p)));
  let html: string;
  if (list.length) html = list.map(projectCard).join('');
  else if (projectFiltersActive()) html = '<div class="empty">Nenhum projeto encontrado com esses filtros.</div>';
  else if (archived) html = '<div class="empty">Ainda não existem projetos arquivados.</div>';
  else html = `<div class="empty">Ainda não existem projetos.<br><br><button class="primary" data-action="project-new">${icon('plus')}<span>Criar primeiro projeto</span></button></div>`;
  pageContent().innerHTML = html;
}

export function initHome(): void {
  registerPage('home', () => renderList(false));
  registerPage('archive', () => renderList(true));
}
