# Handoff: módulos que precisam ser revisados

As regras de negócio novas (hierarquia, status, permissões por função, dependências informativas, checklist, lixeira e busca) foram implementadas. O documento de regras **não cita** os módulos abaixo. Eles foram **mantidos**, só com os ajustes mínimos para funcionar com o modelo novo. Cada um precisa de uma decisão: manter como está, ajustar ou remover.

## Módulos mantidos sem regra definida

| Módulo | Onde | Como ficou | O que decidir |
| --- | --- | --- | --- |
| Contratantes | Configurações → Contratantes; campo no projeto | Igual à versão anterior. Acesso só pela matriz (módulo "Contratantes"). O perfil Coordenador **não** recebeu esse módulo. | Quem cadastra contratantes? O Coordenador deve ter acesso? |
| Convênio (processo, órgão, número, valores, origem do recurso) | Formulário e aba Informações do projeto | Igual. Quem edita o projeto edita o convênio. | Continua fazendo parte do projeto? |
| Marcos | Visão geral do projeto | Igual. Quem edita o projeto (Administrador e Coordenador) cria e edita marcos. | Continuam? Quem edita? |
| Chat do projeto | Aba Chat | Igual. Quem vê o projeto usa o chat; o autor apaga as próprias mensagens e o Administrador apaga qualquer uma. O Visualizador **pode escrever** no chat. | O Visualizador deve poder escrever? O Coordenador deve apagar mensagens? |
| Comentários e anexos (links) | Janela da tarefa | Quem edita a tarefa comenta e anexa. | Continuam? Quem pode? |
| Hoje | Menu Hoje | Mostra só os projetos que o usuário vê. | Continua? |
| Histórico | Menu Histórico e Visão geral | Mostra só os projetos que o usuário vê. Projetos na lixeira saem do histórico até serem restaurados. | Continua? |
| Colaboradores | Menu Colaboradores | Acesso pela matriz (módulo "Colaboradores"); o Coordenador recebeu. "Bloqueadas" virou "Em espera" (projeto ou etapa em espera/pausa), porque as dependências não bloqueiam mais. | Continua? Quem acessa? |
| Arquivados | Menu Arquivados | Agora é a lista de projetos **encerrados** (encerrar = arquivar). | O nome "Arquivados" serve, ou deve ser "Encerrados"? |
| Tags da tarefa | Só nos dados (`tags`) | Mantidas nos dados, sem tela (como já era). | Podem ser removidas? |

## Mudanças que removeram funcionalidade (autorizadas)

- **Subetapas, Mapa e Cartões**: removidos. As subetapas viraram etapas do projeto, com as mesmas tarefas.
- **Status "Concluído" do projeto**: removido. Encerrar = arquivar. Projetos concluídos viraram arquivados com status "Em análise".
- **Dependências de projeto, de etapa e entre projetos, e as condições Concluído/Iniciado**: removidas. Ficaram só tarefa → tarefa do mesmo projeto, informativas.
- **Módulos "Kanban" e "Mapa" da matriz de permissões**: removidos. Mudar o status pelo Kanban segue a regra de edição do item.
- **Status "Em revisão" de tarefa**: removido (virou "Em andamento").
- **Etapa acompanhando as tarefas automaticamente** (ex.: reabrir a etapa concluída quando uma tarefa era reaberta): removido, porque as regras dizem que a etapa é concluída livremente.

## Decisões tomadas durante a implementação (confirmar)

1. **Projeto "iniciar a execução"** = mudar para "Em andamento". Só esse status exige pelo menos uma etapa.
2. **Checklist**: além do responsável pela tarefa, o **Administrador** também edita (acesso completo). O Coordenador que não é responsável pela tarefa **não** edita. Um Visualizador escolhido como responsável também não edita (é somente leitura).
3. **Lixeira**:
   - Um item cujo "pai" também está na lixeira (ex.: tarefa excluída antes da etapa) só pode ser restaurado junto com o pai ou depois dele. A tela avisa o motivo.
   - Excluir permanentemente um item leva junto o que dependia dele na lixeira (ex.: as tarefas excluídas antes da etapa). A confirmação informa quantos.
   - Excluir uma etapa não exige permissão separada para as tarefas dela: quem pode excluir a etapa leva as tarefas junto.
   - Pessoas excluídas enquanto o item estava na lixeira não voltam como responsáveis.
4. **Mover tarefa para outra etapa** exige poder criar tarefas na etapa de destino.
5. **Perfis personalizados antigos**: receberam a função Responsável se a matriz permitia criar ou editar algo no trabalho; senão, Visualizador. A função pode ser trocada em Configurações → Perfis.
6. **Perfis padrão antigos**: "Gerente" virou "Coordenador" e ganhou usuários, lixeira e colaboradores; "Colaborador" virou "Responsável" e ganhou criar, editar e excluir em etapas, tarefas e subtarefas.
7. **Ordem de criação**: projetos novos agora entram no fim da lista. Os projetos já salvos estavam do mais novo para o mais antigo e continuam nessa ordem. A opção "Ordenar" do filtro (nome, prazo, progresso) foi mantida; o padrão é a ordem de criação.
8. **Foto do usuário**: guardada no navegador, reduzida para 160×160.
9. **Busca de pessoas**: encontra todos os usuários (inclusive inativos, marcados como tal). A ficha da pessoa mostra só os vínculos nos projetos que quem busca pode ver.
10. **Datas**: nenhuma validação (por exemplo, término antes do início é aceito), seguindo "não criar validações desnecessárias".
