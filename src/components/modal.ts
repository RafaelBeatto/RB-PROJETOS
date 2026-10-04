/**
 * Janela principal (formulários de projeto, tarefa, etapa…).
 * Só existe uma aberta por vez; abrir outra substitui o conteúdo.
 */
import { $, $maybe } from '../utils/dom';
import { icon } from './icons';

interface ModalOptions {
  wide?: boolean;
}

export function modalShell(): string {
  return `<div class="modal-wrap" id="modalWrap" hidden><div class="modal" id="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-head"><h2 id="modalTitle"></h2><button class="close" data-action="modal-close" aria-label="Fechar">${icon('close')}</button></div><div id="modalBody"></div></div></div>`;
}

export function openModal(title: string, html: string, options: ModalOptions = {}): HTMLElement {
  const wrap = $('#modalWrap');
  $('#modal').classList.toggle('wide', !!options.wide);
  $('#modalTitle').textContent = title;
  const body = $('#modalBody');
  body.innerHTML = html;
  wrap.hidden = false;
  return body;
}

export function closeModal(): void {
  const wrap = $maybe('#modalWrap');
  if (wrap) wrap.hidden = true;
}

export function isModalOpen(): boolean {
  return $maybe('#modalWrap')?.hidden === false;
}

/** Elemento de formulário dentro da janela; falha cedo se o HTML mudou. */
export function modalField<T extends Element = HTMLInputElement>(selector: string): T {
  return $<T>(selector, $('#modalBody'));
}

export function installModal(): void {
  const wrap = $('#modalWrap');
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap) closeModal();
  });
}
