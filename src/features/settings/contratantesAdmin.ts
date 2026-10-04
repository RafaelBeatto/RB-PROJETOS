/** Configurações → Contratantes: cadastro usado no formulário e no filtro de projetos. */
import { refresh } from '../../app/navigation';
import { askFields, confirmDanger } from '../../components/dialog';
import { icon } from '../../components/icons';
import { openMenu, type MenuItem } from '../../components/menu';
import { showToast } from '../../components/toast';
import { can } from '../../services/permissionService';
import {
  createContratante,
  deleteContratante,
  findContratante,
  projectsWithContratante,
  sortedContratantes,
  updateContratante,
  validateContratante,
} from '../../services/contratanteService';
import type { Contratante } from '../../types/contratante';
import { onClick } from '../../utils/actions';
import { esc, plural } from '../../utils/dom';

function row(p: Contratante): string {
  const used = projectsWithContratante(p.id);
  return `<tr><td data-label="Contratante"><b>${esc(p.name)}</b></td><td data-label="Cidade">${esc(p.cidade || '—')}</td><td data-label="Projetos">${
    used ? plural(used, 'projeto', 'projetos') : '—'
  }</td><td class="ta-r"><button class="ghost icon-only" data-action="contratante-menu" data-id="${p.id}" aria-label="Ações de ${esc(p.name)}">${icon(
    'moreVertical',
  )}</button></td></tr>`;
}

export function renderContratantesTab(): string {
  const list = sortedContratantes();
  const table = list.length
    ? `<div class="table-wrap"><table class="utable"><thead><tr><th>Contratante</th><th>Cidade</th><th>Projetos</th><th class="ta-r">Ações</th></tr></thead><tbody>${list
        .map(row)
        .join('')}</tbody></table></div>`
    : '<div class="empty">Nenhuma contratante cadastrada ainda.</div>';
  const add = can('contratantes', 'create') ? `<button class="primary" data-action="contratante-new">${icon('plus')}<span>Nova contratante</span></button>` : '';
  return `<div class="settings-bar"><p class="sub">${plural(list.length, 'contratante', 'contratantes')} · só o administrador cadastra; nos projetos elas são apenas escolhidas.</p>${add}</div>${table}`;
}

async function openForm(item?: Contratante): Promise<void> {
  const r = await askFields(item ? 'Editar contratante' : 'Nova contratante', [
    { label: 'Nome', value: item?.name ?? '', required: true },
    { label: 'Cidade', value: item?.cidade ?? '', required: true },
  ]);
  if (!r) return;
  const [name = '', cidade = ''] = r;
  const error = validateContratante(name, cidade, item);
  if (error) {
    showToast(error);
    return;
  }
  if (item) updateContratante(item, name, cidade);
  else createContratante(name, cidade);
  refresh();
  showToast(item ? 'Contratante salva' : 'Contratante cadastrada');
}

function menuFor(item: Contratante): MenuItem[] {
  const items: MenuItem[] = [];
  if (can('contratantes', 'edit')) items.push({ label: 'Editar', icon: 'edit', run: () => void openForm(item) });
  if (can('contratantes', 'delete')) {
    const used = projectsWithContratante(item.id);
    items.push({
      label: 'Excluir',
      icon: 'trash',
      danger: true,
      disabledReason: used ? `Usada em ${plural(used, 'projeto', 'projetos')}. Troque a contratante desses projetos antes.` : null,
      run: async () => {
        if (!(await confirmDanger(`Excluir ${item.name}?`, 'A contratante deixa de aparecer no formulário e no filtro de projetos.'))) return;
        deleteContratante(item);
        refresh();
        showToast('Contratante excluída');
      },
    });
  }
  return items;
}

export function initContratantesAdmin(): void {
  onClick('contratante-new', () => void openForm());
  onClick('contratante-menu', (el) => {
    const item = findContratante(el.dataset.id);
    if (item) openMenu(el, menuFor(item));
  });
}
