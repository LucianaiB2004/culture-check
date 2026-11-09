import type { Job, Report } from './types';
const DB = 'culture-check', ST = 'kv';
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(ST);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function put(k: string, v: unknown) {
  const d = await db();
  await new Promise<void>((res, rej) => { const t = d.transaction(ST, 'readwrite'); t.objectStore(ST).put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
}
async function get<T>(k: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((res, rej) => { const t = d.transaction(ST).objectStore(ST).get(k); t.onsuccess = () => res(t.result as T); t.onerror = () => rej(t.error); });
}
export const saveJob = (j: Job) => put('job', j);
export const loadJob = () => get<Job>('job');
export const saveReport = (r: Report) => put('report', r);
export const loadReport = () => get<Report>('report');
export const clearReport = () => put('report', undefined);
