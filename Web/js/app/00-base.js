/* Angelito de Navidad · la app (datos, pantallas y panel). Los juegos viven en juegos.js. */
import * as CFG from '../firebase-config.js';
const { firebaseConfig, ADMIN_EMAIL } = CFG; const VAPID_KEY = CFG.VAPID_KEY || '';
const APP_VERSION = '2026.11.13-114418';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, deleteUser, updatePassword, reauthenticateWithCredential, EmailAuthProvider, setPersistence, browserSessionPersistence, inMemoryPersistence } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { initGames, tileHTML } from './juegos.js';
import { decoratePanel, navHTML, pic, fillPics } from './panel.js';
import { runTransaction, deleteField, terminate, clearIndexedDbPersistence, getFirestore, getDocsFromServer, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, setDoc as fsSetDoc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit, writeBatch as fsWriteBatch, increment, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const buzz = n => { if (navigator.vibrate) try { navigator.vibrate(n); } catch { } }; // vibración corta (si el teléfono la tiene)
// 🎯 Solo cambia el dato que cambió. Dentro de las pantallas, al volver a dibujar algo NO se reemplaza todo:
// se compara con lo que ya está y se actualiza únicamente lo distinto (un texto, un número, un deseo nuevo…).
// Así las fotos no parpadean, no se pierde lo que estás escribiendo y la lista no «se recarga».
const KEY_ATTRS = ['id', 'data-mid', 'data-row', 'data-p', 'data-wmore', 'data-wstar', 'data-aped', 'data-pped', 'data-act', 'data-tile', 'data-gpick', 'data-hc', 'data-atab', 'data-ptab', 'data-ag'];
const keyOf = n => { if (n.nodeType !== 1) return null; for (const a of KEY_ATTRS) { const v = n.getAttribute(a); if (v) return n.tagName + '|' + a + '|' + v; } return null; };
function morphEl(from, to) {
  for (const a of [...from.attributes]) if (!to.hasAttribute(a.name) && !(a.name === 'open' && from.tagName === 'DETAILS') && !(a.name === 'style' && from.style.transform)) from.removeAttribute(a.name);
  for (const a of [...to.attributes]) if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value);
  if ((from.tagName === 'INPUT' || from.tagName === 'TEXTAREA') && from !== document.activeElement && to.hasAttribute('value') && from.value !== to.getAttribute('value')) from.value = to.getAttribute('value');
  if (from.tagName === 'TEXTAREA') { if (from !== document.activeElement && from.value !== to.value) from.value = to.value; return; }
  morphKids(from, to);
}
function morphKids(from, to) {
  const keyed = new Map(); for (const n of from.childNodes) { const k = keyOf(n); if (k) keyed.set(k, n); }
  const want = [...to.childNodes]; let j = 0;
  for (const nn of want) {
    const cur = from.childNodes[j], k = keyOf(nn);
    let m = null;
    if (k) m = keyed.get(k) || null;
    else if (cur && !keyOf(cur) && cur.nodeType === nn.nodeType && (cur.nodeType !== 1 || cur.tagName === nn.tagName)) m = cur;
    if (m) { if (m !== cur) from.insertBefore(m, cur || null); if (k) keyed.delete(k); if (m.nodeType === 1) morphEl(m, nn); else if (m.nodeValue !== nn.nodeValue) m.nodeValue = nn.nodeValue; }
    else from.insertBefore(document.importNode(nn, true), cur || null);
    j++;
  }
  while (from.childNodes.length > want.length) from.lastChild.remove();
}
(() => {
  const d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML'); if (!d?.set) return;
  Object.defineProperty(Element.prototype, 'innerHTML', { configurable: true, enumerable: d.enumerable, get() { return d.get.call(this); },
    set(v) {
      const s = String(v);
      if (!this.isConnected || !this.closest('.view') || this.__ih == null || this.tagName === 'TEMPLATE') { this.__ih = s; return d.set.call(this, s); }
      if (this.__ih === s) return; // igual que antes: no se toca nada
      this.__ih = s; const t = document.createElement('template'); d.set.call(t, s);
      try { morphKids(this, t.content); } catch (e) { console.warn('morph', e); d.set.call(this, s); }
    } });
  // Si un pedazo se reusa, un «escuchador» que se vuelve a poner reemplaza al anterior en vez de sumarse (nada se ejecuta dos veces)
  const add = EventTarget.prototype.addEventListener, rm = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opt) {
    if (this instanceof Element && typeof fn === 'function' && this.closest?.('.view')) {
      const m = this.__ls ||= new Map(), k = type + '|' + fn.toString().length + '|' + fn.toString().slice(0, 120), old = m.get(k);
      if (old) rm.call(this, type, old[0], old[1]); m.set(k, [fn, opt]);
    }
    return add.call(this, type, fn, opt);
  };
})();
const rowsOf = s => s.docs.map(d => ({ id: d.id, ...d.data() })); // documentos de una consulta como lista
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ms = t => !t ? 0 : typeof t.toMillis === 'function' ? t.toMillis() : typeof t === 'number' ? t : t.seconds != null ? t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6) : t.__t != null ? t.__t : t._ms != null ? t._ms : 0;
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const cap = t => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
// Nombres: lo que va entre paréntesis también empieza en mayúscula, p. ej. "Luis Miguel (Cristofel)"
const upParen = t => typeof t === 'string' ? t.replace(/\(\s*(\p{Ll})/gu, m => m.slice(0, -1) + m.slice(-1).toUpperCase()) : t;
const fixPerson = p => ({ ...p, name: upParen(p.name), first: upParen(p.first), last: upParen(p.last) });
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

/* ---------- 📡 sin internet: cada cambio se guarda en el teléfono y se sube solo cuando vuelve la conexión ----------
   (antes la app se quedaba «cargando» esperando al servidor; ahora sigue al instante) */
let offTip = 0;
function queued(p) {
  if (navigator.onLine !== false) return p;
  p.catch(e => { try { toast('⚠️ Un cambio no se pudo subir: ' + authErr(e)); } catch { } });
  return Promise.race([p, new Promise(r => setTimeout(r, 300))]).then(v => { if (Date.now() - offTip > 6000) { offTip = Date.now(); setTimeout(() => toast('💾 Guardado en tu teléfono · se sube al volver el internet'), 900); } return v; });
}
const setDoc = (...a) => queued(fsSetDoc(...a));
const writeBatch = d => { const b = fsWriteBatch(d), c = b.commit.bind(b); b.commit = () => queued(c()); return b; };
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
try { const b = JSON.parse(localStorage.getItem('angelito:boot:v1') || 'null'); if (b) { S.event = b.event || {}; S.participants = (b.participants || []).map(fixPerson); S.activities = b.activities || []; S.drawMeta = b.drawMeta || null; S.notices = b.notices || []; S.qCount = b.qCount || 0; } } catch { }
try { const lu = localStorage.getItem('angelito:lastUid'); if (lu && S.participants.some(p => p.id === lu)) { S.uid = lu; S.me = S.participants.find(p => p.id === lu); S.bootGuess = true; } } catch { }
const P = id => S.participants.find(p => p.id === id);
const pName = id => P(id)?.name || 'Alguien';
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
adivinaAngel: ['🕵️', '¿Quién es mi angelito? + gran revelación'], perfil: ['👕', 'Perfil de gustos'], gracias: ['💛', 'Recibí mi regalo + agradecimiento'], juegos: ['🎮', 'Juegos (dominó, X y O, ahorcado)'] };
const mod = k => k !== 'pistas' && (S.event.modules || {})[k] !== false; // las pistas del angelito se quitaron
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

