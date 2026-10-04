/**
 * Peças das barras de filtro: busca, pílulas de seleção e pílula liga/desliga.
 * Cada controle declara `data-filter="grupo.campo"`; um único listener atualiza
 * o objeto de filtros correspondente e pede uma nova renderização.
 */
import { esc, refocus } from '../utils/dom';
import { icon } from './icons';

export type Option = readonly [value: string, label: string];

export function options(list: readonly Option[], selected: string, allLabel: string): string {
  return `<option value="">${esc(allLabel)}</option>${list
    .map(([v, l]) => `<option value="${esc(v)}" ${selected === v ? 'selected' : ''}>${esc(l)}</option>`)
    .join('')}`;
}

export function filterSelect(filter: string, label: string, list: readonly Option[], selected: string, allLabel: string): string {
  const current = selected ? (list.find(([v]) => v === selected)?.[1] ?? '') : '';
  return `<label class="fsel ${selected ? 'on' : ''}"><span>${esc(label)}</span><b>${esc(current)}</b><select data-filter="${filter}" aria-label="${esc(label)}">${options(
    list,
    selected,
    allLabel,
  )}</select></label>`;
}

export function filterSearch(filter: string, placeholder: string, value: string): string {
  return `<div class="fsearch">${icon('search')}<input data-filter="${filter}" id="f-${filter.replace('.', '-')}" type="search" placeholder="${esc(
    placeholder,
  )}" value="${esc(value)}" aria-label="${esc(placeholder)}" autocomplete="off"></div>`;
}

export function filterToggle(filter: string, label: string, on: boolean): string {
  return `<label class="ftog ${on ? 'on' : ''}"><input type="checkbox" data-filter="${filter}" ${on ? 'checked' : ''}>${esc(label)}</label>`;
}

export function clearButton(group: string): string {
  return `<button class="fclear" data-action="filter-clear" data-group="${group}">Limpar</button>`;
}

/** Atualiza o visual da pílula sem redesenhar a barra (mantém o foco). */
export function syncControl(el: HTMLInputElement | HTMLSelectElement): void {
  const wrap = el.closest('.fsel, .ftog');
  if (!wrap) return;
  if (el instanceof HTMLInputElement && el.type === 'checkbox') {
    wrap.classList.toggle('on', el.checked);
    return;
  }
  wrap.classList.toggle('on', !!el.value);
  const b = wrap.querySelector('b');
  if (b && el instanceof HTMLSelectElement) b.textContent = el.value ? (el.selectedOptions[0]?.text ?? '') : '';
}

interface FilterBinding {
  /** Objeto de filtros do grupo; os campos são alterados pelo nome em data-filter. */
  get: () => object;
  reset: () => void;
  render: () => void;
}

const groups = new Map<string, FilterBinding>();

export function registerFilterGroup(name: string, binding: FilterBinding): void {
  groups.set(name, binding);
}

function handle(el: HTMLInputElement | HTMLSelectElement): void {
  const [group, key] = (el.dataset.filter ?? '').split('.');
  const binding = group ? groups.get(group) : undefined;
  if (!binding || !key) return;
  const target = binding.get() as Record<string, unknown>;
  target[key] = el instanceof HTMLInputElement && el.type === 'checkbox' ? el.checked : el.value;
  syncControl(el);
  // Algumas telas redesenham a própria barra; nesse caso o campo de busca recupera o foco.
  const focusedId = document.activeElement === el && el.id ? el.id : '';
  binding.render();
  if (focusedId && document.activeElement?.id !== focusedId) refocus(`#${focusedId}`);
}

export function installFilters(): void {
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el instanceof HTMLInputElement && el.dataset.filter && el.type !== 'checkbox') handle(el);
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if ((el instanceof HTMLSelectElement || (el instanceof HTMLInputElement && el.type === 'checkbox')) && el.dataset.filter) handle(el);
  });
}

export function clearFilterGroup(name: string): void {
  const binding = groups.get(name);
  if (!binding) return;
  binding.reset();
  binding.render();
}
