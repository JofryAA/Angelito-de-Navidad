/* Angelito de Navidad · la app (datos, pantallas y panel). Los juegos viven en juegos.js. */
import * as CFG from '../firebase-config.js';
const { firebaseConfig, ADMIN_EMAIL } = CFG; const VAPID_KEY = CFG.VAPID_KEY || '';
const APP_VERSION = '2026.11.13-114418';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, deleteUser, updatePassword, reauthenticateWithCredential, EmailAuthProvider, setPersistence, browserSessionPersistence, inMemoryPersistence } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initGames } from './juegos.js';
import { decoratePanel, navHTML, pic, fillPics } from './panel.js';
import { runTransaction, deleteField, terminate, clearIndexedDbPersistence, getFirestore, getDocsFromServer, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, setDoc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit, writeBatch, increment, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ms = t => !t ? 0 : typeof t.toMillis === 'function' ? t.toMillis() : typeof t === 'number' ? t : t.seconds != null ? t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6) : t.__t != null ? t.__t : t._ms != null ? t._ms : 0;
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const cap = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
const fmtDate = (s, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => {
  if (!s) return ''; const d = new Date(s.length <= 10 ? s + 'T12:00' : s); return isNaN(d) ? '' : cap(d.toLocaleDateString('es', opts));
};
// Hora siempre en formato de 12 horas: 7:30 p. m.
const hm = d => { let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0'), ap = h < 12 ? 'a. m.' : 'p. m.'; h = h % 12 || 12; return `${h}:${m} ${ap}`; };
const fmtTime = t => { if (!t) return ''; const [h, m] = t.split(':').map(Number); const d = new Date(); d.setHours(h, m); return hm(d); };
const normName = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
const titleCase = s => s.trim().replace(/\s+/g, ' ').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
const pinPass = pin => `ang#${pin}#elito`; // Firebase pide 6+ caracteres
const EMOJIS = ['🦌', '⛄', '🎄', '🌟', '🍪', '🔔', '🧦', '🎅', '🤶', '❄️', '🕯️', '🍬', '🧸', '🪅', '🎀', '🦉', '🐧', '🍫', '☃️', '🎻'];
const QCOLORS = ['#f7efe1', '#ffd9a8', '#cdeccf', '#ffc9c3', '#e9dcff', '#cfe6ff'];
const authErr = e => {
  const c = e?.code || '';
  if (c.includes('too-many-requests')) return 'Demasiados intentos. Espera unos minutos.';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-login')) return 'PIN incorrecto.';
  if (c.includes('network')) return 'Sin conexión. Revisa tu internet.';
  if (c.includes('permission-denied')) return 'No tienes permiso para hacer esto.';
  if (c.includes('operation-not-allowed')) return 'El registro con correo/contraseña no está activado en Firebase (avisa al organizador).';
  if (c.includes('unauthorized-domain')) return 'Este dominio no está autorizado en Firebase Authentication (avisa al organizador).';
  if (c.includes('app-check') || c.includes('appcheck')) return 'Falló la verificación anti-robots. Recarga la página e intenta otra vez.';
  if (c.includes('api-key') || c.includes('configuration-not-found')) return 'La configuración de Firebase es incorrecta (avisa al organizador).';
  if (c.includes('weak-password')) return 'Ese PIN es muy débil para Firebase. Prueba con otro.';
  return 'Algo salió mal. Intenta otra vez.' + (c ? ` (${c})` : '');
};

/* ---------- setup check ---------- */
const configured = firebaseConfig && firebaseConfig.apiKey && !/PEGA|TU_/i.test(firebaseConfig.apiKey);
if (!configured) {
  $('#app').innerHTML = `<div class="card setup"><h2 class="sec-title">🔧 Falta conectar Firebase</h2>
    <p>Abre el archivo <code>firebase-config.js</code> y pega los datos de tu proyecto de Firebase. Los pasos están en <code>LEEME.md</code>.</p></div>`;
  $('#tabs').style.display = 'none';
  throw new Error('Firebase no configurado');
}

/* ---------- firebase ---------- */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let db; try { db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); } catch (e) { db = getFirestore(app); } // datos guardados en el teléfono: abre al instante
const adminApp = initializeApp(firebaseConfig, 'organizador'); // sesión separada para el admin
const adminAuth = getAuth(adminApp);
setPersistence(adminAuth, browserSessionPersistence).catch(() => { }); // el modo organizador se cierra al cerrar la app (teléfonos prestados)
const adbOwn = getFirestore(adminApp);
let adb = adbOwn; // el panel usa la sesión de organizador; si quien entra es una persona inscrita con permisos, usa su propia sesión
const regApp = initializeApp(firebaseConfig, 'registro'); // para que el admin inscriba a otros sin cerrar sesiones
const regAuth = getAuth(regApp);
setPersistence(regAuth, inMemoryPersistence).catch(() => { });

/* ---------- state ---------- */
const S = {
  event: {}, drawMeta: null, participants: [], activities: [], wishes: [], questions: [], qCount: 0,
  uid: null, me: null, authReady: false, assignment: null, isAdmin: false, assignments: {},
  wishPid: null, spinning: false, rot: 0, segs: [], qSubOn: false,
  myPicks: [], publicPicks: [], rsvps: [], myVotes: {}, myQuiz: {}, quizPlay: {}, adminQuiz: [], signups: [], adminVotes: [], actId: null, revealed: {}, suggestions: [], sugVotes: [], sugAuthors: {}, buz: 'c',
  att: {}, myCreated: new Set(), myThanks: null, thanksFromRec: null, wishPick: null, chatReacts: [], replyTo: null, photos: [], live: null, myLive: {}, memories: [], anonVotesLive: [],  notices: [], profiles: {}, hintsIn: [], hintsSent: [], myAngelGuess: null, angelGuesses: [], reveal: null, giftStatus: {}, incoming: null, myGuess: null, guesses: [], chat: [], chatSeen: 0
};
// Arranque instantáneo: si ya habías entrado en este teléfono, se muestra tu sesión con los datos guardados
// mientras Firebase la confirma por detrás (sin la ruedita de "cargando" cada vez que abres la app).
try { const b = JSON.parse(localStorage.getItem('angelito:boot:v1') || 'null'); if (b) { S.event = b.event || {}; S.participants = b.participants || []; S.activities = b.activities || []; S.drawMeta = b.drawMeta || null; S.notices = b.notices || []; S.qCount = b.qCount || 0; } } catch { }
try { const lu = localStorage.getItem('angelito:lastUid'); if (lu && S.participants.some(p => p.id === lu)) { S.uid = lu; S.me = S.participants.find(p => p.id === lu); S.bootGuess = true; } } catch { }
const P = id => S.participants.find(p => p.id === id);
const pName = id => P(id)?.name || '—';
const pEmoji = id => P(id)?.emoji || '🎁';
const shortName = p => p ? `${String(p.first || '')} ${String(p.last || '').charAt(0)}.` : '';
const regOpen = () => S.event.registrationOpen !== false;
// Se muestra la fecha que de verdad aplica el servidor (revealAt), en hora de República Dominicana.
const revealDay = () => S.event.revealAt ? new Date(ms(S.event.revealAt) - 4 * 3600e3).toISOString().slice(0, 10) : (S.event.revealDate || (S.event.eventDate || '').slice(0, 10));
// "el viernes, 18 de diciembre a las 8:00 p. m." (sin hora si se abre a medianoche)
const revealWhen = () => { const rd = revealDay(); if (!rd) return ''; const t = S.event.revealAt ? new Date(ms(S.event.revealAt)) : null; return fmtDate(rd) + (t && (t.getHours() || t.getMinutes()) ? ' a las ' + hm(t) : ''); };
const isRevealed = () => !!S.event.revealNow || (!!S.event.revealAt && Date.now() >= ms(S.event.revealAt));
const guessesOpen = () => !!S.event.guessesOpen;
const MODS = { ruleta: ['🎡', 'Ruleta'], deseos: ['🎁', 'Lista de deseos'], agenda: ['📅', 'Agenda de actividades'], anonimos: ['💌', 'Preguntas anónimas'], buzon: ['💡', 'Sugerencias'], chat: ['💬', 'Chat'],
  asistencia: ['🎉', 'Confirmar asistencia y aporte'], estado: ['🛍️', 'Estado del regalo'], adivinanza: ['🔮', '¿Qué crees que te van a regalar?'], reglas: ['📜', 'Reglas y normas'],
  pistas: ['💌', 'Pistas secretas'], adivinaAngel: ['🕵️', '¿Quién es mi angelito? + gran revelación'], perfil: ['👕', 'Perfil de gustos'], gracias: ['💛', 'Recibí mi regalo + agradecimiento'], juegos: ['🎮', 'Juegos (dominó, X y O, ahorcado)'] };
const mod = k => (S.event.modules || {})[k] !== false;
const TAB_MOD = { ruleta: 'ruleta', deseos: 'deseos', actividades: 'agenda', actividad: 'agenda', anonimos: 'anonimos', juegos: 'juegos' };
const BUZ_MOD = { s: 'buzon', c: 'chat', f: 'fotos' };
const viewOn = v => v === 'buzon' ? (mod('buzon') || mod('chat')) : v === 'actividades' ? (mod('agenda') || mod('anonimos')) : !(TAB_MOD[v] && !mod(TAB_MOD[v]));
function setBuz(b) {
  if (!mod(BUZ_MOD[b])) b = ['c', 's', 'f'].find(x => mod(BUZ_MOD[x])) || 'c';
  S.buz = b;
  $$('#buz-seg button').forEach(x => { x.classList.toggle('on', x.dataset.b === b); x.style.display = mod(BUZ_MOD[x.dataset.b]) ? '' : 'none'; });
  $('#buz-s').style.display = b === 's' ? '' : 'none'; $('#buz-c').style.display = b === 'c' ? '' : 'none'; $('#buz-f').style.display = b === 'f' ? '' : 'none';
  if (b === 'f') { ensurePhotos(); renderPhotos(); }
  document.body.classList.toggle('chat-on', b === 'c' && $('#v-buzon').classList.contains('on')); syncImmersive();
  if (b === 'c') { try { diceHint(); } catch { } S.chatStick = true; requestAnimationFrame(() => { renderChat(); scrollChat(true); }); }
  requestAnimationFrame(() => { try { renderBadges(); } catch { } });
}
const drawReady = () => {
  if (!S.drawMeta?.ids) return false;
  return S.participants.map(p => p.id).sort().join(',') === [...S.drawMeta.ids].sort().join(',');
};

/* ---------- selector propio (no el menú del sistema) ---------- */
function wrapSelect(sel) {
  if (sel.closest('.csel') || sel.multiple) return;
  const w = document.createElement('span'); w.className = 'csel'; sel.before(w); w.appendChild(sel);
  if (sel.style.width) { w.style.width = sel.style.width; w.style.flexShrink = '0'; sel.style.width = '100%'; }
  const hit = document.createElement('button'); hit.type = 'button'; hit.className = 'cs-hit'; hit.setAttribute('aria-label', 'Elegir opción'); w.appendChild(hit);
  sel.tabIndex = -1;
}
function openSelect(sel) {
  if (sel.disabled) return;
  const box = $('#csel'), sh = $('#csel-s');
  const label = sel.closest('.field')?.querySelector('span')?.textContent || '';
  sh.innerHTML = (label ? `<div class="cs-h">${esc(label)}</div>` : '') + [...sel.options].filter(o => !o.hidden).map((o, i) =>
    `<button type="button" class="cs-o ${o.selected ? 'on' : ''}" data-i="${o.index}" ${o.disabled ? 'disabled' : ''}><span class="rd"></span><span>${esc(o.textContent)}</span></button>`).join('');
  box.classList.add('on'); sheetHistory();
  sh.onclick = e => {
    const b = e.target.closest('.cs-o'); if (!b || b.disabled) return;
    sel.selectedIndex = +b.dataset.i; box.classList.remove('on');
    sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true }));
  };
  sh.querySelector('.cs-o.on')?.scrollIntoView({ block: 'nearest' });
}
$('#csel').addEventListener('click', e => { if (e.target.id === 'csel') $('#csel').classList.remove('on'); });
document.addEventListener('click', e => { const h = e.target.closest('.cs-hit'); if (h) { e.preventDefault(); openSelect(h.parentElement.querySelector('select')); } });
// Un formulario inválido con un select: abrimos nuestro selector en vez del aviso del navegador.
const wrapAll = root => root.querySelectorAll?.('select.in').forEach(wrapSelect);
wrapAll(document);
new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) { if (n.matches?.('select.in')) wrapSelect(n); else wrapAll(n); } })
  .observe(document.body, { childList: true, subtree: true });

/* ---------- doble toque: un formulario no se envía dos veces seguidas ---------- */
const inFlight = new WeakSet();
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.id === 'c-form') return; // en el chat se puede escribir rápido, un mensaje tras otro
  if (inFlight.has(f)) { e.preventDefault(); e.stopImmediatePropagation(); return; }
  inFlight.add(f); setTimeout(() => inFlight.delete(f), 700);
}, true);

/* ---------- formularios: avisos propios, no los del navegador ---------- */
const fieldMsg = el => {
  const v = el.validity;
  if (v.valueMissing) return el.tagName === 'SELECT' ? 'Elige una opción.' : 'Completa este campo.';
  if (v.tooShort) return `Escribe al menos ${el.minLength} caracteres.`;
  if (v.typeMismatch) return el.type === 'url' ? 'Escribe un enlace válido (https://…).' : 'Revisa este dato.';
  if (v.rangeUnderflow || v.rangeOverflow) return 'Ese valor no está permitido.';
  if (v.badInput) return 'Revisa este dato.';
  if (v.patternMismatch) return el.title || 'Revisa el formato.';
  return 'Revisa este campo.';
};
let firstBad = null;
document.addEventListener('invalid', e => {
  const el = e.target; e.preventDefault(); // quita la burbuja del navegador
  el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad');
  const host = el.closest('.field') || el;
  let m = host.nextElementSibling?.classList?.contains('ferr') ? host.nextElementSibling : null;
  if (!m) { m = document.createElement('div'); m.className = 'ferr'; host.after(m); }
  m.textContent = fieldMsg(el);
  if (!firstBad) { firstBad = el; setTimeout(() => { firstBad?.focus(); firstBad = null; }, 0); }
}, true);
document.addEventListener('input', e => {
  const el = e.target; if (!el.classList?.contains('bad')) return;
  if (el.checkValidity?.()) { el.classList.remove('bad'); const host = el.closest('.field') || el; if (host.nextElementSibling?.classList?.contains('ferr')) host.nextElementSibling.remove(); }
}, true);
document.addEventListener('change', e => { const el = e.target; if (el.classList?.contains('bad') && el.checkValidity?.()) { el.classList.remove('bad'); const host = el.closest('.field') || el; if (host.nextElementSibling?.classList?.contains('ferr')) host.nextElementSibling.remove(); } }, true);

/* ---------- live data ---------- */
const fail = what => e => { console.warn(what, e); };
// Datos base (evento, sorteo, personas, actividades). Si una suscripción falla, se vuelve a intentar sola:
// antes se quedaba muerta hasta recargar y la lista de amigos no aparecía.
const SYNC = { t0: Date.now(), people: false, wishes: false, tries: 0 };
const fromServer = s => !s.metadata || s.metadata.fromCache === false;
let unsubCore = [], coreT = null;
function coreRetry(what) { return e => { console.warn(what, e); if (SYNC.tries >= 6) { SYNC.people = false; return; } if (coreT) return; /* agotado: el vigilante lo retoma y avisa */ coreT = setTimeout(() => { coreT = null; SYNC.tries++; startCoreSubs(); }, 1500 * (SYNC.tries + 1)); }; }
function startCoreSubs() {
  unsubCore.forEach(u => { try { u(); } catch { } }); unsubCore = [];
  unsubCore.push(onSnapshot(doc(db, 'config', 'event'), s => { S.event = s.exists() ? s.data() : {}; syncQuestions(); syncGuesses(); render(); checkRelogin(); }, coreRetry('event')));
  unsubCore.push(onSnapshot(doc(db, 'config', 'draw'), s => { S.drawMeta = s.exists() ? s.data() : null; render(); }, coreRetry('draw')));
  unsubCore.push(onSnapshot(collection(db, 'participants'), { includeMetadataChanges: true }, s => { // avisa también cuando el servidor confirma
    if (fromServer(s)) { SYNC.people = true; SYNC.tries = 0; }
    S.participants = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(a.at) - ms(b.at));
    S.me = S.uid ? P(S.uid) || null : null; maybeForcePin(); maybeAskNotif(); syncAdminMode();
    ensureUserSubs(); checkGone(); checkRelogin();
    if (S.me && userSubDenied) retryUserSubs();
    render();
  }, coreRetry('participants')));
  unsubCore.push(onSnapshot(collection(db, 'activities'), s => {
    S.activities = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ((a.date || '') + (a.time || '')).localeCompare((b.date || '') + (b.time || ''))); render();
  }, coreRetry('activities')));
}
startCoreSubs();
// Reparación: borra la copia guardada en este teléfono y vuelve a bajar todo (no borra nada del grupo ni cierra tu sesión).
async function repairData(auto) {
  try { sessionStorage.setItem('angelito:repaired', String(Date.now())); } catch { }
  if (!auto) toast('🔄 Recargando los datos…');
  try { await terminate(db); await clearIndexedDbPersistence(db); } catch (e) { console.warn('repair', e); }
  try { localStorage.removeItem('angelito:boot:v1'); } catch { }
  location.reload();
}
// Vigilante: si hay internet y el servidor responde pero la lista en vivo no llega, la copia local está trabada → se repara sola (una vez).
async function healthCheck() {
  if (navigator.onLine === false || document.hidden || typeof getDocsFromServer !== 'function') return;
  const stuckPeople = !SYNC.people, stuckWishes = !!S.me && !SYNC.wishes && Date.now() - SYNC.wishesT0 > 9000;
  if (!stuckPeople && !stuckWishes) { $('#datafail').hidden = true; return; }
  let ok = false;
  try { const r = await getDocsFromServer(collection(db, 'participants')); ok = true; if (stuckPeople && !SYNC.people) { S.participants = r.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(a.at) - ms(b.at)); S.me = S.uid ? P(S.uid) || null : null; render(); } } catch (e) { console.warn('health', e); }
  if (SYNC.people && (!S.me || SYNC.wishes)) return;
  let done = 0; try { done = +sessionStorage.getItem('angelito:repaired') || 0; } catch { done = 1; } // sin sessionStorage no se arriesga un bucle de recargas
  if (ok && !done) return repairData(true);
  if (ok && stuckWishes && auth.currentUser) { subRetries = 0; startUserSubs(auth.currentUser); }
  if (ok && stuckPeople) { SYNC.tries = 0; startCoreSubs(); }
  $('#datafail').hidden = false;
}
setTimeout(healthCheck, 9000); setInterval(healthCheck, 20000);
addEventListener('online', () => setTimeout(healthCheck, 3000));
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(healthCheck, 4000); });


let unsubUser = [];
// Justo al registrarse, la cuenta existe antes que su ficha de participante, y las reglas
// rechazan las suscripciones. Si eso pasa, se reintentan cuando aparece la ficha.
let userSubDenied = false;
let subRetryT = null, subRetries = 0;
const retryUserSubs = () => {
  if (subRetryT || subRetries >= 8) return;
  subRetryT = setTimeout(() => {
    subRetryT = null;
    if (!userSubDenied || !S.me || auth.currentUser?.uid !== S.uid) return;
    subRetries++; startUserSubs(auth.currentUser); syncQuestions(true); syncGuesses(true); render();
  }, 1200 + subRetries * 800);
};
const ufail = what => e => {
  console.warn(what, e);
  userSubDenied = true; if (S.me) retryUserSubs(); // cualquier fallo se reintenta (antes solo el de permisos)
};
// Las colecciones del grupo (deseos, chat, ideas…) solo se piden cuando la cuenta YA tiene su ficha de participante.
// Antes se pedían apenas había sesión, y Firestore respondía "Missing or insufficient permissions" mientras
// se terminaba de inscribir, o para siempre si a esa cuenta la quitaron del grupo o le dieron un PIN temporal.
let subsFor = null;
function ensureUserSubs() {
  const u = auth.currentUser; if (!u || subsFor === u.uid || !P(u.uid)) return;
  startUserSubs(u); syncQuestions(true); syncGuesses(true); render();
}
// Cuenta que ya no está en el grupo (la quitaron o se le dio un PIN temporal y se creó otra): se cierra con un aviso.
// El organizador puede pedir que TODOS vuelvan a entrar (para activar avisos e instalar la app).
function checkRelogin() {
  const u = auth.currentUser, at = S.event?.reloginAt ? ms(S.event.reloginAt) : 0;
  if (!u || !at || !P(u.uid) || S.isOwner) return;
  const last = Date.parse(u.metadata?.lastSignInTime || 0) || 0;
  if (last >= at) return;
  try { localStorage.removeItem(ASK_KEY); localStorage.removeItem(INST_KEY); } catch { }
  signOut(auth).then(() => {
    const s2 = openModal(`<div class="relog"><div class="rl-ic">🔔</div><h3>Vuelve a entrar, por favor 🙏</h3>
      <p class="muted">El organizador actualizó el angelito. Entra otra vez con tu nombre y tu PIN y luego:</p>
      <div class="rl-steps"><div><span>1</span><b>Activa los avisos</b><small>Para enterarte del chat, la ruleta y las actividades.</small></div>
      <div><span>2</span><b>Instala la app</b><small>Queda en tu pantalla como una aplicación más.</small></div></div>
      <div class="actions"><button class="btn gold" data-a="in">Entrar ahora</button></div></div>`);
    s2.onclick = e => { if (e.target.closest('[data-a=in]')) { closeModal(); setTimeout(() => openAuth('login'), 150); } };
  }).catch(() => { });
}
function checkGone() {
  const u = auth.currentUser; if (!u || !SYNC.people || P(u.uid)) return;
  const age = Date.now() - Date.parse(u.metadata?.creationTime || 0);
  if (!(age > 120000)) return; // recién creada: su ficha está por llegar
  signOut(auth).then(() => { toast('Tu acceso cambió. Entra de nuevo con tu nombre y tu PIN.'); setTimeout(() => openAuth('login'), 600); }).catch(() => { });
}
function startUserSubs(user) {
  subsFor = user.uid;
  unsubUser.forEach(u => u()); unsubUser = []; userSubDenied = false; SYNC.wishes = false; SYNC.wishesT0 = Date.now();
    unsubUser.push(onSnapshot(collection(db, 'wishes'), { includeMetadataChanges: true }, s => {
      if (fromServer(s)) SYNC.wishes = true;
      S.wishes = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(a.at) - ms(b.at)); render();
    }, ufail('wishes')));
    unsubUser.push(onSnapshot(doc(db, 'staff', user.uid), s => { S.myStaff = s.exists() ? s.data() : null; syncAdminMode(); }, () => { S.myStaff = null; syncAdminMode(); }));
    unsubUser.push(onSnapshot(doc(db, 'assignments', user.uid), s => { S.assignment = s.exists() ? s.data() : null; render(); }, ufail('assignment')));
    const rows = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
    unsubUser.push(onSnapshot(query(collection(db, 'activityPicks'), where('uid', '==', user.uid)), s => { S.myPicks = rows(s); render(); }, ufail('myPicks')));
    unsubUser.push(onSnapshot(query(collection(db, 'activityPicks'), where('public', '==', true)), s => { S.publicPicks = rows(s); render(); }, ufail('publicPicks')));
    unsubUser.push(onSnapshot(query(collection(db, 'votes'), where('uid', '==', user.uid)), s => { S.myVotes = Object.fromEntries(rows(s).map(v => [v.act, v.choice])); render(); }, ufail('myVotes')));
    unsubUser.push(onSnapshot(query(collection(db, 'quizAns'), where('uid', '==', user.uid)), s => { S.myQuiz = Object.fromEntries(rows(s).map(v => [v.act, v.a])); render(); }, ufail('myQuiz')));
    unsubUser.push(onSnapshot(collection(db, 'activitySignups'), s => { S.signups = rows(s); render(); }, ufail('signups')));
    unsubUser.push(onSnapshot(collection(db, 'suggestions'), s => { S.suggestions = rows(s); render(); }, ufail('suggestions')));
    unsubUser.push(onSnapshot(collection(db, 'sugVotes'), s => { S.sugVotes = rows(s); render(); }, ufail('sugVotes')));
    unsubUser.push(onSnapshot(collection(db, 'attendance'), s => { S.att = Object.fromEntries(rows(s).map(x => [x.id, x])); render(); }, ufail('attendance')));
    unsubUser.push(onSnapshot(doc(db, 'giftStatus', user.uid), s => { if (!S.isOwner) S.giftStatus = s.exists() ? { [user.uid]: s.data().status } : {}; render(); }, ufail('giftStatus')));
    unsubUser.push(onSnapshot(doc(db, 'giftIncoming', user.uid), s => { S.incoming = s.exists() ? s.data() : null; render(); }, ufail('incoming')));
    unsubUser.push(onSnapshot(query(collection(db, 'notices'), orderBy('ts', 'desc'), limit(30)), s => { S.notices = rows(s); render(); }, ufail('notices')));
    unsubUser.push(onSnapshot(doc(db, 'party', 'live'), s => { S.live = s.exists() ? s.data() : null; render(); }, () => { }));
    unsubUser.push(onSnapshot(doc(db, 'stats', 'questions'), s => { S.qCount = s.exists() ? (s.data().count || 0) : 0; render(); }, ufail('stats')));
    unsubUser.push(onSnapshot(doc(db, 'thanks', user.uid), s => { S.myThanks = s.exists() ? s.data() : null; render(); }, ufail('thanks')));
    unsubUser.push(onSnapshot(doc(db, 'wishPick', user.uid), s => { S.wishPick = s.exists() ? s.data() : null; render(); }, ufail('wishPick')));
    unsubUser.push(onSnapshot(collection(db, 'memories'), s => { S.memories = rows(s); render(); }, ufail('memories')));
    unsubUser.push(onSnapshot(collection(db, 'profiles'), s => { S.profiles = Object.fromEntries(rows(s).map(x => [x.id, x])); render(); }, ufail('profiles')));
    unsubUser.push(onSnapshot(query(collection(db, 'hints'), where('to', '==', user.uid)), s => { S.hintsIn = rows(s); render(); }, ufail('hints')));
    unsubUser.push(onSnapshot(doc(db, 'hintsSent', user.uid), s => { S.hintsSent = s.exists() ? (s.data().texts || []) : []; render(); }, ufail('hintsSent')));
    unsubUser.push(onSnapshot(doc(db, 'angelGuess', user.uid), s => { S.myAngelGuess = s.exists() ? s.data() : null; render(); }, ufail('angelGuess')));
    unsubUser.push(onSnapshot(doc(db, 'reveal', 'main'), s => { S.reveal = s.exists() ? s.data() : null; syncAngelGuesses(); render(); }, ufail('reveal')));
    unsubUser.push(onSnapshot(doc(db, 'guesses', user.uid), s => { S.myGuess = s.exists() ? s.data() : null; render(); }, ufail('myGuess')));
    unsubUser.push(onSnapshot(query(collection(db, 'chat'), orderBy('ts', 'desc'), limit(120)), { includeMetadataChanges: true }, s => {
      // orden por la hora del SERVIDOR (no la del teléfono, que puede estar adelantada o atrasada); lo que aún no sube va al final con 🕓
      const t = m => m.pending ? 9e15 + (m.ts || 0) : (ms(m.at) || m.ts || 0);
      S.chat = s.docs.map(d => ({ id: d.id, ...d.data(), pending: !!d.metadata?.hasPendingWrites })).sort((a, b) => t(a) - t(b));
      S.chatLive = !s.metadata?.fromCache; render();
    }, ufail('chat')));
}
onAuthStateChanged(auth, user => {
  try { if (user) localStorage.setItem('angelito:lastUid', user.uid); else localStorage.removeItem('angelito:lastUid'); } catch { }
  if (S.bootGuess) { S.bootGuess = false; if (user && user.uid === S.uid) S.uid = null; } // la sesión supuesta se confirma: arrancar como cambio de usuario normal
  try { if ((user ? user.uid : null) !== S.uid) GAMES.stop(); } catch { }
  unsubUser.forEach(u => u()); unsubUser = [];
  if ((user ? user.uid : null) !== S.uid) { S.wishPid = null; S.revealed = {}; S.rot = 0; const wc = $('#wheel'); if (wc) { wc.style.transition = 'none'; wc.style.transform = ''; requestAnimationFrame(() => { wc.style.transition = ''; }); } }
  S.uid = user ? user.uid : null; S.me = S.uid ? P(S.uid) || null : null; S.assignment = null; S.wishes = [];
  S.myPicks = []; S.publicPicks = []; S.rsvps = []; S.myVotes = {}; S.myQuiz = {}; S.quizPlay = {}; S.signups = []; S.revealed = {}; if (!S.isAdmin) S.suggestions = []; S.hintsIn = []; S.hintsSent = []; S.myAngelGuess = null; S.myThanks = null; S.wishPick = null; S.replyTo = null; S.myLive = {}; if (unsubPhotos) { unsubPhotos(); unsubPhotos = null; } S.photos = []; if (!S.isOwner) { S.reveal = null; S.angelGuesses = []; }
  S.giftStatus = {}; S.incoming = null; S.myGuess = null; S.chat = []; if (!S.isAdmin) S.att = {};
  S.authReady = true; setTimeout(maybeForcePin, 0);
  subRetries = 0;
  if (!user) { S.myStaff = null; syncAdminMode(); if (!adminAuth.currentUser) { S.att = {}; S.suggestions = []; } }
  subsFor = null; if (user) { ensureUserSubs(); checkGone(); checkRelogin(); }
  syncQuestions(true); syncGuesses(true); render();
  if (user && canNotify() && Notification.permission === 'granted') setTimeout(() => registerPush(), 1500);
});

let unsubAG = null;
function syncAngelGuesses() {
  const want = !!S.reveal && (!!S.uid || S.isOwner);
  if (want && !unsubAG) unsubAG = onSnapshot(collection(S.uid ? db : adb, 'angelGuess'), s => { S.angelGuesses = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, () => { unsubAG = null; });
  else if (!want && unsubAG) { unsubAG(); unsubAG = null; S.angelGuesses = []; }
}
let unsubG = null;
function syncGuesses(force) {
  const want = (!!S.uid || S.isAdmin) && guessesOpen();
  if (force && unsubG) { unsubG(); unsubG = null; }
  if (want && !unsubG) unsubG = onSnapshot(collection(S.uid ? db : adb, 'guesses'), s => { S.guesses = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, () => { unsubG = null; S.guesses = []; render(); });
  else if (!want && unsubG) { unsubG(); unsubG = null; S.guesses = []; }
}
let unsubQ = null;
function syncQuestions(force) {
  const want = !!S.uid && isRevealed();
  if (force && unsubQ) { unsubQ(); unsubQ = null; S.qSubOn = false; }
  if (want && !unsubQ) {
    S.qSubOn = true;
    unsubQ = onSnapshot(collection(db, 'questions'), s => {
      S.questions = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.id.localeCompare(b.id)); render();
    }, () => { S.questions = []; unsubQ = null; S.qSubOn = false; render(); });
  } else if (!want && unsubQ) { unsubQ(); unsubQ = null; S.qSubOn = false; S.questions = []; }
}
setInterval(() => { syncQuestions(); }, 30000);

let unsubAdm = [], unsubStaff = null;
const can = p => S.isOwner || !!(S.staff && S.staff.perms && S.staff.perms[p]);
function startAdminSubs() {
  unsubAdm.forEach(u => u()); unsubAdm = [];
  S.assignments = {}; S.adminVotes = []; S.sugAuthors = {}; S.adminGuesses = []; S.staffList = [];
  if (!S.isAdmin) return;
  const sub = (q, f, n) => unsubAdm.push(onSnapshot(q, f, fail(n)));
  const rows = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
  if (S.isOwner) {
    sub(doc(adb, 'drawRules', 'main'), s => { S.drawRules = s.exists() ? (s.data().pairs || []) : []; render(); }, 'drawRules');
    sub(collection(adb, 'assignments'), s => { S.assignments = Object.fromEntries(s.docs.map(d => [d.id, d.data()])); render(); }, 'assignments');
    sub(collection(adb, 'suggestionAuthors'), s => { S.sugAuthors = Object.fromEntries(s.docs.map(d => [d.id, d.data().uid])); render(); }, 'sugauth');
    sub(collection(adb, 'guesses'), s => { S.adminGuesses = rows(s); render(); }, 'guesses-adm');
    sub(collection(adb, 'memories'), s => { if (!S.uid) S.memories = rows(s); render(); }, 'mem-adm');
    sub(doc(adb, 'reveal', 'main'), s => { S.reveal = s.exists() ? s.data() : null; syncAngelGuesses(); render(); }, 'reveal-adm');
    sub(collection(adb, 'giftStatus'), s => { S.giftStatus = Object.fromEntries(s.docs.map(d => [d.id, d.data().status])); render(); }, 'gs-adm');
    sub(collection(adb, 'staff'), s => { S.staffList = rows(s).sort((x, y) => ms(x.at) - ms(y.at)); render(); }, 'staff');
  }
  if (can('actividades')) {
    sub(collection(adb, 'votes'), s => { S.adminVotes = rows(s); render(); }, 'votes');
    sub(collection(adb, 'quizAns'), s => { S.adminQuiz = rows(s); render(); }, 'quiz-adm');
    sub(collection(adb, 'activitySignups'), s => { S.signups = rows(s); render(); }, 'signups-adm');
  }
  sub(collection(adb, 'suggestions'), s => { S.suggestions = rows(s); render(); }, 'sug-adm');
  sub(query(collection(adb, 'notices'), orderBy('ts', 'desc'), limit(30)), s => { if (!S.uid) S.notices = rows(s); render(); }, 'notices-adm');
  sub(doc(adb, 'stats', 'questions'), s => { if (!S.uid) S.qCount = s.exists() ? (s.data().count || 0) : 0; render(); }, 'stats-adm');
  if (can('moderar') || can('participantes')) sub(collection(adb, 'wishes'), s => { if (!S.uid) S.wishes = rows(s); render(); }, 'wishes-adm');
  sub(collection(adb, 'sugVotes'), s => { S.sugVotes = rows(s); render(); }, 'sugvotes-adm');
  sub(collection(adb, 'attendance'), s => { S.att = Object.fromEntries(rows(s).map(x => [x.id, x])); render(); }, 'att-adm');

  sub(query(collection(adb, 'chat'), orderBy('ts', 'desc'), limit(120)), s => { if (!S.uid) S.chat = rows(s).reverse(); render(); }, 'chat-adm');
}
// Una persona inscrita con permisos administra con su misma cuenta (sin segunda cuenta ni contraseña aparte).
function syncAdminMode() {
  if (adminAuth.currentUser) return;            // hay una sesión de organizador aparte: esa manda
  const had = !!S.staffSelf;
  if (S.myStaff && S.uid && S.me) {
    const sig = x => JSON.stringify([x?.perms || null, !!x?.owner]);
    const same = had && sig(S.staff) === sig(S.myStaff);
    adb = db; S.staff = S.myStaff; S.isAdmin = true; S.isOwner = !!S.myStaff.owner; S.staffSelf = true; // acceso total = igual que el principal
    if (same) return; // nada cambió
    startAdminSubs();
    if (!had) { let seen = ''; try { seen = localStorage.getItem('angelito:staffHi') || ''; } catch { } if (seen !== S.uid) { try { localStorage.setItem('angelito:staffHi', S.uid); } catch { } toast('🛡️ Ya eres administrador: toca el engranaje de arriba'); } }
  } else if (had) {
    S.staffSelf = false; S.staff = null; S.isAdmin = false; S.isOwner = false; adb = adbOwn; startAdminSubs();
    if (location.hash === '#admin') location.hash = 'inicio';
  } else return;
  syncGuesses(true); render();
}
onAuthStateChanged(adminAuth, user => {
  if (unsubStaff) { unsubStaff(); unsubStaff = null; }
  adb = adbOwn; S.staffSelf = false;
  S.isOwner = !!user && (user.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
  S.staff = null; S.isAdmin = S.isOwner;
  if (user && !S.isOwner) {
    unsubStaff = onSnapshot(doc(adb, 'staff', user.uid), s => {
      if (!s.exists()) { S.staff = null; S.isAdmin = false; startAdminSubs(); signOut(adminAuth); toast('Esa cuenta no tiene acceso de organizador'); render(); return; }
      const prev = JSON.stringify(S.staff?.perms || null); S.staff = s.data(); S.isAdmin = true;
      if (prev !== JSON.stringify(S.staff.perms || null)) startAdminSubs();
      syncGuesses(true); render();
    }, () => { S.isAdmin = false; signOut(adminAuth); render(); });
  }
  startAdminSubs(); syncGuesses(true); render();
  if (!user) syncAdminMode();
});

/* ---------- toast / modal ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3400); }
// Botón atrás de Android: cierra la hoja abierta en vez de cambiar de pestaña por detrás.
let sheetEntry = false, sheetHash = '';
function sheetHistory() { if (!sheetEntry) { try { history.pushState({ sheet: 1 }, ''); sheetEntry = true; sheetHash = location.hash; } catch { } } }
addEventListener('popstate', () => {
  if (!sheetEntry) return; sheetEntry = false;
  if (location.hash !== sheetHash) return; // fue un cambio de pestaña, no el botón atrás
  if ($('#csel').classList.contains('on')) { $('#csel').classList.remove('on'); if ($('#modal').classList.contains('on')) sheetHistory(); return; }
  if ($('#modal').classList.contains('on')) { if (S.spinning || S.forcePin) { sheetHistory(); return; } closeModal(); return; }
  history.back(); // la hoja ya estaba cerrada: este "atrás" era para navegar
});
function openModal(html) { $('#sheet').className = 'sheet'; $('#sheet').innerHTML = html; $('#modal').classList.add('on'); sheetHistory(); return $('#sheet'); }
function closeModal() { $('#modal').classList.remove('on'); $('#sheet').onclick = null; }
// En computadora, la tecla Esc cierra la ventanita abierta (como tocar fuera o el botón atrás en el teléfono).
addEventListener('keydown', e => {
  if (e.key !== 'Escape' || PARTY) return;
  if ($('#csel').classList.contains('on')) { e.preventDefault(); $('#csel').classList.remove('on'); return; }
  if ($('#modal').classList.contains('on') && !S.spinning && !S.forcePin) { e.preventDefault(); closeModal(); }
});
const nMsg = n => `${n} ${n === 1 ? 'mensaje' : 'mensajes'}`;
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !S.spinning && !S.forcePin) closeModal(); });
function confirmBox(title, body, ok = 'Sí, continuar') {
  return new Promise(res => {
    const s = openModal(`<h3>${esc(title)}</h3><p class="muted">${esc(body)}</p><div class="actions"><button class="btn" data-a="no">Cancelar</button><button class="btn primary" data-a="ok">${esc(ok)}</button></div>`);
    s.onclick = e => { const a = e.target.closest('[data-a]')?.dataset.a; if (a) { closeModal(); res(a === 'ok'); } };
  });
}
const pinField = (id, label) => `<label class="field"><span>${label}</span><input class="in pinin" id="${id}" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"></label>`;
const onlyDigits = root => $$('.pinin', root).forEach(i => i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 4); }));
const busy = (btn, on, label) => { btn.disabled = on; if (on) { btn.dataset.l = btn.innerHTML; btn.innerHTML = '<span class="spin-dots"></span>'; } else btn.innerHTML = label || btn.dataset.l; };

/* ---------- auth UI (participantes) ---------- */
function openAuth(tab = 'login', then) {
  const s = openModal(`<div class="auth-hd"><span class="auth-logo">🎁</span><b>${esc(S.event?.eventName || 'Angelito de Navidad')}</b><small>Entra con tu nombre y tu PIN</small></div><div class="seg auth-seg"><button data-t="login">Entrar</button><button data-t="reg">Registrarme</button></div><div id="auth-body"></div>`);
  s.classList.add('authm');
  const show = t => {
    $$('.seg button', s).forEach(b => b.classList.toggle('on', b.dataset.t === t));
    const body = $('#auth-body', s);
    if (t === 'org') {
      body.innerHTML = `<div class="stack"><p class="muted small">Solo para el <b>organizador principal</b>. Si te dieron permisos de administrador, entra normal con tu nombre y tu PIN: el panel te aparece solo.</p>
        <label class="field"><span>Usuario</span><input class="in" id="o-user" autocapitalize="off" autocomplete="username" placeholder="admin"></label>
        <label class="field"><span>Contraseña</span><input class="in" id="o-pass" type="password" autocomplete="current-password"></label></div>
        <div class="err" id="o-err"></div>
        <div class="actions"><button class="btn" data-x>Cancelar</button><button class="btn gold" id="o-go">Entrar</button></div>`;
      const go = async () => {
        const btn = $('#o-go', body); busy(btn, true);
        try { await adminLogin($('#o-user', body).value, $('#o-pass', body).value); closeModal(); location.hash = 'admin'; toast('Modo organizador activo 🔓'); }
        catch (e) { $('#o-err', body).textContent = authErr(e).replace('PIN incorrecto', 'Usuario o contraseña incorrectos'); busy(btn, false); }
      };
      $('#o-go', body).addEventListener('click', go);
      $('#o-pass', body).addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      return;
    }
    if (t === 'login') {
      let sel = null;
      body.innerHTML = S.participants.length ? `
        <label class="field"><span>¿Quién eres?</span><input class="in" id="l-q" placeholder="🔍 Busca tu nombre…" autocomplete="off"></label>
        <div class="pick" id="l-pick" style="margin-top:10px"></div>
        <div id="l-pinbox" style="display:none;margin-top:14px">${pinField('l-pin', 'Tu PIN de 4 números')}</div>
        <div class="err" id="l-err"></div>
        <div class="actions"><button class="btn" data-x>Cancelar</button><button class="btn gold" id="l-go" disabled>Entrar</button></div>`
        : `<div class="empty"><span class="e">🎄</span>Todavía nadie se ha registrado.</div><div class="actions"><button class="btn gold" data-sw="reg">Registrarme</button></div>`;
      if (!S.participants.length) return;
      onlyDigits(body);
      const paint = () => {
        const q = normName($('#l-q', body).value);
        $('#l-pick', body).innerHTML = S.participants.filter(p => !q || String(p.nameKey || '').includes(q))
          .map(p => `<button class="apick ${sel === p.id ? 'on' : ''}" data-p="${esc(p.id)}"><span class="ap-e">${esc(p.emoji)}</span><span class="ap-n">${esc(p.first || p.name)}</span><small>${esc(p.last || '')}</small></button>`).join('') || '<p class="muted small">No aparece. ¿Ya te registraste?</p>';
      };
      paint();
      $('#l-q', body).addEventListener('input', paint);
      $('#l-pick', body).addEventListener('click', e => {
        const b = e.target.closest('[data-p]'); if (!b) return;
        sel = b.dataset.p; paint(); $('#l-pinbox', body).style.display = ''; $('#l-go', body).disabled = false; $('#l-pin', body).focus();
      });
      const go = async () => {
        const pin = $('#l-pin', body).value, p = P(sel), err = $('#l-err', body), btn = $('#l-go', body);
        if (!p) return; if (!/^\d{4}$/.test(pin)) { err.textContent = 'El PIN tiene 4 números.'; return; }
        busy(btn, true); err.textContent = '';
        try { await signInWithEmailAndPassword(auth, p.email, pinPass(pin)); closeModal(); toast(`¡Hola, ${p.first}! 👋`); then && then(); }
        catch (e) { err.textContent = authErr(e); busy(btn, false); }
      };
      $('#l-go', body).addEventListener('click', go);
      $('#l-pin', body).addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    } else {
      if (!regOpen()) { body.innerHTML = `<div class="empty"><span class="e">🔒</span>Las inscripciones están cerradas. Habla con el organizador.</div><div class="actions"><button class="btn" data-x>Cerrar</button></div>`; return; }
      body.innerHTML = `<div class="stack">
        <div class="row"><label class="field"><span>Nombre</span><input class="in" id="r-first" maxlength="25" autocomplete="given-name"></label>
        <label class="field"><span>Apellido</span><input class="in" id="r-last" maxlength="25" autocomplete="family-name"></label></div>
        <div class="row">${pinField('r-pin', 'Crea tu PIN (4 números)')}${pinField('r-pin2', 'Repite el PIN')}</div>
        <p class="muted small">🔐 Con este PIN entras, giras la ruleta y manejas tu lista de deseos. No lo compartas.</p></div>
        <div class="err" id="r-err"></div>
        <div class="actions"><button class="btn" data-x>Cancelar</button><button class="btn gold" id="r-go">Registrarme</button></div>`;
      onlyDigits(body);
      $('#r-go', body).addEventListener('click', async () => {
        const first = titleCase($('#r-first', body).value), last = titleCase($('#r-last', body).value);
        const pin = $('#r-pin', body).value, pin2 = $('#r-pin2', body).value, err = $('#r-err', body), btn = $('#r-go', body);
        if (!first || !last) { err.textContent = 'Escribe tu nombre y tu apellido.'; return; }
        if (!/^\d{4}$/.test(pin)) { err.textContent = 'El PIN debe tener 4 números.'; return; }
        if (pin !== pin2) { err.textContent = 'Los PIN no coinciden.'; return; }
        const name = `${first} ${last}`, nameKey = normName(name);
        busy(btn, true); err.textContent = '';
        try {
          const r = await registerPerson(first, last, pin, false);
          if (r === 'dup') { err.textContent = `Ya hay alguien registrado como ${name}. Si eres tú, entra con tu PIN.`; busy(btn, false); return; }
          closeModal(); toast(`¡Bienvenido al angelito, ${first}! 🎉`); confetti(90); then && then();
        } catch (e) { err.textContent = e?.code?.includes('permission') ? 'Las inscripciones están cerradas.' : authErr(e); busy(btn, false); }
      });
    }
  };
  s.onclick = e => {
    const t = e.target.closest('[data-t]')?.dataset.t || e.target.closest('[data-sw]')?.dataset.sw; if (t) show(t);
    if (e.target.closest('[data-x]')) closeModal();
  };
  show(tab);
}
/* ---------- PIN temporal: obligar a crear uno nuevo ---------- */
// Invita a activar las notificaciones apenas la persona entra (el navegador exige que ella toque "Permitir").
const ASK_KEY = 'angelito:askNotif';
let askT = null;
function maybeAskNotif() {
  if (!S.me || S.forcePin || !canNotify() || Notification.permission !== 'default' || askT) return;
  if (isIOS() && !isStandalone()) return;
  let last = 0; try { last = +localStorage.getItem(ASK_KEY) || 0; } catch { }
  if (Date.now() - last < 6 * 3600e3) return; // si no aceptó, se vuelve a preguntar la próxima vez que abra la app
  const busyNow = () => S.spinning || (typeof PARTY !== 'undefined' && PARTY) || location.hash.startsWith('#juego-') || location.hash === '#ruleta'
    || document.body.classList.contains('kb') || $('#modal').classList.contains('on') || $('#csel').classList.contains('on') || !!tourT;
  const tryAsk = () => {
    askT = null;
    if (!S.me || S.forcePin || Notification.permission !== 'default') return;
    if (busyNow()) { askT = setTimeout(tryAsk, 8000); return; } // espera un momento tranquilo
    openModal(`<div style="text-align:center"><div style="font-size:46px">🔔</div><h3>¿Te avisamos?</h3>
      <p class="muted">Te llegará un aviso cuando haya mensajes, actividades, pistas de tu angelito o cambios del evento. Nunca varios seguidos: el nuevo reemplaza al anterior.</p>
      <p class="muted small">Puedes apagarlas cuando quieras en 🔔 Notificaciones.</p></div>
      <div class="actions"><button class="btn" data-a="no">Ahora no</button><button class="btn gold" data-a="ok">🔔 Activar</button></div>`).onclick = async e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      try { localStorage.setItem(ASK_KEY, String(Date.now())); } catch { } // se guarda solo cuando responde
      closeModal(); if (a === 'ok') await enableNotifications();
    };
  };
  askT = setTimeout(tryAsk, 6000);
}
function maybeForcePin() {
  if (S.forcePin && S.me && !S.me.mustChangePin) { S.forcePin = false; closeModal(); return; }
  if (!S.me || !S.me.mustChangePin || S.forcePin) return;
  S.forcePin = true;
  const s2 = openModal(`<h3>🔐 Crea tu nuevo PIN</h3><p class="muted">Entraste con un PIN temporal que te dio el organizador. Crea ahora tu propio PIN de 4 números (no lo compartas).</p>
    <div class="row" style="margin-top:12px">${pinField('np-1', 'Nuevo PIN')}${pinField('np-2', 'Repítelo')}</div>
    <div class="err" id="np-err"></div><div class="actions"><button class="btn" data-a="out">Salir</button><button class="btn gold" data-a="ok">Guardar mi PIN</button></div>`);
  onlyDigits(s2);
  s2.onclick = async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'out') { S.forcePin = false; closeModal(); await signOut(auth); return; }
    const p1 = $('#np-1', s2).value, p2 = $('#np-2', s2).value, er = $('#np-err', s2);
    if (!/^\d{4}$/.test(p1)) { er.textContent = 'El PIN debe tener 4 números.'; return; }
    if (p1 !== p2) { er.textContent = 'Los PIN no coinciden.'; return; }
    const btn = s2.querySelector('[data-a=ok]'); busy(btn, true);
    try {
      await updatePassword(auth.currentUser, pinPass(p1));
      await setDoc(doc(db, 'participants', S.uid), { mustChangePin: false }, { merge: true });
      S.forcePin = false; closeModal(); toast('¡Listo! Ya tienes tu nuevo PIN 🔐');
    } catch (err) {
      er.textContent = err?.code?.includes('requires-recent-login') ? 'Por seguridad, sal y vuelve a entrar con el PIN temporal.' : authErr(err); busy(btn, false);
    }
  };
}
/* ---------- admin: restablecer PIN (pasa todo a una cuenta nueva) ---------- */
async function resetPin(pid, tempPin) {
  const p = P(pid); if (!p) throw new Error('no participant');
  const slug = String(p.nameKey || 'persona').replace(/ñ/g, 'n').replace(/[^a-z0-9 ]/g, '').replace(/ /g, '.') || 'persona';
  const email = `${slug}.${Math.random().toString(36).slice(2, 7)}@angelito.app`;
  const cred = await createUserWithEmailAndPassword(regAuth, email, pinPass(tempPin));
  const nid = cred.user.uid; try { await signOut(regAuth); } catch { }
  const ops = [];  // [tipo, ref, datos]
  const put = (ref, data) => ops.push(['set', ref, data]), del = ref => ops.push(['del', ref]);
  const R = (c, id) => doc(adb, c, id);
  const q = (c, f, v) => getDocs(query(collection(adb, c), where(f, '==', v)));
  const { id: _i, ...pdata } = p;
  // el cambio de ficha va al final y de una sola vez: si algo se corta antes, la persona sigue intacta con su cuenta vieja
  const fin = writeBatch(adb);
  fin.set(R('participants', nid), { ...pdata, email, mustChangePin: true }); fin.delete(R('participants', pid));
  if (p.nameKey) fin.set(R('names', p.nameKey), { uid: nid });
  fin.set(R('banned', pid), { at: serverTimestamp() });
  if ((S.drawRules || []).some(r => r.a === pid || r.b === pid)) fin.set(R('drawRules', 'main'), { pairs: S.drawRules.map(r => ({ ...r, a: r.a === pid ? nid : r.a, b: r.b === pid ? nid : r.b })), at: serverTimestamp() });
  for (const c of ['assignments', 'giftStatus', 'giftIncoming', 'attendance', 'guesses']) {
    const snap = await getDoc(R(c, pid)).catch(() => null);
    if (snap && snap.exists()) { const data = snap.data(); if ('uid' in data) data.uid = nid; put(R(c, nid), data); del(R(c, pid)); }
  }
  (await q('assignments', 'recipient', pid)).forEach(d => { if (d.id !== pid) put(d.ref, { ...d.data(), recipient: nid }); });
  (await q('questions', 'to', pid)).forEach(d => put(d.ref, { ...d.data(), to: nid }));
  for (const c of ['wishes', 'wishImg', 'chatImg', 'activitySignups', 'suggestions', 'questionAuthors', 'suggestionAuthors'])
    (await q(c, 'uid', pid)).forEach(d => put(d.ref, { ...d.data(), uid: nid }));
  (await q('activityPicks', 'uid', pid)).forEach(d => { put(R('activityPicks', `${d.data().act}__${nid}`), { ...d.data(), uid: nid }); del(d.ref); });
  (await q('votes', 'uid', pid)).forEach(d => { put(R('votes', `${d.data().act}__${nid}`), { ...d.data(), uid: nid }); del(d.ref); });
  (await q('votes', 'choice', pid)).forEach(d => { if (d.data().uid !== pid) put(d.ref, { ...d.data(), choice: nid }); });
  (await q('sugVotes', 'uid', pid)).forEach(d => { put(R('sugVotes', `${d.data().sug}__${nid}`), { ...d.data(), uid: nid }); del(d.ref); });
  (await q('chatReacts', 'uid', pid)).forEach(d => { put(R('chatReacts', `${d.data().msg}__${nid}`), { ...d.data(), uid: nid }); del(d.ref); });
  (await q('fcmTokens', 'uid', pid)).forEach(d => del(d.ref)); del(R('fcmTokens', pid));
  for (const c of ['profiles', 'hintsSent', 'angelGuess', 'thanks', 'wishPick']) { const sn = await getDoc(R(c, pid)).catch(() => null); if (sn && sn.exists()) { put(R(c, nid), sn.data()); del(R(c, pid)); } }
  (await q('hints', 'to', pid)).forEach(d => put(d.ref, { ...d.data(), to: nid }));
  for (const c of ['photos', 'photosFull']) (await q(c, 'uid', pid)).forEach(d => put(d.ref, { ...d.data(), uid: nid }));
  (await q('anonVotes', 'uid', pid)).forEach(d => { put(R('anonVotes', `${d.data().qid}__${nid}`), { ...d.data(), uid: nid }); del(d.ref); });
  (await q('anonVotes', 'choice', pid)).forEach(d => { if (d.data().uid !== pid) put(d.ref, { ...d.data(), choice: nid }); });
  (await q('triviaAns', 'uid', pid)).forEach(d => { put(R('triviaAns', `${d.data().qi}__${nid}`), { ...d.data(), uid: nid }); del(d.ref); });
  (await getDocs(collection(adb, 'chat'))).forEach(d => { const m = d.data(); let ch = false; const o = { ...m };
    if (m.uid === pid) { o.uid = nid; ch = true; }
    if (m.replyTo?.uid === pid) { o.replyTo = { ...m.replyTo, uid: nid }; ch = true; }
    if (m.r && pid in m.r) { o.r = { ...m.r, [nid]: m.r[pid] }; delete o.r[pid]; ch = true; }
    if (ch) put(d.ref, o); });
  if (S.reveal?.pairs?.some(x => x.g === pid || x.r === pid)) put(R('reveal', 'main'), { ...S.reveal, pairs: S.reveal.pairs.map(x => ({ g: x.g === pid ? nid : x.g, r: x.r === pid ? nid : x.r })) });
  if (S.event.guessWinner === pid) put(R('config', 'event'), { guessWinner: nid });
  (await q('angelGuess', 'guess', pid)).forEach(d => { if (d.id !== pid) put(d.ref, { ...d.data(), guess: nid }); });
  if (S.drawMeta?.ids?.includes(pid)) fin.set(R('config', 'draw'), { ...S.drawMeta, ids: S.drawMeta.ids.map(x => x === pid ? nid : x) });
  S.activities.filter(a => Array.isArray(a.results) && a.results.some(r => r.key === pid))
    .forEach(a => put(R('activities', a.id), { results: a.results.map(r => r.key === pid ? { ...r, key: nid } : r) }));
  // permisos de administrador, puntos de los juegos y mesas en las que está sentada
  { const st = await getDoc(R('staff', pid)).catch(() => null); if (st && st.exists()) { put(R('staff', nid), { ...st.data(), pid: nid }); del(R('staff', pid)); } }
  (await q('gameWins', 'uid', pid)).forEach(d => { put(R('gameWins', d.id.endsWith('_' + pid) ? d.id.slice(0, -pid.length) + nid : `${d.data().gid}_${nid}`), { ...d.data(), uid: nid }); del(d.ref); });
  for (const d of (await getDocs(query(collection(adb, 'games'), where('players', 'array-contains', pid)))).docs) {
    const g = d.data(), sw = x => x === pid ? nid : x;
    put(d.ref, { ...g, players: g.players.map(sw), host: sw(g.host), winners: (g.winners || []).map(sw) });
    const h = await getDoc(doc(adb, 'games', d.id, 'hands', pid)).catch(() => null);
    if (h && h.exists()) { put(doc(adb, 'games', d.id, 'hands', nid), h.data()); del(h.ref); }
  }
  // escribir en tandas (los set primero para no perder nada si se corta)
  ops.sort((a, b) => (a[0] === 'del') - (b[0] === 'del'));
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(adb);
    ops.slice(i, i + 400).forEach(([t, ref, data]) => t === 'set' ? b.set(ref, data, { merge: ref.path.startsWith('activities/') || ref.path === 'config/event' }) : b.delete(ref));
    await b.commit();
  }
  await fin.commit();
  return nid;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-preset-pin]'); if (!b || !S.isOwner) return;
  const p = P(b.dataset.presetPin); if (!p) return;
  const s2 = openModal(`<h3>🔑 Restablecer PIN</h3><p class="muted">Para <b>${esc(p.name)}</b>. La app le creará un <b>PIN temporal</b> para que te lo copies y se lo envíes. Sigue siendo la misma persona, con su sorteo, sus deseos y todo lo suyo. Cuando entre, la app le pedirá crear su propio PIN.</p>
    <div class="err" id="rp-err"></div>
    <div class="actions"><button class="btn" data-a="no">Cancelar</button><button class="btn gold" data-a="ok">🔑 Generar PIN temporal</button></div>`);
  s2.onclick = async ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return; if (a === 'no') return closeModal();
    const btn = s2.querySelector('[data-a=ok]'); busy(btn, true);
    let pin; const bad = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '1212']);
    do { pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0'); } while (bad.has(pin));
    try {
      await resetPin(p.id, pin);
      const msg = `Hola ${p.first} 👋 Tu PIN temporal del angelito es ${pin}. Entra, toca tu nombre, escribe ese PIN y la app te pedirá crear uno nuevo. 🎁`;
      s2.innerHTML = `<div class="center"><h3>✅ PIN temporal de ${esc(p.first)}</h3>
        <div class="reveal-name" style="letter-spacing:.2em">${pin}</div>
        <p class="muted small">Envíaselo por WhatsApp o díselo en persona.</p></div>
        <textarea class="in" id="rp-msg" readonly style="min-height:90px;margin-top:12px">${esc(msg)}</textarea>
        <div class="actions"><button class="btn" data-c="pin">📋 Copiar PIN</button><button class="btn gold" data-c="msg">📋 Copiar mensaje</button></div>
        <button class="btn ghost" data-c="close" style="width:100%;margin-top:8px">Listo</button>`;
      s2.onclick = async e2 => {
        const c = e2.target.closest('[data-c]')?.dataset.c; if (!c) return;
        if (c === 'close') return closeModal();
        const text = c === 'pin' ? pin : msg;
        try { await navigator.clipboard.writeText(text); toast('📋 Copiado'); }
        catch { const t = $('#rp-msg', s2); t.value = text; t.focus(); t.select(); toast('Selecciónalo y cópialo'); }
      };
    } catch (err) { console.error(err); $('#rp-err', s2).textContent = authErr(err); busy(btn, false); }
  };
});
/* ---------- ícono de perfil ---------- */
const ICONS = ['🎅','🤶','🧑‍🎄','🦌','⛄','☃️','🎄','🌟','⭐','✨','🎁','🎀','🔔','🕯️','🧦','🍪','🍬','🍭','🍫','🥂','🍷','☕','🍰','🧁',
  '🐶','🐱','🐻','🐼','🐨','🦊','🐰','🐧','🦉','🦁','🐯','🐮','🐷','🐸','🐵','🦄','🐝','🦋','🐢','🐬',
  '😀','😎','🤓','🥳','😇','🤠','🥰','😜','🤩','😴','🤗','🧐','👑','💃','🕺','🎸','🎤','🎧','⚽','⚾','🏀','🎮','📚','🎨','📸','✈️',
  '🌸','🌻','🌈','🔥','💎','❤️','💛','💚','💙','💜','🍀','🌙','☀️','🌊','🍕','🌮','🥑','🍓','🍉','🥭','🍍','🥥'];
function isOneEmoji(t) {
  t = (t || '').trim(); if (!t || t.length > 16) return false;
  try { if ([...new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(t)].length !== 1) return false; } catch { if ([...t].length > 4) return false; }
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(t);
}
function openIconPicker() {
  if (!S.me) return;
  let pick = S.me.emoji;
  const s2 = openModal(`<h3>😀 Elige tu ícono</h3><p class="muted small">Es el que verán todos junto a tu nombre.</p>
    <div style="display:flex;align-items:center;gap:12px;margin:12px 0"><div class="av" id="ic-prev" style="width:60px;height:60px;border-radius:18px;display:grid;place-items:center;font-size:34px;background:var(--card2)">${esc(pick)}</div>
      <input class="in" id="ic-own" maxlength="16" placeholder="O pega cualquier emoji 👉" style="flex:1"></div>
    <div class="chips" id="ic-grid" style="max-height:44vh;overflow:auto;gap:6px">${ICONS.map(x => `<button type="button" class="chip ${x === pick ? 'on' : ''}" data-ic="${x}" style="font-size:22px;padding:8px 10px">${x}</button>`).join('')}</div>
    <div class="err" id="ic-err"></div>
    <div class="actions"><button class="btn" data-a="no">Cancelar</button><button class="btn gold" data-a="ok">Guardar</button></div>`);
  const setPick = v => { pick = v; $('#ic-prev', s2).textContent = v; $$('#ic-grid .chip', s2).forEach(c => c.classList.toggle('on', c.dataset.ic === v)); $('#ic-err', s2).textContent = ''; };
  $('#ic-own', s2).addEventListener('input', e => { const v = e.target.value.trim(); if (isOneEmoji(v)) setPick(v); else if (v) $('#ic-err', s2).textContent = 'Pon un solo emoji.'; });
  s2.onclick = async e => {
    const c = e.target.closest('[data-ic]'); if (c) { $('#ic-own', s2).value = ''; return setPick(c.dataset.ic); }
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; if (a === 'no') return closeModal();
    if (!isOneEmoji(pick)) { $('#ic-err', s2).textContent = 'Elige un emoji.'; return; }
    if (pick === S.me.emoji) return closeModal();
    try { await setDoc(doc(db, 'participants', S.uid), { emoji: pick }, { merge: true }); closeModal(); toast(`${pick} ¡Listo, ese es tu ícono!`); }
    catch (err) { $('#ic-err', s2).textContent = authErr(err); }
  };
}
document.addEventListener('click', e => { if (e.target.closest('#prof-icon')) openIconPicker(); });
async function fullLogout() {
  toast('Cerrando sesión…');
  try { await signOut(auth); } catch { }
  try { await terminate(db); await clearIndexedDbPersistence(db); } catch (e) { console.warn(e); }  // borra la copia local de esta persona
  for (const k of Object.keys(localStorage)) if (/^angelito:(remind|ms|chatSeen|sugSeen):/.test(k)) try { localStorage.removeItem(k); } catch { }
  location.reload();
}
const staffEmail = u => `${u.trim().toLowerCase()}@staff.angelito.app`;
function adminLogin(user, pass) {
  const u = (user || '').trim().toLowerCase();
  const email = (!u || u === 'admin') ? ADMIN_EMAIL : u.includes('@') ? u : staffEmail(u);
  return signInWithEmailAndPassword(adminAuth, email, pass);
}
async function registerPerson(first, last, pin, byAdmin) {
  const name = `${first} ${last}`, nameKey = normName(name);
  const dup = await getDocs(query(collection(byAdmin ? adb : db, 'participants'), where('nameKey', '==', nameKey)));
  if (!dup.empty) return 'dup';
  const slug = nameKey.replace(/ñ/g, 'n').replace(/[^a-z0-9 ]/g, '').replace(/ /g, '.') || 'persona';
  const email = `${slug}.${Math.random().toString(36).slice(2, 7)}@angelito.app`;
  const cred = await createUserWithEmailAndPassword(byAdmin ? regAuth : auth, email, pinPass(pin));
  const used = new Set(S.participants.map(p => p.emoji));
  const emoji = EMOJIS.find(x => !used.has(x)) || EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  try {
    const xdb = byAdmin ? adb : db, w = writeBatch(xdb);
    w.set(doc(xdb, 'participants', cred.user.uid), { first, last, name, nameKey, email, emoji, at: serverTimestamp(), ...(byAdmin ? { mustChangePin: true } : {}) }); // quien inscribe no se queda con su PIN: al entrar crea el suyo
    w.set(doc(xdb, 'names', nameKey), { uid: cred.user.uid });
    await w.commit();
  } catch (e) { try { await deleteUser(cred.user); } catch { } throw e; }
  finally { if (byAdmin) { try { await signOut(regAuth); } catch { } } }
  return cred.user.uid;
}
function askPin(title, body) {
  return new Promise(res => {
    const s = openModal(`<h3>${esc(title)}</h3><p class="muted">${esc(body)}</p><div style="margin-top:14px">${pinField('v-pin', 'Tu PIN')}</div><div class="err" id="v-err"></div>
      <div class="actions"><button class="btn" data-a="no">Cancelar</button><button class="btn gold" data-a="ok">Continuar</button></div>`);
    onlyDigits(s); setTimeout(() => $('#v-pin', s)?.focus(), 80);
    const ok = async () => {
      const pin = $('#v-pin', s).value; if (!/^\d{4}$/.test(pin)) { $('#v-err', s).textContent = 'El PIN tiene 4 números.'; return; }
      const btn = s.querySelector('[data-a=ok]'); busy(btn, true);
      try { await signInWithEmailAndPassword(auth, S.me.email, pinPass(pin)); closeModal(); res(true); }
      catch (e) { $('#v-err', s).textContent = authErr(e); busy(btn, false); }
    };
    $('#v-pin', s).addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    s.onclick = e => { const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'no') { closeModal(); res(false); } if (a === 'ok') ok(); };
  });
}
function userMenu() {
  const row = (a, e, t, d, x = '') => `<button class="mrow" data-a="${a}"><span class="me-e">${SVGI[e] ? ic(e, 22) : e}</span><span class="grow"><b>${t}</b>${d ? `<span class="muted small">${d}</span>` : ''}</span>${x}<span class="chev">›</span></button>`;
  const pd = profDone();
  const s = openModal(`<div class="card who-card um-hd"><button class="av" data-a="icon" title="Cambiar mi ícono" aria-label="Cambiar mi ícono">${esc(S.me.emoji)}</button><div><h3 style="margin:0">${esc(S.me.name)}</h3><div class="muted small">Participante del angelito</div></div></div>
    <div class="mlist">
      ${mod('perfil') ? row('prof', 'shirt', 'Mi perfil de gustos', 'Tallas, colores y lo que te gusta', `<span class="cnt ${pd < PROF.length ? 'no' : 'ok'}">${pd}/${PROF.length}</span>`) : ''}
      ${S.isAdmin ? row('admin', 'shield', 'Panel de control', S.isOwner ? 'Organizador principal' : 'Tienes permisos de administrador') : ''}
      ${row('notif', 'bell', 'Notificaciones', 'Elige qué avisos recibir')}
      ${isInstalled() ? '' : row('install', 'phone', 'Instalar la app', 'Ábrela desde tu pantalla de inicio')}
      ${row('help', 'help', 'Ayuda', 'Guía, preguntas frecuentes y soluciones')}
    </div>
    <div class="actions"><button class="btn ghost" data-a="out">Cerrar sesión</button><button class="btn gold" data-a="close">Listo</button></div>`);
  s.onclick = async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; closeModal();
    if (a === 'org') return openAuth('org');
    if (a === 'icon') return openIconPicker();
    if (a === 'prof') return openProfile();
    if (a === 'help') return openHelp();
    if (a === 'admin') { location.hash = 'admin'; return; }
    if (a === 'notif') return openNotifPrefs();
    if (a === 'install') return installApp();
    if (a === 'out') return fullLogout();
  };
}

/* ---------- ❓ ayuda ---------- */
function openHelp() {
  const qa = (q, a) => `<details class="faq"><summary>${q}</summary><div>${a}</div></details>`;
  const s = openModal(`<h3>❓ Ayuda</h3><p class="muted small">Toca una pregunta para ver la respuesta.</p>
    <div class="stack" style="gap:8px;margin-top:12px">
      ${qa('🎡 ¿Cómo sé quién me tocó?', 'Cuando el organizador haga el sorteo, entra a <b>Ruleta</b> y gírala. Solo tú ves tu resultado: guarda el secreto 🤫.')}
      ${qa('🎁 ¿Para qué es la lista de deseos?', 'En <b>Deseos</b> escribe ideas de lo que te gustaría recibir (puedes poner foto, enlace y precio). Tu angelito la verá. También llena <b>Mi perfil de gustos</b> con tus tallas y colores.')}
      ${qa('🔐 Olvidé mi PIN', 'Pídele al organizador un <b>PIN temporal</b>. Entras con ese y la app te pide crear uno nuevo. No pierdes nada de lo tuyo.')}
      ${qa('👻 No me aparecen las personas o los datos', 'Revisa que tengas internet y toca <b>Recargar datos</b> aquí abajo. Eso vuelve a bajar todo; no borra nada ni cierra tu sesión.')}
      ${qa('🔔 No me llegan las notificaciones', 'Entra a tu menú → <b>Notificaciones</b> y actívalas. En iPhone primero hay que <b>instalar la app</b> en la pantalla de inicio. Si las bloqueaste, actívalas en los ajustes del teléfono.')}
      ${qa('📲 ¿Cómo instalo la app?', 'Toca el ícono de descarga arriba, o en el menú del navegador elige <b>Instalar app</b> / <b>Agregar a pantalla de inicio</b>.')}
      ${qa('🎮 ¿Cómo se juega?', 'En <b>Juegos</b> elige un juego, crea la mesa e invita con el enlace (o juega contra 🤖). Cada turno tiene tiempo: 1 minuto en dominó y 30 segundos en los demás; si se acaba, la app juega por ti. En la siguiente partida sale quien ganó.')}
      ${qa('💌 ¿Qué es el buzón anónimo?', 'Está en <b>Actividades</b>. Escribes mensajes sin que se sepa quién fuiste; se abren todos juntos el día que diga el organizador.')}
      ${qa('🛡️ Soy administrador, ¿dónde está el panel?', 'Si el organizador te dio permisos, toca el <b>engranaje</b> de arriba o tu menú → <b>Panel de control</b>. Entras con tu misma cuenta.')}
    </div>
    <div class="mlist" style="margin-top:14px">
      <button class="mrow" data-a="tour"><span class="me-e">${ic('book', 22)}</span><span class="grow"><b>Ver la guía paso a paso</b></span><span class="chev">›</span></button>
      <button class="mrow" data-a="reload"><span class="me-e">${ic('refresh', 22)}</span><span class="grow"><b>Recargar datos</b><span class="muted small">Si algo no aparece o se ve viejo</span></span><span class="chev">›</span></button>
      ${S.me && mod('chat') ? `<button class="mrow" data-a="chat"><span class="me-e">${ic('chat', 22)}</span><span class="grow"><b>Preguntar en el chat del grupo</b></span><span class="chev">›</span></button>` : ''}
    </div>
    <div class="actions"><button class="btn gold" data-a="close">Listo</button></div>`);
  s.onclick = e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; closeModal();
    if (a === 'tour') return openTour(true);
    if (a === 'reload') return repairData();
    if (a === 'chat') { location.hash = 'chat'; }
  };
}
// Toda la fila del interruptor es táctil, no solo la bolita.
document.addEventListener('click', e => { const sw = e.target.closest('.switch'); if (!sw || e.target.closest('button,a,input,select,label')) return; sw.querySelector('.tg')?.click(); });
document.addEventListener('click', e => { if (e.target.closest('[data-help]')) { e.preventDefault(); openHelp(); } });

/* ---------- routing ---------- */
const VIEWS = ['inicio', 'ruleta', 'deseos', 'actividades', 'anonimos', 'buzon', 'juegos', 'admin'];
const tabScroll = {}; let curView = null;
function route() {
  // las animaciones de entrada de listas solo al cambiar de pantalla (no cada vez que llegan datos nuevos)
  document.body.classList.add('anim-in'); clearTimeout(route.t); route.t = setTimeout(() => document.body.classList.remove('anim-in'), 1100);
  if (!history.state?.sheet) sheetEntry = false;
  if (curView) tabScroll[curView] = scrollY;
  let v = location.hash.slice(1);
  if (v === 'chat') { v = 'buzon'; S.buz = 'c'; }
  if (v === 'fotos') { v = 'buzon'; S.buz = 'c'; } // la sección de fotos se quitó: las fotos van por el chat
  if (v === 'sugerencias') { v = 'buzon'; S.buz = 's'; }
  if (v.startsWith('juego-')) v = 'juegos';
  if (v.startsWith('actividad-')) { S.actId = v.slice(10); v = 'actividad'; renderActDetail(); }
  else if (!VIEWS.includes(v)) v = 'inicio';
  if (v === 'actividades' && !mod('agenda') && mod('anonimos')) v = 'anonimos';
  if (!viewOn(v)) v = 'inicio';
  if (v === 'buzon') setBuz(S.buz);
  $$('.view').forEach(el => el.classList.toggle('on', el.id === 'v-' + v));
  const tv = v === 'actividad' || v === 'anonimos' ? 'actividades' : v === 'buzon' && S.buz === 's' ? 'sugerencias' : v;
  $$('.tab').forEach(el => el.classList.toggle('on', el.dataset.v === tv));
  document.body.classList.toggle('ideas-on', v === 'buzon' && S.buz === 's');
  $('#v-buzon .sec-title').textContent = v === 'buzon' && S.buz === 's' ? 'Ideas' : 'Chat';
  try { renderHelper(); } catch { }
  document.body.classList.toggle('adm-view', v === 'admin');
  $('#gear').style.background = v === 'admin' ? 'var(--cream)' : '';
  if (v === 'ruleta') requestAnimationFrame(drawWheel);
  if (v === 'juegos') { try { GAMES.render(); } catch (e) { console.error(e); } } else { try { GAMES.leaveView(); } catch { } }
  const same = curView === v; curView = v;
  document.body.classList.toggle('chat-on', v === 'buzon' && S.buz === 'c');
  syncImmersive();
  if (!same) requestAnimationFrame(() => { scrollTo({ top: v === 'actividad' || (v === 'buzon' && S.buz === 'c') || (v === 'juegos' && location.hash.includes('juego-')) ? 0 : (tabScroll[v] || 0) }); fitChat(); });
}
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) location.hash = g.dataset.go; });
$$('.tab').forEach(t => t.addEventListener('click', () => { if (t.dataset.v === 'buzon') S.buz = 'c'; if (t.dataset.v === 'sugerencias') S.buz = 's'; if (location.hash === '#' + t.dataset.v) route(); else location.hash = t.dataset.v; }));
$('#gear').addEventListener('click', () => { location.hash = 'admin'; });
$('#h-sug').addEventListener('click', e => { if (location.hash === '#sugerencias') { e.preventDefault(); route(); } });
let logoTaps = [];
$('.brand').addEventListener('click', () => {
  const now = Date.now(); logoTaps = logoTaps.filter(t => now - t < 3000); logoTaps.push(now);
  if (logoTaps.length >= 5) { logoTaps = []; location.hash = 'admin'; }
});
addEventListener('hashchange', route);

/* ---------- render ---------- */
let rq = false;
function render() { if (rq) return; rq = true; requestAnimationFrame(() => { rq = false; renderAll(); }); }
function applyMods() {
  $$('.tab').forEach(t => { const v = t.dataset.v; t.style.display = (v === 'sugerencias' ? mod('buzon') : v === 'buzon' ? mod('chat') : viewOn(v)) ? '' : 'none'; });
  const cur = location.hash.slice(1).startsWith('actividad-') ? 'actividad' : location.hash.slice(1);
  if (!viewOn(cur)) route();
  if ($('#v-buzon').classList.contains('on')) setBuzQuiet();
  $('#h-acts').parentElement && ($('#h-acts').style.display = mod('agenda') ? '' : 'none');
  const hr = $('#h-acts').previousElementSibling; if (hr) hr.style.display = mod('agenda') ? '' : 'none';
}
function renderGames() { if ($('#v-juegos').classList.contains('on')) GAMES.render(); }
/* ---------- 💡 ayudante flotante ----------
   Un bombillito en la esquina con UN consejo a la vez según lo que te falta (avisos, talla, deseos, ruleta…)
   y, si ya está todo, invita a compartir ideas. Se asoma solo una vez al entrar y se esconde solo; nunca tapa nada importante. */
function helperTips() {
  if (!S.me) return [];
  const c = S.event, a = S.att[S.uid] || {}, t = [];
  if (canNotify() && Notification.permission !== 'granted' && !(isIOS() && !isStandalone())) t.push(['🔔', Notification.permission === 'denied' ? 'Tus avisos están bloqueados. Toca y te explico cómo activarlos' : '¿Te avisamos de los mensajes y de tu angelito? Actívalos aquí', 'notif', 'Activar']);
  if (mod('ruleta') && S.drawMeta && drawReady() && S.drawMeta.ids?.includes(S.uid) && !S.assignment?.revealed) t.push(['🎡', '¡Ya puedes girar la ruleta y ver a quién le regalas!', '#ruleta', 'Girar']);
  if (mod('asistencia') && !a.status) t.push(['🎉', '¿Vas al angelito? Confírmalo en un toque', 'att', 'Confirmar']);
  if (mod('perfil') && profDone() < 4) t.push(['👕', 'Pon tu talla y tus gustos para que tu angelito acierte', 'perfil', 'Completar']);
  if (mod('deseos') && !S.wishes.some(w => w.uid === S.uid)) t.push(['🎁', 'Escribe 2 o 3 ideas de regalo en tu lista de deseos', '#deseos', 'Escribir']);
  const unread = typeof chatUnread === 'function' ? chatUnread() : 0;
  if (mod('chat') && unread) t.push(['💬', `Tienes ${unread} ${unread === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} en el chat`, '#chat', 'Leer']);
  if (!isInstalled() && !(isIOS() && isStandalone())) t.push(['📲', 'Pon el Angelito en tu pantalla de inicio: abre al instante', 'install', 'Instalar']);
  if (mod('anonimos') && !isRevealed()) t.push(['💌', 'En el buzón anónimo puedes escribirle a alguien sin que sepa que fuiste tú', '#anonimos', 'Escribir']);
  if (mod('sugerencias')) t.push(['💡', '¿Tienes una idea para el angelito? Compártela aquí', '#sugerencias', 'Compartir']);
  return t;
}
let helpI = 0, helpT = null;
function renderHelper() {
  const el = $('#helper'); if (!el) return;
  const busy = !S.me || S.forcePin || S.spinning || (typeof PARTY !== 'undefined' && PARTY) || location.hash.startsWith('#juego-') || location.hash === '#admin' || ($('#v-buzon')?.classList.contains('on') && S.buz === 'c') || document.body.classList.contains('kb'); // en el chat no estorba al escribir
  const tips = helperTips();
  el.hidden = busy || !tips.length; if (el.hidden) { el.classList.remove('open'); return; }
  el.classList.toggle('pend', tips[0][2] !== '#sugerencias'); // brilla solo si hay algo pendiente de verdad
  { const n = tips.filter(t => t[2] !== '#sugerencias').length, bt = $('#helper-btn'); if (bt.dataset.n !== String(n)) { bt.dataset.n = n; bt.innerHTML = `<span class="hb-orb">💡</span>${n ? `<span class="hb-n">${n}</span>` : ''}`; } }
  if (el.classList.contains('open')) fillHelper(tips);
  // se asoma una vez por sesión, un rato después de entrar y en un momento tranquilo
  let shown = false; try { shown = sessionStorage.getItem('angelito:helper') === '1'; } catch { }
  if (!shown && !helpT && !$('#modal').classList.contains('on')) helpT = setTimeout(() => { helpT = null; if ($('#modal').classList.contains('on') || $('#helper').hidden) return; try { sessionStorage.setItem('angelito:helper', '1'); } catch { } openHelper(true); }, 6000);
}
function fillHelper(tips) {
  const n = tips.length, k = helpI % n, [e, txt, go, cta] = tips[k];
  $('#helper-b').innerHTML = `<div class="hb-top"><span class="hb-k">${ic('bulb', 14)} Consejo${n > 1 ? ` ${k + 1} de ${n}` : ''}</span><button class="hb-x" data-hclose aria-label="Cerrar">${ic('x', 16)}</button></div>
    <div class="hb-main"><span class="hb-e">${e}</span><span class="hb-t">${esc(txt)}</span></div>
    ${n > 1 ? `<div class="hb-dots">${tips.map((_, i) => `<i class="${i === k ? 'on' : ''}"></i>`).join('')}</div>` : ''}
    <div class="hb-a"><button class="btn sm gold" data-hgo="${esc(go)}">${esc(cta)}</button>${n > 1 ? `<button class="btn sm ghost" data-hnext>Siguiente ${ic('back', 14)}</button>` : ''}</div>`;
  const b = $('#helper-b'); b.classList.remove('swap'); void b.offsetWidth; b.classList.add('swap');
}
function openHelper(auto) {
  const tips = helperTips(); if (!tips.length) return;
  fillHelper(tips); $('#helper').classList.add('open');
  clearTimeout(openHelper.t); if (auto) openHelper.t = setTimeout(() => $('#helper').classList.remove('open'), 9000);
}
$('#helper').addEventListener('click', e => {
  const el = $('#helper'); clearTimeout(openHelper.t);
  if (e.target.closest('[data-hclose]')) { el.classList.remove('open'); helpI++; return; }
  if (e.target.closest('[data-hnext]')) { helpI++; fillHelper(helperTips()); return; }
  const g = e.target.closest('[data-hgo]')?.dataset.hgo;
  if (g) {
    el.classList.remove('open'); helpI++;
    if (g === 'notif') enableNotifications(); else if (g === 'perfil') openProfile(); else if (g === 'install') installApp();
    else if (g === 'att') { location.hash = 'inicio'; setTimeout(() => $('#h-att')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }
    else location.hash = g.slice(1);
    return;
  }
  if (e.target.closest('#helper-btn')) { if (helperDrag.moved) return; if (el.classList.contains('open')) el.classList.remove('open'); else openHelper(false); }
});
// El 💡 se puede arrastrar a cualquier altura y se pega al borde izquierdo o derecho (se recuerda en este teléfono).
const helperDrag = { moved: false };
function placeHelper(pos) {
  const el = $('#helper'); if (!el) return;
  const p = pos || (() => { try { return JSON.parse(localStorage.getItem('angelito:helperPos') || 'null'); } catch { return null; } })();
  if (!p) return;
  const maxB = innerHeight - 140, b = Math.max(84, Math.min(maxB, p.b));
  el.style.bottom = b + 'px'; el.classList.toggle('left', p.side === 'left');
  el.style.left = p.side === 'left' ? '14px' : 'auto'; el.style.right = p.side === 'left' ? 'auto' : '14px';
}
(() => {
  const btn = $('#helper-btn'), el = $('#helper'); if (!btn) return;
  let sx = 0, sy = 0, startB = 0, id = null;
  btn.addEventListener('pointerdown', e => {
    id = e.pointerId; sx = e.clientX; sy = e.clientY; helperDrag.moved = false;
    startB = innerHeight - el.getBoundingClientRect().bottom; btn.setPointerCapture(id);
  });
  btn.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!helperDrag.moved && Math.hypot(dx, dy) < 8) return; // un toque normal no lo mueve
    helperDrag.moved = true; el.classList.add('drag'); el.classList.remove('open');
    el.style.left = Math.max(4, Math.min(innerWidth - 56, e.clientX - 24)) + 'px'; el.style.right = 'auto';
    el.style.bottom = Math.max(70, Math.min(innerHeight - 70, startB - dy)) + 'px';
  });
  const end = e => {
    if (e.pointerId !== id) return; id = null; el.classList.remove('drag');
    if (!helperDrag.moved) return;
    const pos = { side: e.clientX < innerWidth / 2 ? 'left' : 'right', b: parseFloat(el.style.bottom) || 92 };
    placeHelper(pos); try { localStorage.setItem('angelito:helperPos', JSON.stringify(pos)); } catch { }
    setTimeout(() => { helperDrag.moved = false; }, 50); // que el "click" que sigue al soltar no abra la burbuja
  };
  btn.addEventListener('pointerup', end); btn.addEventListener('pointercancel', end);
  placeHelper(); addEventListener('resize', () => placeHelper());
})();
function renderAll() {
  for (const f of [renderHelper, applyMods, renderUser, renderHome, renderWheel, renderWishes, renderActs, renderActDetail, renderQuestions, renderSuggestions, renderMyAngel, renderProgress, renderAttendance, renderAppCard, renderNotices, renderBadges, renderHints, renderThanks, renderPhotos, renderLive, renderMemCard, renderPartyLive, saveBoot, renderQuick, renderRevealBtn, renderNoticeAdmin, checkEvents, renderChat, renderGames, renderProfCard, renderUserDot, renderNext, renderAdmin]) { try { f(); } catch (e) { console.error('render', f.name, e); } }
}
const GAMES = initGames({ db, fs: { doc, collection, onSnapshot, query, orderBy, limit, setDoc, getDoc, writeBatch, runTransaction }, S, esc, toast, $, openModal, closeModal, confirmBox, render, confetti,
  P, pName, pEmoji, shortName, authErr, can, needLogin: t => needLogin(t), notify: (t, b, u) => notifyCat('juegos', t, b, u) });
function renderAllOld() { applyMods(); renderUser(); renderHome(); renderWheel(); renderWishes(); renderActs(); renderActDetail(); renderQuestions(); renderSuggestions(); renderMyAngel(); renderProgress(); renderAttendance(); renderAppCard(); renderNotices(); renderNoticeAdmin(); checkEvents(); renderChat(); renderAdmin(); }
const needLogin = (txt) => `<div class="card lockcard"><span class="e">🔐</span><p>${txt}</p><div style="display:flex;gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap"><button class="btn gold" data-auth="login">Entrar</button><button class="btn" data-auth="reg">Registrarme</button></div></div>`;
document.addEventListener('click', e => { const b = e.target.closest('[data-auth]'); if (b) openAuth(b.dataset.auth); });
document.addEventListener('click', async e => {
  if (!e.target.closest('#join-other')) return;
  if (!(await confirmBox('¿Inscribir a otra persona?', `Se cerrará la sesión de ${S.me.first} en este teléfono. Luego podrás volver a entrar con tu PIN.`, 'Continuar'))) return;
  try { sessionStorage.setItem('angelito:afterLogout', 'reg'); } catch { } return fullLogout();
});

function renderUserDot() { document.body.classList.toggle('logged', !!S.me); const u = $('#ubtn'); if (!u) return; const need = S.me && mod('perfil') && profDone() < 4; let d = u.querySelector('.rdot'); if (need && !d) { d = document.createElement('span'); d.className = 'rdot'; u.appendChild(d); } else if (!need && d) d.remove(); }
function renderUser() {
  const box = $('#userbox');
  $('#gear').style.display = S.isAdmin ? '' : 'none';
  if (!S.authReady && !S.me) { box.innerHTML = '<span class="pill"><span class="spin-dots" style="width:12px;height:12px;border-width:2px"></span></span>'; return; }
  box.innerHTML = S.me ? `<button class="userchip" id="ubtn"><span class="av">${esc(S.me.emoji)}</span>${esc(shortName(S.me))}</button>` : `<button class="userchip login" data-auth="login">Entrar</button>`;
  $('#ubtn')?.addEventListener('click', userMenu);
  $('#gear').style.display = S.isAdmin ? '' : 'none';
}

function renderHome() {
  const c = S.event;
  $('#h-title').textContent = c.eventName || 'Angelito de Navidad';
  $('#h-sub').textContent = c.subtitle || 'Regalos, sorpresas y buena compañía.';
  $('#h-eyebrow').textContent = c.eventDate ? 'Intercambio · ' + fmtDate(c.eventDate, { day: 'numeric', month: 'long', year: 'numeric' }) : 'Angelito de Navidad';
  const info = [
    ['calendar', 'Fecha', c.eventDate ? fmtDate(c.eventDate) : 'Por definir'],
    ['clock', 'Hora', c.eventDate ? hm(new Date(c.eventDate)) : 'Por definir'],
    ['pin', 'Lugar', c.place || 'Por definir'],
    ['wallet', 'Presupuesto', c.budget || 'Por definir'],
  ];
  if (c.dress) info.push(['dress', 'Vestimenta', c.dress]);
  if (c.contribAmount && mod('asistencia')) info.push(['coins', 'Aporte', c.contribAmount]);
  info.push(['users', 'Participantes', S.participants.length ? `${S.participants.length} ${S.participants.length === 1 ? 'inscrito' : 'inscritos'}` : 'Aún nadie']);
  const known = info.filter(x => x[2] !== 'Por definir');
  $('#h-info').innerHTML = known.map(([i, k, v], n) => `<div class="irow"><span class="ir-ic c${n % 5 + 1}">${ic(i, 18)}</span><div class="ir-t"><div class="k">${k}</div><div class="v">${esc(v)}</div></div></div>`).join('')
    + (known.length < info.length ? `<div class="irow pend" style="grid-column:1/-1"><div class="v muted" style="font-weight:500;display:flex;gap:8px;align-items:center">${ic('hourglass', 16)} ${info.filter(x => x[2] === 'Por definir').map(x => x[1].toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' y $1')}: el organizador lo anunciará pronto</div></div>` : '');
  const n = $('#h-notes'); n.style.display = c.notes ? '' : 'none'; n.textContent = c.notes || '';
  const rules = Array.isArray(c.rules) ? c.rules : [];
  $('#h-sug').style.display = mod('buzon') ? '' : 'none';
  const hr = $('#h-rules'); hr.style.display = rules.length && mod('reglas') ? '' : 'none';
  const showR = S.rulesOpen || rules.length <= 3 ? rules : rules.slice(0, 3);
  hr.innerHTML = rules.length ? `<h2>📜 Reglas del angelito</h2><div class="rules">${showR.map((r, i) => `<div class="rule"><div class="ri">${esc(r.icon || '⭐')}</div><div class="rt"><span class="rn">${i + 1}.</span>${esc(r.text)}</div></div>`).join('')}</div>
    ${rules.length > 3 ? `<button class="btn sm ghost" id="rules-more" style="margin-top:10px;width:100%">${S.rulesOpen ? 'Ver menos ▴' : `Ver las ${rules.length} reglas ▾`}</button>` : ''}` : '';
  const jn = $('#h-join'), cnt = S.participants.length;
  if (!S.authReady) jn.innerHTML = '';
  else if (!regOpen()) jn.innerHTML = S.me ? '' : `<div class="card join"><div class="je">🔒</div><div style="flex:1"><b>Inscripciones cerradas</b><div class="muted small">Si ya estás inscrito, entra con tu PIN.</div></div><button class="btn gold" data-auth="login">Entrar</button></div>`;
  else if (!S.me) jn.innerHTML = `<div class="card join big"><div class="je">✍️</div><h3>¡Únete al angelito!</h3>
      <p class="muted">Regístrate con tu nombre, tu apellido y un PIN de 4 números. ${cnt ? `Ya hay <b>${cnt}</b> ${cnt === 1 ? 'inscrito' : 'inscritos'}.` : '¡Sé el primero!'}</p>
      <div class="jb"><button class="btn primary" data-auth="reg">🎁 Registrarme</button><button class="btn" data-auth="login">Ya estoy inscrito</button></div></div>`;
  else jn.innerHTML = '';
  $('#h-join2').innerHTML = ''; // la tarjeta "¿Alguien más quiere participar?" ya no se muestra
  renderTodo();
  const upcoming = S.activities.filter(a => !a.date || a.date >= todayStr());
  const homeActs = (upcoming.length ? upcoming : S.activities).slice(0, 3);
  $('#h-acts').innerHTML = S.activities.length ? `<div class="tl">${homeActs.map(a => `
    <a class="ev clk" href="#actividad-${esc(a.id)}"><div class="card"><div class="em">${esc(a.emoji || '🎁')}</div><div style="flex:1">
      <div class="when">${esc(fmtDate(a.date))}${a.time ? ' · ' + esc(fmtTime(a.time)) : ''}</div>
      <h3>${esc(a.title)}</h3>${a.place ? `<p>📍 ${esc(a.place)}</p>` : ''}${kindTag(a)}
    </div><span class="chev">›</span></div></a>`).join('')}</div>`
    : '';
  const ah = $('#h-acts').previousElementSibling; if (ah && mod('agenda')) ah.style.display = S.activities.length ? '' : 'none';
}

/* ---------- tus pendientes ---------- */
/* ---------- 📘 guía para quien entra por primera vez ---------- */
const TOUR = () => [
  ['🎁', `¡Bienvenido, ${S.me?.first || ''}!`, 'Esta es la app del angelito: aquí pasa todo antes y durante la fiesta. Te enseñamos lo principal en 1 minuto.'],
  ['👕', 'Tu perfil es lo más importante', 'Pon tu talla, tus colores y lo que te gusta. Así tu angelito acierta con el regalo. Lo encuentras en tu nombre (arriba) o en Deseos.'],
  ['🎁', 'Tu lista de deseos', 'Escribe lo que te gustaría recibir, con foto si quieres. Marca con ⭐ el que más quieres.'],
  ['🎡', 'La ruleta', 'Cuando el organizador haga el sorteo, gira la ruleta para descubrir a quién le regalas. ¡Es secreto!'],
  ['💬', 'Chat del grupo', 'Escribe ocurrencias, menciona a alguien con @ para que le llegue el aviso, y si no sabes qué decir toca el 🎲.'],
  ['🎮', 'Juegos', 'Dominó, ahorcado, 4 en línea y X y O con el grupo o contra 🤖. Ganar suma puntos en la tabla de campeones.'],
  ['📲', 'Instálala y activa los avisos', 'Así te enteras de la ruleta, las pistas de tu angelito y los mensajes. Busca el 📲 arriba.'],
];
function openTour(force) {
  if (!S.me) return;
  const key = 'angelito:tour:' + S.uid;
  if (!force) { try { if (localStorage.getItem(key)) return; } catch { } }
  try { localStorage.setItem(key, '1'); } catch { }
  const T = TOUR().filter((_, k) => !(k === 1 && !mod('perfil')) && !(k === 5 && !mod('juegos'))); let i = 0;
  const s2 = openModal('<div id="tour"></div>');
  const paint = () => {
    const [e, t, d] = T[i], last = i === T.length - 1;
    $('#tour', s2).innerHTML = `<div class="tour-e">${e}</div><h3 style="text-align:center">${esc(t)}</h3><p class="muted" style="text-align:center">${esc(d)}</p>
      <div class="tour-dots">${T.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      ${last ? `<div class="stack" style="margin-top:14px">${mod('perfil') ? '<button class="btn gold" data-t="prof">👕 Llenar mi perfil ahora</button>' : ''}<button class="btn" data-t="wish">🎁 Escribir mis deseos</button></div>` : ''}
      <div class="actions">${i ? '<button class="btn ghost" data-t="prev">‹ Atrás</button>' : '<button class="btn ghost" data-t="skip">Saltar</button>'}${last ? '<button class="btn" data-t="skip">Listo</button>' : '<button class="btn gold" data-t="next">Siguiente ›</button>'}</div>`;
  };
  paint();
  s2.onclick = e => {
    const t = e.target.closest('[data-t]')?.dataset.t; if (!t) return;
    if (t === 'next') { i = Math.min(T.length - 1, i + 1); paint(); } else if (t === 'prev') { i = Math.max(0, i - 1); paint(); }
    else { closeModal(); if (t === 'prof') setTimeout(openProfile, 150); if (t === 'wish') location.hash = 'deseos'; }
  };
  let x0 = null; s2.onpointerdown = e => { x0 = e.clientX; }; s2.onpointerup = e => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 60) { i = Math.max(0, Math.min(T.length - 1, i + (dx < 0 ? 1 : -1))); paint(); } };
}
let tourT = null;
function maybeTour() {
  if (!S.me || S.forcePin || tourT) return;
  try { if (localStorage.getItem('angelito:tour:' + S.uid)) return; } catch { }
  tourT = setTimeout(function go() { tourT = null; if (!S.me) return; if ($('#modal').classList.contains('on') || S.spinning) { tourT = setTimeout(go, 3000); return; } openTour(); }, 1200);
}
/* ---------- lo que te toca ahora (cambia según el momento) ---------- */
function renderNext() {
  const box = $('#h-next'); if (!box) return;
  if (!S.me) { box.innerHTML = ''; return; }
  const c = S.event, today = todayStr(), evDay = (c.eventDate || '').slice(0, 10);
  const A = S.assignment, ready = mod('ruleta') && S.drawMeta && drawReady() && S.drawMeta.ids?.includes(S.uid);
  let h = '';
  if (evDay && evDay === today) h = `<div class="card nextc"><div class="nx-e">🎉</div><div class="grow"><b>¡Hoy es el angelito!</b><div class="muted small">${c.place ? '📍 ' + esc(c.place) + ' · ' : ''}${esc(hm(new Date(c.eventDate)))}</div></div><a class="btn sm gold" href="#actividades">Ver agenda</a></div>`;
  else if (ready && !A?.revealed) h = `<a class="card nextc hot" href="#ruleta"><div class="nx-e spin">🎡</div><div class="grow"><b>¡Ya puedes girar la ruleta!</b><div class="muted small">Descubre a quién le vas a regalar.</div></div><span class="btn sm gold">Girar ahora</span></a>`;
  else if (ready && A?.revealed && A.recipient && P(A.recipient)) {
    const R = P(A.recipient);
    h = `<div class="card nextc"><div class="nx-e">🤫</div><div class="grow"><b>Le regalas a <button class="peek" id="nx-peek">${S.peek ? esc(R.emoji + ' ' + R.name) : '•••• 👁️'}</button></b><div class="muted small">Es secreto. Toca para ver.</div>
      <div class="qa" style="margin-top:8px"><button class="btn sm gold" id="nx-list">🎁 Ver su lista</button>${mod('pistas') ? '<a class="btn sm" href="#ruleta">💌 Mandar una pista</a>' : ''}</div></div></div>`;
  }
  box.innerHTML = h;
}
document.addEventListener('click', e => {
  if (e.target.closest('#nx-peek')) { S.peek = !S.peek; renderNext(); if (S.peek) setTimeout(() => { S.peek = false; renderNext(); }, 4000); }
  if (e.target.closest('#nx-list') && S.assignment?.recipient) { S.wishPid = S.assignment.recipient; location.hash = 'deseos'; render(); }
});
// 💌 El buzón anónimo en Inicio, para que nadie se lo pierda
function anonCardHTML() {
  if (!S.me || !mod('anonimos') || isRevealed()) return '';
  const n = S.qCount || 0;
  return `<a class="card anonhome" href="#anonimos"><span class="ah-e">💌</span><div class="grow"><b>Buzón anónimo</b><div class="muted small">Escríbele algo bonito a alguien del grupo… sin que sepa que fuiste tú 🤫${n ? ` · ${n} ${n === 1 ? 'mensaje guardado' : 'mensajes guardados'}` : ''}</div></div><span class="btn sm gold">Escribir</span></a>`;
}
function renderTodo() {
  const box = $('#h-todo'); if (!box) return;
  if (!S.me) { box.innerHTML = ''; return; }
  const anon = anonCardHTML();
  const c = S.event, a = S.att[S.uid] || {}, items = [];
  if (mod('asistencia')) items.push([!!a.status, a.status === 'no' ? 'Dijiste que no puedes ir' : 'Confirma si vas', 'att']);
  if (mod('asistencia') && c.contribAmount && a.status === 'si') items.push([!!(a.paid || a.confirmed), `Da tu aporte de ${c.contribAmount}`, 'att']);
  if (mod('deseos')) items.push([S.wishes.some(w => w.uid === S.uid), 'Escribe tu lista de deseos', '#deseos']);

  if (mod('ruleta') && S.drawMeta && drawReady() && S.drawMeta.ids.includes(S.uid)) items.unshift([!!S.assignment?.revealed, 'Gira la ruleta y descubre a quién le regalas', '#ruleta']);
  if (canNotify() && !(isIOS() && !isStandalone())) items.push([Notification.permission === 'granted', 'Activa los avisos para enterarte de todo', 'notif']);
  if (!isInstalled()) items.push([false, 'Pon el angelito en tu pantalla de inicio', 'install']);
  if (!items.length) { box.innerHTML = anon; return; }
  const done = items.filter(x => x[0]).length;
  if (done === items.length) { box.innerHTML = `<div class="card todo-ok">🎉 <b>¡Tienes todo listo!</b> <span class="muted small">Solo falta disfrutar el angelito.</span></div>` + anon; return; }
  const TI = { att: ['calcheck', 'c1'], '#deseos': ['gift', 'c2'], '#ruleta': ['wheel', 'c3'], notif: ['bell', 'c4'], install: ['install', 'c5'] };
  const ord = [...items.filter(x => !x[0]), ...items.filter(x => x[0])], pct = Math.round(done / items.length * 100);
  box.innerHTML = `<div class="card todo"><div class="todo-h"><b>Tus pendientes</b><span class="todo-n">${done}/${items.length}</span></div>
    <div class="tbar"><i style="width:${pct}%"></i></div>
    <div class="steps">${ord.map(([ok, l, go], k) => { const [icn, col] = TI[go] || ['check', 'c1']; return `<button class="step ${ok ? 'done' : ''}" data-todo="${go}" style="--d:${k * 60}ms"><span class="st-ic ${col}">${ok ? ic('check', 18) : ic(icn, 18)}</span><span class="st-l">${esc(l)}</span>${ok ? '' : `<span class="go">${ic('back', 16)}</span>`}</button>`; }).join('')}</div></div>` + anon;
}
document.addEventListener('click', e => {
  if (e.target.closest('#rules-more')) { S.rulesOpen = !S.rulesOpen; renderHome(); return; }
  const t = e.target.closest('[data-todo]'); if (!t) return;
  const go = t.dataset.todo;
  if (go === 'att') $('#h-att')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); else if (go === 'perfil') openProfile(); else if (go === 'notif') enableNotifications(); else if (go === 'install') installApp(); else location.hash = go.slice(1);
});
function tick() {
  const cands = [S.event.eventAt ? new Date(ms(S.event.eventAt)) : null, S.event.eventDate ? new Date(S.event.eventDate.length <= 10 ? S.event.eventDate + 'T00:00' : S.event.eventDate) : null];
  const t = cands.find(x => x && !isNaN(x) && x.getFullYear() > 2000) || null;
  const d = t ? Math.max(0, t - Date.now()) : null;
  const set = (k, v) => { const el = $(`[data-c="${k}"]`); if (el) el.textContent = v; };
  const cnt = $('.hero .count'), nd = $('#h-nodate');
  if (cnt) cnt.hidden = d == null; if (nd) nd.hidden = d != null;
  if (d == null) return;
  set('d', Math.floor(d / 864e5)); set('h', String(Math.floor(d / 36e5) % 24).padStart(2, '0'));
  set('m', String(Math.floor(d / 6e4) % 60).padStart(2, '0')); set('s', String(Math.floor(d / 1e3) % 60).padStart(2, '0'));
}
setInterval(tick, 1000);

/* ---------- ruleta ---------- */
function renderWheel() {
  const top = $('#r-top'), btn = $('#spinBtn'), msg = $('#r-msg');
  let canSpin = false; btn.style.display = '';
  if (!S.me) {
    top.innerHTML = S.authReady ? needLogin('Entra con tu nombre y tu PIN para girar.') : ''; btn.style.display = 'none'; msg.textContent = '';
  } else {
    top.innerHTML = `<div class="card who-card"><div class="av">${esc(S.me.emoji)}</div><div class="grow"><div class="muted small">Vas a girar como</div><b style="font-size:1.15rem">${esc(S.me.name)}</b><div class="wc-st" id="wc-st"></div></div></div>`;
    if (!S.drawMeta || !drawReady() || !S.drawMeta.ids.includes(S.uid)) msg.textContent = 'La ruleta está inhabilitada por ahora. ¡Vuelve pronto! 🎄';
    else if (!S.assignment) msg.textContent = 'Cargando tu sorteo…';
    else { canSpin = true; msg.textContent = S.assignment.revealed ? 'Ya giraste. Puedes volver a verlo con tu PIN.' : `¡Mucha suerte, ${S.me.first}! 🍀`; }
    btn.innerHTML = S.assignment?.revealed ? '🔐 Ver a quién me tocó' : '🎡 Girar la ruleta';
    if (canSpin && needGuess()) { btn.innerHTML = '🔮 Primero guarda tu adivinanza'; msg.textContent = 'Antes de girar, escribe abajo qué crees que te van a regalar 👇'; }
    if (!canSpin && !(S.drawMeta && drawReady() && S.drawMeta.ids.includes(S.uid))) btn.innerHTML = '🔒 Ruleta inhabilitada';
  }
  btn.disabled = S.spinning || !canSpin;
  const locked = !!S.me && !canSpin && !S.spinning && !(S.drawMeta && drawReady() && S.drawMeta.ids?.includes(S.uid));
  const wasLocked = $('#v-ruleta').classList.contains('locked');
  $('#v-ruleta').classList.toggle('locked', locked);
  const st = $('#wc-st');
  if (st) st.innerHTML = locked ? `<span class="wc-pill">${ic('lock', 14)} Se abre cuando el organizador haga el sorteo</span>` : canSpin && S.assignment && !S.assignment.revealed ? `<span class="wc-pill go">${ic('wheel', 14)} ¡Ya puedes girar!</span>` : '';
  if (locked) msg.innerHTML = '';
  wheelBulbs();
  if (!S.spinning) { if (wasLocked !== locked) requestAnimationFrame(drawWheel); else drawWheel(); }
}
// Bombillos alrededor de la ruleta (animados con CSS)
function wheelBulbs() {
  const w = $('#wheel')?.closest('.wheel-wrap'); if (!w || w.querySelector('.bulbs')) return;
  const d = document.createElement('div'); d.className = 'bulbs'; d.setAttribute('aria-hidden', 'true');
  d.innerHTML = Array.from({ length: 20 }, (_, k) => `<i style="--a:${k * 18}deg;--k:${k % 2}"></i>`).join(''); w.appendChild(d);
}
function drawWheel() {
  const cv = $('#wheel'); const size = cv.clientWidth; if (!size) return;
  const dpr = devicePixelRatio || 1; cv.width = size * dpr; cv.height = size * dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  const pool = S.drawMeta?.ids ? S.participants.filter(p => S.drawMeta.ids.includes(p.id)) : S.participants;
  let segs = pool.filter(p => p.id !== S.uid);
  if (!segs.length) segs = [{ id: '_', name: '¿?', emoji: '🎁' }];
  S.segs = segs;
  const r = size / 2, n = segs.length, a = Math.PI * 2 / n;
  const pal = ['#c7352d', '#1f7a4c', '#e3ae4b', '#f3e7d3', '#8f2420', '#2c9a64'];
  ctx.translate(r, r);
  segs.forEach((p, i) => {
    const s = -Math.PI / 2 + i * a;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r - 2, s, s + a); ctx.closePath();
    let col = pal[i % pal.length]; if (n > 1 && i === n - 1 && col === pal[0]) col = pal[2];
    ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); const mid = s + a / 2, flip = Math.cos(mid) < 0; ctx.rotate(flip ? mid + Math.PI : mid);
    ctx.fillStyle = (col === '#f3e7d3' || col === '#e3ae4b') ? '#3a1a10' : '#fff8ec';
    const fs = Math.max(10, Math.min(16, size / (n > 10 ? 28 : 21)));
    ctx.font = `700 ${fs}px "DM Sans", sans-serif`; ctx.textAlign = flip ? 'left' : 'right'; ctx.textBaseline = 'middle';
    let nm = n > 18 ? (p.emoji || '🎁') : (p.emoji ? p.emoji + ' ' : '') + (p.first || p.name); if (nm.length > 14) nm = nm.slice(0, 13) + '…';
    ctx.fillText(nm, flip ? -(r - 16) : r - 16, 0); ctx.restore();
  });
  ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3; ctx.stroke();
}
function buildBulbs() {
  const b = $('#bulbs'); b.innerHTML = '';
  for (let i = 0; i < 20; i++) {
    const el = document.createElement('i');
    el.style.transform = `rotate(${i * 18}deg) translateY(calc(-1 * (var(--wsz)/2 + 6px)))`;
    el.style.animationDelay = (i % 2 ? .6 : 0) + 's'; b.appendChild(el);
  }
}
function spinTo(targetId) {
  return new Promise(res => {
    const n = S.segs.length, seg = 360 / n;
    const i = Math.max(0, S.segs.findIndex(p => p.id === targetId));
    const center = (i + .5) * seg, jitter = (Math.random() - .5) * seg * .6;
    const delta = ((-(center + jitter) - (S.rot % 360)) % 360 + 360) % 360;
    S.rot += 360 * 6 + delta;
    const cv = $('#wheel'); cv.style.transform = `rotate(${S.rot}deg)`;
    let done = false; const fin = () => { if (!done) { done = true; res(); } };
    cv.addEventListener('transitionend', fin, { once: true }); setTimeout(fin, 5800);
  });
}
// Nadie ve la ruleta sin antes guardar su adivinanza (si las adivinanzas están activas y abiertas).
const needGuess = () => mod('adivinanza') && !guessesOpen() && !S.event.guessesLocked && !S.assignment?.revealed && !S.myGuess?.text;
$('#spinBtn').addEventListener('click', async e => {
  if (needGuess()) { e.stopImmediatePropagation(); const f = $('#g-form'); f?.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => $('#g-text')?.focus(), 400); toast('🔮 Guarda tu adivinanza y luego gira'); return; }
}, true);
$('#spinBtn').addEventListener('click', async () => {
  if (S.spinning || !S.me || !S.assignment) return;
  const a = S.assignment, rid = a.recipient;
  // Siempre (al girar y cada vez que quiera volver a verlo): confirmar privacidad + PIN
  if (!(await privacyGate(a.revealed))) return;
  if (!(await askPin(`Hola, ${S.me.first} 👋`, a.revealed ? 'Confirma tu PIN para ver de nuevo a quién te tocó.' : 'Confirma tu PIN para girar la ruleta.'))) return;
  if (!a.revealed) {
    try { await setDoc(doc(db, 'assignments', S.uid), { revealed: true, revealedAt: serverTimestamp() }, { merge: true }); }
    catch (e) { toast(authErr(e)); return; }
  }
  S.spinning = true; renderWheel(); drawWheel();
  await spinTo(rid);
  S.spinning = false; renderWheel();
  showReveal(rid);
  setTimeout(() => { const cv = $('#wheel'); cv.style.transition = 'none'; S.rot = 0; cv.style.transform = ''; requestAnimationFrame(() => { cv.style.transition = ''; }); }, 800); // la ruleta no queda señalando a tu persona
});
// Antes de girar o de volver a ver: confirmar que nadie más está mirando
function privacyGate(again) {
  return new Promise(res => {
    const items = [['lugar', 'Estoy en un lugar seguro'], ['solo', 'No hay nadie a mi alrededor mirando la pantalla'], ['yo', 'Confirmo que solo yo veré esta información']];
    const s = openModal(`<div class="pg"><div class="pg-ic">🤫</div><h3>${again ? 'Antes de verlo otra vez' : 'Antes de girar'}</h3>
      <p class="muted small">Tu angelito es un secreto. Confirma estas tres cosas:</p>
      <div class="pg-list">${items.map(([k, t], i) => `<button type="button" class="pg-it" data-k="${k}" style="--d:${i * 80}ms"><span class="pg-ck">${ic('check', 16)}</span><span>${t}</span></button>`).join('')}</div>
      <div class="pg-note">${ic('clock', 18)}<span>El nombre se verá <b>solo 5 segundos</b> y luego se ocultará. Para verlo de nuevo tendrás que pasar por estos pasos otra vez.</span></div>
      <div class="actions"><button class="btn" data-a="no">Ahora no</button><button class="btn gold" data-a="ok" disabled>Continuar</button></div></div>`);
    s.onclick = e => {
      const it = e.target.closest('.pg-it');
      if (it) { it.classList.toggle('on'); s.querySelector('[data-a=ok]').disabled = s.querySelectorAll('.pg-it.on').length < items.length; return; }
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      if (a === 'ok' && s.querySelectorAll('.pg-it.on').length < items.length) return;
      closeModal(); res(a === 'ok');
    };
  });
}
function showReveal(rid) {
  confetti();
  const w = S.wishes.filter(x => x.uid === rid);
  const s = openModal(`<div class="center">
    <div style="font-size:54px">${esc(pEmoji(rid))}</div>
    <p class="muted">${esc(S.me.first)}, eres el angelito de…</p>
    <div class="reveal-name">${esc(pName(rid))}</div>
    ${S.event.budget ? `<span class="badge">💰 Presupuesto: ${esc(S.event.budget)}</span>` : ''}
  </div>
  ${mod('perfil') ? `<div style="margin-top:14px">${profileHtml(rid, true)}</div>` : ''}
  <div style="margin-top:18px"><b>Su lista de deseos</b>
    <div class="stack" style="margin-top:10px">${w.length ? w.slice(0, 4).map(x => `<div class="item"><span>🎁</span><div class="grow"><div class="t">${esc(x.text)}</div></div></div>`).join('') : '<p class="muted small">Todavía no ha escrito deseos. ¡Revisa más tarde!</p>'}</div>
  </div>
  <p class="muted small center" style="margin-top:14px">🤫 Shhh… es un secreto.</p>
  <div class="rv-timer"><i></i></div><p class="muted small center" id="rv-left">Se oculta en 5 segundos…</p>
  <div class="actions"><button class="btn" data-a="close">Cerrar</button><button class="btn gold" data-a="list">Ver su lista</button></div>`);
  let left = 5; const tick = setInterval(() => {
    left--; const el = $('#rv-left', s); if (el) el.textContent = left > 0 ? `Se oculta en ${left} segundo${left === 1 ? '' : 's'}…` : '';
    if (left <= 0 || !$('#modal').classList.contains('on') || !s.querySelector('.reveal-name')) { clearInterval(tick); if (s.querySelector('.reveal-name') && $('#modal').classList.contains('on')) { closeModal(); toast('🔒 Se ocultó. Para verlo otra vez, toca «Ver a quién me tocó».'); } }
  }, 1000);
  s.onclick = e => {
    const x = e.target.closest('[data-a]')?.dataset.a; if (!x) return;
    closeModal(); if (x === 'list') { S.wishPid = rid; location.hash = 'deseos'; render(); }
  };
}

/* ---------- deseos ---------- */
function renderWishes() {
  const root = $('#w-root');
  if (!S.me) { root.innerHTML = S.authReady ? needLogin('Entra para ver las listas de deseos y escribir la tuya.') : ''; return; }
  if (!S.wishPid || !P(S.wishPid)) S.wishPid = S.uid;
  const mine = S.wishPid === S.uid;
  const items = S.wishes.filter(w => w.uid === S.wishPid).sort((a, b) => (b.top ? 1 : 0) - (a.top ? 1 : 0));
  const isRec = !mine && S.assignment?.revealed && S.assignment.recipient === S.wishPid;
  const keep = { t: $('#w-text')?.value || '', l: $('#w-link')?.value || '', p: $('#w-price')?.value || '', f: document.activeElement?.id, sl: $('#w-strip')?.scrollLeft || 0 };
  const many = S.participants.length > 8;
  root.innerHTML = `${many ? `<input class="in psearch" id="w-q" type="search" placeholder="🔍 Buscar a alguien…" autocomplete="off" value="${esc(S.wishQ || '')}">` : ''}
  <div class="pscroll" id="w-strip">${wishStrip()}</div>
  <div class="h2row wh"><h2>${esc(pEmoji(S.wishPid))} ${mine ? 'Mi lista de deseos' : 'Lista de ' + esc(pName(S.wishPid))}</h2>${mine ? `<div style="display:flex;gap:6px"><button class="btn sm" id="prof-icon">${esc(S.me.emoji)} Ícono</button>${mod('perfil') ? `<button class="btn sm btn-ic ${profDone() < PROF.length ? 'gold pulse-soft' : ''}" id="prof-edit">${ic('shirt', 16)} Mi perfil${profDone() < PROF.length ? ' <span class="rdot"></span>' : ''}</button>` : ''}</div>` : ''}</div>
  ${mod('perfil') ? profileHtml(S.wishPid) : ''}
  <div class="stack">${items.length ? items.map((w, k) => `
    <div class="item witem ${w.top ? 'wtop' : ''}" style="--d:${k * 50}ms"><span class="wi-ic c${k % 5 + 1}">${ic(w.top ? 'star' : 'gift', 20)}</span><div class="grow">
      ${w.top ? '<div class="small" style="color:var(--gold);font-weight:700">⭐ El que más quiere</div>' : ''}
      <div class="t">${esc(w.text)}</div>
      ${w.hasImg ? (S.wishImgs[w.id] ? `<button class="wimg" data-wimg="${esc(w.id)}" style="background:url('${S.wishImgs[w.id]}') center/cover" aria-label="Ver foto"></button>` : Date.now() - (wishImgTried.get(w.id) || Date.now()) > 8000 ? '' : '<div class="wimg ld"></div>') : ''}
      ${w.price ? `<span class="badge">≈ ${esc(w.price)}</span>` : ''}

      ${isRec ? `<div><button class="btn sm ${S.wishPick?.wishId === w.id ? 'gold' : ''}" data-wpick="${esc(w.id)}" style="margin-top:8px">${S.wishPick?.wishId === w.id ? '🛒 Apartado por ti (solo tú lo ves)' : '🛒 Este lo compro yo'}</button></div>` : ''}
      ${/^https?:\/\//i.test(w.link || '') ? `<div><a class="link" href="${esc(w.link)}" target="_blank" rel="noopener">🔗 Ver referencia</a></div>` : ''}
    </div>${w.uid === S.uid ? `<button class="wmore" data-wmore="${esc(w.id)}" aria-label="Opciones del deseo"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button>` : ''}</div>`).join('')
    : `<div class="card empty"><span class="e">🌟</span>${mine ? 'Tu lista está vacía. ¡Agrega lo que te gustaría!' : esc(pName(S.wishPid)) + ' todavía no ha pedido nada.'}</div>`}</div>
  ${mine ? `<details class="wadd" id="w-add" ${S.wAddOpen || !items.length || keep.t ? 'open' : ''}><summary><span class="wa-ic">${ic('plus', 20)}</span><span><b>Agregar un deseo</b><small>Con foto, enlace y precio si quieres</small></span><span class="wa-ch">${ic('back', 18)}</span></summary><form class="card stack" id="w-form">
    <input class="in" id="w-text" maxlength="160" placeholder="Ej. Un libro de cocina, talla M, color azul…" required>
    <div class="row"><input class="in" id="w-link" maxlength="300" placeholder="Enlace (opcional)"><input class="in" id="w-price" maxlength="30" placeholder="Precio aprox. (opcional)"></div>
    ${S.wishDraftImg ? `<div class="wprev" style="background-image:url('${S.wishDraftImg}')"><button type="button" id="w-img-x" aria-label="Quitar foto">✕</button></div>`
      : `<div class="camrow"><label class="btn sm btn-ic">${ic('camera', 16)} Tomar foto<input type="file" class="w-img" accept="image/*" capture="environment" hidden></label><label class="btn sm btn-ic">${ic('image', 16)} Galería<input type="file" class="w-img" accept="image/*" hidden></label></div>`}
    <button class="btn gold" type="submit">✨ Agregar a mi lista</button></form></details>` : ''}`;
  $('#w-add')?.addEventListener('toggle', e => { S.wAddOpen = e.target.open; });
  loadWishImgs(items);
  if (mine) { $('#w-text').value = keep.t; $('#w-link').value = keep.l; $('#w-price').value = keep.p; }
  $('#w-strip').scrollLeft = keep.sl;
  if (keep.f && $('#' + keep.f)) { const f = $('#' + keep.f); f.focus(); if (keep.f === 'w-q') { const L = f.value.length; f.setSelectionRange?.(L, L); } }
}
// Orden: yo, la persona que me tocó (si ya la vi), quienes tienen deseos y luego el resto, por nombre.
function wishStrip() {
  const rec = S.assignment?.revealed ? S.assignment.recipient : null;
  const cnt = id => S.wishes.filter(w => w.uid === id).length;
  const q = normName(S.wishQ || '');
  const rank = p => p.id === S.uid ? 0 : p.id === rec ? 1 : cnt(p.id) ? 2 : 3;
  const list = S.participants.filter(p => !q || p.id === S.wishPid || normName(p.name).includes(q))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'es'));
  if (!list.length) return '<div class="pempty">Nadie con ese nombre.</div>';
  const fc = {}; S.participants.forEach(p => { const k = normName(p.first); fc[k] = (fc[k] || 0) + 1; });
  const label = p => fc[normName(p.first)] > 1 ? shortName(p) : p.first;
  return list.map(p => { const n = cnt(p.id);
    return `<button class="pav ${S.wishPid === p.id ? 'on' : ''}" data-p="${esc(p.id)}" title="${esc(p.name)}"><span class="ci">${esc(p.emoji)}${n ? `<span class="n">${n}</span>` : ''}</span><span class="nm">${esc(p.id === S.uid ? 'Mi lista' : p.id === rec ? '🎯 ' + label(p) : label(p))}</span></button>`; }).join('');
}
// Las fotos de los deseos se bajan solo cuando alguien abre esa lista (así la app sigue rápida).
// Cada foto se pide UNA sola vez (antes, si una foto faltaba o venía vacía, se volvía a pedir en cada
// actualización y la lista de deseos se redibujaba sin parar).
S.wishImgs = {}; const wishImgTried = new Map(); let wishImgT = null;
function loadWishImgs(items) {
  for (const w of items) {
    if (!w.hasImg || S.wishImgs[w.id] || (Date.now() - (wishImgTried.get(w.id) || 0) < 10 * 60e3)) continue;
    wishImgTried.set(w.id, Date.now());
    getDoc(doc(S.uid ? db : adb, 'wishImg', w.id)).then(d => {
      const data = d.exists() ? String(d.data().data || '').replace(/[^A-Za-z0-9+/=:;,._-]/g, '') : '';
      if (!data) return;
      S.wishImgs[w.id] = data; clearTimeout(wishImgT); wishImgT = setTimeout(render, 120); // una sola actualización por tanda de fotos
    }).catch(() => { });
  }
}
$('#w-root').addEventListener('change', async e => {
  if (!e.target.classList.contains('w-img') || !e.target.files[0]) return;
  try { S.wishDraftImg = await shrink(e.target.files[0], 720, .7, 150000); renderWishes(); } catch { toast('No se pudo leer la foto'); }
});
$('#w-root').addEventListener('click', e => {
  if (e.target.closest('#w-img-x')) { S.wishDraftImg = null; renderWishes(); return; }
  const im = e.target.closest('[data-wimg]'); if (!im) return;
  openModal(`<img src="${S.wishImgs[im.dataset.wimg] || ''}" alt="" style="width:100%;border-radius:14px"><div class="actions"><button class="btn gold" data-a="x">Cerrar</button></div>`).onclick = ev => { if (ev.target.closest('[data-a]')) closeModal(); };
});
$('#w-root').addEventListener('input', e => {
  if (e.target.id !== 'w-q') return;
  S.wishQ = e.target.value; $('#w-strip').innerHTML = wishStrip(); $('#w-strip').scrollLeft = 0;
});
$('#w-root').addEventListener('click', async e => {
  const c = e.target.closest('[data-p]'); if (c) { S.wishPid = c.dataset.p; $$('#w-form input').forEach(i => i.value = ''); renderWishes(); $('#w-strip [data-p].on')?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' }); return; }
  const d = e.target.closest('[data-del]');
  if (d && await confirmBox('¿Borrar este deseo?', 'Se quitará de la lista.', 'Borrar')) {
    const xdb = d.dataset.own ? db : adb, b = writeBatch(xdb); b.delete(doc(xdb, 'wishes', d.dataset.del));
    if (S.wishes.find(w => w.id === d.dataset.del)?.hasImg) b.delete(doc(xdb, 'wishImg', d.dataset.del));
    try { await b.commit(); } catch (err) { toast(authErr(err)); }
  }
});
$('#w-root').addEventListener('submit', async e => {
  e.preventDefault(); if (e.target.id !== 'w-form') return;
  const text = $('#w-text').value.trim(); if (!text) return;
  const btn = e.target.querySelector('button[type=submit]') || e.target.querySelector('button'); busy(btn, true);
  try {
    const ref = doc(collection(db, 'wishes')), img = S.wishDraftImg, b = writeBatch(db);
    b.set(ref, { uid: S.uid, text, link: $('#w-link').value.trim(), price: $('#w-price').value.trim(), ...(img ? { hasImg: true } : {}), at: serverTimestamp() });
    if (img) { b.set(doc(db, 'wishImg', ref.id), { uid: S.uid, data: img }); S.wishImgs[ref.id] = img; }
    await b.commit();
    S.wishDraftImg = null; $('#w-text').value = $('#w-link').value = $('#w-price').value = ''; toast('Deseo agregado 🎁'); renderWishes();
  } catch (err) { toast(authErr(err)); }
  busy(btn, false, '✨ Agregar a mi lista');
});

/* ---------- anónimos ---------- */
function renderQuestions() {
  const fb = $('#q-formbox');
  if (!S.me) fb.innerHTML = S.authReady ? needLogin('Entra para dejar un mensaje anónimo. Ningún participante verá quién lo escribió.') : '';
  else if (!$('#q-form')) {
    fb.innerHTML = `<form class="card stack" id="q-form">
      <label class="field"><span>Para</span><select class="in" id="q-to"></select></label>
      <label class="field"><span>Tu pregunta o mensaje (se mostrará sin tu nombre)</span><textarea class="in" id="q-text" maxlength="400" placeholder="¿Quién se comió los pastelitos el año pasado? 👀" required></textarea></label>
      <button class="btn gold" type="submit">💌 Enviar anónimamente</button></form>`;
  }
  const sel = $('#q-to');
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = `<option value="">🎄 Para todos</option>` + S.participants.map(p => `<option value="${esc(p.id)}">${esc(p.emoji)} ${esc(p.name)}</option>`).join('');
    sel.value = [...sel.options].some(o => o.value === cur) ? cur : '';
  }
  const board = $('#q-board'), n = S.qCount, open = isRevealed() && !!S.me;
  const sec = $('#v-anonimos'), fbx = $('#q-formbox');
  if (open && fbx.nextElementSibling === board) { sec.insertBefore(board, fbx); fbx.classList.add('after'); }
  if (!open && board.nextElementSibling === fbx) { sec.insertBefore(fbx, board); fbx.classList.remove('after'); }
  sec.querySelector('.sec-sub').style.display = open ? 'none' : '';
  if (!isRevealed()) {
    const rd = revealDay(); let left = '';
    if (rd) { const days = Math.ceil((new Date(rd + 'T00:00') - new Date(todayStr() + 'T00:00')) / 864e5); left = days <= 0 ? 'Se abren hoy' : days === 1 ? 'Se abren mañana' : `Faltan ${days} días`; }
    board.innerHTML = `<div class="card vault"><span class="lock">🔒</span>
      <div class="big">${n}</div><div class="muted">${n === 1 ? 'mensaje guardado' : 'mensajes guardados'} bajo llave</div>
      <p style="margin-top:14px">${rd ? `Se abrirán el <b>${esc(revealWhen())}</b>` : 'El organizador indicará el día en que se abren'}</p>
      ${left ? `<span class="badge" style="margin-top:10px">⏳ ${left}</span>` : ''}</div>`;
  } else if (!S.me) {
    board.innerHTML = `<div class="card vault"><span class="lock">🔓</span><div class="big">${n}</div><div class="muted">¡El buzón ya está abierto! Entra para leerlos.</div></div>`;
  } else {
    const qs = S.questions;
    board.innerHTML = qs.length ? `<div class="h2row" style="margin-top:0"><h2>🎉 ¡Se abrió el buzón!</h2><span class="muted small">${nMsg(qs.length)}</span></div>
      <div class="qgrid">${qs.map((q, i) => `<div class="q" style="--rot:${((i * 37) % 7) - 3}deg;background:${QCOLORS[i % QCOLORS.length]};animation-delay:${Math.min(i, 12) * 60}ms">
        <div class="to">${q.to ? (P(q.to) ? 'Para ' + esc(pName(q.to)) : 'Para alguien del grupo') : 'Para todos'}</div><div class="txt">${esc(q.text)}</div></div>`).join('')}</div>`
      : `<div class="card empty"><span class="e">📭</span>${S.qSubOn ? 'El buzón está abierto pero vacío.' : 'Abriendo el buzón…'}</div>`;
  }
}
$('#q-formbox').addEventListener('submit', async e => {
  e.preventDefault(); if (e.target.id !== 'q-form') return;
  const text = $('#q-text').value.trim(); if (!text) return;
  const btn = e.target.querySelector('button[type=submit]') || e.target.querySelector('button'); busy(btn, true);
  try {
    const b = writeBatch(db);
    const qref = doc(collection(db, 'questions'));
    b.set(qref, { text, to: $('#q-to').value });
    b.set(doc(db, 'questionAuthors', qref.id), { uid: S.uid });
    b.set(doc(db, 'stats', 'questions'), { count: increment(1), last: qref.id }, { merge: true });
    await b.commit();
    $('#q-text').value = ''; toast('Mensaje guardado en secreto 🤫');
  } catch (err) { toast(authErr(err)); }
  busy(btn, false, '💌 Enviar anónimamente');
});

/* ---------- estado del regalo + adivinanza ---------- */
const GS = { pensando: ['🤔', 'Pensando'], ideas: ['💡', 'Tengo ideas'], comprado: ['🛍️', 'Ya lo compré'], envuelto: ['🎀', 'Envuelto y listo'] };
const GS_IN = {
  pensando: ['🤔', 'Tu angelito todavía está pensando qué regalarte.'],
  ideas: ['💡', 'Tu angelito ya tiene algunas ideas…'],
  comprado: ['🛍️', '¡Tu angelito ya compró tu regalo!'],
  envuelto: ['🎀', '¡Tu regalo ya está envuelto y listo!']
};
function renderMyAngel() {
  const box = $('#r-extra'); if (!box) return;
  if (!S.me) { box.innerHTML = ''; return; }
  const keep = { g: $('#g-text')?.value, a: $('#g-actual')?.value, f: document.activeElement?.id };
  const ready = !!S.drawMeta && drawReady() && S.drawMeta.ids.includes(S.uid);
  let h = '';
  if (ready && S.assignment?.revealed && mod('estado')) {
    const my = S.giftStatus[S.uid];
    h += `<div class="h2row"><h2>🎁 Mi regalo para mi angelito</h2></div>
      <div class="card"><p class="muted small" style="margin-bottom:12px">Actualiza cómo vas. A esa persona le llega el aviso sin tu nombre 🤫</p>
      <div class="stat4">${Object.entries(GS).map(([k, [e, l]]) => `<button class="${my === k ? 'on' : ''}" data-gs="${k}"><span>${e}</span>${l}</button>`).join('')}</div></div>`;
  }
  if (ready && mod('estado')) {
    const inc = S.incoming && GS_IN[S.incoming.status];
    h += `<div class="h2row"><h2>📬 Mi regalo</h2></div>
      <div class="card incoming"><div class="ie">${inc ? inc[0] : '👀'}</div><div><b>${inc ? inc[1] : 'Tu angelito aún no ha dado señales.'}</b><div class="muted small">Tu angelito es secreto. Solo verás cómo va con tu regalo.</div></div></div>`;
  }
  // adivinanza
  if (!mod('adivinanza')) { box.innerHTML = h; return; }
  const prize = S.event.guessPrize;
  h += `<div class="h2row"><h2>🔮 ¿Qué crees que te van a regalar?</h2></div>`;
  if (prize) h += `<div class="prize"><span style="font-size:22px">🏆</span><div>Quien más se acerque gana: <b>${esc(prize)}</b></div></div>`;
  if (!guessesOpen() && S.event.guessesLocked) {
    h += `<div class="card empty"><span class="e">🔒</span>Las adivinanzas ya están cerradas.</div>`;
  } else if (!guessesOpen()) {
    h += `<form class="card stack guesscard" id="g-form"><p class="muted small">Escribe tu adivinanza. Nadie la verá hasta el día del intercambio, y puedes cambiarla hasta entonces.</p>
      <textarea class="in" id="g-text" maxlength="200" placeholder="Creo que me van a regalar… un perfume 👃" style="min-height:70px">${esc(S.myGuess?.text || '')}</textarea>
      <button class="btn gold" type="submit">🔮 ${S.myGuess?.text ? 'Actualizar mi adivinanza' : 'Guardar mi adivinanza'}</button></form>`;
  } else {
    const list = S.guesses.filter(g => P(g.uid) && g.text).sort((a, b) => (b.uid === S.event.guessWinner) - (a.uid === S.event.guessWinner) || pName(a.uid).localeCompare(pName(b.uid)));
    const mine = S.guesses.find(g => g.uid === S.uid) || S.myGuess;
    if (mine?.text) h += `<form class="card stack" id="g-aform" style="margin-bottom:12px"><b>¿Qué te regalaron al final?</b>
      <div style="display:flex;gap:8px"><input class="in" id="g-actual" maxlength="200" placeholder="Me regalaron…" value="${esc(mine.actual || '')}"><button class="btn gold" type="submit">Guardar</button></div></form>`;
    h += list.length ? `<div class="stack">${list.map(g => `<div class="guess ${g.uid === S.event.guessWinner ? 'win' : ''}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${esc(pEmoji(g.uid))} ${esc(pName(g.uid))}</b>${g.uid === S.event.guessWinner ? '<span class="tag gold">🏆 ¡Ganador!</span>' : ''}</div>
      <div class="gl">🔮 Creía que le regalarían</div><div class="gv">${esc(g.text)}</div>
      ${g.actual ? `<div class="gl">🎁 Le regalaron</div><div class="gv">${esc(g.actual)}</div>` : ''}</div>`).join('')}</div>`
      : `<div class="card empty"><span class="e">🔮</span>Nadie escribió adivinanzas.</div>`;
  }
  box.innerHTML = h;
  if (keep.g != null && $('#g-text')) $('#g-text').value = keep.g;
  if (keep.a != null && $('#g-actual')) $('#g-actual').value = keep.a;
  if (keep.f && $('#' + keep.f)) $('#' + keep.f).focus();
}
$('#r-extra').addEventListener('click', async e => {
  const b = e.target.closest('[data-gs]'); if (!b || !S.assignment) return;
  const st = b.dataset.gs;
  try {
    const w = writeBatch(db);
    w.set(doc(db, 'giftStatus', S.uid), { status: st, at: serverTimestamp() });
    w.set(doc(db, 'giftIncoming', S.assignment.recipient), { status: st });
    await w.commit(); toast(GS[st][0] + ' ¡Listo! Ya le avisamos (en secreto)'); if (st === 'envuelto') confetti(70);
  } catch (err) { toast(authErr(err)); }
});
$('#r-extra').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    if (e.target.id === 'g-form') {
      const text = $('#g-text').value.trim(); if (!text) return toast('Escribe tu adivinanza');
      await setDoc(doc(db, 'guesses', S.uid), { uid: S.uid, text, at: serverTimestamp() }, { merge: true }); toast('Adivinanza guardada 🔮');
    }
    if (e.target.id === 'g-aform') {
      await setDoc(doc(db, 'guesses', S.uid), { actual: $('#g-actual').value.trim(), actualAt: serverTimestamp() }, { merge: true }); toast('¡Guardado! 🎁');
    }
  } catch (err) { toast(err?.code?.includes('permission') ? 'Las adivinanzas ya se revelaron, no se pueden cambiar.' : authErr(err)); }
});
function renderProgress() {
  const box = $('#h-prog'); if (!box) return;
  if (!S.isOwner || !S.drawMeta || !mod('estado')) { box.style.display = 'none'; return; }
  const ids = S.drawMeta.ids.filter(id => P(id)), n = ids.length || 1;
  const cnt = k => ids.filter(id => S.giftStatus[id] === k).length;
  const none = ids.filter(id => !S.giftStatus[id]).length;
  const cols = { pensando: '#8c8c8c', ideas: '#6aa8ff', comprado: '#ecbc5c', envuelto: '#4fd18b' };
  box.style.display = '';
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:baseline"><b>🛍️ ¿Cómo van los regalos?</b> <span class="muted small">(solo tú lo ves)</span><span class="muted small">${cnt('comprado') + cnt('envuelto')} de ${ids.length} listos</span></div>
    <div class="prog">${Object.keys(GS).map(k => `<i style="width:${cnt(k) / n * 100}%;background:${cols[k]}"></i>`).join('')}</div>
    <div class="going" style="margin-top:4px">${Object.entries(GS).map(([k, [e, l]]) => `<span>${e} ${l}: <b>${cnt(k)}</b></span>`).join('')}${none ? `<span>😴 Sin noticias: <b>${none}</b></span>` : ''}</div>`;
}

/* ---------- asistencia y aporte ---------- */
function attSummary() {
  const ids = S.participants.map(p => p.id), a = id => S.att[id] || {};
  return { going: ids.filter(id => a(id).status === 'si').length, notGoing: ids.filter(id => a(id).status === 'no').length,
    pending: ids.filter(id => !a(id).status).length, paid: ids.filter(id => a(id).confirmed).length, said: ids.filter(id => a(id).paid && !a(id).confirmed).length };
}
// Lista de quiénes van / no pueden / no han respondido
function openAttList() {
  const g = st => S.participants.filter(p => ((S.att[p.id] || {}).status || '') === st).sort((a, b) => a.name.localeCompare(b.name));
  const col = (t, cls, l) => `<div class="al-g ${cls}"><div class="al-h"><b>${t}</b><span>${l.length}</span></div>${l.length ? `<div class="al-l">${l.map((p, k) => `<div class="al-p" style="--d:${k * 30}ms"><span>${esc(p.emoji)}</span>${esc(p.name)}${p.id === S.uid ? ' <small>(tú)</small>' : ''}</div>`).join('')}</div>` : '<p class="muted small">Nadie</p>'}</div>`;
  const s2 = openModal(`<h3>🎉 ¿Quiénes van?</h3><div class="al">${col('✅ Van', 'ok', g('si'))}${col('😢 No pueden', 'no', g('no'))}${col('⏳ Sin responder', 'wait', g(''))}</div><div class="actions"><button class="btn gold" data-a="x">Listo</button></div>`);
  s2.onclick = e => { if (e.target.closest('[data-a]')) closeModal(); };
}
function renderAttendance() {
  const box = $('#h-att'); if (!box) return;
  if (!S.me || !mod('asistencia')) { box.innerHTML = ''; } else {
    const c = S.event, me = S.att[S.uid] || {}, sm = attSummary();
    const late = c.rsvpDeadline && todayStr() > c.rsvpDeadline;
    const goingP = S.participants.filter(p => (S.att[p.id] || {}).status === 'si');
    const faces = goingP.slice(0, 6).map((p, k) => `<span class="rf" style="--k:${k}">${esc(p.emoji)}</span>`).join('') + (goingP.length > 6 ? `<span class="rf more" style="--k:6">+${goingP.length - 6}</span>` : '');
    const editing = !me.status || S.attEdit;
    let h = `<div class="card rsvpcard" style="margin-bottom:16px"><b class="rv-t">🎉 ¿Vas al angelito?</b>
      ${c.rsvpDeadline ? `<p class="muted small" style="margin-top:2px">${late ? '⚠️ La fecha para confirmar ya pasó' : 'Confirma antes del ' + esc(fmtDate(c.rsvpDeadline))}</p>` : ''}
      <button class="rv-who" data-attlist type="button"><span class="rv-faces">${faces || '<span class="rf">🙂</span>'}</span><span class="rv-n"><b>${sm.going}</b><span>${sm.going === 1 ? 'va' : 'van'}</span></span><span class="rv-sub">${sm.notGoing ? `${sm.notGoing} no pueden` : ''}${sm.notGoing && sm.pending ? ' · ' : ''}${sm.pending ? `${sm.pending} sin responder` : ''}<em>Ver lista ›</em></span></button>
      ${editing ? `<div class="rsvp" style="grid-template-columns:1fr 1fr;margin-top:12px"><button class="${me.status === 'si' ? 'on' : ''}" data-att="si"><span class="rs-i">${ic('check', 26)}</span>Sí, voy</button><button class="${me.status === 'no' ? 'on' : ''}" data-att="no"><span class="rs-i">${ic('xcircle', 26)}</span>No puedo</button></div>`
        : `<div class="rv-me ${me.status}"><span class="rv-mi">${me.status === 'si' ? ic('check', 18) : ic('xcircle', 18)}</span><b>${me.status === 'si' ? '¡Vas! Te esperamos' : 'Dijiste que no puedes ir'}</b><button class="btn sm" data-attedit type="button">Cambiar</button></div>`}`;
    if (me.status === 'si' && c.contribAmount) {
      h += `<div class="prize" style="margin:14px 0 0;flex-wrap:wrap"><span style="font-size:22px">💵</span><div style="flex:1;min-width:180px"><b>Aporte: ${esc(c.contribAmount)}</b>${c.contribInfo ? `<div class="small" style="margin-top:2px">${esc(c.contribInfo)}</div>` : ''}
        <div class="small" style="margin-top:6px">${me.confirmed ? '✅ <b>El organizador confirmó tu aporte.</b> ¡Gracias!' : me.paid ? '⏳ Marcaste que ya lo diste. Falta que el organizador lo confirme.' : '💤 Todavía no has dado tu aporte.'}</div></div>
        ${me.confirmed ? '' : me.paid ? '<button class="btn sm" data-paid="0">Deshacer</button>' : '<button class="btn sm gold" data-paid="1">Ya lo di</button>'}</div>`;
    }
    if (c.contribAmount && sm.going) {
      const going = S.participants.filter(p => (S.att[p.id] || {}).status === 'si');
      const paidL = going.filter(p => S.att[p.id].confirmed), pendL = going.filter(p => !S.att[p.id].confirmed);
      h += `<details class="fold" style="margin:14px 0 0"><summary><span class="cnts"><span class="cnt ok">💵 ${paidL.length} ya aportaron</span><span class="cnt wait">⏳ ${pendL.length} faltan</span></span></summary>
        <div class="muted small"><b>Ya aportaron</b></div><div class="going">${paidL.map(p => `<span>${esc(p.emoji)} ${esc(shortName(p))}</span>`).join('') || '<span>Nadie todavía</span>'}</div>
        <div class="muted small" style="margin-top:10px"><b>Falta su aporte</b></div><div class="going">${pendL.map(p => `<span>${esc(p.emoji)} ${esc(shortName(p))}${S.att[p.id].paid ? ' · dice que ya' : ''}</span>`).join('') || '<span>¡Nadie! 🎉</span>'}</div></details>`;
    }
    box.innerHTML = h + '</div>';
  }
  if (!S.isAdmin) return;
  const sm = attSummary(), amt = S.event.contribAmount;
  const num = parseFloat(String(amt || '').replace(/[^\d.]/g, '')), pre = String(amt || '').match(/^[^\d]*/)?.[0].trim() || '';
  $('#att-sum').innerHTML = `<div class="cnts" style="margin:8px 0 6px"><span class="cnt ok">${sm.going} van</span><span class="cnt no">${sm.notGoing} no van</span><span class="cnt wait">${sm.pending} sin responder</span></div>
    ${amt ? `<div class="paybox"><div><span class="muted small">Aportes pagados</span><b>${sm.paid} de ${sm.going}</b></div>${num ? `<div><span class="muted small">Total recogido</span><b>${esc(pre)}${(num * sm.paid).toLocaleString('es')}</b></div>` : ''}${sm.said ? `<div><span class="muted small">Dicen que pagaron</span><b>${sm.said}</b></div>` : ''}</div>` : ''}
    ${can('participantes') ? '<p class="muted small" style="margin-top:8px">👇 Marca quién pagó en la lista de participantes (arriba en esta misma sección).</p>' : ''}`;
  $('#att-list').innerHTML = can('participantes') ? '' : S.participants.map(p => {
    const a = S.att[p.id] || {};
    const st = a.status === 'si' ? '<span class="badge">✅ Va</span>' : a.status === 'no' ? '<span class="badge" style="background:rgba(226,72,63,.22);color:#ffc2bc">❌ No va</span>' : '<span class="badge" style="background:rgba(255,255,255,.08);color:var(--muted)">⏳ Sin responder</span>';
    const pay = a.confirmed ? '<span class="badge">💵 Pagó</span>' : a.paid ? '<span class="badge" style="background:rgba(236,188,92,.2);color:#ffd99a">💵 Dice que pagó</span>' : '';
    return `<div class="item" style="align-items:center"><span style="font-size:22px">${esc(p.emoji)}</span><div class="grow"><div class="t">${esc(p.name)}</div>${st} ${pay}</div>
      ${a.status === 'si' || a.confirmed ? `<button class="btn sm ${a.confirmed ? '' : 'gold'}" data-conf="${esc(p.id)}" data-v="${a.confirmed ? 0 : 1}">${a.confirmed ? 'Quitar pago' : '✓ Pagó'}</button>` : ''}</div>`;
  }).join('') || '<p class="muted small">Nadie se ha registrado todavía.</p>';
}
$('#h-att').addEventListener('click', async e => {
  if (e.target.closest('[data-attedit]')) { S.attEdit = true; return renderAttendance(); }
  if (e.target.closest('[data-attlist]')) return openAttList();
  const b = e.target.closest('[data-att],[data-paid]'); if (!b || !S.me) return;
  if (b.dataset.att) S.attEdit = false;
  const cur = S.att[S.uid] || {};
  const o = { uid: S.uid, status: b.dataset.att || cur.status || 'si', paid: b.dataset.paid != null ? b.dataset.paid === '1' : !!cur.paid, at: serverTimestamp() };
  if (o.status === 'no') o.paid = !!cur.paid;
  try { await setDoc(doc(db, 'attendance', S.uid), o, { merge: true }); if (b.dataset.att === 'si') { toast('¡Genial, te esperamos! 🎉'); confetti(60); } else if (b.dataset.paid === '1') toast('Anotado 💵 El organizador lo confirmará'); }
  catch (err) { toast(authErr(err)); }
});
// Menú ⋯ de cada persona: reusa las mismas acciones de la lista (PIN, editar, quitar, quitar pago).
document.addEventListener('click', e => {
  const m = e.target.closest('[data-pmore]'); if (!m) return;
  const id = m.dataset.pmore, p = P(id), a = S.att[id] || {}; if (!p) return;
  sheet({ head: `<div class="wm-h who-card" style="display:flex;gap:12px;align-items:center"><span class="av">${esc(p.emoji)}</span><div><div class="muted small">Participante</div><b>${esc(p.name)}</b></div></div>`, items: [
    a.confirmed && can('aportes') && { k: 'conf', icon: 'undo', label: 'Quitar el pago', hint: 'Vuelve a quedar como pendiente' },
    S.isOwner && { k: 'presetPin', icon: 'key', label: 'Darle un PIN temporal', hint: 'Si olvidó su PIN; conserva todo lo suyo' },
    { k: 'pedit', icon: 'edit', label: 'Editar nombre o ícono' },
    { k: 'rm', icon: 'userx', label: 'Quitar del angelito', hint: 'Se borra todo lo suyo', danger: true },
  ] }).then(k => {
    if (!k) return;
    const t = document.createElement('button'); t.hidden = true; t.dataset[k] = id; if (k === 'conf') t.dataset.v = '0';
    $('#p-list').appendChild(t); setTimeout(() => { t.click(); t.remove(); }, 60);
  });
});
document.addEventListener('click', e => { const f = e.target.closest('[data-pf2]'); if (f) { S.pFilter = f.dataset.pf2; renderAdmin(); } });
document.addEventListener('input', e => { if (e.target.id === 'p-q') { S.pQuery = e.target.value; renderAdmin(); } });
$('#p-list').addEventListener('click', async e => {
  const b = e.target.closest('[data-conf]'); if (!b) return;
  try { await setDoc(doc(adb, 'attendance', b.dataset.conf), { uid: b.dataset.conf, confirmed: b.dataset.v === '1' }, { merge: true }); toast(b.dataset.v === '1' ? '💵 Marcado como pagó' : 'Pago quitado'); }
  catch (err) { toast(authErr(err)); }
});
$('#att-list').addEventListener('click', async e => {
  const b = e.target.closest('[data-conf]'); if (!b) return;
  try { await setDoc(doc(adb, 'attendance', b.dataset.conf), { uid: b.dataset.conf, confirmed: b.dataset.v === '1' }, { merge: true }); }
  catch (err) { toast(authErr(err)); }
});

/* ---------- chat ---------- */
const OCURRENCIAS = [
  'Confiesa: ¿cuál ha sido el peor regalo que te han dado? 🙈', 'Si tu angelito te regala medias, ¿cómo reaccionas? 🧦', '¿Quién de aquí envuelve los regalos con papel de periódico? 📰',
  'Describe tu Navidad ideal con 3 emojis 🎄', '¿Quién se va a comer todo el puerco este año? 🍖', 'Pista falsa sobre tu regalo, ¡a confundir! 🕵️', '¿Quién llega tarde a la cena seguro? ⏰',
  'Canción que no puede faltar en la fiesta 🎶', '¿Moro o arroz blanco? Debate abierto 🍚', 'Lo más raro que has pedido de regalo 🤔', '¿Quién de la familia baila peor? 💃',
  'Mándale una indirecta a tu angelito 😏', '¿Pastelitos de pollo o de queso? Vota 🥟', 'Si fueras un plato navideño, ¿cuál serías? 🍽️', 'El villancico que te sabes completo 🎤',
  '¿Quién es el tío/la tía que más habla en la cena? 🗣️', 'Recuerdo navideño de cuando eras niño ⭐', '¿Quién se duerme primero en la fiesta? 😴', 'Tu bebida navideña favorita 🥤',
  'Adivina: ¿quién crees que es tu angelito? 👀', 'Si pudieras pedir cualquier cosa, sin presupuesto… 💸', '¿Quién de aquí hace el mejor chiste malo? 🤡', '¿Merengue o bachata para abrir la fiesta? 🕺',
  'Una palabra para describir este año 📅', '¿Quién es capaz de abrir su regalo antes de tiempo? 🎁', 'Tu propósito para el año nuevo (prometo no burlarme) 🙏', 'Dato curioso que nadie del grupo sabe de ti 🤫',
  '¿Qué regalo NUNCA deberían darte? 🚫', 'Pon 3 emojis y que adivinen qué quieres de regalo 🧩', '¿Quién de aquí sería el mejor Santa Claus? 🎅'
];
// Alto exacto del chat: lo que queda entre su borde superior y el cuadro de escribir.
// En el chat y dentro de una partida no hay barra de pestañas (más pantalla): se sale con el botón ‹ de arriba.
function syncImmersive() {
  const on = document.body.classList.contains('chat-on') || /^#juego-/.test(location.hash);
  document.body.classList.toggle('immersive', on);
  requestAnimationFrame(fitChat);
}
addEventListener('hashchange', () => setTimeout(syncImmersive, 0));
setTimeout(() => { $('#c-back').innerHTML = ic('back', 22); $('#gear').innerHTML = ic('gear', 20); $('#inst-btn .ib-app').innerHTML = ic('install', 18); }, 0);
$('#c-back').addEventListener('click', () => { location.hash = '#inicio'; });
function fitChat() {
  if (!document.body.classList.contains('chat-on')) return;
  const l = $('#c-list'), d = $('#c-dock'); if (!l || !d || !l.offsetParent) return;
  const vh = visualViewport?.height || innerHeight, top = l.getBoundingClientRect().top + scrollY;
  const low = document.body.classList.contains('kb') || document.body.classList.contains('immersive');
  const h = Math.max(96, Math.round(vh - d.getBoundingClientRect().height - (low ? 14 : 100) - top - 8));
  l.style.height = h + 'px';
}
addEventListener('resize', () => requestAnimationFrame(fitChat));
visualViewport?.addEventListener('resize', () => requestAnimationFrame(fitChat));
document.addEventListener('focusin', () => setTimeout(fitChat, 60)); document.addEventListener('focusout', () => setTimeout(fitChat, 200));
const scrollChat = force => { fitChat(); const l = $('#c-list'); if (l && (force || S.chatStick)) l.scrollTop = l.scrollHeight; };
let chatSig = '';
function renderChat() {
  const gate = $('#c-gate'), wrap = $('#c-wrap');
  const can = !!S.me || S.isAdmin;
  gate.innerHTML = can ? '' : (S.authReady ? needLogin('Entra con tu PIN para leer y escribir en el chat.') : '');
  wrap.style.display = can ? '' : 'none';
  // Para escribir hay que tener los avisos activados (así nadie se pierde lo que le responden). Leer siempre se puede.
  const needN = !!S.me && !S.isAdmin && canNotify() && !(isIOS() && !isStandalone()) && Notification.permission !== 'granted';
  $('#c-form').style.display = S.me && !needN ? '' : 'none'; $('#c-emo').style.display = S.me && !needN ? '' : 'none';
  $('#c-ngate').hidden = !needN && !!S.me;
  if (!S.me) $('#c-ngate').innerHTML = `<div class="ngate"><span>💬</span><div><b>Para escribir, entra con tu nombre</b><small>${S.isAdmin ? 'Como organizador solo puedes leer el chat.' : 'Usa tu PIN de 4 números.'}</small></div>${S.isAdmin ? '' : '<button class="btn sm gold" type="button" data-auth="login">Entrar</button>'}</div>`;
  else if (needN) $('#c-ngate').innerHTML = `<div class="ngate"><span>🔔</span><div><b>Activa los avisos para escribir</b><small>${Notification.permission === 'denied' ? 'Los tienes bloqueados: te explico cómo permitirlos.' : 'Así te enteras cuando te respondan o te mencionen.'}</small></div><button class="btn sm gold" type="button" data-nact>Activar</button></div>`;
  if (!can) return;
  $('#c-count').textContent = navigator.onLine === false ? '📡 Sin conexión: se enviará al volver' : S.chat.length ? nMsg(S.chat.length) : '';
  loadChatImgs();
  const sig = S.chat.map(m => m.id + (m.edited ? 'e' + m.text.length + m.text.slice(-4) : '') + (m.pending ? '~' : '') + (m.hasImg && S.chatImgs[m.id] ? 'i' : '')).join() + S.participants.length + (S.isAdmin ? 'a' : '') + '|' + S.chat.map(m => JSON.stringify(m.r || {})).join();
  if (sig === chatSig) return; chatSig = sig;
  const l = $('#c-list'), near = l.scrollHeight - l.scrollTop - l.clientHeight < 80;
  let last = '', prev = null;
  l.innerHTML = S.chat.length ? S.chat.map(m => {
    const d = new Date(ms(m.at) || m.ts || 0), day = d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
    const sep = day !== last ? `<div class="daysep">${esc(cap(day))}</div>` : ''; last = day;
    const me = m.uid === S.uid;
    // mensajes seguidos de la misma persona (menos de 5 min): sin repetir nombre ni ícono, más juntitos
    const cont = !sep && prev && prev.uid === m.uid && Math.abs((ms(m.at) || m.ts || 0) - (ms(prev.at) || prev.ts || 0)) < 5 * 60e3; prev = m;
    const tagMe = (m.mentions || []).includes(S.uid) || ((m.mentions || []).includes('all') && m.uid !== S.uid);
    return `${sep}<div class="msg ${me ? 'me' : ''} ${cont ? 'cont' : ''}"><div class="av">${esc(pEmoji(m.uid))}</div><div class="bub ${tagMe ? 'tagged' : ''}" data-mid="${esc(m.id)}" data-mine="${me ? 1 : ''}">${me || cont ? '' : `<div class="nm" style="color:${nmColor(m.uid)}">${esc(shortName(P(m.uid)) || 'Alguien')}</div>`}${m.replyTo ? `<div class="quote">↩️ <b>${esc(shortName(P(m.replyTo.uid)) || '')}</b> ${esc(m.replyTo.text || '')}</div>` : ''}${m.hasImg ? (S.chatImgs[m.id] ? `<button type="button" class="cimg" data-cimg="${esc(m.id)}" aria-label="Ver foto"><img src="${S.chatImgs[m.id]}" alt=""></button>` : '<div class="cimg ld"></div>') : ''}${m.hasImg && m.text === '📷 Foto' ? '' : `<div class="mt">${mentionHTML(m)}</div>`}${(() => { const r = reactsFor(m.id); const k = Object.keys(r); return k.length ? `<div class="reacts">${k.map(e => `<span class="${r[e].includes(S.uid) ? 'me' : ''}">${e} ${r[e].length}</span>`).join('')}</div>` : ''; })()}<div class="tm">${m.edited ? '<span class="edt">editado · </span>' : ''}${hm(d)}${me ? (m.pending ? ' <span title="Enviando…">🕓</span>' : ' <span class="ok" title="Enviado">✓</span>') : ''}</div></div></div>`;
  }).join('') : `<div class="empty" style="margin:auto"><span class="e">💬</span>Nadie ha escrito todavía.<br>¡Rompe el hielo! Toca 🎲 para una idea.</div>`;
  if (near || S.chatStick) { S.chatStick = false; l.scrollTop = l.scrollHeight; }
}
// Mientras se escribe, la barra de pestañas se esconde para que el teclado no tape el cuadro de texto.
const isTyping = el => el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|tel|url|email|password|number)$/.test(el.type || 'text')));
// Solo cuenta como "teclado abierto" si la pantalla visible se encogió de verdad (teclado del teléfono),
// así en computadoras o con teclado físico la barra nunca desaparece.
let baseH = Math.max(innerHeight, visualViewport?.height || 0);
function kbCheck() {
  const vh = visualViewport?.height || innerHeight, typing = isTyping(document.activeElement);
  if (!typing) baseH = Math.max(vh, innerHeight);
  document.body.classList.toggle('kb', typing && baseH - vh > 140);
}
document.addEventListener('focusin', () => setTimeout(kbCheck, 250));
document.addEventListener('focusout', () => setTimeout(kbCheck, 150));
visualViewport?.addEventListener('resize', kbCheck);
addEventListener('resize', kbCheck);
visualViewport?.addEventListener('resize', () => { if (document.activeElement?.id === 'c-text') try { scrollChat(true); } catch { } });
$('#c-emo').addEventListener('click', e => { const b = e.target.closest('[data-e]'); if (!b) return; const i = $('#c-text'); i.value += (b.dataset.e.startsWith('@') && i.value && !i.value.endsWith(' ') ? ' ' : '') + b.dataset.e; i.focus(); });
/* ---------- @menciones ---------- */
const mLabel = p => { const dup = S.participants.filter(x => normName(x.first) === normName(p.first)).length > 1; return dup ? `${p.first}${(p.last || '').charAt(0)}` : p.first; };
function mentionHTML(m) {
  let h = esc(m.text);
  if ((m.mentions || []).includes('all')) h = h.replace(/(^|\s)@todos\b/gi, '$1<b class="mention me">@todos</b>');
  for (const uid of (m.mentions || [])) { const p = P(uid); if (!p) continue; const lab = esc('@' + mLabel(p)); h = h.split(lab).join(`<b class="mention ${uid === S.uid ? 'me' : ''}">${lab}</b>`); }
  return h;
}
function mentionQuery() { const i = $('#c-text'), v = i.value.slice(0, i.selectionStart ?? i.value.length), mm = v.match(/(^|\s)@([^\s@]{0,20})$/); return mm ? mm[2] : null; }
function renderMentionBar() {
  const box = $('#c-mention'); if (!box) return;
  const q = mentionQuery(); if (q == null) { box.innerHTML = ''; box.hidden = true; return; }
  // coincide si el nombre o el apellido EMPIEZA con lo escrito ("@as" → Asael, no Nicole Cuevas); primero los que empiezan por el nombre
  const nq = normName(q), rank = p => { const w = normName(p.name).split(/\s+/); return w[0].startsWith(nq) ? 0 : w.some(x => x.startsWith(nq)) ? 1 : 9; };
  const list = S.participants.filter(p => p.id !== S.uid && rank(p) < 9).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, 8);
  const all = 'todos'.startsWith(nq);
  box.hidden = !list.length && !all;
  box.innerHTML = (all ? '<button type="button" data-ment="all" class="mall">📣 @todos</button>' : '') + list.map(p => `<button type="button" data-ment="${esc(p.id)}">${esc(p.emoji)} ${esc(mLabel(p))}</button>`).join('');
}
$('#c-text').addEventListener('input', renderMentionBar);
$('#c-text').addEventListener('click', renderMentionBar);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ment]'); if (!b) return;
  const p = b.dataset.ment === 'all' ? { first: 'todos' } : P(b.dataset.ment), i = $('#c-text'); if (!p) return;
  const pos = i.selectionStart ?? i.value.length, before = i.value.slice(0, pos).replace(/@([^\s@]{0,20})$/, '@' + (b.dataset.ment === 'all' ? 'todos' : mLabel(p)) + ' ');
  i.value = before + i.value.slice(pos); i.focus(); i.setSelectionRange(before.length, before.length); renderMentionBar();
});
const mentionsIn = text => /(^|\s)@todos\b/i.test(text) ? ['all'] : S.participants.filter(p => p.id !== S.uid && new RegExp('(^|\\s)@' + mLabel(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[\\s.,!?¿¡:;)])', 'i').test(text)).map(p => p.id).slice(0, 10);
const prompts = () => (Array.isArray(S.event.chatPrompts) && S.event.chatPrompts.length) ? S.event.chatPrompts : OCURRENCIAS;
// 🎲 Ocurrencia al azar sin repetir hasta agotar la lista, con animación; avisa de su existencia las primeras veces.
let diceBag = [];
$('#c-dice').addEventListener('click', () => {
  const i = $('#c-text'), l = prompts(); if (!diceBag.length) diceBag = l.map((_, k) => k).sort(() => Math.random() - .5);
  const t = l[diceBag.pop()] || l[0], d = $('#c-dice'); d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll');
  if (navigator.vibrate) try { navigator.vibrate(25); } catch { }
  i.value = t; i.focus(); i.setSelectionRange(t.length, t.length);
  try { localStorage.setItem('angelito:diceUsed', String((+localStorage.getItem('angelito:diceUsed') || 0) + 1)); } catch { } diceHint();
});
function diceHint() {
  let n = 0; try { n = +localStorage.getItem('angelito:diceUsed') || 0; } catch { }
  const show = n < 3 && !!S.me; $('#c-dicehint').hidden = true; $('#c-dice').classList.toggle('glow', n < 3);
}
$('#c-text').addEventListener('input', () => { diceHint(); syncSend(); });
const syncSend = () => $('#c-form')?.classList.toggle('ready', !!($('#c-text').value.trim() || S.chatDraftImg));
// (el texto de ayuda del chat es fijo: "Escribe un mensaje…")
$('#c-form').addEventListener('submit', async e => {
  e.preventDefault(); const i = $('#c-text'), img = S.chatDraftImg, text = i.value.trim() || (img ? '📷 Foto' : ''); if (!text || !S.me) return;
  S.chatDraftImg = null; renderChatImgPrev(); setTimeout(syncSend, 0);
  i.value = '';
  const rt = S.replyTo; S.replyTo = null; renderReplyBar();
  const ments = mentionsIn(text); renderMentionBar();
  if (ments[0] === 'all' && !(await confirmBox('📣 ¿Avisar a todo el grupo?', 'A todos les llegará una notificación con tu mensaje. Úsalo solo para cosas importantes.', 'Avisar a todos'))) { i.value = text; return; }
  try {
    const ref = doc(collection(db, 'chat')), b = writeBatch(db);
    b.set(ref, { uid: S.uid, text, ts: Date.now(), at: serverTimestamp(), ...(img ? { hasImg: true } : {}), ...(ments.length ? { mentions: ments } : {}), ...(rt ? { replyTo: { id: rt.id, uid: rt.uid, text: rt.text.slice(0, 100) } } : {}) });
    if (img) { b.set(doc(db, 'chatImg', ref.id), { uid: S.uid, data: img }); S.chatImgs[ref.id] = img; }
    await b.commit(); S.chatStick = true; scrollChat(true); if (ments.length) toast(ments[0] === 'all' ? '📣 Le avisamos a todo el grupo' : `📣 Le avisamos a ${ments.map(u => shortName(P(u))).join(', ')}`); }
  catch (err) { i.value = text === '📷 Foto' ? '' : text; if (img) { S.chatDraftImg = img; renderChatImgPrev(); } toast(err?.code?.includes('permission') ? 'No se pudo enviar. Revisa que la hora de tu teléfono esté bien.' : authErr(err)); }
});
/* ---------- 📷 fotos en el chat ---------- */
S.chatImgs = {}; const chatImgLoading = new Set();
function loadChatImgs() {
  for (const m of S.chat) {
    if (!m.hasImg || S.chatImgs[m.id] || chatImgLoading.has(m.id)) continue;
    chatImgLoading.add(m.id);
    getDoc(doc(S.uid ? db : adb, 'chatImg', m.id)).then(d => { if (d.exists()) { S.chatImgs[m.id] = String(d.data().data || '').replace(/[^A-Za-z0-9+/=:;,._-]/g, ''); render(); } })
      .catch(() => { }).finally(() => chatImgLoading.delete(m.id));
  }
}
// Cámara del chat: elegir entre tomar una foto o enviar una de la galería
$('#c-imgbtn').addEventListener('click', async () => {
  const k = await sheet({ title: 'Enviar una foto', items: [{ k: 'cam', icon: 'camera', label: 'Tomar foto', hint: 'Abre la cámara' }, { k: 'gal', icon: 'image', label: 'Elegir de la galería', hint: 'Una foto que ya tienes' }] });
  if (!k) return;
  const f = $('#c-file'); if (k === 'cam') f.setAttribute('capture', 'environment'); else f.removeAttribute('capture');
  f.click();
});
$('#c-file').addEventListener('change', async e => {
  const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
  if (!/^image\//.test(f.type)) return toast('Eso no es una foto');
  try { S.chatDraftImg = await shrink(f, 1080, .8, 150000); renderChatImgPrev(); $('#c-text').focus(); }
  catch { toast('No se pudo leer esa foto'); }
});
function renderChatImgPrev() {
  const b = $('#c-imgprev'); b.hidden = !S.chatDraftImg; syncSend();
  b.innerHTML = S.chatDraftImg ? `<div class="cip2"><div class="cip2-th"><img src="${S.chatDraftImg}" alt="Foto a enviar"><button type="button" class="cip2-x" data-cipx aria-label="Quitar foto">${ic('x', 14)}</button></div></div>` : '';
  $('#c-text').placeholder = S.chatDraftImg ? 'Añade un texto…' : 'Escribe un mensaje…';
}
$('#c-imgprev').addEventListener('click', e => { if (e.target.closest('[data-cipx]')) { S.chatDraftImg = null; renderChatImgPrev(); } });
$('#c-list').addEventListener('click', e => {
  const im = e.target.closest('[data-cimg]'); if (!im) return; e.stopPropagation();
  openModal(`<img src="${S.chatImgs[im.dataset.cimg] || ''}" alt="" style="width:100%;border-radius:14px"><div class="actions"><button class="btn gold" data-a="x">Cerrar</button></div>`).onclick = ev => { if (ev.target.closest('[data-a]')) closeModal(); };
}, true);
$('#c-ngate').addEventListener('click', e => { if (e.target.closest('[data-nact]')) enableNotifications(); });
$('#c-list').addEventListener('click', e => { const b = e.target.closest('[data-mid]'); if (!b) return; const m = S.chat.find(x => x.id === b.dataset.mid); if (m) openMsgMenu(m); });

/* ---------- admin: adivinanzas y chat ---------- */
$('#g-prize-save').addEventListener('click', async () => { if (await saveEvent({ guessPrize: $('#g-prize').value.trim() })) toast('Premio guardado 🏆'); });
$('#g-open').addEventListener('click', async () => {
  const v = !guessesOpen();
  if (v && !(await confirmBox('¿Revelar las adivinanzas?', 'Todos verán lo que cada uno adivinó y ya no se podrán cambiar.', 'Revelar'))) return;
  if (await saveEvent(v ? { guessesOpen: true, guessesLocked: true } : { guessesOpen: false })) toast(v ? 'Adivinanzas reveladas 🔮' : 'Adivinanzas ocultas de nuevo (ya no se pueden cambiar)');
});
$('#g-winner').addEventListener('change', async e => {
  if (await saveEvent({ guessWinner: e.target.value })) { toast(e.target.value ? `🏆 ¡${pName(e.target.value)} es el ganador!` : 'Ganador quitado'); if (e.target.value) confetti(100); }
});
$('#c-clear').addEventListener('click', async () => {
  if (!(await confirmBox('¿Vaciar el chat?', 'Se borrarán todos los mensajes para todos.', 'Vaciar'))) return;
  try {
    const docs = (await getDocs(collection(adb, 'chat'))).docs;
    for (let i = 0; i < docs.length; i += 400) { const b = writeBatch(adb); docs.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit(); }
    toast('Chat vaciado 🧹');
  } catch (err) { toast(authErr(err)); }
});

/* ---------- perfil de gustos ---------- */
const PROF = [['shirt', '👕', 'Talla de camisa/blusa', 'M'], ['pants', '👗', 'Talla de pantalón/falda', '32 / 8'], ['shoe', '👟', 'Talla de zapatos', '9'],
  ['colors', '🎨', 'Colores favoritos', 'Azul, verde'], ['likes', '💛', 'Me gusta', 'Café, libros, el béisbol…'],
  ['allergy', '⚠️', 'Alergias o cosas que no puedo usar', 'Perfumes fuertes, nueces…'], ['nogift', '🙅', 'Por favor no me regales', 'Tazas, medias…']];
const profDone = (uid = S.uid) => { const pr = S.profiles?.[uid] || {}; return PROF.filter(([k]) => String(pr[k] || '').trim()).length; };
function renderProfCard() {
  const box = $('#h-prof'); if (!box) return;
  if (!S.me || !mod('perfil')) { box.innerHTML = ''; return; }
  const n = profDone(); if (n >= 4) { box.innerHTML = ''; return; }
  box.innerHTML = `<button class="card profcard" id="prof-cta"><span class="pc-e">👕</span><span class="grow"><b>${n ? 'Termina tu perfil' : 'Completa tu perfil'}</b><span class="muted small">Tu angelito necesita tu talla, tus colores y lo que te gusta para acertar.</span>
    <span class="pbar2"><i style="width:${Math.round(n / PROF.length * 100)}%"></i></span><span class="small" style="color:var(--gold);font-weight:700">${n} de ${PROF.length} listos</span></span><span class="chev">›</span></button>`;
}
document.addEventListener('click', e => { if (e.target.closest('#prof-cta')) openProfile(); });
function profileHtml(uid, compact) {
  const pr = S.profiles[uid]; if (!pr || !PROF.some(([k]) => pr[k])) return compact ? '' : (uid === S.uid ? '' : `<p class="muted small" style="margin:-4px 0 12px">Todavía no ha llenado su perfil de gustos.</p>`);
  return `<div class="card" style="margin-bottom:14px;padding:14px"><div class="stack" style="gap:6px">${PROF.filter(([k]) => pr[k]).map(([k, e, l]) =>
    `<div class="small"><span class="muted">${e} ${esc(l)}:</span> <b>${esc(pr[k])}</b></div>`).join('')}</div></div>`;
}
function openProfile() {
  const pr = S.profiles[S.uid] || {};
  const s2 = openModal(`<h3>👕 Mi perfil de gustos</h3><p class="muted small">Ayuda a tu angelito a acertar. Todo es opcional.</p>
    <div class="stack" style="margin-top:12px">${PROF.map(([k, e, l, ph]) => `<label class="field"><span>${e} ${esc(l)}</span><input class="in" data-pf="${k}" maxlength="120" placeholder="${esc(ph)}" value="${esc(pr[k] || '')}"></label>`).join('')}</div>
    <div class="actions"><button class="btn" data-a="no">Cancelar</button><button class="btn gold" data-a="ok">Guardar</button></div>`);
  s2.onclick = async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; if (a === 'no') return closeModal();
    const o = {}; $$('[data-pf]', s2).forEach(i => { o[i.dataset.pf] = i.value.trim(); });
    try { await setDoc(doc(db, 'profiles', S.uid), o); closeModal(); toast('Perfil guardado 👕'); } catch (err) { toast(authErr(err)); }
  };
}
document.addEventListener('click', e => { if (e.target.closest('#prof-edit')) openProfile(); });

/* ---------- pistas secretas + ¿quién es mi angelito? + gran revelación ---------- */
function renderHints() {
  const box = $('#r-hints'); if (!box) return;
  if (!S.me) { box.innerHTML = ''; return; }
  const ready = !!S.drawMeta && drawReady() && S.drawMeta.ids.includes(S.uid);
  const keep = { h: $('#h-text')?.value, f: document.activeElement?.id };
  let h = '';
  const rv = S.reveal;
  if (rv && mod('adivinaAngel')) {
    const mine = rv.pairs.find(x => x.r === S.uid), guessOf = uid => S.angelGuesses.find(g => g.id === uid)?.guess;
    const hits = rv.pairs.filter(x => guessOf(x.r) === x.g);
    h += `<div class="h2row"><h2>🎉 La gran revelación</h2></div>`;
    if (mine) h += `<div class="card incoming" style="margin-bottom:12px"><div class="ie">${esc(pEmoji(mine.g))}</div><div><div class="muted small">Tu angelito era…</div><b style="font-size:1.2rem">${esc(pName(mine.g))}</b>
      ${S.myAngelGuess?.guess ? `<div class="small" style="margin-top:4px">${S.myAngelGuess.guess === mine.g ? '✅ ¡Lo adivinaste!' : `❌ Tú creías que era ${esc(pName(S.myAngelGuess.guess))}`}</div>` : ''}</div></div>`;
    h += `<div class="stack">${rv.pairs.filter(x => P(x.g) && P(x.r)).map(x => { const gs = guessOf(x.r); return `<div class="item" style="align-items:center"><span style="font-size:20px">${esc(pEmoji(x.g))}</span><div class="grow"><div class="t">${esc(pName(x.g))} → ${esc(pName(x.r))}</div>${gs ? `<div class="muted small">${esc(P(x.r)?.first || '')} creía: ${esc(pName(gs))} ${gs === x.g ? '✅' : '❌'}</div>` : ''}</div></div>`; }).join('')}</div>
      <p class="muted small center" style="margin-top:10px">🕵️ ${hits.length} ${hits.length === 1 ? 'persona adivinó' : 'personas adivinaron'} quién era su angelito${hits.length ? ': ' + hits.map(x => esc(P(x.r)?.first || '')).join(', ') : ''}</p>`;
  }
  if (ready && mod('pistas')) {
    if (S.assignment?.revealed) {
      const sent = S.hintsSent || [];
      h += `<div class="h2row"><h2>💌 Pistas para tu angelito</h2><span class="muted small">${sent.length}/10</span></div>
        <div class="card stack"><p class="muted small">Mándale pistas sobre ti sin decir tu nombre 😏 Ej: "me encanta el café", "llego tarde a todo".</p>
        ${sent.length ? `<div class="stack" style="gap:6px">${sent.map(t => `<div class="small">💌 ${esc(t)}</div>`).join('')}</div>` : ''}
        ${sent.length < 10 && !rv && !S.event.angelLocked ? `<form id="h-form" style="display:flex;gap:8px"><input class="in" id="h-text" maxlength="200" placeholder="Escribe una pista…"><button class="btn gold" type="submit">Enviar</button></form>` : ''}</div>`;
    }
    const inc = [...S.hintsIn].sort((a, b) => (a.ts || 0) - (b.ts || 0));
    h += `<div class="h2row"><h2>📨 Pistas de tu angelito</h2></div>` + (inc.length
      ? `<div class="stack">${inc.map((x, i) => `<div class="guess"><div class="gl" style="margin-top:0">Pista ${i + 1}</div><div class="gv">${esc(x.text)}</div></div>`).join('')}</div>`
      : `<div class="card empty"><span class="e">📭</span>Tu angelito todavía no te ha mandado pistas.</div>`);
  }
  if (ready && mod('adivinaAngel') && !rv && !S.event.angelLocked) {
    const g = S.myAngelGuess?.guess;
    h += `<div class="h2row"><h2>🕵️ ¿Quién crees que es tu angelito?</h2></div>
      <div class="card stack"><p class="muted small">Elige a quién crees que te tocó como angelito. Nadie lo ve hasta la gran revelación en la fiesta, y puedes cambiarlo hasta entonces.</p>
      <select class="in" id="ag-sel"><option value="">— Elige —</option>${S.participants.filter(p => p.id !== S.uid && S.drawMeta.ids.includes(p.id)).map(p => `<option value="${esc(p.id)}" ${g === p.id ? 'selected' : ''}>${esc(p.emoji)} ${esc(p.name)}</option>`).join('')}</select>
      ${g ? `<div class="small">✅ Tu sospecha: <b>${esc(pName(g))}</b></div>` : ''}</div>`;
  }
  if (document.activeElement?.id === 'ag-sel') return; // no cerrar el selector mientras se elige
  box.innerHTML = h;
  if (keep.h != null && $('#h-text')) $('#h-text').value = keep.h;
  if (keep.f && $('#' + keep.f)) $('#' + keep.f).focus();
}
$('#r-hints').addEventListener('submit', async e => {
  e.preventDefault(); if (e.target.id !== 'h-form') return;
  const text = $('#h-text').value.trim(); if (!text || !S.assignment) return;
  const sent = [...(S.hintsSent || []), text];
  try {
    const b = writeBatch(db);
    b.set(doc(collection(db, 'hints')), { to: S.assignment.recipient, text, ts: Math.floor(Date.now() / 600000) * 600000 });
    b.set(doc(db, 'hintsSent', S.uid), { texts: sent });
    await b.commit(); $('#h-text').value = ''; toast('💌 Pista enviada en secreto');
  } catch (err) { toast(authErr(err)); }
});
$('#r-hints').addEventListener('change', async e => {
  if (e.target.id !== 'ag-sel') return; const v = e.target.value;
  try { if (v) await setDoc(doc(db, 'angelGuess', S.uid), { guess: v, at: serverTimestamp() }); toast(v ? `🕵️ Guardado: crees que es ${pName(v)}` : ''); }
  catch (err) { toast(authErr(err)); }
  e.target.blur(); render();
});
async function toggleReveal() {
  if (!S.isOwner) return;
  if (S.reveal) {
    if (!(await confirmBox('¿Ocultar la revelación?', 'Las parejas vuelven a ser secretas en la app.', 'Ocultar'))) return;
    const w = writeBatch(adb); w.delete(doc(adb, 'reveal', 'main')); await w.commit(); return toast('Revelación oculta');
  }
  if (!drawReady()) return toast('Primero genera el sorteo');
  if (!(await confirmBox('🎉 ¿Hacer la gran revelación?', 'Todos verán quién era el angelito de quién y quién adivinó. Hazlo en la fiesta 😉', 'Revelar'))) return;
  const pairs = Object.entries(S.assignments).filter(([g]) => P(g)).map(([g, a]) => ({ g, r: a.recipient }));
  try { await setDoc(doc(adb, 'reveal', 'main'), { pairs, at: serverTimestamp() }); toast('🎉 ¡Revelado!'); confetti(140); } catch (err) { toast(authErr(err)); }
}
$('#d-reveal').addEventListener('click', toggleReveal);

/* ---------- calendario y mapa ---------- */
function icsDate(d) { return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
function calLinks() {
  const c = S.event; const start = c.eventAt ? new Date(ms(c.eventAt)) : c.eventDate ? new Date(c.eventDate) : null;
  if (!start || isNaN(start)) return null;
  const end = new Date(start.getTime() + 4 * 3600e3), title = c.eventName || 'Angelito de Navidad';
  const details = [c.subtitle, c.budget ? 'Presupuesto: ' + c.budget : '', c.dress ? 'Vestimenta: ' + c.dress : '', location.origin + location.pathname].filter(Boolean).join('\n');
  const g = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${icsDate(start)}/${icsDate(end)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(c.place || '')}`;
  const esc2 = t => String(t || '').replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Angelito//ES', 'BEGIN:VEVENT', 'UID:angelito-' + start.getTime() + '@angelito.app', 'DTSTAMP:' + icsDate(new Date()),
    'DTSTART:' + icsDate(start), 'DTEND:' + icsDate(end), 'SUMMARY:' + esc2(title), 'DESCRIPTION:' + esc2(details), 'LOCATION:' + esc2(c.place),
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Mañana es el angelito 🎁', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  return { g, ics: 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics) };
}
function mapsUrl() {
  const c = S.event;
  if (/^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(c.mapsUrl || '')) return c.mapsUrl;
  return c.place ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.place) : '';
}
function renderQuick() {
  const box = $('#h-quick'); if (!box) return;
  const cl = calLinks(), mp = mapsUrl(), pl = (S.event.place || '').trim();
  // Mapa pequeño del lugar (Google Maps sin clave). Solo se vuelve a dibujar si cambia el lugar.
  const mapH = pl ? `<div class="evmap"><iframe title="Mapa: ${esc(pl)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${encodeURIComponent(pl)}&z=15&output=embed"></iframe><a class="evmap-go" href="${esc(mp)}" target="_blank" rel="noopener">${ic('pin', 16)} Abrir en Maps</a></div>` : '';
  if (box.dataset.map !== pl) { box.dataset.map = pl; box.innerHTML = ''; }
  const old = box.querySelector('.evmap');
  box.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap"><button class="btn btn-ic" id="q-inv" style="flex:1">${ic('image', 18)} Invitación</button>${cl ? `<button class="btn btn-ic" id="q-cal" style="flex:1">${ic('calendar', 18)} Calendario</button>` : ''}${mp && !pl ? `<a class="btn" href="${esc(mp)}" target="_blank" rel="noopener" style="flex:1;text-decoration:none">📍 Cómo llegar</a>` : ''}</div>`;
  if (pl) box.prepend(old || document.createRange().createContextualFragment(mapH));
}
document.addEventListener('click', e => {
  if (!e.target.closest('#q-cal')) return; const cl = calLinks(); if (!cl) return;
  openModal(`<h3>📅 Agregar al calendario</h3><p class="muted small">Elige tu calendario. Incluye un recordatorio un día antes.</p>
    <div class="stack" style="margin-top:12px"><a class="btn gold" href="${esc(cl.g)}" target="_blank" rel="noopener" style="text-decoration:none">Google Calendar</a>
    <a class="btn" href="${esc(cl.ics)}" download="angelito.ics" style="text-decoration:none">📱 iPhone / Outlook / otro (.ics)</a></div>
    <div class="actions"><button class="btn ghost" data-a="x">Cerrar</button></div>`).onclick = ev => { if (ev.target.closest('[data-a]')) closeModal(); };
});

/* ---------- recordatorios automáticos por fecha ---------- */
function milestoneReminders() {
  const c = S.event; const once = (k, f) => { const key = 'angelito:ms:' + S.uid + ':' + k; let done = false; try { done = !!localStorage.getItem(key); } catch { } if (!done) { f(); try { localStorage.setItem(key, '1'); } catch { } } };
  const at = c.eventAt ? ms(c.eventAt) : c.eventDate ? new Date(c.eventDate).getTime() : 0;
  if (at) {
    const days = Math.ceil((new Date(new Date(at).toDateString()) - new Date(new Date().toDateString())) / 864e5);
    const tag = new Date(at).toDateString();
    if (days === 3) once('d3' + tag, () => notifyUser('⏳ ¡Faltan 3 días para el angelito!', 'Revisa tu regalo y tu aporte.', './', 'd3'));
    if (days === 1) once('d1' + tag, () => notifyUser('🎁 ¡Mañana es el angelito!', `${c.place ? '📍 ' + c.place + ' · ' : ''}No olvides el regalo envuelto.`, './', 'd1'));
    if (days === 0) once('d0' + tag, () => notifyUser('🎄 ¡Hoy es el angelito!', 'Nos vemos en la fiesta 🥳', './', 'd0'));
  }
  if (c.revealAt && mod('anonimos')) {
    const rd = new Date(ms(c.revealAt)).toDateString();
    if (rd === new Date().toDateString()) once('rv' + rd, () => notifyUser('💌 Hoy se abre el buzón anónimo', 'Entra a leer los mensajes.', './#anonimos', 'rvday'));
  }
  if (c.rsvpDeadline && mod('asistencia') && !(S.att[S.uid] || {}).status) {
    const d = Math.ceil((new Date(c.rsvpDeadline + 'T12:00') - new Date()) / 864e5);
    if (d === 1) once('dl' + c.rsvpDeadline, () => notifyUser('⚠️ Mañana es el último día para confirmar', 'Dinos si vas al angelito.', './', 'dl'));
  }
}

/* ---------- exportar resumen ---------- */
function summaryRows() {
  return S.participants.map(p => { const a = S.att[p.id] || {}; return { name: p.name, va: a.status === 'si' ? 'Sí' : a.status === 'no' ? 'No' : 'Sin responder', aporte: a.confirmed ? 'Recibido' : a.paid ? 'Dice que pagó' : (a.status === 'si' ? 'Pendiente' : '-') }; });
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); toast('📋 Copiado'); }
  catch { openModal(`<h3>📋 Copia el texto</h3><textarea class="in" style="min-height:220px" readonly>${esc(t)}</textarea><div class="actions"><button class="btn gold" data-a="x">Listo</button></div>`).onclick = e => { if (e.target.closest('[data-a]')) closeModal(); }; }
}
$('#exp-wa').addEventListener('click', () => {
  const c = S.event, rows = summaryRows(), sm = attSummary();
  const list = (f) => rows.filter(f).map(r => '• ' + r.name).join('\n') || '• Nadie';
  const t = `🎁 *${c.eventName || 'Angelito de Navidad'}*${c.eventDate ? '\n📅 ' + fmtDate(c.eventDate) : ''}${c.place ? '\n📍 ' + c.place : ''}

✅ *Van (${sm.going}):*
${list(r => r.va === 'Sí')}

❌ *No van (${sm.notGoing}):*
${list(r => r.va === 'No')}

⏳ *Sin responder (${sm.pending}):*
${list(r => r.va === 'Sin responder')}
${c.contribAmount ? `
💵 *Aporte ${c.contribAmount}*
Recibidos (${sm.paid}):
${list(r => r.aporte === 'Recibido')}
Pendientes (${sm.going - sm.paid}):
${list(r => r.va === 'Sí' && r.aporte !== 'Recibido')}` : ''}`;
  copyText(t);
});
$('#exp-csv').addEventListener('click', () => {
  const q = v => '"' + String(v).replace(/"/g, '""') + '"';
  copyText(['Nombre,¿Va?,Aporte', ...summaryRows().map(r => [r.name, r.va, r.aporte].map(q).join(','))].join('\n'));
});

function renderRevealBtn() { const b = $('#d-reveal'); if (b) b.textContent = S.reveal ? 'Ocultar' : '🎉 Revelar'; }
/* ---------- sugerencias ---------- */
const sTs = x => x.ts || ms(x.at);
const ST = { nueva: ['🆕', 'Nueva'], revision: ['👀', 'En revisión'], aprobada: ['👍', 'Aprobada'], hecho: ['✅', 'Hecho'], no: ['❌', 'No se hará'] };
$('#buz-seg').addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (b) location.hash = { c: 'chat', s: 'sugerencias', f: 'fotos' }[b.dataset.b]; });
function setBuzQuiet() {
  const want = !mod(BUZ_MOD[S.buz]);
  $$('#buz-seg button').forEach(x => { x.style.display = mod(BUZ_MOD[x.dataset.b]) ? '' : 'none'; });
  if (want) setBuz(S.buz);
}
function renderSuggestions() {
  const fb = $('#s-formbox');
  if (!S.me) fb.innerHTML = S.authReady ? needLogin('Entra con tu PIN para dejar una sugerencia.') : '';
  else if (!$('#s-form')) fb.innerHTML = `<form class="ideaform2" id="s-form">
      <div class="if-hd"><span class="if-ic">${ic('bulb', 26)}</span><div><b>¿Qué le falta al angelito?</b><small>Propón juegos, comida o dinámicas. El grupo vota las mejores.</small></div></div>
      <div class="if-chips">${[['🎮', 'Un juego: '], ['🍽️', 'De comer: '], ['🎶', 'Música: '], ['🎁', 'Una dinámica: '], ['🎄', 'Decoración: ']].map(([e, t]) => `<button type="button" class="if-chip" data-sstart="${t}">${e} ${t.replace(/: $/, '')}</button>`).join('')}</div>
      <textarea class="in" id="s-text" maxlength="600" rows="3" placeholder="Ej. Que juguemos dominó después de la cena 🎲" required></textarea>
      <div class="idearow2"><button type="button" class="signsw" id="s-sign" role="switch" aria-checked="false" aria-label="Firmar con mi nombre"><span class="ss-av" id="s-av">🕶️</span><span class="ss-t"><b id="s-hint">Anónima</b><small id="s-sub">Nadie sabrá quién fue</small></span><span class="ss-tg" aria-hidden="true"><i></i></span></button>
      <button class="btn if-go" type="submit" id="s-go">${ic('send', 18)} Enviar idea</button></div></form>`;
  try { if (localStorage.getItem('angelito:signIdeas') === '1') setSign(true); } catch { }
  const list = $('#s-list');
  if (!S.me && !S.isAdmin) { list.innerHTML = ''; return; }
  const votes = id => S.sugVotes.filter(v => v.sug === id);
  const items = [...S.suggestions].sort((a, b) => votes(b.id).length - votes(a.id).length || sTs(b) - sTs(a));
  const max = Math.max(1, ...items.map(x => votes(x.id).length));
  list.innerHTML = items.length ? `<div class="h2row" style="margin-top:0"><h2>Ideas del grupo</h2><span class="tag">${items.length} ${items.length === 1 ? 'idea' : 'ideas'}</span></div><p class="muted small" style="margin:-6px 0 12px">Toca 👍 en las que te gusten: las más votadas suben.</p><div class="stack">${items.map((x, k) => {
    const st = ST[x.status] || ST.nueva, au = S.sugAuthors[x.id], vs = votes(x.id), mine = vs.some(v => v.uid === S.uid), top = k < 3 && vs.length > 0;
    return `<div class="sug2 ${top ? 'top' : ''} s-${esc(x.status || 'nueva')}" style="--d:${Math.min(k, 8) * 50}ms;--v:${vs.length / max * 100}%">
      <button class="vote2 ${mine ? 'on' : ''}" data-svote="${esc(x.id)}" ${S.me ? '' : 'disabled'} aria-label="Apoyar"><span class="v-th">👍</span><b>${vs.length}</b></button>
      <div class="s2-b"><div class="s2-top">${top ? `<span class="s2-rank">${['🥇', '🥈', '🥉'][k]} Top ${k + 1}</span>` : ''}${x.status && x.status !== 'nueva' ? `<span class="st2 ${esc(x.status)}">${st[0]} ${st[1]}</span>` : ''}</div>
        <div class="txt">${esc(x.text)}</div>
        <div class="s2-meta">${x.signed && x.uid ? `<span class="s2-av">${esc(pEmoji(x.uid))}</span>${esc(pName(x.uid))}` : '<span class="s2-av">🕶️</span>Anónima'}</div>
        <div class="s2-bar"><i></i></div>
        ${S.isOwner ? `<div class="spy">🕵️ Solo tú ves esto · Escrita por: <b>${au ? esc(pName(au)) : 'desconocido'}</b></div>` : ''}
        ${can('moderar') ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${Object.entries(ST).map(([kk, v]) => `<button class="btn sm ${x.status === kk || (!x.status && kk === 'nueva') ? 'gold' : ''}" data-sst="${kk}" data-sid="${esc(x.id)}">${v[0]} ${v[1]}</button>`).join('')}<button class="btn sm" data-sdel="${esc(x.id)}">🗑️</button></div>` : ''}
      </div></div>`;
  }).join('')}</div>` : `<div class="card s2-empty"><div class="s2e-ic">💡</div><b>Todavía no hay ideas</b><p class="muted small">¡Sé el primero! Por ejemplo:</p><div class="if-chips" style="justify-content:center">${['🎲 Dominó después de la cena', '🎤 Karaoke de villancicos', '📸 Foto grupal con gorros'].map(t => `<span class="if-chip ghost">${t}</span>`).join('')}</div></div>`;
}
$('#s-formbox').addEventListener('click', e => {
  const st = e.target.closest('[data-sstart]');
  if (st) { const t = $('#s-text'); if (!t.value.startsWith(st.dataset.sstart)) t.value = st.dataset.sstart + t.value.replace(/^[^:]{1,20}: /, ''); t.focus(); t.setSelectionRange(t.value.length, t.value.length); return; }
  if (!e.target.closest('#s-sign')) return;
  const on = !$('#s-sign').classList.contains('on'); setSign(on);
  try { localStorage.setItem('angelito:signIdeas', on ? '1' : '0'); } catch { }
});
function setSign(on) {
  const t = $('#s-sign'); if (!t) return; t.classList.toggle('on', on); t.setAttribute('aria-checked', String(on));
  $('#s-av').textContent = on ? (S.me?.emoji || '🙂') : '🕶️';
  $('#s-hint').textContent = on ? 'Con mi nombre' : 'Anónima';
  $('#s-sub').textContent = on ? `Firmada: ${shortName(S.me) || 'tú'}` : 'Nadie sabrá quién fue';
}
$('#s-formbox').addEventListener('submit', async e => {
  e.preventDefault(); if (e.target.id !== 's-form') return;
  const text = $('#s-text').value.trim(); if (!text) return;
  const signed = $('#s-sign').classList.contains('on'), btn = $('#s-go'), label = btn.innerHTML; busy(btn, true);
  try {
    const b = writeBatch(db), ref = doc(collection(db, 'suggestions')); S.myCreated.add(ref.id);
    const ts = Math.floor(Date.now() / 3600e3) * 3600e3; // hora redondeada: no delata quién la escribió
    b.set(ref, signed ? { text, signed: true, uid: S.uid, status: 'nueva', ts } : { text, signed: false, status: 'nueva', ts });
    b.set(doc(db, 'suggestionAuthors', ref.id), { uid: S.uid });
    await b.commit(); $('#s-text').value = ''; toast('¡Gracias por tu sugerencia! 💡');
  } catch (err) { toast(authErr(err)); }
  busy(btn, false, label);
});
$('#s-list').addEventListener('click', async e => {
  const st = e.target.closest('[data-sst]'), del = e.target.closest('[data-sdel]'), vt = e.target.closest('[data-svote]');
  try {
    if (vt && S.me) {
      const id = `${vt.dataset.svote}__${esc(S.uid)}`;
      if (S.sugVotes.some(v => v.id === id)) { const w = writeBatch(db); w.delete(doc(db, 'sugVotes', id)); await w.commit(); }
      else { await setDoc(doc(db, 'sugVotes', id), { sug: vt.dataset.svote, uid: S.uid, at: serverTimestamp() }); }
    }
    if (st) await setDoc(doc(adb, 'suggestions', st.dataset.sid), { status: st.dataset.sst }, { merge: true });
    if (del && await confirmBox('¿Borrar esta sugerencia?', 'No se puede deshacer.', 'Borrar')) {
      const b = writeBatch(adb); b.delete(doc(adb, 'suggestions', del.dataset.sdel)); if (S.isOwner || can('moderar')) b.delete(doc(adb, 'suggestionAuthors', del.dataset.sdel));
      S.sugVotes.filter(v => v.sug === del.dataset.sdel).forEach(v => b.delete(doc(adb, 'sugVotes', v.id))); await b.commit();
    }
  } catch (err) { toast(authErr(err)); }
});

/* ---------- admin ---------- */
let cfgDirty = false;
$('#cfg-form').addEventListener('input', () => { cfgDirty = true; syncCfgBar(); });
// Barra fija de "cambios sin guardar" (en vez de un botón flotando encima de los campos)
function syncCfgBar() { const b = $('#cfg-bar'); if (b) b.hidden = !(cfgDirty && S.admGrp === 'evento' && location.hash === '#admin'); }
$('#cfg-bar').addEventListener('click', e => { if (e.target.closest('[data-cfg=save]')) $('#cfg-form').requestSubmit(); if (e.target.closest('[data-cfg=undo]')) { cfgDirty = false; syncCfgBar(); renderAdmin(); toast('Cambios descartados'); } });

/* ---------- panel del organizador: secciones ---------- */
const ADM_GROUPS = [['resumen', '🏠', 'Resumen'], ['evento', '🎄', 'Evento'], ['personas', '👥', 'Personas'], ['actividades', '📅', 'Actividades'], ['mensajes', '💬', 'Mensajes'], ['fiesta', '🎉', 'Fiesta'], ['ajustes', '⚙️', 'Ajustes']];
function sortAdm() { // ordena las tarjetas por sección
  const panel = $('#adm-panel'), ord = g => ADM_GROUPS.findIndex(x => x[0] === g);
  [...panel.querySelectorAll(':scope > .admin-sec')].sort((a, b) => ord(a.dataset.grp) - ord(b.dataset.grp) || (+a.dataset.ord - +b.dataset.ord)).forEach(el => panel.appendChild(el));
}
sortAdm(); $('[data-grp="ajustes"][data-ord="3"]')?.classList.add('danger');
try { S.admGrp = sessionStorage.getItem('angelito:admGrp') || 'resumen'; } catch { S.admGrp = 'resumen'; }
function applyAdmGroups() {
  const secs = $$('#adm-panel > .admin-sec');
  const allowed = el => el.id === 'adm-dash' || el.style.display !== 'none';
  const avail = ADM_GROUPS.filter(([g]) => secs.some(el => el.dataset.grp === g && allowed(el)));
  if (!avail.some(([g]) => g === S.admGrp)) S.admGrp = 'resumen';
  $('#adm-nav').innerHTML = navHTML(avail, S.admGrp); decoratePanel($('#adm-panel'));
  secs.forEach(el => el.classList.toggle('gh', el.dataset.grp !== S.admGrp));
}
function admGo(g) {
  if (cfgDirty && S.admGrp === 'evento' && g !== 'evento') toast('⚠️ Tienes cambios del evento sin guardar');
  S.admGrp = g; try { sessionStorage.setItem('angelito:admGrp', g); } catch { } syncCfgBar();
  applyAdmGroups(); renderAdmDash(); renderDrawRules();
  $('#adm-nav [data-ag].on')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  const top = $('#adm-nav').getBoundingClientRect().top + scrollY - 8; if (scrollY > top) scrollTo({ top, behavior: 'smooth' });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-ag]'); if (b) { admGo(b.dataset.ag); const t = b.dataset.nextgo; if (t) setTimeout(() => { const el = $('#' + t); if (!el) return; if (el.tagName === 'DETAILS') el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 250); } });
$('#party-unlock').addEventListener('click', async () => {
  if (!(await confirmBox('¿Reabrir pistas y sospechas?', 'Todos podrán volver a mandar pistas y cambiar a quién creen que es su angelito.', 'Reabrir'))) return;
  if (await saveEvent({ angelLocked: false })) toast('🔓 Pistas y sospechas abiertas otra vez');
});
function renderAdmDash() {
  { const u = $('#party-unlock'); if (u) u.hidden = !(S.isOwner && S.event.angelLocked); }
  const box = $('#adm-dash'); if (!box || S.admGrp !== 'resumen') return;
  const c = S.event, ps = S.participants, sm = attSummary();
  const withW = ps.filter(p => S.wishes.some(w => w.uid === p.id)).length;
  const drawn = !!S.drawMeta && drawReady();
  const tile = (k, v, sub, g) => `<button class="dt" data-ag="${g}"><div class="dk">${k}</div><div class="dv">${v}</div>${sub ? `<div class="ds">${sub}</div>` : ''}</button>`;
  const steps = [
    [!!(c.eventDate && c.place), '🎄 Pon la fecha y el lugar', 'evento', can('evento')],
    [(c.rules || []).length > 0, '📜 Escribe las reglas', 'evento', can('evento') && mod('reglas')],
    [S.activities.length > 0, '📅 Crea las actividades', 'actividades', can('actividades')],
    [ps.length >= 3, '👥 Que se inscriban al menos 3 personas', 'personas', can('participantes')],
    [drawn, S.drawMeta && !drawReady() ? '🎡 Vuelve a generar el sorteo (cambió la lista)' : '🎡 Genera el sorteo', 'personas', S.isOwner],
    [!c.contribAmount || (sm.going > 0 && sm.paid >= sm.going), '💵 Recibe los aportes', 'personas', can('aportes') && !!c.contribAmount && mod('asistencia')],
  ].filter(x => x[3]);
  const done = steps.filter(x => x[0]).length;
  const nextStep = steps.find(x => !x[0]);
  const cta = nextStep ? `<button class="card nextc hot" data-ag="${nextStep[2]}" data-nextgo="${nextStep[1].includes('sorteo') ? 'd-gen' : ''}" style="width:100%;text-align:left;margin-bottom:14px"><div class="nx-e">👉</div><div class="grow"><span class="muted small">Siguiente paso</span><b style="display:block">${nextStep[1]}</b></div><span class="btn sm gold">Hacerlo ahora</span></button>` : `<div class="card nextc" style="margin-bottom:14px"><div class="nx-e">✅</div><div class="grow"><b>${S.isOwner ? '¡Todo listo!' : 'Tus tareas están al día'}</b><div class="muted small">${S.isOwner ? 'Solo falta disfrutar la fiesta.' : 'Lo demás le toca al organizador principal.'}</div></div></div>`;
  box.innerHTML = cta + `<div class="dgrid">
      ${tile('👥 Inscritos', ps.length, regOpen() ? 'Inscripciones abiertas' : '🔒 Inscripciones cerradas', 'personas')}
      ${tile('✅ Van', sm.going, sm.pending ? `${sm.pending} sin responder` : 'Todos respondieron', 'personas')}
      ${c.contribAmount && mod('asistencia') && can('aportes') ? tile('💵 Aportes', `${sm.paid}/${sm.going}`, sm.said ? `${sm.said} dicen que ya` : 'recibidos', 'personas') : tile('📅 Actividades', S.activities.length, 'programadas', 'actividades')}
      ${tile('🎁 Con lista', `${withW}/${ps.length}`, 'ya escribieron deseos', 'personas')}
      ${tile('🎡 Sorteo', drawn ? '✅' : '⏳', drawn ? 'Listo' : S.drawMeta ? 'Hay que repetirlo' : 'Pendiente', 'personas')}
      ${tile('💌 Anónimos', S.qCount || 0, 'preguntas', 'mensajes')}
    </div>
    ${steps.length ? `<div class="card"><div style="display:flex;justify-content:space-between;align-items:baseline"><b>Pasos para tener todo listo</b><span class="muted small">${done} de ${steps.length}</span></div>
      <div class="prog" style="margin-top:8px"><i style="width:${done / steps.length * 100}%;background:var(--gold)"></i></div>
      <div class="steps">${steps.map(([ok, l, g]) => `<button class="step ${ok ? 'done' : ''}" data-ag="${g}"><span class="ck">${ok ? '✓' : ''}</span><span>${l}</span>${ok ? '' : '<span class="go">Ir ›</span>'}</button>`).join('')}</div></div>` : ''}
    <div class="card" style="margin-top:14px"><b>Accesos rápidos</b><div class="qa">
      ${can('evento') ? '<button class="btn sm gold" data-ag="mensajes">📣 Enviar un aviso</button>' : ''}
      ${can('participantes') ? '<button class="btn sm" data-ag="personas">👥 Participantes</button>' : ''}
      ${can('actividades') ? '<button class="btn sm" data-ag="actividades" data-nextgo="a-fold">➕ Actividad</button>' : ''}
      ${S.isOwner ? '<button class="btn sm" data-ag="fiesta">📺 Modo fiesta</button>' : ''}</div></div>`;
}
function renderAdmin() {
  $('#adm-panel').style.display = S.isAdmin ? '' : 'none';
  const lg = $('#adm-login');
  if (S.isAdmin) { lg.innerHTML = ''; }
  else if (!$('#adm-form')) {
    lg.innerHTML = `<form class="card stack" id="adm-form" style="max-width:420px">
      <div class="lockcard" style="padding:6px 0 0"><span class="e">🛡️</span><b>Área del organizador</b><p class="muted small">Entra con el usuario y la contraseña del organizador principal. Los administradores entran con su nombre y su PIN, como siempre.</p></div>
      <label class="field"><span>Usuario</span><input class="in" id="adm-user" autocapitalize="off" autocomplete="username" placeholder="admin"></label>
      <label class="field"><span>Contraseña</span><input class="in" id="adm-pass" type="password" autocomplete="current-password" required></label>
      <div class="err" id="adm-err"></div>
      <button class="btn gold" type="submit">Entrar</button></form>`;
  }
  if (!S.isAdmin) return;
  $$('#adm-panel [data-perm]').forEach(el => { el.style.display = (el.dataset.perm === 'owner' ? S.isOwner : can(el.dataset.perm)) ? '' : 'none'; });
  const rr = $('#d-reveal-row'); if (rr) rr.style.display = S.drawMeta ? '' : 'none';
  { const sec = $('#d-gen')?.closest('.admin-sec'), want = (S.drawMeta && drawReady()) ? '3' : '0'; if (sec && sec.dataset.ord !== want) { sec.dataset.ord = want; sortAdm(); } } // sin sorteo, 'Generar sorteo' va primero
  applyAdmGroups(); renderAdmDash(); renderDrawRules();
  $('#adm-who').textContent = S.staffSelf && S.me ? S.me.name : S.isOwner ? 'Organizador principal' : S.staff?.name || 'Organizador';
  $('#adm-role').textContent = S.isOwner ? 'Panel de control · acceso total' : 'Panel de control · administrador';
  { const k = S.staffSelf && S.me ? 'me' : S.isOwner ? 'crown' : 'shield'; const el = $('#adm-ic'); if (el.dataset.k !== k + (S.me?.emoji || '')) { el.dataset.k = k + (S.me?.emoji || ''); el.innerHTML = k === 'me' ? esc(S.me.emoji || '🙂') : pic(k, 22); } }
  $('#adm-acts').hidden = !!S.staffSelf; // quien administra con su propia cuenta no tiene otra contraseña ni otra sesión que cerrar
  renderStaff();
  const f = $('#cfg-form');
  if (!cfgDirty) for (const k of ['eventName', 'subtitle', 'eventDate', 'place', 'mapsUrl', 'budget', 'dress', 'revealDate', 'revealTime', 'notes', 'contribAmount', 'contribInfo', 'rsvpDeadline']) f.elements[k].value = S.event[k] || '';
  $('#reg-tg').classList.toggle('on', regOpen());
  $('#g-open').classList.toggle('on', guessesOpen());
  $('#mod-list').innerHTML = Object.entries(MODS).map(([k, [e, l]]) => `<div class="switch"><div><b>${e} ${l}</b></div><button class="tg ${mod(k) ? 'on' : ''}" data-mod="${k}" aria-label="${esc(l)}"></button></div>`).join('');
  if (document.activeElement?.id !== 'cp-text' && !cpDirty) $('#cp-text').value = prompts().join('\n');
  const gN = (S.adminGuesses || []).filter(g => g.text).length;
  $('#g-count').textContent = S.isOwner ? `${gN} de ${S.participants.length} ya escribieron su adivinanza.` : '';
  if (document.activeElement?.id !== 'g-prize') $('#g-prize').value = S.event.guessPrize || '';
  const gw = $('#g-winner');
  if (document.activeElement !== gw) { gw.innerHTML = '<option value="">— Sin elegir —</option>' + S.participants.map(p => `<option value="${esc(p.id)}">${esc(p.emoji)} ${esc(p.name)}</option>`).join(''); gw.value = S.event.guessWinner || ''; }
  const rl = Array.isArray(S.event.rules) ? S.event.rules : [];
  $('#r-list').innerHTML = rl.length ? rl.map((r, i) => `<div class="rule" style="align-items:center"><div class="ri">${esc(r.icon || '⭐')}</div><div class="rt" style="flex:1;padding-top:0">${esc(r.text)}</div>
    <div style="display:flex;gap:2px"><button class="x" data-rup="${i}" ${i === 0 ? 'disabled style="opacity:.3"' : ''} aria-label="Subir">↑</button><button class="x" data-rdown="${i}" ${i === rl.length - 1 ? 'disabled style="opacity:.3"' : ''} aria-label="Bajar">↓</button><button class="x" data-rdel="${i}" aria-label="Borrar">✕</button></div></div>`).join('')
    : '<p class="muted small">Todavía no hay reglas.</p>';
  $('#q-now').classList.toggle('on', !!S.event.revealNow);
  const hasDraw = !!S.drawMeta;
  // Una sola lista: asistencia, pago, ruleta y acciones en la misma fila (sin listas repetidas).
  const attOf = id => S.att[id] || {}, payOn = mod('asistencia') && !!S.event.contribAmount;
  const F = S.pFilter || 'todos', PQ = normName(S.pQuery || '');
  const flt = { todos: () => true, van: id => attOf(id).status === 'si', sin: id => !attOf(id).status, no: id => attOf(id).status === 'no', debe: id => attOf(id).status === 'si' && !attOf(id).confirmed };
  const cntF = k => S.participants.filter(p => flt[k](p.id)).length;
  const chips = [['todos', 'Todos'], ['van', 'Van'], ['sin', 'Sin responder'], ['no', 'No van'], ...(payOn ? [['debe', 'Falta pagar']] : [])];
  if (!$('#p-q')) $('#p-tools').innerHTML = `<input class="in" id="p-q" type="search" placeholder="🔍 Buscar persona…" autocomplete="off"><div class="pfil" id="p-fil"></div>`;
  $('#p-tools').style.display = S.participants.length > 5 ? '' : 'none'; // con pocas personas no hace falta
  $('#p-fil').innerHTML = chips.map(([k, l]) => `<button class="${F === k ? 'on' : ''}" data-pf2="${k}">${l} <span>${cntF(k)}</span></button>`).join('');
  const list = S.participants.filter(p => flt[F](p.id) && (!PQ || normName(p.name).includes(PQ)));
  $('#p-list').innerHTML = !S.participants.length ? `<p class="muted small">Nadie se ha registrado todavía. Comparte el enlace de la página.</p>`
    : !list.length ? '<p class="muted small center">Nadie en este filtro.</p>' : list.map(p => {
    const a = attOf(p.id);
    const att = mod('asistencia') ? (a.status === 'si' ? '<span class="bdg ok">Va</span>' : a.status === 'no' ? '<span class="bdg no">No va</span>' : '<span class="bdg wait">Sin responder</span>') : '';
    const pay = payOn && a.status === 'si' ? (a.confirmed ? '<span class="bdg paid">💵 Pagó</span>' : a.paid ? '<span class="bdg said">Dice que pagó</span>' : '<span class="bdg due">Falta pagar</span>') : '';
    const spin = hasDraw && S.assignments[p.id] ? (S.assignments[p.id].revealed ? '<span class="bdg">🎡 Giró</span>' : '<span class="bdg wait">🎡 No ha girado</span>') : '';
    const gs = GS[S.giftStatus[p.id]];
    const payBtn = payOn && can('aportes') && a.status === 'si' && !a.confirmed ? `<button class="btn xs gold" data-conf="${esc(p.id)}" data-v="1">✓ Pagó</button>` : '';
    return `<div class="prow"><span class="pe">${esc(p.emoji)}</span><div class="grow"><div class="t">${esc(p.name)}</div><div class="bdgs">${att}${pay}${spin}${gs ? `<span class="bdg">${gs[0]} ${gs[1]}</span>` : ''}</div></div>
      <div class="pact">${payBtn}<button class="wmore" data-pmore="${esc(p.id)}" aria-label="Más opciones"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button></div></div>`;
  }).join('');
  const spun = Object.values(S.assignments).filter(a => a.revealed).length;
  $('#d-status').innerHTML = !hasDraw ? `Hay ${S.participants.length} inscritos. Cuando estén todos, genera el sorteo (mínimo 3).`
    : drawReady() ? `✅ Sorteo listo · <b>${spun} de ${S.participants.length}</b> ya giraron. Las parejas no se muestran aquí.`
      : '⚠️ Los participantes cambiaron después del sorteo. Vuelve a generarlo.';
  $('#d-gen').textContent = hasDraw ? 'Volver a sortear' : 'Generar sorteo';
  $('#q-count').textContent = `${nMsg(S.qCount)} en el buzón · ${isRevealed() ? 'abiertos ahora' : 'se abren el ' + (revealWhen() || 'día del evento')}`;
  $('#relog-last').textContent = S.event.reloginAt ? 'Último pedido: ' + new Date(ms(S.event.reloginAt)).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  if (![$('#q-date'), $('#q-time')].includes(document.activeElement) && !syncCfgBar.qEdit) { $('#q-date').value = revealDay() || ''; $('#q-time').value = S.event.revealTime || '00:00'; }
  { const ra = S.event.revealAt ? ms(S.event.revealAt) : 0; $('#q-left').textContent = isRevealed() ? '🔓 Abiertos' : ra > Date.now() ? '⏳ ' + leftTo(ra) : ''; }
  $('#a-list').innerHTML = S.activities.map(a => {
    let meta = '', btns = '';
    if (a.kind === 'assign') { meta = a.assignedAt ? `🎲 Repartido a ${Number(a.assignedN) || 0} · ${a.secret ? 'secreto' : 'público'}` : '🎲 Sin repartir'; btns = `<button class="btn sm gold" data-assign="${esc(a.id)}">${a.assignedAt ? 'Repartir de nuevo' : '🎲 Repartir'}</button>`; }
    if (a.kind === 'vote') { const n = S.adminVotes.filter(v => v.act === a.id).length; meta = `🗳️ ${n} ${n === 1 ? 'voto' : 'votos'} · ${a.resultsOpen ? 'resultados publicados' : 'resultados ocultos'}`; btns = `<button class="btn sm gold" data-results="${esc(a.id)}">${a.resultsOpen ? 'Ocultar resultados' : '📊 Publicar resultados'}</button>`; }
    if (a.kind === 'signup') { const n = S.signups.filter(x => x.act === a.id).length; meta = `📝 ${n} de ${(a.items || []).length} apuntados`; }
    if (a.kind === 'quiz') { const n = S.adminQuiz.filter(x => x.act === a.id).length; meta = `❓ ${(a.qs || []).length} preguntas · ${n} ${n === 1 ? 'respondió' : 'respondieron'} · ${a.resultsOpen ? 'resultados publicados' : 'resultados ocultos'}`; btns = `<button class="btn sm gold" data-results="${esc(a.id)}">${a.resultsOpen ? 'Ocultar resultados' : '📊 Publicar resultados'}</button>`; }
    return `<div class="item" style="flex-wrap:wrap"><span style="font-size:22px">${esc(a.emoji)}</span><div class="grow"><div class="t">${esc(a.title)}</div>
      <div class="muted small">${esc(fmtDate(a.date))}${a.time ? ' · ' + esc(fmtTime(a.time)) : ''}</div>${meta ? `<div class="muted small" style="margin-top:4px">${meta}</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${btns}<button class="btn sm" data-aedit="${esc(a.id)}">✏️ Editar</button><a class="btn sm" href="#actividad-${esc(a.id)}" style="text-decoration:none">👁️ Ver</a></div></div>
      <button class="x" data-act="${esc(a.id)}" aria-label="Borrar">✕</button></div>`;
  }).join('') || '<p class="muted small">No hay actividades todavía.</p>';
}
$('#adm-login').addEventListener('submit', async e => {
  e.preventDefault(); const btn = e.target.querySelector('button[type=submit]'); busy(btn, true);
  try { await adminLogin($('#adm-user').value, $('#adm-pass').value); toast('Modo organizador activo 🔓'); }
  catch (err) { $('#adm-err').textContent = authErr(err).replace('PIN incorrecto', 'Usuario o contraseña incorrectos'); busy(btn, false); }
});
fillPics();
$('#adm-out').addEventListener('click', async () => { await signOut(adminAuth); $('#adm-login').innerHTML = ''; render(); toast('Saliste del modo organizador'); });
const saveEvent = async patch => {
  S.selfEditAt = Date.now(); // lo cambié yo: no me avises a mí mismo
  try { await setDoc(doc(adb, 'config', 'event'), patch, { merge: true }); return true; } catch (e) { toast(authErr(e)); return false; }
};
$('#cfg-form').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, o = {};
  for (const k of ['eventName', 'subtitle', 'eventDate', 'place', 'mapsUrl', 'budget', 'dress', 'revealDate', 'revealTime', 'notes', 'contribAmount', 'contribInfo', 'rsvpDeadline']) o[k] = f.elements[k].value.trim();
  if (o.eventDate && isNaN(new Date(o.eventDate))) return toast('La fecha del evento no es válida');
  if (o.revealDate && isNaN(new Date(o.revealDate + 'T00:00'))) return toast('La fecha de los anónimos no es válida');
  o.eventAt = o.eventDate ? Timestamp.fromDate(new Date(o.eventDate)) : null;
  if (!o.eventName) return toast('Ponle nombre al evento');
  if (o.mapsUrl && !/^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(o.mapsUrl)) return toast('El enlace debe ser de Google Maps (https://maps.app.goo.gl/…)');
  if (o.rsvpDeadline && o.eventDate && o.rsvpDeadline > o.eventDate.slice(0, 10)) return toast('La fecha para confirmar debe ser antes del evento');
  if (o.eventDate && new Date(o.eventDate) < new Date() && !(await confirmBox('Esa fecha ya pasó', '¿Guardar de todos modos?', 'Guardar'))) return;
  if (S.isOwner) o.revealAt = o.revealDate ? Timestamp.fromDate(new Date(o.revealDate + 'T' + (o.revealTime || '00:00'))) : (o.eventDate ? Timestamp.fromDate(new Date(o.eventDate.slice(0, 10) + 'T00:00')) : null);
  else {
    delete o.revealDate; delete o.revealTime;
    // si el principal no fijó un día propio para los anónimos, se abren el día del evento (aunque cambie la fecha)
    if (!S.event.revealDate && o.eventDate) { const ra = Timestamp.fromDate(new Date(o.eventDate.slice(0, 10) + 'T00:00')); if (ra.toMillis() > Date.now()) o.revealAt = ra; }
  }
  if (S.isOwner && o.revealDate && o.eventDate && o.revealDate > o.eventDate.slice(0, 10)) return toast('Los anónimos deben abrirse antes o el mismo día del evento');
  if (S.isOwner && o.revealDate && o.revealDate < todayStr() && !(await confirmBox('Los anónimos se abrirían ya', 'Esa fecha ya pasó: todos verían los mensajes ahora mismo.', 'Guardar igual'))) return;
  if (await saveEvent(o)) { cfgDirty = false; syncCfgBar(); toast('Evento guardado'); }
});
// Buzón anónimo: cambiar el día y la hora en que se abren, desde su propia tarjeta
['q-date', 'q-time'].forEach(id => $('#' + id).addEventListener('input', () => { syncCfgBar.qEdit = true; }));
$('#q-useev').addEventListener('click', () => { const d = (S.event.eventDate || '').slice(0, 10); if (!d) return toast('Primero pon la fecha del evento'); $('#q-date').value = d; $('#q-time').value = '00:00'; syncCfgBar.qEdit = true; });
$('#q-save').addEventListener('click', async () => {
  const d = $('#q-date').value, t = $('#q-time').value || '00:00', ev = (S.event.eventDate || '').slice(0, 10);
  if (!d || isNaN(new Date(d + 'T' + t))) return toast('Elige un día válido');
  if (ev && d > ev) return toast('Los anónimos deben abrirse antes o el mismo día del evento');
  if (new Date(d + 'T' + t) < new Date() && !(await confirmBox('Los anónimos se abrirían ya', 'Esa fecha ya pasó: todos verían los mensajes ahora mismo.', 'Guardar igual'))) return;
  if (await saveEvent({ revealDate: d, revealTime: t, revealAt: Timestamp.fromDate(new Date(d + 'T' + t)) })) { syncCfgBar.qEdit = false; toast('Fecha del buzón guardada 💌'); render(); }
});
let cpDirty = false;
$('#cp-text').addEventListener('input', () => { cpDirty = true; });
$('#cp-save').addEventListener('click', async () => { const l = $('#cp-text').value.split('\n').map(x => x.trim().slice(0, 140)).filter(Boolean).slice(0, 120); if (await saveEvent({ chatPrompts: l })) { cpDirty = false; toast('Ideas guardadas 🎲'); } });
$('#cp-reset').addEventListener('click', async () => { if (!(await confirmBox('¿Usar las ideas de fábrica?', 'Se reemplazan las ideas que escribiste.', 'Reemplazar'))) return; if (await saveEvent({ chatPrompts: [] })) { cpDirty = false; $('#cp-text').value = OCURRENCIAS.join('\n'); toast('Ideas de fábrica'); } });
$('#mod-list').addEventListener('click', async e => {
  const b = e.target.closest('[data-mod]'); if (!b) return;
  const m = { ...(S.event.modules || {}) }; m[b.dataset.mod] = !mod(b.dataset.mod);
  if (await saveEvent({ modules: m })) toast(`${MODS[b.dataset.mod][0]} ${m[b.dataset.mod] ? 'Encendido' : 'Apagado'}`);
});
onlyDigits($('#pa-form'));
$('#pa-form').addEventListener('submit', async e => {
  e.preventDefault();
  const first = titleCase($('#pa-first').value), last = titleCase($('#pa-last').value), pin = $('#pa-pin').value, btn = e.target.querySelector('button[type=submit]');
  if (!first || !last) return toast('Escribe nombre y apellido');
  if (!/^\d{4}$/.test(pin)) return toast('El PIN debe tener 4 números');
  if (S.drawMeta && !S.isOwner) return toast('Ya se hizo el sorteo: solo el organizador principal puede inscribir a más personas.');
  if (S.drawMeta && !(await confirmBox('El sorteo ya está hecho', 'Si inscribes a alguien ahora habrá que volver a sortear y todos tendrán que girar de nuevo.', 'Inscribir igual'))) return;
  busy(btn, true);
  try {
    const r = await registerPerson(first, last, pin, true);
    if (r === 'dup') toast(`Ya existe ${first} ${last}`);
    else { toast(`✅ ${first} inscrito. Entra con el PIN ${pin} y la app le pedirá crear el suyo`); $('#pa-first').value = $('#pa-last').value = $('#pa-pin').value = ''; }
  } catch (err) { toast(authErr(err)); }
  busy(btn, false, 'Inscribir');
});
$('#adm-pw').addEventListener('click', () => {
  const s2 = openModal(`<h3>🔑 Cambiar contraseña de admin</h3>
    <div class="stack" style="margin-top:12px"><label class="field"><span>Contraseña actual</span><input class="in" id="pw-old" type="password" autocomplete="current-password"></label>
    <label class="field"><span>Nueva contraseña (mínimo 6)</span><input class="in" id="pw-new" type="password" autocomplete="new-password"></label>
    <label class="field"><span>Repite la nueva</span><input class="in" id="pw-new2" type="password" autocomplete="new-password"></label></div>
    <div class="err" id="pw-err"></div><div class="actions"><button class="btn" data-a="no">Cancelar</button><button class="btn gold" data-a="ok">Cambiar</button></div>`);
  s2.onclick = async ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return; if (a === 'no') return closeModal();
    const o = $('#pw-old', s2).value, n = $('#pw-new', s2).value, n2 = $('#pw-new2', s2).value, er = $('#pw-err', s2);
    if (n.length < 6) { er.textContent = 'La nueva debe tener al menos 6 caracteres.'; return; }
    if (n !== n2) { er.textContent = 'Las contraseñas no coinciden.'; return; }
    try {
      await reauthenticateWithCredential(adminAuth.currentUser, EmailAuthProvider.credential(adminAuth.currentUser.email, o));
      await updatePassword(adminAuth.currentUser, n); closeModal(); toast('Contraseña cambiada 🔑');
    } catch (err) { er.textContent = authErr(err).replace('PIN incorrecto', 'La contraseña actual no es correcta'); }
  };
});
$('#p-list').addEventListener('click', e => {
  const b = e.target.closest('[data-pedit]'); if (!b) return; const p = P(b.dataset.pedit); if (!p) return;
  const s2 = openModal(`<h3>✏️ Editar participante</h3><div class="stack" style="margin-top:12px">
    <div class="row"><label class="field"><span>Nombre</span><input class="in" id="pe-first" maxlength="25" value="${esc(p.first)}"></label><label class="field"><span>Apellido</span><input class="in" id="pe-last" maxlength="25" value="${esc(p.last)}"></label></div>
    <label class="field"><span>Emoji</span><div class="chips" id="pe-emo">${EMOJIS.map(x => `<button type="button" class="chip ${x === p.emoji ? 'on' : ''}" data-em="${x}">${x}</button>`).join('')}</div></label></div>
    <div class="actions"><button class="btn" data-a="no">Cancelar</button><button class="btn gold" data-a="ok">Guardar</button></div>`);
  let em = p.emoji;
  s2.onclick = async ev => {
    const c = ev.target.closest('[data-em]'); if (c) { em = c.dataset.em; $$('#pe-emo .chip', s2).forEach(x => x.classList.toggle('on', x === c)); return; }
    const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return; if (a === 'no') return closeModal();
    const first = titleCase($('#pe-first', s2).value), last = titleCase($('#pe-last', s2).value); if (!first || !last) return toast('Nombre y apellido');
    const nk = normName(`${first} ${last}`);
    if (nk !== p.nameKey && S.participants.some(x => x.id !== p.id && x.nameKey === nk)) return toast('Ya existe alguien con ese nombre');
    try {
      const w = writeBatch(adb);
      if (nk !== p.nameKey) { if (p.nameKey) w.delete(doc(adb, 'names', p.nameKey)); w.set(doc(adb, 'names', nk), { uid: p.id }); }
      w.set(doc(adb, 'participants', p.id), { first, last, name: `${first} ${last}`, nameKey: nk, emoji: em }, { merge: true });
      await w.commit(); closeModal(); toast('Participante actualizado ✏️'); }
    catch (err) { toast(authErr(err)); }
  };
});
const PERMS = { evento: ['🎄', 'Evento, reglas y secciones'], actividades: ['📅', 'Actividades y dinámicas'], participantes: ['👥', 'Participantes e inscripciones'], aportes: ['💵', 'Asistencia y aportes'], moderar: ['🧹', 'Moderar chat, deseos y sugerencias'] };
let stPerms = { evento: true, actividades: true };
function renderStaff() {
  if (!S.isOwner) return;
  $('#st-perms').innerHTML = Object.entries(PERMS).map(([k, [e, l]]) => `<button type="button" class="chip perm ${stPerms[k] ? 'on' : ''}" data-np="${k}">${e} ${l}</button>`).join('');
  const sel = $('#st-person'), taken = new Set((S.staffList || []).map(x => x.id));
  const opts = '<option value="">Elige a alguien…</option>' + S.participants.filter(p => !taken.has(p.id)).sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  if (sel.dataset.sig !== opts) { const v = sel.value; sel.innerHTML = opts; sel.dataset.sig = opts; if (v && !taken.has(v)) sel.value = v; }
  $('#st-list').innerHTML = (S.staffList || []).length ? S.staffList.map(st => { const p = P(st.id); return `<div class="staff">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div style="min-width:0"><b>${p ? esc(p.emoji || '🙂') : '🛡️'} ${esc(p ? p.name : st.name)}</b><div class="muted small">${p ? 'Entra con su cuenta de siempre' : st.username ? `Cuenta aparte · usuario: <b>${esc(st.username)}</b>` : '⚠️ Ya no está inscrita'}</div></div><button class="x" data-stdel="${esc(st.id)}" aria-label="Quitar">✕</button></div>
      ${p ? `<div class="switch st-own"><div><b>👑 Acceso total</b><div class="muted small">Igual que el organizador principal: ve y maneja todo con su propia cuenta.</div></div><button class="tg ${st.owner ? 'on' : ''}" data-sown="${esc(st.id)}" aria-label="Acceso total"></button></div>` : ''}
      ${st.owner ? '<p class="muted small" style="margin-top:8px">✅ Tiene todos los permisos.</p>' : `<div class="chips" style="margin-top:10px">${Object.entries(PERMS).map(([k, [e, l]]) => `<button type="button" class="chip perm ${st.perms?.[k] ? 'on' : ''}" data-sp="${k}" data-sid="${esc(st.id)}">${e} ${l}</button>`).join('')}</div>`}</div>`; }).join('')
    : '<p class="muted small">Todavía no hay administradores. El único es el organizador principal.</p>';
}
$('#st-perms').addEventListener('click', e => { const b = e.target.closest('[data-np]'); if (!b) return; stPerms[b.dataset.np] = !stPerms[b.dataset.np]; renderStaff(); });
$('#st-form').addEventListener('submit', async e => {
  e.preventDefault();
  const pid = $('#st-person').value, p = P(pid), btn = e.target.querySelector('button[type=submit]');
  if (!p) return toast('Elige a la persona');
  if (!Object.values(stPerms).some(Boolean)) return toast('Marca al menos una responsabilidad');
  if (!(await confirmBox(`¿Hacer administrador a ${p.name}?`, 'Podrá manejar lo que marcaste entrando con su propio PIN. Puedes quitarle el acceso cuando quieras.', 'Sí, darle acceso'))) return;
  busy(btn, true);
  try {
    await setDoc(doc(adb, 'staff', pid), { name: p.name, pid, perms: { ...stPerms }, at: serverTimestamp() });
    $('#st-person').value = '';
    toast(`✅ ${shortName(p)} ya es administrador: le aparece el panel en su app`);
  } catch (err) { toast(authErr(err)); }
  busy(btn, false, '➕ Hacer administrador');
});
$('#st-list').addEventListener('click', async e => {
  const t = e.target.closest('[data-sp]'), d = e.target.closest('[data-stdel]'), o = e.target.closest('[data-sown]');
  try {
    if (o) {
      const st = S.staffList.find(x => x.id === o.dataset.sown), p = P(st?.id), on = !st.owner; if (!p) return;
      if (on && !(await confirmBox(`¿Darle acceso total a ${p.name}?`, 'Podrá hacer TODO lo que tú haces: ver las parejas del sorteo, quién escribió los anónimos y sugerencias, cambiar la configuración y dar o quitar administradores. Úsalo solo con alguien de total confianza.', 'Sí, acceso total'))) return;
      await setDoc(doc(adb, 'staff', st.id), { owner: on }, { merge: true });
      toast(on ? `👑 ${shortName(p)} ya tiene acceso total` : 'Acceso total quitado'); return;
    }
    if (t) { const st = S.staffList.find(x => x.id === t.dataset.sid); const perms = { ...(st.perms || {}) }; perms[t.dataset.sp] = !perms[t.dataset.sp]; await setDoc(doc(adb, 'staff', st.id), { perms }, { merge: true }); toast(perms[t.dataset.sp] ? '✅ Permiso dado' : 'Permiso quitado'); }
    if (d) { const st = S.staffList.find(x => x.id === d.dataset.stdel); if (!(await confirmBox(`¿Quitar a ${P(st?.id)?.name || st?.name}?`, 'Ya no podrá entrar al panel. Sigue siendo participante.', 'Quitar'))) return; const w = writeBatch(adb); w.delete(doc(adb, 'staff', d.dataset.stdel)); await w.commit(); toast('Acceso retirado'); }
  } catch (err) { toast(authErr(err)); }
});
const DEFAULT_RULES = [
  ['🤫', 'Secreto total: no le digas a nadie quién te tocó hasta el día del intercambio.'],
  ['💰', 'Respeta el presupuesto acordado, ni mucho más ni mucho menos.'],
  ['📝', 'Llena tu lista de deseos para que tu angelito tenga ideas.'],
  ['🎁', 'Trae el regalo envuelto y con el nombre de quien lo recibe.'],
  ['🚫', 'No se vale cambiar de angelito ni intercambiar parejas.'],
  ['⏰', 'Llega a tiempo: el intercambio empieza a la hora indicada.'],
  ['💌', 'En el buzón y las sugerencias, todo con respeto y buena onda.'],
  ['😄', 'Lo más importante: compartir, reír y pasarla bien en familia.']
].map(([icon, text]) => ({ icon, text }));
const curRules = () => Array.isArray(S.event.rules) ? S.event.rules.map(r => ({ ...r })) : [];
$('#r-form').addEventListener('submit', async e => {
  e.preventDefault(); const text = $('#r-text').value.trim(); if (!text) return;
  if (curRules().length >= 40) return toast('Máximo 40 reglas');
  if (await saveEvent({ rules: [...curRules(), { icon: $('#r-icon').value, text }] })) { $('#r-text').value = ''; toast('Regla agregada 📜'); }
});
$('#r-defaults').addEventListener('click', async () => {
  const cur = curRules();
  if (cur.length && !(await confirmBox('¿Cargar reglas sugeridas?', 'Se agregarán al final de las que ya tienes.', 'Agregar'))) return;
  const have = new Set(cur.map(r => r.text));
  if (await saveEvent({ rules: [...cur, ...DEFAULT_RULES.filter(r => !have.has(r.text))] })) toast('Reglas sugeridas cargadas ✨');
});
$('#r-list').addEventListener('click', async e => {
  const b = e.target.closest('[data-rup],[data-rdown],[data-rdel]'); if (!b || b.disabled) return;
  if (S.rBusy) return; S.rBusy = true; setTimeout(() => { S.rBusy = false; }, 900);
  const r = curRules();
  if (b.dataset.rdel != null) { if (!(await confirmBox('¿Borrar esta regla?', r[+b.dataset.rdel]?.text || '', 'Borrar'))) return; r.splice(+b.dataset.rdel, 1); }
  else { const i = +(b.dataset.rup ?? b.dataset.rdown), j = b.dataset.rup != null ? i - 1 : i + 1; [r[i], r[j]] = [r[j], r[i]]; }
  await saveEvent({ rules: r });
});
$('#reg-tg').addEventListener('click', async () => { const v = !regOpen(); if (v && S.drawMeta && !S.isOwner) return toast('Ya se hizo el sorteo: solo el organizador principal puede reabrir las inscripciones.'); if (await saveEvent({ registrationOpen: v })) toast(v ? 'Inscripciones abiertas' : 'Inscripciones cerradas 🔒'); });
$('#q-now').addEventListener('click', async () => { const v = !S.event.revealNow; if (v && !(await confirmBox('¿Abrir el buzón ahora?', `Todos verán los ${S.qCount || 0} anónimos antes de la fecha. Aunque lo cierres después, ya los habrán visto.`, 'Abrir ahora'))) return; if (await saveEvent({ revealNow: v })) toast(v ? 'Buzón abierto 🎉' : 'Buzón cerrado de nuevo 🔒'); });
$('#p-list').addEventListener('click', async e => {
  const b = e.target.closest('[data-rm]'); if (!b) return; const id = b.dataset.rm;
  if (S.drawMeta && !S.isOwner) return toast('Ya se hizo el sorteo: solo el organizador principal puede cambiar la lista.');
  const msg = S.drawMeta ? 'Se borrarán su registro y su lista. El sorteo quedará inválido y habrá que volver a sortear.' : 'Se borrarán su registro, su lista de deseos y su asistencia. Si solo olvidó su PIN, mejor un 🔑 PIN temporal (lo da el organizador principal y conserva todo lo suyo).';
  if (!(await confirmBox(`¿Quitar a ${pName(id)}?`, msg, 'Quitar'))) return;
  try {
    const b2 = writeBatch(adb);
    const pp = P(id);
    b2.delete(doc(adb, 'participants', id)); if (S.isOwner) { b2.delete(doc(adb, 'assignments', id)); b2.delete(doc(adb, 'staff', id)); }
    if (pp?.nameKey) b2.delete(doc(adb, 'names', pp.nameKey));
    b2.set(doc(adb, 'banned', id), { at: serverTimestamp() });
    (await getDocs(query(collection(adb, 'wishes'), where('uid', '==', id)))).forEach(d => b2.delete(d.ref));
    (await getDocs(query(collection(adb, 'wishImg'), where('uid', '==', id)))).forEach(d => b2.delete(d.ref));
    // todo lo suyo, para que no queden puestos tomados ni votos de alguien que ya no está
    const mine = c => getDocs(query(collection(adb, c), where('uid', '==', id))).then(r => r.docs).catch(() => []);
    for (const c of ['activitySignups', 'sugVotes', 'chatReacts']) (await mine(c)).forEach(d => b2.delete(d.ref));
    if (can('actividades')) (await mine('votes')).forEach(d => b2.delete(d.ref));
    b2.delete(doc(adb, 'attendance', id)); b2.delete(doc(adb, 'profiles', id));
    if (S.staffList?.some(x => x.id === id) || S.isOwner) b2.delete(doc(adb, 'staff', id));
    if (S.isOwner) {
      for (const c of ['giftStatus', 'guesses', 'angelGuess', 'wishPick', 'thanks', 'hintsSent', 'fcmTokens']) b2.delete(doc(adb, c, id));
      const rec = S.assignments?.[id]?.recipient; if (rec) b2.delete(doc(adb, 'giftIncoming', rec));
    }
    await b2.commit(); toast('Participante eliminado');
  } catch (err) { toast(authErr(err)); }
});
// Restricciones: pares { a: quien regala, b: a quien no le puede salir, both: también al revés }
function blockedSet() { const s = new Set(); for (const r of S.drawRules || []) { s.add(r.a + '>' + r.b); if (r.both) s.add(r.b + '>' + r.a); } return s; }
// ---- Sorteo con restricciones: método seguro ----
// 1) Primero se busca UNA sola cadena (A→B→C→…→A): al azar y, si cuesta, paso a paso eligiendo siempre a quien
//    tiene menos opciones (así no se tranca).
// 2) Si no existe una cadena única, se usa un emparejamiento perfecto (método exacto de caminos de aumento):
//    sigue siendo un sorteo válido —todos dan y reciben una vez, nadie se toca a sí mismo y se respetan TODAS
//    las restricciones—, aunque pueda formar varios círculos.
// 3) Si ni eso existe, es matemáticamente imposible, y drawCheck dice exactamente por qué y a quién afecta.
function drawRing(ids) { return drawPlan(ids).next; }
function drawPlan(ids) {
  const bad = blockedSet(), ok = (x, y) => x !== y && !bad.has(x + '>' + y), n = ids.length;
  const outs = Object.fromEntries(ids.map(x => [x, ids.filter(y => ok(x, y))]));
  const ins = Object.fromEntries(ids.map(y => [y, ids.filter(x => ok(x, y))]));
  const zeroOut = ids.filter(x => !outs[x].length), zeroIn = ids.filter(y => !ins[y].length);
  if (n < 2 || zeroOut.length || zeroIn.length) return { next: null, zeroOut, zeroIn, outs };
  const ring = r => Object.fromEntries(r.map((x, i) => [x, r[(i + 1) % r.length]]));
  for (let t = 0; t < 3000; t++) { const r = shuffle([...ids]); if (r.every((x, i) => ok(x, r[(i + 1) % n]))) return { next: ring(r), cycle: true, outs }; }
  const start = ids.reduce((m, x) => outs[x].length < outs[m].length ? x : m, ids[0]);
  const path = [start], used = new Set(path); let steps = 0;
  const go = () => {
    if (++steps > 300000) return false;
    const last = path[path.length - 1];
    if (path.length === n) return ok(last, start);
    const cand = shuffle(outs[last].filter(z => !used.has(z)))
      .sort((a, b) => outs[a].filter(z => !used.has(z)).length - outs[b].filter(z => !used.has(z)).length);
    for (const y of cand) { path.push(y); used.add(y); if (go()) return true; path.pop(); used.delete(y); }
    return false;
  };
  if (go()) return { next: ring(path), cycle: true, outs };
  // emparejamiento perfecto exacto (Kuhn): a cada quien un destinatario distinto permitido
  const match = {}; // destinatario -> quien le regala
  const aug = (x, seen) => { for (const y of shuffle([...outs[x]])) { if (seen.has(y)) continue; seen.add(y); if (!match[y] || aug(match[y], seen)) { match[y] = x; return true; } } return false; };
  const fails = []; for (const x of shuffle([...ids])) if (!aug(x, new Set())) fails.push(x);
  if (fails.length) return { next: null, fails, outs };
  return { next: Object.fromEntries(Object.entries(match).map(([y, x]) => [x, y])), cycle: false, outs };
}
// Revisión para el organizador: ¿se puede sortear? ¿alguien queda con tan pocas opciones que adivinaría quién le tocó?
function drawCheck(ids = S.participants.map(p => p.id)) {
  const nm = id => shortName(P(id)) || '?', plan = drawPlan(ids), msgs = [];
  if (!plan.next) {
    if (plan.zeroOut?.length) msgs.push(['err', `A ${plan.zeroOut.map(nm).join(', ')} no le puede salir nadie.`]);
    if (plan.zeroIn?.length) msgs.push(['err', `${plan.zeroIn.map(nm).join(', ')} no le puede salir a nadie.`]);
    if (plan.fails?.length) msgs.push(['err', `Hay demasiadas restricciones entre ${plan.fails.map(nm).join(', ')} y los demás: no alcanza para que todos tengan a alguien distinto.`]);
    if (!msgs.length) msgs.push(['err', 'Con estas restricciones no hay forma de sortear.']);
  } else {
    if (!plan.cycle) msgs.push(['warn', 'Se puede sortear, pero no en una sola cadena: algunos se regalarán entre ellos en grupitos. Sigue siendo válido.']);
    const tight = ids.filter(x => plan.outs[x].length <= 2 && ids.length > 3);
    if (tight.length) msgs.push(['warn', `Pocas opciones: a ${tight.map(x => `${nm(x)} (${plan.outs[x].length})`).join(', ')} casi le podrían adivinar quién le toca.`]);
  }
  return { ok: !!plan.next, msgs };
}
function renderDrawRules() {
  if (!S.isOwner || !$('#x-list')) return;
  const ppl = [...S.participants].sort((a, b) => a.name.localeCompare(b.name));
  const opts = '<option value="">Elige…</option>' + ppl.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  for (const id of ['#x-a', '#x-b']) { const el = $(id); if (el.dataset.sig !== opts) { const v = el.value; el.innerHTML = opts; el.dataset.sig = opts; el.value = v; } }
  const rules = (S.drawRules || []).filter(r => P(r.a) && P(r.b));
  $('#x-count').textContent = rules.length || '';
  $('#x-list').innerHTML = rules.length ? rules.map((r, i) => `<div class="prow" style="align-items:center"><div style="flex:1;min-width:0">${esc(P(r.a).emoji)} <b>${esc(shortName(P(r.a)))}</b> ${r.both ? '⇄' : '→'} 🚫 ${esc(P(r.b).emoji)} <b>${esc(shortName(P(r.b)))}</b><div class="muted small">${r.both ? 'No se tocan entre ellos' : `A ${esc(shortName(P(r.a)))} no le sale ${esc(shortName(P(r.b)))}`}</div></div><button class="x" data-xdel="${i}" aria-label="Quitar">✕</button></div>`).join('')
    : '<p class="muted small">Sin restricciones: cualquiera le puede salir a cualquiera.</p>';
  const ck = rules.length ? drawCheck() : { ok: true, msgs: [] };
  if (ck.ok && !ck.msgs.length && rules.length) ck.msgs.push(['ok', '✅ Todo bien: el sorteo se puede hacer respetando estas restricciones.']);
  $('#x-list').insertAdjacentHTML('beforeend', ck.msgs.map(([k, m]) => `<div class="xck ${k}">${k === 'err' ? '⛔ ' : k === 'warn' ? '⚠️ ' : ''}${esc(m)}</div>`).join(''));
  $('#d-gen').disabled = !ck.ok; $('#d-gen').title = ck.ok ? '' : 'Arregla las restricciones primero';
}
const saveRules = pairs => setDoc(doc(adb, 'drawRules', 'main'), { pairs, at: serverTimestamp() });
$('#x-form').addEventListener('submit', async e => {
  e.preventDefault();
  const a = $('#x-a').value, b = $('#x-b').value, both = $('#x-both').checked;
  if (!a || !b) return toast('Elige a las dos personas');
  if (a === b) return toast('Elige dos personas distintas');
  const cur = (S.drawRules || []).filter(r => P(r.a) && P(r.b));
  if (cur.some(r => (r.a === a && r.b === b) || (r.both && r.a === b && r.b === a))) return toast('Esa restricción ya existe');
  if (cur.length >= 60) return toast('Máximo 60 restricciones');
  const pairs = [...cur, { a, b, both }];
  const keep = S.drawRules; S.drawRules = pairs; const ck = drawCheck(); S.drawRules = keep;
  if (!ck.ok) return openModal(`<h3>🚫 Esa restricción rompe el sorteo</h3><p class="muted">${esc(ck.msgs.map(m => m[1]).join(' '))}</p><p class="muted small" style="margin-top:8px">No la guardé. Quita otra restricción o pon esta solo en un sentido.</p><div class="actions"><button class="btn gold" data-a="close">Entendido</button></div>`).onclick = e => { if (e.target.closest('[data-a]')) closeModal(); };
  const warn = ck.msgs.filter(m => m[0] === 'warn').map(m => m[1]);
  if (warn.length && !(await confirmBox('⚠️ Ojo con esta restricción', warn.join(' '), 'Guardar igual'))) return;
  try { await saveRules(pairs); $('#x-a').value = $('#x-b').value = ''; toast(S.drawMeta ? '✅ Guardada. Vuelve a sortear para aplicarla' : '✅ Restricción guardada'); } catch (err) { toast(authErr(err)); }
});
$('#x-list').addEventListener('click', async e => {
  const b = e.target.closest('[data-xdel]'); if (!b) return;
  const pairs = (S.drawRules || []).filter(r => P(r.a) && P(r.b)); pairs.splice(+b.dataset.xdel, 1);
  try { await saveRules(pairs); toast('Restricción quitada'); } catch (err) { toast(authErr(err)); }
});
$('#d-gen').addEventListener('click', async () => {
  const ids = S.participants.map(p => p.id);
  if (ids.length < 3) return toast('Necesitas al menos 3 participantes');
  const msg = S.drawMeta ? 'Se borrarán todos los giros y cada quien tendrá que girar de nuevo. Las inscripciones se cerrarán.' : `Se sortearán ${ids.length} personas y se cerrarán las inscripciones.`;
  if (!(await confirmBox(S.drawMeta ? '¿Volver a sortear?' : '¿Generar el sorteo?', msg, 'Sortear'))) return;
  if (ids.length > 450) return toast('Son demasiadas personas para sortear de una vez');
  // Una sola cadena: A→B→C→…→A. Nadie se toca a sí mismo, no hay parejas que se regalen mutuamente
  // y se respetan las restricciones del organizador ("a X no le puede salir Y").
  const next = drawRing(ids);
  if (!next) return toast('🚫 ' + (drawCheck(ids).msgs[0]?.[1] || 'Con estas restricciones no hay forma de sortear.') + ' Revisa las restricciones.');
  const perm = ids.map(x => next[x]);
  try {
    // 1) primero se invalida el sorteo viejo: si algo falla a medias, la app no lo da por bueno
    if (S.drawMeta) { const b0 = writeBatch(adb); b0.delete(doc(adb, 'config', 'draw')); await b0.commit(); }
    // 2) limpieza de giros, pistas y estados anteriores (puede ir en tandas)
    const ops = [];
    for (const c of ['giftStatus', 'giftIncoming', 'hints', 'hintsSent', 'angelGuess', 'reveal', 'thanks', 'wishPick']) (await getDocs(collection(adb, c))).forEach(d => ops.push(['del', d.ref]));
    (await getDocs(collection(adb, 'assignments'))).forEach(d => { if (!ids.includes(d.id)) ops.push(['del', d.ref]); });
    await commitOps(ops);
    // 3) el sorteo nuevo completo en UNA sola escritura: o queda todo o no queda nada
    const b = writeBatch(adb);
    ids.forEach((id, i) => b.set(doc(adb, 'assignments', id), { recipient: perm[i], revealed: false, at: serverTimestamp() }));
    b.set(doc(adb, 'config', 'event'), { registrationOpen: false, angelLocked: false }, { merge: true });
    b.set(doc(adb, 'config', 'draw'), { ids, n: ids.length, at: serverTimestamp() });
    await b.commit(); toast('¡Sorteo generado! 🎉 Ya pueden girar.'); confetti(60);
  } catch (err) { toast(authErr(err) + ' · Vuelve a tocar Sortear'); }
});
async function commitOps(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(adb);
    ops.slice(i, i + 400).forEach(([t, ref, data, merge]) => t === 'set' ? b.set(ref, data, merge ? { merge: true } : undefined) : b.delete(ref));
    await b.commit();
  }
}
const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const PRESETS = {
  biblicos: { title: 'Personajes bíblicos', emoji: '📖', kind: 'assign', secret: true,
    items: 'Moisés\nNoé\nAbraham\nSara\nDavid\nGoliat\nEster\nRut\nDaniel\nJonás\nSansón\nDalila\nJosé (el de los sueños)\nMaría\nPedro\nPablo\nJuan el Bautista\nElías\nSalomón\nDébora\nGedeón\nJacob\nRebeca\nLázaro\nZaqueo\nMarta\nRaquel\nJosué\nNoemí\nTomás',
    desc: 'Cada quien recibe un personaje bíblico en secreto. Ven vestido o con un detalle de tu personaje y los demás tendrán que adivinar quién eres. ¡No le digas a nadie lo que te tocó!' },
  vestido: { title: 'Mejor vestido navideño', emoji: '👗', kind: 'vote', voteTarget: 'participants', desc: 'Vota por la persona que venga mejor vestida. El ganador se anuncia en la fiesta y se lleva un premio sorpresa.' },
  karaoke: { title: 'Karaoke de villancicos', emoji: '🎤', kind: 'assign', secret: false, items: 'Noche de paz\nCampana sobre campana\nLos peces en el río\nEl burrito sabanero\nFeliz Navidad\nAsómate a la ventana\nArbolito\nNiño Jesús\nLa marimorena\nBlanca Navidad', desc: 'A cada quien le toca un villancico para cantar. ¡Ensaya en la ducha!' },
  trivia: { title: 'Trivia navideña', emoji: '❓', kind: 'quiz', items: "¿Cuál es la capital de República Dominicana? | Santiago | *Santo Domingo | La Romana | Puerto Plata\n¿Cómo se llama la montaña más alta del Caribe? | Loma Quita Espuela | *Pico Duarte | Monte Cristi | Loma de la Galleta\n\"La bandera\" dominicana es arroz, habichuelas y carne | *Verdadero | Falso\nLas habichuelas con dulce se comen en Navidad | Verdadero | *Falso\n¿Qué día se celebra la Independencia dominicana? | 6 de enero | 16 de agosto | *27 de febrero | 24 de diciembre\nEl merengue es el baile nacional de República Dominicana | *Verdadero | Falso\n¿Qué se come típicamente en la Nochebuena dominicana? | Sushi | *Puerco asado | Pizza | Hot dog\n¿Qué bebida caliente es típica en Navidad en RD? | *Té de jengibre | Café frío | Limonada | Morir soñando\nLa playa de Bávaro queda en Punta Cana | *Verdadero | Falso\nEl Faro a Colón está en Santo Domingo | *Verdadero | Falso\n¿En qué ciudad está el Monumento a los Héroes de la Restauración? | Higüey | *Santiago | Barahona | Baní\n¿En qué ciudad nació Jesús? | Nazaret | Jerusalén | *Belén | Egipto\n¿Cuántos Reyes Magos dice la tradición que llegaron? | 2 | *3 | 4 | 12\n¿Qué día se celebra el Día de Reyes? | 25 de diciembre | 1 de enero | *6 de enero | 14 de febrero\n¿Quién fue el primer hombre según la Biblia? | Noé | Moisés | *Adán | Abraham\n¿Cuál es el primer libro de la Biblia? | Éxodo | *Génesis | Mateo | Apocalipsis\n¿Cuál fue el primer milagro de Jesús? | Caminar sobre el agua | *Convertir agua en vino | Multiplicar los panes | Calmar la tormenta\n¿Quién construyó el arca? | Moisés | *Noé | David | Jonás\n¿Quién venció al gigante Goliat? | Sansón | Salomón | *David | Pedro\n¿Quién abrió el Mar Rojo? | Elías | *Moisés | Josué | Pablo\nSanta Claus vive en el Polo Sur | Verdadero | *Falso\n¿Cómo se llama el reno de la nariz roja? | Bambi | *Rudolph | Pancho | Rayo\n¿Cuál es el primer mes del año? | Diciembre | *Enero | Febrero | Marzo\nEl sol es una estrella | *Verdadero | Falso\n¿De qué color era el caballo blanco de Napoleón? | Negro | Marrón | *Blanco | Gris\n¿Cuántos meses del año tienen 28 días? | Solo febrero | 2 | 6 | *Todos\n¿Qué pesa más: un kilo de algodón o un kilo de hierro? | El hierro | El algodón | *Pesan lo mismo\n¿Cuántas patas tiene un gallo? | *2 | 4 | 3 | 6\nSi estás en una carrera y pasas al segundo, ¿en qué lugar quedas? | Primero | *Segundo | Tercero | Último\n¿Qué tiene dientes pero no come? | Un perro | *Un peine | Un bebé | Una silla",
    desc: 'Preguntas fáciles (y algunas con truco 😄) sobre RD, la Navidad y la Biblia. Responde desde tu teléfono; el organizador publica el ranking en la fiesta.' },
  regalo: { title: 'Mejor regalo de la noche', emoji: '🏆', kind: 'vote', voteTarget: 'participants', desc: 'Después del intercambio, vota por quien dio el regalo más creativo.' }
};
const aForm = $('#a-form');
function updKind() {
  const k = aForm.kind.value, vt = aForm.voteTarget.value;
  $('#a-vt-f').style.display = k === 'vote' ? '' : 'none';
  $('#a-items-f').style.display = (k === 'assign' || k === 'signup' || k === 'quiz' || (k === 'vote' && vt === 'options')) ? '' : 'none';
  $('#a-quiz-h').style.display = k === 'quiz' ? '' : 'none';
  aForm.items.style.minHeight = k === 'quiz' ? '220px' : '';
  $('#a-secret-f').style.display = k === 'assign' ? '' : 'none';
  $('#a-items-l').textContent = k === 'quiz' ? 'Preguntas (una por línea)' : k === 'assign' ? 'Lo que se va a repartir (uno por línea)' : k === 'signup' ? 'Cosas para apuntarse (una por línea)' : 'Opciones de la votación (una por línea)';
}
aForm.kind.addEventListener('change', updKind); aForm.voteTarget.addEventListener('change', updKind);
function fillActForm(a, editing) {
  aForm.reset();
  for (const k of ['title', 'date', 'time', 'place', 'host', 'dress', 'bring', 'desc']) aForm[k].value = a[k] || '';
  { const d = a.openAt ? new Date(a.openAt) : null; aForm.openDate.value = d ? d.toLocaleDateString('en-CA') : ''; aForm.openTime.value = d ? d.toTimeString().slice(0, 5) : ''; }
  if (a.emoji) aForm.emoji.value = a.emoji;
  aForm.kind.value = a.kind || 'none'; aForm.voteTarget.value = a.voteTarget || 'participants';
  aForm.items.value = a.kind === 'quiz' && a.qs ? triviaText((a.qs || []).map(q => ({ ...q, c: -1 }))) : Array.isArray(a.items) ? a.items.join('\n') : (a.items || '');
  if (a.kind === 'quiz' && editing && a.id) getDoc(doc(adb, 'quizKeys', a.id)).then(d => { const c = d.data()?.c || []; if (aForm.id.value === a.id) aForm.items.value = triviaText((a.qs || []).map((q, i) => ({ ...q, c: c[i] ?? -1 }))); }).catch(() => { });
  aForm.secret.checked = a.secret !== false;
  aForm.id.value = editing ? a.id : '';
  $('#a-submit').textContent = editing ? 'Guardar cambios' : 'Agregar actividad';
  $('#a-cancel').style.display = editing ? '' : 'none';
  if (editing || a.title) $('#a-fold').open = true;
  updKind(); if ($('#a-fold').open) aForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$('#a-presets').addEventListener('click', e => {
  const b = e.target.closest('[data-preset]'); if (!b) return;
  const p = PRESETS[b.dataset.preset]; fillActForm({ ...p, date: (S.event.eventDate || '').slice(0, 10) }, false);
  toast('Plantilla cargada: revisa y guarda ✨');
});
$('#a-cancel').addEventListener('click', () => { fillActForm({}, false); });
aForm.addEventListener('submit', async e => {
  e.preventDefault(); const f = aForm, id = f.id.value;
  const o = { title: f.title.value.trim(), emoji: f.emoji.value, date: f.date.value, time: f.time.value, place: f.place.value.trim(), host: f.host.value.trim(),
    dress: f.dress.value.trim(), bring: f.bring.value.trim(), desc: f.desc.value.trim(), kind: f.kind.value, voteTarget: f.voteTarget.value,
    items: f.items.value.split('\n').map(x => x.trim().slice(0, 100)).filter(Boolean).slice(0, 80), secret: f.secret.checked,
    openAt: f.openDate.value ? new Date(f.openDate.value + 'T' + (f.openTime.value || '00:00')).getTime() : null };
  if (!o.title || !o.date) return;
  if (o.openAt != null && isNaN(o.openAt)) return toast('La hora de apertura no es válida');
  if (o.kind === 'assign' && !o.items.length) return toast('Escribe lo que se va a repartir');
  let quizKey = null;
  if (o.kind === 'quiz') {
    const list = parseTrivia(f.items.value).slice(0, 60).map(t => ({ q: t.q.slice(0, 200), o: t.o.map(x => x.slice(0, 80)), c: t.c }));
    if (!list.length) return toast('Escribe al menos una pregunta: Pregunta | opción | *correcta');
    o.qs = list.map(({ q, o: op }) => ({ q, o: op })); quizKey = list.map(t => t.c); o.items = [];
  }
  if ((o.kind === 'signup' || (o.kind === 'vote' && o.voteTarget === 'options')) && !o.items.length) return toast('Escribe al menos una opción');
  try {
    if (id) {
      const old = S.activities.find(a => a.id === id);
      // "Apúntate": cada quien está anotado por el número de la opción; si una opción cambia o se quita, esa persona queda libre
      const su = old?.kind === 'signup' ? S.signups.filter(x => x.act === id && (o.kind !== 'signup' || (old.items || [])[x.idx] !== o.items[x.idx])) : [];
      if (su.length && !(await confirmBox('Cambiaste opciones con gente anotada', `${su.length === 1 ? '1 persona quedará' : su.length + ' personas quedarán'} sin anotar en lo que cambió, para que nadie aparezca llevando otra cosa.`, 'Guardar'))) return;
      const b = writeBatch(adb);
      su.forEach(x => b.delete(doc(adb, 'activitySignups', x.id)));
      b.set(doc(adb, 'activities', id), o, { merge: true });
      if (quizKey) b.set(doc(adb, 'quizKeys', id), { c: quizKey });
      if (old?.kind === 'assign' && old.secret !== o.secret)
        (await getDocs(query(collection(adb, 'activityPicks'), where('act', '==', id)))).forEach(d => b.set(d.ref, { public: !o.secret }, { merge: true }));
      await b.commit(); toast('Actividad actualizada ✏️');
    } else {
      S.selfEditAt = Date.now(); const ref = doc(collection(adb, 'activities'));
      if (quizKey) await setDoc(doc(adb, 'quizKeys', ref.id), { c: quizKey });
      await setDoc(ref, { ...o, at: serverTimestamp() }); toast('Actividad agregada 📅');
    }
    fillActForm({}, false); $('#a-fold').open = false;
    setTimeout(() => $('#a-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  } catch (err) { toast(authErr(err)); }
});
async function assignAct(a) {
  const items = (a.items || []).filter(Boolean); if (!items.length) return toast('Esta actividad no tiene opciones para repartir');
  const ppl = shuffle(S.participants.map(p => p.id)); if (!ppl.length) return toast('No hay participantes todavía');
  const msg = a.assignedAt ? 'A cada persona le tocará algo nuevo.' : `Se repartirá entre ${ppl.length} personas${items.length < ppl.length ? ' (algunas opciones se repetirán porque hay más personas que opciones)' : ''}.`;
  if (!(await confirmBox(a.assignedAt ? '¿Repartir de nuevo?' : '¿Repartir ahora?', msg, 'Repartir'))) return;
  let pool = []; while (pool.length < ppl.length) pool = pool.concat(shuffle([...items]));
  try {
    const b = writeBatch(adb);
    (await getDocs(query(collection(adb, 'activityPicks'), where('act', '==', a.id)))).forEach(d => { if (!ppl.includes(d.data().uid)) b.delete(d.ref); });
    ppl.forEach((uid, i) => b.set(doc(adb, 'activityPicks', `${esc(a.id)}__${uid}`), { act: a.id, uid, item: pool[i], public: a.secret === false, at: serverTimestamp() }));
    b.set(doc(adb, 'activities', a.id), { assignedAt: serverTimestamp(), assignedN: ppl.length }, { merge: true });
    await b.commit(); toast('¡Repartido! 🎲 Cada quien ya puede ver lo suyo'); confetti(60);
  } catch (err) { toast(authErr(err)); }
}
async function toggleResults(a) {
  try {
    if (a.resultsOpen) { await setDoc(doc(adb, 'activities', a.id), { resultsOpen: false, key: [] }, { merge: true }); return toast('Resultados ocultos'); }
    if (a.kind === 'quiz') {
      const key = (await getDoc(doc(adb, 'quizKeys', a.id))).data()?.c || [];
      const ans = S.adminQuiz.filter(x => x.act === a.id && P(x.uid));
      const results = ans.map(x => ({ key: x.uid, label: pName(x.uid), emoji: pEmoji(x.uid), count: (x.a || []).filter((v, i) => v === key[i]).length, t: ms(x.at) }))
        .sort((x, y) => y.count - x.count || x.t - y.t).map(({ t, ...r }) => r);
      if (!(await confirmBox('¿Publicar resultados?', `${ans.length} ${ans.length === 1 ? 'persona respondió' : 'personas respondieron'}. Todos verán el ranking y las respuestas correctas, y ya no se podrá responder.`, 'Publicar'))) return;
      await setDoc(doc(adb, 'activities', a.id), { resultsOpen: true, results, key, votesN: ans.length }, { merge: true }); toast('Resultados publicados 🏆'); confetti(80); return;
    }
    const vs = S.adminVotes.filter(v => v.act === a.id);
    const opts = a.voteTarget === 'participants' ? S.participants.map(p => ({ key: p.id, label: p.name, emoji: p.emoji })) : (a.items || []).map(t => ({ key: t, label: t, emoji: '' }));
    const results = opts.map(o => ({ ...o, count: vs.filter(v => v.choice === o.key).length })).filter(r => r.count || a.voteTarget !== 'participants').sort((x, y) => y.count - x.count);
    if (!(await confirmBox('¿Publicar resultados?', `Hay ${vs.length} votos. Todos verán los resultados y ya no se podrá votar.`, 'Publicar'))) return;
    await setDoc(doc(adb, 'activities', a.id), { resultsOpen: true, results, votesN: vs.length }, { merge: true }); toast('Resultados publicados 🏆'); confetti(80);
  } catch (err) { toast(authErr(err)); }
}
$('#a-list').addEventListener('click', async e => {
  const t = e.target.closest('[data-act],[data-aedit],[data-assign],[data-results]'); if (!t) return;
  const a = S.activities.find(x => x.id === (t.dataset.act || t.dataset.aedit || t.dataset.assign || t.dataset.results)); if (!a) return;
  if (t.dataset.aedit) return fillActForm(a, true);
  if (t.dataset.assign) return assignAct(a);
  if (t.dataset.results) return toggleResults(a);
  if (!(await confirmBox('¿Borrar esta actividad?', 'Se borrará con sus asignaciones, votos y confirmaciones.', 'Borrar'))) return;
  try {
    const b = writeBatch(adb); b.delete(doc(adb, 'activities', a.id));
    for (const c of ['activityPicks', 'rsvps', 'votes', 'activitySignups', 'quizAns'])
      (await getDocs(query(collection(adb, c), where('act', '==', a.id)))).forEach(d => b.delete(d.ref));
    if (a.kind === 'quiz') b.delete(doc(adb, 'quizKeys', a.id));
    await b.commit(); toast('Actividad borrada');
  } catch (err) { toast(authErr(err)); }
});
updKind();

$('#q-clear').addEventListener('click', async () => {
  if (!(await confirmBox('¿Borrar todos los anónimos?', 'Se eliminarán todos los mensajes. No se puede deshacer.', 'Borrar todo'))) return;
  try {
    const docs = [...(await getDocs(collection(adb, 'questions'))).docs, ...(await getDocs(collection(adb, 'questionAuthors'))).docs];
    for (let i = 0; i < docs.length; i += 400) { const b = writeBatch(adb); docs.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit(); }
    await setDoc(doc(adb, 'stats', 'questions'), { count: 0 }); $('#q-adm').innerHTML = ''; toast('Buzón vaciado');
  } catch (err) { toast(authErr(err)); }
});

async function loadAdminQuestions() {
  const box = $('#q-adm'); box.innerHTML = '<p class="muted small"><span class="spin-dots"></span> Cargando…</p>';
  try {
    const [qs, as] = await Promise.all([getDocs(collection(adb, 'questions')), getDocs(collection(adb, 'questionAuthors'))]);
    const authors = Object.fromEntries(as.docs.map(d => [d.id, d.data().uid]));
    const list = qs.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(a.at) - ms(b.at));
    box.innerHTML = list.length ? `<p class="muted small">🤫 Solo tú ves esto. Los participantes nunca ven el autor.</p>` + list.map(q => `
      <div class="item"><span style="font-size:22px">${esc(authors[q.id] ? pEmoji(authors[q.id]) : '❔')}</span><div class="grow">
        <div class="muted small"><b style="color:var(--gold)">De: ${esc(authors[q.id] ? pName(authors[q.id]) : 'Desconocido')}</b> → ${q.to ? esc(pName(q.to)) : 'Todos'}</div>
        <div class="t" style="margin-top:4px">${esc(q.text)}</div></div>
        <button class="x" data-qdel="${esc(q.id)}" aria-label="Borrar">✕</button></div>`).join('')
      : '<p class="muted small">El buzón está vacío.</p>';
  } catch (err) { box.innerHTML = ''; toast(authErr(err)); }
}
$('#q-view').addEventListener('click', loadAdminQuestions);
$('#q-adm').addEventListener('click', async e => {
  const b = e.target.closest('[data-qdel]'); if (!b) return;
  if (!(await confirmBox('¿Borrar este mensaje?', 'No se puede deshacer.', 'Borrar'))) return;
  try {
    const w = writeBatch(adb); w.delete(doc(adb, 'questions', b.dataset.qdel)); w.delete(doc(adb, 'questionAuthors', b.dataset.qdel));
    w.set(doc(adb, 'stats', 'questions'), { count: increment(-1) }, { merge: true });
    await w.commit(); loadAdminQuestions();
  } catch (err) { toast(authErr(err)); }
});

/* ---------- actividades ---------- */
const KIND = { assign: ['🎭', 'Asignación'], vote: ['🗳️', 'Votación'], signup: ['📝', 'Apúntate'], quiz: ['❓', 'Trivia'] };
function kindTag(a) {
  const k = KIND[a.kind]; const mine = a.kind === 'assign' && S.myPicks.some(p => p.act === a.id);
  const t = [k ? `<span class="tag">${k[0]} ${k[1]}</span>` : '', mine ? '<span class="tag gold">✨ Te tocó algo</span>' : '',
    (a.kind === 'vote' || a.kind === 'quiz') && a.resultsOpen ? '<span class="tag gold">🏆 Resultados</span>' : ''].join('');
  return t ? `<div class="tags">${t}</div>` : '';
}
const actWhen = a => `${fmtDate(a.date)}${a.time ? ' · ' + fmtTime(a.time) : ''}`;
function renderActs() {
  // El buzón anónimo es una actividad más (siempre primera en la lista).
  let anon = '';
  if (mod('anonimos')) {
    const open = isRevealed(), rd = revealDay(), n = S.qCount || 0;
    const when = open ? '¡Ya está abierto!' : rd ? 'Se abre el ' + revealWhen() : 'Se abre el día del intercambio';
    anon = `<a class="actcard card anoncard" href="#anonimos"><div class="em">💌</div>
      <div style="flex:1;min-width:0"><div class="when">${esc(when)}</div><h3>Buzón anónimo</h3><span class="badge">${open ? (n === 1 ? '👀 Leer el mensaje' : '👀 Leer los ' + n + ' mensajes') : '✍️ Escribe sin que sepan quién · ' + n + ' guardados'}</span></div>
      <span class="chev">›</span></a>`;
  }
  $('#acts-root').innerHTML = S.activities.length ? `<div class="stack">${anon}${S.activities.map(a => `
    <a class="actcard card" href="#actividad-${esc(a.id)}"><div class="em">${esc(a.emoji || '🎁')}</div>
      <div style="flex:1;min-width:0"><div class="when">${esc(actWhen(a))}</div><h3>${esc(a.title)}</h3>${a.openAt && Date.now() < a.openAt ? `<span class="badge">🔒 Se abre el ${esc(openWhen(a))}</span>` : kindTag(a)}</div>
      <span class="chev">›</span></a>`).join('')}</div>`
    : `${anon ? `<div class="stack" style="margin-bottom:12px">${anon}</div>` : ''}<div class="card plancard"><div class="pl-top"><span class="pl-ic">${ic('calendar', 26)}</span><div class="grow"><b>Aquí estará el plan del día</b><p class="small">Cena, juegos, dinámicas e intercambio. Te avisamos cuando el organizador lo publique.</p></div></div>${S.event.eventDate && new Date(S.event.eventDate) > new Date() ? (() => { const d = Math.ceil((new Date(S.event.eventDate) - new Date()) / 864e5); return `<div class="pl-cd"><b>${d}</b><span>${d === 1 ? 'día' : 'días'} para el angelito</span></div>`; })() : ''}
      <div class="qa" style="justify-content:center;margin-top:12px">${mod('juegos') ? '<a class="btn sm gold" href="#juegos">Mientras tanto, a jugar</a>' : ''}${mod('deseos') ? `<a class="btn sm btn-ic" href="#deseos">${ic('gift', 16)} Mi lista de deseos</a>` : ''}</div></div>`;
}
function voteOptions(a) {
  return a.voteTarget === 'participants'
    ? S.participants.filter(p => p.id !== S.uid).map(p => ({ key: p.id, label: p.name, emoji: p.emoji }))
    : (a.items || []).map(t => ({ key: t, label: t, emoji: '' }));
}
const openWhen = a => { const d = new Date(a.openAt); return fmtDate(d.toLocaleDateString('en-CA')) + ' a las ' + hm(d); };
const leftTo = t => { const m = Math.max(1, Math.round((t - Date.now()) / 6e4)); return m < 60 ? `Faltan ${m} min` : m < 1440 ? `Faltan ${Math.round(m / 60)} h` : `Faltan ${Math.ceil(m / 1440)} días`; };
/* ---------- ❓ trivia como actividad ---------- */
function quizHTML(a) {
  const qs = a.qs || [], my = S.myQuiz[a.id], N = qs.length;
  let h = `<div class="h2row"><h2>❓ ${a.resultsOpen ? 'Resultados' : 'Trivia'}</h2><span class="muted small">${N} preguntas</span></div>`;
  if (a.resultsOpen && a.results) {
    const key = a.key || [], max = Math.max(1, N);
    h += `<div class="stack">${a.results.slice(0, 15).map((r, i) => `<div class="bar ${i === 0 && r.count ? 'win' : ''}"><i style="width:${(Number(r.count) || 0) / max * 100}%"></i><span>${['🥇', '🥈', '🥉'][i] || i + 1 + '.'} ${esc(r.emoji || '')} ${esc(r.label)}</span><span>${Number(r.count) || 0}/${N}</span></div>`).join('') || '<div class="card empty">Nadie respondió 😅</div>'}</div>`;
    if (S.me) h += `<div class="h2row"><h2>Las respuestas</h2>${my ? `<span class="tag gold">Acertaste ${my.filter((v, i) => v === key[i]).length}/${N}</span>` : ''}</div>
      <div class="stack">${qs.map((q, i) => { const ok = my && my[i] === key[i]; return `<div class="qrev ${my ? (ok ? 'ok' : 'no') : ''}"><div class="qr-n">${i + 1}</div><div class="grow"><b>${esc(q.q)}</b>
        <div class="small">✅ ${esc(q.o[key[i]] ?? '—')}${my && !ok ? `<br><span class="muted">Tú: ${esc(q.o[my[i]] ?? 'sin responder')}</span>` : ''}</div></div></div>`; }).join('')}</div>`;
    return h;
  }
  if (!S.me) return h + needLogin('Entra con tu PIN para jugar la trivia.');
  if (my) return h + `<div class="card qdone"><div class="qd-e">🎉</div><b>¡Listo! Respondiste las ${N} preguntas</b><p class="muted small">Los resultados y las respuestas correctas se publican cuando el organizador lo decida. ¡Suerte!</p></div>`;
  if (!N) return h + '<div class="card empty">Todavía no hay preguntas.</div>';
  const st = S.quizPlay[a.id];
  if (!st) return h + `<div class="card qstart"><div class="qd-e">🧠</div><b>${N} preguntas fáciles (o eso creemos 😅)</b><p class="muted small">Elige una respuesta en cada una. Al terminar se envían y ya no se pueden cambiar.</p><button class="btn gold" data-qstart>¡Empezar!</button></div>`;
  const i = st.i, q = qs[i];
  return h + `<div class="qcard" style="--p:${i / N * 100}%"><div class="qc-top"><span>Pregunta ${i + 1} de ${N}</span>${i ? '<button class="btn sm ghost" data-qback>‹ Atrás</button>' : ''}</div><div class="qc-bar"><i></i></div>
    <div class="qc-q">${esc(q.q)}</div><div class="qc-o">${q.o.map((o, k) => `<button class="qopt c${k + 1} ${st.a[i] === k ? 'on' : ''}" data-qa="${k}"><b>${'ABCD'[k]}</b><span>${esc(o)}</span></button>`).join('')}</div></div>`;
}
async function quizClick(a, b) {
  const N = (a.qs || []).length;
  if (b.dataset.qstart != null) { S.quizPlay[a.id] = { i: 0, a: [] }; return renderActDetail(); }
  const st = S.quizPlay[a.id]; if (!st) return;
  if (b.dataset.qback != null) { st.i = Math.max(0, st.i - 1); return renderActDetail(); }
  st.a[st.i] = +b.dataset.qa; b.classList.add('on');
  if (st.i < N - 1) { setTimeout(() => { st.i++; renderActDetail(); }, 220); return; }
  try {
    await setDoc(doc(db, 'quizAns', `${esc(a.id)}__${esc(S.uid)}`), { act: a.id, uid: S.uid, a: Array.from({ length: N }, (_, k) => st.a[k] ?? -1), at: serverTimestamp() });
    delete S.quizPlay[a.id]; confetti(90); toast('¡Respuestas enviadas! 🎉');
  } catch (err) { toast(err?.code?.includes('permission') ? 'La trivia ya cerró.' : authErr(err)); }
}
function renderActDetail() {
  const root = $('#act-root'); if (!root || !S.actId) return;
  const a = S.activities.find(x => x.id === S.actId);
  if (!a) { root.innerHTML = `<a class="back" href="#actividades">‹ Actividades</a><div class="card empty"><span class="e">🔎</span>Esta actividad no existe o fue borrada.</div>`; return; }
  const k = KIND[a.kind];
  const info = [['🕒', 'Cuándo', actWhen(a)], ['📍', 'Lugar', a.place], ['🙋', 'Responsable', a.host], ['👗', 'Vestimenta', a.dress], ['🧺', 'Qué traer', a.bring]].filter(x => x[2]);
  let h = `<a class="back" href="#actividades">‹ Actividades</a>
    <div class="hero act-hero"><div class="eyebrow">${k ? k[0] + ' ' + k[1] : 'Actividad'}</div><div class="bigem">${esc(a.emoji || '🎁')}</div><h1>${esc(a.title)}</h1><div class="when">${esc(actWhen(a))}</div></div>
    <div class="info">${info.map(([i, l, v]) => `<div class="card"><div class="k">${i} ${l}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>
    ${a.desc ? `<div class="card notes">${esc(a.desc)}</div>` : ''}`;

  // hasta la hora de apertura se ve la información, pero no se puede votar, apuntarse ni ver lo asignado
  if (a.openAt && Date.now() < a.openAt && !S.isAdmin) {
    root.innerHTML = h + `<div class="card vault"><span class="lock">🔒</span><p style="margin-top:6px">Se abre el <b>${esc(openWhen(a))}</b></p><span class="badge" style="margin-top:10px">⏳ ${esc(leftTo(a.openAt))}</span></div>`;
    clearTimeout(renderActDetail.t); renderActDetail.t = setTimeout(render, Math.min(a.openAt - Date.now() + 500, 60000)); return;
  }

  if (a.openAt && Date.now() < a.openAt) h += `<div class="banner" style="margin:10px 0">🔒 Los participantes la verán abierta el ${esc(openWhen(a))}</div>`;
  // dinámica
  if (a.kind === 'assign') {
    const mine = S.myPicks.find(p => p.act === a.id);
    h += `<div class="h2row"><h2>🎭 ${a.secret ? 'Lo que te tocó' : 'Asignaciones'}</h2></div>`;
    if (!S.me) h += needLogin('Entra con tu PIN para ver lo que te tocó.');
    else if (!a.assignedAt) h += `<div class="card empty"><span class="e">⏳</span>El organizador todavía no ha repartido. ¡Vuelve pronto!</div>`;
    else if (!mine) h += `<div class="card empty"><span class="e">🤷</span>No te tocó nada en este reparto. Quizás te registraste después; avísale al organizador.</div>`;
    else h += `<button class="pickcard ${S.revealed[a.id] ? 'open' : ''}" data-reveal="${esc(a.id)}"><div class="muted small">${esc(S.me.first)}, te tocó…</div><div class="reveal-name">${esc(mine.item)}</div><div class="hint">👆 Toca para ${S.revealed[a.id] ? 'ocultar' : 'revelar'}</div></button>`;
    if (S.me && a.assignedAt && a.secret) h += `<p class="muted small center" style="margin-top:10px">🤫 Es secreto: los demás no ven lo que te tocó.</p>`;
    if (S.me && a.assignedAt && !a.secret) {
      const pub = S.publicPicks.filter(p => p.act === a.id && P(p.uid)).sort((x, y) => pName(x.uid).localeCompare(pName(y.uid)));
      h += `<div class="stack" style="margin-top:12px">${pub.map(p => `<div class="item" style="align-items:center"><span style="font-size:20px">${esc(pEmoji(p.uid))}</span><div class="grow t">${esc(pName(p.uid))}</div><b style="color:var(--gold);text-align:right">${esc(p.item)}</b></div>`).join('')}</div>`;
    }
  } else if (a.kind === 'vote') {
    h += `<div class="h2row"><h2>🗳️ ${a.resultsOpen ? 'Resultados' : 'Vota'}</h2></div>`;
    if (a.resultsOpen && a.results) {
      const max = Math.max(1, ...a.results.map(r => Number(r.count) || 0)), tot = a.results.reduce((t, r) => t + (Number(r.count) || 0), 0);
      h += `<div class="stack">${a.results.map((r, i) => `<div class="bar ${i === 0 && r.count ? 'win' : ''}"><i style="width:${(Number(r.count) || 0) / max * 100}%"></i><span>${i === 0 && r.count ? '🏆 ' : ''}${esc(r.emoji || '')} ${esc(r.label)}</span><span>${Number(r.count) || 0}</span></div>`).join('')}</div>
        <p class="muted small center" style="margin-top:10px">${tot} ${tot === 1 ? 'voto' : 'votos'} en total</p>`;
    } else if (!S.me) h += needLogin('Entra con tu PIN para votar.');
    else {
      const opts = voteOptions(a), my = S.myVotes[a.id];
      h += opts.length ? `<div class="stack"${opts.length > 8 ? ' style="max-height:55vh;overflow:auto;padding-right:2px"' : ''}>${opts.map((o, i) => `<button class="opt ${my === o.key ? 'on' : ''}" data-vote="${i}"><span class="radio"></span>${o.emoji ? esc(o.emoji) + ' ' : ''}${esc(o.label)}</button>`).join('')}</div>
        <p class="muted small center" style="margin-top:10px">${my ? '✅ Ya votaste. Puedes cambiar tu voto' : 'Los demás participantes no ven tu voto. Puedes cambiarlo'} hasta que el organizador publique los resultados.</p>`
        : `<div class="card empty"><span class="e">🗳️</span>Todavía no hay opciones para votar.</div>`;
    }
  } else if (a.kind === 'quiz') h += quizHTML(a);
  else if (a.kind === 'signup') {
    const items = a.items || [], su = S.signups.filter(x => x.act === a.id);
    h += `<div class="h2row"><h2>📝 Apúntate</h2><span class="muted small">${su.length}/${items.length}</span></div>`;
    if (!S.me) h += needLogin('Entra con tu PIN para apuntarte.');
    else h += `<div class="stack">${items.map((t, i) => {
      const c = su.find(x => x.idx === i), mine = c && c.uid === S.uid;
      return `<div class="slot ${c ? 'taken' : ''}"><span style="font-size:20px">${c ? esc(pEmoji(c.uid)) : '⬜'}</span><div class="grow">${esc(t)}${c ? `<div class="who">${mine ? 'Lo llevas tú' : esc(pName(c.uid))}</div>` : ''}</div>
        ${!c ? `<button class="btn sm gold" data-sign="${i}">Me apunto</button>` : mine ? `<button class="btn sm" data-unsign="${i}">Soltar</button>` : '<span class="tag">✓</span>'}</div>`;
    }).join('')}</div>`;
  }

  root.innerHTML = h;
}
$('#act-root').addEventListener('click', async e => {
  const a = S.activities.find(x => x.id === S.actId); if (!a) return;
  const qb = e.target.closest('[data-qa],[data-qstart],[data-qback]');
  if (qb) return quizClick(a, qb);
  const t = e.target.closest('[data-reveal],[data-vote],[data-sign],[data-unsign]'); if (!t) return;
  try {
    if (t.dataset.reveal) { S.revealed[a.id] = !S.revealed[a.id]; if (S.revealed[a.id]) confetti(70); renderActDetail(); }
    else if (t.dataset.vote) {
      const o = voteOptions(a)[+t.dataset.vote]; if (!o) return;
      await setDoc(doc(db, 'votes', `${esc(a.id)}__${esc(S.uid)}`), { act: a.id, uid: S.uid, choice: o.key, at: serverTimestamp() }); toast('Voto guardado 🗳️');
    } else if (t.dataset.sign) {
      const i = +t.dataset.sign; if (S.signups.some(x => x.act === a.id && x.idx === i)) return toast('Alguien ya lo tomó');
      await setDoc(doc(db, 'activitySignups', `${esc(a.id)}__${i}`), { act: a.id, idx: i, uid: S.uid, at: serverTimestamp() }); toast('¡Apuntado! 🙌');
    } else if (t.dataset.unsign) {
      const w = writeBatch(db); w.delete(doc(db, 'activitySignups', `${esc(a.id)}__${t.dataset.unsign}`)); await w.commit();
    }
  } catch (err) { toast(err?.code?.includes('permission') ? 'Alguien se te adelantó o ya no se puede cambiar.' : authErr(err)); }
});

/* ---------- app instalable + notificaciones ---------- */
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const canNotify = () => 'Notification' in window;
let installEvt = null, swReg = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; render(); });
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
    try {
      const reg = swReg || await navigator.serviceWorker?.getRegistration();
      if (reg) return stackNotify(reg, title, body, url);
      return new Notification(title, { body, icon: 'icons/icon-192.png', tag: 'angelito', renotify: true });
    } catch { }
  }
  toast(body ? `${title} · ${body}` : title);
}
let pushDone = false, pushToken = '';
// Un registro por teléfono (puedes tener la app en varios): guarda qué avisos NO quieres para que el servidor tampoco los mande.
const tokenId = t => { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) | 0; return `${S.uid}_${(h >>> 0).toString(36)}`; };
async function syncPushPrefs() {
  if (!pushToken || !S.uid) return;
  const o = nprefs(), off = Object.keys(NCAT).filter(k => o[k] === false);
  try {
    await setDoc(doc(db, 'fcmTokens', tokenId(pushToken)), { uid: S.uid, token: pushToken, off, at: serverTimestamp() });
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
  const newMsgs = added('chatIds').map(id => S.chat.find(m => m.id === id)).filter(m => m && m.uid !== S.uid);
  const viewingChat = !document.hidden && $('#v-buzon').classList.contains('on') && S.buz === 'c';
  const tagged = newMsgs.filter(m => (m.mentions || []).includes(S.uid) || (m.mentions || []).includes('all'));
  if (tagged.length && !viewingChat) { const m = tagged[tagged.length - 1]; notifyCat('mencion', `📣 ${shortName(P(m.uid)) || 'Alguien'} te mencionó`, m.text.slice(0, 120), './#chat'); if (navigator.vibrate) try { navigator.vibrate([60, 40, 60]); } catch { } }
  else if (newMsgs.length && !viewingChat) { const m = newMsgs[newMsgs.length - 1]; notifyCat('chat', `💬 ${shortName(P(m.uid)) || 'Chat'}`, m.text.slice(0, 120), './#chat', () => `💬 ${chatUnread()} mensajes nuevos en el chat`); }
  const newSugs = added('sugs').filter(id => !S.myCreated.has(id) && S.suggestions.find(x => x.id === id)?.uid !== S.uid);
  if (newSugs.length) { const x = S.suggestions.find(y => y.id === newSugs[newSugs.length - 1]); notifyCat('sugerencias', '💡 Nueva sugerencia', (x?.text || '').slice(0, 120) + ' · ¡Vota 👍!', './#sugerencias', n => `💡 ${n} sugerencias nuevas para votar`); }
  if (now.rec && now.rec === was.rec) { const nw = added('recWishes'); if (nw.length) { const w = S.wishes.find(x => x.id === nw[nw.length - 1]); notifyCat('deseos', '🎁 Tu persona agregó un deseo nuevo', 'Entra a verlo 👀', './#deseos', n => `🎁 Tu persona agregó ${n} deseos nuevos`); } }
  if (!mine && was.ev !== now.ev && was.ev !== '||') notifyCat('evento', '🎄 Cambió la información del evento', `${fmtDate(S.event.eventDate) || ''}${S.event.place ? ' · 📍 ' + S.event.place : ''}`, './');
  if (!mine && was.rules !== now.rules && was.rules !== '[]') notifyCat('evento', '📜 Se actualizaron las reglas del angelito', 'Échales un vistazo en Inicio.', './');
  added('notices').map(id => S.notices.find(n => n.id === id)).filter(n => n && noticeForMe(n) && !seen().has(n.id)).forEach(n => notifyCat('avisos', '📣 ' + n.title, n.body || '', './'));
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
  try { await setDoc(doc(collection(adb, 'notices')), { title, body, target, ts: Date.now(), at: serverTimestamp() }); toast('📣 Aviso enviado'); return true; }
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
  angelito: ['💌', 'Pistas y noticias de tu angelito', 5], juegos: ['🎮', 'Te toca jugar', 1], avisos: ['📣', 'Avisos, sorteo y recordatorios', 0]
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
function chatUnread() { if (!S.me) return 0; const t = seenTs('chatSeen'); return S.chat.filter(m => m.uid !== S.uid && (m.ts || 0) > t).length; }
function sugUnread() { if (!S.me) return 0; const t = seenTs('sugSeen'); return S.suggestions.filter(x => sTs(x) > t && x.uid !== S.uid && !S.myCreated.has(x.id)).length; }
function renderBadges() {
  const onBuzon = !document.hidden && $('#v-buzon').classList.contains('on');
  if (S.me && onBuzon && S.buz === 'c' && S.chat.length) { const mx = Math.max(...S.chat.map(m => m.ts || 0)); if (mx > seenTs('chatSeen')) setSeen('chatSeen', mx); }
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

/* ---------- 📺 modo fiesta ---------- */
let PARTY = null;
async function openParty() {
  if (!S.isOwner) return toast('Solo el organizador principal puede abrir el modo fiesta');
  toast('Preparando el modo fiesta… 📺');
  let qs = [], ag = [];
  try { qs = (await getDocs(collection(adb, 'questions'))).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(a.at) - ms(b.at)); } catch { }
  try { ag = (await getDocs(collection(adb, 'angelGuess'))).docs.map(d => ({ id: d.id, ...d.data() })); } catch { }
  let authors = {}; try { (await getDocs(collection(adb, 'questionAuthors'))).forEach(d => { authors[d.id] = d.data().uid; }); } catch { }
  const choice = await new Promise(res => {
    const s2 = openModal(`<h3>📺 Abrir el modo fiesta</h3><p class="muted">Al abrirlo ya nadie podrá mandar pistas ni cambiar su sospecha.</p>
      <div class="stack" style="margin-top:14px"><button class="btn gold" data-a="cont">▶️ Continuar donde quedé</button>
      <button class="btn" data-a="fresh">🧹 Empezar desde cero <span class="muted small" style="display:block;font-weight:400">Borra trivia y votos de ensayos</span></button>
      <button class="btn ghost" data-a="no">Cancelar</button></div>`);
    s2.onclick = ev => { const a = ev.target.closest('[data-a]')?.dataset.a; if (a) { closeModal(); res(a); } };
  });
  if (choice === 'no') return;
  const fresh = choice === 'fresh';
  try {
    const ops = [];
    if (fresh) for (const c of ['triviaAns', 'anonVotes']) (await getDocs(collection(adb, c))).forEach(d => ops.push(['del', d.ref]));
    ops.push(['set', doc(adb, 'config', 'event'), { angelLocked: true }, true]);  // ya no se pueden cambiar sospechas ni mandar pistas
    await commitOps(ops);
  } catch (e) { console.warn(e); }
  PARTY_SUBS.forEach(u => u()); PARTY_SUBS = [
    onSnapshot(collection(adb, 'anonVotes'), s => { S.anonVotesLive = s.docs.map(d => d.data()); if (PARTY) paintParty(); }, () => { }),
  ];
  const c = S.event, slides = [];
  const big = (e, t, sub = '') => `<div class="pe">${e}</div><div class="pt">${t}</div>${sub ? `<div class="ps">${sub}</div>` : ''}`;
  slides.push({ html: () => big('🎁', esc(c.eventName || 'Angelito de Navidad'), `¡Bienvenidos! · ${S.participants.length} participantes`) });
  // parejas
  const pairs = Object.entries(S.assignments).filter(([g, a]) => P(g) && P(a.recipient)).map(([g, a]) => ({ g, r: a.recipient }));
  shuffle(pairs);
  if (pairs.length) {
    slides.push({ html: () => big('🎡', 'La gran revelación', 'Toca para descubrir cada angelito') });
    pairs.forEach(x => slides.push({ reveal: false, onReveal: () => confetti(120), html: s => `<div class="ps">El angelito de</div><div class="pt">${esc(pEmoji(x.r))} ${esc(pName(x.r))}</div><div class="ps">es…</div>
      <div class="pt" style="${s.reveal ? '' : 'filter:blur(22px)'}">${esc(pEmoji(x.g))} <span class="gold">${esc(pName(x.g))}</span></div>
      ${s.reveal && ag.find(a => a.id === x.r)?.guess ? `<div class="ps">${esc(P(x.r)?.first || '')} creía que era ${esc(pName(ag.find(a => a.id === x.r).guess))} ${ag.find(a => a.id === x.r).guess === x.g ? '✅' : '❌'}</div>` : ''}` }));
    const hits = pairs.filter(x => ag.find(a => a.id === x.r)?.guess === x.g);
    if (ag.length) slides.push({ html: () => big('🕵️', `${hits.length} ${hits.length === 1 ? 'persona adivinó' : 'personas adivinaron'} su angelito`, hits.map(x => esc(pName(x.r))).join(' · ') || 'Nadie esta vez 😅') });
  }
  // anónimos
  if (qs.length) {
    slides.push({ html: () => big('💌', 'Buzón anónimo', nMsg(qs.length)) });
    qs.forEach((q, i) => slides.push({ steps: 2, step: 0, author: false,
      onEnter: s => setLive({ mode: 'anon', qid: q.id, text: q.text, open: s.step === 0 }),
      onStep: s => { setLive({ mode: 'anon', qid: q.id, text: q.text, open: false }); },
      html: s => { const vs = S.anonVotesLive.filter(v => v.qid === q.id); const cnt = {}; vs.forEach(v => cnt[v.choice] = (cnt[v.choice] || 0) + 1);
        const top = Object.entries(cnt).filter(([u]) => P(u)).sort((a, b) => b[1] - a[1]).slice(0, 4), au = authors[q.id];
        return `<div class="ps">${q.to ? 'Para ' + esc(pName(q.to)) : 'Para todos'} · ${i + 1}/${qs.length}</div><div class="pq">${esc(q.text)}</div>
          ${s.step === 0 ? `<div class="ps">🕵️ ¿Quién lo escribió? Voten desde su teléfono · ${vs.length} ${vs.length === 1 ? 'voto' : 'votos'}</div>`
          : `${top.length ? `<div class="pbars" style="margin:2vh auto 0">${top.map(([u, n]) => `<div class="pbar"><i style="width:${n / top[0][1] * 100}%"></i><span>${esc(pEmoji(u))} ${esc(pName(u))}</span><b>${n}</b></div>`).join('')}</div>` : '<div class="ps">Nadie votó</div>'}
            ${s.author ? `<div class="pt" style="font-size:min(7vw,60px)">✍️ <span class="gold">${au && P(au) ? esc(pName(au)) : 'Anónimo'}</span></div>` : `<div style="margin-top:2vh"><button class="btn sm" data-pauthor>👁️ Revelar quién lo escribió (solo si quieres)</button></div>`}`}`; } }));
  }
  // votaciones
  S.activities.filter(a => a.kind === 'vote').forEach(a => {
    const vs = S.adminVotes.filter(v => v.act === a.id);
    const opts = a.voteTarget === 'participants' ? S.participants.map(p => ({ key: p.id, label: p.name, emoji: p.emoji })) : (a.items || []).map(t => ({ key: t, label: t, emoji: '' }));
    const res = opts.map(o => ({ ...o, n: vs.filter(v => v.choice === o.key).length })).filter(r => r.n).sort((x, y) => y.n - x.n);
    if (!res.length) return;
    slides.push({ reveal: false, onReveal: () => confetti(140), html: s => `<div class="pe">${esc(a.emoji || '🏆')}</div><div class="pt">${esc(a.title)}</div>
      ${s.reveal ? `<div class="pt">🏆 ${esc(res[0].emoji)} <span class="gold">${esc(res[0].label)}</span></div><div class="pbars">${res.slice(0, 5).map(r => `<div class="pbar"><i style="width:${r.n / res[0].n * 100}%"></i><span>${esc(r.emoji)} ${esc(r.label)}</span><b>${r.n}</b></div>`).join('')}</div>` : '<div class="ps">Toca para ver al ganador 🥁</div>'}` });
  });
  // adivinanzas de regalo
  const gs = (S.adminGuesses || []).filter(g => g.text && P(g.uid));
  if (gs.length) {
    slides.push({ html: () => big('🔮', '¿Qué creían que les iban a regalar?', S.event.guessPrize ? 'Premio: ' + esc(S.event.guessPrize) : '') });
    gs.forEach(g => slides.push({ html: () => `<div class="pt">${esc(pEmoji(g.uid))} ${esc(pName(g.uid))}</div><div class="ps">creía que le iban a regalar</div><div class="pq">${esc(g.text)}</div>${g.actual ? `<div class="ps">y le regalaron: <b>${esc(g.actual)}</b></div>` : ''}` }));
    if (S.event.guessWinner && P(S.event.guessWinner)) slides.push({ reveal: false, onReveal: () => confetti(160), html: s => big('🏆', 'Ganador de la adivinanza', s.reveal ? `<span class="gold" style="font-size:1.6em">${esc(pName(S.event.guessWinner))}</span>` : 'Toca para revelar 🥁') });
  }
  slides.push({ html: () => big('🎄', '¡Feliz Navidad!', 'Gracias por compartir 💛') });
  let saved = 0; try { saved = fresh ? 0 : +sessionStorage.getItem('angelito:partyI') || 0; } catch { }
  PARTY = { slides, i: Math.max(0, Math.min(saved, slides.length - 1)) };
  $('#party').classList.add('on'); enterSlide();
  try { await document.documentElement.requestFullscreen?.(); } catch { }
}
let PARTY_SUBS = [];
function paintParty() {
  const s = PARTY.slides[PARTY.i];
  $('#party-body').innerHTML = `<div class="pslide">${s.html(s)}</div>`;
  $('#party-count').textContent = `${PARTY.i + 1} / ${PARTY.slides.length}`;
}
function renderPartyLive() { if (PARTY) paintParty(); }
function enterSlide() {
  const s = PARTY.slides[PARTY.i];
  if (s.onEnter) s.onEnter(s); else if (PARTY.live) setLive({ mode: 'none' });
  PARTY.live = !!s.onEnter; paintParty();
}
function partyNext() {
  const s = PARTY.slides[PARTY.i];
  if (s.steps && s.step < s.steps - 1) { s.step++; s.onStep?.(s); return paintParty(); }
  if (s.reveal === false) { s.reveal = true; s.onReveal?.(); return paintParty(); }
  if (PARTY.i < PARTY.slides.length - 1) { PARTY.i++; enterSlide(); }
}
function partySkip() { if (PARTY.i < PARTY.slides.length - 1) { PARTY.i++; enterSlide(); } }
function partyPrev() { if (PARTY.i > 0) { PARTY.i--; enterSlide(); } }
function closeParty() { try { if (PARTY) sessionStorage.setItem('angelito:partyI', String(PARTY.i)); } catch { } $('#party').classList.remove('on'); PARTY = null; setLive({ mode: 'none' }); PARTY_SUBS.forEach(u => u()); PARTY_SUBS = []; try { document.fullscreenElement && document.exitFullscreen(); } catch { } }
$('#party').addEventListener('click', e => {
  if (e.target.closest('[data-pauthor]')) { const s = PARTY.slides[PARTY.i]; s.author = true; confetti(70); return paintParty(); }
  if (e.target.closest('#party-x')) return closeParty();
  if (e.target.closest('#party-prev')) return partyPrev();
  if (e.target.closest('#party-skip')) return partySkip();
  if (e.target.closest('#party-next') || e.target.closest('#party-body')) return partyNext();
});
addEventListener('pagehide', () => { if (PARTY) setLive({ mode: 'none' }); });
addEventListener('keydown', e => { if (!PARTY) return; if (['ArrowRight', ' ', 'Enter', 'PageDown'].includes(e.key)) { e.preventDefault(); partyNext(); } if (['ArrowLeft', 'PageUp'].includes(e.key)) partyPrev(); if (e.key === 'Escape') closeParty(); });
$('#party-open').addEventListener('click', openParty);

/* ================= LOTE 3 ================= */

/* ---------- 🔠 letra grande ---------- */
// Se quitó el botón A+: si alguien lo tenía activado, se vuelve a la letra normal.
function applyBig() { document.documentElement.classList.remove('big'); try { localStorage.removeItem('angelito:big'); } catch { } }
applyBig();

/* ---------- 💛 recibí mi regalo + agradecimiento ---------- */
let unsubThx = null, thxFor = null;
function syncThanks() {
  const rec = S.assignment?.revealed ? S.assignment.recipient : null;
  if (rec === thxFor) return; thxFor = rec;
  if (unsubThx) { unsubThx(); unsubThx = null; } S.thanksFromRec = null;
  if (rec) unsubThx = onSnapshot(doc(db, 'thanks', rec), s => { S.thanksFromRec = s.exists() ? s.data() : null; render(); }, () => { });
}
function renderThanks() {
  const box = $('#r-thanks'); if (!box) return; syncThanks();
  if (!S.me || !mod('gracias') || !S.drawMeta?.ids?.includes(S.uid)) { box.innerHTML = ''; return; }
  const keep = { t: $('#th-text')?.value, f: document.activeElement?.id };
  const my = S.myThanks, fr = S.thanksFromRec;
  let h = '';
  if (fr?.received) h += `<div class="h2row"><h2>💛 ¡Tu regalo llegó!</h2></div><div class="card incoming"><div class="ie">💛</div><div><b>Tu persona recibió tu regalo</b>${fr.note ? `<div class="small" style="margin-top:6px;white-space:pre-wrap">"${esc(fr.note)}"</div>` : ''}<div class="muted small" style="margin-top:4px">Solo tú ves este mensaje.</div></div></div>`;
  h += `<div class="h2row"><h2>💛 ¿Ya recibiste tu regalo?</h2></div>`;
  if (my?.received && !S.editThx) h += `<div class="card"><b>✅ Le avisaste a tu angelito</b>${my.note ? `<div class="small" style="margin-top:6px;white-space:pre-wrap">"${esc(my.note)}"</div>` : ''}<button class="btn sm" id="th-edit" style="margin-top:10px">✏️ Cambiar mensaje</button></div>`;
  else h += `<form class="card stack" id="th-form"><p class="muted small">Cuando lo recibas, avísale a tu angelito y déjale unas palabras. Solo esa persona lo verá. 💛</p>
    <textarea class="in" id="th-text" maxlength="500" placeholder="¡Me encantó! Gracias, angelito 🥰" style="min-height:70px">${esc(my?.note || '')}</textarea>
    <button class="btn gold" type="submit">💛 Recibí mi regalo</button></form>`;
  box.innerHTML = h;
  if (keep.t != null && $('#th-text')) $('#th-text').value = keep.t;
  if (keep.f && $('#' + keep.f)) $('#' + keep.f).focus();
}
$('#r-thanks').addEventListener('click', e => { if (e.target.closest('#th-edit')) { S.editThx = true; renderThanks(); } });
$('#r-thanks').addEventListener('submit', async e => {
  e.preventDefault(); if (e.target.id !== 'th-form') return;
  try { await setDoc(doc(db, 'thanks', S.uid), { received: true, note: $('#th-text').value.trim(), at: serverTimestamp() }); S.editThx = false; toast('💛 ¡Tu angelito ya lo sabe!'); confetti(80); }
  catch (err) { toast(authErr(err)); }
});

/* ---------- ⭐ deseo favorito + 🛒 lo compro yo ---------- */
// Menú de opciones de un deseo propio (como en las apps: un solo botón ⋮ con todo adentro)
function wishMenu(id) {
  const w = S.wishes.find(x => x.id === id && x.uid === S.uid); if (!w) return;
  sheet({ title: w.text, sub: 'Tu deseo', items: [
    { k: 'top', icon: 'star', label: w.top ? 'Quitar de favorito' : 'Marcar como favorito', hint: w.top ? 'Ya no aparecerá como el que más quieres' : 'Tu angelito sabrá que es el que más quieres' },
    { k: 'edit', icon: 'edit', label: 'Editar', hint: 'Cambia el texto, el enlace o el precio' },
    { k: 'del', icon: 'trash', label: 'Eliminar', hint: 'Se quita de tu lista', danger: true },
  ] }).then(async k => {
    if (k === 'top') return toggleTop(id);
    if (k === 'edit') return setTimeout(() => editWish(id), 180);
    if (k === 'del') {
      if (!(await confirmBox('¿Eliminar este deseo?', 'Se quitará de tu lista.', 'Eliminar'))) return;
      const b = writeBatch(db); b.delete(doc(db, 'wishes', id)); if (w.hasImg) b.delete(doc(db, 'wishImg', id));
      try { await b.commit(); toast('Deseo eliminado'); } catch (err) { toast(authErr(err)); }
    }
  });
}
// ✏️ Editar un deseo propio (texto, enlace y precio). La foto se cambia borrándolo y creándolo de nuevo.
function editWish(id) {
  const w = S.wishes.find(x => x.id === id && x.uid === S.uid); if (!w) return;
  const s2 = openModal(`<h3>✏️ Editar deseo</h3><form class="stack" id="we-form" style="margin-top:10px">
    <label class="field"><span>¿Qué te gustaría?</span><textarea class="in" name="text" maxlength="160" required style="min-height:80px">${esc(w.text)}</textarea></label>
    <label class="field"><span>Enlace de referencia <small class="muted">(opcional)</small></span><input class="in" name="link" type="url" maxlength="300" placeholder="https://…" value="${esc(w.link || '')}"></label>
    <label class="field"><span>Precio aproximado <small class="muted">(opcional)</small></span><input class="in" name="price" maxlength="30" placeholder="RD$1,500" value="${esc(w.price || '')}"></label>
    <div class="actions"><button type="button" class="btn" data-a="close">Cancelar</button><button class="btn gold" type="submit">Guardar</button></div></form>`);
  s2.onclick = e => { if (e.target.closest('[data-a=close]')) closeModal(); };
  $('#we-form', s2).addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, text = f.text.value.trim(), link = f.link.value.trim(), price = f.price.value.trim();
    if (!text) return toast('Escribe tu deseo');
    if (link && !/^https?:\/\//i.test(link)) return toast('El enlace debe empezar con https://');
    try { await setDoc(doc(db, 'wishes', id), { text, link, price }, { merge: true }); closeModal(); toast('✅ Deseo actualizado'); }
    catch (err) { toast(authErr(err)); }
  });
}
async function toggleTop(id) {
  const mine = S.wishes.filter(w => w.uid === S.uid), w0 = mine.find(w => w.id === id); if (!w0) return;
  try {
    const b = writeBatch(db);
    mine.filter(w => w.top && w.id !== id).forEach(w => b.set(doc(db, 'wishes', w.id), { top: false }, { merge: true }));
    b.set(doc(db, 'wishes', id), { top: !w0.top }, { merge: true });
    await b.commit(); toast(!w0.top ? '⭐ Marcado como el que más quieres' : 'Quitado de favorito');
  } catch (err) { toast(authErr(err)); }
}
async function togglePick(id) {
  try {
    const cur = S.wishPick?.wishId;
    await setDoc(doc(db, 'wishPick', S.uid), { wishId: cur === id ? '' : id });
    toast(cur === id ? 'Quitaste el apartado' : '🛒 ¡Apartado! Solo tú lo ves');
  } catch (err) { toast(authErr(err)); }
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-wtop]'); if (t) return toggleTop(t.dataset.wtop);
  const mo = e.target.closest('[data-wmore]'); if (mo) return wishMenu(mo.dataset.wmore);
  const p = e.target.closest('[data-wpick]'); if (p) return togglePick(p.dataset.wpick);
});

/* ---------- íconos (trazos limpios en vez de emojis en menús y botones de opciones) ---------- */
// Color fijo por persona para su nombre en el chat
const NM_COLORS = ['#f6c560', '#7fd6a8', '#8ec5ff', '#f59ab5', '#c7a6ff', '#ffb37a', '#6fe0d6', '#e8e07a'];
function nmColor(uid) { let h = 0; for (const c of String(uid)) h = (h * 31 + c.charCodeAt(0)) | 0; return NM_COLORS[Math.abs(h) % NM_COLORS.length]; }
const SVGI = {
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v7M12 14v7M3 12h7M14 12h7M5.6 5.6l5 5M13.4 13.4l5 5M18.4 5.6l-5 5M10.6 13.4l-5 5"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  install: '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M12 7v7M9 11l3 3 3-3M10 18.5h4"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/>',
  calcheck: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  dress: '<path d="M9 2h6l-1 5 4 14H6l4-14z"/><path d="M8 11h8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  hourglass: '<path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  star: '<path d="M11.52 2.3a.53.53 0 0 1 .96 0l2.31 4.68a2.12 2.12 0 0 0 1.6 1.16l5.16.76a.53.53 0 0 1 .3.9l-3.74 3.64a2.12 2.12 0 0 0-.61 1.88l.88 5.14a.53.53 0 0 1-.77.56l-4.62-2.43a2.12 2.12 0 0 0-1.97 0L6.4 21.01a.53.53 0 0 1-.77-.56l.88-5.14a2.12 2.12 0 0 0-.61-1.88L2.16 9.8a.53.53 0 0 1 .29-.9l5.17-.76a2.12 2.12 0 0 0 1.6-1.16z"/>',
  edit: '<path d="M21.17 6.81a2.83 2.83 0 0 0-4-4L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/><path d="m15 5 4 4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/>',
  reply: '<path d="M9 17l-5-5 5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  shirt: '<path d="M8 3l4 2 4-2 5 4-3 4-2-1v11H8V10l-2 1-3-4z"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  bell: '<path d="M10.27 21a1.94 1.94 0 0 0 3.46 0"/><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33"/>',
  phone: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 8v6m-3-3l3 3 3-3"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.7-2.5 2-2.5 4"/><path d="M12 17h.01"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9m-4 4l3 3"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
  userx: '<circle cx="10" cy="8" r="4"/><path d="M3 21a7 7 0 0114 0"/><path d="M17 8l4 4m0-4l-4 4"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/>',
  refresh: '<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
  logout: '<path d="M15 4h4v16h-4"/><path d="M10 16l-4-4 4-4"/><path d="M6 12h10"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  send: '<path d="M14.54 21.69a.5.5 0 0 0 .94-.03l6.5-19a.5.5 0 0 0-.64-.64l-19 6.5a.5.5 0 0 0-.03.94l7.93 3.18a2 2 0 0 1 1.11 1.11z"/><path d="M21.85 2.15 10.91 13.09"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r=".9" fill="currentColor"/><circle cx="15" cy="15" r=".9" fill="currentColor"/><circle cx="15" cy="9" r=".9" fill="currentColor"/><circle cx="9" cy="15" r=".9" fill="currentColor"/>',
  belloff: '<path d="M10.27 21a1.94 1.94 0 0 0 3.46 0"/><path d="M17 17H4a1 1 0 0 1-.74-1.67C4.59 13.96 6 12.5 6 8a6 6 0 0 1 .26-1.74"/><path d="M8.67 2.7A6 6 0 0 1 18 8c0 2.4.4 4.05 1 5.2"/><path d="m2 2 20 20"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  xcircle: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6m0-6l-6 6"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  download: '<path d="M12 4v11m-5-5l5 5 5-5"/><path d="M5 20h14"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  whatsapp: '<path d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-4-1z"/><path d="M9 9.5c.3 2.2 2.3 4.2 4.5 4.5l1-1.2 1.8.8-.3 1.4c-3.6.4-7.4-3.4-7-7l1.4-.3.8 1.8z"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6"/>',
};
const ic = (n, sz = 20) => `<svg class="ic" viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SVGI[n] || ''}</svg>`;
// Hoja de opciones reutilizable (mismo estilo en toda la app): sheet({ title, sub, head, items:[{k, icon, label, hint, danger}] }) → Promise con la clave elegida
function sheet({ title = '', sub = '', head = '', items = [] }) {
  return new Promise(res => {
    const s2 = openModal(`${head || `<div class="wm-h">${sub ? `<div class="muted small">${esc(sub)}</div>` : ''}<b>${esc(title)}</b></div>`}
      <div class="wm-list">${items.filter(Boolean).map(i => `<button class="wm-row ${i.danger ? 'danger' : ''}" data-k="${i.k}">${ic(i.icon)}<span><b>${esc(i.label)}</b>${i.hint ? `<small>${esc(i.hint)}</small>` : ''}</span></button>`).join('')}</div>
      <div class="actions"><button class="btn" data-k="">Cancelar</button></div>`);
    s2.onclick = e => { const b = e.target.closest('[data-k]'); if (!b || b.closest('.wm-extra')) return; closeModal(); res(b.dataset.k || null); };
  });
}
/* ---------- 💬 reacciones y respuestas ---------- */
const REACTS = ['❤️', '😂', '🔥', '👍', '😮', '🎄'];
function reactsFor(id) { const r = {}, m = S.chat.find(x => x.id === id); Object.entries((m && m.r) || {}).forEach(([u, e]) => { if (REACTS.includes(e)) (r[e] ||= []).push(u); }); return r; }
function openMsgMenu(m) {
  const mine = m.uid === S.uid, canDel = mine || can('moderar'), myR = (m.r || {})[S.uid];
  const reacts = S.me ? `<div class="wm-extra" style="display:flex;justify-content:space-between;gap:6px;margin:4px 0 10px">${REACTS.map(e => `<button class="iconbtn" data-re="${e}" style="width:46px;height:46px;font-size:24px;${myR === e ? 'background:var(--cream)' : ''}">${e}</button>`).join('')}</div>` : '';
  const head = `<div class="wm-h"><div class="muted small">${esc(shortName(P(m.uid)) || 'Alguien')}</div><b style="font-weight:500;white-space:pre-wrap">${esc(m.hasImg && m.text === '📷 Foto' ? '📷 Foto' : m.text.slice(0, 300))}</b></div>${reacts}`;
  const p = sheet({ head, items: [
    S.me && { k: 'reply', icon: 'reply', label: 'Responder' },
    !(m.hasImg && m.text === '📷 Foto') && { k: 'copy', icon: 'copy', label: 'Copiar texto' },
    mine && { k: 'edit', icon: 'edit', label: m.hasImg ? 'Editar comentario' : 'Editar mensaje', hint: 'Los demás verán que lo editaste' },
    canDel && { k: 'del', icon: 'trash', label: 'Eliminar mensaje', hint: mine ? 'Se borra para todos' : 'Como moderador', danger: true },
  ] });
  $('#sheet').addEventListener('click', async e => {
    const r = e.target.closest('[data-re]'); if (!r) return; closeModal();
    try { await setDoc(doc(db, 'chat', m.id), { r: { [S.uid]: myR === r.dataset.re ? deleteField() : r.dataset.re } }, { merge: true }); } catch (err) { toast(authErr(err)); }
  }, { once: true });
  p.then(async a => {
    if (a === 'reply') { S.replyTo = { id: m.id, uid: m.uid, text: m.text.slice(0, 100) }; renderReplyBar(); $('#c-text').focus(); }
    if (a === 'copy') { try { await navigator.clipboard.writeText(m.text); toast('Texto copiado'); } catch { toast('No se pudo copiar'); } }
    if (a === 'edit') editMsg(m);
    if (a === 'del') {
      if (!(await confirmBox('¿Eliminar este mensaje?', 'Se borrará para todos.', 'Eliminar'))) return;
      try { const x = mine ? db : adb, w = writeBatch(x); w.delete(doc(x, 'chat', m.id)); if (m.hasImg) w.delete(doc(x, 'chatImg', m.id)); await w.commit(); toast('Mensaje eliminado'); } catch (err) { toast(authErr(err)); }
    }
  });
}
// ✏️ Editar un mensaje propio (o el comentario de una foto)
function editMsg(m) {
  const cur = m.hasImg && m.text === '📷 Foto' ? '' : m.text;
  const s2 = openModal(`<h3>${m.hasImg ? 'Editar comentario' : 'Editar mensaje'}</h3>
    ${m.hasImg && S.chatImgs[m.id] ? `<img src="${S.chatImgs[m.id]}" alt="" style="width:100%;max-height:220px;object-fit:cover;border-radius:14px;margin-top:10px">` : ''}
    <form class="stack" id="me-form" style="margin-top:12px"><textarea class="in" name="t" maxlength="500" style="min-height:90px" placeholder="${m.hasImg ? 'Escribe un comentario (opcional)' : ''}">${esc(cur)}</textarea>
    <div class="actions"><button type="button" class="btn" data-a="close">Cancelar</button><button class="btn gold" type="submit">Guardar</button></div></form>`);
  s2.onclick = e => { if (e.target.closest('[data-a=close]')) closeModal(); };
  const ta = $('#me-form textarea', s2); setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }, 200);
  $('#me-form', s2).addEventListener('submit', async e => {
    e.preventDefault(); const t = ta.value.trim() || (m.hasImg ? '📷 Foto' : '');
    if (!t) return toast('El mensaje no puede quedar vacío');
    if (t === m.text) return closeModal();
    const ments = t === '📷 Foto' ? [] : mentionsIn(t);
    try { await setDoc(doc(db, 'chat', m.id), { text: t, edited: true, mentions: ments }, { merge: true }); closeModal(); toast('Mensaje editado'); }
    catch (err) { toast(authErr(err)); }
  });
}
function renderReplyBar() {
  const b = $('#c-reply'); if (!b) return;
  b.innerHTML = S.replyTo ? `<div class="replybar"><div style="flex:1;min-width:0"><b>↩️ ${esc(shortName(P(S.replyTo.uid)) || '')}</b><div class="muted small" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(S.replyTo.text)}</div></div><button class="x" id="c-reply-x" aria-label="Cancelar">✕</button></div>` : '';
}
document.addEventListener('click', e => { if (e.target.closest('#c-reply-x')) { S.replyTo = null; renderReplyBar(); } });

/* ---------- 🖼️ tarjeta de invitación ---------- */
// Invitación (1080×1350, para WhatsApp e Instagram). Se dibuja al momento: la cuenta de días siempre es la de HOY.
async function makeInvite() {
  const c = S.event, W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d'), cx = W / 2;
  try { await Promise.all([document.fonts.load('900 90px Fraunces'), document.fonts.load('700 40px "DM Sans"'), document.fonts.load('500 40px "DM Sans"')]); } catch { }
  // fondo: rojo profundo con luz arriba y nieve suave
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#a3221d'); g.addColorStop(.6, '#5a110f'); g.addColorStop(1, '#0b1f17'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const rg = x.createRadialGradient(cx, 260, 40, cx, 260, 620); rg.addColorStop(0, 'rgba(255,215,140,.28)'); rg.addColorStop(1, 'rgba(255,215,140,0)'); x.fillStyle = rg; x.fillRect(0, 0, W, H);
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280; // nieve igual en cada tarjeta
  for (let i = 0; i < 110; i++) { x.fillStyle = `rgba(255,255,255,${.25 + rnd() * .55})`; x.beginPath(); x.arc(rnd() * W, rnd() * H, rnd() * 3.2 + .8, 0, 7); x.fill(); }
  // marco dorado fino
  x.strokeStyle = 'rgba(236,188,92,.55)'; x.lineWidth = 3; x.beginPath(); x.roundRect(40, 40, W - 80, H - 80, 36); x.stroke();
  // regalo dibujado (no emoji: se ve igual en todos los teléfonos)
  const gx = cx, gy = 172, gw = 170, gh = 120;
  x.fillStyle = '#e8463c'; x.beginPath(); x.roundRect(gx - gw / 2, gy, gw, gh, 16); x.fill();
  x.fillStyle = '#ff5a4f'; x.beginPath(); x.roundRect(gx - gw / 2 - 12, gy - 36, gw + 24, 44, 12); x.fill();
  x.fillStyle = '#f2c35f'; x.fillRect(gx - 14, gy - 36, 28, gh + 36); x.fillRect(gx - gw / 2 - 12, gy - 20, gw + 24, 17);
  x.strokeStyle = '#f2c35f'; x.lineWidth = 13; x.lineCap = 'round';
  x.beginPath(); x.ellipse(gx - 38, gy - 62, 36, 22, -.5, 0, 7); x.stroke(); x.beginPath(); x.ellipse(gx + 38, gy - 62, 36, 22, .5, 0, 7); x.stroke();
  x.fillStyle = '#f2c35f'; x.beginPath(); x.arc(gx, gy - 44, 14, 0, 7); x.fill();
  // textos
  x.textAlign = 'center';
  x.fillStyle = '#ffd99a'; x.font = '700 30px "DM Sans", sans-serif'; x.fillText('E S T Á S   I N V I T A D O   A L', cx, 365);
  const title = c.eventName || 'Angelito de Navidad'; x.fillStyle = '#fff7ec';
  let fs = 96; x.font = `900 ${fs}px Fraunces, serif`;
  const wrap = () => { const ws = title.split(' '), ls = ['']; ws.forEach(w => { const t = (ls[ls.length - 1] + ' ' + w).trim(); if (x.measureText(t).width > W - 200 && ls[ls.length - 1]) ls.push(w); else ls[ls.length - 1] = t; }); return ls; };
  let lines = wrap(); while (lines.length > 2 && fs > 60) { fs -= 6; x.font = `900 ${fs}px Fraunces, serif`; lines = wrap(); }
  lines.slice(0, 2).forEach((l, i) => x.fillText(l, cx, 470 + i * (fs + 4)));
  let y = 470 + Math.min(lines.length, 2) * (fs + 4) + 10;
  // datos en una cuadrícula de 2 columnas
  const start = c.eventAt ? new Date(ms(c.eventAt)) : c.eventDate ? new Date(c.eventDate.length <= 10 ? c.eventDate + 'T00:00' : c.eventDate) : null;
  const rows = [];
  if (start && !isNaN(start)) { rows.push(['FECHA', cap(start.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'long' }))]); if (start.getHours() || start.getMinutes()) rows.push(['HORA', hm(start)]); }
  if (c.place) rows.push(['LUGAR', c.place]);
  if (c.budget) rows.push(['REGALO DE', c.budget]);
  if (rows.length) {
    const L = 120, R = W - 120, colW = (R - L) / 2, nr = Math.ceil(rows.length / 2), ch = nr * 112 + 24;
    x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.roundRect(L, y, R - L, ch, 30); x.fill(); x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 2; x.stroke();
    x.fillStyle = 'rgba(255,255,255,.1)'; if (rows.length > 1) x.fillRect(L + colW, y + 24, 2, ch - 48); for (let r = 1; r < nr; r++) x.fillRect(L + 30, y + 12 + r * 112, R - L - 60, 2);
    rows.forEach(([k, v], i) => {
      const col = rows.length === 1 ? 0 : i % 2, row = Math.floor(i / 2), tx = rows.length === 1 ? cx : L + colW * col + colW / 2, ty = y + 58 + row * 112;
      x.textAlign = 'center'; x.fillStyle = '#ecbc5c'; x.font = '700 22px "DM Sans", sans-serif'; x.fillText(k, tx, ty);
      let f2 = 38; x.font = `600 ${f2}px "DM Sans", sans-serif`; while (x.measureText(v).width > colW - 40 && f2 > 24) { f2 -= 2; x.font = `600 ${f2}px "DM Sans", sans-serif`; }
      let t = v; while (x.measureText(t).width > colW - 40 && t.length > 4) t = t.slice(0, -2) + '…';
      x.fillStyle = '#fff'; x.fillText(t, tx, ty + 46);
    });
    y += ch + 30;
  }
  // cuenta regresiva por días de calendario (hoy → el día del evento)
  if (start && !isNaN(start)) {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0); const d1 = new Date(start); d1.setHours(0, 0, 0, 0);
    const d = Math.round((d1 - d0) / 864e5), room = H - 170 - y;
    const big = d > 1 ? String(d) : d === 1 ? '¡Mañana!' : d === 0 ? '¡Es hoy!' : '';
    if (big && room > 120) {
      const bs = Math.min(d > 1 ? 150 : 100, room - (d > 1 ? 60 : 10));
      x.textAlign = 'center'; x.fillStyle = '#ecbc5c'; x.font = `900 ${bs}px Fraunces, serif`; x.fillText(big, cx, y + bs * .85);
      if (d > 1) { x.fillStyle = '#ffe6bd'; x.font = '600 34px "DM Sans", sans-serif'; x.fillText('días para el angelito', cx, y + bs * .85 + 50); }
    }
  }
  // pie
  x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '500 28px "DM Sans", sans-serif'; x.fillText('Entra, inscríbete y arma tu lista de deseos', cx, H - 118);
  x.fillStyle = '#fff'; x.font = '700 36px "DM Sans", sans-serif'; x.fillText(location.host || 'angelito', cx, H - 72);
  return cv;
}
async function shareInvite() {
  toast('Creando tu invitación…');
  const cv = await makeInvite();
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const file = new File([blob], 'invitacion-angelito.png', { type: 'image/png' });
  const text = `🎁 ¡Estás invitado al ${S.event.eventName || 'angelito'}! Entra aquí: ${location.origin + location.pathname}`;
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
  const url = URL.createObjectURL(blob);
  openModal(`<h3>Tu invitación</h3><p class="muted small">Se crea al momento con los días que faltan hoy. Mantén presionada la imagen para guardarla.</p><img src="${url}" alt="Invitación" style="width:100%;border-radius:16px;margin-top:10px;box-shadow:0 14px 40px rgba(0,0,0,.45)">
    <div class="qa" style="justify-content:center;margin-top:12px"><a class="btn sm btn-ic" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener" style="text-decoration:none">${ic('whatsapp', 18)} WhatsApp</a><button class="btn sm btn-ic" data-a="copy">${ic('link', 18)} Copiar enlace</button></div>
    <div class="actions"><a class="btn gold btn-ic" href="${url}" download="invitacion-angelito.png" style="text-decoration:none">${ic('download', 18)} Descargar</a><button class="btn" data-a="x">Cerrar</button></div>`).onclick = async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'copy') { try { await navigator.clipboard.writeText(text); toast('Enlace copiado'); } catch { toast(location.origin + location.pathname); } return; }
    closeModal(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
}
document.addEventListener('click', e => { if (e.target.closest('#q-inv')) shareInvite(); });

/* ---------- 📸 fotos ---------- */
let unsubPhotos = null;
function ensurePhotos() {
  if (unsubPhotos || !(S.me || S.isAdmin)) return;
  unsubPhotos = onSnapshot(query(collection(S.uid ? db : adb, 'photos'), orderBy('at', 'desc'), limit(36)), s => { S.photos = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, () => { unsubPhotos = null; });
}
function shrink(file, max, q, lim) {
  return new Promise((res, rej) => {
    const img = new Image(); img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
      let qq = q, d = c.toDataURL('image/jpeg', qq); while (d.length > (lim || (max > 500 ? 900000 : 40000)) && qq > .3) { qq -= .1; d = c.toDataURL('image/jpeg', qq); }
      URL.revokeObjectURL(img.src); res(d);
    }; img.onerror = rej; img.src = URL.createObjectURL(file);
  });
}
function renderPhotos() {
  const box = $('#f-root'); if (!box) return;
  if (!S.me && !S.isAdmin) { box.innerHTML = S.authReady ? needLogin('Entra para ver y subir fotos.') : ''; return; }
  if ($('#v-buzon').classList.contains('on') && S.buz === 'f') ensurePhotos();
  const ps = S.photos || [];
  const up = S.uploading || 0;
  box.innerHTML = `${S.me ? `<div class="camrow"><label class="btn gold">📷 Tomar foto<input type="file" class="f-in" accept="image/*" capture="environment" hidden></label><label class="btn">🖼️ Galería<input type="file" class="f-in" accept="image/*" multiple hidden></label></div>` : ''}
    <p class="muted small center" style="margin:8px 0 14px">Las fotos se guardan en tamaño reducido para que el álbum sea gratis.</p>
    ${ps.length || up ? `<div class="pgrid">${'<div class="pth up">Subiendo…</div>'.repeat(up)}${ps.map(p => `<button class="pth" data-ph="${esc(p.id)}" style="background-image:url('${String(p.thumb || '').replace(/[^A-Za-z0-9+/=:;,._-]/g, '')}')" aria-label="Foto de ${esc(pName(p.uid))}"></button>`).join('')}</div>`
      : '<div class="card empty"><span class="e">📷</span>Todavía no hay fotos. ¡Sube la primera!</div>'}`;
}
document.addEventListener('change', async e => {
  if (!e.target.classList.contains('f-in')) return; const files = [...e.target.files].slice(0, 10); if (!files.length) return;
  S.uploading = (S.uploading || 0) + files.length; renderPhotos();
  let ok = 0;
  for (const f of files) {
    try {
      const [thumb, full] = await Promise.all([shrink(f, 260, .55), shrink(f, 1280, .72)]);
      const ref = doc(collection(db, 'photos')), b = writeBatch(db);
      b.set(ref, { uid: S.uid, thumb, caption: '', at: serverTimestamp() }); b.set(doc(db, 'photosFull', ref.id), { uid: S.uid, data: full });
      await b.commit(); ok++;
    } catch (err) { console.warn(err); toast(err?.code?.includes('quota') ? 'Se llenó el espacio del álbum' : 'No se pudo subir una foto'); }
    finally { S.uploading = Math.max(0, S.uploading - 1); renderPhotos(); }
  }
  if (ok) toast(`✅ ${ok} ${ok === 1 ? 'foto subida' : 'fotos subidas'}`);
  e.target.value = '';
});
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-ph]'); if (!b) return; const p = (S.photos || []).find(x => x.id === b.dataset.ph); if (!p) return;
  const s2 = openModal(`<div class="center"><img id="ph-big" src="${String(p.thumb || '').replace(/[^A-Za-z0-9+/=:;,._-]/g, '')}" alt="" style="width:100%;border-radius:14px"><p class="muted small" style="margin-top:8px">${esc(pEmoji(p.uid))} ${esc(pName(p.uid))}</p></div>
    <div class="actions">${(p.uid === S.uid || can('moderar')) ? '<button class="btn" data-a="del">🗑️ Borrar</button>' : ''}<button class="btn gold" data-a="x">Cerrar</button></div>`);
  try { const f = await getDoc(doc(S.uid ? db : adb, 'photosFull', p.id)); if (f.exists() && $('#ph-big', s2)) $('#ph-big', s2).src = String(f.data().data || '').replace(/[^A-Za-z0-9+/=:;,._-]/g, ''); } catch { }
  s2.onclick = async ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return; closeModal();
    if (a === 'del' && await confirmBox('¿Borrar esta foto?', 'Se borrará para todos.', 'Borrar')) {
      try { const x = p.uid === S.uid ? db : adb, w = writeBatch(x); w.delete(doc(x, 'photos', p.id)); w.delete(doc(x, 'photosFull', p.id)); await w.commit(); } catch (err) { toast(authErr(err)); }
    }
  };
});

/* ---------- 🎲 trivia + 🕵️ quién escribió (en vivo) ---------- */
function parseTrivia(txt) {
  return txt.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const parts = l.split('|').map(x => x.trim()); if (parts.length < 3) return null;
    const q = parts.shift(); let c = parts.findIndex(x => x.startsWith('*')); if (c < 0) c = 0;
    return { q, o: parts.slice(0, 4).map(x => x.replace(/^\*/, '').trim()), c: Math.min(c, 3) };
  }).filter(x => x && x.o.length >= 2);
}
const triviaText = list => list.map(t => [t.q, ...t.o.map((o, i) => (i === t.c ? '*' : '') + o)].join(' | ')).join('\n');
async function setLive(o) { try { await setDoc(doc(adb, 'party', 'live'), { ...o, ts: Date.now() }); } catch (e) { console.warn('live', e); } }

// teléfonos: tarjeta en vivo
function renderLive() {
  const box = $('#live'); if (!box) return;
  const L = S.live;
  if (!S.me || !L || !['anon', 'trivia'].includes(L.mode) || S.liveHide === (L.qid ?? L.qi) + L.mode) { box.classList.remove('on'); return; }
  box.classList.add('on');
  if (L.mode === 'anon') {
    const my = S.myLive[`a:${L.qid}`];
    box.innerHTML = `<div class="livehd"><b>🕵️ ¿Quién escribió este anónimo?</b><button class="x" data-lhide aria-label="Ocultar">▾</button></div>
      <div class="pq" style="font-size:1.15rem;margin:10px 0">${esc(L.text || '')}</div>
      ${L.open ? `<div class="chips" style="max-height:34vh;overflow:auto">${S.participants.map(p => `<button class="chip ${my === p.id ? 'on' : ''}" data-lv="${esc(p.id)}">${esc(p.emoji)} ${esc(shortName(p))}</button>`).join('')}</div>
        <p class="muted small" style="margin-top:8px">${my ? '✅ Votaste por ' + esc(pName(my)) + '. Puedes cambiarlo.' : 'Toca a quien creas que lo escribió.'}</p>`
        : `<p class="muted">⏳ Votación cerrada. ¡Mira la pantalla!</p>`}`;
  } else {
    const my = S.myLive[`t:${L.qi}`];
    box.innerHTML = `<div class="livehd"><b>🎲 Trivia · ${L.n || ''}/${L.total || ''}</b><button class="x" data-lhide aria-label="Ocultar">▾</button></div>
      <div style="font-weight:700;font-size:1.15rem;margin:10px 0">${esc(L.q || '')}</div>
      <div class="tvopts">${(L.o || []).map((o, i) => { const st = L.correct != null ? (i === L.correct ? 'ok' : (my === i ? 'bad' : '')) : (my === i ? 'on' : ''); return `<button class="tvo ${st}" data-ta="${i}" ${my != null || !L.open ? 'disabled' : ''}><b>${'ABCD'[i]}</b> ${esc(o)}</button>`; }).join('')}</div>
      <p class="muted small" style="margin-top:8px">${L.correct != null ? (my === L.correct ? '🎉 ¡Correcto!' : my != null ? '😅 Uy, no era esa.' : 'No respondiste a tiempo.') : my != null ? '✅ Respuesta enviada. ¡Espera el resultado!' : L.open ? '¡Rápido! Cuenta la velocidad.' : '⏳ Tiempo cerrado.'}</p>`;
  }
}
document.addEventListener('click', async e => {
  if (e.target.closest('[data-lhide]')) { const L = S.live; S.liveHide = (L.qid ?? L.qi) + L.mode; return renderLive(); }
  const v = e.target.closest('[data-lv]');
  if (v && S.live?.mode === 'anon') { const qid = S.live.qid; try { await setDoc(doc(db, 'anonVotes', `${qid}__${S.uid}`), { qid, uid: S.uid, choice: v.dataset.lv }); S.myLive[`a:${qid}`] = v.dataset.lv; renderLive(); } catch (err) { toast(authErr(err)); } }
  const t = e.target.closest('[data-ta]');
  if (t && S.live?.mode === 'trivia' && S.live.open) { const qi = S.live.qi, a = +t.dataset.ta; S.myLive[`t:${qi}`] = a; renderLive(); try { await setDoc(doc(db, 'triviaAns', `${qi}__${S.uid}`), { qi, uid: S.uid, a, t: serverTimestamp() }); } catch (err) { delete S.myLive[`t:${qi}`]; renderLive(); toast(err?.code?.includes('permission') ? 'Ya respondiste o se cerró el tiempo' : authErr(err)); } }
});

/* ---------- 📖 recuerdos + 🔁 nuevo año ---------- */
async function saveMemories() {
  if (!S.isOwner) return;
  if (!(await confirmBox('¿Guardar los recuerdos del año?', S.reveal ? 'Todos podrán verlos en Inicio, incluidas las parejas.' : 'Todavía no hiciste la gran revelación, así que las parejas NO se incluirán (para no arruinar la sorpresa). Puedes volver a guardar después de revelar.', 'Guardar'))) return;
  const c = S.event, year = (c.eventDate || '').slice(0, 4) || String(new Date().getFullYear());
  toast('Guardando recuerdos… 📖');
  const get = async n => { try { return (await getDocs(collection(adb, n))).docs.map(d => ({ id: d.id, ...d.data() })); } catch { return []; } };
  const [chat, sugs, sv, wishes, photos] = await Promise.all(['chat', 'suggestions', 'sugVotes', 'wishes', 'photos'].map(get));
  const nm = id => P(id)?.name || '—';
  const pairs = S.reveal ? Object.entries(S.assignments).filter(([g]) => P(g)).map(([g, a]) => ({ g: nm(g), r: nm(a.recipient) })) : [];
  const votes = S.activities.filter(a => a.kind === 'vote').map(a => {
    const vs = S.adminVotes.filter(v => v.act === a.id); const cnt = {}; vs.forEach(v => cnt[v.choice] = (cnt[v.choice] || 0) + 1);
    const best = Object.entries(cnt).sort((x, y) => y[1] - x[1])[0]; return best ? { title: a.title, winner: a.voteTarget === 'participants' ? nm(best[0]) : best[0], n: best[1] } : null;
  }).filter(Boolean);
  const qz = S.activities.find(a => a.kind === 'quiz' && a.resultsOpen && a.results?.[0]?.count), tw = qz ? [qz.results[0].key, qz.results[0].count] : null;
  const rc = {}; chat.forEach(m => { rc[m.id] = Object.keys(m.r || {}).length; });
  const topChat = chat.filter(m => rc[m.id]).sort((a, b) => rc[b.id] - rc[a.id]).slice(0, 3).map(m => ({ text: m.text.slice(0, 200), who: nm(m.uid), n: rc[m.id] }));
  const vc = {}; sv.forEach(v => vc[v.sug] = (vc[v.sug] || 0) + 1);
  const topSugs = sugs.filter(x => vc[x.id]).sort((a, b) => vc[b.id] - vc[a.id]).slice(0, 3).map(x => ({ text: x.text.slice(0, 200), n: vc[x.id] }));
  const mem = { year, eventName: c.eventName || 'Angelito', date: c.eventDate || '', place: c.place || '', people: S.participants.map(p => ({ name: p.name, emoji: p.emoji })),
    pairs, votes, guessWinner: c.guessWinner ? nm(c.guessWinner) : '', triviaWinner: tw ? { name: nm(tw[0]), n: tw[1] } : null, topChat, topSugs,
    stats: { participants: S.participants.length, wishes: wishes.length, chat: chat.length, suggestions: sugs.length, questions: S.qCount, photos: photos.length },
    cover: photos.slice(0, 6).map(p => p.thumb).filter(t => String(t).length < 80000), at: serverTimestamp() };
  try { await setDoc(doc(adb, 'memories', year), mem); toast(`📖 Recuerdos ${year} guardados`); confetti(80); } catch (err) { toast(authErr(err)); }
}
$('#relog-go').addEventListener('click', async () => {
  if (!(await confirmBox('¿Pedir a todos que vuelvan a entrar?', 'A cada persona se le cerrará la sesión la próxima vez que abra la app y le pediremos entrar de nuevo, activar los avisos e instalar la app. Tú no sales.', 'Sí, pedirlo'))) return;
  if (await saveEvent({ reloginAt: Timestamp.now() })) toast('Listo: todos volverán a entrar 📲');
});
$('#mem-save').addEventListener('click', saveMemories);
function renderMemCard() {
  const box = $('#h-mem'); if (!box) return;
  const ms2 = [...(S.memories || [])].sort((a, b) => String(b.id).localeCompare(String(a.id)));
  box.innerHTML = ms2.length ? `<div class="h2row"><h2>📖 Recuerdos</h2></div><div class="chips" style="margin-bottom:16px">${ms2.map(m => `<button class="chip" data-mem="${esc(m.id)}">📖 ${esc(m.eventName)}${String(m.eventName).includes(m.year) ? '' : ' ' + esc(m.year)}</button>`).join('')}</div>` : '';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-mem]'); if (!b) return; const m = S.memories.find(x => x.id === b.dataset.mem); if (!m) return;
  const st = m.stats || {}, clean = t => String(t || '').replace(/[^A-Za-z0-9+/=:;,._-]/g, '');
  openModal(`<div class="center"><div style="font-size:44px">📖</div><h3>${esc(m.eventName)}${String(m.eventName).includes(m.year) ? '' : ' ' + esc(m.year)}</h3><p class="muted small">${esc(m.date ? fmtDate(m.date, { day: 'numeric', month: 'long', year: 'numeric' }) : '')}${m.place ? ' · ' + esc(m.place) : ''}</p></div>
    ${(m.cover || []).length ? `<div class="pgrid" style="margin:12px 0">${m.cover.map(t => `<div class="pth" style="background-image:url('${clean(t)}')"></div>`).join('')}</div>` : ''}
    <div class="going" style="justify-content:center">${[['👥', st.participants, 'participantes'], ['🎁', st.wishes, 'deseos'], ['💬', st.chat, 'mensajes'], ['💡', st.suggestions, 'sugerencias'], ['💌', st.questions, 'anónimos'], ['📸', st.photos, 'fotos']].filter(x => x[1]).map(([e, n, l]) => `<span>${e} <b>${Number(n) || 0}</b> ${l}</span>`).join('')}</div>
    ${(m.pairs || []).length ? `<b style="display:block;margin-top:16px">🎁 Los angelitos</b><div class="stack" style="margin-top:8px;gap:6px">${m.pairs.map(x => `<div class="small">${esc(x.g)} → ${esc(x.r)}</div>`).join('')}</div>` : ''}
    ${(m.votes || []).length || m.guessWinner || m.triviaWinner ? `<b style="display:block;margin-top:16px">🏆 Ganadores</b><div class="stack" style="margin-top:8px;gap:6px">${(m.votes || []).map(v => `<div class="small">${esc(v.title)}: <b>${esc(v.winner)}</b></div>`).join('')}${m.guessWinner ? `<div class="small">🔮 Adivinanza: <b>${esc(m.guessWinner)}</b></div>` : ''}${m.triviaWinner ? `<div class="small">🎲 Trivia: <b>${esc(m.triviaWinner.name)}</b> (${Number(m.triviaWinner.n) || 0} aciertos)</div>` : ''}</div>` : ''}
    ${(m.topChat || []).length ? `<b style="display:block;margin-top:16px">😂 Lo más reaccionado del chat</b><div class="stack" style="margin-top:8px">${m.topChat.map(x => `<div class="guess"><div class="gv">"${esc(x.text)}"</div><div class="gl">— ${esc(x.who)} · ${Number(x.n) || 0} reacciones</div></div>`).join('')}</div>` : ''}
    ${(m.topSugs || []).length ? `<b style="display:block;margin-top:16px">💡 Las sugerencias más votadas</b><div class="stack" style="margin-top:8px">${m.topSugs.map(x => `<div class="guess"><div class="gv">${esc(x.text)}</div><div class="gl">👍 ${Number(x.n) || 0}</div></div>`).join('')}</div>` : ''}
    <div class="actions"><button class="btn gold" data-a="x">Cerrar</button></div>`).onclick = ev => { if (ev.target.closest('[data-a]')) closeModal(); };
});
$('#ny-go').addEventListener('click', async () => {
  if (!S.isOwner) return;
  const s2 = openModal(`<h3>🔁 Empezar un nuevo año</h3><p class="muted">Se borra todo lo de este año: sorteo, deseos, aportes, anónimos, sugerencias, actividades, pistas, votos, trivia${''}. <b>Se conservan</b> los participantes, sus perfiles e íconos, el equipo, las reglas y los recuerdos.</p>
    <label class="chk" style="margin-top:12px"><input type="checkbox" id="ny-chat" checked> Borrar también el chat y las fotos</label>
    <p class="muted small" style="margin-top:12px">💡 Antes, toca <b>📖 Guardar recuerdos del año</b> para no perder nada.</p>
    <label class="field" style="margin-top:12px"><span>Escribe NUEVO AÑO para confirmar</span><input class="in" id="ny-txt" autocomplete="off"></label>
    <div class="err" id="ny-err"></div><div class="actions"><button class="btn" data-a="no">Cancelar</button><button class="btn primary" data-a="ok">Borrar y empezar</button></div>`);
  s2.onclick = async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; if (a === 'no') return closeModal();
    if ($('#ny-txt', s2).value.trim().toUpperCase() !== 'NUEVO AÑO') { $('#ny-err', s2).textContent = 'Escribe NUEVO AÑO exactamente.'; return; }
    const btn = s2.querySelector('[data-a=ok]'); busy(btn, true);
    const cols = ['assignments', 'giftStatus', 'giftIncoming', 'guesses', 'angelGuess', 'hints', 'hintsSent', 'reveal', 'wishes', 'wishImg', 'wishPick', 'games', 'gameWins', 'attendance', 'questions', 'questionAuthors',
      'suggestions', 'suggestionAuthors', 'sugVotes', 'activities', 'activityPicks', 'votes', 'activitySignups', 'quizAns', 'quizKeys', 'rsvps', 'notices', 'thanks', 'anonVotes', 'triviaAns', 'party'];
    const wipeMedia = $('#ny-chat', s2).checked; if (wipeMedia) cols.push('chat', 'chatReacts', 'photos');
    try {
      { const b0 = writeBatch(adb); b0.delete(doc(adb, 'config', 'draw')); await b0.commit(); }
      if (wipeMedia) { const ph = (await getDocs(collection(adb, 'photos'))).docs.map(d => d.id); await commitOps(ph.map(id => ['del', doc(adb, 'photosFull', id)])); }
      for (const c of cols) { const ds = (await getDocs(collection(adb, c))).docs; await commitOps(ds.map(d => ['del', d.ref])); }
      const b = writeBatch(adb);
      b.set(doc(adb, 'stats', 'questions'), { count: 0 });
      b.set(doc(adb, 'config', 'event'), { eventDate: '', eventAt: null, revealDate: '', revealAt: null, rsvpDeadline: '', revealNow: false, guessesOpen: false, guessesLocked: false, guessWinner: '', angelLocked: false, registrationOpen: true }, { merge: true });
      await b.commit(); closeModal(); toast('🔁 ¡Listo! Nuevo año, nuevo angelito 🎄'); confetti(120);
    } catch (err) { $('#ny-err', s2).textContent = authErr(err); busy(btn, false); }
  };
});

/* ---------- ⚡ copia rápida en localStorage ---------- */
const BOOT_KEY = 'angelito:boot:v1';
let bootT = null;
function saveBoot() {
  clearTimeout(bootT);
  bootT = setTimeout(() => {
    try { localStorage.setItem(BOOT_KEY, JSON.stringify({ event: S.event, participants: S.participants, activities: S.activities, drawMeta: S.drawMeta, notices: S.notices, qCount: S.qCount, t: Date.now() })); } catch { }
  }, 2500);
}

/* ---------- actualización automática ---------- */
let updating = false;
async function checkUpdate() {
  if (updating) return;
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
    const v = String((await r.json()).version || ''); if (!v) return;
    if (!checkUpdate.base) { checkUpdate.base = APP_VERSION.startsWith('__') ? v : APP_VERSION; }
    let tried = ''; try { tried = sessionStorage.getItem('angelito:reloadedFor') || ''; } catch { }
    if (v !== checkUpdate.base && tried !== v) {
      const busyNow = S.spinning || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && document.activeElement.value;
      if (busyNow) { if (checkUpdate.warned !== v) { checkUpdate.warned = v; toast('🎁 Hay una versión nueva. Se actualizará al terminar.'); } return; }
      try { sessionStorage.setItem('angelito:reloadedFor', v); } catch { }
      updating = true;
      toast('🎁 Nueva versión, actualizando…');
      try { await swReg?.update(); } catch { }
      setTimeout(() => location.reload(), 1200);
    }
  } catch { }
}
setInterval(checkUpdate, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
setTimeout(checkUpdate, 4000);

/* ---------- efectos ---------- */
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function confetti(count = 170) {
  if (reduce) return;
  const cv = $('#fx'), ctx = cv.getContext('2d'), dpr = devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cols = ['#e2483f', '#ecbc5c', '#2f9461', '#f7efe1', '#ff8a7a'];
  const ps = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 120, y: innerHeight * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 6,
    r: Math.random() * 6 + 4, c: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * 6, va: (Math.random() - .5) * .3
  }));
  const t0 = performance.now();
  (function f(t) {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ps.forEach(p => { p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); });
    if (t - t0 < 4000) requestAnimationFrame(f); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })(t0);
}
function snow() {
  if (reduce) return;
  const cv = $('#snow'), ctx = cv.getContext('2d'); let W, H;
  const size = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; }; size(); addEventListener('resize', size);
  const fl = Array.from({ length: (navigator.hardwareConcurrency || 8) <= 4 ? 25 : 45 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2.2 + .6, s: Math.random() * .6 + .25, d: Math.random() * 6 }));
  let lastT = 0;
  (function f(t = 0) {
    requestAnimationFrame(f);
    if (document.hidden || S.spinning || t - lastT < 33) return; // ~30 cuadros por segundo y en pausa si no se ve
    lastT = t;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = 'rgba(255,255,255,.75)';
    fl.forEach(p => { p.y += p.s * 2; p.d += .02; p.x += Math.sin(p.d) * .6; if (p.y > H) { p.y = -5; p.x = Math.random() * W; } ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); });
  })();
}
addEventListener('resize', () => { if (!S.spinning) drawWheel(); });

$('#datafail-btn').addEventListener('click', () => repairData());
const netState = () => { $('#offline').hidden = navigator.onLine !== false; };
addEventListener('online', () => { netState(); toast('✅ De vuelta en línea'); }); addEventListener('offline', netState); netState();
snow(); buildBulbs(); route(); renderAll(); tick(); maybeAskInstall();
try { if (sessionStorage.getItem('angelito:afterLogout') === 'reg') { sessionStorage.removeItem('angelito:afterLogout'); setTimeout(() => openAuth('reg'), 1200); } } catch { }

