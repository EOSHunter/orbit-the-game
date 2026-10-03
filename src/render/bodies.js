// Procedural body art for all 12 stages ("Luminous Vector Dusk"): flat-filled geometric shapes,
// a thin rim light, a dark terminator crescent, light fixed at the upper-left (stars light
// themselves). Nothing here uses image assets.
//
// Sprites are baked lazily into offscreen canvases per (stage, variant, size bucket) and then
// blitted. Each body picks one of VARIANTS looks from its seed, so a body looks the same every
// frame and every session; rotation, flip and size add further variety.
//
// Layers of a sprite, drawn in this order:
//   additive glows + `rays` (additive layer)  ->  `under` (e.g. ring back, accretion disc)
//   -> `surf` (rotating surface)  ->  `shade` (static terminator/rim/atmosphere)  ->  `over`
//   -> per-frame additive details (granulation, flares, hot spots, beams flash)

import { TAU, mulberry32, hash01, seedInt, mixHex, lighten, darken, rgba, shiftHue, makeCanvas } from './util.js';
import { drawGlow } from './glow.js';

export const VARIANTS = 12;
const MAX_TEX = 1024;               // max sprite layer size in baked pixels
const PIXEL_BUDGET = 18e6;          // total baked pixels kept alive (~72 MB worst case)

// ---- per-stage spec ---------------------------------------------------------------------------

export const SPEC = [
  { kind: 'rock',    pad: 1.15, cull: 1.35, spin: 0.7,  fb: '#8A7F9E' },  // 0 Meteorite
  { kind: 'rock',    pad: 1.15, cull: 1.35, spin: 0.45, fb: '#8E8A9B' },  // 1 Asteroid
  { kind: 'icy',     pad: 1.22, cull: 1.35, spin: 0.3,  fb: '#B9C7E6' },  // 2 Dwarf Planet
  { kind: 'rocky',   pad: 1.22, cull: 1.35, spin: 0.25, fb: '#4FA3C7' },  // 3 Rocky Planet
  { kind: 'gas',     pad: 1.22, cull: 2.1,  spin: 0,    fb: '#D9A066' },  // 4 Gas Giant
  { kind: 'gas',     pad: 1.3,  cull: 2.1,  spin: 0,    fb: '#C9B8E8' },  // 5 Gas Planet
  { kind: 'star',    pad: 1.1,  cull: 2.6,  spin: 0.05, fb: '#FFD66B' },  // 6 Dwarf Star
  { kind: 'star',    pad: 1.1,  cull: 3.4,  spin: 0.045,fb: '#FFE9A0' },  // 7 Star
  { kind: 'star',    pad: 1.1,  cull: 3.8,  spin: 0.03, fb: '#FF8A4D' },  // 8 Giant Star
  { kind: 'star',    pad: 1.1,  cull: 4.8,  spin: 0.025,fb: '#CFE4FF' },  // 9 Supergiant Star
  { kind: 'neutron', pad: 1.15, cull: 5.6,  spin: 0,    fb: '#EAF6FF' },  // 10 Neutron Star
  { kind: 'hole',    pad: 1.0,  cull: 2.9,  spin: 0,    fb: '#000000' },  // 11 Black Hole
];

const lookCache = new Map();

/** Colours / flags of a stage+variant (hue shifted +-6 degrees per variant). */
export function look(stage, vi) {
  const key = stage * 64 + vi;
  let L = lookCache.get(key);
  if (L) return L;
  const hue = (hash01(vi, stage * 7 + 3) - 0.5) * 12;
  const H = (c) => shiftHue(c, hue);
  switch (stage) {
    case 0: L = { body: H('#8A7F9E'), rim: '#FFB067', dark: '#2A2440' }; break;
    case 1: L = { body: H('#8E8A9B'), rim: '#D6DCF2', dark: '#3A3F66' }; break;
    case 2: L = { body: H('#B9C7E6'), haze: '#7FD6FF', dark: '#2A3566' }; break;
    case 3: {
      const t = vi % 3;
      L = t === 0 ? { type: 'terrestrial', ocean: H('#4FA3C7'), land: H('#5FBF8F'), haze: '#7FD6FF', hazeA: 0.5, dark: '#0C1736' }
        : t === 1 ? { type: 'lava', ocean: '#3A1410', accent: H('#C2452D'), crack: '#FF8A3D', haze: '#FF8A3D', hazeA: 0.4, dark: '#12060A' }
        : { type: 'metallic', ocean: H('#9AA7B8'), accent: '#5E6C9E', haze: '#9AA7B8', hazeA: 0.22, dark: '#12183A' };
      break;
    }
    case 4: L = { bands: ['#D9A066', '#B5704A', '#F2D3A0'].map(H), eye: '#B5532F', ring: hash01(vi, 99) < 0.45, haze: '#F2D3A0', hazeA: 0.28, dark: '#2A0F26', soft: 0 }; break;
    case 5: L = { bands: ['#C9B8E8', '#8FB4E8', '#E9D8FF'].map(H), eye: '#F4D8FF', ring: hash01(vi, 99) < 0.2, haze: '#E9D8FF', hazeA: 0.6, dark: '#2A1650', soft: 1 }; break;
    case 6: L = vi % 2 ? { core: '#FFD0A8', edge: '#FF6B4A', glow: '#FF6B4A', rays: 6 + (vi % 3) }
      : { core: '#FFE9A0', edge: '#FFB347', glow: '#FFD66B', rays: 6 + (vi % 3) }; break;
    case 7: L = { core: '#FFF3C4', edge: '#FF9A3D', glow: '#FFB347', rays: 8 }; break;
    case 8: L = { core: '#FF8A4D', edge: '#C2452D', glow: '#FF6A3D', rays: 6 }; break;
    case 9: L = vi % 2 ? { core: '#FFC8CF', edge: '#FF5E73', glow: '#FF5E73', rays: 8 + (vi % 5) }
      : { core: '#CFE4FF', edge: '#7FB0FF', glow: '#7FB0FF', rays: 8 + (vi % 5) }; break;
    case 10: L = { core: '#EAF6FF', beam: '#7FD6FF' }; break;
    default: L = { ring: '#FFC15A', d0: '#FF8A3D', d1: '#C48BFF', tilt: (hash01(vi, 5) - 0.5) * 1.0 };
  }
  lookCache.set(key, L);
  return L;
}

/** Soft additive halos drawn behind a body. [{color, scale (x radius), alpha}] */
export function glowsFor(stage, L) {
  switch (stage) {
    case 3: return L.type === 'lava' ? [{ color: '#FF8A3D', scale: 1.35, alpha: 0.2 }] : null;
    case 5: return [{ color: '#E9D8FF', scale: 1.7, alpha: 0.28 }];
    case 6: return [{ color: L.glow, scale: 2.4, alpha: 0.5 }, { color: L.core, scale: 1.3, alpha: 0.5 }];
    case 7: return [{ color: L.glow, scale: 3.6, alpha: 0.42 }, { color: L.edge, scale: 2.0, alpha: 0.4 }, { color: L.core, scale: 1.3, alpha: 0.5 }];
    case 8: return [{ color: L.glow, scale: 4.0, alpha: 0.42 }, { color: L.edge, scale: 2.1, alpha: 0.4 }];
    case 9: return [{ color: L.glow, scale: 5.2, alpha: 0.46 }, { color: L.core, scale: 2.2, alpha: 0.4 }, { color: L.core, scale: 1.3, alpha: 0.45 }];
    case 10: return [{ color: L.beam, scale: 6.0, alpha: 0.22 }, { color: L.beam, scale: 2.8, alpha: 0.75 }, { color: L.core, scale: 1.5, alpha: 0.7 }];
    default: return null;
  }
}

export function variantOf(body) {
  if (body.variant != null && Number.isFinite(body.variant)) return ((body.variant | 0) % VARIANTS + VARIANTS) % VARIANTS;
  return seedInt(body.seed) % VARIANTS;
}

// ---- baking helpers ---------------------------------------------------------------------------

function rbFor(pad, bucket) {
  return Math.max(6, Math.min(bucket, Math.floor(MAX_TEX / (2 * pad))));
}

function mkLayer(pad, bucket, draw, add) {
  const Rb = rbFor(pad, bucket);
  const S = Math.ceil(2 * Rb * pad);
  const c = makeCanvas(S, S);
  const g = c.getContext('2d');
  g.translate(S / 2, S / 2);
  draw(g, Rb);
  return { c, S, Rb, add: !!add };
}

function smoothPath(g, pts, R) {
  const n = pts.length;
  const mx = (a, b) => [(a[0] + b[0]) / 2 * R, (a[1] + b[1]) / 2 * R];
  const m0 = mx(pts[n - 1], pts[0]);
  g.beginPath();
  g.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const p = pts[i], m = mx(p, pts[(i + 1) % n]);
    g.quadraticCurveTo(p[0] * R, p[1] * R, m[0], m[1]);
  }
  g.closePath();
}

function polyPath(g, pts, R) {
  g.beginPath();
  g.moveTo(pts[0][0] * R, pts[0][1] * R);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] * R, pts[i][1] * R);
  g.closePath();
}

function blob(g, cx, cy, r, rng, n) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU, rr = r * (0.65 + rng() * 0.5);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  smoothPath(g, pts.map((p) => [p[0] / 1, p[1] / 1]), 1);
}

function crater(g, x, y, r, dark, light) {
  g.fillStyle = rgba(dark, 0.38);
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.lineWidth = Math.max(1, r * 0.18);
  g.strokeStyle = rgba(light, 0.4);
  g.beginPath(); g.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); // lit lower-right wall
  g.strokeStyle = rgba(dark, 0.55);
  g.beginPath(); g.arc(x, y, r, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); // shadowed upper-left wall
}

function rimStroke(g, R, color, alpha, wMul) {
  const lw = Math.max(1.5, R * 0.03) * (wMul || 1);
  const gr = g.createLinearGradient(-R, -R, R * 0.35, R * 0.35);
  gr.addColorStop(0, rgba(color, alpha));
  gr.addColorStop(1, rgba(color, 0));
  g.strokeStyle = gr;
  g.lineWidth = lw;
  g.beginPath(); g.arc(0, 0, R - lw / 2, 0, TAU); g.stroke();
}

function bakeShade(bucket, o) {
  return mkLayer(1.22, bucket, (g, R) => {
    if (o.hazeA > 0) {
      const gr = g.createRadialGradient(0, 0, R * 0.88, 0, 0, R * 1.2);
      gr.addColorStop(0, rgba(o.haze, o.hazeA * 0.25));
      gr.addColorStop(0.375, rgba(o.haze, o.hazeA));
      gr.addColorStop(1, rgba(o.haze, 0));
      g.fillStyle = gr;
      g.beginPath(); g.arc(0, 0, R * 1.2, 0, TAU); g.fill();
    }
    g.save();
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
    const t = g.createRadialGradient(-R * 0.38, -R * 0.38, R * 0.15, -R * 0.38, -R * 0.38, R * 1.8);
    t.addColorStop(0, rgba(o.dark, 0));
    t.addColorStop(0.45, rgba(o.dark, 0));
    t.addColorStop(1, rgba(o.dark, o.shadowA));
    g.fillStyle = t;
    g.fillRect(-R, -R, 2 * R, 2 * R);
    g.restore();
    if (o.rimA > 0) rimStroke(g, R, o.rim || '#EAF0FF', o.rimA, 1);
  });
}

// ---- bakers -----------------------------------------------------------------------------------

function bakeRock(stage, vi, bucket) {
  const L = look(stage, vi);
  const rng = mulberry32(seedInt(stage * 1013 + vi * 77 + 5));
  const jag = stage === 0;
  const n = jag ? 7 + ((rng() * 3) | 0) : 9 + ((rng() * 3) | 0);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = ((i + (rng() - 0.5) * 0.55) / n) * TAU;
    const rr = jag ? 0.66 + rng() * 0.34 : 0.8 + rng() * 0.2;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  const path = (g, R) => (jag ? polyPath(g, pts, R) : smoothPath(g, pts, R));
  const surf = mkLayer(1.15, bucket, (g, R) => {
    const fill = g.createLinearGradient(-R, -R, R, R);
    fill.addColorStop(0, lighten(L.body, 0.22));
    fill.addColorStop(0.5, L.body);
    fill.addColorStop(1, mixHex(L.body, L.dark, 0.6));
    path(g, R);
    g.fillStyle = fill;
    g.fill();
    g.save();
    path(g, R);
    g.clip();
    // dark crescent on the lower-right (light is upper-left)
    g.beginPath();
    g.rect(-2 * R, -2 * R, 4 * R, 4 * R);
    g.arc(-0.32 * R, -0.32 * R, 1.12 * R, 0, TAU, true);
    g.fillStyle = rgba(L.dark, 0.5);
    g.fill('evenodd');
    if (R >= 12) {
      const nc = stage === 0 ? 1 + ((rng() * 2) | 0) : 2 + ((rng() * 2) | 0);
      for (let i = 0; i < nc; i++) {
        const a = rng() * TAU, d = rng() * 0.5;
        crater(g, Math.cos(a) * d * R, Math.sin(a) * d * R, R * (0.1 + rng() * 0.14), L.dark, lighten(L.body, 0.35));
      }
    }
    g.restore();
    path(g, R);
    const lw = Math.max(1.5, R * 0.03);
    const rg = g.createLinearGradient(-R, -R, R * 0.3, R * 0.3);
    rg.addColorStop(0, rgba(L.rim, 0.95));
    rg.addColorStop(1, rgba(L.rim, 0));
    g.lineJoin = 'round';
    g.lineWidth = lw;
    g.strokeStyle = rg;
    g.stroke();
  });
  return { surf, rotates: true };
}

function bakeIcy(stage, vi, bucket) {
  const L = look(stage, vi);
  const rng = mulberry32(seedInt(2000 + vi * 31));
  const surf = mkLayer(1.22, bucket, (g, R) => {
    g.save();
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
    const base = g.createRadialGradient(-R * 0.3, -R * 0.3, 0, 0, 0, R * 1.1);
    base.addColorStop(0, lighten(L.body, 0.3));
    base.addColorStop(1, mixHex(L.body, L.dark, 0.35));
    g.fillStyle = base;
    g.fillRect(-R, -R, 2 * R, 2 * R);
    for (let i = 0; i < 9; i++) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * 0.85 * R, r = R * (0.15 + rng() * 0.3);
      const light = rng() < 0.5;
      const col = light ? '#FFFFFF' : L.haze;
      const gr = g.createRadialGradient(Math.cos(a) * d, Math.sin(a) * d, 0, Math.cos(a) * d, Math.sin(a) * d, r);
      gr.addColorStop(0, rgba(col, light ? 0.28 : 0.22));
      gr.addColorStop(1, rgba(col, 0));
      g.fillStyle = gr;
      g.fillRect(-R, -R, 2 * R, 2 * R);
    }
    // fine cracks + a few small craters
    g.strokeStyle = rgba('#FFFFFF', 0.22);
    g.lineWidth = Math.max(1, R * 0.015);
    for (let i = 0; i < 4; i++) {
      let x = (rng() - 0.5) * R * 1.4, y = (rng() - 0.5) * R * 1.4;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rng() - 0.5) * R * 0.5; y += (rng() - 0.5) * R * 0.5; g.lineTo(x, y); }
      g.stroke();
    }
    if (R >= 14) for (let i = 0; i < 3; i++) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * 0.7 * R;
      crater(g, Math.cos(a) * d, Math.sin(a) * d, R * (0.06 + rng() * 0.07), L.dark, '#FFFFFF');
    }
    g.restore();
  });
  const shade = bakeShade(bucket, { haze: L.haze, hazeA: 0.45, dark: L.dark, shadowA: 0.62, rim: '#FFFFFF', rimA: 0.85 });
  return { surf, shade, rotates: true };
}

function bakeRocky(stage, vi, bucket) {
  const L = look(stage, vi);
  const rng = mulberry32(seedInt(3000 + vi * 53));
  const surf = mkLayer(1.22, bucket, (g, R) => {
    g.save();
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
    const base = g.createRadialGradient(-R * 0.25, -R * 0.25, 0, 0, 0, R * 1.15);
    if (L.type === 'terrestrial') {
      base.addColorStop(0, lighten(L.ocean, 0.12));
      base.addColorStop(1, mixHex(L.ocean, '#10142B', 0.35));
      g.fillStyle = base; g.fillRect(-R, -R, 2 * R, 2 * R);
      const nc = 2 + ((rng() * 3) | 0);
      for (let i = 0; i < nc; i++) {
        const a = rng() * TAU, d = rng() * 0.55 * R;
        const cx = Math.cos(a) * d, cy = Math.sin(a) * d, r = R * (0.2 + rng() * 0.22);
        g.fillStyle = L.land;
        blob(g, cx, cy, r, rng, 8); g.fill();
        g.fillStyle = rgba(lighten(L.land, 0.35), 0.35);
        blob(g, cx - r * 0.2, cy - r * 0.2, r * 0.55, rng, 7); g.fill();
      }
      g.fillStyle = rgba('#FFFFFF', 0.85); // polar cap
      g.beginPath(); g.ellipse(0, -R * 0.96, R * 0.5, R * 0.18, 0, 0, TAU); g.fill();
      g.strokeStyle = rgba('#FFFFFF', 0.28); g.lineWidth = Math.max(1, R * 0.04); g.lineCap = 'round';
      for (let i = 0; i < 4; i++) { // cloud wisps
        const r = R * (0.3 + rng() * 0.6), a0 = rng() * TAU;
        g.beginPath(); g.arc(0, 0, r, a0, a0 + 0.6 + rng() * 0.8); g.stroke();
      }
    } else if (L.type === 'lava') {
      base.addColorStop(0, lighten(L.accent, 0.05));
      base.addColorStop(1, L.ocean);
      g.fillStyle = base; g.fillRect(-R, -R, 2 * R, 2 * R);
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {
        g.strokeStyle = pass === 0 ? rgba(L.crack, 0.28) : rgba(lighten(L.crack, 0.25), 0.95);
        g.lineWidth = Math.max(1, R * (pass === 0 ? 0.06 : 0.022));
        const r2 = mulberry32(seedInt(3300 + vi));
        for (let i = 0; i < 6; i++) {
          let x = (r2() - 0.5) * R * 1.5, y = (r2() - 0.5) * R * 1.5, a = r2() * TAU;
          g.beginPath(); g.moveTo(x, y);
          for (let k = 0; k < 5; k++) { a += (r2() - 0.5) * 1.6; x += Math.cos(a) * R * 0.2; y += Math.sin(a) * R * 0.2; g.lineTo(x, y); }
          g.stroke();
        }
      }
    } else { // metallic
      base.addColorStop(0, lighten(L.ocean, 0.2));
      base.addColorStop(1, mixHex(L.ocean, L.accent, 0.6));
      g.fillStyle = base; g.fillRect(-R, -R, 2 * R, 2 * R);
      g.strokeStyle = rgba(L.accent, 0.5); g.lineWidth = Math.max(1, R * 0.02);
      for (let i = 1; i <= 4; i++) { g.beginPath(); g.arc(0, 0, R * i * 0.24, 0, TAU); g.stroke(); }
      for (let i = 0; i < 6; i++) { const a = rng() * TAU; g.beginPath(); g.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2); g.lineTo(Math.cos(a) * R * 1.1, Math.sin(a) * R * 1.1); g.stroke(); }
      for (let i = 0; i < 4; i++) { const a = rng() * TAU, d = rng() * 0.7 * R; crater(g, Math.cos(a) * d, Math.sin(a) * d, R * (0.06 + rng() * 0.06), L.accent, '#FFFFFF'); }
    }
    g.restore();
  });
  const shade = bakeShade(bucket, { haze: L.haze, hazeA: L.hazeA, dark: L.dark, shadowA: 0.68, rim: lighten(L.haze, 0.5), rimA: 0.85 });
  return { surf, shade, rotates: true };
}

function bakeGas(stage, vi, bucket) {
  const L = look(stage, vi);
  const rng = mulberry32(seedInt(4000 + stage * 17 + vi * 59));
  const soft = L.soft;
  const Rb = rbFor(1.22, bucket);
  const R = Rb;
  const nb = 4 + ((rng() * 3) | 0);
  const ws = [];
  let sum = 0;
  for (let i = 0; i < nb; i++) { const w = 0.6 + rng(); ws.push(w); sum += w; }
  const bands = [];
  let y = -R;
  const W = Math.ceil(3 * R);
  for (let i = 0; i < nb; i++) {
    const h = (ws[i] / sum) * 2 * R, feather = h * 0.5;
    const H = Math.ceil(h + 2 * feather);
    const c = makeCanvas(W, H), g = c.getContext('2d');
    let col = L.bands[(i + ((rng() * 2) | 0)) % 3];
    col = rng() < 0.5 ? lighten(col, 0.08 + rng() * 0.12) : darken(col, 0.05 + rng() * 0.12);
    if (soft) col = mixHex(col, '#E9D8FF', 0.25);
    g.fillStyle = col; g.fillRect(0, 0, W, H);
    const blobs = soft ? 8 : 16;
    for (let k = 0; k < blobs; k++) {
      const x = rng() * W, yy = feather * 0.4 + rng() * (h + feather * 1.2);
      const rx = R * (0.12 + rng() * 0.35), ry = Math.max(2, h * (0.1 + rng() * 0.3));
      const light = rng() < 0.5;
      g.fillStyle = rgba(light ? lighten(col, 0.5) : darken(col, 0.45), (soft ? 0.14 : 0.26) * (0.5 + rng()));
      for (const dx of [0, -W, W]) { g.beginPath(); g.ellipse(x + dx, yy, rx, ry, 0, 0, TAU); g.fill(); }
    }
    g.strokeStyle = rgba(lighten(col, 0.4), soft ? 0.1 : 0.2);
    g.lineWidth = Math.max(1, R * 0.012);
    for (let k = 0; k < 3; k++) { const yy = feather + rng() * h; g.beginPath(); g.moveTo(0, yy); g.lineTo(W, yy + (rng() - 0.5) * 3); g.stroke(); }
    g.globalCompositeOperation = 'destination-in';
    const m = g.createLinearGradient(0, 0, 0, H);
    m.addColorStop(0, 'rgba(0,0,0,0)');
    m.addColorStop(feather / H, 'rgba(0,0,0,1)');
    m.addColorStop((feather + h) / H, 'rgba(0,0,0,1)');
    m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(0, 0, W, H);
    bands.push({ c, y: y - feather, W, H, speed: (rng() < 0.5 ? -1 : 1) * (0.015 + rng() * 0.035) * R, phase: rng() * W });
    y += h;
  }
  // storm eye
  const ew = R * (soft ? 0.26 : 0.3), eh = R * (soft ? 0.14 : 0.17);
  const ec = makeCanvas(Math.ceil(ew * 2.6), Math.ceil(eh * 2.6));
  {
    const g = ec.getContext('2d');
    g.translate(ec.width / 2, ec.height / 2);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, ew * 1.2);
    gr.addColorStop(0, rgba(L.eye, soft ? 0.35 : 0.9));
    gr.addColorStop(0.55, rgba(L.eye, soft ? 0.25 : 0.7));
    gr.addColorStop(1, rgba(L.eye, 0));
    g.scale(1, eh / ew);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, ew * 1.2, 0, TAU); g.fill();
    g.strokeStyle = rgba(lighten(L.eye, 0.5), soft ? 0.25 : 0.5);
    g.lineWidth = Math.max(1, R * 0.02);
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, ew * (0.35 + i * 0.22), i * 1.3, i * 1.3 + 3.2); g.stroke(); }
  }
  const eye = { c: ec, x: R * 0.28, y: R * 0.3, w: ec.width, h: ec.height };
  const tilt = (hash01(vi, 11) - 0.5) * 0.35;

  const paintBands = (g, t) => {
    g.fillStyle = L.bands[1]; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    for (const b of bands) {
      const o = (((b.phase + t * b.speed) % b.W) + b.W) % b.W;
      g.drawImage(b.c, -R - o, b.y);
      g.drawImage(b.c, -R - o + b.W, b.y);
    }
  };
  const surf = mkLayer(1.22, bucket, (g) => {
    g.save(); g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
    g.rotate(tilt);
    paintBands(g, 0);
    g.drawImage(eye.c, eye.x - eye.w / 2, eye.y - eye.h / 2);
    g.restore();
  });
  const shade = bakeShade(bucket, { haze: L.haze, hazeA: L.hazeA, dark: L.dark, shadowA: soft ? 0.5 : 0.66, rim: lighten(L.haze, 0.3), rimA: soft ? 0.18 : 0.7 });

  let under = null, over = null;
  if (L.ring) {
    const rtilt = -0.38 + (hash01(vi, 21) - 0.5) * 0.3;
    const ringDraw = (front) => (g, Rr) => {
      g.save();
      g.rotate(rtilt);
      g.beginPath();
      g.rect(-3 * Rr, front ? 0 : -3 * Rr, 6 * Rr, 3 * Rr);
      g.clip();
      g.scale(1, 0.36);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 2.1 * Rr);
      const c0 = L.bands[2], c1 = L.bands[0];
      gr.addColorStop(0.58, rgba(c0, 0));
      gr.addColorStop(0.62, rgba(c0, 0.55));
      gr.addColorStop(0.78, rgba(lighten(c0, 0.2), 0.7));
      gr.addColorStop(0.83, rgba(c1, 0.08));
      gr.addColorStop(0.88, rgba(c1, 0.6));
      gr.addColorStop(0.97, rgba(c1, 0.25));
      gr.addColorStop(1, rgba(c1, 0));
      g.fillStyle = gr;
      g.beginPath(); g.arc(0, 0, 2.1 * Rr, 0, TAU); g.fill();
      g.restore();
    };
    under = mkLayer(2.1, bucket, ringDraw(false));
    over = mkLayer(2.1, bucket, ringDraw(true));
  }
  return { surf, shade, under, over, gas: { bands, eye, R, tilt, paintBands } };
}

function bakeStar(stage, vi, bucket) {
  const L = look(stage, vi);
  const rng = mulberry32(seedInt(6000 + stage * 19 + vi * 71));
  const surf = mkLayer(1.1, bucket, (g, R) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
    gr.addColorStop(0, lighten(L.core, 0.55));
    gr.addColorStop(0.45, L.core);
    gr.addColorStop(0.9, mixHex(L.core, L.edge, 0.75));
    gr.addColorStop(1, L.edge);
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.save();
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.clip();
    for (let i = 0; i < 16; i++) { // static granulation
      const a = rng() * TAU, d = Math.sqrt(rng()) * 0.85 * R, r = R * (0.08 + rng() * 0.16);
      const light = rng() < 0.5;
      const x = Math.cos(a) * d, y = Math.sin(a) * d;
      const bg = g.createRadialGradient(x, y, 0, x, y, r);
      bg.addColorStop(0, rgba(light ? '#FFFFFF' : L.edge, light ? 0.22 : 0.2));
      bg.addColorStop(1, rgba(light ? '#FFFFFF' : L.edge, 0));
      g.fillStyle = bg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    const lm = g.createRadialGradient(0, 0, R * 0.72, 0, 0, R); // limb darkening
    lm.addColorStop(0, rgba(L.edge, 0));
    lm.addColorStop(1, rgba(darken(L.edge, 0.35), 0.5));
    g.fillStyle = lm; g.fillRect(-R, -R, 2 * R, 2 * R);
    g.restore();
  });
  // rays: alternating long and short tapered spikes
  const long = stage === 9 ? 2.3 : stage === 7 ? 1.25 : stage === 8 ? 0.9 : 1.0;
  const n = L.rays;
  const rayPad = 1.1 + long * 1.05;
  const rays = mkLayer(rayPad, bucket, (g, R) => {
    const r2 = mulberry32(seedInt(6500 + stage * 7 + vi));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + (r2() - 0.5) * 0.15;
      const len = R * (1 + long * (i % 2 ? 0.55 : 1) * (0.75 + r2() * 0.4));
      const w = R * (stage === 8 ? 0.34 : 0.17) * (i % 2 ? 0.8 : 1);
      g.save();
      g.rotate(a);
      const gr = g.createLinearGradient(R * 0.8, 0, len, 0);
      gr.addColorStop(0, rgba(L.core, stage === 8 ? 0.35 : 0.6));
      gr.addColorStop(0.5, rgba(L.edge, 0.2));
      gr.addColorStop(1, rgba(L.edge, 0));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(R * 0.8, -w); g.lineTo(len, 0); g.lineTo(R * 0.8, w); g.closePath(); g.fill();
      g.restore();
    }
  }, true);
  return { surf, rays, rayDir: vi % 2 ? 1 : -1 };
}

function bakeNeutron(stage, vi, bucket) {
  const L = look(stage, vi);
  const surf = mkLayer(1.15, bucket, (g, R) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, R);
    gr.addColorStop(0, '#FFFFFF');
    gr.addColorStop(0.5, L.core);
    gr.addColorStop(0.88, mixHex(L.core, L.beam, 0.6));
    gr.addColorStop(1, L.beam);
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.strokeStyle = rgba('#FFFFFF', 0.9);
    g.lineWidth = Math.max(1.2, R * 0.06);
    g.beginPath(); g.arc(0, 0, R - g.lineWidth / 2, 0, TAU); g.stroke();
  });
  const len = 5.2;
  const beams = mkLayer(len + 0.4, bucket, (g, R) => {
    for (let s = 0; s < 2; s++) {
      g.save();
      g.rotate(s * Math.PI);
      const gr = g.createLinearGradient(R * 0.6, 0, R * len, 0);
      gr.addColorStop(0, rgba('#FFFFFF', 0.95));
      gr.addColorStop(0.18, rgba(L.beam, 0.6));
      gr.addColorStop(1, rgba(L.beam, 0));
      g.fillStyle = gr;
      g.beginPath(); g.moveTo(R * 0.5, -R * 0.2); g.lineTo(R * len, -R * 0.03); g.lineTo(R * len, R * 0.03); g.lineTo(R * 0.5, R * 0.2); g.closePath(); g.fill();
      // thin hot core line
      g.strokeStyle = rgba('#FFFFFF', 0.7);
      g.lineWidth = Math.max(1, R * 0.05);
      g.beginPath(); g.moveTo(R * 0.6, 0); g.lineTo(R * len * 0.55, 0); g.stroke();
      g.restore();
    }
  }, true);
  return { surf, rays: beams };
}

function bakeHole(stage, vi, bucket) {
  const L = look(stage, vi);
  const discDraw = (front) => (g, R) => {
    g.save();
    if (front) { g.beginPath(); g.arc(0, 0, R * 1.02, 0, TAU); g.clip(); }
    g.rotate(L.tilt);
    g.beginPath();
    g.rect(-3 * R, front ? 0 : -3 * R, 6 * R, front ? 3 * R : 6 * R);
    g.clip();
    g.scale(1, 0.34);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 2.7 * R);
    gr.addColorStop(0.36, rgba('#FFE2A0', 0));
    gr.addColorStop(0.42, rgba('#FFE2A0', 0.95));
    gr.addColorStop(0.52, rgba(L.d0, 0.85));
    gr.addColorStop(0.72, rgba(mixHex(L.d0, L.d1, 0.6), 0.5));
    gr.addColorStop(0.88, rgba(L.d1, 0.2));
    gr.addColorStop(1, rgba(L.d1, 0));
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, 2.7 * R, 0, TAU); g.fill();
    g.strokeStyle = rgba('#FFE2A0', 0.3);
    g.lineWidth = Math.max(1, R * 0.03);
    for (const k of [1.55, 1.95]) { g.beginPath(); g.arc(0, 0, k * R, 0, TAU); g.stroke(); }
    g.restore();
  };
  const under = mkLayer(2.8, bucket, (g, R) => {
    // faint lensing halo (soft Einstein-ring look), then the back half of the disc
    const lg = g.createRadialGradient(0, 0, R, 0, 0, R * 2.0);
    lg.addColorStop(0, rgba(L.ring, 0.34));
    lg.addColorStop(0.15, rgba(L.d1, 0.16));
    lg.addColorStop(1, rgba(L.d1, 0));
    g.fillStyle = lg; g.beginPath(); g.arc(0, 0, R * 2.0, 0, TAU); g.fill();
    discDraw(false)(g, R);
  });
  const over = mkLayer(2.8, bucket, discDraw(true));
  return { under, over, hole: { tilt: L.tilt } };
}

const BAKERS = { rock: bakeRock, icy: bakeIcy, rocky: bakeRocky, gas: bakeGas, star: bakeStar, neutron: bakeNeutron, hole: bakeHole };

function layerPixels(l) { return l ? l.S * l.S : 0; }
function spritePixels(s) {
  let p = layerPixels(s.surf) + layerPixels(s.shade) + layerPixels(s.under) + layerPixels(s.over) + layerPixels(s.rays);
  if (s.gas) for (const b of s.gas.bands) p += b.W * b.H;
  return p;
}

// ---- painter ----------------------------------------------------------------------------------

export function createBodyPainter() {
  const cache = new Map();
  const pending = new Map();
  let pixels = 0;
  let frame = 0;
  let urgentLeft = 0;
  const B = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const anim = [1, 1];

  const bucketFor = (rpx) => { let b = 8; while (b < rpx && b < 512) b *= 2; return b; };

  function bake(stage, vi, bucket) {
    const key = stage * 1e6 + vi * 1e3 + bucket;
    let s = cache.get(key);
    if (s) return s;
    s = BAKERS[SPEC[stage].kind](stage, vi, bucket);
    s.used = frame;
    s.bucket = bucket;
    s.look = look(stage, vi);
    s.glows = glowsFor(stage, s.look);
    s.px = spritePixels(s);
    cache.set(key, s);
    pixels += s.px;
    pending.delete(key);
    if (pixels > PIXEL_BUDGET) {
      for (const [k, v] of cache) {
        if (pixels <= PIXEL_BUDGET * 0.85) break;
        if (v.used >= frame - 1) continue;
        cache.delete(k);
        pixels -= v.px;
      }
    }
    return s;
  }

  function xf(ctx, sx, sy, ang) {
    const cs = Math.cos(ang), sn = Math.sin(ang);
    ctx.setTransform(B.a * cs + B.c * sn, B.b * cs + B.d * sn, -B.a * sn + B.c * cs, -B.b * sn + B.d * cs,
      B.a * sx + B.c * sy + B.e, B.b * sx + B.d * sy + B.f);
  }
  function resetXf(ctx) { ctx.setTransform(B.a, B.b, B.c, B.d, B.e, B.f); }

  /** Blit one baked layer centred at (sx, sy) for a body of CSS radius r. */
  function blit(ctx, l, sx, sy, r, ang) {
    const dw = (l.S * r) / l.Rb;
    if (!ang) { ctx.drawImage(l.c, sx - dw / 2, sy - dw / 2, dw, dw); return; }
    xf(ctx, sx, sy, ang);
    ctx.drawImage(l.c, -dw / 2, -dw / 2, dw, dw);
    resetXf(ctx);
  }

  return {
    setBase(a, b, c, d, e, f) { B.a = a; B.b = b; B.c = c; B.d = d; B.e = e; B.f = f; },

    beginFrame() { frame++; urgentLeft = 10; },

    /** Bake queued sprites within a time budget (ms). */
    endFrame(budgetMs) {
      if (!pending.size) return;
      const t0 = performance.now();
      for (const [k, p] of pending) {
        if (performance.now() - t0 > budgetMs) break;
        bake(p[0], p[1], p[2]);
      }
    },

    /** Best available sprite for a body at this on-screen size (device px radius). */
    spriteFor(stage, vi, rpxDev) {
      const bucket = bucketFor(rpxDev);
      const key = stage * 1e6 + vi * 1e3 + bucket;
      let s = cache.get(key);
      if (s) {
        if (s.used !== frame) { s.used = frame; cache.delete(key); cache.set(key, s); }
        return s;
      }
      for (const nb of [bucket * 2, bucket / 2, bucket * 4, bucket / 4]) {
        if (nb < 8 || nb > 512) continue;
        const n = cache.get(stage * 1e6 + vi * 1e3 + nb);
        if (n) { n.used = frame; pending.set(key, [stage, vi, bucket]); return n; }
      }
      if (urgentLeft > 0) { urgentLeft--; return bake(stage, vi, bucket); }
      pending.set(key, [stage, vi, bucket]);
      return null;
    },

    /** Radius multiplier (giant breathing) and alpha multiplier (supergiant flicker). */
    animate(stage, time, seed) {
      let rs = 1, fa = 1;
      if (stage === 8) rs = 1 + 0.08 * Math.sin((time / 4) * TAU + seed);
      else if (stage === 9) fa = 0.88 + 0.12 * (0.5 + 0.5 * Math.sin(time * 7.3 + seed) * Math.sin(time * 3.1 + seed * 2));
      else if (stage === 6 || stage === 7) rs = 1 + 0.03 * Math.sin((time / 3) * TAU + seed);
      anim[0] = rs; anim[1] = fa;
      return anim; // shared array: read it immediately
    },

    /** Pass A (additive): halos, star rays, neutron beams. */
    drawAdditive(ctx, sp, sx, sy, r, time, alpha, seed, quality, isTiny) {
      const gl = sp.glows;
      if (gl) {
        const n = quality >= 1 && !isTiny ? gl.length : 1;
        for (let i = 0; i < n; i++) {
          const g = gl[i];
          drawGlow(ctx, g.color, sx, sy, r * g.scale, g.alpha * alpha);
        }
      }
      if (sp.rays) {
        const kind = sp.rays;
        ctx.globalAlpha = 0.85 * alpha;
        if (sp.rayDir) blit(ctx, kind, sx, sy, r, time * 0.06 * sp.rayDir + seed);
        else { // neutron beams: fast sweep, with a lighthouse flash on the core
          const a = time * 2.6 + seed;
          blit(ctx, kind, sx, sy, r, a);
          const flash = Math.pow(Math.max(0, Math.cos(a * 2)), 10);
          if (flash > 0.02) drawGlow(ctx, '#FFFFFF', sx, sy, r * 3.2, flash * 0.55 * alpha);
        }
      }
    },

    /** Pass B (source-over): under layer, surface, shade, over layer. */
    drawSurface(ctx, sp, sx, sy, r, ang, time, alpha, dynamicGas) {
      ctx.globalAlpha = alpha;
      if (sp.under) blit(ctx, sp.under, sx, sy, r, 0);
      if (sp.hole) { // black disc stays vector so its edge is crisp at any size
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
      } else if (sp.gas && dynamicGas) {
        const G = sp.gas;
        const k = r / G.R;
        ctx.save();
        xf(ctx, sx, sy, G.tilt);
        ctx.scale(k, k);
        ctx.beginPath(); ctx.arc(0, 0, G.R, 0, TAU); ctx.clip();
        G.paintBands(ctx, time);
        const e = G.eye, br = 1 + 0.06 * Math.sin(time * 0.9);
        ctx.drawImage(e.c, e.x - (e.w * br) / 2 + Math.sin(time * 0.12) * G.R * 0.05, e.y - (e.h * br) / 2, e.w * br, e.h * br);
        ctx.restore();
        resetXf(ctx);
      } else if (sp.surf) {
        ctx.globalAlpha = alpha;
        blit(ctx, sp.surf, sx, sy, r, sp.gas ? 0 : ang);
      }
      if (sp.shade) { ctx.globalAlpha = alpha; blit(ctx, sp.shade, sx, sy, r, 0); }
      if (sp.over) { ctx.globalAlpha = alpha; blit(ctx, sp.over, sx, sy, r, 0); }
      if (sp.hole) {
        ctx.globalAlpha = alpha;
        ctx.lineWidth = Math.max(1.2, r * 0.045);
        ctx.strokeStyle = '#FFC15A';
        ctx.beginPath(); ctx.arc(sx, sy, r * 1.035, 0, TAU); ctx.stroke();
      }
    },

    /** Pass C (additive): moving granulation, flares, accretion hot spots. */
    drawDynamic(ctx, sp, stage, sx, sy, r, time, alpha, seed) {
      const L = sp.look;
      if (sp.rayDir !== undefined && r >= 18) {
        for (let k = 0; k < 4; k++) {
          const a = time * (0.15 + k * 0.07) + k * 1.7 + seed;
          const d = r * (0.38 + 0.16 * Math.sin(time * 0.3 + k * 2));
          drawGlow(ctx, k % 2 ? '#FFFFFF' : L.core, sx + Math.cos(a) * d, sy + Math.sin(a) * d, r * 0.42, 0.2 * alpha);
        }
        // flares: short arcs that lick outward from the limb
        const rate = stage === 9 ? 0.18 : 0.3;
        ctx.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          const cyc = time * rate + k / 3 + seed * 0.13;
          const ph = cyc - Math.floor(cyc), idx = Math.floor(cyc);
          const e = Math.sin(ph * Math.PI);
          const a0 = hash01(seed + k * 3.1, idx) * TAU;
          ctx.globalAlpha = 0.55 * e * alpha;
          ctx.strokeStyle = L.core;
          ctx.lineWidth = Math.max(1.2, r * 0.07 * e);
          ctx.beginPath(); ctx.arc(sx, sy, r * (1.02 + 0.12 * e), a0, a0 + 0.45 + 0.35 * e); ctx.stroke();
          ctx.globalAlpha = 0.3 * e * alpha;
          ctx.lineWidth = Math.max(1, r * 0.03 * e);
          ctx.beginPath(); ctx.arc(sx, sy, r * (1.16 + 0.3 * e), a0 + 0.1, a0 + 0.4 + 0.25 * e); ctx.stroke();
        }
      } else if (sp.hole && r >= 10) {
        const tilt = sp.hole.tilt, cs = Math.cos(tilt), sn = Math.sin(tilt);
        for (let k = 0; k < 3; k++) {
          const rad = (1.35 + k * 0.4) * r;
          const th = time * (1.6 / (0.6 + k * 0.5)) + k * 2.1;
          const ex = Math.cos(th) * rad, ey = Math.sin(th) * rad * 0.34;
          const x = sx + ex * cs - ey * sn, y = sy + ex * sn + ey * cs;
          drawGlow(ctx, k ? '#FF8A3D' : '#FFE2A0', x, y, r * (0.55 - k * 0.1), (0.42 - k * 0.08) * alpha);
        }
        drawGlow(ctx, '#FFC15A', sx, sy, r * 1.35, 0.22 * alpha); // photon-ring bloom
      }
    },
  };
}
