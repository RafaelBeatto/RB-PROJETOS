/**
 * Navegação entre páginas globais e o projeto aberto.
 * As telas se registram aqui, o que evita importações circulares entre features.
 */
import { findProject } from '../services/projectService';
import { emptyBranchFilters, emptyTaskFilters, ui, type Page } from '../state/store';
import type { Project } from '../types/project';
import { $, $$ } from '../utils/dom';

const pages = new Map<Page, () => void>();
let renderProjectView: () => void = () => undefined;

export function registerPage(page: Page, render: () => void): void {
  pages.set(page, render);
}

export function registerProjectView(render: () => void): void {
  renderProjectView = render;
}

function setActiveNav(page: Page): void {
  $$('[data-action="nav"]').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
}

export function isProjectOpen(): boolean {
  return !$('#projectView').hidden;
}

/** Projeto aberto; só deve ser chamado dentro das telas do projeto. */
export function currentProject(): Project {
  const p = findProject(ui.projectId);
  if (!p) throw new Error('Nenhum projeto aberto');
  return p;
}

export function goTo(page: Page): void {
  ui.page = page;
  $('#home').hidden = false;
  $('#projectView').hidden = true;
  setActiveNav(page);
  pages.get(page)?.();
}

export function refreshPage(): void {
  pages.get(ui.page)?.();
}

export function openProject(id: string): void {
  if (!findProject(id)) return;
  ui.projectId = id;
  ui.tab = 'overview';
  ui.cardLevel = null;
  ui.taskFilters = emptyTaskFilters();
  ui.branchFilters = emptyBranchFilters();
  $('#home').hidden = true;
  $('#projectView').hidden = false;
  window.scrollTo(0, 0);
  renderProjectView();
}

export function refreshProject(): void {
  if (isProjectOpen()) renderProjectView();
}

/** Redesenha o que estiver na tela. */
export function refresh(): void {
  if (isProjectOpen()) refreshProject();
  else refreshPage();
}

export function setPageHeader(title: string, subtitle: string, showNewProject: boolean): void {
  $('#pageTitle').textContent = title;
  $('#pageSub').textContent = subtitle;
  $('#homeNew').hidden = !showNewProject;
}

/** Troca a barra de filtros só quando muda o tipo de página, para não perder o foco ao digitar. */
export function setFilterBar(kind: string, html: () => string): void {
  const el = $('#homeFilters');
  if (el.dataset.kind === kind) return;
  el.dataset.kind = kind;
  el.innerHTML = html();
}

export function resetFilterBar(): void {
  $('#homeFilters').dataset.kind = '';
}

export function pageContent(): HTMLElement {
  return $('#projects');
}
