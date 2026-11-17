
/* =====================================================================================================
   🔐 CAJA FUERTE (lado de la app) — para auditar junto con push/vault.mjs y firestore.rules (ver SEGURIDAD.md)
   • Este teléfono crea su propia llave ECDH P-256. La parte privada NO se puede exportar (WebCrypto,
     extractable:false) y vive solo en este navegador (IndexedDB). Solo se sube la parte pública (devkeys/).
   • El servidor deja en assignments/{yo}.boxes.{este teléfono} una «cajita» con mi persona y mi token secreto.
     Solo este teléfono la puede abrir. Lo abierto queda en memoria, nunca se vuelve a guardar en la base.
   • Lo que la app manda «para el servidor» (autor de un anónimo) va cifrado con la llave pública del servidor.
   • Mismo formato en los dos lados: ECDH P-256 → HKDF-SHA256 (sal = llave efímera, info «angelito-caja-v1») → AES-256-GCM.
   ===================================================================================================== */
const CF = (() => {
  const te = new TextEncoder(), td = new TextDecoder(), INFO = te.encode('angelito-caja-v1'), C = crypto.subtle;
  const b64 = buf => { let s = ''; new Uint8Array(buf).forEach(x => { s += String.fromCharCode(x); }); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(String(s || '')), c => c.charCodeAt(0));
  const ALG = { name: 'ECDH', namedCurve: 'P-256' };
  let kp = null, serverPub = null;
  const idb = () => new Promise((ok, no) => { const r = indexedDB.open('angelito-caja', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  const idbGet = async k => { const d = await idb(); return new Promise(ok => { const q = d.transaction('k').objectStore('k').get(k); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); }); };
  const idbPut = async (k, v) => { const d = await idb(); return new Promise(ok => { const t = d.transaction('k', 'readwrite'); t.objectStore('k').put(v, k); t.oncomplete = () => ok(); t.onerror = () => ok(); }); };
  async function deviceKey() {
    if (kp) return kp;
    kp = await idbGet('dev').catch(() => null);
    if (!kp?.privateKey) { kp = await C.generateKey(ALG, false, ['deriveBits']); await idbPut('dev', kp); }
    return kp;
  }
  const aesKey = async (shared, salt, use) => C.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: INFO }, await C.importKey('raw', shared, 'HKDF', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, false, [use]);
  async function pubB64() { return b64(await C.exportKey('raw', (await deviceKey()).publicKey)); }
  // abrir mi cajita
  async function openBox(box) {
    const ePub = unb64(box.e), ek = await C.importKey('raw', ePub, ALG, false, []);
    const shared = await C.deriveBits({ name: 'ECDH', public: ek }, (await deviceKey()).privateKey, 256);
    const pt = await C.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, await aesKey(shared, ePub, 'decrypt'), unb64(box.ct));
    return JSON.parse(td.decode(pt));
  }
  // cifrar algo que solo el servidor podrá abrir
  async function sealForServer(obj) {
    if (!serverPub) { const s = await getDoc(doc(db, 'config', 'vault')); serverPub = s.data()?.pub; if (!serverPub) throw new Error('La caja fuerte todavía no está lista. Intenta en un par de minutos.'); }
    const e = await C.generateKey(ALG, true, ['deriveBits']), ePub = new Uint8Array(await C.exportKey('raw', e.publicKey));
    const sk = await C.importKey('raw', unb64(serverPub), ALG, false, []), shared = await C.deriveBits({ name: 'ECDH', public: sk }, e.privateKey, 256);
    const iv = crypto.getRandomValues(new Uint8Array(12)), ct = await C.encrypt({ name: 'AES-GCM', iv }, await aesKey(shared, ePub, 'encrypt'), te.encode(JSON.stringify(obj)));
    return { e: b64(ePub), iv: b64(iv), ct: b64(ct) };
  }
  // registrar la llave pública de este teléfono (una vez por persona y teléfono)
  async function register(uid, force) {
    try {
      const pub = await pubB64(), flag = 'angelito:devreg:' + uid;
      if (!force && localStorage.getItem(flag) === pub.slice(0, 16)) return;
      if (force && Date.now() - (+localStorage.getItem(flag + ':t') || 0) < 10 * 60e3) return; localStorage.setItem(flag + ':t', Date.now());
      await setDoc(doc(db, 'devkeys', `${uid}__${DEV}`), { uid, dev: DEV, pub, at: Date.now() });
      localStorage.setItem(flag, pub.slice(0, 16));
    } catch (e) { console.warn('caja', e); }
  }
  async function sha256hex(s) { return [...new Uint8Array(await C.digest('SHA-256', te.encode(String(s))))].map(x => x.toString(16).padStart(2, '0')).join(''); }
  // mi asignación: abre la cajita de este teléfono y deja en memoria recipient + k (así el resto de la app no cambia)
  async function unlockAssignment(a) {
    if (!a || a.recipient) return a;                       // vista previa / datos viejos sin cifrar
    const box = a.boxes?.[DEV]; if (!box) return { ...a, pendingBox: true };
    try { const x = await openBox(box); return { ...a, recipient: x.r, k: x.k }; } catch { return { ...a, pendingBox: true, boxErr: true }; }
  }
  return { register, openBox, sealForServer, sha256hex, unlockAssignment, pubB64 };
})();
