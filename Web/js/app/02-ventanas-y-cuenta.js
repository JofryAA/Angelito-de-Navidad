/* ---------- toast / modal ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3400); }
// Botón atrás de Android: cierra la hoja abierta en vez de cambiar de pestaña por detrás.
let sheetEntry = false, sheetHash = '';
function sheetHistory() { if (!sheetEntry) { try { history.pushState({ sheet: 1 }, ''); sheetEntry = true; sheetHash = location.hash; } catch { } } }
addEventListener('popstate', () => {
  if (!sheetEntry) return; sheetEntry = false;
  if (location.hash !== sheetHash) return; // fue un cambio de pestaña, no el botón atrás
  if ($('#csel').classList.contains('on')) { $('#csel').classList.remove('on'); if ($('#modal').classList.contains('on')) sheetHistory(); return; }
  if ($('#modal').classList.contains('on')) { if (S.spinning || S.forcePin) { sheetHistory(); return; } closeModal(); return; }
  history.back(); // la hoja ya estaba cerrada: este "atrás" era para navegar
});
function openModal(html) { $('#sheet').className = 'sheet'; $('#sheet').innerHTML = html; if (document.body.classList.contains('touring')) { openModal.later = true; return $('#sheet'); } /* durante la guía, las ventanas automáticas esperan a que termine */ $('#modal').classList.add('on'); sheetHistory(); return $('#sheet'); }
function viewImage(src) { openModal(`<img src="${src || ''}" alt="" style="width:100%;border-radius:14px"><div class="actions"><button class="btn gold" data-a="x">Cerrar</button></div>`).onclick = ev => { if (ev.target.closest('[data-a]')) closeModal(); }; }
// Cabecera de una hoja con la persona (menú ⋯, asistencia…)
const personHead = (p, sub) => `<div class="wm-h who-card" style="display:flex;gap:12px;align-items:center"><span class="av">${esc(p.emoji)}</span><div><div class="muted small">${esc(sub)}</div><b>${esc(p.name)}</b></div></div>`;
// Pestañas en forma de chips (ayuda, reacciones, asistencia): [clave, texto, número?]
const chipTabs = (list, cur, attr) => `<div class="ctabs" data-noswipe>${list.map(([k, l, n]) => `<button type="button" class="${k === cur ? 'on' : ''}" data-${attr}="${esc(k)}">${l}${n != null ? `<i>${n}</i>` : ''}</button>`).join('')}</div>`;
function closeModal() {
  setTimeout(() => { try { fitChat(); } catch { } }, 260); $('#modal').classList.remove('on'); $('#sheet').onclick = null; }
// En computadora, la tecla Esc cierra la ventanita abierta (como tocar fuera o el botón atrás en el teléfono).
addEventListener('keydown', e => {
  if (e.key !== 'Escape' || PARTY) return;
  if ($('#csel').classList.contains('on')) { e.preventDefault(); $('#csel').classList.remove('on'); return; }
  if ($('#modal').classList.contains('on') && !S.spinning && !S.forcePin) { e.preventDefault(); closeModal(); }
});
const nMsg = n => `${n} ${n === 1 ? 'mensaje' : 'mensajes'}`;
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !S.spinning && !S.forcePin) closeModal(); });
function confirmBox(title, body, ok = 'Sí, continuar') {
  return new Promise(res => {
    const s = openModal(`<h3>${esc(title)}</h3><p class="muted">${esc(body)}</p><div class="actions"><button class="btn" data-a="no">Cancelar</button><button class="btn primary" data-a="ok">${esc(ok)}</button></div>`);
    s.onclick = e => { const a = e.target.closest('[data-a]')?.dataset.a; if (a) { closeModal(); res(a === 'ok'); } };
  });
}
const pinField = (id, label) => `<label class="field"><span>${label}</span><input class="in pinin" id="${id}" type="password" inputmode="numeric" maxlength="4" autocomplete="off" placeholder="••••"></label>`;
const onlyDigits = root => $$('.pinin', root).forEach(i => i.addEventListener('input', () => { i.value = i.value.replace(/\D/g, '').slice(0, 4); }));
const busy = (btn, on, label) => { btn.disabled = on; if (on) { btn.dataset.l = btn.innerHTML; btn.innerHTML = '<span class="spin-dots"></span>'; } else btn.innerHTML = label || btn.dataset.l; };

/* ---------- auth UI (participantes) ---------- */
function openAuth(tab = 'login', then) {
  const s = openModal(`<div class="auth-hd"><span class="auth-logo">🎁</span><b>${esc(S.event?.eventName || 'Angelito de Navidad')}</b><small>Entra con tu nombre y tu PIN</small></div><div class="seg auth-seg"><button data-t="login">Entrar</button><button data-t="reg">Registrarme</button></div><div id="auth-body"></div>`);
  s.classList.add('authm');
  const show = t => {
    $$('.seg button', s).forEach(b => b.classList.toggle('on', b.dataset.t === t));
    const body = $('#auth-body', s);
    if (t === 'org') {
      body.innerHTML = `<div class="stack"><p class="muted small">Solo para el <b>organizador principal</b>. Si te dieron permisos de administrador, entra normal con tu nombre y tu PIN: el panel te aparece solo.</p>
        <label class="field"><span>Usuario</span><input class="in" id="o-user" autocapitalize="off" autocomplete="username" placeholder="admin"></label>
        <label class="field"><span>Contraseña</span><input class="in" id="o-pass" type="password" autocomplete="current-password"></label></div>
        <div class="err" id="o-err"></div>
        <div class="actions"><button class="btn" data-x>Cancelar</button><button class="btn gold" id="o-go">Entrar</button></div>`;
      const go = async () => {
        const btn = $('#o-go', body); busy(btn, true);
        try { await adminLogin($('#o-user', body).value, $('#o-pass', body).value); closeModal(); location.hash = 'admin'; toast('Modo organizador activo 🔓'); }
        catch (e) { $('#o-err', body).textContent = authErr(e).replace('PIN incorrecto', 'Usuario o contraseña incorrectos'); busy(btn, false); }
      };
      $('#o-go', body).addEventListener('click', go);
      $('#o-pass', body).addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      return;
    }
    if (t === 'login') {
      let sel = null;
      body.innerHTML = S.participants.length ? `
        <label class="field"><span>¿Quién eres?</span><input class="in" id="l-q" placeholder="🔍 Busca tu nombre…" autocomplete="off"></label>
        <div class="pick" id="l-pick" style="margin-top:10px"></div>
        <div id="l-pinbox" style="display:none;margin-top:14px">${pinField('l-pin', 'Tu PIN de 4 números')}</div>
        <div class="err" id="l-err"></div>
        <div class="actions"><button class="btn" data-x>Cancelar</button><button class="btn gold" id="l-go" disabled>Entrar</button></div>`
        : `<div class="empty"><span class="e">🎄</span>Todavía nadie se ha registrado.</div><div class="actions"><button class="btn gold" data-sw="reg">Registrarme</button></div>`;
      if (!S.participants.length) return;
      onlyDigits(body);
      const paint = () => {
        const q = normName($('#l-q', body).value);
        $('#l-pick', body).innerHTML = S.participants.filter(p => !q || String(p.nameKey || '').includes(q))
          .map(p => `<button class="apick ${sel === p.id ? 'on' : ''}" data-p="${esc(p.id)}"><span class="ap-e">${esc(p.emoji)}</span><span class="ap-n">${esc(p.first || p.name)}</span><small>${esc(p.last || '')}</small></button>`).join('') || '<p class="muted small">No aparece. ¿Ya te registraste?</p>';
      };
      paint();
      $('#l-q', body).addEventListener('input', paint);
      $('#l-pick', body).addEventListener('click', e => {
        const b = e.target.closest('[data-p]'); if (!b) return;
        sel = b.dataset.p; paint(); $('#l-pinbox', body).style.display = ''; $('#l-go', body).disabled = false; $('#l-pin', body).focus();
      });
      const go = async () => {
        const pin = $('#l-pin', body).value, p = P(sel), err = $('#l-err', body), btn = $('#l-go', body);
        if (!p) return; if (!/^\d{4}$/.test(pin)) { err.textContent = 'El PIN tiene 4 números.'; return; }
        busy(btn, true); err.textContent = '';
        try { await signInWithEmailAndPassword(auth, p.email, pinPass(pin)); closeModal(); toast(`¡Hola, ${p.first}! 👋`); then && then(); }
        catch (e) { err.textContent = authErr(e); busy(btn, false); }
      };
      $('#l-go', body).addEventListener('click', go);
      $('#l-pin', body).addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    } else {
      if (!regOpen()) { body.innerHTML = `<div class="empty"><span class="e">🔒</span>Las inscripciones están cerradas. Habla con el organizador.</div><div class="actions"><button class="btn" data-x>Cerrar</button></div>`; return; }
      body.innerHTML = `<div class="stack">
        <div class="row"><label class="field"><span>Nombre</span><input class="in" id="r-first" maxlength="25" autocomplete="given-name"></label>
        <label class="field"><span>Apellido</span><input class="in" id="r-last" maxlength="25" autocomplete="family-name"></label></div>
        <div class="row">${pinField('r-pin', 'Crea tu PIN (4 números)')}${pinField('r-pin2', 'Repite el PIN')}</div>
        <p class="muted small">🔐 Con este PIN entras, giras la ruleta y manejas tu lista de deseos. No lo compartas.</p></div>
        <div class="err" id="r-err"></div>
        <div class="actions"><button class="btn" data-x>Cancelar</button><button class="btn gold" id="r-go">Registrarme</button></div>`;
      onlyDigits(body);
      $('#r-go', body).addEventListener('click', async () => {
        const first = titleCase($('#r-first', body).value), last = titleCase($('#r-last', body).value);
        const pin = $('#r-pin', body).value, pin2 = $('#r-pin2', body).value, err = $('#r-err', body), btn = $('#r-go', body);
        if (!first || !last) { err.textContent = 'Escribe tu nombre y tu apellido.'; return; }
        if (!/^\d{4}$/.test(pin)) { err.textContent = 'El PIN debe tener 4 números.'; return; }
        if (pin !== pin2) { err.textContent = 'Los PIN no coinciden.'; return; }
        const name = `${first} ${last}`, nameKey = normName(name);
        busy(btn, true); err.textContent = '';
        try {
          const r = await registerPerson(first, last, pin, false);
          if (r === 'dup') { err.textContent = `Ya hay alguien registrado como ${name}. Si eres tú, entra con tu PIN.`; busy(btn, false); return; }
          closeModal(); toast(`¡Bienvenido al angelito, ${first}! 🎉`); confetti(90); then && then();
        } catch (e) { err.textContent = e?.code?.includes('permission') ? 'Las inscripciones están cerradas.' : authErr(e); busy(btn, false); }
      });
    }
  };
  s.onclick = e => {
    const t = e.target.closest('[data-t]')?.dataset.t || e.target.closest('[data-sw]')?.dataset.sw; if (t) show(t);
    if (e.target.closest('[data-x]')) closeModal();
  };
  show(tab);
}
/* ---------- PIN temporal: obligar a crear uno nuevo ---------- */
// Invita a activar las notificaciones apenas la persona entra (el navegador exige que ella toque "Permitir").
const ASK_KEY = 'angelito:askNotif';
let askT = null;
function maybeAskNotif() {
  if (!S.me || S.forcePin || !canNotify() || Notification.permission !== 'default' || askT) return;
  if (isIOS() && !isStandalone()) return;
  let last = 0; try { last = +localStorage.getItem(ASK_KEY) || 0; } catch { }
  if (Date.now() - last < 6 * 3600e3) return; // si no aceptó, se vuelve a preguntar la próxima vez que abra la app
  const busyNow = () => S.spinning || (typeof PARTY !== 'undefined' && PARTY) || location.hash.startsWith('#juego-') || location.hash === '#ruleta'
    || document.body.classList.contains('kb') || $('#modal').classList.contains('on') || $('#csel').classList.contains('on') || !!tourT;
  const tryAsk = () => {
    askT = null;
    if (!S.me || S.forcePin || Notification.permission !== 'default') return;
    if (busyNow()) { askT = setTimeout(tryAsk, 8000); return; } // espera un momento tranquilo
    openModal(`<div style="text-align:center"><div style="font-size:46px">🔔</div><h3>¿Te avisamos?</h3>
      <p class="muted">Te llegará un aviso cuando haya mensajes, actividades, invitaciones a jugar o cambios del evento. Nunca varios seguidos: el nuevo reemplaza al anterior.</p>
      <p class="muted small">Puedes apagarlas cuando quieras en 🔔 Notificaciones.</p></div>
      <div class="actions"><button class="btn" data-a="no">Ahora no</button><button class="btn gold" data-a="ok">🔔 Activar</button></div>`).onclick = async e => {
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
      try { localStorage.setItem(ASK_KEY, String(Date.now())); } catch { } // se guarda solo cuando responde
      closeModal(); if (a === 'ok') await enableNotifications();
    };
  };
  askT = setTimeout(tryAsk, 6000);
}
function maybeForcePin() {
  if (S.forcePin && S.me && !S.me.mustChangePin) { S.forcePin = false; closeModal(); return; }
  if (!S.me || !S.me.mustChangePin || S.forcePin) return;
  S.forcePin = true;
  const s2 = openModal(`<h3>🔐 Crea tu nuevo PIN</h3><p class="muted">Entraste con un PIN temporal que te dio el organizador. Crea ahora tu propio PIN de 4 números (no lo compartas).</p>
    <div class="row" style="margin-top:12px">${pinField('np-1', 'Nuevo PIN')}${pinField('np-2', 'Repítelo')}</div>
    <div class="err" id="np-err"></div><div class="actions"><button class="btn" data-a="out">Salir</button><button class="btn gold" data-a="ok">Guardar mi PIN</button></div>`);
  onlyDigits(s2);
  s2.onclick = async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'out') { S.forcePin = false; closeModal(); await signOut(auth); return; }
    const p1 = $('#np-1', s2).value, p2 = $('#np-2', s2).value, er = $('#np-err', s2);
    if (!/^\d{4}$/.test(p1)) { er.textContent = 'El PIN debe tener 4 números.'; return; }
    if (p1 !== p2) { er.textContent = 'Los PIN no coinciden.'; return; }
    const btn = s2.querySelector('[data-a=ok]'); busy(btn, true);
    try {
      await updatePassword(auth.currentUser, pinPass(p1));
      await setDoc(doc(db, 'participants', S.uid), { mustChangePin: false }, { merge: true });
      S.forcePin = false; closeModal(); toast('¡Listo! Ya tienes tu nuevo PIN 🔐');
    } catch (err) {
      er.textContent = err?.code?.includes('requires-recent-login') ? 'Por seguridad, sal y vuelve a entrar con el PIN temporal.' : authErr(err); busy(btn, false);
    }
  };
}
/* ---------- admin: restablecer PIN (pasa todo a una cuenta nueva) ---------- */
async function resetPin(pid, tempPin) {
  const p = P(pid); if (!p) throw new Error('no participant');
  const slug = String(p.nameKey || 'persona').replace(/ñ/g, 'n').replace(/[^a-z0-9 ]/g, '').replace(/ /g, '.') || 'persona';
  const email = `${slug}.${Math.random().toString(36).slice(2, 7)}@angelito.app`;
  const cred = await createUserWithEmailAndPassword(regAuth, email, pinPass(tempPin));
  const nid = cred.user.uid; try { await signOut(regAuth); } catch { }
  const ops = [];  // [tipo, ref, datos]
  const put = (ref, data) => ops.push(['set', ref, data]), del = ref => ops.push(['del', ref]);
  const R = (c, id) => doc(adb, c, id);
  const q = (c, f, v) => getDocs(query(collection(adb, c), where(f, '==', v)));
  const { id: _i, ...pdata } = p;
  // el cambio de ficha va al final y de una sola vez: si algo se corta antes, la persona sigue intacta con su cuenta vieja
  const fin = writeBatch(adb);
  fin.set(R('participants', nid), { ...pdata, email, mustChangePin: true }); fin.delete(R('participants', pid));
  if (p.nameKey) fin.set(R('names', p.nameKey), { uid: nid });
  fin.set(R('banned', pid), { at: serverTimestamp() });
  if ((S.drawRules || []).some(r => r.a === pid || r.b === pid)) fin.set(R('drawRules', 'main'), { pairs: S.drawRules.map(r => ({ ...r, a: r.a === pid ? nid : r.a, b: r.b === pid ? nid : r.b })), at: serverTimestamp() });
  for (const c of ['giftStatus', 'attendance', 'guesses']) { // 🔐 assignments, giftIncoming y pistas los mueve la caja fuerte (servidor)
    const snap = await getDoc(R(c, pid)).catch(() => null);
    if (snap && snap.exists()) { const data = snap.data(); if ('uid' in data) data.uid = nid; put(R(c, nid), data); del(R(c, pid)); }
  }
  // 🔐 a quién le toca está cifrado: la caja fuerte cambia pid → nid adentro de las parejas
  put(doc(collection(adb, 'vaultOps')), { op: 'remap', from: pid, to: nid, at: serverTimestamp() });
  (await q('questions', 'to', pid)).forEach(d => put(d.ref, { ...d.data(), to: nid }));
  for (const c of ['wishes', 'wishImg', 'chatImg', 'activitySignups', 'suggestions', 'suggestionAuthors'] /* los autores de anónimos están sellados: no se tocan */)
    (await q(c, 'uid', pid).catch(() => ({ forEach() { } }))).forEach(d => put(d.ref, { ...d.data(), uid: nid })); // los autores de anónimos están sellados: si no se pueden leer, se dejan
  (await q('activityPicks', 'uid', pid)).forEach(d => { put(R('activityPicks', `${d.data().act}__${nid}`), { ...d.data(), uid: nid }); del(d.ref); });
  (await q('votes', 'uid', pid)).forEach(d => { put(R('votes', `${d.data().act}__${nid}`), { ...d.data(), uid: nid }); del(d.ref); });
  (await q('votes', 'choice', pid)).forEach(d => { if (d.data().uid !== pid) put(d.ref, { ...d.data(), choice: nid }); });
  (await q('sugVotes', 'uid', pid)).forEach(d => { put(R('sugVotes', `${d.data().sug}__${nid}`), { ...d.data(), uid: nid }); del(d.ref); });
  (await q('chatReacts', 'uid', pid)).forEach(d => { put(R('chatReacts', `${d.data().msg}__${nid}`), { ...d.data(), uid: nid }); del(d.ref); });
  (await q('fcmTokens', 'uid', pid)).forEach(d => del(d.ref)); del(R('fcmTokens', pid));
  for (const c of ['profiles', 'hintsSent', 'angelGuess', 'thanks', 'wishPick']) { const sn = await getDoc(R(c, pid)).catch(() => null); if (sn && sn.exists()) { put(R(c, nid), sn.data()); del(R(c, pid)); } }
  for (const c of ['photos', 'photosFull']) (await q(c, 'uid', pid)).forEach(d => put(d.ref, { ...d.data(), uid: nid }));
  (await q('anonVotes', 'uid', pid)).forEach(d => { put(R('anonVotes', `${d.data().qid}__${nid}`), { ...d.data(), uid: nid }); del(d.ref); });
  (await q('anonVotes', 'choice', pid)).forEach(d => { if (d.data().uid !== pid) put(d.ref, { ...d.data(), choice: nid }); });
  (await q('triviaAns', 'uid', pid)).forEach(d => { put(R('triviaAns', `${d.data().qi}__${nid}`), { ...d.data(), uid: nid }); del(d.ref); });
  (await getDocs(collection(adb, 'chat'))).forEach(d => { const m = d.data(); let ch = false; const o = { ...m };
    if (m.uid === pid) { o.uid = nid; ch = true; }
    if (m.replyTo?.uid === pid) { o.replyTo = { ...m.replyTo, uid: nid }; ch = true; }
    if (m.r && pid in m.r) { o.r = { ...m.r, [nid]: m.r[pid] }; delete o.r[pid]; ch = true; }
    if (ch) put(d.ref, o); });
  if (S.reveal?.pairs?.some(x => x.g === pid || x.r === pid)) put(R('reveal', 'main'), { ...S.reveal, pairs: S.reveal.pairs.map(x => ({ g: x.g === pid ? nid : x.g, r: x.r === pid ? nid : x.r })) });
  if (S.event.guessWinner === pid) put(R('config', 'event'), { guessWinner: nid });
  (await q('angelGuess', 'guess', pid)).forEach(d => { if (d.id !== pid) put(d.ref, { ...d.data(), guess: nid }); });
  if (S.drawMeta?.ids?.includes(pid)) fin.set(R('config', 'draw'), { ...S.drawMeta, ids: S.drawMeta.ids.map(x => x === pid ? nid : x) });
  S.activities.filter(a => Array.isArray(a.results) && a.results.some(r => r.key === pid))
    .forEach(a => put(R('activities', a.id), { results: a.results.map(r => r.key === pid ? { ...r, key: nid } : r) }));
  // permisos de administrador, puntos de los juegos y mesas en las que está sentada
  { const st = await getDoc(R('staff', pid)).catch(() => null); if (st && st.exists()) { put(R('staff', nid), { ...st.data(), pid: nid }); del(R('staff', pid)); } }
  (await q('gameWins', 'uid', pid)).forEach(d => { put(R('gameWins', d.id.endsWith('_' + pid) ? d.id.slice(0, -pid.length) + nid : `${d.data().gid}_${nid}`), { ...d.data(), uid: nid }); del(d.ref); });
  for (const d of (await getDocs(query(collection(adb, 'games'), where('players', 'array-contains', pid)))).docs) {
    const g = d.data(), sw = x => x === pid ? nid : x;
    put(d.ref, { ...g, players: g.players.map(sw), host: sw(g.host), winners: (g.winners || []).map(sw) });
    const h = await getDoc(doc(adb, 'games', d.id, 'hands', pid)).catch(() => null);
    if (h && h.exists()) { put(doc(adb, 'games', d.id, 'hands', nid), h.data()); del(h.ref); }
  }
  // escribir en tandas (los set primero para no perder nada si se corta)
  ops.sort((a, b) => (a[0] === 'del') - (b[0] === 'del'));
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(adb);
    ops.slice(i, i + 400).forEach(([t, ref, data]) => t === 'set' ? b.set(ref, data, { merge: ref.path.startsWith('activities/') || ref.path === 'config/event' }) : b.delete(ref));
    await b.commit();
  }
  await fin.commit();
  return nid;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-preset-pin]'); if (!b || !S.isOwner) return;
  const p = P(b.dataset.presetPin); if (!p) return;
  const s2 = openModal(`<h3>🔑 Restablecer PIN</h3><p class="muted">Para <b>${esc(p.name)}</b>. La app le creará un <b>PIN temporal</b> para que te lo copies y se lo envíes. Sigue siendo la misma persona, con su sorteo, sus deseos y todo lo suyo. Cuando entre, la app le pedirá crear su propio PIN.</p>
    <div class="err" id="rp-err"></div>
    <div class="actions"><button class="btn" data-a="no">Cancelar</button><button class="btn gold" data-a="ok">🔑 Generar PIN temporal</button></div>`);
  s2.onclick = async ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return; if (a === 'no') return closeModal();
    const btn = s2.querySelector('[data-a=ok]'); busy(btn, true);
    let pin; const bad = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '1212']);
    do { pin = String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0'); } while (bad.has(pin));
    try {
      await resetPin(p.id, pin);
      const msg = `Hola ${p.first} 👋 Tu PIN temporal del angelito es ${pin}. Entra, toca tu nombre, escribe ese PIN y la app te pedirá crear uno nuevo. 🎁`;
      s2.innerHTML = `<div class="center"><h3>✅ PIN temporal de ${esc(p.first)}</h3>
        <div class="reveal-name" style="letter-spacing:.2em">${pin}</div>
        <p class="muted small">Envíaselo por WhatsApp o díselo en persona.</p></div>
        <textarea class="in" id="rp-msg" readonly style="min-height:90px;margin-top:12px">${esc(msg)}</textarea>
        <div class="actions"><button class="btn" data-c="pin">📋 Copiar PIN</button><button class="btn gold" data-c="msg">📋 Copiar mensaje</button></div>
        <button class="btn ghost" data-c="close" style="width:100%;margin-top:8px">Listo</button>`;
      s2.onclick = async e2 => {
        const c = e2.target.closest('[data-c]')?.dataset.c; if (!c) return;
        if (c === 'close') return closeModal();
        const text = c === 'pin' ? pin : msg;
        try { await navigator.clipboard.writeText(text); toast('📋 Copiado'); }
        catch { const t = $('#rp-msg', s2); t.value = text; t.focus(); t.select(); toast('Selecciónalo y cópialo'); }
      };
    } catch (err) { console.error(err); $('#rp-err', s2).textContent = authErr(err); busy(btn, false); }
  };
});
/* ---------- ícono de perfil ---------- */
const ICONS = ['🎅','🤶','🧑‍🎄','🦌','⛄','☃️','🎄','🌟','⭐','✨','🎁','🎀','🔔','🕯️','🧦','🍪','🍬','🍭','🍫','🥂','🍷','☕','🍰','🧁',
  '🐶','🐱','🐻','🐼','🐨','🦊','🐰','🐧','🦉','🦁','🐯','🐮','🐷','🐸','🐵','🦄','🐝','🦋','🐢','🐬',
  '😀','😎','🤓','🥳','😇','🤠','🥰','😜','🤩','😴','🤗','🧐','👑','💃','🕺','🎸','🎤','🎧','⚽','⚾','🏀','🎮','📚','🎨','📸','✈️',
  '🌸','🌻','🌈','🔥','💎','❤️','💛','💚','💙','💜','🍀','🌙','☀️','🌊','🍕','🌮','🥑','🍓','🍉','🥭','🍍','🥥'];
function isOneEmoji(t) {
  t = (t || '').trim(); if (!t || t.length > 16) return false;
  try { if ([...new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(t)].length !== 1) return false; } catch { if ([...t].length > 4) return false; }
  return /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(t);
}
function openIconPicker() {
  if (!S.me) return;
  let pick = S.me.emoji;
  const s2 = openModal(`<h3>😀 Elige tu ícono</h3><p class="muted small">Es el que verán todos junto a tu nombre.</p>
    <div style="display:flex;align-items:center;gap:12px;margin:12px 0"><div class="av" id="ic-prev" style="width:60px;height:60px;border-radius:18px;display:grid;place-items:center;font-size:34px;background:var(--card2)">${esc(pick)}</div>
      <input class="in" id="ic-own" maxlength="16" placeholder="O pega cualquier emoji 👉" style="flex:1"></div>
    <div class="chips" id="ic-grid" style="max-height:44vh;overflow:auto;gap:6px">${ICONS.map(x => `<button type="button" class="chip ${x === pick ? 'on' : ''}" data-ic="${x}" style="font-size:22px;padding:8px 10px">${x}</button>`).join('')}</div>
    <div class="err" id="ic-err"></div>
    <div class="actions"><button class="btn" data-a="no">Cancelar</button><button class="btn gold" data-a="ok">Guardar</button></div>`);
  const setPick = v => { pick = v; $('#ic-prev', s2).textContent = v; $$('#ic-grid .chip', s2).forEach(c => c.classList.toggle('on', c.dataset.ic === v)); $('#ic-err', s2).textContent = ''; };
  $('#ic-own', s2).addEventListener('input', e => { const v = e.target.value.trim(); if (isOneEmoji(v)) setPick(v); else if (v) $('#ic-err', s2).textContent = 'Pon un solo emoji.'; });
  s2.onclick = async e => {
    const c = e.target.closest('[data-ic]'); if (c) { $('#ic-own', s2).value = ''; return setPick(c.dataset.ic); }
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; if (a === 'no') return closeModal();
    if (!isOneEmoji(pick)) { $('#ic-err', s2).textContent = 'Elige un emoji.'; return; }
    if (pick === S.me.emoji) return closeModal();
    try { await setDoc(doc(db, 'participants', S.uid), { emoji: pick }, { merge: true }); closeModal(); toast(`${pick} ¡Listo, ese es tu ícono!`); }
    catch (err) { $('#ic-err', s2).textContent = authErr(err); }
  };
}
document.addEventListener('click', e => { if (e.target.closest('#prof-icon')) openIconPicker(); });
async function fullLogout() {
  toast('Cerrando sesión…');
  try { await signOut(auth); } catch { }
  window.__dead = true; try { await terminate(db); await clearIndexedDbPersistence(db); } catch (e) { console.warn(e); }  // borra la copia local de esta persona
  for (const k of Object.keys(localStorage)) if (/^angelito:(remind|ms|chatSeen|sugSeen|lg|tour\d?):/.test(k)) try { localStorage.removeItem(k); } catch { } // en un teléfono prestado no queda nada tuyo
  try { sessionStorage.clear(); } catch { }
  location.reload();
}
const staffEmail = u => `${u.trim().toLowerCase()}@staff.angelito.app`;
function adminLogin(user, pass) {
  const u = (user || '').trim().toLowerCase();
  const email = (!u || u === 'admin') ? ADMIN_EMAIL : u.includes('@') ? u : staffEmail(u);
  return signInWithEmailAndPassword(adminAuth, email, pass);
}
async function registerPerson(first, last, pin, byAdmin) {
  const name = `${first} ${last}`, nameKey = normName(name);
  const dup = await getDocs(query(collection(byAdmin ? adb : db, 'participants'), where('nameKey', '==', nameKey)));
  if (!dup.empty) return 'dup';
  const slug = nameKey.replace(/ñ/g, 'n').replace(/[^a-z0-9 ]/g, '').replace(/ /g, '.') || 'persona';
  const email = `${slug}.${Math.random().toString(36).slice(2, 7)}@angelito.app`;
  if (!byAdmin) try { localStorage.setItem('angelito:tourLogin', '1'); } catch { }
  const cred = await createUserWithEmailAndPassword(byAdmin ? regAuth : auth, email, pinPass(pin));
  const used = new Set(S.participants.map(p => p.emoji));
  const emoji = EMOJIS.find(x => !used.has(x)) || EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  try {
    const xdb = byAdmin ? adb : db, w = writeBatch(xdb);
    w.set(doc(xdb, 'participants', cred.user.uid), { first, last, name, nameKey, email, emoji, at: serverTimestamp(), ...(byAdmin ? { mustChangePin: true } : {}) }); // quien inscribe no se queda con su PIN: al entrar crea el suyo
    w.set(doc(xdb, 'names', nameKey), { uid: cred.user.uid });
    await w.commit();
  } catch (e) { try { await deleteUser(cred.user); } catch { } throw e; }
  finally { if (byAdmin) { try { await signOut(regAuth); } catch { } } }
  return cred.user.uid;
}
function askPin(title, body) {
  return new Promise(res => {
    const s = openModal(`<h3>${esc(title)}</h3><p class="muted">${esc(body)}</p><div style="margin-top:14px">${pinField('v-pin', 'Tu PIN')}</div><div class="err" id="v-err"></div>
      <div class="actions"><button class="btn" data-a="no">Cancelar</button><button class="btn gold" data-a="ok">Continuar</button></div>`);
    onlyDigits(s); setTimeout(() => $('#v-pin', s)?.focus(), 80);
    const ok = async () => {
      const pin = $('#v-pin', s).value; if (!/^\d{4}$/.test(pin)) { $('#v-err', s).textContent = 'El PIN tiene 4 números.'; return; }
      const btn = s.querySelector('[data-a=ok]'); busy(btn, true);
      try { await signInWithEmailAndPassword(auth, S.me.email, pinPass(pin)); closeModal(); res(true); }
      catch (e) { $('#v-err', s).textContent = authErr(e); busy(btn, false); }
    };
    $('#v-pin', s).addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
    s.onclick = e => { const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'no') { closeModal(); res(false); } if (a === 'ok') ok(); };
  });
}
function userMenu() {
  const row = (a, e, t, d, x = '') => `<button class="mrow" data-a="${a}"><span class="me-e">${SVGI[e] ? ic(e, 22) : e}</span><span class="grow"><b>${t}</b>${d ? `<span class="muted small">${d}</span>` : ''}</span>${x}<span class="chev">›</span></button>`;
  const pd = profDone();
  const s = openModal(`<div class="card who-card um-hd"><button class="av" data-a="icon" title="Cambiar mi ícono" aria-label="Cambiar mi ícono">${esc(S.me.emoji)}</button><div><h3 style="margin:0">${esc(S.me.name)}</h3><div class="muted small">Participante del angelito</div></div></div>
    <div class="mlist">
      ${mod('perfil') ? row('prof', 'shirt', 'Mi perfil de gustos', 'Tallas, colores y lo que te gusta', `<span class="cnt ${pd < PROF.length ? 'no' : 'ok'}">${pd}/${PROF.length}</span>`) : ''}
      ${S.isAdmin ? row('admin', 'shield', 'Panel de control', S.isOwner ? 'Organizador principal' : 'Tienes permisos de administrador') : ''}
      <button class="mrow" data-online><span class="me-e">🟢</span><span class="grow"><b>Quién está en línea</b><span class="muted small">${onlineIds().length} conectados ahora</span></span><span class="chev">›</span></button>
      ${row('notif', 'bell', 'Notificaciones', 'Elige qué avisos recibir')}
      ${row('install', 'phone', isInstalled() ? 'Reinstalar o reparar la app' : 'Descargar la app', isInstalled() ? 'Si te da algún error, aquí se arregla' : 'Ábrela desde tu pantalla de inicio')}
      ${row('help', 'help', 'Ayuda', 'Guía, preguntas frecuentes y soluciones')}
    </div>
    <div class="actions"><button class="btn ghost" data-a="out">Cerrar sesión</button><button class="btn gold" data-a="close">Listo</button></div>`);
  s.onclick = async e => {
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; closeModal();
    if (a === 'org') return openAuth('org');
    if (a === 'icon') return openIconPicker();
    if (a === 'prof') return openProfile();
    if (a === 'help') return openHelp();
    if (a === 'admin') { location.hash = 'admin'; return; }
    if (a === 'notif') return openNotifPrefs();
    if (a === 'install') return appSheet();
    if (a === 'out') return fullLogout();
  };
}

/* ---------- ❓ centro de ayuda: buscador, temas y pasos; se abre en el tema de la pantalla donde estás ---------- */
const HELP_CATS = [
  ['empezar', '🚀', 'Empezar'], ['ruleta', '🎡', 'Ruleta'], ['deseos', '🎁', 'Deseos'], ['actividades', '📅', 'Actividades'],
  ['chat', '💬', 'Chat'], ['ideas', '💡', 'Ideas'], ['juegos', '🎮', 'Juegos'], ['cuenta', '👤', 'Cuenta y avisos'], ['problemas', '🛠️', 'Problemas'], ['organizador', '🛡️', 'Organizador'],
];
const HELP = () => [
  // 🚀 empezar
  ['empezar', '👋', '¿Qué es esta app?', ['Es la app del angelito del grupo: aquí está el sorteo, las listas de deseos, las actividades, el chat y los juegos.', 'Abajo tienes las pestañas: toca una o desliza la pantalla a los lados para cambiar.', 'El botón <b>?</b> de arriba abre esta ayuda en el tema de la pantalla donde estés.']],
  ['empezar', '📝', 'Registrarme y entrar', ['Toca <b>Registrarme</b>, escribe tu nombre y apellido y elige un emoji.', 'Crea un <b>PIN de 4 números</b>: es tu clave, no se lo digas a nadie.', 'Para volver a entrar: <b>Entrar</b> → busca tu nombre → tócalo → escribe tu PIN.'], 'Si se te olvida el PIN, el organizador te da uno temporal y no pierdes nada.'],
  ['empezar', '🏠', 'La pantalla de inicio', ['Arriba ves la cuenta regresiva y los detalles del evento (fecha, hora y mapa del lugar).', 'En <b>Tus pendientes</b> aparece lo que te falta: confirmar si vas, llenar tu perfil, escribir deseos…', 'Toca cualquier pendiente y la app te lleva directo.']],
  ['empezar', '🧭', 'Moverme por la app', ['Toca las pestañas de abajo o <b>desliza a la izquierda o a la derecha</b> para pasar de una a otra.', 'Las ventanas que suben desde abajo se cierran deslizándolas hacia abajo o con el botón atrás del teléfono.', 'El 💡 te da consejos de lo que te falta; muévelo arrastrándolo.']],
  ['empezar', '📘', 'Ver la guía paso a paso otra vez', ['Abre esta ayuda y toca <b>Ver la guía paso a paso</b> (abajo del todo).', 'La guía te lleva pantalla por pantalla y te enseña cada función.']],
  // 🎡 ruleta
  ['ruleta', '🎡', '¿Cómo sé a quién le regalo?', ['Espera a que el organizador haga el sorteo (te llega un aviso).', 'Entra a <b>Ruleta</b>, confirma que estás en un lugar donde nadie ve tu pantalla y escribe tu PIN.', 'Toca <b>Girar</b>. El nombre se muestra unos segundos y luego se oculta solo.'], 'Solo tú ves tu resultado. Para volver a verlo, entra otra vez a Ruleta con tu PIN.'],
  ['ruleta', '🤫', '¿Alguien más puede ver quién me tocó?', ['No. Ni el organizador ve las parejas en la app.', 'Las parejas solo se muestran a todos si el organizador hace la <b>Gran revelación</b> en la fiesta.']],
  ['ruleta', '🛍️', 'Marcar cómo va mi regalo', ['Después de girar, en <b>Ruleta</b> baja hasta <b>Mi regalo para mi angelito</b>.', 'Elige: Pensando, Tengo ideas o <b>Ya lo compré</b>.', 'A esa persona le llega el aviso sin tu nombre 🤫.']],
  ['ruleta', '🕵️', '¿Quién creo que es mi angelito?', ['En <b>Ruleta</b> aparece <b>¿Quién crees que es tu angelito?</b>', 'Elige a la persona que sospechas. Puedes cambiarla hasta la revelación.', 'En la gran revelación se ve quién adivinó.']],
  ['ruleta', '💛', 'Recibí mi regalo', ['Después de la fiesta, en <b>Ruleta</b> toca <b>💛 Recibí mi regalo</b>.', 'Escribe un mensaje de agradecimiento: solo lo lee tu angelito.']],
  // 🎁 deseos
  ['deseos', '➕', 'Agregar un deseo', ['Entra a <b>Deseos</b>; tu lista sale primero (<b>Mi lista</b>).', 'Toca <b>Agregar deseo</b>, escribe qué te gustaría (talla y color si aplica).', 'Opcional: <b>Tomar foto</b> o <b>Galería</b>, un enlace de la tienda y el precio aproximado.', 'Toca <b>✨ Agregar a mi lista</b>.'], 'Con foto y enlace tu angelito acierta seguro.'],
  ['deseos', '⭐', 'Marcar mi favorito, editar o borrar', ['En tu lista, toca la ⭐ de un deseo para marcarlo como el que más quieres (sale primero).', 'Toca los tres puntos <b>⋯</b> del deseo para editarlo o borrarlo.']],
  ['deseos', '👀', 'Ver la lista de otra persona', ['Arriba en Deseos está la fila de personas: toca un nombre.', 'Si son muchos, usa el buscador <b>🔍 Buscar a alguien</b>.', 'También ves su perfil de gustos: tallas, colores, lo que le gusta y lo que no.']],
  ['deseos', '🛒', '«Lo compro yo»', ['Abre la lista de la persona que te tocó.', 'En el deseo que vas a regalar, toca <b>🛒 Lo compro yo</b>.', 'Así queda apartado para ti y no se te olvida cuál elegiste.']],
  ['deseos', '👕', 'Mi perfil de gustos', ['Toca tu nombre arriba a la derecha → <b>Mi perfil de gustos</b>.', 'Llena tu talla de camisa, zapatos, colores, lo que te gusta, alergias y lo que no quieres recibir.', 'Todo es opcional, pero mientras más llenes, mejor regalo.']],
  // 📅 actividades
  ['actividades', '📅', 'Ver y participar en actividades', ['Entra a <b>Actividades</b> y toca una para ver los detalles.', 'Según la actividad puedes votar, anotarte, responder la trivia o elegir una opción.', 'Te llega un aviso cuando empieza.']],
  ['actividades', '🎉', 'Confirmar si voy', ['En Inicio toca <b>¿Vas al angelito?</b> (también sale en el 💡).', 'Elige <b>Sí, voy</b> o <b>No puedo</b>. Lo puedes cambiar después.']],
  ['actividades', '💌', 'Buzón anónimo', ['En Actividades entra a <b>💌 Buzón anónimo</b>.', 'Escribe tu pregunta o mensaje y, si quieres, para quién es.', 'Nadie ve quién lo escribió. Los mensajes se abren todos juntos el día que diga el organizador.']],
  ['actividades', '🗺️', '¿Dónde y cuándo es?', ['En Inicio toca los detalles del evento.', 'Ahí están la fecha, la hora y el mapa: toca el mapa para abrir la ruta en tu teléfono.']],
  // 💬 chat
  ['chat', '✍️', 'Escribir en el chat', ['Entra a <b>Chat</b> y escribe abajo. Toca la flechita para enviar.', 'Para escribir hay que tener los avisos activados.', 'Sin internet también puedes escribir: se envía solo cuando vuelve la conexión (verás 🕓).']],
  ['chat', '↩️', 'Responder un mensaje', ['<b>Desliza el mensaje hacia la derecha</b> y suéltalo cuando salga la flechita.', 'O tócalo y elige <b>Responder</b>.', 'Para cancelar la respuesta toca la ✕ de arriba del cuadro de texto.']],
  ['chat', '😂', 'Reaccionar y ver quién reaccionó', ['Toca un mensaje: arriba salen las reacciones ❤️ 😂 🔥 👍 😮 🎄.', 'Las reacciones se ven debajo del mensaje. Tócalas para ver <b>quién reaccionó</b>.', 'Para quitar la tuya, vuelve a tocar el mismo emoji o tócala en la lista.']],
  ['chat', '✅', 'Seleccionar varios mensajes', ['<b>Mantén presionado</b> un mensaje hasta que vibre.', 'Toca otros mensajes para agregarlos a la selección.', 'Arriba puedes copiarlos, responder, reaccionar, editar o borrar (los tuyos). La ✕ cancela.']],
  ['chat', '📣', 'Mencionar a alguien', ['Escribe <b>@</b> y las primeras letras del nombre; toca la persona.', 'A esa persona le llega un aviso. Con <b>@todos</b> le llega a todo el grupo (úsalo solo para cosas importantes).']],
  ['chat', '📷', 'Enviar una foto o una ocurrencia', ['Toca la cámara 📷: <b>Tomar foto</b> o <b>Elegir de la galería</b>.', 'Toca el 🎲 y te sale una ocurrencia al azar para romper el hielo.']],
  // 💡 ideas
  ['ideas', '💡', 'Proponer una idea', ['Entra a <b>Ideas</b> y escribe tu propuesta (juegos, comida, música…).', 'Los demás pueden votarla; las más votadas salen primero.']],
  // 🎮 juegos
  ['juegos', '🎲', 'Crear una partida', ['Entra a <b>Juegos</b> y elige: Dominó, Ahorcado, 4 en línea o X y O.', 'Elige cómo jugar: con el grupo o <b>contra la máquina 🤖</b>.', 'Con el grupo: toca un asiento libre <b>＋</b> para invitar a alguien (le llega una notificación) o comparte el enlace.', 'Cuando estén listos, toca <b>▶ Empezar partida</b>. Los asientos vacíos se llenan con 🤖.']],
  ['juegos', '🙅', 'Dominó: pases, capicúa y tranque', ['Si no llevas ficha, la app pasa sola y te avisa: no tienes que tocar nada.', 'Si una ficha cabe por los dos lados, te pregunta dónde ponerla.', 'Capicúa, pase de salida y pase corrido valen +25. En el tranque gana quien tenga menos puntos.']],
  ['juegos', '⏱️', 'Tiempo, salir y volver', ['Cada turno tiene tiempo: 1 minuto en dominó y 30 segundos en los demás. Si se acaba, la app juega por ti.', 'Si sales de la app, la partida sigue guardada (hasta 12 horas): vuelve a Juegos → <b>Tus partidas</b> → <b>Seguir</b>.']],
  ['juegos', '📴', 'Jugar sin internet', ['Sin internet, al crear una partida juegas contra 🤖 en tu teléfono.', 'Las partidas contra la máquina se guardan en tu teléfono aunque cierres la app.', 'Estas partidas no suman puntos a la tabla de campeones.']],
  ['juegos', '🔊', 'Música y voz del juego', ['En la mesa toca el botón 🔊 de arriba.', 'Activa o apaga la <b>música de fondo</b> y los <b>efectos y voz</b> («Paso», «¡Capicúa!», «¡Ganaste!»).']],
  ['juegos', '🏆', 'Tabla de campeones', ['Cada partida ganada con el grupo suma: dominó 3, ahorcado y 4 en línea 2, X y O 1.', 'La tabla está al final de la pantalla de Juegos.']],
  // 👤 cuenta
  ['cuenta', '🔔', 'Activar las notificaciones', ['Toca tu nombre arriba → <b>Notificaciones</b> → Activar.', 'En iPhone primero instala la app en la pantalla de inicio.', 'Si las bloqueaste: ajustes del teléfono → navegador → Notificaciones → permitir este sitio.']],
  ['cuenta', '📲', 'Instalar la app', ['Toca el ícono 🎁 con la flechita de arriba.', 'O en el menú del navegador elige <b>Instalar app</b> / <b>Agregar a pantalla de inicio</b>.', 'Instalada abre al instante y funciona sin internet.']],
  ['cuenta', '🔐', 'Mi ícono, mi PIN y cerrar sesión', ['Toca tu nombre arriba para abrir tu menú.', 'Toca tu ícono para cambiarlo; abajo está <b>Cerrar sesión</b>.', 'Para cambiar el PIN, pídele al organizador un PIN temporal: al entrar con él creas uno nuevo.']],
  ['cuenta', '🛡️', 'Mis datos y mi privacidad', ['Tu PIN no se guarda en ningún lado: solo sirve para entrar.', 'Tu resultado de la ruleta, tus agradecimientos y lo que apartas solo los ves tú.', 'Si cierras sesión en un teléfono prestado, no queda nada tuyo guardado ahí.']],
  // 🛠️ problemas
  ['problemas', '📡', 'Sin internet', ['La app sigue funcionando. El punto en tu nombre (arriba) se pone <b>rojo</b> mientras no tienes internet y <b>verde</b> cuando vuelve.', 'Lo que hagas (mensajes, deseos, reacciones) se guarda en tu teléfono y se sube solo cuando vuelve el internet.', 'Las partidas en línea esperan a que vuelvas; contra 🤖 puedes jugar igual.']],
  ['problemas', '👻', 'No me aparecen personas o datos', ['Revisa que tengas internet.', 'Abre esta ayuda y toca <b>Recargar datos</b>: baja todo de nuevo sin borrar nada ni cerrar tu sesión.']],
  ['problemas', '⏰', 'Me dice «revisa la hora de tu teléfono»', ['Ajustes del teléfono → Fecha y hora → activa <b>hora automática</b>.', 'Vuelve a intentarlo.']],
  ['problemas', '🔐', 'Olvidé mi PIN', ['Pídele al organizador un <b>PIN temporal</b>.', 'Entra con ese PIN: la app te pide crear uno nuevo. No pierdes nada.']],
  // 🛡️ organizador
  ['organizador', '🎡', 'Hacer el sorteo', ['Panel → <b>Sorteo</b>. Primero pon las <b>restricciones</b> (por ejemplo, esposos que no se toquen).', 'Toca <b>🎡 Generar sorteo</b>: se cierran las inscripciones y a todos les llega el aviso para girar.', 'Para empezar de nuevo: <b>🧹 Limpiar sorteo</b>. Si ya se había revelado, queda guardado en <b>📜 Angelitos pasados</b>.']],
  ['organizador', '🎉', 'La gran revelación', ['En la fiesta toca <b>Revelar</b> en la sección Sorteo.', 'Todos ven quién era el angelito de quién y quién adivinó. Se puede ocultar otra vez.']],
  ['organizador', '👥', 'Participantes y PIN temporal', ['En <b>Participantes</b> busca a la persona y toca <b>⋯</b>.', 'Ahí le das un PIN temporal, la editas o la quitas.']],
  ['organizador', '🧑‍🤝‍🧑', 'Ayudantes y co-organizadores', ['En <b>Equipo</b> agrega a alguien y elige qué puede hacer (actividades, chat, aportes…).', 'Actívale <b>organizador principal</b> si debe tener los mismos poderes que tú.']],
];
const VIEW_HELP = { inicio: 'empezar', ruleta: 'ruleta', deseos: 'deseos', actividades: 'actividades', actividad: 'actividades', anonimos: 'actividades', juegos: 'juegos', admin: 'organizador' };
function helpCtx() {
  const v = location.hash.slice(1);
  if (v.startsWith('juego')) return 'juegos';
  if (v === 'buzon' || v === 'chat' || v === 'sugerencias') return S.buz === 's' ? 'ideas' : 'chat';
  if (v.startsWith('actividad')) return 'actividades';
  return VIEW_HELP[v] || 'empezar';
}
function openHelp(cat) {
  cat = cat || helpCtx();
  const isAdm = S.isAdmin || S.isOwner || !!S.staff;
  const cats = HELP_CATS.filter(c => c[0] !== 'organizador' || isAdm), all = HELP().filter(a => a[0] !== 'organizador' || isAdm);
  let q = '', open = 0;
  const s = openModal(`<div class="hc"><div class="hc-hd"><h3>❓ Ayuda</h3><p class="muted small">Busca lo que quieres hacer o elige un tema.</p>
      <input class="in" id="hc-q" type="text" placeholder="🔍 Ej. responder, PIN, foto, dominó…" autocomplete="off" enterkeyhint="search"></div>
    ${chipTabs(cats.map(([k, e, l]) => [k, `${e} ${l}`]), '', 'hc')}
    <div class="hc-list" id="hc-list"></div>
    <div class="mlist hc-foot">
      <button class="mrow" data-a="tour"><span class="me-e">${ic('book', 22)}</span><span class="grow"><b>Ver la guía paso a paso</b><span class="muted small">Te lleva por cada pantalla de la app</span></span><span class="chev">›</span></button>
      <button class="mrow" data-a="reload"><span class="me-e">${ic('refresh', 22)}</span><span class="grow"><b>Recargar datos</b><span class="muted small">Si algo no aparece o se ve viejo</span></span><span class="chev">›</span></button>
      ${S.me && mod('chat') ? `<button class="mrow" data-a="chat"><span class="me-e">${ic('chat', 22)}</span><span class="grow"><b>Preguntar en el chat del grupo</b></span><span class="chev">›</span></button>` : ''}
    </div>
    <div class="actions"><button class="btn gold" data-a="close">Listo</button></div></div>`);
  s.classList.add('sheet-tall');
  const norm = t => normName(String(t).replace(/<[^>]+>/g, ''));
  const paint = () => {
    const nq = norm(q.trim());
    const list = nq ? all.filter(a => norm(a[2] + ' ' + a[3].join(' ') + ' ' + (a[4] || '')).includes(nq)) : all.filter(a => a[0] === cat);
    s.querySelectorAll('[data-hc]').forEach(b => b.classList.toggle('on', !nq && b.dataset.hc === cat));
    const ct = cats.find(c => c[0] === cat);
    $('#hc-list', s).innerHTML = (nq ? `<div class="hc-ttl">${list.length ? `${list.length} resultado${list.length > 1 ? 's' : ''}` : 'No encontré nada con eso. Prueba con otra palabra o pregunta en el chat.'}</div>` : `<div class="hc-ttl">${ct[1]} ${ct[2]}</div>`)
      + list.map((a, k) => `<details class="hc-a" ${k === open && !nq ? 'open' : nq && list.length <= 2 ? 'open' : ''}><summary><span class="hc-e">${a[1]}</span><b>${a[2]}</b></summary>
        <ol class="hc-steps">${a[3].map(x => `<li>${x}</li>`).join('')}</ol>${a[4] ? `<p class="hc-tip">💡 ${a[4]}</p>` : ''}</details>`).join('');
  };
  paint();
  $('#hc-q', s).addEventListener('input', e => { q = e.target.value; paint(); });
  s.onclick = e => {
    const c = e.target.closest('[data-hc]'); if (c) { cat = c.dataset.hc; q = ''; $('#hc-q', s).value = ''; open = 0; paint(); c.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); $('#hc-list', s).scrollIntoView({ block: 'nearest' }); return; }
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; closeModal();
    if (a === 'tour') return setTimeout(() => openTour(true), 250);
    if (a === 'reload') return repairData();
    if (a === 'chat') { location.hash = 'chat'; }
  };
  requestAnimationFrame(() => s.querySelector('[data-hc].on')?.scrollIntoView({ inline: 'center', block: 'nearest' }));
}

document.addEventListener('click', e => { const h = e.target.closest('[data-help]'); if (h) { e.preventDefault(); openHelp(h.dataset.help || undefined); } });

