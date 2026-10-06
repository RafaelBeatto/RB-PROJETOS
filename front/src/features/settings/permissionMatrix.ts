/** Tabela de permissões (módulos × ações), usada no editor de perfis e na visualização. */
import { icon } from '../../components/icons';
import { ACTION_LABELS, MODULE_KEYS, PERMISSION_ACTIONS, PERMISSION_MODULES, type PermissionAction, type PermissionModule, type PermissionSet } from '../../types/access';
import { $$, esc } from '../../utils/dom';

export function permissionMatrix(permissions: PermissionSet, editable: boolean): string {
  const head = PERMISSION_ACTIONS.map((a) => `<th>${ACTION_LABELS[a]}</th>`).join('');
  const rows = MODULE_KEYS.map((m) => {
    const def = PERMISSION_MODULES[m];
    const cells = PERMISSION_ACTIONS.map((a) => {
      if (!(def.actions as readonly PermissionAction[]).includes(a)) return '<td class="pm-na" aria-label="Não se aplica">–</td>';
      const on = permissions[m]?.includes(a) ?? false;
      const label = `${def.label}: ${ACTION_LABELS[a]}`;
      return editable
        ? `<td><input type="checkbox" class="pm-check" data-pm="${m}.${a}" ${on ? 'checked' : ''} aria-label="${esc(label)}"></td>`
        : `<td class="${on ? 'pm-yes' : 'pm-no'}" aria-label="${esc(label)}: ${on ? 'sim' : 'não'}">${on ? icon('check') : '–'}</td>`;
    }).join('');
    return `<tr><th scope="row">${def.label}${def.hint ? `<small>${esc(def.hint)}</small>` : ''}</th>${cells}</tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="pmatrix"><thead><tr><th>Módulo</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

/** Liga as regras de consistência: criar/editar/excluir exigem visualizar. */
export function bindMatrix(root: HTMLElement): void {
  root.addEventListener('change', (e) => {
    const box = e.target;
    if (!(box instanceof HTMLInputElement) || !box.dataset.pm) return;
    const [module, action] = box.dataset.pm.split('.') as [PermissionModule, PermissionAction];
    const rowBoxes = $$<HTMLInputElement>(`[data-pm^="${module}."]`, root);
    if (action === 'view' && !box.checked) rowBoxes.forEach((b) => (b.checked = false));
    if (action !== 'view' && box.checked) {
      const view = rowBoxes.find((b) => b.dataset.pm === `${module}.view`);
      if (view) view.checked = true;
    }
  });
}

export function readMatrix(root: HTMLElement): PermissionSet {
  const set: PermissionSet = {};
  for (const box of $$<HTMLInputElement>('[data-pm]', root)) {
    if (!box.checked) continue;
    const [module, action] = (box.dataset.pm ?? '').split('.') as [PermissionModule, PermissionAction];
    (set[module] ??= []).push(action);
  }
  return set;
}
