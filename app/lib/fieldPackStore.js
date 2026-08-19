// Tiny IndexedDB key-value store for the field pack (and, in Phase 2,
// the offline outbox). No dependency - it's one object store.
const DB_NAME = "patchup-field";
const STORE = "kv";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const out = fn(store);
      tx.oncomplete = () => resolve(out?.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const kvGet = (key) => withStore("readonly", (s) => s.get(key));
export const kvSet = (key, value) => withStore("readwrite", (s) => s.put(value, key));
export const kvDelete = (key) => withStore("readwrite", (s) => s.delete(key));

export async function saveFieldPack(pack) {
  await kvSet("fieldPack", pack);
}
export async function loadFieldPack() {
  return kvGet("fieldPack");
}

// Called on logout: the pack holds customer names, phones and addresses,
// and must not outlive the session on a shared or handed-back device.
export async function clearFieldData() {
  try {
    await kvDelete("fieldPack");
    await kvDelete("lastFieldSync");
  } catch {}
  try {
    if (typeof caches !== "undefined") await caches.delete("patchup-field-v1");
  } catch {}
}
