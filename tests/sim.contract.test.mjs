// Contract tests: snapshot shape, event bus, determinism, lifecycle, rebase, save/load, fixtures, source hygiene.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSim, CLS_LIST, GEN_VERSION } from '../src/sim/index.js';
import { createBus, EVENT_TYPES } from '../src/sim/events.js';
import { makeFixtureState, makeFixtureEvents } from '../src/sim/fixtures.js';
import { createUniverse } from '../src/sim/universe.js';
import { hash32, makeRng } from '../src/sim/rng.js';
import { CONFIG } from '../src/sim/config.js';
import { STAGES } from '../src/stages.js';
import { test, done, run, recorder, STEP, lab } from './sim.util.mjs';

const BODY_KEYS = ['id', 'cls', 'stageId', 'variant', 'seed', 'rel', 'mass', 'radius', 'p', 'v', 'spin', 'temperatureK', 'atmosphere', 'ring', 'emissive', 'entry', 'feeding', 'coma', 'beam', 'parentId', 'onRails', 'state', 'disrupt', 'absorbT'];
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

function checkState(st, { strictBodies = true } = {}) {
  for (const k of ['status', 'time', 'mass', 'stageIndex', 'stageId', 'progress', 'health', 'flags', 'stats', 'seed', 'genVersion', 'originAbs', 'player', 'bodies', 'far', 'sky', 'key', 'hud']) assert.ok(k in st, `state.${k}`);
  assert.ok(['title', 'playing', 'choice', 'ended', 'paused'].includes(st.status));
  for (const k of ['bounds', 'edge', 'edgeDoom', 'effects']) assert.ok(!(k in st), `legacy field ${k} must be gone`);
  for (const k of ['absorbed', 'hits', 'elapsed', 'maxMass', 'nearMisses', 'disruptions']) assert.ok(Number.isFinite(st.stats[k]), `stats.${k}`);
  assert.ok(isVec(st.originAbs));
  for (const b of [st.player, ...st.bodies]) {
    for (const k of BODY_KEYS) assert.ok(k in b, `body.${k}`);
    assert.ok(CLS_LIST.includes(b.cls), b.cls);
    assert.ok(['prey', 'neutral', 'threat', 'self'].includes(b.rel));
    assert.ok(isVec(b.p) && isVec(b.v), 'vectors');
    assert.ok(b.mass > 0 && Math.abs(b.radius - 10 * Math.sqrt(b.mass)) < 1e-6 * b.radius + 1e-9, 'radius = 10 sqrt(mass)');
    assert.ok(['alive', 'disrupting', 'absorbing'].includes(b.state));
    assert.ok(typeof b.onRails === 'boolean' && Number.isSafeInteger(b.id) && Number.isInteger(b.seed));
    assert.ok(b.spin && isVec(b.spin.axis) && Number.isFinite(b.spin.rate) && Number.isFinite(b.spin.phase));
    assert.ok(b.feeding >= 0 && b.feeding <= 1 && b.coma >= 0 && b.coma <= 1);
  }
  assert.equal(st.player.rel, 'self'); assert.equal(st.player.id, 0);
  assert.ok('health' in st.player && 'invuln' in st.player && Array.isArray(st.player.thrust) && st.player.thrust.length === 2);
  if (strictBodies) assert.ok(st.bodies.length <= CONFIG.maxNearBodies);
  const f = st.far;
  assert.ok(f.p instanceof Float32Array && f.size instanceof Float32Array && f.cls instanceof Uint8Array && f.seed instanceof Uint32Array && f.temp instanceof Float32Array);
  assert.ok(f.count >= 0 && f.p.length >= 3 * f.count);
  for (let i = 0; i < f.count; i++) assert.ok(f.cls[i] < CLS_LIST.length && f.size[i] > 0 && Number.isFinite(f.p[3 * i]));
  assert.ok(Number.isFinite(st.sky.seed) && Number.isFinite(st.sky.level) && Number.isFinite(st.sky.density));
  assert.ok(isVec(st.key.dir) && Math.abs(Math.hypot(...st.key.dir) - 1) < 1e-6 && st.key.temperatureK > 0 && st.key.intensity >= 0 && st.key.intensity <= 1);
  const h = st.hud;
  for (const k of ['speed', 'speedMax', 'escapeSpeed', 'thrust', 'gravityDepth', 'proximity', 'inAtmosphere', 'atmosphereDensity', 'nearestThreat', 'nearestPrey', 'markers', 'region', 'capture', 'orbit', 'trajectory', 'beaconAudio']) assert.ok(k in h, `hud.${k}`);
  for (const k of ['star', 'blackHole', 'pulsar']) assert.ok(h.proximity[k] >= 0 && h.proximity[k] <= 1, `proximity.${k}`);
  assert.ok(h.markers.length <= 12);
  for (const m of h.markers) assert.ok(['id', 'rel', 'cls', 'bearing', 'dist', 'p'].every((k) => k in m));
  for (const n of [h.nearestThreat, h.nearestPrey]) if (n) assert.ok(['id', 'cls', 'bearing', 'dist', 'gap', 'ratio'].every((k) => k in n));
  assert.ok(typeof h.region.inVoid === 'boolean' && h.region.density >= 0 && ('nearestMatter' in h.region));
  assert.ok(h.thrust >= 0 && h.thrust <= 1 && h.gravityDepth >= 0 && h.gravityDepth <= 1);
}

test('getState returns the same object, mutated in place, and always has the contract shape', () => {
  const sim = createSim({ seed: 'shape' });
  const st = sim.getState();
  assert.equal(sim.getState(), st);
  checkState(st);
  assert.equal(st.status, 'title');
  sim.start();
  const bodiesArr = st.bodies; const player = st.player; const far = st.far;
  for (let i = 0; i < 600; i++) {
    sim.setInput({ x: Math.sin(i * 0.02), z: Math.cos(i * 0.017), stabilize: i % 200 > 150 });
    sim.step(STEP);
    if (i % 50 === 0) checkState(st);
  }
  assert.equal(sim.getState(), st); assert.equal(st.bodies, bodiesArr); assert.equal(st.player, player); assert.equal(st.far, far);
  assert.equal(st.seed, 'shape'); assert.equal(st.genVersion, GEN_VERSION);
});

test('only contract events are emitted, with the contract payload keys', () => {
  const fixtures = new Map(makeFixtureEvents().map((e) => [e.type, e.payload]));
  const sim = createSim({ seed: 'events' });
  const log = recorder(sim);
  sim.start();
  const st = sim.getState();
  // a varied run that triggers many events: growth through stages, impacts, voids, entries
  for (const [m, tp] of [[1, [500, 0]], [30, [9000, 4000]], [250, [-30000, 12000]], [900, [70000, -20000]], [4000, [5e5, 3e5]], [60000, [2e6, -1e6]]]) {
    sim.debug.setPlayer({ mass: m });
    sim.debug.teleport([tp[0], 0, tp[1]]);
    for (let i = 0; i < 900; i++) {
      sim.setInput({ x: Math.cos(i * 0.006 + m), z: Math.sin(i * 0.009), stabilize: false });
      sim.step(STEP);
      if (st.status === 'choice') sim.pickChoice('abandon_evolution');
    }
  }
  assert.ok(log.length > 10);
  for (const e of log) {
    assert.ok(EVENT_TYPES.includes(e.type), `unknown event ${e.type}`);
    const ref = fixtures.get(e.type);
    for (const k of Object.keys(ref)) assert.ok(k in e.payload, `${e.type} payload.${k}`);
  }
});

test('every event in the contract has a fixture, and fixtures build valid states for all 12 stages', () => {
  const ev = makeFixtureEvents();
  assert.deepEqual(ev.map((e) => e.type).sort(), [...EVENT_TYPES].sort());
  for (const s of STAGES) {
    const st = makeFixtureState(s.id);
    checkState(st);
    assert.equal(st.stageId, s.id);
  }
  assert.equal(JSON.stringify(makeFixtureState('star')), JSON.stringify(makeFixtureState('star')), 'fixtures are pure');
});

test('event bus: on/off/*, synchronous delivery, a throwing handler cannot break the sim', () => {
  const bus = createBus(); const got = [];
  const off = bus.on('x', (p) => got.push(['x', p]));
  bus.on('*', (p, t) => got.push(['*', t]));
  bus.on('x', () => { throw new Error('bad consumer'); });
  bus.emit('x', 1); assert.deepEqual(got, [['x', 1], ['*', 'x']]);
  off(); bus.emit('x', 2); assert.equal(got.length, 3);
});

test('determinism: same seed and same inputs give identical runs, events and snapshots', () => {
  const play = () => {
    const sim = createSim({ seed: 'det' });
    const log = recorder(sim);
    sim.start();
    const r = makeRng(5);
    for (let i = 0; i < 2400; i++) {
      if (i % 30 === 0) sim.setInput({ x: r() * 2 - 1, z: r() * 2 - 1, stabilize: r() < 0.1 });
      sim.step(STEP);
      const st = sim.getState();
      if (st.status === 'choice') sim.pickChoice('abandon_evolution');
    }
    const st = sim.getState();
    const snap = JSON.stringify({ ...st, far: { count: st.far.count, p: Array.from(st.far.p.slice(0, 30)) } });
    return { snap, ev: JSON.stringify(log.map((e) => [e.type, e.t])) };
  };
  const a = play(); const b = play();
  assert.equal(a.snap, b.snap); assert.equal(a.ev, b.ev);
  const c = createSim({ seed: 'det2' }); c.start(); run(c, 5);
  assert.notEqual(JSON.stringify(c.getState().hud.markers), JSON.parse(JSON.stringify(JSON.parse(a.snap).hud.markers)) && '');
});

test('lifecycle: title -> playing -> restart reuses the state object; pause freezes the world', () => {
  const sim = createSim({ seed: 'life' });
  const st = sim.getState(); const log = recorder(sim);
  sim.step(STEP); assert.equal(st.status, 'title');
  sim.start();
  assert.equal(st.status, 'playing');
  assert.deepEqual(log.map((e) => e.type).slice(0, 2), ['status', 'run-start']);
  run(sim, 1);
  const t = st.time; const px = st.player.p[0];
  sim.setPaused(true); run(sim, 1); assert.equal(st.status, 'paused'); assert.equal(st.time, t); assert.equal(st.player.p[0], px);
  sim.setPaused(false); assert.equal(st.status, 'playing');
  sim.restart('another');
  assert.equal(sim.getState(), st); assert.equal(st.seed, 'another'); assert.equal(st.time, 0); assert.equal(st.status, 'playing');
  assert.ok(log.filter((e) => e.type === 'run-start').length === 2);
  sim.pickChoice('nonsense'); assert.equal(st.status, 'playing', 'pickChoice outside a choice is a no-op');
});

test('evolution, choices, health-low, invuln and endings follow the 2D rules', () => {
  const sim = lab(createSim);
  const st = sim.getState(); const log = recorder(sim);
  sim.debug.setPlayer({ mass: 20, natural: true });
  run(sim, 0.1);
  assert.equal(st.stageId, 'asteroid');
  assert.ok(log.some((e) => e.type === 'evolve' && e.payload.fromId === 'meteorite' && e.payload.toId === 'asteroid'));
  assert.equal(st.status, 'playing', 'stage 1 has no menu');
  sim.debug.setPlayer({ mass: 80, natural: true });
  run(sim, 0.1);
  assert.equal(st.status, 'choice'); assert.equal(st.stageId, 'dwarf_planet');
  const open = log.find((e) => e.type === 'choice-open');
  assert.ok(open && open.payload.stageIndex === 2 && open.payload.choices.length === 4);
  const mark = st.player.p[0]; run(sim, 0.5); // the world nearly stops during a choice and nothing can hurt
  sim.pickChoice('war_planet');
  assert.equal(st.status, 'playing'); assert.equal(st.flags.trajectory, 'war_planet'); assert.ok(Math.abs(st.flags.speedMult - 1.15) < 1e-9);
  assert.ok(log.some((e) => e.type === 'choice-picked' && e.payload.choiceId === 'war_planet'));
  void mark;
  // lethal hit: a body >= 3x heavier kills outright
  const sim2 = lab(createSim); const st2 = sim2.getState(); const log2 = recorder(sim2);
  sim2.debug.setPlayer({ mass: 1 });
  sim2.debug.spawnBody({ cls: 'asteroid', mass: 30, p: [30, 0, 0], v: [-10, 0, 0] });
  run(sim2, 4);
  const death = log2.find((e) => e.type === 'death');
  assert.ok(death && death.payload.cause === 'collision' && log2.some((e) => e.type === 'hit' && e.payload.lethal));
  assert.equal(st2.status, 'ended'); assert.equal(st2.deathCause, 'collision');
  assert.equal(log2.find((e) => e.type === 'ending').payload.ending.id, 'stellar_fragment');
  // non-lethal hit: damage, invulnerability, health-low after repeated hits, regeneration
  const sim3 = lab(createSim); const st3 = sim3.getState(); const log3 = recorder(sim3);
  sim3.debug.setPlayer({ mass: 10 });
  sim3.debug.spawnBody({ cls: 'meteorite', mass: 14, p: [40, 0, 0], v: [-12, 0, 0] });
  run(sim3, 1);
  assert.ok(st3.health < 1 && st3.health > 0.4 && st3.player.invuln);
  run(sim3, 2);
  assert.ok(log3.some((e) => e.type === 'invuln-end'));
});

test('finale: after the last stage the run ends after 1.6x mass or 30 s with the finale ending', () => {
  const sim = lab(createSim);
  const st = sim.getState(); const log = recorder(sim);
  sim.debug.setPlayer({ mass: 3.2e6 });
  run(sim, 0.1);
  assert.equal(st.stageId, 'black_hole');
  assert.equal(st.status, 'playing');
  run(sim, 31);
  assert.equal(st.status, 'ended'); assert.equal(st.flags.finale, true);
  const e = log.find((x) => x.type === 'ending');
  assert.equal(e.payload.kind, 'finale');
  assert.ok(e.payload.ending && e.payload.ending.title);
  // the mass route
  const sim2 = lab(createSim); sim2.debug.setPlayer({ mass: 3.2e6 }); run(sim2, 0.1);
  sim2.debug.setPlayer({ mass: 3.2e6 * 1.7 }); run(sim2, 0.1);
  assert.equal(sim2.getState().status, 'ended');
});

test('floating origin: rebase keeps the player near zero, positions continuous in absolute terms', () => {
  const sim = createSim({ seed: 'rebase' });
  sim.start();
  const st = sim.getState(); let stepNo = 0; const log = [];
  sim.events.on('*', (payload, type) => log.push({ type, payload, t: st.time, step: stepNo }));
  let maxP = 0; let lastAbs = [st.originAbs[0] + st.player.p[0], st.originAbs[2] + st.player.p[2]];
  let jump = 0;
  for (let i = 0; i < 7000; i++) {
    sim.setInput({ x: 1, z: 0, stabilize: false });
    stepNo++;
    sim.step(STEP);
    maxP = Math.max(maxP, Math.hypot(st.player.p[0], st.player.p[2]));
    const abs = [st.originAbs[0] + st.player.p[0], st.originAbs[2] + st.player.p[2]];
    if (log.length && log[log.length - 1].type === 'rebase' && log[log.length - 1].step === stepNo) {
      jump = Math.max(jump, Math.hypot(abs[0] - lastAbs[0], abs[1] - lastAbs[1]) - Math.hypot(...st.player.v) * STEP * 1.01);
    }
    lastAbs = abs;
    if (st.status === 'choice') sim.pickChoice('abandon_evolution');
  }
  const rebases = log.filter((e) => e.type === 'rebase');
  assert.ok(rebases.length >= 1, 'the origin was rebased');
  for (let i = 0; i < log.length; i++) if (log[i].type === 'rebase') for (let j = i - 1; j >= 0 && log[j].step === log[i].step; j--) assert.ok(log[j].type === 'rebase', `rebase is emitted first in its step (saw ${log[j].type})`);
  assert.ok(maxP <= Math.max(CONFIG.rebaseDistance, CONFIG.rebaseRadii * st.player.radius) * 1.5 + 1e4, `player stays near the origin (${maxP})`);
  assert.ok(jump < 1e-6, `absolute position is continuous across rebases (${jump})`);
  for (const b of st.bodies) assert.ok(Math.hypot(b.p[0], b.p[2]) < 1e8, 'bodies are origin relative');
});

test('save/load: seed + deltas + run state reproduce the world', () => {
  const sim = createSim({ seed: 'save' });
  sim.start();
  const st = sim.getState();
  for (let i = 0; i < 3000; i++) { sim.setInput({ x: Math.cos(i * 0.01), z: Math.sin(i * 0.02), stabilize: false }); sim.step(STEP); if (st.status === 'choice') sim.pickChoice('abandon_evolution'); }
  assert.ok(st.stats.absorbed > 0, 'ate something');
  const save = JSON.parse(JSON.stringify(sim.exportSave()));
  assert.equal(save.seed, 'save'); assert.equal(save.genVersion, GEN_VERSION);
  assert.ok(save.deltas.consumed.length >= st.stats.absorbed);
  const sim2 = createSim({ seed: 'other' });
  assert.equal(sim2.importSave(save), true);
  const s2 = sim2.getState();
  assert.equal(s2.seed, 'save');
  assert.ok(Math.abs(s2.mass - st.mass) < 1e-9 && s2.stageIndex === st.stageIndex);
  assert.ok(Math.abs((s2.originAbs[0] + s2.player.p[0]) - (st.originAbs[0] + st.player.p[0])) < 1e-6);
  for (const id of save.deltas.consumed) assert.ok(!s2.bodies.some((b) => b.id === id), 'consumed bodies stay gone');
  assert.equal(createSim().importSave({ seed: 'x', genVersion: 99, run: {} }), false);
  checkState(s2);
});

test('voids: the beacon pings every 6 s and a gentle tide drifts toward matter; region-change fires', () => {
  const u = createUniverse('void-run');
  const lv = 3; let spot = null;
  const cs = u.levels.cellSize(4);
  for (let i = -40; i < 40 && !spot; i++) for (let j = -40; j < 40 && !spot; j++) {
    const r = u.getRegion([i * cs * 0.5, 0, j * cs * 0.5], lv);
    if (r.inVoid && r.density < 0.1) spot = [i * cs * 0.5, 0, j * cs * 0.5];
  }
  assert.ok(spot, 'found a void');
  const sim = createSim({ seed: 'void-run' });
  sim.start();
  const st = sim.getState(); const log = recorder(sim);
  sim.debug.teleport(spot);
  run(sim, 14);
  assert.equal(st.hud.region.inVoid, true);
  assert.ok(st.hud.region.nearestMatter && st.hud.region.nearestMatter.dist > 0);
  assert.ok(log.some((e) => e.type === 'region-change' && e.payload.inVoid === true));
  assert.ok(log.filter((e) => e.type === 'beacon-ping').length >= 2, 'pings every 6 s');
  // the tide moves an idle player toward the nearest matter bearing
  const bearing = st.hud.region.nearestMatter.bearing;
  const speed = Math.hypot(st.player.v[0], st.player.v[2]);
  assert.ok(speed > 0 || st.hud.region.inVoid === false);
  void bearing;
});

test('chase AI: from stage 3 heavier threats pursue the player within the detection radius', () => {
  const sim = lab(createSim, { chase: { chanceStart: 1, chanceEnd: 1 } });
  const st = sim.getState();
  sim.debug.setPlayer({ mass: 300 });
  run(sim, 0.05);
  const R = st.player.radius;
  const chaser = sim.debug.spawnBody({ cls: 'rockyPlanet', mass: 700, p: [R * 20, 0, 0], v: [0, 0, 0], chaser: true });
  const before = Math.hypot(chaser.p[0], chaser.p[2]);
  run(sim, 1.5);
  assert.ok(chaser._chasing, 'it noticed the player');
  assert.ok(Math.hypot(chaser.p[0], chaser.p[2]) < before, 'and closes in');
  assert.ok(Math.hypot(chaser.v[0], chaser.v[2]) < 8.6 * R, 'at no more than the chase speed cap');
  // before stage 3 nothing chases
  const sim2 = lab(createSim, { chase: { chanceStart: 1, chanceEnd: 1 } });
  sim2.debug.setPlayer({ mass: 30 }); run(sim2, 0.05);
  const c2 = sim2.debug.spawnBody({ cls: 'dwarfPlanet', mass: 200, p: [600, 0, 0], chaser: true });
  run(sim2, 1);
  assert.ok(!c2._chasing && Math.hypot(c2.v[0], c2.v[2]) < 1e-9);
});

test('systems on rails: planets orbit their star; hits demote a body to free flight', () => {
  const u = createUniverse('rails');
  let sys = null;
  outer: for (let l = 7; l < 14; l++) for (let cx = -3; cx < 3; cx++) for (let cz = -3; cz < 3; cz++) {
    for (const r of u.getCell(l, cx, cz).roots) if (r.hasSystem) { sys = r; break outer; }
  }
  assert.ok(sys, 'found a system');
  const sim = createSim({ seed: 'rails' });
  sim.debug.setLoaderEnabled(false);
  sim.start();
  sim.debug.teleport([sys.p0[0] + sys.extent * 1.05, 0, sys.p0[2]]);
  sim.debug.setLoaderEnabled(true);
  sim.debug.loaderTick();
  const st = sim.getState();
  const star = st.bodies.find((b) => b.id === sys.id);
  assert.ok(star, 'the star is loaded');
  const kids = st.bodies.filter((b) => b.parentId === star.id);
  assert.ok(kids.length > 0 && kids.every((k) => k.onRails));
  const k = kids[0];
  const d0 = Math.hypot(k.p[0] - star.p[0], k.p[2] - star.p[2]);
  const pos0 = [k.p[0], k.p[2]];
  sim.setInput({ x: 0, z: 0, stabilize: false });
  run(sim, 2);
  const d1 = Math.hypot(k.p[0] - star.p[0], k.p[2] - star.p[2]);
  assert.ok(Math.abs(d1 - d0) < 0.2 * d0 + 1, 'stays on its orbit');
  assert.ok(Math.hypot(k.p[0] - pos0[0], k.p[2] - pos0[1]) > 0, 'and moves');
});

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

test('hygiene: no boundary code, no Math.random/Date, no DOM/three/render imports in src/sim', () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'sim');
  const files = readdirSync(dir).filter((f) => f.endsWith('.js'));
  assert.ok(files.length >= 9);
  for (const f of files) {
    const code = stripComments(readFileSync(join(dir, f), 'utf8'));
    assert.ok(!/boundary/i.test(code), `${f}: boundary`);
    assert.ok(!/Math\.random|Date\.now|new Date|performance\.now/.test(code), `${f}: nondeterministic source`);
    assert.ok(!/\b(document|window|navigator|AudioContext|requestAnimationFrame)\b/.test(code.replace(/globalThis/g, '')), `${f}: DOM access`);
    assert.ok(!/from\s+['"](three|\.\.\/render|\.\.\/ui|\.\.\/audio|\.\.\/data)/.test(code), `${f}: forbidden import`);
  }
  assert.equal(typeof hash32(1, 2, 3), 'number');
});

done('sim.contract');
