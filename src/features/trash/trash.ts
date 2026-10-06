/**
 * Lixeira (Administrador e Coordenador): restaurar um ou vários itens,
 * excluir permanentemente e esvaziar. Exclusão permanente sempre pede confirmação.
 */
import { pageContent, refreshPage, registerPage, setFilterBar, setPageHeader } from '../../app/navigation';
import { confirmDanger } from '../../components/dialog';
import { icon } from '../../components/icons';
import { showToast } from '../../components/toast';
import { canPurge, canRestore } from '../../services/permissionService';
import { emptyTrash, entryContents, entryName, entryPath, kindLabel, purgeEntries, restoreBlock, restoreEntries, trashEntries, withDependents } from '../../services/trashService';
import { ui } from '../../state/store';
import type { TrashEntry } from '../../types/trash';
import { onClick } from '../../utils/actions';
import { dayLabel, formatTime } from '../../utils/date';
import { $$, esc, plural } from '../../utils/dom';

function row(e: TrashEntry): string {
  const checked = ui.trashSelection.has(e.id);
  const path = entryPath(e);
  const inside = entryContents(e);
  const block = restoreBlock(e);
  return `<label class="trash-row ${checked ? 'on' : ''}"><input type="checkbox" data-trash-pick="${e.id}" ${checked ? 'checked' : ''} aria-label="Selecionar ${esc(entryName(e))}"><div class="trash-body"><div><span class="hist-tag">${kindLabel(
    e.kind,
  )}</span> <b>${esc(entryName(e))}</b></div><small>${[path && `Em ${esc(path)}`, inside && `Com ${esc(inside)}`].filter(Boolean).join(' · ')}</small><small>Excluído por ${esc(e.deletedBy)} · ${dayLabel(
    e.deletedAt,
  )} ${formatTime(e.deletedAt)}</small>${block ? `<small class="warn-txt">${icon('warning')} ${esc(block)}</small>` : ''}</div></label>`;
}

function renderTrash(): void {
  const entries = trashEntries();
  // Remove da seleção o que não está mais na lixeira.
  for (const id of ui.trashSelection) if (!entries.some((e) => e.id === id)) ui.trashSelection.delete(id);
  const n = ui.trashSelection.size;
  setPageHeader('Lixeira', 'Itens excluídos. Restaure para devolver ao lugar original.', false);
  setFilterBar('trash', () => '');
  if (!entries.length) {
    pageContent().innerHTML = '<div class="empty">A lixeira está vazia.</div>';
    return;
  }
  const bar = `<div class="trash-bar"><label class="check-row"><input type="checkbox" data-trash-all ${n === entries.length ? 'checked' : ''}> ${
    n ? plural(n, 'item selecionado', 'itens selecionados') : 'Selecionar todos'
  }</label><span class="bd-actions">${
    canRestore() ? `<button class="ghost" data-action="trash-restore" ${n ? '' : 'disabled'}>${icon('reset')}Restaurar</button>` : ''
  }${canPurge() ? `<button class="danger" data-action="trash-purge" ${n ? '' : 'disabled'}>${icon('trash')}Excluir permanentemente</button><button class="ghost" data-action="trash-empty">Esvaziar lixeira</button>` : ''}</span></div>`;
  pageContent().innerHTML = `${bar}<div class="trash-list">${entries.map(row).join('')}</div>`;
  $$<HTMLInputElement>('[data-trash-pick]').forEach((box) =>
    box.addEventListener('change', () => {
      if (box.checked) ui.trashSelection.add(box.dataset.trashPick ?? '');
      else ui.trashSelection.delete(box.dataset.trashPick ?? '');
      renderTrash();
    }),
  );
  $$<HTMLInputElement>('[data-trash-all]').forEach((box) =>
    box.addEventListener('change', () => {
      ui.trashSelection = new Set(box.checked ? entries.map((e) => e.id) : []);
      renderTrash();
    }),
  );
}

function restoreSelected(): void {
  const { restored, skipped } = restoreEntries([...ui.trashSelection]);
  ui.trashSelection.clear();
  refreshPage();
  const extra = skipped.length ? ` · ${plural(skipped.length, 'item ficou', 'itens ficaram')} na lixeira (restaure antes o item que o contém)` : '';
  showToast(`${plural(restored, 'item restaurado', 'itens restaurados')}${extra}`);
}

async function purgeSelected(): Promise<void> {
  const ids = [...ui.trashSelection];
  const all = withDependents(ids);
  const extra = all.length - ids.length;
  const ok = await confirmDanger(
    `Excluir permanentemente ${plural(ids.length, 'item', 'itens')}?`,
    `${extra ? `Também ${plural(extra, 'item que estava dentro deles será apagado', 'itens que estavam dentro deles serão apagados')}. ` : ''}Esta ação não pode ser desfeita.`,
    'Excluir permanentemente',
  );
  if (!ok) return;
  const gone = purgeEntries(ids);
  ui.trashSelection.clear();
  refreshPage();
  showToast(`${plural(gone, 'item excluído', 'itens excluídos')} permanentemente`);
}

async function empty(): Promise<void> {
  const n = trashEntries().length;
  const ok = await confirmDanger('Esvaziar a lixeira?', `${plural(n, 'item será apagado', 'itens serão apagados')} permanentemente. Esta ação não pode ser desfeita.`, 'Esvaziar lixeira');
  if (!ok) return;
  emptyTrash();
  ui.trashSelection.clear();
  refreshPage();
  showToast('Lixeira esvaziada');
}

export function initTrash(): void {
  registerPage('trash', renderTrash);
  onClick('trash-restore', restoreSelected);
  onClick('trash-purge', () => void purgeSelected());
  onClick('trash-empty', () => void empty());
}
