  /* ================= 🏆 Torneo de dominó navideño =================
     Quien lo crea elige 1 contra 1 o en parejas; la gente se inscribe; al sortear se arman las llaves al azar.
     Cada partido es una mesa normal de dominó. El SERVIDOR mira quién ganó cada mesa y arma la ronda siguiente,
     hasta que queda el campeón. Todo vive en Realtime Database (tourn/), no gasta la cuota de Firestore. */
  G.tourn = null;
  function tournSub() { if (G.subT || !S.me) return; G.subT = RT.onValue(rr('tourn'), s => { G.tourn = s.val(); render(); }, () => { G.subT = null; }); }
  const tName = team => (team || []).map(u => esc(u === me() ? 'Tú' : seatName(u))).join(' y ');
  const myMatch = T => { const rs = T?.rounds || []; for (let r = 0; r < rs.length; r++) for (let i = 0; i < (rs[r] || []).length; i++) { const m = rs[r][i]; if (m && m.w == null && (m.t || []).some(tm => (tm || []).includes(me()))) return { r, i, m }; } return null; };
  function tournHTML() {
    const T = G.tourn;
    if (!T || !T.status) return `<button type="button" class="tn-cta" data-tn="new"><span class="tn-ic">🏆</span><span class="grow"><b>Torneo de dominó navideño</b><small>Crea uno: inscripciones, llaves y un campeón</small></span><span class="tn-go">Crear ▸</span></button>`;
    const by = T.by === me(), ents = Object.keys(T.entrants || {}).filter(u => X.P(u)), inIt = ents.includes(me());
    const head = `<div class="tn-h"><span class="tn-ic">🏆</span><div class="grow"><b>${esc(T.title || 'Torneo de dominó')}</b><small>${T.mode === 'parejas' ? 'En parejas' : '1 contra 1'} · a ${T.target || 100} puntos · organiza ${esc(T.by === me() ? 'tú' : seatName(T.by))}</small></div></div>`;
    if (T.status === 'insc') return `<div class="tn">${head}
      <div class="tn-ents">${ents.length ? ents.map(u => `<span class="tn-p ${u === me() ? 'me' : ''}">${esc(X.pEmoji(u))} ${esc(u === me() ? 'Tú' : seatName(u))}</span>`).join('') : '<small class="muted">Nadie inscrito todavía</small>'}</div>
      <div class="qa"><button class="btn sm ${inIt ? '' : 'gold'}" data-tn="${inIt ? 'out' : 'in'}">${inIt ? 'Salir del torneo' : '✍️ Inscribirme'}</button>${by ? `<button class="btn sm gold" data-tn="draw" ${ents.length < (T.mode === 'parejas' ? 4 : 2) ? 'disabled' : ''}>🎲 Sortear llaves y empezar</button><button class="btn sm ghost" data-tn="cancel">Cancelar</button>` : ''}</div>
      ${by && ents.length < (T.mode === 'parejas' ? 4 : 2) ? `<small class="muted">Hacen falta al menos ${T.mode === 'parejas' ? 4 : 2} inscritos</small>` : ''}</div>`;
    const rs = T.rounds || [], mm = myMatch(T), n = rs.length;
    const rname = (r, total) => { const left = total - r; return left === 1 ? 'Final' : left === 2 ? 'Semifinal' : left === 3 ? 'Cuartos' : 'Ronda ' + (r + 1); };
    const total = Math.max(n, Math.ceil(Math.log2(Math.max(2, (rs[0] || []).length * 2))));
    const bracket = `<div class="tn-br">${rs.map((ms, r) => `<div class="tn-col"><small class="tn-rn">${rname(r, total)}</small>${(ms || []).map(m => {
      const t = m?.t || [], st = m?.w != null ? '' : m?.gid ? '<i class="tn-live">en juego</i>' : '';
      return `<div class="tn-m">${[0, 1].map(k => t[k] ? `<div class="tn-t ${m.w === k ? 'w' : m.w != null ? 'l' : ''} ${(t[k] || []).includes(me()) ? 'me' : ''}">${tName(t[k])}${m.w === k ? ' ✓' : ''}</div>` : `<div class="tn-t bye">— pasa directo —</div>`).join('')}${st}</div>`; }).join('')}</div>`).join('')}</div>`;
    if (T.status === 'done') { const champ = T.champ || []; return `<div class="tn done">${head}<div class="tn-champ"><span>🏆</span><b>${champ.length ? tName(champ) : '—'}</b><small>${champ.length > 1 ? '¡Campeones' : '¡Campeón'} del torneo navideño!</small></div>${bracket}${by ? '<div class="qa"><button class="btn sm" data-tn="clear">🧹 Quitar el torneo</button></div>' : ''}</div>`; }
    return `<div class="tn">${head}${mm ? `<div class="tn-me"><b>Tu partido · ${rname(mm.r, total)}</b><span>${tName(mm.m.t[0])} <i>vs</i> ${tName(mm.m.t[1])}</span>${mm.m.gid ? `<a class="btn sm gold" href="#juego-${esc(mm.m.gid)}">▶ Entrar a la mesa</a>` : `<button class="btn sm gold" data-tn="play">▶ Jugar mi partido</button>`}</div>` : ''}${bracket}${by ? '<div class="qa"><button class="btn sm ghost" data-tn="cancel">Cancelar torneo</button></div>' : ''}</div>`;
  }
  const tUpd = U => rUpdate(Object.fromEntries(Object.entries(U).map(([k, v]) => ['tourn' + (k ? '/' + k : ''), v])));
  function teamsFrom(ids, mode) { const a = shuffleTiles(ids); if (mode !== 'parejas') return a.map(u => [u]); const t = []; for (let i = 0; i + 1 < a.length; i += 2) t.push([a[i], a[i + 1]]); return t; }
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-tn]'); if (!b) return; const a = b.dataset.tn, T = G.tourn;
    try {
      if (a === 'new') {
        const s2 = openModal(`<h3>🏆 Nuevo torneo de dominó</h3><p class="muted small">Tú lo organizas: abres inscripciones y, cuando estén todos, sorteas las llaves.</p>
          <label class="field" style="margin-top:10px"><span>Nombre</span><input class="in" id="tn-title" maxlength="60" value="Torneo navideño de dominó"></label>
          <div class="field"><span>Modalidad</span><div class="chips"><button type="button" class="chip on" data-m="solo">1 contra 1</button><button type="button" class="chip" data-m="parejas">En parejas</button></div></div>
          <div class="field"><span>Cada partido a</span><div class="chips"><button type="button" class="chip" data-p="50">50</button><button type="button" class="chip on" data-p="100">100</button><button type="button" class="chip" data-p="150">150</button></div></div>
          <div class="actions"><button class="btn" data-a="x">Cancelar</button><button class="btn gold" data-a="ok">Abrir inscripciones</button></div>`);
        let mode = 'solo', target = 100;
        s2.onclick = async ev => {
          const m = ev.target.closest('[data-m]'), p = ev.target.closest('[data-p]'), k = ev.target.closest('[data-a]')?.dataset.a;
          if (m) { mode = m.dataset.m; s2.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x === m)); }
          if (p) { target = +p.dataset.p; s2.querySelectorAll('[data-p]').forEach(x => x.classList.toggle('on', x === p)); }
          if (k === 'x') closeModal();
          if (k === 'ok') { closeModal(); await tUpd({ '': { id: Date.now().toString(36), by: me(), title: (s2.querySelector('#tn-title').value || '').trim().slice(0, 60) || 'Torneo de dominó', mode, target, status: 'insc', at: Date.now(), entrants: { [me()]: Date.now() } } }); toast('🏆 ¡Torneo creado! Comparte para que se inscriban'); }
        };
        return;
      }
      if (!T) return;
      if (a === 'in' || a === 'out') return await tUpd({ ['entrants/' + me()]: a === 'in' ? Date.now() : null });
      if (a === 'cancel' || a === 'clear') { if (a === 'cancel' && !(await confirmBox('¿Cancelar el torneo?', 'Se borran las inscripciones y las llaves.', 'Cancelar torneo'))) return; return await tUpd({ '': null }); }
      if (a === 'draw') {
        const ents = Object.keys(T.entrants || {}).filter(u => X.P(u)), teams = teamsFrom(ents, T.mode);
        if (teams.length < 2) return toast('Hacen falta más inscritos');
        const r0 = []; for (let i = 0; i < teams.length; i += 2) r0.push(teams[i + 1] ? { t: [teams[i], teams[i + 1]] } : { t: [teams[i], null], w: 0 });
        const left = T.mode === 'parejas' && ents.length % 2 ? ents.filter(u => !teams.flat().includes(u)) : [];
        await tUpd({ rounds: [r0], status: 'play', start: Date.now() }); confetti(40);
        toast(left.length ? `🎲 ¡Llaves listas! ${seatName(left[0])} quedó sin pareja esta vez` : '🎲 ¡Llaves listas! Que empiece el torneo');
        return;
      }
      if (a === 'play') {
        const mm = myMatch(T); if (!mm || mm.m.gid) return;
        const order = T.mode === 'parejas' ? [mm.m.t[0][0], mm.m.t[1][0], mm.m.t[0][1], mm.m.t[1][1]] : [mm.m.t[0][0], mm.m.t[1][0]];
        const id = RT.push(rr('games')).key, now = Date.now();
        const base = { type: 'domino', host: me(), players: [me()], status: 'lobby', createdAt: now, updatedAt: now, seq: 0, mode: T.mode === 'parejas' ? 'parejas' : 'solo', max: T.mode === 'parejas' ? 4 : 2,
          target: T.target || 100, scores: T.mode === 'parejas' ? [0, 0] : [], title: `🏆 ${(T.title || 'Torneo').slice(0, 40)} · partido`, tm: { tid: T.id, r: mm.r, i: mm.i, order } };
        await rUpdate({ ['games/' + id]: base, [`tourn/rounds/${mm.r}/${mm.i}/gid`]: id }); // las dos cosas juntas: si otro ya creó la mesa, no queda una huérfana
        for (const u of order) if (u !== me()) rUpdate({ [`invites/${u}/${id}_${me()}`]: { from: me(), game: id, type: 'domino', title: 'tu partido del torneo 🏆', ts: Date.now() } }).catch(() => { });
        location.hash = 'juego-' + id;
      }
    } catch (err) { toast(gErr(err)); }
  });
