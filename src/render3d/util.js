import * as THREE from 'three';

export const CLS_DEFAULT = ['meteorite', 'asteroid', 'comet', 'dwarfPlanet', 'rockyPlanet', 'gasGiant', 'brownDwarf', 'star', 'neutronStar', 'blackHole', 'debris', 'fragment'];

/** Emitter whitelist (contract 2.1). Returns true if `cause` may glow on a body of this class. */
export function causeAllowed(cls, cause, variant, entry) {
  switch (cls) {
    case 'meteorite': case 'asteroid': case 'debris': case 'comet':
      return cause === 'impact-flash' || (cause === 'ablation' && entry != null) || (cause === 'atmospheric-entry' && entry != null);
    case 'dwarfPlanet': return cause === 'impact-flash';
    case 'rockyPlanet': return cause === 'impact-flash' || (cause === 'hot-ground' && variant === 'lava');
    case 'gasGiant': return false;
    case 'brownDwarf': return cause === 'stellar-remnant';
    case 'star': return cause === 'star';
    case 'neutronStar': return cause === 'stellar-remnant' || cause === 'pulsar-beam';
    case 'blackHole': return cause === 'accretion' || cause === 'jet';
    case 'fragment': return cause === 'impact-flash' || cause === 'hot-debris';
    default: return false;
  }
}

/** Kelvin -> linear RGB (same fit as the GLSL), un-normalised brightness 0..1. */
export function blackbodyRGB(K, out = [0, 0, 0]) {
  const t = Math.min(Math.max(K, 800), 40000) / 100;
  let r, g, b;
  r = t <= 66 ? 1 : Math.min(1, Math.max(0, 1.2929362 * Math.pow(t - 60, -0.1332048)));
  g = t <= 66 ? Math.min(1, Math.max(0, 0.3900816 * Math.log(t) - 0.6318414)) : Math.min(1, Math.max(0, 1.1298909 * Math.pow(t - 60, -0.0755148)));
  b = t >= 66 ? 1 : t <= 19 ? 0 : Math.min(1, Math.max(0, 0.5432068 * Math.log(t - 10) - 1.1962541));
  const dim = Math.min(1, Math.max(0, (K - 700) / 1200));
  const s = 0.25 + 0.75 * dim * dim * (3 - 2 * dim);
  out[0] = Math.pow(r, 2.2) * s; out[1] = Math.pow(g, 2.2) * s; out[2] = Math.pow(b, 2.2) * s;
  return out;
}

const _c = new THREE.Color();
export function hexLinear(hex, out = [0, 0, 0]) {
  _c.set(hex || '#808080'); out[0] = _c.r; out[1] = _c.g; out[2] = _c.b; return out;
}
export const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

export function seedFloat(seed) { return ((seed >>> 0) % 100003) + 0.37; }
export function frac01(seed, k) {
  let h = ((seed >>> 0) ^ Math.imul(k + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Column-major 4x4 from position, unit quaternion and uniform scale, written into arr at off. */
export function writeTRS(arr, off, px, py, pz, qx, qy, qz, qw, s) {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2, yy = qy * y2, yz = qy * z2, zz = qz * z2, wx = qw * x2, wy = qw * y2, wz = qw * z2;
  arr[off] = (1 - (yy + zz)) * s; arr[off + 1] = (xy + wz) * s; arr[off + 2] = (xz - wy) * s; arr[off + 3] = 0;
  arr[off + 4] = (xy - wz) * s; arr[off + 5] = (1 - (xx + zz)) * s; arr[off + 6] = (yz + wx) * s; arr[off + 7] = 0;
  arr[off + 8] = (xz + wy) * s; arr[off + 9] = (yz - wx) * s; arr[off + 10] = (1 - (xx + yy)) * s; arr[off + 11] = 0;
  arr[off + 12] = px; arr[off + 13] = py; arr[off + 14] = pz; arr[off + 15] = 1;
}

export function quatAxisAngle(ax, ay, az, ang, out) {
  const l = Math.hypot(ax, ay, az) || 1, s = Math.sin(ang / 2) / l;
  out[0] = ax * s; out[1] = ay * s; out[2] = az * s; out[3] = Math.cos(ang / 2); return out;
}
export function quatMul(a, b, out) {
  const ax = a[0], ay = a[1], az = a[2], aw = a[3], bx = b[0], by = b[1], bz = b[2], bw = b[3];
  out[0] = aw * bx + ax * bw + ay * bz - az * by;
  out[1] = aw * by - ax * bz + ay * bw + az * bx;
  out[2] = aw * bz + ax * by - ay * bx + az * bw;
  out[3] = aw * bw - ax * bx - ay * by - az * bz; return out;
}
