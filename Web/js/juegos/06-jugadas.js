  /* ----- jugadas ----- */
  function playDomino(seat, tile, side) {
    const h = isBot(seat) ? (G.botHands[seat] || []) : G.hand; // la mano tal como está al decidir la jugada
    return play(g => { const r = applyMove(g, seat, h, tile, side); return { patch: r.patch, seat, hand: tile != null ? r.hand : null }; });
  }
  function maybeBot() {
    const g0 = G.cur; clearTimeout(G.botT);
    if (!live(g0) || g0.host !== me()) return;
    if (document.hidden) return; // si quien creó la mesa no la está viendo, los 🤖 esperan (no gastan nada)
    const seat0 = g0.players[g0.turn]; if (!isBot(seat0)) return;
    G.botT = setTimeout(() => {
      const g = G.cur; if (!live(g) || g.host !== me()) return; // siempre con el estado más reciente
      const seat = g.players[g.turn]; if (!isBot(seat)) return;
      if (g.type === 'domino') {
        const hand = G.botHands[seat]; if (!hand) return;
        if ((g.counts?.[g.turn] ?? hand.length) !== hand.length) return; // la mano del 🤖 aún no llegó; el reloj lo reintenta
        robotMove(g, seat, hand);
      } else robotMove(g, seat);
    }, g0.type === 'domino' ? 420 + Math.random() * 260 : 360);
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

