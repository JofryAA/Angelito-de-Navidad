/* ---------- perfil de gustos ---------- */
const PROF = [['shirt', '👕', 'Talla de camisa/blusa', 'M'], ['pants', '👗', 'Talla de pantalón/falda', '32 / 8'], ['shoe', '👟', 'Talla de zapatos', '9'],
  ['colors', '🎨', 'Colores favoritos', 'Azul, verde'], ['likes', '💛', 'Me gusta', 'Café, libros, el béisbol…'],
  ['allergy', '⚠️', 'Alergias o cosas que no puedo usar', 'Perfumes fuertes, nueces…'], ['nogift', '🙅', 'Por favor no me regales', 'Tazas, medias…']];
const PROF_LONG = ['colors', 'likes', 'allergy', 'nogift']; // gustos: hasta 500 caracteres (tallas: 120)
const profDone = (uid = S.uid) => { const pr = S.profiles?.[uid] || {}; return PROF.filter(([k]) => String(pr[k] || '').trim()).length; };
function renderProfCard() {
  const box = $('#h-prof'); if (!box) return;
  if (!S.me || !mod('perfil')) { box.innerHTML = ''; return; }
  const n = profDone(); if (n >= 4) { box.innerHTML = ''; return; }
  box.innerHTML = `<button class="card profcard" id="prof-cta"><span class="pc-e">👕</span><span class="grow"><b>${n ? 'Termina tu perfil' : 'Completa tu perfil'}</b><span class="muted small">Tu angelito necesita tu talla, tus colores y lo que te gusta para acertar.</span>
    <span class="pbar2"><i style="width:${Math.round(n / PROF.length * 100)}%"></i></span><span class="small" style="color:var(--gold);font-weight:700">${n} de ${PROF.length} listos</span></span><span class="chev">›</span></button>`;
}
document.addEventListener('click', e => { if (e.target.closest('#prof-cta')) openProfile(); });
// Ilustración para deseos sin foto: emoji según lo que pidió y un color de fondo
const WISH_ART = [[/libro|biblia|novela|cuento/i, '📚'], [/perfume|colonia|fragancia/i, '🧴'], [/zapat|tenis|sandalia|chancleta/i, '👟'], [/camis|blusa|ropa|pantal|falda|vestid|suéter|sueter|abrigo|jacket/i, '👕'],
  [/caf[eé]|taza|termo/i, '☕'], [/aud[ií]fono|bocina|speaker|celular|tel[eé]fono|tablet|laptop|reloj inteligente|smartwatch|tecnolog/i, '🎧'], [/reloj/i, '⌚'], [/cartera|bolso|mochila/i, '👜'],
  [/chocolate|dulce|galleta|bomb[oó]n/i, '🍫'], [/maquillaje|labial|crema|skin|uñas/i, '💄'], [/juego|consola|play|nintendo|xbox/i, '🎮'], [/cocina|olla|sart[eé]n|licuadora/i, '🍳'],
  [/flor|planta/i, '🌸'], [/vino|whisky|ron\b|cerveza/i, '🍷'], [/cadena|arete|anillo|pulsera|collar|joya/i, '💍'], [/gorra|sombrero/i, '🧢'], [/pelota|bate|guante|b[eé]isbol|f[uú]tbol|basket/i, '⚾'], [/m[uú]sica|guitarra/i, '🎸']];
const WISH_COL = ['#f0a33a', '#d9466b', '#8a4ad8', '#3779de', '#1fa58f', '#2aa565'];
const wishArt = (t, k) => [(WISH_ART.find(([r]) => r.test(t)) || [0, '🎁'])[1], WISH_COL[k % WISH_COL.length]];
function wishHero(uid, mine, isRec, items) {
  const p = P(uid), col = nmColor(uid), pd = profDone(uid), pr = (mod('perfil') && S.profiles[uid]) || {}, v = k => String(pr[k] || '').trim();
  const list = k => v(k).split(/[;,\n/]|\s+-\s+|-| y /).map(x => x.trim()).filter(Boolean).slice(0, 8);
  const none = t => /^(n\/?a+|no+|ningun[oa]?|nada+|nop?e?)[.!]*$/i.test(t);
  const sizes = [['shirt', '👕', 'Camisa'], ['pants', '👖', 'Pantalón'], ['shoe', '👟', 'Zapatos']].filter(([k]) => v(k)).map(([k, e, l]) => `<div class="whs"><small>${e} ${l}</small><b>${esc(v(k))}</b></div>`).join('');
  const row = (lab, html) => `<div class="whr"><small>${lab}</small><div class="whc-row">${html}</div></div>`;
  const chips = (list('colors').length ? row('🎨 Colores favoritos', list('colors').map(c => `<span class="whc col">${esc(c)}</span>`).join('')) : '')
    + (list('likes').length ? row(`💛 ${mine ? 'Me gusta' : 'Le gusta'}`, list('likes').map(c => `<span class="whc">${esc(c)}</span>`).join('')) : '');
  const warn = [v('allergy') && !none(v('allergy')) ? `<small>⚠️ Alergias o cosas que no ${mine ? 'puedo' : 'puede'} usar</small>${esc(v('allergy'))}` : '', v('nogift') && !none(v('nogift')) ? `<small>🙅 Por favor no ${mine ? 'me' : 'le'} regales</small>${esc(v('nogift'))}` : ''].filter(Boolean);
  return `<section class="whero2" style="--hc:${col}">
    <div class="wh2-top"><div class="wh-av"><span>${esc(pEmoji(uid))}</span></div>
      <div class="grow wh-tx">${isRec ? '<span class="wh-tag">🎯 ¡Es tu persona!</span>' : ''}<b>${esc(mine ? 'Mi lista' : p?.name || '')}</b>
        <small>${items.length} ${items.length === 1 ? 'deseo' : 'deseos'}${S.event.budget ? ` · 💰 ${esc(S.event.budget)}` : ''}</small></div>
      ${mine ? `<div class="wh-act"><button class="whb" id="prof-icon" aria-label="Cambiar ícono">${esc(S.me.emoji)}</button>${mod('perfil') ? `<button class="whb ${pd < PROF.length ? 'pend' : ''}" id="prof-edit" aria-label="Mi perfil">${ic('shirt', 20)}</button>` : ''}</div>` : ''}</div>
    ${mod('perfil') && (sizes || chips || warn.length) ? `<div class="wh2-prof">${sizes ? `<div class="whs-row">${sizes}</div>` : ''}${chips}${warn.map(w => `<div class="whw">${w}</div>`).join('')}</div>`
      : mod('perfil') ? `<div class="wh2-prof empty">${mine ? `👕 Completa tu perfil (tallas, colores y gustos) para que tu angelito acierte · <b>${pd}/${PROF.length}</b>` : 'Todavía no ha llenado su perfil de gustos.'}</div>` : ''}
  </section>`;
}
function wishHeroOld(uid, mine, isRec, items) {
  const p = P(uid), col = nmColor(uid), pd = profDone(uid);
  return `<section class="whero" style="--hc:${col}">
    <div class="wh-av"><span>${esc(pEmoji(uid))}</span></div>
    <div class="grow wh-tx">${isRec ? '<span class="wh-tag">🎯 ¡Es tu persona!</span>' : mine ? '<span class="wh-tag me">Tu lista</span>' : ''}
      <b>${esc(mine ? 'Mi lista de deseos' : p?.name || '')}</b>
      <div class="wh-stats"><span>🎁 <b>${items.length}</b> ${items.length === 1 ? 'deseo' : 'deseos'}</span>${mod('perfil') ? `<span>👕 <b>${pd}/${PROF.length}</b> perfil</span>` : ''}${S.event.budget ? `<span>💰 ${esc(S.event.budget)}</span>` : ''}</div></div>
    ${mine ? `<div class="wh-act"><button class="whb" id="prof-icon" aria-label="Cambiar ícono">${esc(S.me.emoji)}<small>Ícono</small></button>${mod('perfil') ? `<button class="whb ${pd < PROF.length ? 'pend' : ''}" id="prof-edit">${ic('shirt', 20)}<small>Perfil</small></button>` : ''}</div>` : ''}
  </section>`;
}
function profileHtml(uid, compact) {
  const pr = S.profiles[uid]; if (!pr || !PROF.some(([k]) => pr[k])) return compact ? '' : (uid === S.uid ? '' : `<p class="muted small" style="margin:-4px 0 12px">Todavía no ha llenado su perfil de gustos.</p>`);
  if (compact) return `<div class="card" style="margin-bottom:14px;padding:14px"><div class="stack" style="gap:6px">${PROF.filter(([k]) => pr[k]).map(([k, e, l]) =>
    `<div class="small"><span class="muted">${e} ${esc(l)}:</span> <b>${esc(pr[k])}</b></div>`).join('')}</div></div>`;
  const v = k => String(pr[k] || '').trim(), list = k => v(k).split(/[;,\n]| y /).map(x => x.trim()).filter(Boolean).slice(0, 40);
  const sizes = [['shirt', '👕', 'Camisa'], ['pants', '👖', 'Pantalón'], ['shoe', '👟', 'Zapatos']].filter(([k]) => v(k));
  return `<section class="wprof">
    ${sizes.length ? `<div class="wp-sizes">${sizes.map(([k, e, l]) => `<div class="wp-size"><span>${e}</span><b>${esc(v(k))}</b><small>${l}</small></div>`).join('')}</div>` : ''}
    ${v('colors') ? `<div class="wp-row"><small>🎨 Colores favoritos</small><div class="wp-chips">${list('colors').map(c => `<span class="wp-chip color">${esc(c)}</span>`).join('')}</div></div>` : ''}
    ${v('likes') ? `<div class="wp-row"><small>💛 ${uid === S.uid ? 'Me gusta' : 'Le gusta'}</small><div class="wp-chips">${list('likes').map(c => `<span class="wp-chip like">${esc(c)}</span>`).join('')}</div></div>` : ''}
    ${v('allergy') && !/^(n\/?a|no|ninguna?|nada)$/i.test(v('allergy')) ? `<div class="wp-warn"><span>⚠️</span><div><small>${uid === S.uid ? 'Alergias o cosas que no puedo usar' : 'Alergias o cosas que no puede usar'}</small><b>${esc(v('allergy'))}</b></div></div>` : ''}
    ${v('nogift') ? `<div class="wp-warn no"><span>🙅</span><div><small>${uid === S.uid ? 'Por favor no me regales' : 'Por favor no le regales'}</small><b>${esc(v('nogift'))}</b></div></div>` : ''}
  </section>`;
}
function openProfile() {
  const pr = S.profiles[S.uid] || {};
  const s2 = openModal(`<h3>👕 Mi perfil de gustos</h3><p class="muted small">Ayuda a tu angelito a acertar. Todo es opcional.</p>
    <div class="stack" style="margin-top:12px">${PROF.map(([k, e, l, ph]) => `<label class="field"><span>${e} ${esc(l)}</span>${PROF_LONG.includes(k) ? `<textarea class="in" data-pf="${k}" maxlength="500" rows="2" placeholder="${esc(ph)}" style="min-height:64px;resize:vertical">${esc(pr[k] || '')}</textarea>` : `<input class="in" data-pf="${k}" maxlength="120" placeholder="${esc(ph)}" value="${esc(pr[k] || '')}">`}</label>`).join('')}</div>
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
      <select class="in" id="ag-sel"><option value="">Elige a alguien</option>${S.participants.filter(p => p.id !== S.uid && S.drawMeta.ids.includes(p.id)).map(p => `<option value="${esc(p.id)}" ${g === p.id ? 'selected' : ''}>${esc(p.emoji)} ${esc(p.name)}</option>`).join('')}</select>
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
    b.set(doc(collection(db, 'hints')), { to: S.assignment.recipient, text, ts: Math.floor(Date.now() / 600000) * 600000, ...(S.assignment.k ? { k: S.assignment.k } : {}) });
    b.set(doc(db, 'hintsSent', S.uid), { n: sent.length });
    await b.commit(); try { localStorage.setItem('angelito:hintsSent:' + S.uid, JSON.stringify(sent)); } catch { } S.hintsSent = sent; void 0; $('#h-text').value = ''; toast('💌 Pista enviada en secreto');
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
  // 🔐 las parejas solo las conoce la caja fuerte: se le pide que las abra (tarda hasta 2 minutos)
  try { await setDoc(doc(adb, 'reveal', 'main'), { want: true, at: serverTimestamp() }); toast('🔐 Abriendo la caja fuerte… las parejas aparecen en 1 o 2 minutos'); confetti(60); } catch (err) { toast(authErr(err)); }
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
async function copyText(t, msg = '📋 Copiado') {
  try { await navigator.clipboard.writeText(t); toast(msg); }
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
      <textarea class="in" id="s-text" maxlength="600" rows="3" placeholder="Ej. Que juguemos dominó después de la cena 🎲. Cuenta los detalles: cómo sería, qué hace falta, cuánto cuesta…" required></textarea>
      <input class="in" id="s-link" type="url" maxlength="300" inputmode="url" placeholder="🎬 Enlace de un video o ejemplo (YouTube, TikTok, Instagram…) · opcional" style="margin-top:8px">
      <div class="s-pics" id="s-pics"></div>
      <label class="btn sm s-addpic" id="s-addpic">📷 Agregar fotos (hasta 3)<input type="file" id="s-file" accept="image/*" multiple hidden></label>
      <p class="muted small" id="s-picnote" hidden>🕶️ Tu idea es anónima: revisa que la foto no te delate (tu cara, tu casa…).</p>
      <div class="idearow2"><button type="button" class="signsw" id="s-sign" role="switch" aria-checked="false" aria-label="Firmar con mi nombre"><span class="ss-av" id="s-av">🕶️</span><span class="ss-t"><b id="s-hint">Anónima</b><small id="s-sub">Nadie sabrá quién fue</small></span><span class="ss-tg" aria-hidden="true"><i></i></span></button>
      <button class="btn if-go" type="submit" id="s-go">${ic('send', 18)} Enviar idea</button></div></form>`;
  try { if (localStorage.getItem('angelito:signIdeas') === '1') setSign(true); } catch { }
  const list = $('#s-list');
  if (!S.me && !S.isAdmin) { setHTML(list, ''); return; }
  // 👍 me gusta / 👎 no me gusta (los votos viejos sin «v» cuentan como 👍). Ordena por la diferencia.
  const votes = id => S.sugVotes.filter(v => v.sug === id && (v.v ?? 1) > 0), nays = id => S.sugVotes.filter(v => v.sug === id && v.v === -1), score = id => votes(id).length - nays(id).length;
  const items = [...S.suggestions].sort((a, b) => score(b.id) - score(a.id) || votes(b.id).length - votes(a.id).length || sTs(b) - sTs(a));
  const max = Math.max(1, ...items.map(x => votes(x.id).length));
  setHTML(list, items.length ? `<div class="h2row" style="margin-top:0"><h2>Ideas del grupo</h2><span class="tag">${items.length} ${items.length === 1 ? 'idea' : 'ideas'}</span></div><p class="muted small" style="margin:-6px 0 12px">Vota 👍 si te gusta o 👎 si no: las mejores suben.</p><div class="stack">${items.map((x, k) => {
    const st = ST[x.status] || ST.nueva, vs = votes(x.id), ns = nays(x.id), mine = vs.some(v => v.uid === S.uid), mineN = ns.some(v => v.uid === S.uid), top = k < 3 && score(x.id) > 0;
    return `<div class="sug2 ${top ? 'top' : ''} s-${esc(x.status || 'nueva')}" style="--d:${Math.min(k, 8) * 50}ms;--v:${vs.length / max * 100}%">
      <div class="vote3"><button class="vote2 ${mine ? 'on' : ''}" data-svote="${esc(x.id)}" data-vv="1" ${S.me ? '' : 'disabled'} aria-label="Me gusta"><span class="v-th">👍</span><b>${vs.length}</b></button><button class="vote2 nay ${mineN ? 'on' : ''}" data-svote="${esc(x.id)}" data-vv="-1" ${S.me ? '' : 'disabled'} aria-label="No me gusta"><span class="v-th">👎</span><b>${ns.length}</b></button></div>
      <div class="s2-b"><div class="s2-top">${top ? `<span class="s2-rank">${['🥇', '🥈', '🥉'][k]} Top ${k + 1}</span>` : ''}${x.status && x.status !== 'nueva' ? `<span class="st2 ${esc(x.status)}">${st[0]} ${st[1]}</span>` : ''}</div>
        <div class="txt">${esc(x.text)}</div>
        <div class="s2-meta">${x.signed && x.uid ? `<span class="s2-av">${esc(pEmoji(x.uid))}</span>${esc(pName(x.uid))}` : '<span class="s2-av">🕶️</span>Anónima'}</div>
        <div class="s2-bar"><i></i></div>
        ${sugMedia(x)}
        ${can('moderar') ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${Object.entries(ST).map(([kk, v]) => `<button class="btn sm ${x.status === kk || (!x.status && kk === 'nueva') ? 'gold' : ''}" data-sst="${kk}" data-sid="${esc(x.id)}">${v[0]} ${v[1]}</button>`).join('')}<button class="btn sm" data-sdel="${esc(x.id)}">🗑️</button></div>` : ''}
      </div></div>`;
  }).join('')}</div>` : `<div class="card s2-empty"><div class="s2e-ic">💡</div><b>Todavía no hay ideas</b><p class="muted small">¡Sé el primero! Por ejemplo:</p><div class="if-chips" style="justify-content:center">${['🎲 Dominó después de la cena', '🎤 Karaoke de villancicos', '📸 Foto grupal con gorros'].map(t => `<span class="if-chip ghost">${t}</span>`).join('')}</div></div>`);
}
$('#s-formbox').addEventListener('click', e => {
  const st = e.target.closest('[data-sstart]');
  if (st) { const t = $('#s-text'); if (!t.value.startsWith(st.dataset.sstart)) t.value = st.dataset.sstart + t.value.replace(/^[^:]{1,20}: /, ''); t.focus(); t.setSelectionRange(t.value.length, t.value.length); return; }
  if (!e.target.closest('#s-sign')) return;
  const on = !$('#s-sign').classList.contains('on'); setSign(on);
  try { localStorage.setItem('angelito:signIdeas', on ? '1' : '0'); } catch { }
});
// 📷 fotos y 🎬 enlace de las ideas
let sugDraft = [];
const sugImgs = {}, sugTried = new Set();
function drawSugPics() {
  const box = $('#s-pics'); if (!box) return;
  box.innerHTML = sugDraft.map((d, i) => `<div class="s-pic" style="background-image:url('${d}')"><button type="button" class="x" data-sprm="${i}" aria-label="Quitar foto">✕</button></div>`).join('');
  $('#s-addpic').hidden = sugDraft.length >= 3;
  $('#s-picnote').hidden = !sugDraft.length || $('#s-sign').classList.contains('on');
}
function sugMedia(x) {
  let h = '';
  if (x.imgs) {
    for (let i = 0; i < Math.min(3, x.imgs); i++) { const k = `${x.id}__${i}`; if (!sugImgs[k] && !sugTried.has(k)) { sugTried.add(k); getDoc(doc(S.uid ? db : adb, 'sugImg', k)).then(d => { const v = String(d.data()?.data || '').replace(/[^A-Za-z0-9+/=:;,._-]/g, ''); if (v.startsWith('data:image/')) { sugImgs[k] = v; clearTimeout(drawSugPics.t); drawSugPics.t = setTimeout(render, 120); } }).catch(() => { }); } }
    h += `<div class="s2-imgs n${Math.min(3, x.imgs)}">${Array.from({ length: Math.min(3, x.imgs) }, (_, i) => { const v = sugImgs[`${x.id}__${i}`]; return `<button type="button" class="s2-img" ${v ? `data-simg="${x.id}__${i}" style="background-image:url('${v}')"` : 'disabled'} aria-label="Ver foto"></button>`; }).join('')}</div>`;
  }
  if (x.link && /^https:\/\//.test(x.link)) {
    let u = null; try { u = new URL(x.link); } catch { }
    if (u) {
      const yt = (u.hostname.replace(/^www\.|^m\./, '') === 'youtu.be' ? u.pathname.slice(1) : /youtube\.com$/.test(u.hostname) ? (u.searchParams.get('v') || (u.pathname.match(/\/(shorts|embed|live)\/([\w-]{6,})/) || [])[2]) : '') || '';
      const site = /tiktok/.test(u.hostname) ? 'TikTok' : /instagram/.test(u.hostname) ? 'Instagram' : /facebook|fb\.watch/.test(u.hostname) ? 'Facebook' : yt ? 'YouTube' : u.hostname.replace(/^www\./, '');
      h += `<a class="s2-link" href="${esc(u.href)}" target="_blank" rel="noopener noreferrer">${/^[\w-]{6,20}$/.test(yt) ? `<span class="s2-lthumb" style="background-image:url('https://i.ytimg.com/vi/${yt}/mqdefault.jpg')"><i>▶</i></span>` : '<span class="s2-lthumb"><i>▶</i></span>'}<span><b>Ver ${yt || /TikTok|Instagram|Facebook/.test(site) ? 'video' : 'enlace'}</b><small>${esc(site)}</small></span></a>`;
    }
  }
  return h;
}
$('#s-formbox').addEventListener('change', async e => {
  if (e.target.id !== 's-file') return;
  const files = [...e.target.files].filter(f => /^image\//.test(f.type)).slice(0, 3 - sugDraft.length); e.target.value = '';
  for (const f of files) { try { sugDraft.push(await shrink(f, 1000, .8, 150000)); } catch { toast('No se pudo leer una de las fotos'); } }
  drawSugPics();
});
$('#s-formbox').addEventListener('click', e => { const r = e.target.closest('[data-sprm]'); if (r) { sugDraft.splice(+r.dataset.sprm, 1); drawSugPics(); } });
$('#s-list').addEventListener('click', e => { const im = e.target.closest('[data-simg]'); if (im && sugImgs[im.dataset.simg]) viewImage(sugImgs[im.dataset.simg]); });
function setSign(on) {
  const t = $('#s-sign'); if (!t) return; t.classList.toggle('on', on); t.setAttribute('aria-checked', String(on));
  $('#s-av').textContent = on ? (S.me?.emoji || '🙂') : '🕶️';
  $('#s-hint').textContent = on ? 'Con mi nombre' : 'Anónima';
  $('#s-sub').textContent = on ? `Firmada: ${shortName(S.me) || 'tú'}` : 'Nadie sabrá quién fue';
  if ($('#s-picnote')) $('#s-picnote').hidden = on || !sugDraft.length;
}
$('#s-formbox').addEventListener('submit', async e => {
  e.preventDefault(); if (e.target.id !== 's-form') return;
  const text = $('#s-text').value.trim(); if (!text) return;
  const signed = $('#s-sign').classList.contains('on'), btn = $('#s-go'), label = btn.innerHTML; busy(btn, true);
  try {
    const b = writeBatch(db), ref = doc(collection(db, 'suggestions')); S.myCreated.add(ref.id);
    const ts = Math.floor(Date.now() / 3600e3) * 3600e3; // hora redondeada: no delata quién la escribió
    const link = ($('#s-link')?.value || '').trim(), imgs = sugDraft.slice(0, 3);
    if (link && !/^https:\/\/\S+$/.test(link)) { busy(btn, false, label); return toast('El enlace debe empezar con https://'); }
    const extra = { ...(link ? { link } : {}), ...(imgs.length ? { imgs: imgs.length } : {}) };
    b.set(ref, signed ? { text, signed: true, uid: S.uid, status: 'nueva', ts, ...extra } : { text, signed: false, status: 'nueva', ts, ...extra });
    imgs.forEach((data, i) => b.set(doc(db, 'sugImg', `${ref.id}__${i}`), { sug: ref.id, data })); // 📷 sin nombre: no delata a quien la mandó
    b.set(doc(db, 'suggestionAuthors', ref.id), { box: await CF.sealForServer({ uid: S.uid, col: 'suggestionAuthors', id: ref.id, tok: await auth.currentUser.getIdToken() }) }); // 🔐 cifrado: ni el organizador lo puede leer
    await b.commit(); $('#s-text').value = ''; $('#s-link').value = ''; sugDraft = []; drawSugPics(); toast('¡Gracias por tu sugerencia! 💡');
  } catch (err) { toast(authErr(err)); }
  busy(btn, false, label);
});
$('#s-list').addEventListener('click', async e => {
  const st = e.target.closest('[data-sst]'), del = e.target.closest('[data-sdel]'), vt = e.target.closest('[data-svote]');
  try {
    if (vt && S.me) {
      const id = `${vt.dataset.svote}__${esc(S.uid)}`;
      const want = +vt.dataset.vv || 1, cur = S.sugVotes.find(v => v.id === id);
      if (cur && (cur.v ?? 1) === want) { const w = writeBatch(db); w.delete(doc(db, 'sugVotes', id)); await w.commit(); } // tocar el mismo otra vez lo quita
      else await setDoc(doc(db, 'sugVotes', id), { sug: vt.dataset.svote, uid: S.uid, v: want, at: serverTimestamp() }); // o cambia de 👍 a 👎
    }
    if (st) await setDoc(doc(adb, 'suggestions', st.dataset.sid), { status: st.dataset.sst }, { merge: true });
    if (del && await confirmBox('¿Borrar esta sugerencia?', 'No se puede deshacer.', 'Borrar')) {
      const b = writeBatch(adb); b.delete(doc(adb, 'suggestions', del.dataset.sdel)); if (S.isOwner || can('moderar')) b.delete(doc(adb, 'suggestionAuthors', del.dataset.sdel));
      S.sugVotes.filter(v => v.sug === del.dataset.sdel).forEach(v => b.delete(doc(adb, 'sugVotes', v.id)));
      for (let i = 0; i < (S.suggestions.find(x => x.id === del.dataset.sdel)?.imgs || 0); i++) b.delete(doc(adb, 'sugImg', `${del.dataset.sdel}__${i}`));
      await b.commit();
    }
  } catch (err) { toast(authErr(err)); }
});

