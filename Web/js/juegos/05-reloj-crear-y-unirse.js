  /* ----- reloj de turno: dominó 1 minuto, los demás 30 s, con su barra ----- */
  const turnMs = () => (typeof window !== 'undefined' && window.__turnMs) || (G.cur?.type === 'domino' ? 60000 : 30000); // dominó: 1 minuto; los demás: 30 s
  const live = g => g && g.status === 'playing' && !g.handOver && Array.isArray(g.players);
  function armClock() {
    const g = G.cur;
    if (!live(g)) { clearTimeout(G.clockT); clearTimeout(G.dogT); G.turnKey = ''; return; }
    if ((g.idle || 0) >= g.players.length * 2) { clearTimeout(G.clockT); clearTimeout(G.dogT); G.turnKey = ''; return; } // nadie está jugando: se para el reloj y la mesa caduca sola
    const key = `${g.id}:${g.hand || 0}:${g.turn}:${g.seq}`;
    if (key === G.turnKey) return;
    G.turnKey = key; G.turnStart = Date.now(); clearTimeout(G.clockT); clearTimeout(G.dogT);
    const seat = g.players[g.turn];
    if (seat === me()) G.clockT = setTimeout(() => { if (G.turnKey === key) autoMove(); }, turnMs());
    else if (!isBot(seat) && (g.host === me() || g.players.includes(me()))) G.clockT = setTimeout(() => { if (G.turnKey === key) absentMove(seat); }, turnMs() + (g.host === me() ? 6000 : 15000)); // si la persona no está, se salta su turno (primero quien creó la mesa; si es él quien falta, cualquiera)
    if (g.host === me() && isBot(seat)) { const dog = () => { if (G.turnKey !== key) return; maybeBot(true); G.dogT = setTimeout(dog, 5000); }; G.dogT = setTimeout(dog, 5000); } // por si el 🤖 se quedó sin jugar
  }
  const clockBar = (T = turnMs()) => `<i class="tbar" style="animation-duration:${T / 1000}s;animation-delay:-${Math.min(T - 1, Math.max(0, Date.now() - (G.turnStart || Date.now()))) / 1000}s"></i>`;
  function autoMove() { // se acabó tu tiempo: la app juega por ti
    const g = G.cur; if (!live(g) || g.players[g.turn] !== me()) return;
    toast('⏰ Se acabó el tiempo: jugamos por ti');
    return robotMove(g, me(), G.hand) || skipTurn(me());
  }
  function skipTurn(seat) {
    return tx((t, g) => { if (!live(g) || g.players[g.turn] !== seat) return; upd(t, g, { turn: (g.turn + 1) % g.players.length, last: { seat, timeout: true, root: g.last?.root || 0 }, idle: (g.idle || 0) + 1, ...(g.type === 'domino' && !(g.chain || []).length ? { mustOpen: null } : {}) }); });
  }
  const teamOfSeat = (g, s) => { const i = g.players.indexOf(s); return i < 0 ? -1 : g.mode === 'parejas' ? i % 2 : i; };

  /* ----- crear / unirse ----- */
  async function create(type, mode) {
    if (G.creating) return; G.creating = true; setTimeout(() => { G.creating = false; }, 1500);
    const loc = mode === 'bot' || navigator.onLine === false, id = loc ? 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : RT.push(rr('games')).key, now = Date.now();
    const base = { type, host: me(), players: [me()], status: 'lobby', createdAt: now, updatedAt: now, seq: 0, title: '' };
    if (type === 'domino') Object.assign(base, { mode, max: mode === 'parejas' ? 4 : 4, target: mode === 'parejas' ? 200 : 100, scores: mode === 'parejas' ? [0, 0] : [], title: mode === 'parejas' ? 'Dominó en parejas' : 'Dominó, cada quien solo' });
    if (type === 'ttt') Object.assign(base, { max: 2, board: '.........', title: 'X y O' });
    if (type === 'c4') Object.assign(base, { max: 2, board: C4EMPTY, title: '4 en línea' });
    if (type === 'ahorcado') Object.assign(base, { max: 6, cat: mode || 'mix', title: 'Ahorcado · ' + (WORD_CATS[mode]?.name || 'De todo') });
    if (mode === 'bot') base.title += ' contra 🤖'; // las reglas exigen crear la mesa solo con uno mismo; start() sienta al 🤖
    try { await setDoc(doc(db, 'games', id), base); location.hash = 'juego-' + id; if (loc) { if (navigator.onLine === false) toast('📴 Sin internet: juegas contra 🤖 en este teléfono'); setTimeout(() => { if (G.cur?.id === id) start(); }, 400); } } catch (e) { toast(gErr(e)); }
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const QUIET = ['No es tu turno', 'La mano no está en juego']; // llegan tarde por un doble toque o un turno que ya pasó: no molestan
  async function tx(fn) {
    const gid = G.cur?.id; if (!gid) return false;
    for (let w = 0; G.busy && w < 100; w++) await sleep(50); // espera a que termine la jugada anterior en vez de perder esta
    if (G.busy || G.cur?.id !== gid) return false; G.busy = true;
    try {
      if (isLoc(gid)) { const s = lsnap('games/' + gid); if (!s.exists()) throw new Error('La mesa ya no existe'); const ops = [], t = { get: async r => lsnap(r.path), update: (r, v) => ops.push(() => lmerge(r.path, v)), set: (r, v) => ops.push(() => lput(r.path, v)) }; await fn(t, { id: gid, ...sane(s.data()) }); ops.forEach(f => f()); return true; }
      if (navigator.onLine === false) { if (Date.now() - (G.offT || 0) > 8000) { G.offT = Date.now(); toast('📡 Sin internet: esta partida es en línea. Al volver la conexión sigues jugando.'); } return false; }
      await rTx(gid, fn); return true; }
    catch (e) { if (window.__quota?.check(e)) { toast('⏳ Las partidas en línea están en pausa unos minutos (límite gratis de hoy).'); return false; } const m = e?.code === 'network' ? e.message : e?.code === 'permission-denied' ? 'No se pudo. Revisa que la hora de tu teléfono esté en automático.' : e?.code ? gErr(e) : (e.message || 'No se pudo'); if (!QUIET.includes(m)) toast(m); console.warn('juego', e); return false; }
    finally { G.busy = false; }
  }
  const upd = (t, g, patch) => t.update(doc(db, 'games', g.id), { ...patch, seq: (g.seq || 0) + 1, updatedAt: Date.now() });
  // Jugada "en vivo": se pinta al instante en tu pantalla y después se confirma en la base.
  // calc(g) devuelve { patch, seat?, hand? } o lanza un error si la jugada no vale. Si la base la rechaza, se deshace.
  function play(calc) {
    const g0 = G.cur; if (!g0 || g0.loading || g0.gone) return Promise.resolve();
    let opt = 0, real = 0;
    try {
      const r = calc(g0); if (!r) return Promise.resolve();
      opt = (g0.seq || 0) + 1; G.cur = { ...g0, ...r.patch, idle: 0, seq: opt };
      if (r.hand) { if (isBot(r.seat)) G.botHands = { ...G.botHands, [r.seat]: r.hand }; else if (r.seat === me()) G.hand = r.hand; }
      fx(g0); sounds(g0, G.cur); armClock(); render(); maybeBot(); autoPass();
    } catch (e) { if (!QUIET.includes(e.message)) toast(e.message || 'No se pudo'); return Promise.resolve(); }
    G.pend = (G.pend || 0) + 1;
    return tx((t, g) => { const r = calc(g, true); if (!r) return; real = (g.seq || 0) + 1; upd(t, g, { idle: 0, ...r.patch }); /* una jugada real reinicia el contador de turnos saltados */ if (r.hand) t.update(doc(db, 'games', g.id, 'hands', r.seat), { tiles: r.hand }); })
      .then(ok => {
        G.pend = Math.max(0, (G.pend || 1) - 1);
        if (!G.cur || G.cur.id !== g0.id || !G.srv) return;
        if (ok && real) G.okSeq = Math.max(G.okSeq || 0, real); // confirmada: un aviso más viejo que esto ya no cuenta
        if (ok && real !== opt && !G.pend && G.srv.seq >= real) { const prev = G.cur; G.cur = G.srv; G.hand = G.srvHand || []; G.botHands = { ...G.srvBots }; G.turnKey = ''; onGameChange(prev); render(); maybeBot(); return; }
        if (!ok || (!G.pend && (G.cur.seq || 0) <= G.srv.seq)) { // falló, o ya no queda nada en camino: manda lo que dice la base
          const prev = G.cur; G.cur = G.srv; G.hand = G.srvHand || []; G.botHands = { ...G.srvBots };
          G.turnKey = ''; onGameChange(prev); render(); maybeBot(); // si la jugada de un 🤖 falló, que lo vuelva a intentar
        }
      });
  }
  const join = () => tx((t, g) => { if (g.status !== 'lobby') throw new Error('La partida ya empezó'); if (g.players.includes(me())) return; if (g.players.length >= g.max) throw new Error('La mesa está llena'); upd(t, g, { players: [...g.players, me()] }); });
  const leave = () => tx((t, g) => { if (g.status !== 'lobby') throw new Error('Ya empezó'); upd(t, g, { players: g.players.filter(s => s !== me()) }); }).then(() => { location.hash = 'juegos'; });
  const addBot = () => tx((t, g) => { if (g.host !== me() || g.status !== 'lobby' || g.players.length >= g.max) return; const b = ['bot1', 'bot2', 'bot3'].find(x => !g.players.includes(x)); if (b) upd(t, g, { players: [...g.players, b] }); });
  const kick = s => tx((t, g) => { if (g.host !== me() || g.status !== 'lobby') return; upd(t, g, { players: g.players.filter(x => x !== s) }); });
  const swapSeats = () => tx((t, g) => { if (g.host !== me() || g.players.length < 3) return; const p = g.players.slice(); p.splice(1, 0, p.pop()); upd(t, g, { players: p }); });

  // Cambiarse de lado en la sala de espera (intercambia el asiento con quien esté en el lado elegido)
  function pickSide(k) {
    return tx((t, g) => {
      if (g.status !== 'lobby') throw new Error('Ya empezó');
      const p = g.players.slice(), i = p.indexOf(me()); if (i < 0) return;
      const pz = g.type === 'domino' && g.mode === 'parejas', ok = j => pz ? j % 2 === k : j === k;
      if (ok(i)) return;
      let j = p.findIndex((s, n) => n !== i && ok(n) && isBot(s)); if (j < 0) j = p.findIndex((s, n) => n !== i && ok(n));
      if (j >= 0) { [p[i], p[j]] = [p[j], p[i]]; return upd(t, g, { players: p }); }
      // nadie en ese lado: quien creó la mesa sienta un 🤖 delante para ocupar el otro lugar
      if (g.host !== me()) throw new Error('Pídele a quien creó la mesa que te cambie');
      if (p.length >= g.max) return;
      const b = ['bot1', 'bot2', 'bot3'].find(x => !p.includes(x)); if (!b) return;
      p.splice(i, 0, b); upd(t, g, { players: p });
    });
  }
  // ＋ en un asiento libre: invitar a alguien inscrito (le llega notificación), poner un 🤖 o compartir el enlace
  function seatPicker() {
    const g = G.cur; if (!g || g.status !== 'lobby') return;
    const host = g.host === me(), sent = G.invited ||= {};
    const ppl = (S.participants || []).filter(p => !g.players.includes(p.id)).sort((a, b) => a.name.localeCompare(b.name));
    const row = p => `<button class="sp-p ${sent[g.id + p.id] ? 'sent' : ''}" data-inv="${esc(p.id)}"><span class="sp-a">${esc(p.emoji || '🙂')}</span><span class="grow"><b>${esc(p.name)}</b></span><span class="sp-s">${sent[g.id + p.id] ? '✓ Invitado' : 'Invitar'}</span></button>`;
    const s2 = openModal(`<h3>＋ Llenar asiento</h3><p class="muted small">Elige a alguien del grupo: le llega una notificación para unirse. ${host && g.type !== 'ahorcado' ? 'Si lo dejas vacío, al empezar se llena con un 🤖.' : ''}</p>
      ${host && g.type !== 'ahorcado' ? '<button class="sp-bot" data-a="bot"><span class="sp-a">🤖</span><span class="grow"><b>Poner un robot ahora</b><small>Juega solo y al instante</small></span></button>' : ''}
      <input class="in" id="sp-q" placeholder="🔍 Buscar a alguien…" autocomplete="off" style="margin:12px 0 8px">
      <div class="sp-list" id="sp-list">${ppl.map(row).join('') || '<p class="muted small center">No hay más personas para invitar.</p>'}</div>
      <div class="actions"><button class="btn" data-a="link">📲 Enviar enlace</button><button class="btn gold" data-a="x">Listo</button></div>`);
    $('#sp-q', s2).addEventListener('input', e => { const q = e.target.value.trim().toLowerCase(); s2.querySelectorAll('[data-inv]').forEach(b => { b.style.display = !q || b.textContent.toLowerCase().includes(q) ? '' : 'none'; }); });
    s2.onclick = async ev => {
      const a = ev.target.closest('[data-a]')?.dataset.a, inv = ev.target.closest('[data-inv]');
      if (a === 'x') return closeModal();
      if (a === 'bot') { closeModal(); return addBot(); }
      if (a === 'link') { closeModal(); return document.querySelector('[data-gact="share"]')?.click(); }
      if (inv && !inv.classList.contains('sent')) {
        const to = inv.dataset.inv; inv.classList.add('sent'); inv.querySelector('.sp-s').textContent = 'Enviando…';
        try {
          await rUpdate({ [`invites/${to}/${g.id}_${me()}`]: { from: me(), game: g.id, type: g.type, title: g.title || 'una partida', ts: Date.now() } });
          sent[g.id + to] = 1; inv.querySelector('.sp-s').textContent = '✓ Invitado'; toast(`📨 Invitación enviada a ${X.shortName(X.P(to))}`);
        } catch (e) { inv.classList.remove('sent'); inv.querySelector('.sp-s').textContent = 'Invitar'; toast(gErr(e)); }
      }
    };
  }
  // Invitaciones que me llegan con la app abierta: aviso con botón para entrar a la mesa
  let unsubInv = null, invUid = null;
  function watchInvites() {
    if (invUid === me()) return; invUid = me(); if (unsubInv) { unsubInv(); unsubInv = null; } if (!me()) return;
    const base = 'invites/' + me();
    unsubInv = RT.onValue(rr(base), sn => {
      const seen = G.invSeen ||= new Set(), docs = []; sn.forEach(c => { docs.push({ id: c.key, ref: { __r: 1, path: base + '/' + c.key }, data: () => c.val() || {} }); });
      docs.forEach(d => {
        const ch = { doc: d }, v = d.data(), sk = d.id + ':' + (v.ts || 0); if (seen.has(sk)) return; seen.add(sk);
        if (Date.now() - (v.ts || 0) > 15 * 60e3) { deleteDoc(ch.doc.ref).catch(() => { }); return; } // vieja: se limpia
        if (location.hash === '#juego-' + v.game) { deleteDoc(ch.doc.ref).catch(() => { }); return; }
        // también como notificación del navegador (por si la app está en segundo plano o en otra pestaña)
        try {
          if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker?.controller)
            navigator.serviceWorker.controller.postMessage({ type: 'invite', title: `🎮 ${X.shortName(X.P(v.from)) || 'Alguien'} te invitó a jugar`, body: `${v.title} · ¿te unes?`, url: location.href.split('#')[0] + '#juego-' + v.game, game: v.game });
        } catch { }
        const s2 = openModal(`<div class="center"><div style="font-size:46px">🎮</div><h3>${esc(X.shortName(X.P(v.from)) || 'Alguien')} te invitó a jugar</h3><p class="muted">${esc(v.title)}</p></div>
          <div class="actions"><button class="btn" data-a="no">Ahora no</button><button class="btn gold" data-a="go">¡Vamos!</button></div>`);
        s2.onclick = e => { const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; closeModal(); deleteDoc(ch.doc.ref).catch(() => { }); if (a === 'go') location.hash = 'juego-' + v.game; };
      });
    }, () => { });
  }
  setInterval(watchInvites, 3000); setTimeout(watchInvites, 1500);
  // Quién sale en la partida siguiente: quien ganó la anterior; si hubo empate, se alterna.
  function nextStarterOf(g, players) {
    const n = players.length, w = (g.winners || []).find(s => players.includes(s)), rs = g.result?.seat;
    if (typeof rs === 'string' && players.includes(rs)) return players.indexOf(rs);        // X y O / 4 en línea (también si ganó el 🤖)
    if (w) return players.indexOf(w);
    return ((g.starter ?? -1) + 1) % n;
  }
  const first = n => Math.floor(Math.random() * n); // la primera partida la abre cualquiera, no siempre quien creó la mesa
  async function start() {
    const g = G.cur; if (g.host !== me() || G.starting) return; G.starting = true; setTimeout(() => { G.starting = false; }, 2000);
    if (g.type === 'domino') {
      let players = g.players.slice();
      if (g.mode === 'parejas') { while (players.length < 4) players.push(['bot1', 'bot2', 'bot3'].find(x => !players.includes(x))); }
      if (players.length < 2) { players.push('bot1'); }
      if (isLoc(g.id)) while (players.length < (g.max || 4)) players.push(['bot1', 'bot2', 'bot3'].find(x => !players.includes(x)));
      const ng = { ...g, players, nextStarter: -1, hand: 0 };
      return deal(g, ng, players, { players, status: 'playing', scores: g.mode === 'parejas' ? [0, 0] : players.map(() => 0), nextStarter: -1 });
    }
    if (g.type === 'ttt' || g.type === 'c4') {
      const players = g.players.length < 2 ? [...g.players, 'bot1'] : g.players;
      const st = first(players.length); return tx((t, gg) => upd(t, gg, { players, status: 'playing', board: g.type === 'c4' ? C4EMPTY : '.........', turn: st, starter: st, winners: [], result: null, lastCell: -1 }));
    }
    if (g.type === 'ahorcado') {
      const { word, cat } = pickWord(g.cat);
      return tx((t, gg) => { const st = first(gg.players.length); upd(t, gg, { status: 'playing', word, wcat: cat, guessed: hangOpen(word), errors: 0, maxErrors: 6, scores: gg.players.map(() => 0), turn: st, starter: st, winners: [], result: null }); });
    }
  }
  async function nextHand() {
    const g = G.cur; if (g.host !== me() || !g.handOver || g.status !== 'playing' || G.starting) return; G.starting = true; setTimeout(() => { G.starting = false; }, 2000);
    return deal(g, g, g.players, { result: null, want: null, idle: 0, shown: null });
  }
  // Reparte una mano: cada asiento recibe sus fichas en secreto y la mesa se actualiza, todo en una sola escritura
  async function deal(g, ng, players, extra) {
    const { hands, patch } = dealHand(ng);
    // en «transacción»: si alguien enseñó sus fichas en ese mismo instante, se reintenta con la mesa nueva (antes salía «sin permiso»)
    return tx((t, gg) => { players.forEach(s => t.set(doc(db, 'games', g.id, 'hands', s), { tiles: hands[s] })); upd(t, gg, { ...patch, ...extra }); });
  }
  // "Otra partida": arranca de una vez con los mismos jugadores y sale quien ganó.
  async function again() {
    let g = G.cur; if (!g || g.status !== 'done' || (!g.players.includes(me()) && g.host !== me()) || G.starting) return;
    const wait = 2500 - (Date.now() - (g.updatedAt || 0)); // un respiro para que los ganadores anoten su victoria antes de limpiar la mesa
    if (wait > 0) { if (G.againWait) return; G.againWait = true; await sleep(Math.min(wait, 2500)); G.againWait = false; g = G.cur; if (!g || g.status !== 'done' || G.starting) return; }
    if (g.type === 'domino') {
      if (g.host !== me()) return tx((t, gg) => { if (gg.status === 'done' && !gg.want) upd(t, gg, { want: 'again' }); }); // reparte quien creó la mesa
      G.starting = true; setTimeout(() => { G.starting = false; }, 2000);
      const ng = { ...g, hand: 0, nextStarter: typeof g.result?.seat === 'number' ? g.result.seat : -1 };
      return deal(g, ng, g.players, { status: 'playing', round: (g.round || 0) + 1, winners: [], result: null, want: null, idle: 0, shown: null, scores: g.mode === 'parejas' ? [0, 0] : g.players.map(() => 0) });
    }
    const np = g.type === 'ahorcado' ? pickWord(g.cat) : null;
    return tx((t, gg) => {
      if (gg.status !== 'done') return;
      const st = nextStarterOf(gg, gg.players), base = { status: 'playing', round: (gg.round || 0) + 1, turn: st, starter: st, winners: [], result: null };
      if (gg.type === 'ahorcado') upd(t, gg, { ...base, word: np.word, wcat: np.cat, guessed: hangOpen(np.word), errors: 0, scores: gg.players.map(() => 0) });
      else upd(t, gg, { ...base, board: gg.type === 'c4' ? C4EMPTY : '.........', lastCell: -1 });
    });
  }
  // Volver a la sala para cambiar jugadores (solo quien creó la mesa).
  async function rematch() {
    const g = G.cur; if (g.host !== me()) return;
    const human = g.players.filter(s => !isBot(s));
    await tx((t, gg) => upd(t, gg, { status: 'lobby', round: (gg.round || 0) + 1, want: null, players: gg.type === 'domino' && gg.mode === 'parejas' ? gg.players : human.concat(gg.players.filter(isBot)), winners: [], result: null, handOver: false, scores: gg.mode === 'parejas' ? [0, 0] : [], chain: [], hand: 0, board: gg.type === 'c4' ? C4EMPTY : '.........', guessed: '', errors: 0, lastCell: -1 }));
  }
  const askNext = () => tx((t, g) => { if (g.status === 'playing' && g.handOver && !g.want) upd(t, g, { want: 'next' }); });
  async function del() {
    if (!(await confirmBox('¿Cerrar esta mesa?', 'Se borra la partida para todos.', 'Cerrar mesa'))) return;
    try { await dropGame(G.cur); location.hash = 'juegos'; } catch (e) { toast(gErr(e)); }
  }

