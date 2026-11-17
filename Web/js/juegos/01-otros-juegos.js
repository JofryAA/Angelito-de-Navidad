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
