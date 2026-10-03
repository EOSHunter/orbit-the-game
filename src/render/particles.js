// Particle pool + one-shot effects (absorb / hit / evolve / death) + trauma-based screen shake.
//
// - The pool is a fixed ring buffer of typed arrays, so nothing is allocated in the hot loop.
// - Effects are plain objects pushed into `state.effects` by spawnEffect(); they are advanced
//   and drawn inside the renderer's drawFrame. Particles live in world space, but their
//   sizes/speeds are authored in screen pixels and converted with the zoom at spawn time so an
//   effect looks the same at every stage.
// - getShake(state) is a pure function of state.effects + state.time.

import { TAU, clamp, easeOutCubic, mixHex } from './util.js';
import { REL } from './palette.js';
import { drawGlow } from './glow.js';

const K_GLOW = 0, K_SHARD = 1, K_STREAK = 2, K_DUST = 3;
export const KIND = { GLOW: K_GLOW, SHARD: K_SHARD, STREAK: K_STREAK, DUST: K_DUST };

// ---- particle pool ----------------------------------------------------------------------------

export function createParticles(max) {
  let N = max;
  const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
  const age = new Float32Array(N), life = new Float32Array(N), size = new Float32Array(N);
  const drag = new Float32Array(N), rot = new Float32Array(N), vrot = new Float32Array(N);
  const alpha = new Float32Array(N), grow = new Float32Array(N), swirl = new Float32Array(N), hs = new Float32Array(N);
  const kind = new Uint8Array(N), home = new Uint8Array(N), col = new Uint16Array(N);
  const colors = [], colorIdx = new Map();
  let head = 0;
  let limit = N;

  const colorId = (hex) => {
    let i = colorIdx.get(hex);
    if (i === undefined) { i = colors.length; colors.push(hex); colorIdx.set(hex, i); }
    return i;
  };

  return {
    /** Lower/raise the usable pool size (quality governor). */
    setLimit(n) { limit = Math.min(N, Math.max(32, n | 0)); },

    spawn(p) {
      const i = head;
      head = (head + 1) % limit;
      x[i] = p.x; y[i] = p.y; vx[i] = p.vx || 0; vy[i] = p.vy || 0;
      age[i] = 0; life[i] = p.life || 0.5; size[i] = p.size || 1;
      drag[i] = p.drag || 0; rot[i] = p.rot || 0; vrot[i] = p.vrot || 0;
      alpha[i] = p.alpha == null ? 1 : p.alpha; grow[i] = p.grow || 0;
      swirl[i] = p.swirl || 0; hs[i] = p.homeSpeed || 0;
      kind[i] = p.kind || 0; home[i] = p.home ? 1 : 0; col[i] = colorId(p.color || '#FFFFFF');
    },

    /** Advance everything. `tgt` = {x, y, r} world-space attractor (the player) for homing particles. */
    update(dt, tgt) {
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0) continue;
        age[i] += dt;
        if (age[i] >= life[i]) { life[i] = 0; continue; }
        if (home[i] && tgt) {
          const dx = tgt.x - x[i], dy = tgt.y - y[i];
          const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
          if (d < tgt.r * 0.55 && age[i] > 0.12) { life[i] = 0; continue; }
          const nx = dx / d, ny = dy / d;
          const sw = swirl[i] * Math.min(1, d / (tgt.r * 8 + 1e-6));
          const spd = hs[i];
          const k = Math.min(1, 7 * dt);
          vx[i] += ((nx - ny * sw) * spd - vx[i]) * k;
          vy[i] += ((ny + nx * sw) * spd - vy[i]) * k;
        } else if (drag[i]) {
          const f = Math.exp(-drag[i] * dt);
          vx[i] *= f; vy[i] *= f;
        }
        x[i] += vx[i] * dt; y[i] += vy[i] * dt;
        rot[i] += vrot[i] * dt;
      }
    },

    /** Draw. `m` = {cx, cy, camX, camY, zoom}. Additive kinds first, then solid shards. */
    draw(ctx, m) {
      const z = m.zoom;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < N; i++) {
        const l = life[i];
        if (l <= 0) continue;
        const k = kind[i];
        if (k === K_SHARD) continue;
        const t = age[i] / l;
        const a = alpha[i] * (1 - t) * (1 - t * 0.3);
        if (a < 0.01) continue;
        const sx = (x[i] - m.camX) * z + m.cx, sy = (y[i] - m.camY) * z + m.cy;
        const s = Math.max(k === K_DUST ? 6 : 1.6, size[i] * (1 + grow[i] * t) * z);
        if (k === K_GLOW) drawGlow(ctx, colors[col[i]], sx, sy, s * 1.6, a);
        else if (k === K_DUST) drawGlow(ctx, colors[col[i]], sx, sy, s, a * 0.5);
        else { // streak: teardrop / spaghettified streak along the velocity
          const len = Math.min(120, Math.hypot(vx[i], vy[i]) * z * 0.07 + s);
          const sp = Math.hypot(vx[i], vy[i]) || 1;
          ctx.globalAlpha = a;
          ctx.strokeStyle = colors[col[i]];
          ctx.lineWidth = Math.max(1, s * 0.55 * (1 - t * 0.5));
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - (vx[i] / sp) * len, sy - (vy[i] / sp) * len);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'round';
      for (let i = 0; i < N; i++) {
        if (life[i] <= 0 || kind[i] !== K_SHARD) continue;
        const t = age[i] / life[i];
        const a = alpha[i] * (1 - t * t);
        if (a < 0.02) continue;
        const sx = (x[i] - m.camX) * z + m.cx, sy = (y[i] - m.camY) * z + m.cy;
        const len = Math.max(2.5, size[i] * z) * (1 - t * 0.4);
        const dx = Math.cos(rot[i]) * len * 0.5, dy = Math.sin(rot[i]) * len * 0.5;
        ctx.globalAlpha = a;
        ctx.strokeStyle = colors[col[i]];
        ctx.lineWidth = Math.max(1.4, len * 0.42);
        ctx.beginPath(); ctx.moveTo(sx - dx, sy - dy); ctx.lineTo(sx + dx, sy + dy); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
  };
}

// ---- effects ----------------------------------------------------------------------------------

const DEFS = {
  absorb: { life: 1.0, trauma: () => 0.1, decay: 1.5 },
  hit:    { life: 0.8, trauma: (o) => 0.2 + 0.3 * clamp(o.strength == null ? 0.5 : o.strength, 0, 1), decay: 1.5 },
  evolve: { life: 1.7, trauma: () => 0.35, decay: 0.5 },
  death:  { life: 2.4, trauma: () => 0.8, decay: 0.55 },
};

const MAX_EFFECTS = 64;

/**
 * Queue a visual effect. type: 'absorb' | 'hit' | 'evolve' | 'death'.
 * (x, y) in world units. opts: { radius (world, size of the thing involved), color (hex),
 * strength (0..1, 'hit'), damage (bool, coral vignette), spiral (bool, 'absorb'), trauma }.
 */
export function spawnEffect(state, type, x, y, opts) {
  const def = DEFS[type];
  if (!def || !state) return null;
  opts = opts || {};
  if (!state.effects) state.effects = [];
  const fx = state.effects;
  const e = {
    type, x, y, age: 0, life: def.life,
    trauma: opts.trauma != null ? opts.trauma : def.trauma(opts), decay: def.decay,
    opts, started: false, emitted: 0,
  };
  if (fx.length >= MAX_EFFECTS) fx.shift();
  fx.push(e);
  return e;
}

// ---- shake ------------------------------------------------------------------------------------

let reducedMotion = false;
export function setReducedMotion(v) { reducedMotion = !!v; }

const MAX_SHAKE_PX = 12;
const MAX_ROT = (1.5 * Math.PI) / 180;

/**
 * Trauma-based shake from the active effects: shake = trauma^2 x max offset.
 * Returns CSS-pixel offsets {x, y} and a rotation in radians. Pure function of the state.
 */
export function getShake(state) {
  const out = { x: 0, y: 0, rot: 0, amount: 0 };
  const fx = state && state.effects;
  if (!fx || !fx.length || reducedMotion) return out;
  let total = 0, slow = 0;
  for (let i = 0; i < fx.length; i++) {
    const e = fx[i];
    const tr = e.trauma - e.decay * e.age;
    if (tr > 0) { total += tr; if (e.type === 'evolve') slow += tr; }
  }
  if (total <= 0) return out;
  const slowFrac = slow / total;
  total = Math.min(1, total);
  const s = total * total;
  const f = 1 - 0.75 * slowFrac; // evolve = slow, low frequency
  const t = (state.time || 0) * f;
  out.amount = s;
  out.x = s * MAX_SHAKE_PX * (Math.sin(t * 37.1) + 0.6 * Math.sin(t * 61.7 + 1.3)) / 1.6;
  out.y = s * MAX_SHAKE_PX * (Math.sin(t * 43.3 + 2.1) + 0.6 * Math.sin(t * 57.9 + 0.4)) / 1.6;
  out.rot = s * MAX_ROT * Math.sin(t * 29.0 + 0.7);
  return out;
}

// ---- effect update / draw ---------------------------------------------------------------------

const rnd = Math.random;

/** Dim overlay alpha (0..1) while an 'evolve' inhale is running: the world dims, then releases. */
export function evolveDim(state) {
  const fx = state.effects;
  let d = 0;
  if (!fx) return 0;
  for (let i = 0; i < fx.length; i++) {
    const e = fx[i];
    if (e.type !== 'evolve') continue;
    const a = e.age;
    const v = a < 0.4 ? a / 0.4 : a < 0.75 ? 1 - (a - 0.4) / 0.35 : 0;
    if (v > d) d = v;
  }
  return d;
}

/** Seconds left of the evolve inhale (renderer delays the player's morph until it ends). */
export function evolveInhaleLeft(state) {
  const fx = state.effects;
  let left = 0;
  if (!fx) return 0;
  for (let i = 0; i < fx.length; i++) {
    const e = fx[i];
    if (e.type === 'evolve' && e.age < 0.4) left = Math.max(left, 0.4 - e.age);
  }
  return left;
}

/** Strength 0..1 of the coral damage vignette. */
export function damageFlash(state) {
  const fx = state.effects;
  let v = 0;
  if (!fx) return 0;
  for (let i = 0; i < fx.length; i++) {
    const e = fx[i];
    if ((e.type === 'hit' && e.opts.damage) || e.type === 'death') v = Math.max(v, 1 - e.age / 0.15);
  }
  return clamp(v, 0, 1);
}

/**
 * Advance effects by dt, spawning their particles. env = {P (particle pool), zoom, player, quality}.
 * Finished effects are removed in place.
 */
export function updateEffects(state, dt, env) {
  const fx = state.effects;
  if (!fx || !fx.length) return;
  const z = env.zoom, P = env.P, pl = env.player;
  const px2w = 1 / z;
  let w = 0;
  for (let i = 0; i < fx.length; i++) {
    const e = fx[i];
    const o = e.opts;
    const R0 = o.radius > 0 ? o.radius : 14 * px2w;
    const rpx = Math.max(R0 * z, 6);
    if (!e.started) {
      e.started = true;
      if (e.type === 'hit') {
        const st = o.strength == null ? 0.5 : o.strength;
        const n = Math.round((12 + 18 * st) * env.partScale);
        const base = o.color || '#FFD9A0';
        for (let k = 0; k < n; k++) {
          const a = rnd() * TAU, sp = (90 + rnd() * 260) * px2w;
          P.spawn({ x: e.x + Math.cos(a) * R0 * 0.5, y: e.y + Math.sin(a) * R0 * 0.5, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 0.5 + rnd() * 0.45, size: (3 + rnd() * 5) * px2w, drag: 3.2, rot: rnd() * TAU, vrot: (rnd() - 0.5) * 18,
            kind: K_SHARD, color: rnd() < 0.7 ? base : '#FFFFFF' });
        }
        if (rpx > 40) for (let k = 0; k < 4; k++) {
          const a = rnd() * TAU;
          P.spawn({ x: e.x, y: e.y, vx: Math.cos(a) * 30 * px2w, vy: Math.sin(a) * 30 * px2w, life: 1.2, size: rpx * 0.6 * px2w, drag: 1.5, kind: K_DUST, color: mixHex(base, '#FF8A3D', 0.5), alpha: 0.5 });
        }
      } else if (e.type === 'death') {
        const base = o.color || REL.player;
        const n = Math.round(46 * env.partScale);
        for (let k = 0; k < n; k++) {
          const a = rnd() * TAU, sp = (30 + rnd() * 240) * px2w;
          P.spawn({ x: e.x + Math.cos(a) * R0 * 0.4, y: e.y + Math.sin(a) * R0 * 0.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
            life: 1.2 + rnd() * 1.2, size: (4 + rnd() * 9) * px2w, drag: 1.4, rot: rnd() * TAU, vrot: (rnd() - 0.5) * 8,
            kind: K_SHARD, color: rnd() < 0.6 ? base : (rnd() < 0.5 ? REL.playerGlow : REL.threat) });
        }
        for (let k = 0; k < 14; k++) {
          const a = rnd() * TAU, sp = (10 + rnd() * 70) * px2w;
          P.spawn({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1.4 + rnd(), size: (24 + rnd() * 40) * px2w,
            drag: 1.0, kind: K_DUST, color: rnd() < 0.5 ? REL.playerGlow : base, alpha: 0.45 });
        }
      }
    }

    // continuous emission
    if (e.type === 'absorb' && pl) {
      const total = Math.round(clamp(6 + rpx * 0.6, 6, 40) * env.partScale);
      const want = Math.floor(total * Math.min(1, e.age / 0.32 + 0.0001));
      const spiral = o.spiral || pl.stageIndex === 11;
      const base = o.color || (spiral ? REL.playerGlow : REL.prey);
      while (e.emitted < want) {
        e.emitted++;
        const a = rnd() * TAU, d = Math.sqrt(rnd()) * R0 * 0.9;
        const sx = e.x + Math.cos(a) * d, sy = e.y + Math.sin(a) * d;
        const dist = Math.hypot(pl.x - sx, pl.y - sy);
        P.spawn({ x: sx, y: sy, vx: Math.cos(a + 1.57) * dist * 0.8, vy: Math.sin(a + 1.57) * dist * 0.8, life: 0.95,
          size: Math.max(R0 * 0.16, 2.6 * px2w), home: true, homeSpeed: Math.max(dist * 2.4, pl.r * 5, 60 * px2w) * (0.8 + rnd() * 0.5),
          swirl: spiral ? 1.7 : 0.55 * (rnd() < 0.5 ? 1 : -1), kind: spiral ? K_STREAK : K_GLOW,
          color: spiral && rnd() < 0.4 ? REL.orchid : base, alpha: 0.9 });
      }
    } else if (e.type === 'evolve' && pl) {
      const total = Math.round(40 * env.partScale);
      const want = e.age < 0.4 ? Math.floor((total * e.age) / 0.4) : total;
      while (e.emitted < want) { // inhale: gold motes converge on the player
        e.emitted++;
        const a = rnd() * TAU, d = (90 + rnd() * 160) * px2w + pl.r * 2;
        P.spawn({ x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d, vx: 0, vy: 0, life: 0.55, size: 3 * px2w, home: true,
          homeSpeed: d * 2.8, swirl: 0.35, kind: K_GLOW, color: rnd() < 0.5 ? '#FFE9A0' : REL.player, alpha: 0.9 });
      }
      if (!e.burst && e.age >= 0.4) {
        e.burst = true;
        const n = Math.round(30 * env.partScale);
        for (let k = 0; k < n; k++) {
          const a = rnd() * TAU, sp = (140 + rnd() * 300) * px2w;
          P.spawn({ x: pl.x, y: pl.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.7 + rnd() * 0.5, size: 3.5 * px2w, drag: 2.6,
            kind: K_STREAK, color: rnd() < 0.5 ? '#FFFFFF' : REL.player, alpha: 0.95 });
        }
      }
    }

    e.age += dt;
    if (e.age < e.life) fx[w++] = e;
  }
  fx.length = w;
}

/**
 * Draw the screen-space parts of effects (flash discs and rings). Called with 'lighter' blending
 * active-capable; this function sets the modes it needs. m = {cx, cy, camX, camY, zoom}.
 */
export function drawEffects(ctx, state, m, player) {
  const fx = state.effects;
  if (!fx || !fx.length) return;
  const z = m.zoom;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < fx.length; i++) {
    const e = fx[i], o = e.opts;
    const t = e.age;
    let x = e.x, y = e.y;
    if (e.type === 'evolve' && player) { x = player.x; y = player.y; }
    const sx = (x - m.camX) * z + m.cx, sy = (y - m.camY) * z + m.cy;
    const R0 = o.radius > 0 ? o.radius : 14 / z;
    const rpx = Math.max(R0 * z, 6);
    ctx.lineCap = 'round';
    if (e.type === 'absorb') {
      const u = t / 0.45;
      if (u < 1) {
        const col = o.color || (o.spiral || (player && player.stageIndex === 11) ? REL.playerGlow : REL.prey);
        ctx.globalAlpha = 0.85 * (1 - u);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1 + 2 * (1 - u);
        ctx.beginPath(); ctx.arc(sx, sy, rpx * (1 + 0.9 * easeOutCubic(u)), 0, TAU); ctx.stroke();
      }
    } else if (e.type === 'hit' || e.type === 'death') {
      const flashLife = e.type === 'death' ? 0.12 : 0.05;
      if (t < flashLife) drawGlow(ctx, '#FFFFFF', sx, sy, rpx * (e.type === 'death' ? 3.4 : 2.2) + 10, 1 - t / flashLife);
      const rings = e.type === 'death' ? 2 : 1;
      for (let r = 0; r < rings; r++) {
        const u = (t - r * 0.18) / (e.type === 'death' ? 0.9 : 0.5);
        if (u <= 0 || u >= 1) continue;
        const col = r ? REL.threat : (o.color ? o.color : e.type === 'death' ? REL.player : '#FFD9A0');
        ctx.globalAlpha = 0.8 * (1 - u);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5 + 4 * (1 - u);
        ctx.beginPath(); ctx.arc(sx, sy, rpx * (0.8 + 2.6 * easeOutCubic(u)) + 12 * u, 0, TAU); ctx.stroke();
      }
    } else if (e.type === 'evolve') {
      const pr = player ? Math.max(player.radius * z, 10) : rpx;
      if (t < 0.4) { // inhale: a tightening ring
        const u = t / 0.4;
        ctx.globalAlpha = 0.5 * u;
        ctx.strokeStyle = REL.player;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(sx, sy, pr * (4 - 2.6 * easeOutCubic(u)), 0, TAU); ctx.stroke();
      } else {
        const u = (t - 0.4) / 0.9;
        if (t < 0.52) drawGlow(ctx, '#FFF3C4', sx, sy, pr * 6, 1 - (t - 0.4) / 0.12);
        if (u < 1) {
          ctx.globalAlpha = 0.95 * (1 - u);
          ctx.strokeStyle = '#FFF3C4';
          ctx.lineWidth = 2 + 8 * (1 - u);
          ctx.beginPath(); ctx.arc(sx, sy, pr * (1.2 + 7 * easeOutCubic(u)), 0, TAU); ctx.stroke();
          ctx.globalAlpha = 0.5 * (1 - u);
          ctx.strokeStyle = REL.player;
          ctx.lineWidth = 1.5 + 3 * (1 - u);
          ctx.beginPath(); ctx.arc(sx, sy, pr * (1.0 + 5 * easeOutCubic(Math.max(0, u - 0.08))), 0, TAU); ctx.stroke();
        }
      }
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
