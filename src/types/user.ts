export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
}

/** Pessoa exibível com avatar: um usuário cadastrado ou um nome solto. */
export interface Person {
  name: string;
  color: string;
}
