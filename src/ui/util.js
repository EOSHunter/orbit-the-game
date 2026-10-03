// Vesper Drift UI: small DOM/format helpers and the inline line-icon set. No dependencies.

export const NS = 'http://www.w3.org/2000/svg';

export const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function el(tag, cls, text, attrs) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

export function svg(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

export function fmtMass(m) {
  if (!isFinite(m) || m < 0) m = 0;
  const units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
  for (const [v, u] of units) if (m >= v) return (m / v).toFixed(m / v < 10 ? 2 : m / v < 100 ? 1 : 0) + u;
  return m < 100 ? m.toFixed(1) : String(Math.round(m));
}

export function fmtTime(t) {
  t = Math.max(0, Math.floor(t || 0));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

// World units -> compact readout ("840", "3.2k", "1.4M").
export function fmtDist(d) {
  if (!isFinite(d) || d < 0) return '--';
  if (d >= 1e6) return (d / 1e6).toFixed(d < 1e7 ? 1 : 0) + 'M';
  if (d >= 1e3) return (d / 1e3).toFixed(d < 1e4 ? 1 : 0) + 'k';
  return String(Math.round(d));
}

// Bearing in radians (0 = north, clockwise) -> "047°".
export function fmtBearing(b) {
  if (!isFinite(b)) return '---°';
  let deg = Math.round((b * 180) / Math.PI) % 360;
  if (deg < 0) deg += 360;
  return String(deg).padStart(3, '0') + '°';
}

export const CLS_NAMES = {
  meteorite: 'Meteorite', asteroid: 'Asteroid', comet: 'Comet', dwarfPlanet: 'Dwarf planet',
  rockyPlanet: 'Rocky planet', gasGiant: 'Gas giant', brownDwarf: 'Brown dwarf', star: 'Star',
  neutronStar: 'Neutron star', blackHole: 'Black hole', debris: 'Debris', fragment: 'Fragment',
};
export const clsName = (c) => CLS_NAMES[c] || (c ? String(c).replace(/([A-Z])/g, ' $1').toLowerCase() : 'Unknown');

// Short stage codes for the ladder.
export const STAGE_CODES = ['MET', 'AST', 'DWF', 'RKY', 'GAS', 'BDW', 'DST', 'STR', 'GNT', 'SGT', 'NEU', 'BHO'];

// 2 px stroke line icons, rounded caps. All decorative (aria-hidden); buttons carry the label.
const ICONS = {
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  capture: '<circle cx="12" cy="12" r="2.6"/><ellipse cx="12" cy="12" rx="9.5" ry="4" transform="rotate(-25 12 12)"/><circle cx="19.6" cy="8" r="1.1"/>',
  lock: '<rect x="6" y="11" width="12" height="9" rx="1.5"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  warn: '<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.2M12 17.2v.01"/>',
  topdown: '<rect x="4" y="4" width="16" height="16" rx="1"/><circle cx="12" cy="12" r="2.5"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/>',
  trajectory: '<circle cx="5.5" cy="18.5" r="1.8"/><path d="M7 17c3-1 4-4 6-7s4-4 6-4" stroke-dasharray="2 3"/><path d="M16.5 4.5 19 6l-1.5 2.5"/>',
  beacon: '<circle cx="12" cy="12" r="1.8"/><path d="M8 8a5.7 5.7 0 0 0 0 8M16 8a5.7 5.7 0 0 1 0 8M5.2 5.2a9.6 9.6 0 0 0 0 13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6"/>',
  orbit: '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="8.5" stroke-dasharray="3 2.6"/>',
};
export function icon(name) {
  return `<svg class="vd-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name] || ''}</svg>`;
}

// Stage glyph by era: rock, planet, banded gas body, star, neutron star, black hole.
export function stageGlyph(i) {
  let body;
  if (i <= 1) body = '<path d="M7 9.5 10.5 6l5 .8 3 3.6-.6 4.8-3.6 3L9 18.4l-3-3.6z"/><path d="M10.5 11.5l1.6 1.4M14 14.6h.01"/>';
  else if (i <= 3) body = '<circle cx="12" cy="12" r="7"/><path d="M12 5a7 7 0 0 1 0 14" opacity=".45"/><ellipse cx="12" cy="12" rx="9.5" ry="2.4" opacity=".5"/>';
  else if (i <= 5) body = '<circle cx="12" cy="12" r="7.5"/><path d="M5 9.6h14M4.6 12.4h14.8M5.4 15.2h13.2" opacity=".6"/>';
  else if (i <= 9) body = '<circle cx="12" cy="12" r="5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2"/>';
  else if (i === 10) body = '<circle cx="12" cy="12" r="2.6"/><path d="M12 9.4 8 1.8M12 14.6l4 7.6" opacity=".7"/><circle cx="12" cy="12" r="6.5" opacity=".35"/>';
  else body = '<circle cx="12" cy="12" r="4.4" fill="currentColor" fill-opacity=".08"/><circle cx="12" cy="12" r="6.4"/><ellipse cx="12" cy="12" rx="10" ry="2.8" opacity=".55"/>';
  return `<svg class="vd-glyph" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}

// Relation shape for markers/rows, so prey/neutral/threat never rely on hue alone.
// prey = filled dot, neutral = hollow ring, threat = diamond.
export function relShape(rel) {
  if (rel === 'threat') return '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1 11 6 6 11 1 6z"/></svg>';
  if (rel === 'prey') return '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.6"/></svg>';
  return '<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="3.6" fill="none" stroke-width="1.6"/></svg>';
}
export const REL_LABEL = { prey: 'Prey', neutral: 'Neutral', threat: 'Threat', self: 'Self' };
