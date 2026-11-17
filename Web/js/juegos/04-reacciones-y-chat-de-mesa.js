  /* ----- 😂 reacciones y frases rápidas en la mesa (como en el parchís) ----- */
  const EMOTES = ['😂', '😎', '🔥', '👏', '😱', '🙏', '😤', '🎉', '¡Buena jugada!', '¡Apúrate!', '¡Te tengo!', '¡Qué suerte!', 'Juega ya 🙄', '¡Esa no me la esperaba!', '¡Somos los mejores!', '¡Otra partida!'];
  function showEmote(seat, d) {
    const k = +d?.k, ts = +d?.ts || 0; if (!(k >= 0 && k < EMOTES.length) || Date.now() - ts > 9000) return;
    bubble(seat, EMOTES[k], k < 8, ts);
  }
  // Globito flotante sobre la mesa: lo usan las reacciones y los mensajes del chat de la mesa
  function bubble(seat, txt, big, ts) {
    const key = seat + ':' + ts + ':' + txt.length; G.emoSeen ||= new Set(); if (G.emoSeen.has(key) || Date.now() - ts > 9000) return; G.emoSeen.add(key);
    const root = document.getElementById('g-root'); if (!root) return;
    let box = document.getElementById('g-emos'); if (!box) { box = document.createElement('div'); box.id = 'g-emos'; document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = 'gemo' + (big ? ' big' : '') + (seat === me() ? ' mine' : '');
    el.innerHTML = `<span class="ge-who">${esc(seat === me() ? 'Tú' : String(seatName(seat)))}</span><span class="ge-t">${esc(txt)}</span>`;
    box.appendChild(el); try { SND.fx('pop'); } catch { }
    setTimeout(() => el.classList.add('out'), 3200); setTimeout(() => el.remove(), 3700);
  }
  async function sendEmote(k) {
    const g = G.cur; if (!g || !g.players?.includes(me())) return toast('Solo los que están en la mesa pueden reaccionar');
    if (Date.now() - (G.emoT || 0) < 1500) return; G.emoT = Date.now();
    const d = { k, ts: Date.now() };
    showEmote(me(), d); // tú lo ves al instante
    if (isLoc(g.id)) return; // contra 🤖 se queda en tu teléfono
    try { await setDoc(doc(db, 'games', g.id, 'emotes', me()), d); } catch (e) { toast(gErr(e)); }
  }
  // botoncito de reaccionar: va junto a «¡Te toca!» / el estado de la jugada, donde se mira durante el juego
  const emoChip = () => ''; // las reacciones y el chat ahora van en los botones flotantes (gfab)
  /* ----- 💬 chat de la mesa: privado de esta sala (jugadores y quien esté mirando); se borra con la mesa ----- */
  // Dos cosas separadas y pequeñas, para que la mesa se siga viendo:
  //   😄 bandeja de reacciones rápidas (flota encima del botón y se cierra al usarla)
  //   💬 chat de la mesa (panel bajito abajo, sin tapar el juego; la mesa sigue tocable)
  const chatOpen = () => !!document.getElementById('gchat-panel');
  const chatRow = m => `<div class="gc-m ${m.uid === me() ? 'me' : ''}"><small>${esc(m.uid === me() ? 'Tú' : String(seatName(m.uid)))}</small><span>${esc(m.t)}</span></div>`;
  function paintChat() {
    const l = document.querySelector('#gchat-panel .gc-list'); if (!l) return;
    const near = l.scrollHeight - l.scrollTop - l.clientHeight < 60;
    l.innerHTML = G.chat.length ? G.chat.map(chatRow).join('') : '<p class="gc-empty">Nadie ha escrito todavía. ¡Rompe el hielo! 😏</p>';
    if (near) l.scrollTop = l.scrollHeight;
  }
  function chatBadge() { document.querySelectorAll('[data-gact="chat"]').forEach(b => { b.dataset.n = G.chatUnread > 9 ? '9+' : G.chatUnread || ''; }); }
  async function sendChat(txt) {
    const g = G.cur; txt = String(txt || '').trim().slice(0, 200); if (!g || !txt) return;
    if (Date.now() - (G.chatT || 0) < 900) return; G.chatT = Date.now();
    const m = { uid: me(), t: txt, ts: Date.now() };
    if (isLoc(g.id)) { G.chat = [...G.chat, { id: 'l' + m.ts, ...m }].slice(-40); paintChat(); return; } // contra 🤖 se queda en tu teléfono
    try { const k = RT.push(rr('gchat/' + g.id)).key; await rUpdate({ [`gchat/${g.id}/${k}`]: m }); } catch (e) { toast(gErr(e)); }
  }
  function closeChat() { const p = document.getElementById('gchat-panel'); if (!p) return; p.classList.add('out'); setTimeout(() => p.remove(), 200); }
  function openChat() {
    if (chatOpen()) return closeChat(); closeTray();
    G.chatUnread = 0; chatBadge();
    const p = document.createElement('div'); p.id = 'gchat-panel';
    p.innerHTML = `<div class="gcp-h"><i class="gcp-grip" aria-hidden="true"></i><b>💬 Chat de la mesa</b><small>arrástralo · deslízalo arriba para quitarlo</small><button type="button" class="gcp-x" aria-label="Cerrar chat">✕</button></div><div class="gc-list"></div>
      <form class="gc-form"><input class="in" maxlength="200" placeholder="Escribe algo… 😏" autocomplete="off" enterkeyhint="send"><button class="btn gold" type="submit" aria-label="Enviar">➤</button></form>`;
    document.body.appendChild(p); paintChat();
    try { const t = +localStorage.getItem('angelito:gchatTop'); if (t) p.style.top = Math.min(innerHeight - 200, t) + 'px'; } catch { }
    const f = p.querySelector('.gc-form');
    f.onsubmit = e => { e.preventDefault(); const i = f.querySelector('input'); sendChat(i.value); i.value = ''; };
    p.querySelector('.gcp-x').onclick = closeChat;
  }
  function closeTray() { document.getElementById('gq-tray')?.remove(); }
  /* ✋ Interactivo: los botones flotantes se arrastran a donde quieras (se pegan al borde más cercano y se recuerda
     el lugar), y el panel del chat se arrastra por su barra: si lo lanzas hacia arriba o abajo, se quita. */
  const FAB_KEY = 'angelito:gfab';
  function fabPos() { try { return JSON.parse(localStorage.getItem(FAB_KEY) || 'null'); } catch { return null; } }
  function placeFab(el) { const p = fabPos(); if (!p || !el) return; el.style.top = Math.max(70, Math.min(innerHeight - 130, p.y)) + 'px'; el.style.left = p.side === 'l' ? '10px' : 'auto'; el.style.right = p.side === 'l' ? 'auto' : '10px'; }
  let fabDrag = null;
  document.addEventListener('pointerdown', e => {
    const f = e.target.closest('.gfab'); if (!f) return;
    const r = f.getBoundingClientRect(); fabDrag = { f, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
  }, true);
  document.addEventListener('pointermove', e => {
    if (!fabDrag) return; const d = fabDrag;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 8) return;
    d.moved = true; d.f.classList.add('drag'); closeTray();
    d.f.style.left = (e.clientX - d.dx) + 'px'; d.f.style.right = 'auto'; d.f.style.top = Math.max(60, Math.min(innerHeight - 110, e.clientY - d.dy)) + 'px';
  }, { passive: true });
  const fabUp = () => {
    const d = fabDrag; fabDrag = null; if (!d?.moved) return;
    const r = d.f.getBoundingClientRect(), side = r.left + r.width / 2 < innerWidth / 2 ? 'l' : 'r';
    d.f.classList.remove('drag'); try { localStorage.setItem(FAB_KEY, JSON.stringify({ side, y: r.top })); } catch { }
    placeFab(d.f); G.fabMovedAt = Date.now(); // el «clic» que viene al soltar no abre nada
  };
  document.addEventListener('pointerup', fabUp, true); document.addEventListener('pointercancel', fabUp, true);
  document.addEventListener('click', e => { if (e.target.closest('.gfab') && Date.now() - (G.fabMovedAt || 0) < 400) { e.stopPropagation(); e.preventDefault(); } }, true);
  new MutationObserver(() => { const f = document.querySelector('.gfab:not([data-placed])'); if (f) { f.dataset.placed = 1; placeFab(f); } }).observe(document.body, { childList: true, subtree: true });
  // panel del chat: arrastrar por la barra de arriba; si se suelta lejos, se quita
  let chDrag = null;
  document.addEventListener('pointerdown', e => { const h = e.target.closest('#gchat-panel .gcp-h'); if (!h || e.target.closest('button')) return; const p = h.parentElement; chDrag = { p, y0: e.clientY, top: p.getBoundingClientRect().top }; p.classList.add('drag'); }, true);
  document.addEventListener('pointermove', e => { if (!chDrag) return; const dy = e.clientY - chDrag.y0; chDrag.dy = dy; chDrag.p.style.top = Math.max(-200, chDrag.top + dy) + 'px'; chDrag.p.style.opacity = Math.max(.3, 1 - Math.max(0, -dy - 60) / 200); }, { passive: true });
  document.addEventListener('pointerup', () => {
    const d = chDrag; chDrag = null; if (!d) return; d.p.classList.remove('drag');
    if ((d.dy || 0) < -70) { closeChat(); return; } // lanzado hacia arriba: se quita
    const top = d.p.getBoundingClientRect().top;
    if (top > innerHeight - 120) { closeChat(); return; } // bajado hasta el fondo: se quita
    d.p.style.opacity = ''; try { localStorage.setItem('angelito:gchatTop', Math.max(56, Math.round(top))); } catch { }
  }, true);

  function emotePicker(anchor) {
    if (document.getElementById('gq-tray')) return closeTray();
    const g = G.cur; if (!g?.players?.includes(me())) return toast('Solo los que están en la mesa pueden reaccionar');
    const t = document.createElement('div'); t.id = 'gq-tray';
    t.innerHTML = `<div class="gqt-e">${EMOTES.slice(0, 8).map((e, k) => `<button type="button" data-emo="${k}">${e}</button>`).join('')}</div>
      <div class="gqt-p">${EMOTES.slice(8).map((e, k) => `<button type="button" data-emo="${k + 8}">${esc(e)}</button>`).join('')}</div>`;
    document.body.appendChild(t);
    const r = anchor?.getBoundingClientRect?.(); if (r) { t.style.top = Math.max(70, Math.min(innerHeight - 140, r.top - 20)) + 'px'; t.style.bottom = 'auto'; }
    t.onclick = e => { const b = e.target.closest('[data-emo]'); if (!b) return; closeTray(); sendEmote(+b.dataset.emo); };
    setTimeout(() => document.addEventListener('pointerdown', function off(ev) { if (!ev.target.closest('#gq-tray,[data-gact="emo"]')) { closeTray(); document.removeEventListener('pointerdown', off, true); } }, true), 0);
  }
  function closeGame() {
    closeChat(); closeTray(); G.subEmo?.(); G.subEmo = null; G.subChat?.(); G.subChat = null; G.subQ?.(); G.subQ = null; G.queue = []; G.chat = []; G.chatIds = null; G.chatUnread = 0;
    [G.sub, G.subHand, ...Object.values(G.subBots)].forEach(u => u && u()); clearTimeout(G.botT); clearTimeout(G.clockT); clearTimeout(G.dogT); clearTimeout(G.nextT);
    Object.assign(G, { sub: null, subHand: null, subBots: {}, cur: null, hand: [], botHands: {}, turnKey: '', srv: null, srvHand: [], srvBots: {}, pend: 0, okSeq: 0 });
  }
  // 🔊 Lo que suena en cada jugada (una sola vez por jugada)
  const spoken = s => s === me() ? 'Tú' : String(seatName(s)).replace(/[^\p{L}\p{N} ]/gu, '').trim() || 'El robot';
  function sounds(prev, g) {
    if (!g || !prev || prev.loading || prev.gone || prev.id !== g.id || g.loading) return;
    const k = `${g.id}:${g.round || 0}:${g.seq}`; if (G.sndKey === k) return; G.sndKey = k;
    const L = g.last;
    if (g.type === 'domino') {
      if (g.handOver && !prev.handOver && g.result) {
        const w = g.result.why || '', won = g.result.team >= 0 && g.result.team === teamOfSeat(g, me());
        if (g.status === 'done') { SND.fx(won ? 'win' : 'lose'); SND.say(won ? '¡Ganaste la partida!' : 'Se acabó la partida. ¡Otra!'); return; }
        if (/tranque/.test(w)) { SND.fx('lock'); SND.say(won ? '¡Juego trancado! Ganaste' : '¡Juego trancado!'); }
        else if (w === 'capicua') { SND.fx('win'); SND.say('¡Capicúa!'); }
        else { SND.fx(won ? 'win' : 'lose'); SND.say(won ? '¡Dominó! Ganaste la mano' : '¡Dominó!'); }
        return;
      }
      if ((g.chain || []).length > (prev.chain || []).length) SND.fx('clack');
      else if (L?.pass && (g.passes || 0) > (prev.passes || 0)) { SND.fx('pass'); SND.say(L.seat === me() ? 'Paso' : spoken(L.seat) + ' pasa'); }
      if (L?.bonus && !prev.last?.bonus) SND.say(L.bonus.why === 'corrido' ? '¡Pase corrido!' : '¡Pase de salida!');
    } else if (g.type === 'ttt' || g.type === 'c4') { if (g.board !== prev.board) SND.fx(g.type === 'c4' ? 'drop' : 'pop'); }
    else if (g.type === 'ahorcado') { if ((g.errors || 0) > (prev.errors || 0)) SND.fx('bad'); else if ((g.guessed || '').length > (prev.guessed || '').length) SND.fx('good'); }
    if (g.type !== 'domino' && g.status === 'done' && prev.status !== 'done') {
      const won = (g.winners || []).includes(me()), draw = g.result?.why === 'empate';
      SND.fx(won ? 'win' : draw ? 'pass' : 'lose');
      SND.say(won ? '¡Ganaste!' : draw ? 'Empate' : g.type === 'ahorcado' ? (g.result?.why === 'ahorcado' ? '¡Ahorcados!' : 'Palabra resuelta') : 'Perdiste. ¡La revancha!');
      return;
    }
    if (live(g) && g.players[g.turn] === me() && !(live(prev) && prev.players[prev.turn] === me())) SND.fx('turn');
  }
  // 🙅 Dominó: si no llevas ficha, pasas solo (te avisa y lo dice en voz alta)
  function autoPass() {
    const g = G.cur; clearTimeout(G.passT);
    if (!live(g) || g.type !== 'domino' || g.players[g.turn] !== me() || !G.hand.length) return;
    if ((g.counts?.[g.turn] ?? G.hand.length) !== G.hand.length) return; // tu mano todavía no llegó
    if (playable(G.hand, g.chain || [], g.mustOpen).length) return;
    const key = `${g.id}:${g.hand}:${g.turn}:${g.seq}`;
    G.passT = setTimeout(() => {
      const c = G.cur; if (!live(c) || c.players[c.turn] !== me() || `${c.id}:${c.hand}:${c.turn}:${c.seq}` !== key) return;
      if (playable(G.hand, c.chain || [], c.mustOpen).length) return;
      playDomino(me(), null); // sin cartel que tape la mesa: el «No llevas · pasando…» ya se ve en tu atril
    }, 1500);
  }
  // Alguien no está (se le fue el internet o salió): en X y O y 4 en línea juega un 🤖 por esa persona; en los demás se salta su turno
  function absentMove(seat) {
    const g = G.cur; if (!live(g) || g.players[g.turn] !== seat) return;
    return (g.type !== 'domino' && robotMove(g, seat)) || skipTurn(seat);
  }
  // La jugada de un 🤖 (también cuando juega por ti o por alguien que no está). hand: fichas, solo en dominó
  function robotMove(g, seat, hand) {
    if (g.type === 'domino') { if (!hand) return null; const c = botChoice(hand, g.chain || [], g.mustOpen); return playDomino(seat, c ? c.tile : null, c?.side); }
    if (g.type === 'ttt') return playTTT(seat, tttBot(g.board, g.turn === 0 ? 'X' : 'O'));
    if (g.type === 'c4') return playC4(seat, c4Bot(g.board, g.turn === 0 ? 'R' : 'Y'));
    return null;
  }
  // 🃏 Fin de mano: enseñar mis fichas (y las de los 🤖 si soy anfitrión) para comparar
  function showTiles() {
    const g = G.cur; if (!g || g.type !== 'domino' || !g.handOver) return;
    const mine = g.players.includes(me()) && !g.shown?.[me()] ? { [me()]: G.hand || [] } : {};
    if (g.host === me()) for (const b of g.players.filter(isBot)) if (!g.shown?.[b] && G.botHands[b]) mine[b] = G.botHands[b];
    const k = Object.keys(mine); if (!k.length || G.showing === g.seq) return; G.showing = g.seq;
    tx(async (t, c) => { if (!c.handOver) return; const sh = { ...(c.shown || {}) }; k.forEach(x => { if (!sh[x]) sh[x] = (mine[x] || []).join(',') || '-'; }); await upd(t, c, { shown: sh }); });
  }
  function onGameChange(prev) {
    const g = G.cur;
    if (G.pick && (!g || g.players?.[g.turn] !== me() || g.handOver || !G.hand.includes(G.pick))) G.pick = null; // ya no te toca: se cancela la elección de lado
    if (g && prev && !prev.loading && prev.players && !prev.players.includes(me()) && g.players?.includes(me())) { toast('🙋 ¡Te tocó! Entraste a la mesa'); try { navigator.vibrate?.([80, 40, 80]); SND.fx('pop'); } catch { } } armClock(); sounds(prev, g); autoPass(); showTiles();
    fx(prev); hostDuties();
    if (!g || g.type !== 'domino') { maybeBot(); return; }
    const mine = g.players?.includes(me());
    if (mine && !G.subHand) G.subHand = onSnapshot(doc(db, 'games', g.id, 'hands', me()), s => { G.srvHand = s.exists() ? tilesOk(s.data().tiles) : []; if (!G.pend) G.hand = G.srvHand; render(); autoPass(); }, () => { });
    if (g.host === me()) g.players.filter(isBot).forEach(b => { if (G.subBots[b]) return; G.subBots[b] = onSnapshot(doc(db, 'games', g.id, 'hands', b), s => { G.srvBots[b] = s.exists() ? tilesOk(s.data().tiles) : []; if (!G.pend) G.botHands[b] = G.srvBots[b]; maybeBot(); }, () => { }); });
    const key = `${g.id}:${g.hand}:${g.turn}:${g.handOver}`;
    if (g.status === 'playing' && !g.handOver && g.players[g.turn] === me() && G.seenTurn !== key) { G.seenTurn = key; if (navigator.vibrate) try { navigator.vibrate(60); } catch { } if (document.hidden) X.notify?.('🎲 ¡Te toca jugar!', g.title || 'Dominó', '#juegos'); }
    maybeBot();
  }
  function fx(prev) { // celebraciones, una sola vez por mano/partida
    const g = G.cur; if (!g || !prev || prev.loading) return;
    if (g.status === 'done' && prev.status === 'playing' && (g.winners || []).includes(me())) { const k = `${g.id}:${g.round || 0}:fin`; if (G.fxKey !== k) { G.fxKey = k; confetti(160); } return; }
    if (g.type === 'domino' && g.handOver && !prev.handOver && g.result && g.result.team >= 0 && teamOfSeat(g, me()) === g.result.team) { const k = `${g.id}:${g.round || 0}:${g.hand}`; if (G.fxKey !== k) { G.fxKey = k; confetti(80); } }
  }
  // Quien creó la mesa reparte las fichas (las reglas solo lo dejan a él): atiende los pedidos de los demás
  // y pasa sola a la siguiente mano para que el juego no se quede esperando un toque.
  function hostDuties() {
    const g = G.cur; clearTimeout(G.nextT);
    if (!g || g.host !== me() || g.type !== 'domino') return;
    const retry = ms => { G.nextT = setTimeout(hostDuties, ms); }; // se reevalúa hasta que la mesa avance (si un reparto falló, se repite)
    if (g.want === 'again' && g.status === 'done') { again(); return retry(2500); }
    if (g.status === 'playing' && g.handOver) {
      if (g.want === 'next') { nextHand(); return retry(2500); }
      G.nextT = setTimeout(() => { const c = G.cur; if (c && c.id === g.id && c.hand === g.hand && c.handOver && c.status === 'playing') nextHand(); retry(2500); }, NEXT_MS);
    }
  }
  const NEXT_MS = 8000;
