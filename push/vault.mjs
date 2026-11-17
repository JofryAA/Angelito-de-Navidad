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

// 🔑 Llave de la caja: VAULT_KEY (secreto propio de GitHub, generado sin que nadie lo viera). Si no está, se usa la
// derivada de la cuenta de servicio (versión 1). Con VAULT_KEY, la v1 solo sirve para abrir lo viejo durante la migración 3.
export function makeVault(sa, vaultKey) {
  if (vaultKey && String(vaultKey).trim().length >= 32) { // cualquier texto largo y al azar sirve
    const v2 = core(Buffer.from(hkdfSync('sha256', Buffer.from(String(vaultKey).trim()), Buffer.from('angelito'), Buffer.from('caja-fuerte-v2'), 64)));
    const v1 = core(Buffer.from(hkdfSync('sha256', Buffer.from(sa.private_key), Buffer.from('angelito'), Buffer.from('caja-fuerte-v1'), 64)));
    const V = { ...v2, kv: 2, legacy: true,
      seal: obj => ({ ...v2.seal(obj), kv: 2 }),
      open: v => v?.kv === 2 ? v2.open(v) : V.legacy ? v1.open(v) : (() => { throw new Error('vault v1'); })(),
      openFromApp: box => { try { return v2.openFromApp(box); } catch { return v1.openFromApp(box); } } }; // autor enviado desde una página abierta antes del cambio de llave
    V.openFor = (g, v) => { const x = V.open(v); if (x.g !== undefined && x.g !== g) throw new Error('vault ajeno'); return x; };
    return V;
  }
  return { ...core(Buffer.from(hkdfSync('sha256', Buffer.from(sa.private_key), Buffer.from('angelito'), Buffer.from('caja-fuerte-v1'), 64))), kv: 1 };
}
function core(root) {
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
  // la pareja va atada a quien regala (g): copiar el «vault» de otra persona a tu documento no sirve de nada
  const openFor = (g, v) => { const x = open(v); if (x.g !== undefined && x.g !== g) throw new Error('vault ajeno'); return x; };
  return { seal, open, openFor, boxFor, openFromApp, pubB64: b64(pub) };
}
export const sha256 = s => createHash('sha256').update(String(s)).digest();
export const newToken = () => randomBytes(24).toString('base64url');
export const MIN_OPC = n => Math.max(2, Math.ceil((n - 1) / 3)); // cada quien debe poder recibir al menos 1/3 del grupo: así nadie puede «forzar» el sorteo con restricciones
export function optsOK(ids, pairs) { const bad = new Set(); for (const r of pairs || []) { bad.add(r.a + '>' + r.b); if (r.both) bad.add(r.b + '>' + r.a); } const m = MIN_OPC(ids.length); return ids.every(x => ids.filter(y => y !== x && !bad.has(x + '>' + y)).length >= m); }

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
export async function vaultTasks({ db, sa, vaultKey, now, log = console.log }) {
  const V = makeVault(sa, vaultKey), did = [], alerts = []; let revealedNow = false, migrated3 = false;
  const cfg = db.doc('config/vault'), cv = (await cfg.get()).data() || {};
  if (cv.pub !== V.pubB64 && !(V.kv === 2 && (cv.mig || 0) < 3)) { await cfg.set({ pub: V.pubB64, v: 1, kv: V.kv, at: now }, { merge: true }); did.push('llave'); } // con llave nueva, la publica la migración 3

  // 1) Migración única: parejas en claro → cifradas (y se borra el texto en claro)
  if (!cv.migrated) {
    const as = (await db.collection('assignments').get()).docs, b = db.batch(); let n = 0;
    for (const d of as) { const r = d.data().recipient; if (!r) continue; const k = newToken(); b.set(d.ref, { vault: V.seal({ r, k }), recipient: FieldValue.delete(), boxes: {} }, { merge: true }); b.set(db.doc('angelKey/' + r), { h: sha256(k) }); n++; }
    for (const d of (await db.collection('hintsSent').get()).docs) if (d.data().texts) b.set(d.ref, { n: (d.data().texts || []).length, texts: FieldValue.delete() }, { merge: true });
    for (const c of ['questionAuthors', 'suggestionAuthors']) for (const d of (await db.collection(c).get()).docs) { const u = d.data().uid; if (u) b.set(d.ref, { sealed: V.seal({ uid: u }), uid: FieldValue.delete() }, { merge: true }); }
    b.set(cfg, { migrated: now }, { merge: true }); await b.commit(); did.push(`migración (${n})`);
  }

  // 1c) Migración 3 (una vez, al activar VAULT_KEY): todo lo cifrado con la llave vieja se vuelve a cifrar con la nueva.
  //     Las cajitas de los teléfonos no cambian (van cifradas para cada teléfono, no con la llave del servidor).
  if (V.kv === 2 && (cv.mig || 0) >= 2 && (cv.mig || 0) < 3) {
    const ops = []; let n = 0;
    for (const d of (await db.collection('assignments').get()).docs) { const v = d.data().vault; if (!v || v.kv === 2) continue; const x = V.open(v); ops.push(b => b.set(d.ref, { vault: V.seal(x) }, { merge: true })); n++; }
    for (const c of ['questionAuthors', 'suggestionAuthors']) for (const d of (await db.collection(c).get()).docs) { const x = d.data(); try {
      if (x.box && !x.box.kv) { ops.push(b => b.set(d.ref, { box: { ...V.boxFor(V.pubB64, V.openFromApp(x.box)), kv: 2 } }, { merge: true })); n++; }
      else if (x.sealed && x.sealed.kv !== 2) { ops.push(b => b.set(d.ref, { sealed: V.seal(V.open(x.sealed)) }, { merge: true })); n++; } } catch { } }
    for (let i = 0; i < ops.length; i += 400) { const b = db.batch(); ops.slice(i, i + 400).forEach(f => f(b)); await b.commit(); }
    await cfg.set({ mig: 3, pub: V.pubB64, kv: 2, at: now }, { merge: true }); cv.mig = 3; did.push(`migración 3 (${n})`); migrated3 = true;
  }
  if (V.kv === 2 && (cv.mig || 0) >= 3) V.legacy = false; // las parejas ya no se abren con la llave vieja

  // 1b) Migración 2: atar cada pareja a quien regala, y borrar lo que delataba parejas (wishPick, hintsSent, conteo de restricciones)
  if ((cv.mig || 0) < 2) {
    const b = db.batch();
    for (const d of (await db.collection('assignments').get()).docs) { const v = d.data().vault; if (!v) continue; try { const x = V.open(v); if (x.g === undefined) b.set(d.ref, { vault: V.seal({ g: d.id, r: x.r, k: x.k }) }, { merge: true }); } catch { } }
    for (const c of ['wishPick', 'hintsSent', 'adminState']) for (const d of (await db.collection(c).get()).docs) b.delete(d.ref);
    b.set(cfg, { mig: 2 }, { merge: true }); await b.commit(); did.push('migración 2');
  }

  // 2) Pedidos del organizador: sortear / cambiar el uid de alguien (al restablecer su PIN)
  for (const op of (await db.collection('vaultOps').get()).docs) {
    const o = op.data(); try {
      if (o.op === 'draw') await doDraw(db, V, o.ids || []);
      if (o.op === 'remap' && o.from && o.to) {
        // el cambio de ficha del cliente llega al final: si todavía no llegó, se espera (hasta 15 min)
        const young = now - (o.at?.toMillis?.() ?? now) < 15 * 60e3;
        if (young && (await db.doc('participants/' + o.from).get()).exists) continue;
        await doRemap(db, V, o.from, o.to);
      }
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
      let n = 0;
      for (const dk of devs) {
        if (!draw.ids.includes(dk.uid) || !/^[a-z0-9]{6,16}$/.test(dk.dev)) continue;
        const a = (await db.doc('assignments/' + dk.uid).get()).data(); if (!a?.vault || a.boxes?.[dk.dev]?.for === dk.pub.slice(0, 16)) continue;
        const others = Object.keys(a.boxes || {}).filter(x => x !== dk.dev);
        if (others.length >= 4) continue; // máximo 4 teléfonos por persona
        try { await db.doc('assignments/' + dk.uid).set({ boxes: { [dk.dev]: { ...V.boxFor(dk.pub, V.openFor(dk.uid, a.vault)), for: dk.pub.slice(0, 16) } } }, { merge: true }); n++; if (others.length) alerts.push(dk.uid); } catch { }
      }
      if (n) did.push(`cajitas (${n})`);
    }
    if (devs.length || now - (cv.boxAt || 0) > 3600e3) await cfg.set({ boxAt: now }, { merge: true });
  }

  // 5) Agradecimientos: la persona escribe thanks/{ella}; su angelito lo lee en thanksFor/{sha256(k)} (id imposible de adivinar)
  for (const t of (await db.collection('thanks').where('at', '>', new Date((cv.thxAt || now - 864e5) - 60e3)).get()).docs) {
    const r = t.id, hk = (await db.doc('angelKey/' + r).get()).data()?.h; if (!hk) continue;
    await db.doc('thanksFor/' + Buffer.from(hk).toString('hex')).set(t.data());
  }
  await cfg.set({ thxAt: now }, { merge: true });

  // 6) Revelación: el organizador la pide (reveal/main con want) → aquí se abren las parejas y los autores de anónimos
  const rv = db.doc('reveal/main'), rd = (await rv.get()).data();
  const ev = (await db.doc('config/event').get()).data() || {};
  const msOf = x => !x ? 0 : x.toMillis ? x.toMillis() : +new Date(x);
  if (rd && !rd.pairs && rd.want) {
    // solo el día del angelito (desde 3 h antes de la hora del evento) o pasada la fecha de revelación; queda anotado para siempre y se avisa a todos
    const okTime = (msOf(ev.eventAt) && now >= msOf(ev.eventAt) - 3 * 3600e3) || (msOf(ev.revealAt) && now >= msOf(ev.revealAt));
    if (!okTime) { await rv.delete(); await db.doc('config/revealGate').set({ denied: now }, { merge: true }); did.push('revelación rechazada (todavía no es el día)'); }
    else {
      const pairs = []; for (const d of (await db.collection('assignments').get()).docs) { const v = d.data().vault; if (v) try { pairs.push({ g: d.id, r: V.openFor(d.id, v).r }); } catch { } }
      await rv.set({ pairs, at: FieldValue.serverTimestamp(), want: FieldValue.delete() }, { merge: true });
      await db.collection('revealLog').add({ at: FieldValue.serverTimestamp(), n: pairs.length });
      revealedNow = true; did.push('revelación');
    }
  }
  // autores de anónimos: solo después de una revelación que quedó anotada en revealLog (y que avisó a todos); el organizador no lo puede adelantar a escondidas
  if (now - (cv.authAt || 0) > 30 * 60e3 && (revealedNow || !(await db.collection('revealLog').get()).empty)) {
    await cfg.set({ authAt: now }, { merge: true });
    const b = db.batch(); let n = 0;
    for (const d of (await db.collection('questionAuthors').get()).docs) { const x = d.data(); if (x.uid) continue; try {
      let u = null; if (x.box) { const o = V.openFromApp(x.box); if (o.col === 'questionAuthors' && o.id === d.id) u = o.uid; } else if (x.sealed) u = V.open(x.sealed).uid; // el autor va atado a ESTE mensaje
      if (u) { b.set(d.ref, { uid: u }, { merge: true }); n++; } } catch { } }
    if (n) { await b.commit(); did.push(`autores (${n})`); }
  }
  // sin sorteo: las huellas viejas se borran (nadie puede seguir mandando pistas de un sorteo que ya no existe)
  // también lo que solo tiene sentido con parejas (estado del regalo recibido, pistas, agradecimientos): el organizador no puede leerlo, así que lo limpia el servidor
  if (!draw?.ids?.length && !cv.akClean) { await wipe(db, PAIR_COLS); await db.doc('config/vault').set({ akClean: now }, { merge: true }); }
  if (draw?.ids?.length && cv.akClean) await cfg.set({ akClean: FieldValue.delete() }, { merge: true });
  if (did.length) log('Caja fuerte: ' + did.join(', ') + '.');
  return { V, alerts, revealedNow, migrated3 };
}

const PAIR_COLS = ['angelKey', 'giftIncoming', 'hints', 'thanksFor', 'revealLog'];
async function wipe(db, cols) { for (const c of cols) { const ds = (await db.collection(c).get()).docs; for (let i = 0; i < ds.length; i += 400) { const b = db.batch(); ds.slice(i, i + 400).forEach(d => b.delete(d.ref)); await b.commit(); } } }

async function doDraw(db, V, ids) {
  ids = [...new Set(ids)].filter(Boolean); if (ids.length < 3) throw new Error('Se necesitan al menos 3 personas');
  const people = new Set((await db.collection('participants').select().get()).docs.map(d => d.id)); ids = ids.filter(id => people.has(id));
  const rules = (await db.doc('drawRules/main').get()).data()?.pairs || [];
  if (!optsOK(ids, rules)) throw new Error('Hay demasiadas restricciones: cada quien debe poder recibir a ' + MIN_OPC(ids.length) + ' personas o más');
  const next = drawPlan(ids, rules); if (!next) throw new Error('Con estas restricciones no hay forma de sortear');
  await wipe(db, PAIR_COLS); // lo del sorteo anterior
  const b = db.batch();
  for (const d of (await db.collection('assignments').get()).docs) if (!ids.includes(d.id)) b.delete(d.ref);
  for (const g of ids) { const k = newToken(); b.set(db.doc('assignments/' + g), { vault: V.seal({ g, r: next[g], k }), boxes: {}, revealed: false, at: FieldValue.serverTimestamp() }); b.set(db.doc('angelKey/' + next[g]), { h: sha256(k) }); }
  b.set(db.doc('config/event'), { fix: FieldValue.delete(), registrationOpen: false, angelLocked: false, guessesOpen: false, guessesLocked: false, guessWinner: FieldValue.delete() }, { merge: true });
  b.set(db.doc('config/draw'), { ids, n: ids.length, at: FieldValue.serverTimestamp() });
  b.set(db.doc('config/vault'), { boxAt: 0, akClean: 0 }, { merge: true }); // que se hagan las cajitas de todos los teléfonos ya registrados
  await b.commit();
}

async function doRemap(db, V, from, to) {
  // solo para el cambio de PIN: «from» ya no existe y «to» es una persona nueva fuera del sorteo
  const draw = (await db.doc('config/draw').get()).data() || {}, ids = draw.ids || [];
  if ((await db.doc('participants/' + from).get()).exists || !(await db.doc('participants/' + to).get()).exists || ids.includes(to) || from === to) throw new Error('cambio de uid no válido');
  const b = db.batch();
  for (const d of (await db.collection('assignments').get()).docs) {
    const a = d.data(); if (!a.vault) continue; const x = V.openFor(d.id, a.vault), g = d.id === from ? to : d.id;
    if (x.r === from) x.r = to;
    // TODAS se vuelven a cifrar y TODAS las cajitas se rehacen: desde afuera no se nota a quién le tocaba
    b.set(db.doc('assignments/' + g), { ...a, vault: V.seal({ g, r: x.r, k: x.k }), boxes: {} });
    if (d.id === from) b.delete(d.ref);
  }
  const ak = await db.doc('angelKey/' + from).get(); if (ak.exists) { b.set(db.doc('angelKey/' + to), ak.data()); b.delete(ak.ref); }
  // lo que le llegó a «from» como persona secreta (estado del regalo y pistas) pasa a «to»: el organizador ya no puede leerlo ni moverlo
  const gi = await db.doc('giftIncoming/' + from).get(); if (gi.exists) { b.set(db.doc('giftIncoming/' + to), gi.data()); b.delete(gi.ref); }
  for (const h of (await db.collection('hints').where('to', '==', from).get()).docs) b.update(h.ref, { to });
  if (ids.includes(from)) b.set(db.doc('config/draw'), { ids: ids.map(x => x === from ? to : x) }, { merge: true });
  b.set(db.doc('config/vault'), { boxAt: 0 }, { merge: true });
  await b.commit();
}
