/**
 * Seletor de dependências (etapas e tarefas do mesmo projeto) usado nos formulários
 * da tarefa e da etapa, e o resumo "Depende de / Dependem deste".
 */
import { icon } from '../../components/icons';
import { dependencyItems, dependencyOptions, dependentItems, type DepItem, type DepOwner } from '../../services/dependencyService';
import type { Project } from '../../types/project';
import { $$, esc } from '../../utils/dom';
import { taskStatusClass } from '../../utils/format';

const statusClass = (x: DepItem): string => taskStatusClass(x.kind === 'branch' ? x.branch.status : x.task.status);

function optionsHtml(p: Project, owner: DepOwner, selected: Set<string>, editable: boolean): string {
  const opts = dependencyOptions(p, owner);
  if (!opts.length) return '<p class="sub flat small">Nenhuma outra etapa ou tarefa neste projeto.</p>';
  const row = ({ item, block }: (typeof opts)[number]): string => {
    const on = selected.has(item.id);
    // Um item já escolhido que ficou inválido continua visível para poder ser desmarcado.
    const disabled = !editable || (!!block && !on);
    const where = item.kind === 'task' ? (p.branches.find((b) => b.id === item.task.branch)?.name ?? 'Sem etapa') : 'Etapa';
    return `<label class="dep-opt${block && !on ? ' off' : ''}" data-dep-name="${esc(item.name.toLowerCase())}" ${block ? `title="${esc(block)}"` : ''}><input type="checkbox" name="dep" value="${item.id}" ${
      on ? 'checked' : ''
    } ${disabled ? 'disabled' : ''}><span>${icon(item.kind === 'branch' ? 'branch' : 'done')}${esc(item.name)}<small>${esc(where)} · ${esc(item.status)}${block ? ` · ${esc(block)}` : ''}</small></span></label>`;
  };
  const branches = opts.filter((o) => o.item.kind === 'branch');
  const tasks = opts.filter((o) => o.item.kind === 'task');
  return `${branches.length ? `<div class="dep-group"><div class="lbl">Etapas</div>${branches.map(row).join('')}</div>` : ''}${
    tasks.length ? `<div class="dep-group"><div class="lbl">Tarefas</div>${tasks.map(row).join('')}</div>` : ''
  }`;
}

/** Bloco recolhível com busca e as opções. */
export function depPickerHtml(p: Project, owner: DepOwner, selected: string[], editable: boolean): string {
  return `<details class="form-full deps-box" ${selected.length ? 'open' : ''}><summary>${icon('link')}Depende de <small>(etapas ou tarefas deste projeto · informativo: não impede iniciar nem concluir)</small></summary>${
    p.branches.length + p.tasks.length > 8 ? '<input class="field dep-search" type="search" placeholder="Buscar etapa ou tarefa" aria-label="Buscar dependência">' : ''
  }<div class="dep-pick" data-dep-pick>${optionsHtml(p, owner, new Set(selected), editable)}</div></details>`;
}

/** Liga a busca e redesenha as opções quando o dono muda (ex.: a tarefa trocou de etapa). */
export function bindDepPicker(root: HTMLElement, p: Project, owner: () => DepOwner, editable: boolean): { refresh: () => void } {
  const box = root.querySelector<HTMLElement>('[data-dep-pick]');
  const search = root.querySelector<HTMLInputElement>('.dep-search');
  const filter = (): void => {
    const q = (search?.value ?? '').trim().toLowerCase();
    $$('.dep-opt', box ?? root).forEach((el) => (el.hidden = !!q && !(el.dataset.depName ?? '').includes(q)));
  };
  search?.addEventListener('input', filter);
  return {
    refresh: () => {
      if (!box) return;
      const selected = new Set($$<HTMLInputElement>('input[name="dep"]:checked', box).map((i) => i.value));
      box.innerHTML = optionsHtml(p, owner(), selected, editable);
      filter();
    },
  };
}

/** "Depende de" e "Dependem deste", com o status de cada item. */
export function relationsHtml(p: Project, id: string, deps: string[]): string {
  const before = dependencyItems(p, deps);
  const after = dependentItems(p, id);
  if (!before.length && !after.length) return '';
  const chips = (items: DepItem[]): string =>
    items
      .map(
        (x) =>
          `<button type="button" class="chip dep-chip" ${x.kind === 'task' ? `data-goto-task="${x.id}"` : `data-goto-branch="${x.id}"`}>${icon(x.kind === 'branch' ? 'branch' : 'done')}${esc(
            x.name,
          )} <span class="status ${statusClass(x)}">${esc(x.status)}</span></button>`,
      )
      .join('');
  return `<div class="deps-view">${before.length ? `<div><span class="lbl">${icon('link')} Depende de</span>${chips(before)}</div>` : ''}${
    after.length ? `<div><span class="lbl">${icon('arrowRight')} Dependem deste</span>${chips(after)}</div>` : ''
  }</div>`;
}
