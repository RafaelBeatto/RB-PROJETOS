import './styles/index.css';
import { installAppActions } from './app/appActions';
import { goTo, homePage } from './app/navigation';
import { installShortcuts } from './app/shortcuts';
import { initTheme } from './app/theme';
import { STORAGE_FAILED, STORAGE_KEYS, readString, writeString } from './services/storage';
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
/** Gravação recusada pelo navegador (espaço cheio ou bloqueado): avisa em vez de perder em silêncio. */
function installStorageWarning(): void {
  window.addEventListener(STORAGE_FAILED, () =>
    showToast('Não foi possível salvar: o espaço deste navegador está cheio ou bloqueado. Esvazie a lixeira ou libere espaço; as últimas alterações podem se perder ao recarregar.'),
  );
}

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
  // Anexos foram removidos do sistema: apaga uma única vez os arquivos que tenham ficado no navegador.
  if (!readString(STORAGE_KEYS.filesCleaned)) {
    try {
      // A marca só é gravada quando a exclusão termina; se for bloqueada, tenta de novo na próxima vez.
      indexedDB.deleteDatabase('rb-files').onsuccess = () => writeString(STORAGE_KEYS.filesCleaned, '1');
    } catch {
      /* armazenamento indisponível: nada a apagar */
    }
  }
  installPermissionErrors();
  installStorageWarning();
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
