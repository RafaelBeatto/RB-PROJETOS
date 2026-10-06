/** Estrutura fixa da aplicação: barra superior, navegação, áreas de conteúdo e camadas. */
import type { Page, ProjectTab } from '../state/store';
import { icon, type IconName } from './icons';
import { modalShell } from './modal';

const NAV: { page: Page; label: string; icon: IconName; mobile: boolean; perm: string }[] = [
  { page: 'home', label: 'Projetos', icon: 'board', mobile: true, perm: 'projects.view' },
  { page: 'today', label: 'Hoje', icon: 'today', mobile: true, perm: 'projects.view' },
  { page: 'history', label: 'Histórico', icon: 'activity', mobile: true, perm: 'projects.view' },
  { page: 'collaborators', label: 'Colaboradores', icon: 'collaborators', mobile: false, perm: 'collaborators.view' },
  { page: 'archive', label: 'Arquivados', icon: 'archive', mobile: false, perm: 'projects.view' },
  { page: 'trash', label: 'Lixeira', icon: 'trash', mobile: false, perm: '@trash' },
];

const TABS: { tab: ProjectTab; label: string }[] = [
  { tab: 'kanban', label: 'Etapas' },
  { tab: 'overview', label: 'Visão geral' },
  { tab: 'info', label: 'Informações' },
  { tab: 'chat', label: 'Chat' },
];

const navItem = (n: (typeof NAV)[number]): string =>
  `<button class="nav-item${n.mobile ? '' : ' desktop-only'}" data-action="nav" data-page="${n.page}" data-perm="${n.perm}">${icon(n.icon)}<span>${n.label}</span></button>`;

export function appShell(): string {
  return `
<div class="login" id="login" hidden></div>
<div class="app">
  <header class="topbar">
    <div class="brand">RB <i>PROJECTS</i></div>
    <div class="top-actions">
      <button class="ghost settings-top" data-action="nav" data-page="settings" data-perm="@settings" aria-label="Configurações">${icon('settings')}</button>
      <button class="ghost theme-toggle" data-action="theme-toggle" aria-label="Trocar tema"></button>
      <button class="ghost" data-action="search" aria-label="Pesquisar">${icon('search')}<span class="hide-sm">Pesquisar</span><kbd class="hide-sm">Ctrl K</kbd></button>
      <button class="primary" data-action="project-new" data-perm="@projectCreate">${icon('plus')}<span>Projeto</span></button>
    </div>
  </header>
  <aside class="sidebar" aria-label="Navegação">
    ${NAV.map(navItem).join('')}
    <button class="nav-item mobile-only" data-action="more">${icon('more')}<span>Mais</span></button>
    <div class="nav-bottom">
      <div id="accountSlot"></div>
      <button class="nav-item" data-action="nav" data-page="settings" data-perm="@settings">${icon('settings')}<span>Configurações</span></button>
      <button class="nav-item" data-action="logout">${icon('logout')}<span>Sair</span></button>
    </div>
  </aside>
  <main class="main">
    <section id="home">
      <div class="page-head">
        <div><h1 id="pageTitle">Projetos</h1><p class="sub" id="pageSub"></p></div>
        <button class="primary" id="homeNew" data-action="project-new">${icon('plus')}<span>Novo projeto</span></button>
      </div>
      <div id="homeFilters"></div>
      <div id="projects" class="projects"></div>
    </section>
    <section id="projectView" class="project-view" hidden>
      <button class="crumb" data-action="back">${icon('chevronLeft')}Projetos</button>
      <div class="project-title">
        <div><h1 id="pName"></h1><p class="sub" id="pDescription"></p><div id="pMeta" class="p-meta"></div></div>
        <div class="top-actions">
          <button class="ghost" data-action="project-edit" data-perm="@projectEdit">${icon('edit')}<span>Editar</span></button>
          <button class="primary" data-action="add-menu" data-perm="@branchCreate|@projectEdit">${icon('plus')}<span>Adicionar</span></button>
        </div>
      </div>
      <nav class="tabs" aria-label="Seções do projeto">
        ${TABS.map((t) => `<button class="tab" data-action="tab" data-tab="${t.tab}">${t.label}<span class="tab-badge" hidden></span></button>`).join('')}
      </nav>
      <div id="viewContent"></div>
    </section>
  </main>
</div>
${modalShell()}
<div id="toast" class="toast" role="status" hidden></div>
<datalist id="usersList"></datalist>`;
}
