// Simulation / Universe (SIM): the public entry point. Pure JS, no rendering, no DOM, no Math.random/Date.
// See src/sim/README.md for the model; docs/interfaces.md section 4 for the contract.
import { STAGES as DEFAULT_STAGES, getChoicesFor, applyChoice, getEnding, choiceFlags } from '../stages.js';
import { CONFIG, mergeConfig } from './config.js';
import { createBus } from './events.js';
import { createUniverse, GEN_VERSION, makeLevels } from './universe.js';
import { hash32, hashString, makeRng, smoothstep } from './rng.js';
import {
  CLS_LIST, CLS_INDEX, stageIdForMass, ENTRY_CLASSES,
} from './classes.js';
import {
  clamp, lerp, softenedAccel, escapeSpeed, rocheDistance, absorbEfficiency, mergeVelocity, classify, specificEnergy,
} from './physics.js';
import { railOffset } from './orbits.js';
import {
  bodyFromDesc, makeDynamic, setMass, stepVisuals, updateEmissive, playerLook, blankBody, DYN_BASE,
} from './body.js';

export { CLS_LIST, GEN_VERSION };

const U32 = 4294967296;
const TAU = Math.PI * 2;

function defaultSeed() {
  // The only entropy point in SIM, used only when the host passes no seed. Everything after is deterministic.
  try {
    const a = new Uint32Array(2);
    globalThis.crypto.getRandomValues(a);
    return `VD-${a[0].toString(36).toUpperCase().slice(0, 4)}-${a[1].toString(36).toUpperCase().slice(0, 4)}`;
  } catch (e) {
    return 'VD-DEFAULT';
  }
}

const FALLBACK_ENDINGS = {
  death: { id: 'stellar-fragment', title: 'Stellar Fragment', text: 'Something far larger swept you into countless glittering fragments.' },
  eventHorizon: { id: 'event-horizon', title: 'Event Horizon', text: 'A far larger black hole took you. Out there, time forgets you, and you become eternal.' },
  finale: { id: 'creator-god', title: 'Creator God', text: 'Nothing is left that can resist you.' },
};

export function createSim(opts = {}) {
  const cfg = mergeConfig(CONFIG, opts.config);
  const stages = opts.stages || DEFAULT_STAGES;
  const lastStage = stages.length - 1;
  const bus = createBus();
  const levels = makeLevels(cfg);
  const G = cfg.gravity;

  let seedStr = opts.seed != null ? String(opts.seed) : defaultSeed();
  let seedH = hashString(seedStr);
  let universe = createUniverse(seedStr, cfg);

  // ---- snapshot -----------------------------------------------------------------------------------------
  const player = blankBody(cfg);
  player.id = 0; player.rel = 'self'; player.health = 1; player.invuln = false; player.thrust = [0, 0];
  const bodies = [];
  const far = {
    count: 0, p: new Float32Array(cfg.maxFar * 3), size: new Float32Array(cfg.maxFar), cls: new Uint8Array(cfg.maxFar),
    seed: new Uint32Array(cfg.maxFar), temp: new Float32Array(cfg.maxFar),
  };
  const hud = {
    speed: 0, speedMax: 0, escapeSpeed: null, thrust: 0, gravityDepth: 0,
    proximity: { star: 0, blackHole: 0, pulsar: 0 }, inAtmosphere: false, atmosphereDensity: 0,
    nearestThreat: null, nearestPrey: null, markers: [],
    region: { inVoid: false, density: 1, nearestMatter: null },
    capture: null, orbit: null, trajectory: null, beaconAudio: { pulsar: 0 },
  };
  const state = {
    status: 'title', time: 0, mass: cfg.startMass, stageIndex: 0, stageId: stages[0].id, progress: 0, health: 1,
    flags: {}, stats: { absorbed: 0, hits: 0, elapsed: 0, maxMass: cfg.startMass, nearMisses: 0, disruptions: 0 },
    seed: seedStr, genVersion: GEN_VERSION, originAbs: [0, 0, 0],
    player, bodies, far,
    sky: { seed: 0, level: 0, density: 1 },
    key: { dir: [0.5, 0.4, 0.2], temperatureK: 6500, intensity: 0.1, hostId: null },
    hud,
  };

  // internal reusable objects
  const ntObj = { id: 0, cls: '', bearing: 0, dist: 0, gap: 0, ratio: 0 };
  const npObj = { id: 0, cls: '', bearing: 0, dist: 0, gap: 0, ratio: 0 };
  const markerPool = Array.from({ length: 12 }, () => ({ id: 0, rel: 'neutral', cls: '', bearing: 0, dist: 0, p: [0, 0, 0] }));
  const nmObj = { dist: 0, bearing: 0 };
  const captureObj = { level: 0, hostId: null };
  const orbitObj = { hostId: 0, hostCls: '', period: 0, altitude: 0 };

  // ---- run-time variables ------------------------------------------------------------------------------
  const loaded = new Map();       // id -> live body
  const wells = [];                // bodies and static far records that exert gravity
  const farRecs = new Map();       // id -> { id, cls, p, v, mass, radius, _mu, desc, ... }
  const sweep = [];
  let farList = [];
  let worldTime = 0;
  let stepCount = 0;
  let hitStop = 0; let hitTimer = 0; let invuln = 0; let deathTimer = 0; let deathKind = null; let finaleT = 0;
  let playerAlive = true;
  let input = { x: 0, z: 0, stabilize: false };
  let loaderEnabled = true;
  let dynRng = makeRng(hash32(seedH, 0xd7a));
  let dynId = 0; let dynCount = 0;
  let chainT = -99; let chainN = 0;
  let healthLowFired = false;
  let disrupting = 0;
  let thrustAccelNow = 1;
  let options = { trajectory: cfg.trajectory.enabled };
  // orbit / assist / capture / region trackers
  let orbitHost = null; let orbitTimer = 0; let orbitLostTimer = 0;
  let assistHost = null; let assistW = 0;
  let captureLevel = 0; let captureHost = null; let captureWarned = 0; let captureActive = false;
  let regionTimer = 0; let beaconTimer = 0; let inVoid = false;
  let tidalHost = null; let tidalActive = false; let tidalShed = 0;
  let keyHost = null; let keyGlowDir = [0.5, 0.4, 0.2];
  let trajTimer = 0;
  const tmp2 = [0, 0];
  const tmpO = [0, 0, 0]; const tmpOV = [0, 0, 0];
  const tmpA = [0, 0, 0]; const tmpV = [0, 0, 0]; const queryPos = [0, 0, 0];

  const stageIndexOf = (mass) => {
    let idx = 0;
    for (let i = 1; i < stages.length; i++) { if (mass >= (Number(stages[i].minMass) || 0)) idx = i; else break; }
    return idx;
  };
  const stageT = (i) => clamp(i / Math.max(1, lastStage), 0, 1);

  let quiet = false;     // dev starts replay evolution silently: no events until the run really begins
  function emit(type, payload) { if (!quiet) bus.emit(type, payload); }
  function setStatus(s) {
    if (state.status === s) return;
    const prev = state.status; state.status = s;
    emit('status', { status: s, prev });
  }
  const pos3 = (b) => [b.p[0], b.p[1], b.p[2]];

  function growPlayer() {
    setMass(cfg, player, player.mass);
    state.mass = player.mass;
  }

  function updateProgress() {
    const i = state.stageIndex;
    if (i >= lastStage) { state.progress = 1; return; }
    const base = i === 0 ? cfg.startMass : Number(stages[i].minMass) || 0;
    const next = Number(stages[i + 1].minMass) || base + 1;
    state.progress = clamp((state.mass - base) / Math.max(1e-9, next - base), 0, 1);
  }

  // =================================================================================================
  // Loading
  // =================================================================================================
  function railUpdate(b) {
    const parent = b._parent;
    railOffset(b._orbit, worldTime, tmpO, tmpOV);
    b.p[0] = parent.p[0] + tmpO[0]; b.p[2] = parent.p[2] + tmpO[2];
    b.v[0] = parent.v[0] + tmpOV[0]; b.v[2] = parent.v[2] + tmpOV[2];
  }

  function demote(b) {
    if (!b.onRails) return;
    b.onRails = false; b.parentId = null; b._parent = null; b._static = false;
  }

  function promoteChildren(host) {
    for (let i = 0; i < bodies.length; i++) {
      const c = bodies[i];
      if (c._parent === host && !c._dead) { demote(c); }
    }
  }

  function instantiate(d) {
    const kn = universe.getKnocked(d.id);
    const b = bodyFromDesc(cfg, d, state.originAbs);
    if (kn) {
      b.onRails = false; b.parentId = null; b._static = false;
      b.p[0] = kn.p[0] - state.originAbs[0]; b.p[2] = kn.p[2] - state.originAbs[2];
      b.v[0] = kn.v[0]; b.v[2] = kn.v[1];
    } else if (d.orbit) {
      const parent = loaded.get(d.parentId);
      if (parent && !parent._dead) { b._parent = parent; railUpdate(b); }
      else if (universe.isConsumed(d.parentId)) {
        universe.railState(d, worldTime, tmpA, tmpV);
        b.onRails = false; b.parentId = null;
        b.p[0] = tmpA[0] - state.originAbs[0]; b.p[2] = tmpA[2] - state.originAbs[2];
        b.v[0] = tmpV[0]; b.v[2] = tmpV[2];
      } else return null;
    }
    b._chaser = -1;
    stepVisualsInit(b);
    bodies.push(b); loaded.set(b.id, b);
    return b;
  }
  function stepVisualsInit(b) { updateEmissive(b); b.rel = classify(cfg.ratio, player.mass, b.mass, 'neutral'); }

  function addDynamic(kind, mass, p, v) {
    if (bodies.length >= cfg.maxNearBodies || dynCount >= cfg.maxDynamic) return null;
    const b = makeDynamic(cfg, kind, mass, p, v, seedH, ++dynId);
    b.rel = classify(cfg.ratio, player.mass, b.mass, 'neutral');
    bodies.push(b); loaded.set(b.id, b); dynCount++;
    return b;
  }

  function killBody(b, consume) {
    if (b._dead) return;
    b._dead = true;
    if (b.entry) { b.entry = null; }
    if (consume && !b._dyn) universe.consume(b.id);
    promoteChildren(b);
  }

  function winOf(level, viewR) { return Math.min(viewR, cfg.universe.nearK * levels.radiusMax(level)); }

  function farRecFor(d) {
    let r = farRecs.get(d.id);
    if (!r) {
      r = { id: d.id, cls: d.cls, p: [0, 0, 0], v: [0, 0, 0], mass: d.mass, radius: d.radius, _mu: 0, desc: d, state: 'alive', _dead: false, _isFar: true, _stamp: 0, atmosphere: null, temperatureK: d.temperatureK };
      r._mu = setMassOnly(d.mass, d.radius);
      r._range = G.rangeK * d.radius;
      farRecs.set(d.id, r);
    }
    return r;
  }
  function setMassOnly(_m, R) { return G.surfaceRate * G.surfaceRate * R * R * R; }

  function refreshWells() {
    wells.length = 0;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (!b._dead && b.mass >= G.wellMass && b.state === 'alive') wells.push(b);
    }
    const reachBase = cfg.view.radiusS * player.radius;
    for (const r of farRecs.values()) {
      if (r.mass < G.wellMass || loaded.has(r.id) || universe.isConsumed(r.id)) continue;
      if (Math.hypot(r.p[0] - player.p[0], r.p[2] - player.p[2]) < reachBase + G.rangeK * r.radius) wells.push(r);
    }
  }

  function loaderTick(force) {
    const S = player.radius; const viewR = cfg.view.radiusS * S;
    const Lp = levels.levelOfMass(player.mass);
    const lo = Math.max(0, Lp - cfg.levels.belowLevels);
    const qx = state.originAbs[0] + player.p[0]; const qz = state.originAbs[2] + player.p[2];
    queryPos[0] = qx; queryPos[1] = 0; queryPos[2] = qz;
    const doFar = force || stepCount % cfg.view.farRefreshSteps === 0;
    const { near, far: farD } = universe.query(queryPos, viewR, [lo, levels.count - 1], { far: doFar, budget: force ? 0 : cfg.view.genBudget });
    const px = player.p[0]; const pz = player.p[2];

    // ---- load
    const cand = [];
    for (let i = 0; i < near.length; i++) if (!loaded.has(near[i].id)) cand.push(near[i]);
    if (cand.length) {
      const room = cfg.maxNearBodies - bodies.length;
      let pick = cand;
      if (cand.length > room || (!force && cand.length > cfg.view.loadBudget)) {
        const keyOf = new Map();
        for (const d of cand) {
          const root = d.sys ? d.sys[0] : d;
          const dist = Math.hypot(root.p0[0] - state.originAbs[0] - px, root.p0[2] - state.originAbs[2] - pz);
          keyOf.set(d, -(d.radius + 0.1) / (dist + S));
        }
        pick = cand.slice().sort((a, b) => keyOf.get(a) - keyOf.get(b));
        pick = pick.slice(0, Math.max(0, Math.min(room, force ? room : cfg.view.loadBudget)));
        pick.sort((a, b) => a.depth - b.depth);
      }
      for (let i = 0; i < pick.length; i++) instantiate(pick[i]);
    }

    // ---- unload (hysteresis: a body stays until well beyond its load window)
    let any = false;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b._dead || b.state === 'absorbing') continue;
      let drop;
      if (b.onRails && b._parent) drop = b._parent._unload === true;
      else {
        const dist = Math.hypot(b.p[0] - px, b.p[2] - pz);
        if (b._dyn) drop = dist > viewR * 3;
        else {
          const d = b._desc;
          const win = winOf(d.level, viewR);
          const reach = d.root ? Math.max(d.extent, 1.5 * d.radius) : b.radius * 2;
          drop = dist > cfg.view.unloadK * (win + reach) + b.radius;
        }
      }
      b._unload = drop;
      if (drop) any = true;
    }
    if (any) {
      let w = 0;
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (b._unload && !b._dead) { loaded.delete(b.id); b._dead = true; b._gone = true; if (b._dyn) dynCount--; }
        else bodies[w++] = b;
      }
      bodies.length = w;
    }

    // ---- far field + static wells (refreshed less often than the near field)
    if (doFar) {
    farList = farD;
    const stamp = stepCount;
    for (let i = 0; i < farD.length; i++) {
      const d = farD[i];
      const r = farRecFor(d);
      r._stamp = stamp;
      r.p[0] = d.p0[0] - state.originAbs[0]; r.p[1] = d.p0[1]; r.p[2] = d.p0[2] - state.originAbs[2];
    }
    for (const [id, r] of farRecs) if (r._stamp !== stamp) farRecs.delete(id);
    fillFar(farD, px, pz);
    }
    refreshWells();
    if (doFar) updateKeyCandidates();
    const lvl = Lp;
    state.sky.level = lvl;
    const cs = levels.cellSize(Math.min(levels.count - 1, lvl + 2));
    state.sky.seed = hash32(seedH, Math.floor(qx / cs), Math.floor(qz / cs));
  }

  function fillFar(farD, px, pz) {
    let list = farD;
    if (list.length > cfg.maxFar) {
      const key = new Map();
      for (const d of list) key.set(d, -d.radius / (Math.hypot(d.p0[0] - state.originAbs[0] - px, d.p0[2] - state.originAbs[2] - pz) + 1));
      list = list.slice().sort((a, b) => key.get(a) - key.get(b)).slice(0, cfg.maxFar);
    }
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const d = list[i];
      if (loaded.has(d.id)) continue;
      far.p[n * 3] = d.p0[0] - state.originAbs[0]; far.p[n * 3 + 1] = d.p0[1]; far.p[n * 3 + 2] = d.p0[2] - state.originAbs[2];
      far.size[n] = d.radius; far.cls[n] = CLS_INDEX[d.cls]; far.seed[n] = d.seed; far.temp[n] = d.temperatureK || 0;
      n++;
    }
    far.count = n;
  }

  // ---- key light -----------------------------------------------------------------------------------------
  function updateKeyCandidates() {
    let best = null; let bestL = 0;
    const consider = (host, T, R) => {
      const dx = host.p[0] - player.p[0]; const dz = host.p[2] - player.p[2];
      const lum = (R * R * (T / 5800) ** 4) / (dx * dx + dz * dz + R * R);
      if (lum > bestL) { bestL = lum; best = host; }
    };
    for (let i = 0; i < bodies.length; i++) { const b = bodies[i]; if (b.cls === 'star' && !b._dead) consider(b, b.temperatureK || 5800, b.radius); }
    for (const r of farRecs.values()) if (r.cls === 'star' && !loaded.has(r.id)) consider(r, r.temperatureK || 5800, r.radius);
    keyHost = best;
  }

  function updateKey() {
    const k = state.key;
    const h = keyHost;
    if (h && !h._dead) {
      const dx = h.p[0] - player.p[0]; const dz = h.p[2] - player.p[2];
      const d = Math.hypot(dx, dz) || 1;
      const hl = d; const y = 0.32 * hl;
      const n = Math.hypot(dx, y, dz);
      k.dir[0] = dx / n; k.dir[1] = y / n; k.dir[2] = dz / n;
      k.hostId = h.id; k.temperatureK = h.temperatureK || 5800;
      k.intensity = clamp(0.15 + 6 * (h.radius / d), 0.15, 1);
    } else {
      k.dir[0] = keyGlowDir[0]; k.dir[1] = keyGlowDir[1]; k.dir[2] = keyGlowDir[2];
      k.hostId = null; k.temperatureK = 6500; k.intensity = 0.06;
    }
  }

  // =================================================================================================
  // Spawning of dynamic bodies
  // =================================================================================================
  function spread(n, vx, vz, speed, out) {
    // n unit offsets with zero mean, scaled by speed
    let mx = 0; let mz = 0;
    for (let i = 0; i < n; i++) {
      const a = dynRng() * TAU; const s = (0.3 + 0.7 * dynRng()) * speed;
      out[i * 2] = Math.cos(a) * s; out[i * 2 + 1] = Math.sin(a) * s;
      mx += out[i * 2]; mz += out[i * 2 + 1];
    }
    for (let i = 0; i < n; i++) { out[i * 2] += vx - mx / n; out[i * 2 + 1] += vz - mz / n; }
  }
  const spreadBuf = new Float64Array(64);

  function spawnDebris(kind, totalMass, n, p, vx, vz, speed, hot) {
    if (n <= 0 || totalMass <= 0) return 0;
    n = Math.min(n, 30);
    spread(n, vx, vz, speed, spreadBuf);
    let made = 0;
    for (let i = 0; i < n; i++) {
      const a = dynRng() * TAU; const r = dynRng();
      tmpA[0] = p[0] + Math.cos(a) * r; tmpA[1] = p[1]; tmpA[2] = p[2] + Math.sin(a) * r;
      tmpV[0] = spreadBuf[i * 2]; tmpV[1] = 0; tmpV[2] = spreadBuf[i * 2 + 1];
      const b = addDynamic(kind, totalMass / n, tmpA, tmpV);
      if (!b) continue;
      made++;
      if (hot) { b._hot = 1; b._flash = 1; }
    }
    return made;
  }

  // =================================================================================================
  // Player events: absorb, hit, death
  // =================================================================================================
  let stageStartElapsed = 0;
  // log-progress through the current stage versus the time spent in it (see CONFIG.pace)
  function paceFactor() {
    const c = cfg.pace;
    if (!c.enabled || state.stageIndex >= lastStage) return 1;
    const i = state.stageIndex;
    const lo = Math.max(cfg.startMass, Number(stages[i].minMass) || cfg.startMass);
    const hi = Number(stages[i + 1].minMass) || lo * 3.2;
    const lp = clamp(Math.log(player.mass / lo) / Math.log(hi / lo), 0, 1);
    const expected = clamp((state.stats.elapsed - stageStartElapsed) / c.targetStageTime, 0, 1.5);
    return clamp(((expected + c.delta) / (lp + c.delta)) ** c.power, c.min, c.max);
  }

  function playerAbsorb(b, relSpeed) {
    const p = player;
    const flags = state.flags;
    const vesc = escapeSpeed(p._mu + b._mu, p.radius + b.radius);
    let eff = absorbEfficiency(cfg.absorb, relSpeed, vesc);
    eff = Math.min(1, eff * (1 + (flags.absorbBonus || 0)) * paceFactor());
    const gained = b.mass * eff;
    const shed = b.mass - gained;
    const ratio = b.mass / p.mass;
    p.v[0] = mergeVelocity(p.mass, p.v[0], gained, b.v[0]);
    p.v[2] = mergeVelocity(p.mass, p.v[2], gained, b.v[2]);
    // angular momentum of the off-centre part goes into spin
    const dx = b.p[0] - p.p[0]; const dz = b.p[2] - p.p[2];
    const lz = dx * (b.v[2] - p.v[2]) - dz * (b.v[0] - p.v[0]);
    p.spin.rate = clamp(p.spin.rate + (lz * gained) / (p.mass * p.radius * p.radius + 1e-9), -3, 3);
    p.mass += gained;
    state.stats.absorbed++;
    state.stats.maxMass = Math.max(state.stats.maxMass, p.mass);
    growPlayer();
    if (b.cls !== 'debris' && b.cls !== 'fragment' && shed > 0) {
      const dm = shed * cfg.absorb.debrisFraction;
      const n = Math.min(cfg.absorb.debrisMax, Math.max(1, Math.round(dm / Math.max(1e-6, b.mass * 0.15))));
      if (dm > p.mass * 1e-6) spawnDebris('debris', dm, n, pos3(b), b.v[0], b.v[2], relSpeed * 0.25, true);
    }
    if (state.stageIndex === lastStage) player.feeding = Math.min(1, player.feeding + 0.5 + 3 * (b.mass / p.mass));
    if (state.time - chainT <= cfg.absorb.chainWindow) chainN++; else chainN = 1;
    chainT = state.time;
    const nlen = Math.hypot(-dx, -dz) || 1;
    emit('absorb', {
      bodyId: b.id, cls: b.cls, mass: b.mass, gained, ratio, relSpeed, p: pos3(b), dir: [-dx / nlen, 0, -dz / nlen],
      chain: chainN, tde: state.stageId === 'black_hole' && b.cls === 'star',
    });
    if (state.stageIndex === lastStage && b.mass > p.mass * 0.05) hitStop = Math.max(hitStop, 0.04);
    // visual pull-in; the body is removed when absorbT reaches 1
    b.state = 'absorbing'; b.absorbT = 0; b._a0x = b.p[0] - p.p[0]; b._a0z = b.p[2] - p.p[2];
    b.disrupt = null; if (b._dsr) { endDisruption(b, false); }
    if (!b._dyn) universe.consume(b.id);
    demote(b);
    promoteChildren(b);
    if (b.entry) { emit('atmosphere-exit', { bodyId: b.id, hostId: b.entry.hostId }); b.entry = null; }
  }

  function die(cause, killer) {
    if (!playerAlive) return;
    playerAlive = false;
    deathKind = cause;
    deathTimer = cfg.death.delay;
    state.deathCause = cause;
    const flags = state.flags;
    if (cause === 'collision') { flags.death = 'stellar-fragment'; flags.died = true; }
    if (cause === 'captured') { flags.death = 'event-horizon'; flags.eventHorizon = true; }
    player.v[0] *= 0.2; player.v[2] *= 0.2;
    hitStop = 0.08;
    emit('death', { cause, killerId: killer ? killer.id : null, killerCls: killer ? killer.cls : null, p: pos3(player) });
  }

  function hurt(b, nx, nz, ratio, relSpeed) {
    const flags = state.flags;
    state.stats.hits++;
    hitTimer = 0;
    hitStop = cfg.hitStop;
    const armor = flags.armor > 0 ? clamp(flags.armor, 0, 0.9) : 0;
    const resist = clamp(flags.damageResist || 0, 0, 0.75);
    const lethal = ratio >= cfg.ratio.lethal && !(flags.armor > 0);
    const damage = (0.35 + 0.12 * Math.min(ratio - cfg.ratio.dominate, 4)) * (1 - armor) * (1 - resist);
    state.health -= damage;
    invuln = cfg.player.invulnTime; player.invuln = true;
    const dead = lethal || state.health <= 0;
    emit('hit', {
      bodyId: b.id, cls: b.cls, damage, strength: clamp(ratio / cfg.ratio.lethal, 0, 1), relSpeed,
      p: [player.p[0] + nx * player.radius, 0, player.p[2] + nz * player.radius], normal: [-nx, 0, -nz],
      health: Math.max(0, state.health), lethal: dead,
    });
    if (dead) die('collision', b);
  }

  function contactBounce(b, nx, nz, d, rr, vnOut) {
    const p = player;
    const pm = p.mass; const bm = b.mass;
    const immovable = bm > pm * 500;
    if (!immovable && b.onRails && pm / (pm + bm) > 0.002) demote(b);
    const pw = immovable || b.onRails ? 1 : bm / (pm + bm);
    const bw = immovable || b.onRails ? 0 : pm / (pm + bm);
    const overlap = rr - d;
    p.p[0] -= nx * overlap * pw; p.p[2] -= nz * overlap * pw;
    b.p[0] += nx * overlap * bw; b.p[2] += nz * overlap * bw;
    const rvx = b.v[0] - p.v[0]; const rvz = b.v[2] - p.v[2];
    let vn = rvx * nx + rvz * nz;
    vnOut.v = -vn;
    if (bw === 0) {
      if (vn < 0) { p.v[0] += -(1 + cfg.collision.restitution) * vn * nx * -1; p.v[2] += -(1 + cfg.collision.restitution) * vn * nz * -1; }
      return;
    }
    if (vn < 0) {
      const j = (-(1 + cfg.collision.restitution) * vn) / (1 / pm + 1 / bm);
      p.v[0] -= (j / pm) * nx; p.v[2] -= (j / pm) * nz;
      b.v[0] += (j / bm) * nx; b.v[2] += (j / bm) * nz;
    }
    vn = (b.v[0] - p.v[0]) * nx + (b.v[2] - p.v[2]) * nz;
    const minSep = cfg.collision.minSeparation * p.radius;
    if (vn < minSep) {
      const dv = minSep - vn;
      p.v[0] -= nx * dv * pw; p.v[2] -= nz * dv * pw;
      b.v[0] += nx * dv * bw; b.v[2] += nz * dv * bw;
    }
  }
  const vnBox = { v: 0 };

  // =================================================================================================
  // Roche disruption
  // =================================================================================================
  function startDisruption(b, primary) {
    if (b.state !== 'alive' || disrupting >= cfg.roche.maxConcurrent) return;
    const r = cfg.roche;
    const ratio = primary.mass / b.mass;
    const n = Math.round(lerp(r.fragmentsMin, r.fragmentsMax, clamp(Math.log10(ratio / r.minRatio) / 1.2, 0, 1)));
    b.state = 'disrupting';
    b.disrupt = { progress: 0, axis: [0, 0, 0], stretch: 1 };
    b._dsr = { n, shed: 0, m0: b.mass, T: r.duration * (1 + 0.3 * Math.log10(ratio)), primary, player: primary === player };
    disrupting++;
    demote(b);
    if (primary === player) state.stats.disruptions++;
    emit('roche-disruption', { phase: 'start', bodyId: b.id, cls: b.cls, mass: b.mass, victim: 'prey', p: pos3(b), fragments: n });
  }

  function endDisruption(b, remove) {
    if (!b._dsr) return;
    disrupting--;
    emit('roche-disruption', { phase: 'end', bodyId: b.id, cls: b.cls, mass: b._dsr.m0, victim: 'prey', p: pos3(b), fragments: b._dsr.shed });
    b._dsr = null;
    if (remove) killBody(b, true);
  }

  function updateDisruptions(sdt) {
    const r = cfg.roche;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.state !== 'disrupting' || !b._dsr || b._dead) continue;
      const D = b._dsr;
      const pr = D.primary;
      const dx = pr.p[0] - b.p[0]; const dz = pr.p[2] - b.p[2];
      const d = Math.hypot(dx, dz) || 1;
      const ax = dx / d; const az = dz / d;
      b.disrupt.axis[0] = ax; b.disrupt.axis[2] = az;
      b.disrupt.progress = Math.min(1, b.disrupt.progress + sdt / D.T);
      b.disrupt.stretch = 1 + 2.5 * b.disrupt.progress;
      const want = Math.floor(b.disrupt.progress * D.n + 1e-9);
      const tid = Math.sqrt((2 * pr._mu) / (d * d * d));
      while (D.shed < want) {
        D.shed++;
        const fm = (D.m0 * r.shedFraction) / D.n;
        const s = (dynRng() - 0.5) * 2 * b.radius * b.disrupt.stretch;
        tmpA[0] = b.p[0] + ax * s; tmpA[1] = b.p[1]; tmpA[2] = b.p[2] + az * s;
        const px = -az; const pz = ax;
        const sv = (dynRng() - 0.5) * 0.4 * b.radius;
        tmpV[0] = b.v[0] + ax * s * tid + px * sv; tmpV[1] = 0; tmpV[2] = b.v[2] + az * s * tid + pz * sv;
        addDynamic('fragment', fm, tmpA, tmpV);
      }
      setMass(cfg, b, D.m0 * (1 - b.disrupt.progress * r.shedFraction));
      if (b.disrupt.progress >= 1) endDisruption(b, true);
    }
  }

  // =================================================================================================
  // Atmosphere (rule R6)
  // =================================================================================================
  const atmoHosts = [];
  function atmosphereFor(b, sdt) {
    let host = null; let rho = 0;
    for (let k = 0; k < atmoHosts.length; k++) {
      const h = atmoHosts[k];
      if (h === b) continue;
      const H = h.atmosphere.shellHeight;
      const dx = b.p[0] - h.p[0]; if (dx > h.radius + H || dx < -h.radius - H) continue;
      const dz = b.p[2] - h.p[2];
      const alt = Math.hypot(dx, dz) - h.radius;
      if (alt < H) { host = h; rho = h.atmosphere.density * Math.exp((-2.5 * Math.max(alt, 0)) / H); break; }
    }
    b._atmHost = host; b._atmRho = rho;
    if (!ENTRY_CLASSES.has(b.cls)) {
      if (b.entry) { emit('atmosphere-exit', { bodyId: b.id, hostId: b.entry.hostId }); b.entry = null; }
      return;
    }
    let on = false; let intensity = 0; let relSpeed = 0;
    if (host && rho > 0.02) {
      const rvx = b.v[0] - host.v[0]; const rvz = b.v[2] - host.v[2];
      relSpeed = Math.hypot(rvx, rvz);
      const vesc = escapeSpeed(host._mu, host.radius);
      const f = relSpeed / vesc;
      if (f > cfg.entryMinSpeed) { on = true; intensity = clamp((f - cfg.entryMinSpeed) / (1 - cfg.entryMinSpeed + 0.3), 0, 1) * Math.min(1, rho * 1.5); }
    }
    if (on) {
      if (b.entry && b.entry.hostId !== host.id) { emit('atmosphere-exit', { bodyId: b.id, hostId: b.entry.hostId }); b.entry = null; }
      if (!b.entry) {
        b.entry = b._entryObj; b.entry.hostId = host.id; b.entry.intensity = intensity;
        emit('atmosphere-entry', { bodyId: b.id, hostId: host.id, intensity, relSpeed, p: pos3(b) });
      } else b.entry.intensity = intensity;
      if (b !== player && b.mass > 1e-4) setMass(cfg, b, b.mass * (1 - cfg.entry.ablation * intensity * sdt));
    } else if (b.entry) {
      emit('atmosphere-exit', { bodyId: b.id, hostId: b.entry.hostId });
      b.entry = null;
    }
  }

  function applyDrag(b, sdt) {
    const h = b._atmHost;
    if (!h || b._atmRho <= 0) return;
    const rvx = b.v[0] - h.v[0]; const rvz = b.v[2] - h.v[2];
    const sp = Math.hypot(rvx, rvz);
    const k = Math.min(0.5, (0.5 * b._atmRho * sp * sdt) / b.radius);
    b.v[0] -= rvx * k; b.v[2] -= rvz * k;
  }

  // =================================================================================================
  // Player step: gravity wells, capture, thrust, brake
  // =================================================================================================
  let domWell = null; let domMag = 0; let domD = 0;
  function playerForces() {
    const p = player; const S = p.radius; const pm = p.mass;
    let ax = 0; let az = 0; let cx = 0; let cz = 0; // regular gravity and capture pull
    domWell = null; domMag = 0; domD = 0;
    let capW = null; let capRatio = 0;
    tidalHost = null; let tidalDepth = 0;
    const cap = cfg.capture;
    for (let i = 0; i < wells.length; i++) {
      const w = wells[i];
      if (w._dead || w.state === 'absorbing') continue;
      if (w.mass < pm * G.minRatio) continue;
      const dx = w.p[0] - p.p[0]; const dz = w.p[2] - p.p[2];
      const d = Math.hypot(dx, dz);
      if (w.cls === 'blackHole' && w.mass >= cap.massRatio * pm && w.mass <= cap.maxRatio * pm) {
        const rc = Math.max(cap.radiusK * w.radius, cap.radiusS * p.radius); const reach = Math.max(cap.loadK * w.radius, cap.reachK * rc);
        if (d < reach) {
          const dd = Math.max(d, 0.5 * w.radius);
          let a = cap.pull * thrustAccelNow * (rc / dd) * (rc / dd);
          if (d > rc) a *= 1 - smoothstep(rc, reach, d);
          const inv = 1 / (d || 1);
          cx += dx * inv * a; cz += dz * inv * a;
          const r = a / thrustAccelNow;
          if (r > capRatio) { capRatio = r; capW = w; }
          if (a > domMag) { domMag = a; domWell = w; domD = d; }
        }
      } else {
        tmp2[0] = 0; tmp2[1] = 0;
        const mag = softenedAccel(G, w._mu, w.radius, w.p[0], w.p[2], p.p[0], p.p[2], tmp2);
        if (mag > 0) {
          ax += tmp2[0]; az += tmp2[1];
          if (mag > domMag) { domMag = mag; domWell = w; domD = d; }
        }
      }
      if (w.cls !== 'blackHole' && w.mass >= cfg.roche.minRatio * pm) {
        const zone = rocheDistance(cfg.roche, w.radius, w.cls, p.cls) + 0.5 * p.radius;
        if (d < zone && (!tidalHost || d < tidalDepth)) { tidalHost = w; tidalDepth = d; }
      }
    }
    // ordinary wells can bend your path but never overpower your thrust (only the capture mechanic is inescapable)
    const gm = Math.hypot(ax, az); const gmax = G.playerMaxPull * thrustAccelNow;
    if (gm > gmax) { ax *= gmax / gm; az *= gmax / gm; if (domMag > gmax) domMag = gmax; }
    ax += cx; az += cz;
    // void drift: a gentle tide toward matter
    if (inVoid && hud.region.nearestMatter) {
      const br = hud.region.nearestMatter.bearing;
      ax += Math.sin(br) * cfg.void.drift * S; az += -Math.cos(br) * cfg.void.drift * S;
    }
    // atmosphere
    return { ax, az, capW, capRatio };
  }

  function stepPlayer(sdt) {
    const p = player; const S = p.radius; const flags = state.flags;
    const pc = cfg.player;
    const t = stageT(state.stageIndex);
    const speedMult = flags.speedMult > 0 ? flags.speedMult : 1;
    thrustAccelNow = lerp(pc.accelEarly, pc.accelLate, t) * S * speedMult;
    let ix = 0; let iz = 0; let stab = false;
    if (state.status === 'playing' && playerAlive) {
      ix = input.x; iz = input.z; stab = !!input.stabilize;
      const m = Math.hypot(ix, iz);
      if (m > 1) { ix /= m; iz /= m; }
    }
    const inMag = Math.hypot(ix, iz);
    const g = playerForces();
    let tx = ix * thrustAccelNow; let tz = iz * thrustAccelNow;
    const vcap = pc.maxSpeed * S * speedMult;
    // reference frame for the stabiliser: the dominant well when one is pulling noticeably
    let rvx = p.v[0]; let rvz = p.v[2];
    let hvx = 0; let hvz = 0;
    if (domWell && domMag > 0.02 * thrustAccelNow) { hvx = domWell.v[0]; hvz = domWell.v[2]; }
    rvx -= hvx; rvz -= hvz;
    const sp = Math.hypot(rvx, rvz);
    if (sp >= vcap && sp > 0 && tx * rvx + tz * rvz > 0) { // at the cap: thrust cannot add speed
      const k = (tx * rvx + tz * rvz) / (sp * sp);
      tx -= rvx * k; tz -= rvz * k;
    }
    p.v[0] += (tx + g.ax) * sdt; p.v[2] += (tz + g.az) * sdt;
    // lateral stabiliser (labelled assist): while thrusting, sideways velocity is damped so the craft follows the stick
    // instead of orbiting its target forever; speed along the thrust direction (inertia) is untouched
    if (inMag >= 0.05 && !(orbitHost && pc.orbitLock)) {
      const lat = lerp(pc.lateralEarly, pc.lateralLate, t);
      const kx = ix / inMag; const kz = iz / inMag;
      const rx = p.v[0] - hvx; const rz = p.v[2] - hvz;
      const along = rx * kx + rz * kz;
      const f = 1 - Math.exp(-lat * sdt);
      p.v[0] -= (rx - along * kx) * f; p.v[2] -= (rz - along * kz) * f;
    }
    // stabiliser (labelled assist): brake relative to the dominant well when there is no input, strongly on Space
    let kb = 0;
    if (inMag < 0.05) kb = lerp(pc.brakeEarly, pc.brakeLate, t);
    if (orbitHost && pc.orbitLock) kb = 0;
    if (stab) kb = Math.max(kb, pc.stabilize);
    if (kb > 0) {
      const f = Math.exp(-kb * sdt);
      p.v[0] = hvx + (p.v[0] - hvx) * f; p.v[2] = hvz + (p.v[2] - hvz) * f;
    }
    // gravity-lock: while the pull is deadly (capture) the assist does not help you escape
    p.thrust[0] = ix; p.thrust[1] = iz;
    // atmosphere drag
    applyDrag(p, sdt);
    p.p[0] += p.v[0] * sdt; p.p[2] += p.v[2] * sdt;
    // gravity work for slingshot accounting
    if (domWell) {
      if (assistHost !== domWell) { finishAssist(); assistHost = domWell; assistW = 0; }
      // work of the dominant well's pull
      const dx = domWell.p[0] - p.p[0]; const dz = domWell.p[2] - p.p[2];
      const d = Math.hypot(dx, dz) || 1;
      assistW += ((dx / d) * p.v[0] + (dz / d) * p.v[2]) * domMag * sdt;
    } else finishAssist();
    // capture bookkeeping
    updateCapture(g.capW, g.capRatio, sdt);
    updateTidal(sdt);
    updateOrbit(sdt);
  }

  function finishAssist() {
    if (!assistHost) return;
    const sp = Math.hypot(player.v[0], player.v[2]);
    const gain = assistW / Math.max(sp, 1e-6);
    if (gain > cfg.slingshot.minGain * player.radius && Math.hypot(assistHost.v[0], assistHost.v[2]) > 1e-6) {
      emit('slingshot', { hostId: assistHost.id, speedGain: gain, p: pos3(player) });
    }
    assistHost = null; assistW = 0;
  }

  function updateCapture(capW, capRatio, sdt) {
    const cap = cfg.capture;
    const target = capW ? clamp((capRatio - cap.target0) / 1.0, 0, 1) : 0;
    const prev = captureLevel;
    if (target > captureLevel) captureLevel = Math.min(target, captureLevel + cap.rise * sdt);
    else captureLevel = Math.max(target, captureLevel - cap.fall * sdt);
    if (capW) captureHost = capW;
    if (captureHost) {
      if (captureLevel > 0.08) captureActive = true;
      for (let i = 0; i < cap.warnAt.length; i++) {
        const th = cap.warnAt[i];
        if (prev < th && captureLevel >= th - 1e-9 && th > captureWarned) {
          captureWarned = th;
          emit('capture-warning', { bodyId: captureHost.id, level: th, p: pos3(captureHost) });
        }
      }
      if (captureLevel < 0.03 && captureActive) {
        emit('capture-clear', { bodyId: captureHost.id });
        captureActive = false; captureWarned = 0; captureHost = null;
      }
    }
    if (captureLevel >= 1 && playerAlive && state.status === 'playing') die('captured', captureHost);
    if (captureActive && captureHost) { captureObj.level = captureLevel; captureObj.hostId = captureHost.id; hud.capture = captureObj; } else hud.capture = null;
  }

  function updateTidal(sdt) {
    if (tidalHost && playerAlive && state.status === 'playing') {
      if (!tidalActive) {
        tidalActive = true; tidalShed = 0;
        player.disrupt = { progress: 0, axis: [0, 0, 0], stretch: 1 };
        emit('roche-disruption', { phase: 'start', bodyId: tidalHost.id, cls: tidalHost.cls, mass: tidalHost.mass, victim: 'player', p: pos3(player), fragments: 0 });
      }
      const dx = tidalHost.p[0] - player.p[0]; const dz = tidalHost.p[2] - player.p[2];
      const d = Math.hypot(dx, dz) || 1;
      const dr = player.disrupt;
      dr.axis[0] = dx / d; dr.axis[2] = dz / d;
      dr.progress = Math.min(1, dr.progress + 0.5 * sdt); dr.stretch = 1 + 1.5 * dr.progress;
      const resist = clamp(state.flags.damageResist || 0, 0, 0.75);
      hitTimer = 0;
      // damage ramps from a quarter at the edge of the limit to full at contact
      const contact = tidalHost.radius + player.radius;
      const zone = rocheDistance(cfg.roche, tidalHost.radius, tidalHost.cls, player.cls) + 0.5 * player.radius;
      const depth = clamp(1 - (d - contact) / Math.max(zone - contact, 1e-9), 0, 1);
      state.health -= cfg.roche.playerDps * (0.25 + 0.75 * depth) * sdt * (1 - resist);
      tidalShed += sdt;
      if (tidalShed > 0.3) {
        tidalShed = 0; tmpA[0] = player.p[0]; tmpA[1] = 0; tmpA[2] = player.p[2];
        tmpV[0] = player.v[0] + (dx / d) * player.radius; tmpV[1] = 0; tmpV[2] = player.v[2] + (dz / d) * player.radius;
        addDynamic('fragment', player.mass * 1e-4, tmpA, tmpV);
      }
      if (state.health <= 0) die('collision', tidalHost);
    } else if (tidalActive) {
      tidalActive = false;
      emit('roche-disruption', { phase: 'end', bodyId: tidalHost ? tidalHost.id : 0, cls: tidalHost ? tidalHost.cls : 'star', mass: 0, victim: 'player', p: pos3(player), fragments: 0 });
      player.disrupt = null;
    }
  }

  function updateOrbit(sdt) {
    const w = domWell;
    let cand = null; let info = null;
    if (w && playerAlive && !(w.cls === 'blackHole' && captureLevel > 0.3)) {
      const rvx = player.v[0] - w.v[0]; const rvz = player.v[2] - w.v[2];
      const dx = player.p[0] - w.p[0]; const dz = player.p[2] - w.p[2];
      const d = Math.hypot(dx, dz);
      const E = specificEnergy(w._mu, w.radius, G.soften, d, rvx * rvx + rvz * rvz);
      if (E < 0 && d < cfg.orbit.soiK * w.radius) {
        const h = Math.abs(dx * rvz - dz * rvx);
        const a = -w._mu / (2 * E);
        const e = Math.sqrt(Math.max(0, 1 + (2 * E * h * h) / (w._mu * w._mu)));
        if (a * (1 - e) > w.radius * 1.05) {
          cand = w; info = { period: TAU * Math.sqrt((a * a * a) / w._mu), altitude: d - w.radius };
        }
      }
    }
    if (cand) {
      orbitLostTimer = 0;
      if (orbitHost === cand) { orbitObj.period = info.period; orbitObj.altitude = info.altitude; }
      else {
        if (orbitHost) { emit('orbit-lost', { hostId: orbitHost.id }); orbitHost = null; orbitTimer = 0; hud.orbit = null; }
        orbitTimer += sdt;
        if (orbitTimer >= cfg.orbit.acquire) {
          orbitHost = cand;
          orbitObj.hostId = cand.id; orbitObj.hostCls = cand.cls; orbitObj.period = info.period; orbitObj.altitude = info.altitude;
          hud.orbit = orbitObj;
          emit('orbit-acquired', { hostId: cand.id, hostCls: cand.cls, period: info.period, p: pos3(player) });
        }
      }
    } else {
      orbitTimer = 0;
      if (orbitHost) {
        orbitLostTimer += sdt;
        if (orbitLostTimer >= cfg.orbit.lose) { emit('orbit-lost', { hostId: orbitHost.id }); orbitHost = null; hud.orbit = null; orbitLostTimer = 0; }
      }
    }
  }

  // =================================================================================================
  // Free bodies
  // =================================================================================================
  function chaseChance() {
    const c = cfg.chase;
    if (!c.enabled || state.stageIndex < c.minStage) return 0;
    const t = clamp((state.stageIndex - c.minStage) / Math.max(1, lastStage - c.minStage), 0, 1);
    return lerp(c.chanceStart, c.chanceEnd, t);
  }

  function stepFree(sdt) {
    const pm = player.mass; const S = player.radius;
    const c = cfg.chase;
    const canChase = c.enabled && playerAlive && state.status === 'playing' && state.stageIndex >= c.minStage;
    const chance = canChase ? chaseChance() : 0;
    const chaseSpeed = lerp(c.speed, c.speedLate, stageT(state.stageIndex)) * S;
    const detect = c.detectionRadius * S;
    const playerMu = G.surfaceRate * G.surfaceRate * S * S * S;
    const n = bodies.length;
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (b._dead || b.onRails || b.state === 'absorbing') continue;
      let ax = 0; let az = 0;
      let dom = null; let domA = 0;
      const bm = b.mass;
      const bx = b.p[0]; const bz = b.p[2];
      for (let k = 0; k < wells.length; k++) {
        const w = wells[k];
        const rg = w._range;
        const dx = w.p[0] - bx; if (dx > rg || dx < -rg) continue;
        const dz = w.p[2] - bz; if (dz > rg || dz < -rg) continue;
        if (w === b || w._dead || w.state === 'absorbing' || w.mass < bm * 1.5) continue;
        const d2 = dx * dx + dz * dz;
        if (d2 > rg * rg) continue;
        const eps = G.soften * w.radius;
        const q = d2 + eps * eps;
        let kk = w._mu / (q * Math.sqrt(q));
        if (d2 > 0.49 * rg * rg) kk *= 1 - smoothstep(0.7 * rg, rg, Math.sqrt(d2));
        const mag = Math.sqrt(d2) * kk;
        ax += dx * kk; az += dz * kk;
        if (mag > domA) { domA = mag; dom = w; }
      }
      // the player is a gravity source too: it drags smaller free bodies toward it (finite reach, softened)
      if (playerAlive && G.playerPull > 0 && pm >= bm * G.minRatio) {
        tmp2[0] = 0; tmp2[1] = 0;
        softenedAccel(G, playerMu * G.playerPull, S, player.p[0], player.p[2], bx, bz, tmp2);
        ax += tmp2[0]; az += tmp2[1];
        const back = (bm / pm) * sdt; // Newton's third law: the player feels the (tiny) reaction
        player.v[0] -= tmp2[0] * back; player.v[2] -= tmp2[1] * back;
      }
      if (b.cls === 'fragment' && dom) { // fragments lose angular momentum to the surrounding material and spiral in
        const dxw = b.p[0] - dom.p[0]; const dzw = b.p[2] - dom.p[2];
        const dd = Math.hypot(dxw, dzw) || 1;
        const kk = 0.8 * Math.min(1, (3 * dom.radius) / dd) ** 2;
        ax -= (b.v[0] - dom.v[0]) * kk; az -= (b.v[2] - dom.v[2]) * kk;
      }
      // chase AI (force based: bounded acceleration toward a desired velocity)
      if (canChase && b.rel === 'threat' && bm >= pm * c.massRatioCutoff && b.cls !== 'debris' && b.cls !== 'fragment' && b.state === 'alive') {
        if (b._chaser < 0) b._chaser = hash32(b.id, 0xc4a5e) / U32 < chance ? 1 : 0;
        if (b._chaser === 1) {
          const dx = player.p[0] - b.p[0]; const dz = player.p[2] - b.p[2];
          const d = Math.hypot(dx, dz);
          if (d < detect) { b._chasing = true; b._giveUp = 0; } else if (b._chasing && (b._giveUp += sdt) > c.giveUpDelay) b._chasing = false;
          if (b._chasing) {
            const tx = dx + player.v[0] * c.lead; const tz = dz + player.v[2] * c.lead;
            const tl = Math.hypot(tx, tz) || 1;
            const speed = chaseSpeed / (1 + c.heavyDrag * (b.radius / S));
            const wx = (tx / tl) * speed - b.v[0]; const wz = (tz / tl) * speed - b.v[2];
            const wl = Math.hypot(wx, wz);
            const lim = c.accel * S * sdt;
            const kk = wl > lim ? lim / wl : 1;
            b.v[0] += wx * kk; b.v[2] += wz * kk;
          }
        } else b._chasing = false;
      } else b._chasing = false;
      b.v[0] += ax * sdt; b.v[2] += az * sdt;
      applyDrag(b, sdt);
      b.p[0] += b.v[0] * sdt; b.p[2] += b.v[2] * sdt;
    }
  }

  function updateRails() {
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b._dead || !b.onRails || b._static || b.state === 'absorbing') continue;
      if (!b._parent || b._parent._dead) { demote(b); continue; }
      railUpdate(b);
    }
  }

  // =================================================================================================
  // Player interactions + HUD + near-miss
  // =================================================================================================
  function interactPlayer(sdt) {
    const p = player; const pr = p.radius; const pm = p.mass;
    const flags = state.flags;
    const playing = state.status === 'playing' && playerAlive;
    const range = flags.absorbRange > 0 ? flags.absorbRange : 1;
    const pullR = pr * (cfg.absorb.pullBase + cfg.absorb.pullPerStage * state.stageIndex) * range;
    let bestT = Infinity; let bestP = Infinity; let tB = null; let pB = null;
    let proxStar = 0; let proxBH = 0; let proxPulsar = 0;
    let nMark = 0; let markWorst = -1;
    const mk = markerPool;
    const keys = interactKeys;
    const n = bodies.length;
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (b._dead || b.state === 'absorbing') continue;
      b.rel = classify(cfg.ratio, pm, b.mass, b.rel);
      const dx = b.p[0] - p.p[0]; const dz = b.p[2] - p.p[2];
      const d = Math.hypot(dx, dz);
      const rr = pr + b.radius;
      const rel = b.rel;
      // hud: nearest, markers, proximity
      const small = b.cls === 'debris' || b.cls === 'fragment' || b.radius < 0.08 * pr;
      if (!small) {
        const gap = d - rr;
        if (rel === 'threat' && gap < bestT) { bestT = gap; tB = b; }
        else if (rel === 'prey' && gap < bestP) { bestP = gap; pB = b; }
        const key = d * (rel === 'neutral' ? 3 : 1) / (b.radius + 0.5 * pr);
        if (nMark < 12) { keys[nMark] = key; markIdx[nMark] = b; nMark++; }
        else {
          let wi = 0; let wv = keys[0];
          for (let q = 1; q < 12; q++) if (keys[q] > wv) { wv = keys[q]; wi = q; }
          if (key < wv) { keys[wi] = key; markIdx[wi] = b; }
        }
      }
      if (b.cls === 'star') proxStar = Math.max(proxStar, clamp(1 - (d - b.radius) / (6 * b.radius), 0, 1));
      else if (b.cls === 'blackHole') proxBH = Math.max(proxBH, clamp(1 - (d - b.radius) / (cfg.capture.loadK * b.radius), 0, 1));
      else if (b.cls === 'neutronStar') {
        proxPulsar = Math.max(proxPulsar, clamp(1 - (d - b.radius) / (12 * b.radius), 0, 1));
        if (b.beam && playerAlive) pulsarCheck(b, dx, dz, d);
      }
      if (!playing) continue;
      if (b.state !== 'alive' && b.state !== 'disrupting') continue;

      // prey: gravity scoop, contact absorb, Roche disruption
      if (rel === 'prey') {
        const reach = rr + pullR;
        if (d < reach && d > 1e-6) {
          const f = (1 - d / reach) * cfg.absorb.pullAccel * pr * sdt;
          if (b.onRails) demote(b);
          b.v[0] -= (dx / d) * f; b.v[2] -= (dz / d) * f;
        }
        if (d < pr + b.radius * cfg.absorb.contact + pr * (range - 1) * 0.5) {
          playerAbsorb(b, Math.hypot(b.v[0] - p.v[0], b.v[2] - p.v[2]));
          continue;
        }
        if (b.state === 'alive') {
          const ratio = pm / b.mass;
          if (ratio >= cfg.roche.minRatio && ratio <= cfg.roche.maxRatio && d < rocheDistance(cfg.roche, pr, p.cls, b.cls) + 0.5 * b.radius) startDisruption(b, p);
        }
        continue;
      }
      // neutral / threat contact
      if (d < rr && playerAlive) {
        let ddx = dx; let ddz = dz; let dd = d;
        if (dd < 1e-6) { ddx = 1; ddz = 0; dd = 1e-6; }
        const nx = ddx / dd; const nz = ddz / dd;
        const relSpeed = Math.hypot(b.v[0] - p.v[0], b.v[2] - p.v[2]);
        if (rel === 'threat' && invuln <= 0 && dd < rr * cfg.collision.grace) {
          hurt(b, nx, nz, b.mass / pm, relSpeed);
          if (!playerAlive) return;
        }
        contactBounce(b, nx, nz, dd, rr, vnBox);
        b._nmMin = 0;
        if (!b._touch) { b._touch = true; emit('bounce', { bodyId: b.id, relSpeed: vnBox.v, p: [p.p[0] + nx * pr, 0, p.p[2] + nz * pr], normal: [-nx, 0, -nz] }); }
      } else b._touch = false;
      // near miss
      const thr = cfg.nearMiss.factor * rr;
      if (d < thr) {
        if (!b._nmIn) { b._nmIn = true; b._nmMin = d; b._nmSpeed = Math.hypot(b.v[0] - p.v[0], b.v[2] - p.v[2]); }
        else if (d < b._nmMin) { b._nmMin = d; b._nmSpeed = Math.hypot(b.v[0] - p.v[0], b.v[2] - p.v[2]); }
      } else if (b._nmIn && d > thr * 1.15) {
        b._nmIn = false;
        if (b._nmMin > rr && state.time - b._nmLast >= cfg.nearMiss.minGap) {
          b._nmLast = state.time; state.stats.nearMisses++;
          emit('near-miss', { bodyId: b.id, cls: b.cls, rel, gap: b._nmMin - rr, relSpeed: b._nmSpeed, p: pos3(b) });
        }
      }
    }
    // hud nearest
    hud.nearestThreat = null; hud.nearestPrey = null;
    if (tB) { fillNearest(ntObj, tB); hud.nearestThreat = ntObj; }
    if (pB) { fillNearest(npObj, pB); hud.nearestPrey = npObj; }
    // markers sorted by key
    for (let a = 1; a < nMark; a++) { const kv = keys[a]; const bv = markIdx[a]; let j = a - 1; while (j >= 0 && keys[j] > kv) { keys[j + 1] = keys[j]; markIdx[j + 1] = markIdx[j]; j--; } keys[j + 1] = kv; markIdx[j + 1] = bv; }
    hud.markers.length = nMark;
    for (let q = 0; q < nMark; q++) {
      const b = markIdx[q]; const m = mk[q];
      m.id = b.id; m.rel = b.rel; m.cls = b.cls;
      const dx = b.p[0] - p.p[0]; const dz = b.p[2] - p.p[2];
      m.bearing = Math.atan2(dx, -dz); m.dist = Math.hypot(dx, dz);
      m.p[0] = b.p[0]; m.p[1] = b.p[1]; m.p[2] = b.p[2];
      hud.markers[q] = m;
    }
    hud.proximity.star = proxStar; hud.proximity.blackHole = proxBH; hud.proximity.pulsar = proxPulsar;
    hud.beaconAudio.pulsar = proxPulsar;
  }
  const interactKeys = new Float64Array(12);
  const markIdx = new Array(12).fill(null);

  function fillNearest(o, b) {
    const dx = b.p[0] - player.p[0]; const dz = b.p[2] - player.p[2];
    const d = Math.hypot(dx, dz);
    o.id = b.id; o.cls = b.cls; o.bearing = Math.atan2(dx, -dz); o.dist = d; o.gap = d - player.radius - b.radius; o.ratio = b.mass / player.mass;
  }

  function pulsarCheck(b, dx, dz, d) {
    const reach = cfg.pulsar.range * b.radius;
    // bearing from the star to the player against the beam axis (two opposite beams)
    const f = Math.sin(Math.atan2(-dz, -dx) - b.beam.phase);
    const crossed = (f > 0) !== (b._pf > 0) && Math.abs(f) < 0.5 && Math.abs(b._pf) < 0.5;
    b._pf = f;
    if (crossed && d < reach && worldTime - b._lastBeam >= cfg.pulsar.minInterval) {
      b._lastBeam = worldTime;
      emit('pulsar-beam', { bodyId: b.id, p: pos3(b), intensity: clamp(1 - d / reach, 0, 1) });
    }
  }

  // =================================================================================================
  // Body-body collisions (sweep and prune on x)
  // =================================================================================================
  const pairBuf = [];
  function bodyCollisions(sdt) {
    // maintain the sorted list
    let w = 0;
    for (let i = 0; i < sweep.length; i++) { const b = sweep[i]; if (!b._dead && b.state === 'alive') sweep[w++] = b; else b._sw = false; }
    sweep.length = w;
    for (let i = 0; i < bodies.length; i++) { const b = bodies[i]; if (!b._sw && !b._dead && b.state === 'alive') { b._sw = true; sweep.push(b); } }
    for (let i = 1; i < sweep.length; i++) {
      const a = sweep[i]; const key = a.p[0] - a.radius; let j = i - 1;
      while (j >= 0 && sweep[j].p[0] - sweep[j].radius > key) { sweep[j + 1] = sweep[j]; j--; }
      sweep[j + 1] = a;
    }
    pairBuf.length = 0;
    const n = sweep.length;
    for (let i = 0; i < n; i++) {
      const a = sweep[i]; const amax = a.p[0] + a.radius;
      for (let j = i + 1; j < n; j++) {
        const b = sweep[j];
        if (b.p[0] - b.radius > amax) break;
        if (a.onRails && b.onRails) continue;
        const dx = b.p[0] - a.p[0]; const dz = b.p[2] - a.p[2]; const rr = a.radius + b.radius;
        if (dx * dx + dz * dz < rr * rr) pairBuf.push(a, b);
      }
    }
    for (let i = 0; i < pairBuf.length; i += 2) {
      const a = pairBuf[i]; const b = pairBuf[i + 1];
      if (a._dead || b._dead || a.state !== 'alive' || b.state !== 'alive') continue;
      resolvePair(a, b);
    }
    void sdt;
  }

  function resolvePair(a, b) {
    const big = a.mass >= b.mass ? a : b; const small = big === a ? b : a;
    const ratio = big.mass / small.mass;
    const dx = small.p[0] - big.p[0]; const dz = small.p[2] - big.p[2];
    let d = Math.hypot(dx, dz); let nx = 1; let nz = 0;
    if (d > 1e-9) { nx = dx / d; nz = dz / d; } else d = 1e-9;
    const rvx = small.v[0] - big.v[0]; const rvz = small.v[2] - big.v[2];
    const relSpeed = Math.hypot(rvx, rvz);
    const vesc = escapeSpeed(big._mu + small._mu, big.radius + small.radius);
    const mred = (big.mass * small.mass) / (big.mass + small.mass);
    const ebind = 0.6 * G.surfaceRate * G.surfaceRate * big.radius * big.radius * big.mass;
    const energy = clamp((0.5 * mred * relSpeed * relSpeed) / ebind, 0, 1);
    const cp = [big.p[0] + nx * big.radius, 0, big.p[2] + nz * big.radius];
    const nearPlayer = Math.hypot(cp[0] - player.p[0], cp[2] - player.p[2]) < cfg.view.radiusS * player.radius * 0.5;
    const soft = big.cls === 'star' || big.cls === 'neutronStar' || big.cls === 'blackHole' || big.cls === 'gasGiant' || big.cls === 'brownDwarf';
    const stamp = worldTime;

    if (ratio >= cfg.mergeRatio) {
      let keep = absorbEfficiency(cfg.absorb, relSpeed, vesc);
      if (soft) keep = 1;
      const g = small.mass * keep; const shed = small.mass - g;
      if (small.mass > big.mass * 0.01 && big.onRails) demote(big);
      big.v[0] = mergeVelocity(big.mass, big.v[0], g, small.v[0]);
      big.v[2] = mergeVelocity(big.mass, big.v[2], g, small.v[2]);
      const lz = (small.p[0] - big.p[0]) * rvz - (small.p[2] - big.p[2]) * rvx;
      big.spin.rate = clamp(big.spin.rate + (lz * g) / (big.mass * big.radius * big.radius + 1e-9), -6, 6);
      setMass(cfg, big, big.mass + g);
      let ejecta = 0;
      if (!soft && shed > 0) ejecta = spawnDebris('debris', shed * cfg.absorb.debrisFraction, Math.min(cfg.impact.maxEjecta, 1 + Math.floor(energy * cfg.impact.maxEjecta)), cp, small.v[0], small.v[2], relSpeed * 0.3, true);
      big._flash = Math.max(big._flash, 0.4 + 0.6 * energy);
      if (big.cls === 'blackHole') big.feeding = Math.min(1, big.feeding + 0.6);
      killBody(small, true);
      if (small.entry) small.entry = null;
      emit('impact', { a: big.id, b: small.id, p: cp, normal: [nx, 0, nz], energy, relSpeed, ejecta, nearPlayer });
      return;
    }
    // comparable masses
    if (a.onRails) demote(a); if (b.onRails) demote(b);
    if (energy >= cfg.impact.shatterEnergy) {
      let ejecta = 0;
      for (const body of [a, b]) {
        const n = Math.min(cfg.impact.maxEjecta, 4 + Math.floor(energy * 6));
        ejecta += spawnDebris('fragment', body.mass * 0.8, n, pos3(body), body.v[0], body.v[2], relSpeed * 0.4, true);
        killBody(body, true);
      }
      emit('impact', { a: a.id, b: b.id, p: cp, normal: [nx, 0, nz], energy, relSpeed, ejecta, nearPlayer });
      return;
    }
    // inelastic bounce
    const overlap = a.radius + b.radius - d;
    const wa = b.mass / (a.mass + b.mass); const wb = 1 - wa;
    const sx = (b.p[0] - a.p[0]) / d; const sz = (b.p[2] - a.p[2]) / d;
    a.p[0] -= sx * overlap * wa; a.p[2] -= sz * overlap * wa; b.p[0] += sx * overlap * wb; b.p[2] += sz * overlap * wb;
    const rv = (b.v[0] - a.v[0]) * sx + (b.v[2] - a.v[2]) * sz;
    if (rv < 0) {
      const j = (-(1 + cfg.collision.restitution) * rv) / (1 / a.mass + 1 / b.mass);
      a.v[0] -= (j / a.mass) * sx; a.v[2] -= (j / a.mass) * sz; b.v[0] += (j / b.mass) * sx; b.v[2] += (j / b.mass) * sz;
      if (stamp - a._lastImpact > 0.4 && stamp - b._lastImpact > 0.4) {
        a._lastImpact = b._lastImpact = stamp;
        a._flash = Math.max(a._flash, 0.3 + 0.7 * energy); b._flash = Math.max(b._flash, 0.3 + 0.7 * energy);
        let ejecta = 0;
        if (energy > 0.05) ejecta = spawnDebris('debris', small.mass * 0.05 * energy, 1 + Math.floor(energy * 4), cp, big.v[0], big.v[2], relSpeed * 0.3, true);
        emit('impact', { a: a.id, b: b.id, p: cp, normal: [nx, 0, nz], energy, relSpeed: -rv, ejecta, nearPlayer });
      }
    }
  }

  // =================================================================================================
  // Region, trajectory
  // =================================================================================================
  function updateRegion(sdt) {
    regionTimer -= sdt;
    if (regionTimer > 0) return;
    regionTimer = 0.125;
    tmpA[0] = state.originAbs[0] + player.p[0]; tmpA[1] = 0; tmpA[2] = state.originAbs[2] + player.p[2];
    const Lp = levels.levelOfMass(player.mass);
    const r = universe.getRegion(tmpA, Lp);
    const thr = cfg.universe.voidDensity;
    const prev = inVoid;
    if (!inVoid && r.density < thr) inVoid = true;
    else if (inVoid && r.density > thr * cfg.void.hysteresis) inVoid = false;
    const reg = hud.region;
    reg.density = r.density; reg.inVoid = inVoid;
    if (inVoid) {
      const nmv = r.nearestMatter || { dist: 0, bearing: 0 };
      nmObj.dist = nmv.dist; nmObj.bearing = nmv.bearing; reg.nearestMatter = nmObj;
    } else reg.nearestMatter = null;
    state.sky.density = r.density;
    if (inVoid !== prev && state.status === 'playing') {
      emit('region-change', { inVoid, density: r.density });
      beaconTimer = 0;
    }
  }

  function updateBeacon(sdt) {
    if (!inVoid || state.status !== 'playing') { beaconTimer = 0; return; }
    beaconTimer -= sdt;
    if (beaconTimer <= 0) {
      beaconTimer = cfg.void.ping;
      const nm = hud.region.nearestMatter;
      if (nm) emit('beacon-ping', { dist: nm.dist, bearing: nm.bearing });
    }
  }

  function updateTrajectory() {
    if (!options.trajectory) { hud.trajectory = null; return; }
    const T = cfg.trajectory; const N = T.points;
    if (!trajBuf || trajBuf.length !== N * 3) trajBuf = new Float32Array(N * 3);
    let x = player.p[0]; let z = player.p[2]; let vx = player.v[0]; let vz = player.v[2];
    const o = [0, 0];
    for (let i = 0; i < N; i++) {
      trajBuf[i * 3] = x; trajBuf[i * 3 + 1] = 0; trajBuf[i * 3 + 2] = z;
      o[0] = 0; o[1] = 0;
      for (let k = 0; k < wells.length; k++) {
        const w = wells[k];
        if (w._dead || w.mass < player.mass * G.minRatio || (w.cls === 'blackHole' && w.mass >= cfg.capture.massRatio * player.mass)) continue;
        softenedAccel(G, w._mu, w.radius, w.p[0] + w.v[0] * i * T.step, w.p[2] + w.v[2] * i * T.step, x, z, o);
      }
      vx += o[0] * T.step; vz += o[1] * T.step;
      x += vx * T.step; z += vz * T.step;
    }
    hud.trajectory = trajBuf;
  }
  let trajBuf = null;

  // =================================================================================================
  // Rebase
  // =================================================================================================
  function rebase(sx, sz) {
    emit('rebase', { shift: [sx, 0, sz] });
    state.originAbs[0] += sx; state.originAbs[2] += sz;
    for (let i = 0; i < bodies.length; i++) { const b = bodies[i]; b.p[0] -= sx; b.p[2] -= sz; }
    player.p[0] -= sx; player.p[2] -= sz;
    for (const r of farRecs.values()) { r.p[0] -= sx; r.p[2] -= sz; }
    if (keyHost && keyHost._isFar && farRecs.get(keyHost.id) !== keyHost) { keyHost.p[0] -= sx; keyHost.p[2] -= sz; }
    for (let i = 0; i < far.count; i++) { far.p[i * 3] -= sx; far.p[i * 3 + 2] -= sz; }
  }

  // =================================================================================================
  // Stage progression, choices, endings
  // =================================================================================================
  function evolve(newIndex) {
    const from = stages[state.stageIndex];
    state.stageIndex = newIndex; state.stageId = stages[newIndex].id;
    stageStartElapsed = state.stats.elapsed;
    refreshPlayerLook();
    emit('evolve', { fromId: from.id, toId: stages[newIndex].id, fromIndex: newIndex - 1, toIndex: newIndex, mass: player.mass });
    if (newIndex === lastStage) finaleT = 0;
    let choices = null;
    try { choices = getChoicesFor(newIndex); } catch (e) { choices = null; }
    if (choices && choices.length) {
      setStatus('choice');
      emit('choice-open', { stageIndex: newIndex, choices });
    }
  }

  function refreshPlayerLook() {
    playerLook(cfg, player, stageIdForPlayer(), state.flags, seedH);
  }
  function stageIdForPlayer() { return stages[state.stageIndex].id; }

  function pickChoice(id) {
    if (state.status !== 'choice') return;
    const before = state.mass;
    const stageIndex = state.stageIndex;
    try { applyChoice(state, id); } catch (e) { return; }
    if (state.mass !== before && Number.isFinite(state.mass) && state.mass > 0) { player.mass = state.mass; growPlayer(); }
    refreshPlayerLook();
    emit('choice-picked', { stageIndex, choiceId: id });
    setStatus('playing');
  }

  function finish(kind) {
    state.flags.ending = kind;
    let ending = null;
    try { ending = getEnding(state); } catch (e) { ending = null; }
    if (!ending || !ending.title) ending = FALLBACK_ENDINGS[kind];
    setStatus('ended');
    emit('ending', { kind, ending });
  }

  // =================================================================================================
  // Step
  // =================================================================================================
  function compact() {
    let w = 0;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b._dead) { loaded.delete(b.id); if (b._dyn && !b._gone) dynCount--; continue; }
      bodies[w++] = b;
    }
    bodies.length = w;
  }

  function step(dt) {
    if (state.status === 'paused') return;
    stepCount++;
    // floating origin first, so every event of this step uses the new frame
    const lim = Math.max(cfg.rebaseDistance, cfg.rebaseRadii * player.radius);
    if (Math.hypot(player.p[0], player.p[2]) > lim) rebase(player.p[0], player.p[2]);

    let scale = 1;
    const st = state.status;
    if (st === 'playing') { scale = playerAlive ? 1 : cfg.death.slowmo; if (hitStop > 0) { hitStop -= dt; scale = 0.05; } }
    else if (st === 'choice') scale = 0.15;
    else if (st === 'ended') scale = 0.3;
    const sdt = dt * scale;
    state.time += dt; worldTime += sdt;
    const playing = st === 'playing';

    if (loaderEnabled && (stepCount % cfg.view.tickSteps === 0)) loaderTick(false);

    // atmosphere pass (entry + drag state)
    atmoHosts.length = 0;
    for (let i = 0; i < bodies.length; i++) { const b = bodies[i]; if (b.atmosphere && !b._dead && b.state === 'alive') atmoHosts.push(b); }
    for (let i = 0; i < bodies.length; i++) { const b = bodies[i]; if (!b._dead && !b.onRails && b.state === 'alive') atmosphereFor(b, sdt); }
    atmosphereFor(player, sdt);

    stepPlayer(sdt);
    stepFree(sdt);
    updateRails();
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b.state === 'absorbing') {
        b.absorbT += sdt / 0.28;
        const k = 1 - Math.min(1, b.absorbT); const e = k * k;
        b.p[0] = player.p[0] + b._a0x * e; b.p[2] = player.p[2] + b._a0z * e;
        b.v[0] = player.v[0]; b.v[2] = player.v[2];
        if (b.absorbT >= 1) b._dead = true;
      }
      if (b._dyn) { b._age += sdt; if (b._age > b._ttl) b._dead = true; }
      if (!b._dead) stepVisuals(b, sdt, worldTime, cfg);
    }
    updateDisruptions(sdt);
    bodyCollisions(sdt);
    interactPlayer(sdt);

    // player vitals
    if (playerAlive) {
      if (playing) {
        invuln = Math.max(0, invuln - sdt);
        if (player.invuln && invuln <= 0) { player.invuln = false; emit('invuln-end', {}); }
        hitTimer += sdt;
        if (hitTimer > cfg.player.regenDelay) state.health = Math.min(cfg.player.maxHealth, state.health + cfg.player.regenRate * sdt);
        state.stats.elapsed += sdt;
      }
      if (state.health < 0.3 && !healthLowFired) { healthLowFired = true; emit('health-low', { health: Math.max(0, state.health) }); }
      else if (state.health >= 0.3) healthLowFired = false;
    }
    stepVisuals(player, sdt, worldTime, cfg);
    player.health = clamp(state.health, 0, 1);
    state.stats.maxMass = Math.max(state.stats.maxMass, player.mass);

    if (playing && playerAlive) {
      if (state.stageIndex < lastStage) {
        const idx = stageIndexOf(player.mass);
        if (idx > state.stageIndex) evolve(state.stageIndex + 1);
      }
      if (state.status === 'playing' && state.stageIndex === lastStage) {
        finaleT += sdt;
        const finalMin = Math.max(cfg.startMass, Number(stages[lastStage].minMass) || 0);
        if (player.mass >= finalMin * cfg.finale.massFactor || finaleT > cfg.finale.maxTime) { state.flags.finale = true; finish('finale'); }
      }
    } else if (playing && !playerAlive) {
      deathTimer -= dt;
      if (deathTimer <= 0 && state.status === 'playing') finish(deathKind === 'captured' ? 'eventHorizon' : 'death');
    }

    updateRegion(sdt);
    updateBeacon(sdt);
    updateKey();
    compact();
    // hud scalars
    state.health = Math.min(state.health, cfg.player.maxHealth);
    state.mass = player.mass;
    updateProgress();
    const S = player.radius;
    const speed = Math.hypot(player.v[0], player.v[2]);
    hud.speed = speed; hud.speedMax = cfg.player.maxSpeed * S * (state.flags.speedMult > 0 ? state.flags.speedMult : 1);
    hud.thrust = clamp(Math.hypot(player.thrust[0], player.thrust[1]), 0, 1);
    if (domWell) {
      hud.gravityDepth = clamp(domMag / (1.5 * thrustAccelNow), 0, 1);
      hud.escapeSpeed = hud.gravityDepth > 0.01 ? escapeSpeed(domWell._mu, Math.max(domD, domWell.radius * 0.5)) : null;
    } else { hud.gravityDepth = 0; hud.escapeSpeed = null; }
    hud.inAtmosphere = player._atmRho > 0.01; hud.atmosphereDensity = player._atmRho;
    if (options.trajectory && --trajTimer <= 0) { trajTimer = cfg.trajectory.every; updateTrajectory(); } else if (!options.trajectory) hud.trajectory = null;
  }

  // =================================================================================================
  // Lifecycle
  // =================================================================================================
  function resetRun(newSeed, dev) {
    if (newSeed != null) { seedStr = String(newSeed); seedH = hashString(seedStr); }
    universe = createUniverse(seedStr, cfg);
    state.seed = seedStr;
    bodies.length = 0; loaded.clear(); wells.length = 0; farRecs.clear(); sweep.length = 0; farList = []; far.count = 0;
    dynRng = makeRng(hash32(seedH, 0xd7a)); dynId = 0; dynCount = 0; disrupting = 0;
    const g = hash32(seedH, 0x91c);
    keyGlowDir = [Math.cos(g * 1e-9 * TAU) * 0.8, 0.45, Math.sin(g * 1e-9 * TAU) * 0.8];
    const ln = Math.hypot(...keyGlowDir); keyGlowDir = keyGlowDir.map((v) => v / ln);
    state.flags = {
      speedMult: 1, damageResist: 0, absorbBonus: 0, choices: {}, choiceCount: 0, abandonCount: 0, abandonOnly: true,
      trajectory: null, planetType: null, gasType: null, starType: null, supergiantPerk: null,
    };
    delete state.deathCause;
    state.stats = { absorbed: 0, hits: 0, elapsed: 0, maxMass: cfg.startMass, nearMisses: 0, disruptions: 0 };
    state.time = 0; worldTime = 0; stepCount = 0; stageStartElapsed = 0;
    state.health = cfg.player.maxHealth;
    player.mass = cfg.startMass;
    state.stageIndex = stageIndexOf(player.mass); state.stageId = stages[state.stageIndex].id;
    player.p = [0, 0, 0]; player.v = [0, 0, 0]; player.thrust = [0, 0]; player.entry = null; player.disrupt = null;
    player.feeding = 0; player._flash = 0; player._hot = 0; player.spin = { axis: [0.1, 0.99, 0.05], rate: 0.4, phase: 0 };
    player.state = 'alive'; player.absorbT = 0; player.invuln = false; player.rel = 'self'; player._dead = false;
    growPlayer();
    refreshPlayerLook();
    updateEmissive(player);   // no step runs before the next frame: drop the previous run's glow now
    if (dev) applyDevStart(dev);
    playerAlive = true; hitStop = 0; hitTimer = 0; invuln = 0; deathTimer = 0; deathKind = null; finaleT = 0; healthLowFired = false;
    chainT = -99; chainN = 0;
    orbitHost = null; orbitTimer = 0; orbitLostTimer = 0; assistHost = null; assistW = 0;
    captureLevel = 0; captureHost = null; captureWarned = 0; captureActive = false;
    tidalHost = null; tidalActive = false; inVoid = false; regionTimer = 0; beaconTimer = 0;
    domWell = null; domMag = 0;
    hud.capture = null; hud.orbit = null; hud.region.inVoid = false; hud.region.nearestMatter = null; hud.nearestThreat = null; hud.nearestPrey = null;
    hud.markers.length = 0;
    // start somewhere calm and dense
    const Lp = levels.levelOfMass(player.mass);
    const s = universe.findStart(Lp, 12 * player.radius);
    state.originAbs = [s[0], 0, s[2]];
    state.sky.level = Lp;
    if (loaderEnabled) loaderTick(true);
    updateRegion(1); regionTimer = 0;
    updateKey();
    updateProgress();
    compact();
    for (let i = 0; i < bodies.length; i++) { bodies[i].rel = classify(cfg.ratio, player.mass, bodies[i].mass, 'neutral'); }
  }

  resetRun(null);

  // Dev start: walk the normal progression (mass at each stage's threshold -> evolve() -> pickChoice()) so the
  // player's mass, size, look, flags and stage state are exactly what a played run would hold. `forms` are choice
  // ids (stages.js); a stage with a menu and no matching id is abandoned. Silent: the caller emits run-start.
  function applyDevStart({ stageIndex, forms }) {
    const prev = state.status;
    quiet = true;
    try {
      for (let i = 1; i <= stageIndex; i++) {
        player.mass = Number(stages[i].minMass) || player.mass; growPlayer();
        state.stats.maxMass = player.mass;
        evolve(i);
        if (state.status === 'choice') {
          const offered = getChoicesFor(i) || [];
          const pick = (forms || []).find((id) => offered.some((c) => c.id === id));
          pickChoice(pick || offered[offered.length - 1].id);   // the last offer is always Abandon evolution
        }
      }
    } finally { quiet = false; }
    updateEmissive(player);
    state.status = prev;
  }

  function resolveDevSpec(spec) {
    if (!spec) return null;
    const s = spec.stage;
    const idx = typeof s === 'number' ? s : stages.findIndex((st) => st.id === s);
    if (!Number.isInteger(idx) || idx < 0 || idx > lastStage) return null;
    return { stageIndex: idx, forms: Array.isArray(spec.forms) ? spec.forms : spec.forms ? [spec.forms] : [] };
  }

  function start() {
    if (state.status === 'title') {
      setStatus('playing');
      emit('run-start', { seed: seedStr, genVersion: GEN_VERSION, stageId: state.stageId });
    }
  }

  function restart(seed, dev) {
    const prev = state.status;
    resetRun(seed != null ? seed : null, dev);
    state.status = 'playing';
    if (prev !== 'playing') emit('status', { status: 'playing', prev });
    emit('run-start', { seed: seedStr, genVersion: GEN_VERSION, stageId: state.stageId });
  }

  /** Developer start: begin a fresh run already at `spec.stage` (stage id or index) with `spec.forms` chosen. False if the stage is unknown. */
  function startAt(spec) {
    const dev = resolveDevSpec(spec);
    if (!dev) return false;
    restart(spec.seed != null ? spec.seed : null, dev);
    return true;
  }

  /** Abandon the run and return to the title state: a full reset (same seed), nothing started. */
  function quitToTitle() {
    const prev = state.status;
    resetRun(null);
    input = { x: 0, z: 0, stabilize: false }; pausedFrom = null;
    state.status = 'title';
    if (prev !== 'title') emit('status', { status: 'title', prev });
  }

  function setPaused(p) {
    if (p && state.status !== 'paused') { pausedFrom = state.status; setStatus('paused'); }
    else if (!p && state.status === 'paused') setStatus(pausedFrom || 'playing');
  }
  let pausedFrom = null;

  function exportSave() {
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (b._desc && !b._dead && !b.onRails && (b._desc.orbit || b._desc.hasSystem)) {
        universe.setKnocked(b.id, { p: [state.originAbs[0] + b.p[0], 0, state.originAbs[2] + b.p[2]], v: [b.v[0], b.v[2]] });
      }
    }
    return {
      seed: seedStr, genVersion: GEN_VERSION, deltas: universe.exportDeltas(),
      run: {
        time: state.time, worldTime, mass: player.mass, stageIndex: state.stageIndex, health: state.health,
        flags: JSON.parse(JSON.stringify(state.flags)), stats: { ...state.stats }, status: state.status === 'paused' ? 'playing' : state.status,
        originAbs: state.originAbs.slice(), p: [player.p[0], player.p[2]], v: [player.v[0], player.v[2]], finaleT,
      },
    };
  }

  function importSave(s) {
    if (!s || s.genVersion !== GEN_VERSION || typeof s.seed !== 'string' || !s.run) return false;
    resetRun(s.seed);
    universe.importDeltas(s.deltas);
    const r = s.run;
    state.flags = JSON.parse(JSON.stringify(r.flags));
    state.stats = { absorbed: 0, hits: 0, elapsed: 0, maxMass: r.mass, nearMisses: 0, disruptions: 0, ...r.stats };
    state.time = r.time; worldTime = r.worldTime || r.time; state.health = r.health; finaleT = r.finaleT || 0;
    stageStartElapsed = state.stats.elapsed;
    player.mass = r.mass; growPlayer();
    state.stageIndex = stageIndexOf(r.mass); state.stageId = stages[state.stageIndex].id;
    state.originAbs = r.originAbs.slice();
    player.p = [r.p[0], 0, r.p[1]]; player.v = [r.v[0], 0, r.v[1]];
    refreshPlayerLook();
    bodies.length = 0; loaded.clear(); farRecs.clear(); sweep.length = 0;
    if (loaderEnabled) loaderTick(true);
    updateProgress();
    state.status = r.status === 'ended' ? 'title' : r.status || 'playing';
    return true;
  }

  function teleport(absPos) {
    const sx = absPos[0] - (state.originAbs[0] + player.p[0]);
    const sz = absPos[2] - (state.originAbs[2] + player.p[2]);
    emit('rebase', { shift: [-sx, 0, -sz] });
    state.originAbs = [absPos[0], 0, absPos[2]];
    player.p[0] = 0; player.p[2] = 0;
    for (let i = 0; i < bodies.length; i++) { bodies[i]._dead = true; bodies[i]._gone = true; }
    bodies.length = 0; loaded.clear(); farRecs.clear(); sweep.length = 0; dynCount = 0; disrupting = 0;
    if (loaderEnabled) loaderTick(true);
    refreshWells();
  }

  // ---- debug helpers (tests and tuning) ---------------------------------------------------------------
  function spawnBody(props) {
    const mass = props.mass ?? 1;
    const b = blankBody(cfg);
    b.id = props.id ?? (DYN_BASE + 1e9 + (++dynId));
    b.cls = props.cls || 'meteorite';
    b.stageId = stageIdForMass(mass);
    b.variant = props.variant ?? null; b.seed = props.seed ?? hash32(b.id, 5);
    setMass(cfg, b, mass);
    b.p = [props.p?.[0] ?? 0, 0, props.p?.[2] ?? 0]; b.v = [props.v?.[0] ?? 0, 0, props.v?.[2] ?? 0];
    if (props.atmosphere) { b.atmosphere = { ...props.atmosphere }; b._atmK = props.atmosphere.shellHeight / b.radius; }
    if (props.temperatureK != null) b.temperatureK = props.temperatureK;
    if (props.beam) { b.beam = { ...props.beam }; b._beam0 = props.beam.phase; }
    b.onRails = !!props.static; b._static = !!props.static;
    b.rel = classify(cfg.ratio, player.mass, b.mass, 'neutral');
    b._chaser = props.chaser === true ? 1 : props.chaser === false ? 0 : -1;
    bodies.push(b); loaded.set(b.id, b);
    refreshWells();
    return b;
  }

  const debug = {
    CONFIG: cfg,
    get universe() { return universe; },
    teleport,
    spawnBody,
    clearBodies() { for (const b of bodies) { b._dead = true; b._gone = true; } bodies.length = 0; loaded.clear(); sweep.length = 0; wells.length = 0; farRecs.clear(); far.count = 0; keyHost = null; dynCount = 0; disrupting = 0; },
    setLoaderEnabled(v) { loaderEnabled = !!v; },
    loaderTick: () => loaderTick(true),
    setPlayer(props) {
      if (props.mass != null) {
        player.mass = props.mass; growPlayer();
        // `natural: true` leaves the stage alone so the next steps evolve through it with events and menus
        if (!props.natural) { state.stageIndex = stageIndexOf(player.mass); state.stageId = stages[state.stageIndex].id; refreshPlayerLook(); }
      }
      // vectors may be [x, z] (2 entries) or [x, y, z]
      if (props.p) { player.p[0] = props.p[0]; player.p[2] = props.p.length === 2 ? props.p[1] : props.p[2]; }
      if (props.v) { player.v[0] = props.v[0]; player.v[2] = props.v.length === 2 ? props.v[1] : props.v[2]; }
    },
    get wells() { return wells; },
    stats: () => ({ bodies: bodies.length, cells: universe.cacheSize(), far: far.count, dyn: dynCount, farRecs: farRecs.size }),
    get captureLevel() { return captureLevel; },
    stagesIn: stages,
  };

  /** A detached copy of the player's body as it would look after picking `id` (read-only; for choice previews). */
  function previewChoice(id) {
    const b = { ...player, id: -1, p: [0, 0, 0], v: [0, 0, 0], spin: { axis: player.spin.axis.slice(), rate: 0, phase: 0.6 },
      atmosphere: null, ring: null, beam: null, entry: null, emissive: null, _em: { cause: 'impact-flash', intensity: 0 }, _flash: 0, _hot: 0, feeding: 0, rel: 'self' };
    playerLook(cfg, b, stageIdForPlayer(), { ...state.flags, ...choiceFlags(state.stageIndex, id) }, seedH);
    updateEmissive(b);
    return b;
  }

  const sim = {
    events: bus,
    getState: () => state,
    step,
    setInput(i) { input = { x: Number(i.x) || 0, z: Number(i.z) || 0, stabilize: !!i.stabilize }; },
    start, restart, startAt, quitToTitle, pickChoice, previewChoice, setPaused,
    setOptions(o) { options = { ...options, ...o }; },
    exportSave, importSave,
    debug,
  };
  return sim;
}
