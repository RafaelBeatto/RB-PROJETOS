/**
 * Seção "Dependências" dos formulários (tarefa, etapa e projeto) e o explorador
 * para escolher os itens: projetos → etapas → tarefas, com busca e expandir/recolher.
 * As escolhas ficam no formulário até salvar; as regras (ciclos, bloqueio) são
 * conferidas de novo pelos serviços na gravação.
 */
import { icon } from '../../components/icons';
import { db } from '../../services/db';
import {
  dependencyState,
  depRef,
  forbiddenTargets,
  itemPath,
  refKey,
  type OwnerDraft,
} from '../../services/dependencyService';
import type { Branch } from '../../types/branch';
import { CONDITION_LABELS, DEP_CONDITIONS, KIND_LABELS, type DepCondition, type Dependency, type ItemRef } from '../../types/dependency';
import type { Project } from '../../types/project';
import type { Task } from '../../types/task';
import { esc, plural } from '../../utils/dom';
import { uid } from '../../utils/ids';
import { KIND_ICONS } from './dependencyView';

export type OwnerContext = () => Omit<OwnerDraft, 'dependencies'>;

// Lista de dependências no formulário

function rowHtml(dep: Dependency, editable: boolean): string {
  const state = dependencyState(dep);
  const target = state.target;
  const cls = state.invalid ? 'invalid' : state.met ? 'met' : 'pending';
  const badge = state.invalid
    ? `<span class="dep-state invalid">${icon('warning')}Item excluído — não bloqueia mais</span>`
    : state.met
      ? `<span class="dep-state met">${icon('check')}Condição atendida · ${esc(state.detail)}</span>`
      : `<span class="dep-state pending">${icon('lock')}Pendente · ${esc(state.detail)}</span>`;
  const path = target ? itemPath(target) : '';
  const cond = DEP_CONDITIONS.map(
    (c) =>
      `<button type="button" class="${dep.condition === c ? 'on' : ''}" data-dep-cond="${dep.id}|${c}" aria-pressed="${dep.condition === c}" ${
        editable && !state.invalid ? '' : 'disabled'
      }>${CONDITION_LABELS[c]}</button>`,
  ).join('');
  return `<div class="dep-row ${cls}"><span class="dep-ico">${icon(KIND_ICONS[dep.kind])}</span><div class="dep-main"><b>${esc(
    target?.name ?? 'Item removido',
  )}</b><small>${KIND_LABELS[dep.kind]}${path ? ` · ${esc(path)}` : ''}</small>${badge}</div><div class="dep-side"><div class="seg dep-cond" role="group" aria-label="Condição">${cond}</div>${
    editable ? `<button type="button" class="dep-x" data-dep-del="${dep.id}" aria-label="Remover dependência">${icon('close')}</button>` : ''
  }</div></div>`;
}

/** Lista somente leitura (aba Informações). */
export function dependencyListHtml(deps: Dependency[]): string {
  return `<div class="dep-list">${deps.map((d) => rowHtml(d, false)).join('') || '<div class="dep-empty">Nenhuma dependência configurada.</div>'}</div>`;
}

export function dependencySection(): string {
  return '<div class="sec deps" id="depEditor"></div>';
}

export interface DependencyEditor {
  value: () => Dependency[];
}

export function mountDependencyEditor(root: HTMLElement, owner: OwnerContext, initial: Dependency[], editable: boolean, intro: string): DependencyEditor {
  let deps = initial.map((d) => ({ ...d }));
  const render = (): void => {
    const pending = deps.filter((d) => {
      const s = dependencyState(d);
      return !s.invalid && !s.met;
    }).length;
    const summary = deps.length
      ? `${plural(deps.length, 'dependência', 'dependências')}${pending ? ` · <span class="late-txt">${plural(pending, 'pendente', 'pendentes')}</span>` : ' · todas atendidas'}`
      : '';
    root.innerHTML = `<div class="sec-head dep-head"><h3>Dependências</h3><span class="sub flat">${summary}</span>${
      editable ? `<button type="button" class="ghost" data-dep-add>${icon('plus')}Adicionar</button>` : ''
    }</div><p class="sub flat dep-intro">${esc(intro)}</p><div class="dep-list">${
      deps.map((d) => rowHtml(d, editable)).join('') || '<div class="dep-empty">Nenhuma dependência: pode começar a qualquer momento.</div>'
    }</div>`;
  };
  root.addEventListener('click', async (e) => {
    const target = e.target as Element;
    const cond = target.closest<HTMLElement>('[data-dep-cond]');
    if (cond) {
      const [id, c] = (cond.dataset.depCond ?? '').split('|');
      const dep = deps.find((d) => d.id === id);
      if (dep && DEP_CONDITIONS.includes(c as DepCondition)) dep.condition = c as DepCondition;
      render();
      return;
    }
    const del = target.closest<HTMLElement>('[data-dep-del]');
    if (del) {
      deps = deps.filter((d) => d.id !== del.dataset.depDel);
      render();
      return;
    }
    if (!target.closest('[data-dep-add]')) return;
    const chosen = await openDependencyPicker(owner(), deps);
    if (!chosen) return;
    const byKey = new Map(deps.map((d) => [refKey(depRef(d)), d]));
    deps = chosen.map(
      (ref) => byKey.get(refKey(ref)) ?? { id: uid('d'), kind: ref.kind, projectId: ref.projectId, targetId: ref.id, condition: 'done' as DepCondition },
    );
    render();
  });
  render();
  return { value: () => deps.map((d) => ({ ...d })) };
}

// Explorador

interface TreeNode {
  ref: ItemRef;
  key: string;
  name: string;
  meta: string;
  children: TreeNode[];
}

function taskNode(p: Project, t: Task): TreeNode {
  const ref: ItemRef = { kind: 'task', projectId: p.id, id: t.id };
  return { ref, key: refKey(ref), name: t.title, meta: t.status, children: [] };
}

function branchNode(p: Project, b: Branch, seen: Set<string>): TreeNode {
  seen.add(b.id);
  const ref: ItemRef = { kind: 'branch', projectId: p.id, id: b.id };
  const kids = p.branches.filter((x) => x.parent === b.id && !seen.has(x.id)).map((x) => branchNode(p, x, seen));
  const tasks = p.tasks.filter((t) => t.branch === b.id).map((t) => taskNode(p, t));
  const detail = dependencyState({ id: '', kind: 'branch', projectId: p.id, targetId: b.id, condition: 'done' }).detail;
  return { ref, key: refKey(ref), name: b.name, meta: detail, children: [...kids, ...tasks] };
}

function projectNode(p: Project): TreeNode {
  const ref: ItemRef = { kind: 'project', projectId: p.id, id: p.id };
  const seen = new Set<string>();
  const roots = p.branches.filter((b) => !b.parent || !p.branches.some((x) => x.id === b.parent));
  const branches = roots.map((b) => branchNode(p, b, seen));
  const loose = p.tasks.filter((t) => !t.branch || !p.branches.some((b) => b.id === t.branch)).map((t) => taskNode(p, t));
  return { ref, key: refKey(ref), name: p.name, meta: `${p.status}${p.archived ? ' · arquivado' : ''} · ${plural(p.tasks.length, 'tarefa', 'tarefas')}`, children: [...branches, ...loose] };
}

function buildTree(currentProjectId: string): TreeNode[] {
  const order = (p: Project): number => (p.id === currentProjectId ? 0 : p.archived ? 2 : 1);
  return [...db.projects].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name, 'pt-BR')).map(projectNode);
}

/** Abre o explorador; devolve a seleção final (ou null se cancelar). */
export function openDependencyPicker(owner: Omit<OwnerDraft, 'dependencies'>, current: Dependency[]): Promise<ItemRef[] | null> {
  const tree = buildTree(owner.ref.projectId);
  const forbidden = forbiddenTargets({ ...owner, dependencies: [] });
  const selected = new Map<string, ItemRef>(current.map((d) => [refKey(depRef(d)), depRef(d)]));
  const expanded = new Set<string>(tree.filter((n) => n.ref.projectId === owner.ref.projectId).map((n) => n.key));
  // Abre o caminho até os itens já escolhidos.
  const openPathTo = (nodes: TreeNode[], trail: string[]): void => {
    for (const n of nodes) {
      if (selected.has(n.key)) trail.forEach((k) => expanded.add(k));
      openPathTo(n.children, [...trail, n.key]);
    }
  };
  openPathTo(tree, []);
  let query = '';

  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap ask-wrap';
    wrap.innerHTML = `<div class="modal dep-picker" role="dialog" aria-modal="true" aria-label="Escolher dependências"><div class="modal-head"><h2>Escolher dependências</h2><button class="close" data-pick-cancel aria-label="Fechar">${icon(
      'close',
    )}</button></div><p class="sub flat">Navegue pelos projetos, etapas e tarefas e marque o que precisa acontecer antes. Projeto e etapa contam com todas as tarefas dentro deles.</p><div class="fsearch dt-search">${icon(
      'search',
    )}<input type="search" placeholder="Buscar projeto, etapa ou tarefa" aria-label="Buscar" autocomplete="off"></div><div class="dtree" role="tree"></div><div class="modal-actions dt-foot"><span class="sub flat" data-pick-count></span><div class="dt-buttons"><button type="button" class="ghost" data-pick-cancel>Cancelar</button><button type="button" class="primary" data-pick-ok>Aplicar</button></div></div></div>`;
    document.body.appendChild(wrap);
    const treeEl = wrap.querySelector<HTMLElement>('.dtree')!;
    const search = wrap.querySelector<HTMLInputElement>('input')!;

    const matches = (n: TreeNode): boolean => !query || n.name.toLowerCase().includes(query);
    const hasMatch = (n: TreeNode): boolean => matches(n) || n.children.some(hasMatch);

    const rowHtmlFor = (n: TreeNode, level: number): string => {
      if (!hasMatch(n)) return '';
      const childMatch = !!query && n.children.some(hasMatch);
      const open = expanded.has(n.key) || childMatch;
      const isSel = selected.has(n.key);
      const self = n.key === refKey(owner.ref);
      const blocked = forbidden.has(n.key);
      const reason = self ? 'É o próprio item' : blocked ? 'Criaria dependência circular' : '';
      const chevron = n.children.length
        ? `<button type="button" class="dt-tog" data-tog="${esc(n.key)}" aria-label="${open ? 'Recolher' : 'Expandir'} ${esc(n.name)}" aria-expanded="${open}">${icon(
            open ? 'chevronDown' : 'chevronRight',
          )}</button>`
        : '<span class="dt-tog-sp"></span>';
      const row = `<div class="dt-row ${isSel ? 'sel' : ''} ${blocked && !isSel ? 'off' : ''} ${matches(n) && query ? 'hit' : ''}" role="treeitem" aria-selected="${isSel}" style="--lvl:${level}">${chevron}<button type="button" class="dt-pick" data-pick="${esc(
        n.key,
      )}" ${blocked && !isSel ? `disabled title="${reason}"` : ''}><span class="dt-box">${icon(isSel ? 'selectOn' : 'selectOff')}</span><span class="dt-ico">${icon(
        KIND_ICONS[n.ref.kind],
      )}</span><span class="dt-name"><b>${esc(n.name)}</b><small>${esc(KIND_LABELS[n.ref.kind])}${n.meta ? ` · ${esc(n.meta)}` : ''}${reason ? ` · ${reason}` : ''}</small></span></button></div>`;
      const kids = open ? n.children.map((c) => rowHtmlFor(c, level + 1)).join('') : '';
      return row + kids;
    };

    const nodeByKey = new Map<string, TreeNode>();
    const index = (nodes: TreeNode[]): void => nodes.forEach((n) => (nodeByKey.set(n.key, n), index(n.children)));
    index(tree);

    const render = (): void => {
      const scroll = treeEl.scrollTop;
      const html = tree.map((n) => rowHtmlFor(n, 0)).join('');
      treeEl.innerHTML = html || '<div class="dep-empty">Nada encontrado.</div>';
      treeEl.scrollTop = scroll;
      const names = [...selected.keys()].map((k) => nodeByKey.get(k)?.name).filter(Boolean);
      wrap.querySelector('[data-pick-count]')!.textContent = names.length ? `${plural(names.length, 'item selecionado', 'itens selecionados')}` : 'Nenhum item selecionado';
    };

    const finish = (value: ItemRef[] | null): void => {
      wrap.remove();
      resolve(value);
    };
    wrap.addEventListener('click', (e) => {
      const target = e.target as Element;
      if (e.target === wrap || target.closest('[data-pick-cancel]')) return finish(null);
      if (target.closest('[data-pick-ok]')) return finish([...selected.values()]);
      const tog = target.closest<HTMLElement>('[data-tog]');
      if (tog?.dataset.tog) {
        const key = tog.dataset.tog;
        if (expanded.has(key)) expanded.delete(key);
        else expanded.add(key);
        render();
        return;
      }
      const pick = target.closest<HTMLButtonElement>('[data-pick]');
      const node = pick?.dataset.pick ? nodeByKey.get(pick.dataset.pick) : undefined;
      if (!node || pick?.disabled) return;
      if (selected.has(node.key)) selected.delete(node.key);
      else selected.set(node.key, node.ref);
      render();
    });
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        finish(null);
      }
    });
    search.addEventListener('input', () => {
      query = search.value.trim().toLowerCase();
      render();
    });
    render();
    search.focus();
  });
}
