import type { HistoryEntry, VisitRecord } from "../types";

const DB_NAME = "browser-palette";
const DB_VERSION = 1;
const STORE_NAME = "history";
const FAVICON_TTL = 7 * 24 * 60 * 60 * 1000;

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: "normalizedUrl"
        });

        store.createIndex("hostname", "hostname");
        store.createIndex("lastVisitedAt", "lastVisitedAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => T | Promise<T>
) {
  const db = await openDatabase();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const result = Promise.resolve(callback(store));

    transaction.oncomplete = () => {
      db.close();
      result.then(resolve).catch(reject);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

function getEntry(store: IDBObjectStore, normalizedUrl: string) {
  return new Promise<HistoryEntry | null>((resolve, reject) => {
    const request = store.get(normalizedUrl);
    request.onsuccess = () => resolve((request.result as HistoryEntry | undefined) || null);
    request.onerror = () => reject(request.error);
  });
}

function getAllEntries(store: IDBObjectStore) {
  return new Promise<HistoryEntry[]>((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as HistoryEntry[]) || []);
    request.onerror = () => reject(request.error);
  });
}

export function getHistoryEntries() {
  return withStore("readonly", (store) => getAllEntries(store));
}

export function recordVisit(visit: VisitRecord) {
  return withStore("readwrite", async (store) => {
    if (!visit.normalizedUrl || !visit.url) {
      return null;
    }

    const existing = await getEntry(store, visit.normalizedUrl);
    const now = Date.now();
    const entry: HistoryEntry = {
      ...existing,
      ...visit,
      title: visit.title || existing?.title || visit.hostname || visit.url,
      firstVisitedAt: existing?.firstVisitedAt || now,
      lastVisitedAt: now,
      visitCount: (existing?.visitCount || 0) + 1,
      faviconExpiresAt: visit.faviconUrl ? now + FAVICON_TTL : existing?.faviconExpiresAt
    };

    store.put(entry);
    return entry;
  });
}

export function deleteHistoryEntry(normalizedUrl: string) {
  return withStore("readwrite", (store) => {
    store.delete(normalizedUrl);
  });
}

export function clearHistoryEntries() {
  return withStore("readwrite", (store) => {
    store.clear();
  });
}

export function runHistoryGarbageCollection() {
  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  return withStore("readwrite", async (store) => {
    const entries = await getAllEntries(store);
    let deleted = 0;

    for (const entry of entries) {
      const isOld = now - entry.lastVisitedAt > thirtyDays;
      const isLowValue = entry.visitCount < 2;

      if (isOld && isLowValue) {
        store.delete(entry.normalizedUrl);
        deleted += 1;
        continue;
      }

      if (entry.faviconExpiresAt && entry.faviconExpiresAt < now) {
        store.put({
          ...entry,
          faviconUrl: "",
          faviconExpiresAt: undefined
        });
      }
    }

    return { deleted };
  });
}
