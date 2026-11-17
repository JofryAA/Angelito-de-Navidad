// Une las partes de cada carpeta (en orden por su número) en un solo archivo, que es lo que carga la página:
//   Web/js/app/*.js    → Web/js/app.js
//   Web/js/juegos/*.js → Web/js/juegos.js
// Se edita SIEMPRE en las carpetas; los archivos unidos se generan (GitHub lo hace también antes de publicar).
// Uso: node tools/build-app.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
for (const name of ['app', 'juegos']) {
  const dir = new URL(`../Web/js/${name}/`, import.meta.url), out = new URL(`../Web/js/${name}.js`, import.meta.url);
  const files = readdirSync(dir).filter(f => /^\d\d-.*\.js$/.test(f)).sort();
  writeFileSync(out, files.map(f => readFileSync(new URL(f, dir), 'utf8')).join(''));
  console.log(`${name}.js armado con ${files.length} partes.`);
}
