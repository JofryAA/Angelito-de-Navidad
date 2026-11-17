/* ---------- actividades ---------- */
const KIND = { assign: ['🎭', 'Asignación'], vote: ['🗳️', 'Votación'], signup: ['📝', 'Apúntate'], quiz: ['❓', 'Trivia'] };
function kindTag(a) {
  const k = KIND[a.kind]; const mine = a.kind === 'assign' && S.myPicks.some(p => p.act === a.id);
  const t = [k ? `<span class="tag">${k[0]} ${k[1]}</span>` : '', mine ? '<span class="tag gold">✨ Te tocó algo</span>' : '',
    (a.kind === 'vote' || a.kind === 'quiz') && a.resultsOpen ? '<span class="tag gold">🏆 Resultados</span>' : ''].join('');
  return t ? `<div class="tags">${t}</div>` : '';
}
const actWhen = a => `${fmtDate(a.date)}${a.time ? ' · ' + fmtTime(a.time) : ''}`;
function renderActs() {
  // El buzón anónimo es una actividad más (siempre primera en la lista).
  let anon = '';
  if (mod('anonimos')) {
    const open = isRevealed(), rd = revealDay(), n = S.qCount || 0;
    const when = open ? '¡Ya está abierto!' : rd ? 'Se abre el ' + revealWhen() : 'Se abre el día del intercambio';
    anon = `<a class="actcard card anoncard" href="#anonimos"><div class="em">💌</div>
      <div style="flex:1;min-width:0"><div class="when">${esc(when)}</div><h3>Buzón anónimo</h3><span class="badge">${open ? (n === 1 ? '👀 Leer el mensaje' : '👀 Leer los ' + n + ' mensajes') : '✍️ Escribe sin que sepan quién · ' + n + ' guardados'}</span></div>
      <span class="chev">›</span></a>`;
  }
  $('#acts-root').innerHTML = S.activities.length ? `<div class="stack">${anon}${S.activities.map(a => `
    <a class="actcard card" href="#actividad-${esc(a.id)}"><div class="em">${esc(a.emoji || '🎁')}</div>
      <div style="flex:1;min-width:0"><div class="when">${esc(actWhen(a))}</div><h3>${esc(a.title)}</h3>${a.openAt && Date.now() < a.openAt ? `<span class="badge">🔒 Se abre el ${esc(openWhen(a))}</span>` : kindTag(a)}</div>
      <span class="chev">›</span></a>`).join('')}</div>`
    : `${anon ? `<div class="stack" style="margin-bottom:12px">${anon}</div>` : ''}<div class="card plancard"><div class="pl-top"><span class="pl-ic">${ic('calendar', 26)}</span><div class="grow"><b>Aquí estará el plan del día</b><p class="small">Cena, juegos, dinámicas e intercambio. Te avisamos cuando el organizador lo publique.</p></div></div>${S.event.eventDate && new Date(S.event.eventDate) > new Date() ? (() => { const d = Math.ceil((new Date(S.event.eventDate) - new Date()) / 864e5); return `<div class="pl-cd"><b>${d}</b><span>${d === 1 ? 'día' : 'días'} para el angelito</span></div>`; })() : ''}
      <div class="qa" style="justify-content:center;margin-top:12px">${mod('juegos') ? '<a class="btn sm gold" href="#juegos">Mientras tanto, a jugar</a>' : ''}${mod('deseos') ? `<a class="btn sm btn-ic" href="#deseos">${ic('gift', 16)} Mi lista de deseos</a>` : ''}</div></div>`;
}
function voteOptions(a) {
  return a.voteTarget === 'participants'
    ? S.participants.filter(p => p.id !== S.uid).map(p => ({ key: p.id, label: p.name, emoji: p.emoji }))
    : (a.items || []).map(t => ({ key: t, label: t, emoji: '' }));
}
const openWhen = a => { const d = new Date(a.openAt); return fmtDate(d.toLocaleDateString('en-CA')) + ' a las ' + hm(d); };
const leftTo = t => { const m = Math.max(1, Math.round((t - Date.now()) / 6e4)); return m < 60 ? `Faltan ${m} min` : m < 1440 ? `Faltan ${Math.round(m / 60)} h` : `Faltan ${Math.ceil(m / 1440)} días`; };
/* ---------- ❓ trivia como actividad ---------- */
function quizHTML(a) {
  const qs = a.qs || [], my = S.myQuiz[a.id], N = qs.length;
  let h = `<div class="h2row"><h2>❓ ${a.resultsOpen ? 'Resultados' : 'Trivia'}</h2><span class="muted small">${N} preguntas</span></div>`;
  if (a.resultsOpen && a.results) {
    const key = a.key || [], max = Math.max(1, N);
    h += `<div class="stack">${a.results.slice(0, 15).map((r, i) => `<div class="bar ${i === 0 && r.count ? 'win' : ''}"><i style="width:${(Number(r.count) || 0) / max * 100}%"></i><span>${['🥇', '🥈', '🥉'][i] || i + 1 + '.'} ${esc(r.emoji || '')} ${esc(r.label)}</span><span>${Number(r.count) || 0}/${N}</span></div>`).join('') || '<div class="card empty">Nadie respondió 😅</div>'}</div>`;
    if (S.me) h += `<div class="h2row"><h2>Las respuestas</h2>${my ? `<span class="tag gold">Acertaste ${my.filter((v, i) => v === key[i]).length}/${N}</span>` : ''}</div>
      <div class="stack">${qs.map((q, i) => { const ok = my && my[i] === key[i]; return `<div class="qrev ${my ? (ok ? 'ok' : 'no') : ''}"><div class="qr-n">${i + 1}</div><div class="grow"><b>${esc(q.q)}</b>
        <div class="small">✅ ${esc(q.o[key[i]] ?? 'Sin respuesta')}${my && !ok ? `<br><span class="muted">Tú: ${esc(q.o[my[i]] ?? 'sin responder')}</span>` : ''}</div></div></div>`; }).join('')}</div>`;
    return h;
  }
  if (!S.me) return h + needLogin('Entra con tu PIN para jugar la trivia.');
  if (my) return h + `<div class="card qdone"><div class="qd-e">🎉</div><b>¡Listo! Respondiste las ${N} preguntas</b><p class="muted small">Los resultados y las respuestas correctas se publican cuando el organizador lo decida. ¡Suerte!</p></div>`;
  if (!N) return h + '<div class="card empty">Todavía no hay preguntas.</div>';
  const st = S.quizPlay[a.id];
  if (!st) return h + `<div class="card qstart"><div class="qd-e">🧠</div><b>${N} preguntas fáciles (o eso creemos 😅)</b><p class="muted small">Elige una respuesta en cada una. Al terminar se envían y ya no se pueden cambiar.</p><button class="btn gold" data-qstart>¡Empezar!</button></div>`;
  const i = st.i, q = qs[i];
  return h + `<div class="qcard" style="--p:${i / N * 100}%"><div class="qc-top"><span>Pregunta ${i + 1} de ${N}</span>${i ? '<button class="btn sm ghost" data-qback>‹ Atrás</button>' : ''}</div><div class="qc-bar"><i></i></div>
    <div class="qc-q">${esc(q.q)}</div><div class="qc-o">${q.o.map((o, k) => `<button class="qopt c${k + 1} ${st.a[i] === k ? 'on' : ''}" data-qa="${k}"><b>${'ABCD'[k]}</b><span>${esc(o)}</span></button>`).join('')}</div></div>`;
}
async function quizClick(a, b) {
  const N = (a.qs || []).length;
  if (b.dataset.qstart != null) { S.quizPlay[a.id] = { i: 0, a: [] }; return renderActDetail(); }
  const st = S.quizPlay[a.id]; if (!st) return;
  if (b.dataset.qback != null) { st.i = Math.max(0, st.i - 1); return renderActDetail(); }
  st.a[st.i] = +b.dataset.qa; b.classList.add('on');
  if (st.i < N - 1) { setTimeout(() => { st.i++; renderActDetail(); }, 220); return; }
  try {
    await setDoc(doc(db, 'quizAns', `${esc(a.id)}__${esc(S.uid)}`), { act: a.id, uid: S.uid, a: Array.from({ length: N }, (_, k) => st.a[k] ?? -1), at: serverTimestamp() });
    delete S.quizPlay[a.id]; confetti(90); toast('¡Respuestas enviadas! 🎉');
  } catch (err) { toast(err?.code?.includes('permission') ? 'La trivia ya cerró.' : authErr(err)); }
}
function renderActDetail() {
  const root = $('#act-root'); if (!root || !S.actId) return;
  const a = S.activities.find(x => x.id === S.actId);
  if (!a) { root.innerHTML = `<a class="back" href="#actividades">‹ Actividades</a><div class="card empty"><span class="e">🔎</span>Esta actividad no existe o fue borrada.</div>`; return; }
  const k = KIND[a.kind];
  const info = [['🕒', 'Cuándo', actWhen(a)], ['📍', 'Lugar', a.place], ['🙋', 'Responsable', a.host], ['👗', 'Vestimenta', a.dress], ['🧺', 'Qué traer', a.bring]].filter(x => x[2]);
  let h = `<a class="back" href="#actividades">‹ Actividades</a>
    <div class="hero act-hero"><div class="eyebrow">${k ? k[0] + ' ' + k[1] : 'Actividad'}</div><div class="bigem">${esc(a.emoji || '🎁')}</div><h1>${esc(a.title)}</h1><div class="when">${esc(actWhen(a))}</div></div>
    <div class="info">${info.map(([i, l, v]) => `<div class="card"><div class="k">${i} ${l}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>
    ${a.desc ? `<div class="card notes">${esc(a.desc)}</div>` : ''}`;

  // hasta la hora de apertura se ve la información, pero no se puede votar, apuntarse ni ver lo asignado
  if (a.openAt && Date.now() < a.openAt && !S.isAdmin) {
    root.innerHTML = h + `<div class="card vault"><span class="lock">🔒</span><p style="margin-top:6px">Se abre el <b>${esc(openWhen(a))}</b></p><span class="badge" style="margin-top:10px">⏳ ${esc(leftTo(a.openAt))}</span></div>`;
    clearTimeout(renderActDetail.t); renderActDetail.t = setTimeout(render, Math.min(a.openAt - Date.now() + 500, 60000)); return;
  }

  if (a.openAt && Date.now() < a.openAt) h += `<div class="banner" style="margin:10px 0">🔒 Los participantes la verán abierta el ${esc(openWhen(a))}</div>`;
  // dinámica
  if (a.kind === 'assign') {
    const mine = S.myPicks.find(p => p.act === a.id);
    h += `<div class="h2row"><h2>🎭 ${a.secret ? 'Lo que te tocó' : 'Asignaciones'}</h2></div>`;
    if (!S.me) h += needLogin('Entra con tu PIN para ver lo que te tocó.');
    else if (!a.assignedAt) h += `<div class="card empty"><span class="e">⏳</span>El organizador todavía no ha repartido. ¡Vuelve pronto!</div>`;
    else if (!mine) h += `<div class="card empty"><span class="e">🤷</span>No te tocó nada en este reparto. Quizás te registraste después; avísale al organizador.</div>`;
    else h += `<button class="pickcard ${S.revealed[a.id] ? 'open' : ''}" data-reveal="${esc(a.id)}"><div class="muted small">${esc(S.me.first)}, te tocó…</div><div class="reveal-name">${esc(mine.item)}</div><div class="hint">👆 Toca para ${S.revealed[a.id] ? 'ocultar' : 'revelar'}</div></button>`;
    if (S.me && a.assignedAt && a.secret) h += `<p class="muted small center" style="margin-top:10px">🤫 Es secreto: los demás no ven lo que te tocó.</p>`;
    if (S.me && a.assignedAt && !a.secret) {
      const pub = S.publicPicks.filter(p => p.act === a.id && P(p.uid)).sort((x, y) => pName(x.uid).localeCompare(pName(y.uid)));
      h += `<div class="stack" style="margin-top:12px">${pub.map(p => `<div class="item" style="align-items:center"><span style="font-size:20px">${esc(pEmoji(p.uid))}</span><div class="grow t">${esc(pName(p.uid))}</div><b style="color:var(--gold);text-align:right">${esc(p.item)}</b></div>`).join('')}</div>`;
    }
  } else if (a.kind === 'vote') {
    h += `<div class="h2row"><h2>🗳️ ${a.resultsOpen ? 'Resultados' : 'Vota'}</h2></div>`;
    if (a.resultsOpen && a.results) {
      const max = Math.max(1, ...a.results.map(r => Number(r.count) || 0)), tot = a.results.reduce((t, r) => t + (Number(r.count) || 0), 0);
      h += `<div class="stack">${a.results.map((r, i) => `<div class="bar ${i === 0 && r.count ? 'win' : ''}"><i style="width:${(Number(r.count) || 0) / max * 100}%"></i><span>${i === 0 && r.count ? '🏆 ' : ''}${esc(r.emoji || '')} ${esc(r.label)}</span><span>${Number(r.count) || 0}</span></div>`).join('')}</div>
        <p class="muted small center" style="margin-top:10px">${tot} ${tot === 1 ? 'voto' : 'votos'} en total</p>`;
    } else if (!S.me) h += needLogin('Entra con tu PIN para votar.');
    else {
      const opts = voteOptions(a), my = S.myVotes[a.id];
      h += opts.length ? `<div class="stack"${opts.length > 8 ? ' style="max-height:55vh;overflow:auto;padding-right:2px"' : ''}>${opts.map((o, i) => `<button class="opt ${my === o.key ? 'on' : ''}" data-vote="${i}"><span class="radio"></span>${o.emoji ? esc(o.emoji) + ' ' : ''}${esc(o.label)}</button>`).join('')}</div>
        <p class="muted small center" style="margin-top:10px">${my ? '✅ Ya votaste. Puedes cambiar tu voto' : 'Los demás participantes no ven tu voto. Puedes cambiarlo'} hasta que el organizador publique los resultados.</p>`
        : `<div class="card empty"><span class="e">🗳️</span>Todavía no hay opciones para votar.</div>`;
    }
  } else if (a.kind === 'quiz') h += quizHTML(a);
  else if (a.kind === 'signup') {
    const items = a.items || [], su = S.signups.filter(x => x.act === a.id);
    h += `<div class="h2row"><h2>📝 Apúntate</h2><span class="muted small">${su.length}/${items.length}</span></div>`;
    if (!S.me) h += needLogin('Entra con tu PIN para apuntarte.');
    else h += `<div class="stack">${items.map((t, i) => {
      const c = su.find(x => x.idx === i), mine = c && c.uid === S.uid;
      return `<div class="slot ${c ? 'taken' : ''}"><span style="font-size:20px">${c ? esc(pEmoji(c.uid)) : '⬜'}</span><div class="grow">${esc(t)}${c ? `<div class="who">${mine ? 'Lo llevas tú' : esc(pName(c.uid))}</div>` : ''}</div>
        ${!c ? `<button class="btn sm gold" data-sign="${i}">Me apunto</button>` : mine ? `<button class="btn sm" data-unsign="${i}">Soltar</button>` : '<span class="tag">✓</span>'}</div>`;
    }).join('')}</div>`;
  }

  root.innerHTML = h;
}
$('#act-root').addEventListener('click', async e => {
  const a = S.activities.find(x => x.id === S.actId); if (!a) return;
  const qb = e.target.closest('[data-qa],[data-qstart],[data-qback]');
  if (qb) return quizClick(a, qb);
  const t = e.target.closest('[data-reveal],[data-vote],[data-sign],[data-unsign]'); if (!t) return;
  try {
    if (t.dataset.reveal) { S.revealed[a.id] = !S.revealed[a.id]; if (S.revealed[a.id]) confetti(70); renderActDetail(); }
    else if (t.dataset.vote) {
      const o = voteOptions(a)[+t.dataset.vote]; if (!o) return;
      await setDoc(doc(db, 'votes', `${esc(a.id)}__${esc(S.uid)}`), { act: a.id, uid: S.uid, choice: o.key, at: serverTimestamp() }); toast('Voto guardado 🗳️');
    } else if (t.dataset.sign) {
      const i = +t.dataset.sign; if (S.signups.some(x => x.act === a.id && x.idx === i)) return toast('Alguien ya lo tomó');
      await setDoc(doc(db, 'activitySignups', `${esc(a.id)}__${i}`), { act: a.id, idx: i, uid: S.uid, at: serverTimestamp() }); toast('¡Apuntado! 🙌');
    } else if (t.dataset.unsign) {
      const w = writeBatch(db); w.delete(doc(db, 'activitySignups', `${esc(a.id)}__${t.dataset.unsign}`)); await w.commit();
    }
  } catch (err) { toast(err?.code?.includes('permission') ? 'Alguien se te adelantó o ya no se puede cambiar.' : authErr(err)); }
});

