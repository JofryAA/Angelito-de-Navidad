/* ---------- 📺 modo fiesta ---------- */
let PARTY = null;
async function openParty() {
  if (!S.isOwner) return toast('Solo el organizador principal puede abrir el modo fiesta');
  toast('Preparando el modo fiesta… 📺');
  let qs = [], ag = [];
  try { qs = (await getDocs(collection(adb, 'questions'))).docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => ms(a.at) - ms(b.at)); } catch { }
  try { ag = (await getDocs(collection(adb, 'angelGuess'))).docs.map(d => ({ id: d.id, ...d.data() })); } catch { }
  let authors = {}; try { (await getDocs(collection(adb, 'questionAuthors'))).forEach(d => { authors[d.id] = d.data().uid; }); } catch { }
  const choice = await new Promise(res => {
    const s2 = openModal(`<h3>📺 Abrir el modo fiesta</h3><p class="muted">Al abrirlo ya nadie podrá cambiar su sospecha.</p>
      <div class="stack" style="margin-top:14px"><button class="btn gold" data-a="cont">▶️ Continuar donde quedé</button>
      <button class="btn" data-a="fresh">🧹 Empezar desde cero <span class="muted small" style="display:block;font-weight:400">Borra trivia y votos de ensayos</span></button>
      <button class="btn ghost" data-a="no">Cancelar</button></div>`);
    s2.onclick = ev => { const a = ev.target.closest('[data-a]')?.dataset.a; if (a) { closeModal(); res(a); } };
  });
  if (choice === 'no') return;
  const fresh = choice === 'fresh';
  try {
    const ops = [];
    if (fresh) for (const c of ['triviaAns', 'anonVotes']) (await getDocs(collection(adb, c))).forEach(d => ops.push(['del', d.ref]));
    ops.push(['set', doc(adb, 'config', 'event'), { angelLocked: true }, true]);  // ya no se pueden cambiar sospechas ni mandar pistas
    await commitOps(ops);
  } catch (e) { console.warn(e); }
  PARTY_SUBS.forEach(u => u()); PARTY_SUBS = [
    onSnapshot(collection(adb, 'anonVotes'), s => { S.anonVotesLive = s.docs.map(d => d.data()); if (PARTY) paintParty(); }, () => { }),
  ];
  const c = S.event, slides = [];
  const big = (e, t, sub = '') => `<div class="pe">${e}</div><div class="pt">${t}</div>${sub ? `<div class="ps">${sub}</div>` : ''}`;
  slides.push({ html: () => big('🎁', esc(c.eventName || 'Angelito de Navidad'), `¡Bienvenidos! · ${S.participants.length} participantes`) });
  // parejas
  const pairs = Object.entries(S.assignments).filter(([g, a]) => P(g) && P(a.recipient)).map(([g, a]) => ({ g, r: a.recipient }));
  shuffle(pairs);
  if (pairs.length) {
    slides.push({ html: () => big('🎡', 'La gran revelación', 'Toca para descubrir cada angelito') });
    pairs.forEach(x => slides.push({ reveal: false, onReveal: () => confetti(120), html: s => `<div class="ps">El angelito de</div><div class="pt">${esc(pEmoji(x.r))} ${esc(pName(x.r))}</div><div class="ps">es…</div>
      <div class="pt" style="${s.reveal ? '' : 'filter:blur(22px)'}">${esc(pEmoji(x.g))} <span class="gold">${esc(pName(x.g))}</span></div>
      ${s.reveal && ag.find(a => a.id === x.r)?.guess ? `<div class="ps">${esc(P(x.r)?.first || '')} creía que era ${esc(pName(ag.find(a => a.id === x.r).guess))} ${ag.find(a => a.id === x.r).guess === x.g ? '✅' : '❌'}</div>` : ''}` }));
    const hits = pairs.filter(x => ag.find(a => a.id === x.r)?.guess === x.g);
    if (ag.length) slides.push({ html: () => big('🕵️', `${hits.length} ${hits.length === 1 ? 'persona adivinó' : 'personas adivinaron'} su angelito`, hits.map(x => esc(pName(x.r))).join(' · ') || 'Nadie esta vez 😅') });
  }
  // anónimos
  if (qs.length) {
    slides.push({ html: () => big('💌', 'Buzón anónimo', nMsg(qs.length)) });
    qs.forEach((q, i) => slides.push({ steps: 2, step: 0, author: false,
      onEnter: s => setLive({ mode: 'anon', qid: q.id, text: q.text, open: s.step === 0 }),
      onStep: s => { setLive({ mode: 'anon', qid: q.id, text: q.text, open: false }); },
      html: s => { const vs = S.anonVotesLive.filter(v => v.qid === q.id); const cnt = {}; vs.forEach(v => cnt[v.choice] = (cnt[v.choice] || 0) + 1);
        const top = Object.entries(cnt).filter(([u]) => P(u)).sort((a, b) => b[1] - a[1]).slice(0, 4), au = authors[q.id];
        return `<div class="ps">${q.to ? 'Para ' + esc(pName(q.to)) : 'Para todos'} · ${i + 1}/${qs.length}</div><div class="pq">${esc(q.text)}</div>
          ${s.step === 0 ? `<div class="ps">🕵️ ¿Quién lo escribió? Voten desde su teléfono · ${vs.length} ${vs.length === 1 ? 'voto' : 'votos'}</div>`
          : `${top.length ? `<div class="pbars" style="margin:2vh auto 0">${top.map(([u, n]) => `<div class="pbar"><i style="width:${n / top[0][1] * 100}%"></i><span>${esc(pEmoji(u))} ${esc(pName(u))}</span><b>${n}</b></div>`).join('')}</div>` : '<div class="ps">Nadie votó</div>'}
            ${s.author ? `<div class="pt" style="font-size:min(7vw,60px)">✍️ <span class="gold">${au && P(au) ? esc(pName(au)) : 'Anónimo'}</span></div>` : `<div style="margin-top:2vh"><button class="btn sm" data-pauthor>👁️ Revelar quién lo escribió (solo si quieres)</button></div>`}`}`; } }));
  }
  // trivia: ranking de aciertos
  for (const a of S.activities.filter(a => a.kind === 'quiz')) {
    let key = []; try { key = (await getDoc(doc(adb, 'quizKeys', a.id))).data()?.c || []; } catch { }
    const N = (a.qs || []).length, res = S.adminQuiz.filter(x => x.act === a.id && P(x.uid)).map(x => ({ emoji: pEmoji(x.uid), label: pName(x.uid), n: (x.a || []).filter((v, i) => v === key[i]).length })).sort((x, y) => y.n - x.n);
    if (!res.length) continue;
    slides.push({ reveal: false, onReveal: () => confetti(140), html: s => `<div class="pe">❓</div><div class="pt">${esc(a.title)}</div>
      ${s.reveal ? `<div class="pt">🏆 ${esc(res[0].emoji)} <span class="gold">${esc(res[0].label)}</span></div><div class="ps">${res[0].n} de ${N} aciertos</div><div class="pbars">${res.slice(0, 5).map(r => `<div class="pbar"><i style="width:${r.n / Math.max(1, N) * 100}%"></i><span>${esc(r.emoji)} ${esc(r.label)}</span><b>${r.n}</b></div>`).join('')}</div>` : `<div class="ps">${res.length} ${res.length === 1 ? 'persona jugó' : 'personas jugaron'} · toca para ver quién ganó</div>`}` });
  }
  // votaciones
  S.activities.filter(a => a.kind === 'vote').forEach(a => {
    const vs = S.adminVotes.filter(v => v.act === a.id);
    const opts = a.voteTarget === 'participants' ? S.participants.map(p => ({ key: p.id, label: p.name, emoji: p.emoji })) : (a.items || []).map(t => ({ key: t, label: t, emoji: '' }));
    const res = opts.map(o => ({ ...o, n: vs.filter(v => v.choice === o.key).length })).filter(r => r.n).sort((x, y) => y.n - x.n);
    if (!res.length) return;
    slides.push({ reveal: false, onReveal: () => confetti(140), html: s => `<div class="pe">${esc(a.emoji || '🏆')}</div><div class="pt">${esc(a.title)}</div>
      ${s.reveal ? `<div class="pt">🏆 ${esc(res[0].emoji)} <span class="gold">${esc(res[0].label)}</span></div><div class="pbars">${res.slice(0, 5).map(r => `<div class="pbar"><i style="width:${r.n / res[0].n * 100}%"></i><span>${esc(r.emoji)} ${esc(r.label)}</span><b>${r.n}</b></div>`).join('')}</div>` : '<div class="ps">Toca para ver al ganador 🥁</div>'}` });
  });
  // adivinanzas de regalo
  const gs = (S.adminGuesses || []).filter(g => g.text && P(g.uid));
  if (gs.length) {
    slides.push({ html: () => big('🔮', '¿Qué creían que les iban a regalar?', S.event.guessPrize ? 'Premio: ' + esc(S.event.guessPrize) : '') });
    gs.forEach(g => slides.push({ html: () => `<div class="pt">${esc(pEmoji(g.uid))} ${esc(pName(g.uid))}</div><div class="ps">creía que le iban a regalar</div><div class="pq">${esc(g.text)}</div>${g.actual ? `<div class="ps">y le regalaron: <b>${esc(g.actual)}</b></div>` : ''}` }));
    if (S.event.guessWinner && P(S.event.guessWinner)) slides.push({ reveal: false, onReveal: () => confetti(160), html: s => big('🏆', 'Ganador de la adivinanza', s.reveal ? `<span class="gold" style="font-size:1.6em">${esc(pName(S.event.guessWinner))}</span>` : 'Toca para revelar 🥁') });
  }
  slides.push({ html: () => big('🎄', '¡Feliz Navidad!', 'Gracias por compartir 💛') });
  let saved = 0; try { saved = fresh ? 0 : +sessionStorage.getItem('angelito:partyI') || 0; } catch { }
  PARTY = { slides, i: Math.max(0, Math.min(saved, slides.length - 1)) };
  $('#party').classList.add('on'); enterSlide();
  try { await document.documentElement.requestFullscreen?.(); } catch { }
}
let PARTY_SUBS = [];
function paintParty() {
  const s = PARTY.slides[PARTY.i];
  $('#party-body').innerHTML = `<div class="pslide">${s.html(s)}</div>`;
  $('#party-count').textContent = `${PARTY.i + 1} / ${PARTY.slides.length}`;
}
function renderPartyLive() { if (PARTY) paintParty(); }
function enterSlide() {
  const s = PARTY.slides[PARTY.i];
  if (s.onEnter) s.onEnter(s); else if (PARTY.live) setLive({ mode: 'none' });
  PARTY.live = !!s.onEnter; paintParty();
}
function partyNext() {
  const s = PARTY.slides[PARTY.i];
  if (s.steps && s.step < s.steps - 1) { s.step++; s.onStep?.(s); return paintParty(); }
  if (s.reveal === false) { s.reveal = true; s.onReveal?.(); return paintParty(); }
  if (PARTY.i < PARTY.slides.length - 1) { PARTY.i++; enterSlide(); }
}
function partySkip() { if (PARTY.i < PARTY.slides.length - 1) { PARTY.i++; enterSlide(); } }
function partyPrev() { if (PARTY.i > 0) { PARTY.i--; enterSlide(); } }
function closeParty() { try { if (PARTY) sessionStorage.setItem('angelito:partyI', String(PARTY.i)); } catch { } $('#party').classList.remove('on'); PARTY = null; setLive({ mode: 'none' }); PARTY_SUBS.forEach(u => u()); PARTY_SUBS = []; try { document.fullscreenElement && document.exitFullscreen(); } catch { } }
$('#party').addEventListener('click', e => {
  if (e.target.closest('[data-pauthor]')) { const s = PARTY.slides[PARTY.i]; s.author = true; confetti(70); return paintParty(); }
  if (e.target.closest('#party-x')) return closeParty();
  if (e.target.closest('#party-prev')) return partyPrev();
  if (e.target.closest('#party-skip')) return partySkip();
  if (e.target.closest('#party-next') || e.target.closest('#party-body')) return partyNext();
});
addEventListener('pagehide', () => { if (PARTY) setLive({ mode: 'none' }); });
addEventListener('keydown', e => { if (!PARTY) return; if (['ArrowRight', ' ', 'Enter', 'PageDown'].includes(e.key)) { e.preventDefault(); partyNext(); } if (['ArrowLeft', 'PageUp'].includes(e.key)) partyPrev(); if (e.key === 'Escape') closeParty(); });
$('#party-open').addEventListener('click', openParty);

