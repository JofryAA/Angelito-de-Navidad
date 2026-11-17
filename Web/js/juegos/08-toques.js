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
    if (a === 'emo') return emotePicker(e.target.closest('[data-gact]'));
    if (a === 'chat') return openChat();
    if (a === 'queue' || a === 'unqueue') return setQueue(a === 'queue');
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
