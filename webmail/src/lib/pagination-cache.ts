type CachedPageData = {
  emails: any[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
};

type CacheRecord = {
  key: string;
  namespace: string;
  page: number;
  data: CachedPageData;
  updatedAt: number;
  accessedAt: number;
};

type PaginationCacheStats = {
  pages: number;
  bytes: number;
};

const DB_NAME = "webmail-pagination-cache";
const DB_VERSION = 1;
const STORE = "pages";
const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_PAGES_PER_NAMESPACE = 30;

function canUseIdb() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function makeKey(namespace: string, page: number) {
  return `${namespace}::${page}`;
}

function isValidCachedPageData(data: unknown): data is CachedPageData {
  if (!data || typeof data !== "object") return false;
  const candidate = data as Partial<CachedPageData>;
  if (!Array.isArray(candidate.emails)) return false;
  if (typeof candidate.total !== "number" || !Number.isFinite(candidate.total)) return false;
  if (candidate.nextCursor !== null && typeof candidate.nextCursor !== "string") return false;
  if (typeof candidate.hasMore !== "boolean") return false;
  return true;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => void | Promise<T>,
): Promise<T> {
  const db = await openDb();
  return await new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let settled = false;
    let resultValue: T | undefined;
    tx.oncomplete = () => {
      settled = true;
      resolve(resultValue as T);
    };
    tx.onerror = () => {
      settled = true;
      reject(tx.error);
    };
    tx.onabort = () => {
      settled = true;
      reject(tx.error);
    };
    Promise.resolve(work(store))
      .then((value) => {
        resultValue = value as T;
      })
      .catch((err) => {
        if (!settled) reject(err);
      });
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("namespace", "namespace", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function getRecord(key: string): Promise<CacheRecord | null> {
  return withStore("readonly", (store) => {
    return new Promise<CacheRecord | null>((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as CacheRecord | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  });
}

async function putRecord(record: CacheRecord): Promise<void> {
  await withStore("readwrite", (store) => {
    store.put(record);
  });
}

async function deleteRecord(key: string): Promise<void> {
  await withStore("readwrite", (store) => {
    store.delete(key);
  });
}

async function listNamespaceRecords(namespace: string): Promise<CacheRecord[]> {
  return withStore("readonly", (store) => {
    return new Promise<CacheRecord[]>((resolve, reject) => {
      const index = store.index("namespace");
      const req = index.getAll(IDBKeyRange.only(namespace));
      req.onsuccess = () => resolve((req.result as CacheRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
  });
}

async function pruneNamespace(namespace: string): Promise<void> {
  const records = await listNamespaceRecords(namespace);
  if (records.length <= MAX_PAGES_PER_NAMESPACE) return;
  records.sort((a, b) => a.accessedAt - b.accessedAt);
  const extra = records.length - MAX_PAGES_PER_NAMESPACE;
  for (let i = 0; i < extra; i += 1) {
    await deleteRecord(records[i].key);
  }
}

export function buildPaginationNamespace(params: {
  folder: string;
  threaded: boolean;
  perPage: number;
}) {
  const folder = params.folder.trim().toLowerCase();
  const mode = params.threaded ? "threaded" : "list";
  return `v1|folder:${folder}|mode:${mode}|pp:${params.perPage}`;
}

export async function getCachedPage(
  namespace: string,
  page: number,
): Promise<CachedPageData | null> {
  if (!canUseIdb()) return null;
  const key = makeKey(namespace, page);
  const record = await getRecord(key);
  if (!record) return null;
  if (Date.now() - record.updatedAt > TTL_MS) {
    await deleteRecord(key);
    return null;
  }
  if (!isValidCachedPageData(record.data)) {
    await deleteRecord(key);
    return null;
  }
  void putRecord({ ...record, accessedAt: Date.now() });
  return record.data;
}

export async function setCachedPage(
  namespace: string,
  page: number,
  data: CachedPageData,
): Promise<void> {
  if (!canUseIdb()) return;
  const now = Date.now();
  const record: CacheRecord = {
    key: makeKey(namespace, page),
    namespace,
    page,
    data,
    updatedAt: now,
    accessedAt: now,
  };
  await putRecord(record);
  await pruneNamespace(namespace);
}

export async function clearPaginationCache(namespace?: string): Promise<void> {
  if (!canUseIdb()) return;
  if (!namespace) {
    await withStore("readwrite", (store) => {
      store.clear();
    });
    return;
  }

  const records = await listNamespaceRecords(namespace);
  for (const rec of records) {
    await deleteRecord(rec.key);
  }
}

export async function getPaginationCacheStats(namespace?: string): Promise<PaginationCacheStats> {
  if (!canUseIdb()) return { pages: 0, bytes: 0 };
  const records = namespace
    ? await listNamespaceRecords(namespace)
    : await withStore("readonly", (store) => {
        return new Promise<CacheRecord[]>((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () => resolve((req.result as CacheRecord[]) || []);
          req.onerror = () => reject(req.error);
        });
      });

  let bytes = 0;
  for (const rec of records) {
    try {
      bytes += new Blob([JSON.stringify(rec.data)]).size;
    } catch {
      // ignore malformed entry and continue
    }
  }
  return { pages: records.length, bytes };
}
