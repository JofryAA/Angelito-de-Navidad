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
  unsubCore.push(onSnapshot(doc(db, 'config', 'event'), s => { S.event = s.exists() ? s.data() : {}; syncQuestions(); syncGuesses(); render(); checkRefresh(); checkRelogin(); }, coreRetry('event')));
  unsubCore.push(onSnapshot(doc(db, 'config', 'draw'), s => { S.drawMeta = s.exists() ? s.data() : null; render(); }, coreRetry('draw')));
  unsubCore.push(onSnapshot(collection(db, 'participants'), { includeMetadataChanges: true }, s => { // avisa también cuando el servidor confirma
    if (fromServer(s)) { SYNC.people = true; SYNC.tries = 0; }
    S.participants = s.docs.map(d => fixPerson({ id: d.id, ...d.data() })).sort((a, b) => ms(a.at) - ms(b.at));
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
  window.__dead = true; try { await terminate(db); await clearIndexedDbPersistence(db); } catch (e) { console.warn('repair', e); }
  try { localStorage.removeItem('angelito:boot:v1'); } catch { }
  location.reload();
}
// Vigilante: si hay internet y el servidor responde pero la lista en vivo no llega, la copia local está trabada → se repara sola (una vez).
let hcN = 0, hcNext = 0; // cada revisión al servidor espera el doble que la anterior (20 s → 40 s → … máx. 10 min)
async function healthCheck() {
  if (window.__dead || navigator.onLine === false || document.hidden || typeof getDocsFromServer !== 'function' || quotaOut()) return;
  const stuckPeople = !SYNC.people, stuckWishes = !!S.me && !SYNC.wishes && Date.now() - SYNC.wishesT0 > 9000;
  if (!stuckPeople && !stuckWishes) { $('#datafail').hidden = true; hcN = 0; hcNext = 0; return; }
  if (Date.now() < hcNext) return;
  hcNext = Date.now() + Math.min(600e3, 20e3 * 2 ** hcN++);
  let ok = false;
  try { const r = await getDocsFromServer(collection(db, 'participants')); ok = true; if (stuckPeople && !SYNC.people) { S.participants = r.docs.map(d => fixPerson({ id: d.id, ...d.data() })).sort((a, b) => ms(a.at) - ms(b.at)); S.me = S.uid ? P(S.uid) || null : null; render(); } } catch (e) { console.warn('health', e); if (quotaCheck(e)) return; }
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
// 🧯 Freno de cuota: si Firebase dice «se acabó la cuota de hoy» (resource-exhausted / 429), TODO se detiene
// 15 minutos (bots, latidos, reintentos) en vez de insistir y gastar más. Los juegos contra 🤖 siguen sin internet.
let quotaUntil = 0; try { quotaUntil = +localStorage.getItem('angelito:quota') || 0; } catch { }
const quotaOut = () => Date.now() < quotaUntil;
const isQuotaErr = e => /resource-exhausted|quota|429/i.test(String(e?.code || '') + ' ' + String(e?.message || ''));
function quotaCheck(e) {
  if (!isQuotaErr(e)) return false;
  if (!quotaOut()) { quotaUntil = Date.now() + 15 * 60e3; try { localStorage.setItem('angelito:quota', quotaUntil); } catch { } setTimeout(quotaBanner, 0); setTimeout(() => { quotaBanner(); if (auth.currentUser && S.me) { subRetries = 0; startUserSubs(auth.currentUser); } }, 15 * 60e3 + 500); }
  return true;
}
function quotaBanner() {
  let b = document.getElementById('quotabar');
  if (!quotaOut()) { b?.remove(); return; }
  if (!b) { b = document.createElement('div'); b.id = 'quotabar'; document.body.appendChild(b); }
  b.innerHTML = '⏳ Mucha actividad hoy: la app está en pausa unos minutos para no pasarse del límite gratis. Lo que ya ves sigue aquí y los juegos contra 🤖 funcionan.';
}
window.__quota = { out: quotaOut, check: quotaCheck };
if (quotaOut()) { setTimeout(quotaBanner, 1500); setTimeout(() => { quotaBanner(); try { beat(true); } catch { } }, quotaUntil - Date.now() + 500); } // al terminar la pausa el aviso se quita solo
const ufail = what => e => {
  console.warn(what, e);
  if (quotaCheck(e)) return; // sin cuota no se reintenta: se reanuda solo cuando pase el freno
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
    // 🔐 mi persona viene cifrada: se abre en este teléfono (caja fuerte) y queda solo en memoria
    CF.register(user.uid); let asSeq = 0;
    unsubUser.push(onSnapshot(doc(db, 'assignments', user.uid), s => { const n = ++asSeq, raw = s.exists() ? s.data() : null; CF.unlockAssignment(raw).then(a => { if (n !== asSeq) return; if (a?.boxErr) CF.register(user.uid, true); S.assignment = a; render(); }); }, ufail('assignment')));
    const rows = rowsOf;
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
    // 💸 cuota: el «en línea» y el «visto por» del grupo solo se escuchan con el chat abierto; siempre solo lo tuyo
    unsubUser.push(onSnapshot(doc(db, 'chatSeen', user.uid), s => { S.chatSeenAll = { ...(S.chatSeenAll || {}), [user.uid]: s.exists() ? +s.data().ts || 0 : 0 }; try { renderBadges(); } catch { } }, () => { }));
    unsubUser.push(() => liveGroup(false)); beat(true); setTimeout(liveGroupSync, 400);
    unsubUser.push(onSnapshot(doc(db, 'thanks', user.uid), s => { S.myThanks = s.exists() ? s.data() : null; render(); }, ufail('thanks')));
    // «Lo compro yo» se guarda SOLO en este teléfono: en la base revelaría a quién le regalas
    try { S.wishPick = JSON.parse(localStorage.getItem('angelito:wishPick:' + user.uid) || 'null'); } catch { S.wishPick = null; }
    getDoc(doc(db, 'wishPick', user.uid)).then(s => { if (!s.exists()) return; if (!S.wishPick && s.data().wishId) { S.wishPick = s.data(); try { localStorage.setItem('angelito:wishPick:' + user.uid, JSON.stringify(S.wishPick)); } catch { } } deleteDoc(doc(db, 'wishPick', user.uid)).catch(() => { }); render(); }).catch(() => { });
    unsubUser.push(onSnapshot(collection(db, 'memories'), s => { S.memories = rows(s); render(); }, ufail('memories')));
    unsubUser.push(onSnapshot(collection(db, 'profiles'), s => { S.profiles = Object.fromEntries(rows(s).map(x => [x.id, x])); render(); }, ufail('profiles')));
    unsubUser.push(onSnapshot(query(collection(db, 'hints'), where('to', '==', user.uid)), s => { S.hintsIn = rows(s); render(); }, ufail('hints')));
    // las pistas que mandaste: el texto solo en este teléfono; en la base solo cuántas (el texto revelaría a quién)
    try { S.hintsSent = JSON.parse(localStorage.getItem('angelito:hintsSent:' + user.uid) || '[]'); } catch { S.hintsSent = []; }
    unsubUser.push(onSnapshot(doc(db, 'hintsSent', user.uid), s => { const n = s.exists() ? (+s.data().n || (s.data().texts || []).length) : 0; if (S.hintsSent.length < n) S.hintsSent = [...S.hintsSent, ...Array(n - S.hintsSent.length).fill('(enviada desde otro teléfono)')]; if (!n) S.hintsSent = []; render(); }, ufail('hintsSent')));
    unsubUser.push(onSnapshot(doc(db, 'angelGuess', user.uid), s => { S.myAngelGuess = s.exists() ? s.data() : null; render(); }, ufail('angelGuess')));
    unsubUser.push(onSnapshot(doc(db, 'reveal', 'main'), s => { S.reveal = s.exists() && s.data().pairs ? s.data() : null; /* 🔐 mientras la caja fuerte abre las parejas, todavía no hay revelación */ syncAngelGuesses(); render(); }, ufail('reveal')));
    unsubUser.push(onSnapshot(doc(db, 'guesses', user.uid), s => { S.myGuess = s.exists() ? s.data() : null; render(); }, ufail('myGuess')));
    unsubUser.push(onSnapshot(query(collection(db, 'chat'), orderBy('ts', 'desc'), limit(120)), { includeMetadataChanges: true }, s => {
      // orden por la hora del SERVIDOR (no la del teléfono, que puede estar adelantada o atrasada); lo que aún no sube va al final con 🕓
      const t = m => ms(m.at) || (9e15 + (m.ts || 0)); // sin hora del servidor = aún no subió (va al final); una reacción pendiente NO mueve el mensaje
      S.chat = s.docs.map(d => { const x = d.data(); return { id: d.id, ...x, pending: !!d.metadata?.hasPendingWrites && !ms(x.at) }; }).sort((a, b) => t(a) - t(b));
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
  const rows = rowsOf;
  if (S.isOwner) {
    sub(doc(adb, 'drawRules', 'main'), s => { S.drawRules = s.exists() ? (s.data().pairs || []) : []; render(); }, 'drawRules');
    sub(doc(adb, 'adminState', 'draw'), s => { S.drawState = s.exists() ? s.data() : null; render(); }, 'drawState');
    sub(collection(adb, 'assignments'), s => { S.assignments = Object.fromEntries(s.docs.map(d => [d.id, d.data()])); render(); }, 'assignments');
    sub(collection(adb, 'suggestionAuthors'), s => { S.sugAuthors = Object.fromEntries(s.docs.filter(d => d.data().uid).map(d => [d.id, d.data().uid])); render(); }, 'sugauth'); // 🔐 cifrados: no se ven
    sub(collection(adb, 'guesses'), s => { S.adminGuesses = rows(s); render(); }, 'guesses-adm');
    sub(collection(adb, 'memories'), s => { if (!S.uid) S.memories = rows(s); render(); }, 'mem-adm');
    sub(doc(adb, 'reveal', 'main'), s => { S.reveal = s.exists() ? s.data() : null; syncAngelGuesses(); render(); }, 'reveal-adm');
    sub(collection(adb, 'history'), s => { S.history = rows(s).sort((x, y) => ms(y.at) - ms(x.at)); render(); }, 'history');
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

