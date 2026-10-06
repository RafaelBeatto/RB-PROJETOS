# back

Pasta reservada para o servidor (API e banco de dados) do RB Projects.

**Hoje ela está vazia de propósito.** O RB Projects é 100% estático: não há servidor nem banco de dados. Os dados (projetos, usuários, perfis, permissões, chat e lixeira) ficam no `localStorage` do navegador, e todo o código está em `../front/`.

Quando houver uma API, ela entra aqui. As regras de acesso já estão concentradas em `front/src/services/permissionService.ts` e o acesso aos dados em `front/src/services/storage.ts`, que são os pontos a migrar.
