// Multi-layer parallax starfield. Every layer is a pre-rendered offscreen tile that is wrapped
// by modulo tiling, so cost is a handful of drawImage calls regardless of the world size.
//
// Zoom handling: scroll offsets are *integrated* from camera deltas (never derived from the
// absolute camera position), so a huge zoom change (the world shrinking 1000x across the 12
// stages) never makes the sky jump. Zoom only scales each layer about the screen centre by
// zoom^(small power), so deep layers barely react and the zoom reads as pulling away.

import { TAU, clamp, lerp, mulberry32, mixHex, lighten, makeCanvas } from './util.js';
import { STAGES, CORE } from './palette.js';
import { getGlow } from './glow.js';

// ---- tunables: deep-space look ----
const NEBULA_COLORS = ['#5b2a9a', '#1f8c9a', '#2a4fb0', '#b04a8a']; // deep purple, teal, blue, warm magenta
const NEBULA_CLOUDS = 26;          // clouds per tile (spread over the whole tile so something is always in view)
const NEBULA_ALPHA = [0.07, 0.16]; // per-cloud additive alpha range (keep low)
const NEBULA_SIZE = [160, 330];    // cloud radius range, px of the (T-sized) tile
const GALAXY_COUNT = 5;            // distant galaxies per galaxy tile
const GALAXY_SIZE = [14, 34];      // galaxy radius range, px
const GALAXY_BRIGHTNESS = [0.35, 0.8];
const MARGIN = 40; // extra coverage so screen shake never reveals tile edges

// par: scroll speed relative to world motion on screen. zp: zoom exponent.
const LAYERS = {
  galaxy: { T: 1536, par: 0.03, zp: 0.03 },
  nebula: { T: 1024, par: 0.05, zp: 0.04 },
  speck:  { T: 768, par: 0.06, zp: 0.05 },
  dust:   { T: 448, par: 0.10, zp: 0.08 },
  far:    { T: 512, par: 0.20, zp: 0.12 },
  mid:    { T: 576, par: 0.40, zp: 0.18 },
  fore:   { T: 900, par: 1.30, zp: 0.28 },
};

const TWINKLE = [
  { period: 2.4, phase: 0.0 },
  { period: 3.3, phase: 2.1 },
  { period: 4.0, phase: 4.2 },
];

function newLayerState(def) {
  return { T: def.T, par: def.par, zp: def.zp, ox: 0, oy: 0, scale: 1 };
}

function wrapped(T, x, y, rr, fn) {
  fn(x, y);
  const nx = x < rr ? 1 : x > T - rr ? -1 : 0;
  const ny = y < rr ? 1 : y > T - rr ? -1 : 0;
  if (nx) fn(x + nx * T, y);
  if (ny) fn(x, y + ny * T);
  if (nx && ny) fn(x + nx * T, y + ny * T);
}

const STAR_COLORS = ['#EAF0FF', '#EAF0FF', '#CFE0FF', '#BFD2FF', '#FFE6C7', '#FFD2A8', '#D9C8FF'];

export function createStarfield() {
  const L = {
    nebula: newLayerState(LAYERS.nebula),
    galaxy: newLayerState(LAYERS.galaxy),
    speck: newLayerState(LAYERS.speck),
    dust: newLayerState(LAYERS.dust),
    far: newLayerState(LAYERS.far),
    mid: newLayerState(LAYERS.mid),
    fore: newLayerState(LAYERS.fore),
  };
  let tiles = null; // baked canvases
  let res = 1;      // tile pixels per CSS pixel
  const nebCache = new Map();
  let prev = null;
  let zRef = 0;

  function bakeStarTile(T, count, sizeRange, groups, seed, glowEvery) {
    const mk = () => {
      const c = makeCanvas(Math.ceil(T * res), Math.ceil(T * res));
      const g = c.getContext('2d');
      g.scale(res, res);
      return [c, g];
    };
    const [staticC, sg] = mk();
    const twin = [];
    for (let k = 0; k < groups; k++) twin.push(mk());
    const rng = mulberry32(seed);
    const drawStar = (g, x, y, size, color, alpha, glow) => {
      wrapped(T, x, y, size * 3, (px, py) => {
        if (glow) {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = alpha * 0.55;
          g.drawImage(getGlow(color), px - size * 4, py - size * 4, size * 8, size * 8);
          g.globalCompositeOperation = 'source-over';
        }
        g.globalAlpha = alpha;
        g.fillStyle = color;
        g.beginPath();
        g.arc(px, py, size, 0, TAU);
        g.fill();
      });
    };
    for (let i = 0; i < count; i++) {
      const x = rng() * T, y = rng() * T;
      const size = lerp(sizeRange[0], sizeRange[1], Math.pow(rng(), 2));
      const color = STAR_COLORS[(rng() * STAR_COLORS.length) | 0];
      const alpha = 0.35 + rng() * 0.6;
      const glow = glowEvery && i % glowEvery === 0 && size > sizeRange[0] * 1.4;
      // a fraction of the stars twinkle; they live in separate tiles with their own phase
      if (groups && rng() < 0.4) drawStar(twin[(rng() * groups) | 0][1], x, y, size, color, 0.95, glow);
      else drawStar(sg, x, y, size, color, alpha, glow);
    }
    return { c: staticC, twinkle: twin.map((t) => t[0]) };
  }

  // thousands of dim flat 1px dots, denser along a diagonal band (galactic-plane look); no glow
  function bakeSpecks(T, seed) {
    const c = makeCanvas(Math.ceil(T * res), Math.ceil(T * res));
    const g = c.getContext('2d');
    g.scale(res, res);
    const rng = mulberry32(seed);
    const cols = ['#EAF0FF', '#CFE0FF', '#FFE6C7', '#DDE6FF'];
    const n = 3200, px = 1 / res > 1 ? 1 / res : 1;
    for (let i = 0; i < n; i++) {
      const x = rng() * T, y = rng() * T;
      const d = ((x - y) / T) * 2 - Math.round(((x - y) / T) * 2); // wraps seamlessly across the tile
      if (rng() > 0.3 + 0.7 * Math.exp(-d * d * 18)) continue;
      g.globalAlpha = 0.12 + 0.35 * rng() * rng();
      g.fillStyle = cols[(rng() * cols.length) | 0];
      g.fillRect(Math.floor(x), Math.floor(y), px, px);
    }
    return c;
  }

  function bakeDust(T, seed) {
    const c = makeCanvas(Math.ceil(T * res), Math.ceil(T * res));
    const g = c.getContext('2d');
    g.scale(res, res);
    const rng = mulberry32(seed);
    const cols = [CORE.mist, '#5E6C9E', CORE.moonWhite, '#7FD6FF'];
    for (let i = 0; i < 170; i++) {
      const x = rng() * T, y = rng() * T, s = 0.45 + rng() * 0.7;
      g.globalAlpha = 0.18 + rng() * 0.4;
      g.fillStyle = cols[(rng() * cols.length) | 0];
      wrapped(T, x, y, s, (px, py) => g.fillRect(px - s / 2, py - s / 2, s, s));
    }
    return c;
  }

  function bakeFore(T, seed) {
    const c = makeCanvas(Math.ceil(T * 0.5), Math.ceil(T * 0.5));
    const g = c.getContext('2d');
    g.scale(0.5, 0.5);
    g.globalCompositeOperation = 'lighter';
    const rng = mulberry32(seed);
    const cols = [CORE.mist, '#C48BFF', '#7FD6FF'];
    for (let i = 0; i < 9; i++) {
      const x = rng() * T, y = rng() * T, r = 10 + rng() * 26;
      const col = cols[(rng() * cols.length) | 0];
      wrapped(T, x, y, r, (px, py) => {
        g.globalAlpha = 0.05 + rng() * 0.05;
        g.drawImage(getGlow(col), px - r, py - r, r * 2, r * 2);
      });
    }
    return c;
  }

  function nebulaFor(stage) {
    let c = nebCache.get(stage);
    if (c) return c;
    const T = LAYERS.nebula.T, k = 0.4;
    c = makeCanvas(T * k, T * k);
    const g = c.getContext('2d');
    g.scale(k, k);
    g.globalCompositeOperation = 'lighter';
    const tint = STAGES[stage].tint[1];
    const cols = NEBULA_COLORS.map((col) => mixHex(col, tint, 0.18));
    const rng = mulberry32(7000 + stage * 31);
    for (let i = 0; i < NEBULA_CLOUDS; i++) {
      const x = rng() * T, y = rng() * T, r = lerp(NEBULA_SIZE[0], NEBULA_SIZE[1], rng());
      const col = cols[(rng() * cols.length) | 0], ang = rng() * Math.PI, sq = 0.35 + 0.5 * rng();
      const al = lerp(NEBULA_ALPHA[0], NEBULA_ALPHA[1], rng());
      // elongated soft clouds: a few overlapping glows along a rotated axis
      for (let j = 0; j < 3; j++) {
        const off = (j - 1) * r * 0.55, rj = r * (0.8 + 0.3 * rng());
        const cx = x + Math.cos(ang) * off, cy = y + Math.sin(ang) * off;
        wrapped(T, cx, cy, rj, (px, py) => {
          g.save();
          g.translate(px, py); g.rotate(ang); g.scale(1, sq);
          g.globalAlpha = al;
          g.drawImage(getGlow(col), -rj, -rj, rj * 2, rj * 2);
          g.restore();
        });
      }
    }
    nebCache.set(stage, c);
    return c;
  }

  // a handful of distant galaxies: elliptical smudges with a bright core and a faint spiral-ish disk
  function bakeGalaxies(T, seed) {
    const k = 0.75;
    const c = makeCanvas(Math.ceil(T * k), Math.ceil(T * k));
    const g = c.getContext('2d');
    g.scale(k, k);
    g.globalCompositeOperation = 'lighter';
    const rng = mulberry32(seed);
    for (let i = 0; i < GALAXY_COUNT; i++) {
      const x = ((i + 0.2 + 0.6 * rng()) / GALAXY_COUNT) * T, y = rng() * T;
      const r = lerp(GALAXY_SIZE[0], GALAXY_SIZE[1], rng() * rng()), ang = rng() * Math.PI, sq = 0.25 + 0.55 * rng();
      const br = lerp(GALAXY_BRIGHTNESS[0], GALAXY_BRIGHTNESS[1], rng());
      wrapped(T, x, y, r * 3, (px, py) => {
        g.save();
        g.translate(px, py); g.rotate(ang); g.scale(1, sq);
        g.globalAlpha = br * 0.5; g.drawImage(getGlow('#9db8ff'), -r * 2.4, -r * 2.4, r * 4.8, r * 4.8);
        g.globalAlpha = br * 0.55; g.drawImage(getGlow('#ffe2b0'), -r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
        g.restore();
      });
    }
    return c;
  }

  function ensureTiles() {
    if (tiles) return;
    tiles = {
      galaxy: bakeGalaxies(LAYERS.galaxy.T, 77),
      speck: bakeSpecks(LAYERS.speck.T, 51),
      dust: bakeDust(LAYERS.dust.T, 11),
      far: bakeStarTile(LAYERS.far.T, 260, [0.5, 1.1], 0, 21, 0),
      mid: bakeStarTile(LAYERS.mid.T, 120, [0.8, 2.1], 0, 31, 6),
      fore: bakeFore(LAYERS.fore.T, 41),
    };
  }

  function drawTiles(ctx, img, l, w, h) {
    const T = l.T, s = l.scale, cx = w / 2, cy = h / 2, size = T * s;
    const i0 = Math.floor((l.ox - (cx + MARGIN) / s) / T);
    const i1 = Math.ceil((l.ox + (w - cx + MARGIN) / s) / T);
    const j0 = Math.floor((l.oy - (cy + MARGIN) / s) / T);
    const j1 = Math.ceil((l.oy + (h - cy + MARGIN) / s) / T);
    for (let j = j0; j < j1; j++) {
      const y = cy + (j * T - l.oy) * s;
      for (let i = i0; i < i1; i++) ctx.drawImage(img, cx + (i * T - l.ox) * s, y, size, size);
    }
  }

  function drawTwinkle(ctx, groups, l, w, h, time, base, depth) {
    for (let g = 0; g < groups.length; g++) {
      const tw = TWINKLE[g % TWINKLE.length];
      const s = 0.5 + 0.5 * Math.sin((time / tw.period) * TAU + tw.phase);
      ctx.globalAlpha = base * (0.15 + depth * s);
      drawTiles(ctx, groups[g], l, w, h);
    }
  }

  return {
    /** Call when the canvas backing store changes (resize / DPR change). */
    resize(dpr) {
      const r = clamp(dpr, 1, 2);
      if (r !== res) { res = r; tiles = null; }
    },

    /** Integrate camera motion into layer scroll offsets and ease the zoom scales. */
    update(camera, dt, reduced) {
      const z = camera.zoom > 1e-9 ? camera.zoom : 1;
      if (!zRef) zRef = z;
      const dx = prev ? camera.x - prev.x : 0;
      const dy = prev ? camera.y - prev.y : 0;
      prev = prev || { x: 0, y: 0 };
      prev.x = camera.x; prev.y = camera.y;
      const k = 1 - Math.exp(-3 * Math.min(dt, 0.1));
      const damp = reduced ? 0.3 : 1;
      for (const key in L) {
        const l = L[key];
        l.ox += (dx * z * l.par * damp) / l.scale;
        l.oy += (dy * z * l.par * damp) / l.scale;
        if (l.ox > 1e6 || l.ox < -1e6) l.ox %= l.T;
        if (l.oy > 1e6 || l.oy < -1e6) l.oy %= l.T;
        const target = clamp(Math.pow(z / zRef, l.zp * (reduced ? 0.4 : 1)), 0.45, 2.2);
        l.scale += (target - l.scale) * k;
      }
    },

    /**
     * Background layers (nebula, dust, far, mid). `fade` = {from, to, t} stage cross-fade,
     * quality 0..2.
     */
    draw(ctx, w, h, time, fade, quality, reduced) {
      ensureTiles();
      const dens = (key) => lerp(STAGES[fade.from][key], STAGES[fade.to][key], fade.t);
      ctx.globalCompositeOperation = 'source-over';

      // soft layered nebula clouds (cross-faded between stages), then distant galaxies
      ctx.globalAlpha = 1 - fade.t;
      if (fade.t < 1) drawTiles(ctx, nebulaFor(fade.from), L.nebula, w, h);
      if (fade.t > 0) {
        ctx.globalAlpha = fade.t;
        drawTiles(ctx, nebulaFor(fade.to), L.nebula, w, h);
      }

      ctx.globalAlpha = 1;
      drawTiles(ctx, tiles.galaxy, L.galaxy, w, h);
      drawTiles(ctx, tiles.speck, L.speck, w, h);

      // two crisp star layers with subtle parallax
      const sd = clamp(dens('stars'), 0.6, 1);
      ctx.globalAlpha = 0.8 * sd;
      drawTiles(ctx, tiles.far.c, L.far, w, h);
      ctx.globalAlpha = sd;
      drawTiles(ctx, tiles.mid.c, L.mid, w, h);
      ctx.globalAlpha = 1;
    },

    /** Out-of-focus foreground motes (drawn over the bodies). */
    drawForeground(ctx, w, h, quality, reduced) {
      return; // foreground motes stay off: they overlap small bodies
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1;
      drawTiles(ctx, tiles.fore, L.fore, w, h);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}
