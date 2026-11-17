// Une los archivos de Web/js/app/ (en orden por su número) en Web/js/app.js, que es lo que carga la página.
// Se edita SIEMPRE en Web/js/app/; Web/js/app.js se genera (lo hace también GitHub antes de publicar).
// Uso: node tools/build-app.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir = new URL('../Web/js/app/', import.meta.url), out = new URL('../Web/js/app.js', import.meta.url);
const files = readdirSync(dir).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
writeFileSync(out, files.map(f => readFileSync(new URL(f, dir), 'utf8')).join(''));
console.log(`app.js armado con ${files.length} partes.`);
