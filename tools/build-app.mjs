// Une las partes de cada carpeta (en orden por su número) en un solo archivo, que es lo que carga la página:
//   Web/js/app/*.js    → Web/js/app.js
//   Web/js/juegos/*.js → Web/js/juegos.js
//   Web/css/tema/*.css → Web/css/tema.css (estilos por tema)
// Se edita SIEMPRE en las carpetas; los archivos unidos se generan (GitHub lo hace también antes de publicar).
// Uso: node tools/build-app.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
for (const [name, ext, base] of [['app', 'js', 'js'], ['juegos', 'js', 'js'], ['tema', 'css', 'css']]) {
  const dir = new URL(`../Web/${base}/${name}/`, import.meta.url), out = new URL(`../Web/${base}/${name}.${ext}`, import.meta.url);
  const files = readdirSync(dir).filter(f => new RegExp(`^\\d\\d[a-z]?-.*\\.${ext}$`).test(f)).sort();
  writeFileSync(out, files.map(f => readFileSync(new URL(f, dir), 'utf8')).join(''));
  console.log(`${name}.${ext} armado con ${files.length} partes.`);
}
