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
/* ---------- 🟢 en línea: punto verde (conectado) o rojo (sin internet) en tu nombre, y quién más está conectado ---------- */
const netState = () => { document.body.classList.toggle('net-off', navigator.onLine === false); $$('.netdot').forEach(d => d.className = 'netdot ' + (navigator.onLine === false ? 'off' : 'on')); try { renderChat(); } catch { } beat(); };
addEventListener('online', netState); addEventListener('offline', netState);
const ONLINE_MS = 9 * 60e3; // «en línea» = dio señal en los últimos 9 minutos (la señal va cada 4: así se ahorra cuota)
const isOnline = uid => uid === S.uid ? navigator.onLine !== false && !document.hidden : !!(S.presence?.[uid]?.on && Date.now() - (S.presence[uid].ts || 0) < ONLINE_MS);
const onlineIds = () => S.participants.filter(p => isOnline(p.id)).map(p => p.id);
let beatT = 0, beatLast = 0;
function beat(force) { // «sigo aquí» cada 4 minutos mientras la app está a la vista
  clearTimeout(beatT); if (window.__dead || !S.me || navigator.onLine === false || quotaOut()) return;
  const on = !document.hidden;
  if (force || !on || Date.now() - beatLast > 235e3) { beatLast = Date.now(); fsSetDoc(doc(db, 'presence', S.uid), { ts: Date.now(), on, at: serverTimestamp() }).catch(quotaCheck); }
  if (on) beatT = setTimeout(beat, 240e3);
}
// Escuchas del grupo (en línea + visto por): se abren al entrar al chat y se cierran 20 s después de salir.
let groupUn = null, groupOffT = 0;
function liveGroup(on) {
  clearTimeout(groupOffT);
  if (on && !groupUn && S.me && !quotaOut()) {
    const err = e => { quotaCheck(e); groupUn?.(); groupUn = null; }; // si falla, se suelta para volver a abrirse
    const a = onSnapshot(collection(db, 'presence'), s => { S.presence = Object.fromEntries(s.docs.map(d => [d.id, { ts: +d.data().ts || 0, on: !!d.data().on }])); try { renderChat(); } catch { } }, err);
    const b = onSnapshot(collection(db, 'chatSeen'), s => { S.chatSeenAll = Object.fromEntries(s.docs.map(d => [d.id, +d.data().ts || 0])); try { renderChat(); renderBadges(); } catch { } }, err);
    groupUn = () => { a(); b(); };
  } else if (!on && groupUn) { groupUn(); groupUn = null; }
}
function liveGroupSync() {
  if (window.__dead) return;
  const want = !!S.me && !document.hidden && $('#v-buzon')?.classList.contains('on') && S.buz === 'c';
  if (want) liveGroup(true); else if (groupUn && !groupOffT) groupOffT = setTimeout(() => { groupOffT = 0; liveGroup(false); }, 20e3);
}
setInterval(liveGroupSync, 3000); document.addEventListener('visibilitychange', liveGroupSync); addEventListener('hashchange', () => setTimeout(liveGroupSync, 50));
document.addEventListener('visibilitychange', () => beat(true));
setInterval(() => { if (S.me && $('#v-buzon')?.classList.contains('on')) renderChat(); }, 60e3); // el «en línea» se apaga solo si alguien se va sin avisar
const agoTxt = t => { const m = Math.round((Date.now() - t) / 60e3); return m < 1 ? 'hace un momento' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : m < 2880 ? 'ayer' : `hace ${Math.round(m / 1440)} días`; };
async function showOnline() {
  if (!groupUn && !quotaOut()) try { const r = await getDocs(collection(db, 'presence')); S.presence = Object.fromEntries(r.docs.map(d => [d.id, { ts: +d.data().ts || 0, on: !!d.data().on }])); } catch (e) { quotaCheck(e); }
  const on = S.participants.filter(p => isOnline(p.id)).sort((a, b) => (b.id === S.uid) - (a.id === S.uid) || a.name.localeCompare(b.name, 'es'));
  const off = S.participants.filter(p => !isOnline(p.id)).sort((a, b) => (S.presence?.[b.id]?.ts || 0) - (S.presence?.[a.id]?.ts || 0));
  const row = (p, live) => `<div class="rxw-row"><span class="rxw-av on-av">${esc(p.emoji)}<i class="netdot ${live ? 'on' : 'off'}"></i></span><span class="grow"><b>${p.id === S.uid ? 'Tú' : esc(p.name)}</b><small>${live ? 'En línea' : S.presence?.[p.id]?.ts ? 'Se conectó ' + agoTxt(S.presence[p.id].ts) : 'Todavía no ha entrado'}</small></span></div>`;
  openModal(`<h3>🟢 En línea</h3><p class="muted small" style="margin-top:2px">${on.length} ${on.length === 1 ? 'persona conectada' : 'personas conectadas'} ahora</p>
    <div class="rxw-list" style="margin-top:10px">${on.map(p => row(p, true)).join('')}${off.length ? `<div class="hc-ttl" style="font-size:.85rem;margin:12px 4px 4px">Fuera de línea</div>${off.map(p => row(p, false)).join('')}` : ''}</div>
    <div class="actions"><button class="btn gold" data-a="x">Listo</button></div>`).onclick = e => { if (e.target.closest('[data-a]')) closeModal(); };
}
document.addEventListener('click', e => { if (e.target.closest('[data-online]')) { e.preventDefault(); e.stopPropagation(); showOnline(); } }, true);
netState();
snow(); buildBulbs(); route(); renderAll(); tick(); maybeAskInstall();
try { if (sessionStorage.getItem('angelito:afterLogout') === 'reg') { sessionStorage.removeItem('angelito:afterLogout'); setTimeout(() => openAuth('reg'), 1200); } } catch { }


/* ---------- 👉 gestos: la pantalla sigue al dedo y pasa a la pestaña de al lado · deslizar hacia abajo cierra las ventanas ---------- */
const visibleTabs = () => $$('.tab').filter(t => t.style.display !== 'none' && t.offsetParent !== null);
function goTab(dir) { // dir: +1 siguiente, -1 anterior
  const tabs = visibleTabs(), i = tabs.findIndex(t => t.classList.contains('on')), nx = tabs[i + dir];
  if (i < 0 || !nx) return false;
  document.body.dataset.swipe = dir > 0 ? 'l' : 'r'; clearTimeout(goTab.t); goTab.t = setTimeout(() => { delete document.body.dataset.swipe; }, 400);
  nx.click(); return true;
}
(() => {
  const NOSWIPE = 'input,textarea,select,button.tg,#c-list,.pscroll,.hand,.mesa,.ttt,.c4,.hkb,.wheel,canvas,iframe,.evmap,.wi-chips,.podium,.ctabs,.aseg,.ar-tabs,.hc-cats,[data-noswipe]';
  const scrollsX = el => { for (let n = el; n && n !== document.body; n = n.parentElement) { if (n.scrollWidth > n.clientWidth + 4 && /(auto|scroll)/.test(getComputedStyle(n).overflowX)) return true; } return false; };
  let st = null;
  const reset = (v, anim) => { if (!v) return; v.style.transition = anim ? 'transform .22s cubic-bezier(.2,.9,.3,1), opacity .22s' : ''; v.style.transform = ''; v.style.opacity = ''; if (anim) setTimeout(() => { v.style.transition = ''; }, 240); };
  document.addEventListener('touchstart', e => {
    st = null; if (e.touches.length !== 1) return;
    const t = e.target, view = t.closest?.('.view.on');
    if (!view || $('#modal').classList.contains('on') || $('.cfocus') || $('#tourx') || document.body.classList.contains('kb') || document.body.classList.contains('csel')) return;
    if (t.closest(NOSWIPE) || scrollsX(t) || ($('#v-juegos')?.classList.contains('ingame') && view.id === 'v-juegos')) return;
    const p = e.touches[0], tabs = visibleTabs(), i = tabs.findIndex(x => x.classList.contains('on'));
    st = { x: p.clientX, y: p.clientY, t: Date.now(), view, fixed: view.id === 'v-buzon', lock: null, dx: 0, canL: i >= 0 && i < tabs.length - 1, canR: i > 0 };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!st) return; const p = e.touches[0], dx = p.clientX - st.x, dy = p.clientY - st.y;
    if (!st.lock) { if (Math.abs(dx) > 22 && Math.abs(dx) > Math.abs(dy) * 2.2) st.lock = 'h'; else if (Math.abs(dy) > 8) { st = null; return; } else return; } // solo un gesto claramente de lado cambia de pestaña: al subir y bajar la pantalla no se «arrastra» hacia los lados
    const ok = dx < 0 ? st.canL : st.canR, k = ok ? .9 : .25; st.dx = dx; // sin pestaña a ese lado: se estira un poquito y vuelve
    st.view.style.transition = 'none'; if (!st.fixed) st.view.style.transform = `translateX(${dx * k}px)`; st.view.style.opacity = String(1 - Math.min(.35, Math.abs(dx * k) / 900));
  }, { passive: true });
  const end = () => {
    if (!st) return; const { view, dx, lock, t } = st, ok = dx < 0 ? st.canL : st.canR; st = null;
    if (lock !== 'h') return reset(view);
    const fast = Math.abs(dx) / Math.max(1, Date.now() - t) > .45;
    if (!ok || (Math.abs(dx) < 70 && !(fast && Math.abs(dx) > 30))) return reset(view, true);
    buzz(8);
    view.style.transition = 'transform .14s ease-in, opacity .14s ease-in'; if (view.id !== 'v-buzon') view.style.transform = `translateX(${dx < 0 ? '-38%' : '38%'})`; view.style.opacity = '0';
    setTimeout(() => { reset(view); goTab(dx < 0 ? 1 : -1); }, 130);
  };
  document.addEventListener('touchend', end, { passive: true }); document.addEventListener('touchcancel', () => { if (st) reset(st.view, true); st = null; }, { passive: true });
  // Ventanas (hojas de abajo): arrastrar hacia abajo para cerrar
  let sd = null; const sh = $('#sheet');
  // ¿El dedo está sobre una lista que se puede subir? Entonces se sube la lista, no se arrastra la ventana
  const innerScrolled = t => { for (let n = t; n && n !== sh; n = n.parentElement) { if (n.scrollHeight > n.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollTop > 2) return true; } return false; };
  sh.addEventListener('touchstart', e => { sd = null; if (S.spinning || S.forcePin || sh.scrollTop > 2 || innerScrolled(e.target) || e.target.closest('input,textarea,select,.wheel,canvas')) return; sd = { y: e.touches[0].clientY, x: e.touches[0].clientX, dy: 0 }; }, { passive: true });
  sh.addEventListener('touchmove', e => { if (!sd) return; if (innerScrolled(e.target) || Math.abs(e.touches[0].clientX - sd.x) > Math.abs(e.touches[0].clientY - sd.y)) { sh.style.transform = sh.style.opacity = ''; sd = null; return; } sd.dy = Math.max(0, e.touches[0].clientY - sd.y); if (sd.dy > 6) { sh.style.transition = 'none'; sh.style.transform = `translateY(${sd.dy}px)`; sh.style.opacity = String(Math.max(.4, 1 - sd.dy / 500)); } }, { passive: true });
  sh.addEventListener('touchend', () => {
    if (!sd) return; const dy = sd.dy; sd = null; sh.style.transition = 'transform .22s ease, opacity .22s ease';
    if (dy > 110) { sh.style.transform = 'translateY(100%)'; sh.style.opacity = '0'; setTimeout(() => { if (history.state?.sheet) history.back(); else closeModal(); sh.style.transform = sh.style.opacity = ''; }, 200); }
    else { sh.style.transform = sh.style.opacity = ''; }
  }, { passive: true });
})();
