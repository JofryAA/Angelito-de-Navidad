/* ---------- deseos ---------- */
// Presupuesto: toma el número más alto que aparezca ("RD$1,500 – 2,000" → 2000)
const numsIn = t => (String(t || '').replace(/(\d),(\d{3})/g, '$1$2').match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0);
const budgetMax = () => Math.max(0, ...numsIn(S.event.budget));
const overBudget = price => { const b = budgetMax(), p = Math.max(0, ...numsIn(price)); return b > 0 && p > b * 1.1; };
const WISH_IDEAS = [['👕', 'Ropa'], ['👟', 'Zapatos'], ['📚', 'Un libro'], ['🎧', 'Tecnología'], ['🧴', 'Perfume'], ['🍫', 'Dulces'], ['🏠', 'Para la casa'], ['💄', 'Cuidado personal'], ['🎮', 'Juegos'], ['⌚', 'Accesorios']];
// 🤫 La misma vista secreta de Inicio, arriba en Deseos: tu persona solo se ve con PIN (1 minuto)
function secBar() {
  const A = S.assignment; if (!mod('ruleta') || !drawReady() || !A?.revealed || !A.recipient || !P(A.recipient) || !S.drawMeta?.ids?.includes(S.uid)) return '';
  const R = P(A.recipient);
  return secretOpen() ? `<div class="secbar open"><span class="sb-e">${esc(R.emoji)}</span><div class="grow"><b>Le regalas a ${esc(R.name)}</b><small>Se oculta solo en 1 minuto</small></div><button class="btn sm gold" data-sec="list">🎁 Su lista</button><button class="btn sm" data-sec="lock" aria-label="Ocultar">🔒</button></div>`
    : `<div class="secbar"><span class="sb-e">🤫</span><div class="grow"><b>Tu persona es secreta</b><small>Nadie que mire tu teléfono puede saberlo</small></div><button class="btn sm gold" data-sec="unlock">🔐 Ver con PIN</button></div>`;
}
function renderWishes() {
  const root = $('#w-root');
  if (!S.me) { root.innerHTML = S.authReady ? needLogin('Entra para ver las listas de deseos y escribir la tuya.') : ''; return; }
  if (!S.wishPid || !P(S.wishPid)) S.wishPid = S.uid;
  const mine = S.wishPid === S.uid;
  const items = S.wishes.filter(w => w.uid === S.wishPid).sort((a, b) => (b.top ? 1 : 0) - (a.top ? 1 : 0));
  const isRec = !mine && S.assignment?.revealed && secretOpen() && S.assignment.recipient === S.wishPid;
  const keep = { t: $('#w-text')?.value || '', l: $('#w-link')?.value || '', p: $('#w-price')?.value || '', f: document.activeElement?.id, sl: $('#w-strip')?.scrollLeft || 0 };
  const many = S.participants.length > 8;
  root.innerHTML = `${secBar()}${many ? `<input class="in psearch" id="w-q" type="search" placeholder="🔍 Buscar a alguien…" autocomplete="off" value="${esc(S.wishQ || '')}">` : ''}
  <div class="pscroll" id="w-strip">${wishStrip()}</div>
  ${wishHero(S.wishPid, mine, isRec, items)}
  ${items.length || mine ? `<div class="wl-h"><b>${mine ? 'Lo que me gustaría' : 'Lo que le gustaría'}</b><span>${items.length} ${items.length === 1 ? 'deseo' : 'deseos'}</span></div>` : ''}
  <div class="wshop">${items.length || mine ? items.map((w, k) => { const img = w.hasImg && S.wishImgs[w.id], dom = /^https?:\/\//i.test(w.link || '') ? (w.link.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i)?.[1] || 'Ver enlace') : '', [we, wc] = wishArt(w.text, k);
    return `<article class="wsc ${w.top ? 'wtop' : ''}" style="--d:${k * 60}ms">
      <div class="wsc-pic ${img ? '' : 'art'}" style="${img ? `background-image:url('${img}')` : `--wa:${wc}`}" ${img ? `data-wimg="${esc(w.id)}" role="button" aria-label="Ver foto"` : ''}>
        ${img ? '' : w.hasImg && Date.now() - (wishImgTried.get(w.id) || Date.now()) <= 8000 ? '<i class="wsc-ld"></i>' : `<span class="wsc-e">${we}</span>`}
        ${w.top ? '<span class="wsc-top">⭐ Favorito</span>' : ''}
        ${w.price ? `<span class="wsc-price ${overBudget(w.price) ? 'over' : ''}">${esc(w.price)}</span>` : ''}
        ${w.uid === S.uid ? `<button class="wsc-star ${w.top ? 'on' : ''}" data-wstar="${esc(w.id)}" aria-label="Favorito">${ic('star', 16)}</button><button class="wsc-more" data-wmore="${esc(w.id)}" aria-label="Opciones"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>` : ''}
      </div>
      <div class="wsc-b"><div class="wsc-t">${esc(w.text)}</div>
        ${dom ? `<a class="wsc-link" href="${esc(w.link)}" target="_blank" rel="noopener">${ic('link', 12)}<span>${esc(dom)}</span></a>` : ''}
        ${overBudget(w.price) ? '<small class="wsc-warn">Pasa el presupuesto</small>' : ''}
        ${isRec ? `<button class="wsc-buy ${S.wishPick?.wishId === w.id ? 'on' : ''}" data-wpick="${esc(w.id)}">${S.wishPick?.wishId === w.id ? '✓ Lo compro yo' : '🛒 Lo compro yo'}</button>` : ''}
      </div></article>`; }).join('') + (mine ? `<button class="wsc wsc-add" data-wadd><span>${ic('plus', 26)}</span><b>Agregar deseo</b><small>Con foto queda mejor</small></button>` : '')
    : `<div class="wempty"><div class="we-ic">🎁</div><b>${mine ? 'Tu lista está vacía' : esc(pName(S.wishPid)) + ' todavía no ha pedido nada'}</b><p class="muted small">${mine ? 'Agrega lo que te gustaría recibir: con foto y enlace tu angelito acierta seguro.' : isRec ? 'Mira su perfil de gustos para inspirarte 👆' : 'Vuelve más tarde 😉'}</p></div>`}</div>
  ${mine ? `<details class="wadd" id="w-add" ${S.wAddOpen || keep.t ? 'open' : ''}><summary><span class="wa-ic">${ic('plus', 20)}</span><span><b>Agregar un deseo</b><small>Con foto, enlace y precio si quieres</small></span><span class="wa-ch">${ic('back', 18)}</span></summary><form class="card stack" id="w-form">
    <div class="wi-chips">${WISH_IDEAS.map(([e, t]) => `<button type="button" class="wi-chip" data-widea="${esc(t)}">${e} ${t}</button>`).join('')}</div>
    <input class="in" id="w-text" maxlength="160" placeholder="Ej. Un libro de cocina, talla M, color azul…" required>
    <div class="row"><input class="in" id="w-link" maxlength="300" placeholder="Enlace (opcional)"><input class="in" id="w-price" maxlength="30" placeholder="Precio aprox. (opcional)"></div>
    ${budgetMax() ? `<div class="wi-chips price"><small>Precio:</small>${[.5, .75, 1].map(f => Math.round(budgetMax() * f / 50) * 50).filter((v, i, a) => v > 0 && a.indexOf(v) === i).map(v => `<button type="button" class="wi-chip" data-wprice="RD$${v.toLocaleString('en-US')}">RD$${v.toLocaleString('en-US')}</button>`).join('')}</div>` : ''}
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
  const rec = S.assignment?.revealed && secretOpen() ? S.assignment.recipient : null; // sin PIN no se adelanta ni se marca
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
  const wi = e.target.closest('[data-widea]'); if (wi) { const t = $('#w-text'); if (!t.value.trim()) t.value = wi.dataset.widea + ': '; else if (!t.value.toLowerCase().includes(wi.dataset.widea.toLowerCase())) t.value = wi.dataset.widea + ': ' + t.value.replace(/^[^:]{1,20}: /, ''); t.focus(); t.setSelectionRange(t.value.length, t.value.length); return; }
  const wp = e.target.closest('[data-wprice]'); if (wp) { $('#w-price').value = wp.dataset.wprice; return; }
  const ws = e.target.closest('[data-wstar]'); if (ws) return toggleTop(ws.dataset.wstar);
  if (e.target.closest('[data-wadd]')) { S.wAddOpen = true; const d = $('#w-add'); if (d) { d.open = true; d.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTimeout(() => $('#w-text')?.focus(), 350); } return; }
  const im = e.target.closest('[data-wimg]'); if (!im) return;
  viewImage(S.wishImgs[im.dataset.wimg]);
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
    b.set(doc(db, 'questionAuthors', qref.id), { box: await CF.sealForServer({ uid: S.uid }) }); // 🔐 cifrado para la caja fuerte; se abre en la revelación
    b.set(doc(db, 'stats', 'questions'), { count: increment(1), last: qref.id }, { merge: true });
    await b.commit();
    $('#q-text').value = ''; toast('Mensaje guardado en secreto 🤫');
  } catch (err) { toast(authErr(err)); }
  busy(btn, false, '💌 Enviar anónimamente');
});

