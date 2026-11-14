// Angelito · envío de notificaciones con la app cerrada.
// Lo ejecuta GitHub Actions cada 5 minutos (.github/workflows/push.yml): revisa lo nuevo en Firestore
// y manda un aviso a cada teléfono que activó las notificaciones. Gratis (plan Spark): solo usa
// Firestore y Firebase Cloud Messaging con la cuenta de servicio guardada en el secreto FIREBASE_ADMIN_KEY.
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const key = process.env.FIREBASE_ADMIN_KEY;
if (!key) { console.log('Falta el secreto FIREBASE_ADMIN_KEY: no se envía nada.'); process.exit(0); }
initializeApp({ credential: cert(JSON.parse(key)) });
const db = getFirestore(), fcm = getMessaging();
const BASE = process.env.APP_URL || 'https://angelito-2026.web.app/';

const now = Date.now();
const stateRef = db.doc('push/state');
const st = (await stateRef.get()).data() || {};
// la primera vez solo mira los últimos 10 minutos; nunca más de 1 hora atrás (si GitHub se atrasó)
const since = Math.max(st.last || now - 10 * 60e3, now - 60 * 60e3);
const ms = t => !t ? 0 : typeof t === 'number' ? t : t.toMillis ? t.toMillis() : 0;

const people = Object.fromEntries((await db.collection('participants').get()).docs.map(d => [d.id, d.data()]));
const short = uid => { const p = people[uid]; return p ? `${p.first} ${(p.last || '')[0] || ''}.`.trim() : 'Alguien'; };
const all = Object.keys(people);

// out[uid][cat] = { title, body, url } — un aviso por persona y categoría en cada vuelta
const out = {};
const put = (uid, cat, msg) => { if (!people[uid]) return; (out[uid] ||= {})[cat] = msg; };

// 💬 chat y 📣 menciones
const chat = (await db.collection('chat').where('ts', '>', since).orderBy('ts').get()).docs.map(d => d.data());
if (chat.length) {
  const last = chat[chat.length - 1];
  for (const uid of all) {
    const mine = chat.filter(m => m.uid !== uid); if (!mine.length) continue;
    const tag = mine.filter(m => (m.mentions || []).includes(uid));
    if (tag.length) { const m = tag[tag.length - 1]; put(uid, 'mencion', { title: `📣 ${short(m.uid)} te mencionó`, body: m.text.slice(0, 140), url: '#chat' }); continue; }
    const m = mine[mine.length - 1];
    put(uid, 'chat', { title: mine.length === 1 ? '💬 Nuevo mensaje en el chat' : `💬 ${mine.length} mensajes nuevos en el chat`, body: `${short(m.uid)}: ${m.text.slice(0, 120)}`, url: '#chat' });
  }
}
// 📣 avisos del organizador
for (const n of (await db.collection('notices').where('ts', '>', since).get()).docs.map(d => d.data()))
  if (!n.target || n.target === 'all') for (const uid of all) put(uid, 'avisos', { title: `📣 ${n.title || 'Aviso'}`, body: (n.body || '').slice(0, 140), url: '#inicio' });
// 📅 actividades nuevas
for (const d of (await db.collection('activities').where('at', '>', new Date(since)).get()).docs) {
  const a = d.data(); for (const uid of all) put(uid, 'actividades', { title: `📅 Nueva actividad: ${a.title}`, body: a.date || '', url: `#actividad-${d.id}` });
}
// 🎡 sorteo listo
const draw = (await db.doc('config/draw').get()).data();
if (draw && ms(draw.at) > since) for (const uid of draw.ids || []) put(uid, 'avisos', { title: '🎡 ¡La ruleta ya está habilitada!', body: 'Entra y descubre a quién te toca regalar.', url: '#ruleta' });
// 💌 buzón anónimo abierto (por fecha u hora, o porque el organizador lo abrió)
const ev = (await db.doc('config/event').get()).data() || {};
const open = !!ev.revealNow || (ev.revealAt && ms(ev.revealAt) <= now);
const openKey = open ? String(ev.revealNow ? 'now' : ms(ev.revealAt)) : '';
if (open && st.revealSent !== openKey) for (const uid of all) put(uid, 'avisos', { title: '💌 ¡Se abrió el buzón anónimo!', body: 'Entra a leer todos los mensajes.', url: '#anonimos' });
// 💌 pistas del angelito (su hora se redondea a 10 min por privacidad: se recuerdan las ya enviadas)
const seenH = new Set(st.hints || []), newH = [];
for (const d of (await db.collection('hints').where('ts', '>', since - 10 * 60e3).get()).docs) {
  if (seenH.has(d.id)) continue; newH.push(d.id);
  put(d.data().to, 'angelito', { title: '💌 ¡Tu angelito te mandó una pista!', body: (d.data().text || '').slice(0, 140), url: '#ruleta' });
}

// enviar
let sent = 0, dropped = 0;
if (Object.keys(out).length) {
  const tokens = (await db.collection('fcmTokens').get()).docs;
  const jobs = [], done = new Set();
  for (const t of tokens) {
    const { uid, token, off = [] } = t.data(); const mine = out[uid]; if (!mine || !token || done.has(token)) continue; done.add(token); // un aviso por teléfono
    // si hay varias cosas a la vez, va la más importante
    const cat = ['mencion', 'angelito', 'avisos', 'actividades', 'chat'].find(c => mine[c] && !off.includes(c)); if (!cat) continue;
    const m = mine[cat];
    jobs.push(fcm.send({ token, data: { title: m.title, body: m.body, url: BASE + m.url, cat },
      webpush: { headers: { Urgency: cat === 'chat' ? 'normal' : 'high', TTL: '86400' } } })
      .then(() => { sent++; })
      .catch(e => { const c = e?.errorInfo?.code || e.code || ''; if (/registration-token-not-registered|invalid-registration-token|invalid-argument/.test(c)) { dropped++; return t.ref.delete(); } console.warn('fcm', c); }));
  }
  await Promise.all(jobs);
}
await stateRef.set({ last: now, revealSent: open ? openKey : (st.revealSent || ''), hints: [...seenH, ...newH].slice(-200), at: FieldValue.serverTimestamp(), sent, dropped }, { merge: true });
console.log(`Listo: ${sent} avisos enviados, ${dropped} teléfonos dados de baja.`);
