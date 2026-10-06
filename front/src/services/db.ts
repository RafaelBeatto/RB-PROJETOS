/**
 * Dados da aplicação em memória e sua gravação no navegador.
 * Os serviços alteram `db` e chamam `persist*()`; nenhuma tela grava direto.
 */
import type { Project } from '../types/project';
import { MAX_RESPONSIBLES } from '../types/task';
import { TRASH_KINDS, type TrashEntry } from '../types/trash';
import type { User } from '../types/user';
import { migrateProjects, migrateUsers } from './migrations';
import { SEED_PROJECTS } from './seed';
import { STORAGE_KEYS, readJSON, readString, writeJSON, writeString } from './storage';
import { loadContratantes } from './contratanteService';
import { adminProfileId, loadAccess } from './profileService';
import { isAdminProfile, seedUsersFromNames, upgradeLegacyUser, userByName } from './userService';

export const db = {
  projects: [] as Project[],
  users: [] as User[],
  /** Lixeira, da exclusão mais antiga para a mais recente. */
  trash: [] as TrashEntry[],
};

export function persistProjects(): void {
  writeJSON(STORAGE_KEYS.projects, db.projects);
}

export function persistUsers(): void {
  writeJSON(STORAGE_KEYS.users, db.users);
}

export function persistTrash(): void {
  writeJSON(STORAGE_KEYS.trash, db.trash);
}

function loadRawProjects(): unknown {
  const raw = readString(STORAGE_KEYS.projects);
  if (raw === null) return SEED_PROJECTS;
  const parsed = readJSON(STORAGE_KEYS.projects);
  if (parsed === undefined) {
    // Conteúdo ilegível: guarda uma cópia antes de seguir com o exemplo, para nada se perder.
    writeString(STORAGE_KEYS.projectsBackup, raw);
    return SEED_PROJECTS;
  }
  return parsed;
}

function loadTrash(): TrashEntry[] {
  const raw = readJSON(STORAGE_KEYS.trash);
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is TrashEntry => typeof e === 'object' && e !== null && typeof e.id === 'string' && TRASH_KINDS.includes(e.kind) && typeof e.projectId === 'string',
  );
}

/** Carrega e migra os dados salvos. Grava de volta só se a migração mudou algo. */
export function loadDatabase(): void {
  const rawProjects = loadRawProjects();
  const { projects, withoutCoordinators } = migrateProjects(rawProjects);
  db.projects = projects;
  db.trash = loadTrash();

  loadAccess();
  loadContratantes();
  const admin = adminProfileId();
  const storedUsers = migrateUsers(readJSON(STORAGE_KEYS.users));
  db.users = storedUsers ?? seedUsersFromNames(projects.flatMap((p) => [p.owner, ...p.tasks.map((t) => t.assignee)]), admin);
  let usersChanged = !storedUsers;
  for (const u of db.users) if (upgradeLegacyUser(u, admin)) usersChanged = true;
  // Regra de segurança: nunca ficar sem administrador ativo.
  const first = db.users[0];
  if (first && !db.users.some((u) => u.active && isAdminProfile(u.profileId))) {
    first.profileId = admin;
    first.active = true;
    usersChanged = true;
  }

  const exists = (id: string): boolean => db.users.some((u) => u.id === id);
  for (const p of projects) {
    // Responsável antigo (texto) vira vínculo com o usuário de mesmo nome; sem cadastro, o nome fica guardado.
    for (const t of p.tasks) {
      const user = !t.assignees.length ? userByName(t.assignee) : undefined;
      if (user) {
        t.assignees = [user.id];
        t.assignee = '';
      }
      t.assignees = t.assignees.filter(exists).slice(0, MAX_RESPONSIBLES);
    }
    for (const b of p.branches) b.assignees = b.assignees.filter(exists);
    if (withoutCoordinators.has(p.id)) {
      const owner = userByName(p.owner);
      p.coordinators = owner ? [owner.id] : [];
    }
  }

  const before = JSON.stringify(rawProjects);
  if (rawProjects !== SEED_PROJECTS && JSON.stringify(db.projects) !== before) {
    // A conversão descarta o que não existe mais (subníveis de etapa, dependências entre projetos…): guarda o original uma vez.
    if (readString(STORAGE_KEYS.projectsBeforeRules) === null) writeString(STORAGE_KEYS.projectsBeforeRules, before);
    persistProjects();
  }
  if (usersChanged) persistUsers();
}
