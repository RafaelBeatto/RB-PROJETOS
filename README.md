# RB Projects

Gerenciador de projetos simples e visual: estrutura do projeto em mapa e cartões, Kanban, tarefas com checklist, marcos e histórico.

A aplicação é 100% estática. Não há servidor, banco de dados nem API: os dados ficam no navegador de cada pessoa (`localStorage`). O site publicado é só HTML, CSS e JavaScript.

**Online:** https://rafaelbeatto.github.io/RB-PROJETOS/

## Funcionalidades

- **Projetos**: status (Em espera, Em andamento, Em pausa, Concluído), coordenadores, prazo (atraso calculado pelo prazo), processo, contratante (nome e cidade), dados de convênio e arquivamento.
- **Dependências**: qualquer projeto, ramificação ou tarefa pode depender de outro projeto, ramificação ou tarefa (inclusive de outros projetos), com a condição "Concluído" ou "Iniciado". Itens bloqueados mostram o motivo e não podem avançar; dependências circulares são impedidas.
- **Estrutura**: ramificações em níveis ilimitados, vistas como
  - **Mapa**: canvas com cartões arrastáveis, conexões, pan, zoom (botões, Ctrl+roda e pinça) e posições salvas;
  - **Cartões**: navegação nível a nível, com caminho clicável.
- **Etapas**: o projeto abre no Kanban de etapas (arrastar com mouse ou toque); as tarefas ficam dentro de cada etapa, com checklist, comentários e anexos. A Estrutura (mapa e cartões) é só visualização. Cada tarefa pode ter vários colaboradores (usuários cadastrados).
- **Chat do projeto**: cada projeto tem uma aba Chat. Digitar `@` abre a lista de todos os usuários cadastrados para marcar, e `@todos` marca todo mundo. As mensagens que marcam você ficam destacadas, e a aba mostra quantas você ainda não viu. O autor apaga as próprias mensagens; o administrador apaga qualquer uma. Quem pode ver o projeto pode usar o chat.
- **Colaboradores**: acompanhamento administrativo do trabalho de cada colaborador — tarefas e etapas vinculadas, com o caminho no projeto (Projeto → Etapa → Tarefa), status, prazo, prioridade e o que está bloqueando.
- **Visões gerais**: Kanban de projetos, Hoje (atrasos e próximos marcos) e Histórico com filtros.
- **Configurações**: usuários, perfis e permissões por módulo e ação (ver abaixo).
- **Login local** (sem servidor) e atalhos de teclado: `Ctrl+K` ou `/` pesquisa, `N` novo, `T` tarefa, `R` ramificação, `K`/`S`/`C` trocam para Etapas, Estrutura e Chat.

## Tecnologias

| Camada | Escolha |
| --- | --- |
| Linguagem | TypeScript (modo estrito) |
| Interface | HTML + CSS + TypeScript, sem framework |
| Ícones | [Lucide](https://lucide.dev) (só os ícones usados entram no build) |
| Build | [Vite](https://vite.dev) — usado apenas em desenvolvimento e build |
| Dados | `localStorage` do navegador |
| Hospedagem | GitHub Pages, publicado por GitHub Actions |

## Desenvolvimento

Requer Node.js 20 ou mais recente.

```bash
npm install
npm run dev        # servidor local com recarga automática
npm run typecheck  # verificação de tipos
npm run build      # gera a versão final em dist/
npm run preview    # serve o conteúdo de dist/ localmente
```

O build usa caminhos relativos (`base: './'` em `vite.config.ts`), então o mesmo `dist/` funciona no GitHub Pages (`/RB-PROJETOS/`), em outro repositório ou em qualquer servidor estático.

## Publicação no GitHub Pages

O workflow `.github/workflows/deploy.yml` gera o build e publica a cada push na branch `main`.

Configuração única no repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Estrutura do projeto

```text
src/
├── main.ts              inicialização: dados, interface, login
├── app/                 navegação, ações globais e atalhos de teclado
├── types/               modelos: projeto, ramificação, tarefa, usuário, atividade
├── services/            regras e dados
│   ├── storage.ts       única porta de acesso ao localStorage
│   ├── migrations.ts    converte dados salvos por versões antigas
│   ├── db.ts            dados em memória e gravação
│   ├── permissionService.ts  hasPermission/can/authorize: verificação central de acesso
│   ├── profileService.ts     perfis e permissões (rb-access-v1)
│   └── *Service.ts      projetos, tarefas, ramificações, usuários, atividade, login
├── state/store.ts       estado da interface (o que está aberto e filtros)
├── components/          modal, diálogos, toast, ícones, avatar, filtros, arrastar
├── features/            telas: auth, projects, tasks, structure, collaborators,
│                        today, history, search, settings (usuários e perfis)
├── utils/               DOM, datas, formatação, ids, delegação de eventos
└── styles/              variáveis, base, componentes, telas e responsivo
```

### Como o código se organiza

- **Telas** geram HTML a partir dos dados e nunca gravam no navegador diretamente; elas chamam os **serviços**.
- **Serviços** alteram os dados, registram a atividade e pedem a gravação em `db.ts`, que usa `storage.ts`.
- **Eventos** usam delegação: elementos declaram `data-action="..."` e um único listener por tipo despacha para o módulo certo. Redesenhar uma tela não acumula listeners.

## Dados e compatibilidade

As chaves do navegador são as mesmas das versões anteriores:

| Chave | Conteúdo |
| --- | --- |
| `rb-projects-v1` | projetos, ramificações, tarefas, marcos, atividade e chat |
| `rb-users-v1` | usuários (com perfil, status, data de criação e senha em hash) |
| `rb-access-v1` | perfis e permissões |
| `rb-chat-seen-v1` | até onde cada usuário já leu o chat de cada projeto |
| `rb-projects-auth` | sessão: id do usuário logado |

Ao abrir, `migrations.ts` completa campos ausentes de dados antigos sem apagar nada. Se o conteúdo salvo estiver ilegível, uma cópia é guardada em `rb-projects-v1-backup` antes de usar o projeto de exemplo.

Os dados ficam no navegador de cada aparelho; não há sincronização entre dispositivos. Isso vale também para o chat: as mensagens só aparecem para quem usa o mesmo navegador.

## Usuários, perfis e permissões

Fluxo de acesso: **Usuário → Perfil → Permissões → Módulos e ações**.

- Cada usuário tem um perfil. Perfis iniciais: **Administrador** (acesso total, não pode ser excluído nem ter permissões reduzidas), **Gerente**, **Colaborador** e **Visualizador**. Todos podem ser editados em *Configurações → Perfis e permissões*, e novos perfis podem ser criados.
- Permissões por módulo: Projetos, Kanban/Etapas, Tarefas, Etapas e Estrutura, Mapa, Contratantes, Colaboradores, Usuários, Perfis e Configurações, com as ações **Visualizar, Criar, Editar e Excluir** quando fazem sentido para o módulo.
- A interface esconde o que o perfil não permite, e toda operação que grava dados passa por `authorize(módulo, ação)` em `services/permissionService.ts`.
- Sempre existe ao menos um administrador ativo: o último não pode ser excluído, desativado nem perder o perfil.
- Usuários desativados não conseguem entrar.
- Estrutura preparada para permissões por projeto (`projectRoles` em `rb-access-v1`), ainda sem interface.

> **Limitação importante:** o RB Projects roda inteiro no navegador (GitHub Pages). As permissões controlam a interface e a lógica do frontend, **não são segurança de servidor**. Quem tem acesso técnico ao navegador pode ler ou alterar os dados locais. Para segurança real é preciso uma API com autenticação e banco de dados; a camada `permissionService` já concentra as regras para facilitar essa evolução.
