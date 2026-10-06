/** Id curto com prefixo (p = projeto, t = tarefa, b = etapa…), no mesmo formato dos dados antigos. */
export function uid(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 9);
}
