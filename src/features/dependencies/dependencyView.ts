/** Indicadores de bloqueio: selo "Bloqueada" com os motivos e painel com o que falta cumprir. */
import { icon, type IconName } from '../../components/icons';
import { blockerText, blockersOf, conditionWord, dependentsOf, type Blocker } from '../../services/dependencyService';
import { KIND_LABELS, type DepKind, type ItemRef } from '../../types/dependency';
import { esc, plural } from '../../utils/dom';

export const KIND_ICONS: Record<DepKind, IconName> = { project: 'projects', branch: 'branch', task: 'done' };

/** Selo compacto para cartões e listas; os motivos aparecem ao passar o mouse. */
export function blockedBadge(ref: ItemRef, label = 'Bloqueada', blockers: Blocker[] = blockersOf(ref)): string {
  if (!blockers.length) return '';
  const title = blockers.map((b) => `• ${blockerText(b)}`).join('\n');
  return `<span class="status blocked" title="${esc(`Aguardando:\n${title}`)}">${icon('lock')}${esc(label)}</span>`;
}

/** Painel com cada condição pendente; vazio quando o item está liberado. */
export function blockersPanel(ref: ItemRef, title = 'Bloqueada', blockers: Blocker[] = blockersOf(ref)): string {
  if (!blockers.length) return '';
  const rows = blockers
    .map(
      (b) =>
        `<li><span class="blk-ico">${icon(KIND_ICONS[b.target.ref.kind])}</span><div>${KIND_LABELS[b.target.ref.kind]} <b>${esc(b.target.name)}</b> precisa estar <b class="blk-cond">${conditionWord(
          b.target.ref.kind,
          b.dep.condition,
        )}</b><small>${esc(b.detail)}${b.inherited ? ` · regra definida ${b.source.ref.kind === 'project' ? 'no projeto' : 'na ramificação'} “${esc(b.source.name)}”` : ''}</small></div></li>`,
    )
    .join('');
  return `<div class="blk" role="status"><div class="blk-head">${icon('lock')}<span>${esc(title)} — ${plural(
    blockers.length,
    'condição pendente',
    'condições pendentes',
  )}</span></div><ul>${rows}</ul></div>`;
}

/** "Libera: …" — itens que dependem diretamente deste. */
export function dependentsLine(ref: ItemRef): string {
  const list = dependentsOf(ref);
  if (!list.length) return '';
  return `<div class="blk-next">${icon('unlock')}<span>Ao cumprir, libera: ${list
    .map((x) => `<b>${esc(x.name)}</b>`)
    .join(', ')}</span></div>`;
}
