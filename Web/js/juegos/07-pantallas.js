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
    const emoBtn = `<button type="button" class="iconbtn gsnd gemo-btn" data-gact="emo" data-n="${G.chatUnread || ''}" aria-label="Chat y reacciones">💬</button>`;
    const head = `<div class="ghead"><a class="backbtn" href="#juegos"><svg class="ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>Juegos</a><b>${GINFO[g.type]?.e || ''} ${esc(g.title || GINFO[g.type]?.name)}</b><button class="iconbtn gsnd ${SND.pref.m || SND.pref.f ? '' : 'off'}" data-gact="snd" aria-label="Sonido">${SND.pref.m || SND.pref.f ? '🔊' : '🔇'}</button>${isLoc(g.id) ? '' : emoBtn}${g.host === me() ? '<button class="iconbtn gdel" data-gact="del" aria-label="Cerrar mesa"><svg class="ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/></svg></button>' : '<span style="width:42px"></span>'}</div>`;
    if (g.status === 'lobby') return head + lobbyHTML(g) + queueHTML(g);
    if (false) return head + `<div class="card empty"><span class="e">🔒</span>Esta partida es solo de ${g.players.map(s => esc(seatName(s))).join(' y ')}<div class="qa" style="justify-content:center"><a class="btn" href="#juegos">Volver</a></div></div>`;
    return head + (g.type === 'domino' ? dominoHTML(g) : g.type === 'ttt' ? tttHTML(g) : g.type === 'c4' ? c4HTML(g) : hangHTML(g)) + queueHTML(g);
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

