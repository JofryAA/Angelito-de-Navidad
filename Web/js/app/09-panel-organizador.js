/* ---------- admin ---------- */
let cfgDirty = false;
$('#cfg-form').addEventListener('input', () => { cfgDirty = true; syncCfgBar(); });
// Barra fija de "cambios sin guardar" (en vez de un botón flotando encima de los campos)
function syncCfgBar() { const b = $('#cfg-bar'); if (b) b.hidden = !(cfgDirty && S.admGrp === 'evento' && location.hash === '#admin'); }
$('#cfg-bar').addEventListener('click', e => { if (e.target.closest('[data-cfg=save]')) $('#cfg-form').requestSubmit(); if (e.target.closest('[data-cfg=undo]')) { cfgDirty = false; syncCfgBar(); renderAdmin(); toast('Cambios descartados'); } });

/* ---------- panel del organizador: secciones ---------- */
// Secciones del panel en el orden en que se prepara el angelito
const ADM_GROUPS = [['resumen', '🏠', 'Resumen'], ['evento', '🎄', 'Evento'], ['personas', '👥', 'Personas'], ['asistencia', '✅', 'Asistencia'], ['aportes', '💵', 'Aportes'], ['sorteo', '🎡', 'Sorteo'], ['actividades', '📅', 'Actividades'], ['mensajes', '💬', 'Mensajes'], ['fiesta', '🎉', 'Fiesta'], ['ajustes', '⚙️', 'Ajustes']];
// Qué se hace en cada sección (se muestra arriba, para que siempre se sepa el paso a paso)
const ADM_INTRO = {
  evento: ['🎄', 'Lo primero: la fecha, el lugar con su mapa, el presupuesto del regalo y las reglas. Todo el grupo lo ve en Inicio.'],
  personas: ['👥', 'Quién está inscrito y quién te ayuda a organizar. Si alguien olvida su PIN, toca ⋯ junto a su nombre y dale uno temporal.'],
  asistencia: ['✅', ['Cada quien confirma si va desde su Inicio.', 'Si alguien te avisa por otro lado, tócalo y cambia su respuesta.', 'Recuérdales a los que faltan con un toque.']],
  aportes: ['💵', ['Pon el monto, para qué es y cómo pagar.', 'Cada quien toca «Ya lo di» en su Inicio.', 'Tú confirmas cuando te llega el dinero.', 'La app les recuerda a los que deben.']],
  sorteo: ['🎡', ['Espera a que estén todos inscritos.', 'Pon las restricciones, por ejemplo esposos.', 'Genera el sorteo: a todos les llega el aviso para girar.', 'En la fiesta haz la gran revelación.']],
  actividades: ['📅', 'Votaciones, trivias y dinámicas para la fiesta. Cada una avisa al grupo cuando empieza.'],
  mensajes: ['💬', 'Avisos para todo el grupo, el chat y el buzón anónimo.'],
  fiesta: ['🎉', 'Lo que se usa el día de la fiesta: el modo pantalla grande y las adivinanzas.'],
  ajustes: ['⚙️', 'Qué secciones ve el grupo, pedir que todos vuelvan a entrar y preparar el próximo año.'],
};
function sortAdm() { // ordena las tarjetas por sección
  const panel = $('#adm-panel'), ord = g => ADM_GROUPS.findIndex(x => x[0] === g);
  [...panel.querySelectorAll(':scope > .admin-sec')].sort((a, b) => ord(a.dataset.grp) - ord(b.dataset.grp) || (+a.dataset.ord - +b.dataset.ord)).forEach(el => panel.appendChild(el));
}
sortAdm(); $('[data-grp="ajustes"][data-ord="3"]')?.classList.add('danger');
try { S.admGrp = sessionStorage.getItem('angelito:admGrp') || 'resumen'; } catch { S.admGrp = 'resumen'; }
// Secciones que esta persona puede ver (según sus permisos y lo que está activo)
function admAvail() { const secs = $$('#adm-panel > .admin-sec'); return ADM_GROUPS.filter(([g]) => secs.some(el => el.dataset.grp === g && (el.id === 'adm-dash' || el.style.display !== 'none'))); }
function applyAdmGroups() {
  const secs = $$('#adm-panel > .admin-sec'), avail = admAvail();
  if (!avail.some(([g]) => g === S.admGrp)) S.admGrp = 'resumen';
  $('#adm-nav').innerHTML = navHTML(avail, S.admGrp); decoratePanel($('#adm-panel'));
  { let it = $('#adm-intro'); if (!it) { it = document.createElement('div'); it.id = 'adm-intro'; $('#adm-nav').after(it); } const x = ADM_INTRO[S.admGrp]; it.hidden = !x; if (x) it.innerHTML = `<span>${x[0]}</span>${Array.isArray(x[1]) ? `<ol>${x[1].map(l => `<li>${l}</li>`).join('')}</ol>` : `<p>${x[1]}</p>`}`; }
  secs.forEach(el => el.classList.toggle('gh', el.dataset.grp !== S.admGrp));
}
function admGo(g) {
  if (cfgDirty && S.admGrp === 'evento' && g !== 'evento') toast('⚠️ Tienes cambios del evento sin guardar');
  S.admGrp = g; try { sessionStorage.setItem('angelito:admGrp', g); } catch { } syncCfgBar();
  applyAdmGroups(); renderAdmDash(); renderDrawRules();
  $('#adm-nav [data-ag].on')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  const top = $('#adm-nav').getBoundingClientRect().top + scrollY - 8; if (scrollY > top) scrollTo({ top, behavior: 'smooth' });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-ag]'); if (b) { admGo(b.dataset.ag); const t = b.dataset.nextgo; if (t) setTimeout(() => { const el = $('#' + t); if (!el) return; if (el.tagName === 'DETAILS') el.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 250); } });
$('#party-unlock').addEventListener('click', async () => {
  if (!(await confirmBox('¿Reabrir pistas y sospechas?', 'Todos podrán volver a mandar pistas y cambiar a quién creen que es su angelito.', 'Reabrir'))) return;
  if (await saveEvent({ angelLocked: false })) toast('🔓 Pistas y sospechas abiertas otra vez');
});
document.addEventListener('click', e => {
  if (!e.target.closest('#gs-who')) return;
  const ids = S.drawMeta?.ids.filter(id => P(id)) || [], ok = id => ['comprado', 'envuelto'].includes(S.giftStatus[id]);
  const row = id => `<div class="al-p"><span>${esc(pEmoji(id))}</span>${esc(pName(id))}${S.giftStatus[id] ? ` <small>· ${esc(GS[S.giftStatus[id]]?.[1] || '')}</small>` : ''}</div>`;
  const s2 = openModal(`<h3>🛍️ ¿Quién ya tiene el regalo?</h3><p class="muted small">Solo ves si cada quien compró, no a quién le regala. Los que faltan reciben recordatorios solos 7 y 2 días antes.</p>
    <div class="al"><div class="al-g no"><div class="al-h"><b>⏳ Faltan</b><span>${ids.filter(id => !ok(id)).length}</span></div><div class="al-l">${ids.filter(id => !ok(id)).map(row).join('') || '<p class="muted small">¡Nadie! 🎉</p>'}</div></div>
    <div class="al-g ok"><div class="al-h"><b>✅ Ya lo tienen</b><span>${ids.filter(ok).length}</span></div><div class="al-l">${ids.filter(ok).map(row).join('') || '<p class="muted small">Nadie todavía</p>'}</div></div></div>
    <div class="actions"><button class="btn gold" data-a="x">Listo</button></div>`);
  s2.onclick = ev => { if (ev.target.closest('[data-a]')) closeModal(); };
});
function renderAdmDash() {
  { const u = $('#party-unlock'); if (u) u.hidden = !(S.isOwner && S.event.angelLocked); }
  const box = $('#adm-dash'); if (!box || S.admGrp !== 'resumen') return;
  const c = S.event, ps = S.participants, sm = attSummary();
  const withW = ps.filter(p => S.wishes.some(w => w.uid === p.id)).length;
  const drawn = !!S.drawMeta && drawReady();
  const tile = (k, v, sub, g) => `<button class="dt" data-ag="${g}"><div class="dk">${k}</div><div class="dv">${v}</div>${sub ? `<div class="ds">${sub}</div>` : ''}</button>`;
  const steps = [
    [!!(c.eventDate && c.place), '🎄 Pon la fecha y el lugar', 'evento', can('evento')],
    [(c.rules || []).length > 0, '📜 Escribe las reglas', 'evento', can('evento') && mod('reglas')],
    [S.activities.length > 0, '📅 Crea las actividades', 'actividades', can('actividades')],
    [ps.length >= 3, '👥 Que se inscriban al menos 3 personas', 'personas', can('participantes')],
    [drawn, S.drawMeta && !drawReady() ? '🎡 La lista cambió: limpia el sorteo y genera uno nuevo' : '🎡 Genera el sorteo', 'sorteo', S.isOwner],
    [!c.contribAmount || (sm.going > 0 && sm.paid >= sm.going), '💵 Recibe los aportes', 'aportes', can('aportes') && !!c.contribAmount && mod('asistencia')],
  ].filter(x => x[3]);
  const done = steps.filter(x => x[0]).length;
  const nextStep = steps.find(x => !x[0]);
  const cta = nextStep ? `<button class="card nextc hot" data-ag="${nextStep[2]}" data-nextgo="${nextStep[1].includes('sorteo') ? 'd-gen' : ''}" style="width:100%;text-align:left;margin-bottom:14px"><div class="nx-e">👉</div><div class="grow"><span class="muted small">Siguiente paso</span><b style="display:block">${nextStep[1]}</b></div><span class="btn sm gold">Hacerlo ahora</span></button>` : `<div class="card nextc" style="margin-bottom:14px"><div class="nx-e">✅</div><div class="grow"><b>${S.isOwner ? '¡Todo listo!' : 'Tus tareas están al día'}</b><div class="muted small">${S.isOwner ? 'Solo falta disfrutar la fiesta.' : 'Lo demás le toca al organizador principal.'}</div></div></div>`;
  // Estado de cada sección, para verlo todo de un vistazo: [texto, ok | pend | info]
  const amt = c.contribAmount, base = S.participants.filter(p => (S.att[p.id] || {}).status === 'si' || (S.att[p.id] || {}).confirmed).length;
  const giftB = drawn && mod('estado') ? S.drawMeta.ids.filter(id => P(id) && ['comprado', 'envuelto'].includes(S.giftStatus[id])).length : null;
  const ST = {
    evento: c.eventDate && c.place ? [`${fmtDate(c.eventDate, { day: 'numeric', month: 'short' })} · ${c.place}`, 'ok'] : ['Falta la fecha o el lugar', 'pend'],
    personas: [`${ps.length} inscritos · ${regOpen() ? 'inscripciones abiertas' : 'inscripciones cerradas'}`, ps.length >= 3 ? 'ok' : 'pend'],
    asistencia: [sm.pending ? `${sm.going} van · faltan ${sm.pending} por responder` : `${sm.going} van · todos respondieron`, sm.pending ? 'pend' : 'ok'],
    aportes: amt ? [`${sm.paid} de ${base} pagaron${sm.said ? ` · ${sm.said} por confirmar` : ''}`, base && sm.paid >= base ? 'ok' : 'pend'] : ['Sin configurar', 'info'],
    sorteo: drawn ? [`Listo${giftB != null ? ` · ${giftB} de ${S.drawMeta.ids.filter(id => P(id)).length} ya compraron` : ''}`, 'ok'] : [S.drawMeta ? 'La lista cambió: hay que repetirlo' : 'Todavía no se ha hecho', 'pend'],
    actividades: [S.activities.length ? `${S.activities.length} programadas` : 'Ninguna todavía', S.activities.length ? 'ok' : 'info'],
    mensajes: [`${S.notices.length || 0} ${S.notices.length === 1 ? "aviso" : "avisos"} · ${S.qCount || 0} ${S.qCount === 1 ? "anónimo" : "anónimos"}`, "info"],
    fiesta: ['Para el día del evento', 'info'],
    ajustes: ['Secciones, entrar de nuevo y año nuevo', 'info'],
  };
  const secs = admAvail().filter(([g]) => g !== 'resumen');
  box.innerHTML = cta + `${steps.length ? `<div class="card adm-prog"><div class="ap-ring" style="--p:${done / steps.length * 360}deg"><b>${done}/${steps.length}</b></div><div class="grow"><b>Preparación del angelito</b><span>${done === steps.length ? '🎉 Todo listo' : `Faltan ${steps.length - done} ${steps.length - done === 1 ? 'paso' : 'pasos'}`}</span></div></div>` : ''}
    <div class="adm-grid">${secs.map(([g, e, l]) => { const [txt, k] = ST[g] || ['', 'info']; return `<button class="ag ${k}" data-ag="${g}"><span class="ag-e">${e}</span><span class="ag-t"><b>${l}</b><small>${esc(txt)}</small></span><i class="ag-dot"></i></button>`; }).join('')}</div>
    ${giftB != null && S.isOwner ? `<button class="dt" id="gs-who" style="width:100%;margin-top:10px"><div class="dk">🛍️ ¿Quién ya compró el regalo?</div><div class="ds">${giftB} de ${S.drawMeta.ids.filter(id => P(id)).length} · toca para ver la lista</div></button>` : ''}
    ${steps.length && done < steps.length ? `<div class="card" style="margin-top:14px"><b>Pasos para tener todo listo</b>
      <div class="steps">${steps.map(([ok, l, g]) => `<button class="step ${ok ? 'done' : ''}" data-ag="${g}"><span class="ck">${ok ? '✓' : ''}</span><span>${l}</span>${ok ? '' : '<span class="go">Ir ›</span>'}</button>`).join('')}</div></div>` : ''}`;
}
function renderAdmin() {
  renderDlLink();
  $('#adm-panel').style.display = S.isAdmin ? '' : 'none';
  const lg = $('#adm-login');
  if (S.isAdmin) { lg.innerHTML = ''; }
  else if (!$('#adm-form')) {
    lg.innerHTML = `<form class="card stack" id="adm-form" style="max-width:420px">
      <div class="lockcard" style="padding:6px 0 0"><span class="e">🛡️</span><b>Área del organizador</b><p class="muted small">Entra con el usuario y la contraseña del organizador principal. Los administradores entran con su nombre y su PIN, como siempre.</p></div>
      <label class="field"><span>Usuario</span><input class="in" id="adm-user" autocapitalize="off" autocomplete="username" placeholder="admin"></label>
      <label class="field"><span>Contraseña</span><input class="in" id="adm-pass" type="password" autocomplete="current-password" required></label>
      <div class="err" id="adm-err"></div>
      <button class="btn gold" type="submit">Entrar</button></form>`;
  }
  if (!S.isAdmin) return;
  $$('#adm-panel [data-perm]').forEach(el => { el.style.display = (el.dataset.perm === 'owner' ? S.isOwner : can(el.dataset.perm)) ? '' : 'none'; });
  const rr = $('#d-reveal-row'); if (rr) rr.style.display = S.drawMeta ? '' : 'none';
  { const sec = $('#d-gen')?.closest('.admin-sec'), want = (S.drawMeta && drawReady()) ? '3' : '0'; if (sec && sec.dataset.ord !== want) { sec.dataset.ord = want; sortAdm(); } } // sin sorteo, 'Generar sorteo' va primero
  applyAdmGroups(); renderAdmDash(); renderDrawRules();
  $('#adm-who').textContent = S.staffSelf && S.me ? S.me.name : S.isOwner ? 'Organizador principal' : S.staff?.name || 'Organizador';
  $('#adm-role').textContent = S.isOwner ? 'Panel · acceso total' : 'Panel · administrador';
  { const k = S.staffSelf && S.me ? 'me' : S.isOwner ? 'crown' : 'shield'; const el = $('#adm-ic'); if (el.dataset.k !== k + (S.me?.emoji || '')) { el.dataset.k = k + (S.me?.emoji || ''); el.innerHTML = k === 'me' ? esc(S.me.emoji || '🙂') : pic(k, 22); } }
  $('#adm-acts').hidden = !!S.staffSelf; // quien administra con su propia cuenta no tiene otra contraseña ni otra sesión que cerrar
  renderStaff();
  const f = $('#cfg-form');
  if (!cfgDirty) for (const k of ['eventName', 'subtitle', 'eventDate', 'place', 'mapsUrl', 'budget', 'dress', 'revealDate', 'revealTime', 'notes', 'rsvpDeadline']) f.elements[k].value = S.event[k] || '';
  $('#reg-tg').classList.toggle('on', regOpen());
  $('#g-open').classList.toggle('on', guessesOpen());
  $('#mod-list').innerHTML = Object.entries(MODS).map(([k, [e, l]]) => `<div class="switch"><div><b>${e} ${l}</b></div><button class="tg ${mod(k) ? 'on' : ''}" data-mod="${k}" aria-label="${esc(l)}"></button></div>`).join('');
  if (document.activeElement?.id !== 'cp-text' && !cpDirty) $('#cp-text').value = prompts().join('\n');
  const gN = (S.adminGuesses || []).filter(g => g.text).length;
  $('#g-count').textContent = S.isOwner ? `${gN} de ${S.participants.length} ya escribieron su adivinanza.` : '';
  if (document.activeElement?.id !== 'g-prize') $('#g-prize').value = S.event.guessPrize || '';
  const gw = $('#g-winner');
  if (document.activeElement !== gw) { gw.innerHTML = '<option value="">Sin elegir</option>' + S.participants.map(p => `<option value="${esc(p.id)}">${esc(p.emoji)} ${esc(p.name)}</option>`).join(''); gw.value = S.event.guessWinner || ''; }
  const rl = Array.isArray(S.event.rules) ? S.event.rules : [];
  $('#r-list').innerHTML = rl.length ? rl.map((r, i) => `<div class="rule" style="align-items:center"><div class="ri">${esc(r.icon || '⭐')}</div><div class="rt" style="flex:1;padding-top:0">${esc(r.text)}</div>
    <div style="display:flex;gap:2px"><button class="x" data-rup="${i}" ${i === 0 ? 'disabled style="opacity:.3"' : ''} aria-label="Subir">↑</button><button class="x" data-rdown="${i}" ${i === rl.length - 1 ? 'disabled style="opacity:.3"' : ''} aria-label="Bajar">↓</button><button class="x" data-rdel="${i}" aria-label="Borrar">✕</button></div></div>`).join('')
    : '<p class="muted small">Todavía no hay reglas.</p>';
  $('#q-now').classList.toggle('on', !!S.event.revealNow);
  const hasDraw = !!S.drawMeta;
  // Una sola lista: asistencia, pago, ruleta y acciones en la misma fila (sin listas repetidas).
  const attOf = id => S.att[id] || {}, payOn = mod('asistencia') && !!S.event.contribAmount;
  const F = S.pFilter || 'todos', PQ = normName(S.pQuery || '');
  const flt = { todos: () => true, van: id => attOf(id).status === 'si', sin: id => !attOf(id).status, no: id => attOf(id).status === 'no', debe: id => attOf(id).status === 'si' && !attOf(id).confirmed };
  const cntF = k => S.participants.filter(p => flt[k](p.id)).length;
  const chips = [['todos', 'Todos'], ['van', 'Van'], ['sin', 'Sin responder'], ['no', 'No van'], ...(payOn ? [['debe', 'Falta pagar']] : [])];
  if (!$('#p-q')) $('#p-tools').innerHTML = `<input class="in" id="p-q" type="search" placeholder="🔍 Buscar persona…" autocomplete="off"><div class="pfil" id="p-fil"></div>`;
  $('#p-tools').style.display = S.participants.length > 5 ? '' : 'none'; // con pocas personas no hace falta
  $('#p-fil').innerHTML = chips.map(([k, l]) => `<button class="${F === k ? 'on' : ''}" data-pf2="${k}">${l} <span>${cntF(k)}</span></button>`).join('');
  const list = S.participants.filter(p => flt[F](p.id) && (!PQ || normName(p.name).includes(PQ)));
  $('#p-list').innerHTML = !S.participants.length ? `<p class="muted small">Nadie se ha registrado todavía. Comparte el enlace de la página.</p>`
    : !list.length ? '<p class="muted small center">Nadie en este filtro.</p>' : list.map(p => {
    const a = attOf(p.id);
    const att = mod('asistencia') ? (a.status === 'si' ? '<span class="bdg ok">Va</span>' : a.status === 'no' ? '<span class="bdg no">No va</span>' : '<span class="bdg wait">Sin responder</span>') : '';
    const pay = payOn && a.status === 'si' ? (a.confirmed ? '<span class="bdg paid">💵 Pagó</span>' : a.paid ? '<span class="bdg said">Dice que pagó</span>' : '<span class="bdg due">Falta pagar</span>') : '';
    const spin = hasDraw && S.assignments[p.id] ? (S.assignments[p.id].revealed ? '<span class="bdg">🎡 Giró</span>' : '<span class="bdg wait">🎡 No ha girado</span>') : '';
    const gs = GS[S.giftStatus[p.id]];
    const payBtn = payOn && can('aportes') && a.status === 'si' && !a.confirmed ? `<button class="btn xs gold" data-conf="${esc(p.id)}" data-v="1">✓ Pagó</button>` : '';
    return `<div class="prow"><span class="pe">${esc(p.emoji)}</span><div class="grow"><div class="t">${esc(p.name)}</div><div class="bdgs">${att}${pay}${spin}${gs ? `<span class="bdg">${gs[0]} ${gs[1]}</span>` : ''}</div></div>
      <div class="pact">${payBtn}<button class="wmore" data-pmore="${esc(p.id)}" aria-label="Más opciones"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button></div></div>`;
  }).join('');
  const spun = Object.values(S.assignments).filter(a => a.revealed).length;
  $('#d-status').innerHTML = !hasDraw ? `Hay ${S.participants.length} inscritos. Cuando estén todos, genera el sorteo (mínimo 3).`
    : drawReady() ? `✅ Sorteo listo · <b>${spun} de ${S.participants.length}</b> ya giraron. Las parejas no se muestran aquí.`
      : '⚠️ Los participantes cambiaron después del sorteo. Vuelve a generarlo.';
  $('#d-gen').textContent = hasDraw ? '🧹 Limpiar sorteo' : '🎡 Generar sorteo';
  { const off = spinPaused(), b = $('#d-pause'); if (b) { b.textContent = off ? '▶️ Activar' : '⏸️ Pausar'; b.classList.toggle('gold', off);
    $('#d-pause-t').textContent = off ? '🔒 Ruleta en pausa' : '⏸️ Pausar la ruleta';
    $('#d-pause-sub').textContent = off ? 'Nadie puede girar ni ver su persona ahora mismo. Cada quien conserva la persona que le tocó: no se borró ni cambió nada. Actívala cuando quieras.'
      : 'Oculta la ruleta y «ver a quién me tocó» para todos. Cada quien conserva la persona que le tocó: no se borra ni cambia nada, solo queda guardada hasta que la actives.'; } }
  renderFixAdmin();
  $('#d-gen').classList.toggle('danger', !!hasDraw);
  renderHistory();
  $('#q-count').textContent = `${nMsg(S.qCount)} en el buzón · ${isRevealed() ? 'abiertos ahora' : 'se abren el ' + (revealWhen() || 'día del evento')}`;
  $('#refresh-last').textContent = S.event.refreshAt ? 'Último refresco: ' + new Date(ms(S.event.refreshAt)).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  $('#relog-last').textContent = S.event.reloginAt ? 'Último pedido: ' + new Date(ms(S.event.reloginAt)).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }) : '';
  if (![$('#q-date'), $('#q-time')].includes(document.activeElement) && !syncCfgBar.qEdit) { $('#q-date').value = revealDay() || ''; $('#q-time').value = S.event.revealTime || '00:00'; }
  { const ra = S.event.revealAt ? ms(S.event.revealAt) : 0; $('#q-left').textContent = isRevealed() ? '🔓 Abiertos' : ra > Date.now() ? '⏳ ' + leftTo(ra) : ''; }
  $('#a-list').innerHTML = S.activities.map(a => {
    let meta = '', btns = '';
    if (a.kind === 'assign') { meta = a.assignedAt ? `🎲 Repartido a ${Number(a.assignedN) || 0} · ${a.secret ? 'secreto' : 'público'}` : '🎲 Sin repartir'; btns = `<button class="btn sm gold" data-assign="${esc(a.id)}">${a.assignedAt ? 'Repartir de nuevo' : '🎲 Repartir'}</button>`; }
    if (a.kind === 'vote') { const n = S.adminVotes.filter(v => v.act === a.id).length; meta = `🗳️ ${n} ${n === 1 ? 'voto' : 'votos'} · ${a.resultsOpen ? 'resultados publicados' : 'resultados ocultos'}`; btns = `<button class="btn sm gold" data-results="${esc(a.id)}">${a.resultsOpen ? 'Ocultar resultados' : '📊 Publicar resultados'}</button>`; }
    if (a.kind === 'signup') { const n = S.signups.filter(x => x.act === a.id).length; meta = `📝 ${n} de ${(a.items || []).length} apuntados`; }
    if (a.kind === 'quiz') { const n = S.adminQuiz.filter(x => x.act === a.id).length; meta = `❓ ${(a.qs || []).length} preguntas · ${n} ${n === 1 ? 'respondió' : 'respondieron'} · ${a.resultsOpen ? 'resultados publicados' : 'resultados ocultos'}`; btns = `<button class="btn sm gold" data-results="${esc(a.id)}">${a.resultsOpen ? 'Ocultar resultados' : '📊 Publicar resultados'}</button>`; }
    return `<div class="item" style="flex-wrap:wrap"><span style="font-size:22px">${esc(a.emoji)}</span><div class="grow"><div class="t">${esc(a.title)}</div>
      <div class="muted small">${esc(fmtDate(a.date))}${a.time ? ' · ' + esc(fmtTime(a.time)) : ''}</div>${meta ? `<div class="muted small" style="margin-top:4px">${meta}</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${btns}<button class="btn sm" data-aedit="${esc(a.id)}">✏️ Editar</button><a class="btn sm" href="#actividad-${esc(a.id)}" style="text-decoration:none">👁️ Ver</a></div></div>
      <button class="x" data-act="${esc(a.id)}" aria-label="Borrar">✕</button></div>`;
  }).join('') || '<p class="muted small">No hay actividades todavía.</p>';
}
$('#adm-login').addEventListener('submit', async e => {
  e.preventDefault(); const btn = e.target.querySelector('button[type=submit]'); busy(btn, true);
  try { await adminLogin($('#adm-user').value, $('#adm-pass').value); toast('Modo organizador activo 🔓'); }
  catch (err) { $('#adm-err').textContent = authErr(err).replace('PIN incorrecto', 'Usuario o contraseña incorrectos'); busy(btn, false); }
});
fillPics();
$('#adm-out').addEventListener('click', async () => { await signOut(adminAuth); $('#adm-login').innerHTML = ''; render(); toast('Saliste del modo organizador'); });
const saveEvent = async patch => {
  S.selfEditAt = Date.now(); // lo cambié yo: no me avises a mí mismo
  try { await setDoc(doc(adb, 'config', 'event'), patch, { merge: true }); return true; } catch (e) { toast(authErr(e)); return false; }
};
$('#cfg-form').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, o = {};
  for (const k of ['eventName', 'subtitle', 'eventDate', 'place', 'mapsUrl', 'budget', 'dress', 'revealDate', 'revealTime', 'notes', 'rsvpDeadline']) o[k] = f.elements[k].value.trim();
  if (o.eventDate && isNaN(new Date(o.eventDate))) return toast('La fecha del evento no es válida');
  if (o.revealDate && isNaN(new Date(o.revealDate + 'T00:00'))) return toast('La fecha de los anónimos no es válida');
  o.eventAt = o.eventDate ? Timestamp.fromDate(new Date(o.eventDate)) : null;
  if (!o.eventName) return toast('Ponle nombre al evento');
  if (o.mapsUrl && !/^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(o.mapsUrl)) return toast('El enlace debe ser de Google Maps (https://maps.app.goo.gl/…)');
  if (o.rsvpDeadline && o.eventDate && o.rsvpDeadline > o.eventDate.slice(0, 10)) return toast('La fecha para confirmar debe ser antes del evento');
  if (o.eventDate && new Date(o.eventDate) < new Date() && !(await confirmBox('Esa fecha ya pasó', '¿Guardar de todos modos?', 'Guardar'))) return;
  if (S.isOwner) o.revealAt = o.revealDate ? Timestamp.fromDate(new Date(o.revealDate + 'T' + (o.revealTime || '00:00'))) : (o.eventDate ? Timestamp.fromDate(new Date(o.eventDate.slice(0, 10) + 'T00:00')) : null);
  else {
    delete o.revealDate; delete o.revealTime;
    // si el principal no fijó un día propio para los anónimos, se abren el día del evento (aunque cambie la fecha)
    if (!S.event.revealDate && o.eventDate) { const ra = Timestamp.fromDate(new Date(o.eventDate.slice(0, 10) + 'T00:00')); if (ra.toMillis() > Date.now()) o.revealAt = ra; }
  }
  if (S.isOwner && o.revealDate && o.eventDate && o.revealDate > o.eventDate.slice(0, 10)) return toast('Los anónimos deben abrirse antes o el mismo día del evento');
  if (S.isOwner && o.revealDate && o.revealDate < todayStr() && !(await confirmBox('Los anónimos se abrirían ya', 'Esa fecha ya pasó: todos verían los mensajes ahora mismo.', 'Guardar igual'))) return;
  if (await saveEvent(o)) { cfgDirty = false; syncCfgBar(); toast('Evento guardado'); }
});
// Buzón anónimo: cambiar el día y la hora en que se abren, desde su propia tarjeta
['q-date', 'q-time'].forEach(id => $('#' + id).addEventListener('input', () => { syncCfgBar.qEdit = true; }));
$('#q-useev').addEventListener('click', () => { const d = (S.event.eventDate || '').slice(0, 10); if (!d) return toast('Primero pon la fecha del evento'); $('#q-date').value = d; $('#q-time').value = '00:00'; syncCfgBar.qEdit = true; });
$('#q-save').addEventListener('click', async () => {
  const d = $('#q-date').value, t = $('#q-time').value || '00:00', ev = (S.event.eventDate || '').slice(0, 10);
  if (!d || isNaN(new Date(d + 'T' + t))) return toast('Elige un día válido');
  if (ev && d > ev) return toast('Los anónimos deben abrirse antes o el mismo día del evento');
  if (new Date(d + 'T' + t) < new Date() && !(await confirmBox('Los anónimos se abrirían ya', 'Esa fecha ya pasó: todos verían los mensajes ahora mismo.', 'Guardar igual'))) return;
  if (await saveEvent({ revealDate: d, revealTime: t, revealAt: Timestamp.fromDate(new Date(d + 'T' + t)) })) { syncCfgBar.qEdit = false; toast('Fecha del buzón guardada 💌'); render(); }
});
let cpDirty = false;
$('#cp-text').addEventListener('input', () => { cpDirty = true; });
$('#cp-save').addEventListener('click', async () => { const l = $('#cp-text').value.split('\n').map(x => x.trim().slice(0, 140)).filter(Boolean).slice(0, 120); if (await saveEvent({ chatPrompts: l })) { cpDirty = false; toast('Ideas guardadas 🎲'); } });
$('#cp-reset').addEventListener('click', async () => { if (!(await confirmBox('¿Usar las ideas de fábrica?', 'Se reemplazan las ideas que escribiste.', 'Reemplazar'))) return; if (await saveEvent({ chatPrompts: [] })) { cpDirty = false; $('#cp-text').value = OCURRENCIAS.join('\n'); toast('Ideas de fábrica'); } });
$('#mod-list').addEventListener('click', async e => {
  const b = e.target.closest('[data-mod]'); if (!b) return;
  const m = { ...(S.event.modules || {}) }; m[b.dataset.mod] = !mod(b.dataset.mod);
  if (await saveEvent({ modules: m })) toast(`${MODS[b.dataset.mod][0]} ${m[b.dataset.mod] ? 'Encendido' : 'Apagado'}`);
});
onlyDigits($('#pa-form'));
$('#pa-form').addEventListener('submit', async e => {
  e.preventDefault();
  const first = titleCase($('#pa-first').value), last = titleCase($('#pa-last').value), pin = $('#pa-pin').value, btn = e.target.querySelector('button[type=submit]');
  if (!first || !last) return toast('Escribe nombre y apellido');
  if (!/^\d{4}$/.test(pin)) return toast('El PIN debe tener 4 números');
  if (S.drawMeta && !S.isOwner) return toast('Ya se hizo el sorteo: solo el organizador principal puede inscribir a más personas.');
  if (S.drawMeta && !(await confirmBox('El sorteo ya está hecho', 'Si inscribes a alguien ahora habrá que volver a sortear y todos tendrán que girar de nuevo.', 'Inscribir igual'))) return;
  busy(btn, true);
  try {
    const r = await registerPerson(first, last, pin, true);
    if (r === 'dup') toast(`Ya existe ${first} ${last}`);
    else { toast(`✅ ${first} inscrito. Entra con el PIN ${pin} y la app le pedirá crear el suyo`); $('#pa-first').value = $('#pa-last').value = $('#pa-pin').value = ''; }
  } catch (err) { toast(authErr(err)); }
  busy(btn, false, 'Inscribir');
});
$('#adm-pw').addEventListener('click', () => {
  const s2 = openModal(`<h3>🔑 Cambiar contraseña de admin</h3>
    <div class="stack" style="margin-top:12px"><label class="field"><span>Contraseña actual</span><input class="in" id="pw-old" type="password" autocomplete="current-password"></label>
    <label class="field"><span>Nueva contraseña (mínimo 6)</span><input class="in" id="pw-new" type="password" autocomplete="new-password"></label>
    <label class="field"><span>Repite la nueva</span><input class="in" id="pw-new2" type="password" autocomplete="new-password"></label></div>
    <div class="err" id="pw-err"></div><div class="actions"><button class="btn" data-a="no">Cancelar</button><button class="btn gold" data-a="ok">Cambiar</button></div>`);
  s2.onclick = async ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return; if (a === 'no') return closeModal();
    const o = $('#pw-old', s2).value, n = $('#pw-new', s2).value, n2 = $('#pw-new2', s2).value, er = $('#pw-err', s2);
    if (n.length < 6) { er.textContent = 'La nueva debe tener al menos 6 caracteres.'; return; }
    if (n !== n2) { er.textContent = 'Las contraseñas no coinciden.'; return; }
    try {
      await reauthenticateWithCredential(adminAuth.currentUser, EmailAuthProvider.credential(adminAuth.currentUser.email, o));
      await updatePassword(adminAuth.currentUser, n); closeModal(); toast('Contraseña cambiada 🔑');
    } catch (err) { er.textContent = authErr(err).replace('PIN incorrecto', 'La contraseña actual no es correcta'); }
  };
});
$('#p-list').addEventListener('click', e => {
  const b = e.target.closest('[data-pedit]'); if (!b) return; const p = P(b.dataset.pedit); if (!p) return;
  const s2 = openModal(`<h3>✏️ Editar participante</h3><div class="stack" style="margin-top:12px">
    <div class="row"><label class="field"><span>Nombre</span><input class="in" id="pe-first" maxlength="25" value="${esc(p.first)}"></label><label class="field"><span>Apellido</span><input class="in" id="pe-last" maxlength="25" value="${esc(p.last)}"></label></div>
    <label class="field"><span>Emoji</span><div class="chips" id="pe-emo">${EMOJIS.map(x => `<button type="button" class="chip ${x === p.emoji ? 'on' : ''}" data-em="${x}">${x}</button>`).join('')}</div></label></div>
    <div class="actions"><button class="btn" data-a="no">Cancelar</button><button class="btn gold" data-a="ok">Guardar</button></div>`);
  let em = p.emoji;
  s2.onclick = async ev => {
    const c = ev.target.closest('[data-em]'); if (c) { em = c.dataset.em; $$('#pe-emo .chip', s2).forEach(x => x.classList.toggle('on', x === c)); return; }
    const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return; if (a === 'no') return closeModal();
    const first = titleCase($('#pe-first', s2).value), last = titleCase($('#pe-last', s2).value); if (!first || !last) return toast('Nombre y apellido');
    const nk = normName(`${first} ${last}`);
    if (nk !== p.nameKey && S.participants.some(x => x.id !== p.id && x.nameKey === nk)) return toast('Ya existe alguien con ese nombre');
    try {
      const w = writeBatch(adb);
      if (nk !== p.nameKey) { if (p.nameKey) w.delete(doc(adb, 'names', p.nameKey)); w.set(doc(adb, 'names', nk), { uid: p.id }); }
      w.set(doc(adb, 'participants', p.id), { first, last, name: `${first} ${last}`, nameKey: nk, emoji: em }, { merge: true });
      await w.commit(); closeModal(); toast('Participante actualizado ✏️'); }
    catch (err) { toast(authErr(err)); }
  };
});
const PERMS = { evento: ['🎄', 'Evento, reglas y secciones'], actividades: ['📅', 'Actividades y dinámicas'], participantes: ['👥', 'Participantes e inscripciones'], aportes: ['💵', 'Asistencia y aportes'], moderar: ['🧹', 'Moderar chat, deseos y sugerencias'] };
let stPerms = { evento: true, actividades: true };
function renderStaff() {
  if (!S.isOwner) return;
  $('#st-perms').innerHTML = Object.entries(PERMS).map(([k, [e, l]]) => `<button type="button" class="chip perm ${stPerms[k] ? 'on' : ''}" data-np="${k}">${e} ${l}</button>`).join('');
  const sel = $('#st-person'), taken = new Set((S.staffList || []).map(x => x.id));
  const opts = '<option value="">Elige a alguien…</option>' + S.participants.filter(p => !taken.has(p.id)).sort((a, b) => a.name.localeCompare(b.name)).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  if (sel.dataset.sig !== opts) { const v = sel.value; sel.innerHTML = opts; sel.dataset.sig = opts; if (v && !taken.has(v)) sel.value = v; }
  $('#st-list').innerHTML = (S.staffList || []).length ? S.staffList.map(st => { const p = P(st.id); return `<div class="staff">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div style="min-width:0"><b>${p ? esc(p.emoji || '🙂') : '🛡️'} ${esc(p ? p.name : st.name)}</b><div class="muted small">${p ? 'Entra con su cuenta de siempre' : st.username ? `Cuenta aparte · usuario: <b>${esc(st.username)}</b>` : '⚠️ Ya no está inscrita'}</div></div><button class="x" data-stdel="${esc(st.id)}" aria-label="Quitar">✕</button></div>
      ${p ? `<div class="switch st-own"><div><b>👑 Acceso total</b><div class="muted small">Igual que el organizador principal: ve y maneja todo con su propia cuenta.</div></div><button class="tg ${st.owner ? 'on' : ''}" data-sown="${esc(st.id)}" aria-label="Acceso total"></button></div>` : ''}
      ${st.owner ? '<p class="muted small" style="margin-top:8px">✅ Tiene todos los permisos.</p>' : `<div class="chips" style="margin-top:10px">${Object.entries(PERMS).map(([k, [e, l]]) => `<button type="button" class="chip perm ${st.perms?.[k] ? 'on' : ''}" data-sp="${k}" data-sid="${esc(st.id)}">${e} ${l}</button>`).join('')}</div>`}</div>`; }).join('')
    : '<p class="muted small">Todavía no hay administradores. El único es el organizador principal.</p>';
}
$('#st-perms').addEventListener('click', e => { const b = e.target.closest('[data-np]'); if (!b) return; stPerms[b.dataset.np] = !stPerms[b.dataset.np]; renderStaff(); });
$('#st-form').addEventListener('submit', async e => {
  e.preventDefault();
  const pid = $('#st-person').value, p = P(pid), btn = e.target.querySelector('button[type=submit]');
  if (!p) return toast('Elige a la persona');
  if (!Object.values(stPerms).some(Boolean)) return toast('Marca al menos una responsabilidad');
  if (!(await confirmBox(`¿Hacer administrador a ${p.name}?`, 'Podrá manejar lo que marcaste entrando con su propio PIN. Puedes quitarle el acceso cuando quieras.', 'Sí, darle acceso'))) return;
  busy(btn, true);
  try {
    await setDoc(doc(adb, 'staff', pid), { name: p.name, pid, perms: { ...stPerms }, at: serverTimestamp() });
    $('#st-person').value = '';
    toast(`✅ ${shortName(p)} ya es administrador: le aparece el panel en su app`);
  } catch (err) { toast(authErr(err)); }
  busy(btn, false, '➕ Hacer administrador');
});
$('#st-list').addEventListener('click', async e => {
  const t = e.target.closest('[data-sp]'), d = e.target.closest('[data-stdel]'), o = e.target.closest('[data-sown]');
  try {
    if (o) {
      const st = S.staffList.find(x => x.id === o.dataset.sown), p = P(st?.id), on = !st.owner; if (!p) return;
      if (on && !(await confirmBox(`¿Darle acceso total a ${p.name}?`, 'Podrá hacer TODO lo que tú haces: ver las parejas del sorteo, quién escribió los anónimos y sugerencias, cambiar la configuración y dar o quitar administradores. Úsalo solo con alguien de total confianza.', 'Sí, acceso total'))) return;
      await setDoc(doc(adb, 'staff', st.id), { owner: on }, { merge: true });
      toast(on ? `👑 ${shortName(p)} ya tiene acceso total` : 'Acceso total quitado'); return;
    }
    if (t) { const st = S.staffList.find(x => x.id === t.dataset.sid); const perms = { ...(st.perms || {}) }; perms[t.dataset.sp] = !perms[t.dataset.sp]; await setDoc(doc(adb, 'staff', st.id), { perms }, { merge: true }); toast(perms[t.dataset.sp] ? '✅ Permiso dado' : 'Permiso quitado'); }
    if (d) { const st = S.staffList.find(x => x.id === d.dataset.stdel); if (!(await confirmBox(`¿Quitar a ${P(st?.id)?.name || st?.name}?`, 'Ya no podrá entrar al panel. Sigue siendo participante.', 'Quitar'))) return; const w = writeBatch(adb); w.delete(doc(adb, 'staff', d.dataset.stdel)); await w.commit(); toast('Acceso retirado'); }
  } catch (err) { toast(authErr(err)); }
});
const DEFAULT_RULES = [
  ['🤫', 'Secreto total: no le digas a nadie quién te tocó hasta el día del intercambio.'],
  ['💰', 'Respeta el presupuesto acordado, ni mucho más ni mucho menos.'],
  ['📝', 'Llena tu lista de deseos para que tu angelito tenga ideas.'],
  ['🎁', 'Trae el regalo envuelto y con el nombre de quien lo recibe.'],
  ['🚫', 'No se vale cambiar de angelito ni intercambiar parejas.'],
  ['⏰', 'Llega a tiempo: el intercambio empieza a la hora indicada.'],
  ['💌', 'En el buzón y las sugerencias, todo con respeto y buena onda.'],
  ['😄', 'Lo más importante: compartir, reír y pasarla bien en familia.']
].map(([icon, text]) => ({ icon, text }));
const curRules = () => Array.isArray(S.event.rules) ? S.event.rules.map(r => ({ ...r })) : [];
$('#r-form').addEventListener('submit', async e => {
  e.preventDefault(); const text = $('#r-text').value.trim(); if (!text) return;
  if (curRules().length >= 40) return toast('Máximo 40 reglas');
  if (await saveEvent({ rules: [...curRules(), { icon: $('#r-icon').value, text }] })) { $('#r-text').value = ''; toast('Regla agregada 📜'); }
});
$('#r-defaults').addEventListener('click', async () => {
  const cur = curRules();
  if (cur.length && !(await confirmBox('¿Cargar reglas sugeridas?', 'Se agregarán al final de las que ya tienes.', 'Agregar'))) return;
  const have = new Set(cur.map(r => r.text));
  if (await saveEvent({ rules: [...cur, ...DEFAULT_RULES.filter(r => !have.has(r.text))] })) toast('Reglas sugeridas cargadas ✨');
});
$('#r-list').addEventListener('click', async e => {
  const b = e.target.closest('[data-rup],[data-rdown],[data-rdel]'); if (!b || b.disabled) return;
  if (S.rBusy) return; S.rBusy = true; setTimeout(() => { S.rBusy = false; }, 900);
  const r = curRules();
  if (b.dataset.rdel != null) { if (!(await confirmBox('¿Borrar esta regla?', r[+b.dataset.rdel]?.text || '', 'Borrar'))) return; r.splice(+b.dataset.rdel, 1); }
  else { const i = +(b.dataset.rup ?? b.dataset.rdown), j = b.dataset.rup != null ? i - 1 : i + 1; [r[i], r[j]] = [r[j], r[i]]; }
  await saveEvent({ rules: r });
});
$('#reg-tg').addEventListener('click', async () => { const v = !regOpen(); if (v && S.drawMeta && !S.isOwner) return toast('Ya se hizo el sorteo: solo el organizador principal puede reabrir las inscripciones.'); if (await saveEvent({ registrationOpen: v })) toast(v ? 'Inscripciones abiertas' : 'Inscripciones cerradas 🔒'); });
$('#q-now').addEventListener('click', async () => { const v = !S.event.revealNow; if (v && !(await confirmBox('¿Abrir el buzón ahora?', `Todos verán los ${S.qCount || 0} anónimos antes de la fecha. Aunque lo cierres después, ya los habrán visto.`, 'Abrir ahora'))) return; if (await saveEvent({ revealNow: v })) toast(v ? 'Buzón abierto 🎉' : 'Buzón cerrado de nuevo 🔒'); });
$('#p-list').addEventListener('click', async e => {
  const b = e.target.closest('[data-rm]'); if (!b) return; const id = b.dataset.rm;
  if (S.drawMeta && !S.isOwner) return toast('Ya se hizo el sorteo: solo el organizador principal puede cambiar la lista.');
  const msg = S.drawMeta ? 'Se borrarán su registro y su lista. El sorteo quedará inválido y habrá que volver a sortear.' : 'Se borrarán su registro, su lista de deseos y su asistencia. Si solo olvidó su PIN, mejor un 🔑 PIN temporal (lo da el organizador principal y conserva todo lo suyo).';
  if (!(await confirmBox(`¿Quitar a ${pName(id)}?`, msg, 'Quitar'))) return;
  try {
    const b2 = writeBatch(adb);
    const pp = P(id);
    b2.delete(doc(adb, 'participants', id)); if (S.isOwner) { b2.delete(doc(adb, 'assignments', id)); b2.delete(doc(adb, 'staff', id)); }
    if (pp?.nameKey) b2.delete(doc(adb, 'names', pp.nameKey));
    b2.set(doc(adb, 'banned', id), { at: serverTimestamp() });
    (await getDocs(query(collection(adb, 'wishes'), where('uid', '==', id)))).forEach(d => b2.delete(d.ref));
    (await getDocs(query(collection(adb, 'wishImg'), where('uid', '==', id)))).forEach(d => b2.delete(d.ref));
    // todo lo suyo, para que no queden puestos tomados ni votos de alguien que ya no está
    const mine = c => getDocs(query(collection(adb, c), where('uid', '==', id))).then(r => r.docs).catch(() => []);
    for (const c of ['activitySignups', 'sugVotes', 'chatReacts']) (await mine(c)).forEach(d => b2.delete(d.ref));
    if (can('actividades')) (await mine('votes')).forEach(d => b2.delete(d.ref));
    b2.delete(doc(adb, 'attendance', id)); b2.delete(doc(adb, 'profiles', id));
    if (S.staffList?.some(x => x.id === id) || S.isOwner) b2.delete(doc(adb, 'staff', id));
    if (S.isOwner) {
      for (const c of ['giftStatus', 'guesses', 'angelGuess', 'wishPick', 'thanks', 'hintsSent', 'fcmTokens']) b2.delete(doc(adb, c, id));
      /* 🔐 a quién le regalaba esa persona ya no se sabe aquí: el ajuste del sorteo lo resuelve en el servidor */
    }
    await b2.commit(); toast('Participante eliminado');
  } catch (err) { toast(authErr(err)); }
});
// 🔀 Ajuste del sorteo (switch): si una pareja quedó fuera de las restricciones, el organizador programa la fecha
// y hora; a esa hora el servidor (push/send.mjs) hace cambios al azar respetando TODAS las restricciones y todos
// vuelven a girar. Nadie ve cuántas parejas cambiaron ni cuáles: el aviso y los pasos son iguales para todos.
const fixOf = () => S.event?.fix || null;
const fixWhen = f => new Date(+f.at).toLocaleString('es-DO', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
function renderFixAdmin() {
  const box = $('#fx-box'); if (!box) return;
  const f = fixOf(), live = f && (f.status === 'scheduled' || f.status === 'running');
  if (!S.isOwner || !S.drawMeta) { if (box.innerHTML) box.innerHTML = ''; return; }
  const inDraw = S.participants.filter(p => S.drawMeta.ids?.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const drops = (f?.drop || []).map(pName).filter(Boolean);
  const def = new Date(Date.now() + 864e5); def.setHours(21, 0, 0, 0);
  const loc = d => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  const verr = S.drawState?.err && Date.now() - (+S.drawState.at || 0) < 864e5 ? `<p class="err" style="margin:0 0 8px">🔐 La caja fuerte no pudo hacer el último pedido: ${esc(S.drawState.err)}</p>` : '';
  box.innerHTML = verr + `<div class="fx-card ${live ? 'on' : ''}"><div class="fx-hd"><span class="fx-ic">🔀</span><div class="grow"><b>Ajuste del sorteo</b><small>${f?.status === 'scheduled' ? 'Programado para el ' + esc(fixWhen(f)) : f?.status === 'running' ? 'Aplicando ahora…' : f?.status === 'failed' ? 'El último intento no se pudo aplicar. Prográmalo otra vez.' : 'Úsalo si agregaste restricciones o alguien sale del sorteo. 🔐 Nadie, ni tú, puede saber si alguien las incumplía'}</small></div></div>
    ${live ? `<p class="muted small">A esa hora el sistema hace los cambios al azar (respetando todas las restricciones) y todos vuelven a girar. Los cambios se hacen primero con quienes aún no han girado. Nadie sabrá cuántos ni cuáles cambiaron.</p>${drops.length ? `<p class="muted small">👋 Sale del sorteo: <b>${esc(drops.join(', '))}</b></p>` : ''}${f.status === 'scheduled' || (f.status === 'running' && Date.now() - +f.at > 15 * 60e3) ? '<div class="actions"><button class="btn sm" id="fx-cancel">Cancelar ajuste</button></div>' : ''}`
    : `<p class="muted small">Elige cuándo se hace. Se avisa a todos que habrá un <b>switch</b> (sin decir cuántos ni por qué) y luego cada quien vuelve a girar su ruleta.</p>
    <label class="field" style="margin-top:8px"><span>Sacar a alguien del sorteo (opcional)</span><select class="in" id="fx-drop"><option value="">Nadie</option>${inDraw.map(p => `<option value="${esc(p.id)}">${esc(p.name)}${S.assignments?.[p.id]?.revealed ? '' : ' · no ha girado'}</option>`).join('')}</select></label>
    <label class="field" style="margin-top:8px"><span>Fecha y hora del ajuste</span><input class="in" type="datetime-local" id="fx-at" value="${loc(def)}"></label>
    <div class="actions"><button class="btn gold" id="fx-go">🔀 Programar ajuste</button></div>`}</div>`;
}
document.addEventListener('click', async e => {
  if (e.target.closest('#fx-go')) {
    const at = new Date($('#fx-at')?.value || '').getTime();
    if (!at || at < Date.now() - 60e3) return toast('Elige una fecha y hora que no haya pasado');
    const dr = $('#fx-drop')?.value || '', f = { id: Date.now().toString(36), at, status: 'scheduled', ...(dr ? { drop: [dr] } : {}) };
    if (!(await confirmBox('🔀 Programar el ajuste', `El ${fixWhen(f)} el sistema hará el switch${dr ? ' y sacará del sorteo a ' + pName(dr) + ' (se borra su cuenta)' : ''}. Todos volverán a girar. Se enviará un aviso a todo el grupo.`, 'Programar'))) return;
    try {
      const b = writeBatch(adb);
      b.set(doc(adb, 'config', 'event'), { fix: f }, { merge: true });
      b.set(doc(collection(adb, 'notices')), { title: '🔀 Ajuste del sorteo', body: `El ${fixWhen(f)} se hará un switch en el sorteo para que todo quede justo. Ese día te llega un aviso: vuelve a girar tu ruleta para ver tu persona definitiva. 🤫 No comentes tu resultado con nadie.`, target: 'all', ts: Date.now(), at: serverTimestamp(), dev: DEV });
      await b.commit(); toast('🔀 Ajuste programado y aviso enviado');
    } catch (err) { toast(authErr(err)); }
  }
  if (e.target.closest('#fx-cancel')) {
    if (!(await confirmBox('Cancelar el ajuste', 'El sorteo se queda como está.', 'Cancelar ajuste'))) return;
    try { await setDoc(doc(adb, 'config', 'event'), { fix: deleteField() }, { merge: true }); toast('Ajuste cancelado'); } catch (err) { toast(authErr(err)); }
  }
});
// Del lado de cada persona: aviso en la ruleta + términos antes de volver a girar + el mismo mensaje para todos.
const fixDone = () => { const f = fixOf(); return f?.status === 'done' && !f.noop ? f : null; };
const fixAccepted = f => { try { return localStorage.getItem('angelito:fixok') === f.id; } catch { return false; } };
function fixBanner() {
  const f = fixOf(); if (!f || !S.drawMeta?.ids?.includes(S.uid)) return '';
  if (f.status === 'scheduled' || f.status === 'running') return `<div class="fx-note"><span>🔀</span><div><b>Habrá un ajuste en el sorteo</b><small>${f.status === 'running' ? 'Se está aplicando ahora mismo…' : 'El ' + esc(fixWhen(f))} · Para que todo quede justo se hará un switch. Cuando esté listo, todos vuelven a girar. 🤫</small></div></div>`;
  if (f.status === 'done' && !f.noop && !S.assignment?.revealed) return `<div class="fx-note go"><span>🔀</span><div><b>El ajuste del sorteo ya está listo</b><small>Todos vuelven a girar su ruleta para ver su persona definitiva.</small></div></div>`;
  return '';
}
function fixTerms(f) {
  return new Promise(res => {
    const items = ['Entiendo que el sorteo tuvo un ajuste y que todos vuelven a girar', 'No voy a comentar ni comparar mi resultado con nadie', 'Estoy en un lugar seguro y nadie está mirando mi pantalla'];
    const s = openModal(`<div class="pg"><div class="pg-ic">🔀</div><h3>Ajuste del sorteo</h3>
      <p class="muted small">Para que todo quedara justo se hizo un switch. No se dice a quiénes ni cuántos: así nadie tiene pistas y la sorpresa se mantiene. Acepta para girar:</p>
      <div class="pg-list">${items.map((t, i) => `<button type="button" class="pg-it" style="--d:${i * 80}ms"><span class="pg-ck">${ic('check', 16)}</span><span>${t}</span></button>`).join('')}</div>
      <div class="actions"><button class="btn" data-a="no">Ahora no</button><button class="btn gold" data-a="ok" disabled>Acepto</button></div></div>`);
    s.onclick = e => {
      const it = e.target.closest('.pg-it'); if (it) { it.classList.toggle('on'); s.querySelector('[data-a=ok]').disabled = s.querySelectorAll('.pg-it.on').length < items.length; return; }
      const a = e.target.closest('[data-a]')?.dataset.a; if (!a || (a === 'ok' && s.querySelectorAll('.pg-it.on').length < items.length)) return;
      closeModal(); if (a === 'ok') try { localStorage.setItem('angelito:fixok', f.id); } catch { } res(a === 'ok');
    };
  });
}
// Restricciones: pares { a: quien regala, b: a quien no le puede salir, both: también al revés }
function blockedSet() { const s = new Set(); for (const r of S.drawRules || []) { s.add(r.a + '>' + r.b); if (r.both) s.add(r.b + '>' + r.a); } return s; }
// ---- Sorteo con restricciones: método seguro ----
// 1) Primero se busca UNA sola cadena (A→B→C→…→A): al azar y, si cuesta, paso a paso eligiendo siempre a quien
//    tiene menos opciones (así no se tranca).
// 2) Si no existe una cadena única, se usa un emparejamiento perfecto (método exacto de caminos de aumento):
//    sigue siendo un sorteo válido (todos dan y reciben una vez, nadie se toca a sí mismo y se respetan TODAS
//    las restricciones), aunque pueda formar varios círculos.
// 3) Si ni eso existe, es matemáticamente imposible, y drawCheck dice exactamente por qué y a quién afecta.
function drawRing(ids) { return drawPlan(ids).next; }
function drawPlan(ids) {
  const bad = blockedSet(), ok = (x, y) => x !== y && !bad.has(x + '>' + y), n = ids.length;
  const outs = Object.fromEntries(ids.map(x => [x, ids.filter(y => ok(x, y))]));
  const ins = Object.fromEntries(ids.map(y => [y, ids.filter(x => ok(x, y))]));
  const zeroOut = ids.filter(x => !outs[x].length), zeroIn = ids.filter(y => !ins[y].length);
  if (n < 2 || zeroOut.length || zeroIn.length) return { next: null, zeroOut, zeroIn, outs };
  const ring = r => Object.fromEntries(r.map((x, i) => [x, r[(i + 1) % r.length]]));
  for (let t = 0; t < 3000; t++) { const r = shuffle([...ids]); if (r.every((x, i) => ok(x, r[(i + 1) % n]))) return { next: ring(r), cycle: true, outs }; }
  const start = ids.reduce((m, x) => outs[x].length < outs[m].length ? x : m, ids[0]);
  const path = [start], used = new Set(path); let steps = 0;
  const go = () => {
    if (++steps > 300000) return false;
    const last = path[path.length - 1];
    if (path.length === n) return ok(last, start);
    const cand = shuffle(outs[last].filter(z => !used.has(z)))
      .sort((a, b) => outs[a].filter(z => !used.has(z)).length - outs[b].filter(z => !used.has(z)).length);
    for (const y of cand) { path.push(y); used.add(y); if (go()) return true; path.pop(); used.delete(y); }
    return false;
  };
  if (go()) return { next: ring(path), cycle: true, outs };
  // emparejamiento perfecto exacto (Kuhn): a cada quien un destinatario distinto permitido
  const match = {}; // destinatario -> quien le regala
  const aug = (x, seen) => { for (const y of shuffle([...outs[x]])) { if (seen.has(y)) continue; seen.add(y); if (!match[y] || aug(match[y], seen)) { match[y] = x; return true; } } return false; };
  const fails = []; for (const x of shuffle([...ids])) if (!aug(x, new Set())) fails.push(x);
  if (fails.length) return { next: null, fails, outs };
  return { next: Object.fromEntries(Object.entries(match).map(([y, x]) => [x, y])), cycle: false, outs };
}
// Revisión para el organizador: ¿se puede sortear? ¿alguien queda con tan pocas opciones que adivinaría quién le tocó?
function drawCheck(ids = S.participants.map(p => p.id)) {
  const nm = id => shortName(P(id)) || '?', plan = drawPlan(ids), msgs = [];
  if (!plan.next) {
    if (plan.zeroOut?.length) msgs.push(['err', `A ${plan.zeroOut.map(nm).join(', ')} no le puede salir nadie.`]);
    if (plan.zeroIn?.length) msgs.push(['err', `${plan.zeroIn.map(nm).join(', ')} no le puede salir a nadie.`]);
    if (plan.fails?.length) msgs.push(['err', `Hay demasiadas restricciones entre ${plan.fails.map(nm).join(', ')} y los demás: no alcanza para que todos tengan a alguien distinto.`]);
    if (!msgs.length) msgs.push(['err', 'Con estas restricciones no hay forma de sortear.']);
  } else {
    if (!plan.cycle) msgs.push(['warn', 'Se puede sortear, pero no en una sola cadena: algunos se regalarán entre ellos en grupitos. Sigue siendo válido.']);
    // 🔐 igual que la caja fuerte (optsOK): cada quien debe poder regalar a m personas Y recibir de m personas
    const m = Math.max(2, Math.ceil((ids.length - 1) / 3)), inN = x => ids.filter(y => y !== x && plan.outs[y].includes(x)).length;
    const tight = ids.filter(x => plan.outs[x].length < m || inN(x) < m);
    if (tight.length) msgs.push(['err', `Demasiadas restricciones sobre ${tight.map(nm).join(', ')}: cada quien debe poder regalarle a ${m} personas o más y recibir de ${m} o más. Así nadie puede forzar ni adivinar una pareja.`]);
  }
  return { ok: !!plan.next && !msgs.some(m => m[0] === 'err'), msgs };
}
function renderDrawRules() {
  if (!S.isOwner || !$('#x-list')) return;
  const ppl = [...S.participants].sort((a, b) => a.name.localeCompare(b.name));
  const opts = '<option value="">Elige…</option>' + ppl.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  for (const id of ['#x-a', '#x-b']) { const el = $(id); if (el.dataset.sig !== opts) { const v = el.value; el.innerHTML = opts; el.dataset.sig = opts; el.value = v; } }
  const rules = (S.drawRules || []).filter(r => P(r.a) && P(r.b));
  $('#x-count').textContent = rules.length || '';
  $('#x-list').innerHTML = rules.length ? rules.map((r, i) => `<div class="prow" style="align-items:center"><div style="flex:1;min-width:0">${esc(P(r.a).emoji)} <b>${esc(shortName(P(r.a)))}</b> ${r.both ? '⇄' : '→'} 🚫 ${esc(P(r.b).emoji)} <b>${esc(shortName(P(r.b)))}</b><div class="muted small">${r.both ? 'No se tocan entre ellos' : `A ${esc(shortName(P(r.a)))} no le sale ${esc(shortName(P(r.b)))}`}</div></div><button class="x" data-xdel="${i}" aria-label="Quitar">✕</button></div>`).join('')
    : '<p class="muted small">Sin restricciones: cualquiera le puede salir a cualquiera.</p>';
  const ck = rules.length ? drawCheck() : { ok: true, msgs: [] };
  if (ck.ok && !ck.msgs.length && rules.length) ck.msgs.push(['ok', '✅ Todo bien: el sorteo se puede hacer respetando estas restricciones.']);
  $('#x-list').insertAdjacentHTML('beforeend', ck.msgs.map(([k, m]) => `<div class="xck ${k}">${k === 'err' ? '⛔ ' : k === 'warn' ? '⚠️ ' : ''}${esc(m)}</div>`).join(''));
  $('#d-gen').disabled = !S.drawMeta && !ck.ok; $('#d-gen').title = S.drawMeta || ck.ok ? '' : 'Arregla las restricciones primero';
}
const saveRules = pairs => setDoc(doc(adb, 'drawRules', 'main'), { pairs, at: serverTimestamp() });
$('#x-form').addEventListener('submit', async e => {
  e.preventDefault();
  const a = $('#x-a').value, b = $('#x-b').value, both = $('#x-both').checked;
  if (!a || !b) return toast('Elige a las dos personas');
  if (a === b) return toast('Elige dos personas distintas');
  const cur = (S.drawRules || []).filter(r => P(r.a) && P(r.b));
  if (cur.some(r => (r.a === a && r.b === b) || (r.both && r.a === b && r.b === a))) return toast('Esa restricción ya existe');
  if (cur.length >= 60) return toast('Máximo 60 restricciones');
  const pairs = [...cur, { a, b, both }];
  const keep = S.drawRules; S.drawRules = pairs; const ck = drawCheck(); S.drawRules = keep;
  if (!ck.ok) return openModal(`<h3>🚫 Esa restricción rompe el sorteo</h3><p class="muted">${esc(ck.msgs.map(m => m[1]).join(' '))}</p><p class="muted small" style="margin-top:8px">No la guardé. Quita otra restricción o pon esta solo en un sentido.</p><div class="actions"><button class="btn gold" data-a="close">Entendido</button></div>`).onclick = e => { if (e.target.closest('[data-a]')) closeModal(); };
  const warn = ck.msgs.filter(m => m[0] === 'warn').map(m => m[1]);
  if (warn.length && !(await confirmBox('⚠️ Ojo con esta restricción', warn.join(' '), 'Guardar igual'))) return;
  try { await saveRules(pairs); $('#x-a').value = $('#x-b').value = ''; toast(S.drawMeta ? '✅ Guardada. Vuelve a sortear para aplicarla' : '✅ Restricción guardada'); } catch (err) { toast(authErr(err)); }
});
$('#x-list').addEventListener('click', async e => {
  const b = e.target.closest('[data-xdel]'); if (!b) return;
  const pairs = (S.drawRules || []).filter(r => P(r.a) && P(r.b)); pairs.splice(+b.dataset.xdel, 1);
  try { await saveRules(pairs); toast('Restricción quitada'); } catch (err) { toast(authErr(err)); }
});
// 🧹 Limpiar sorteo: todo vuelve al inicio (sin sorteo, ruleta cerrada, inscripciones abiertas)
// Guarda en «Angelitos pasados» un sorteo YA revelado (si no se reveló, no se guarda: las parejas siguen secretas)
function histOp(rv, as, th, gu) {
  if (!rv?.exists()) return null;
  const rvd = rv.data(), nm = id => { const x = P(id); return x ? { n: x.name, e: x.emoji || '' } : { n: '(ya no está)', e: '' }; };
  const src = (rvd.pairs || []).length ? rvd.pairs.map(x => [x.g, x.r]) : (as?.docs || []).filter(d => d.data().recipient).map(d => [d.id, d.data().recipient]); // lo que se reveló manda
  if (!src.length) return null;
  const pairs = src.map(([g, r]) => ({ g, r, gn: nm(g).n, ge: nm(g).e, rn: nm(r).n, re: nm(r).e }));
  const guesses = (gu?.docs || []).filter(d => d.data().text || d.data().actual).map(d => ({ uid: d.id, name: nm(d.id).n, text: d.data().text || '', actual: d.data().actual || '', win: d.id === S.event.guessWinner }));
  const thanks = (th?.docs || []).map(d => ({ uid: d.id, name: nm(d.id).n, e: nm(d.id).e, note: d.data().note || '', received: !!d.data().received }));
  const id = 'd' + (ms(S.drawMeta?.at) || ms(rvd.at) || Date.now()); // id fijo: reintentar no duplica
  return ['set', doc(adb, 'history', id), { at: serverTimestamp(), drawAt: S.drawMeta?.at || rvd.at || null, pairs, thanks, guesses, revealed: true }];
}
async function clearDraw() {
  if (!(await confirmBox('¿Limpiar el sorteo?', (S.reveal ? 'Como ya se reveló, las parejas y los agradecimientos se guardan en «📜 Angelitos pasados». ' : 'Aún no se ha revelado: las parejas se descartan sin que nadie las vea. ') + 'Se borra el sorteo, la ruleta se cierra y se reabren las inscripciones. Los deseos, perfiles y todo lo demás se quedan igual.', 'Limpiar'))) return;
  try {
    const [as, th, rv, gu] = await Promise.all([getDocs(collection(adb, 'assignments')), getDocs(collection(adb, 'thanks')), getDoc(doc(adb, 'reveal', 'main')), getDocs(collection(adb, 'guesses'))]);
    const wasRev = rv.exists(), hop = histOp(rv, as, th, gu);
    const ops = hop ? [hop] : [];
    await commitOps(ops); // 1) primero se guarda el recuerdo
    const b0 = writeBatch(adb); b0.delete(doc(adb, 'config', 'draw')); await b0.commit(); // 2) la ruleta se cierra para todos al instante
    const ops2 = [];
    as.forEach(d => ops2.push(['del', d.ref])); th.forEach(d => ops2.push(['del', d.ref]));
    if (wasRev) ops2.push(['del', rv.ref]);
    ops2.push(['set', doc(adb, 'config', 'event'), { registrationOpen: true }, true]);
    await commitOps(ops2);
    toast(hop ? '🧹 Sorteo limpio · guardado en Angelitos pasados' : '🧹 Sorteo limpio. Ya puedes generar uno nuevo.');
  } catch (err) { toast(authErr(err) + ' · Vuelve a intentarlo'); }
}
// 📜 Angelitos pasados (solo aparece si hay historial)
function renderHistory() {
  const h = S.history || [], f = $('#h-fold'); if (!f) return;
  f.hidden = !h.length; if (!h.length) return;
  $('#h-count').textContent = h.length;
  const when = x => { const t = ms(x.drawAt) || ms(x.at); return t ? new Date(t).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Sorteo anterior'; };
  const html = h.map(x => `<div class="hist-it"><div class="hist-hd"><b>🎁 ${esc(when(x))}</b><span class="muted small">${(x.pairs || []).length} parejas${x.revealed ? ' · revelado' : ''}</span><button class="btn xs ghost" data-hdel="${esc(x.id)}" aria-label="Borrar">🗑️</button></div>
    <div class="hist-pairs">${(x.pairs || []).map(q => `<div class="hist-p">${esc(q.ge)} ${esc(q.gn)} <span class="muted">→</span> ${esc(q.re)} ${esc(q.rn)}</div>`).join('')}</div>
    ${(x.guesses || []).filter(g => g.win).map(g => `<div class="hist-t">🏆 <b>${esc(g.name)}</b> ganó la adivinanza${g.text ? ': «' + esc(g.text) + '»' : ''}</div>`).join('')}
    ${(x.thanks || []).filter(t => t.note || t.received).map(t => `<div class="hist-t">💛 <b>${esc(t.name)}</b>${t.note ? ': «' + esc(t.note) + '»' : ' recibió su regalo'}</div>`).join('')}</div>`).join('');
  if ($('#h-list').dataset.h !== html) { $('#h-list').innerHTML = html; $('#h-list').dataset.h = html; }
}
$('#h-list')?.addEventListener('click', async e => {
  const b = e.target.closest('[data-hdel]'); if (!b) return;
  if (!(await confirmBox('¿Borrar este sorteo pasado?', 'Se borra para siempre del historial.', 'Borrar'))) return;
  try { await commitOps([['del', doc(adb, 'history', b.dataset.hdel)]]); toast('Borrado del historial'); } catch (err) { toast(authErr(err)); }
});
$('#h-clear')?.addEventListener('click', async () => {
  if (!(await confirmBox('¿Borrar todo el historial?', 'Se borran para siempre todos los angelitos pasados.', 'Borrar todo'))) return;
  try { await commitOps((S.history || []).map(x => ['del', doc(adb, 'history', x.id)])); toast('🗑️ Historial borrado'); } catch (err) { toast(authErr(err)); }
});
// ⏸️ pausar / ▶️ activar la ruleta (y el «ver a quién me tocó»)
$('#d-pause').addEventListener('click', async () => {
  const off = !spinPaused();
  if (off && !(await confirmBox('¿Pausar la ruleta?', 'Nadie podrá girar ni volver a ver a quién le tocó hasta que la actives. El sorteo no cambia: cada persona conserva la persona que le tocó, guardada y cifrada, y la volverá a ver igual al activarla.', 'Pausar'))) return;
  try { await setDoc(doc(adb, 'config', 'event'), { spinOff: off }, { merge: true }); toast(off ? '🔒 Ruleta en pausa: cada quien conserva su persona' : '▶️ Ruleta activa otra vez'); } catch (e) { toast(authErr(e)); }
});
$('#d-gen').addEventListener('click', async () => {
  if (S.drawMeta) return clearDraw();
  const ids = S.participants.map(p => p.id);
  if (ids.length < 3) return toast('Necesitas al menos 3 participantes');
  const msg = S.drawMeta ? 'Se borrarán todos los giros y cada quien tendrá que girar de nuevo. Las inscripciones se cerrarán.' : `Se sortearán ${ids.length} personas y se cerrarán las inscripciones.`;
  if (!(await confirmBox(S.drawMeta ? '¿Volver a sortear?' : '¿Generar el sorteo?', msg, 'Sortear'))) return;
  if (ids.length > 450) return toast('Son demasiadas personas para sortear de una vez');
  // Una sola cadena: A→B→C→…→A. Nadie se toca a sí mismo, no hay parejas que se regalen mutuamente
  // y se respetan las restricciones del organizador ("a X no le puede salir Y").
  const next = drawRing(ids);
  { const ck = drawCheck(ids); if (next && !ck.ok) return toast('🚫 ' + ck.msgs.find(m => m[0] === 'err')[1]); }
  if (!next) return toast('🚫 ' + (drawCheck(ids).msgs[0]?.[1] || 'Con estas restricciones no hay forma de sortear.') + ' Revisa las restricciones.');
  const perm = ids.map(x => next[x]);
  try {
    // 1) primero se invalida el sorteo viejo: si algo falla a medias, la app no lo da por bueno
    if (S.drawMeta) { const b0 = writeBatch(adb); b0.delete(doc(adb, 'config', 'draw')); await b0.commit(); }
    // 2) limpieza de giros, pistas y estados anteriores (puede ir en tandas)
    const ops = [];
    { const [rv, th, gu] = await Promise.all([getDoc(doc(adb, 'reveal', 'main')), getDocs(collection(adb, 'thanks')), getDocs(collection(adb, 'guesses'))]);
      const hop = histOp(rv, null, th, gu); if (hop) ops.push(hop); if (rv.exists()) ops.push(['del', rv.ref]); } // restos de un sorteo viejo: primero al historial
    // parejas nuevas: se borra solo lo que dependía de la pareja anterior (estado del regalo, "mi regalo", pistas, sospechas y apartados).
    // Deseos, fotos, perfiles, chat, ideas, asistencia y aportes NO se tocan.
    for (const c of ['giftStatus', 'hintsSent', 'angelGuess', 'wishPick', 'thanks', 'guesses']) /* 🔐 regalo recibido y pistas los limpia la caja fuerte */ (await getDocs(collection(adb, c))).forEach(d => ops.push(['del', d.ref]));
    await commitOps(ops);
    // 3) 🔐 el sorteo lo hace la CAJA FUERTE (servidor): aquí solo se pide. Las parejas nunca pasan por este teléfono.
    await setDoc(doc(collection(adb, 'vaultOps')), { op: 'draw', ids, at: serverTimestamp() });
    void perm; toast('🔐 Sorteando en la caja fuerte… en 1 o 2 minutos llega el aviso para girar'); confetti(40);
  } catch (err) { toast(authErr(err) + ' · Vuelve a tocar Sortear'); }
});
async function commitOps(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(adb);
    ops.slice(i, i + 400).forEach(([t, ref, data, merge]) => t === 'set' ? b.set(ref, data, merge ? { merge: true } : undefined) : b.delete(ref));
    await b.commit();
  }
}
const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const PRESETS = {
  biblicos: { title: 'Personajes bíblicos', emoji: '📖', kind: 'assign', secret: true,
    items: 'Moisés\nNoé\nAbraham\nSara\nDavid\nGoliat\nEster\nRut\nDaniel\nJonás\nSansón\nDalila\nJosé (el de los sueños)\nMaría\nPedro\nPablo\nJuan el Bautista\nElías\nSalomón\nDébora\nGedeón\nJacob\nRebeca\nLázaro\nZaqueo\nMarta\nRaquel\nJosué\nNoemí\nTomás',
    desc: 'Cada quien recibe un personaje bíblico en secreto. Ven vestido o con un detalle de tu personaje y los demás tendrán que adivinar quién eres. ¡No le digas a nadie lo que te tocó!' },
  vestido: { title: 'Mejor vestido navideño', emoji: '👗', kind: 'vote', voteTarget: 'participants', desc: 'Vota por la persona que venga mejor vestida. El ganador se anuncia en la fiesta y se lleva un premio sorpresa.' },
  karaoke: { title: 'Karaoke de villancicos', emoji: '🎤', kind: 'assign', secret: false, items: 'Noche de paz\nCampana sobre campana\nLos peces en el río\nEl burrito sabanero\nFeliz Navidad\nAsómate a la ventana\nArbolito\nNiño Jesús\nLa marimorena\nBlanca Navidad', desc: 'A cada quien le toca un villancico para cantar. ¡Ensaya en la ducha!' },
  trivia: { title: 'Trivia navideña', emoji: '❓', kind: 'quiz', items: "¿Cuál es la capital de República Dominicana? | Santiago | *Santo Domingo | La Romana | Puerto Plata\n¿Cómo se llama la montaña más alta del Caribe? | Loma Quita Espuela | *Pico Duarte | Monte Cristi | Loma de la Galleta\n\"La bandera\" dominicana es arroz, habichuelas y carne | *Verdadero | Falso\nLas habichuelas con dulce se comen en Navidad | Verdadero | *Falso\n¿Qué día se celebra la Independencia dominicana? | 6 de enero | 16 de agosto | *27 de febrero | 24 de diciembre\nEl merengue es el baile nacional de República Dominicana | *Verdadero | Falso\n¿Qué se come típicamente en la Nochebuena dominicana? | Sushi | *Puerco asado | Pizza | Hot dog\n¿Qué bebida caliente es típica en Navidad en RD? | *Té de jengibre | Café frío | Limonada | Morir soñando\nLa playa de Bávaro queda en Punta Cana | *Verdadero | Falso\nEl Faro a Colón está en Santo Domingo | *Verdadero | Falso\n¿En qué ciudad está el Monumento a los Héroes de la Restauración? | Higüey | *Santiago | Barahona | Baní\n¿En qué ciudad nació Jesús? | Nazaret | Jerusalén | *Belén | Egipto\n¿Cuántos Reyes Magos dice la tradición que llegaron? | 2 | *3 | 4 | 12\n¿Qué día se celebra el Día de Reyes? | 25 de diciembre | 1 de enero | *6 de enero | 14 de febrero\n¿Quién fue el primer hombre según la Biblia? | Noé | Moisés | *Adán | Abraham\n¿Cuál es el primer libro de la Biblia? | Éxodo | *Génesis | Mateo | Apocalipsis\n¿Cuál fue el primer milagro de Jesús? | Caminar sobre el agua | *Convertir agua en vino | Multiplicar los panes | Calmar la tormenta\n¿Quién construyó el arca? | Moisés | *Noé | David | Jonás\n¿Quién venció al gigante Goliat? | Sansón | Salomón | *David | Pedro\n¿Quién abrió el Mar Rojo? | Elías | *Moisés | Josué | Pablo\nSanta Claus vive en el Polo Sur | Verdadero | *Falso\n¿Cómo se llama el reno de la nariz roja? | Bambi | *Rudolph | Pancho | Rayo\n¿Cuál es el primer mes del año? | Diciembre | *Enero | Febrero | Marzo\nEl sol es una estrella | *Verdadero | Falso\n¿De qué color era el caballo blanco de Napoleón? | Negro | Marrón | *Blanco | Gris\n¿Cuántos meses del año tienen 28 días? | Solo febrero | 2 | 6 | *Todos\n¿Qué pesa más: un kilo de algodón o un kilo de hierro? | El hierro | El algodón | *Pesan lo mismo\n¿Cuántas patas tiene un gallo? | *2 | 4 | 3 | 6\nSi estás en una carrera y pasas al segundo, ¿en qué lugar quedas? | Primero | *Segundo | Tercero | Último\n¿Qué tiene dientes pero no come? | Un perro | *Un peine | Un bebé | Una silla",
    desc: 'Preguntas fáciles (y algunas con truco 😄) sobre RD, la Navidad y la Biblia. Responde desde tu teléfono; el organizador publica el ranking en la fiesta.' },
  regalo: { title: 'Mejor regalo de la noche', emoji: '🏆', kind: 'vote', voteTarget: 'participants', desc: 'Después del intercambio, vota por quien dio el regalo más creativo.' }
};
const aForm = $('#a-form');
function updKind() {
  const k = aForm.kind.value, vt = aForm.voteTarget.value;
  $('#a-vt-f').style.display = k === 'vote' ? '' : 'none';
  $('#a-items-f').style.display = (k === 'assign' || k === 'signup' || k === 'quiz' || (k === 'vote' && vt === 'options')) ? '' : 'none';
  $('#a-quiz-h').style.display = k === 'quiz' ? '' : 'none';
  aForm.items.style.minHeight = k === 'quiz' ? '220px' : '';
  $('#a-secret-f').style.display = k === 'assign' ? '' : 'none';
  $('#a-items-l').textContent = k === 'quiz' ? 'Preguntas (una por línea)' : k === 'assign' ? 'Lo que se va a repartir (uno por línea)' : k === 'signup' ? 'Cosas para apuntarse (una por línea)' : 'Opciones de la votación (una por línea)';
}
aForm.kind.addEventListener('change', updKind); aForm.voteTarget.addEventListener('change', updKind);
function fillActForm(a, editing) {
  aForm.reset();
  for (const k of ['title', 'date', 'time', 'place', 'host', 'dress', 'bring', 'desc']) aForm[k].value = a[k] || '';
  { const d = a.openAt ? new Date(a.openAt) : null; aForm.openDate.value = d ? d.toLocaleDateString('en-CA') : ''; aForm.openTime.value = d ? d.toTimeString().slice(0, 5) : ''; }
  if (a.emoji) aForm.emoji.value = a.emoji;
  aForm.kind.value = a.kind || 'none'; aForm.voteTarget.value = a.voteTarget || 'participants';
  aForm.items.value = a.kind === 'quiz' && a.qs ? triviaText((a.qs || []).map(q => ({ ...q, c: -1 }))) : Array.isArray(a.items) ? a.items.join('\n') : (a.items || '');
  if (a.kind === 'quiz' && editing && a.id) getDoc(doc(adb, 'quizKeys', a.id)).then(d => { const c = d.data()?.c || []; if (aForm.id.value === a.id) aForm.items.value = triviaText((a.qs || []).map((q, i) => ({ ...q, c: c[i] ?? -1 }))); }).catch(() => { });
  aForm.secret.checked = a.secret !== false;
  aForm.id.value = editing ? a.id : '';
  $('#a-submit').textContent = editing ? 'Guardar cambios' : 'Agregar actividad';
  $('#a-cancel').style.display = editing ? '' : 'none';
  if (editing || a.title) $('#a-fold').open = true;
  updKind(); if ($('#a-fold').open) aForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
$('#a-presets').addEventListener('click', e => {
  const b = e.target.closest('[data-preset]'); if (!b) return;
  const p = PRESETS[b.dataset.preset]; fillActForm({ ...p, date: (S.event.eventDate || '').slice(0, 10) }, false);
  toast('Plantilla cargada: revisa y guarda ✨');
});
$('#a-cancel').addEventListener('click', () => { fillActForm({}, false); });
aForm.addEventListener('submit', async e => {
  e.preventDefault(); const f = aForm, id = f.id.value;
  const o = { title: f.title.value.trim(), emoji: f.emoji.value, date: f.date.value, time: f.time.value, place: f.place.value.trim(), host: f.host.value.trim(),
    dress: f.dress.value.trim(), bring: f.bring.value.trim(), desc: f.desc.value.trim(), kind: f.kind.value, voteTarget: f.voteTarget.value,
    items: f.items.value.split('\n').map(x => x.trim().slice(0, 100)).filter(Boolean).slice(0, 80), secret: f.secret.checked,
    openAt: f.openDate.value ? new Date(f.openDate.value + 'T' + (f.openTime.value || '00:00')).getTime() : null };
  if (!o.title || !o.date) return;
  if (o.openAt != null && isNaN(o.openAt)) return toast('La hora de apertura no es válida');
  if (o.kind === 'assign' && !o.items.length) return toast('Escribe lo que se va a repartir');
  let quizKey = null;
  if (o.kind === 'quiz') {
    const list = parseTrivia(f.items.value).slice(0, 60).map(t => ({ q: t.q.slice(0, 200), o: t.o.map(x => x.slice(0, 80)), c: t.c }));
    if (!list.length) return toast('Escribe al menos una pregunta: Pregunta | opción | *correcta');
    o.qs = list.map(({ q, o: op }) => ({ q, o: op })); quizKey = list.map(t => t.c); o.items = [];
  }
  if ((o.kind === 'signup' || (o.kind === 'vote' && o.voteTarget === 'options')) && !o.items.length) return toast('Escribe al menos una opción');
  try {
    if (id) {
      const old = S.activities.find(a => a.id === id);
      // "Apúntate": cada quien está anotado por el número de la opción; si una opción cambia o se quita, esa persona queda libre
      const su = old?.kind === 'signup' ? S.signups.filter(x => x.act === id && (o.kind !== 'signup' || (old.items || [])[x.idx] !== o.items[x.idx])) : [];
      if (su.length && !(await confirmBox('Cambiaste opciones con gente anotada', `${su.length === 1 ? '1 persona quedará' : su.length + ' personas quedarán'} sin anotar en lo que cambió, para que nadie aparezca llevando otra cosa.`, 'Guardar'))) return;
      const b = writeBatch(adb);
      su.forEach(x => b.delete(doc(adb, 'activitySignups', x.id)));
      b.set(doc(adb, 'activities', id), o, { merge: true });
      if (quizKey) b.set(doc(adb, 'quizKeys', id), { c: quizKey });
      if (old?.kind === 'assign' && old.secret !== o.secret)
        (await getDocs(query(collection(adb, 'activityPicks'), where('act', '==', id)))).forEach(d => b.set(d.ref, { public: !o.secret }, { merge: true }));
      await b.commit(); toast('Actividad actualizada ✏️');
    } else {
      S.selfEditAt = Date.now(); const ref = doc(collection(adb, 'activities'));
      if (quizKey) await setDoc(doc(adb, 'quizKeys', ref.id), { c: quizKey });
      await setDoc(ref, { ...o, at: serverTimestamp(), dev: DEV }); toast('Actividad agregada 📅');
    }
    fillActForm({}, false); $('#a-fold').open = false;
    setTimeout(() => $('#a-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  } catch (err) { toast(authErr(err)); }
});
async function assignAct(a) {
  const items = (a.items || []).filter(Boolean); if (!items.length) return toast('Esta actividad no tiene opciones para repartir');
  const ppl = shuffle(S.participants.map(p => p.id)); if (!ppl.length) return toast('No hay participantes todavía');
  const msg = a.assignedAt ? 'A cada persona le tocará algo nuevo.' : `Se repartirá entre ${ppl.length} personas${items.length < ppl.length ? ' (algunas opciones se repetirán porque hay más personas que opciones)' : ''}.`;
  if (!(await confirmBox(a.assignedAt ? '¿Repartir de nuevo?' : '¿Repartir ahora?', msg, 'Repartir'))) return;
  let pool = []; while (pool.length < ppl.length) pool = pool.concat(shuffle([...items]));
  try {
    const b = writeBatch(adb);
    (await getDocs(query(collection(adb, 'activityPicks'), where('act', '==', a.id)))).forEach(d => { if (!ppl.includes(d.data().uid)) b.delete(d.ref); });
    ppl.forEach((uid, i) => b.set(doc(adb, 'activityPicks', `${esc(a.id)}__${uid}`), { act: a.id, uid, item: pool[i], public: a.secret === false, at: serverTimestamp() }));
    b.set(doc(adb, 'activities', a.id), { assignedAt: serverTimestamp(), assignedN: ppl.length }, { merge: true });
    await b.commit(); toast('¡Repartido! 🎲 Cada quien ya puede ver lo suyo'); confetti(60);
  } catch (err) { toast(authErr(err)); }
}
async function toggleResults(a) {
  try {
    if (a.resultsOpen) { await setDoc(doc(adb, 'activities', a.id), { resultsOpen: false, key: [] }, { merge: true }); return toast('Resultados ocultos'); }
    if (a.kind === 'quiz') {
      const key = (await getDoc(doc(adb, 'quizKeys', a.id))).data()?.c || [];
      const ans = S.adminQuiz.filter(x => x.act === a.id && P(x.uid));
      const results = ans.map(x => ({ key: x.uid, label: pName(x.uid), emoji: pEmoji(x.uid), count: (x.a || []).filter((v, i) => v === key[i]).length, t: ms(x.at) }))
        .sort((x, y) => y.count - x.count || x.t - y.t).map(({ t, ...r }) => r);
      if (!(await confirmBox('¿Publicar resultados?', `${ans.length} ${ans.length === 1 ? 'persona respondió' : 'personas respondieron'}. Todos verán el ranking y las respuestas correctas, y ya no se podrá responder.`, 'Publicar'))) return;
      await setDoc(doc(adb, 'activities', a.id), { resultsOpen: true, results, key, votesN: ans.length }, { merge: true }); toast('Resultados publicados 🏆'); confetti(80); return;
    }
    const vs = S.adminVotes.filter(v => v.act === a.id);
    const opts = a.voteTarget === 'participants' ? S.participants.map(p => ({ key: p.id, label: p.name, emoji: p.emoji })) : (a.items || []).map(t => ({ key: t, label: t, emoji: '' }));
    const results = opts.map(o => ({ ...o, count: vs.filter(v => v.choice === o.key).length })).filter(r => r.count || a.voteTarget !== 'participants').sort((x, y) => y.count - x.count);
    if (!(await confirmBox('¿Publicar resultados?', `Hay ${vs.length} votos. Todos verán los resultados y ya no se podrá votar.`, 'Publicar'))) return;
    await setDoc(doc(adb, 'activities', a.id), { resultsOpen: true, results, votesN: vs.length }, { merge: true }); toast('Resultados publicados 🏆'); confetti(80);
  } catch (err) { toast(authErr(err)); }
}
$('#a-list').addEventListener('click', async e => {
  const t = e.target.closest('[data-act],[data-aedit],[data-assign],[data-results]'); if (!t) return;
  const a = S.activities.find(x => x.id === (t.dataset.act || t.dataset.aedit || t.dataset.assign || t.dataset.results)); if (!a) return;
  if (t.dataset.aedit) return fillActForm(a, true);
  if (t.dataset.assign) return assignAct(a);
  if (t.dataset.results) return toggleResults(a);
  if (!(await confirmBox('¿Borrar esta actividad?', 'Se borrará con sus asignaciones, votos y confirmaciones.', 'Borrar'))) return;
  try {
    const b = writeBatch(adb); b.delete(doc(adb, 'activities', a.id));
    for (const c of ['activityPicks', 'rsvps', 'votes', 'activitySignups', 'quizAns'])
      (await getDocs(query(collection(adb, c), where('act', '==', a.id)))).forEach(d => b.delete(d.ref));
    if (a.kind === 'quiz') b.delete(doc(adb, 'quizKeys', a.id));
    await b.commit(); toast('Actividad borrada');
  } catch (err) { toast(authErr(err)); }
});
updKind();

$('#q-clear').addEventListener('click', async () => {
  if (!(await confirmBox('¿Borrar todos los anónimos?', 'Se eliminarán todos los mensajes. No se puede deshacer.', 'Borrar todo'))) return;
  try {
    const qd = (await getDocs(collection(adb, 'questions'))).docs, docs = [...qd, ...qd.map(d => ({ ref: doc(adb, 'questionAuthors', d.id) }))]; // los autores no se leen: se borran por su mismo id
    for (let i = 0; i < docs.length; i += 400) { const b = writeBatch(adb); docs.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit(); }
    await setDoc(doc(adb, 'stats', 'questions'), { count: 0 }); $('#q-adm').innerHTML = ''; toast('Buzón vaciado');
  } catch (err) { toast(authErr(err)); }
});

async function loadAdminQuestions() {
  const box = $('#q-adm'); box.innerHTML = '<p class="muted small"><span class="spin-dots"></span> Cargando…</p>';
  try {
    // 🔒 El autor de cada anónimo queda sellado hasta la revelación (lo exigen también las reglas de la base)
    const qs = await getDocs(collection(adb, 'questions')), sealed = !isRevealed();
    const authors = sealed ? {} : Object.fromEntries((await getDocs(collection(adb, 'questionAuthors')).catch(() => ({ docs: [] }))).docs.map(d => [d.id, d.data().uid]));
    const list = qs.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(a.at) - ms(b.at));
    box.innerHTML = list.length ? (sealed ? `<p class="muted small">🔒 Los autores están sellados hasta la revelación: nadie puede verlos antes, ni siquiera el organizador.</p>` : `<p class="muted small">🤫 Solo tú ves esto. Los participantes nunca ven el autor.</p>`) + list.map(q => `
      <div class="item"><span style="font-size:22px">${esc(authors[q.id] ? pEmoji(authors[q.id]) : '❔')}</span><div class="grow">
        <div class="muted small"><b style="color:var(--gold)">De: ${sealed ? '🔒 Sellado' : esc(authors[q.id] ? pName(authors[q.id]) : 'Desconocido')}</b> → ${q.to ? esc(pName(q.to)) : 'Todos'}</div>
        <div class="t" style="margin-top:4px">${esc(q.text)}</div></div>
        <button class="x" data-qdel="${esc(q.id)}" aria-label="Borrar">✕</button></div>`).join('')
      : '<p class="muted small">El buzón está vacío.</p>';
  } catch (err) { box.innerHTML = ''; toast(authErr(err)); }
}
$('#q-view').addEventListener('click', loadAdminQuestions);
$('#q-adm').addEventListener('click', async e => {
  const b = e.target.closest('[data-qdel]'); if (!b) return;
  if (!(await confirmBox('¿Borrar este mensaje?', 'No se puede deshacer.', 'Borrar'))) return;
  try {
    const w = writeBatch(adb); w.delete(doc(adb, 'questions', b.dataset.qdel)); w.delete(doc(adb, 'questionAuthors', b.dataset.qdel));
    w.set(doc(adb, 'stats', 'questions'), { count: increment(-1) }, { merge: true });
    await w.commit(); loadAdminQuestions();
  } catch (err) { toast(authErr(err)); }
});

// 🐞 Errores recientes de la app (los anota cada teléfono, sin datos personales)
document.addEventListener('click', async e => {
  if (!e.target.closest('#err-load')) return;
  const box = $('#err-list'); box.innerHTML = '<p class="muted small"><span class="spin-dots"></span> Cargando…</p>';
  try {
    const s = await rtGet(rtQuery(rtRef(ardb, 'errs'), rtOrderByChild('ts'), rtLimitToLast(60))), by = new Map();
    s.forEach(c => { const v = c.val() || {}, k = (v.m || '') + '|' + (v.s || ''); const o = by.get(k) || { ...v, n: 0, last: 0 }; o.n++; o.last = Math.max(o.last, +v.ts || 0); by.set(k, o); });
    const L = [...by.values()].sort((a, b) => b.last - a.last);
    box.innerHTML = L.length ? L.map(o => `<div class="item" style="align-items:flex-start"><span>🐞</span><div class="grow"><div class="t" style="word-break:break-word">${esc(o.m)}</div><div class="muted small">${esc(o.s || '')} · ${esc(o.p || '')} · v${esc(o.v || '')}</div><div class="muted small">${o.n} ${o.n === 1 ? 'vez' : 'veces'} · última ${new Date(o.last).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })}</div></div></div>`).join('') : '<p class="muted small">✅ No hay errores anotados. ¡Todo bien!</p>';
  } catch (err) { box.innerHTML = `<p class="muted small">No se pudieron cargar (${esc(err?.code || err?.message || 'error')}).</p>`; }
});
