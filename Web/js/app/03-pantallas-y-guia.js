/* ---------- routing ---------- */
const VIEWS = ['inicio', 'ruleta', 'deseos', 'actividades', 'anonimos', 'buzon', 'juegos', 'admin'];
const tabScroll = {}; let curView = null;
function route() {
  // las animaciones de entrada de listas solo al cambiar de pantalla (no cada vez que llegan datos nuevos)
  // la entrada animada de listas solo la primera vez que abre la app; al cambiar de pestaña la pantalla ya está lista (nada de «recargas»)
  if (!route.n) { route.n = 1; document.body.classList.add('anim-in'); route.t = setTimeout(() => { document.body.classList.remove('anim-in'); document.body.classList.add('navd'); }, 1100); } else document.body.classList.add('navd');
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
const GAMES = initGames({ db, fs: { doc, collection, onSnapshot, query, orderBy, limit, setDoc, getDoc, getDocs, writeBatch, runTransaction, where }, rt: { db: rdb, ref: rtRef, onValue: rtOnValue, update: rtUpdate, get: rtGet, push: rtPush, query: rtQuery, orderByChild: rtOrderByChild, limitToLast: rtLimitToLast, onDisconnect: rtOnDisconnect }, S, esc, toast, $, openModal, closeModal, confirmBox, render, confetti,
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
  box.innerHTML = S.me ? `<button class="userchip" id="ubtn"><span class="av">${esc(S.me.emoji)}<i class="netdot ${navigator.onLine === false ? 'off' : 'on'}"></i></span><span class="nm">${esc(shortName(S.me))}</span></button>` : `<button class="userchip login" data-auth="login">Entrar</button>`;
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
/* ---------- 📘 guía: cada vez que alguien inicia sesión recorre la app; la pantalla se oscurece y se ilumina lo que se explica ---------- */
const demoTiles = l => l.map(t => tileHTML(t)).join('');
const TOUR_DEMOS = {
  domino: () => `<div class="tdm tdm-dom"><div class="dd-chain">${demoTiles(['63', '33', '31'])}<span class="dd-new">${tileHTML('16')}</span></div><span class="dd-bub">🙅 Robertico pasa</span></div>`,
  ttt: () => `<div class="tdm tdm-ttt">${['X', 'O', 'X', '', 'X', 'O', 'O', '', 'X'].map((v, k) => `<i style="--d:${[0, .6, 1.2, 0, 1.8, 2.4, 3, 0, 3.6][k]}s">${v ? `<b class="${v}">${v === 'X' ? '✕' : '○'}</b>` : ''}</i>`).join('')}<span class="tt-line"></span></div>`,
  c4: () => `<div class="tdm tdm-c4">${Array.from({ length: 24 }, (_, k) => { const col = k % 6, row = Math.floor(k / 6), d = { 21: 0, 20: .5, 15: 1, 14: 1.5, 9: 2, 8: 2.5, 3: 3 }[k]; return `<i>${d != null ? `<b class="${[21, 15, 9, 3].includes(k) ? 'r' : 'y'}" style="--d:${d}s;--h:${row + 1}"></b>` : ''}</i>`; }).join('')}</div>`,
  hang: () => `<div class="tdm tdm-hang"><small>🎄 Navidad</small><div>${[...'ESTRELLA'].map((c, k) => `<i><b style="--d:${[0, 1.2, .4, 2, 0, 1.6, 1.6, .8][k]}s">${c}</b></i>`).join('')}</div></div>`,
  chat: () => `<div class="tdm tdm-chat"><span class="tc-arrow">↩</span><div class="tc-bub">¡Yo llevo el bizcocho! 🎂<span class="tc-rx">😂 3</span></div></div>`,
  mesa: () => `<div class="tdm tdm-mesa"><span>🙂<small>Tú</small></span><span class="inv">＋<small>Invitar</small></span><span class="bot">🤖<small>Robot</small></span><span class="bot">🤖<small>Robot</small></span></div>`,
};
const TOUR = () => [
  { c: 'Empezar', v: 'inicio', e: '🎁', t: `¡Bienvenido, ${S.me?.first || ''}!`, d: 'Te damos un paseo rápido por la app para que no se te escape nada. Toca <b>Siguiente</b>, o toca lo que se ilumina.' },
  { c: 'Empezar', v: 'inicio', s: '#tabs', e: '🧭', t: 'Las secciones', d: 'Abajo están todas las secciones. Toca una para entrar, o desliza la pantalla hacia un lado y pasas a la de al lado.' },
  { c: 'Empezar', v: 'inicio', s: '#help-btn', e: '❓', t: 'El botón de ayuda', d: 'Si te pierdes, toca el signo de pregunta. Te explica paso a paso lo que se puede hacer en la pantalla donde estás.' },
  { c: 'Empezar', v: 'inicio', s: '#userbox', e: '👤', t: 'Tu menú', d: 'Toca tu nombre para llenar tu perfil de gustos, escoger qué avisos te llegan, instalar la app o cerrar sesión.' },
  { c: 'Inicio', v: 'inicio', s: '#h-next:not(:empty), #h-todo:not(:empty)', e: '✅', t: 'Tus pendientes', d: 'Aquí te decimos lo que te falta: confirmar si vas, llenar tu perfil, escribir tus deseos. Tocas uno y te lleva directo.' },
  { c: 'Inicio', v: 'inicio', s: '#h-att:not(:empty)', e: '🎉', t: '¿Vas y das el aporte?', d: 'Confirma si vas. Si hay aporte para la comida, aquí ves cuánto es y cómo pagarlo, y tocas <b>Ya lo di</b> cuando lo entregues.' },
  { c: 'Inicio', v: 'inicio', s: '#h-evcard:not(:empty), #h-info:not(:empty)', e: '📍', t: 'Dónde y cuándo', d: 'La fecha, la hora y el lugar del angelito. Toca el mapa y se te abre la ruta en el teléfono.' },
  { c: 'Ruleta', m: 'ruleta', v: 'ruleta', s: '#spinBtn, #wheel', e: '🎡', t: 'La ruleta', d: 'Cuando el organizador haga el sorteo te llega un aviso. Pones tu PIN, giras y te sale a quién le regalas. Nadie más lo ve, ni el organizador.' },
  { c: 'Ruleta', m: 'ruleta', v: 'ruleta', e: '🛍️', t: 'Después de girar', d: 'En esta misma pantalla vas marcando cómo va tu regalo, dices quién crees que es tu angelito y, después de la fiesta, le das las gracias por lo que te regaló.' },
  { c: 'Deseos', m: 'deseos', v: 'deseos', s: '#w-strip', e: '👀', t: 'Las listas de todos', d: 'Toca el nombre de alguien y ves lo que le gustaría recibir, su talla y sus colores. Si es la persona que te tocó, marca <b>Lo compro yo</b> en el regalo que escojas.' },
  { c: 'Deseos', m: 'deseos', v: 'deseos', s: '[data-wadd], #w-add', e: '➕', t: 'Tu lista', d: 'Agrega lo que te gustaría recibir. Con una foto, el enlace de la tienda y el precio, tu angelito no falla. La estrella marca tu favorito.' },
  { c: 'Actividades', m: 'agenda', v: 'actividades', s: '#acts-root', e: '📅', t: 'Actividades', d: 'Lo que vamos a hacer en la fiesta: votaciones, trivias y el buzón anónimo, donde le escribes a alguien sin que sepa que fuiste tú.' },
  { c: 'Chat', m: 'chat', v: 'buzon', s: '#c-list', e: '💬', t: 'Los mensajes', d: 'Desliza un mensaje hacia la derecha para responderlo. Mantenlo presionado para seleccionar varios. Tócalo para reaccionar o ver quién lo vio.', demo: 'chat' },
  { c: 'Chat', m: 'chat', v: 'buzon', s: '#c-form', e: '✍️', t: 'Escribir', d: 'Pon @ y el nombre de alguien y le llega un aviso. El dado te da una ocurrencia y la cámara manda una foto. Sin internet se envía solo cuando vuelva la señal.' },
  { c: 'Ideas', m: 'buzon', v: 'sugerencias', s: '#s-formbox', e: '💡', t: 'Ideas', d: 'Propón juegos, comida o música para la fiesta, y vota por las ideas de los demás.' },
  { c: 'Juegos', m: 'juegos', v: 'juegos', s: '.gcreate2', e: '🎮', t: 'La sala de juegos', d: 'Cuatro juegos para jugar con el grupo o contra la máquina. Cada partida que ganas con el grupo suma puntos en la tabla de campeones.' },
  { c: 'Juegos', m: 'juegos', v: 'juegos', s: '[data-gpick=domino]', e: '🎲', t: 'Dominó', d: 'En parejas o cada quien solo, con las reglas de aquí: capicúa, pase de salida, pase corrido y tranque. Si no llevas ficha, la app pasa por ti y lo dice en voz alta.', demo: 'domino' },
  { c: 'Juegos', m: 'juegos', v: 'juegos', s: '[data-gpick=ttt]', e: '❌', t: 'X y O', d: 'Uno contra uno. Antes de empezar escoges si eres X u O. Gana el primero que haga tres en línea.', demo: 'ttt' },
  { c: 'Juegos', m: 'juegos', v: 'juegos', s: '[data-gpick=c4]', e: '🔴', t: '4 en línea', d: 'Tocas una columna y la ficha cae hasta abajo. Gana quien junte cuatro seguidas: de lado, de pie o en diagonal.', demo: 'c4' },
  { c: 'Juegos', m: 'juegos', v: 'juegos', s: '[data-gpick=ahorcado]', e: '🔤', t: 'Ahorcado', d: 'Escoges una categoría, como Biblia, cultura o Navidad. Cada letra que aciertas suma puntos, y si ya sabes la palabra la escribes completa y ganas más.', demo: 'hang' },
  { c: 'Juegos', m: 'juegos', v: 'juegos', e: '🪑', t: 'Cómo se arma una mesa', d: 'Creas la mesa y tocas un asiento libre para invitar a alguien: le llega un aviso. Los asientos vacíos los llena un robot. Cada turno tiene su tiempo y, si se te acaba, la app juega por ti.', demo: 'mesa' },
  { c: 'Juegos', m: 'juegos', v: 'juegos', e: '🔊', t: 'Música y sin internet', d: 'Cada juego tiene su música y una voz que canta las jugadas. Se apaga con el botón de la bocina. Sin internet también puedes jugar contra la máquina, y la partida se queda guardada en tu teléfono.' },
  { c: 'Listo', v: 'inicio', e: '🎉', t: '¡Ya conoces la app!', d: 'Ahora sí. Si quieres, empieza por aquí:', end: 1 },
];
function openTour() {
  if (!S.me) return;
  try { localStorage.setItem('angelito:tourAt:' + S.uid, String(Date.now())); localStorage.removeItem('angelito:tourLogin'); } catch { }
  $('#tourx')?.remove(); closeModal();
  const T = TOUR().filter(s => !s.m || mod(s.m)), chaps = [...new Set(T.map(s => s.c))], back = location.hash || '#inicio';
  let i = 0, target = null, tok = 0;
  const ov = document.createElement('div'); ov.id = 'tourx';
  ov.innerHTML = '<div class="tx-hole"><i class="tx-ring"></i></div><div class="tx-card" role="dialog" aria-live="polite"><i class="tx-arrow"></i><div class="tx-body"></div></div>';
  document.body.appendChild(ov); document.body.classList.add('touring');
  const hole = $('.tx-hole', ov), card = $('.tx-card', ov), body = $('.tx-body', ov), arrow = $('.tx-arrow', ov);
  const find = sel => sel && $$(sel).find(el => { const r = el.getBoundingClientRect(); return el.offsetParent !== null && r.width > 0 && r.height > 0; });
  function place() {
    const vw = innerWidth, vh = visualViewport?.height || innerHeight, cw = Math.min(420, vw - 24), ch = card.offsetHeight;
    card.style.width = cw + 'px'; card.style.left = Math.round((vw - cw) / 2) + 'px';
    if (!target) { hole.classList.add('off'); card.style.top = Math.max(16, Math.round((vh - ch) / 2)) + 'px'; arrow.hidden = true; return; }
    const r = target.getBoundingClientRect(), pad = 8;
    const x = Math.max(6, r.left - pad), y = Math.max(6, r.top - pad), w = Math.min(vw - 12, r.width + pad * 2), h = Math.min(vh - 12, r.height + pad * 2);
    hole.classList.remove('off'); Object.assign(hole.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    const below = y + h + 14, above = y - ch - 14; let top, up;
    if (below + ch < vh - 8) { top = below; up = true; } else if (above > 8) { top = above; up = false; } else { top = Math.max(8, vh - ch - 12); up = null; }
    card.style.top = Math.round(top) + 'px'; arrow.hidden = up == null; arrow.className = 'tx-arrow ' + (up ? 'up' : 'down');
    arrow.style.left = Math.max(18, Math.min(cw - 30, x + w / 2 - (vw - cw) / 2 - 8)) + 'px';
  }
  function paint() {
    const s = T[i], my = ++tok, last = i === T.length - 1;
    body.innerHTML = `<div class="tx-chaps">${chaps.map(c => `<button type="button" class="${c === s.c ? 'on' : chaps.indexOf(c) < chaps.indexOf(s.c) ? 'done' : ''}" data-tc="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="tx-top"><span class="tx-e">${s.e}</span><div class="grow"><small>Paso ${i + 1} de ${T.length}</small><b>${esc(s.t)}</b></div><button type="button" class="tx-x" data-t="close" aria-label="Cerrar la guía">✕</button></div>
      ${s.demo ? TOUR_DEMOS[s.demo]() : ''}<p>${s.d}</p>
      ${last ? `<div class="tx-end">${mod('perfil') ? `<button class="tx-go" data-t="prof"><span>👕</span><b>Llenar mi perfil</b><small>Para que tu angelito acierte</small></button>` : ''}${mod('deseos') ? `<button class="tx-go" data-t="wish"><span>🎁</span><b>Escribir mis deseos</b><small>Con dos o tres ideas basta</small></button>` : ''}<button class="tx-go" data-t="notif"><span>🔔</span><b>Activar los avisos</b><small>Para enterarte de todo</small></button></div>` : ''}
      <div class="tx-bar"><i style="width:${(i + 1) / T.length * 100}%"></i></div>
      <div class="tx-act">${i ? '<button class="btn ghost" data-t="prev">‹ Atrás</button>' : ''}<button class="btn gold" data-t="${last ? 'done' : 'next'}">${last ? '¡Vamos!' : 'Siguiente ›'}</button></div>`;
    card.classList.remove('in'); void card.offsetWidth; card.classList.add('in');
    $('.tx-chaps .on', body)?.scrollIntoView({ inline: 'center', block: 'nearest' });
    target = null; place();
    if (location.hash.slice(1) !== s.v) location.hash = s.v;
    setTimeout(() => {
      if (my !== tok) return; target = find(s.s) || null;
      if (target) { const r = target.getBoundingClientRect(); if (r.top < 70 || r.bottom > innerHeight - 90) target.scrollIntoView({ block: 'center' }); }
      setTimeout(() => { if (my === tok) place(); }, 60);
    }, location.hash.slice(1) === s.v ? 30 : 320);
  }
  const relayout = () => requestAnimationFrame(place);
  addEventListener('resize', relayout); addEventListener('scroll', relayout, true);
  const end = go => {
    removeEventListener('resize', relayout); removeEventListener('scroll', relayout, true); tok++;
    document.body.classList.remove('touring'); ov.classList.add('out'); setTimeout(() => ov.remove(), 220); location.hash = go || back;
    openModal.later = false;
  };
  const step = d => { i = Math.max(0, Math.min(T.length - 1, i + d)); paint(); };
  ov.addEventListener('click', e => {
    const c = e.target.closest('[data-tc]'); if (c) { const k = T.findIndex(s => s.c === c.dataset.tc); if (k <= i) { i = k; paint(); } return; } // se puede volver a un capítulo, no saltarse los que faltan
    const t = e.target.closest('[data-t]')?.dataset.t;
    if (!t) { if (e.target.closest('.tx-hole')) step(1); return; }
    if (t === 'close') return end(back); // ✕: la guía se cierra y no vuelve a salir (se puede abrir desde la ayuda)
    if (t === 'next') return step(1);
    if (t === 'prev') return step(-1);
    if (t === 'prof') { end('#inicio'); return setTimeout(openProfile, 300); }
    if (t === 'wish') return end('#deseos');
    if (t === 'notif') { end('#inicio'); return setTimeout(() => { try { enableNotifications(); } catch { } }, 300); }
    end('#inicio');
  });
  let x0 = null; card.addEventListener('pointerdown', e => { x0 = e.clientX; }); card.addEventListener('pointerup', e => { if (x0 == null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1); });
  paint();
}
let tourT = null;
function maybeTour() {
  if (!S.me || S.forcePin || tourT || window.__noTour) return; // __noTour: solo para pruebas automáticas
  // La guía sale: 1) a quien se registra por primera vez, 2) a todos cuando el organizador pide que todos vuelvan a entrar (una actualización)
  let seenAt = 0, isNew = false; try { seenAt = +localStorage.getItem('angelito:tourAt:' + S.uid) || 0; isNew = !!localStorage.getItem('angelito:tourLogin'); } catch { }
  const relog = ms(S.event.reloginAt); // solo cuentan los pedidos hechos desde que existe esta guía
  if (!isNew && !(relog > Date.parse('2026-11-15T18:20:00Z') && relog > seenAt)) return;
  tourT = setTimeout(function go() { tourT = null; if (!S.me) return; if ($('#modal').classList.contains('on') || S.spinning || S.forcePin || $('#tourx')) { tourT = setTimeout(go, 3000); return; } openTour(); }, 900);
}
/* ---------- lo que te toca ahora (cambia según el momento) ---------- */
// 🤫 Modo secreto: a quién le regalas NO se nota en ninguna parte (inicio, deseos, etiquetas, orden de la lista)
// a menos que pongas tu PIN. Se vuelve a ocultar al minuto o en cuanto sales de la app.
let secT = 0;
const secretOpen = () => Date.now() < (S.secretUntil || 0);
function openSecret() { S.secretUntil = Date.now() + 60e3; clearTimeout(secT); secT = setTimeout(lockSecret, 60e3); }
function lockSecret() { if (!S.secretUntil) return; S.secretUntil = 0; clearTimeout(secT); if (S.wishPid && S.wishPid === S.assignment?.recipient) S.wishPid = S.uid; render(); } // al ocultarse, Deseos vuelve a tu lista
async function unlockSecret() {
  if (!(await askPin('🤫 Ver tu persona', 'Confirma tu PIN. Se oculta sola en 1 minuto o al salir de la app.'))) return false;
  openSecret(); render(); return true;
}
document.addEventListener('visibilitychange', () => { if (document.hidden) lockSecret(); });
function renderNext() {
  const box = $('#h-next'); if (!box) return;
  if (!S.me) { box.innerHTML = ''; return; }
  const c = S.event, today = todayStr(), evDay = (c.eventDate || '').slice(0, 10);
  const A = S.assignment, ready = mod('ruleta') && S.drawMeta && drawReady() && S.drawMeta.ids?.includes(S.uid);
  let h = '';
  if (evDay && evDay === today) h = `<div class="card nextc"><div class="nx-e">🎉</div><div class="grow"><b>¡Hoy es el angelito!</b><div class="muted small">${c.place ? '📍 ' + esc(c.place) + ' · ' : ''}${esc(hm(new Date(c.eventDate)))}</div></div><a class="btn sm gold" href="#actividades">Ver agenda</a></div>`;
  else if (ready && !A?.revealed) h = `<a class="card nextc hot" href="#ruleta"><div class="nx-e spin">🎡</div><div class="grow"><b>¡Ya puedes girar la ruleta!</b><div class="muted small">Descubre a quién le vas a regalar.</div></div><span class="btn sm gold">Girar ahora</span></a>`;
  else if (ready && A?.revealed && A.recipient && P(A.recipient)) {
    const R = P(A.recipient), op = secretOpen();
    h = `<div class="card nextc ${op ? '' : 'sec-lock'}"><div class="nx-e">${op ? esc(R.emoji) : '🤫'}</div><div class="grow"><b>${op ? 'Le regalas a ' + esc(R.name) : 'Tu persona es secreta'}</b><div class="muted small">${op ? 'Se oculta solo en 1 minuto o al salir de la app.' : 'Nadie que mire tu teléfono puede saberlo: se ve solo con tu PIN.'}</div>
      <div class="qa" style="margin-top:8px">${op ? '<button class="btn sm gold" data-sec="list">🎁 Ver su lista</button><button class="btn sm" data-sec="lock">🔒 Ocultar</button>' : '<button class="btn sm gold" data-sec="unlock">🔐 Ver con PIN</button>'}${mod('pistas') ? '<a class="btn sm" href="#ruleta">💌 Mandar una pista</a>' : ''}</div></div></div>`;
  }
  box.innerHTML = h;
}
document.addEventListener('click', e => {
  const sa = e.target.closest('[data-sec]')?.dataset.sec;
  if (sa === 'unlock') unlockSecret();
  if (sa === 'lock') lockSecret();
  if (sa === 'list' && S.assignment?.recipient && secretOpen()) { S.wishPid = S.assignment.recipient; location.hash = 'deseos'; render(); }
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

  if (mod('estado') && S.assignment?.revealed && S.drawMeta?.ids?.includes(S.uid)) items.push([['comprado', 'envuelto'].includes(S.giftStatus[S.uid]), 'Compra el regalo de tu angelito', 'gs']);
  if (mod('ruleta') && S.drawMeta && drawReady() && S.drawMeta.ids.includes(S.uid)) items.unshift([!!S.assignment?.revealed, 'Gira la ruleta y descubre a quién le regalas', '#ruleta']);
  if (canNotify() && !(isIOS() && !isStandalone())) items.push([Notification.permission === 'granted', 'Activa los avisos para enterarte de todo', 'notif']);
  if (!isInstalled()) items.push([false, 'Pon el angelito en tu pantalla de inicio', 'install']);
  if (!items.length) { box.innerHTML = anon; return; }
  const done = items.filter(x => x[0]).length;
  if (done === items.length) { box.innerHTML = anon; return; } // todo completo: la tarjeta desaparece y no ocupa espacio
  const TI = { gs: ['gift', 'c4'], att: ['calcheck', 'c1'], '#deseos': ['gift', 'c2'], '#ruleta': ['wheel', 'c3'], notif: ['bell', 'c4'], install: ['install', 'c5'] };
  const ord = [...items.filter(x => !x[0]), ...items.filter(x => x[0])], pct = Math.round(done / items.length * 100);
  box.innerHTML = `<div class="card todo"><div class="todo-h"><b>Tus pendientes</b><span class="todo-n">${done}/${items.length}</span></div>
    <div class="tbar"><i style="width:${pct}%"></i></div>
    <div class="steps">${ord.map(([ok, l, go], k) => { const [icn, col] = TI[go] || ['check', 'c1']; return `<button class="step ${ok ? 'done' : ''}" data-todo="${go}" style="--d:${k * 60}ms"><span class="st-ic ${col}">${ok ? ic('check', 18) : ic(icn, 18)}</span><span class="st-l">${esc(l)}</span>${ok ? '' : `<span class="go">${ic('back', 16)}</span>`}</button>`; }).join('')}</div></div>` + anon;
}
document.addEventListener('click', e => {
  if (e.target.closest('#rules-more')) { S.rulesOpen = !S.rulesOpen; renderHome(); return; }
  const t = e.target.closest('[data-todo]'); if (!t) return;
  const go = t.dataset.todo;
  if (go === 'gs') { location.hash = 'ruleta'; setTimeout(() => $('#r-extra .stat4')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400); return; }
  if (go === 'att') $('#h-att')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); else if (go === 'perfil') openProfile(); else if (go === 'notif') enableNotifications(); else if (go === 'install') installApp(); else location.hash = go.slice(1);
});
// 🎄 Mensaje vivo debajo de la cuenta regresiva: cambia según lo que falte (y según cómo vas tú)
function cdMsg(d) {
  const days = Math.floor(d / 864e5), hrs = d / 36e5, gave = !!S.me && S.assignment?.revealed, st = S.giftStatus?.[S.uid];
  const bought = st === 'comprado' || st === 'envuelto', wished = !!S.me && S.wishes.some(w => w.uid === S.uid);
  if (d <= 0) return '🎉 ¡Llegó el día! Nos vemos en el angelito';
  if (hrs < 3) return '⏰ ¡Ya casi! Ve preparando el regalo y la sonrisa';
  if (days < 1) return gave && !bought ? '🛍️ ¡Es hoy! ¿Ya tienes el regalo? Todavía estás a tiempo' : '🎁 ¡Es hoy! ¿Ya envolviste el regalo?';
  if (days === 1) return '🌙 ¡Mañana es el angelito! Deja el regalo listo y envuelto';
  if (days <= 3) return gave && !bought ? `🛍️ Faltan ${days} días… ¿ya compraste el regalo?` : `🎀 Faltan ${days} días: ¿ya envolviste el regalo?`;
  if (days <= 7) return gave ? '🔍 Última semana: revisa la lista de deseos de tu persona' : '🎡 ¡Gira la ruleta y descubre a quién le regalas!';
  if (!wished && S.me) return `📝 Faltan ${days} días · escribe tu lista de deseos para que tu angelito acierte`;
  if (days <= 14) return `🎄 Faltan ${days} días: buen momento para ir pensando el regalo`;
  return `✨ Faltan ${days} días para el angelito`;
}
function tick() {
  const cands = [S.event.eventAt ? new Date(ms(S.event.eventAt)) : null, S.event.eventDate ? new Date(S.event.eventDate.length <= 10 ? S.event.eventDate + 'T00:00' : S.event.eventDate) : null];
  const t = cands.find(x => x && !isNaN(x) && x.getFullYear() > 2000) || null;
  const d = t ? Math.max(0, t - Date.now()) : null;
  const set = (k, v) => { const el = $(`[data-c="${k}"]`); if (el) el.textContent = v; };
  const cnt = $('.hero .count'), nd = $('#h-nodate');
  if (cnt) cnt.hidden = d == null; if (nd) nd.hidden = d != null;
  const msgEl = $('#h-cdmsg'); if (msgEl) { const m = d == null ? '' : cdMsg(d); if (msgEl.dataset.m !== m) { msgEl.dataset.m = m; msgEl.textContent = m; msgEl.classList.remove('in'); void msgEl.offsetWidth; msgEl.classList.add('in'); } msgEl.hidden = !m; }
  if (d == null) return;
  set('d', Math.floor(d / 864e5)); set('h', String(Math.floor(d / 36e5) % 24).padStart(2, '0'));
  set('m', String(Math.floor(d / 6e4) % 60).padStart(2, '0')); set('s', String(Math.floor(d / 1e3) % 60).padStart(2, '0'));
}
setInterval(tick, 1000);

