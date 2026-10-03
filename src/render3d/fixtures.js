// ENG-local fixture states with the exact shape of contract 2.3, so the renderer runs with no SIM.
// (src/sim/fixtures.js is SIM's; this one exists so render3d never depends on it.)
import { CLS_DEFAULT } from './util.js';

export const STAGE_IDS = ['meteorite', 'asteroid', 'dwarf_planet', 'rocky_planet', 'gas_giant', 'gas_planet', 'dwarf_star', 'star', 'giant_star', 'supergiant_star', 'neutron_star', 'black_hole'];
const STAGE_CLS = { meteorite: 'meteorite', asteroid: 'asteroid', dwarf_planet: 'dwarfPlanet', rocky_planet: 'rockyPlanet', gas_giant: 'gasGiant', gas_planet: 'brownDwarf', dwarf_star: 'star', star: 'star', giant_star: 'star', supergiant_star: 'star', neutron_star: 'neutronStar', black_hole: 'blackHole' };
const STAR_CLASS = { dwarf_star: 'dwarf', star: 'main', giant_star: 'giant', supergiant_star: 'supergiant' };
const STAGE_MASS = [6, 40, 260, 1800, 12000, 50000, 2e5, 8e5, 3e6, 1e7, 3e7, 1e8];

let _id = 1;
const radiusOf = (m) => 10 * Math.sqrt(m);
const T_BY = { dwarf: 3600, main: 5800, giant: 4000, supergiant: 9500 };

function emissiveFor(cls, variant, extra = {}) {
  switch (cls) {
    case 'star': return { cause: 'star', intensity: 1 };
    case 'neutronStar': return { cause: 'stellar-remnant', intensity: 1 };
    case 'blackHole': return { cause: 'accretion', intensity: 1 };
    case 'brownDwarf': return { cause: 'stellar-remnant', intensity: 1 };
    case 'rockyPlanet': return variant === 'lava' ? { cause: 'hot-ground', intensity: 1 } : null;
    case 'fragment': return extra.hot ? { cause: 'hot-debris', intensity: 0.8 } : null;
    default: return null;
  }
}

/** Body factory. `r` is the radius in world units. */
export function makeBody(cls, o = {}) {
  const r = o.r || 20, mass = (r / 10) ** 2;
  const starClass = cls === 'star' ? (o.starClass || 'main') : undefined;
  const b = {
    id: o.id || _id++, cls, stageId: o.stageId || 'asteroid', starClass, variant: o.variant == null ? null : o.variant,
    seed: o.seed == null ? (Math.imul(_id, 2654435761) >>> 0) : o.seed, rel: o.rel || 'neutral',
    mass, radius: r, p: [o.x || 0, o.y || 0, o.z || 0], v: o.v || [0, 0, 0],
    spin: { axis: o.axis || [0.12, 1, 0.08], rate: o.spinRate == null ? 0.25 : o.spinRate, phase: 0 },
    temperatureK: cls === 'star' ? (o.T || T_BY[starClass]) : (cls === 'neutronStar' ? 28000 : null),
    atmosphere: o.atmosphere === undefined ? null : o.atmosphere,
    ring: o.ring || null,
    emissive: o.emissive === undefined ? emissiveFor(cls, o.variant, o) : o.emissive,
    entry: o.entry || null, feeding: o.feeding || 0, coma: o.coma || 0,
    beam: cls === 'neutronStar' ? { phase: 0, period: 1.2, width: 0.07 } : null,
    parentId: null, onRails: false, state: 'alive', disrupt: null, absorbT: 0,
  };
  return b;
}

const unit = (v) => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };

function gallery() {
  // one of each class + the variants worth seeing, laid out on a grid around the player
  const L = [];
  const row = (items, z, step) => items.forEach((it, i) => { it.p[0] = (i - (items.length - 1) / 2) * step; it.p[2] = z; L.push(it); });
  row([
    makeBody('meteorite', { r: 18, variant: 'iron', stageId: 'meteorite' }),
    makeBody('asteroid', { r: 40, stageId: 'asteroid' }),
    makeBody('asteroid', { r: 36, variant: 'rubble', stageId: 'asteroid' }),
    makeBody('comet', { r: 30, stageId: 'asteroid', coma: 0 }),
    makeBody('dwarfPlanet', { r: 70, variant: 'ice', stageId: 'dwarf_planet' }),
  ], -230, 150);
  row([
    makeBody('dwarfPlanet', { r: 70, stageId: 'dwarf_planet' }),
    makeBody('rockyPlanet', { r: 90, variant: 'terrestrial', stageId: 'rocky_planet', atmosphere: { density: 0.8, shellHeight: 0.07 } }),
    makeBody('rockyPlanet', { r: 80, variant: 'lava', stageId: 'rocky_planet' }),
    makeBody('rockyPlanet', { r: 80, variant: 'metallic', stageId: 'rocky_planet' }),
  ], -20, 220);
  row([
    makeBody('gasGiant', { r: 130, variant: 'ringed', stageId: 'gas_giant', ring: { inner: 1.35, outer: 2.2, tilt: 0.35 }, atmosphere: { density: 0.3, shellHeight: 0.04 } }),
    makeBody('gasGiant', { r: 100, variant: 'ice', stageId: 'gas_giant' }),
    makeBody('brownDwarf', { r: 120, stageId: 'gas_planet' }),
  ], 260, 320);
  return L;
}

export function makeFixtureState(stageId = 'asteroid', opts = {}) {
  _id = 1;
  const gal = stageId === 'gallery';
  const ent = stageId === 'entry';       // meteorite plunging into a terrestrial planet's atmosphere
  const sid = gal ? 'asteroid' : ent ? 'meteorite' : stageId;
  const idx = Math.max(0, STAGE_IDS.indexOf(sid));
  const cls = STAGE_CLS[sid] || 'asteroid';
  const mass = STAGE_MASS[idx];
  const pr = radiusOf(mass);
  const player = makeBody(cls, { id: 0, r: pr, stageId: sid, rel: 'self', starClass: STAR_CLASS[sid], variant: opts.playerVariant || (cls === 'rockyPlanet' ? 'terrestrial' : null), seed: 12345, x: 0, z: 0,
    atmosphere: cls === 'rockyPlanet' ? { density: 0.8, shellHeight: 0.07 } : null, v: [0, 0, 0] });
  player.health = 1; player.invuln = false; player.thrust = [0, 0];
  if (cls === 'blackHole') { player.emissive = { cause: 'accretion', intensity: 1 }; }

  const bodies = [];
  if (ent) {
    const host = makeBody('rockyPlanet', { id: 99, r: pr * 6, x: pr * 2, z: -pr * 14, stageId: 'rocky_planet', variant: 'terrestrial', rel: 'neutral', atmosphere: { density: 0.9, shellHeight: 0.08 } });
    bodies.push(host);
    player.v = [0, 0, -40]; player.p = [0, 0, -pr * 5]; player.entry = { hostId: 99, intensity: 0.85 };
    player.emissive = { cause: 'ablation', intensity: 0.8 };
    bodies.push(makeBody('fragment', { r: 6, x: pr * 3, z: -pr * 6, stageId: 'meteorite', emissive: { cause: 'hot-debris', intensity: 0.6 } }));
  } else if (gal) {
    bodies.push(...gallery());
    // neutron star, star and black hole at distance, large enough to read
    bodies.push(makeBody('star', { r: 150, x: -620, z: -330, stageId: 'star', starClass: 'main', T: 5800, rel: 'threat' }));
    bodies.push(makeBody('star', { r: 190, x: 700, z: -380, stageId: 'giant_star', starClass: 'giant', T: 3800, rel: 'threat' }));
    bodies.push(makeBody('neutronStar', { r: 22, x: -640, z: 200, stageId: 'neutron_star', rel: 'threat' }));
    bodies.push(makeBody('blackHole', { r: 60, x: 700, z: 150, stageId: 'black_hole', rel: 'threat', feeding: 0.6 }));
    bodies.push(makeBody('fragment', { r: 10, x: 40, z: 60, stageId: 'meteorite', emissive: { cause: 'hot-debris', intensity: 0.9 } }));
  } else {
    // neighbours: prey (smaller), neutral, threat (bigger), spread around the player in player radii
    const rng = (() => { let a = 99 + idx; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; })();
    const small = ['meteorite', 'asteroid', 'asteroid', 'debris', 'fragment'];
    for (let i = 0; i < 34; i++) {
      const ang = rng() * 6.283, d = pr * (2.4 + rng() * 9);
      const sc = 0.18 + rng() * 0.6;
      let c = cls === 'meteorite' || cls === 'asteroid' ? small[Math.floor(rng() * small.length)] : (rng() < 0.5 ? 'asteroid' : 'dwarfPlanet');
      const b = makeBody(c, { r: Math.max(2, pr * sc * (c === 'dwarfPlanet' ? 1.1 : 0.6)), x: Math.cos(ang) * d, z: Math.sin(ang) * d, stageId: c === 'meteorite' ? 'meteorite' : c === 'dwarfPlanet' ? 'dwarf_planet' : 'asteroid', rel: sc < 0.45 ? 'prey' : 'neutral', seed: Math.floor(rng() * 4e9), spinRate: 0.1 + rng() * 0.6, variant: c === 'asteroid' && rng() < 0.2 ? 'iron' : null });
      bodies.push(b);
    }
    const threatCls = idx < 3 ? 'asteroid' : (idx < 6 ? 'gasGiant' : (idx < 10 ? 'star' : 'blackHole'));
    bodies.push(makeBody(threatCls, { r: pr * 2.4, x: pr * 7, z: -pr * 5, stageId: sid, rel: 'threat', starClass: threatCls === 'star' ? 'main' : undefined, atmosphere: threatCls === 'gasGiant' ? { density: 0.3, shellHeight: 0.04 } : null, ring: threatCls === 'gasGiant' ? { inner: 1.35, outer: 2.2, tilt: 0.3 } : null }));
  }

  // far field: struct-of-arrays impostors
  const N = 900, far = { count: N, p: new Float32Array(N * 3), size: new Float32Array(N), cls: new Uint8Array(N), seed: new Uint32Array(N), temp: new Float32Array(N) };
  let a = 7;
  const r = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
  for (let i = 0; i < N; i++) {
    const ang = r() * 6.283, d = pr * (40 + r() * 400);
    far.p[i * 3] = Math.cos(ang) * d; far.p[i * 3 + 1] = (r() - 0.5) * pr * 0.2; far.p[i * 3 + 2] = Math.sin(ang) * d;
    const k = r();
    far.cls[i] = k < 0.6 ? 1 : k < 0.8 ? 3 : k < 0.9 ? 5 : k < 0.98 ? 7 : 9; far.size[i] = pr * (0.1 + r() * 0.8) * (far.cls[i] >= 7 ? 3 : 1);
    far.seed[i] = (r() * 4e9) >>> 0; far.temp[i] = far.cls[i] === 7 ? 3000 + r() * 8000 : 0;
  }

  return {
    status: 'playing', time: 0, mass, stageIndex: idx, stageId: sid, progress: 0.4, health: 1, flags: {}, stats: { absorbed: 0, hits: 0, elapsed: 0, maxMass: mass, nearMisses: 0, disruptions: 0 },
    seed: 'fixture', genVersion: 1, originAbs: [0, 0, 0], player, bodies, far,
    sky: { seed: 4242, level: idx, density: 0.55 },
    key: { dir: unit([-0.62, 0.42, 0.36]), temperatureK: 5800, intensity: 1, hostId: null },
    hud: { speed: 0, speedMax: 100, escapeSpeed: null, thrust: 0, gravityDepth: 0, proximity: { star: 0, blackHole: 0, pulsar: 0 }, inAtmosphere: false, atmosphereDensity: 0, nearestThreat: null, nearestPrey: null, markers: [], region: { inVoid: false, density: 0.5, nearestMatter: null }, capture: null, orbit: null, trajectory: null, beaconAudio: { pulsar: 0 } },
    CLS_LIST: CLS_DEFAULT,
  };
}

/** Advance purely cosmetic fixture motion (spin, beam phase). Not a simulation. */
export function stepFixture(state, dt) {
  const adv = (b) => {
    b.spin.phase += b.spin.rate * dt;
    if (b.beam) b.beam.phase += (Math.PI * 2 / b.beam.period) * dt * 0.5;
    b.p[0] += b.v[0] * dt; b.p[2] += b.v[2] * dt;
  };
  adv(state.player); state.bodies.forEach(adv);
  state.time += dt;
}

export function makeFixtureEvents(state) {
  const p = state.player.p, R = state.player.radius;
  const at = (dx, dz) => [p[0] + dx * R, 0, p[2] + dz * R];
  return [
    { type: 'absorb', payload: { bodyId: 1, cls: 'asteroid', mass: 40, gained: 12, ratio: 0.3, relSpeed: 20, p: at(2.5, 1), dir: [1, 0, 0], chain: 3, tde: false } },
    { type: 'hit', payload: { bodyId: 2, cls: 'asteroid', damage: 0.2, strength: 0.7, relSpeed: 120, p: at(-1, 0.3), normal: [-1, 0, 0], health: 0.8, lethal: false } },
    { type: 'bounce', payload: { bodyId: 2, relSpeed: 40, p: at(1, 0), normal: [1, 0, 0] } },
    { type: 'impact', payload: { a: 3, b: 4, p: at(4, -3), normal: [0, 1, 0], energy: 0.8, relSpeed: 200, ejecta: 40, nearPlayer: true } },
    { type: 'atmosphere-entry', payload: { bodyId: 0, hostId: 99, intensity: 0.8, relSpeed: 300, p } },
    { type: 'capture-warning', payload: { bodyId: 5, level: 0.75, p } },
    { type: 'pulsar-beam', payload: { bodyId: 6, p, intensity: 1 } },
    { type: 'evolve', payload: { fromId: 'asteroid', toId: 'dwarf_planet', fromIndex: 1, toIndex: 2, mass: 200 } },
    { type: 'death', payload: { cause: 'collision', killerId: 2, killerCls: 'asteroid', p } },
  ];
}
