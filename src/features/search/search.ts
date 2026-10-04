import { openProject } from '../../app/navigation';
import { closeModal, modalField, openModal } from '../../components/modal';
import { db } from '../../services/db';
import { agreementName, hasAgreement } from '../../services/projectService';
import { taskPeopleNames } from '../../services/userService';
import { onClick } from '../../utils/actions';
import { esc } from '../../utils/dom';

interface Result {
  projectId: string;
  kind: string;
  label: string;
}

function search(query: string): Result[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const results: Result[] = [];
  for (const p of db.projects) {
    if (p.name.toLowerCase().includes(q)) results.push({ projectId: p.id, kind: 'Projeto', label: p.name });
    if (p.processo && `processo ${p.processo}`.toLowerCase().includes(q)) results.push({ projectId: p.id, kind: 'Processo', label: `${p.processo} — ${p.name}` });
    if (hasAgreement(p) && `${agreementName(p)} ${p.convPolitico}`.toLowerCase().includes(q)) {
      results.push({ projectId: p.id, kind: 'Convênio', label: `${[agreementName(p), p.convPolitico].filter(Boolean).join(' · ')} — ${p.name}` });
    }
    for (const b of p.branches) if (b.name.toLowerCase().includes(q)) results.push({ projectId: p.id, kind: 'Etapa', label: b.name });
    for (const t of p.tasks) if (`${t.title} ${taskPeopleNames(t)}`.toLowerCase().includes(q)) results.push({ projectId: p.id, kind: 'Tarefa', label: t.title });
  }
  return results;
}

export function openSearch(): void {
  openModal(
    'Pesquisar',
    `<input id="globalSearch" class="field search-input" placeholder="Projetos, processos, convênios ou pessoas" aria-label="Pesquisar"><div class="search-results" id="results"></div>`,
  );
  const input = modalField<HTMLInputElement>('#globalSearch');
  const results = modalField<HTMLElement>('#results');
  input.addEventListener('input', () => {
    const found = search(input.value);
    results.innerHTML = !input.value.trim()
      ? ''
      : found.length
        ? found
            .map((r) => `<div class="result" data-action="search-open" data-id="${r.projectId}" tabindex="0"><strong>${esc(r.label)}</strong><small>${r.kind}</small></div>`)
            .join('')
        : '<div class="result">Nenhum resultado.</div>';
  });
  input.focus();
}

export function initSearch(): void {
  onClick('search', openSearch);
  onClick('search-open', (el) => {
    closeModal();
    openProject(el.dataset.id ?? '');
  });
}
