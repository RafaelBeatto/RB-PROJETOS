/** Mensagem do chat do projeto. */
export interface ChatMessage {
  id: string;
  /** Id do autor; o nome fica guardado em `who` para o caso de o usuário ser removido. */
  userId: string;
  who: string;
  text: string;
  at: string;
  /** Usuários marcados com @. */
  mentions: string[];
  /** Marcou @todos: vale para todos os usuários cadastrados. */
  everyone: boolean;
}
