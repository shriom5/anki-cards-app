/**
 * @module db
 * Low-level IndexedDB helpers. All exported functions return Promises.
 *
 * Database : "cardCatalogMedia"
 * Store    : "images"
 * Key type : string (image ID)
 * Value type: string (data URL)
 */

const IDB_NAME  = 'cardCatalogMedia';
const IDB_STORE = 'images';

/** @type {IDBDatabase|null} Cached connection — opened once and reused. */
let _db = null;

/**
 * Opens (or reuses) the IndexedDB connection.
 * Creates the "images" object store on the first run via onupgradeneeded.
 * @returns {Promise<IDBDatabase>}
 */
function getDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror   = e => reject(e.target.error);
  });
}

/**
 * Writes a value under the given key (upsert).
 * @param {string} id
 * @param {string} value - Data URL to store.
 * @returns {Promise<void>}
 */
export function idbPut(id, value) {
  return getDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, id);
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  }));
}

/**
 * Reads a value by key. Resolves to null if the key does not exist.
 * @param {string} id
 * @returns {Promise<string|null>}
 */
export function idbGet(id) {
  return getDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly')
                  .objectStore(IDB_STORE).get(id);
    req.onsuccess = e => resolve(e.target.result ?? null);
    req.onerror   = e => reject(e.target.error);
  }));
}

/**
 * Deletes one or more entries. No-op if ids is empty or null.
 * @param {string[]} ids
 * @returns {Promise<void>}
 */
export function idbDelete(ids) {
  if (!ids?.length) return Promise.resolve();
  return getDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    ids.forEach(id => tx.objectStore(IDB_STORE).delete(id));
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  }));
}

/**
 * Returns every key currently in the images store.
 * @returns {Promise<string[]>}
 */
export function idbGetAllKeys() {
  return getDb().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE, 'readonly')
                  .objectStore(IDB_STORE).getAllKeys();
    req.onsuccess = e => resolve(e.target.result ?? []);
    req.onerror   = e => reject(e.target.error);
  }));
}
