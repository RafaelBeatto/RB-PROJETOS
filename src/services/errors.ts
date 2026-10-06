/** Erro de regra de negócio (ex.: nome obrigatório); a interface mostra a mensagem como aviso. */
export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleError';
  }
}
