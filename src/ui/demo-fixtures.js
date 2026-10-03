// Demo-only mocks for the UI: a bus with the §3 API, a State matching §2.3, and a tiny fake world that
// moves bodies around so the radar, target panel and edge markers have live data. Not used by the game.

export function createMockBus() {
  const map = new Map();
  const on = (type, fn) => {
    if (!map.has(type)) map.set(type, new Set());
    map.get(type).add(fn);
    return () => off(type, fn);
  };
  const off = (type, fn) => { const s = map.get(type); if (s) s.delete(fn); };
  const emit = (type, payload) => {
    for (const fn of map.get(type) || []) fn(payload);
    for (const fn of map.get('*') || []) fn(type, payload);
  };
  return { on, off, emit };
}

const STAGE_IDS = ['meteorite', 'asteroid', 'dwarf_planet', 'rocky_planet', 'gas_giant', 'gas_planet',
  'dwarf_star', 'star', 'giant_star', 'supergiant_star', 'neutron_star', 'black_hole'];
const MIN_MASS = [0, 20, 80, 300, 1000, 3200, 10000, 32000, 100000, 320000, 1000000, 3200000];
const CLS_BY_STAGE = ['meteorite', 'asteroid', 'dwarfPlanet', 'rockyPlanet', 'gasGiant', 'brownDwarf',
  'star', 'star', 'star', 'star', 'neutronStar', 'blackHole'];
export const stageIdOf = (i) => STAGE_IDS[i];
export const minMassOf = (i) => MIN_MASS[i];

export function makeMockState(stageIndex = 0) {
  const mass = MIN_MASS[stageIndex] + (MIN_MASS[stageIndex + 1] ? (MIN_MASS[stageIndex + 1] - MIN_MASS[stageIndex]) * 0.3 : 1e6);
  const player = {
    id: 1, cls: CLS_BY_STAGE[stageIndex], stageId: STAGE_IDS[stageIndex], variant: null, seed: 7, rel: 'self',
    mass, radius: 10 * Math.sqrt(mass), p: [0, 0, 0], v: [0, 0, 0], spin: { axis: [0, 1, 0], rate: 0.2, phase: 0 },
    temperatureK: null, atmosphere: null, ring: null, emissive: null, entry: null, feeding: 0, coma: 0, beam: null,
    parentId: null, onRails: false, state: 'alive', disrupt: null, absorbT: 0, health: 1, invuln: false, thrust: [0, 0],
  };
  return {
    status: 'title', time: 0, mass, stageIndex, stageId: STAGE_IDS[stageIndex], progress: 0.3, health: 1,
    flags: {}, stats: { absorbed: 0, hits: 0, elapsed: 0, maxMass: mass, nearMisses: 0, disruptions: 0 },
    seed: 'VD-7F3A-21C9', genVersion: 1, originAbs: [0, 0, 0], player, bodies: [],
    far: { count: 0, p: new Float32Array(0), size: new Float32Array(0), cls: new Uint8Array(0), seed: new Uint32Array(0), temp: new Float32Array(0) },
    sky: { seed: 1, level: 0, density: 0.5 }, key: { dir: [0.4, 0.6, -0.7], temperatureK: 5800, intensity: 1, hostId: null },
    hud: {
      speed: 0, speedMax: 400, escapeSpeed: 180, thrust: 0, gravityDepth: 0.2,
      proximity: { star: 0, blackHole: 0, pulsar: 0 }, inAtmosphere: false, atmosphereDensity: 0,
      nearestThreat: null, nearestPrey: null, markers: [],
      region: { inVoid: false, density: 0.6, nearestMatter: null },
      capture: null, orbit: null, trajectory: null, beaconAudio: { pulsar: 0 },
    },
  };
}

// Strip to the old 2D state shape (no hud, seed, player body): what the 2D build passes to update().
export function toLegacy(s) {
  return { status: s.status, time: s.time, mass: s.mass, stageIndex: s.stageIndex, progress: s.progress, health: s.health, flags: s.flags, stats: s.stats, deathCause: s.deathCause };
}

// A few bodies circling the player on the x-z plane. rel derives from mass ratio (1.2 band).
export function createMockWorld() {
  const bodies = [];
  const CLS = ['meteorite', 'asteroid', 'comet', 'dwarfPlanet', 'rockyPlanet', 'gasGiant', 'star', 'blackHole', 'debris'];
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 16; i++) {
    bodies.push({
      id: 100 + i, cls: CLS[(rnd() * CLS.length) | 0], ratio: [0.25, 0.5, 0.7, 1, 1.1, 1.6, 2.5, 6][i % 8],
      orbitR: 180 + rnd() * 1600, ang: rnd() * Math.PI * 2, w: (rnd() - 0.5) * 0.35, p: [0, 0, 0],
    });
  }
  let t = 0;
  function step(dt, state) {
    t += dt;
    const hud = state.hud;
    const markers = [];
    for (const b of bodies) {
      b.ang += b.w * dt;
      b.p[0] = Math.cos(b.ang) * b.orbitR;
      b.p[2] = Math.sin(b.ang) * b.orbitR * 0.8;
      const dist = Math.hypot(b.p[0], b.p[2]);
      const rel = b.ratio >= 1.2 ? 'threat' : b.ratio <= 1 / 1.2 ? 'prey' : 'neutral';
      markers.push({ id: b.id, rel, cls: b.cls, bearing: Math.atan2(b.p[0], -b.p[2]), dist, p: b.p, ratio: b.ratio });
    }
    markers.sort((a, b) => a.dist - b.dist);
    markers.length = Math.min(markers.length, 12);
    hud.markers = markers;
    const pick = (rel) => {
      const m = markers.find((x) => x.rel === rel);
      return m ? { id: m.id, cls: m.cls, bearing: m.bearing, dist: m.dist, gap: Math.max(0, m.dist - 60), ratio: m.ratio } : null;
    };
    hud.nearestThreat = pick('threat');
    hud.nearestPrey = pick('prey');
    hud.speed = 140 + Math.sin(t * 0.7) * 90;
    hud.thrust = Math.max(0, Math.sin(t * 1.3)) * 0.9;
    hud.gravityDepth = 0.35 + Math.sin(t * 0.25) * 0.3;
    hud.proximity.star = Math.max(0, Math.sin(t * 0.2));
    hud.proximity.blackHole = Math.max(0, Math.sin(t * 0.13 + 2)) * 0.7;
    hud.proximity.pulsar = Math.max(0, Math.sin(t * 0.31 + 4)) * 0.5;
    if (hud.region.inVoid) hud.region.nearestMatter = { dist: 4200 - (t % 30) * 40, bearing: 0.9 + Math.sin(t * 0.1) * 0.2 };
    return bodies;
  }
  // Fake renderer view: top-down, world (x, z) -> screen, player at centre.
  function makeView(w, h, scale) {
    return {
      width: w, height: h,
      project(p) { return { x: w / 2 + p[0] * scale, y: h / 2 + p[2] * scale, visible: true }; },
      unproject(sx, sy) { return [(sx - w / 2) / scale, 0, (sy - h / 2) / scale]; },
    };
  }
  return { bodies, step, makeView };
}

// One sample of every §3 event, for the "fire all" demo button.
export function makeMockEvents(state) {
  const p = [120, 0, -80];
  return [
    { type: 'run-start', payload: { seed: state.seed, genVersion: 1, stageId: state.stageId } },
    { type: 'status', payload: { status: 'playing', prev: 'title' } },
    { type: 'rebase', payload: { shift: [5000, 0, 0] } },
    { type: 'absorb', payload: { bodyId: 101, cls: 'asteroid', mass: 4, gained: 3.6, ratio: 0.2, relSpeed: 40, p, dir: [0, 0, 1], chain: 3, tde: false } },
    { type: 'hit', payload: { bodyId: 102, cls: 'rockyPlanet', damage: 0.2, strength: 0.6, relSpeed: 90, p, normal: [1, 0, 0], health: 0.62, lethal: false } },
    { type: 'bounce', payload: { bodyId: 103, relSpeed: 20, p, normal: [0, 0, 1] } },
    { type: 'impact', payload: { a: 104, b: 105, p, normal: [1, 0, 0], energy: 0.4, relSpeed: 60, ejecta: 12, nearPlayer: true } },
    { type: 'roche-disruption', payload: { phase: 'start', bodyId: 106, cls: 'dwarfPlanet', mass: 50, victim: 'prey', p, fragments: 9 } },
    { type: 'near-miss', payload: { bodyId: 107, cls: 'gasGiant', rel: 'threat', gap: 34, relSpeed: 200, p } },
    { type: 'atmosphere-entry', payload: { bodyId: 1, hostId: 108, intensity: 0.5, relSpeed: 300, p } },
    { type: 'atmosphere-exit', payload: { bodyId: 1, hostId: 108 } },
    { type: 'orbit-acquired', payload: { hostId: 109, hostCls: 'star', period: 42.5, p } },
    { type: 'orbit-lost', payload: { hostId: 109 } },
    { type: 'slingshot', payload: { hostId: 110, speedGain: 64, p } },
    { type: 'choice-open', payload: { stageIndex: 2, choices: [] } },
    { type: 'choice-picked', payload: { stageIndex: 2, choiceId: 'war_planet' } },
    { type: 'evolve', payload: { fromId: 'asteroid', toId: 'dwarf_planet', fromIndex: 1, toIndex: 2, mass: 80 } },
    { type: 'health-low', payload: { health: 0.28 } },
    { type: 'invuln-end', payload: {} },
    { type: 'region-change', payload: { inVoid: true, density: 0.05 } },
    { type: 'beacon-ping', payload: { dist: 4200, bearing: 0.9 } },
    { type: 'capture-warning', payload: { bodyId: 111, level: 0.5, p } },
    { type: 'capture-clear', payload: { bodyId: 111 } },
    { type: 'pulsar-beam', payload: { bodyId: 112, p, intensity: 0.7 } },
  ];
}
