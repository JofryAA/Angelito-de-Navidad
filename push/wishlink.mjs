// 🔗 Deseo desde un enlace: la persona pega el enlace de un producto (Amazon, Temu, Shein, AliExpress, Walmart…)
// y aquí, en el servidor, se completan solos la foto, el nombre y el precio. Queda igual que un deseo agregado a mano.
// Si la tienda no deja leer la página, el deseo se queda con su enlace y su texto, sin foto automática.
import sharp from 'sharp';
import { FieldValue } from 'firebase-admin/firestore';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const MAX_HTML = 2_500_000, MAX_IMG = 8_000_000, LIM = 150_000;

// solo páginas públicas por https (nada de direcciones internas)
export function safeUrl(u) {
  try {
    const x = new URL(u);
    if (x.protocol !== 'https:' || x.username || x.password) return null;
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.|\[)|\.local$|\.internal$/i.test(x.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(x.hostname)) return null;
    return x;
  } catch { return null; }
}

const why = {};
async function getLimited(url, max, accept) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), 12000);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ac.signal, headers: { 'User-Agent': UA, 'Accept-Language': 'es-DO,es;q=0.9,en;q=0.8', Accept: accept } });
    if (!r.ok || !safeUrl(r.url)) { why.last = 'HTTP ' + r.status; return null; }
    const chunks = []; let n = 0;
    for await (const c of r.body) { n += c.length; if (n > max) break; chunks.push(c); }
    return { buf: Buffer.concat(chunks), type: r.headers.get('content-type') || '', url: r.url };
  } catch (e) { why.last = e.name === 'AbortError' ? 'tardó mucho' : 'sin conexión'; return null; } finally { clearTimeout(t); }
}

const unesc = s => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/\s+/g, ' ').trim();
const meta = (h, ...names) => {
  for (const n of names) {
    const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${n}["'][^>]*>`, 'i'), m = h.match(re);
    if (m) { const c = m[0].match(/content=["']([^"']*)["']/i); if (c && c[1].trim()) return unesc(c[1]); }
  }
  return '';
};

// lee nombre, foto y precio de la página del producto
export function parseProduct(html, pageUrl) {
  const h = String(html || '');
  let title = meta(h, 'og:title', 'twitter:title'), image = meta(h, 'og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src', 'image');
  let price = meta(h, 'product:price:amount', 'og:price:amount', 'price'), cur = meta(h, 'product:price:currency', 'og:price:currency', 'priceCurrency');
  // datos estructurados (JSON-LD) de tipo Product
  for (const m of h.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); if (o['@graph']) walk(o['@graph']);
        if (/Product/i.test([].concat(o['@type'] || '').join())) {
          title ||= unesc(o.name); const im = [].concat(o.image || [])[0]; image ||= typeof im === 'string' ? im : im?.url || '';
          const of = [].concat(o.offers || [])[0]; if (of && !price) { price = String(of.price ?? of.lowPrice ?? ''); cur ||= of.priceCurrency || ''; }
        } };
      walk(JSON.parse(m[1].trim()));
    } catch { }
  }
  // Amazon (a veces sin etiquetas og)
  if (/amazon\./i.test(pageUrl)) {
    title ||= unesc((h.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i) || [])[1]);
    image ||= unesc((h.match(/data-old-hires=["']([^"']+)["']/i) || h.match(/id=["']landingImage["'][^>]+src=["']([^"']+)["']/i) || [])[1]);
    if (!image) { const d = (h.match(/data-a-dynamic-image=["']([^"']+)["']/i) || [])[1]; if (d) try { image = Object.keys(JSON.parse(unesc(d)))[0] || ''; } catch { } }
    if (!price) { const p = (h.match(/class=["']a-offscreen["']>\s*([^<]{1,20})</i) || [])[1]; if (p) price = unesc(p); }
  }
  title ||= unesc((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
  title = title.replace(/\s*[|:–-]\s*(Amazon(\.\w+)*|Temu|SHEIN|AliExpress|Walmart\.com|eBay|Mercado Libre)\s*$/i, '').replace(/^Amazon\.\w+\s*:\s*/i, '').slice(0, 300);
  if (/^(robot check|access denied|attention required|just a moment|página no encontrada|404)/i.test(title)) title = '';
  try { if (image) image = new URL(image, pageUrl).href; } catch { image = ''; }
  price = String(price || '').trim();
  if (price && /^\d+([.,]\d+)?$/.test(price)) price = `${cur === 'USD' || !cur ? 'US$' : cur + ' '}${price}`;
  return { title, image: safeUrl(image) ? image : '', price: price.slice(0, 30) };
}

// foto a JPEG liviano (≤150 KB) y sin datos ocultos
export async function toDataUrl(buf) {
  for (const [w, q] of [[900, 80], [800, 70], [640, 65], [520, 58], [420, 50]]) {
    const out = await sharp(buf, { failOn: 'none' }).rotate().resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: q, mozjpeg: true }).toBuffer();
    const d = 'data:image/jpeg;base64,' + out.toString('base64'); if (d.length <= LIM) return d;
  }
  return '';
}

export async function wishLinkTasks({ db, log = console.log }) {
  const pend = (await db.collection('wishes').where('auto', '==', true).limit(8).get()).docs;
  let ok = 0, bad = 0; const fails = [];
  for (const d of pend) {
    const w = d.data(), u = safeUrl(w.link), upd = { auto: FieldValue.delete() };
    try {
      const page = u && await getLimited(u.href, MAX_HTML, 'text/html,application/xhtml+xml');
      const p = page ? parseProduct(page.buf.toString('utf8'), page.url) : { title: '', image: '', price: '' };
      if (p.title && w.autoText) upd.text = p.title.slice(0, 500);
      if (p.price && !w.price) upd.price = p.price;
      if (p.image && !w.hasImg) {
        const im = await getLimited(p.image, MAX_IMG, 'image/avif,image/webp,image/*');
        const data = im && /^image\//i.test(im.type) ? await toDataUrl(im.buf).catch(() => '') : '';
        if (data) { await db.doc('wishImg/' + d.id).set({ uid: w.uid, data }); upd.hasImg = true; }
      }
      if (w.autoText) upd.autoText = FieldValue.delete();
      if (!upd.hasImg && !upd.text) { bad++; fails.push(`${u?.hostname.replace(/^www\./, '') || 'enlace inválido'}: ${page ? (p.title || p.image ? 'sin foto' : 'página sin datos') : why.last || 'no respondió'}`); } else ok++;
    } catch { bad++; }
    await d.ref.set(upd, { merge: true });
  }
  if (pend.length) log(`Deseos desde enlace: ${ok} completados, ${bad} sin datos de la tienda${fails.length ? ' (' + fails.join('; ') + ')' : ''}.`); // solo la tienda, nunca quién ni qué
  return pend.length;
}
