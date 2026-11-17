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
  const emoChip = g => g?.players?.includes(me()) && (g.status === 'playing' || g.status === 'done') ? `<button type="button" class="emo-chip" data-gact="emo" data-n="${G.chatUnread || ''}" aria-label="Chat y reacciones">💬</button>` : '';
  /* ----- 💬 chat de la mesa: privado de esta sala (jugadores y quien esté mirando); se borra con la mesa ----- */
  const chatOpen = () => !!document.querySelector('#sheet .gc-list') && !!document.getElementById('modal')?.classList.contains('on');
  const chatRow = m => `<div class="gc-m ${m.uid === me() ? 'me' : ''}"><small>${esc(m.uid === me() ? 'Tú' : String(seatName(m.uid)))}</small><span>${esc(m.t)}</span></div>`;
  function paintChat() {
    const l = document.querySelector('#sheet .gc-list'); if (!l) return;
    const near = l.scrollHeight - l.scrollTop - l.clientHeight < 60;
    l.innerHTML = G.chat.length ? G.chat.map(chatRow).join('') : '<p class="gc-empty">Nadie ha escrito todavía. ¡Rompe el hielo! 😏</p>';
    if (near) l.scrollTop = l.scrollHeight;
  }
  function chatBadge() { document.querySelectorAll('[data-gact="emo"]').forEach(b => { b.dataset.n = G.chatUnread > 9 ? '9+' : G.chatUnread || ''; }); }
  async function sendChat(txt) {
    const g = G.cur; txt = String(txt || '').trim().slice(0, 200); if (!g || !txt) return;
    if (Date.now() - (G.chatT || 0) < 900) return; G.chatT = Date.now();
    const m = { uid: me(), t: txt, ts: Date.now() };
    if (isLoc(g.id)) { G.chat = [...G.chat, { id: 'l' + m.ts, ...m }].slice(-40); paintChat(); return; } // contra 🤖 se queda en tu teléfono
    try { const k = RT.push(rr('gchat/' + g.id)).key; await rUpdate({ [`gchat/${g.id}/${k}`]: m }); } catch (e) { toast(gErr(e)); }
  }
  function emotePicker() {
    const g = G.cur, seated = g?.players?.includes(me());
    G.chatUnread = 0; chatBadge();
    const s2 = openModal(`<h3>💬 Chat de la mesa</h3><p class="muted small" style="margin-top:2px">Solo lo ve quien está en esta mesa · se borra al cerrarla</p>
      <div class="gc-list"></div>
      <form class="gc-form"><input class="in" maxlength="200" placeholder="Escribe algo… 😏" autocomplete="off" enterkeyhint="send"><button class="btn gold" type="submit" aria-label="Enviar">➤</button></form>
      ${seated ? `<div class="emo-grid">${EMOTES.slice(0, 8).map((e, k) => `<button type="button" data-emo="${k}">${e}</button>`).join('')}</div>
      <div class="emo-phr">${EMOTES.slice(8).map((e, k) => `<button type="button" data-emo="${k + 8}">${esc(e)}</button>`).join('')}</div>` : ''}`);
    paintChat();
    const f = s2.querySelector('.gc-form');
    f.onsubmit = e => { e.preventDefault(); const i = f.querySelector('input'); sendChat(i.value); i.value = ''; i.focus(); };
    s2.onclick = e => { const b = e.target.closest('[data-emo]'); if (!b) return; closeModal(); sendEmote(+b.dataset.emo); };
  }
  function closeGame() {
    G.subEmo?.(); G.subEmo = null; G.subChat?.(); G.subChat = null; G.chat = []; G.chatIds = null; G.chatUnread = 0;
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
      toast('🙅 No llevas ficha: pasas'); playDomino(me(), null);
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
    const g = G.cur; armClock(); sounds(prev, g); autoPass(); showTiles();
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
