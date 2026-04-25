const DB_NAME = "anon-v2-secure-store"
const DB_VERSION = 1

const STORES = [
  "meta",
  "sessions",
  "identities",
  "prekeys",
  "signedPrekeys",
  "kyberPreKeys",
  "senderKeys",
  "conversations",
  "messages",
  "contacts",
  "groups",
] as const

export type V2StoreName = (typeof STORES)[number]

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available"))
  }

  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store)
        }
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"))
  })

  return dbPromise
}

async function withStore<T>(
  storeName: V2StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | void> {
  const db = await openDb()

  return await new Promise<T | void>((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    const request = fn(store)

    tx.oncomplete = () => {
      if (!request) {
        resolve()
      }
    }

    tx.onerror = () => reject(tx.error || new Error(`IndexedDB transaction failed for ${storeName}`))

    if (request) {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error(`IndexedDB request failed for ${storeName}`))
    }
  })
}

export async function idbPut<T>(storeName: V2StoreName, key: string, value: T) {
  await withStore(storeName, "readwrite", (store) => store.put(value, key))
}

export async function idbGet<T>(storeName: V2StoreName, key: string) {
  return (await withStore<T | undefined>(storeName, "readonly", (store) => store.get(key))) ?? undefined
}

export async function idbDelete(storeName: V2StoreName, key: string) {
  await withStore(storeName, "readwrite", (store) => store.delete(key))
}

export async function idbGetAll<T>(storeName: V2StoreName) {
  return ((await withStore<T[]>(storeName, "readonly", (store) => store.getAll())) || []) as T[]
}

export async function idbGetEntriesByPrefix<T>(storeName: V2StoreName, prefix: string) {
  const db = await openDb()

  return await new Promise<Array<{ key: string; value: T }>>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly")
    const store = tx.objectStore(storeName)
    const request = store.openCursor()
    const entries: Array<{ key: string; value: T }> = []

    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve(entries)
        return
      }

      if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) {
        entries.push({ key: cursor.key, value: cursor.value as T })
      }
      cursor.continue()
    }

    request.onerror = () => reject(request.error || new Error(`Failed to iterate ${storeName}`))
    tx.onerror = () => reject(tx.error || new Error(`IndexedDB cursor transaction failed for ${storeName}`))
  })
}
