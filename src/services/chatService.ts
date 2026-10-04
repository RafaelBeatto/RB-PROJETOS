/**
 * Chat de cada projeto. As mensagens ficam no próprio projeto (`p.chat`).
 * Marcações: "@Nome" marca um usuário cadastrado; "@todos" marca todos os usuários.
 */
import type { ChatMessage } from '../types/chat';
import type { Project } from '../types/project';
import type { User } from '../types/user';
import { uid } from '../utils/ids';
import { currentUser } from './authService';
import { db, persistProjects } from './db';
import { PermissionDeniedError, authorize, isAdmin } from './permissionService';
import { STORAGE_KEYS, readJSON, writeJSON } from './storage';

/** Palavra que marca todo mundo. */
export const EVERYONE = 'todos';
export const MAX_MESSAGE_LENGTH = 4000;
/** Mensagens guardadas por projeto; as mais antigas saem primeiro. */
const MAX_PER_PROJECT = 1000;

/** Usuários que podem ser marcados: todos os cadastrados e ativos, em ordem alfabética. */
export function mentionableUsers(): User[] {
  return db.users.filter((u) => u.active).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * "@Nome" no começo do texto ou depois de um espaço, sem letra ou número colado no fim.
 * Nomes mais longos primeiro, para "@Ana Paula" não parar em "@Ana".
 */
function mentionRegex(names: string[]): RegExp | null {
  const alts = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length).map(escapeRegex);
  return alts.length ? new RegExp(`(^|\\s)@(${alts.join('|')})(?![\\p{L}\\p{N}])`, 'giu') : null;
}

/** Quem o texto marca. */
export function mentionsIn(text: string): { mentions: string[]; everyone: boolean } {
  const users = mentionableUsers();
  const regex = mentionRegex([EVERYONE, ...users.map((u) => u.name)]);
  const found = new Set<string>();
  let everyone = false;
  for (const match of regex ? text.matchAll(regex) : []) {
    const name = (match[2] ?? '').toLocaleLowerCase('pt-BR');
    if (name === EVERYONE) everyone = true;
    else for (const u of users) if (u.name.toLocaleLowerCase('pt-BR') === name) found.add(u.id);
  }
  return { mentions: [...found], everyone };
}

export type ChatPart = { text: string } | { mention: string; me: boolean };

/** Divide a mensagem em texto e marcações, para destacar as marcações na tela. */
export function chatParts(m: ChatMessage, me: string | undefined): ChatPart[] {
  const names = new Map<string, string>(); // nome em minúsculas → id ('' para @todos)
  if (m.everyone) names.set(EVERYONE, '');
  for (const id of m.mentions) {
    const u = db.users.find((x) => x.id === id);
    if (u) names.set(u.name.toLocaleLowerCase('pt-BR'), u.id);
  }
  const regex = mentionRegex([...names.keys()]);
  if (!regex) return [{ text: m.text }];
  const parts: ChatPart[] = [];
  let last = 0;
  for (const match of m.text.matchAll(regex)) {
    const start = (match.index ?? 0) + (match[1] ?? '').length;
    const name = match[2] ?? '';
    if (start > last) parts.push({ text: m.text.slice(last, start) });
    const id = names.get(name.toLocaleLowerCase('pt-BR'));
    parts.push({ mention: `@${name}`, me: id === '' || (!!me && id === me) });
    last = start + name.length + 1;
  }
  if (last < m.text.length) parts.push({ text: m.text.slice(last) });
  return parts;
}

export function mentionsUser(m: ChatMessage, userId: string): boolean {
  return m.everyone || m.mentions.includes(userId);
}

export function sendChatMessage(p: Project, raw: string): ChatMessage | null {
  authorize('projects', 'view', p.id);
  const user = currentUser();
  const text = raw.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!user || !text) return null;
  const message: ChatMessage = { id: uid('m'), userId: user.id, who: user.name, text, at: new Date().toISOString(), ...mentionsIn(text) };
  p.chat.push(message);
  if (p.chat.length > MAX_PER_PROJECT) p.chat.splice(0, p.chat.length - MAX_PER_PROJECT);
  persistProjects();
  markChatSeen(p);
  return message;
}

/** O autor apaga as próprias mensagens; o administrador apaga qualquer uma. */
export function canDeleteChatMessage(m: ChatMessage): boolean {
  const user = currentUser();
  return !!user && (m.userId === user.id || isAdmin(user));
}

export function deleteChatMessage(p: Project, id: string): void {
  const m = p.chat.find((x) => x.id === id);
  if (!m) return;
  if (!canDeleteChatMessage(m)) throw new PermissionDeniedError('projects', 'delete');
  p.chat = p.chat.filter((x) => x.id !== id);
  persistProjects();
}

// Leitura: até quando cada usuário já viu o chat de cada projeto.

type Seen = Record<string, Record<string, string>>;

function readSeen(): Seen {
  const raw = readJSON(STORAGE_KEYS.chatSeen);
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Seen) : {};
}

export function markChatSeen(p: Project): void {
  const user = currentUser();
  const last = p.chat.at(-1)?.at;
  if (!user || !last) return;
  const seen = readSeen();
  if ((seen[user.id]?.[p.id] ?? '') >= last) return;
  seen[user.id] = { ...seen[user.id], [p.id]: last };
  writeJSON(STORAGE_KEYS.chatSeen, seen);
}

/** Mensagens de outras pessoas que marcaram o usuário logado e ele ainda não viu. */
export function unreadMentions(p: Project): number {
  const user = currentUser();
  if (!user) return 0;
  const since = readSeen()[user.id]?.[p.id] ?? '';
  return p.chat.filter((m) => m.at > since && m.userId !== user.id && mentionsUser(m, user.id)).length;
}
