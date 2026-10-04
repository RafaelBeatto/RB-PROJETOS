import type { Dependency } from './dependency';

export interface Point {
  x: number;
  y: number;
}

export interface Branch extends Point {
  id: string;
  name: string;
  /** Id da ramificação pai; null quando fica direto no projeto. */
  parent: string | null;
  /** Id do usuário projetista. */
  designer: string | null;
  /** O que precisa acontecer antes de a ramificação (e suas tarefas) poder avançar. */
  dependencies: Dependency[];
}
