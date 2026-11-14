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
    patch.last = { seat, pass: true };
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
    patch.last = { seat, tile, side };
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
    if (who.length > 1) return { patch: { ...patch, ...endHand(g, -1, g.starter, 0, 'empate') }, hand: newHand };
    const t = who[0]; let best = -1; pips.forEach((p, k) => { if (teamOf(g, k) === t && (best < 0 || p < pips[best])) best = k; });
    return { patch: { ...patch, ...endHand(g, t, best, total, 'tranque') }, hand: newHand };
  }
  patch.turn = (i + 1) % n;
  return { patch, hand: newHand };
}
function endHand(g, team, seatIdx, pts, why) {
  const scores = (g.scores || []).slice();
  if (team >= 0) scores[team] = (scores[team] || 0) + pts;
  const p = { handOver: true, scores, nextStarter: seatIdx, result: { team, seat: seatIdx, pts, why } };
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
export function snakeLayout(chain, cols) {
  cols = Math.max(6, cols | 0);
  const out = []; let dir = 1, x = 0, yc = 1, maxY = 2, prevDbl = false;
  for (let k = 0; k < chain.length; k++) {
    const t = chain[k], dbl = isDouble(t), w = dbl ? 1 : 2;
    if ((dir > 0 && x + w > cols) || (dir < 0 && x - w < 0)) { // vuelta: ficha parada hacia abajo
      const cx = dir > 0 ? x - 1 : x, top = yc + (prevDbl ? 1 : 0.5);
      out.push({ t, k, x: cx, y: top, w: 1, h: 2, v: true, a: +t[0], b: +t[1] });
      yc = top + 1.5; maxY = Math.max(maxY, yc + 1); prevDbl = false;
      dir = -dir; x = dir < 0 ? cx : cx + 1;
      continue;
    }
    if (dbl) out.push({ t, k, x: dir > 0 ? x : x - 1, y: yc - 1, w: 1, h: 2, v: true, a: +t[0], b: +t[1] });
    else out.push({ t, k, x: dir > 0 ? x : x - 2, y: yc - 0.5, w: 2, h: 1, v: false, a: dir > 0 ? +t[0] : +t[1], b: dir > 0 ? +t[1] : +t[0] });
    x += dir * w; maxY = Math.max(maxY, yc + 1); prevDbl = dbl;
  }
  return { tiles: out, rows: maxY };
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
export const WORD_CATS = {
  cultura: { e: '🇩🇴', name: 'Cultura dominicana', words: ['MERENGUE', 'BACHATA', 'MANGÚ', 'SANCOCHO', 'TAMBORA', 'GÜIRA', 'LARIMAR', 'CARNAVAL', 'DIABLO COJUELO', 'CHINCHORRO', 'COLMADO',
    'MOFONGO', 'CONCÓN', 'CHICHARRÓN', 'PLÁTANO', 'HABICHUELAS CON DULCE', 'CASABE', 'YANIQUEQUE', 'PICA POLLO', 'MORIR SOÑANDO', 'MABÍ', 'GUAGUA', 'MOTOCONCHO',
    'DOMINÓ', 'PELOTA', 'PICO DUARTE', 'LAGO ENRIQUILLO', 'ZONA COLONIAL', 'SAMANÁ', 'PUNTA CANA', 'DUARTE', 'ÁMBAR', 'CACAO', 'TOSTONES', 'QUIPE', 'CHIVO GUISADO',
    'LOS TRES GOLPES', 'BIZCOCHO', 'DULCE DE LECHE', 'MAMAJUANA', 'TIGUERE', 'JEVI', 'VAINA', 'CHERCHA', 'PALOS', 'CARABINÉ', 'BOLO', 'FRÍO FRÍO', 'SALCOCHO', 'PASTELÓN'] },
  biblia: { e: '📖', name: 'Biblia', words: ['NOÉ', 'MOISÉS', 'DAVID', 'GOLIAT', 'SANSÓN', 'JONÁS', 'DANIEL', 'ABRAHAM', 'SARA', 'RUT', 'ESTER', 'DÉBORA', 'ELÍAS', 'SALOMÓN',
    'JERUSALÉN', 'BELÉN', 'NAZARET', 'EGIPTO', 'ARCA DE NOÉ', 'MANÁ', 'PARÁBOLA', 'APÓSTOLES', 'PEDRO', 'PABLO', 'JUAN BAUTISTA', 'MARÍA', 'JOSÉ', 'PESEBRE',
    'REYES MAGOS', 'GÉNESIS', 'SALMOS', 'PROVERBIOS', 'ÉXODO', 'DIEZ MANDAMIENTOS', 'MAR ROJO', 'TORRE DE BABEL', 'JARDÍN DEL EDÉN', 'ZAQUEO', 'LÁZARO', 'BUEN SAMARITANO',
    'HIJO PRÓDIGO', 'JACOB', 'ISAAC', 'GEDEÓN', 'SAMUEL', 'NEHEMÍAS', 'APOCALIPSIS', 'BAUTISMO'] },
  navidad: { e: '🎄', name: 'Navidad', words: ['ANGELITO', 'NAVIDAD', 'REGALO', 'PASTELITO', 'PUERCO ASADO', 'AGUINALDO', 'NOCHEBUENA', 'VILLANCICO', 'GUIRNALDA',
    'ESTRELLA', 'PESEBRE', 'REYES MAGOS', 'PONCHE', 'JENGIBRE', 'CASCABEL', 'ARBOLITO', 'PARRANDA', 'MUÉRDAGO', 'RENO', 'TRINEO', 'DUENDE', 'CAMPANAS', 'UVAS',
    'AÑO NUEVO', 'FUEGOS ARTIFICIALES', 'BOTA NAVIDEÑA', 'ESFERAS', 'TURRÓN', 'MANZANAS', 'COQUITO', 'NIEVE', 'SANTA CLOS'] },
  variado: { e: '🎲', name: 'De todo un poco', words: ['ELEFANTE', 'BICICLETA', 'COMPUTADORA', 'MARIPOSA', 'TELÉFONO', 'PARAGUAS', 'GUITARRA', 'HELICÓPTERO', 'CHOCOLATE', 'ARCOÍRIS',
    'ZAPATO', 'ALMOHADA', 'LÁPIZ', 'TORTUGA', 'DINOSAURIO', 'VOLCÁN', 'ASTRONAUTA', 'PIRATA', 'NEVERA', 'SANDÍA', 'PIÑA', 'AGUACATE', 'ESPEJO', 'ESCALERA', 'GLOBO',
    'CAMARÓN', 'PULPO', 'CANGREJO', 'HORMIGA', 'COCODRILO', 'TELEVISOR', 'AVIÓN', 'BIBLIOTECA', 'HOSPITAL', 'PLAYA', 'MONTAÑA', 'CASTILLO', 'RELOJ', 'SEMÁFORO', 'MAQUILLAJE'] },
};
export const WORDS = Object.values(WORD_CATS).flatMap(c => c.words);
export function pickWord(cat) {
  const key = cat && WORD_CATS[cat] ? cat : Object.keys(WORD_CATS)[Math.floor(Math.random() * 4)];
  const ws = WORD_CATS[key].words; return { word: ws[Math.floor(Math.random() * ws.length)], cat: key };
}
// Quita tildes pero respeta la Ñ (á→A, ñ→Ñ).
export const letterKey = str => [...String(str).toUpperCase()].map(c => c === '\u00D1' ? c : c.normalize('NFD').replace(/[\u0300-\u036f]/g, '')).join('');
export function hangSolved(word, guessed) { return [...word].every(ch => !/[A-ZÁÉÍÓÚÑ]/i.test(ch) || guessed.includes(letterKey(ch))); }
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
  domino: { e: '🁫', name: 'Dominó', pts: 3 },
  ttt: { e: '❌', name: 'X y O', pts: 1 },
  ahorcado: { e: '🔤', name: 'Ahorcado', pts: 2 },
  c4: { e: '🔴', name: '4 en línea', pts: 2 },
};
const PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const half = v => `<span class="dh">${Array.from({ length: 9 }, (_, k) => `<i class="${PIPS[v].includes(k) ? 'on' : ''}"></i>`).join('')}</span>`;
const halfS = v => `<span class="dmh">${Array.from({ length: 9 }, (_, k) => `<i class="${PIPS[v].includes(k) ? 'on' : ''}"></i>`).join('')}</span>`;
function snakeHTML(chain, width) {
  if (!chain.length) return '<span class="muted small" style="margin:auto">La mesa está vacía · sale la primera ficha</span>';
  const S = Math.max(20, Math.min(30, Math.floor(width / 14))), cols = Math.floor(width / S);
  const { tiles, rows } = snakeLayout(chain, cols), off = Math.max(0, (width - cols * S) / 2);
  return `<div class="snake" style="height:${rows * S}px">${tiles.map(o => `<span class="dmt ${o.v ? 'v' : 'h'} ${o.k === 0 || o.k === chain.length - 1 ? 'end' : ''} ${o.k === LAST.k ? 'new' : ''}" style="left:${off + o.x * S}px;top:${o.y * S}px;width:${o.w * S - 2}px;height:${o.h * S - 2}px">${halfS(o.a)}<b></b>${halfS(o.b)}</span>`).join('')}</div>`;
}
const LAST = { k: -1 };
export const tileHTML = (t, cls = '', attrs = '') => `<span class="dmn ${isDouble(t) ? 'dbl' : ''} ${cls}" ${attrs}>${half(+t[0])}<b></b>${half(+t[1])}</span>`;
const BOT_NAMES = { bot1: '🤖 Robertico', bot2: '🤖 Chispita', bot3: '🤖 Turrón' };

export function initGames(X) {
  const { db, fs, S, esc, toast, $, openModal, closeModal, confirmBox, render, confetti } = X;
  const { doc, collection, onSnapshot, query, orderBy, limit, setDoc, getDoc, writeBatch, runTransaction } = fs;
  const G = { list: [], wins: [], cur: null, hand: [], botHands: {}, sub: null, subHand: null, subBots: {}, subList: null, subWins: null, botT: null, credited: new Set(), busy: false, seenTurn: '' };
  const seatName = s => isBot(s) ? BOT_NAMES[s] : (X.P(s) ? X.shortName(X.P(s)) : 'Alguien');
  const seatEmoji = s => isBot(s) ? '🤖' : X.pEmoji(s);
  const me = () => S.uid;

  function ensure() {
    if (!S.me) return;
    if (!G.subList) G.subList = onSnapshot(query(collection(db, 'games'), orderBy('updatedAt', 'desc'), limit(40)), s => { G.list = s.docs.map(d => ({ id: d.id, ...d.data() })); creditWins(); cleanupStale(); render(); }, e => { console.warn('games', e); G.subList = null; });
    if (!G.subWins) G.subWins = onSnapshot(query(collection(db, 'gameWins'), limit(1000)), s => { G.wins = s.docs.map(d => d.data()); render(); }, e => { console.warn('gameWins', e); G.subWins = null; });
  }
  function stop() { clearTimeout(G.botT); [G.subList, G.subWins, G.sub, G.subHand, ...Object.values(G.subBots)].forEach(u => u && u()); Object.assign(G, { subList: null, subWins: null, sub: null, subHand: null, subBots: {}, cur: null, list: [], wins: [], hand: [], botHands: {} }); }
  // Mesas sin movimiento: se cierran solas para no dejar partidas "colgadas" gastando recursos.
  // En espera o jugando: 45 min sin jugadas. Terminadas: 2 horas (da tiempo a que los ganadores sumen sus puntos).
  const STALE_LIVE = 45 * 60e3, STALE_DONE = 2 * 3600e3;
  const isStale = g => Date.now() - (g.updatedAt || 0) > (g.status === 'done' ? STALE_DONE : STALE_LIVE);
  let cleaning = false;
  async function cleanupStale() {
    if (cleaning) return; const old = G.list.filter(isStale).slice(0, 5); if (!old.length) return;
    cleaning = true;
    try {
      for (const g of old) { const b = writeBatch(db); (g.players || []).forEach(s => b.delete(doc(db, 'games', g.id, 'hands', s))); b.delete(doc(db, 'games', g.id)); await b.commit().catch(() => { }); }
    } finally { cleaning = false; }
  }
  // Cada ganador anota su propia victoria (las reglas verifican que la mesa terminó y que está en winners).
  function creditWins() {
    for (const g of G.list) {
      if (g.status !== 'done' || !(g.winners || []).includes(me())) continue;
      const id = `${g.id}_${me()}`; if (G.credited.has(id) || G.wins.some(w => w.gid === g.id && w.uid === me())) continue;
      G.credited.add(id);
      setDoc(doc(db, 'gameWins', id), { uid: me(), gid: g.id, type: g.type, at: Date.now() }).catch(e => console.warn('credit', e));
    }
  }

  function open(id) {
    if (G.cur?.id === id && G.sub) return;
    closeGame();
    G.cur = { id, loading: true };
    G.sub = onSnapshot(doc(db, 'games', id), s => {
      if (!s.exists()) { G.cur = { id, gone: true }; render(); return; }
      const prev = G.cur; G.cur = { id, ...s.data() };
      onGameChange(prev); render();
    }, () => { G.cur = { id, gone: true }; render(); });
  }
  function closeGame() {
    [G.sub, G.subHand, ...Object.values(G.subBots)].forEach(u => u && u()); clearTimeout(G.botT);
    Object.assign(G, { sub: null, subHand: null, subBots: {}, cur: null, hand: [], botHands: {} });
  }
  function onGameChange(prev) {
    const g = G.cur; if (!g || g.type !== 'domino') { maybeBot(); return; }
    const mine = g.players?.includes(me());
    if (mine && !G.subHand) G.subHand = onSnapshot(doc(db, 'games', g.id, 'hands', me()), s => { G.hand = s.exists() ? (s.data().tiles || []) : []; render(); }, () => { });
    if (g.host === me()) g.players.filter(isBot).forEach(b => { if (G.subBots[b]) return; G.subBots[b] = onSnapshot(doc(db, 'games', g.id, 'hands', b), s => { G.botHands[b] = s.exists() ? (s.data().tiles || []) : []; maybeBot(); }, () => { }); });
    if (prev && prev.result !== g.result && g.handOver && g.result) { if (g.result.team >= 0 && teamOfSeat(g, me()) === g.result.team) confetti(80); }
    if (g.status === 'done' && prev?.status !== 'done' && (g.winners || []).includes(me())) confetti(160);
    const key = `${g.id}:${g.hand}:${g.turn}:${g.handOver}`;
    if (g.status === 'playing' && !g.handOver && g.players[g.turn] === me() && G.seenTurn !== key) { G.seenTurn = key; if (navigator.vibrate) try { navigator.vibrate(60); } catch { } if (document.hidden) X.notify?.('🁫 ¡Te toca jugar!', g.title || 'Dominó', '#juegos'); }
    maybeBot();
  }
  const teamOfSeat = (g, s) => { const i = g.players.indexOf(s); return i < 0 ? -1 : g.mode === 'parejas' ? i % 2 : i; };

  /* ----- crear / unirse ----- */
  async function create(type, mode) {
    if (G.creating) return; G.creating = true; setTimeout(() => { G.creating = false; }, 1500);
    const id = doc(collection(db, 'games')).id, now = Date.now();
    const base = { type, host: me(), players: [me()], status: 'lobby', createdAt: now, updatedAt: now, seq: 0, title: '' };
    if (type === 'domino') Object.assign(base, { mode, max: mode === 'parejas' ? 4 : 4, target: mode === 'parejas' ? 200 : 100, scores: mode === 'parejas' ? [0, 0] : [], title: mode === 'parejas' ? 'Dominó en parejas' : 'Dominó, cada quien solo' });
    if (type === 'ttt') Object.assign(base, { max: 2, board: '.........', title: 'X y O' });
    if (type === 'c4') Object.assign(base, { max: 2, board: C4EMPTY, title: '4 en línea' });
    if (type === 'ahorcado') Object.assign(base, { max: 6, cat: mode || 'mix', title: 'Ahorcado · ' + (WORD_CATS[mode]?.name || 'De todo') });
    if (mode === 'bot') base.title += ' contra 🤖'; // las reglas exigen crear la mesa solo con uno mismo; start() sienta al 🤖
    try { await setDoc(doc(db, 'games', id), base); location.hash = 'juego-' + id; if (mode === 'bot') setTimeout(() => { if (G.cur?.id === id) start(); }, 900); } catch (e) { toast(X.authErr(e)); }
  }
  async function tx(fn) {
    if (G.busy) return; G.busy = true;
    try { await runTransaction(db, async t => { const s = await t.get(doc(db, 'games', G.cur.id)); if (!s.exists()) throw new Error('La mesa ya no existe'); return fn(t, { id: s.id, ...s.data() }); }); }
    catch (e) { toast(e?.code ? X.authErr(e) : (e.message || 'No se pudo')); }
    finally { G.busy = false; }
  }
  const upd = (t, g, patch) => t.update(doc(db, 'games', g.id), { ...patch, seq: (g.seq || 0) + 1, updatedAt: Date.now() });
  const join = () => tx((t, g) => { if (g.status !== 'lobby') throw new Error('La partida ya empezó'); if (g.players.includes(me())) return; if (g.players.length >= g.max) throw new Error('La mesa está llena'); upd(t, g, { players: [...g.players, me()] }); });
  const leave = () => tx((t, g) => { if (g.status !== 'lobby') throw new Error('Ya empezó'); upd(t, g, { players: g.players.filter(s => s !== me()) }); }).then(() => { location.hash = 'juegos'; });
  const addBot = () => tx((t, g) => { if (g.host !== me() || g.status !== 'lobby' || g.players.length >= g.max) return; const b = ['bot1', 'bot2', 'bot3'].find(x => !g.players.includes(x)); if (b) upd(t, g, { players: [...g.players, b] }); });
  const kick = s => tx((t, g) => { if (g.host !== me() || g.status !== 'lobby') return; upd(t, g, { players: g.players.filter(x => x !== s) }); });
  const swapSeats = () => tx((t, g) => { if (g.host !== me() || g.players.length < 3) return; const p = g.players.slice(); p.splice(1, 0, p.pop()); upd(t, g, { players: p }); });

  async function start() {
    const g = G.cur; if (g.host !== me() || G.starting) return; G.starting = true; setTimeout(() => { G.starting = false; }, 2000);
    if (g.type === 'domino') {
      let players = g.players.slice();
      if (g.mode === 'parejas') { while (players.length < 4) players.push(['bot1', 'bot2', 'bot3'].find(x => !players.includes(x))); }
      if (players.length < 2) { players.push('bot1'); }
      const ng = { ...g, players, nextStarter: -1, hand: 0 };
      const { hands, patch } = dealHand(ng);
      const b = writeBatch(db);
      players.forEach(s => b.set(doc(db, 'games', g.id, 'hands', s), { tiles: hands[s] }));
      b.update(doc(db, 'games', g.id), { ...patch, players, status: 'playing', scores: g.mode === 'parejas' ? [0, 0] : players.map(() => 0), nextStarter: -1, seq: (g.seq || 0) + 1, updatedAt: Date.now() });
      try { await b.commit(); } catch (e) { toast(X.authErr(e)); }
      return;
    }
    if (g.type === 'ttt' || g.type === 'c4') {
      const players = g.players.length < 2 ? [...g.players, 'bot1'] : g.players;
      return tx((t, gg) => upd(t, gg, { players, status: 'playing', board: g.type === 'c4' ? C4EMPTY : '.........', turn: 0, winners: [], result: null, lastCell: -1 }));
    }
    if (g.type === 'ahorcado') {
      const { word, cat } = pickWord(g.cat);
      return tx((t, gg) => upd(t, gg, { status: 'playing', word, wcat: cat, guessed: '', errors: 0, maxErrors: 6, scores: gg.players.map(() => 0), turn: 0, winners: [], result: null }));
    }
  }
  async function nextHand() {
    const g = G.cur; if (g.host !== me() || !g.handOver || g.status !== 'playing' || G.starting) return; G.starting = true; setTimeout(() => { G.starting = false; }, 2000);
    const { hands, patch } = dealHand(g);
    const b = writeBatch(db);
    g.players.forEach(s => b.set(doc(db, 'games', g.id, 'hands', s), { tiles: hands[s] }));
    b.update(doc(db, 'games', g.id), { ...patch, result: null, seq: (g.seq || 0) + 1, updatedAt: Date.now() });
    try { await b.commit(); } catch (e) { toast(X.authErr(e)); }
  }
  async function rematch() {
    const g = G.cur; if (g.host !== me()) return;
    const human = g.players.filter(s => !isBot(s));
    await tx((t, gg) => upd(t, gg, { status: 'lobby', players: gg.type === 'domino' && gg.mode === 'parejas' ? gg.players : human.concat(gg.players.filter(isBot)), winners: [], result: null, handOver: false, scores: gg.mode === 'parejas' ? [0, 0] : [], chain: [], hand: 0, board: gg.type === 'c4' ? C4EMPTY : '.........', guessed: '', errors: 0, lastCell: -1 }));
  }
  async function del() {
    if (!(await confirmBox('¿Cerrar esta mesa?', 'Se borra la partida para todos.', 'Cerrar mesa'))) return;
    const g = G.cur, b = writeBatch(db);
    (g.players || []).forEach(s => b.delete(doc(db, 'games', g.id, 'hands', s)));
    b.delete(doc(db, 'games', g.id));
    try { await b.commit(); location.hash = 'juegos'; } catch (e) { toast(X.authErr(e)); }
  }

  /* ----- jugadas ----- */
  function playDomino(seat, tile, side) {
    return tx((t, g) => {
      const handNow = isBot(seat) ? (G.botHands[seat] || []) : G.hand;
      const r = applyMove(g, seat, handNow, tile, side);
      upd(t, g, r.patch);
      if (tile != null) t.update(doc(db, 'games', g.id, 'hands', seat), { tiles: r.hand });
    });
  }
  function maybeBot() {
    const g = G.cur; clearTimeout(G.botT);
    if (!g || g.host !== me() || g.status !== 'playing') return;
    if (document.hidden) return; // si quien creó la mesa no la está viendo, los 🤖 esperan (no gastan nada)
    const seat = g.players?.[g.turn]; if (!seat || !isBot(seat)) return;
    if (g.type === 'domino') {
      if (g.handOver || !G.botHands[seat]) return;
      G.botT = setTimeout(() => { const c = botChoice(G.botHands[seat], g.chain || [], g.mustOpen); playDomino(seat, c ? c.tile : null, c?.side); }, 1100 + Math.random() * 700);
    } else if (g.type === 'ttt') {
      G.botT = setTimeout(() => playTTT(seat, tttBot(g.board, g.turn === 0 ? 'X' : 'O')), 700);
    } else if (g.type === 'c4') {
      G.botT = setTimeout(() => playC4(seat, c4Bot(g.board, g.turn === 0 ? 'R' : 'Y')), 800);
    }
  }
  function playTTT(seat, cell) {
    return tx((t, g) => {
      const i = g.players.indexOf(seat); if (g.status !== 'playing' || i !== g.turn) throw new Error('No es tu turno');
      if (g.board[cell] !== '.') throw new Error('Esa casilla está ocupada');
      const m = i === 0 ? 'X' : 'O', board = g.board.slice(0, cell) + m + g.board.slice(cell + 1), w = tttWinner(board);
      const p = { board, turn: 1 - i };
      if (w) Object.assign(p, { status: 'done', result: w === 'draw' ? { why: 'empate' } : { seat, why: 'gano' }, winners: w === 'draw' || isBot(seat) ? [] : [seat] });
      upd(t, g, p);
    });
  }
  function playC4(seat, col) {
    return tx((t, g) => {
      const i = g.players.indexOf(seat); if (g.status !== 'playing' || i !== g.turn) throw new Error('No es tu turno');
      const d = c4Drop(g.board, col, i === 0 ? 'R' : 'Y'); if (!d) throw new Error('Esa columna está llena');
      const w = c4Winner(d.b), p = { board: d.b, turn: 1 - i, lastCell: d.i };
      if (w) Object.assign(p, { status: 'done', result: w === 'draw' ? { why: 'empate' } : { seat, why: 'gano' }, winners: w === 'draw' || isBot(seat) ? [] : [seat] });
      upd(t, g, p);
    });
  }
  function hangLetter(L) {
    return tx((t, g) => {
      const i = g.players.indexOf(me()); if (g.status !== 'playing' || i !== g.turn) throw new Error('No es tu turno');
      if ((g.guessed || '').includes(L)) throw new Error('Esa letra ya salió');
      const guessed = (g.guessed || '') + L, n = hangCount(g.word, L), scores = g.scores.slice(), p = { guessed };
      if (n) { scores[i] += n * 10; p.scores = scores; if (hangSolved(g.word, guessed)) Object.assign(p, hangEnd(g, scores, 'resuelta')); }
      else { p.errors = (g.errors || 0) + 1; p.turn = (i + 1) % g.players.length; if (p.errors >= g.maxErrors) Object.assign(p, hangEnd(g, scores, 'ahorcado')); }
      upd(t, g, p);
    });
  }
  function hangWord(w) {
    return tx((t, g) => {
      const i = g.players.indexOf(me()); if (g.status !== 'playing' || i !== g.turn) throw new Error('No es tu turno');
      const ok = letterKey(w.trim()).replace(/\s+/g, ' ') === letterKey(g.word);
      const scores = g.scores.slice(), p = {};
      if (ok) { const missing = [...new Set([...g.word].map(letterKey).filter(c => /[A-ZÑ]/.test(c) && !(g.guessed || '').includes(c)))].length; scores[i] += 30 + missing * 10; Object.assign(p, { scores, guessed: g.guessed + [...new Set([...g.word].map(letterKey))].join('') }, hangEnd(g, scores, 'adivinada')); }
      else { p.errors = (g.errors || 0) + 1; p.turn = (i + 1) % g.players.length; if (p.errors >= g.maxErrors) Object.assign(p, hangEnd(g, scores, 'ahorcado')); }
      upd(t, g, p);
    }).then(() => { const g = G.cur; if (g && g.status === 'playing' && !hangSolved(g.word, g.guessed || '')) toast('❌ Esa no era'); });
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
    return `<div class="gcreate">
        <button class="gc" data-gpick="domino"><span class="gc-e">🁫</span><b>Dominó</b><span>En parejas o cada quien</span></button>
        <button class="gc" data-gpick="ahorcado"><span class="gc-e">🔤</span><b>Ahorcado</b><span>Cultura, Biblia y más</span></button>
        <button class="gc" data-gpick="c4"><span class="gc-e">🔴🟡</span><b>4 en línea</b><span>1 contra 1</span></button>
        <button class="gc" data-gpick="ttt"><span class="gc-e">❌⭕</span><b>X y O</b><span>1 contra 1</span></button>
      </div>
      <p class="muted small center" style="margin:-4px 0 16px">¿No llegan todos? Completa la mesa con 🤖.</p>
      ${live.filter(g => mineIds.has(g.id)).length ? `<div class="h2row"><h2>Tus partidas</h2></div><div class="stack">${live.filter(g => mineIds.has(g.id)).map(row).join('')}</div>` : ''}
      <div class="h2row"><h2>Mesas abiertas</h2></div>
      <div class="stack">${open.map(row).join('') || '<div class="card empty"><span class="e">🎲</span>No hay mesas abiertas. ¡Crea una y que se unan!</div>'}</div>
      ${live.filter(g => !mineIds.has(g.id)).length ? `<div class="h2row"><h2>Jugando ahora</h2></div><div class="stack">${live.filter(g => !mineIds.has(g.id)).map(row).join('')}</div>` : ''}
      <div class="h2row"><h2>🏆 Tabla de campeones</h2></div>
      <div class="card">${ranks.length ? ranks.slice(0, 15).map(([uid, o], k) => `<div class="rk ${uid === me() ? 'me' : ''}"><span class="rk-n">${medal[k] || k + 1}</span><span class="rk-a">${esc(X.pEmoji(uid))}</span><span class="grow"><b>${esc(X.pName(uid))}</b><div class="muted small">${o.domino ? `🁫 ${o.domino} ` : ''}${o.ahorcado ? `🔤 ${o.ahorcado} ` : ''}${o.ttt ? `❌ ${o.ttt} ` : ''}${o.c4 ? `🔴 ${o.c4}` : ''}</div></span><b class="rk-p">${o.pts}</b></div>`).join('')
        : '<p class="muted small center">Todavía nadie ha ganado. Dominó vale 3 puntos, ahorcado y 4 en línea 2, y X y O 1.</p>'}</div>`;
  }
  function seatsHTML(g) {
    const n = g.players.length;
    return `<div class="seats">${g.players.map((s, i) => `<div class="seat ${g.status === 'playing' && !g.handOver && g.turn === i ? 'turn' : ''} ${s === me() ? 'me' : ''}">
      <span class="se">${esc(seatEmoji(s))}</span><span class="sn">${esc(s === me() ? 'Tú' : seatName(s))}</span>
      ${g.type === 'domino' && g.status !== 'lobby' ? `<span class="sc">${g.counts?.[i] ?? 7} 🁢</span>` : ''}
      ${g.type === 'domino' && g.mode === 'parejas' ? `<span class="team t${i % 2}">${i % 2 ? 'B' : 'A'}</span>` : ''}
      ${g.type === 'ahorcado' && g.scores ? `<span class="sc">${g.scores[i] || 0} pts</span>` : ''}
      ${g.type === 'ttt' ? `<span class="sc">${i === 0 ? '❌' : '⭕'}</span>` : ''}${g.type === 'c4' ? `<span class="sc">${i === 0 ? '🔴' : '🟡'}</span>` : ''}
      ${g.status === 'lobby' && g.host === me() && s !== me() ? `<button class="x" data-gkick="${esc(s)}" aria-label="Quitar">✕</button>` : ''}</div>`).join('')}</div>`;
  }
  function lobbyHTML(g) {
    const inIt = g.players.includes(me()), host = g.host === me(), full = g.players.length >= g.max;
    const need = g.type === 'domino' && g.mode === 'parejas' ? 'Faltan asientos: se llenan con 🤖 al empezar.' : (g.type === 'ttt' || g.type === 'c4') && g.players.length < 2 ? 'Si nadie se une, juegas contra 🤖.' : '';
    return `${seatsHTML(g)}
      ${g.type === 'domino' && g.mode === 'parejas' && g.players.length >= 3 ? '<p class="muted small center">Pareja A: asientos 1 y 3 · Pareja B: asientos 2 y 4</p>' : ''}
      <div class="card center" style="margin-top:12px">
        <p class="muted">${host ? (need || '¡Listo para empezar!') : inIt ? 'Esperando a que quien creó la mesa empiece…' : full ? 'La mesa está llena.' : '¿Te unes?'}</p>
        <div class="qa" style="justify-content:center">
          ${!inIt && !full ? '<button class="btn gold" data-gact="join">🙋 Unirme</button>' : ''}
          ${host ? `<button class="btn gold" data-gact="start">▶️ Empezar</button>${!full && g.type !== 'ahorcado' ? '<button class="btn" data-gact="bot">🤖 Agregar</button>' : ''}${g.type === 'domino' && g.mode === 'parejas' && g.players.length >= 3 ? '<button class="btn" data-gact="swap">🔀 Cambiar parejas</button>' : ''}` : ''}
          ${inIt && !host ? '<button class="btn" data-gact="leave">Salir de la mesa</button>' : ''}
          <button class="btn" data-gact="share">📲 Invitar</button>
        </div></div>`;
  }
  function dominoHTML(g) {
    const mySeat = g.players.indexOf(me()), myTurn = g.status === 'playing' && !g.handOver && g.turn === mySeat;
    const chain = g.chain || [], can = mySeat >= 0 ? playable(G.hand, chain, g.mustOpen) : [];
    const sc = g.mode === 'parejas' ? `<div class="score2"><div class="${teamOfSeat(g, me()) === 0 ? 'mine' : ''}"><span>Pareja A</span><b>${g.scores?.[0] || 0}</b></div><span class="muted small">a ${g.target}</span><div class="${teamOfSeat(g, me()) === 1 ? 'mine' : ''}"><span>Pareja B</span><b>${g.scores?.[1] || 0}</b></div></div>`
      : `<div class="score2 solo">${g.players.map((s, i) => `<div class="${s === me() ? 'mine' : ''}"><span>${esc(s === me() ? 'Tú' : seatName(s))}</span><b>${g.scores?.[i] || 0}</b></div>`).join('')}<span class="muted small">a ${g.target}</span></div>`;
    const last = g.last ? (g.last.pass ? `${esc(seatName(g.last.seat))} pasó` : `${esc(g.last.seat === me() ? 'Jugaste' : seatName(g.last.seat) + ' jugó')}`) : g.mustOpen && !chain.length ? `Sale ${esc(seatName(g.players[g.turn]))} con el doble ${g.mustOpen[0]}` : '';
    const R = g.result, why = { domino: '¡Dominó!', capicua: '¡Capicúa! (+25)', tranque: '¡Tranque!', empate: 'Tranque empatado: nadie suma' };
    const winnerTxt = R ? (R.team < 0 ? why.empate : `${g.mode === 'parejas' ? 'Pareja ' + (R.team ? 'B' : 'A') : esc(seatName(g.players[R.team]))} gana ${R.pts} puntos · ${why[R.why]}`) : '';
    return `${sc}${seatsHTML(g)}
      <div class="mesa" id="g-mesa">${(LAST.k = g.last?.tile ? (g.last.side === 'l' ? 0 : chain.length - 1) : -1, snakeHTML(chain, mesaWidth()))}</div>
      <p class="glog">${last}</p>
      ${g.handOver ? `<div class="card center hover"><div style="font-size:36px">${R?.team < 0 ? '🤝' : '🎉'}</div><b>${winnerTxt}</b>
          ${g.status === 'done' ? `<p style="margin-top:8px">🏆 ${(g.winners || []).length ? 'Ganan ' + g.winners.map(s => esc(seatName(s))).join(' y ') : 'Ganaron los 🤖'}</p>` : ''}
          <div class="qa" style="justify-content:center">${g.host === me() ? (g.status === 'done' ? '<button class="btn gold" data-gact="again">🔁 Otra partida</button>' : '<button class="btn gold" data-gact="next">Siguiente mano ▶️</button>') : '<span class="muted small">Esperando a quien creó la mesa…</span>'}</div></div>` : ''}
      ${mySeat >= 0 && g.status === 'playing' ? `<div class="myhand ${myTurn ? 'turn' : ''}"><div class="mh-h"><b>${myTurn ? '👉 ¡Te toca!' : `Turno de ${esc(seatName(g.players[g.turn]))}`}</b>${myTurn && !can.length && !g.handOver ? '<button class="btn sm gold" data-gact="pass">Paso 🙅</button>' : ''}</div>
        <div class="hand">${G.hand.map(t => tileHTML(t, `big ${myTurn && can.includes(t) ? 'ok' : 'no'}`, `data-tile="${t}"`)).join('')}</div></div>` : ''}`;
  }
  function tttHTML(g) {
    const mySeat = g.players.indexOf(me()), myTurn = g.status === 'playing' && g.turn === mySeat;
    const R = g.result;
    const win = new Set(g.status === 'done' ? tttWinCells(g.board || '.........') : []);
    return `${seatsHTML(g)}<div class="ttt ${win.size ? 'won' : ''}">${[...(g.board || '.........')].map((c, k) => `<button class="tc ${c !== '.' ? 'f' : ''} ${win.has(k) ? 'win' : ''}" data-ttt="${k}" ${!myTurn || c !== '.' ? 'disabled' : ''}>${c === 'X' ? '❌' : c === 'O' ? '⭕' : ''}</button>`).join('')}</div>
      <p class="glog">${g.status === 'done' ? (R?.why === 'empate' ? '🤝 ¡Empate!' : `🏆 Ganó ${esc(R.seat === me() ? 'tú' : seatName(R.seat))}`) : myTurn ? '👉 ¡Te toca!' : `Turno de ${esc(seatName(g.players[g.turn]))}`}</p>
      ${g.status === 'done' && g.host === me() ? '<div class="qa" style="justify-content:center"><button class="btn gold" data-gact="again">🔁 Otra</button></div>' : ''}`;
  }
  function c4HTML(g) {
    const mySeat = g.players.indexOf(me()), myTurn = g.status === 'playing' && g.turn === mySeat, R = g.result, b = g.board || C4EMPTY;
    const win = new Set(g.status === 'done' ? c4WinCells(b) : []);
    const cols = Array.from({ length: C4W }, (_, c) => `<button class="c4c" data-c4="${c}" ${!myTurn || b[c] !== '.' ? 'disabled' : ''}>${Array.from({ length: C4H }, (_, r) => { const i = r * C4W + c, v = b[i]; return `<span class="c4h ${v === 'R' ? 'r' : v === 'Y' ? 'y' : ''} ${i === g.lastCell && !win.size ? 'nw' : ''} ${win.has(i) ? 'win' : ''}"></span>`; }).join('')}</button>`).join('');
    return `${seatsHTML(g)}<div class="c4 ${win.size ? 'won' : ''}">${cols}</div>
      <p class="glog">${g.status === 'done' ? (R?.why === 'empate' ? '🤝 ¡Empate!' : `🏆 Ganó ${esc(R.seat === me() ? 'tú' : seatName(R.seat))}`) : myTurn ? '👉 ¡Te toca! Toca una columna' : `Turno de ${esc(seatName(g.players[g.turn]))}`}</p>
      ${g.status === 'done' && g.host === me() ? '<div class="qa" style="justify-content:center"><button class="btn gold" data-gact="again">🔁 Otra</button></div>' : ''}`;
  }
  function hangHTML(g) {
    const mySeat = g.players.indexOf(me()), myTurn = g.status === 'playing' && g.turn === mySeat, gs = g.guessed || '';
    const shown = [...g.word].map(ch => /\s/.test(ch) ? '<span class="hw sp"></span>' : `<span class="hw">${g.status === 'done' || gs.includes(letterKey(ch)) ? esc(ch) : ''}</span>`).join('');
    const parts = ['🎅', '🧣', '🧤', '🎄', '⛄', '💀'].slice(0, g.errors || 0).join(' ');
    const cat = WORD_CATS[g.wcat];
    return `${seatsHTML(g)}<div class="card center">${cat ? `<div class="hcat">${cat.e} Pista: ${esc(cat.name)}</div>` : ''}<div class="muted small">Errores ${g.errors || 0} de ${g.maxErrors}</div><div style="font-size:26px;min-height:36px;letter-spacing:4px">${parts}</div><div class="hword">${shown}</div></div>
      ${g.status === 'done' ? `<p class="glog">${g.result?.why === 'ahorcado' ? '💀 ¡Ahorcados!' : '🎉 ¡Resuelta!'} ${(g.winners || []).length ? '🏆 ' + g.winners.map(s => esc(seatName(s))).join(' y ') : ''}</p>${g.host === me() ? '<div class="qa" style="justify-content:center"><button class="btn gold" data-gact="again">🔁 Otra palabra</button></div>' : ''}`
      : `<p class="glog">${myTurn ? '👉 ¡Te toca! Elige una letra' : `Turno de ${esc(seatName(g.players[g.turn]))}`}</p>
        <div class="hkb">${'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('').map(L => `<button data-hl="${L}" ${!myTurn || gs.includes(L) ? 'disabled' : ''} class="${gs.includes(L) ? (hangCount(g.word, L) ? 'hit' : 'miss') : ''}">${L}</button>`).join('')}</div>
        ${myTurn ? '<button class="btn sm" data-gact="word" style="width:100%;margin-top:10px">💡 Ya sé la palabra</button>' : ''}`}`;
  }
  function renderGame(g) {
    if (g.loading) return '<div class="card empty"><span class="spin-dots"></span></div>';
    if (g.gone) return '<div class="card empty"><span class="e">🫥</span>Esta mesa ya no existe.<div class="qa" style="justify-content:center"><a class="btn" href="#juegos">Volver</a></div></div>';
    const head = `<div class="ghead"><a class="btn sm ghost" href="#juegos">‹ Juegos</a><b>${GINFO[g.type]?.e || ''} ${esc(g.title || GINFO[g.type]?.name)}</b>${g.host === me() || X.can('moderar') ? '<button class="btn sm ghost" data-gact="del" aria-label="Cerrar mesa">🗑️</button>' : '<span></span>'}</div>`;
    if (g.status === 'lobby') return head + lobbyHTML(g);
    if (g.status !== 'lobby' && !g.players.includes(me()) && g.max <= 2) return head + `<div class="card empty"><span class="e">🔒</span>Esta partida es solo de ${g.players.map(s => esc(seatName(s))).join(' y ')}<div class="qa" style="justify-content:center"><a class="btn" href="#juegos">Volver</a></div></div>`;
    return head + (g.type === 'domino' ? dominoHTML(g) : g.type === 'ttt' ? tttHTML(g) : g.type === 'c4' ? c4HTML(g) : hangHTML(g));
  }
  const mesaWidth = () => Math.max(260, (($('#g-root')?.clientWidth) || 360) - 28);
  let rzT; addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (G.cur?.type === 'domino' && document.querySelector('#g-mesa')) renderView(); }, 150); });
  function renderView() {
    const root = $('#g-root'); if (!root) return;
    if (!S.me) { root.innerHTML = X.needLogin('Entra para jugar con el grupo.'); return; }
    ensure();
    const h = location.hash.slice(1), m = h.match(/^juego-(.+)$/);
    if (m) open(m[1]); else if (G.cur) closeGame();
    root.innerHTML = G.cur ? renderGame(G.cur) : renderLobbyList();
  }

  function pickMode(type) {
    const opt = (v, e, t, d) => `<button class="gopt" data-gnew="${type}:${v}"><span class="go-e">${e}</span><span><b>${t}</b><span class="muted small">${d}</span></span></button>`;
    const body = {
      domino: ['🁫 Dominó', opt('parejas', '👥', 'En parejas', '2 contra 2 · se juega a 200 · los asientos vacíos se llenan con 🤖') + opt('solo', '🙋', 'Cada quien', 'De 2 a 4 · se juega a 100')],
      ahorcado: ['🔤 Ahorcado', Object.entries(WORD_CATS).map(([k, c]) => opt(k, c.e, c.name, `${c.words.length} palabras`)).join('') + opt('mix', '🎰', 'Al azar', 'Cualquier categoría')],
      c4: ['🔴 4 en línea', opt('', '🙋', 'Contra alguien', 'Creas la mesa y otra persona se une') + opt('bot', '🤖', 'Contra la máquina', 'Empieza de una vez')],
      ttt: ['❌ X y O', opt('', '🙋', 'Contra alguien', 'Creas la mesa y otra persona se une') + opt('bot', '🤖', 'Contra la máquina', 'Empieza de una vez')],
    }[type];
    openModal(`<h3>${body[0]}</h3><p class="muted small">¿Cómo quieres jugar?</p><div class="stack" style="margin-top:12px">${body[1]}</div><div class="actions"><button class="btn ghost" data-a="x">Cancelar</button></div>`).onclick = ev => { if (ev.target.closest('[data-a]')) closeModal(); };
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden) maybeBot(); });

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
    if (a === 'swap') return swapSeats();
    if (a === 'next') return nextHand();
    if (a === 'again') return rematch();
    if (a === 'del') return del();
    if (a === 'pass') return playDomino(me(), null);
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
    const c = e.target.closest('[data-ttt]'); if (c && !c.disabled) return playTTT(me(), +c.dataset.ttt);
    const c4 = e.target.closest('[data-c4]'); if (c4 && !c4.disabled) return playC4(me(), +c4.dataset.c4);
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

  return { render: renderView, stop, isOpen: () => !!G.cur, active: () => G.list.filter(g => g.status === 'playing' && g.players?.includes(me()) && g.players[g.turn] === me() && !g.handOver).length };
}
