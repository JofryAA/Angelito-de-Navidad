// 🗄️ Copia de seguridad: una vez por noche (3 a. m. hora de RD) el servidor guarda TODO lo importante de Firestore
// (sorteo, personas, deseos, asistencia, aportes, chat, anónimos…) comprimido y CIFRADO en Realtime Database
// (backups/AAAA-MM-DD). Se guardan las últimas 7 noches. Nadie la puede leer desde la app (las reglas lo prohíben)
// y aunque alguien la vea en la consola, está cifrada con una clave que sale de la cuenta de servicio.
// Restaurar: Actions → «Notificaciones (app cerrada)» → Run workflow → restaurar = fecha · confirmar = RESTAURAR.
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { Timestamp } from 'firebase-admin/firestore';

// fotos pesadas, cosas que se rehacen solas o que viven en otra base: no se copian
const SKIP = new Set(['chatImg', 'wishImg', 'photos', 'photosFull', 'push', 'fcmTokens', 'presence', 'chatSeen', 'games', 'gameInvites', 'gameWins']);
const keyOf = sa => createHash('sha256').update('angelito-backup:' + sa.private_key).digest();
const enc = v => v instanceof Timestamp ? { __ts: v.toMillis() } : Array.isArray(v) ? v.map(enc) : v && typeof v === 'object' && v.constructor === Object ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) : v && typeof v === 'object' && typeof v.path === 'string' ? { __ref: v.path } : v;
const dec = (v, db) => Array.isArray(v) ? v.map(x => dec(x, db)) : v && typeof v === 'object' ? ('__ts' in v ? Timestamp.fromMillis(v.__ts) : '__ref' in v ? db.doc(v.__ref) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dec(x, db)]))) : v;

export async function nightlyBackup({ db, rdb, sa, st, stateRef, now, force = false }) {
  const loc = new Date(now - 4 * 3600e3), day = loc.toISOString().slice(0, 10);
  if (!force && (loc.getUTCHours() !== 3 || st.bkDay === day)) return;
  await stateRef.set({ bkDay: day }, { merge: true }); // se marca ANTES: si falla, no se reintenta cada 2 minutos (gastaría la cuota)
  const dump = {}; let n = 0;
  for (const col of await db.listCollections()) {
    if (SKIP.has(col.id)) continue;
    const docs = (await col.get()).docs; dump[col.id] = Object.fromEntries(docs.map(d => [d.id, enc(d.data())])); n += docs.length;
  }
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', keyOf(sa), iv);
  const data = Buffer.concat([c.update(gzipSync(Buffer.from(JSON.stringify(dump)))), c.final()]);
  if (data.length > 7e6) { console.log(`Copia de seguridad: demasiado grande (${Math.round(data.length / 1e6)} MB), no se guardó.`); return; }
  await rdb.ref('backups/' + day).set({ iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64'), n, at: now });
  const all = Object.keys((await rdb.ref('backups').orderByChild('at').limitToFirst(20).get()).val() || {}).sort(); // (igual baja las copias; son pocas)
  if (all.length > 7) await rdb.ref('backups').update(Object.fromEntries(all.slice(0, all.length - 7).map(k => [k, null])));
  await stateRef.set({ bkDay: day }, { merge: true });
  console.log(`Copia de seguridad guardada (${n} registros, ${Math.round(data.length / 1024)} KB).`);
}

export async function restoreBackup({ db, rdb, sa, day, cols }) {
  const b = (await rdb.ref('backups/' + day).get()).val(); if (!b) throw new Error('No hay copia de esa fecha');
  const d = createDecipheriv('aes-256-gcm', keyOf(sa), Buffer.from(b.iv, 'base64')); d.setAuthTag(Buffer.from(b.tag, 'base64'));
  const dump = JSON.parse(gunzipSync(Buffer.concat([d.update(Buffer.from(b.data, 'base64')), d.final()])).toString());
  const want = cols?.length ? cols : Object.keys(dump); let n = 0;
  for (const col of want) {
    const docs = Object.entries(dump[col] || {});
    for (let i = 0; i < docs.length; i += 400) { const bt = db.batch(); docs.slice(i, i + 400).forEach(([id, v]) => bt.set(db.doc(`${col}/${id}`), dec(v, db))); await bt.commit(); }
    n += docs.length;
  }
  console.log(`Restaurado desde ${day}: ${n} registros (${want.length} colecciones).`);
}
