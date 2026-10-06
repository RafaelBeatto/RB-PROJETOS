/**
 * Anexos da tarefa: arquivos enviados (guardados neste navegador) e links.
 * Usado na janela da tarefa e na linha expandida do checklist da etapa.
 */
import { askFields } from '../../components/dialog';
import { icon } from '../../components/icons';
import { showToast } from '../../components/toast';
import { RuleError } from '../../services/errors';
import { formatBytes, getFile } from '../../services/fileStore';
import { addFile, addLink, removeLink } from '../../services/taskService';
import type { Project } from '../../types/project';
import type { Task, TaskLink } from '../../types/task';
import { esc } from '../../utils/dom';

function item(l: TaskLink, editable: boolean): string {
  const label = esc(l.label || l.url);
  let content: string;
  if (l.fileId) content = `<button type="button" class="att-open" data-att-open="${l.id}" title="Abrir ou baixar">${icon('paperclip')}<span>${label}</span><small>${formatBytes(l.size ?? 0)}</small></button>`;
  else if (/^https?:\/\//i.test(l.url)) content = `<a href="${esc(l.url)}" target="_blank" rel="noopener">${icon('link')}<span>${label}</span></a>`;
  else content = `<span>${icon('paperclip')}<span>${label}</span></span>`;
  return `<div class="lnk">${content}${editable ? `<button type="button" class="att-del" data-att-del="${l.id}" aria-label="Remover anexo">${icon('close')}</button>` : ''}</div>`;
}

export function attachmentsHtml(t: Task, editable: boolean): string {
  const list = t.links.map((l) => item(l, editable)).join('') || `<span class="sub flat small">Nenhum anexo.</span>`;
  const actions = editable
    ? `<div class="att-actions"><label class="ghost file-btn">${icon('paperclip')}Anexar arquivo<input type="file" multiple hidden data-att-file></label><button type="button" class="ghost" data-att-link>${icon('link')}Link</button></div>`
    : '';
  return `<div class="att-list">${list}</div>${actions}`;
}

/** Abre (imagem, PDF, texto) ou baixa o arquivo guardado. */
async function openFile(l: TaskLink): Promise<void> {
  const blob = l.fileId ? await getFile(l.fileId).catch(() => undefined) : undefined;
  if (!blob) {
    showToast('Este arquivo não está neste navegador (foi enviado em outro computador ou os dados do site foram apagados).');
    return;
  }
  const url = URL.createObjectURL(blob);
  const viewable = /^(image\/|application\/pdf|text\/)/.test(blob.type || l.mime || '');
  if (viewable) window.open(url, '_blank', 'noopener');
  else {
    const a = document.createElement('a');
    a.href = url;
    a.download = l.label || 'arquivo';
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Liga os botões de anexos dentro de `root`; `changed` redesenha depois de cada alteração. */
export function bindAttachments(root: HTMLElement, p: Project, t: Task, changed: () => void): void {
  root.addEventListener('click', async (e) => {
    const target = e.target as Element;
    const open = target.closest<HTMLElement>('[data-att-open]');
    if (open) {
      const l = t.links.find((x) => x.id === open.dataset.attOpen);
      if (l) void openFile(l);
      return;
    }
    const del = target.closest<HTMLElement>('[data-att-del]');
    if (del?.dataset.attDel) {
      removeLink(p, t, del.dataset.attDel);
      changed();
      return;
    }
    if (target.closest('[data-att-link]')) {
      const r = await askFields('Adicionar link', [{ label: 'Endereço (https://…)', required: true }, { label: 'Nome de exibição (opcional)' }]);
      if (!r?.[0]) return;
      addLink(p, t, r[0], r[1] ?? '');
      changed();
    }
  });
  root.addEventListener('change', async (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement) || !input.matches('[data-att-file]') || !input.files?.length) return;
    const files = [...input.files];
    input.value = '';
    let added = 0;
    for (const file of files) {
      try {
        await addFile(p, t, file);
        added++;
      } catch (error) {
        if (!(error instanceof RuleError)) throw error;
        showToast(error.message);
      }
    }
    if (added) showToast(added === 1 ? 'Arquivo anexado' : `${added} arquivos anexados`);
    changed();
  });
}
