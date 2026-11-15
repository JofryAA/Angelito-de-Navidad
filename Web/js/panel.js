/* Angelito de Navidad · panel de control (diseño y organización).
   Este módulo solo se encarga de cómo SE VE el panel: íconos de cada sección, la barra de secciones
   y la barra de "guardar cambios". La lógica (datos y permisos) sigue en app.js. */

// Íconos de trazo para el panel (24×24)
export const PANEL_ICONS = {
  resumen: '<path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z"/>',
  evento: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  sorteo: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>',
  asistencia: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M9 15l2 2 4-4"/>',
  aportes: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>',
  personas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 015.5 5"/>',
  actividades: '<path d="M4 6h16M4 12h16M4 18h10"/><circle cx="19" cy="18" r="2"/>',
  mensajes: '<path d="M4 5h16v11H9l-5 4z"/>',
  fiesta: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M10 9l4 2-4 2z"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 010-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 014 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1H21a2 2 0 010 4h-.1a1.6 1.6 0 00-1.5 1z"/>',
  rules: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h4"/>',
  wheel: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>',
  money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  megaphone: '<path d="M3 10v4h4l8 5V5L7 10z"/><path d="M18 9a4 4 0 010 6"/>',
  crystal: '<circle cx="12" cy="10" r="6"/><path d="M7 19h10l-1.5-3h-7z"/>',
  team: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  puzzle: '<path d="M10 4a2 2 0 014 0v2h4v4h-2a2 2 0 000 4h2v4h-4v-2a2 2 0 00-4 0v2H6v-4h2a2 2 0 000-4H6V6h4z"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/>',
  crown: '<path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
  exit:'<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>',
};
export const pic = (n, sz = 20) => `<svg class="ic" viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PANEL_ICONS[n] || ''}</svg>`;

// Cada tarjeta del panel: el emoji del título se cambia por un ícono y se agrupa con su descripción.
const CARD_ICON = [
  [/^🎄\s*Evento/, 'evento'], [/^📜/, 'rules'], [/^🎡/, 'wheel'], [/^👥/, 'personas'], [/^🎉\s*Asistencia/, 'asistencia'], [/^💵/, 'money'],
  [/^📅/, 'actividades'], [/^💌/, 'mail'], [/^📣/, 'megaphone'], [/^💬/, 'mensajes'], [/^🔮/, 'crystal'],
  [/^📺/, 'fiesta'], [/^🧩/, 'puzzle'], [/^👮/, 'team'], [/^📖/, 'book'],
];
const EMOJI_HEAD = /^[^\p{L}\p{N}¿¡"“]+/u;
export function decoratePanel(root) {
  root.querySelectorAll(':scope > .admin-sec > h3').forEach(h => {
    if (h.dataset.deco) return;
    const t = h.textContent.trim(), m = CARD_ICON.find(([re]) => re.test(t));
    h.dataset.deco = '1';
    if (!m) return;
    h.classList.add('pnl-h');
    h.innerHTML = `<span class="pnl-hi">${pic(m[1], 20)}</span><span>${t.replace(EMOJI_HEAD, '').replace(/\s*🔁\s*/g, ' ').trim()}</span>`;
  });
}
// Barra de secciones del panel (desplazable, con íconos)
// Con los mismos emojis de la barra de navegación de la app
export const navHTML = (groups, cur) => groups.map(([g, e, l]) => `<button class="${g === cur ? 'on' : ''}" data-ag="${g}"><span class="an-e">${e}</span><span>${l}</span></button>`).join('');

// Rellena <i data-pic="nombre"> con el ícono SVG correspondiente
export function fillPics(root = document) { root.querySelectorAll('i[data-pic]').forEach(i => { i.outerHTML = pic(i.dataset.pic, 16); }); }
