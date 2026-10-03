// Small shared helpers for the render layer: math, seeded RNG, colour parsing.
// Dependency-free ES module.

export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const easeOutBack = (t) => {
  t = clamp(t, 0, 1);
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Small, fast, seedable PRNG returning [0,1). */
export function mulberry32(a) {
  a = a | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn any finite number (integer or float such as Math.random()) into a well-mixed uint32. */
export function seedInt(s) {
  if (!Number.isFinite(s)) s = 0;
  const fl = Math.floor(s);
  const a = fl | 0;
  const f = Math.floor((s - fl) * 4294967296) | 0;
  let h = (a ^ Math.imul(f, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Deterministic [0,1) value from a seed and a salt (cheap, no allocation). */
export function hash01(seed, salt = 0) {
  let h = (seedInt(seed) + Math.imul(salt | 0, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ---- colour -------------------------------------------------------------

const rgbCache = new Map();

export function hexToRgb(hex) {
  let c = rgbCache.get(hex);
  if (c) return c;
  let h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  rgbCache.set(hex, c);
  return c;
}

export function rgbToHex(r, g, b) {
  const q = (v) => {
    v = Math.round(clamp(v, 0, 255));
    return (v < 16 ? '0' : '') + v.toString(16);
  };
  return '#' + q(r) + q(g) + q(b);
}

const rgbaCache = new Map();
/** 'rgba(r,g,b,a)' string. Alpha is quantised to 1/64 so the cache stays small. */
export function rgba(hex, a) {
  const qa = Math.round(clamp(a, 0, 1) * 64);
  const key = hex + qa;
  let s = rgbaCache.get(key);
  if (!s) {
    const [r, g, b] = hexToRgb(hex);
    s = 'rgba(' + r + ',' + g + ',' + b + ',' + qa / 64 + ')';
    if (rgbaCache.size > 4000) rgbaCache.clear();
    rgbaCache.set(key, s);
  }
  return s;
}

export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

export const lighten = (hex, t) => mixHex(hex, '#ffffff', t);
export const darken = (hex, t) => mixHex(hex, '#070914', t);

/** Rotate hue by `deg` degrees (used for the +-6 degree per-body variation). */
export function shiftHue(hex, deg) {
  if (!deg) return hex;
  const [r0, g0, b0] = hexToRgb(hex);
  const r = r0 / 255, g = g0 / 255, b = b0 / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rr = 0, gg = 0, bb = 0;
  if (h < 60) { rr = c; gg = x; }
  else if (h < 120) { rr = x; gg = c; }
  else if (h < 180) { gg = c; bb = x; }
  else if (h < 240) { gg = x; bb = c; }
  else if (h < 300) { rr = x; bb = c; }
  else { rr = c; bb = x; }
  return rgbToHex((rr + m) * 255, (gg + m) * 255, (bb + m) * 255);
}

/** Offscreen canvas that also works outside a window (falls back to OffscreenCanvas). */
export function makeCanvas(w, h) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w | 0);
    c.height = Math.max(1, h | 0);
    return c;
  }
  return new OffscreenCanvas(Math.max(1, w | 0), Math.max(1, h | 0));
}
