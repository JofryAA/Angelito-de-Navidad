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
  function dropGame(g) { if (isLoc(g.id)) { const b = writeBatch(db); (g.players || []).forEach(s => b.delete(doc(db, 'games', g.id, 'hands', s))); b.delete(doc(db, 'games', g.id)); return b.commit(); } return rUpdate({ ['games/' + g.id]: null, ['hands/' + g.id]: null, ['emotes/' + g.id]: null, ['gchat/' + g.id]: null }); }
  function stop() {
    SND.music(null); closeGame(); [G.subList, G.subWins].forEach(u => u && u());
    Object.assign(G, { subList: null, subWins: null, list: [], wins: [], seenTurn: '' }); G.credited.clear();
  }
  // Mesas sin movimiento: se cierran solas para no dejar partidas "colgadas" gastando recursos.
  // En espera o jugando: 45 min sin jugadas. Terminadas: 2 horas (da tiempo a que los ganadores sumen sus puntos).
  // ⏱️ Mesas que se cierran solas (las mismas horas las aplica el servidor y las exigen las reglas):
  //    sala de espera 20 min sin movimiento · partida a medias 2 h sin jugadas · terminada 10 min · sin nadie sentado: al momento
  const STALE_LOBBY = 20 * 60e3, STALE_LIVE = 2 * 3600e3, STALE_DONE = 10 * 60e3;
  const isStale = g => !(g.players || []).length || Date.now() - (g.updatedAt || 0) > (g.status === 'done' ? STALE_DONE : g.status === 'lobby' ? STALE_LOBBY : STALE_LIVE);
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
    G.chat = []; G.chatIds = null; G.chatUnread = 0;
    if (!isLoc(id)) G.subChat = RT.onValue(RT.query(rr('gchat/' + id), RT.limitToLast(40)), s => {
      const arr = []; s.forEach(c => { const v = c.val() || {}; if (typeof v.t === 'string') arr.push({ id: c.key, uid: String(v.uid || ''), t: v.t.slice(0, 200), ts: +v.ts || 0 }); });
      const first = !G.chatIds, fresh = first ? [] : arr.filter(m => !G.chatIds.has(m.id) && m.uid !== me());
      G.chatIds = new Set(arr.map(m => m.id)); G.chat = arr;
      fresh.forEach(m => { if (!chatOpen()) { bubble(m.uid, m.t, false, m.ts); G.chatUnread++; } }); // con el chat abierto, el mensaje ya se ve en la lista
      paintChat(); chatBadge();
    }, () => { });
    if (!isLoc(id)) G.subEmo = RT.onValue(rr('emotes/' + id), s => s.forEach(c => { showEmote(c.key, c.val()); }), () => { });
  }
