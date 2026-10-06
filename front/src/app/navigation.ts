/**
 * Navegação entre páginas globais e o projeto aberto.
 * As telas se registram aqui, o que evita importações circulares entre features.
 * Toda troca de página/aba passa pela verificação de permissão.
 */
import { showToast } from '../components/toast';
import { canCreateProject } from '../services/permissionService';
import { findProject } from '../services/projectService';
import { emptyBranchFilters, emptyTaskFilters, ui, type Page } from '../state/store';
import type { Project } from '../types/project';
import { $, $$ } from '../utils/dom';
import { NO_ACCESS, PAGE_ORDER, TAB_ORDER, applyAccess, canOpenPage, canOpenTab } from './access';

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

function showNoAccess(): void {
  setPageHeader('Sem acesso', 'Seu perfil não tem acesso a nenhum módulo.', false);
  $('#homeFilters').innerHTML = '';
  resetFilterBar();
  pageContent().innerHTML = `<div class="empty">${NO_ACCESS}</div>`;
}

/** Primeira página que o usuário pode abrir. */
export function homePage(): Page | null {
  return PAGE_ORDER.find(canOpenPage) ?? null;
}

export function goTo(page: Page, silent = false): void {
  applyAccess();
  $('#home').hidden = false;
  $('#projectView').hidden = true;
  let target: Page | null = page;
  if (!canOpenPage(page)) {
    if (!silent) showToast(NO_ACCESS);
    target = homePage();
  }
  if (!target) {
    setActiveNav(page);
    showNoAccess();
    return;
  }
  ui.page = target;
  setActiveNav(target);
  pages.get(target)?.();
}

export function refreshPage(): void {
  goTo(ui.page, true);
}

export function openProject(id: string): void {
  if (!findProject(id)) return;
  if (!canOpenTab('overview', id)) {
    showToast('Você não tem acesso a este projeto.');
    return;
  }
  ui.projectId = id;
  // O projeto abre no Kanban de etapas.
  ui.tab = 'kanban';
  ui.branchId = null;
  ui.branchFilters = emptyBranchFilters();
  ui.taskFilters = emptyTaskFilters();
  $('#home').hidden = true;
  $('#projectView').hidden = false;
  window.scrollTo(0, 0);
  refreshProject();
}

/** Abre uma etapa do projeto aberto (Kanban de tarefas). */
export function openBranch(id: string | null): void {
  ui.tab = 'kanban';
  if (ui.branchId !== id) ui.taskFilters = emptyTaskFilters();
  ui.branchId = id;
  window.scrollTo(0, 0);
  refreshProject();
}

export function refreshProject(): void {
  if (!isProjectOpen()) return;
  // Projeto que sumiu (enviado para a lixeira) ou ficou sem acesso: volta para a lista.
  if (!canOpenTab('overview', ui.projectId ?? undefined)) {
    goTo('home', true);
    return;
  }
  applyAccess(ui.projectId ?? undefined);
  if (!canOpenTab(ui.tab, ui.projectId ?? undefined)) ui.tab = TAB_ORDER.find((t) => canOpenTab(t, ui.projectId ?? undefined)) ?? 'overview';
  renderProjectView();
}

/** Redesenha o que estiver na tela. */
export function refresh(): void {
  if (isProjectOpen()) refreshProject();
  else refreshPage();
}

export function setPageHeader(title: string, subtitle: string, showNewProject: boolean): void {
  $('#pageTitle').textContent = title;
  $('#pageSub').textContent = subtitle;
  $('#homeNew').hidden = !showNewProject || !canCreateProject();
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
