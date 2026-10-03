// Pure physics helpers (no state). Exported separately so tests can exercise them directly.
import { DENSITY } from './classes.js';
import { smoothstep } from './rng.js';

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Gravitational parameter of a body: mu = Omega0^2 R^3 (circular surface orbit rate Omega0). */
export const mu = (g, radius) => g.surfaceRate * g.surfaceRate * radius * radius * radius;

/**
 * Softened, range-limited acceleration from a source at (sx, sz) with parameter `muS` and radius `R` on a point at (px, pz).
 * a = mu d / (d^2 + eps^2)^(3/2), eps = soften * R, tapering to zero over the outer 30 % of the range. Adds into out[0], out[1] (x, z).
 * Returns the magnitude added.
 */
export function softenedAccel(g, muS, R, sx, sz, px, pz, out) {
  const dx = sx - px; const dz = sz - pz;
  const range = g.rangeK * R;
  const d2 = dx * dx + dz * dz;
  if (d2 > range * range) return 0;
  const eps = g.soften * R;
  const k = muS / Math.pow(d2 + eps * eps, 1.5);
  let taper = 1;
  if (d2 > 0.49 * range * range) taper = 1 - smoothstep(0.7 * range, range, Math.sqrt(d2));
  out[0] += dx * k * taper; out[1] += dz * k * taper;
  return Math.sqrt(d2) * k * taper;
}

/** Mutual escape speed at centre distance d. */
export const escapeSpeed = (muSum, d) => Math.sqrt((2 * muSum) / Math.max(d, 1e-9));

/** Roche limit (centre distance) for a satellite of class clsS around a primary of class clsP and radius Rp (research 2.4). */
export function rocheDistance(r, Rp, clsP, clsS) {
  const rho = (DENSITY[clsP] || 2) / (DENSITY[clsS] || 2);
  return clamp(r.k * Rp * Math.cbrt(rho), r.minRadii * Rp, r.maxRadii * Rp);
}

/** Share of a prey's mass that the absorber keeps: gentle contact (relSpeed ~ escape speed) keeps more. */
export function absorbEfficiency(a, relSpeed, vesc) {
  const x = relSpeed / Math.max(vesc, 1e-9);
  return lerp(a.gentle, a.fast, smoothstep(a.gentleX, a.fastX, x));
}

/** Velocity of a mass m1 (v1) after taking up mass g carried at v2 (perfectly inelastic, momentum conserving). */
export function mergeVelocity(m1, v1, g, v2) {
  const k = 1 / (m1 + g);
  return (m1 * v1 + g * v2) * k;
}

/** Relative-state classification with hysteresis (same rule as the 2D game). */
export function classify(ratio, playerMass, bodyMass, prev) {
  const { dominate, hysteresis } = ratio;
  const prey = prev === 'prey' ? dominate * (1 - hysteresis) : dominate;
  const threat = prev === 'threat' ? dominate * (1 - hysteresis) : dominate;
  if (playerMass >= bodyMass * prey) return 'prey';
  if (bodyMass >= playerMass * threat) return 'threat';
  return 'neutral';
}

/** Specific orbital energy of (r, v) about a softened source. */
export function specificEnergy(muS, R, soften, d, speed2) {
  const eps = soften * R;
  return 0.5 * speed2 - muS / Math.sqrt(d * d + eps * eps);
}
