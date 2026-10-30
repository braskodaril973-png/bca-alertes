// BCA Alertes — page de l'appli : appairage, liste des lots reçus, témoin de vie du PC.
import {all, getMeta, setMeta, purge} from './db.js';

const $ = s => document.querySelector(s);
const LATE_MS = 26 * 3600 * 1000;
const euro = n => (Number.isFinite(n) ? `${Math.round(n).toLocaleString('fr-FR')} €` : '—');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]);
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = t => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (t.length % 4)) % 4)), c => c.charCodeAt(0));
let filter = 'all';
let reg = null;
const say = (text = '') => void ($('#setup-msg').textContent = text);

/* ---------------- Appairage ---------------- */
// Le lien d'appairage porte la clé publique de la veille dans le « # » : jamais envoyée au serveur.
async function readKeyFromLink() {
  const k = new URLSearchParams(location.hash.slice(1)).get('k');
  if (k && /^[A-Za-z0-9_-]{80,100}$/.test(k) && unb64url(k).length === 65) {
    await setMeta('vapidKey', k);
    history.replaceState(null, '', location.pathname);
  }
  return getMeta('vapidKey');
}
const codeOf = sub => {
  const j = sub.toJSON();
  return 'BCA1.' + b64url(new TextEncoder().encode(JSON.stringify({e: j.endpoint, p: j.keys.p256dh, a: j.keys.auth})));
};
async function subscribe() {
  say();
  const key = await getMeta('vapidKey');
  if (!key) return say('Ouvre d’abord le lien d’appairage envoyé par BénefClicAuto.');
  if ((await Notification.requestPermission()) !== 'granted')
    return say('Notifications refusées : autorise-les dans les réglages du site (cadenas ou ⋮ → Infos sur le site).');
  try {
    const existing = await reg.pushManager.getSubscription();
    // Clé de la veille changée : ancien abonnement retiré.
    if (existing && b64url(existing.options.applicationServerKey) !== key) await existing.unsubscribe();
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: unb64url(key)}));
    await setMeta('code', codeOf(sub));
    await renderSetup();
  } catch (e) {
    say(`Abonnement impossible : ${e.message}`);
  }
}
async function renderSetup() {
  const key = await getMeta('vapidKey');
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  const standalone = matchMedia('(display-mode: standalone)').matches;
  $('#step-install').classList.toggle('done', standalone);
  $('#step-key').classList.toggle('done', !!key);
  $('#key-text').textContent = key ? 'Lien reçu : ce téléphone connaît ta veille.' :
    'Ouvre ce téléphone sur le lien d’appairage envoyé par BénefClicAuto (Réglages de la veille → « Envoyer le lien sur Telegram »).';
  $('#subscribe').disabled = !key || !reg;
  $('#step-push').classList.toggle('done', !!sub && Notification.permission === 'granted');
  const code = sub ? codeOf(sub) : null;
  $('#step-code').hidden = !code;
  $('#code').value = code || '';
  // Tant que l'appairage n'est pas fait, la mise en route reste affichée.
  if (!code) $('#setup').hidden = false;
}
let installEvent = null;
addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvent = e;
  $('#install').hidden = false;
});
$('#install').onclick = async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $('#install').hidden = true;
};
$('#subscribe').onclick = () => void subscribe();
$('#copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText($('#code').value);
    say('Code copié. Colle-le dans BénefClicAuto → Réglages de la veille.');
  } catch {
    $('#code').select();
    say('Copie automatique impossible : le code est sélectionné, copie-le à la main.');
  }
};
$('#share').onclick = async () => {
  try {
    await navigator.share({title: 'Code d’appairage BCA Alertes', text: $('#code').value});
  } catch (e) {
    if (e.name !== 'AbortError') $('#copy').click();
  }
};
$('#open-setup').onclick = () => {
  $('#setup').hidden = !$('#setup').hidden;
  if (!$('#setup').hidden) $('#setup').scrollIntoView({behavior: 'smooth'});
};

/* ---------------- Lots et témoin de vie ---------------- */
function remaining(end, now) {
  const ms = Date.parse(end || '') - now;
  if (!Number.isFinite(ms)) return {text: 'fin inconnue', cls: 'over'};
  if (ms <= 0) return {text: 'Vente terminée', cls: 'over'};
  const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60;
  return {text: `${d ? d + ' j ' : ''}${h} h ${String(m).padStart(2, '0')}`, cls: ms < 2 * 3600000 ? 'soon' : ''};
}
function card(l, now) {
  const r = remaining(l.end, now);
  const lvl = l.lvl === 'green' ? 'green' : 'yellow';
  return `<article class="lot ${lvl}" id="lot-${esc(l.key)}">
    ${l.ph ? `<img class="photo" src="${esc(l.ph)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
    <div class="body">
      <div class="head"><h3>${esc(l.v)}${l.y ? ` — ${esc(l.y)}` : ''}</h3><span class="badge ${lvl}">${lvl === 'green' ? '🟢 Affaire' : '🟡 À vérifier'}</span></div>
      <p class="sub">${Number.isFinite(l.km) ? l.km.toLocaleString('fr-FR') + ' km · ' : ''}Vente Web</p>
      <div class="figures">
        <div class="fig"><small>${l.pk === 'map' ? 'Mise à prix' : 'Enchère'}</small><b>${euro(l.p)}</b></div>
        <div class="fig"><small>Plafond BCA</small><b>${euro(l.lim)}</b></div>
        <div class="fig net"><small>Bénéfice estimé</small><b>${euro(l.net)}</b></div>
      </div>
      <p class="ct">🔧 ${esc(l.ct || 'CT à vérifier manuellement')}</p>
      ${l.kmw ? '<p class="kmw">⚠ km au CT supérieur au km annoncé</p>' : ''}
      ${l.miss ? `<p class="miss">⚠ À vérifier : ${esc(l.miss)}</p>` : ''}
      <div class="foot-row">
        <span class="countdown ${r.cls}" data-end="${esc(l.end || '')}">⏱ ${esc(r.text)}</span>
        <a class="btn primary open" href="${esc(/^https:\/\/www\.alcopa-auction\.fr\//.test(l.url) ? l.url : '#')}" target="_blank" rel="noopener">Ouvrir la fiche</a>
      </div>
    </div>
  </article>`;
}
async function render() {
  const now = Date.now();
  await purge(now).catch(() => {});
  const lots = (await all('lots')).sort((a, b) => (Date.parse(a.end) || Infinity) - (Date.parse(b.end) || Infinity));
  const live = lots.filter(l => !(Date.parse(l.end) < now));
  const soon = l => Date.parse(l.end) - now < 24 * 3600000 && Date.parse(l.end) > now;
  const counts = {all: lots.length, green: lots.filter(l => l.lvl === 'green').length, yellow: lots.filter(l => l.lvl !== 'green').length,
    soon: lots.filter(soon).length};
  for (const [k, n] of Object.entries(counts)) $(`#n-${k}`).textContent = n ? `(${n})` : '';
  const shown = filter === 'all' ? [...live, ...lots.filter(l => !live.includes(l))]
    : filter === 'green' ? lots.filter(l => l.lvl === 'green') : filter === 'yellow' ? lots.filter(l => l.lvl !== 'green') : lots.filter(soon);
  $('#lots').innerHTML = shown.map(l => card(l, now)).join('');
  $('#empty').hidden = shown.length > 0;
  // Témoin de vie : la dernière nouvelle du PC (alerte, message ou récap quotidien).
  const last = await getMeta('lastPush');
  const sig = $('#signal');
  sig.hidden = !last;
  if (last) {
    const age = now - Date.parse(last);
    const h = Math.floor(age / 3600000), m = Math.floor(age / 60000) % 60;
    sig.classList.toggle('late', age > LATE_MS);
    sig.textContent = age > LATE_MS
      ? `⚠ Aucun signal du PC depuis ${h} h : la veille ne tourne peut-être plus (PC éteint, Chrome fermé ?).`
      : `Dernier signal du PC : il y a ${h ? h + ' h ' : ''}${m} min.`;
  }
  const msgs = (await all('messages')).sort((a, b) => b.at.localeCompare(a.at));
  $('#messages-card').hidden = !msgs.length;
  $('#messages').innerHTML = msgs.slice(0, 10).map(x => `<li><time>${esc(new Date(x.at).toLocaleString('fr-FR'))}</time>${esc(x.msg)}</li>`).join('');
  const target = new URLSearchParams(location.hash.slice(1)).get('lot');
  if (target) {
    const el = document.getElementById(`lot-${target}`);
    if (el) {
      el.classList.add('flash');
      el.scrollIntoView({behavior: 'smooth'});
      setTimeout(() => el.classList.remove('flash'), 2500);
    }
    history.replaceState(null, '', location.pathname);
  }
}
for (const chip of document.querySelectorAll('[data-filter]'))
  chip.onclick = () => {
    filter = chip.dataset.filter;
    for (const c of document.querySelectorAll('[data-filter]')) c.setAttribute('aria-pressed', String(c === chip));
    void render();
  };
setInterval(() => {
  const now = Date.now();
  for (const el of document.querySelectorAll('.countdown[data-end]')) {
    const r = remaining(el.dataset.end, now);
    el.textContent = `⏱ ${r.text}`;
    el.className = `countdown ${r.cls}`;
  }
}, 30000);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void render());
addEventListener('hashchange', () => void render());

(async () => {
  if ('serviceWorker' in navigator) {
    reg = await navigator.serviceWorker.register('sw.js', {type: 'module'}).then(() => navigator.serviceWorker.ready).catch(e => (say(`Service worker : ${e.message}`), null));
    navigator.serviceWorker.addEventListener('message', e => e.data?.type === 'refresh' && void render());
  } else say('Ce navigateur ne gère pas les notifications push : utilise Chrome sur Android.');
  await readKeyFromLink();
  await renderSetup();
  await render();
})();
