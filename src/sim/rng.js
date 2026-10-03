// Deterministic hashing and PRNG. No Math.random, no Date. Pure functions only.

const U32 = 4294967296;

function mix(h, v) {
  h = Math.imul(h ^ v, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 13;
  return h;
}

/** Stable integer mix of any number of integers (53-bit safe). Order matters. Returns uint32. */
export function hash32(...ints) {
  let h = 0x9e3779b9;
  for (let i = 0; i < ints.length; i++) {
    const v = ints[i];
    h = mix(h, v | 0);
    const hi = Math.floor(v / U32) | 0;
    if (hi !== 0 && hi !== -1) h = mix(h, hi);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Hash in [0, 1). */
export function hash01(...ints) {
  return hash32(...ints) / U32;
}

/** String -> uint32 (FNV-1a followed by an avalanche). */
export function hashString(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return hash32(h, s.length);
}

/** mulberry32: returns a function giving floats in [0, 1). */
export function makeRng(seed32) {
  let a = seed32 | 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / U32;
  };
}

/** A 53-bit-safe id built from two independent hashes (high part < 2^20 so ids stay below 2^52). */
export function makeId(...ints) {
  const hi = hash32(0x51, ...ints) & 0xfffff;
  const lo = hash32(0xa7, ...ints);
  return hi * U32 + lo;
}

const smooth = (t) => t * t * (3 - 2 * t);

/** Smooth value noise in [0, 1) on an integer lattice, bilinear with a smoothstep fade. */
export function noise2(seedH, level, x, z) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash32(seedH, level, ix, iz) / U32;
  const b = hash32(seedH, level, ix + 1, iz) / U32;
  const c = hash32(seedH, level, ix, iz + 1) / U32;
  const d = hash32(seedH, level, ix + 1, iz + 1) / U32;
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

export const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
