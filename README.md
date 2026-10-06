# RB Projects

Gerenciador de projetos simples e visual: Kanban de projetos, etapas e tarefas, com subtarefas, checklist, dependências, lixeira e histórico.

A aplicação é 100% estática. Não há servidor, banco de dados nem API: os dados ficam no navegador de cada pessoa (`localStorage`). O site publicado é só HTML, CSS e JavaScript.

**Online:** https://rafaelbeatto.github.io/RB-PROJETOS/

## Funcionalidades

Hierarquia: **Projeto → Etapas → Tarefas → Subtarefas**. Os quatro níveis têm nome (obrigatório), descrição, prioridade (Baixa, Média, Alta, Urgente) e datas de início e de término, todos opcionais. A ordem é sempre a de criação (não há ordenação manual); o Kanban organiza por status.

- **Projetos** (tela inicial em Kanban): Em espera, Em pausa, Em andamento, Em análise. Vários coordenadores (opcionais). Para ir para "Em andamento" o projeto precisa de pelo menos uma etapa. Encerrar = arquivar, sem exigir etapas concluídas. Progresso = etapas concluídas ÷ etapas.
- **Etapas** (Kanban dentro do projeto): Em espera, Em pausa, Em andamento, Concluído. Até 2 responsáveis. Podem ser concluídas livremente. Progresso = tarefas concluídas ÷ tarefas ("Em andamento" não conta).
- **Tarefas** (Kanban dentro da etapa): A fazer, Em andamento, Concluído. Até 2 responsáveis. Podem ser concluídas livremente (subtarefas e checklist não impedem).
- **Subtarefas**: A fazer, Em andamento, Concluído. Não têm responsável próprio: mostram sempre os responsáveis atuais da tarefa.
- **Dependências**: uma tarefa pode depender de outras tarefas do mesmo projeto. São só informativas (aparecem no cartão e na tarefa) e não impedem iniciar nem concluir.
- **Checklist** da tarefa: itens com texto e marcado/desmarcado. Só o responsável pela tarefa (e o Administrador) cria, edita, marca e exclui itens.
- **Lixeira**: excluir sempre pede confirmação e envia para a lixeira com o que está dentro (projeto → etapas, tarefas e subtarefas; etapa → tarefas e subtarefas; tarefa → subtarefas). Restaurar um ou vários itens, excluir permanentemente (com confirmação) e esvaziar. Um item cujo "pai" também está na lixeira volta junto com ele ou depois dele.
- **Busca geral** (`Ctrl+K` ou `/`): projetos, etapas, tarefas, subtarefas e pessoas, só nos projetos que o usuário pode ver.
- Mantidos da versão anterior: **chat do projeto** (com `@` e `@todos`), **marcos**, **convênio e contratante**, **comentários e anexos** nas tarefas, **Hoje**, **Histórico**, **Colaboradores** e **Arquivados**. Ver `docs/HANDOFF.md`.
- **Login local** (sem servidor) e atalhos: `N` novo (projeto; dentro do projeto, etapa; dentro da etapa, tarefa), `T` tarefa, `R` etapa, `K`/`C` trocam para Etapas e Chat.

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
├── types/               modelos: projeto, etapa, tarefa, usuário, lixeira, atividade
├── services/            regras e dados
│   ├── storage.ts       única porta de acesso ao localStorage
│   ├── migrations.ts    converte dados salvos por versões antigas
│   ├── db.ts            dados em memória e gravação
│   ├── permissionService.ts  regras de acesso: função do perfil + matriz de permissões
│   ├── profileService.ts     perfis e permissões (rb-access-v1)
│   ├── trashService.ts       lixeira (enviar, restaurar, excluir permanentemente)
│   └── *Service.ts      projetos, etapas, tarefas, usuários, atividade, login
├── state/store.ts       estado da interface (o que está aberto e filtros)
├── components/          modal, diálogos, toast, ícones, avatar, filtros, arrastar
├── features/            telas: auth, projects, structure (etapas), tasks, trash,
│                        collaborators, today, history, search, settings
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
| `rb-projects-v1` | projetos, etapas, tarefas, marcos, atividade e chat |
| `rb-users-v1` | usuários (com perfil, status, data de criação e senha em hash) |
| `rb-access-v1` | perfis e permissões |
| `rb-chat-seen-v1` | até onde cada usuário já leu o chat de cada projeto |
| `rb-trash-v1` | lixeira (itens excluídos com o que estava dentro deles) |
| `rb-projects-v1-antes-das-regras` | cópia dos projetos como estavam antes da conversão para as regras atuais |
| `rb-projects-auth` | sessão: id do usuário logado |

Ao abrir, `migrations.ts` converte dados antigos: projeto "Concluído" vira arquivado (status "Em análise"); subetapas viram etapas do projeto; "Em revisão" vira "Em andamento"; etapa "A fazer" vira "Em espera"; o antigo checklist (guardado em `subtasks`) passa para `checklist`; ficam só as dependências de tarefa para tarefa do mesmo projeto; responsáveis de etapa e tarefa ficam limitados a 2. Antes da primeira conversão, uma cópia dos projetos originais é guardada em `rb-projects-v1-antes-das-regras`. Se o conteúdo salvo estiver ilegível, uma cópia é guardada em `rb-projects-v1-backup` antes de usar o projeto de exemplo.

Os dados ficam no navegador de cada aparelho; não há sincronização entre dispositivos. Isso vale também para o chat: as mensagens só aparecem para quem usa o mesmo navegador.

## Usuários, perfis e permissões

Usuário: nome, foto, e-mail, telefone, cargo, ativo/inativo e perfil. Desativado perde o acesso, mas continua no histórico e nos vínculos. Excluído sai dos projetos, etapas e tarefas, que ficam sem ele (nada é transferido).

Cada **perfil** tem uma **função** e uma **matriz de permissões** (editável em *Configurações → Perfis e permissões*). Uma ação só é liberada quando as duas permitem.

| Função | O que pode |
| --- | --- |
| Administrador | Tudo, inclusive perfis e permissões. |
| Coordenador | Criar e editar projetos, etapas, tarefas e subtarefas; gerenciar usuários (inclusive torná-los Administrador); lixeira. |
| Responsável | Criar e editar etapas; criar e editar tarefas nas etapas em que é responsável; editar as tarefas em que é responsável; criar e editar subtarefas nas tarefas em que é responsável. Sem lixeira e sem usuários. |
| Visualizador | Somente leitura. Administrador e Coordenador podem limitar o acesso dele a projetos específicos. |

- Quem edita um item também pode excluí-lo e alterar status, prioridade, datas, descrição e responsáveis.
- Todos os usuários ativos veem todos os projetos, exceto o Visualizador com acesso limitado.
- Sempre existe ao menos um administrador ativo: o último não pode ser excluído, desativado nem perder o perfil.
- Toda operação que grava dados passa pelas regras de `services/permissionService.ts`.

> **Limitação importante:** o RB Projects roda inteiro no navegador (GitHub Pages). As permissões controlam a interface e a lógica do frontend, **não são segurança de servidor**. Quem tem acesso técnico ao navegador pode ler ou alterar os dados locais. Para segurança real é preciso uma API com autenticação e banco de dados; a camada `permissionService` já concentra as regras para facilitar essa evolução.
