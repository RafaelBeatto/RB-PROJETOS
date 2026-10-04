import { TASK_STATUSES, type TaskStatus } from '../../types/task';
import { onClick } from '../../utils/actions';
import { initTaskFilters } from './taskFilters';
import { openTaskModal } from './taskModal';

const isTaskStatus = (v: string | undefined): v is TaskStatus => TASK_STATUSES.includes(v as TaskStatus);

export function initTaskActions(): void {
  initTaskFilters();
  onClick('task-open', (el) => openTaskModal(el.dataset.id));
  onClick('task-new', (el) => {
    const status = el.dataset.status;
    openTaskModal(undefined, isTaskStatus(status) ? status : 'A fazer', el.dataset.branch ?? '');
  });
}
