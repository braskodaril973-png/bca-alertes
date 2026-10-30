// BCA Alertes — service worker : notifications push de la veille BénefClicAuto, appli hors ligne.
import {store} from './db.js';

const CACHE = 'bca-alertes-v2';
const SHELL = ['./', './index.html', './app.css', './app.js', './db.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Coquille de l'appli : réseau d'abord (mise à jour), cache si pas de réseau.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(res => {
    const copy = res.clone();
    if (res.ok) void caches.open(CACHE).then(c => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request, {ignoreSearch: true}).then(r => r || caches.match('./index.html'))));
});

const euro = n => (Number.isFinite(n) ? `${Math.round(n).toLocaleString('fr-FR')} €` : '—');
function notice(data) {
  if (data.t === 'lot' && data.lot) {
    const l = data.lot;
    const kinds = {upgrade: 'Analyse complétée · ', price: 'Enchère changée · ', ending: 'Fin < 2 h · ', relist: 'Remis en vente · '};
    return {
      title: `${l.lvl === 'green' ? '🟢' : '🟡 À vérifier'} ${kinds[data.kind] || ''}${l.v} — ${l.lvl !== 'green' && Number.isFinite(l.net) ? '≤ ' : ''}${euro(l.net)}`,
      options: {
        body: `${l.pk === 'map' ? 'Mise à prix' : 'Enchère'} ${euro(l.p)} · plafond ${euro(l.lim)} · ${l.ct || 'CT à vérifier'}`,
        tag: `lot-${l.key}`, renotify: true, requireInteraction: true,
        icon: './icon-192.png', badge: './icon-192.png', ...(l.ph ? {image: l.ph} : {}),
        data: {open: `./#lot=${encodeURIComponent(l.key)}`}
      }
    };
  }
  return {title: 'BénefClicAuto', options: {body: String(data.msg || 'Message de la veille'), tag: `sys-${data.t}`,
    icon: './icon-192.png', badge: './icon-192.png', data: {open: './'}}};
}
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let data;
    try {
      data = e.data.json();
    } catch {
      data = {t: 'sys', msg: 'Message illisible reçu de la veille.'};
    }
    await store(data).catch(() => {});
    const {title, options} = notice(data);
    // Chrome exige une notification visible pour chaque message reçu.
    await self.registration.showNotification(title.slice(0, 120), options);
    for (const c of await self.clients.matchAll({type: 'window'})) c.postMessage({type: 'refresh'});
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL(e.notification.data?.open || './', self.registration.scope).href;
  e.waitUntil((async () => {
    for (const c of await self.clients.matchAll({type: 'window', includeUncontrolled: true}))
      if (c.url.startsWith(self.registration.scope)) {
        await c.navigate(target).catch(() => {});
        return c.focus();
      }
    return self.clients.openWindow(target);
  })());
});
