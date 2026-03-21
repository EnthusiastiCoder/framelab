// Hand-off between tools: the result of one tool is kept in IndexedDB (on this device, never uploaded) and the
// next tool page, opened with ?handoff=1, takes it back out (read once, then deleted).
const DB = 'framelab-handoff';
const STORE = 'files';
const KEY = 'next';

interface Stored {
  blob: Blob;
  name: string;
  type: string;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        t.onerror = () => {
          db.close();
          reject(t.error);
        };
      }),
  );
}

/** Keeps a file for the next tool page. */
export function stashHandoff(blob: Blob, name: string, type: string): Promise<void> {
  const value: Stored = { blob, name, type };
  return tx('readwrite', (s) => s.put(value, KEY)).then(() => undefined);
}

/** Takes the kept file (once). Resolves null when there is none or storage is unavailable. */
export async function takeHandoff(): Promise<File | null> {
  try {
    const value = await tx<Stored | undefined>('readonly', (s) => s.get(KEY) as IDBRequest<Stored | undefined>);
    await tx('readwrite', (s) => s.delete(KEY));
    return value ? new File([value.blob], value.name, { type: value.type }) : null;
  } catch {
    return null;
  }
}

/** True when this page was opened as a hand-off target; the query is removed so a reload starts clean. */
export function isHandoffPage(): boolean {
  const url = new URL(location.href);
  if (url.searchParams.get('handoff') !== '1') return false;
  url.searchParams.delete('handoff');
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  return true;
}

/** Stores the file and opens the tool page with it. */
export async function sendTo(slug: string, blob: Blob, name: string, type: string): Promise<void> {
  await stashHandoff(blob, name, type);
  location.href = `/${slug}?handoff=1`;
}
