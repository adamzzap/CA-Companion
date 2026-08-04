// Local storage layer for the standalone build.
//
// In the Claude artifact environment, `window.storage` was a hosted per-user
// key/value store. Outside of Claude there's no backend yet, so this file
// polyfills the same interface (get/set/delete/list) using IndexedDB in the
// browser. Data lives on the device it was entered on — it does not sync
// between phones/users. That's an intentional MVP tradeoff (see README) and
// matches how the tool behaved as a Claude artifact, where each person's
// data was scoped to their own account too.
//
// The `shared` flag from the original interface is accepted for API
// compatibility but currently has no effect (there's no multi-user backend
// to share across yet).

const DB_NAME = 'zzap-site-visit';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

window.storage = {
  async get(key /*, shared */) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => {
        if (!req.result) { reject(new Error('Key not found: ' + key)); return; }
        resolve({ key, value: req.result.value, shared: false });
      };
      req.onerror = () => reject(req.error);
    });
  },

  async set(key, value /*, shared */) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ key, value });
      tx.oncomplete = () => resolve({ key, value, shared: false });
      tx.onerror = () => reject(tx.error);
    });
  },

  async delete(key /*, shared */) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve({ key, deleted: true, shared: false });
      tx.onerror = () => reject(tx.error);
    });
  },

  async list(prefix /*, shared */) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAllKeys();
      req.onsuccess = () => {
        const keys = req.result.filter(k => !prefix || String(k).startsWith(prefix));
        resolve({ keys, prefix, shared: false });
      };
      req.onerror = () => reject(req.error);
    });
  },
};
