# RB Projects

Gerenciador de projetos simples e visual: estrutura do projeto em mapa e cartões, Kanban, tarefas com checklist, marcos e histórico.

A aplicação é 100% estática. Não há servidor, banco de dados nem API: os dados ficam no navegador de cada pessoa (`localStorage`). O site publicado é só HTML, CSS e JavaScript.

**Online:** https://rafaelbeatto.github.io/RB-PROJETOS/

## Funcionalidades

- **Projetos**: status, responsável, coordenadores, prazo, processo, dados de convênio, progresso automático e arquivamento.
- **Estrutura**: ramificações em níveis ilimitados, vistas como
  - **Mapa**: canvas com cartões arrastáveis, conexões, pan, zoom (botões, Ctrl+roda e pinça) e posições salvas;
  - **Cartões**: navegação nível a nível, com caminho clicável.
- **Tarefas**: Kanban (arrastar com mouse ou toque), lista, timeline, checklist, dependências, comentários e anexos.
- **Visões gerais**: Kanban de projetos, Hoje (atrasos e próximos marcos), Usuários e Histórico com filtros.
- **Login local** (sem servidor) e atalhos de teclado: `Ctrl+K` ou `/` pesquisa, `N` novo, `T` tarefa, `R` ramificação, `K`/`L`/`S` trocam de aba.

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
│   └── *Service.ts      projetos, tarefas, ramificações, usuários, atividade, login
├── state/store.ts       estado da interface (o que está aberto e filtros)
├── components/          modal, diálogos, toast, ícones, avatar, filtros, arrastar
├── features/            telas: auth, projects, tasks, structure, timeline,
│                        today, history, users, search, settings
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
| `rb-projects-v1` | projetos, ramificações, tarefas, marcos e atividade |
| `rb-users-v1` | usuários |
| `rb-projects-auth` | sessão do login |
| `rb-me` | nome usado em comentários e na atividade |

Ao abrir, `migrations.ts` completa campos ausentes de dados antigos sem apagar nada. Se o conteúdo salvo estiver ilegível, uma cópia é guardada em `rb-projects-v1-backup` antes de usar o projeto de exemplo.

Os dados ficam no navegador de cada aparelho; não há sincronização entre dispositivos.
