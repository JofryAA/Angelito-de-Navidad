/* ================= LOTE 3 ================= */

/* ---------- 🔠 letra grande ---------- */
// Se quitó el botón A+: si alguien lo tenía activado, se vuelve a la letra normal.
function applyBig() { document.documentElement.classList.remove('big'); try { localStorage.removeItem('angelito:big'); } catch { } }
applyBig();

/* ---------- 💛 recibí mi regalo + agradecimiento ---------- */
let unsubThx = null, thxFor = null;
function syncThanks() {
  // el agradecimiento de mi persona me llega por thanksFor/{sha256(mi token)}: nadie puede saber de quién a quién
  const k = S.assignment?.revealed ? S.assignment.k || (S.assignment.recipient && !S.assignment.vault ? 'r:' + S.assignment.recipient : null) : null;
  if (k === thxFor) return; thxFor = k;
  if (unsubThx) { unsubThx(); unsubThx = null; } S.thanksFromRec = null;
  if (k?.startsWith('r:')) unsubThx = onSnapshot(doc(db, 'thanks', k.slice(2)), s => { S.thanksFromRec = s.exists() ? s.data() : null; render(); }, () => { });
  else if (k) CF.sha256hex(k).then(h => { if (thxFor !== k) return; unsubThx = onSnapshot(doc(db, 'thanksFor', h), s => { S.thanksFromRec = s.exists() ? s.data() : null; render(); }, () => { }); });
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
    <label class="field"><span>¿Qué te gustaría?</span><textarea class="in" name="text" maxlength="500" required style="min-height:120px;resize:vertical">${esc(w.text)}</textarea></label>
    <label class="field"><span>Enlace de referencia <small class="muted">(opcional)</small></span><input class="in" name="link" type="url" maxlength="300" placeholder="https://…" value="${esc(w.link || '')}"></label>
    <label class="field"><span>Precio aproximado <small class="muted">(opcional)</small></span><input class="in" name="price" maxlength="30" placeholder="RD$1,500" value="${esc(w.price || '')}"></label>
    <div class="actions"><button type="button" class="btn" data-a="close">Cancelar</button><button class="btn gold" type="submit">Guardar</button></div></form>`);
  s2.onclick = e => { if (e.target.closest('[data-a=close]')) closeModal(); };
  $('#we-form', s2).addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, text = f.text.value.trim(), link = f.link.value.trim(), price = f.price.value.trim();
    if (!text) return toast('Escribe tu deseo');
    if (link && !/^https?:\/\//i.test(link)) return toast('El enlace debe empezar con https://');
    try { await setDoc(doc(db, 'wishes', id), { text, link, price, ed: serverTimestamp() }, { merge: true }); closeModal(); toast('✅ Deseo actualizado'); }
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
    const cur = S.wishPick?.wishId; S.wishPick = { wishId: cur === id ? '' : id };
    try { localStorage.setItem('angelito:wishPick:' + S.uid, JSON.stringify(S.wishPick)); } catch { } render();
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
/* ---------- 💬 chat estilo WhatsApp: deslizar para responder, mantener para seleccionar, reacciones por fuera ---------- */
const msgOf = id => S.chat.find(x => x.id === id);
const msgText = m => (m.hasImg && m.text === '📷 Foto') ? '📷 Foto' : m.text;
const canDelMsg = m => m.uid === S.uid || can('moderar');
async function reactTo(m, e) {
  if (!S.me || !m) return; const myR = (m.r || {})[S.uid]; buzz(12);
  try { await setDoc(doc(db, 'chat', m.id), { r: { [S.uid]: myR === e ? deleteField() : e } }, { merge: true }); } catch (err) { toast(authErr(err)); }
}
function replyTo(m) { if (!S.me || !m) return; S.replyTo = { id: m.id, uid: m.uid, text: m.text.slice(0, 100) }; renderReplyBar(); $('#c-text').focus(); }
async function copyMsgs(list) {
  const t = list.length === 1 ? list[0].text : list.map(m => `[${hm(new Date(ms(m.at) || m.ts || 0))}] ${shortName(P(m.uid)) || 'Alguien'}: ${msgText(m)}`).join('\n');
  return copyText(t, list.length > 1 ? `📋 ${list.length} mensajes copiados` : '📋 Texto copiado');
}
async function delMsgs(list) {
  if (!list.length || !list.every(canDelMsg)) return;
  if (!(await confirmBox(list.length > 1 ? `¿Eliminar ${list.length} mensajes?` : '¿Eliminar este mensaje?', 'Se borrará para todos.', 'Eliminar'))) return;
  try {
    const x = list.every(m => m.uid === S.uid) ? db : adb, w = writeBatch(x);
    list.forEach(m => { w.delete(doc(x, 'chat', m.id)); if (m.hasImg) w.delete(doc(x, 'chatImg', m.id)); });
    await w.commit(); toast(list.length > 1 ? 'Mensajes eliminados' : 'Mensaje eliminado');
  } catch (err) { toast(authErr(err)); }
}
// ✅ Selección de varios mensajes (mantener presionado)
S.chatSel = new Set();
function selToggle(id) {
  if (S.chatSel.has(id)) S.chatSel.delete(id); else S.chatSel.add(id);
  $(`#c-list [data-row="${CSS.escape(id)}"]`)?.classList.toggle('sel', S.chatSel.has(id)); syncSelBar();
}
function selClear() { if (!S.chatSel.size) return; S.chatSel.clear(); $$('#c-list .msg.sel').forEach(x => x.classList.remove('sel')); syncSelBar(); }
function syncSelBar() {
  [...S.chatSel].forEach(id => { if (!msgOf(id)) S.chatSel.delete(id); });
  const n = S.chatSel.size, bar = $('#c-selbar'); document.body.classList.toggle('csel', n > 0);
  if (!bar) return; bar.hidden = !n; if (!n) { bar.innerHTML = ''; return; }
  const list = [...S.chatSel].map(msgOf), one = n === 1 ? list[0] : null;
  bar.innerHTML = `<button type="button" class="sb-b" data-sb="x" aria-label="Cancelar selección">${ic('x', 20)}</button><b class="sb-n">${n}</b><span class="grow"></span>
    ${one && S.me ? `<button type="button" class="sb-b" data-sb="reply" aria-label="Responder">${ic('reply', 20)}</button><button type="button" class="sb-b" data-sb="react" aria-label="Reaccionar">😊</button>` : ''}
    <button type="button" class="sb-b" data-sb="copy" aria-label="Copiar">${ic('copy', 20)}</button>
    ${one && one.uid === S.uid ? `<button type="button" class="sb-b" data-sb="edit" aria-label="Editar">${ic('edit', 20)}</button>` : ''}
    ${list.every(canDelMsg) ? `<button type="button" class="sb-b danger" data-sb="del" aria-label="Eliminar">${ic('trash', 20)}</button>` : ''}`;
}
$('#c-selbar').addEventListener('click', async e => {
  const k = e.target.closest('[data-sb]')?.dataset.sb; if (!k) return;
  const list = [...S.chatSel].map(msgOf).filter(Boolean).sort((a, b) => S.chat.indexOf(a) - S.chat.indexOf(b));
  if (k === 'x') return selClear();
  selClear();
  if (k === 'copy') return copyMsgs(list);
  if (k === 'reply') return replyTo(list[0]);
  if (k === 'edit') return editMsg(list[0]);
  if (k === 'react') return openMsgMenu(list[0]);
  if (k === 'del') return delMsgs(list);
});
$('#c-back').addEventListener('click', e => { if (S.chatSel.size) { e.stopImmediatePropagation(); selClear(); } }, true);
addEventListener('hashchange', selClear);
// 👀 Quién reaccionó (tocando las reacciones debajo del mensaje)
function showReacts(m) {
  const rx = reactsFor(m.id), all = Object.entries(rx).flatMap(([e, us]) => us.map(u => [e, u])).sort((a, b) => (b[1] === S.uid) - (a[1] === S.uid));
  if (!all.length) return; let tab = '';
  const s2 = openModal(`<h3>Reacciones</h3>${chipTabs([['', 'Todas', all.length], ...Object.keys(rx).map(e => [e, e, rx[e].length])], '', 'rt')}<div class="rxw-list"></div><div class="actions"><button class="btn gold" data-a="x">Listo</button></div>`);
  const paint = () => {
    s2.querySelector('.rxw-list').innerHTML = all.filter(([e]) => !tab || e === tab).map(([e, u]) => `<div class="rxw-row ${u === S.uid ? 'me' : ''}" ${u === S.uid ? `data-rmx="${e}" role="button"` : ''}><span class="rxw-av">${esc(pEmoji(u))}</span><span class="grow"><b>${u === S.uid ? 'Tú' : esc(pName(u))}</b>${u === S.uid ? '<small>Toca para quitarla</small>' : ''}</span><span class="rxw-e">${e}</span></div>`).join('');
    s2.querySelectorAll('[data-rt]').forEach(b => b.classList.toggle('on', b.dataset.rt === tab));
  };
  paint();
  s2.onclick = ev => {
    const t = ev.target.closest('[data-rt]'); if (t) { tab = t.dataset.rt; return paint(); }
    const r = ev.target.closest('[data-rmx]'); if (r) { closeModal(); return reactTo(m, r.dataset.rmx); }
    if (ev.target.closest('[data-a]')) closeModal();
  };
}
// Al tocar un mensaje: se resalta con el fondo borroso, arriba las reacciones y abajo las opciones
function openMsgMenu(m) {
  if (!m || $('.cfocus')) return;
  const row = $(`#c-list [data-row="${CSS.escape(m.id)}"]`), bub = row?.querySelector('.bub');
  const mine = m.uid === S.uid, myR = (m.r || {})[S.uid], rn = Object.values(reactsFor(m.id)).flat().length;
  const acts = [S.me && ['reply', 'reply', 'Responder'], !(m.hasImg && m.text === '📷 Foto') && ['copy', 'copy', 'Copiar'], ['sel', 'check', 'Seleccionar'],
    ['seen', 'check', `Visto por ${seenBy(m).length} de ${Math.max(0, S.participants.length - 1)}`], rn && ['rx', 'users', `Ver reacciones (${rn})`], mine && ['edit', 'edit', m.hasImg ? 'Editar comentario' : 'Editar'],
    canDelMsg(m) && ['del', 'trash', mine ? 'Eliminar' : 'Eliminar · moderador']].filter(Boolean);
  const ov = document.createElement('div'); ov.className = 'cfocus' + (mine ? ' me' : '');
  ov.innerHTML = `<div class="cf-col">
    ${S.me ? `<div class="cf-rx">${REACTS.map((e, i) => `<button type="button" data-re="${e}" class="${myR === e ? 'on' : ''}" style="--i:${i}" aria-label="Reaccionar ${e}">${e}</button>`).join('')}</div>` : ''}
    <div class="cf-msg msg ${mine ? 'me' : ''}">${bub ? bub.outerHTML : ''}</div>
    <div class="cf-menu">${acts.map(([k, icn, l]) => `<button type="button" data-ca="${k}" class="${k === 'del' ? 'danger' : ''}"><span>${esc(l)}</span>${ic(icn, 18)}</button>`).join('')}</div></div>`;
  document.body.appendChild(ov); requestAnimationFrame(() => ov.classList.add('on')); buzz(10);
  let after = null;
  const onPop = () => { removeEventListener('popstate', onPop); ov.classList.remove('on'); setTimeout(() => ov.remove(), 200); const f = after; after = null; if (f) setTimeout(f, 40); };
  try { history.pushState({ cf: 1 }, ''); } catch { }
  addEventListener('popstate', onPop);
  const done = f => { after = f; if (history.state?.cf) history.back(); else onPop(); };
  ov.addEventListener('click', e => {
    const r = e.target.closest('[data-re]'); if (r) return done(() => reactTo(m, r.dataset.re));
    const a = e.target.closest('[data-ca]')?.dataset.ca;
    if (!a) { if (!e.target.closest('.cf-msg')) done(); return; }
    done(() => ({ reply: () => replyTo(m), copy: () => copyMsgs([m]), sel: () => selToggle(m.id), seen: () => showSeen(m), rx: () => showReacts(m), edit: () => editMsg(m), del: () => delMsgs([m]) })[a]?.());
  });
}
// Gestos sobre la lista: deslizar a la derecha = responder · mantener = seleccionar · tocar = opciones
(() => {
  const L = $('#c-list'); let st = null, lpT = 0, suppress = 0;
  L.addEventListener('pointerdown', e => {
    const row = e.target.closest('.msg[data-row]'); if (!row || e.button > 0 || e.target.closest('.rxpill')) return;
    st = { row, id: row.dataset.row, x: e.clientX, y: e.clientY, dx: 0, sw: false, moved: false }; row.style.transition = 'none';
    clearTimeout(lpT); lpT = setTimeout(() => { if (!st || st.moved) return; st.lp = true; buzz(25); selToggle(st.id); }, 430);
  });
  L.addEventListener('pointermove', e => {
    if (!st || st.lp) return; const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (!st.sw && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) { st.moved = true; clearTimeout(lpT); }
    if (!st.sw && dx > 14 && Math.abs(dx) > Math.abs(dy) * 1.6 && S.me && !S.chatSel.size) st.sw = true;
    if (!st.sw) return;
    const t = Math.max(0, Math.min(dx * .75, 84)); st.dx = t; st.row.style.transform = `translateX(${t}px)`; st.row.classList.add('swiping');
    const ok = t > 56; if (ok !== st.row.classList.contains('swok')) { st.row.classList.toggle('swok', ok); if (ok) buzz(12); }
  });
  const up = () => {
    clearTimeout(lpT); if (!st) return;
    if (st.lp) suppress = Date.now();
    if (st.sw) { suppress = Date.now(); if (st.dx > 56) replyTo(msgOf(st.id)); }
    const row = st.row; row.style.transition = 'transform .25s cubic-bezier(.2,.9,.3,1.2)'; row.style.transform = ''; row.classList.remove('swiping', 'swok'); st = null;
  };
  L.addEventListener('pointerup', up); L.addEventListener('pointercancel', up);
  L.addEventListener('contextmenu', e => { if (e.target.closest('.msg[data-row]')) e.preventDefault(); });
  L.addEventListener('click', e => {
    if (suppress && Date.now() - suppress < 600) { suppress = 0; e.stopPropagation(); return; } suppress = 0;
    const px = e.target.closest('[data-rx]'); if (px && !S.chatSel.size) return showReacts(msgOf(px.dataset.rx));
    const row = e.target.closest('.msg[data-row]'); if (!row) return;
    if (S.chatSel.size) { e.stopPropagation(); return selToggle(row.dataset.row); }
    if (!e.target.closest('.bub') || e.target.closest('[data-cimg]')) return;
    openMsgMenu(msgOf(row.dataset.row));
  });
})();

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

