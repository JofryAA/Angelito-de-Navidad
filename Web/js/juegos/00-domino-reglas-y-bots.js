// 🎮 Juegos del angelito: dominó (parejas o cada quien solo), X y O, y ahorcado.
// Todo va en Firestore: games/{id} (la mesa), games/{id}/hands/{asiento} (fichas secretas)
// y gameWins/{id}_{uid} (tabla de campeones). Los 🤖 los maneja el teléfono de quien creó la mesa.

/* ================= motor (funciones puras, se pueden probar sin pantalla) ================= */
export const ALL_TILES = (() => { const t = []; for (let a = 0; a <= 6; a++) for (let b = a; b <= 6; b++) t.push(`${a}${b}`); return t; })();
export const tv = t => [+t[0], +t[1]];
export const tpips = t => +t[0] + +t[1];
export const handPips = h => h.reduce((s, t) => s + tpips(t), 0);
export const isDouble = t => t[0] === t[1];
export const ends = chain => chain.length ? { l: +chain[0][0], r: +chain[chain.length - 1][1] } : null;
export function sidesFor(tile, chain) { // lados donde cabe: [] | ['l'] | ['r'] | ['l','r']
  const e = ends(chain); if (!e) return ['r'];
  const [a, b] = tv(tile), s = [];
  if (a === e.l || b === e.l) s.push('l');
  if (a === e.r || b === e.r) s.push('r');
  return s;
}
export function place(chain, tile, side) {
  const [a, b] = tv(tile), e = ends(chain);
  if (!e) return [`${a}${b}`];
  if (side === 'l') { const x = a === e.l ? b : a; return [`${x}${e.l}`, ...chain]; }
  const x = a === e.r ? b : a; return [...chain, `${e.r}${x}`];
}
export const playable = (hand, chain, mustOpen) => hand.filter(t => (mustOpen && !chain.length) ? t === mustOpen : sidesFor(t, chain).length > 0);
export function shuffleTiles(arr, rnd = Math.random) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Reparte una mano nueva. hands: { asiento: [fichas] }
export function dealHand(g, rnd = Math.random) {
  const n = g.players.length, deck = shuffleTiles(ALL_TILES, rnd), hands = {};
  g.players.forEach((s, i) => { hands[s] = deck.slice(i * 7, i * 7 + 7); });
  let starter = g.nextStarter ?? -1, mustOpen = null;
  if (starter < 0) { // primera mano: sale el doble más alto que esté repartido (normalmente el doble seis)
    for (let d = 6; d >= 0 && starter < 0; d--) { const t = `${d}${d}`; const i = g.players.findIndex(s => hands[s].includes(t)); if (i >= 0) { starter = i; mustOpen = t; } }
    if (starter < 0) starter = 0;
  }
  return { hands, patch: { chain: [], counts: g.players.map(() => 7), pips: g.players.map(s => handPips(hands[s])), turn: starter, starter, passes: 0, mustOpen, handOver: false, hand: (g.hand || 0) + 1, last: null } };
}
const teamOf = (g, i) => g.mode === 'parejas' ? i % 2 : i;
// Aplica una jugada (tile = null es pasar). Devuelve { patch, hand } o lanza error si no es válida.
export function applyMove(g, seat, hand, tile, side) {
  const i = g.players.indexOf(seat);
  if (g.status !== 'playing' || g.handOver) throw new Error('La mano no está en juego');
  if (i !== g.turn) throw new Error('No es tu turno');
  const n = g.players.length, chain = g.chain || [];
  const can = playable(hand, chain, g.mustOpen);
  let patch = { passes: g.passes || 0 }, newHand = hand;
  if (tile == null) {
    if (can.length) throw new Error('Tienes ficha para jugar');
    patch.passes = (g.passes || 0) + 1;
    patch.last = { seat, pass: true, root: g.last?.root || 0 };
    // Reglas dominicanas: el pase da puntos a quien jugó la última ficha (a su pareja, si juegan en parejas)
    //  · pase de salida: el que sigue no puede contestar la primera ficha de la mano → +25
    //  · pase corrido: los otros tres pasan y la mano vuelve a quien jugó → +25 (y vuelve a jugar)
    const lk = g.locker;
    if (lk != null && chain.length && n > 2) { // con 2 jugadores no hay pase corrido
      const salida = chain.length === 1 && patch.passes === 1, corrido = patch.passes === n - 1;
      if (salida || corrido) {
        const pts = (salida ? 25 : 0) + (corrido ? 25 : 0), team = teamOf(g, lk);
        patch.last.bonus = { team, pts, why: salida && corrido ? 'salida-corrido' : salida ? 'salida' : 'corrido', seat: g.players[lk] };
        const scores = (g.scores || []).slice(); scores[team] = (scores[team] || 0) + pts;
        if (scores[team] >= (g.target || 200)) return { patch: { ...patch, ...endHand(g, team, lk, pts, 'pase') }, hand: newHand };
        patch.scores = scores;
      }
    }
  } else {
    if (!hand.includes(tile)) throw new Error('No tienes esa ficha');
    if (!can.includes(tile)) throw new Error('Esa ficha no cabe');
    const sides = sidesFor(tile, chain); if (chain.length && !sides.includes(side)) side = sides[0];
    const e = ends(chain);
    const capicua = !!e && e.l !== e.r && sides.length === 2;
    patch.chain = place(chain, tile, side);
    newHand = hand.filter(t => t !== tile);
    patch.counts = g.counts.slice(); patch.counts[i] = newHand.length;
    patch.pips = g.pips.slice(); patch.pips[i] = handPips(newHand);
    patch.passes = 0; patch.mustOpen = null;
    patch.last = { seat, tile, side, root: !chain.length ? 0 : (g.last?.root || 0) + (side === 'l' ? 1 : 0) }; patch.locker = i; // quién puso la última ficha (el que 'tranca' si nadie más puede jugar)
    if (!newHand.length) { // ¡dominó!
      const total = patch.pips.reduce((a, b) => a + b, 0) + (capicua ? 25 : 0);
      return { patch: { ...patch, ...endHand(g, teamOf(g, i), i, total, capicua ? 'capicua' : 'domino') }, hand: newHand };
    }
  }
  const pips = patch.pips || g.pips;
  if (patch.passes >= n) { // tranque: gana el equipo (o jugador) con menos puntos en la mano
    const nt = g.mode === 'parejas' ? 2 : n, tp = Array(nt).fill(0);
    pips.forEach((p, k) => { tp[teamOf(g, k)] += p; });
    const min = Math.min(...tp), who = tp.map((v, k) => v === min ? k : -1).filter(k => k >= 0);
    const total = pips.reduce((a, b) => a + b, 0);
    // Empate en puntos: gana quien trancó (su pareja, o él mismo). Si él no está entre los empatados, el primero que le sigue en la mesa.
    const locker = patch.locker ?? g.locker ?? g.starter ?? 0;
    let t = who[0];
    if (who.length > 1) { const lt = teamOf(g, locker); if (who.includes(lt)) t = lt; else for (let d = 1; d <= n; d++) { const c = teamOf(g, (locker + d) % n); if (who.includes(c)) { t = c; break; } } }
    let best = -1; pips.forEach((p, k) => { if (teamOf(g, k) === t && (best < 0 || p < pips[best])) best = k; });
    if (who.length > 1 && teamOf(g, locker) === t) best = locker; // sale quien trancó
    return { patch: { ...patch, ...endHand(g, t, best, total, who.length > 1 ? 'tranque-empate' : 'tranque') }, hand: newHand };
  }
  patch.turn = (i + 1) % n;
  return { patch, hand: newHand };
}
function endHand(g, team, seatIdx, pts, why) {
  const scores = (g.scores || []).slice();
  // shown: las fichas que le quedaron a cada quien; se van llenando cuando cada teléfono las enseña
  if (team >= 0) scores[team] = (scores[team] || 0) + pts;
  const p = { handOver: true, scores, nextStarter: seatIdx, shown: {}, result: { team, seat: seatIdx, pts, why } };
  if (team >= 0 && scores[team] >= (g.target || 200)) {
    p.status = 'done';
    p.winners = g.players.filter((s, k) => teamOf(g, k) === team && !isBot(s));
  }
  return p;
}
export const isBot = s => /^bot\d$/.test(s);
// 🤖 elige: la ficha que más pesa, prefiriendo dobles; si puede, deja el extremo que más fichas tiene.
export function botChoice(hand, chain, mustOpen) {
  const can = playable(hand, chain, mustOpen); if (!can.length) return null;
  const count = v => hand.filter(t => t.includes(String(v))).length;
  let best = null, score = -1;
  for (const t of can) for (const side of (chain.length ? sidesFor(t, chain) : ['r'])) {
    const nc = place(chain, t, side), e = ends(nc), rest = hand.filter(x => x !== t);
    const keep = rest.filter(x => x.includes(String(e.l)) || x.includes(String(e.r))).length;
    const sc = tpips(t) * 2 + (isDouble(t) ? 6 : 0) + keep * 3 + count(+t[0]) * 0;
    if (sc > score) { score = sc; best = { tile: t, side }; }
  }
  return best;
}

/* Mesa en serpentín: fila, al llegar al borde baja con una ficha parada y regresa.
   Devuelve posiciones en unidades (1 unidad = medio dominó). */
// Un brazo de la culebra: avanza hacia la derecha desde x0 y, al llegar al borde, baja y vuelve.
function snakeArm(list, cols, x0) {
  const out = []; let dir = 1, x = x0, yc = 1, prevDbl = false;
  for (const { t, k } of list) {
    const dbl = isDouble(t), w = dbl ? 1 : 2;
    if ((dir > 0 && x + w > cols) || (dir < 0 && x - w < 0)) { // vuelta: ficha parada hacia abajo
      const cx = dir > 0 ? x - 1 : x, top = yc + (prevDbl ? 1 : 0.5);
      out.push({ t, k, x: cx, y: top, w: 1, h: 2, v: true, a: +t[0], b: +t[1] });
      yc = top + 1.5; prevDbl = false;
      dir = -dir; x = dir < 0 ? cx : cx + 1;
      continue;
    }
    if (dbl) out.push({ t, k, x: dir > 0 ? x : x - 1, y: yc - 1, w: 1, h: 2, v: true, a: +t[0], b: +t[1] });
    else out.push({ t, k, x: dir > 0 ? x : x - 2, y: yc - 0.5, w: 2, h: 1, v: false, a: dir > 0 ? +t[0] : +t[1], b: dir > 0 ? +t[1] : +t[0] });
    x += dir * w; prevDbl = dbl;
  }
  return out;
}
// La mesa arranca en el centro: la primera ficha (root) queda en medio y la culebra crece hacia ambos lados.
