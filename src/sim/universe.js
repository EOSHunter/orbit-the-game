// Deterministic, effectively infinite, chunked procedural universe. Pure: no DOM, no Math.random, no Date.
//
// Space (the x-z play plane) is cut into square cells per scale LEVEL. Level L holds bodies with mass in
// [mass0 * ratio^L, mass0 * ratio^(L+1)); its cell edge is cellK times the level's reference radius, so every level
// shows roughly the same number of cells at the scale where it matters ("density that changes with scale").
// A cell's content is a pure function of (seed, GEN_VERSION, level, cx, cz) with a fixed draw order. Bodies of one
// cell never need another cell of the SAME level (systems and their orbits are confined to the cell); a body only
// has to avoid the envelopes of HIGHER levels, which are themselves pure, so the result is order independent.
//
// Systems (star > planets > moons, belts) are generated in a local frame and ride analytic Kepler rails around a
// static root. Field bodies (no system) are placed at rest-epoch positions with a small drift velocity; the sim
// integrates them once they are loaded.
import { CONFIG as DEFAULT_CONFIG } from './config.js';
import { hash32, hashString, makeRng, makeId, noise2, smoothstep } from './rng.js';
import { CLS_INDEX, clsForMass, stageIdForMass, describeBody, spinRate } from './classes.js';
import { railOffset } from './orbits.js';

export const GEN_VERSION = 1;
const TAU = Math.PI * 2;

// Satellite rules by host class. `ratio` is an exponent range: child mass = host mass * 10^-U(lo, hi).
const SYSTEM_RULES = {
  star: { chance: 0.85, count: [2, 6], ratio: [1.3, 3.1], a0: [2.4, 3.6], maxA: 8, eMax: 0.18, belt: 0.4, sub: true },
  brownDwarf: { chance: 0.5, count: [1, 2], ratio: [1.2, 2.2], a0: [2.5, 4], maxA: 7, eMax: 0.15, belt: 0, sub: false },
  neutronStar: { chance: 0.35, count: [1, 2], ratio: [1.5, 2.8], a0: [3, 5], maxA: 7, eMax: 0.12, belt: 0, sub: false },
  blackHole: { chance: 0.5, count: [1, 3], ratio: [2.5, 4], a0: [6, 9], maxA: 14, eMax: 0.2, belt: 0, sub: true },
  gasGiant: { chance: 0.8, count: [1, 4], ratio: [1.2, 2.4], a0: [2.4, 3.4], maxA: 7, eMax: 0.1, belt: 0, sub: false },
  rockyPlanet: { chance: 0.4, count: [1, 2], ratio: [1.3, 2.2], a0: [2.5, 4], maxA: 6, eMax: 0.1, belt: 0, sub: false },
  dwarfPlanet: { chance: 0.3, count: [1, 2], ratio: [1.2, 2.0], a0: [2.5, 4], maxA: 6, eMax: 0.1, belt: 0, sub: false },
  asteroid: { chance: 0.08, count: [1, 1], ratio: [1.0, 1.6], a0: [2.5, 3.5], maxA: 5, eMax: 0.05, belt: 0, sub: false },
};

export function makeLevels(cfg) {
  const { count, mass0, ratio, cellK } = cfg.levels;
  const ru = cfg.radiusUnit;
  const refR = []; const maxR = []; const cell = [];
  for (let L = 0; L < count; L++) {
    refR.push(ru * Math.sqrt(mass0 * ratio ** (L + 0.5)));
    maxR.push(ru * Math.sqrt(mass0 * ratio ** (L + 1)));
    cell.push(cellK * refR[L]);
  }
  return {
    count,
    massMin: (L) => mass0 * ratio ** L,
    levelOfMass: (m) => Math.max(0, Math.min(count - 1, Math.floor(Math.log(Math.max(m, 1e-9) / mass0) / Math.log(ratio)))),
    radiusRef: (L) => refR[L],
    radiusMax: (L) => maxR[L],
    cellSize: (L) => cell[L],
  };
}

export const muOf = (cfg, radius) => cfg.gravity.surfaceRate * cfg.gravity.surfaceRate * radius * radius * radius;

export function createUniverse(seed, cfgIn) {
  const cfg = cfgIn || DEFAULT_CONFIG;
  const seedStr = String(seed);
  const seedH = hashString(seedStr);
  const lv = makeLevels(cfg);
  const U = cfg.universe;
  const cache = new Map();
  const consumed = new Set();
  const knocked = new Map();
  let tick = 0;

  // ---- density field -------------------------------------------------------------------------------------
  function densityAt(level, x, z) {
    const s = lv.cellSize(level) * U.noiseCells;
    const gx = x / s; const gz = z / s;
    const n = 0.62 * noise2(seedH ^ 0x1234, level, gx, gz) + 0.38 * noise2(seedH ^ 0x5678, level, gx * 2.7 + 11.3, gz * 2.7 - 5.1);
    return smoothstep(U.voidLo, U.voidHi, n) * (0.55 + 0.9 * smoothstep(0.5, 0.8, n));
  }

  /** Region summary at an absolute position for the player's level (average over the levels the player eats). */
  function regionDensity(x, z, level) {
    let sum = 0; let k = 0;
    for (let l = Math.max(0, level - 3); l <= Math.min(lv.count - 1, level); l++) { sum += densityAt(l, x, z); k++; }
    return k ? sum / k : 0;
  }

  function getRegion(absPos, level) {
    const x = absPos[0]; const z = absPos[2];
    const density = regionDensity(x, z, level);
    const inVoid = density < U.voidDensity;
    let nearestMatter = null;
    if (inVoid) {
      const step = lv.cellSize(Math.min(lv.count - 1, level + 1)) * 0.5;
      let best = null; let bestD = -1;
      const V = cfg.void;
      outer:
      for (let k = 1; k <= V.rings; k++) {
        const rad = k * step;
        for (let i = 0; i < V.steps; i++) {
          const a = (i / V.steps) * TAU + k * 0.37;
          const sx = x + Math.cos(a) * rad; const sz = z + Math.sin(a) * rad;
          const d = regionDensity(sx, sz, level);
          if (d > bestD) { bestD = d; best = { dist: rad, bearing: Math.atan2(sx - x, -(sz - z)) }; }
          if (d >= V.nearThreshold) { best = { dist: rad, bearing: Math.atan2(sx - x, -(sz - z)) }; break outer; }
        }
      }
      nearestMatter = best;
    }
    return { density, inVoid, nearestMatter };
  }

  // ---- cell generation -----------------------------------------------------------------------------------
  function getCell(level, cx, cz) {
    const key = `${level}:${cx}:${cz}`;
    let c = cache.get(key);
    if (c) { c.used = tick; return c; }
    c = generateCell(level, cx, cz);
    c.used = tick;
    cache.set(key, c);
    return c;
  }

  function isFree(level, x, z, e, own) {
    for (let i = 0; i < own.length; i++) {
      const o = own[i]; const dx = o.x - x; const dz = o.z - z; const r = (o.e + e) * 1.05;
      if (dx * dx + dz * dz < r * r) return false;
    }
    for (let l = level + 1; l < lv.count; l++) {
      const cs = lv.cellSize(l);
      const ix0 = Math.floor((x - e) / cs); const ix1 = Math.floor((x + e) / cs);
      const iz0 = Math.floor((z - e) / cs); const iz1 = Math.floor((z + e) / cs);
      for (let ix = ix0; ix <= ix1; ix++) {
        for (let iz = iz0; iz <= iz1; iz++) {
          const envs = getCell(l, ix, iz).envs;
          for (let i = 0; i < envs.length; i++) {
            const o = envs[i]; const dx = o.x - x; const dz = o.z - z; const r = (o.e + e) * 1.05;
            if (dx * dx + dz * dz < r * r) return false;
          }
        }
      }
    }
    return true;
  }

  function newDesc(id, level, cx, cz, idx, mass, rng, depth, parentIdx) {
    const radius = cfg.radiusUnit * Math.sqrt(mass);
    const stageId = stageIdForMass(mass);
    let cls = clsForMass(mass);
    const desc = {
      id, level, cx, cz, idx, depth, pi: parentIdx,
      cls, stageId, starClass: null, variant: null, seed: hash32(id, 0x5eed), mass, radius,
      p0: null, v0: [0, 0, 0], spin: null, temperatureK: null, atmosphere: null, ring: null, beam: null,
      parentId: null, orbit: null, root: parentIdx < 0, hasSystem: false, extent: radius, comet: false,
    };
    // comets are small field bodies on the cold side of the size ladder
    if (depth === 0 && (cls === 'meteorite' || cls === 'asteroid') && rng() < U.cometChance) { cls = 'comet'; desc.cls = cls; desc.comet = true; }
    const info = describeBody(cls, mass, stageId, makeRng(hash32(id, 0xde5c)), radius);
    desc.variant = info.variant; desc.starClass = info.starClass; desc.temperatureK = info.temperatureK;
    desc.atmosphere = info.atmosphere; desc.ring = info.ring; desc.beam = info.beam;
    const sr = makeRng(hash32(id, 0x5b1)); // spin
    const t = sr() * 0.6; const ph = sr() * TAU;
    desc.spin = {
      axis: [Math.sin(t) * Math.cos(ph), Math.cos(t), Math.sin(t) * Math.sin(ph)],
      rate: spinRate(cls, sr()) * (sr() < 0.5 ? -1 : 1), phase: sr() * TAU,
    };
    desc.yo = (hash32(id, 0x77) / 4294967296 - 0.5) * 0.04 * radius;
    return desc;
  }

  const randInt = (rng, [lo, hi]) => lo + Math.floor(rng() * (hi - lo + 1));

  // Build the satellites of `host` (already in sys at index hostIdx). Returns the extent of the whole sub-system.
  function buildChildren(host, hostIdx, sys, rule, rng, depth, maxExtent) {
    const R = host.radius;
    const mu = muOf(cfg, R);
    const n = randInt(rng, rule.count);
    const dir = rng() < 0.5 ? 1 : -1;
    let prevOuter = 0;
    let first = true;
    let extent = R;
    const kids = n + (rule.belt && rng() < rule.belt ? 1 : 0); // the extra slot is a belt
    for (let i = 0; i < kids; i++) {
      const isBelt = i >= n;
      const rm = rng(); const re = rng(); const rw = rng(); const rM = rng(); const rg = rng(); const ra = rng(); const rs = rng();
      if (isBelt) {
        const nb = 6 + Math.floor(rs * 7);
        for (let b = 0; b < nb; b++) {
          const mass = host.mass * 10 ** -(4 + 1.2 * hash32(host.id, 0xbe17, b) / 4294967296);
          if (mass < cfg.levels.mass0) continue;
          const radius = cfg.radiusUnit * Math.sqrt(mass);
          const base = first ? R * (rule.a0[0] + (rule.a0[1] - rule.a0[0]) * ra) : prevOuter;
          const a = base + (first ? 0 : 1.5 * radius) + radius;
          if (a + radius > maxExtent) break;
          const id = makeId(host.id, 0xbe, b);
          const d = newDesc(id, host.level, host.cx, host.cz, sys.length, mass, makeRng(hash32(id, 1)), depth + 1, hostIdx);
          d.parentId = host.id;
          d.orbit = { a, e: 0, w: 0, M0: hash32(id, 3) / 4294967296 * TAU, n: dir * Math.sqrt(mu / (a * a * a)) };
          sys.push(d);
          prevOuter = a + radius; first = false;
          extent = Math.max(extent, prevOuter);
        }
        continue;
      }
      const mass = host.mass * 10 ** -(rule.ratio[0] + (rule.ratio[1] - rule.ratio[0]) * rm);
      if (mass < cfg.levels.mass0) continue;
      const id = makeId(host.id, 0xc1, i);
      const child = newDesc(id, host.level, host.cx, host.cz, sys.length, mass, makeRng(hash32(id, 1)), depth + 1, hostIdx);
      child.parentId = host.id;
      const myIdx = sys.length;
      sys.push(child);
      let env = child.radius;
      const subRule = rule.sub && depth + 1 < 2 ? SYSTEM_RULES[child.cls] : null;
      if (subRule && (hash32(id, 0x5c) / 4294967296) < subRule.chance * 0.6) {
        const sub = buildChildren(child, myIdx, sys, subRule, makeRng(hash32(id, 0x5d)), depth + 1, child.radius * subRule.maxA);
        env = Math.max(env, sub);
      }
      const e = rule.eMax * re;
      const gap = env + prevOuter * (0.15 + 0.25 * rg);
      const a = first ? (R * (rule.a0[0] + (rule.a0[1] - rule.a0[0]) * ra) + env) / (1 - e) : (prevOuter + gap + env) / (1 - e);
      const outer = a * (1 + e) + env;
      if (outer > maxExtent) { // does not fit: drop this child and everything generated for it
        sys.length = myIdx;
        break;
      }
      child.orbit = { a, e, w: rw * TAU, M0: rM * TAU, n: dir * Math.sqrt(mu / (a * a * a)) };
      child.extent = env;
      prevOuter = outer; first = false;
      extent = Math.max(extent, outer);
    }
    return extent;
  }

  function generateCell(level, cx, cz) {
    const cs = lv.cellSize(level);
    const x0 = cx * cs; const z0 = cz * cs;
    const cellH = hash32(seedH, GEN_VERSION, level, cx, cz);
    const mult = densityAt(level, x0 + cs / 2, z0 + cs / 2);
    const lambda = U.lambda * (1 + U.profileSlope * level) * mult * (lv.massMin(level) >= U.heavyMass ? U.heavyFactor : 1);
    const cr = makeRng(hash32(cellH, 7));
    const Lx = Math.exp(-lambda);
    let N = 0; let pr = cr();
    while (pr > Lx && N < U.maxPerCell) { N++; pr *= cr(); }
    const bodies = []; // root descs followed by their satellites, system by system
    const envs = [];
    const roots = [];
    const m0 = lv.massMin(level);
    for (let i = 0; i < N; i++) {
      const r = makeRng(hash32(cellH, 100 + i));
      const um = r(); const mass = m0 * cfg.levels.ratio ** (um ** 1.5);
      const id = makeId(level, cx, cz, i);
      const sys = [];
      const root = newDesc(id, level, cx, cz, 0, mass, makeRng(hash32(cellH, 300 + i)), 0, -1);
      sys.push(root);
      let extent = root.radius;
      const rule = SYSTEM_RULES[root.cls];
      if (rule && (hash32(cellH, 500 + i) / 4294967296) < rule.chance) {
        extent = buildChildren(root, 0, sys, rule, makeRng(hash32(cellH, 700 + i)), 0, Math.min(rule.maxA * root.radius, 0.35 * cs));
      }
      extent = Math.min(Math.max(extent, root.radius), 0.45 * cs);
      let placed = false; let px = 0; let pz = 0;
      for (let t = 0; t < U.placeTries; t++) {
        const ux = r(); const uz = r();
        const x = x0 + extent + ux * (cs - 2 * extent);
        const z = z0 + extent + uz * (cs - 2 * extent);
        if (isFree(level, x, z, extent, envs)) { placed = true; px = x; pz = z; break; }
      }
      if (!placed) continue;
      root.p0 = [px, root.yo, pz];
      root.extent = extent;
      root.hasSystem = sys.length > 1;
      envs.push({ x: px, z: pz, e: extent, id });
      const dr = makeRng(hash32(cellH, 900 + i));
      if (!root.hasSystem) {
        const ang = dr() * TAU;
        let sp = U.driftK * lv.radiusRef(level) ** U.driftExp * (U.driftMin + (U.driftMax - U.driftMin) * dr());
        if (root.comet) sp *= 3;
        root.v0 = [Math.cos(ang) * sp, 0, Math.sin(ang) * sp];
      }
      for (let k = 0; k < sys.length; k++) {
        const d = sys[k];
        d.level = level; d.cx = cx; d.cz = cz; d.idx = i;
      }
      Object.defineProperty(root, 'sys', { value: sys, enumerable: false });
      for (let k = 1; k < sys.length; k++) Object.defineProperty(sys[k], 'sys', { value: sys, enumerable: false });
      bodies.push(...sys);
      roots.push(root);
    }
    return { level, cx, cz, bodies, roots, envs, used: 0 };
  }

  // ---- queries -------------------------------------------------------------------------------------------
  // `budget` ({ left }) caps how many NEW cells one query may generate (frame-time smoothing); skipped cells are picked up
  // by the next query. Without a budget everything is generated at once.
  function cellsAround(level, x, z, radius, fn, budget) {
    const cs = lv.cellSize(level);
    const ix0 = Math.floor((x - radius) / cs); const ix1 = Math.floor((x + radius) / cs);
    const iz0 = Math.floor((z - radius) / cs); const iz1 = Math.floor((z + radius) / cs);
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        if (budget && !cache.has(`${level}:${ix}:${iz}`)) { if (budget.left <= 0) continue; budget.left--; }
        fn(getCell(level, ix, iz));
      }
    }
  }

  /**
   * Bodies near `center` (absolute [x,y,z]). `near` holds whole systems (root + satellites) whose envelope touches the
   * near window of its level; `far` holds roots beyond that inside the far window. Both are cached descriptors (do not
   * mutate them). levelRange = [lowest near/far level, highest near level]. opts.far === false skips the far field.
   */
  function query(center, viewRadius, levelRange, opts) {
    tick++;
    const wantFar = !opts || opts.far !== false;
    const budget = opts && opts.budget > 0 ? { left: opts.budget } : null;
    const x = center[0]; const z = center[2];
    const lo = Math.max(0, levelRange[0]); const hi = Math.min(lv.count - 1, levelRange[1]);
    const near = []; const far = [];
    for (let l = lo; l < lv.count; l++) {
      const cs = lv.cellSize(l);
      const winNear = Math.min(viewRadius, U.nearK * lv.radiusMax(l));
      const winFar = wantFar ? U.farCells * cs : 0;
      const scan = Math.max(winFar, winNear + 0.5 * cs);
      cellsAround(l, x, z, scan, (cell) => {
        const roots = cell.roots;
        for (let i = 0; i < roots.length; i++) {
          const root = roots[i];
          if (consumed.has(root.id)) {
            // the host is gone: its still-present satellites are reported on their own as orphans
            if (l <= hi) {
              const dx = root.p0[0] - x; const dz = root.p0[2] - z;
              if (Math.hypot(dx, dz) < winNear + root.extent) for (let k = 1; k < root.sys.length; k++) if (!consumed.has(root.sys[k].id)) near.push(root.sys[k]);
            }
            continue;
          }
          const d = Math.hypot(root.p0[0] - x, root.p0[2] - z);
          const reach = Math.max(root.extent, 1.5 * root.radius);
          if (l <= hi && d < winNear + reach) {
            const sys = root.sys;
            for (let k = 0; k < sys.length; k++) if (!consumed.has(sys[k].id)) near.push(sys[k]);
          } else if (wantFar && d < winFar) far.push(root);
        }
      }, budget);
    }
    evict();
    return { near, far };
  }

  function evict() {
    if (cache.size <= U.cacheMax) return;
    const entries = [...cache.entries()].sort((a, b) => a[1].used - b[1].used || (a[0] < b[0] ? -1 : 1));
    const drop = Math.ceil(cache.size - U.cacheMax * 0.75);
    for (let i = 0; i < drop; i++) cache.delete(entries[i][0]);
  }

  /** Absolute position/velocity of any descriptor at time t (follows the satellite chain). */
  function railState(desc, t, pos, vel) {
    const chain = [];
    for (let d = desc; d; d = d.pi >= 0 ? desc.sys[d.pi] : null) chain.push(d);
    chain.reverse();
    const root = chain[0];
    pos[0] = root.p0[0]; pos[1] = root.p0[1]; pos[2] = root.p0[2];
    vel[0] = root.v0[0]; vel[1] = 0; vel[2] = root.v0[2];
    const o = [0, 0, 0]; const ov = [0, 0, 0];
    for (let i = 1; i < chain.length; i++) {
      railOffset(chain[i].orbit, t, o, ov);
      pos[0] += o[0]; pos[2] += o[2]; vel[0] += ov[0]; vel[2] += ov[2];
    }
  }

  /**
   * True when no gravity well that matters to a body of radius `S0` reaches (x, z): a well matters when its surface escape
   * speed exceeds 60 % of the starter's top speed (infalling debris is then too fast to catch).
   */
  function wellFree(x, z, margin, S0) {
    const g = cfg.gravity;
    const minR = (0.6 * cfg.player.maxSpeed * S0) / (g.surfaceRate * Math.SQRT2);
    for (let l = Math.max(0, lv.levelOfMass((minR / cfg.radiusUnit) ** 2)); l < lv.count; l++) {
      let free = true;
      cellsAround(l, x, z, Math.min(g.rangeK * lv.radiusMax(l) + margin, 4 * lv.cellSize(l)), (cell) => {
        for (const root of cell.roots) {
          if (root.radius < minR || consumed.has(root.id)) continue;
          if (Math.hypot(root.p0[0] - x, root.p0[2] - z) < g.rangeK * root.radius + margin) free = false;
        }
      });
      if (!free) return false;
    }
    return true;
  }

  /**
   * A calm spot for the player to begin: dense region, nothing big close by, and outside the reach of every gravity well
   * that would fling debris past a starter too fast to catch, searched on a spiral from the origin.
   */
  function findStart(fromLevel, clearRadius) {
    const lvl = Math.min(lv.count - 1, fromLevel + 2);
    const step = lv.cellSize(lvl) * 0.5;
    const S0 = clearRadius / 12;
    let fallback = null;
    for (let k = 0; k < 2500; k++) {
      const a = k * 2.399963; const r = step * Math.sqrt(k) * 0.9;
      const x = Math.cos(a) * r; const z = Math.sin(a) * r;
      if (regionDensity(x, z, fromLevel) < 0.8) continue;
      if (!isFree(fromLevel - 1, x, z, clearRadius, [])) continue;
      if (!fallback) fallback = [x, 0, z];
      if (!wellFree(x, z, 25 * clearRadius, S0)) continue;
      return [x, 0, z];
    }
    return fallback || [0, 0, 0];
  }

  return {
    seed: seedStr,
    genVersion: GEN_VERSION,
    levels: lv,
    query,
    getRegion,
    getCell,
    findStart,
    railState,
    densityAt,
    consume(id) { consumed.add(id); knocked.delete(id); },
    isConsumed: (id) => consumed.has(id),
    setKnocked(id, state) { knocked.set(id, state); },
    getKnocked: (id) => knocked.get(id),
    exportDeltas() {
      return { consumed: [...consumed].sort((a, b) => a - b), knocked: [...knocked.entries()].map(([id, s]) => ({ id, ...s })) };
    },
    importDeltas(d) {
      consumed.clear(); knocked.clear();
      if (!d) return;
      for (const id of d.consumed || []) consumed.add(id);
      for (const k of d.knocked || []) { const { id, ...rest } = k; knocked.set(id, rest); }
    },
    cacheSize: () => cache.size,
    clearCache() { cache.clear(); },
    CLS_INDEX,
  };
}
