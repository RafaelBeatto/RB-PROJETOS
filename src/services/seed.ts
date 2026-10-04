/** Projeto de exemplo exibido quando o navegador ainda não tem dados. */
export const SEED_PROJECTS = [
  {
    id: 'p1',
    name: 'Sistema APAE',
    description: 'Desenvolvimento do sistema de controle financeiro.',
    status: 'Em andamento',
    owner: 'Rafael',
    due: '2026-11-30',
    archived: false,
    branches: [
      { id: 'b1', name: 'Planejamento', parent: null },
      { id: 'b2', name: 'Desenvolvimento', parent: null },
      { id: 'b3', name: 'Backend', parent: 'b2' },
      { id: 'b4', name: 'Frontend', parent: 'b2' },
      { id: 'b5', name: 'Implantação', parent: null },
    ],
    tasks: [
      { id: 't1', title: 'Requisitos', status: 'Concluído', priority: 'Alta', assignee: 'Rafael', due: '2026-10-10', branch: 'b1', description: 'Mapear requisitos principais.' },
      { id: 't2', title: 'Documentação', status: 'Concluído', priority: 'Média', assignee: 'Rafael', due: '2026-10-12', branch: 'b1', description: 'Documentar o projeto.' },
      { id: 't3', title: 'Criar banco de dados', status: 'Em revisão', priority: 'Alta', assignee: 'Rafael', due: '2026-10-15', branch: 'b3', description: 'Criar a modelagem e as tabelas.', tags: 'backend', subtasks: [{ id: 's1', title: 'Criar tabelas', done: true }] },
      { id: 't4', title: 'Criar API', status: 'Em andamento', priority: 'Alta', assignee: 'Rafael', due: '2026-10-20', branch: 'b3', description: 'Implementar endpoints da API.', tags: 'backend', dependencies: ['t3'] },
      {
        id: 't5', title: 'Criar autenticação', status: 'A fazer', priority: 'Alta', assignee: 'Rafael', due: '2026-10-24', branch: 'b3', description: 'Implementar autenticação dos usuários.', tags: 'segurança', dependencies: ['t3'],
        subtasks: [{ id: 's2', title: 'Criar endpoint', done: false }, { id: 's3', title: 'Criar validação', done: false }],
      },
      { id: 't6', title: 'Criar login', status: 'A fazer', priority: 'Média', assignee: 'João', due: '2026-10-26', branch: 'b4', description: 'Criar fluxo de login.', tags: 'frontend', dependencies: ['t5'] },
      { id: 't7', title: 'Configurar servidor', status: 'A fazer', priority: 'Baixa', assignee: 'Rafael', due: '2026-11-18', branch: 'b5', description: 'Preparar ambiente de implantação.', tags: 'infra' },
    ],
  },
];
