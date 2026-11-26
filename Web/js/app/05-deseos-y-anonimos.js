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
// 💬 comentarios de un deseo
const cmsOf = id => (S.wishComments || []).filter(c => c.wish === id);
function cmBtn(w) {
  const n = cmsOf(w.id).length;
  return `<button type="button" class="wsc-cm" data-wcm="${esc(w.id)}">💬 ${n ? `${n} ${n === 1 ? 'comentario' : 'comentarios'}` : 'Comentar'}</button>`;
}
function cmList(id) {
  const w = S.wishes.find(x => x.id === id), cs = cmsOf(id);
  if (!cs.length) return '<p class="muted small" style="text-align:center;margin:14px 0">Todavía no hay comentarios. Pregunta la talla, el color o lo que quieras saber 😉</p>';
  return cs.map(c => { const del = (c.uid && c.uid === S.uid) || w?.uid === S.uid || S.isAdmin;
    return `<div class="cm ${c.uid === S.uid ? 'me' : ''}"><span class="cm-av">${c.anon ? '🕶️' : esc(pEmoji(c.uid))}</span><div class="cm-b"><b>${c.anon ? 'Alguien (en secreto)' : esc(pName(c.uid))}${c.uid && c.uid === w?.uid ? ' <small class="cm-own">dueño del deseo</small>' : ''}</b><p>${esc(c.text)}</p><small class="muted">${ms(c.at) ? agoTxt(ms(c.at)) : 'enviando…'}</small></div>${del ? `<button type="button" class="cm-x" data-cmdel="${esc(c.id)}" aria-label="Borrar comentario">✕</button>` : ''}</div>`; }).join('');
}
function openWishComments(id) {
  const w = S.wishes.find(x => x.id === id); if (!w) return;
  const own = w.uid === S.uid; S.cmOpen = id;
  const m = openModal(`<h3>💬 Comentarios</h3><p class="muted small" style="margin:-4px 0 10px">${own ? 'Tu deseo' : `Deseo de ${esc(pName(w.uid))}`}: <b>${esc(w.text.slice(0, 90))}${w.text.length > 90 ? '…' : ''}</b></p>
    <div class="cm-list" id="cm-list">${cmList(id)}</div>
    <form id="cm-form" class="cm-form"><textarea class="in" id="cm-text" maxlength="300" rows="2" placeholder="${own ? 'Responde aquí…' : 'Escribe un comentario o pregunta…'}" required></textarea>
      ${own ? '' : `<button type="button" class="cm-sw" id="cm-anon" role="switch" aria-checked="false"><span class="cm-sw-ic">🙂</span><span class="cm-sw-t"><b>Comentar en secreto</b><small>Se verá tu nombre: ${esc(shortName(S.me) || 'tú')}</small></span><span class="cm-sw-k" aria-hidden="true"><i></i></span></button>`}
      <button class="btn gold" type="submit" id="cm-send">Enviar</button></form>`);
  const sw = $('#cm-anon', m);
  if (sw) sw.onclick = () => { const on = !sw.classList.contains('on'); sw.classList.toggle('on', on); sw.setAttribute('aria-checked', on);
    $('.cm-sw-ic', sw).textContent = on ? '🕶️' : '🙂';
    $('small', sw).textContent = on ? 'Nadie sabrá que fuiste tú, ni el organizador' : `Se verá tu nombre: ${shortName(S.me) || 'tú'}`;
    $('#cm-send', m).textContent = on ? '🕶️ Enviar en secreto' : 'Enviar'; };
  m.onclick = async e => {
    const x = e.target.closest('[data-cmdel]'); if (!x) return;
    if (!(await confirmBox('¿Borrar este comentario?', 'No se puede deshacer.', 'Borrar'))) { openWishComments(id); return; }
    try { const b = writeBatch(db); b.delete(doc(db, 'wishComments', x.dataset.cmdel)); await b.commit(); } catch (err) { toast(authErr(err)); } openWishComments(id);
  };
  $('#cm-form', m).addEventListener('submit', async e => {
    e.preventDefault(); const text = $('#cm-text', m).value.trim(); if (!text) return;
    const anon = !!$('#cm-anon', m)?.classList.contains('on'), btn = $('#cm-send', m); busy(btn, true);
    try { await setDoc(doc(collection(db, 'wishComments')), anon ? { wish: id, owner: w.uid, anon: true, text, at: serverTimestamp() } : { wish: id, owner: w.uid, uid: S.uid, anon: false, text, at: serverTimestamp() }); $('#cm-text', m).value = ''; }
    catch (err) { toast(authErr(err)); }
    busy(btn, false, anon ? '🕶️ Enviar en secreto' : 'Enviar');
  });
}
// 📰 todos los deseos juntos, lo más nuevo arriba (como publicaciones)
const wishFeedItems = () => S.wishes.filter(w => P(w.uid)).sort((a, b) => Math.max(ms(b.at), ms(b.ed)) - Math.max(ms(a.at), ms(a.ed))).slice(0, S.feedN || 30);
function wishFeed(items) {
  if (!items.length) return '<div class="card s2-empty"><b>Todavía no hay deseos</b><p class="muted small">Cuando alguien agregue uno, aparecerá aquí.</p></div>';
  return items.map((w, k) => { const img = w.hasImg && S.wishImgs[w.id], dom = /^https?:\/\//i.test(w.link || '') ? (w.link.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i)?.[1] || 'Ver enlace') : '', t = Math.max(ms(w.at), ms(w.ed)), last = cmsOf(w.id).slice(-1)[0], n = cmsOf(w.id).length, [we, wc] = wishArt(w.text, k);
    const media = img ? `<div class="wf-m" style="background-image:url('${img}')" data-wimg="${esc(w.id)}" role="button" aria-label="Ver foto"></div>`
      : w.auto || w.hasImg ? '<div class="wf-m ld"><i class="wsc-ld"></i></div>' : `<div class="wf-m art" style="--wa:${wc}"><span>${we}</span></div>`;
    return `<article class="wfeed"><header><span class="wf-av">${esc(pEmoji(w.uid))}</span><b class="wf-n">${esc(pName(w.uid))}</b><small>${t ? agoTxt(t) : ''}${w.top ? ' · ⭐' : ''}</small><button type="button" class="wf-go" data-wgo="${esc(w.uid)}">Su lista ›</button></header>
      <div class="wf-row">${media}<div class="wf-c"><div class="wf-t">${esc(w.text)}</div>${w.auto ? '<small class="wf-auto">⏳ Buscando foto y precio…</small>' : ''}
        <div class="wf-meta">${w.price ? `<span class="wf-price">${esc(w.price)}</span>` : ''}${dom ? `<a class="wsc-link" href="${esc(w.link)}" target="_blank" rel="noopener">${ic('link', 12)}<span>${esc(dom)}</span></a>` : ''}</div></div></div>
      <footer><button type="button" class="wf-cm" data-wcm="${esc(w.id)}">💬 ${n ? n : ''}</button>${last ? `<span class="wf-last" data-wcm="${esc(w.id)}"><b>${last.anon ? '🕶️ Alguien' : esc(pName(last.uid).split(' ')[0])}:</b> ${esc(last.text.slice(0, 90))}</span>` : '<span class="wf-last muted" data-wcm="'+esc(w.id)+'">Comentar…</span>'}</footer></article>`; }).join('') + (S.wishes.length > (S.feedN || 30) ? '<button type="button" class="btn" data-wfmore style="width:100%">Ver más deseos</button>' : '');
}
function renderWishes() {
  const root = $('#w-root');
  if (!S.me) { root.innerHTML = S.authReady ? needLogin('Entra para ver las listas de deseos y escribir la tuya.') : ''; return; }
  if (!S.wishPid || !P(S.wishPid)) S.wishPid = S.uid;
  const mine = S.wishPid === S.uid;
  const items = S.wishes.filter(w => w.uid === S.wishPid).sort((a, b) => (b.top ? 1 : 0) - (a.top ? 1 : 0));
  const isRec = !mine && S.assignment?.revealed && secretOpen() && S.assignment.recipient === S.wishPid;
  const keep = { t: $('#w-text')?.value || '', l: $('#w-link')?.value || '', p: $('#w-price')?.value || '', f: document.activeElement?.id };
  const many = S.participants.length > 8;
  // 🧈 sin «fricción»: ya no se reconstruye la pantalla entera en cada cambio; cada parte se toca solo si cambió de verdad
  //    (no se cortan el deslizamiento, la fila de personas, las fotos ni lo que estás escribiendo)
  if (root.__sk !== many || !$('#w-main')) { root.__sk = many; root.innerHTML = `<div id="w-sec"></div><div class="wtabs" id="w-tabs" role="tablist"></div><div id="w-listv">${many ? `<input class="in psearch" id="w-q" type="search" placeholder="🔍 Buscar a alguien…" autocomplete="off" value="${esc(S.wishQ || '')}">` : ''}<div class="pscroll" id="w-strip"></div><div id="w-main"></div><div id="w-formbox"></div></div><div id="w-feed" hidden></div>`; }
  setHTML($('#w-sec'), secBar());
  setHTML($('#w-strip'), wishStrip());
  setHTML($('#w-main'), `${wishHero(S.wishPid, mine, isRec, items)}
  ${items.length || mine ? `<div class="wl-h"><b>${mine ? 'Lo que me gustaría' : 'Lo que le gustaría'}</b><span>${items.length} ${items.length === 1 ? 'deseo' : 'deseos'}</span></div>` : ''}
  <div class="wshop">${items.length || mine ? items.map((w, k) => { const img = w.hasImg && S.wishImgs[w.id], dom = /^https?:\/\//i.test(w.link || '') ? (w.link.match(/^https?:\/\/(?:www\.)?([^/?#]+)/i)?.[1] || 'Ver enlace') : '', [we, wc] = wishArt(w.text, k);
    return `<article class="wsc ${w.top ? 'wtop' : ''}" style="--d:${k * 60}ms">
      <div class="wsc-pic ${img ? '' : 'art'}" style="${img ? `background-image:url('${img}')` : `--wa:${wc}`}" ${img ? `data-wimg="${esc(w.id)}" role="button" aria-label="Ver foto"` : ''}>
        ${img ? '' : w.auto || (w.hasImg && Date.now() - (wishImgTried.get(w.id) || Date.now()) <= 8000) ? `<i class="wsc-ld"></i>${w.auto ? '<span class="wsc-auto">⏳ Buscando foto y precio en la tienda…</span>' : ''}` : `<span class="wsc-e">${we}</span>`}
        ${w.top ? '<span class="wsc-top">⭐ Favorito</span>' : ''}
        ${w.price ? `<span class="wsc-price ${overBudget(w.price) ? 'over' : ''}">${esc(w.price)}</span>` : ''}
        ${w.uid === S.uid ? `<button class="wsc-star ${w.top ? 'on' : ''}" data-wstar="${esc(w.id)}" aria-label="Favorito">${ic('star', 16)}</button><button class="wsc-more" data-wmore="${esc(w.id)}" aria-label="Opciones"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>` : ''}
      </div>
      <div class="wsc-b"><div class="wsc-t">${esc(w.text)}</div>
        ${dom ? `<a class="wsc-link" href="${esc(w.link)}" target="_blank" rel="noopener">${ic('link', 12)}<span>${esc(dom)}</span></a>` : ''}
        ${overBudget(w.price) ? '<small class="wsc-warn">Pasa el presupuesto</small>' : ''}
        ${cmBtn(w)}
        ${isRec ? `<button class="wsc-buy ${S.wishPick?.wishId === w.id ? 'on' : ''}" data-wpick="${esc(w.id)}">${S.wishPick?.wishId === w.id ? '✓ Lo compro yo' : '🛒 Lo compro yo'}</button>` : ''}
      </div></article>`; }).join('') + (mine ? `<button class="wsc wsc-add" data-wadd><span>${ic('plus', 26)}</span><b>Agregar deseo</b><small>Con foto queda mejor</small></button>` : '')
    : `<div class="wempty"><div class="we-ic">🎁</div><b>${mine ? 'Tu lista está vacía' : esc(pName(S.wishPid)) + ' todavía no ha pedido nada'}</b><p class="muted small">${mine ? 'Agrega lo que te gustaría recibir: con foto y enlace tu angelito acierta seguro.' : isRec ? 'Mira su perfil de gustos para inspirarte 👆' : 'Vuelve más tarde 😉'}</p></div>`}</div>`);
  if (setHTML($('#w-formbox'), `${mine ? `<details class="wadd" id="w-add" ${S.wAddOpen ? 'open' : ''}><summary><span class="wa-ic">${ic('plus', 20)}</span><span><b>Agregar un deseo</b><small>Escríbelo o pega el enlace de la tienda</small></span><span class="wa-ch">${ic('back', 18)}</span></summary><form class="card stack" id="w-form">
    <div class="wi-chips">${WISH_IDEAS.map(([e, t]) => `<button type="button" class="wi-chip" data-widea="${esc(t)}">${e} ${t}</button>`).join('')}</div>
    <div class="wlink"><span class="wl-ic">🔗</span><input class="in" id="w-link" type="url" inputmode="url" maxlength="300" placeholder="Pega el enlace del producto (Amazon, Temu, Shein…)"></div>
    <p class="muted small wl-help">Con el enlace, la foto, el nombre y el precio se ponen solos en 1–2 minutos. ¿No lo tienes? Búscalo:
      <span class="wl-shops">${WSHOPS.map(([n, u]) => `<button type="button" class="wi-chip" data-wshop="${esc(u)}">${n}</button>`).join('')}</span></p>
    <textarea class="in" id="w-text" maxlength="500" rows="3" placeholder="Qué quieres: un libro de cocina, talla M, color azul… (si pegaste un enlace, puedes dejarlo vacío)" style="min-height:84px;resize:vertical"></textarea>
    <input class="in" id="w-price" maxlength="30" placeholder="Precio aprox. (opcional)">
    ${budgetMax() ? `<div class="wi-chips price"><small>Precio:</small>${[.5, .75, 1].map(f => Math.round(budgetMax() * f / 50) * 50).filter((v, i, a) => v > 0 && a.indexOf(v) === i).map(v => `<button type="button" class="wi-chip" data-wprice="RD$${v.toLocaleString('en-US')}">RD$${v.toLocaleString('en-US')}</button>`).join('')}</div>` : ''}
    ${S.wishDraftImg ? `<div class="wprev" style="background-image:url('${S.wishDraftImg}')"><button type="button" id="w-img-x" aria-label="Quitar foto">✕</button></div>`
      : `<div class="camrow"><label class="btn sm btn-ic">${ic('camera', 16)} Tomar foto<input type="file" class="w-img" accept="image/*" capture="environment" hidden></label><label class="btn sm btn-ic">${ic('image', 16)} Galería<input type="file" class="w-img" accept="image/*" hidden></label></div>`}
    <button class="btn gold" type="submit">✨ Agregar a mi lista</button></form></details>` : ''}`)) {
    $('#w-add')?.addEventListener('toggle', e => { S.wAddOpen = e.target.open; });
    if (mine) { $('#w-text').value = keep.t; $('#w-link').value = keep.l; $('#w-price').value = keep.p; if (keep.t) $('#w-add').open = true; }
    if (keep.f && /^w-(text|link|price)$/.test(keep.f) && $('#' + keep.f)) $('#' + keep.f).focus();
  }
  // 📰 pestañas: lista por persona / todos los deseos juntos (como publicaciones)
  setHTML($('#w-tabs'), [['list', '👤 Por persona'], ['feed', '📰 Todos']].map(([k, t]) => `<button type="button" role="tab" class="wtab ${S.wView === k ? 'on' : ''}" aria-selected="${S.wView === k}" data-wview="${k}">${t}</button>`).join(''));
  $('#w-listv').hidden = S.wView === 'feed'; $('#w-feed').hidden = S.wView !== 'feed';
  if (S.wView === 'feed') { const fi = wishFeedItems(); setHTML($('#w-feed'), wishFeed(fi)); loadWishImgs(fi); } else loadWishImgs(items);
  if (S.cmOpen && $('#cm-list')) { setHTML($('#cm-list'), cmList(S.cmOpen)); }
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
  S.wishQ = e.target.value; setHTML($('#w-strip'), wishStrip()); $('#w-strip').scrollLeft = 0;
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
// 🛒 buscar en la tienda con lo que escribiste (abre la tienda; luego se copia el enlace del producto)
const WSHOPS = [['🛒 Amazon', 'https://www.amazon.com/s?k='], ['🧡 Temu', 'https://www.temu.com/search_result.html?search_key='], ['👗 Shein', 'https://us.shein.com/pdsearch/'], ['🔴 AliExpress', 'https://www.aliexpress.com/wholesale?SearchText='], ['🔵 Walmart', 'https://www.walmart.com/search?q=']];
$('#w-root').addEventListener('click', e => {
  const v = e.target.closest('[data-wview]'); if (v) { S.wView = v.dataset.wview; renderWishes(); return; }
  const c = e.target.closest('[data-wcm]'); if (c) { openWishComments(c.dataset.wcm); return; }
  const g = e.target.closest('[data-wgo]'); if (g) { S.wishPid = g.dataset.wgo; S.wView = 'list'; renderWishes(); scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (e.target.closest('[data-wfmore]')) { S.feedN = (S.feedN || 30) + 30; renderWishes(); }
});
$('#w-root').addEventListener('click', e => { const b = e.target.closest('[data-wshop]'); if (!b) return; const q = $('#w-text')?.value.trim(); if (!q) { toast('Escribe primero qué quieres buscar'); $('#w-text')?.focus(); return; } open(b.dataset.wshop + encodeURIComponent(q.slice(0, 80)), '_blank', 'noopener'); toast('Cuando lo encuentres, copia el enlace y pégalo aquí 🔗'); });
$('#w-root').addEventListener('submit', async e => {
  e.preventDefault(); if (e.target.id !== 'w-form') return;
  let text = $('#w-text').value.trim(); const link = $('#w-link').value.trim();
  if (link && !/^https:\/\/\S+$/i.test(link)) return toast('El enlace debe empezar con https://');
  if (!text && !link) return toast('Escribe tu deseo o pega el enlace del producto');
  let autoText = false; if (!text) { autoText = true; text = 'Producto de ' + (link.match(/^https:\/\/(?:www\.|m\.)?([^/?#]+)/i)?.[1] || 'la tienda'); }
  const btn = e.target.querySelector('button[type=submit]') || e.target.querySelector('button'); busy(btn, true);
  try {
    const ref = doc(collection(db, 'wishes')), img = S.wishDraftImg, b = writeBatch(db);
    // 🔗 con enlace: el servidor completa foto, precio (y el nombre si no lo escribiste)
    const auto = !!link && (!img || autoText || !$('#w-price').value.trim());
    b.set(ref, { uid: S.uid, text, link, price: $('#w-price').value.trim(), ...(img ? { hasImg: true } : {}), ...(auto ? { auto: true } : {}), ...(autoText ? { autoText: true } : {}), at: serverTimestamp() });
    if (img) { b.set(doc(db, 'wishImg', ref.id), { uid: S.uid, data: img }); S.wishImgs[ref.id] = img; }
    await b.commit();
    S.wishDraftImg = null; $('#w-text').value = $('#w-link').value = $('#w-price').value = ''; toast(link && !img ? 'Deseo agregado 🎁 La foto y el precio aparecen en 1–2 minutos' : 'Deseo agregado 🎁'); renderWishes();
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
    b.set(doc(db, 'questionAuthors', qref.id), { box: await CF.sealForServer({ uid: S.uid, col: 'questionAuthors', id: qref.id, tok: await auth.currentUser.getIdToken() }) }); // 🔐 cifrado para la caja fuerte; se abre en la revelación
    b.set(doc(db, 'stats', 'questions'), { count: increment(1), last: qref.id }, { merge: true });
    await b.commit();
    $('#q-text').value = ''; toast('Mensaje guardado en secreto 🤫');
  } catch (err) { toast(authErr(err)); }
  busy(btn, false, '💌 Enviar anónimamente');
});

