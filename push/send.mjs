// Angelito · envío de notificaciones con la app cerrada.
// Lo ejecuta GitHub Actions cada 5 minutos (.github/workflows/push.yml): revisa lo nuevo en Firestore
// y manda un aviso a cada teléfono que activó las notificaciones. Gratis (plan Spark): solo usa
// Firestore y Firebase Cloud Messaging con la cuenta de servicio guardada en el secreto FIREBASE_ADMIN_KEY.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getDatabase } from 'firebase-admin/database';
import { nightlyBackup, restoreBackup } from './backup.mjs';

const key = process.env.FIREBASE_ADMIN_KEY;
if (!key) { console.log('Falta el secreto FIREBASE_ADMIN_KEY: no se envía nada.'); process.exit(0); }
const SA = JSON.parse(key);
initializeApp({ credential: cert(SA), databaseURL: process.env.RTDB_URL || `https://${SA.project_id}-default-rtdb.firebaseio.com` });
const db = getFirestore(), fcm = getMessaging();
const BASE = process.env.APP_URL || 'https://angelito-2026.web.app/';

const now = Date.now();
const stateRef = db.doc('push/state');
const st = (await stateRef.get()).data() || {};
// la primera vez solo mira los últimos 10 minutos; nunca más de 1 hora atrás (si GitHub se atrasó)
const since = Math.max(st.last || now - 10 * 60e3, now - 60 * 60e3);
const ms = t => !t ? 0 : typeof t === 'number' ? t : t.toMillis ? t.toMillis() : 0;

// Primero se mira si hay algo nuevo (consultas baratas). Solo si hay algo se leen personas y teléfonos:
// así, aunque corra cada minuto, casi no gasta lecturas del plan gratis.
const PRUEBA = process.env.PRUEBA === '1';
const chatQ = await db.collection('chat').where('ts', '>', since).orderBy('ts').get();
const noticesQ = await db.collection('notices').where('ts', '>', since).get();
const actsQ = await db.collection('activities').where('at', '>', new Date(since)).get();
const hintsQ = await db.collection('hints').where('ts', '>', since - 10 * 60e3).get();
// 🎮 las invitaciones a jugar viven en Realtime Database (invites/{a quién}/{mesa})
const invs = [];
try { const all = (await getDatabase().ref('invites').get()).val() || {}, old = {}; for (const [to, m] of Object.entries(all)) for (const [k, v] of Object.entries(m || {})) { if ((+v?.ts || 0) > since) invs.push({ to, ...v }); else if (now - (+v?.ts || 0) > 864e5) old[`${to}/${k}`] = null; } if (Object.keys(old).length) await getDatabase().ref('invites').update(old); /* las de más de un día se limpian */ } catch (e) { console.log('Invitaciones: no se pudieron leer.'); }
const draw = (await db.doc('config/draw').get()).data();
const ev = (await db.doc('config/event').get()).data() || {};
const open = !!ev.revealNow || (ev.revealAt && ms(ev.revealAt) <= now);
const openKey = open ? String(ev.revealNow ? 'now' : ms(ev.revealAt)) : '';
const seenH = new Set(st.hints || []);
// ⏰ Recordatorios automáticos (hora de RD, UTC-4): una sola vez cada uno, entre 9 a. m. y 8 p. m.
const loc = new Date(now - 4 * 3600e3), today = loc.toISOString().slice(0, 10), hourL = loc.getUTCHours();
const evDay = String(ev.eventDate || '').slice(0, 10), dl = String(ev.rsvpDeadline || '').slice(0, 10);
const daysTo = d => d ? Math.round((Date.parse(d) - Date.parse(today)) / 864e5) : null;
const remSent = new Set(st.rem || []), dueRem = [];
if (hourL >= 9 && hourL < 20 && evDay) {
  const dt = daysTo(evDay);
  if (dt === 10) dueRem.push('wish10');
  if (dt === 7) dueRem.push('buy7');
  if (dt === 2) dueRem.push('buy2');
  if (dt === 1) dueRem.push('eve1');
  if (dt === 0 && hourL >= 8) dueRem.push('day0');
  if (dl && daysTo(dl) === 1) dueRem.push('rsvp1');
}
const remKey = k => `${k}:${evDay}`;
const remDue = dueRem.filter(k => !remSent.has(remKey(k)));
// 🗄️ Restaurar una copia (solo a mano, con confirmación escrita)
if (process.env.RESTAURAR) {
  if (process.env.CONFIRMAR !== 'RESTAURAR') { console.log('Para restaurar escribe RESTAURAR en «confirmar».'); process.exit(0); }
  await restoreBackup({ db, rdb: getDatabase(), sa: SA, day: process.env.RESTAURAR.trim(), cols: (process.env.COLECCIONES || '').split(',').map(x => x.trim()).filter(Boolean) });
  process.exit(0);
}
// 🗄️ Copia de seguridad de cada noche
try { await nightlyBackup({ db, rdb: getDatabase(), sa: SA, st, stateRef, now, force: process.env.COPIA === '1' }); } catch (e) { console.log('Copia de seguridad: falló (' + String(e?.message || e).slice(0, 80) + ').'); }
// 🐞 Errores de la app: cada hora se resume en el registro (solo el mensaje técnico) y se borran los de más de 7 días
if (!st.errAt || now - st.errAt > 3600e3 || process.env.ERRORES === '1') {
  try {
    const r = getDatabase().ref('errs'), all = (await r.orderByChild('ts').startAt(now - 7 * 864e5).get()).val() || {}, by = {};
    for (const v of Object.values(all)) if ((+v.ts || 0) > (process.env.ERRORES === '1' ? now - 864e5 : (st.errAt || now - 3600e3))) { const k = String(v.m).slice(0, 90) + ' @ ' + String(v.s || '').slice(0, 60); by[k] = (by[k] || 0) + 1; }
    for (const [k, n] of Object.entries(by)) console.log(`🐞 ${n}× ${k}`);
    const old = (await r.orderByChild('ts').endAt(now - 7 * 864e5).get()).val() || {}; if (Object.keys(old).length) await r.update(Object.fromEntries(Object.keys(old).map(k => [k, null])));
    await stateRef.set({ errAt: now }, { merge: true });
  } catch (e) { console.log('Errores: no se pudieron revisar.'); }
}
// 🎮 Quién puede usar la base de juegos: copia de los participantes (al momento en que alguien entra o sale; y cada 30 min por si acaso)
// En cada vuelta solo se CUENTA a los participantes (cuesta 1 lectura): si alguien entró o salió, se copia la lista al momento.
let memN = -1; try { memN = (await db.collection('participants').count().get()).data().count; } catch { }
if (!st.memAt || now - st.memAt > 1800e3 || (memN >= 0 && memN !== st.memN)) {
  try {
    const ids = (await db.collection('participants').select().get()).docs.map(d => d.id);
    await getDatabase().ref('members').set(Object.fromEntries(ids.map(id => [id, true])));
    await stateRef.set({ memAt: now, memN: ids.length }, { merge: true }); st.memAt = now; st.memN = ids.length;
  } catch (e) { console.log('Miembros de juegos: no se pudieron copiar.'); }
}
// 🏆 Torneo: el servidor mira quién ganó cada mesa del torneo, arma la ronda siguiente y corona al campeón
try {
  const rdb = getDatabase(), tr = rdb.ref('tourn'), T = (await tr.get()).val();
  if (T?.status === 'play' && Array.isArray(T.rounds)) {
    const rs = T.rounds, U = {};
    for (let r = 0; r < rs.length; r++) for (let i = 0; i < (rs[r] || []).length; i++) {
      const m = rs[r][i]; if (!m || m.w != null) continue;
      if (!m.t?.[1]) { m.w = 0; U[`rounds/${r}/${i}/w`] = 0; continue; }
      if (!m.gid) continue;
      const g = (await rdb.ref('games/' + m.gid).get()).val();
      if (!g) { U[`rounds/${r}/${i}/gid`] = null; continue; } // la mesa se cerró sin terminar: se puede volver a jugar
      const wins = Array.isArray(g.winners) ? g.winners : Object.values(g.winners || {});
      if (g.status === 'done' && wins.length) { const k = (m.t[0] || []).includes(wins[0]) ? 0 : (m.t[1] || []).includes(wins[0]) ? 1 : -1; if (k >= 0) { m.w = k; U[`rounds/${r}/${i}/w`] = k; } }
    }
    const last = rs[rs.length - 1] || [];
    if (last.length && last.every(m => m?.w != null)) {
      const adv = last.map(m => m.t[m.w]);
      if (adv.length === 1) { U.status = 'done'; U.champ = adv[0]; U.end = now; }
      else { const nr = []; for (let i = 0; i < adv.length; i += 2) nr.push(adv[i + 1] ? { t: [adv[i], adv[i + 1]] } : { t: [adv[i], null], w: 0 }); U[`rounds/${rs.length}`] = nr; }
    }
    if (Object.keys(U).length) { await tr.update(U); console.log('Torneo actualizado.'); }
  }
} catch (e) { console.log('Torneo: no se pudo revisar.'); }
// 🧹 Mesas de juego abandonadas: las cierra el servidor (aunque nadie abra la app). A los ganadores que aún no
// anotaron su victoria se la anota antes de borrar. Sala 20 min · partida 2 h · terminada 10 min · vacía: al momento.
try {
  const rdb = getDatabase(), games = (await rdb.ref('games').orderByChild('updatedAt').endAt(now - 10 * 60e3).get()).val() || {}, U = {};
  for (const [gid, g] of Object.entries(games)) {
    const st = g?.status, age = now - (+g?.updatedAt || 0), players = Array.isArray(g?.players) ? g.players : Object.values(g?.players || {});
    if (players.length && age < (st === 'done' ? 10 * 60e3 : st === 'lobby' ? 20 * 60e3 : 2 * 3600e3)) continue;
    if (st === 'done') for (const w of (Array.isArray(g.winners) ? g.winners : Object.values(g.winners || {}))) if (!/^bot\d$/.test(w)) U[`wins/${g.round ? `${gid}_${g.round}_${w}` : `${gid}_${w}`}`] = { uid: w, gid, type: g.type || '', at: +g.updatedAt || now };
    for (const c of ['games', 'hands', 'emotes', 'gchat', 'queue']) U[`${c}/${gid}`] = null;
  }
  if (Object.keys(U).length) { await rdb.ref().update(U); console.log('Mesas abandonadas cerradas.'); }
} catch (e) { console.log('Mesas: no se pudieron revisar.'); }
// 🏆 Una sola vez: la tabla de campeones de antes (Firestore) se copia a Realtime Database, donde viven los juegos ahora
if (!st.winsMig) {
  try {
    const ws = (await db.collection('gameWins').get()).docs, U = {};
    for (const d of ws) { const v = d.data(); if (v.uid && v.gid) U[d.id.replace(/[.#$\[\]/]/g, '_')] = { uid: v.uid, gid: v.gid, type: v.type || '', at: +v.at || 0 }; }
    if (Object.keys(U).length) await getDatabase().ref('wins').update(U);
    await stateRef.set({ winsMig: true }, { merge: true }); console.log('Campeones copiados a la base de juegos.');
  } catch (e) { console.log('Campeones: no se pudieron copiar todavía.'); }
}
// 🔀 Ajuste programado del sorteo (lo programa el organizador). Aquí NUNCA se escriben nombres ni parejas en el
// registro: GitHub guarda estos registros y otras personas podrían leerlos.
let fixReady = false;
let fx = ev.fix;
// Botón manual del organizador (Actions → Run workflow → «ajuste»): hace el ajuste YA.
if (process.env.AJUSTE === '1' && draw?.ids?.length && !(fx && fx.status === 'scheduled')) {
  fx = { id: 'sys' + now.toString(36), at: now, status: 'scheduled' };
  await db.doc('config/event').set({ fix: fx }, { merge: true });
}
if (fx && fx.status === 'scheduled' && +fx.at <= now && draw?.ids?.length) {
  try { fixReady = await runFix(fx); console.log(fixReady ? 'Ajuste del sorteo aplicado.' : 'Ajuste del sorteo: nada que aplicar.'); }
  catch (e) { console.log('Ajuste del sorteo: no se pudo aplicar.'); await db.doc('config/event').set({ fix: { ...fx, status: 'failed' } }, { merge: true }).catch(() => { }); }
}
async function runFix(fx) {
  const evRef = db.doc('config/event');
  const claimed = await db.runTransaction(async t => { const f = (await t.get(evRef)).data()?.fix; if (!f || f.id !== fx.id || f.status !== 'scheduled') return false; t.set(evRef, { fix: { ...f, status: 'running' } }, { merge: true }); return true; });
  if (!claimed) return false;
  // quien ya no existe como participante (p. ej. se borró por error) también sale del sorteo
  const alive = new Set((await db.collection('participants').select().get()).docs.map(d => d.id));
  const drop = [...new Set([...(fx.drop || []), ...draw.ids.filter(d => !alive.has(d))])].filter(d => draw.ids.includes(d)), ids = draw.ids.filter(g => !drop.includes(g)), rec = {}, spun = new Set();
  for (const d of (await db.collection('assignments').get()).docs) if (draw.ids.includes(d.id)) { rec[d.id] = d.data().recipient; if (d.data().revealed || d.data().spunEver) spun.add(d.id); } // «ya giró alguna vez» (spunEver): ningún ajuste lo borra
  const orig = { ...rec };
  // 👋 quien sale del sorteo: a quien le regalaba a esa persona le pasa la persona que le tocaba a ella (se cierra la cadena)
  for (const d of drop) {
    const g = Object.keys(rec).find(k => rec[k] === d);
    // si su asignación ya se había borrado, su persona es la que quedó sin angelito
    const r = rec[d] || draw.ids.find(x => !drop.includes(x) && !Object.values(rec).includes(x)); // si queda «a sí mismo», los cambios de abajo lo arreglan
    if (g) { if (!r) throw new Error('cadena'); rec[g] = r; } delete rec[d];
  }
  const pairs = (await db.doc('drawRules/main').get()).data()?.pairs || [], blocked = new Set();
  for (const r of pairs) { blocked.add(r.a + '>' + r.b); if (r.both) blocked.add(r.b + '>' + r.a); }
  const ok = (g, r) => !!r && g !== r && !blocked.has(g + '>' + r);
  const before = orig, givers = ids.filter(g => rec[g]);
  const rnd = n => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
  // cambia la persona de «v» con la de otro al azar, siempre que los dos queden cumpliendo las restricciones
  const swap = (v, avoid) => {
    const opts = givers.filter(y => y !== v && !avoid.includes(y) && ok(v, rec[y]) && ok(y, rec[v]));
    if (!opts.length) return null;
    const fresh = opts.filter(y => !spun.has(y)), pool = fresh.length ? fresh : opts; // primero con quienes AÚN NO han girado: nunca vieron su persona, así que no deja rastro
    const y = pool[rnd(pool.length)]; [rec[v], rec[y]] = [rec[y], rec[v]]; return y;
  };
  console.log('Ajuste: ' + (givers.some(g => !ok(g, rec[g])) ? 'hay restricciones por corregir' : 'no hay restricciones incumplidas') + (drop.length ? ' · se cierra la cadena de quien salió' : ''));
  for (const v of givers) if (!ok(v, rec[v])) {
    const y = swap(v, []); if (!y) throw new Error('sin salida');
    swap(v, [y]); // segundo cambio: así nadie puede deducir la pareja nueva a partir de la vieja
  }
  if (givers.some(g => !ok(g, rec[g]))) throw new Error('incumple');
  if (!drop.length && givers.every(g => rec[g] === orig[g])) { await evRef.set({ fix: { ...fx, status: 'done', doneAt: Date.now(), noop: true } }, { merge: true }); return false; } // nada que cambiar: nadie tiene que volver a girar
  const changed = givers.filter(g => rec[g] !== before[g]);
  const touchedRec = new Set(changed.flatMap(g => [before[g], rec[g]]));
  const ops = [];
  for (const g of givers) ops.push(b => b.set(db.doc('assignments/' + g), { recipient: rec[g], revealed: false, revealedAt: FieldValue.delete(), ...(spun.has(g) ? { spunEver: true } : {}) }, { merge: true }));
  for (const g of changed) for (const c of ['giftStatus', 'wishPick', 'hintsSent']) ops.push(b => b.delete(db.doc(`${c}/${g}`)));
  for (const r of touchedRec) { ops.push(b => b.delete(db.doc('giftIncoming/' + r))); ops.push(b => b.delete(db.doc('thanks/' + r))); }
  for (const d of (await db.collection('hints').get()).docs) if (touchedRec.has(d.data().to)) ops.push(b => b.delete(d.ref));
  if (drop.length) {
    ops.push(b => b.set(db.doc('config/draw'), { ids, n: ids.length }, { merge: true }));
    for (const d of drop) {
      const pp = (await db.doc('participants/' + d).get()).data() || {};
      if (pp.nameKey) ops.push(b => b.delete(db.doc('names/' + pp.nameKey)));
      for (const t of (await db.collection('fcmTokens').where('uid', '==', d).get()).docs) ops.push(b => b.delete(t.ref));
      for (const c of ['participants', 'assignments', 'attendance', 'profiles', 'staff', 'giftStatus', 'giftIncoming', 'guesses', 'angelGuess', 'wishPick', 'thanks', 'hintsSent', 'presence', 'chatSeen']) ops.push(b => b.delete(db.doc(`${c}/${d}`)));
      ops.push(b => b.set(db.doc('banned/' + d), { at: FieldValue.serverTimestamp() }));
      for (const c of ['wishes', 'wishImg', 'activitySignups', 'sugVotes', 'chatReacts', 'votes']) for (const w of (await db.collection(c).where('uid', '==', d).get()).docs) ops.push(b => b.delete(w.ref));
    }
  }
  ops.push(b => b.set(evRef, { fix: { ...fx, status: 'done', doneAt: Date.now() } }, { merge: true }));
  for (let i = 0; i < ops.length; i += 400) { const b = db.batch(); ops.slice(i, i + 400).forEach(f => f(b)); await b.commit(); }
  return true;
}
const nothing = !PRUEBA && !fixReady && !remDue.length && !invs.length && chatQ.empty && noticesQ.empty && actsQ.empty && !(draw && ms(draw.at) > since)
  && !(open && st.revealSent !== openKey) && hintsQ.docs.every(d => seenH.has(d.id));
if (nothing) { await stateRef.set({ last: now }, { merge: true }); console.log('Nada nuevo.'); process.exit(0); }

const people = Object.fromEntries((await db.collection('participants').get()).docs.map(d => [d.id, d.data()]));
const short = uid => { const p = people[uid]; return p ? `${p.first} ${(p.last || '')[0] || ''}.`.trim() : 'Alguien'; };
const all = Object.keys(people);

// out[uid][cat] = { title, body, url }: un aviso por persona y categoría en cada vuelta
const out = {};
const put = (uid, cat, msg) => { if (!people[uid]) return; (out[uid] ||= {})[cat] = msg; };

// 💬 chat y 📣 menciones
const chat = chatQ.docs.map(d => d.data());
if (chat.length) {
  const last = chat[chat.length - 1];
  // lo que cada quien ya leyó en la app no se le avisa (ni se le avisa si está mirando el chat ahora mismo)
  const seen = Object.fromEntries((await db.collection('chatSeen').get()).docs.map(d => [d.id, d.data()]));
  for (const uid of all) {
    const sv = seen[uid] || {}, upTo = +sv.ts || 0, active = ms(sv.at) > now - 3 * 60e3;
    const mine = chat.filter(m => m.uid !== uid && (m.ts || 0) > upTo); if (!mine.length || (active && !mine.some(m => (m.mentions || []).includes(uid)))) continue;
    const tag = mine.filter(m => (m.mentions || []).includes(uid) || (m.mentions || []).includes('all'));
    if (tag.length) { const m = tag[tag.length - 1]; put(uid, 'mencion', { title: (m.mentions || []).includes('all') ? `📣 ${short(m.uid)} avisó a todo el grupo` : `📣 ${short(m.uid)} te mencionó`, body: m.text.slice(0, 140), url: '#chat' }); continue; }
    const m = mine[mine.length - 1];
    const txt = (m.text || '').trim() || (m.hasImg ? '📷 Foto' : 'Mensaje');
    put(uid, 'chat', { title: `💬 ${short(m.uid)}`, body: txt.slice(0, 140) + (mine.length > 1 ? ` · +${mine.length - 1} más` : ''), url: '#chat' }); // como WhatsApp: el nombre arriba, el mensaje abajo
  }
}
// 📣 avisos del organizador
for (const n of noticesQ.docs.map(d => d.data()))
  if (!n.target || n.target === 'all') for (const uid of all) put(uid, 'avisos', { title: `📣 ${n.title || 'Aviso'}`, body: (n.body || '').slice(0, 140), url: '#inicio', skipDev: n.dev || '' });
// 📅 actividades nuevas
for (const d of actsQ.docs) {
  const a = d.data(); for (const uid of all) put(uid, 'actividades', { title: `📅 Nueva actividad: ${a.title}`, body: a.date || '', url: `#actividad-${d.id}`, skipDev: a.dev || '' });
}
// 🔀 ajuste del sorteo listo: el MISMO aviso para todos
if (fixReady) for (const uid of draw.ids || []) put(uid, 'avisos', { title: '🔀 El ajuste del sorteo está listo', body: 'Entra y gira tu ruleta otra vez para ver tu persona definitiva. 🤫', url: '#ruleta' });
// 🎡 sorteo listo
if (draw && ms(draw.at) > since) for (const uid of draw.ids || []) put(uid, 'avisos', { title: '🎡 ¡La ruleta ya está habilitada!', body: 'Entra y descubre a quién te toca regalar.', url: '#ruleta' });
// 💌 buzón anónimo abierto (por fecha u hora, o porque el organizador lo abrió)
if (open && st.revealSent !== openKey) for (const uid of all) put(uid, 'avisos', { title: '💌 ¡Se abrió el buzón anónimo!', body: 'Entra a leer todos los mensajes.', url: '#anonimos' });
// 💌 pistas del angelito (su hora se redondea a 10 min por privacidad: se recuerdan las ya enviadas)
const newH = [];
for (const d of hintsQ.docs) {
  if (seenH.has(d.id)) continue; newH.push(d.id);
  put(d.data().to, 'angelito', { title: '💌 ¡Tu angelito te mandó una pista!', body: (d.data().text || '').slice(0, 140), url: '#ruleta' });
}

// 🎮 invitaciones a una mesa de juego
for (const v of invs) { put(v.to, 'juegos', { title: `🎮 ${short(v.from)} te invitó a jugar`, body: `${v.title || 'Una partida'} · ¿te unes?`, url: `#juego-${v.game}`, kind: 'invite', game: v.game }); }

// ⏰ recordatorios
if (remDue.length) {
  const evAt = ev.eventDate ? new Date(ev.eventDate + (ev.eventDate.length <= 10 ? 'T12:00' : '')) : null;
  const hora = evAt && !isNaN(evAt) && ev.eventDate.length > 10 ? evAt.toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' }) : '';
  const lugar = ev.place ? ` en ${ev.place}` : '';
  const drawIds = draw?.ids || all;
  const needCol = c => remDue.some(k => c.includes(k));
  const att = needCol(['rsvp1']) ? Object.fromEntries((await db.collection('attendance').get()).docs.map(d => [d.id, d.data().status])) : {};
  const hasW = needCol(['wish10']) ? new Set((await db.collection('wishes').get()).docs.map(d => d.data().uid)) : new Set();
  for (const k of remDue) {
    if (k === 'wish10') for (const uid of all) if (!hasW.has(uid)) put(uid, 'avisos', { title: '🎁 Escribe tu lista de deseos', body: 'Faltan 10 días: ayuda a tu angelito a acertar con tu regalo.', url: '#deseos' });
    if (k === 'buy7') for (const uid of drawIds) put(uid, 'avisos', { title: '🛍️ Falta una semana', body: '¿Ya tienes el regalo de tu angelito? Que no te agarre la última hora 🎁', url: '#ruleta' });
    if (k === 'buy2') for (const uid of drawIds) put(uid, 'avisos', { title: '⏰ ¡Faltan 2 días!', body: '¿Ya tienes el regalo de tu angelito? No lo dejes para última hora 😉', url: '#ruleta' });
    if (k === 'eve1') for (const uid of all) put(uid, 'avisos', { title: '🎄 ¡Mañana es el angelito!', body: `${hora ? 'A las ' + hora : 'Mañana'}${lugar}. ¡No olvides el regalo envuelto! 🎁`, url: '#inicio' });
    if (k === 'day0') for (const uid of all) put(uid, 'avisos', { title: '🎁 ¡Hoy es el angelito!', body: `${hora ? 'Te esperamos a las ' + hora : 'Te esperamos'}${lugar}.`, url: '#inicio' });
    if (k === 'rsvp1') for (const uid of all) if (!att[uid]) put(uid, 'avisos', { title: '📝 Mañana se cierra la confirmación', body: '¿Vas al angelito? Confírmalo en la app.', url: '#inicio' });
  }
  console.log('Recordatorios:', remDue.join(', '));
}

// prueba manual: un aviso a todos los teléfonos registrados
if (PRUEBA) for (const uid of all) put(uid, 'avisos', { title: '🔔 Prueba de notificaciones', body: 'Si ves esto, los avisos con la app cerrada funcionan 🎁', url: '#inicio' });

// enviar
let sent = 0, dropped = 0;
// Un teléfono pertenece solo a la última persona que entró en él: si antes entró otra cuenta (una de prueba, por ejemplo),
// ese registro viejo se borra para que nadie reciba en su teléfono los avisos de otra persona (ni los de sus propios mensajes).
const allTok = (await db.collection('fcmTokens').get()).docs, byTok = new Map();
for (const d of allTok) { const t = d.data().token; if (!t) continue; const prev = byTok.get(t); if (!prev || ms(d.data().at) > ms(prev.data().at)) byTok.set(t, d); }
const stale = allTok.filter(d => d.data().token && byTok.get(d.data().token) !== d);
await Promise.all(stale.map(d => d.ref.delete().catch(() => { })));
if (stale.length) console.log(`Registros repetidos de un mismo teléfono borrados: ${stale.length}`);
const tokens = [...byTok.values()];
const conAvisos = new Set(tokens.map(t => t.data().uid));
console.log(`Teléfonos con avisos activados: ${tokens.length} (${conAvisos.size} personas de ${all.length}).`);
if (Object.keys(out).length) {
  const jobs = [], done = new Set();
  for (const t of tokens) {
    const { uid, token, off = [] } = t.data(); const mine = out[uid]; if (!mine || !token || done.has(token)) continue; done.add(token); // un aviso por teléfono
    // si hay varias cosas a la vez, va la más importante
    const dev = t.data().dev || ''; // lo que se mandó desde este mismo teléfono no le llega a él
    const cat = ['mencion', 'juegos', 'angelito', 'avisos', 'actividades', 'chat'].find(c => mine[c] && (PRUEBA || !off.includes(c)) && !(dev && mine[c].skipDev === dev)); if (!cat) continue;
    const m = mine[cat];
    jobs.push(fcm.send({ token, data: { title: m.title, body: m.body, url: BASE + m.url, cat, ...(m.kind ? { kind: m.kind, game: m.game || '' } : {}) },
      webpush: { headers: { Urgency: cat === 'chat' ? 'normal' : 'high', TTL: '86400' } } })
      .then(() => { sent++; })
      .catch(e => { const c = e?.errorInfo?.code || e.code || ''; if (/registration-token-not-registered|invalid-registration-token|invalid-argument/.test(c)) { dropped++; return t.ref.delete(); } console.warn('fcm', c); }));
  }
  await Promise.all(jobs);
}
await stateRef.set({ rem: [...remSent, ...remDue.map(remKey)].slice(-60), last: now, revealSent: open ? openKey : (st.revealSent || ''), hints: [...seenH, ...newH].slice(-200), at: FieldValue.serverTimestamp(), sent, dropped }, { merge: true });
console.log(`Listo: ${sent} avisos enviados, ${dropped} teléfonos dados de baja.`);
