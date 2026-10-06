/**
 * Aba "Chat" do projeto. Digitar "@" abre a lista de marcação: "@todos" e todos os
 * usuários cadastrados. Enter envia; Shift+Enter quebra a linha.
 */
import { currentProject, refreshProject } from '../../app/navigation';
import { avatar } from '../../components/avatar';
import { confirmDanger } from '../../components/dialog';
import { icon } from '../../components/icons';
import { currentUser } from '../../services/authService';
import {
  EVERYONE,
  MAX_MESSAGE_LENGTH,
  canDeleteChatMessage,
  chatParts,
  deleteChatMessage,
  markChatSeen,
  mentionableUsers,
  mentionsUser,
  canWriteChat,
  sendChatMessage,
  unreadMentions,
} from '../../services/chatService';
import { findUser, personByName } from '../../services/userService';
import type { ChatMessage } from '../../types/chat';
import type { Project } from '../../types/project';
import { onClick } from '../../utils/actions';
import { dayLabel, formatTime, ymdOf } from '../../utils/date';
import { $, esc, plural } from '../../utils/dom';
import { registerTab } from '../projects/projectView';

/** Mensagens seguidas do mesmo autor dentro deste intervalo ficam agrupadas. */
const GROUP_MS = 5 * 60_000;
const MAX_INPUT_HEIGHT = 160;

/** Rascunho por projeto: a tela é redesenhada a cada ação e o texto não pode se perder. */
const drafts = new Map<string, string>();

const fold = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR');

function messageText(m: ChatMessage, me: string | undefined): string {
  return chatParts(m, me)
    .map((part) => ('mention' in part ? `<span class="mention${part.me ? ' me' : ''}">${esc(part.mention)}</span>` : esc(part.text)))
    .join('');
}

function messageHtml(m: ChatMessage, prev: ChatMessage | undefined, me: string | undefined): string {
  const grouped = !!prev && prev.userId === m.userId && Date.parse(m.at) - Date.parse(prev.at) < GROUP_MS && ymdOf(new Date(prev.at)) === ymdOf(new Date(m.at));
  const author = findUser(m.userId) ?? personByName(m.who);
  const classes = ['msg', grouped ? 'grouped' : '', m.userId === me ? 'mine' : '', me && m.userId !== me && mentionsUser(m, me) ? 'for-me' : ''].filter(Boolean).join(' ');
  const remove = canDeleteChatMessage(m)
    ? `<button class="icon-btn msg-del" data-action="chat-delete" data-id="${m.id}" aria-label="Apagar mensagem" title="Apagar">${icon('trash')}</button>`
    : '';
  const head = grouped ? '' : `<div class="msg-head"><b>${esc(m.who)}</b><time datetime="${esc(m.at)}">${formatTime(m.at)}</time></div>`;
  return `<div class="${classes}"><div class="msg-av">${grouped ? '' : avatar(author)}</div><div class="msg-body">${head}<div class="msg-text">${messageText(m, me)}</div></div>${remove}</div>`;
}

function renderChat(p: Project): string {
  const me = currentUser()?.id;
  let day = '';
  const log = p.chat
    .map((m, i) => {
      const d = ymdOf(new Date(m.at));
      const sep = d !== day ? `<div class="chat-day"><span>${esc(dayLabel(m.at))}</span></div>` : '';
      const prev = d === day ? p.chat[i - 1] : undefined;
      day = d;
      return sep + messageHtml(m, prev, me);
    })
    .join('');
  const empty = `<div class="chat-empty">${icon('comment')}<p>Nenhuma mensagem ainda.</p><p class="sub flat">Converse com a equipe sobre este projeto. Use <b>@</b> para marcar alguém ou <b>@${EVERYONE}</b> para marcar todos.</p></div>`;
  if (!canWriteChat(p)) {
    return `<div class="chat"><div class="chat-log" id="chatLog" aria-live="polite">${log || empty}</div><p class="chat-hint chat-readonly">${icon(
      'lock',
    )}Seu perfil (Visualizador) pode ler o chat, mas não enviar mensagens.</p></div>`;
  }
  return `<div class="chat"><div class="chat-log" id="chatLog" aria-live="polite">${log || empty}</div><form class="chat-compose" id="chatForm" autocomplete="off">
  <div class="chat-input"><div class="mention-pop" id="mentionPop" role="listbox" aria-label="Marcar pessoa" hidden></div>
  <textarea class="field" id="chatText" rows="1" maxlength="${MAX_MESSAGE_LENGTH}" placeholder="Escreva uma mensagem… use @ para marcar alguém" aria-label="Mensagem">${esc(drafts.get(p.id) ?? '')}</textarea></div>
  <button class="primary chat-send" aria-label="Enviar">${icon('send')}<span>Enviar</span></button>
</form><p class="chat-hint">Enter envia · Shift+Enter quebra a linha · @ marca pessoas</p></div>`;
}

interface MentionOption {
  insert: string;
  html: string;
  /** Textos comparados com o que foi digitado depois do "@". */
  keys: string[];
}

function mentionOptions(): MentionOption[] {
  const users = mentionableUsers();
  const everyone: MentionOption = {
    insert: EVERYONE,
    keys: [EVERYONE],
    html: `<span class="av everyone">${icon('users')}</span><span><b>@${EVERYONE}</b><small>Marca ${plural(users.length, 'pessoa cadastrada', 'pessoas cadastradas')}</small></span>`,
  };
  return [
    everyone,
    ...users.map((u) => ({
      insert: u.name,
      keys: [u.name, ...u.name.split(/\s+/)].map(fold),
      html: `${avatar(u, true)}<span><b>${esc(u.name)}</b>${u.role ? `<small>${esc(u.role)}</small>` : ''}</span>`,
    })),
  ];
}

/** Liga envio, rascunho, altura automática e a lista de marcação ao campo de texto. */
function mountChat(p: Project, container: HTMLElement): void {
  markChatSeen(p);
  if (!canWriteChat(p)) {
    const log = container.querySelector<HTMLElement>('#chatLog');
    if (log) log.scrollTop = log.scrollHeight;
    return;
  }
  const log = $('#chatLog', container);
  const form = $<HTMLFormElement>('#chatForm', container);
  const input = $<HTMLTextAreaElement>('#chatText', container);
  const pop = $('#mentionPop', container);
  log.scrollTop = log.scrollHeight;

  let options: MentionOption[] = [];
  let active = 0;
  let start = -1;

  const grow = (): void => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight + 2, MAX_INPUT_HEIGHT)}px`;
  };

  const close = (): void => {
    pop.hidden = true;
    options = [];
    start = -1;
  };

  const paint = (): void => {
    pop.innerHTML = options
      .map((o, i) => `<div class="mention-opt${i === active ? ' active' : ''}" role="option" aria-selected="${i === active}" data-index="${i}">${o.html}</div>`)
      .join('');
    pop.hidden = false;
    pop.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  };

  /** Abre a lista quando o cursor está logo depois de "@algo" (o nome pode ter espaços). */
  const update = (): void => {
    const caret = input.selectionStart;
    if (caret !== input.selectionEnd) return close();
    const match = /(^|\s)@([^@\n]{0,40})$/u.exec(input.value.slice(0, caret));
    if (!match) return close();
    const typed = fold(match[2] ?? '');
    const found = mentionOptions().filter((o) => o.keys.some((k) => k.startsWith(typed)));
    if (!found.length) return close();
    const at = caret - (match[2] ?? '').length - 1;
    if (at !== start) active = 0;
    start = at;
    options = found;
    active = Math.min(active, found.length - 1);
    paint();
  };

  const pick = (option: MentionOption | undefined): void => {
    if (!option || start < 0) return;
    const caret = input.selectionStart;
    const text = `@${option.insert} `;
    input.value = input.value.slice(0, start) + text + input.value.slice(caret).replace(/^ /, '');
    const pos = start + text.length;
    input.setSelectionRange(pos, pos);
    drafts.set(p.id, input.value);
    close();
    grow();
    input.focus();
  };

  const send = (): void => {
    if (!sendChatMessage(p, input.value)) return;
    drafts.delete(p.id);
    refreshProject();
    document.querySelector<HTMLTextAreaElement>('#chatText')?.focus();
  };

  input.addEventListener('input', () => {
    drafts.set(p.id, input.value);
    grow();
    update();
  });
  input.addEventListener('click', update);
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (!pop.hidden && options.length) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        paint();
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pick(options[active]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  // mousedown (e não click) para o campo não perder o foco antes da escolha.
  pop.addEventListener('mousedown', (e) => {
    const opt = (e.target as Element).closest<HTMLElement>('.mention-opt');
    if (!opt) return;
    e.preventDefault();
    pick(options[Number(opt.dataset.index)]);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    send();
  });
  grow();
}

export function initChat(): void {
  registerTab('chat', { render: renderChat, mount: mountChat, badge: unreadMentions });
  onClick('chat-delete', async (el) => {
    const p = currentProject();
    const id = el.dataset.id ?? '';
    if (!(await confirmDanger('Apagar mensagem', 'A mensagem será apagada do chat para todos.', 'Apagar'))) return;
    deleteChatMessage(p, id);
    refreshProject();
  });
}
