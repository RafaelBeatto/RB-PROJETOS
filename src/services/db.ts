/**
 * Dados da aplicação em memória e sua gravação no navegador.
 * Os serviços alteram `db` e chamam `persist*()`; nenhuma tela grava direto.
 */
import type { Project } from '../types/project';
import type { User } from '../types/user';
import { ensureLayout } from './branchService';
import { migrateProjects, migrateUsers } from './migrations';
import { SEED_PROJECTS } from './seed';
import { STORAGE_KEYS, readJSON, readString, writeJSON, writeString } from './storage';
import { loadPrefeituras } from './prefeituraService';
import { adminProfileId, loadAccess } from './profileService';
import { isAdminProfile, seedUsersFromNames, upgradeLegacyUser, userByName } from './userService';

export const db = {
  projects: [] as Project[],
  users: [] as User[],
};

export function persistProjects(): void {
  writeJSON(STORAGE_KEYS.projects, db.projects);
}

export function persistUsers(): void {
  writeJSON(STORAGE_KEYS.users, db.users);
}

let pending: ReturnType<typeof setTimeout> | undefined;
/** Grava com atraso; usado em pan/zoom do mapa para não salvar a cada movimento. */
export function persistProjectsSoon(delay = 300): void {
  clearTimeout(pending);
  pending = setTimeout(persistProjects, delay);
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

/** Carrega e migra os dados salvos. Grava de volta só se a migração mudou algo. */
export function loadDatabase(): void {
  const rawProjects = loadRawProjects();
  const { projects, withoutCoordinators } = migrateProjects(rawProjects);
  db.projects = projects;

  loadAccess();
  loadPrefeituras();
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

  for (const p of projects) {
    if (withoutCoordinators.has(p.id)) {
      const owner = userByName(p.owner);
      p.coordinators = owner ? [owner.id] : [];
    }
    ensureLayout(p);
  }

  const before = JSON.stringify(rawProjects);
  if (rawProjects !== SEED_PROJECTS && JSON.stringify(db.projects) !== before) persistProjects();
  if (usersChanged) persistUsers();
}
