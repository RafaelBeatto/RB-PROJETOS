export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** Foto em data URL (imagem reduzida); vazio = iniciais. */
  photo: string;
  /** Cargo exibido (texto livre), não confundir com o perfil de acesso. */
  role: string;
  color: string;
  /** Perfil de acesso (ver types/access.ts). */
  profileId: string;
  active: boolean;
  /**
   * Projetos que um Visualizador pode ver. null = todos (padrão).
   * Só vale para quem tem a função Visualizador.
   */
  projectIds: string[] | null;
  /** Data de criação, ISO. */
  createdAt: string;
  /** SHA-256 de salt + senha. A senha em texto nunca é guardada. */
  passwordHash: string;
  passwordSalt: string;
}

/** Pessoa exibível com avatar: um usuário cadastrado ou um nome solto. */
export interface Person {
  name: string;
  color: string;
  photo?: string;
}
