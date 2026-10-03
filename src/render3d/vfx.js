// Event-driven visual effects. Nothing here runs without an event or a state flag from the sim:
//   impact / hit / absorb flashes, ballistic ejecta that cool white -> yellow -> orange -> red -> black
//   (no smoke, no flame), Roche tidal streams (non-emissive dust), atmospheric-entry streak (ONLY while
//   body.entry != null), evolve ring, death burst, shed-regolith motes for thrust (grey, non-additive).
import * as THREE from 'three';
import { partVert, partFrag } from './glsl/misc.js';

class Pool {
  constructor(scene, shared, max, additive, order) {
    this.max = max; this.head = 0;
    this.p = new Float64Array(max * 3); this.v = new Float32Array(max * 3);
    this.age = new Float32Array(max).fill(1); this.life = new Float32Array(max).fill(1);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.t0 = new Float32Array(max); this.t1 = new Float32Array(max);
    this.b0 = new Float32Array(max); this.kind = new Uint8Array(max); this.shape = new Uint8Array(max);
    this.spin = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.gp = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.gs = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    this.gst = new THREE.BufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.gp); g.setAttribute('aSize', this.gs); g.setAttribute('aState', this.gst);
    this.uniforms = { uViewH: shared.uViewH, uPixelRatio: { value: 1 } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: partVert, fragmentShader: partFrag, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.points.frustumCulled = false; this.points.renderOrder = order;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, t0, t1, b0, kind = 0, shape = 0) {
    const i = this.head; this.head = (this.head + 1) % this.max;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.age[i] = 0; this.life[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.t0[i] = t0; this.t1[i] = t1;
    this.b0[i] = b0; this.kind[i] = kind; this.shape[i] = shape; this.spin[i] = Math.random() * 6.28;
    return i;
  }
  clear() { this.age.fill(1); }
  shift(sx, sy, sz) { for (let i = 0; i < this.max; i++) { this.p[i * 3] -= sx; this.p[i * 3 + 1] -= sy; this.p[i * 3 + 2] -= sz; } }
  update(dt, tgt, pixelRatio) {
    const pos = this.gp.array, siz = this.gs.array, st = this.gst.array;
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.age[i] >= 1) { st[i * 4 + 1] = 0; siz[i] = 0; continue; }
      alive++;
      this.age[i] += dt / this.life[i];
      const a = Math.min(1, this.age[i]);
      const k = this.kind[i];
      if (k === 1 && tgt) {                       // spiral toward target (absorb / evolve inhale)
        const dx = tgt[0] - this.p[i * 3], dy = tgt[1] - this.p[i * 3 + 1], dz = tgt[2] - this.p[i * 3 + 2];
        const d = Math.hypot(dx, dy, dz) + 1e-3, pull = 9 * (0.4 + a * 2);
        this.v[i * 3] += (dx / d * pull * d * 0.9 - dz / d * d * 1.8) * dt; this.v[i * 3 + 1] += dy / d * pull * d * 0.9 * dt; this.v[i * 3 + 2] += (dz / d * pull * d * 0.9 + dx / d * d * 1.8) * dt;
        this.v[i * 3] *= 1 - 1.6 * dt; this.v[i * 3 + 1] *= 1 - 1.6 * dt; this.v[i * 3 + 2] *= 1 - 1.6 * dt;
      }
      if (k !== 2) { this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt; }
      pos[i * 3] = this.p[i * 3]; pos[i * 3 + 1] = this.p[i * 3 + 1]; pos[i * 3 + 2] = this.p[i * 3 + 2];
      siz[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * a;
      const tcool = this.t0[i] > 0 ? this.t0[i] + (this.t1[i] - this.t0[i]) * Math.pow(a, 0.55) : 0;
      st[i * 4] = tcool;
      st[i * 4 + 1] = this.b0[i] * Math.pow(1 - a, this.t0[i] > 0 ? 1.3 : 0.8) * (tcool > 0 && tcool < 900 ? 0 : 1);
      st[i * 4 + 2] = this.shape[i]; st[i * 4 + 3] = a;
    }
    for (const at of [this.gp, this.gs, this.gst]) at.needsUpdate = true;
    this.uniforms.uPixelRatio.value = pixelRatio;
    this.points.visible = alive > 0;
    return alive;
  }
}

const rnd = Math.random;
function randDir(out) {
  const z = rnd() * 2 - 1, a = rnd() * 6.2832, s = Math.sqrt(1 - z * z);
  out[0] = s * Math.cos(a); out[1] = (z * 0.25); out[2] = s * Math.sin(a); // flattened toward the play plane
  return out;
}

export class Vfx {
  constructor(scene, shared) {
    this.glow = new Pool(scene, shared, 5000, true, 30);
    this.dust = new Pool(scene, shared, 3000, false, 29);
    this.shake = 0; this.flash = 0; this.ca = 0; this.deathT = 0; this.lensPulse = 0;
    this.pulse = new Map();
    this.roche = new Map();
    this.reduced = false;
    this.playerR = 10; this.playerP = [0, 0, 0];
    this.onEvolve = null;
    this._d = [0, 0, 0];
    this.listing = [];                 // for ?debug=emitters
    this.entryActive = 0;
  }

  attach(bus) {
    this.detach();
    const on = (t, f) => bus.on(t, f);
    this.offs = [
      on('run-start', () => this.reset()),
      on('status', (e) => { if (e.status === 'title') this.reset(); }),
      on('rebase', (e) => this.rebase(e.shift)),
      on('absorb', (e) => this.absorb(e)),
      on('hit', (e) => this.hit(e)),
      on('bounce', (e) => this.bounce(e)),
      on('impact', (e) => this.impact(e)),
      on('roche-disruption', (e) => this.rocheEvt(e)),
      on('atmosphere-entry', (e) => this.entry(e)),
      on('capture-warning', (e) => { this.lensPulse = Math.max(this.lensPulse, 0.25 + 0.3 * e.level); }),
      on('pulsar-beam', (e) => this.pulse.set(e.bodyId, Math.min(2, 0.6 + e.intensity))),
      on('evolve', (e) => this.evolve(e)),
      on('death', (e) => this.death(e)),
    ];
  }
  detach() { if (this.offs) { for (const o of this.offs) if (typeof o === 'function') o(); this.offs = null; } }

  reset() { this.glow.clear(); this.dust.clear(); this.shake = this.flash = this.ca = this.deathT = this.lensPulse = 0; this.pulse.clear(); this.roche.clear(); }
  rebase(s) { this.glow.shift(s[0], s[1], s[2]); this.dust.shift(s[0], s[1], s[2]); }

  _n(n) { return this.reduced ? Math.ceil(n * 0.4) : n; }
  _flash(p, size, life, t0 = 7500, t1 = 3500, b = 1.6) { this.glow.spawn(p[0], p[1], p[2], 0, 0, 0, life, size, size * 1.8, t0, t1, this.reduced ? b * 0.5 : b, 2, 0); }
  _ejecta(p, normal, n, speed, size, spread = 1) {
    const d = this._d;
    for (let i = 0; i < n; i++) {
      randDir(d);
      let vx = d[0] * spread, vy = d[1] * spread, vz = d[2] * spread;
      if (normal) { vx += normal[0] * 0.8; vy += normal[1] * 0.8; vz += normal[2] * 0.8; }
      const sp = speed * (0.25 + rnd() * 0.9);
      const life = 1.2 + rnd() * 2.6, s = size * (0.35 + rnd() * 0.9);
      // white-hot -> yellow -> orange -> red -> black as a blackbody cools; stays a glowing speck, never a flame
      this.glow.spawn(p[0], p[1], p[2], vx * sp, vy * sp, vz * sp, life, s, s * 0.5, 5200 + rnd() * 1800, 650, 1.1);
    }
  }
  _dust(p, n, speed, size, life = 1.6, spread = 1, vel) {
    const d = this._d;
    for (let i = 0; i < n; i++) {
      randDir(d); const sp = speed * (0.2 + rnd());
      this.dust.spawn(p[0] + d[0] * size * 2, p[1], p[2] + d[2] * size * 2, d[0] * sp * spread + (vel ? vel[0] : 0), d[1] * sp + (vel ? vel[1] : 0), d[2] * sp * spread + (vel ? vel[2] : 0), life * (0.6 + rnd() * 0.8), size * (0.5 + rnd()), size * 0.6, 0, 0, 0.55, 0);
    }
  }

  absorb(e) {
    const rb = 10 * Math.sqrt(Math.max(1, e.mass || 1));
    this._flash(e.p, Math.max(rb * 1.3, this.playerR * 0.5), 0.22, 7000, 4200, 1.1);
    const n = this._n(Math.min(46, 10 + (e.chain || 0) * 4 + Math.round(8 * Math.min(4, e.ratio || 0.2))));
    const d = this._d;
    for (let i = 0; i < n; i++) {
      randDir(d); const r = rb * (0.6 + rnd() * 0.9);
      this.dust.spawn(e.p[0] + d[0] * r, e.p[1] + d[1] * r, e.p[2] + d[2] * r, -d[2] * r * 3, 0, d[0] * r * 3, 0.7 + rnd() * 0.6, rb * 0.12 + 0.2, rb * 0.04, 0, 0, 0.7, 1);
    }
  }
  hit(e) {
    const s = Math.max(0.1, e.strength || 0.3);
    this._flash(e.p, this.playerR * (0.5 + 1.4 * s), 0.18 + 0.2 * s, 8000, 4000, 2.2);
    this._ejecta(e.p, e.normal, this._n(Math.round(14 + 50 * s)), Math.max(30, (e.relSpeed || 100) * 0.4), this.playerR * 0.07);
    this.shake = Math.max(this.shake, Math.min(1, 0.35 + s)); this.ca = Math.max(this.ca, s);
  }
  bounce(e) {
    this._dust(e.p, this._n(8), Math.max(12, (e.relSpeed || 40) * 0.2), this.playerR * 0.1, 1.4);
    this.shake = Math.max(this.shake, 0.12);
  }
  impact(e) {
    const en = Math.min(1, Math.max(0.02, e.energy || 0.1)), sc = this.playerR * (e.nearPlayer ? 1 : 0.7);
    this._flash(e.p, sc * (0.25 + 2.4 * en), 0.14 + 0.5 * en, 8000, 3800, 1.4 + en);
    this._ejecta(e.p, e.normal, this._n(Math.min(70, Math.max(4, Math.round(e.ejecta || 16)))), Math.max(20, (e.relSpeed || 60) * 0.35), sc * 0.05, 1);
    this._dust(e.p, this._n(10), (e.relSpeed || 40) * 0.12, sc * 0.08, 2.4);
    if (en > 0.5) this.glow.spawn(e.p[0], e.p[1], e.p[2], 0, 0, 0, 0.8, sc * 0.3, sc * 4.5, 6500, 2500, 0.7, 2, 1);
    if (e.nearPlayer) this.shake = Math.max(this.shake, 0.25 * en + 0.1);
  }
  rocheEvt(e) {
    if (e.phase === 'start') this.roche.set(e.bodyId, true);
    else { this.roche.delete(e.bodyId); this._dust(e.p, this._n(26), 30, this.playerR * 0.12, 3); }
  }
  entry(e) {
    this._flash(e.p, this.playerR * 1.2, 0.3, 5200, 3000, 1.0);
    this.glow.spawn(e.p[0], e.p[1], e.p[2], 0, 0, 0, 0.7, this.playerR * 0.4, this.playerR * 3, 4200, 1800, 0.8, 2, 1);
  }
  evolve(e) {
    const p = this.playerP, R = this.playerR;
    this.glow.spawn(p[0], p[1], p[2], 0, 0, 0, 1.1, R * 1.5, R * 14, 9500, 5500, 1.3, 2, 1);
    this.glow.spawn(p[0], p[1], p[2], 0, 0, 0, 0.5, R * 3, R * 7, 8000, 4500, 1.0, 2, 0);
    const d = this._d;
    for (let i = 0; i < this._n(44); i++) {           // inhale: motes pulled into the player
      randDir(d); const r = R * (4 + rnd() * 5);
      this.dust.spawn(p[0] + d[0] * r, p[1] + d[1] * r, p[2] + d[2] * r, 0, 0, 0, 0.9 + rnd() * 0.5, R * 0.14, R * 0.03, 0, 0, 0.8, 1);
    }
    this.flash = Math.max(this.flash, 0.28);
    if (this.onEvolve) this.onEvolve(e);
  }
  death(e) {
    const p = e.p || this.playerP, R = this.playerR;
    this._flash(p, R * 6, 0.6, 9000, 4000, 2.6);
    this._ejecta(p, null, this._n(90), Math.max(40, R * 5), R * 0.09, 1.2);
    this._dust(p, this._n(30), R * 2, R * 0.15, 3.5);
    this.shake = 1; this.ca = 1; this.deathT = 0.0001; this.flash = Math.max(this.flash, 0.5);
  }

  /** Per-frame: state-driven emitters (entry streak, Roche stream, thrust motes) then integrate pools. */
  update(dt, state, ctx) {
    const pl = state.player;
    this.playerR = pl ? pl.radius : this.playerR;
    if (pl) { this.playerP[0] = pl.p[0]; this.playerP[1] = pl.p[1]; this.playerP[2] = pl.p[2]; }
    this.reduced = !!ctx.opts.reducedMotion;
    this.listing.length = 0; this.entryActive = 0;

    // atmospheric entry: ONLY while body.entry != null (scripted exception R6)
    const scan = (b) => {
      if (b.entry) this._entryStreak(b, state, dt);
      if (b.state === 'disrupting' && b.disrupt && this.roche.has(b.id)) this._rocheStream(b, dt);
    };
    if (pl) scan(pl);
    for (let i = 0; i < state.bodies.length; i++) scan(state.bodies[i]);

    // thrust: grey regolith motes, non-additive, no glow, only for small rocky players
    if (pl && pl.thrust && !this.reduced && (pl.cls === 'meteorite' || pl.cls === 'asteroid' || pl.cls === 'dwarfPlanet')) {
      const mag = Math.hypot(pl.thrust[0], pl.thrust[1]);
      if (mag > 0.15 && Math.random() < Math.min(1, mag * 30 * dt)) {
        const nx = -pl.thrust[0] / mag, nz = -pl.thrust[1] / mag, R = pl.radius;
        this.dust.spawn(pl.p[0] + nx * R * 0.9, pl.p[1], pl.p[2] + nz * R * 0.9, pl.v[0] * 0.2 + nx * R * 1.2 + (rnd() - 0.5) * R * 0.4, 0, pl.v[2] * 0.2 + nz * R * 1.2 + (rnd() - 0.5) * R * 0.4, 0.9, R * 0.06, R * 0.03, 0, 0, 0.5, 0);
      }
    }

    // decay scalars
    this.shake = Math.max(0, this.shake - dt * 1.6); this.flash = Math.max(0, this.flash - dt * 1.4); this.ca = Math.max(0, this.ca - dt * 2.2);
    this.lensPulse = Math.max(0, this.lensPulse - dt * 0.5);
    for (const [k, v] of this.pulse) { const nv = v - dt * 3; if (nv <= 0) this.pulse.delete(k); else this.pulse.set(k, nv); }
    if (this.deathT > 0) this.deathT = Math.min(1, this.deathT + dt * 0.35);

    const alive = this.glow.update(dt, this.playerP, ctx.pixelRatio) + this.dust.update(dt, this.playerP, ctx.pixelRatio);
    this.alive = alive;
  }

  _entryStreak(b, state, dt) {
    this.entryActive++;
    const intensity = Math.min(1, Math.max(0, b.entry.intensity || 0.5));
    this.listing.push({ id: b.id, cause: 'atmospheric-entry', intensity });
    let host = null;
    for (let i = 0; i < state.bodies.length; i++) if (state.bodies[i].id === b.entry.hostId) { host = state.bodies[i]; break; }
    const hv = host ? host.v : [0, 0, 0];
    let rx = b.v[0] - hv[0], ry = b.v[1] - hv[1], rz = b.v[2] - hv[2];
    const sp = Math.hypot(rx, ry, rz) || 1; rx /= sp; ry /= sp; rz /= sp;     // tail points opposite the air-relative velocity
    const R = b.radius, n = Math.max(1, Math.round((this.reduced ? 1 : 3) + 7 * intensity * Math.min(1, dt * 60)));
    // bright head
    this.glow.spawn(b.p[0] + rx * R * 0.5, b.p[1], b.p[2] + rz * R * 0.5, 0, 0, 0, 0.12, R * (1.6 + 1.6 * intensity), R * 1.2, 5200, 3400, 0.9 * intensity + 0.2, 2, 0);
    for (let i = 0; i < n; i++) {
      const d = 0.6 + rnd() * 3.2 * (0.5 + intensity), j = 0.35 * R;
      const s = R * (0.25 + rnd() * 0.4);
      this.glow.spawn(b.p[0] - rx * R * d + (rnd() - 0.5) * j, b.p[1] - ry * R * d + (rnd() - 0.5) * j, b.p[2] - rz * R * d + (rnd() - 0.5) * j,
        -rx * Math.min(sp, R * 14) * 0.15 + b.v[0] * 0.0, 0, -rz * Math.min(sp, R * 14) * 0.15, 0.35 + rnd() * 0.5, s, s * 0.3, 3200 + 2600 * intensity, 900, 0.7 * (0.4 + intensity));
    }
  }
  _rocheStream(b, dt) {
    const ax = b.disrupt.axis || [1, 0, 0], R = b.radius, st = b.disrupt.stretch || 0;
    if (Math.random() > Math.min(1, 40 * dt)) return;
    for (let s = -1; s <= 1; s += 2) {
      const e = R * (1 + st);
      this.dust.spawn(b.p[0] + ax[0] * e * s, b.p[1] + ax[1] * e * s, b.p[2] + ax[2] * e * s, b.v[0] + ax[0] * R * 1.1 * s * (0.4 + rnd()), b.v[1], b.v[2] + ax[2] * R * 1.1 * s * (0.4 + rnd()), 1.6, R * 0.07, R * 0.03, 0, 0, 0.55, 0);
    }
  }
}
