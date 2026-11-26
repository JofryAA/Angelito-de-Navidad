/* ---------- app instalable + notificaciones ---------- */
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const canNotify = () => 'Notification' in window;
let installEvt = null, swReg = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; render(); });
landingInstall();
addEventListener('appinstalled', () => { installEvt = null; toast('¡App instalada! 🎉'); try { localStorage.setItem(INST_KEY, String(Date.now() + 3650 * 864e5)); localStorage.setItem(INSTALLED_KEY, '1'); } catch { } render(); });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  const cfgQ = encodeURIComponent(JSON.stringify({ apiKey: firebaseConfig.apiKey, projectId: firebaseConfig.projectId, messagingSenderId: firebaseConfig.messagingSenderId, appId: firebaseConfig.appId }));
  navigator.serviceWorker.register('sw.js?cfg=' + cfgQ).then(r => { swReg = r; if (canNotify() && Notification.permission === 'granted') registerPush(); }).catch(() => {});
}
// Una sola notificación, con aspecto de app profesional: el título dice quién o qué (sin adornos),
// el cuerpo el mensaje, y si llegan más se agrupan ("3 novedades") con una línea por cada una.
async function stackNotify(reg, title, body, url) {
  const split = t => { const m = String(t || '').match(/^([^\p{L}\p{N}@¡¿"“]+)\s*(.*)$/u); return m ? [m[1].trim(), m[2]] : ['', String(t || '')]; };
  const [emo, clean] = split(title);
  const old = await reg.getNotifications({ tag: 'angelito' });
  const d = (old[0] && old[0].data) || {}, prev = Array.isArray(d.items) ? d.items : [];
  const n = (d.n || prev.length) + 1;
  const items = [{ e: emo, t: clean, b: body || '' }, ...prev.filter(x => !(x.t === clean && x.b === (body || '')))].slice(0, 5);
  old.forEach(x => x.close());
  const one = items.length === 1;
  return reg.showNotification(one ? clean : `${n} novedades del angelito`, {
    body: one ? (body || '') : items.map(x => `${x.e || '•'} ${x.t}${x.b ? ': ' + x.b : ''}`).join('\n') + (n > items.length ? `\n+${n - items.length} más` : ''),
    icon: 'icons/icon-192.png', badge: 'icons/badge-96.png', tag: 'angelito', renotify: true, timestamp: Date.now(), lang: 'es', dir: 'ltr',
    vibrate: [80, 40, 80], data: { url: url || './', items, n }, actions: [{ action: 'open', title: 'Abrir' }]
  });
}
// al volver a la app, la notificación acumulada ya no hace falta
document.addEventListener('visibilitychange', async () => { if (document.hidden) return; try { const reg = swReg || await navigator.serviceWorker?.getRegistration(); (await reg?.getNotifications({ tag: 'angelito' }) || []).forEach(n => n.close()); } catch { } });
async function notifyUser(title, body = '', url = './', tag) {
  if (canNotify() && Notification.permission === 'granted' && document.hidden) {
    if (quietNow()) return; // horario de silencio
    if (pushToken) return; // 🔁 este teléfono ya recibe los avisos del servidor: no repetir el mismo aviso desde la app
    try {
      const reg = swReg || await navigator.serviceWorker?.getRegistration();
      if (reg) return stackNotify(reg, title, body, url);
      return new Notification(title, { body, icon: 'icons/icon-192.png', tag: 'angelito', renotify: true });
    } catch { }
  }
  toast(body ? `${title} · ${body}` : title);
}
let pushDone = false, pushToken = '';
// Este teléfono tiene un número propio: lo que tú mandes desde aquí (avisos, actividades) no te llega como notificación a ti mismo
const DEV = (() => { try { let d = localStorage.getItem('angelito:dev'); if (!d) { d = Math.random().toString(36).slice(2, 12); localStorage.setItem('angelito:dev', d); } return d; } catch { return ''; } })();
// Un registro por teléfono (puedes tener la app en varios): guarda qué avisos NO quieres para que el servidor tampoco los mande.
const tokenId = t => { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) | 0; return `${S.uid}_${(h >>> 0).toString(36)}`; };
async function syncPushPrefs() {
  if (!pushToken || !S.uid) return;
  const o = nprefs(), off = Object.keys(NCAT).filter(k => o[k] === false);
  try {
    await setDoc(doc(db, 'fcmTokens', tokenId(pushToken)), { uid: S.uid, token: pushToken, off, dev: DEV, at: serverTimestamp() });
    if (!syncPushPrefs.old) { syncPushPrefs.old = true; { const w = writeBatch(db); w.delete(doc(db, 'fcmTokens', S.uid)); await w.commit().catch(() => { }); } } // formato viejo (uno por persona)
  } catch (e) { console.warn('push prefs', e); }
}
async function registerPush() {
  if (pushDone || !VAPID_KEY || !swReg || !S.uid) return; pushDone = true;
  try {
    const m = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js');
    if (!(await m.isSupported())) return;
    const messaging = m.getMessaging(app);
    const token = await m.getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
    if (token && S.uid) { pushToken = token; await syncPushPrefs(); }
    // con la app abierta los avisos ya salen desde aquí; el servidor solo cuenta cuando está cerrada
    m.onMessage(messaging, () => { });
  } catch (e) {
    // "Registration failed - push service error" (AbortError): el navegador no alcanzó el servicio de avisos
    // (Brave con push de Google apagado, incógnito, VPN o red que bloquea fcmregistrations.googleapis.com, o una
    // suscripción vieja trabada). Se reintenta un par de veces; la app sigue funcionando igual.
    console.warn('push', e); pushDone = false; S.pushFail = (S.pushFail || 0) + 1;
    if (e?.name === 'AbortError' && S.pushFail === 1) { try { const sub = await swReg?.pushManager?.getSubscription(); await sub?.unsubscribe(); } catch { } }
    if (S.pushFail <= 3) setTimeout(registerPush, 20000 * S.pushFail);
  }
}
// El navegador ya no deja preguntar si se bloquearon: se explica cómo permitirlas desde el teléfono.
function notifHelp() {
  const inst = isStandalone();
  openModal(`<div style="text-align:center"><div style="font-size:44px">🔕</div><h3>Los avisos están bloqueados</h3></div>
    <p class="muted">Así te enteras de mensajes, pistas de tu angelito y cambios del evento. Para permitirlos:</p>
    <ol class="helpsteps">${inst
      ? '<li>Mantén presionado el ícono del <b>Angelito</b> en tu pantalla</li><li>Toca <b>ⓘ Información de la app</b></li><li>Entra a <b>Notificaciones</b> y actívalas</li>'
      : '<li>Toca el <b>🔒</b> (o ⓘ) al lado de la dirección, arriba</li><li>Entra a <b>Permisos</b> o <b>Configuración del sitio</b></li><li>En <b>Notificaciones</b> elige <b>Permitir</b></li><li>Vuelve aquí y recarga</li>'}</ol>
    <div class="actions"><button class="btn" data-a="close">Luego</button><button class="btn gold" data-a="reload">Ya las permití</button></div>`)
    .onclick = e => { const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; closeModal(); if (a === 'reload') { if (Notification.permission === 'granted') { registerPush(); toast('🔔 ¡Listo!'); render(); } else location.reload(); } };
}
async function enableNotifications() {
  if (!canNotify()) {
    return openModal(`<h3>🔔 Notificaciones</h3><p class="muted">${isIOS() ? 'En iPhone primero instala la app: toca <b>Compartir</b> ⬆️ y luego <b>"Agregar a inicio"</b>. Después ábrela desde el ícono y activa las notificaciones.' : 'Este navegador no permite notificaciones.'}</p><div class="actions"><button class="btn gold" data-a="ok">Entendido</button></div>`).onclick = e => { if (e.target.closest('[data-a]')) closeModal(); };
  }
  if (Notification.permission === 'denied') return notifHelp();
  const r = await Notification.requestPermission();
  if (r === 'granted') { toast('🔔 ¡Listo! Te avisaremos de lo importante'); registerPush(); notifyUser('🔔 Notificaciones activadas', 'Así se verán los avisos del angelito.'); }
  else if (r === 'denied') notifHelp(); else toast('Cuando quieras, actívalas desde el 💡 o en tu menú → Notificaciones.');
  render();
}
/* ---------- 📲 descargar, reinstalar y reparar la app ---------- */
const DL_URL = () => location.origin + location.pathname.replace(/index\.html$/, '') + '?instalar=1';
const inAppBrowser = () => /FBAN|FBAV|Instagram|Line\/|WhatsApp|; wv\)/i.test(navigator.userAgent);
// Borra la copia guardada de la app (no tus datos ni tu sesión) y la vuelve a bajar completa
async function repairApp() {
  toast('🔧 Reparando la app…');
  try { for (const r of await navigator.serviceWorker?.getRegistrations() || []) await r.unregister(); } catch { }
  try { for (const k of await caches.keys()) await caches.delete(k); } catch { }
  try { localStorage.removeItem('angelito:boot:v1'); } catch { }
  setTimeout(() => location.replace(location.pathname + '?v=' + Date.now() + location.hash), 400);
}
// Opción para todos (menú de tu nombre): instalar, o reparar si ya la tiene y da error
function appSheet() {
  const inst = isInstalled();
  const s2 = openModal(`<div class="dlh"><div class="dlh-ic">🎁</div><h3>${inst ? 'Tu app del angelito' : 'Descarga la app'}</h3><p class="muted small">${inst ? 'Si algo no se ve bien o te da error, prueba en este orden:' : 'Te queda un ícono en la pantalla de inicio: abre al instante, funciona sin internet y te llegan los avisos.'}</p></div>
    <div class="mlist" style="margin-top:12px">
      ${inst ? `<button class="mrow" data-a="fix"><span class="me-e">🔧</span><span class="grow"><b>1. Reparar la app</b><span class="muted small">Baja de nuevo la última versión. No borra nada tuyo.</span></span><span class="chev">›</span></button>
      <button class="mrow" data-a="data"><span class="me-e">${ic('refresh', 22)}</span><span class="grow"><b>2. Recargar los datos</b><span class="muted small">Si falta gente, mensajes o deseos.</span></span><span class="chev">›</span></button>
      <button class="mrow" data-a="re"><span class="me-e">📲</span><span class="grow"><b>3. Volver a instalarla</b><span class="muted small">Si sigue fallando: quítala y ponla otra vez.</span></span><span class="chev">›</span></button>`
      : `<button class="btn gold big" data-a="inst" style="width:100%">📲 Instalar ahora</button>`}
    </div><div class="actions"><button class="btn" data-a="x">Cerrar</button></div>`);
  s2.onclick = e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'x') return closeModal();
    if (a === 'fix') { closeModal(); return repairApp(); }
    if (a === 'data') { closeModal(); return repairData(); }
    if (a === 'inst') { closeModal(); return installApp(); }
    if (a === 're') return openModal(`<h3>📲 Volver a instalarla</h3><ol class="hc-steps" style="padding-left:20px;margin-top:12px"><li>Mantén presionado el ícono 🎁 del angelito en tu pantalla y toca <b>Desinstalar</b> (en iPhone: <b>Eliminar app</b>). Tus datos no se pierden: están guardados en la nube.</li><li>Abre este enlace en ${isIOS() ? '<b>Safari</b>' : '<b>Chrome</b>'}: <b>${esc(DL_URL())}</b></li><li>Toca <b>Instalar</b> y entra con tu nombre y tu PIN.</li></ol><div class="actions"><button class="btn" data-a="copy">📋 Copiar enlace</button><button class="btn gold" data-a="x">Listo</button></div>`).onclick = ev => { const b = ev.target.closest('[data-a]')?.dataset.a; if (b === 'copy') copyText(DL_URL(), '📋 Enlace copiado'); if (b === 'x') closeModal(); };
  };
}
// Quien abre el enlace de descarga (?instalar=1) ve de una vez la invitación a instalar
function landingInstall() {
  let want = false; try { want = new URLSearchParams(location.search).has('instalar'); } catch { }
  if (!want) return;
  try { history.replaceState(history.state, '', location.pathname + location.hash); } catch { }
  if (isStandalone()) return toast('✅ Ya tienes la app instalada');
  const go = () => {
    if (inAppBrowser()) return openModal(`<div class="dlh"><div class="dlh-ic">🎁</div><h3>Ábrelo en tu navegador</h3><p class="muted small">Desde WhatsApp o Instagram no se puede instalar. Toca los tres puntitos <b>⋮</b> de arriba y elige <b>Abrir en ${isIOS() ? 'Safari' : 'Chrome'}</b>.</p></div><div class="actions"><button class="btn" data-a="copy">📋 Copiar enlace</button><button class="btn gold" data-a="x">Entendido</button></div>`).onclick = e => { const b = e.target.closest('[data-a]')?.dataset.a; if (b === 'copy') copyText(DL_URL(), '📋 Enlace copiado'); if (b === 'x') closeModal(); };
    appSheet();
  };
  setTimeout(go, 900); // da tiempo a que el navegador avise que se puede instalar
}
// Organizador: el enlace listo para mandar
function renderDlLink() {
  const box = $('#dl-link'); if (!box) return; const url = DL_URL();
  if (box.dataset.u === url) return; box.dataset.u = url;
  box.innerHTML = `<div class="dl-url"><span>${esc(url)}</span></div><div class="ar-tools" style="--n:3;border:0;padding-top:8px"><button type="button" data-dl="copy"><span>📋</span>Copiar</button><button type="button" data-dl="wa"><span>💬</span>WhatsApp</button><button type="button" data-dl="share"><span>📤</span>Compartir</button></div>`;
}
$('#dl-link').addEventListener('click', e => {
  const k = e.target.closest('[data-dl]')?.dataset.dl; if (!k) return;
  const url = DL_URL(), txt = `🎁 Descarga la app del angelito aquí y entra con tu nombre: ${url}`;
  if (k === 'copy') return copyText(url, '📋 Enlace copiado');
  if (k === 'wa') return open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank', 'noopener');
  if (navigator.share) navigator.share({ text: txt }).catch(() => { }); else copyText(txt, '📋 Mensaje copiado');
});
function installApp() {
  if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; render(); }); return; }
  openModal(`<h3>📲 Instala la app</h3>
    ${isIOS() ? `<ol class="stack" style="padding-left:18px;margin-top:10px;line-height:1.5"><li>Abre esta página en <b>Safari</b>.</li><li>Toca el botón <b>Compartir</b> ⬆️ (abajo).</li><li>Elige <b>"Agregar a inicio"</b> y luego <b>Agregar</b>.</li></ol>`
      : `<ol class="stack" style="padding-left:18px;margin-top:10px;line-height:1.5"><li>Abre el menú del navegador <b>⋮</b>.</li><li>Toca <b>"Instalar app"</b> o <b>"Agregar a pantalla principal"</b>.</li></ol>`}
    <p class="muted small" style="margin-top:12px">Te queda un ícono 🎁 como cualquier otra app.</p>
    <div class="actions"><button class="btn gold" data-a="ok">Entendido</button></div>`).onclick = e => { if (e.target.closest('[data-a]')) closeModal(); };
}
const hideKey = 'angelito:hideAppCard';
// Ya no hay tarjetas en Inicio: solo el ícono 📲 arriba (para quien no la ha instalado) y una ventana que lo invita.
// ¿Ya está instalada? En la app abierta se sabe por el modo standalone; en el navegador, por una marca que
// guardamos al instalarla o al abrirla instalada, y en Chrome Android también preguntándole al sistema.
const INSTALLED_KEY = 'angelito:installed';
let relatedInstalled = false;
const isInstalled = () => { if (isStandalone()) { try { localStorage.setItem(INSTALLED_KEY, '1'); } catch { } return true; } try { if (localStorage.getItem(INSTALLED_KEY) === '1') return true; } catch { } return relatedInstalled; };
try { navigator.getInstalledRelatedApps?.().then(l => { if (l && l.length) { relatedInstalled = true; try { localStorage.setItem(INSTALLED_KEY, '1'); } catch { } render(); } }).catch(() => { }); } catch { }
function renderAppCard() {
  const box = $('#h-app'); if (box) box.innerHTML = '';
  const ib = $('#inst-btn'); if (ib) ib.hidden = isInstalled();
  maybeTour(); maybeAskNotif(); // también al entrar, no solo al registrarse
}
const INST_KEY = 'angelito:askInstall';
let instT = null;
function maybeAskInstall() {
  if (isInstalled() || instT) return;
  let last = 0; try { last = +localStorage.getItem(INST_KEY) || 0; } catch { }
  if (Date.now() - last < 2 * 864e5) return; // "Ahora no" vuelve a preguntar en 2 días
  const busyNow = () => S.spinning || S.forcePin || (typeof PARTY !== 'undefined' && PARTY) || location.hash.startsWith('#juego-') || location.hash === '#ruleta'
    || location.hash === '#admin' || document.body.classList.contains('kb') || $('#modal').classList.contains('on') || $('#csel').classList.contains('on') || !!tourT;
  const tryAsk = () => {
    instT = null; if (isInstalled()) return;
    if (busyNow()) { instT = setTimeout(tryAsk, 8000); return; }
    openModal(`<div style="text-align:center"><div class="ab-ic" style="margin:0 auto 10px">🎁</div><h3>Instala la app del angelito</h3>
      <p class="muted">Ábrela con un toque desde tu pantalla de inicio, como cualquier otra app.</p>
      <div class="inst-pts"><span>⚡ Más rápida</span><span>🔔 Avisos</span><span>📷 Fotos fácil</span></div>
      <p class="muted small">Si ahora no, la encuentras arriba en 📲.</p></div>
      <div class="actions"><button class="btn" data-a="no">Ahora no</button><button class="btn gold" data-a="ok">📲 ${isIOS() ? 'Cómo instalarla' : 'Instalar'}</button></div>`).onclick = e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      try { localStorage.setItem(INST_KEY, String(Date.now())); } catch { }
      closeModal(); if (a === 'ok') setTimeout(installApp, 120);
    };
  };
  instT = setTimeout(tryAsk, 2000);
}
document.addEventListener('click', e => { if (e.target.closest('#inst-btn')) installApp(); });

/* ---------- avisos del organizador ---------- */
const seenKey = 'angelito:seenNotices';
const seen = () => { try { return new Set(JSON.parse(localStorage.getItem(seenKey) || '[]')); } catch { return new Set(); } };
const markSeen = id => { const s = seen(); s.add(id); try { localStorage.setItem(seenKey, JSON.stringify([...s].slice(-200))); } catch { } };
const AUD = { all: 'Todos', unpaid: 'Los que no han dado su aporte', pending: 'Los que no han confirmado si van' };
function noticeForMe(n) {
  if (!S.me) return false;
  const a = S.att[S.uid] || {};
  if (n.target === 'unpaid') return a.status === 'si' && !a.confirmed;
  if (n.target === 'pending') return !a.status;
  return true;
}
function renderNotices() {
  const box = $('#h-notices'); if (!box) return;
  const ss = seen(), list = S.notices.filter(n => noticeForMe(n) && !ss.has(n.id)).slice(0, 3);
  box.innerHTML = list.map(n => `<div class="banner" style="align-items:flex-start"><span style="font-size:22px">📣</span><div style="flex:1"><b>${esc(n.title)}</b>${n.body ? `<div class="small" style="margin-top:2px;white-space:pre-wrap">${esc(n.body)}</div>` : ''}<div class="muted small" style="margin-top:4px">Aviso del organizador</div></div><button class="x" data-nseen="${esc(n.id)}" aria-label="Cerrar">✕</button></div>`).join('');
}
$('#h-notices').addEventListener('click', e => { const b = e.target.closest('[data-nseen]'); if (b) { markSeen(b.dataset.nseen); renderNotices(); } });

/* ---------- vigilante de eventos (para avisar) ---------- */
let EV = null, evTimer = null;
function snapshotEv() {
  const rec = S.assignment?.revealed ? S.assignment.recipient : null;
  return {
    draw: ms(S.drawMeta?.at) || (S.drawMeta ? 1 : 0), inc: S.incoming?.status || '', rev: isRevealed(), gopen: guessesOpen(),
    thx: !!S.thanksFromRec?.received, chatIds: S.chat.map(m => m.id), picks: S.myPicks.length, hints: S.hintsIn.length, reveal: !!S.reveal,
    results: S.activities.filter(a => a.resultsOpen).map(a => a.id), notices: S.notices.map(n => n.id),
    sugs: S.suggestions.map(x => x.id), acts: S.activities.map(a => a.id), rec,
    recWishes: rec ? S.wishes.filter(w => w.uid === rec).map(w => w.id) : [],
    ev: [S.event.eventName, S.event.eventDate, S.event.place].join('|'), rules: JSON.stringify(S.event.rules || [])
  };
}
function checkEvents() {
  if (!S.me) { EV = null; clearTimeout(evTimer); evTimer = null; return; }
  if (!EV) { if (!evTimer) evTimer = setTimeout(() => { EV = snapshotEv(); evTimer = null; onOpenReminders(); resumePending(); }, 2500); return; }
  const now = snapshotEv(), was = EV; EV = now;
  const added = (k) => now[k].filter(x => !was[k].includes(x));
  if (now.draw && now.draw !== was.draw && S.drawMeta?.ids?.includes(S.uid)) notifyCat('avisos', '🎡 ¡La ruleta ya está habilitada!', 'Entra y descubre a quién te toca regalar.', './#ruleta');
  if (now.inc && now.inc !== was.inc && GS_IN[now.inc]) notifyCat('angelito', `${GS_IN[now.inc][0]} Noticias de tu angelito`, GS_IN[now.inc][1], './#ruleta');
  if (now.rev && !was.rev) notifyCat('avisos', '💌 ¡Se abrió el buzón anónimo!', 'Ya puedes leer todos los mensajes.', './#anonimos');
  if (now.gopen && !was.gopen) notifyCat('avisos', '🔮 Se revelaron las adivinanzas', '¿Quién se acercó más?', './#ruleta');
  if (now.hints > was.hints) notifyCat('angelito', '💌 ¡Tu angelito te mandó una pista!', S.hintsIn.slice().sort((a, b) => (b.ts || 0) - (a.ts || 0))[0]?.text || '', './#ruleta', n => `💌 Tu angelito te mandó ${n} pistas`);
  if (now.reveal && !was.reveal) notifyCat('avisos', '🎉 ¡La gran revelación!', 'Entra a ver quién era el angelito de quién.', './#ruleta');
  if (now.thx && !was.thx) notifyCat('angelito', '💛 ¡Tu persona recibió tu regalo!', 'Te dejó un mensaje. Entra a verlo.', './#ruleta');
  if (now.picks > was.picks) notifyCat('actividades', '🎭 Te tocó algo en una actividad', 'Entra a Agenda para verlo.', './#actividades');
  added('results').forEach(id => { const a = S.activities.find(x => x.id === id); if (a) notifyCat('actividades', '🏆 Resultados publicados', a.title, './#actividad-' + id); });
  const mine = Date.now() - (S.selfEditAt || 0) < 8000;
  if (!mine) added('acts').forEach(id => { const a = S.activities.find(x => x.id === id); if (a) notifyCat('actividades', `📅 Nueva actividad: ${a.title}`, actWhen(a), './#actividad-' + id, n => `📅 ${n} actividades nuevas en la agenda`); });
  // chat: cada mensaje avisa (la notificación nueva reemplaza la anterior); si te mencionan, aviso aparte aunque silencies el chat
  const readTo = Math.max(seenTs('chatSeen'), S.chatSeenAll?.[S.uid] || 0); // lo que ya leíste (aquí o en otro teléfono) no se avisa
  const newMsgs = added('chatIds').map(id => S.chat.find(m => m.id === id)).filter(m => m && m.uid !== S.uid && (m.ts || 0) > readTo);
  const viewingChat = !document.hidden && $('#v-buzon').classList.contains('on') && S.buz === 'c';
  const tagged = newMsgs.filter(m => (m.mentions || []).includes(S.uid) || (m.mentions || []).includes('all'));
  if (tagged.length && !viewingChat) { const m = tagged[tagged.length - 1]; notifyCat('mencion', `📣 ${shortName(P(m.uid)) || 'Alguien'} te mencionó`, m.text.slice(0, 120), './#chat'); if (navigator.vibrate) try { navigator.vibrate([60, 40, 60]); } catch { } }
  else if (newMsgs.length && !viewingChat) { const m = newMsgs[newMsgs.length - 1]; const who = shortName(P(m.uid)) || 'Chat', txt = (m.text || '').trim() || '📷 Foto'; notifyCat('chat', `💬 ${who}`, txt.slice(0, 140), './#chat', () => `💬 ${who} (${chatUnread()} mensajes)`); } // como WhatsApp: nombre arriba, mensaje abajo
  const newSugs = added('sugs').filter(id => !S.myCreated.has(id) && S.suggestions.find(x => x.id === id)?.uid !== S.uid);
  if (newSugs.length) { const x = S.suggestions.find(y => y.id === newSugs[newSugs.length - 1]); notifyCat('sugerencias', '💡 Nueva sugerencia', (x?.text || '').slice(0, 120) + ' · ¡Vota 👍!', './#sugerencias', n => `💡 ${n} sugerencias nuevas para votar`); }
  if (now.rec && now.rec === was.rec) { const nw = added('recWishes'); if (nw.length) { const w = S.wishes.find(x => x.id === nw[nw.length - 1]); notifyCat('deseos', '🎁 Tu persona agregó un deseo nuevo', 'Entra a verlo 👀', './#deseos', n => `🎁 Tu persona agregó ${n} deseos nuevos`); } }
  if (!mine && was.ev !== now.ev && was.ev !== '||') notifyCat('evento', '🎄 Cambió la información del evento', `${fmtDate(S.event.eventDate) || ''}${S.event.place ? ' · 📍 ' + S.event.place : ''}`, './');
  if (!mine && was.rules !== now.rules && was.rules !== '[]') notifyCat('evento', '📜 Se actualizaron las reglas del angelito', 'Échales un vistazo en Inicio.', './');
  added('notices').map(id => S.notices.find(n => n.id === id)).filter(n => n && noticeForMe(n) && !seen().has(n.id) && n.dev !== DEV).forEach(n => notifyCat('avisos', '📣 ' + n.title, n.body || '', './'));
}
function onOpenReminders() {
  try { milestoneReminders(); } catch (e) { console.warn(e); }
  const c = S.event, a = S.att[S.uid] || {}, day = todayStr();
  let last = ''; try { last = localStorage.getItem('angelito:remind:' + S.uid) || ''; } catch { }
  if (last === day) return;
  let sent = false;
  if (!document.hidden) return; // con la app abierta ya lo ve en "Tus pendientes"
  if (mod('asistencia') && !a.status) { notifyUser('🎉 ¿Vas al angelito?', 'Confirma tu asistencia en Inicio.', './', 'att'); sent = true; }
  else if (mod('asistencia') && c.contribAmount && a.status === 'si' && !a.confirmed && !a.paid) { notifyUser('💵 Recuerda dar tu aporte', `${c.contribAmount}${c.contribInfo ? ' · ' + c.contribInfo : ''}`, './', 'pay'); sent = true; }
  if (sent) try { localStorage.setItem('angelito:remind:' + S.uid, day); } catch { }
}

/* ---------- admin: avisos ---------- */
function renderNoticeAdmin() {
  if (!S.isAdmin) return;
  $('#n-list').innerHTML = S.notices.length ? S.notices.slice(0, 15).map(n => `<div class="item"><span style="font-size:20px">📣</span><div class="grow"><div class="t">${esc(n.title)}</div>${n.body ? `<div class="muted small">${esc(n.body)}</div>` : ''}<div class="muted small" style="margin-top:4px">Para: ${esc(AUD[n.target] || 'Todos')} · ${esc(`${new Date(n.ts || 0).toLocaleDateString('es', { day: 'numeric', month: 'short' })}, ${hm(new Date(n.ts || 0))}`)}</div></div><button class="x" data-ndel="${esc(n.id)}" aria-label="Borrar">✕</button></div>`).join('') : '<p class="muted small">No has enviado avisos.</p>';
}
async function sendNotice(title, body, target) {
  try { await setDoc(doc(collection(adb, 'notices')), { title, body, target, ts: Date.now(), at: serverTimestamp(), dev: DEV }); S.selfEditAt = Date.now(); toast('📣 Aviso enviado'); return true; }
  catch (err) { toast(authErr(err)); return false; }
}
$('#n-form').addEventListener('submit', async e => {
  e.preventDefault(); const t = $('#n-title').value.trim(), b = $('#n-body').value.trim(), g = $('#n-target').value;
  if (!t) return toast('Escribe el título del aviso');
  if (await sendNotice(t, b, g)) { $('#n-title').value = $('#n-body').value = ''; }
});
$('#n-list').addEventListener('click', async e => {
  const b = e.target.closest('[data-ndel]'); if (!b) return;
  if (!(await confirmBox('¿Borrar este aviso?', 'Desaparece para todos.', 'Borrar'))) return;
  try { const w = writeBatch(adb); w.delete(doc(adb, 'notices', b.dataset.ndel)); await w.commit(); toast('Aviso borrado'); } catch (err) { toast(authErr(err)); }
});
$('#att-remind').addEventListener('click', async () => {
  const c = S.event; const n = attSummary(); const pend = n.going - n.paid;
  if (!pend) return toast('¡Todos los que van ya dieron su aporte! 🎉');
  if (!(await confirmBox('¿Enviar recordatorio?', `Le llegará a ${pend} ${pend === 1 ? 'persona que no ha' : 'personas que no han'} dado su aporte.`, 'Enviar'))) return;
  sendNotice('💵 Recuerda tu aporte', `${c.contribAmount || ''}${c.contribInfo ? ' · ' + c.contribInfo : ''}`.trim(), 'unpaid');
});
$('#att-remind2').addEventListener('click', async () => {
  const n = attSummary(); if (!n.pending) return toast('Todos ya respondieron 🎉');
  if (!(await confirmBox('¿Enviar recordatorio?', `Le llegará a ${n.pending} ${n.pending === 1 ? 'persona' : 'personas'} que no han confirmado.`, 'Enviar'))) return;
  sendNotice('🎉 ¿Vas al angelito?', 'Confirma tu asistencia en Inicio.', 'pending');
});

/* ---------- notificaciones inteligentes ---------- */
// [emoji, nombre, minutos mínimos entre avisos del mismo tipo]
const NCAT = {
  chat: ['💬', 'Mensajes del chat', 0], mencion: ['📣', 'Cuando te mencionan con @', 0], sugerencias: ['💡', 'Sugerencias nuevas', 30], actividades: ['📅', 'Actividades nuevas y resultados', 10],
  deseos: ['🎁', 'Deseos nuevos de tu persona', 30], evento: ['🎄', 'Cambios del evento (fecha, lugar, reglas)', 10],
  angelito: ['💌', 'Pistas y noticias de tu angelito', 5], juegos: ['🎮', 'Te toca jugar', 1], aportes: ['💵', 'Quién ya pagó el aporte', 0], deseos: ['🎁', 'Cuando alguien agrega o cambia sus deseos', 0], avisos: ['📣', 'Avisos, sorteo y recordatorios', 0]
};
const NP_KEY = 'angelito:nprefs', NS_KEY = 'angelito:nstate';
const nprefs = () => { try { return { quiet: true, ...JSON.parse(localStorage.getItem(NP_KEY) || '{}') }; } catch { return { quiet: true }; } };
const saveNP = o => { try { localStorage.setItem(NP_KEY, JSON.stringify(o)); } catch { } clearTimeout(saveNP.t); saveNP.t = setTimeout(() => syncPushPrefs(), 800); };
const nstate = () => { try { return { last: {}, pend: {}, ...JSON.parse(localStorage.getItem(NS_KEY) || '{}') }; } catch { return { last: {}, pend: {} }; } };
const saveNS = o => { try { localStorage.setItem(NS_KEY, JSON.stringify(o)); } catch { } };
const quietNow = () => { const h = new Date().getHours(); return nprefs().quiet && (h >= 22 || h < 8); };
const flushT = {};
function notifyCat(cat, title, body, url, groupTitle) {
  if (nprefs()[cat] === false) return;
  const cd = (NCAT[cat]?.[2] || 0) * 60000, st = nstate(), now = Date.now();
  if (!cd || now - (st.last[cat] || 0) >= cd) { st.last[cat] = now; delete st.pend[cat]; saveNS(st); return notifyUser(title, body, url, cat); }
  const p = st.pend[cat] || { n: 0 }; p.n++; p.title = groupTitle ? groupTitle(p.n + 1) : title; p.body = body; p.url = url;
  st.pend[cat] = p; saveNS(st); scheduleFlush(cat, (st.last[cat] || 0) + cd - now);
}
function scheduleFlush(cat, delay) {
  clearTimeout(flushT[cat]);
  flushT[cat] = setTimeout(() => {
    const st = nstate(), p = st.pend[cat]; if (!p || nprefs()[cat] === false) { delete st.pend[cat]; saveNS(st); return; }
    if (cat === 'chat' && chatUnread() === 0) { delete st.pend[cat]; saveNS(st); return; } // ya lo leyó
    st.last[cat] = Date.now(); delete st.pend[cat]; saveNS(st); notifyUser(p.title, p.body, p.url, cat);
  }, Math.max(1500, delay));
}
function resumePending() { const st = nstate(); for (const c of Object.keys(st.pend)) scheduleFlush(c, (st.last[c] || 0) + (NCAT[c]?.[2] || 0) * 60000 - Date.now()); }

/* ---------- puntos rojos (sin leer) ---------- */
const seenTs = k => { try { return +localStorage.getItem(`angelito:${k}:${S.uid}`) || 0; } catch { return 0; } };
const setSeen = (k, v) => { try { localStorage.setItem(`angelito:${k}:${S.uid}`, String(v)); } catch { } };
function chatUnread() { if (!S.me) return 0; const t = Math.max(seenTs('chatSeen'), S.chatSeenAll?.[S.uid] || 0); return S.chat.filter(m => m.uid !== S.uid && (m.ts || 0) > t).length; }
function sugUnread() { if (!S.me) return 0; const t = seenTs('sugSeen'); return S.suggestions.filter(x => sTs(x) > t && x.uid !== S.uid && !S.myCreated.has(x.id)).length; }
// 👁️ «Visto»: guarda hasta qué mensaje leíste. Así el aviso del teléfono no te llega por lo que ya viste,
// los avisos viejos del chat se borran al abrirlo, y el grupo puede ver quién leyó cada mensaje.
let seenSent = 0, seenT = 0;
function markChatSeen(mx) {
  if (!S.me || !mx || mx <= seenSent || mx <= (S.chatSeenAll?.[S.uid] || 0)) return;
  clearTimeout(seenT); seenT = setTimeout(() => {
    seenSent = mx; setDoc(doc(db, 'chatSeen', S.uid), { ts: Math.min(mx, Date.now()), at: serverTimestamp() }).catch(() => { seenSent = 0; });
    navigator.serviceWorker?.ready.then(r => r.getNotifications()).then(ns => ns.forEach(n => { const d = n.data || {}, items = d.items || []; if (/chat/.test(d.url || '') || (items.length && items.every(x => /💬|📣/.test(x.e || '')))) n.close(); })).catch(() => { });
  }, 1200);
}
const seenBy = m => S.participants.filter(p => p.id !== m.uid && (S.chatSeenAll?.[p.id] || 0) >= (m.ts || 0));
function showSeen(m) {
  const yes = seenBy(m), no = S.participants.filter(p => p.id !== m.uid && !yes.includes(p)); let tab = 'si';
  const s2 = openModal(`<h3>👁️ Visto por</h3><p class="muted small" style="margin-top:2px">${esc(m.text.slice(0, 80))}</p><div class="sw-tabs"></div><div class="rxw-list"></div><div class="actions"><button class="btn gold" data-a="x">Listo</button></div>`);
  const paint = () => {
    s2.querySelector('.sw-tabs').innerHTML = chipTabs([['si', '✓✓ Lo vieron', yes.length], ['no', '🕓 Todavía no', no.length]], tab, 'sw');
    const l = tab === 'si' ? yes : no;
    s2.querySelector('.rxw-list').innerHTML = l.length ? l.map(p => `<div class="rxw-row"><span class="rxw-av">${esc(p.emoji)}</span><span class="grow"><b>${p.id === S.uid ? 'Tú' : esc(p.name)}</b></span></div>`).join('') : `<p class="ar-empty">${tab === 'si' ? 'Nadie lo ha visto todavía' : '🎉 Ya lo vieron todos'}</p>`;
  };
  paint(); s2.onclick = e => { const t = e.target.closest('[data-sw]'); if (t) { tab = t.dataset.sw; return paint(); } if (e.target.closest('[data-a]')) closeModal(); };
}
function renderBadges() {
  const onBuzon = !document.hidden && $('#v-buzon').classList.contains('on');
  if (S.me && onBuzon && S.buz === 'c' && S.chat.length) { const mx = Math.max(...S.chat.map(m => m.ts || 0)); if (mx > seenTs('chatSeen')) setSeen('chatSeen', mx); markChatSeen(mx); }
  if (S.me && onBuzon && S.buz === 's' && S.suggestions.length) { const mx = Math.max(...S.suggestions.map(x => sTs(x))); if (mx > seenTs('sugSeen')) setSeen('sugSeen', mx); }
  const c = mod('chat') ? chatUnread() : 0, g = mod('buzon') ? sugUnread() : 0;
  const put = (el, n) => { if (!el) return; let b = el.querySelector('.bd'); if (!n) { b?.remove(); return; } if (!b) { b = document.createElement('span'); b.className = 'bd'; el.appendChild(b); } b.textContent = n > 99 ? '99+' : n; };
  put($('.tab[data-v=buzon]'), c); put($('.tab[data-v=sugerencias]'), g); put($('#buz-seg [data-b=c]'), c); put($('#buz-seg [data-b=s]'), g);
  const spinNow = !!(S.me && mod('ruleta') && S.drawMeta && drawReady() && S.drawMeta.ids?.includes(S.uid) && !S.assignment?.revealed);
  put($('.tab[data-v=ruleta]'), spinNow ? '!' : 0);
  let myTurn = 0; try { myTurn = S.me ? GAMES.active() : 0; } catch { } put($('.tab[data-v=juegos]'), myTurn);
  const mb = $('#c-mute'); if (mb) { const off = nprefs().chat === false, k = off ? 'off' : 'on'; if (mb.dataset.k !== k) { mb.dataset.k = k; mb.innerHTML = ic(off ? 'belloff' : 'bell', 20); mb.classList.toggle('on', !off); } }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

/* ---------- preferencias ---------- */
function openNotifPrefs() {
  const pr = nprefs(), perm = canNotify() ? Notification.permission : 'na';
  const s2 = openModal(`<h3>🔔 Notificaciones</h3>
    ${perm === 'granted' ? '<p class="muted small">✅ Activas en este teléfono. Elige qué quieres recibir:</p>'
      : perm === 'denied' ? '<p class="muted small">⚠️ Las bloqueaste en el navegador. Actívalas en los ajustes del navegador para este sitio. Mientras, verás los avisos dentro de la app.</p>'
      : perm === 'na' ? `<p class="muted small">${isIOS() ? 'En iPhone, primero instala la app (Compartir → Agregar a inicio).' : 'Este navegador no las permite.'} Verás los avisos dentro de la app.</p>`
      : '<button class="btn gold" data-a="enable" style="width:100%;margin:6px 0 8px">🔔 Activar notificaciones</button>'}
    <div class="stack" style="margin-top:10px">${Object.entries(NCAT).map(([k, [e, l, m]]) => `<div class="switch"><div><b>${e} ${l}</b>${m ? `<div class="muted small">Máximo 1 cada ${m} min, agrupadas</div>` : ''}</div><button class="tg ${pr[k] === false ? '' : 'on'}" data-np2="${k}" aria-label="${esc(l)}"></button></div>`).join('')}
    <div class="switch"><div><b>🌙 Horario de silencio</b><div class="muted small">De 10 pm a 8 am no suena nada</div></div><button class="tg ${pr.quiet ? 'on' : ''}" data-np2="quiet" aria-label="Horario de silencio"></button></div></div>
    <div class="actions"><button class="btn gold" data-a="x">Listo</button></div>`);
  s2.onclick = async e => {
    const t = e.target.closest('[data-np2]');
    if (t) { const o = nprefs(), k = t.dataset.np2; o[k] = k === 'quiet' ? !o.quiet : o[k] === false; saveNP(o); t.classList.toggle('on'); renderBadges(); return; }
    const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'x') closeModal(); if (a === 'enable') { closeModal(); await enableNotifications(); openNotifPrefs(); }
  };
}
document.addEventListener('click', e => {
  if (e.target.closest('#c-mute')) { const o = nprefs(); o.chat = o.chat === false; saveNP(o); toast(o.chat === false ? '🔕 Chat silenciado (igual te avisamos si te mencionan con @)' : '🔔 Te avisaremos del chat'); renderBadges(); }
});

