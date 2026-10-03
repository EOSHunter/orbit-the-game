// Analytic Kepler rails in the x-z play plane. Pure functions, exact and drift-free.
// orbit = { a, e, w, M0, n }   semi-major axis, eccentricity, periapsis angle, mean anomaly at t=0, mean motion (rad/s, signed)

export function solveKepler(M, e) {
  M = Math.atan2(Math.sin(M), Math.cos(M)); // wrap to (-pi, pi]
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 8; i++) {
    const f = E - e * Math.sin(E) - M;
    E -= f / (1 - e * Math.cos(E));
  }
  return E;
}

/** Position (out[0], out[2]) and velocity (vout[0], vout[2]) relative to the parent at time t. y components are left alone. */
export function railOffset(o, t, out, vout) {
  const E = solveKepler(o.M0 + o.n * t, o.e);
  const cE = Math.cos(E);
  const sE = Math.sin(E);
  const b = o.a * Math.sqrt(1 - o.e * o.e);
  const px = o.a * (cE - o.e);
  const pz = b * sE;
  const cw = Math.cos(o.w);
  const sw = Math.sin(o.w);
  out[0] = px * cw - pz * sw;
  out[2] = px * sw + pz * cw;
  if (vout) {
    const Ed = o.n / (1 - o.e * cE);
    const vx = -o.a * sE * Ed;
    const vz = b * cE * Ed;
    vout[0] = vx * cw - vz * sw;
    vout[2] = vx * sw + vz * cw;
  }
}

export const orbitPeriod = (o) => (2 * Math.PI) / Math.abs(o.n);
