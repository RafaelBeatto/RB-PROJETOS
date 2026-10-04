/**
 * Diálogos curtos que abrem por cima da janela principal, no lugar de
 * prompt() e confirm(). Devolvem uma Promise com a resposta.
 */
import { esc } from '../utils/dom';

export interface DialogField {
  label: string;
  value?: string;
  required?: boolean;
  type?: 'text' | 'password' | 'email';
}

interface DialogOptions {
  fields?: DialogField[];
  confirmLabel?: string;
  danger?: boolean;
  message?: string;
}

function openDialog(title: string, options: DialogOptions): Promise<string[] | null> {
  const fields = options.fields ?? [];
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap ask-wrap';
    wrap.innerHTML = `<form class="modal ask" role="dialog" aria-modal="true"><div class="modal-head"><h2>${esc(title)}</h2></div>${
      options.message ? `<p class="sub">${esc(options.message)}</p>` : ''
    }${fields
      .map(
        (f, i) =>
          `<div class="form-full"><label>${esc(f.label)}<input class="field" data-dialog-field="${i}" type="${f.type ?? 'text'}" value="${esc(f.value ?? '')}" ${f.required ? 'required' : ''}></label></div>`,
      )
      .join('')}<div class="modal-actions"><button type="button" class="ghost" data-dialog-cancel>Cancelar</button><button class="${
      options.danger ? 'danger' : 'primary'
    }">${esc(options.confirmLabel ?? 'Salvar')}</button></div></form>`;
    document.body.appendChild(wrap);

    const finish = (value: string[] | null): void => {
      wrap.remove();
      resolve(value);
    };
    const form = wrap.querySelector('form')!;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      finish(fields.map((_, i) => wrap.querySelector<HTMLInputElement>(`[data-dialog-field="${i}"]`)?.value.trim() ?? ''));
    });
    wrap.querySelector('[data-dialog-cancel]')?.addEventListener('click', () => finish(null));
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) finish(null);
    });
    wrap.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        finish(null);
      }
    });
    (wrap.querySelector<HTMLElement>('input') ?? wrap.querySelector<HTMLElement>('form button:last-child'))?.focus();
  });
}

/** Pede valores ao usuário; null se cancelar. */
export function askFields(title: string, fields: DialogField[], confirmLabel = 'Salvar'): Promise<string[] | null> {
  return openDialog(title, { fields, confirmLabel });
}

/** Pede confirmação de uma ação destrutiva. */
export async function confirmDanger(title: string, message: string, confirmLabel = 'Excluir'): Promise<boolean> {
  return (await openDialog(title, { message, confirmLabel, danger: true })) !== null;
}
