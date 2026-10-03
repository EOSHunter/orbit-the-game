// Static, valid State and one of every event (contract 4 / section 10 step S0). For UI, SND and ENG development.
// Pure and deterministic. Positions are origin-relative; the player sits at the origin.
import { STAGES, getStageIndex } from '../stages.js';
import { CLS_LIST, CLS_INDEX, clsForStageId, starClassForStageId, validateEmissive } from './classes.js';
import { hash32 } from './rng.js';
import { EVENT_TYPES } from './events.js';

const RU = 10;
const rad = (m) => RU * Math.sqrt(m);

function body(id, cls, mass, p, v, extra = {}) {
  const radius = rad(mass);
  return {
    id, cls, stageId: STAGES[getStageIndex(mass)].id, variant: null, seed: hash32(id, 11), rel: 'neutral', mass, radius,
    p: [p[0], 0, p[2]], v: [v[0], 0, v[2]], spin: { axis: [0, 1, 0], rate: 0.3, phase: 0 },
    temperatureK: null, atmosphere: null, ring: null, emissive: null, entry: null, feeding: 0, coma: 0, beam: null,
    parentId: null, onRails: false, state: 'alive', disrupt: null, absorbT: 0, ...extra,
  };
}

/** `stageId` is a stages.js id (default 'meteorite'). opts: { mass, seed, status, bodies: false } */
export function makeFixtureState(stageId = 'meteorite', opts = {}) {
  const stageIndex = Math.max(0, STAGES.findIndex((s) => s.id === stageId));
  const stage = STAGES[stageIndex];
  const mass = opts.mass ?? Math.max(1, Number(stage.minMass) || 1) * 1.1;
  const R = rad(mass);
  const cls = clsForStageId(stage.id);
  const player = body(0, cls, mass, [0, 0, 0], [R * 2, 0, -R], {
    rel: 'self', stageId: stage.id, starClass: starClassForStageId(stage.id) || undefined,
    variant: { rockyPlanet: 'terrestrial', gasGiant: 'ringed', star: 'yellow', neutronStar: 'pulsar', blackHole: 'stellar' }[cls] || null,
    temperatureK: cls === 'star' ? 5800 : cls === 'neutronStar' ? 600000 : null,
    atmosphere: cls === 'rockyPlanet' ? { density: 0.6, shellHeight: 0.16 * R } : cls === 'gasGiant' ? { density: 0.95, shellHeight: 0.33 * R } : null,
    ring: cls === 'gasGiant' ? { inner: 1.4, outer: 2.4, tilt: 0.2 } : null,
    emissive: cls === 'star' ? { cause: 'star', intensity: 0.9 } : cls === 'neutronStar' ? { cause: 'stellar-remnant', intensity: 0.7 } : cls === 'blackHole' ? { cause: 'accretion', intensity: 0.6 } : null,
    beam: cls === 'neutronStar' ? { phase: 0.5, period: 1.2, width: 0.15 } : null,
  });
  player.health = 0.8; player.invuln = false; player.thrust = [0.4, -0.2];

  const bodies = [];
  if (opts.bodies !== false) {
    const ring = [
      ['meteorite', 0.3, 'prey'], ['asteroid', 0.6, 'prey'], ['comet', 0.5, 'prey'], ['dwarfPlanet', 1.0, 'neutral'],
      ['rockyPlanet', 2.5, 'threat'], ['gasGiant', 6, 'threat'], ['brownDwarf', 12, 'threat'], ['star', 40, 'threat'],
      ['neutronStar', 90, 'threat'], ['blackHole', 220, 'threat'], ['debris', 0.02, 'prey'], ['fragment', 0.03, 'prey'],
    ];
    ring.forEach(([c, k, rel], i) => {
      const m = Math.max(0.01, mass * k * (rel === 'prey' ? 0.5 : 1));
      const a = (i / ring.length) * Math.PI * 2;
      const dist = R * (8 + 3 * i);
      const b = body(1000 + i, c, m, [Math.cos(a) * dist, 0, Math.sin(a) * dist], [Math.sin(a) * R * 0.3, 0, -Math.cos(a) * R * 0.3], { rel });
      b.stageId = STAGES[getStageIndex(m)].id;
      if (c === 'star') { b.starClass = 'main'; b.variant = 'yellow'; b.temperatureK = 5800; b.emissive = { cause: 'star', intensity: 0.9 }; }
      if (c === 'neutronStar') { b.beam = { phase: 1, period: 1.5, width: 0.15 }; b.emissive = { cause: 'stellar-remnant', intensity: 0.7 }; b.temperatureK = 600000; }
      if (c === 'blackHole') b.emissive = { cause: 'accretion', intensity: 0.6 };
      if (c === 'brownDwarf') { b.emissive = { cause: 'stellar-remnant', intensity: 0.12 }; b.temperatureK = 1200; }
      if (c === 'rockyPlanet') { b.variant = 'terrestrial'; b.atmosphere = { density: 0.6, shellHeight: 0.16 * b.radius }; }
      if (c === 'gasGiant') { b.variant = 'storm'; b.atmosphere = { density: 0.95, shellHeight: 0.33 * b.radius }; }
      if (c === 'comet') { b.coma = 0.6; b.variant = 'icy'; }
      bodies.push(b);
    });
  }
  const nT = bodies.find((b) => b.rel === 'threat'); const nP = bodies.find((b) => b.rel === 'prey');
  const near = (b) => (b ? { id: b.id, cls: b.cls, bearing: Math.atan2(b.p[0], -b.p[2]), dist: Math.hypot(b.p[0], b.p[2]), gap: Math.hypot(b.p[0], b.p[2]) - R - b.radius, ratio: b.mass / mass } : null);

  const far = {
    count: 3, p: new Float32Array(3 * 8), size: new Float32Array(8), cls: new Uint8Array(8), seed: new Uint32Array(8), temp: new Float32Array(8),
  };
  [[R * 400, 0, -R * 300, 'star', R * 60, 5800], [-R * 500, 0, R * 200, 'blackHole', R * 90, 0], [R * 100, 0, R * 700, 'neutronStar', R * 20, 600000]].forEach(([x, y, z, c, size, T], i) => {
    far.p.set([x, y, z], i * 3); far.size[i] = size; far.cls[i] = CLS_INDEX[c]; far.seed[i] = hash32(i, 77); far.temp[i] = T;
  });

  const markers = bodies.slice(0, 12).map((b) => ({ id: b.id, rel: b.rel, cls: b.cls, bearing: Math.atan2(b.p[0], -b.p[2]), dist: Math.hypot(b.p[0], b.p[2]), p: b.p.slice() }));
  const state = {
    status: opts.status || 'playing', time: 42, mass, stageIndex, stageId: stage.id,
    progress: 0.4, health: 0.8,
    flags: { speedMult: 1, damageResist: 0, absorbBonus: 0, choices: {}, choiceCount: 0, abandonCount: 0, abandonOnly: true, trajectory: null, planetType: null, gasType: null, starType: null, supergiantPerk: null },
    stats: { absorbed: 12, hits: 1, elapsed: 42, maxMass: mass, nearMisses: 2, disruptions: 0 },
    seed: opts.seed || 'VD-FIXTURE', genVersion: 1, originAbs: [1234.5, 0, -987.25],
    player, bodies, far,
    sky: { seed: hash32(7, 7), level: 3, density: 0.9 },
    key: { dir: [0.6, 0.4, -0.3].map((c) => c / Math.hypot(0.6, 0.4, 0.3)), temperatureK: 5800, intensity: 0.8, hostId: null },
    hud: {
      speed: Math.hypot(...player.v), speedMax: 14 * R, escapeSpeed: 3 * R, thrust: 0.45, gravityDepth: 0.2,
      proximity: { star: 0.1, blackHole: 0, pulsar: 0 }, inAtmosphere: false, atmosphereDensity: 0,
      nearestThreat: near(nT), nearestPrey: near(nP), markers,
      region: { inVoid: false, density: 0.9, nearestMatter: null },
      capture: null, orbit: null, trajectory: null, beaconAudio: { pulsar: 0 },
    },
  };
  return state;
}

/** One of every event type of contract section 3, with plausible payloads. */
export function makeFixtureEvents() {
  const p = [10, 0, -20];
  const n = [0, 0, 1];
  return [
    { type: 'run-start', payload: { seed: 'VD-FIXTURE', genVersion: 1, stageId: 'meteorite' } },
    { type: 'status', payload: { status: 'playing', prev: 'title' } },
    { type: 'rebase', payload: { shift: [5000, 0, -3000] } },
    { type: 'absorb', payload: { bodyId: 1001, cls: 'asteroid', mass: 0.6, gained: 0.24, ratio: 0.3, relSpeed: 12, p, dir: [1, 0, 0], chain: 2, tde: false } },
    { type: 'hit', payload: { bodyId: 1004, cls: 'rockyPlanet', damage: 0.35, strength: 0.5, relSpeed: 30, p, normal: n, health: 0.65, lethal: false } },
    { type: 'bounce', payload: { bodyId: 1003, relSpeed: 8, p, normal: n } },
    { type: 'impact', payload: { a: 1003, b: 1004, p, normal: n, energy: 0.4, relSpeed: 20, ejecta: 5, nearPlayer: true } },
    { type: 'roche-disruption', payload: { phase: 'start', bodyId: 1001, cls: 'asteroid', mass: 0.6, victim: 'prey', p, fragments: 12 } },
    { type: 'near-miss', payload: { bodyId: 1005, cls: 'gasGiant', rel: 'threat', gap: 4, relSpeed: 25, p } },
    { type: 'atmosphere-entry', payload: { bodyId: 0, hostId: 1005, intensity: 0.7, relSpeed: 40, p } },
    { type: 'atmosphere-exit', payload: { bodyId: 0, hostId: 1005 } },
    { type: 'orbit-acquired', payload: { hostId: 1005, hostCls: 'gasGiant', period: 24, p } },
    { type: 'orbit-lost', payload: { hostId: 1005 } },
    { type: 'slingshot', payload: { hostId: 1005, speedGain: 14, p } },
    { type: 'choice-open', payload: { stageIndex: 2, choices: [{ id: 'frozen_fortress', label: 'Frozen Fortress', description: '...' }] } },
    { type: 'choice-picked', payload: { stageIndex: 2, choiceId: 'frozen_fortress' } },
    { type: 'evolve', payload: { fromId: 'meteorite', toId: 'asteroid', fromIndex: 0, toIndex: 1, mass: 20 } },
    { type: 'health-low', payload: { health: 0.29 } },
    { type: 'invuln-end', payload: {} },
    { type: 'region-change', payload: { inVoid: true, density: 0.1 } },
    { type: 'beacon-ping', payload: { dist: 5000, bearing: 0.8 } },
    { type: 'capture-warning', payload: { bodyId: 1009, level: 0.5, p } },
    { type: 'capture-clear', payload: { bodyId: 1009 } },
    { type: 'pulsar-beam', payload: { bodyId: 1008, p, intensity: 0.6 } },
    { type: 'death', payload: { cause: 'collision', killerId: 1004, killerCls: 'rockyPlanet', p } },
    { type: 'ending', payload: { kind: 'death', ending: { id: 'stellar_fragment', title: 'Stellar Fragment', text: '...' } } },
  ].filter((e) => EVENT_TYPES.includes(e.type));
}

export { CLS_LIST, validateEmissive };
