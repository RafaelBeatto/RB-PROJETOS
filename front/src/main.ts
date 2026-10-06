import './styles/index.css';
import { installAppActions } from './app/appActions';
import { goTo, homePage } from './app/navigation';
import { installShortcuts } from './app/shortcuts';
import { initTheme } from './app/theme';
import { installFilters } from './components/filterBar';
import { appShell } from './components/layout';
import { installModal } from './components/modal';
import { initLogin } from './features/auth/login';
import { initChat } from './features/chat/projectChat';
import { initCollaborators } from './features/collaborators/collaborators';
import { initHistory } from './features/history/history';
import { initInfo } from './features/projects/info';
import { initMilestones } from './features/projects/milestoneModal';
import { initOverview } from './features/projects/overview';
import { initProjectBoard } from './features/projects/projectBoard';
import { initProjectFilters } from './features/projects/projectFilters';
import { initProjectView } from './features/projects/projectView';
import { initSearch } from './features/search/search';
import { initSettings } from './features/settings/settings';
import { initEtapaBoard } from './features/structure/etapaBoard';
import { initStructure } from './features/structure/structureTab';
import { initToday } from './features/today/today';
import { initTrash } from './features/trash/trash';
import { loadDatabase } from './services/db';
import { RuleError } from './services/errors';
import { PermissionDeniedError } from './services/permissionService';
import { showToast } from './components/toast';
import { installActions } from './utils/actions';
import { $ } from './utils/dom';

/** Ações bloqueadas pelas regras (permissão ou regra de negócio) viram um aviso, sem quebrar a tela. */
function installPermissionErrors(): void {
  const handle = (error: unknown, prevent: () => void): void => {
    if (error instanceof PermissionDeniedError || error instanceof RuleError) {
      prevent();
      showToast(error.message);
    }
  };
  window.addEventListener('error', (e) => handle(e.error, () => e.preventDefault()));
  window.addEventListener('unhandledrejection', (e) => handle(e.reason, () => e.preventDefault()));
}

function start(): void {
  // Anexos foram removidos do sistema: apaga os arquivos que tenham ficado guardados no navegador.
  try {
    indexedDB.deleteDatabase('rb-files');
  } catch {
    /* armazenamento indisponível: nada a apagar */
  }
  installPermissionErrors();
  loadDatabase();
  $('#app').innerHTML = appShell();
  initTheme();

  installActions();
  installModal();
  installFilters();
  installAppActions();
  installShortcuts();

  initProjectFilters();
  initProjectBoard();
  initToday();
  initHistory();
  initCollaborators();
  initProjectView();
  initOverview();
  initInfo();
  initMilestones();
  initStructure();
  initEtapaBoard();
  initChat();
  initTrash();
  initSearch();
  initSettings();

  initLogin(() => goTo(homePage() ?? 'home', true));
}

start();
