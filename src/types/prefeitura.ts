/** Prefeitura atendida pelos projetos. Cadastrada só pelo administrador, escolhida no projeto. */
export interface Prefeitura {
  id: string;
  name: string;
  /** Cidade/UF ou observação curta (opcional). */
  uf: string;
}
