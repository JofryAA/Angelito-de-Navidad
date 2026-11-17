/* ---------- ruleta ---------- */
function renderWheel() {
  const top = $('#r-top'), btn = $('#spinBtn'), msg = $('#r-msg');
  let canSpin = false; btn.style.display = '';
  if (!S.me) {
    top.innerHTML = S.authReady ? needLogin('Entra con tu nombre y tu PIN para girar.') : ''; btn.style.display = 'none'; msg.textContent = '';
  } else {
    top.innerHTML = `<div class="spinpass"><div class="sp-top"><span class="sp-av"><i></i><span>${esc(S.me.emoji)}</span></span><div class="grow"><small>Vas a girar como</small><b>${esc(S.me.name)}</b></div></div><div class="wc-st" id="wc-st"></div></div>${fixBanner()}`;
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
  if (fixOf()?.status === 'running' && Date.now() - +fixOf().at < 15 * 60e3) return toast('🔀 El ajuste se está aplicando. Espera un momento…');
  // Tras un ajuste, los términos y la privacidad van en UNA sola ventana (no dos listas seguidas)
  const fd = fixDone(), terms = fd && !a.revealed && !fixAccepted(fd); if (terms && !(await fixTerms(fd))) return;
  // Siempre (al girar y cada vez que quiera volver a verlo): confirmar privacidad + PIN
  if (!terms && !(await privacyGate(a.revealed))) return;
  if (!(await askPin(`Hola, ${S.me.first} 👋`, a.revealed ? 'Confirma tu PIN para ver de nuevo a quién te tocó.' : 'Confirma tu PIN para girar la ruleta.'))) return;
  openSecret(); // ya puso su PIN: en Inicio y Deseos se ve su persona 2 minutos sin pedirlo otra vez
  if (!a.revealed) {
    try { await setDoc(doc(db, 'assignments', S.uid), { revealed: true, revealedAt: serverTimestamp(), spunEver: true }, { merge: true }); /* spunEver: ningún ajuste lo borra */ }
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
    ${fixDone() ? `<span class="badge">🔀 Tu persona fue reasignada</span>` : ''}
    <p class="muted">${esc(S.me.first)}, ${fixDone() ? 'tu persona definitiva es…' : 'eres el angelito de…'}</p>
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
    closeModal(); if (x === 'list') { openSecret(); S.wishPid = rid; location.hash = 'deseos'; render(); }
  };
}

