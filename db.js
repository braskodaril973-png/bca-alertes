// BCA Alertes — base locale du téléphone (IndexedDB), partagée par la page et le service worker.
// Elle ne contient que ce que les notifications ont apporté. Rien n'est envoyé nulle part.
const NAME = 'bca-alertes';
let opening = null;
function open() {
  return (opening ||= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('lots')) db.createObjectStore('lots', {keyPath: 'key'});
      if (!db.objectStoreNames.contains('messages')) db.createObjectStore('messages', {keyPath: 'id', autoIncrement: true});
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', {keyPath: 'id'});
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  }));
}
async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
export const put = (store, value) => run(store, 'readwrite', s => s.put(value));
export const all = store => run(store, 'readonly', s => s.getAll());
export const get = (store, key) => run(store, 'readonly', s => s.get(key));
export const remove = (store, key) => run(store, 'readwrite', s => s.delete(key));
export const getMeta = async id => (await get('meta', id))?.value ?? null;
export const setMeta = (id, value) => put('meta', {id, value});

/** Notification reçue → rangée : lot (une ligne par lot) ou message système (20 derniers). */
export async function store(data) {
  const at = data.at || new Date().toISOString();
  await setMeta('lastPush', at);
  if (data.t === 'lot' && data.lot?.key) {
    const before = await get('lots', String(data.lot.key));
    await put('lots', {...before, ...data.lot, key: String(data.lot.key), kind: data.kind, receivedAt: at, seen: false,
      firstAt: before?.firstAt || at});
  } else if (data.t === 'sys' || data.t === 'recap') {
    await put('messages', {t: data.t, msg: String(data.msg || '').slice(0, 600), at});
    const msgs = await all('messages');
    for (const m of msgs.slice(0, Math.max(0, msgs.length - 20))) await remove('messages', m.id);
  }
}
/** Lots dont la vente est finie depuis plus de 2 jours : retirés. */
export async function purge(now = Date.now()) {
  for (const l of await all('lots')) {
    const end = Date.parse(l.end || '');
    if (Number.isFinite(end) && now - end > 2 * 24 * 3600 * 1000) await remove('lots', l.key);
  }
}
