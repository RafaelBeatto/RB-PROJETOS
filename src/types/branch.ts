import type { Dependency } from './dependency';
import type { TaskStatus } from './task';

export interface Point {
  x: number;
  y: number;
}

export interface Branch extends Point {
  id: string;
  name: string;
  /** Id da etapa pai; null quando fica direto no projeto. */
  parent: string | null;
  /** Id do usuário responsável pela etapa (o campo se chama designer por compatibilidade). */
  designer: string | null;
  /** Coluna da etapa no Kanban "Etapas" (mesmas colunas das tarefas). */
  status: TaskStatus;
  /** O que precisa acontecer antes de a etapa (e suas tarefas) poder avançar. */
  dependencies: Dependency[];
}
