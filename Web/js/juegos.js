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
export function snakeLayout(chain, cols, root = 0) {
  cols = Math.max(8, cols | 0); root = Math.min(Math.max(0, root | 0), Math.max(0, chain.length - 1));
  if (!chain.length) return { tiles: [], rows: 0 };
  const rw = isDouble(chain[root]) ? 1 : 2, x0 = Math.floor((cols - rw) / 2);
  const right = snakeArm(chain.slice(root).map((t, i) => ({ t, k: root + i })), cols, x0);
  // brazo izquierdo: se calcula como espejo (fichas volteadas) y se refleja en X y en Y
  const left = snakeArm(chain.slice(0, root).reverse().map((t, i) => ({ t: t[1] + t[0], k: root - 1 - i })), cols, cols - x0)
    .map(o => ({ ...o, x: cols - o.x - o.w, y: 2 - o.y - o.h, a: o.b, b: o.a }));
  const all = [...left, ...right], minY = Math.min(...all.map(o => o.y)), maxY = Math.max(...all.map(o => o.y + o.h));
  return { tiles: all.map(o => ({ ...o, y: o.y - minY })), rows: maxY - minY };
}

/* X y O */
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export function tttWinner(b) { for (const [x, y, z] of LINES) if (b[x] !== '.' && b[x] === b[y] && b[y] === b[z]) return b[x]; return b.includes('.') ? null : 'draw'; }
export function tttWinCells(b) { for (const L of LINES) if (b[L[0]] !== '.' && b[L[0]] === b[L[1]] && b[L[1]] === b[L[2]]) return L; return []; }
export function tttBot(b, me) { // gana si puede, bloquea, centro, esquina, lo que quede
  const op = me === 'X' ? 'O' : 'X', free = [...b].map((c, i) => c === '.' ? i : -1).filter(i => i >= 0);
  const tryWin = m => free.find(i => tttWinner(b.slice(0, i) + m + b.slice(i + 1)) === m);
  let k = tryWin(me); if (k != null) return k;
  k = tryWin(op); if (k != null) return k;
  if (b[4] === '.') return 4;
  const cs = [0, 2, 6, 8].filter(i => b[i] === '.'); if (cs.length) return cs[Math.floor(Math.random() * cs.length)];
  return free[0];
}

/* Ahorcado */
// Cada palabra trae sus stickers de pista: 'PALABRA|🎯🎯'.
const W = s => s.split(',').map(x => x.trim()).filter(Boolean);
export const WORD_CATS = {
  cultura: { e: '🇩🇴', name: 'Cultura dominicana', words: W(`MERENGUE|💃🎺🇩🇴, BACHATA|🎸💃❤️, MANGÚ|🍌🥣🧅, SANCOCHO|🍲🥩🌽, TAMBORA|🥁🎶, GÜIRA|🎶🧀🥄, LARIMAR|💎🌊🔵, CARNAVAL|🎭🎉🥁, CHINCHORRO|🐟🌊🕸️, COLMADO|🏪🛒🏍️,
    MOFONGO|🍌🧄🥓, CONCÓN|🍚🔥🥄, CHICHARRÓN|🐷🔥😋, PLÁTANO|🍌🟢🇩🇴, HABICHUELAS CON DULCE|🥣🥛🍬, CASABE|🫓🌿🥥, YANIQUEQUE|🫓🏖️🔥, PICA POLLO|🍗🔥🍟, MORIR SOÑANDO|🍊🥛😴, MABÍ|🥤🌿🧊, GUAGUA|🚌👥💨, MOTOCONCHO|🏍️👤💵,
    DOMINÓ|🁫🎲👴, PELOTA|⚾🧢🏟️, PICO DUARTE|⛰️🥾🥶, LAGO ENRIQUILLO|🐊💧🧂, ZONA COLONIAL|🏰⛪🕰️, SAMANÁ|🐋🌴🏝️, PUNTA CANA|🏖️✈️🌴, DUARTE|🇩🇴👨‍🦱📜, ÁMBAR|🟠💎🦟, CACAO|🍫🌱🥣, TOSTONES|🍌🔨🧂, QUIPE|🥙🌾🥩, CHIVO GUISADO|🐐🍲🌶️,
    LOS TRES GOLPES|🍳🧀🥓, BIZCOCHO|🎂🧁🎉, DULCE DE LECHE|🥛🍬🟤, JEVI|😎👍✨, CHERCHA|😂👥🗣️, CARABINÉ|💃🕺🎶, FRÍO FRÍO|🧊🍧🌈, PASTELÓN|🍌🥩🧀, TRES LECHES|🥛🥛🥛, ARROZ CON HABICHUELA|🍚🥣🍗, PASTELES EN HOJA|🍃🍌🎄, BANDERA|🇩🇴🔵🔴, MALECÓN|🌊🛣️🌅, JARABACOA|⛰️🍓🏞️`) },
  biblia: { e: '📖', name: 'Biblia', words: W(`NOÉ|🚢🐘🌈, MOISÉS|🌊📜🔥, DAVID|👑🪨🎵, GOLIAT|🗿⚔️🪨, SANSÓN|💪💇🦁, JONÁS|🐋🙏🌊, DANIEL|🦁🙏🕳️, ABRAHAM|⭐👴👶, SARA|👵👶😂, RUT|🌾👩❤️, ESTER|👸👑🙏, DÉBORA|👩‍⚖️🌴⚔️, ELÍAS|🔥🐦🌧️, SALOMÓN|👑🧠🏛️,
    JERUSALÉN|🏙️🕍🧱, BELÉN|⭐👶🐑, NAZARET|🏘️🔨👦, EGIPTO|🐫🏜️🧱, ARCA DE NOÉ|🚢🦒🌧️, MANÁ|🍞☁️🏜️, PARÁBOLA|📖🌱💬, APÓSTOLES|👥1️⃣2️⃣, PEDRO|🎣🐓🗝️, PABLO|✉️⛵⛓️, JUAN BAUTISTA|💧🦗🍯, MARÍA|👩👶⭐, JOSÉ|🔨👨👶, PESEBRE|👶🐑🌾,
    REYES MAGOS|👑👑👑, GÉNESIS|🌍🌱1️⃣, SALMOS|🎵🙏📖, PROVERBIOS|🧠💬📖, ÉXODO|🚶🌊🏜️, DIEZ MANDAMIENTOS|🔟📜⛰️, MAR ROJO|🌊🔴🚶, TORRE DE BABEL|🗼🗣️🌍, JARDÍN DEL EDÉN|🌳🍎🐍, ZAQUEO|🌳👀💰, LÁZARO|⚰️🚶✨, BUEN SAMARITANO|🩹🐴❤️,
    HIJO PRÓDIGO|👦💸🐷, JACOB|🪜😴👬, ISAAC|👶👴🐏, GEDEÓN|🏺🔥3️⃣, SAMUEL|👦👂🌙, NEHEMÍAS|🧱🏗️🙏, APOCALIPSIS|📖🔚🎺, BAUTISMO|💧🙏🕊️`) },
  navidad: { e: '🎄', name: 'Navidad', words: W(`ANGELITO|😇🎁🤫, NAVIDAD|🎄⭐🎁, REGALO|🎁🎀😊, PASTELITO|🥟🔥😋, PUERCO ASADO|🐷🔥🎄, AGUINALDO|🎶🚪🌙, NOCHEBUENA|🌙🍽️👨‍👩‍👧, VILLANCICO|🎶🎄👶, GUIRNALDA|🎄〰️✨,
    ESTRELLA|⭐🌌👆, PESEBRE|👶🐑🌾, REYES MAGOS|👑🐫🎁, JENGIBRE|🌿🍪☕, CASCABEL|🔔🎶🦌, ARBOLITO|🎄💡🎁, PARRANDA|🎶🚶🌙, RENO|🦌🔴🛷, TRINEO|🛷❄️🎁, CAMPANAS|🔔🔔⛪, UVAS|🍇1️⃣2️⃣,
    AÑO NUEVO|🎆🕛🥳, FUEGOS ARTIFICIALES|🎆💥🌃, BOTA NAVIDEÑA|🧦🎁🔥, ESFERAS|🔴🟡🎄, TURRÓN|🍬🥜🎄, MANZANAS|🍎🍏🎄, NIEVE|❄️⛄🥶, TELERA|🥖🎄🧈, CENA|🍽️🕯️👨‍👩‍👧, LUCES|💡✨🎄`) },
  variado: { e: '🎲', name: 'De todo un poco', words: W(`ELEFANTE|🐘👃💧, BICICLETA|🚲🦵💨, COMPUTADORA|💻⌨️🖱️, MARIPOSA|🦋🌸🐛, TELÉFONO|📱☎️💬, PARAGUAS|☂️🌧️💧, GUITARRA|🎸🎶🤘, HELICÓPTERO|🚁🌀☁️, CHOCOLATE|🍫🟤😋, ARCOÍRIS|🌈🌧️☀️,
    ZAPATO|👟👞🦶, ALMOHADA|🛏️😴☁️, LÁPIZ|✏️📝📏, TORTUGA|🐢🐌🏠, DINOSAURIO|🦖🦕🥚, VOLCÁN|🌋🔥⛰️, ASTRONAUTA|👨‍🚀🚀🌕, NEVERA|🧊🥛🚪, SANDÍA|🍉🟢🔴, PIÑA|🍍👑💛, AGUACATE|🥑🟢🥗, ESPEJO|🪞👀🙂, ESCALERA|🪜⬆️⬇️, GLOBO|🎈🎉💨,
    CAMARÓN|🦐🌊🍤, PULPO|🐙8️⃣🌊, CANGREJO|🦀🏖️✂️, HORMIGA|🐜🍃💪, COCODRILO|🐊🦷💧, TELEVISOR|📺🛋️🎬, AVIÓN|✈️☁️🧳, BIBLIOTECA|📚🤫🏛️, HOSPITAL|🏥👩‍⚕️💉, PLAYA|🏖️🌊☀️, MONTAÑA|⛰️🥾🌲, CASTILLO|🏰👑🐉, RELOJ|⏰⌚🕐, SEMÁFORO|🚦🔴🟢`) },
};
const HINTS = {};
for (const c of Object.values(WORD_CATS)) c.words = c.words.map(x => { const [w, h] = x.split('|'); HINTS[w] = h || ''; return w; });
export const wordHint = w => HINTS[w] || '';
// El ahorcado siempre arranca con letras a la vista: una, o dos si la palabra es larga (nunca toda la palabra).
export function hangOpen(word, rnd = Math.random) {
  const ls = [...new Set([...letterKey(word)].filter(c => /[A-ZÑ]/.test(c)))];
  const n = Math.min(ls.length - 1, ls.length >= 7 ? 2 : 1); let out = '';
  for (let k = 0; k < n; k++) out += ls.splice(Math.floor(rnd() * ls.length), 1)[0];
  return out;
}
export const WORDS = Object.values(WORD_CATS).flatMap(c => c.words);
export function pickWord(cat) {
  const key = cat && WORD_CATS[cat] ? cat : Object.keys(WORD_CATS)[Math.floor(Math.random() * 4)];
  const ws = WORD_CATS[key].words; return { word: ws[Math.floor(Math.random() * ws.length)], cat: key };
}
// Quita tildes pero respeta la Ñ (á→A, ñ→Ñ).
export const letterKey = str => [...String(str).toUpperCase()].map(c => c === '\u00D1' ? c : c.normalize('NFD').replace(/[\u0300-\u036f]/g, '')).join('');
export function hangSolved(word, guessed) { return [...word].every(ch => !/[A-ZÑ]/.test(letterKey(ch)) || guessed.includes(letterKey(ch))); }
export function hangCount(word, L) { return [...word].filter(ch => letterKey(ch) === L).length; }

/* 4 en línea: tablero de 7 columnas × 6 filas (fila 0 arriba) */
export const C4W = 7, C4H = 6, C4EMPTY = '.'.repeat(42);
export function c4Drop(b, col, m) { for (let r = C4H - 1; r >= 0; r--) { const i = r * C4W + col; if (b[i] === '.') return { b: b.slice(0, i) + m + b.slice(i + 1), i }; } return null; }
export function c4Winner(b) {
  const at = (r, c) => (r >= 0 && r < C4H && c >= 0 && c < C4W) ? b[r * C4W + c] : '#';
  for (let r = 0; r < C4H; r++) for (let c = 0; c < C4W; c++) { const m = at(r, c); if (m === '.') continue;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) if ([1, 2, 3].every(k => at(r + dr * k, c + dc * k) === m)) return m; }
  return b.includes('.') ? null : 'draw';
}
// Las 4 casillas que formaron la línea ganadora (para resaltarlas).
export function c4WinCells(b) {
  const at = (r, c) => (r >= 0 && r < C4H && c >= 0 && c < C4W) ? b[r * C4W + c] : '#';
  for (let r = 0; r < C4H; r++) for (let c = 0; c < C4W; c++) { const m = at(r, c); if (m === '.') continue;
    for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) if ([1, 2, 3].every(k => at(r + dr * k, c + dc * k) === m)) {
      const cells = [0, 1, 2, 3].map(k => (r + dr * k) * C4W + c + dc * k);
      for (let k = 4; at(r + dr * k, c + dc * k) === m; k++) cells.push((r + dr * k) * C4W + c + dc * k); // si son 5 o más, todas
      return cells; } }
  return [];
}
export function c4Bot(b, me) {
  const op = me === 'R' ? 'Y' : 'R', cols = [3, 2, 4, 1, 5, 0, 6].filter(c => b[c] === '.');
  for (const c of cols) if (c4Winner(c4Drop(b, c, me).b) === me) return c;
  for (const c of cols) if (c4Winner(c4Drop(b, c, op).b) === op) return c;
  const safe = cols.filter(c => { const nb = c4Drop(b, c, me).b; return !cols.some(c2 => { const d = c4Drop(nb, c2, op); return d && c4Winner(d.b) === op; }); });
  return (safe.length ? safe : cols)[Math.random() < .75 ? 0 : Math.floor(Math.random() * (safe.length || cols.length))];
}

/* ================= pantalla ================= */
const GINFO = {
  domino: { e: '🎲', name: 'Dominó', pts: 3 },
  ttt: { e: '❌', name: 'X y O', pts: 1 },
  ahorcado: { e: '🔤', name: 'Ahorcado', pts: 2 },
  c4: { e: '🔴', name: '4 en línea', pts: 2 },
};
const PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const half = v => `<span class="dh">${Array.from({ length: 9 }, (_, k) => `<i class="${PIPS[v].includes(k) ? 'on' : ''}"></i>`).join('')}</span>`;
const halfS = v => `<span class="dmh">${Array.from({ length: 9 }, (_, k) => `<i class="${PIPS[v].includes(k) ? 'on' : ''}"></i>`).join('')}</span>`;
function snakeHTML(chain, width, root) {
  if (!chain.length) return '<span class="mesa-empty">La mesa está vacía · sale la primera ficha</span>';
  const S = Math.max(26, Math.min(46, Math.floor(width / 13))), cols = Math.floor(width / S);
  const { tiles, rows } = snakeLayout(chain, cols, root), off = Math.max(0, (width - cols * S) / 2);
  return `<div class="snake" style="height:${rows * S}px;--s:${S}px">${tiles.map(o => `<span class="dmt ${o.v ? 'v' : 'h'} ${o.k === 0 || o.k === chain.length - 1 ? 'end' : ''} ${o.k === LAST.k ? 'new' : ''} ${o.k === root ? 'root' : ''}" style="left:${off + o.x * S}px;top:${o.y * S}px;width:${o.w * S - 3}px;height:${o.h * S - 3}px">${halfS(o.a)}<b></b>${halfS(o.b)}</span>`).join('')}</div>`;
}
const LAST = { k: -1 };
export const tileHTML = (t, cls = '', attrs = '') => `<span class="dmn ${isDouble(t) ? 'dbl' : ''} ${cls}" ${attrs}>${half(+t[0])}<b></b>${half(+t[1])}</span>`;
const BOT_NAMES = { bot1: '🤖 Robertico', bot2: '🤖 Chispita', bot3: '🤖 Turrón' };


/* ================= 🔊 sonido: música de fondo, efectos y voz (todo generado en el teléfono, sin archivos) ================= */
export const SND = (() => {
  let ctx = null, master = null, musicBus = null, fxBus = null, seqT = 0, kind = null, step = 0, nextT = 0;
  const pref = (() => { try { return { m: 1, f: 1, ...JSON.parse(localStorage.getItem('angelito:snd') || '{}') }; } catch { return { m: 1, f: 1 }; } })();
  const save = () => { try { localStorage.setItem('angelito:snd', JSON.stringify(pref)); } catch { } };
  function ac() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => { }); return ctx; }
    const C = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext); if (!C) return null;
    ctx = new C(); master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = .085; musicBus.connect(master);
    fxBus = ctx.createGain(); fxBus.gain.value = .5; fxBus.connect(master);
    return ctx;
  }
  if (typeof document !== 'undefined') ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (ctx) ac(); }, { passive: true }));
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  function tone(bus, t, n, d, { type = 'sine', vol = .5, a = .005, slide = 0 } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(hz(n), t);
    if (slide) o.frequency.exponentialRampToValueAtTime(hz(n + slide), t + d);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + d + .02);
  }
  let noiseBuf = null;
  function noise(bus, t, d, { vol = .3, f = 6000, q = 1, type = 'highpass' } = {}) {
    if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate * .5, ctx.sampleRate); const c = noiseBuf.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1; }
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = noiseBuf; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); s.connect(fl); fl.connect(g); g.connect(bus); s.start(t); s.stop(t + d + .02);
  }
  // 🎶 Ritmos originales: dominó con sabor a merengue (tambora, güira, bajo y acordes de piano); los demás, campanitas navideñas.
  const SONGS = {
    domino: { bpm: 132, chords: [[57, 60, 64], [62, 65, 69], [64, 68, 71], [57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59], [57, 61, 64]],
      beat(t, s, sp, ch) { const k = s % 8; // 8 corcheas por compás
        noise(musicBus, t, .05, { vol: k % 2 ? .12 : .22, f: 7000 }); // güira
        if (k === 0 || k === 4) tone(musicBus, t, 38 + (ch[0] % 12), .22, { vol: .9, slide: -7 }); // tambora
        if (k === 7) noise(musicBus, t, .08, { vol: .25, f: 900, type: 'bandpass', q: 3 }); // golpe al aro
        if (k === 0 || k === 3 || k === 4 || k === 6) tone(musicBus, t, ch[k === 3 || k === 6 ? 2 : 0] - 24, sp * 1.6, { type: 'triangle', vol: .7 }); // bajo
        if (k === 1 || k === 3 || k === 5 || k === 7) ch.forEach(n => tone(musicBus, t, n + 12, sp * .8, { type: 'triangle', vol: .16 })); // piano a contratiempo
      } },
    fiesta: { bpm: 112, chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
      beat(t, s, sp, ch) { const k = s % 8;
        if (k % 2 === 0) noise(musicBus, t, .04, { vol: .1, f: 8000 });
        tone(musicBus, t, ch[[0, 1, 2, 1, 0, 2, 1, 2][k]] + 24, sp * 2.2, { vol: .22 }); // campanitas
        if (k === 0) tone(musicBus, t, ch[0] - 12, sp * 3.5, { type: 'triangle', vol: .5 });
        if (k === 4) tone(musicBus, t, ch[2] - 12, sp * 3, { type: 'triangle', vol: .4 });
      } },
  };
  function tick() {
    if (!ctx || !kind) return; const song = SONGS[kind], sp = 60 / song.bpm / 2;
    while (nextT < ctx.currentTime + .15) { const ch = song.chords[Math.floor(step / 8) % song.chords.length]; try { song.beat(nextT, step, sp, ch); } catch { } nextT += sp; step++; }
  }
  function music(k) {
    k = k && pref.m ? (SONGS[k] ? k : 'fiesta') : null;
    if (k === kind) return; kind = k; clearInterval(seqT);
    if (!k) return; if (!ac()) return;
    step = 0; nextT = ctx.currentTime + .08; seqT = setInterval(tick, 40); tick();
  }
  const FX = {
    clack: t => { noise(fxBus, t, .05, { vol: .9, f: 2500, type: 'bandpass', q: 2 }); tone(fxBus, t, 88, .04, { type: 'square', vol: .12 }); },
    pop: t => tone(fxBus, t, 72, .12, { vol: .5, slide: 7 }),
    drop: t => { tone(fxBus, t, 79, .18, { vol: .4, slide: -12 }); noise(fxBus, t + .16, .06, { vol: .4, f: 1200, type: 'bandpass' }); },
    good: t => { tone(fxBus, t, 76, .1, { vol: .4 }); tone(fxBus, t + .08, 83, .16, { vol: .4 }); },
    bad: t => { tone(fxBus, t, 50, .25, { type: 'sawtooth', vol: .15, slide: -3 }); },
    pass: t => noise(fxBus, t, .3, { vol: .35, f: 1500, type: 'bandpass', q: .7 }),
    turn: t => { tone(fxBus, t, 84, .09, { vol: .25 }); tone(fxBus, t + .1, 88, .12, { vol: .25 }); },
    win: t => { [72, 76, 79, 84, 88].forEach((n, i) => tone(fxBus, t + i * .09, n, .35, { type: 'triangle', vol: .45 })); [96, 100, 103].forEach((n, i) => tone(fxBus, t + .5 + i * .05, n, .3, { vol: .15 })); },
    lose: t => { [67, 64, 60, 55].forEach((n, i) => tone(fxBus, t + i * .16, n, .3, { type: 'triangle', vol: .35 })); },
    lock: t => { tone(fxBus, t, 40, .5, { vol: .9, slide: -5 }); noise(fxBus, t, .2, { vol: .5, f: 400, type: 'lowpass' }); },
  };
  function fx(name) { if (!pref.f || !FX[name] || !ac()) return; try { FX[name](ctx.currentTime + .01); } catch { } }
  let voice = null;
  function pickVoice() {
    const vs = (typeof speechSynthesis !== 'undefined' && speechSynthesis.getVoices()) || [];
    return vs.find(v => /es[-_](DO|US|MX|419)/i.test(v.lang)) || vs.find(v => /^es/i.test(v.lang)) || null;
  }
  if (typeof speechSynthesis !== 'undefined') try { speechSynthesis.onvoiceschanged = () => { voice = pickVoice(); }; } catch { }
  function say(text) {
    if (!pref.f || typeof speechSynthesis === 'undefined' || !text) return;
    try {
      voice ||= pickVoice(); const u = new SpeechSynthesisUtterance(text); u.lang = voice?.lang || 'es-US'; if (voice) u.voice = voice; u.rate = 1.05; u.pitch = 1.05; u.volume = 1;
      if (musicBus && ctx) { musicBus.gain.setTargetAtTime(.03, ctx.currentTime, .05); u.onend = () => musicBus.gain.setTargetAtTime(.085, ctx.currentTime, .2); }
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch { }
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) { const k = kind; music(null); SND._resume = k; } else if (SND._resume) { const k = SND._resume; SND._resume = null; music(k); } });
  const SND = { music, fx, say, pref, set(k, v) { pref[k] = v ? 1 : 0; save(); if (k === 'm' && !v) music(null); }, get playing() { return kind; } };
  return SND;
})();

export function initGames(X) {
  const { db, fs, S, esc, toast, $, openModal, closeModal, confirmBox, render, confetti } = X;
  const { collection, query, orderBy, limit, getDoc, where } = fs, fsDoc = fs.doc, fsSnap = fs.onSnapshot, fsSet = fs.setDoc, fsBatch = fs.writeBatch, fsTx = fs.runTransaction;
  /* ----- 📴 partidas en este teléfono (contra 🤖 o sin internet): ids que empiezan con L, se guardan aunque cierres la app ----- */
  const isLoc = id => typeof id === 'string' && id[0] === 'L';
  let LSk = null, LS = {};
  const ls = () => { const k = 'angelito:lg:' + (S.uid || 'x'); if (LSk !== k) { LSk = k; try { LS = JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch { LS = {}; } } return LS; };
  const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
  const lsnap = path => { const v = ls()[path]; return { id: path.split('/').pop(), exists: () => v != null, data: () => clone(v), metadata: {} }; };
  const lsubs = new Map(), lListSubs = new Set();
  function lput(path, v) {
    const o = ls(); if (v == null) delete o[path]; else o[path] = clone(v);
    try { localStorage.setItem(LSk, JSON.stringify(o)); } catch { }
    setTimeout(() => { (lsubs.get(path) || []).forEach(f => f(lsnap(path))); lListSubs.forEach(f => f()); }, 0);
  }
  const lmerge = (path, v) => lput(path, { ...(ls()[path] || {}), ...v });
  /* ----- 🎮 partidas en línea: Realtime Database (no gasta la cuota de lecturas de Firestore) -----
     Las fichas y las reacciones van en ramas aparte (hands/, emotes/) para que leer la lista de mesas nunca baje fichas ajenas. */
  const gErr = e => e?.code === 'network' ? e.message : X.authErr(e);
  const RT = X.rt, rr = path => RT.ref(RT.db, path), ROOT = () => RT.ref(RT.db);
  const rPath = p => p[0] === 'games' && p[2] === 'hands' ? `hands/${p[1]}/${p[3]}` : p[0] === 'games' && p[2] === 'emotes' ? `emotes/${p[1]}/${p[3]}` : p[0] === 'gameWins' ? `wins/${p[1]}` : p.join('/');
  const rsnap = (path, s) => ({ id: path.split('/').pop(), exists: () => s.exists(), data: () => s.val() });
  const flat = (path, v) => Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [path + '/' + k, x]));
  const rErr = e => { if (e?.code === 'network' || e?.code === 'permission-denied') return e; const m = String(e?.code || e?.message || ''); if (/permission/i.test(m)) { const x = new Error('permission-denied'); x.code = 'permission-denied'; return x; } if (/network|disconnect|offline/i.test(m)) return offErr(); return e; };
  let RTon = null, RTseen = false; // null = todavía no se sabe (al abrir); false = se cayó la conexión
  try { RT.onValue(rr('.info/connected'), s => { if (s.val()) { RTseen = true; RTon = true; } else RTon = RTseen ? false : null; }); } catch { }
  const offErr = () => Object.assign(new Error('📡 Sin conexión: la jugada no se envió. Revisa tu internet.'), { code: 'network' });
  const rUpdate = U => RTon === false ? Promise.reject(offErr()) : Promise.race([RT.update(ROOT(), U), new Promise((_, no) => setTimeout(() => no(offErr()), 9000))]).catch(e => { throw rErr(e); });
  const doc = (d, ...p) => (p[0] === 'games' && isLoc(p[1])) ? { __l: 1, path: p.join('/'), id: p[p.length - 1] } : { __r: 1, path: rPath(p), id: p[p.length - 1] };
  const onSnapshot = (ref, ...a) => {
    if (ref?.__r) { const [cb, err] = a.filter(x => typeof x === 'function'); return RT.onValue(rr(ref.path), s => cb(rsnap(ref.path, s)), e => err?.(rErr(e))); }
    if (!ref?.__l) return fsSnap(ref, ...a);
    const cb = a.find(x => typeof x === 'function'), set = lsubs.get(ref.path) || new Set(); lsubs.set(ref.path, set); set.add(cb);
    setTimeout(() => { if (set.has(cb)) cb(lsnap(ref.path)); }, 0); return () => set.delete(cb);
  };
  const setDoc = (ref, d, o) => ref?.__l ? (o?.merge ? lmerge(ref.path, d) : lput(ref.path, d), Promise.resolve()) : ref?.__r ? rUpdate(o?.merge ? flat(ref.path, d) : { [ref.path]: d }) : fsSet(ref, d, o);
  // Varias escrituras juntas: en Realtime Database van en UNA sola actualización (todo o nada)
  function writeBatch() {
    const L = [], U = {};
    const b = { set: (r, v, o) => { if (r.__l) L.push(() => o?.merge ? lmerge(r.path, v) : lput(r.path, v)); else if (o?.merge) Object.assign(U, flat(r.path, v)); else U[r.path] = v; return b; },
      update: (r, v) => { if (r.__l) L.push(() => lmerge(r.path, v)); else Object.assign(U, flat(r.path, v)); return b; },
      delete: r => { if (r.__l) L.push(() => lput(r.path, null)); else U[r.path] = null; return b; },
      commit: async () => { L.forEach(f => f()); if (Object.keys(U).length) await rUpdate(U); } };
    return b;
  }
  // «Transacción»: lee la mesa, calcula la jugada y la sube junto con las fichas. Las reglas exigen seq = seq + 1,
  // así que si otro jugó al mismo tiempo la escritura se rechaza y se vuelve a intentar con la mesa nueva.
  async function rTx(gid, fn) {
    for (let k = 0; ; k++) {
      const s = await RT.get(rr('games/' + gid)).catch(e => { throw rErr(e); }); if (!s.exists()) throw new Error('La mesa ya no existe');
      const U = {}, t = { get: async r => rsnap(r.path, await RT.get(rr(r.path))), update: (r, v) => { Object.assign(U, flat(r.path, v)); return t; }, set: (r, v) => { U[r.path] = v; return t; } };
      await fn(t, { id: gid, ...sane(s.val()) });
      if (!Object.keys(U).length) return;
      try { await rUpdate(U); return; } catch (e) { if (k >= 2 || e?.code !== 'permission-denied') throw e; await sleep(120 + Math.random() * 200); }
    }
  }
  const localGames = () => Object.entries(ls()).filter(([k]) => /^games\/L[^/]*$/.test(k)).map(([k, v]) => ({ id: k.slice(6), ...sane(v) }));
  const deleteDoc = ref => { const b = writeBatch(db); b.delete(ref); return b.commit(); };
  const G = { list: [], wins: [], cur: null, hand: [], botHands: {}, sub: null, subHand: null, subBots: {}, subList: null, subWins: null, botT: null, credited: new Set(), busy: false, seenTurn: '', srv: null, srvHand: [], srvBots: {}, pend: 0 };
  const seatName = s => BOT_NAMES[s] || (isBot(s) ? '🤖' : (X.P(s) ? X.shortName(X.P(s)) : 'Alguien'));
  const seatEmoji = s => isBot(s) ? '🤖' : X.pEmoji(s);
  const me = () => S.uid;
  // Todo lo que llega de la base se normaliza antes de pintarlo: números como números y fichas válidas (nada de HTML colado).
  const TILE = /^[0-6][0-6]$/;
  const tilesOk = a => Array.isArray(a) ? a.filter(t => typeof t === 'string' && TILE.test(t)) : [];
  function sane(d) {
    const n = v => Number.isFinite(+v) ? +v : 0, nums = a => Array.isArray(a) ? a.map(n) : undefined, str = v => typeof v === 'string' ? v : '';
    const R = d.result && typeof d.result === 'object' ? { ...d.result, pts: n(d.result.pts), team: n(d.result.team), why: str(d.result.why) } : null;
    const o = { ...d, max: n(d.max) || 6, turn: n(d.turn), hand: n(d.hand), seq: n(d.seq), errors: n(d.errors), round: n(d.round), idle: n(d.idle), updatedAt: n(d.updatedAt),
      players: Array.isArray(d.players) ? d.players.map(String) : [], winners: Array.isArray(d.winners) ? d.winners.map(String) : [],
      chain: tilesOk(d.chain), mustOpen: typeof d.mustOpen === 'string' && TILE.test(d.mustOpen) ? d.mustOpen : null,
      word: str(d.word), guessed: str(d.guessed), title: str(d.title), host: str(d.host), type: str(d.type), status: str(d.status), result: R };
    for (const k of ['target', 'maxErrors', 'lastCell', 'passes', 'locker']) if (k in d) o[k] = n(d[k]);
    for (const k of ['scores', 'counts', 'pips']) if (k in d) o[k] = nums(d[k]) || [];
    for (const k of ['board', 'mode', 'cat', 'hint']) if (k in d && typeof d[k] !== 'string') delete o[k];
    return o;
  }

  const qOut = () => !!window.__quota?.out();
  function ensure() {
    if (!S.me) return; clearTimeout(G.offT2);
    if (!G.subList) { const mix = () => { G.list = [...localGames(), ...(G.remote || [])].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); }; if (!G.lHook) { G.lHook = () => { mix(); render(); }; lListSubs.add(G.lHook); } mix(); G.subList = RT.onValue(RT.query(rr('games'), RT.orderByChild('updatedAt'), RT.limitToLast(25)), s => { const v = s.val() || {}; G.remote = Object.keys(v).map(id => ({ id, ...sane(v[id] || {}) })); mix(); creditWins(); cleanupStale(); render(); }, e => { console.warn('games', e); G.subList = null; }); }
    if (!G.subWins) {
      // campeones: todos en Realtime Database (los de antes los copió el servidor una sola vez)
      G.subWins = RT.onValue(rr('wins'), s => { const v = s.val() || {}; G.wins = Object.keys(v).map(id => ({ id, ...v[id] })); render(); }, e => { console.warn('wins', e); G.subWins = null; });
    }
  }
  // Borra una mesa con las fichas de cada asiento
  function dropGame(g) { if (isLoc(g.id)) { const b = writeBatch(db); (g.players || []).forEach(s => b.delete(doc(db, 'games', g.id, 'hands', s))); b.delete(doc(db, 'games', g.id)); return b.commit(); } return rUpdate({ ['games/' + g.id]: null, ['hands/' + g.id]: null, ['emotes/' + g.id]: null }); }
  function stop() {
    SND.music(null); closeGame(); [G.subList, G.subWins].forEach(u => u && u());
    Object.assign(G, { subList: null, subWins: null, list: [], wins: [], seenTurn: '' }); G.credited.clear();
  }
  // Mesas sin movimiento: se cierran solas para no dejar partidas "colgadas" gastando recursos.
  // En espera o jugando: 45 min sin jugadas. Terminadas: 2 horas (da tiempo a que los ganadores sumen sus puntos).
  const STALE_LOBBY = 60 * 60e3, STALE_LIVE = 12 * 3600e3, STALE_DONE = 2 * 3600e3; // una partida a medias se guarda 12 horas: puedes salir y volver
  const isStale = g => Date.now() - (g.updatedAt || 0) > (g.status === 'done' ? STALE_DONE : g.status === 'lobby' ? STALE_LOBBY : STALE_LIVE);
  let cleaning = false;
  async function cleanupStale() {
    if (cleaning) return; const old = G.list.filter(isStale).slice(0, 5); if (!old.length) return;
    cleaning = true;
    try {
      for (const g of old) await dropGame(g).catch(() => { });
    } finally { cleaning = false; }
  }
  // Cada ganador anota su propia victoria (las reglas verifican que la mesa terminó y que está en winners).
  function creditWins() {
    for (const g of G.list) {
      if (g.status !== 'done' || isLoc(g.id) || !(g.winners || []).includes(me())) continue;
      const id = g.round ? `${g.id}_${g.round}_${me()}` : `${g.id}_${me()}`; if (G.credited.has(id) || G.wins.some(w => w.id === id)) continue; // cada revancha cuenta aparte
      G.credited.add(id);
      setDoc(doc(db, 'gameWins', id), { uid: me(), gid: g.id, type: g.type, at: Date.now() }).catch(e => { console.warn('credit', e); if (e?.code !== 'permission-denied') G.credited.delete(id); });
    }
  }

  function open(id) {
    if (G.cur?.id === id && G.sub) return;
    closeGame();
    G.cur = { id, loading: true };
    G.sub = onSnapshot(doc(db, 'games', id), s => {
      if (!s.exists()) { G.srv = null; G.cur = { id, gone: true }; render(); return; }
      const srv = { id, ...sane(s.data()) }; G.srv = srv;
      if (srv.seq < (G.okSeq || 0) || (G.pend > 0 && G.cur && !G.cur.loading && (G.cur.seq || 0) > srv.seq)) return; // llegó tarde, o hay una jugada mía en camino: no retroceder la pantalla
      const prev = G.cur; G.cur = srv;
      onGameChange(prev); render();
    }, () => { G.cur = { id, gone: true }; render(); });
    if (!isLoc(id)) G.subEmo = RT.onValue(rr('emotes/' + id), s => s.forEach(c => { showEmote(c.key, c.val()); }), () => { });
  }
  /* ----- 😂 reacciones y frases rápidas en la mesa (como en el parchís) ----- */
  const EMOTES = ['😂', '😎', '🔥', '👏', '😱', '🙏', '😤', '🎉', '¡Buena jugada!', '¡Apúrate!', '¡Te tengo!', '¡Qué suerte!', 'Juega ya 🙄', '¡Esa no me la esperaba!', '¡Somos los mejores!', '¡Otra partida!'];
  function showEmote(seat, d) {
    const k = +d?.k, ts = +d?.ts || 0; if (!(k >= 0 && k < EMOTES.length) || Date.now() - ts > 9000) return;
    const key = seat + ts; G.emoSeen ||= new Set(); if (G.emoSeen.has(key)) return; G.emoSeen.add(key);
    const root = document.getElementById('g-root'); if (!root) return;
    let box = document.getElementById('g-emos'); if (!box) { box = document.createElement('div'); box.id = 'g-emos'; document.body.appendChild(box); }
    const txt = EMOTES[k], big = k < 8, el = document.createElement('div');
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
  const emoChip = g => g?.players?.includes(me()) && (g.status === 'playing' || g.status === 'done') ? '<button type="button" class="emo-chip" data-gact="emo" aria-label="Reaccionar">😄</button>' : '';
  function emotePicker() {
    const s2 = openModal(`<h3>😄 Reaccionar</h3><div class="emo-grid">${EMOTES.slice(0, 8).map((e, k) => `<button type="button" data-emo="${k}">${e}</button>`).join('')}</div>
      <div class="emo-phr">${EMOTES.slice(8).map((e, k) => `<button type="button" data-emo="${k + 8}">${esc(e)}</button>`).join('')}</div>`);
    s2.onclick = e => { const b = e.target.closest('[data-emo]'); if (!b) return; closeModal(); sendEmote(+b.dataset.emo); };
  }
  function closeGame() {
    G.subEmo?.(); G.subEmo = null;
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

  /* ----- pintar ----- */
  function board() { // tabla de campeones
    const by = {};
    for (const w of G.wins) { if (!X.P(w.uid)) continue; const o = by[w.uid] ||= { pts: 0, domino: 0, ttt: 0, ahorcado: 0, c4: 0 }; o.pts += GINFO[w.type]?.pts || 1; o[w.type] = (o[w.type] || 0) + 1; }
    return Object.entries(by).sort((a, b) => b[1].pts - a[1].pts);
  }
  function renderLobbyList() {
    const ranks = board(), medal = ['🥇', '🥈', '🥉'];
    const fresh = g => !isStale(g);
    const open = G.list.filter(g => g.status === 'lobby' && fresh(g));
    const live = G.list.filter(g => g.status === 'playing' && fresh(g));
    const mineIds = new Set(G.list.filter(g => g.players?.includes(me())).map(g => g.id));
    const row = g => { const full = g.players.length >= g.max, inIt = g.players.includes(me());
      if (!inIt && full && g.max <= 2) return `<div class="card gm" style="opacity:.6"><div class="gm-e">${GINFO[g.type]?.e || '🎮'}</div><div class="grow"><b>${esc(g.title || GINFO[g.type]?.name)}</b><div class="muted small">${g.players.map(s => esc(seatName(s))).join(' vs ')}</div></div><span class="muted small">🔒 Llena</span></div>`;
      return `<a class="card gm clk" href="#juego-${esc(g.id)}"><div class="gm-e">${GINFO[g.type]?.e || '🎮'}</div><div class="grow"><b>${esc(g.title || GINFO[g.type]?.name)}</b>
        <div class="muted small">${g.players.map(s => esc(seatEmoji(s))).join(' ')} · ${g.players.length}/${g.max} ${g.status === 'lobby' ? (full ? '· llena' : '· esperando') : '· jugando'}</div></div>
        <span class="btn sm ${inIt ? '' : 'gold'}">${inIt ? (g.status === 'playing' ? 'Seguir' : 'Ver') : g.status === 'lobby' && !full ? 'Unirme' : 'Mirar'}</span></a>`; };
    const nOpen = t => open.filter(g => g.type === t).length;
    const card = (t, cls, art, name, sub, tag) => `<button class="gc2 ${cls}" data-gpick="${t}"><span class="gc2-art">${art}</span><span class="gc2-tx"><b>${name}</b><span>${sub}</span></span><span class="gc2-ft"><span class="gc2-tag">${tag}</span>${nOpen(t) ? `<span class="gc2-live">${nOpen(t)} esperando</span>` : ''}<span class="gc2-go">Jugar ▸</span></span></button>`;
    return `<div class="ghero"><div class="ghero-t"><small>Sala de juegos</small><b>¿Quién se atreve?</b><span>Gana partidas, suma puntos y llega a la cima de la tabla 🏆</span></div><div class="ghero-art">${tileHTML('66', 'hero1')}${tileHTML('65', 'hero2')}</div></div>
      <div class="gcreate2">
        ${card('domino', 'g-dom', tileHTML('63'), 'Dominó', 'En parejas o cada quien', '+3 pts')}
        ${card('ahorcado', 'g-hang', '<span class="gc2-letters"><i>A</i><i>_</i><i>O</i></span>', 'Ahorcado', 'Cultura, Biblia y más', '+2 pts')}
        ${card('c4', 'g-c4', '<span class="gc2-c4">' + 'RYRY.RY.'.split('').map(c => `<i class="${c}"></i>`).join('') + '</span>', '4 en línea', '1 contra 1', '+2 pts')}
        ${card('ttt', 'g-ttt', '<span class="gc2-ttt"><i>✕</i><i>○</i><i></i><i></i><i>✕</i><i>○</i><i></i><i></i><i>✕</i></span>', 'X y O', '1 contra 1', '+1 pt')}
      </div>
      <p class="gtip">🤖 ¿No llegan todos? Completa la mesa con robots.</p>
      ${live.filter(g => mineIds.has(g.id)).length ? `<div class="h2row"><h2>Tus partidas</h2></div><div class="stack">${live.filter(g => mineIds.has(g.id)).map(row).join('')}</div>` : ''}
      <div class="h2row"><h2>Mesas abiertas</h2></div>
      <div class="stack">${open.map(row).join('') || '<div class="card empty"><span class="e">🎲</span>No hay mesas abiertas. ¡Crea una y que se unan!</div>'}</div>
      ${live.filter(g => !mineIds.has(g.id)).length ? `<div class="h2row"><h2>Jugando ahora</h2></div><div class="stack">${live.filter(g => !mineIds.has(g.id)).map(row).join('')}</div>` : ''}
      <div class="h2row"><h2>🏆 Tabla de campeones</h2></div>
      ${ranks.length >= 2 ? `<div class="podium">${[1, 0, 2].filter(k => ranks[k]).map(k => `<div class="pd pd${k + 1}"><span class="pd-a">${esc(X.pEmoji(ranks[k][0]))}</span><b>${esc(X.P(ranks[k][0]) ? X.shortName(X.P(ranks[k][0])) : X.pName(ranks[k][0]))}</b><span class="pd-p">${ranks[k][1].pts} pts</span><span class="pd-b">${medal[k]}</span></div>`).join('')}</div>` : ''}
      <div class="card">${ranks.length ? ranks.slice(0, 15).map(([uid, o], k) => `<div class="rk ${uid === me() ? 'me' : ''}"><span class="rk-n">${medal[k] || k + 1}</span><span class="rk-a">${esc(X.pEmoji(uid))}</span><span class="grow"><b>${esc(X.pName(uid))}</b><div class="muted small">${o.domino ? `🎲 ${o.domino} ` : ''}${o.ahorcado ? `🔤 ${o.ahorcado} ` : ''}${o.ttt ? `❌ ${o.ttt} ` : ''}${o.c4 ? `🔴 ${o.c4}` : ''}</div></span><b class="rk-p">${o.pts}</b></div>`).join('')
        : '<p class="muted small center">Todavía nadie ha ganado. Dominó vale 3 puntos, ahorcado y 4 en línea 2, y X y O 1.</p>'}</div>`;
  }
  function seatsHTML(g) {
    const n = g.players.length;
    const pz = g.type === 'domino' && g.mode === 'parejas';
    const free = g.status === 'lobby' ? Math.max(0, (g.max || 0) - n) : 0;
    const freeH = Array.from({ length: Math.min(free, 4) }, (_, k) => { const i = n + k; return `<button class="seat free ${pz ? 't' + (i % 2 ? 'b' : 'a') : ''}" ${g.players.includes(me()) ? 'data-gact="seat"' : 'disabled'}>
      <span class="se">＋</span><span class="sn">${n + free > 2 ? 'Libre' : 'Asiento libre'}</span><span class="sc">${g.players.includes(me()) ? 'Invitar' : 'Esperando…'}</span>${pz ? `<span class="team t${i % 2}">${i % 2 ? 'B' : 'A'}</span>` : ''}</button>`; }).join('');
    return `<div class="seats ${n + free > 2 ? 'four' : 'two'}">${g.players.map((s, i) => `<div class="seat ${pz ? (i % 2 ? 'tb' : 'ta') : ''} ${g.status === 'playing' && !g.handOver && g.turn === i ? 'turn' : ''} ${s === me() ? 'me' : ''}" style="--d:${i * 60}ms">
      <span class="se">${esc(seatEmoji(s))}</span><span class="sn">${esc(s === me() ? 'Tú' : seatName(s).replace('🤖 ', ''))}</span>${live(g) && g.turn === i ? clockBar() : ''}
      ${g.type === 'domino' && g.status !== 'lobby' ? `<span class="sc">${(c => c + (c === 1 ? ' ficha' : ' fichas'))(g.counts?.[i] ?? 7)}</span>` : ''}
      ${g.type === 'domino' && g.mode === 'parejas' ? `<span class="team t${i % 2}">${i % 2 ? 'B' : 'A'}</span>` : ''}
      ${g.type === 'ahorcado' && g.scores ? `<span class="sc">${g.scores[i] || 0} pts</span>` : ''}
      ${g.type === 'ttt' ? `<span class="sc">${i === 0 ? '❌' : '⭕'}</span>` : ''}${g.type === 'c4' ? `<span class="sc">${i === 0 ? '🔴' : '🟡'}</span>` : ''}
      ${g.status === 'lobby' && g.host === me() && s !== me() ? `<button class="x" data-gkick="${esc(s)}" aria-label="Quitar">✕</button>` : ''}</div>`).join('')}${freeH}</div>`;
  }
  // Elegir lado: ❌/⭕, 🔴/🟡 o Pareja A/B (nada queda por defecto sin que lo puedas cambiar)
  function sideHTML(g) {
    const i = g.players.indexOf(me()), pz = g.type === 'domino' && g.mode === 'parejas';
    const opts = g.type === 'ttt' ? [['❌', 'Ser X'], ['⭕', 'Ser O']] : g.type === 'c4' ? [['🔴', 'Rojas'], ['🟡', 'Amarillas']] : pz ? [['A', 'Pareja A'], ['B', 'Pareja B']] : null;
    if (!opts) return '';
    const cur = pz ? i % 2 : i;
    return `<div class="lb-pick"><span>${pz ? 'Tu pareja' : 'Tus fichas'}</span>${opts.map(([e, l], k) => `<button class="lbp ${cur === k ? 'on' : ''} ${pz ? 't' + 'ab'[k] : ''}" data-gact="side" data-k="${k}"><b>${e}</b>${l}</button>`).join('')}</div>`;
  }
  function lobbyHTML(g) {
    const inIt = g.players.includes(me()), host = g.host === me(), full = g.players.length >= g.max;
    const need = g.type === 'domino' && g.mode === 'parejas' ? 'Faltan asientos: se llenan con 🤖 al empezar.' : (g.type === 'ttt' || g.type === 'c4') && g.players.length < 2 ? 'Si nadie se une, juegas contra 🤖.' : '';
    const GI = { domino: '🎲', ahorcado: '🔤', ttt: '❌', c4: '🔴' }[g.type] || '🎮';
    const msg = host ? (need || '¡Todo listo para empezar!') : inIt ? 'Esperando a que quien creó la mesa empiece' : full ? 'La mesa está llena.' : '¿Te unes a la mesa?';
    return `<div class="lobby2">
        <div class="lb-hd"><span class="lb-ic">${GI}</span><div class="grow"><b>Sala de espera</b><span class="lb-st">${g.players.length} de ${g.max} jugadores${!host && inIt ? '<i class="dots"><i></i><i></i><i></i></i>' : ''}</span></div></div>
        ${seatsHTML(g)}
        ${g.type === 'domino' ? `${g.mode === 'parejas' ? '<p class="lb-note">🤝 Pareja A: asientos 1 y 3 · Pareja B: asientos 2 y 4</p>' : ''}
          <details class="lb-rules"><summary>📖 Reglas dominicanas</summary><ul>
            <li>Primera mano: sale quien tenga el <b>doble 6</b>. Después sale quien ganó la mano anterior.</li>
            <li>Gana la mano quien se queda sin fichas: ${g.mode === 'parejas' ? 'su pareja se anota' : 'se anota'} <b>todos los puntos</b> que quedan en las manos.</li>
            <li><b>Capicúa</b> (la última ficha cabe por los dos lados): <b>+25</b>.</li>
            <li><b>Pase de salida</b> (el siguiente no puede contestar la primera ficha): <b>+25</b> para quien salió.</li>
            <li><b>Pase corrido</b> (todos los demás pasan y la mano vuelve a quien jugó): <b>+25</b> y vuelve a jugar.</li>
            <li><b>Tranque</b>: se enseñan las fichas y gana ${g.mode === 'parejas' ? 'la pareja' : 'quien tenga'} con menos puntos; si empatan, gana quien trancó.</li>
            <li>Gana la partida ${g.mode === 'parejas' ? 'la primera pareja' : 'el primero'} que llegue a <b>${g.target || 200}</b>.</li></ul></details>` : ''}
        ${inIt ? sideHTML(g) : ''}
        <p class="lb-msg">${msg}</p>
        <div class="lb-act">
          ${!inIt && !full ? '<button class="btn gold lb-main" data-gact="join">🙋 Unirme a la mesa</button>' : ''}
          ${host ? '<button class="btn gold lb-main" data-gact="start">▶ Empezar partida</button>' : ''}
          <div class="lb-row">
            ${host && g.type === 'domino' && g.mode === 'parejas' && g.players.length >= 3 ? '<button class="btn" data-gact="swap">🔀 Cambiar parejas</button>' : ''}
            <button class="btn" data-gact="share">📲 Invitar</button>
            ${inIt && !host ? '<button class="btn ghost" data-gact="leave">Salir de la mesa</button>' : ''}
          </div>
        </div></div>`;
  }
  function dominoHTML(g) {
    const mySeat = g.players.indexOf(me()), myTurn = g.status === 'playing' && !g.handOver && g.turn === mySeat;
    const chain = g.chain || [], can = mySeat >= 0 ? playable(G.hand, chain, g.mustOpen) : [];
    const tm = t => g.players.filter((_, i) => i % 2 === t).map(x => esc(seatEmoji(x))).join('');
    const pc = t => Math.min(100, (g.scores?.[t] || 0) / (g.target || 200) * 100);
    const sc = g.mode === 'parejas' ? `<div class="sb2"><div class="sb-t ta ${teamOfSeat(g, me()) === 0 ? 'mine' : ''}" style="--p:${pc(0)}%"><span class="sb-l">Pareja A <i>${tm(0)}</i></span><b>${g.scores?.[0] || 0}</b><span class="sb-bar"><i></i></span></div><div class="sb-goal"><span>🏆</span><b>${g.target}</b><small>meta</small></div><div class="sb-t tb ${teamOfSeat(g, me()) === 1 ? 'mine' : ''}" style="--p:${pc(1)}%"><span class="sb-l">Pareja B <i>${tm(1)}</i></span><b>${g.scores?.[1] || 0}</b><span class="sb-bar"><i></i></span></div></div>`
      : `<div class="score2 solo">${g.players.map((s, i) => `<div class="${s === me() ? 'mine' : ''}"><span>${esc(s === me() ? 'Tú' : seatName(s))}</span><b>${g.scores?.[i] || 0}</b></div>`).join('')}<span class="muted small">a ${g.target}</span></div>`;
    const last = g.last ? (g.last.timeout ? `⏰ A ${esc(seatName(g.last.seat))} se le acabó el tiempo` : g.last.pass ? `${esc(seatName(g.last.seat))} pasó` : `${esc(g.last.seat === me() ? 'Jugaste' : seatName(g.last.seat) + ' jugó')}`) : g.mustOpen && !chain.length ? `Sale ${esc(seatName(g.players[g.turn]))} con el doble ${g.mustOpen[0]}` : '';
    const B = g.last?.bonus, bonusTxt = B ? ` · 🎉 ¡${{ salida: 'Pase de salida', corrido: 'Pase corrido', 'salida-corrido': 'Pase de salida y corrido' }[B.why] || 'Pase'}! +${B.pts} ${g.mode === 'parejas' ? 'Pareja ' + (B.team ? 'B' : 'A') : esc(B.seat === me() ? 'para ti' : 'para ' + seatName(B.seat))}` : '';
    const R = g.result, why = { pase: '¡Pase! Llegó a la meta', domino: '¡Dominó!', capicua: '¡Capicúa! (+25)', tranque: '¡Tranque! Gana quien tiene menos puntos en fichas', 'tranque-empate': '¡Tranque con empate! Gana quien trancó', empate: 'Tranque empatado' };
    const winnerTxt = R ? (R.team < 0 ? why.empate : `${g.mode === 'parejas' ? 'Pareja ' + (R.team ? 'B' : 'A') : esc(seatName(g.players[R.team]))} gana ${R.pts} puntos · ${why[R.why]}`) : '';
    return `${sc}${seatsHTML(g)}
      <div class="mesa ${g.handOver ? 'ended' : ''}" id="g-mesa">${(LAST.k = g.last?.tile ? (g.last.side === 'l' ? 0 : chain.length - 1) : -1, snakeHTML(chain, mesaWidth(), g.last?.root || 0))}${g.handOver ? handsOnTable(g) + plaqueHTML(g, R, winnerTxt, mySeat) : ''}</div>
      <p class="glog ${B ? 'bonus' : ''}">${last}${bonusTxt}${g.status !== 'playing' || mySeat < 0 ? emoChip(g) : ''}</p>
      ${g.status === 'done' ? againHTML(g, '🔁 Otra partida') : ''}
      ${mySeat >= 0 && g.status === 'playing' && !g.handOver ? `<div class="myhand ${myTurn ? 'turn' : ''}"><div class="mh-h"><b>${myTurn ? '<span class="mh-go">👉</span> ¡Te toca!' : `<span class="mh-av">${esc(seatEmoji(g.players[g.turn]))}</span> Turno de ${esc(seatName(g.players[g.turn]).replace('🤖 ', ''))}`}</b>${myTurn && !can.length && !g.handOver && G.hand.length ? '<span class="autopass">🙅 No llevas · pasando…</span>' : ''}${emoChip(g)}</div>${myTurn && !g.handOver ? `<div class="tline">${clockBar()}</div>` : ''}
        <div class="hand">${G.hand.map(t => tileHTML(t, `big ${myTurn && can.includes(t) ? 'ok' : 'no'}`, `data-tile="${esc(t)}"`)).join('')}</div></div>` : ''}`;
  }
  // 🏁 El resultado va EN la mesa (como en la vida real: se viran las fichas y se cuenta ahí mismo), sin paneles aparte
  function plaqueHTML(g, R, winnerTxt, mySeat) {
    const tr = /tranque/.test(R?.why || ''), ic = R?.team < 0 ? '🤝' : tr ? '🔒' : R?.why === 'capicua' ? '🎯' : '🁫';
    const head = R?.team < 0 ? 'Tranque empatado' : tr ? '¡Tranque!' : R?.why === 'capicua' ? '¡Capicúa!' : R?.why === 'pase' ? '¡Pase!' : '¡Dominó!';
    let cmp = '';
    if (tr) {
      if (g.mode === 'parejas') { const tp = [0, 0]; (g.pips || []).forEach((p, k) => tp[teamOf(g, k)] += p); cmp = `<div class="pq-cmp"><span class="${R.team === 0 ? 'w' : ''}">A <b>${tp[0]}</b></span><i>vs</i><span class="${R.team === 1 ? 'w' : ''}">B <b>${tp[1]}</b></span></div>`; }
      else cmp = `<div class="pq-cmp">${g.players.map((s, k) => `<span class="${teamOf(g, k) === R.team ? 'w' : ''}">${esc(s === me() ? 'Tú' : seatName(s).replace('🤖 ', ''))} <b>${(g.pips || [])[k] || 0}</b></span>`).join('<i>·</i>')}</div>`;
    }
    const who = R && R.team >= 0 ? (g.mode === 'parejas' ? 'Pareja ' + (R.team ? 'B' : 'A') : (g.players[R.team] === me() ? 'Tú' : seatName(g.players[R.team]))) : '';
    const done = g.status === 'done';
    return `<div class="pq ${tr ? 'lock' : ''} ${done ? 'fin' : ''}"><div class="pq-ic">${done ? '🏆' : ic}</div><b class="pq-h">${tr && !done && R?.team >= 0 ? '' : ''}${done ? ((g.winners || []).length ? '¡Ganan ' + g.winners.map(s => esc(s === me() ? 'tú' : seatName(s))).join(' y ') + '!' : '¡Ganaron los 🤖!') : head}</b>
      ${tr && !done ? '<small class="pq-rule">gana el que tiene menos</small>' : ''}${who ? `<span class="pq-pts">${esc(who)} <b>+${R.pts || 0}</b></span>` : ''}${cmp}
      ${!done && mySeat >= 0 ? `<button class="pq-next" data-gact="next" ${g.want && g.host !== me() ? 'disabled' : ''}>Siguiente mano ▶</button><small class="pq-sub">Sale ${esc(seatName(g.players[R?.seat ?? 0]))}</small>` : ''}</div>`;
  }
  // 🃏 Al terminar, cada quien «vira» sus fichas en su lado de la mesa, como en la vida real: tú abajo, los demás arriba y a los lados
  function handsOnTable(g) {
    const sh = g.shown || {}, R = g.result || {}, n = g.players.length, meI = Math.max(0, g.players.indexOf(me()));
    const POS = n === 2 ? ['bot', 'top'] : n === 3 ? ['bot', 'right', 'left'] : ['bot', 'right', 'top', 'left'];
    return g.players.map((s, k) => {
      const pos = POS[(k - meI + n) % n], t = sh[s] && sh[s] !== '-' ? String(sh[s]).split(',') : null, p = (g.pips || [])[k] || 0, win = teamOf(g, k) === R.team;
      return `<div class="mt-side ${pos} ${win ? 'win' : ''}"><span class="mt-tag">${esc(s === me() ? 'Tú' : seatName(s).replace('🤖 ', '🤖'))} · <b>${p}</b></span><span class="mt-tiles">${t ? t.map((x, j) => tileHTML(x, '', `style="--k:${j}"`)).join('') : sh[s] === '-' ? '<i>sin fichas</i>' : '<i>…</i>'}</span></div>`;
    }).join('');
  }
  // Debajo, en la tarjeta del ganador: la cuenta (en parejas, la suma de cada pareja)
  function handsCmp(g) {
    const R = g.result || {}, tr = /tranque/.test(R.why || '');
    if (g.mode === 'parejas') { const tp = [0, 0]; (g.pips || []).forEach((p, k) => tp[teamOf(g, k)] += p); return `<p class="hs-line">${tr ? '🔒 Gana la que tiene menos: ' : ''}Pareja A <b>${tp[0]}</b> · Pareja B <b>${tp[1]}</b></p>`; }
    return tr ? '<p class="hs-line">🔒 Gana quien tiene menos puntos en sus fichas (están viradas en la mesa)</p>' : '';
  }
  // 🃏 Las fichas que le quedaron a cada quien y la cuenta de puntos (en el tranque gana el que menos tiene)
  function handsHTML(g) {
    const sh = g.shown || {}, R = g.result || {}, tr = /tranque/.test(R.why || ''), par = g.mode === 'parejas';
    const row = (s, k) => { const t = sh[s] && sh[s] !== '-' ? String(sh[s]).split(',') : null, p = (g.pips || [])[k] || 0;
      return `<div class="hs-row ${teamOf(g, k) === R.team ? 'win' : ''}"><span class="hs-who">${esc(s === me() ? 'Tú' : seatName(s))}</span><span class="hs-tiles">${t ? t.map(x => tileHTML(x)).join('') : sh[s] === '-' ? '<i class="muted small">sin fichas</i>' : '<i class="muted small">enseñando…</i>'}</span><b class="hs-pts">${p}</b></div>`; };
    let cmp = '';
    if (par) { const tp = [0, 0]; (g.pips || []).forEach((p, k) => tp[teamOf(g, k)] += p); cmp = `<div class="hs-cmp"><span class="${R.team === 0 ? 'win' : ''}">Pareja A <b>${tp[0]}</b></span><i>vs</i><span class="${R.team === 1 ? 'win' : ''}">Pareja B <b>${tp[1]}</b></span></div>`; }
    return `<div class="hshow">${tr ? '<p class="hs-t">🔒 Juego trancado: se cuentan los puntos de las fichas. Gana quien tiene <b>menos</b>.</p>' : '<p class="hs-t">Lo que le quedó a cada quien:</p>'}
      ${g.players.map(row).join('')}${cmp}<p class="hs-sum">Se anota${R.team >= 0 ? '' : 'n'} <b>${R.pts || 0}</b> puntos${tr ? ' (lo que hay en todas las manos)' : ''}</p></div>`;
  }
  // Al terminar: cualquiera de la mesa pide otra partida (sale quien ganó); quien la creó puede además cambiar jugadores.
  function againHTML(g, label) {
    if (g.status !== 'done' || !label) return '';
    if (!g.players.includes(me()) && g.host !== me()) return '';
    const waiting = g.type === 'domino' && g.want === 'again' && g.host !== me();
    return `<div class="qa" style="justify-content:center"><button class="btn gold" data-gact="again" ${waiting ? 'disabled' : ''}>${waiting ? 'Repartiendo…' : label}</button>${g.host === me() ? '<button class="btn" data-gact="lobby">👥 Cambiar jugadores</button>' : ''}</div>`;
  }
  function tttHTML(g) {
    const mySeat = g.players.indexOf(me()), myTurn = g.status === 'playing' && g.turn === mySeat;
    const R = g.result;
    const win = new Set(g.status === 'done' ? tttWinCells(g.board || '.........') : []);
    return `${seatsHTML(g)}<div class="ttt ${win.size ? 'won' : ''}">${[...(g.board || '.........')].map((c, k) => `<button class="tc ${c !== '.' ? 'f' : ''} ${win.has(k) ? 'win' : ''}" data-ttt="${k}" ${!myTurn || c !== '.' ? 'disabled' : ''} ${k === g.lastCell ? 'data-nw' : ''}>${c === 'X' ? '<svg class="tx" viewBox="0 0 40 40"><path d="M10 10l20 20M30 10L10 30"/></svg>' : c === 'O' ? '<svg class="to" viewBox="0 0 40 40"><circle cx="20" cy="20" r="11"/></svg>' : ''}</button>`).join('')}</div>
      <p class="glog">${emoChip(g)}${g.status === 'done' ? (R?.why === 'empate' ? '🤝 ¡Empate!' : `🏆 Ganó ${esc(R?.seat === me() ? 'tú' : seatName(R?.seat))}`) : myTurn ? '👉 ¡Te toca!' : `Turno de ${esc(seatName(g.players[g.turn]))}`}</p>
      ${againHTML(g, '🔁 Otra partida')}`;
  }
  function c4HTML(g) {
    const mySeat = g.players.indexOf(me()), myTurn = g.status === 'playing' && g.turn === mySeat, R = g.result, b = g.board || C4EMPTY;
    const win = new Set(g.status === 'done' ? c4WinCells(b) : []);
    const cols = Array.from({ length: C4W }, (_, c) => `<button class="c4c" data-c4="${c}" ${!myTurn || b[c] !== '.' ? 'disabled' : ''}>${Array.from({ length: C4H }, (_, r) => { const i = r * C4W + c, v = b[i]; return `<span class="c4h ${v === 'R' ? 'r' : v === 'Y' ? 'y' : ''} ${i === g.lastCell && !win.size ? 'nw' : ''} ${win.has(i) ? 'win' : ''}"></span>`; }).join('')}</button>`).join('');
    return `${seatsHTML(g)}<div class="c4 ${win.size ? 'won' : ''}">${cols}</div>
      <p class="glog">${emoChip(g)}${g.status === 'done' ? (R?.why === 'empate' ? '🤝 ¡Empate!' : `🏆 Ganó ${esc(R?.seat === me() ? 'tú' : seatName(R?.seat))}`) : myTurn ? '👉 ¡Te toca! Toca una columna' : `Turno de ${esc(seatName(g.players[g.turn]))}`}</p>
      ${againHTML(g, '🔁 Otra partida')}`;
  }
  function hangHTML(g) {
    const mySeat = g.players.indexOf(me()), myTurn = g.status === 'playing' && g.turn === mySeat, gs = g.guessed || '';
    const shown = [...g.word].map(ch => /\s/.test(ch) ? '<span class="hw sp"></span>' : `<span class="hw">${g.status === 'done' || gs.includes(letterKey(ch)) ? esc(ch) : ''}</span>`).join('');
    const parts = ['🎅', '🧣', '🧤', '🎄', '⛄', '💀'].slice(0, g.errors || 0).join(' ');
    const cat = WORD_CATS[g.wcat];
    return `${seatsHTML(g)}<div class="card center">${cat ? `<div class="hcat">${cat.e} ${esc(cat.name)}</div>` : ''}${wordHint(g.word) ? `<div class="hhint" aria-label="Pista"><small>Pista</small>${wordHint(g.word)}</div>` : ''}<div class="hlives" aria-label="Vidas">${Array.from({ length: g.maxErrors || 6 }, (_, k) => `<span class="${k < (g.maxErrors || 6) - (g.errors || 0) ? 'on' : 'off'}">${k < (g.maxErrors || 6) - (g.errors || 0) ? '❤️' : '🖤'}</span>`).join('')}</div><div class="muted small">${(g.maxErrors || 6) - (g.errors || 0)} de ${g.maxErrors || 6} vidas</div><div class="hword">${shown}</div></div>
      ${g.status === 'done' ? `<p class="glog">${emoChip(g)}${g.result?.why === 'ahorcado' ? '💀 ¡Ahorcados!' : '🎉 ¡Resuelta!'} ${(g.winners || []).length ? '🏆 ' + g.winners.map(s => esc(seatName(s))).join(' y ') : ''}</p>${againHTML(g, '🔁 Otra palabra')}`
      : `<p class="glog">${emoChip(g)}${myTurn ? '👉 ¡Te toca! Elige una letra' : `Turno de ${esc(seatName(g.players[g.turn]))}`}</p>
        <div class="hkb">${'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('').map(L => `<button data-hl="${L}" ${!myTurn || gs.includes(L) ? 'disabled' : ''} class="${gs.includes(L) ? (hangCount(g.word, L) ? 'hit' : 'miss') : ''}">${L}</button>`).join('')}</div>
        ${myTurn ? '<button class="btn sm" data-gact="word" style="width:100%;margin-top:10px">💡 Ya sé la palabra</button>' : ''}`}`;
  }
  function renderGame(g) {
    if (g.loading) return '<div class="card empty"><span class="spin-dots"></span></div>';
    if (g.gone) return '<div class="card empty"><span class="e">🫥</span>Esta mesa ya no existe.<div class="qa" style="justify-content:center"><a class="btn" href="#juegos">Volver</a></div></div>';
    const emoBtn = g.players?.includes(me()) && (g.status === 'playing' || g.status === 'done') ? '<button type="button" class="iconbtn gsnd gemo-btn" data-gact="emo" aria-label="Reaccionar">😄</button>' : '';
    const head = `<div class="ghead"><a class="backbtn" href="#juegos"><svg class="ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>Juegos</a><b>${GINFO[g.type]?.e || ''} ${esc(g.title || GINFO[g.type]?.name)}</b><button class="iconbtn gsnd ${SND.pref.m || SND.pref.f ? '' : 'off'}" data-gact="snd" aria-label="Sonido">${SND.pref.m || SND.pref.f ? '🔊' : '🔇'}</button>${g.host === me() ? '<button class="iconbtn gdel" data-gact="del" aria-label="Cerrar mesa"><svg class="ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/></svg></button>' : '<span style="width:42px"></span>'}</div>`;
    if (g.status === 'lobby') return head + lobbyHTML(g);
    if (g.status !== 'lobby' && !g.players.includes(me()) && g.max <= 2) return head + `<div class="card empty"><span class="e">🔒</span>Esta partida es solo de ${g.players.map(s => esc(seatName(s))).join(' y ')}<div class="qa" style="justify-content:center"><a class="btn" href="#juegos">Volver</a></div></div>`;
    return head + (g.type === 'domino' ? dominoHTML(g) : g.type === 'ttt' ? tttHTML(g) : g.type === 'c4' ? c4HTML(g) : hangHTML(g));
  }
  const mesaWidth = () => Math.max(250, (($('#g-root')?.clientWidth) || 360) - 42);
  let rzT; addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (G.cur?.type === 'domino' && document.querySelector('#g-mesa')) renderView(); }, 150); });
  function renderView() {
    const root = $('#g-root'); if (!root) return;
    if (!S.me) { root.innerHTML = X.needLogin('Entra para jugar con el grupo.'); return; }
    ensure();
    const h = location.hash.slice(1), m = h.match(/^juego-([A-Za-z0-9_-]{1,80})$/);
    if (m) open(m[1]); else if (G.cur) closeGame();
    $('#v-juegos')?.classList.toggle('ingame', !!G.cur);
    root.innerHTML = G.cur ? renderGame(G.cur) : renderLobbyList();
    SND.music(G.cur && G.cur.status === 'playing' && G.cur.players?.includes(me()) ? (G.cur.type === 'domino' ? 'domino' : 'fiesta') : null);
  }

  function pickMode(type) {
    const opt = (v, e, t, d) => `<button class="gopt" data-gnew="${type}:${v}"><span class="go-e">${e}</span><span><b>${t}</b><span class="muted small">${d}</span></span></button>`;
    const body = {
      domino: ['🎲 Dominó', opt('parejas', '👥', 'En parejas', '2 contra 2 · se juega a 200 · los asientos vacíos se llenan con 🤖') + opt('solo', '🙋', 'Cada quien', 'De 2 a 4 · se juega a 100')],
      ahorcado: ['🔤 Ahorcado', Object.entries(WORD_CATS).map(([k, c]) => opt(k, c.e, c.name, `${c.words.length} palabras`)).join('') + opt('mix', '🎰', 'Al azar', 'Cualquier categoría')],
      c4: ['🔴 4 en línea', opt('', '🙋', 'Contra alguien', 'Creas la mesa y otra persona se une') + opt('bot', '🤖', 'Contra la máquina', 'Empieza de una vez')],
      ttt: ['❌ X y O', opt('', '🙋', 'Contra alguien', 'Creas la mesa y otra persona se une') + opt('bot', '🤖', 'Contra la máquina', 'Empieza de una vez')],
    }[type];
    openModal(`<h3>${body[0]}</h3><p class="muted small">¿Cómo quieres jugar?</p><div class="stack" style="margin-top:12px">${body[1]}</div><div class="actions"><button class="btn ghost" data-a="x">Cancelar</button></div>`).onclick = ev => { if (ev.target.closest('[data-a]')) closeModal(); };
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) maybeBot(); });
  // Vigilante: si le toca a un 🤖 y nada está en camino (p. ej. se perdió una jugada por mala señal), lo despierta.
  setInterval(() => {
    const g = G.cur; if (!live(g) || g.host !== me() || document.hidden || G.busy || G.pend) return;
    if (!isBot(g.players[g.turn])) { G.botWait = 0; return; }
    G.botWait = (G.botWait || 0) + 1; if (G.botWait >= 2) { G.botWait = 0; maybeBot(); }
  }, 1500);

  /* ----- toques ----- */
  document.addEventListener('click', async e => {
    const pk = e.target.closest('[data-gpick]'); if (pk) return pickMode(pk.dataset.gpick);
    const nw = e.target.closest('[data-gnew]'); if (nw) { closeModal(); const [t, m] = nw.dataset.gnew.split(':'); return create(t, m); }
    if (!G.cur) return;
    const a = e.target.closest('[data-gact]')?.dataset.gact;
    if (a === 'join') return join();
    if (a === 'leave') return leave();
    if (a === 'start') return start();
    if (a === 'bot') return addBot();
    if (a === 'seat') return seatPicker();
    if (a === 'side') return pickSide(+e.target.closest('[data-k]').dataset.k);
    if (a === 'swap') return swapSeats();
    if (a === 'next') return G.cur.host === me() ? nextHand() : askNext();
    if (a === 'again') return again();
    if (a === 'lobby') return rematch();
    if (a === 'del') return del();
    if (a === 'pass') return playDomino(me(), null);
    if (a === 'emo') return emotePicker();
    if (a === 'peek') { G.peek = G.peek === G.cur?.seq ? -1 : G.cur?.seq; return renderView(); }
    if (a === 'snd') {
      const s2 = openModal(`<h3>🔊 Sonido del juego</h3><div class="stack" style="margin-top:12px">
        <div class="switch"><div><b>🎶 Música de fondo</b><div class="muted small">Ritmo de merengue en el dominó; campanitas en los demás.</div></div><button class="tg ${SND.pref.m ? 'on' : ''}" data-snd="m" aria-label="Música"></button></div>
        <div class="switch"><div><b>🗣️ Efectos y voz</b><div class="muted small">«Paso», «¡Capicúa!», «¡Juego trancado!», «¡Ganaste!»…</div></div><button class="tg ${SND.pref.f ? 'on' : ''}" data-snd="f" aria-label="Efectos"></button></div></div>
        <div class="actions"><button class="btn gold" data-a="x">Listo</button></div>`);
      s2.onclick = ev => { const t = ev.target.closest('[data-snd]'); if (t) { const k = t.dataset.snd, v = !SND.pref[k]; SND.set(k, v); t.classList.toggle('on', v); if (k === 'f' && v) SND.say('Sonido activado'); renderView(); return; } if (ev.target.closest('[data-a]')) closeModal(); };
      return;
    }
    if (a === 'share') {
      const url = location.href.split('#')[0] + '#juego-' + G.cur.id, txt = `🎮 ¡Únete a la mesa de ${G.cur.title} en el angelito! ${url}`;
      if (navigator.share) { navigator.share({ text: txt }).catch(() => { }); return; }
      const s2 = openModal(`<h3>📲 Invitar a la mesa</h3><p class="muted small">Quien abra el enlace entra directo a esta mesa.</p><input class="in" readonly value="${esc(url)}" style="margin-top:10px">
        <div class="actions"><a class="btn" href="https://wa.me/?text=${encodeURIComponent(txt)}" target="_blank" rel="noopener" style="text-decoration:none">💬 WhatsApp</a><button class="btn gold" data-a="copy">📋 Copiar</button></div>`);
      s2.onclick = async ev => { const b = ev.target.closest('[data-a]')?.dataset.a; if (b !== 'copy') return; try { await navigator.clipboard.writeText(txt); toast('📋 Enlace copiado'); closeModal(); } catch { s2.querySelector('input').select(); toast('Selecciónalo y cópialo'); } };
      return;
    }
    if (a === 'word') {
      const s2 = openModal(`<h3>💡 ¿Cuál es la palabra?</h3><p class="muted small">Si aciertas ganas 30 puntos más 10 por cada letra que faltaba. Si fallas, cuenta como error.</p><input class="in" id="hw-in" maxlength="40" autocomplete="off" style="margin-top:10px;text-transform:uppercase"><div class="actions"><button class="btn" data-a="x">Cancelar</button><button class="btn gold" data-a="ok">Adivinar</button></div>`);
      setTimeout(() => $('#hw-in')?.focus(), 80);
      s2.onclick = ev => { const b = ev.target.closest('[data-a]')?.dataset.a; if (!b) return; const v = $('#hw-in').value; closeModal(); if (b === 'ok' && v.trim()) hangWord(v); };
      return;
    }
    const k = e.target.closest('[data-gkick]'); if (k) return kick(k.dataset.gkick);
    const hl = e.target.closest('[data-hl]'); if (hl && !hl.disabled) return hangLetter(hl.dataset.hl);
    const c = e.target.closest('[data-ttt]'); if (c && !c.disabled) { if (G.pend || G.busy || Date.now() - (G.tapAt || 0) < 350) return; G.tapAt = Date.now(); return playTTT(me(), +c.dataset.ttt); }
    const c4 = e.target.closest('[data-c4]'); if (c4 && !c4.disabled) { if (G.pend || G.busy || Date.now() - (G.tapAt || 0) < 350) return; G.tapAt = Date.now(); return playC4(me(), +c4.dataset.c4); }
    const tl = e.target.closest('[data-tile]');
    if (tl && G.cur.type === 'domino') {
      const g = G.cur, t = tl.dataset.tile, chain = g.chain || [];
      if (g.players[g.turn] !== me() || g.handOver) return toast('Espera tu turno');
      if (!playable(G.hand, chain, g.mustOpen).includes(t)) { tl.classList.remove('shake'); void tl.offsetWidth; tl.classList.add('shake'); return toast(g.mustOpen && !chain.length ? `Tienes que salir con el doble ${g.mustOpen[0]}` : 'Esa no cabe'); }
      const sides = sidesFor(t, chain);
      if (chain.length && sides.length === 2 && ends(chain).l !== ends(chain).r) {
        const e2 = ends(chain);
        const s2 = openModal(`<h3>¿Dónde la pones?</h3><div class="center" style="margin:12px 0">${tileHTML(t, 'big')}</div><div class="actions" style="justify-content:center"><button class="btn gold" data-a="l">⬅️ Al ${e2.l}</button><button class="btn gold" data-a="r">Al ${e2.r} ➡️</button></div>`);
        s2.onclick = ev => { const b = ev.target.closest('[data-a]')?.dataset.a; if (!b) return; closeModal(); playDomino(me(), t, b); };
        return;
      }
      return playDomino(me(), t, sides[0] || 'r');
    }
  });

  return { render: renderView, stop, leaveView: () => {
    SND.music(null); const g = G.cur; if (g && !(g.status === 'playing' && Array.isArray(g.players) && g.players.includes(me()))) closeGame();
    // 💸 cuota: fuera de Juegos la lista de mesas se suelta (cada jugada de cualquiera costaba una lectura a todos),
    // salvo que estés en una partida en curso (para el aviso de «te toca»).
    clearTimeout(G.offT2); G.offT2 = setTimeout(() => {
      if (location.hash.slice(1).startsWith('juego') || location.hash === '#juegos' || !G.subList) return;
      if (G.list.some(x => x.status === 'playing' && !isLoc(x.id) && x.players?.includes(me()))) return;
      G.subList(); G.subList = null;
    }, 30e3);
  }, isOpen: () => !!G.cur, active: () => G.list.filter(g => g.status === 'playing' && g.players?.includes(me()) && g.players[g.turn] === me() && !g.handOver).length };
}
