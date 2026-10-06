/**
 * Registro de conclusão: quem concluiu e quando, em tarefas, subtarefas, etapas e itens de checklist.
 * Ao reabrir o item, o registro é apagado; concluir de novo registra a nova conclusão.
 */
import type { Completion } from '../types/task';
import { formatDate, formatTime } from '../utils/date';
import { currentUser } from './authService';
import { findUser } from './userService';

/** Marca (ou limpa) o registro conforme o item está concluído; mantém o registro original se já estava. */
export function stampCompletion(item: Completion, done: boolean): void {
  if (!done) {
    delete item.doneBy;
    delete item.doneByName;
    delete item.doneAt;
    return;
  }
  if (item.doneAt) return;
  const user = currentUser();
  item.doneBy = user?.id ?? '';
  item.doneByName = user?.name ?? '';
  item.doneAt = new Date().toISOString();
}

/** "Concluída por Rafael em 06/10/2026 às 15:32" (ou vazio se não há registro). */
export function completionText(item: Completion, word = 'Concluída'): string {
  if (!item.doneAt) return '';
  const who = findUser(item.doneBy)?.name ?? item.doneByName ?? '';
  const day = formatDate(item.doneAt.slice(0, 10));
  return `${word}${who ? ` por ${who}` : ''} em ${day} às ${formatTime(item.doneAt)}`;
}
