import './styles/index.css';
import { installAppActions } from './app/appActions';
import { goTo } from './app/navigation';
import { installShortcuts } from './app/shortcuts';
import { installFilters } from './components/filterBar';
import { appShell } from './components/layout';
import { installModal } from './components/modal';
import { initLogin } from './features/auth/login';
import { initHistory } from './features/history/history';
import { initHome } from './features/projects/home';
import { initInfo } from './features/projects/info';
import { initMilestones } from './features/projects/milestoneModal';
import { initOverview } from './features/projects/overview';
import { initProjectBoard } from './features/projects/projectBoard';
import { initProjectFilters } from './features/projects/projectFilters';
import { initProjectView } from './features/projects/projectView';
import { initSearch } from './features/search/search';
import { initSettings } from './features/settings/settings';
import { initStructure } from './features/structure/structureTab';
import { initTaskActions } from './features/tasks/taskActions';
import { initTaskBoard } from './features/tasks/taskBoard';
import { initTaskList } from './features/tasks/taskList';
import { initTimeline } from './features/timeline/timeline';
import { initToday } from './features/today/today';
import { initUsers } from './features/users/users';
import { loadDatabase } from './services/db';
import { installActions } from './utils/actions';
import { $ } from './utils/dom';

function start(): void {
  loadDatabase();
  $('#app').innerHTML = appShell();

  installActions();
  installModal();
  installFilters();
  installAppActions();
  installShortcuts();

  initProjectFilters();
  initHome();
  initProjectBoard();
  initToday();
  initUsers();
  initHistory();
  initProjectView();
  initOverview();
  initInfo();
  initMilestones();
  initTaskActions();
  initTaskBoard();
  initTaskList();
  initTimeline();
  initStructure();
  initSearch();
  initSettings();

  goTo('home');
  initLogin();
}

start();
