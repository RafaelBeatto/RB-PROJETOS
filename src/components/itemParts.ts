/**
 * Peças comuns a projeto, etapa, tarefa e subtarefa: prioridade, datas,
 * responsáveis e os campos de formulário que os quatro níveis compartilham.
 */
import { findUser } from '../services/userService';
import { PRIORITIES, type OptionalPriority } from '../types/task';
import type { User } from '../types/user';
import { formatShortDate, today } from '../utils/date';
import { esc } from '../utils/dom';
import { priorityClass } from '../utils/format';
import { avatar } from './avatar';

/** Etiqueta de prioridade; vazio quando não há prioridade. */
export function priorityBadge(priority: OptionalPriority): string {
  return priority ? `<span class="prio ${priorityClass(priority)}" title="Prioridade ${esc(priority.toLowerCase())}">${esc(priority)}</span>` : '';
}

/** "01/10 → 15/10"; a data de término fica em vermelho se passou e o item não está concluído. */
export function datesBadge(start: string, due: string, done: boolean): string {
  if (!start && !due) return '';
  const late = !done && !!due && due < today();
  const text = start && due ? `${formatShortDate(start)} → ${formatShortDate(due)}` : start ? `Início ${formatShortDate(start)}` : `Até ${formatShortDate(due)}`;
  return `<span class="dates${late ? ' late-txt' : ''}" title="${late ? 'Data de término vencida' : 'Datas'}">${esc(text)}</span>`;
}

export function usersOf(ids: string[]): User[] {
  return ids.map((id) => findUser(id)).filter((u): u is User => !!u);
}

/** Avatares e nomes dos responsáveis; `empty` quando não há ninguém. */
export function peopleLine(ids: string[], empty = 'Sem responsável'): string {
  const users = usersOf(ids);
  if (!users.length) return `<span class="sub flat">${esc(empty)}</span>`;
  return users.map((u) => `<span class="who">${avatar(u, true)}<span>${esc(u.name)}</span></span>`).join('');
}

function priorityOptions(selected: OptionalPriority): string {
  return `<option value="" ${selected ? '' : 'selected'}>Sem prioridade</option>${PRIORITIES.map((p) => `<option ${p === selected ? 'selected' : ''}>${p}</option>`).join('')}`;
}

export function statusSelect(statuses: readonly string[], selected: string): string {
  return `<label>Status<select class="field" name="status">${statuses.map((s) => `<option ${s === selected ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>`;
}

export interface CommonValues {
  priority: OptionalPriority;
  start: string;
  due: string;
  description: string;
}

/** Prioridade, datas de início e término e descrição: todos opcionais. */
export function commonFields(v: Partial<CommonValues> = {}): string {
  return `<label>Prioridade<select class="field" name="priority">${priorityOptions(v.priority ?? '')}</select></label><label>Data de início<input class="field" type="date" name="start" value="${esc(
    v.start ?? '',
  )}"></label><label>Data de término<input class="field" type="date" name="due" value="${esc(v.due ?? '')}"></label><div class="form-full"><label>Descrição<textarea class="field" name="description" placeholder="Opcional">${esc(
    v.description ?? '',
  )}</textarea></label></div>`;
}

export function readCommon(data: FormData): CommonValues {
  const text = (name: string): string => String(data.get(name) ?? '').trim();
  const priority = text('priority') as OptionalPriority;
  return {
    priority: (PRIORITIES as readonly string[]).includes(priority) ? priority : '',
    start: text('start'),
    due: text('due'),
    description: text('description'),
  };
}
