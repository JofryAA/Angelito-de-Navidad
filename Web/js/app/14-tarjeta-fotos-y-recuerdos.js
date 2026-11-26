/* ---------- 🖼️ tarjeta de invitación ---------- */
// Invitación (1080×1350, para WhatsApp e Instagram). Se dibuja al momento: la cuenta de días siempre es la de HOY.
async function makeInvite() {
  const c = S.event, W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d'), cx = W / 2;
  try { await Promise.all([document.fonts.load('900 90px Fraunces'), document.fonts.load('700 40px "DM Sans"'), document.fonts.load('500 40px "DM Sans"')]); } catch { }
  // fondo: rojo profundo con luz arriba y nieve suave
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#a3221d'); g.addColorStop(.6, '#5a110f'); g.addColorStop(1, '#0b1f17'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const rg = x.createRadialGradient(cx, 260, 40, cx, 260, 620); rg.addColorStop(0, 'rgba(255,215,140,.28)'); rg.addColorStop(1, 'rgba(255,215,140,0)'); x.fillStyle = rg; x.fillRect(0, 0, W, H);
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280; // nieve igual en cada tarjeta
  for (let i = 0; i < 110; i++) { x.fillStyle = `rgba(255,255,255,${.25 + rnd() * .55})`; x.beginPath(); x.arc(rnd() * W, rnd() * H, rnd() * 3.2 + .8, 0, 7); x.fill(); }
  // marco dorado fino
  x.strokeStyle = 'rgba(236,188,92,.55)'; x.lineWidth = 3; x.beginPath(); x.roundRect(40, 40, W - 80, H - 80, 36); x.stroke();
  // regalo dibujado (no emoji: se ve igual en todos los teléfonos)
  const gx = cx, gy = 172, gw = 170, gh = 120;
  x.fillStyle = '#e8463c'; x.beginPath(); x.roundRect(gx - gw / 2, gy, gw, gh, 16); x.fill();
  x.fillStyle = '#ff5a4f'; x.beginPath(); x.roundRect(gx - gw / 2 - 12, gy - 36, gw + 24, 44, 12); x.fill();
  x.fillStyle = '#f2c35f'; x.fillRect(gx - 14, gy - 36, 28, gh + 36); x.fillRect(gx - gw / 2 - 12, gy - 20, gw + 24, 17);
  x.strokeStyle = '#f2c35f'; x.lineWidth = 13; x.lineCap = 'round';
  x.beginPath(); x.ellipse(gx - 38, gy - 62, 36, 22, -.5, 0, 7); x.stroke(); x.beginPath(); x.ellipse(gx + 38, gy - 62, 36, 22, .5, 0, 7); x.stroke();
  x.fillStyle = '#f2c35f'; x.beginPath(); x.arc(gx, gy - 44, 14, 0, 7); x.fill();
  // textos
  x.textAlign = 'center';
  x.fillStyle = '#ffd99a'; x.font = '700 30px "DM Sans", sans-serif'; x.fillText('E S T Á S   I N V I T A D O   A L', cx, 365);
  const title = c.eventName || 'Angelito de Navidad'; x.fillStyle = '#fff7ec';
  let fs = 96; x.font = `900 ${fs}px Fraunces, serif`;
  const wrap = () => { const ws = title.split(' '), ls = ['']; ws.forEach(w => { const t = (ls[ls.length - 1] + ' ' + w).trim(); if (x.measureText(t).width > W - 200 && ls[ls.length - 1]) ls.push(w); else ls[ls.length - 1] = t; }); return ls; };
  let lines = wrap(); while (lines.length > 2 && fs > 60) { fs -= 6; x.font = `900 ${fs}px Fraunces, serif`; lines = wrap(); }
  lines.slice(0, 2).forEach((l, i) => x.fillText(l, cx, 470 + i * (fs + 4)));
  let y = 470 + Math.min(lines.length, 2) * (fs + 4) + 10;
  // datos en una cuadrícula de 2 columnas
  const start = c.eventAt ? new Date(ms(c.eventAt)) : c.eventDate ? new Date(c.eventDate.length <= 10 ? c.eventDate + 'T00:00' : c.eventDate) : null;
  const rows = [];
  if (start && !isNaN(start)) { rows.push(['FECHA', cap(start.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'long' }))]); if (start.getHours() || start.getMinutes()) rows.push(['HORA', hm(start)]); }
  if (c.place) rows.push(['LUGAR', c.place]);
  if (c.budget) rows.push(['REGALO DE', c.budget]);
  if (rows.length) {
    const L = 120, R = W - 120, colW = (R - L) / 2, nr = Math.ceil(rows.length / 2), ch = nr * 112 + 24;
    x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.roundRect(L, y, R - L, ch, 30); x.fill(); x.strokeStyle = 'rgba(255,255,255,.12)'; x.lineWidth = 2; x.stroke();
    x.fillStyle = 'rgba(255,255,255,.1)'; if (rows.length > 1) x.fillRect(L + colW, y + 24, 2, ch - 48); for (let r = 1; r < nr; r++) x.fillRect(L + 30, y + 12 + r * 112, R - L - 60, 2);
    rows.forEach(([k, v], i) => {
      const col = rows.length === 1 ? 0 : i % 2, row = Math.floor(i / 2), tx = rows.length === 1 ? cx : L + colW * col + colW / 2, ty = y + 58 + row * 112;
      x.textAlign = 'center'; x.fillStyle = '#ecbc5c'; x.font = '700 22px "DM Sans", sans-serif'; x.fillText(k, tx, ty);
      let f2 = 38; x.font = `600 ${f2}px "DM Sans", sans-serif`; while (x.measureText(v).width > colW - 40 && f2 > 24) { f2 -= 2; x.font = `600 ${f2}px "DM Sans", sans-serif`; }
      let t = v; while (x.measureText(t).width > colW - 40 && t.length > 4) t = t.slice(0, -2) + '…';
      x.fillStyle = '#fff'; x.fillText(t, tx, ty + 46);
    });
    y += ch + 30;
  }
  // cuenta regresiva por días de calendario (hoy → el día del evento)
  if (start && !isNaN(start)) {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0); const d1 = new Date(start); d1.setHours(0, 0, 0, 0);
    const d = Math.round((d1 - d0) / 864e5), room = H - 170 - y;
    const big = d > 1 ? String(d) : d === 1 ? '¡Mañana!' : d === 0 ? '¡Es hoy!' : '';
    if (big && room > 120) {
      const bs = Math.min(d > 1 ? 150 : 100, room - (d > 1 ? 60 : 10));
      x.textAlign = 'center'; x.fillStyle = '#ecbc5c'; x.font = `900 ${bs}px Fraunces, serif`; x.fillText(big, cx, y + bs * .85);
      if (d > 1) { x.fillStyle = '#ffe6bd'; x.font = '600 34px "DM Sans", sans-serif'; x.fillText('días para el angelito', cx, y + bs * .85 + 50); }
    }
  }
  // pie
  x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '500 28px "DM Sans", sans-serif'; x.fillText('Entra, inscríbete y arma tu lista de deseos', cx, H - 118);
  x.fillStyle = '#fff'; x.font = '700 36px "DM Sans", sans-serif'; x.fillText(location.host || 'angelito', cx, H - 72);
  return cv;
}
async function shareInvite() {
  toast('Creando tu invitación…');
  const cv = await makeInvite();
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  const file = new File([blob], 'invitacion-angelito.png', { type: 'image/png' });
  const text = `🎁 ¡Estás invitado al ${S.event.eventName || 'angelito'}! Entra aquí: ${location.origin + location.pathname}`;
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
  const url = URL.createObjectURL(blob);
  openModal(`<h3>Tu invitación</h3><p class="muted small">Se crea al momento con los días que faltan hoy. Mantén presionada la imagen para guardarla.</p><img src="${url}" alt="Invitación" style="width:100%;border-radius:16px;margin-top:10px;box-shadow:0 14px 40px rgba(0,0,0,.45)">
    <div class="qa" style="justify-content:center;margin-top:12px"><a class="btn sm btn-ic" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener" style="text-decoration:none">${ic('whatsapp', 18)} WhatsApp</a><button class="btn sm btn-ic" data-a="copy">${ic('link', 18)} Copiar enlace</button></div>
    <div class="actions"><a class="btn gold btn-ic" href="${url}" download="invitacion-angelito.png" style="text-decoration:none">${ic('download', 18)} Descargar</a><button class="btn" data-a="x">Cerrar</button></div>`).onclick = async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'copy') return copyText(text, '📋 Enlace copiado');
    closeModal(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
}
document.addEventListener('click', e => { if (e.target.closest('#q-inv')) shareInvite(); });

/* ---------- 📸 fotos ---------- */
let unsubPhotos = null;
function ensurePhotos() {
  if (unsubPhotos || !(S.me || S.isAdmin)) return;
  unsubPhotos = onSnapshot(query(collection(S.uid ? db : adb, 'photos'), orderBy('at', 'desc'), limit(36)), s => { S.photos = s.docs.map(d => ({ id: d.id, ...d.data() })); render(); }, () => { unsubPhotos = null; });
}
function shrink(file, max, q, lim) {
  return new Promise((res, rej) => {
    const img = new Image(); img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
      let qq = q, d = c.toDataURL('image/jpeg', qq); while (d.length > (lim || (max > 500 ? 900000 : 40000)) && qq > .3) { qq -= .1; d = c.toDataURL('image/jpeg', qq); }
      URL.revokeObjectURL(img.src); res(d);
    }; img.onerror = rej; img.src = URL.createObjectURL(file);
  });
}
function renderPhotos() {
  const box = $('#f-root'); if (!box) return;
  if (!S.me && !S.isAdmin) { box.innerHTML = S.authReady ? needLogin('Entra para ver y subir fotos.') : ''; return; }
  if ($('#v-buzon').classList.contains('on') && S.buz === 'f') ensurePhotos();
  const ps = S.photos || [];
  const up = S.uploading || 0;
  box.innerHTML = `${S.me ? `<div class="camrow"><label class="btn gold">📷 Tomar foto<input type="file" class="f-in" accept="image/*" capture="environment" hidden></label><label class="btn">🖼️ Galería<input type="file" class="f-in" accept="image/*" multiple hidden></label></div>` : ''}
    <p class="muted small center" style="margin:8px 0 14px">Las fotos se guardan en tamaño reducido para que el álbum sea gratis.</p>
    ${ps.length || up ? `<div class="pgrid">${'<div class="pth up">Subiendo…</div>'.repeat(up)}${ps.map(p => `<button class="pth" data-ph="${esc(p.id)}" style="background-image:url('${String(p.thumb || '').replace(/[^A-Za-z0-9+/=:;,._-]/g, '')}')" aria-label="Foto de ${esc(pName(p.uid))}"></button>`).join('')}</div>`
      : '<div class="card empty"><span class="e">📷</span>Todavía no hay fotos. ¡Sube la primera!</div>'}`;
}
document.addEventListener('change', async e => {
  if (!e.target.classList.contains('f-in')) return; const files = [...e.target.files].slice(0, 10); if (!files.length) return;
  S.uploading = (S.uploading || 0) + files.length; renderPhotos();
  let ok = 0;
  for (const f of files) {
    try {
      const [thumb, full] = await Promise.all([shrink(f, 260, .55), shrink(f, 1280, .72)]);
      const ref = doc(collection(db, 'photos')), b = writeBatch(db);
      b.set(ref, { uid: S.uid, thumb, caption: '', at: serverTimestamp() }); b.set(doc(db, 'photosFull', ref.id), { uid: S.uid, data: full });
      await b.commit(); ok++;
    } catch (err) { console.warn(err); toast(err?.code?.includes('quota') ? 'Se llenó el espacio del álbum' : 'No se pudo subir una foto'); }
    finally { S.uploading = Math.max(0, S.uploading - 1); renderPhotos(); }
  }
  if (ok) toast(`✅ ${ok} ${ok === 1 ? 'foto subida' : 'fotos subidas'}`);
  e.target.value = '';
});
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-ph]'); if (!b) return; const p = (S.photos || []).find(x => x.id === b.dataset.ph); if (!p) return;
  const s2 = openModal(`<div class="center"><img id="ph-big" src="${String(p.thumb || '').replace(/[^A-Za-z0-9+/=:;,._-]/g, '')}" alt="" style="width:100%;border-radius:14px"><p class="muted small" style="margin-top:8px">${esc(pEmoji(p.uid))} ${esc(pName(p.uid))}</p></div>
    <div class="actions">${(p.uid === S.uid || can('moderar')) ? '<button class="btn" data-a="del">🗑️ Borrar</button>' : ''}<button class="btn gold" data-a="x">Cerrar</button></div>`);
  try { const f = await getDoc(doc(S.uid ? db : adb, 'photosFull', p.id)); if (f.exists() && $('#ph-big', s2)) $('#ph-big', s2).src = String(f.data().data || '').replace(/[^A-Za-z0-9+/=:;,._-]/g, ''); } catch { }
  s2.onclick = async ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return; closeModal();
    if (a === 'del' && await confirmBox('¿Borrar esta foto?', 'Se borrará para todos.', 'Borrar')) {
      try { const x = p.uid === S.uid ? db : adb, w = writeBatch(x); w.delete(doc(x, 'photos', p.id)); w.delete(doc(x, 'photosFull', p.id)); await w.commit(); } catch (err) { toast(authErr(err)); }
    }
  };
});

/* ---------- 🎲 trivia + 🕵️ quién escribió (en vivo) ---------- */
function parseTrivia(txt) {
  return txt.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const parts = l.split('|').map(x => x.trim()); if (parts.length < 3) return null;
    const q = parts.shift(); let c = parts.findIndex(x => x.startsWith('*')); if (c < 0) c = 0;
    return { q, o: parts.slice(0, 4).map(x => x.replace(/^\*/, '').trim()), c: Math.min(c, 3) };
  }).filter(x => x && x.o.length >= 2);
}
const triviaText = list => list.map(t => [t.q, ...t.o.map((o, i) => (i === t.c ? '*' : '') + o)].join(' | ')).join('\n');
async function setLive(o) { try { await setDoc(doc(adb, 'party', 'live'), { ...o, ts: Date.now() }); } catch (e) { console.warn('live', e); } }

// teléfonos: tarjeta en vivo
function renderLive() {
  const box = $('#live'); if (!box) return;
  const L = S.live;
  if (!S.me || !L || !['anon', 'trivia'].includes(L.mode) || S.liveHide === (L.qid ?? L.qi) + L.mode) { box.classList.remove('on'); return; }
  box.classList.add('on');
  if (L.mode === 'anon') {
    const my = S.myLive[`a:${L.qid}`];
    box.innerHTML = `<div class="livehd"><b>🕵️ ¿Quién escribió este anónimo?</b><button class="x" data-lhide aria-label="Ocultar">▾</button></div>
      <div class="pq" style="font-size:1.15rem;margin:10px 0">${esc(L.text || '')}</div>
      ${L.open ? `<div class="chips" style="max-height:34vh;overflow:auto">${S.participants.map(p => `<button class="chip ${my === p.id ? 'on' : ''}" data-lv="${esc(p.id)}">${esc(p.emoji)} ${esc(shortName(p))}</button>`).join('')}</div>
        <p class="muted small" style="margin-top:8px">${my ? '✅ Votaste por ' + esc(pName(my)) + '. Puedes cambiarlo.' : 'Toca a quien creas que lo escribió.'}</p>`
        : `<p class="muted">⏳ Votación cerrada. ¡Mira la pantalla!</p>`}`;
  } else {
    const my = S.myLive[`t:${L.qi}`];
    box.innerHTML = `<div class="livehd"><b>🎲 Trivia · ${L.n || ''}/${L.total || ''}</b><button class="x" data-lhide aria-label="Ocultar">▾</button></div>
      <div style="font-weight:700;font-size:1.15rem;margin:10px 0">${esc(L.q || '')}</div>
      <div class="tvopts">${(L.o || []).map((o, i) => { const st = L.correct != null ? (i === L.correct ? 'ok' : (my === i ? 'bad' : '')) : (my === i ? 'on' : ''); return `<button class="tvo ${st}" data-ta="${i}" ${my != null || !L.open ? 'disabled' : ''}><b>${'ABCD'[i]}</b> ${esc(o)}</button>`; }).join('')}</div>
      <p class="muted small" style="margin-top:8px">${L.correct != null ? (my === L.correct ? '🎉 ¡Correcto!' : my != null ? '😅 Uy, no era esa.' : 'No respondiste a tiempo.') : my != null ? '✅ Respuesta enviada. ¡Espera el resultado!' : L.open ? '¡Rápido! Cuenta la velocidad.' : '⏳ Tiempo cerrado.'}</p>`;
  }
}
document.addEventListener('click', async e => {
  if (e.target.closest('[data-lhide]')) { const L = S.live; S.liveHide = (L.qid ?? L.qi) + L.mode; return renderLive(); }
  const v = e.target.closest('[data-lv]');
  if (v && S.live?.mode === 'anon') { const qid = S.live.qid; try { await setDoc(doc(db, 'anonVotes', `${qid}__${S.uid}`), { qid, uid: S.uid, choice: v.dataset.lv }); S.myLive[`a:${qid}`] = v.dataset.lv; renderLive(); } catch (err) { toast(authErr(err)); } }
  const t = e.target.closest('[data-ta]');
  if (t && S.live?.mode === 'trivia' && S.live.open) { const qi = S.live.qi, a = +t.dataset.ta; S.myLive[`t:${qi}`] = a; renderLive(); try { await setDoc(doc(db, 'triviaAns', `${qi}__${S.uid}`), { qi, uid: S.uid, a, t: serverTimestamp() }); } catch (err) { delete S.myLive[`t:${qi}`]; renderLive(); toast(err?.code?.includes('permission') ? 'Ya respondiste o se cerró el tiempo' : authErr(err)); } }
});

/* ---------- 📖 recuerdos + 🔁 nuevo año ---------- */
async function saveMemories() {
  if (!S.isOwner) return;
  if (!(await confirmBox('¿Guardar los recuerdos del año?', S.reveal ? 'Todos podrán verlos en Inicio, incluidas las parejas.' : 'Todavía no hiciste la gran revelación, así que las parejas NO se incluirán (para no arruinar la sorpresa). Puedes volver a guardar después de revelar.', 'Guardar'))) return;
  const c = S.event, year = (c.eventDate || '').slice(0, 4) || String(new Date().getFullYear());
  toast('Guardando recuerdos… 📖');
  const get = async n => { try { return (await getDocs(collection(adb, n))).docs.map(d => ({ id: d.id, ...d.data() })); } catch { return []; } };
  const [chat, sugs, sv, wishes, photos] = await Promise.all(['chat', 'suggestions', 'sugVotes', 'wishes', 'photos'].map(get));
  const nm = id => P(id)?.name || 'Alguien';
  const pairs = (S.reveal?.pairs || []).map(x => ({ g: nm(x.g), r: nm(x.r) }));
  const votes = S.activities.filter(a => a.kind === 'vote').map(a => {
    const vs = S.adminVotes.filter(v => v.act === a.id); const cnt = {}; vs.forEach(v => cnt[v.choice] = (cnt[v.choice] || 0) + 1);
    const best = Object.entries(cnt).sort((x, y) => y[1] - x[1])[0]; return best ? { title: a.title, winner: a.voteTarget === 'participants' ? nm(best[0]) : best[0], n: best[1] } : null;
  }).filter(Boolean);
  const qz = S.activities.find(a => a.kind === 'quiz' && a.resultsOpen && a.results?.[0]?.count), tw = qz ? [qz.results[0].key, qz.results[0].count] : null;
  const rc = {}; chat.forEach(m => { rc[m.id] = Object.keys(m.r || {}).length; });
  const topChat = chat.filter(m => rc[m.id]).sort((a, b) => rc[b.id] - rc[a.id]).slice(0, 3).map(m => ({ text: m.text.slice(0, 200), who: nm(m.uid), n: rc[m.id] }));
  const vc = {}; sv.forEach(v => vc[v.sug] = (vc[v.sug] || 0) + ((v.v ?? 1) > 0 ? 1 : -1)); // 👎 resta
  const topSugs = sugs.filter(x => vc[x.id] > 0).sort((a, b) => vc[b.id] - vc[a.id]).slice(0, 3).map(x => ({ text: x.text.slice(0, 200), n: vc[x.id] }));
  const mem = { year, eventName: c.eventName || 'Angelito', date: c.eventDate || '', place: c.place || '', people: S.participants.map(p => ({ name: p.name, emoji: p.emoji })),
    pairs, votes, guessWinner: c.guessWinner ? nm(c.guessWinner) : '', triviaWinner: tw ? { name: nm(tw[0]), n: tw[1] } : null, topChat, topSugs,
    stats: { participants: S.participants.length, wishes: wishes.length, chat: chat.length, suggestions: sugs.length, questions: S.qCount, photos: photos.length },
    cover: photos.slice(0, 6).map(p => p.thumb).filter(t => String(t).length < 80000), at: serverTimestamp() };
  try { await setDoc(doc(adb, 'memories', year), mem); toast(`📖 Recuerdos ${year} guardados`); confetti(80); } catch (err) { toast(authErr(err)); }
}
// 🔄 Refrescar la app de todos: cada teléfono se recarga una vez con la última versión (sin cerrar sesión)
const BOOT_AT = Date.now();
function checkRefresh() {
  const at = ms(S.event?.refreshAt); if (!at) return;
  let done = 0; try { done = +localStorage.getItem('angelito:refreshed') || 0; } catch { }
  if (at <= done) return;
  if (at < BOOT_AT - 5000) { try { localStorage.setItem('angelito:refreshed', String(at)); } catch { } return; } // abrió la app después del pedido: ya está al día
  const busy = S.spinning || (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && document.activeElement.value) || $('#modal').classList.contains('on') || $('#tourx');
  if (busy) { clearTimeout(checkRefresh.t); checkRefresh.t = setTimeout(checkRefresh, 5000); return; }
  try { localStorage.setItem('angelito:refreshed', String(at)); } catch { }
  toast('🔄 Refrescando la app…');
  (swReg?.update() || Promise.resolve()).catch(() => { }).finally(() => setTimeout(() => location.reload(), 900));
}
$('#refresh-go').addEventListener('click', async () => {
  if (!(await confirmBox('¿Refrescar la app de todos?', 'A cada persona se le recargará la app con la última versión. Nadie pierde nada ni tiene que volver a entrar.', 'Refrescar'))) return;
  if (await saveEvent({ refreshAt: Timestamp.now() })) toast('🔄 Listo: la app de todos se va a refrescar');
});
$('#relog-go').addEventListener('click', async () => {
  if (!(await confirmBox('¿Pedir a todos que vuelvan a entrar?', 'A cada persona se le cerrará la sesión la próxima vez que abra la app y le pediremos entrar de nuevo, activar los avisos e instalar la app. Tú no sales.', 'Sí, pedirlo'))) return;
  if (await saveEvent({ reloginAt: Timestamp.now() })) toast('Listo: todos volverán a entrar 📲');
});
$('#mem-save').addEventListener('click', saveMemories);
function renderMemCard() {
  const box = $('#h-mem'); if (!box) return;
  const ms2 = [...(S.memories || [])].sort((a, b) => String(b.id).localeCompare(String(a.id)));
  box.innerHTML = ms2.length ? `<div class="h2row"><h2>📖 Recuerdos</h2></div><div class="chips" style="margin-bottom:16px">${ms2.map(m => `<button class="chip" data-mem="${esc(m.id)}">📖 ${esc(m.eventName)}${String(m.eventName).includes(m.year) ? '' : ' ' + esc(m.year)}</button>`).join('')}</div>` : '';
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-mem]'); if (!b) return; const m = S.memories.find(x => x.id === b.dataset.mem); if (!m) return;
  const st = m.stats || {}, clean = t => String(t || '').replace(/[^A-Za-z0-9+/=:;,._-]/g, '');
  openModal(`<div class="center"><div style="font-size:44px">📖</div><h3>${esc(m.eventName)}${String(m.eventName).includes(m.year) ? '' : ' ' + esc(m.year)}</h3><p class="muted small">${esc(m.date ? fmtDate(m.date, { day: 'numeric', month: 'long', year: 'numeric' }) : '')}${m.place ? ' · ' + esc(m.place) : ''}</p></div>
    ${(m.cover || []).length ? `<div class="pgrid" style="margin:12px 0">${m.cover.map(t => `<div class="pth" style="background-image:url('${clean(t)}')"></div>`).join('')}</div>` : ''}
    <div class="going" style="justify-content:center">${[['👥', st.participants, 'participantes'], ['🎁', st.wishes, 'deseos'], ['💬', st.chat, 'mensajes'], ['💡', st.suggestions, 'sugerencias'], ['💌', st.questions, 'anónimos'], ['📸', st.photos, 'fotos']].filter(x => x[1]).map(([e, n, l]) => `<span>${e} <b>${Number(n) || 0}</b> ${l}</span>`).join('')}</div>
    ${(m.pairs || []).length ? `<b style="display:block;margin-top:16px">🎁 Los angelitos</b><div class="stack" style="margin-top:8px;gap:6px">${m.pairs.map(x => `<div class="small">${esc(x.g)} → ${esc(x.r)}</div>`).join('')}</div>` : ''}
    ${(m.votes || []).length || m.guessWinner || m.triviaWinner ? `<b style="display:block;margin-top:16px">🏆 Ganadores</b><div class="stack" style="margin-top:8px;gap:6px">${(m.votes || []).map(v => `<div class="small">${esc(v.title)}: <b>${esc(v.winner)}</b></div>`).join('')}${m.guessWinner ? `<div class="small">🔮 Adivinanza: <b>${esc(m.guessWinner)}</b></div>` : ''}${m.triviaWinner ? `<div class="small">🎲 Trivia: <b>${esc(m.triviaWinner.name)}</b> (${Number(m.triviaWinner.n) || 0} aciertos)</div>` : ''}</div>` : ''}
    ${(m.topChat || []).length ? `<b style="display:block;margin-top:16px">😂 Lo más reaccionado del chat</b><div class="stack" style="margin-top:8px">${m.topChat.map(x => `<div class="guess"><div class="gv">"${esc(x.text)}"</div><div class="gl">de ${esc(x.who)} · ${Number(x.n) || 0} reacciones</div></div>`).join('')}</div>` : ''}
    ${(m.topSugs || []).length ? `<b style="display:block;margin-top:16px">💡 Las sugerencias más votadas</b><div class="stack" style="margin-top:8px">${m.topSugs.map(x => `<div class="guess"><div class="gv">${esc(x.text)}</div><div class="gl">👍 ${Number(x.n) || 0}</div></div>`).join('')}</div>` : ''}
    <div class="actions"><button class="btn gold" data-a="x">Cerrar</button></div>`).onclick = ev => { if (ev.target.closest('[data-a]')) closeModal(); };
});
$('#ny-go').addEventListener('click', async () => {
  if (!S.isOwner) return;
  const s2 = openModal(`<h3>🔁 Empezar un nuevo año</h3><p class="muted">Se borra todo lo de este año: sorteo, deseos, aportes, anónimos, sugerencias, actividades, pistas, votos, trivia${''}. <b>Se conservan</b> los participantes, sus perfiles e íconos, el equipo, las reglas y los recuerdos.</p>
    <label class="chk" style="margin-top:12px"><input type="checkbox" id="ny-chat" checked> Borrar también el chat y las fotos</label>
    <p class="muted small" style="margin-top:12px">💡 Antes, toca <b>📖 Guardar recuerdos del año</b> para no perder nada.</p>
    <label class="field" style="margin-top:12px"><span>Escribe NUEVO AÑO para confirmar</span><input class="in" id="ny-txt" autocomplete="off"></label>
    <div class="err" id="ny-err"></div><div class="actions"><button class="btn" data-a="no">Cancelar</button><button class="btn primary" data-a="ok">Borrar y empezar</button></div>`);
  s2.onclick = async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; if (a === 'no') return closeModal();
    if ($('#ny-txt', s2).value.trim().toUpperCase() !== 'NUEVO AÑO') { $('#ny-err', s2).textContent = 'Escribe NUEVO AÑO exactamente.'; return; }
    const btn = s2.querySelector('[data-a=ok]'); busy(btn, true);
    const cols = ['assignments', 'giftStatus', 'guesses', 'angelGuess', 'hintsSent', /* 🔐 regalo recibido y pistas: los borra la caja fuerte al quedar sin sorteo */ 'reveal', 'wishes', 'wishImg', 'wishComments', 'wishPick', 'games', 'gameWins', 'attendance', 'questions', 'questionAuthors',
      'suggestions', 'suggestionAuthors', 'sugVotes', 'sugImg', 'activities', 'activityPicks', 'votes', 'activitySignups', 'quizAns', 'quizKeys', 'rsvps', 'notices', 'thanks', 'anonVotes', 'triviaAns', 'party'];
    const wipeMedia = $('#ny-chat', s2).checked; if (wipeMedia) cols.push('chat', 'chatReacts', 'photos');
    try {
      { const b0 = writeBatch(adb); b0.delete(doc(adb, 'config', 'draw')); await b0.commit(); }
      if (wipeMedia) { const ph = (await getDocs(collection(adb, 'photos'))).docs.map(d => d.id); await commitOps(ph.map(id => ['del', doc(adb, 'photosFull', id)])); }
      for (const c of cols) { if (c === 'questionAuthors') continue; const ds = (await getDocs(collection(adb, c))).docs; if (c === 'questions') await commitOps(ds.map(d => ['del', doc(adb, 'questionAuthors', d.id)])); await commitOps(ds.map(d => ['del', d.ref])); }
      const b = writeBatch(adb);
      b.set(doc(adb, 'stats', 'questions'), { count: 0 });
      b.set(doc(adb, 'config', 'event'), { fix: deleteField(), eventDate: '', eventAt: null, revealDate: '', revealAt: null, rsvpDeadline: '', revealNow: false, guessesOpen: false, guessesLocked: false, guessWinner: '', angelLocked: false, registrationOpen: true }, { merge: true });
      await b.commit(); closeModal(); toast('🔁 ¡Listo! Nuevo año, nuevo angelito 🎄'); confetti(120);
    } catch (err) { $('#ny-err', s2).textContent = authErr(err); busy(btn, false); }
  };
});

/* ---------- ⚡ copia rápida en localStorage ---------- */
const BOOT_KEY = 'angelito:boot:v1';
let bootT = null;
function saveBoot() {
  clearTimeout(bootT);
  bootT = setTimeout(() => {
    try { localStorage.setItem(BOOT_KEY, JSON.stringify({ event: S.event, participants: S.participants, activities: S.activities, drawMeta: S.drawMeta, notices: S.notices, qCount: S.qCount, t: Date.now() })); } catch { }
  }, 2500);
}

