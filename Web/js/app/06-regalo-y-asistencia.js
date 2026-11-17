/* ---------- estado del regalo + adivinanza ---------- */
const GS = { pensando: ['🤔', 'Pensando'], ideas: ['💡', 'Tengo ideas'], comprado: ['🛍️', 'Ya lo compré'], envuelto: ['🎀', 'Envuelto y listo'] };
const GS_IN = {
  pensando: ['🤔', 'Tu angelito todavía está pensando qué regalarte.'],
  ideas: ['💡', 'Tu angelito ya tiene algunas ideas…'],
  comprado: ['🛍️', '¡Tu angelito ya compró tu regalo!'],
  envuelto: ['🎀', '¡Tu regalo ya está envuelto y listo!']
};
function renderMyAngel() {
  const box = $('#r-extra'); if (!box) return;
  if (!S.me) { box.innerHTML = ''; return; }
  const keep = { g: $('#g-text')?.value, a: $('#g-actual')?.value, f: document.activeElement?.id };
  const ready = !!S.drawMeta && drawReady() && S.drawMeta.ids.includes(S.uid);
  let h = '';
  if (ready && S.assignment?.revealed && mod('estado')) {
    const my = S.giftStatus[S.uid];
    h += `<div class="h2row"><h2>🎁 Mi regalo para mi angelito</h2></div>
      <div class="card"><p class="muted small" style="margin-bottom:12px">Actualiza cómo vas. A esa persona le llega el aviso sin tu nombre 🤫</p>
      <div class="stat4">${Object.entries(GS).map(([k, [e, l]]) => `<button class="${my === k ? 'on' : ''}" data-gs="${k}"><span>${e}</span>${l}</button>`).join('')}</div></div>`;
  }
  if (ready && mod('estado')) {
    const inc = S.incoming && GS_IN[S.incoming.status];
    h += `<div class="h2row"><h2>📬 Mi regalo</h2></div>
      <div class="card incoming"><div class="ie">${inc ? inc[0] : '👀'}</div><div><b>${inc ? inc[1] : 'Tu angelito aún no ha dado señales.'}</b><div class="muted small">Tu angelito es secreto. Solo verás cómo va con tu regalo.</div></div></div>`;
  }
  // adivinanza
  if (!mod('adivinanza')) { box.innerHTML = h; return; }
  const prize = S.event.guessPrize;
  h += `<div class="h2row"><h2>🔮 ¿Qué crees que te van a regalar?</h2></div>`;
  if (prize) h += `<div class="prize2"><div class="pz-sh"></div><span class="pz-ic">🏆</span><div class="grow"><small>Premio para quien más se acerque</small><b>${esc(prize)}</b></div><span class="pz-sp">✨</span></div>`;
  if (!guessesOpen() && S.event.guessesLocked) {
    h += `<div class="card empty"><span class="e">🔒</span>Las adivinanzas ya están cerradas.</div>`;
  } else if (!guessesOpen()) {
    h += `<form class="card stack guesscard" id="g-form"><p class="muted small">Escribe tu adivinanza. Nadie la verá hasta el día del intercambio, y puedes cambiarla hasta entonces.</p>
      <textarea class="in" id="g-text" maxlength="200" placeholder="Creo que me van a regalar… un perfume 👃" style="min-height:70px">${esc(S.myGuess?.text || '')}</textarea>
      <button class="btn gold" type="submit">🔮 ${S.myGuess?.text ? 'Actualizar mi adivinanza' : 'Guardar mi adivinanza'}</button></form>`;
  } else {
    const list = S.guesses.filter(g => P(g.uid) && g.text).sort((a, b) => (b.uid === S.event.guessWinner) - (a.uid === S.event.guessWinner) || pName(a.uid).localeCompare(pName(b.uid)));
    const mine = S.guesses.find(g => g.uid === S.uid) || S.myGuess;
    if (mine?.text) h += `<form class="card stack" id="g-aform" style="margin-bottom:12px"><b>¿Qué te regalaron al final?</b>
      <div style="display:flex;gap:8px"><input class="in" id="g-actual" maxlength="200" placeholder="Me regalaron…" value="${esc(mine.actual || '')}"><button class="btn gold" type="submit">Guardar</button></div></form>`;
    h += list.length ? `<div class="stack">${list.map(g => `<div class="guess ${g.uid === S.event.guessWinner ? 'win' : ''}">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>${esc(pEmoji(g.uid))} ${esc(pName(g.uid))}</b>${g.uid === S.event.guessWinner ? '<span class="tag gold">🏆 ¡Ganador!</span>' : ''}</div>
      <div class="gl">🔮 Creía que le regalarían</div><div class="gv">${esc(g.text)}</div>
      ${g.actual ? `<div class="gl">🎁 Le regalaron</div><div class="gv">${esc(g.actual)}</div>` : ''}</div>`).join('')}</div>`
      : `<div class="card empty"><span class="e">🔮</span>Nadie escribió adivinanzas.</div>`;
  }
  box.innerHTML = h;
  if (keep.g != null && $('#g-text')) $('#g-text').value = keep.g;
  if (keep.a != null && $('#g-actual')) $('#g-actual').value = keep.a;
  if (keep.f && $('#' + keep.f)) $('#' + keep.f).focus();
}
$('#r-extra').addEventListener('click', async e => {
  const b = e.target.closest('[data-gs]'); if (!b || !S.assignment) return;
  const st = b.dataset.gs;
  try {
    const w = writeBatch(db);
    w.set(doc(db, 'giftStatus', S.uid), { status: st, at: serverTimestamp() });
    w.set(doc(db, 'giftIncoming', S.assignment.recipient), { status: st });
    await w.commit(); toast(GS[st][0] + ' ¡Listo! Ya le avisamos (en secreto)'); if (st === 'envuelto') confetti(70);
  } catch (err) { toast(authErr(err)); }
});
$('#r-extra').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    if (e.target.id === 'g-form') {
      const text = $('#g-text').value.trim(); if (!text) return toast('Escribe tu adivinanza');
      await setDoc(doc(db, 'guesses', S.uid), { uid: S.uid, text, at: serverTimestamp() }, { merge: true }); toast('Adivinanza guardada 🔮');
    }
    if (e.target.id === 'g-aform') {
      await setDoc(doc(db, 'guesses', S.uid), { actual: $('#g-actual').value.trim(), actualAt: serverTimestamp() }, { merge: true }); toast('¡Guardado! 🎁');
    }
  } catch (err) { toast(err?.code?.includes('permission') ? 'Las adivinanzas ya se revelaron, no se pueden cambiar.' : authErr(err)); }
});
function renderProgress() {
  const box = $('#h-prog'); if (!box) return;
  if (!S.isOwner || !S.drawMeta || !mod('estado')) { box.style.display = 'none'; return; }
  const ids = S.drawMeta.ids.filter(id => P(id)), n = ids.length || 1;
  const cnt = k => ids.filter(id => S.giftStatus[id] === k).length;
  const none = ids.filter(id => !S.giftStatus[id]).length;
  const cols = { pensando: '#8c8c8c', ideas: '#6aa8ff', comprado: '#ecbc5c', envuelto: '#4fd18b' };
  box.style.display = '';
  box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:baseline"><b>🛍️ ¿Cómo van los regalos?</b> <span class="muted small">(solo tú lo ves)</span><span class="muted small">${cnt('comprado') + cnt('envuelto')} de ${ids.length} listos</span></div>
    <div class="prog">${Object.keys(GS).map(k => `<i style="width:${cnt(k) / n * 100}%;background:${cols[k]}"></i>`).join('')}</div>
    <div class="going" style="margin-top:4px">${Object.entries(GS).map(([k, [e, l]]) => `<span>${e} ${l}: <b>${cnt(k)}</b></span>`).join('')}${none ? `<span>😴 Sin noticias: <b>${none}</b></span>` : ''}</div>`;
}

/* ---------- asistencia y aporte ---------- */
function attSummary() {
  const ids = S.participants.map(p => p.id), a = id => S.att[id] || {};
  return { going: ids.filter(id => a(id).status === 'si').length, notGoing: ids.filter(id => a(id).status === 'no').length,
    pending: ids.filter(id => !a(id).status).length, paid: ids.filter(id => a(id).confirmed).length, said: ids.filter(id => a(id).paid && !a(id).confirmed).length };
}
// 📊 Informes del organizador: asistencia y aportes van por separado (alguien puede ir y todavía no haber pagado)
S.attTab = S.attTab || 'si'; S.payTab = S.payTab || 'debe';
const attOf = id => S.att[id] || {};
// Pestañas parejas con número grande (reutilizable): [clave, emoji, texto, número, color]
const segTabs = (tabs, cur, attr) => `<div class="aseg" style="--n:${tabs.length}" data-noswipe>${tabs.map(([k, e, l, c, cls]) => `<button type="button" class="${cls || ''} ${cur === k ? 'on' : ''}" data-${attr}="${k}"><b>${c}</b><span>${e} ${l}</span></button>`).join('')}</div>`;
// Si la pestaña elegida quedó vacía (y no la eligió la persona), abre una que tenga gente
const pickTab = (tabs, cur, picked) => (tabs.some(t => t[0] === cur) && (picked || tabs.find(t => t[0] === cur)[3])) ? cur : (tabs.find(t => t[3]) || tabs[0])[0];
const personRows = (list, attr, sub, empty) => list.length ? list.map(p => `<button type="button" class="ar-p" data-${attr}="${esc(p.id)}"><span class="ar-av">${esc(p.emoji)}</span><span class="grow"><b>${esc(p.name)}</b><small>${sub(attOf(p.id))}</small></span><span class="ar-ed">${ic('edit', 16)}</span></button>`).join('')
  : `<div class="ar-empty"><span>${empty[0]}</span>${empty[1]}</div>`;
const toolBar = acts => `<div class="ar-tools" style="--n:${acts.length}">${acts.map(([k, e, l]) => `<button type="button" data-aact="${k}"><span>${e}</span>${l}</button>`).join('')}</div>`;
const byName = l => l.sort((a, b) => a.name.localeCompare(b.name, 'es'));
function renderAttReport(sm, amt, num, pre) {
  const n = S.participants.length, tot = n || 1, pct = v => Math.round(v / tot * 100);
  const a1 = sm.going / tot * 360, a2 = a1 + sm.notGoing / tot * 360;
  const tabs = [['si', '✅', 'Van', sm.going, 'ok'], ['no', '❌', 'No van', sm.notGoing, 'no'], ['pend', '⏳', 'Faltan', sm.pending, 'wait']];
  S.attTab = pickTab(tabs, S.attTab, S.attTabPicked);
  const F = { si: a => a.status === 'si', no: a => a.status === 'no', pend: a => !a.status };
  const list = byName(S.participants.filter(p => F[S.attTab](attOf(p.id))));
  $('#att-sum').innerHTML = `<div class="ar">
    <div class="ar-top">
      <div class="ar-ring" style="--a1:${a1}deg;--a2:${a2}deg"><div class="ar-in"><b>${pct(sm.going)}%</b><span>van</span></div></div>
      <div class="ar-sum"><div class="ar-big"><b>${sm.going}</b><span>de ${n} van al angelito</span></div><div class="ar-st ${sm.pending ? '' : 'done'}">${sm.pending ? `Faltan <b>${sm.pending}</b> por responder` : '🎉 <b>Todos respondieron</b>'}</div>
        <div class="ar-stack"><i class="ok" style="width:${pct(sm.going)}%"></i><i class="no" style="width:${pct(sm.notGoing)}%"></i></div></div>
    </div>
    ${segTabs(tabs, S.attTab, 'atab')}
    <div class="ar-list">${personRows(list, 'aped', a => (a.status === 'si' ? '✅ Va' : a.status === 'no' ? '❌ No va' : '⏳ No ha respondido') + (a.setBy ? ' · por el organizador' : ''), S.attTab === 'pend' ? ['🎉', 'Todos respondieron'] : ['🙌', 'Nadie en esta lista'])}</div>
    ${toolBar([['exp-wa', '💬', 'WhatsApp'], ['exp-csv', '📊', 'Excel'], ...(sm.pending ? [['att-remind2', '🔔', 'Recordar']] : [])])}
  </div>`;
  $('#att-list').innerHTML = '';
  // 💵 Aportes (solo si hay monto): quién pagó, quién debe y quién dice que ya
  $('#pay-card').style.display = mod('asistencia') ? '' : 'none';
  if (!amt) { $('#pay-sum').innerHTML = `<div class="pay-setup"><p class="muted small">¿Van a hacer una «vaca» para la comida, la bebida o el lugar? Configúralo y la app se encarga del resto:</p>
      <ol class="pay-how"><li><b>Pones el monto</b>, para qué es y cómo pagar.</li><li><b>Cada quien lo ve</b> en Inicio y toca «Ya lo di».</li><li><b>Tú confirmas</b> cuando te llega el dinero.</li><li>La app <b>recuerda</b> a los que deben antes de la fecha límite.</li></ol>
      <button class="btn gold" type="button" data-payset style="width:100%">💵 Configurar el aporte</button></div>`; return; }
  const owe = p => { const a = attOf(p.id); return a.status === 'si' && !a.confirmed && !a.paid; }, said = p => { const a = attOf(p.id); return !a.confirmed && a.paid; }, paid = p => attOf(p.id).confirmed;
  const cnt = f => S.participants.filter(f).length, nP = cnt(paid), nO = cnt(owe), nS = cnt(said), base = nP + nO + nS;
  const money = v => esc(pre) + Math.round(v).toLocaleString('es-DO'), mp = base ? Math.round(nP / base * 100) : 0;
  const ptabs = [['debe', '⏳', 'Deben', nO, 'no'], ['dice', '🟡', 'Dicen que ya', nS, 'gold'], ['pago', '💵', 'Pagaron', nP, 'ok']];
  S.payTab = pickTab(ptabs, S.payTab, S.payTabPicked);
  const plist = byName(S.participants.filter({ debe: owe, dice: said, pago: paid }[S.payTab]));
  $('#pay-sum').innerHTML = `<div class="ar">
    <div class="pay-cfg"><div class="grow"><b>${esc(amt)} por persona</b><small>${[S.event.contribFor && esc(S.event.contribFor), S.event.contribDue && `Hasta el ${esc(fmtDate(S.event.contribDue, { day: 'numeric', month: 'long' }))}${payLate() ? ' · <em>venció</em>' : ` · ${payDaysLeft()}`}`].filter(Boolean).join(' · ') || 'Toca «Editar» para poner para qué es y la fecha límite'}</small></div><button type="button" class="btn sm" data-payset>${ic('edit', 14)} Editar</button></div>
    <div class="ar-money"><div class="ar-mh"><span>Recogido</span><b>${mp}%</b></div>
      ${num ? `<div class="ar-mv"><b>${money(num * nP)}</b><span>de ${money(num * base)}</span></div>` : `<div class="ar-mv"><b>${nP} de ${base}</b><span>ya pagaron</span></div>`}
      <div class="ar-mbar"><i style="width:${mp}%"></i></div></div>
    ${segTabs(ptabs, S.payTab, 'ptab')}
    <div class="ar-list">${personRows(plist, 'pped', a => a.confirmed ? '💵 Aporte recibido' : a.paid ? '🟡 Dice que ya pagó · confírmalo' : a.status === 'si' ? '⏳ Va y no ha pagado' : '⏳ Sin pagar', S.payTab === 'debe' ? ['💰', 'Nadie debe'] : S.payTab === 'dice' ? ['👍', 'Nada por confirmar'] : ['🕐', 'Nadie ha pagado todavía'])}</div>
    ${toolBar([['att-remind', '📣', 'Recordar pago'], ['exp-wa', '💬', 'WhatsApp']])}
  </div>`;
}
['#att-sum', '#pay-sum'].forEach(sel => $(sel).addEventListener('click', e => {
  if (e.target.closest('[data-payset]')) return paySetup();
  const t = e.target.closest('[data-atab]'); if (t) { S.attTab = t.dataset.atab; S.attTabPicked = true; return renderAttendance(); }
  const pt = e.target.closest('[data-ptab]'); if (pt) { S.payTab = pt.dataset.ptab; S.payTabPicked = true; return renderAttendance(); }
  const a = e.target.closest('[data-aact]'); if (a) return $('#' + a.dataset.aact)?.click();
  const pe = e.target.closest('[data-aped]'); if (pe) return editAtt(pe.dataset.aped, 'att');
  const pp = e.target.closest('[data-pped]'); if (pp) return editAtt(pp.dataset.pped, 'pay');
}));
// 💵 Configurar el aporte (monto, para qué, cómo pagar y fecha límite), todo en un solo lugar
const payDue = () => S.event.contribDue ? new Date(S.event.contribDue + 'T23:59') : null;
const payLate = () => { const d = payDue(); return !!d && d < new Date(); };
const payDaysLeft = () => { const d = payDue(); if (!d) return ''; const n = Math.ceil((d - Date.now()) / 864e5); return n <= 0 ? 'vence hoy' : n === 1 ? 'falta 1 día' : `faltan ${n} días`; };
function paySetup() {
  const c = S.event, num = String(c.contribAmount || '').replace(/[^\d]/g, '');
  const s2 = openModal(`<h3>💵 Aporte del grupo</h3><p class="muted small">Lo verán todos los que van, con un botón para avisar que ya pagaron.</p>
    <form class="stack" id="pay-form" style="margin-top:12px">
      <label class="field"><span>¿Cuánto da cada persona?</span><div class="pay-amt"><b>RD$</b><input class="in" name="amt" inputmode="numeric" maxlength="7" placeholder="500" value="${esc(num)}"></div></label>
      <div class="wi-chips">${[300, 500, 700, 1000, 1500].map(v => `<button type="button" class="wi-chip" data-pv="${v}">RD$${v.toLocaleString('es-DO')}</button>`).join('')}</div>
      <label class="field"><span>¿Para qué es? <small class="muted">(opcional)</small></span><input class="in" name="for" maxlength="100" placeholder="Comida, bebida y decoración" value="${esc(c.contribFor || '')}"></label>
      <label class="field"><span>¿Cómo pagar y a quién?</span><input class="in" name="info" maxlength="160" placeholder="Transferencia a Banreservas 123-456 o en efectivo a Carmen" value="${esc(c.contribInfo || '')}"></label>
      <label class="field"><span>Fecha límite <small class="muted">(opcional)</small></span><input class="in" type="date" name="due" value="${esc(c.contribDue || '')}"></label>
      <div class="actions">${c.contribAmount ? '<button type="button" class="btn ghost" data-a="off">Quitar aporte</button>' : '<button type="button" class="btn ghost" data-a="x">Cancelar</button>'}<button class="btn gold" type="submit">Guardar</button></div></form>`);
  s2.onclick = async e => {
    const v = e.target.closest('[data-pv]'); if (v) { s2.querySelector('[name=amt]').value = v.dataset.pv; return; }
    const a = e.target.closest('[data-a]')?.dataset.a; if (a === 'x') return closeModal();
    if (a === 'off' && await confirmBox('¿Quitar el aporte?', 'Ya no se mostrará a nadie. Los pagos marcados se quedan guardados.', 'Quitar')) { if (await saveEvent({ contribAmount: '', contribFor: '', contribDue: '' })) { closeModal(); toast('Aporte quitado'); } }
  };
  $('#pay-form', s2).addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target.elements, n = parseInt(String(f.amt.value).replace(/[^\d]/g, ''), 10);
    if (!n) return toast('Pon el monto del aporte');
    if (f.due.value && S.event.eventDate && f.due.value > S.event.eventDate.slice(0, 10)) return toast('La fecha límite debe ser antes del evento');
    if (await saveEvent({ contribAmount: 'RD$' + n.toLocaleString('es-DO'), contribFor: f.for.value.trim(), contribInfo: f.info.value.trim(), contribDue: f.due.value || '' })) { closeModal(); toast('💵 Aporte guardado'); }
  });
}
// ✏️ Quien tiene permiso de aportes cambia la asistencia o el pago de alguien (cada cosa por su lado)
async function editAtt(id, what) {
  const p = P(id), a = attOf(id); if (!p || !can('aportes')) return;
  const amt = S.event.contribAmount, att = what !== 'pay', pay = what !== 'att' && amt;
  const k = await sheet({ head: personHead(p, att && pay ? 'Asistencia y aporte' : att ? 'Asistencia' : 'Aporte'), items: [
    att && a.status !== 'si' && { k: 'si', icon: 'check', label: 'Va' },
    att && a.status !== 'no' && { k: 'no', icon: 'xcircle', label: 'No va' },
    att && a.status && { k: 'pend', icon: 'undo', label: 'Dejar sin responder' },
    pay && !a.confirmed && { k: 'pay', icon: 'coins', label: 'Pagó su aporte', hint: a.paid ? 'Dice que ya lo dio' : '' },
    pay && a.confirmed && { k: 'unpay', icon: 'undo', label: 'Quitar el pago', hint: 'Vuelve a quedar pendiente' },
  ] });
  if (!k) return;
  const o = { uid: id, setBy: S.uid || 'admin' };
  if (k === 'si' || k === 'no') o.status = k; if (k === 'pend') o.status = deleteField();
  if (k === 'pay') o.confirmed = true; if (k === 'unpay') o.confirmed = false;
  if (k === 'pay' || k === 'unpay') delete o.setBy; // el pago no cambia quién marcó la asistencia
  try { await setDoc(doc(adb, 'attendance', id), o, { merge: true }); toast({ si: '✅ Marcado: va', no: '❌ Marcado: no va', pend: '⏳ Quedó sin responder', pay: '💵 Aporte recibido', unpay: 'Pago quitado' }[k]); }
  catch (err) { toast(authErr(err)); }
}
// Lista de quiénes van / no pueden / no han respondido
function openAttList() {
  const g = st => S.participants.filter(p => ((S.att[p.id] || {}).status || '') === st).sort((a, b) => a.name.localeCompare(b.name));
  const col = (t, cls, l) => `<div class="al-g ${cls}"><div class="al-h"><b>${t}</b><span>${l.length}</span></div>${l.length ? `<div class="al-l">${l.map((p, k) => `<div class="al-p" style="--d:${k * 30}ms"><span>${esc(p.emoji)}</span>${esc(p.name)}${p.id === S.uid ? ' <small>(tú)</small>' : ''}</div>`).join('')}</div>` : '<p class="muted small">Nadie</p>'}</div>`;
  const s2 = openModal(`<h3>🎉 ¿Quiénes van?</h3><div class="al">${col('✅ Van', 'ok', g('si'))}${col('😢 No pueden', 'no', g('no'))}${col('⏳ Sin responder', 'wait', g(''))}</div><div class="actions"><button class="btn gold" data-a="x">Listo</button></div>`);
  s2.onclick = e => { if (e.target.closest('[data-a]')) closeModal(); };
}
function renderAttendance() {
  const box = $('#h-att'); if (!box) return;
  if (!S.me || !mod('asistencia')) { box.innerHTML = ''; } else {
    const c = S.event, me = S.att[S.uid] || {}, sm = attSummary();
    const late = c.rsvpDeadline && todayStr() > c.rsvpDeadline;
    const goingP = S.participants.filter(p => (S.att[p.id] || {}).status === 'si');
    const faces = goingP.slice(0, 6).map((p, k) => `<span class="rf" style="--k:${k}">${esc(p.emoji)}</span>`).join('') + (goingP.length > 6 ? `<span class="rf more" style="--k:6">+${goingP.length - 6}</span>` : '');
    const editing = !me.status || S.attEdit;
    let h = `<div class="card rsvpcard" style="margin-bottom:16px"><b class="rv-t">🎉 ¿Vas al angelito?</b>
      ${c.rsvpDeadline ? `<p class="muted small" style="margin-top:2px">${late ? '⚠️ La fecha para confirmar ya pasó' : 'Confirma antes del ' + esc(fmtDate(c.rsvpDeadline))}</p>` : ''}
      <button class="rv-who" data-attlist type="button"><span class="rv-faces">${faces || '<span class="rf">🙂</span>'}</span><span class="rv-n"><b>${sm.going}</b><span>${sm.going === 1 ? 'va' : 'van'}</span></span><span class="rv-sub">${sm.notGoing ? `${sm.notGoing} no pueden` : ''}${sm.notGoing && sm.pending ? ' · ' : ''}${sm.pending ? `${sm.pending} sin responder` : ''}<em>Ver lista ›</em></span></button>
      ${editing ? `<div class="rsvp" style="grid-template-columns:1fr 1fr;margin-top:12px"><button class="${me.status === 'si' ? 'on' : ''}" data-att="si"><span class="rs-i">${ic('check', 26)}</span>Sí, voy</button><button class="${me.status === 'no' ? 'on' : ''}" data-att="no"><span class="rs-i">${ic('xcircle', 26)}</span>No puedo</button></div>`
        : `<div class="rv-me ${me.status}"><span class="rv-mi">${me.status === 'si' ? ic('check', 18) : ic('xcircle', 18)}</span><b>${me.status === 'si' ? '¡Vas! Te esperamos' : 'Dijiste que no puedes ir'}</b><button class="btn sm" data-attedit type="button">Cambiar</button></div>`}`;
    if (me.status === 'si' && c.contribAmount) {
      const st = me.confirmed ? 3 : me.paid ? 2 : 1, late = !me.confirmed && !me.paid && payLate();
      h += `<div class="mypay ${late ? 'late' : ''}">
        <div class="mp-h"><span class="mp-i">💵</span><div class="grow"><b>Tu aporte: ${esc(c.contribAmount)}</b><small>${[c.contribFor && esc(c.contribFor), c.contribDue && (me.confirmed ? '' : late ? '⚠️ La fecha límite ya pasó' : `Hasta el ${esc(fmtDate(c.contribDue, { day: 'numeric', month: 'long' }))} · ${payDaysLeft()}`)].filter(Boolean).join(' · ')}</small></div></div>
        <div class="mp-steps">${['Pagar', 'Avisar', 'Confirmado'].map((l, k) => `<div class="${k + 1 < st || st === 3 ? 'done' : k + 1 === st ? 'cur' : ''}"><i>${k + 1 < st || st === 3 ? '✓' : k + 1}</i><span>${l}</span></div>`).join('')}</div>
        ${c.contribInfo && !me.confirmed ? `<div class="mp-info"><span>${esc(c.contribInfo)}</span><button type="button" class="btn xs" data-paycopy>${ic('copy', 14)} Copiar</button></div>` : ''}
        <div class="mp-msg">${me.confirmed ? '✅ <b>El organizador confirmó tu aporte.</b> ¡Gracias!' : me.paid ? '⏳ Avisaste que ya lo diste. Falta que el organizador lo confirme.' : 'Cuando lo des, toca <b>«Ya lo di»</b> para avisarle al organizador.'}</div>
        ${me.confirmed ? '' : me.paid ? '<button class="btn sm ghost" data-paid="0" style="width:100%">Me equivoqué, todavía no</button>' : '<button class="btn gold" data-paid="1" style="width:100%">💵 Ya lo di</button>'}</div>`;
    }
    if (c.contribAmount && sm.going) {
      const going = S.participants.filter(p => (S.att[p.id] || {}).status === 'si');
      const paidL = going.filter(p => S.att[p.id].confirmed), pendL = going.filter(p => !S.att[p.id].confirmed);
      h += `<details class="fold" style="margin:14px 0 0"><summary><span class="cnts"><span class="cnt ok">💵 ${paidL.length} ya aportaron</span><span class="cnt wait">⏳ ${pendL.length} faltan</span></span></summary>
        <div class="muted small"><b>Ya aportaron</b></div><div class="going">${paidL.map(p => `<span>${esc(p.emoji)} ${esc(shortName(p))}</span>`).join('') || '<span>Nadie todavía</span>'}</div>
        <div class="muted small" style="margin-top:10px"><b>Falta su aporte</b></div><div class="going">${pendL.map(p => `<span>${esc(p.emoji)} ${esc(shortName(p))}${S.att[p.id].paid ? ' · dice que ya' : ''}</span>`).join('') || '<span>¡Nadie! 🎉</span>'}</div></details>`;
    }
    box.innerHTML = h + '</div>';
  }
  if (!S.isAdmin) return;
  const sm = attSummary(), amt = S.event.contribAmount;
  const num = parseFloat(String(amt || '').replace(/[^\d.]/g, '')), pre = String(amt || '').match(/^[^\d]*/)?.[0].trim() || '';
  renderAttReport(sm, amt, num, pre);
}
$('#h-att').addEventListener('click', async e => {
  if (e.target.closest('[data-paycopy]')) return copyText(S.event.contribInfo || '', '📋 Datos para pagar copiados');
  if (e.target.closest('[data-attedit]')) { S.attEdit = true; return renderAttendance(); }
  if (e.target.closest('[data-attlist]')) return openAttList();
  const b = e.target.closest('[data-att],[data-paid]'); if (!b || !S.me) return;
  if (b.dataset.att) S.attEdit = false;
  const cur = S.att[S.uid] || {};
  const o = { uid: S.uid, status: b.dataset.att || cur.status || 'si', paid: b.dataset.paid != null ? b.dataset.paid === '1' : !!cur.paid, at: serverTimestamp() }; if (cur.setBy) o.setBy = deleteField();
  if (o.status === 'no') o.paid = !!cur.paid;
  try { await setDoc(doc(db, 'attendance', S.uid), o, { merge: true }); if (b.dataset.att === 'si') { toast('¡Genial, te esperamos! 🎉'); confetti(60); } else if (b.dataset.paid === '1') toast('Anotado 💵 El organizador lo confirmará'); }
  catch (err) { toast(authErr(err)); }
});
// Menú ⋯ de cada persona: reusa las mismas acciones de la lista (PIN, editar, quitar, quitar pago).
document.addEventListener('click', e => {
  const m = e.target.closest('[data-pmore]'); if (!m) return;
  const id = m.dataset.pmore, p = P(id), a = S.att[id] || {}; if (!p) return;
  sheet({ head: personHead(p, 'Participante'), items: [
    can('aportes') && { k: 'attEdit', icon: 'calcheck', label: 'Asistencia', hint: a.status === 'si' ? 'Va' : a.status === 'no' ? 'No va' : 'Sin responder' },
    can('aportes') && S.event.contribAmount && { k: 'payEdit', icon: 'coins', label: 'Aporte', hint: a.confirmed ? 'Pagó' : a.paid ? 'Dice que ya pagó' : 'No ha pagado' },
    S.isOwner && { k: 'presetPin', icon: 'key', label: 'Darle un PIN temporal', hint: 'Si olvidó su PIN; conserva todo lo suyo' },
    { k: 'pedit', icon: 'edit', label: 'Editar nombre o ícono' },
    { k: 'rm', icon: 'userx', label: 'Quitar del angelito', hint: 'Se borra todo lo suyo', danger: true },
  ] }).then(k => {
    if (!k) return; if (k === 'attEdit') return editAtt(id, 'att'); if (k === 'payEdit') return editAtt(id, 'pay');
    const t = document.createElement('button'); t.hidden = true; t.dataset[k] = id; if (k === 'conf') t.dataset.v = '0';
    $('#p-list').appendChild(t); setTimeout(() => { t.click(); t.remove(); }, 60);
  });
});
document.addEventListener('click', e => { const f = e.target.closest('[data-pf2]'); if (f) { S.pFilter = f.dataset.pf2; renderAdmin(); } });
document.addEventListener('input', e => { if (e.target.id === 'p-q') { S.pQuery = e.target.value; renderAdmin(); } });
// 💵 Marcar o quitar un pago (lista de participantes y menú ⋯ usan lo mismo)
async function setPaid(id, v) {
  try { await setDoc(doc(adb, 'attendance', id), { uid: id, confirmed: v }, { merge: true }); toast(v ? '💵 Marcado como pagó' : 'Pago quitado'); } catch (err) { toast(authErr(err)); }
}
['#p-list', '#att-list'].forEach(sel => $(sel).addEventListener('click', e => { const b = e.target.closest('[data-conf]'); if (b) setPaid(b.dataset.conf, b.dataset.v === '1'); }));

