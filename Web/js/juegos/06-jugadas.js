  /* ----- jugadas ----- */
  function playDomino(seat, tile, side) {
    const h = isBot(seat) ? (G.botHands[seat] || []) : G.hand; // la mano tal como está al decidir la jugada
    return play(g => { const r = applyMove(g, seat, h, tile, side); return { patch: r.patch, seat, hand: tile != null ? r.hand : null }; });
  }
  // 🤖 Los robots piensan como personas: tardan según lo difícil de la jugada (pocas opciones = rápido, muchas = piensan),
  // a veces dudan un poco, y al final de la mano van más ligeros. Nunca se pasan del reloj del turno.
  const rnd = (a, b) => a + (Math.random() + Math.random()) / 2 * (b - a); // más natural que un azar plano
  function botDelay(g, seat) {
    let t;
    if (g.type === 'domino') {
      const hand = G.botHands[seat] || [], chain = g.chain || [], opts = playable(hand, chain, g.mustOpen).length;
      if (!chain.length) t = rnd(1300, 2400);                       // la salida: mira toda la mano
      else if (!opts) t = rnd(900, 1700);                           // no lleva: revisa y dice «paso»
      else if (opts === 1) t = rnd(800, 1600);                      // jugada obligada
      else t = rnd(1500, 2600) + Math.min(5, opts) * rnd(150, 380); // varias opciones: piensa
      if (hand.length <= 2) t *= .75;                               // final de mano: ya sabe lo que hay
    } else if (g.type === 'ttt') t = (g.board || '').replace(/\./g, '').length < 2 ? rnd(700, 1300) : rnd(1000, 2200);
    else if (g.type === 'c4') t = rnd(1100, 2600);
    else t = rnd(1400, 3000);                                       // ahorcado: elige una letra
    if (Math.random() < .12) t += rnd(1200, 2800);                  // de vez en cuando se queda pensando
    return Math.min(t, 9000);
  }
  function maybeBot() {
    const g0 = G.cur, key = g0 ? `${g0.id}:${g0.seq}:${g0.turn}` : '';
    if (G.botT && G.botKey === key && G.botAt > Date.now()) return; // ya está pensando esta misma jugada: no se reinicia
    clearTimeout(G.botT); G.botT = null;
    if (!live(g0) || g0.host !== me()) return;
    if (document.hidden) return; // si quien creó la mesa no la está viendo, los 🤖 esperan (no gastan nada)
    const seat0 = g0.players[g0.turn]; if (!isBot(seat0)) return;
    const wait = botDelay(g0, seat0); G.botAt = Date.now() + wait; G.botKey = key;
    G.botT = setTimeout(() => {
      G.botAt = 0; G.botT = null;
      const g = G.cur; if (!live(g) || g.host !== me()) return; // siempre con el estado más reciente
      const seat = g.players[g.turn]; if (!isBot(seat)) return;
      if (g.type === 'domino') {
        const hand = G.botHands[seat]; if (!hand) return;
        if ((g.counts?.[g.turn] ?? hand.length) !== hand.length) return; // la mano del 🤖 aún no llegó; el reloj lo reintenta
        robotMove(g, seat, hand);
      } else robotMove(g, seat);
    }, wait);
  }
  function playTTT(seat, cell) {
    return play(g => {
      const i = g.players.indexOf(seat); if (g.status !== 'playing' || i !== g.turn) throw new Error('No es tu turno');
      if (g.board[cell] !== '.') throw new Error('Esa casilla está ocupada');
      const m = i === 0 ? 'X' : 'O', board = g.board.slice(0, cell) + m + g.board.slice(cell + 1), w = tttWinner(board);
      const p = { board, turn: 1 - i, lastCell: cell };
      if (w) Object.assign(p, { status: 'done', result: w === 'draw' ? { why: 'empate' } : { seat, why: 'gano' }, winners: w === 'draw' || isBot(seat) ? [] : [seat] });
      return { patch: p };
    });
  }
  function playC4(seat, col) {
    return play(g => {
      const i = g.players.indexOf(seat); if (g.status !== 'playing' || i !== g.turn) throw new Error('No es tu turno');
      const d = c4Drop(g.board, col, i === 0 ? 'R' : 'Y'); if (!d) throw new Error('Esa columna está llena');
      const w = c4Winner(d.b), p = { board: d.b, turn: 1 - i, lastCell: d.i };
      if (w) Object.assign(p, { status: 'done', result: w === 'draw' ? { why: 'empate' } : { seat, why: 'gano' }, winners: w === 'draw' || isBot(seat) ? [] : [seat] });
      return { patch: p };
    });
  }
  function hangLetter(L) {
    return play(g => {
      const i = g.players.indexOf(me()); if (g.status !== 'playing' || i !== g.turn) throw new Error('No es tu turno');
      if ((g.guessed || '').includes(L)) throw new Error('Esa letra ya salió');
      const guessed = (g.guessed || '') + L, n = hangCount(g.word, L), scores = g.scores.slice(), p = { guessed };
      if (n) { scores[i] += n * 10; p.scores = scores; if (hangSolved(g.word, guessed)) Object.assign(p, hangEnd(g, scores, 'resuelta')); }
      else { p.errors = (g.errors || 0) + 1; p.turn = (i + 1) % g.players.length; if (p.errors >= g.maxErrors) Object.assign(p, hangEnd(g, scores, 'ahorcado')); }
      return { patch: p };
    });
  }
  function hangWord(w) {
    let good = false;
    return play(g => {
      const i = g.players.indexOf(me()); if (g.status !== 'playing' || i !== g.turn) throw new Error('No es tu turno');
      const ok = good = letterKey(w.trim()).replace(/\s+/g, ' ') === letterKey(g.word);
      const scores = g.scores.slice(), p = {};
      if (ok) { const missing = [...new Set([...g.word].map(letterKey).filter(c => /[A-ZÑ]/.test(c) && !(g.guessed || '').includes(c)))].length; scores[i] += 30 + missing * 10; Object.assign(p, { scores, guessed: g.guessed + [...new Set([...g.word].map(letterKey))].join('') }, hangEnd(g, scores, 'adivinada')); }
      else { p.errors = (g.errors || 0) + 1; p.turn = (i + 1) % g.players.length; if (p.errors >= g.maxErrors) Object.assign(p, hangEnd(g, scores, 'ahorcado')); }
      return { patch: p };
    }).then(() => { if (!good) toast('❌ Esa no era'); });
  }
  function hangEnd(g, scores, why) {
    const top = Math.max(...scores), winners = top > 0 ? g.players.filter((s, k) => scores[k] === top) : [];
    return { status: 'done', winners, result: { why } };
  }

