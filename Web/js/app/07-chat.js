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
  // el chat termina 12px arriba de la barra de escribir (medido sobre la barra real: nunca se tocan)
  // si en ese momento algo de la pantalla está difuminado o animándose, la barra «se ve» en otro sitio: se usa dónde DEBE estar
  const vh = visualViewport?.height || innerHeight, should = vh - (parseFloat(getComputedStyle(d).bottom) || 0) - d.offsetHeight, seen = d.getBoundingClientRect().top;
  const top = Math.abs(seen - should) > 40 ? should : seen;
  const h = Math.max(Math.round(vh * .3), Math.round(top - l.getBoundingClientRect().top - 12));
  if (Math.abs((parseFloat(l.style.height) || 0) - h) > 1) l.style.height = h + 'px';
}
addEventListener('resize', () => requestAnimationFrame(fitChat));
document.addEventListener('visibilitychange', () => { if (!document.hidden) [80, 400, 1200].forEach(t => setTimeout(fitChat, t)); });
addEventListener('scroll', () => requestAnimationFrame(fitChat), { passive: true }); // si la página se movió, el chat se vuelve a medir
addEventListener('hashchange', () => [60, 350, 900].forEach(t => setTimeout(fitChat, t))); // al entrar al chat se mide de nuevo cuando todo ya está en su sitio
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
  { const n = onlineIds().length, cc = $('#c-count'), h = navigator.onLine === false ? '<button type="button" class="onl off" data-online><i class="netdot off"></i>Sin conexión</button>' : `<button type="button" class="onl" data-online><i class="netdot on"></i>${n} en línea</button>`; if (cc.dataset.h !== h) { cc.dataset.h = h; cc.innerHTML = h; } }
  loadChatImgs();
  const sig = S.chat.map(m => m.id + (m.edited ? 'e' + m.text.length + m.text.slice(-4) : '') + (m.pending ? '~' : '') + (m.hasImg && S.chatImgs[m.id] ? 'i' : '')).join() + S.participants.length + (S.isAdmin ? 'a' : '') + '|' + S.chat.map(m => JSON.stringify(m.r || {})).join() + '|' + onlineIds().join() + '|' + S.chat.filter(m => m.uid === S.uid).map(m => seenBy(m).length).join();
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
    const rx = reactsFor(m.id), rk = Object.keys(rx).sort((a, b) => rx[b].length - rx[a].length), rn = rk.reduce((a, e) => a + rx[e].length, 0);
    return `${sep}<div class="msg ${me ? 'me' : ''} ${cont ? 'cont' : ''} ${rn ? 'hasrx' : ''} ${S.chatSel?.has(m.id) ? 'sel' : ''}" data-row="${esc(m.id)}"><i class="swr">${ic('reply', 18)}</i><div class="av">${esc(pEmoji(m.uid))}${!me && isOnline(m.uid) ? '<i class="netdot on"></i>' : ''}</div><div class="bub ${tagMe ? 'tagged' : ''}" data-mid="${esc(m.id)}" data-mine="${me ? 1 : ''}">${me || cont ? '' : `<div class="nm" style="color:${nmColor(m.uid)}">${esc(shortName(P(m.uid)) || 'Alguien')}</div>`}${m.replyTo ? `<div class="quote">↩️ <b>${esc(shortName(P(m.replyTo.uid)) || '')}</b> ${esc(m.replyTo.text || '')}</div>` : ''}${m.hasImg ? (S.chatImgs[m.id] ? `<button type="button" class="cimg" data-cimg="${esc(m.id)}" aria-label="Ver foto"><img src="${S.chatImgs[m.id]}" alt=""></button>` : '<div class="cimg ld"></div>') : ''}${m.hasImg && m.text === '📷 Foto' ? '' : `<div class="mt">${mentionHTML(m)}</div>`}<div class="tm">${m.edited ? '<span class="edt">editado · </span>' : ''}${hm(d)}${me ? (m.pending ? ' <span title="Enviando…">🕓</span>' : (() => { const n = seenBy(m).length, all = S.participants.length - 1; return n && n >= all ? ' <span class="ok seen" title="Lo vieron todos">✓✓</span>' : n ? ` <span class="ok" title="Lo vieron ${n}">✓✓</span>` : ' <span class="ok" title="Enviado">✓</span>'; })()) : ''}</div>${rn ? `<button type="button" class="rxpill ${rk.some(e => rx[e].includes(S.uid)) ? 'me' : ''}" data-rx="${esc(m.id)}" aria-label="Ver reacciones">${rk.slice(0, 3).join('')}${rn > 1 ? `<b>${rn}</b>` : ''}</button>` : ''}</div></div>`;
  }).join('') : `<div class="empty" style="margin:auto"><span class="e">💬</span>Nadie ha escrito todavía.<br>¡Rompe el hielo! Toca 🎲 para una idea.</div>`;
  if (near || S.chatStick) { S.chatStick = false; l.scrollTop = l.scrollHeight; }
  syncSelBar();
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
/* ---------- 🔍 buscadores: recuerdan lo escrito aunque se toque un perfil o la pantalla se redibuje ---------- */
const QMEM = (() => { try { return JSON.parse(sessionStorage.getItem('angelito:q') || '{}'); } catch { return {}; } })();
const qSave = t => { if (!t?.matches?.('input.qs, input[type=search], #l-q, #sp-q') || !t.id) return; QMEM[t.id] = t.value; try { sessionStorage.setItem('angelito:q', JSON.stringify(QMEM)); } catch { } };
['input', 'change', 'compositionend', 'keyup'].forEach(ev => document.addEventListener(ev, e => qSave(e.target), true));
function qRestore() {
  document.querySelectorAll('input.qs, input[type=search], #l-q, #sp-q').forEach(i => {
    const v = QMEM[i.id]; if (!v || i.value || i.dataset.qr === v) return;
    i.dataset.qr = v; i.value = v; i.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
new MutationObserver(() => requestAnimationFrame(qRestore)).observe(document.body, { childList: true, subtree: true });
/* ---------- @menciones ---------- */
const mLabel = p => { const dup = S.participants.filter(x => normName(x.first) === normName(p.first)).length > 1; return dup ? `${p.first}${(p.last || '').charAt(0)}` : p.first; };
function mentionHTML(m) {
  let h = esc(m.text);
  if ((m.mentions || []).includes('all')) h = h.replace(/(^|\s)@todos\b/gi, '$1<b class="mention me">@todos</b>');
  for (const uid of (m.mentions || [])) { const p = P(uid); if (!p) continue; const lab = esc('@' + mLabel(p)); h = h.replace(new RegExp(lab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), `<b class="mention ${uid === S.uid ? 'me' : ''}">${lab}</b>`); }
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
  buzz(25);
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
  const im = e.target.closest('[data-cimg]'); if (!im || S.chatSel?.size) return; e.stopPropagation();
  viewImage(S.chatImgs[im.dataset.cimg]);
}, true);
$('#c-ngate').addEventListener('click', e => { if (e.target.closest('[data-nact]')) enableNotifications(); });
/* (toques del chat: ver «💬 chat estilo WhatsApp») */

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

