// 🔐 CAJA FUERTE DEL ANGELITO (lado del servidor)
// ------------------------------------------------------------------------------------------------
// Objetivo: que NADIE —ni el organizador, ni quien sea dueño del proyecto de Firebase— pueda ver en la base de
// datos quién le regala a quién, ni quién escribió cada mensaje anónimo, hasta la gran revelación.
//
// Cómo:
//  • La pareja de cada persona se guarda CIFRADA (AES-256-GCM) en assignments/{quien regala}.vault.
//    La llave (K) NO está en la base: se deriva de la cuenta de servicio, que solo existe como secreto de GitHub.
//  • Cada teléfono crea su propia llave (ECDH P-256) y sube solo la parte pública (devkeys/). El servidor le prepara
//    una «cajita» (boxes.{teléfono}) con su persona, que solo ese teléfono puede abrir. La app la abre al girar.
//  • Para pistas y «estado del regalo» quien regala usa un token secreto (k); la base solo guarda sha256(k) en
//    angelKey/{persona}, así las reglas comprueban sin saber quién es quién.
//  • El sorteo se hace AQUÍ (no en el teléfono del organizador). Las parejas en claro solo existen un instante en la
//    memoria de esta tarea de GitHub y se publican únicamente en la revelación (reveal/main).
//  • Los autores de anónimos llegan cifrados con la llave pública del servidor y solo se abren en la revelación.
// Para auditar: este archivo + Web/js/app/00b-caja-fuerte.js + firestore.rules. Ver SEGURIDAD.md.
import { createHash, createECDH, createCipheriv, createDecipheriv, randomBytes, hkdfSync } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';

const b64 = b => Buffer.from(b).toString('base64'), unb64 = s => Buffer.from(String(s || ''), 'base64');
const INFO_BOX = 'angelito-caja-v1';

export function makeVault(sa) {
  const root = Buffer.from(hkdfSync('sha256', Buffer.from(sa.private_key), Buffer.from('angelito'), Buffer.from('caja-fuerte-v1'), 64));
  const K = root.subarray(0, 32);                                       // llave simétrica de la caja (solo servidor)
  const ecdh = createECDH('prime256v1'); ecdh.setPrivateKey(root.subarray(32, 64)); // llave del servidor
  const pub = ecdh.getPublicKey();                                      // 65 bytes; se publica en config/vault
  const gcm = (key, iv, data) => { const c = createCipheriv('aes-256-gcm', key, iv); return Buffer.concat([c.update(data), c.final(), c.getAuthTag()]); };
  const ungcm = (key, iv, data) => { const d = createDecipheriv('aes-256-gcm', key, iv); d.setAuthTag(data.subarray(data.length - 16)); return Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]); };
  const seal = obj => { const iv = randomBytes(12); return { iv: b64(iv), ct: b64(gcm(K, iv, Buffer.from(JSON.stringify(obj)))) }; };
  const open = v => JSON.parse(ungcm(K, unb64(v.iv), unb64(v.ct)).toString());
  // cajita para un teléfono (ECIES: ECDH efímero + HKDF + AES-GCM). Igual que en la app con WebCrypto.
  const boxFor = (devPubB64, obj) => {
    const e = createECDH('prime256v1'); e.generateKeys();
    const ePub = e.getPublicKey(), shared = e.computeSecret(unb64(devPubB64));
    const key = Buffer.from(hkdfSync('sha256', shared, ePub, Buffer.from(INFO_BOX), 32)), iv = randomBytes(12);
    return { e: b64(ePub), iv: b64(iv), ct: b64(gcm(key, iv, Buffer.from(JSON.stringify(obj)))) };
  };
  // abrir algo que la app cifró para el servidor (autores de anónimos)
  const openFromApp = box => {
    const ePub = unb64(box.e), shared = ecdh.computeSecret(ePub);
    const key = Buffer.from(hkdfSync('sha256', shared, ePub, Buffer.from(INFO_BOX), 32));
    return JSON.parse(ungcm(key, unb64(box.iv), unb64(box.ct)).toString());
  };
  return { seal, open, boxFor, openFromApp, pubB64: b64(pub) };
}
export const sha256 = s => createHash('sha256').update(String(s)).digest();
export const newToken = () => randomBytes(24).toString('base64url');

/* ---------------- sorteo (misma lógica que la app: una sola cadena si se puede; si no, emparejamiento exacto) ---------------- */
const rnd = n => { const a = new Uint32Array(1); globalThis.crypto.getRandomValues(a); return a[0] % n; };
const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = rnd(i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
export function drawPlan(ids, pairs) {
  const bad = new Set(); for (const r of pairs || []) { bad.add(r.a + '>' + r.b); if (r.both) bad.add(r.b + '>' + r.a); }
  const ok = (x, y) => x !== y && !bad.has(x + '>' + y), n = ids.length;
  const outs = Object.fromEntries(ids.map(x => [x, ids.filter(y => ok(x, y))]));
  if (n < 2 || ids.some(x => !outs[x].length) || ids.some(y => !ids.some(x => ok(x, y)))) return null;
  const ring = r => Object.fromEntries(r.map((x, i) => [x, r[(i + 1) % r.length]]));
  for (let t = 0; t < 3000; t++) { const r = shuffle([...ids]); if (r.every((x, i) => ok(x, r[(i + 1) % n]))) return ring(r); }
  const start = ids.reduce((m, x) => outs[x].length < outs[m].length ? x : m, ids[0]);
  const path = [start], used = new Set(path); let steps = 0;
  const go = () => {
    if (++steps > 300000) return false;
    const last = path[path.length - 1];
    if (path.length === n) return ok(last, start);
    const cand = shuffle(outs[last].filter(z => !used.has(z))).sort((a, b) => outs[a].filter(z => !used.has(z)).length - outs[b].filter(z => !used.has(z)).length);
    for (const y of cand) { path.push(y); used.add(y); if (go()) return true; path.pop(); used.delete(y); }
    return false;
  };
  if (go()) return ring(path);
  const match = {};
  const aug = (x, seen) => { for (const y of shuffle([...outs[x]])) { if (seen.has(y)) continue; seen.add(y); if (!match[y] || aug(match[y], seen)) { match[y] = x; return true; } } return false; };
  for (const x of shuffle([...ids])) if (!aug(x, new Set())) return null;
  return Object.fromEntries(Object.entries(match).map(([y, x]) => [x, y]));
}

/* ---------------- tareas que corre push/send.mjs en cada vuelta ---------------- */
export async function vaultTasks({ db, sa, now, log = console.log }) {
  const V = makeVault(sa), did = [];
  const cfg = db.doc('config/vault'), cv = (await cfg.get()).data() || {};
  if (cv.pub !== V.pubB64) { await cfg.set({ pub: V.pubB64, v: 1, at: now }, { merge: true }); did.push('llave'); }

  // 1) Migración única: parejas en claro → cifradas (y se borra el texto en claro)
  if (!cv.migrated) {
    const as = (await db.collection('assignments').get()).docs, b = db.batch(); let n = 0;
    for (const d of as) { const r = d.data().recipient; if (!r) continue; const k = newToken(); b.set(d.ref, { vault: V.seal({ r, k }), recipient: FieldValue.delete(), boxes: {} }, { merge: true }); b.set(db.doc('angelKey/' + r), { h: sha256(k) }); n++; }
    for (const d of (await db.collection('hintsSent').get()).docs) if (d.data().texts) b.set(d.ref, { n: (d.data().texts || []).length, texts: FieldValue.delete() }, { merge: true });
    for (const c of ['questionAuthors', 'suggestionAuthors']) for (const d of (await db.collection(c).get()).docs) { const u = d.data().uid; if (u) b.set(d.ref, { sealed: V.seal({ uid: u }), uid: FieldValue.delete() }, { merge: true }); }
    b.set(cfg, { migrated: now }, { merge: true }); await b.commit(); did.push(`migración (${n})`);
  }

  // 2) Pedidos del organizador: sortear / cambiar el uid de alguien (al restablecer su PIN)
  for (const op of (await db.collection('vaultOps').get()).docs) {
    const o = op.data(); try {
      if (o.op === 'draw') await doDraw(db, V, o.ids || []);
      if (o.op === 'remap' && o.from && o.to) await doRemap(db, V, o.from, o.to);
      did.push(o.op);
    } catch (e) { await db.doc('adminState/draw').set({ err: String(e.message || e).slice(0, 120), at: now }, { merge: true }); log('Caja fuerte: un pedido no se pudo hacer.'); }
    await op.ref.delete();
  }

  if (did.some(x => x === 'draw' || x === 'remap')) cv.boxAt = 0; // tras sortear o cambiar un uid: cajitas para TODOS los teléfonos
  // 3) Cajitas para cada teléfono nuevo de quien está en el sorteo
  const draw = (await db.doc('config/draw').get()).data();
  if (draw?.ids?.length) {
    const devs = (await db.collection('devkeys').where('at', '>', (cv.boxAt || 0) - 5 * 60e3).get()).docs.map(d => d.data()).filter(d => d.uid && d.dev && d.pub);
    if (devs.length) {
      const b = db.batch(); let n = 0;
      for (const dk of devs) {
        if (!draw.ids.includes(dk.uid)) continue;
        const a = (await db.doc('assignments/' + dk.uid).get()).data(); if (!a?.vault || a.boxes?.[dk.dev]?.for === dk.pub.slice(0, 16)) continue;
        try { b.set(db.doc('assignments/' + dk.uid), { boxes: { [dk.dev]: { ...V.boxFor(dk.pub, V.open(a.vault)), for: dk.pub.slice(0, 16) } } }, { merge: true }); n++; } catch { }
      }
      if (n) { await b.commit(); did.push(`cajitas (${n})`); }
    }
    if (devs.length || now - (cv.boxAt || 0) > 3600e3) await cfg.set({ boxAt: now }, { merge: true });
  }

  // 4) Cuántas parejas no cumplen las restricciones (solo el número, nunca quiénes) → para el «switch»
  const rdoc = (await db.doc('drawRules/main').get()).data() || {}, stamp = `${draw?.at?.toMillis?.() || 0}:${rdoc.at?.toMillis?.() || 0}:${did.join()}`;
  if (draw?.ids?.length && cv.badStamp !== stamp) { // solo cuando cambian el sorteo o las restricciones (para no gastar lecturas)
    await cfg.set({ badStamp: stamp }, { merge: true });
    const rules = rdoc.pairs || [], bl = new Set(); for (const r of rules) { bl.add(r.a + '>' + r.b); if (r.both) bl.add(r.b + '>' + r.a); }
    let bad = 0; for (const d of (await db.collection('assignments').get()).docs) { const v = d.data().vault; if (!v) continue; try { if (bl.has(d.id + '>' + V.open(v).r)) bad++; } catch { } }
    const ds = (await db.doc('adminState/draw').get()).data() || {}; if (ds.bad !== bad) await db.doc('adminState/draw').set({ bad, at: now }, { merge: true });
  }

  // 5) Agradecimientos: la persona escribe thanks/{ella}; su angelito lo lee en thanksFor/{sha256(k)} (id imposible de adivinar)
  for (const t of (await db.collection('thanks').where('at', '>', new Date(now - 10 * 60e3)).get()).docs) {
    const r = t.id, hk = (await db.doc('angelKey/' + r).get()).data()?.h; if (!hk) continue;
    await db.doc('thanksFor/' + Buffer.from(hk).toString('hex')).set(t.data());
  }

  // 6) Revelación: el organizador la pide (reveal/main con want) → aquí se abren las parejas y los autores de anónimos
  const rv = db.doc('reveal/main'), rd = (await rv.get()).data();
  if (rd && !rd.pairs && rd.want) {
    const pairs = []; for (const d of (await db.collection('assignments').get()).docs) { const v = d.data().vault; if (v) try { pairs.push({ g: d.id, r: V.open(v).r }); } catch { } }
    await rv.set({ pairs, at: FieldValue.serverTimestamp(), want: FieldValue.delete() }, { merge: true }); did.push('revelación');
  }
  const ev = (await db.doc('config/event').get()).data() || {};
  const revealed = !!ev.revealNow || (ev.revealAt && (ev.revealAt.toMillis ? ev.revealAt.toMillis() : +new Date(ev.revealAt)) <= now);
  if (revealed && now - (cv.authAt || 0) > 30 * 60e3) {
    await cfg.set({ authAt: now }, { merge: true });
    const b = db.batch(); let n = 0;
    for (const d of (await db.collection('questionAuthors').get()).docs) { const x = d.data(); if (x.uid) continue; try { const u = x.box ? V.openFromApp(x.box).uid : x.sealed ? V.open(x.sealed).uid : null; if (u) { b.set(d.ref, { uid: u }, { merge: true }); n++; } } catch { } }
    if (n) { await b.commit(); did.push(`autores (${n})`); }
  }
  if (did.length) log('Caja fuerte: ' + did.join(', ') + '.');
  return V;
}

async function doDraw(db, V, ids) {
  ids = [...new Set(ids)].filter(Boolean); if (ids.length < 3) throw new Error('Se necesitan al menos 3 personas');
  const people = new Set((await db.collection('participants').select().get()).docs.map(d => d.id)); ids = ids.filter(id => people.has(id));
  const rules = (await db.doc('drawRules/main').get()).data()?.pairs || [];
  const next = drawPlan(ids, rules); if (!next) throw new Error('Con estas restricciones no hay forma de sortear');
  const b = db.batch();
  for (const d of (await db.collection('assignments').get()).docs) if (!ids.includes(d.id)) b.delete(d.ref);
  for (const d of (await db.collection('angelKey').get()).docs) b.delete(d.ref);
  for (const g of ids) { const k = newToken(); b.set(db.doc('assignments/' + g), { vault: V.seal({ r: next[g], k }), boxes: {}, revealed: false, at: FieldValue.serverTimestamp() }); b.set(db.doc('angelKey/' + next[g]), { h: sha256(k) }); }
  b.set(db.doc('config/event'), { fix: FieldValue.delete(), registrationOpen: false, angelLocked: false, guessesOpen: false, guessesLocked: false, guessWinner: FieldValue.delete() }, { merge: true });
  b.set(db.doc('config/draw'), { ids, n: ids.length, at: FieldValue.serverTimestamp() });
  b.set(db.doc('config/vault'), { boxAt: 0 }, { merge: true }); // que se hagan las cajitas de todos los teléfonos ya registrados
  await b.commit();
}

async function doRemap(db, V, from, to) {
  const b = db.batch();
  for (const d of (await db.collection('assignments').get()).docs) {
    const a = d.data(); if (!a.vault) continue; const x = V.open(a.vault);
    if (x.r === from) { x.r = to; b.set(d.ref, { vault: V.seal(x), boxes: {} }, { merge: true }); }
  }
  const ak = (await db.doc('angelKey/' + from).get()); if (ak.exists) { b.set(db.doc('angelKey/' + to), ak.data()); b.delete(ak.ref); }
  b.set(db.doc('config/vault'), { boxAt: 0 }, { merge: true });
  await b.commit();
}
