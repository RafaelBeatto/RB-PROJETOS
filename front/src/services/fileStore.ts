/**
 * Arquivos anexados às tarefas, guardados no IndexedDB deste navegador.
 * Ficam fora do localStorage para não esgotar o espaço dos dados do sistema
 * (o localStorage tem poucos MB; o IndexedDB aceita arquivos grandes).
 */
const DB_NAME = 'rb-files';
const STORE = 'files';

/** Tamanho máximo de cada arquivo anexado. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Não foi possível abrir o armazenamento de arquivos.'));
  });
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = work(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('Falha ao acessar o arquivo.'));
        };
      }),
  );
}

export function putFile(id: string, file: Blob): Promise<unknown> {
  return run('readwrite', (s) => s.put(file, id));
}

export function getFile(id: string): Promise<Blob | undefined> {
  return run('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>);
}

export function deleteFile(id: string): Promise<unknown> {
  return run('readwrite', (s) => s.delete(id)).catch(() => undefined);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}
