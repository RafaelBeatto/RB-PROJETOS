/** Configurações → Prefeituras: cadastro usado no formulário e no filtro de projetos. */
import { refresh } from '../../app/navigation';
import { askFields, confirmDanger } from '../../components/dialog';
import { icon } from '../../components/icons';
import { openMenu, type MenuItem } from '../../components/menu';
import { showToast } from '../../components/toast';
import { can } from '../../services/permissionService';
import {
  createPrefeitura,
  deletePrefeitura,
  findPrefeitura,
  projectsWithPrefeitura,
  sortedPrefeituras,
  updatePrefeitura,
  validatePrefeitura,
} from '../../services/prefeituraService';
import type { Prefeitura } from '../../types/prefeitura';
import { onClick } from '../../utils/actions';
import { esc, plural } from '../../utils/dom';

function row(p: Prefeitura): string {
  const used = projectsWithPrefeitura(p.id);
  return `<tr><td data-label="Prefeitura"><b>${esc(p.name)}</b>${p.uf ? `<small>${esc(p.uf)}</small>` : ''}</td><td data-label="Projetos">${
    used ? plural(used, 'projeto', 'projetos') : '—'
  }</td><td class="ta-r"><button class="ghost icon-only" data-action="pref-menu" data-id="${p.id}" aria-label="Ações de ${esc(p.name)}">${icon(
    'moreVertical',
  )}</button></td></tr>`;
}

export function renderPrefeiturasTab(): string {
  const list = sortedPrefeituras();
  const table = list.length
    ? `<div class="table-wrap"><table class="utable"><thead><tr><th>Prefeitura</th><th>Projetos</th><th class="ta-r">Ações</th></tr></thead><tbody>${list
        .map(row)
        .join('')}</tbody></table></div>`
    : '<div class="empty">Nenhuma prefeitura cadastrada ainda.</div>';
  const add = can('prefeituras', 'create') ? `<button class="primary" data-action="pref-new">${icon('plus')}<span>Nova prefeitura</span></button>` : '';
  return `<div class="settings-bar"><p class="sub">${plural(list.length, 'prefeitura', 'prefeituras')} · só o administrador cadastra; nos projetos elas são apenas escolhidas.</p>${add}</div>${table}`;
}

async function openForm(item?: Prefeitura): Promise<void> {
  const r = await askFields(item ? 'Editar prefeitura' : 'Nova prefeitura', [
    { label: 'Nome', value: item?.name ?? '', required: true },
    { label: 'Cidade / UF (opcional)', value: item?.uf ?? '' },
  ]);
  if (!r) return;
  const [name = '', uf = ''] = r;
  const error = validatePrefeitura(name, item);
  if (error) {
    showToast(error);
    return;
  }
  if (item) updatePrefeitura(item, name, uf);
  else createPrefeitura(name, uf);
  refresh();
  showToast(item ? 'Prefeitura salva' : 'Prefeitura cadastrada');
}

function menuFor(item: Prefeitura): MenuItem[] {
  const items: MenuItem[] = [];
  if (can('prefeituras', 'edit')) items.push({ label: 'Editar', icon: 'edit', run: () => void openForm(item) });
  if (can('prefeituras', 'delete')) {
    const used = projectsWithPrefeitura(item.id);
    items.push({
      label: 'Excluir',
      icon: 'trash',
      danger: true,
      disabledReason: used ? `Usada em ${plural(used, 'projeto', 'projetos')}. Troque a prefeitura desses projetos antes.` : null,
      run: async () => {
        if (!(await confirmDanger(`Excluir ${item.name}?`, 'A prefeitura deixa de aparecer no formulário e no filtro de projetos.'))) return;
        deletePrefeitura(item);
        refresh();
        showToast('Prefeitura excluída');
      },
    });
  }
  return items;
}

export function initPrefeiturasAdmin(): void {
  onClick('pref-new', () => void openForm());
  onClick('pref-menu', (el) => {
    const item = findPrefeitura(el.dataset.id);
    if (item) openMenu(el, menuFor(item));
  });
}
