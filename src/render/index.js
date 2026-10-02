// Vesper Drift renderer: fully procedural Canvas 2D, no image assets, no dependencies.
//
//   import { createRenderer, spawnEffect, getShake } from './render/index.js';
//   const r = createRenderer(canvas);          // optional 2nd arg: options (see setOptions)
//   r.resize();                                // call on window resize
//   r.drawFrame(state, camera, dt);            // state = {player, bodies, time, effects, bounds}
//
// Contract
//   Body   {id, x, y, vx, vy, radius, mass, kind:'player'|'prey'|'threat'|'neutral',
//           stageIndex 0..11, seed, alive}   (optional: `variant` int overrides the seed-picked look)
//   camera {x, y, zoom}  - zoom = CSS pixels per world unit; world origin is the arena centre.
//
// Notes for the engine
//   * Rim colour follows body.kind: prey = mint, threat = coral (+ pulsing ring), neutral = the
//     "equal" glacier rim. The creative direction wants +-5% hysteresis around the 1.2x mass
//     ratio; that is the engine's job (kind is authoritative). Kind changes cross-fade over 250 ms.
//   * drawFrame applies screen shake itself (from getShake(state)). If your engine already shakes
//     the camera with getShake(), construct with {applyShake: false}.
//   * Evolve: spawnEffect(state,'evolve',...) delays the player's morph by the 0.4 s inhale. The
//     stage change itself is detected from player.stageIndex, no extra call needed.
//   * Effects are advanced with dt, so a paused game (dt = 0) freezes them.

import { TAU, clamp, lerp, easeOutCubic, easeOutBack, hash01, mixHex, rgba } from './util.js';
import { CORE, REL, STAGES, WAKE_COLOR } from './palette.js';
import { drawGlow } from './glow.js';
import { createStarfield } from './starfield.js';
import { SPEC, createBodyPainter, variantOf } from './bodies.js';
import {
  KIND, createParticles, spawnEffect, getShake, setReducedMotion,
  updateEffects, drawEffects, evolveDim, evolveInhaleLeft, damageFlash,
} from './particles.js';

export { spawnEffect, getShake, STAGES, REL, CORE };

const QUALITY = [
  { dpr: 1, particles: 250, scale: 0.5 },
  { dpr: 1.5, particles: 500, scale: 0.75 },
  { dpr: 2, particles: 800, scale: 1 },
];
const TRAIL_N = 40;

const cmpRadiusDesc = (a, b) => b.r - a.r;

function relColor(kind, hc) {
  return kind === 'prey' ? REL.prey : kind === 'threat' ? (hc ? REL.threatHC : REL.threat) : REL.equal;
}

export function createRenderer(canvas, options) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const opt = Object.assign({
    quality: 2, autoQuality: true, applyShake: true, highContrast: false,
    reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  }, options || {});
  let quality = clamp(opt.quality | 0, 0, 2);
  setReducedMotion(opt.reducedMotion);

  const starfield = createStarfield();
  const painter = createBodyPainter();
  const P = createParticles(800);
  P.setLimit(QUALITY[quality].particles);

  let w = 1, h = 1, dpr = 1;
  let vignette = null, edgeGrad = null, grain = null;
  let clock = 0;
  let cam = { x: 0, y: 0, zoom: 1 };

  // per-body relationship state (cross-fade on kind change)
  const rels = new Map();
  let frameNo = 0;

  // stage tracking: background cross-fade + player morph
  let lastStage = -1;
  const fade = { from: 0, to: 0, t: 1, delay: 0 };
  let morph = null; // {from, to, delay, t}
  let shownStage = 0;

  // player trail history (world space)
  const tx = new Float64Array(TRAIL_N), ty = new Float64Array(TRAIL_N);
  let tCount = 0, tAcc = 0, thrustAcc = 0;

  // governor
  let lastNow = 0, avgMs = 12, slowMs = 0;

  const order = [];
  const pool = [];
  let poolN = 0;
  const stats = { drawn: 0, culled: 0, ms: 0, quality: 2, sprites: 0 };

  function newRec() {
    return { b: null, stage: 0, vi: 0, sx: 0, sy: 0, r: 0, ang: 0, seed: 0, spec: null, sp: null, alpha: 1, fa: 1,
      col: '#fff', wPrey: 0, wThreat: 0, wEq: 0, id: 0 };
  }
  function rec() {
    if (poolN === pool.length) pool.push(newRec());
    return pool[poolN++];
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const cw = rect.width || canvas.clientWidth || canvas.width || 300;
    const ch = rect.height || canvas.clientHeight || canvas.height || 150;
    const devDpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    dpr = clamp(Math.min(devDpr, QUALITY[quality].dpr), 1, 2);
    w = cw; h = ch;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    // If the canvas has no CSS size, its layout follows the backing store; pin it so it can't grow.
    const r2 = canvas.getBoundingClientRect();
    if (Math.abs(r2.width - cw) > 1 || Math.abs(r2.height - ch) > 1) {
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
    }
    starfield.resize(dpr);
    buildOverlays();
  }

  function buildOverlays() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const diag = Math.hypot(w, h) / 2;
    vignette = ctx.createRadialGradient(w / 2, h / 2, diag * 0.5, w / 2, h / 2, diag * 1.05);
    vignette.addColorStop(0, 'rgba(7,9,20,0)');
    vignette.addColorStop(1, 'rgba(7,9,20,0.6)');
    edgeGrad = ctx.createRadialGradient(w / 2, h / 2, diag * 0.45, w / 2, h / 2, diag * 1.05);
    edgeGrad.addColorStop(0, 'rgba(255,94,115,0)');
    edgeGrad.addColorStop(1, 'rgba(255,94,115,0.85)');
    if (!grain) {
      const g = document.createElement('canvas');
      g.width = g.height = 128;
      const gc = g.getContext('2d');
      const id = gc.createImageData(128, 128);
      for (let i = 0; i < id.data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
        id.data[i + 3] = 255;
      }
      gc.putImageData(id, 0, 0);
      grain = ctx.createPattern(g, 'repeat');
    }
  }

  function setQuality(q) {
    q = clamp(q | 0, 0, 2);
    if (q === quality) return;
    const dprChanged = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, QUALITY[q].dpr)
      !== Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, QUALITY[quality].dpr);
    quality = q;
    P.setLimit(QUALITY[q].particles);
    if (dprChanged) resize();
  }

  // ---- background / stage tracking --------------------------------------------------------

  function trackStage(state, dt) {
    const pl = state.player;
    const st = pl ? clamp(pl.stageIndex | 0, 0, 11) : 0;
    if (lastStage < 0) { lastStage = st; shownStage = st; fade.from = fade.to = st; fade.t = 1; }
    else if (st !== lastStage) {
      const delay = evolveInhaleLeft(state);
      fade.from = fade.t >= 1 ? fade.to : fade.t < 0.5 ? fade.from : fade.to;
      fade.to = st; fade.t = 0; fade.delay = delay;
      morph = { from: shownStage, to: st, delay, t: 0 };
      lastStage = st;
    }
    if (fade.delay > 0) fade.delay -= dt;
    else if (fade.t < 1) fade.t = Math.min(1, fade.t + dt / 1.5);
    if (morph) {
      if (morph.delay > 0) morph.delay -= dt;
      else {
        morph.t += dt / 0.8;
        if (morph.t >= 1) { shownStage = morph.to; morph = null; }
      }
    }
    if (!morph) shownStage = st;
  }

  function drawBackground() {
    const a = STAGES[fade.from].tint, b = STAGES[fade.to].tint;
    const t = easeOutCubic(fade.t);
    const inner = mixHex(a[1], b[1], t);
    const outer = mixHex(mixHex(a[0], b[0], t), CORE.voidDeep, 0.35);
    const diag = Math.hypot(w, h) / 2;
    const g = ctx.createRadialGradient(w / 2, h * 0.46, 0, w / 2, h / 2, diag * 1.1);
    g.addColorStop(0, inner);
    g.addColorStop(1, outer);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // ---- map boundary ------------------------------------------------------------------------

  function drawBoundary(state, cam, z, time) {
    const R = state.bounds && state.bounds.radius;
    if (!(R > 0)) return 0;
    const pl = state.player;
    const cxs = (0 - cam.x) * z + w / 2, cys = (0 - cam.y) * z + h / 2;
    const Rs = R * z;
    const dc = Math.hypot(w / 2 - cxs, h / 2 - cys);
    const diag = Math.hypot(w, h) / 2 + 80;

    let prox = 0;
    if (pl) {
      const gap = R - Math.hypot(pl.x, pl.y);
      const warn = Math.max(R * 0.12, pl.radius * 8);
      prox = clamp(1 - gap / warn, 0, 1);
    }
    const freq = 0.8 + 2.4 * prox;
    const pulse = opt.reducedMotion ? 0.6 : 0.5 + 0.5 * Math.sin(time * freq * TAU);
    const col = mixHex('#8C6BFF', opt.highContrast ? REL.threatHC : REL.threat, prox);
    const k = 0.22 + 0.7 * prox * (0.55 + 0.45 * pulse);

    // darkened, violet-tinted void outside the arena
    const fullyOut = dc > Rs + diag, fullyIn = dc < Rs - diag;
    if (fullyOut) {
      ctx.fillStyle = 'rgba(42,31,77,0.35)';
      ctx.fillRect(-60, -60, w + 120, h + 120);
    } else if (!fullyIn && Rs < 4e4) {
      ctx.beginPath();
      ctx.rect(-60, -60, w + 120, h + 120);
      ctx.arc(cxs, cys, Rs, 0, TAU);
      ctx.fillStyle = 'rgba(42,31,77,0.35)';
      ctx.fill('evenodd');
    }
    if (fullyOut || fullyIn) return prox;

    let a0 = 0, a1 = TAU;
    if (dc > 1e-3) {
      const cosv = (Rs * Rs + dc * dc - diag * diag) / (2 * Rs * dc);
      if (cosv > 1) return prox;
      if (cosv > -1) {
        const base = Math.atan2(h / 2 - cys, w / 2 - cxs), half = Math.acos(cosv) + 0.05;
        a0 = base - half; a1 = base + half;
      }
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'butt';
    const widths = [44, 20, 8], alphas = [0.05, 0.1, 0.22];
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = alphas[i] * (0.5 + k);
      ctx.strokeStyle = col;
      ctx.lineWidth = widths[i];
      ctx.beginPath(); ctx.arc(cxs, cys, Rs, a0, a1); ctx.stroke();
    }
    ctx.globalAlpha = clamp(0.35 + k, 0, 1);
    ctx.lineWidth = 2 + 2.5 * prox;
    ctx.setLineDash([26, 14]);
    ctx.lineDashOffset = -time * 14;
    ctx.beginPath(); ctx.arc(cxs, cys, Rs, a0, a1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return prox;
  }

  // ---- relationship / rim -----------------------------------------------------------------

  function relOf(b, dt) {
    let e = rels.get(b.id);
    if (!e) { e = { kind: b.kind, prev: b.kind, t: 1, seen: frameNo }; rels.set(b.id, e); }
    if (e.kind !== b.kind) { e.prev = e.kind; e.kind = b.kind; e.t = 0; }
    else if (e.t < 1) e.t = Math.min(1, e.t + dt / 0.25);
    e.seen = frameNo;
    return e;
  }

  function fillRel(rc, e) {
    const cur = e.kind, prv = e.prev, t = e.t;
    const hc = opt.highContrast;
    rc.col = t >= 1 ? relColor(cur, hc) : mixHex(relColor(prv, hc), relColor(cur, hc), t);
    const wp = (cur === 'prey' ? t : 0) + (prv === 'prey' ? 1 - t : 0);
    const wt = (cur === 'threat' ? t : 0) + (prv === 'threat' ? 1 - t : 0);
    rc.wPrey = wp; rc.wThreat = wt; rc.wEq = 1 - wp - wt;
  }

  function drawRim(rc, time, hc) {
    const r = rc.r;
    if (r < 2.5) return;
    const lw = (r < 6 ? 1 : 1.5 + 1.6 * rc.wThreat) * (hc ? 1.4 : 1);
    const rr = r * 1.07 + lw / 2;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = rc.alpha * (0.62 + 0.35 * rc.wThreat + 0.2 * rc.wPrey);
    ctx.strokeStyle = rc.col;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(rc.sx, rc.sy, rr, 0, TAU); ctx.stroke();
    if (r < 6 || opt.reducedMotion) return;
    ctx.globalCompositeOperation = 'lighter';
    if (rc.wThreat > 0.02) { // slow outward pulsing ring
      const ph = (time * 0.55 + rc.id * 0.37) % 1;
      ctx.globalAlpha = rc.alpha * 0.6 * (1 - ph) * rc.wThreat;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(rc.sx, rc.sy, r * (1.15 + 0.55 * ph), 0, TAU); ctx.stroke();
    }
    if (rc.wPrey > 0.02) { // gentle inward pulse
      const ph = (time * 0.7 + rc.id * 0.29) % 1;
      ctx.globalAlpha = rc.alpha * 0.4 * Math.sin(ph * Math.PI) * rc.wPrey;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(rc.sx, rc.sy, r * (1.4 - 0.3 * ph), 0, TAU); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---- body / player drawing -----------------------------------------------------------------

  function spriteFor(stage, vi, r) {
    return painter.spriteFor(stage, vi, r * dpr);
  }

  function surfaceOrFallback(sp, spec, rc, time, dyn) {
    if (!sp) {
      ctx.globalAlpha = rc.alpha;
      ctx.fillStyle = spec.fb;
      ctx.beginPath(); ctx.arc(rc.sx, rc.sy, rc.r, 0, TAU); ctx.fill();
      return;
    }
    painter.drawSurface(ctx, sp, rc.sx, rc.sy, rc.r, rc.ang, time, rc.alpha, dyn);
  }

  /** Full draw of one player-like body (all passes) used for the player and its morph. */
  function drawOne(rc, time, quality) {
    const spec = rc.spec;
    const tiny = rc.r < 8;
    ctx.globalCompositeOperation = 'lighter';
    if (rc.sp) painter.drawAdditive(ctx, rc.sp, rc.sx, rc.sy, rc.r, time, rc.alpha * rc.fa, rc.seed, quality, tiny);
    ctx.globalCompositeOperation = 'source-over';
    surfaceOrFallback(rc.sp, spec, rc, time, rc.stage === 4 || rc.stage === 5 ? rc.r >= 40 && quality >= 1 : false);
    if (rc.sp && quality >= 1 && !tiny) {
      ctx.globalCompositeOperation = 'lighter';
      painter.drawDynamic(ctx, rc.sp, rc.stage, rc.sx, rc.sy, rc.r, time, rc.alpha, rc.seed);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  function setupRec(rc, b, time, z) {
    const stage = clamp(b.stageIndex | 0, 0, 11);
    rc.b = b; rc.stage = stage; rc.spec = SPEC[stage]; rc.id = b.id | 0;
    rc.vi = variantOf(b); rc.seed = (hash01(b.seed, 3) - 0.5) * 6.28;
    rc.sx = (b.x - cam.x) * z + w / 2;
    rc.sy = (b.y - cam.y) * z + h / 2;
    const [rs, fa] = painter.animate(stage, time, rc.seed);
    rc.r = b.radius * z * rs; rc.fa = fa; rc.alpha = 1;
    const spin = (hash01(b.seed, 2) * 2 - 1) * rc.spec.spin;
    rc.ang = hash01(b.seed, 1) * TAU + time * spin;
    if (stage === 10 || stage === 11) rc.ang = 0;
    rc.sp = null;
  }

  // ---- the frame ----------------------------------------------------------------------------

  function drawFrame(state, camera, dt) {
    const t0 = performance.now();
    cam = camera;
    dt = clamp(dt || 0, 0, 0.1);
    clock += dt;
    const time = state.time != null ? state.time : clock;
    const z = camera.zoom > 1e-12 ? camera.zoom : 1;
    const pl = state.player || null;
    const q = quality;
    const reduced = opt.reducedMotion;
    frameNo++;

    // governor: adapt quality from real frame times
    if (lastNow) {
      const real = t0 - lastNow;
      if (real < 150) {
        avgMs = avgMs * 0.94 + real * 0.06;
        if (opt.autoQuality && avgMs > 20 && q > 0) { slowMs += real; if (slowMs > 2000) { setQuality(q - 1); slowMs = 0; avgMs = 16; } }
        else slowMs = Math.max(0, slowMs - real);
      }
    }
    lastNow = t0;

    trackStage(state, dt);
    painter.beginFrame();

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground();

    // screen shake -> base transform
    let sh = { x: 0, y: 0, rot: 0 };
    if (opt.applyShake) sh = getShake(state);
    const cs = Math.cos(sh.rot), sn = Math.sin(sh.rot), cx = w / 2, cy = h / 2;
    const B = [cs * dpr, sn * dpr, -sn * dpr, cs * dpr,
      dpr * (cx + sh.x - cs * cx + sn * cy), dpr * (cy + sh.y - sn * cx - cs * cy)];
    ctx.setTransform(B[0], B[1], B[2], B[3], B[4], B[5]);
    painter.setBase(B[0], B[1], B[2], B[3], B[4], B[5]);

    starfield.update(camera, dt, reduced);
    starfield.draw(ctx, w, h, time, fade, q, reduced);

    const prox = drawBoundary(state, camera, z, time);

    // ---- bodies: cull, classify, sort (big first so small things sit on top) ----
    poolN = 0;
    order.length = 0;
    const bodies = state.bodies || [];
    const hc = opt.highContrast;
    let culled = 0;
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (!b || !b.alive || b === pl) continue;
      const stage = clamp(b.stageIndex | 0, 0, 11);
      const spec = SPEC[stage];
      const sx = (b.x - camera.x) * z + cx, sy = (b.y - camera.y) * z + cy;
      const r = b.radius * z;
      const cull = Math.max(r * spec.cull, 4);
      if (sx < -cull || sx > w + cull || sy < -cull || sy > h + cull) { culled++; continue; }
      const e = relOf(b, dt);
      if (r < 2.2) { // too small for a sprite: a single dot, tinted by relationship
        const col = e.kind === 'prey' ? REL.prey : e.kind === 'threat' ? (hc ? REL.threatHC : REL.threat) : REL.neutral;
        ctx.globalAlpha = e.kind === 'neutral' ? 0.55 : 0.9;
        ctx.fillStyle = col;
        const s = Math.max(1.2, r * 2);
        ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
        continue;
      }
      const rc = rec();
      setupRec(rc, b, time, z);
      fillRel(rc, e);
      order.push(rc);
    }
    ctx.globalAlpha = 1;
    order.sort(cmpRadiusDesc);
    const n = order.length;

    // sprites (may fall back to a cached neighbour size while the exact one is queued)
    for (let i = 0; i < n; i++) { const rc = order[i]; rc.sp = spriteFor(rc.stage, rc.vi, rc.r); }

    // pass A: additive halos, rays, beams, relationship glow
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const rc = order[i];
      if (rc.sp) painter.drawAdditive(ctx, rc.sp, rc.sx, rc.sy, rc.r, time, rc.fa, rc.seed, q, rc.r < 8);
      if (rc.r >= 4) {
        if (rc.wThreat > 0.02) drawGlow(ctx, rc.col, rc.sx, rc.sy, rc.r * 2.0, 0.3 * rc.wThreat);
        if (rc.wPrey > 0.02) drawGlow(ctx, rc.col, rc.sx, rc.sy, rc.r * 1.7, 0.14 * rc.wPrey);
      }
    }
    // pass B: surfaces in size order
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < n; i++) {
      const rc = order[i];
      surfaceOrFallback(rc.sp, rc.spec, rc, time, (rc.stage === 4 || rc.stage === 5) && q >= 1 && rc.r >= 40);
    }
    // pass C: dynamic additive detail + the star-lit rim of the player + rims
    const plStage = pl ? clamp(pl.stageIndex | 0, 0, 11) : 0;
    const lit = pl && pl.alive !== false && plStage >= 6;
    ctx.globalCompositeOperation = 'lighter';
    if (q >= 1) for (let i = 0; i < n; i++) {
      const rc = order[i];
      if (rc.sp && rc.r >= 10) painter.drawDynamic(ctx, rc.sp, rc.stage, rc.sx, rc.sy, rc.r, time, 1, rc.seed);
    }
    if (lit) { // a star-stage player lights nearby bodies on the side that faces it
      const range = pl.radius * 7;
      ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const rc = order[i];
        if (rc.r < 6) continue;
        const dx = pl.x - rc.b.x, dy = pl.y - rc.b.y, d = Math.hypot(dx, dy);
        if (d > range + rc.b.radius || d < 1e-6) continue;
        const k = 1 - d / (range + rc.b.radius);
        const a = Math.atan2(dy, dx);
        ctx.globalAlpha = 0.6 * k;
        ctx.strokeStyle = '#FFD9A0';
        ctx.lineWidth = Math.max(1.5, rc.r * 0.07);
        ctx.beginPath(); ctx.arc(rc.sx, rc.sy, rc.r * 1.0, a - 0.9, a + 0.9); ctx.stroke();
      }
    }
    for (let i = 0; i < n; i++) drawRim(order[i], time, hc);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // ---- world dim during the evolve inhale ----
    const dim = evolveDim(state);
    if (dim > 0.005 && !reduced) {
      ctx.fillStyle = rgba(CORE.voidDeep, 0.5 * dim);
      ctx.fillRect(-60, -60, w + 120, h + 120);
    }

    // ---- particles + effects ----
    const env = { P, zoom: z, quality: q, partScale: QUALITY[q].scale,
      player: pl ? { x: pl.x, y: pl.y, r: pl.radius, radius: pl.radius, stageIndex: pl.stageIndex } : null };
    updateEffects(state, dt, env);
    if (pl && pl.alive !== false) emitThrust(pl, dt, z, plStage, q);
    P.update(dt, env.player);

    const m = { cx, cy, camX: camera.x, camY: camera.y, zoom: z };

    if (pl && pl.alive !== false) drawTrail(pl, camera, z, dt, plStage, time);
    P.draw(ctx, m);
    if (pl && pl.alive !== false) drawPlayer(pl, z, dt, time, plStage, q);
    drawEffects(ctx, state, m, pl);

    starfield.drawForeground(ctx, w, h, q, reduced);

    // ---- screen-space overlays (not shaken) ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    if (q >= 1) {
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
    }
    if (prox > 0.01 && pl) {
      const pr = Math.hypot(pl.x, pl.y) || 1;
      const dx = pl.x / pr, dy = pl.y / pr, ext = Math.hypot(w, h) / 2;
      const g = ctx.createLinearGradient(cx + dx * ext, cy + dy * ext, cx - dx * ext * 0.15, cy - dy * ext * 0.15);
      const pulse = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(time * (0.8 + 2.4 * prox) * TAU);
      const col = hc ? REL.threatHC : REL.threat;
      g.addColorStop(0, rgba(col, 0.55 * prox * (0.6 + 0.4 * pulse)));
      g.addColorStop(0.55, rgba('#8C6BFF', 0.12 * prox));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    const dmg = reduced ? 0 : damageFlash(state);
    if (dmg > 0.01) {
      ctx.globalAlpha = 0.6 * dmg;
      ctx.fillStyle = edgeGrad;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (q >= 2 && !reduced && grain) {
      ctx.globalAlpha = 0.035;
      ctx.translate((Math.random() * 128) | 0, (Math.random() * 128) | 0);
      ctx.fillStyle = grain;
      ctx.fillRect(-128, -128, w + 128, h + 128);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
    }

    // housekeeping
    painter.endFrame(2.5);
    if ((frameNo & 255) === 0) for (const [id, e] of rels) if (frameNo - e.seen > 300) rels.delete(id);
    stats.drawn = n; stats.culled = culled; stats.quality = q; stats.ms = performance.now() - t0;
  }

  // thruster flame: teardrop streaks behind the player for the rocky stages
  function emitThrust(pl, dt, z, stage, q) {
    if (!STAGES[stage].thruster || opt.reducedMotion) return;
    const spd = Math.hypot(pl.vx || 0, pl.vy || 0);
    const sn = clamp(spd / (pl.radius * 10 + 1e-6), 0, 1);
    if (sn < 0.04) return;
    thrustAcc += (50 + 330 * sn) * QUALITY[q].scale * dt;
    const dx = pl.vx / spd, dy = pl.vy / spd;
    const cols = ['#FFD9A0', REL.player, REL.playerGlow];
    while (thrustAcc >= 1) {
      thrustAcc -= 1;
      const j = (Math.random() - 0.5) * 0.5;
      const back = pl.radius * 0.9;
      const sp = spd * 0.35 + pl.radius * 3 * (0.6 + Math.random() * 0.8);
      P.spawn({ x: pl.x - dx * back + (-dy) * j * pl.radius, y: pl.y - dy * back + dx * j * pl.radius,
        vx: -dx * sp + (-dy) * j * sp * 0.4, vy: -dy * sp + dx * j * sp * 0.4,
        life: 0.3 + Math.random() * 0.3, size: Math.max(pl.radius * 0.2, 2 / z), grow: -0.5, kind: KIND.STREAK,
        color: cols[(Math.random() * 3) | 0], alpha: 0.85 });
    }
  }

  function drawTrail(pl, camera, z, dt, stage, time) {
    // sample history
    tAcc += dt;
    const last = tCount ? Math.hypot(pl.x - tx[0], pl.y - ty[0]) : 0;
    if (last > pl.radius * 60) tCount = 0; // teleport / restart
    if (!tCount || tAcc >= 1 / 45) {
      tAcc = 0;
      const lim = Math.min(TRAIL_N, tCount + 1);
      for (let i = lim - 1; i > 0; i--) { tx[i] = tx[i - 1]; ty[i] = ty[i - 1]; }
      tx[0] = pl.x; ty[0] = pl.y;
      tCount = lim;
    }
    const wake = !STAGES[stage].thruster;
    const n = wake ? tCount : Math.min(tCount, 26);
    if (n < 2) return;
    const r = pl.radius * z;
    const col1 = wake ? WAKE_COLOR[stage] : REL.player, col2 = wake ? mixHex(WAKE_COLOR[stage], '#5E6C9E', 0.6) : REL.playerGlow;
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    let px = (pl.x - camera.x) * z + w / 2, py = (pl.y - camera.y) * z + h / 2;
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const x = (tx[i] - camera.x) * z + w / 2, y = (ty[i] - camera.y) * z + h / 2;
      if (Math.abs(x - px) + Math.abs(y - py) > 0.6) {
        const a = Math.pow(1 - u, 1.6) * (wake ? 0.3 : 0.5);
        ctx.strokeStyle = rgba(u < 0.45 ? col1 : col2, a);
        ctx.lineWidth = Math.max(1, r * (wake ? 1.5 : 0.95) * (1 - u) * 0.85);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      }
      px = x; py = y;
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  const playerRec = newRec();
  function drawPlayer(pl, z, dt, time, stage, q) {
    const rc = playerRec;
    const sxp = (pl.x - cam.x) * z + w / 2, syp = (pl.y - cam.y) * z + h / 2;
    const pr = pl.radius * z;
    // halo: the warmest, brightest thing on screen
    const breathe = 1 + 0.06 * Math.sin((time / 3) * TAU);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, REL.playerGlow, sxp, syp, pr * 3.1 * breathe, 0.7);
    drawGlow(ctx, REL.player, sxp, syp, pr * 1.7 * breathe, 0.45);
    ctx.globalCompositeOperation = 'source-over';

    const pStageSeed = pl.seed;
    const draw = (st, alpha, scale) => {
      rc.b = pl; rc.stage = st; rc.spec = SPEC[st]; rc.vi = variantOf(pl);
      rc.seed = (hash01(pStageSeed, 3) - 0.5) * 6.28;
      const [rs, fa] = painter.animate(st, time, rc.seed);
      rc.sx = sxp; rc.sy = syp; rc.r = pr * rs * scale; rc.fa = fa; rc.alpha = alpha;
      const spin = (hash01(pl.seed, 2) * 2 - 1) * rc.spec.spin;
      rc.ang = st >= 10 ? 0 : hash01(pl.seed, 1) * TAU + time * spin;
      rc.sp = spriteFor(st, rc.vi, rc.r);
      drawOne(rc, time, q);
    };
    if (morph && morph.delay <= 0) {
      const e = easeOutCubic(morph.t);
      draw(morph.from, 1 - e, 1 + 0.12 * e);
      draw(morph.to, e, lerp(0.7, 1, easeOutBack(morph.t)));
    } else {
      draw(morph ? morph.from : shownStage, 1, 1);
    }

    // heat on the leading edge (rocky stages) + the player's ember rim
    const spd = Math.hypot(pl.vx || 0, pl.vy || 0);
    ctx.globalCompositeOperation = 'lighter';
    if (STAGES[stage].thruster && spd > 1e-6) {
      const sn = clamp(spd / (pl.radius * 10 + 1e-6), 0, 1);
      const a = Math.atan2(pl.vy, pl.vx);
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.55 * sn;
      ctx.strokeStyle = '#FFB067';
      ctx.lineWidth = Math.max(2, pr * 0.14);
      ctx.beginPath(); ctx.arc(sxp, syp, pr * 1.04, a - 0.95, a + 0.95); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = REL.player;
    ctx.lineWidth = Math.max(1.5, Math.min(2.2, pr * 0.06));
    ctx.beginPath(); ctx.arc(sxp, syp, pr * (stage === 11 ? 1.075 : 1.09), 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  return {
    drawFrame,
    resize,
    setOptions(o) {
      if (!o) return;
      if ('highContrast' in o) opt.highContrast = !!o.highContrast;
      if ('reducedMotion' in o) { opt.reducedMotion = !!o.reducedMotion; setReducedMotion(opt.reducedMotion); }
      if ('applyShake' in o) opt.applyShake = !!o.applyShake;
      if ('autoQuality' in o) opt.autoQuality = !!o.autoQuality;
      if ('quality' in o) { opt.autoQuality = false; setQuality(o.quality); }
    },
    getStats() { return stats; },
  };
}
