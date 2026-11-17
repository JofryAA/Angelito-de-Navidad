export const tileHTML = (t, cls = '', attrs = '') => `<span class="dmn ${isDouble(t) ? 'dbl' : ''} ${cls}" ${attrs}>${half(+t[0])}<b></b>${half(+t[1])}</span>`;
const BOT_NAMES = { bot1: '🤖 Robertico', bot2: '🤖 Chispita', bot3: '🤖 Turrón' };


/* ================= 🔊 sonido: música de fondo, efectos y voz (todo generado en el teléfono, sin archivos) ================= */
export const SND = (() => {
  let ctx = null, master = null, musicBus = null, fxBus = null, seqT = 0, kind = null, step = 0, nextT = 0;
  const pref = (() => { try { return { m: 1, f: 1, v: 1, vm: 70, vf: 90, ...JSON.parse(localStorage.getItem('angelito:snd') || '{}') }; } catch { return { m: 1, f: 1, v: 1, vm: 70, vf: 90 }; } })();
  const save = () => { try { localStorage.setItem('angelito:snd', JSON.stringify(pref)); } catch { } };
  const mv = () => .22 * (pref.vm ?? 70) / 100, fv = () => 1.1 * (pref.vf ?? 90) / 100; // volumen de música y de efectos (0–100)
  function ac() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(() => { }); return ctx; }
    const C = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext); if (!C) return null;
    // más fuerte sin que suene rajado: todo pasa por un compresor antes de la bocina
    ctx = new C(); const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = .004; comp.release.value = .2;
    master = ctx.createGain(); master.gain.value = 1.35; master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = mv(); musicBus.connect(master);
    fxBus = ctx.createGain(); fxBus.gain.value = fv(); fxBus.connect(master);
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
    if (!pref.v || typeof speechSynthesis === 'undefined' || !text) return;
    try {
      voice ||= pickVoice(); const u = new SpeechSynthesisUtterance(text); u.lang = voice?.lang || 'es-US'; if (voice) u.voice = voice; u.rate = 1.05; u.pitch = 1.05; u.volume = 1;
      if (musicBus && ctx) { musicBus.gain.setTargetAtTime(mv() * .3, ctx.currentTime, .05); u.onend = () => musicBus.gain.setTargetAtTime(mv(), ctx.currentTime, .2); }
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch { }
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) { const k = kind; music(null); SND._resume = k; } else if (SND._resume) { const k = SND._resume; SND._resume = null; music(k); } });
  const SND = { music, fx, say, pref, set(k, v) { pref[k] = v ? 1 : 0; save(); if (k === 'm' && !v) music(null); },
    vol(k, n) { pref[k] = Math.max(0, Math.min(100, Math.round(n))); save(); if (ctx) { if (k === 'vm') musicBus.gain.setTargetAtTime(mv(), ctx.currentTime, .05); if (k === 'vf') fxBus.gain.setTargetAtTime(fv(), ctx.currentTime, .05); } },
    get playing() { return kind; } };
  return SND;
})();

