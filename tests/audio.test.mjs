// Headless tests for src/audio: pure functions plus a smoke run against a fake AudioContext.
// Run: node tests/audio.test.mjs
import assert from 'node:assert/strict';
import * as P from '../src/audio/params.js';
import { createAudio } from '../src/audio/index.js';

let passed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }

// ---- pure functions ---------------------------------------------------------------------------
test('stage ids match the 12 stages and normalise', () => {
  assert.equal(P.STAGE_IDS.length, 12);
  assert.equal(P.stageIndexOf('dwarf_planet'), 2);
  assert.equal(P.stageIndexOf('Black Hole'), 11);
  assert.equal(P.stageIndexOf('gas-giant'), 4);
  assert.equal(P.stageIndexOf('nope'), -1);
});

test('mass scale is monotonic, 0..1; resonance falls as mass grows', () => {
  let prevS = -1, prevR = Infinity;
  for (const m of [0, 1, 20, 300, 3200, 1e5, 1e6, 3.2e6, 1e9]) {
    const s = P.massScale(m), r = P.resonanceHz(s);
    assert.ok(s >= prevS && s >= 0 && s <= 1);
    assert.ok(r <= prevR && r >= 24);
    prevS = s; prevR = r;
  }
  assert.ok(P.sfxCutoffHz(1) > P.sfxCutoffHz(0));
});

test('stage params: root falls, reverb grows, special kinds at the end', () => {
  let prev = Infinity;
  for (let i = 0; i < 12; i++) {
    const p = P.stageParams(i);
    assert.ok(p.rootHz < prev); prev = p.rootHz;
    assert.ok(p.chord.length >= 3 && p.cutoffHz > 0);
  }
  assert.ok(P.stageParams(9).reverbSec > P.stageParams(0).reverbSec);
  assert.equal(P.stageParams(10).kind, 'neutron');
  assert.equal(P.stageParams(11).kind, 'blackhole');
  assert.equal(P.stageParams(0).heartbeatBpm, 0);
  assert.ok(P.stageParams(6).heartbeatBpm > 0);
  assert.equal(P.stageParams(-5).kind, 'pad');                 // clamps
});

test('absorb params scale with prey ratio and chain collapses to chew', () => {
  const small = P.absorbParams(0.02, 0.3), big = P.absorbParams(0.8, 0.3);
  assert.ok(big.peak > small.peak && big.dur > small.dur && big.thumpHz < small.thumpHz);
  assert.equal(P.absorbParams(0.5, 0.3, 1).chew, false);
  assert.equal(P.absorbParams(0.5, 0.3, 5).chew, true);
  assert.ok(P.absorbParams(0.5, 0.9).thumpHz < P.absorbParams(0.5, 0.1).thumpHz);
});

test('near-miss sweep falls and bigger bodies are lower/longer', () => {
  const a = P.nearMissParams(300, 0.5, 0.3), b = P.nearMissParams(300, 30, 0.3);
  assert.ok(a.fromHz > a.toHz && b.fromHz > b.toHz);
  assert.ok(b.dur > a.dur && b.fromHz < a.fromHz);
});

test('pan and slingshot intensity are bounded', () => {
  assert.equal(P.panFrom(null, [0, 0, 0]), 0);
  assert.ok(P.panFrom([10, 0, 0], [0, 0, 0]) > 0);
  assert.ok(P.panFrom([-10, 0, 3], [0, 0, 0]) < 0);
  assert.ok(Math.abs(P.panFrom([1e9, 0, 0], [0, 0, 0])) <= 0.65);
  assert.ok(P.slingIntensity(0) === 0 && P.slingIntensity(1e6) <= 1);
});

test('rate gate allows once per interval per key', () => {
  const g = P.createGate();
  assert.ok(g.allow('a', 0, 0.1));
  assert.ok(!g.allow('a', 0.05, 0.1));
  assert.ok(g.allow('b', 0.05, 0.1));
  assert.ok(g.allow('a', 0.11, 0.1));
  g.reset(); assert.ok(g.allow('a', 0.12, 0.1));
});

test('voice stealing takes lowest priority then oldest; drops weak newcomers', () => {
  const vs = [{ prio: 3, start: 1 }, { prio: 1, start: 5 }, { prio: 1, start: 2 }, { prio: 5, start: 0 }];
  assert.equal(P.pickVictim(vs, 3), vs[2]);
  assert.equal(P.pickVictim(vs, 1), vs[2]);
  assert.equal(P.pickVictim([{ prio: 4, start: 0 }], 2), null);
  assert.equal(P.pickVictim([], 1), null);
});

test('buffer generators are finite and bounded; IR decays', () => {
  for (const f of [P.fillWhite, P.fillPink, P.fillBrown]) {
    const a = f(new Float32Array(20000));
    let m = 0; for (const v of a) { assert.ok(Number.isFinite(v)); m = Math.max(m, Math.abs(v)); }
    assert.ok(m > 0.05 && m < 4, `peak ${m}`);
  }
  const ir = P.fillImpulse(new Float32Array(44100), 44100, 1);
  const e = (a, b) => { let s = 0; for (let i = a; i < b; i++) s += ir[i] * ir[i]; return s; };
  assert.ok(e(2000, 12000) > e(30000, 40000));
  const c = P.saturationCurve(); assert.ok(c[0] < 0 && c[c.length - 1] > 0 && Math.abs(c[c.length - 1]) <= 1);
});

// ---- fake AudioContext smoke test ------------------------------------------------------------
class FakeParam {
  constructor() { this.value = 0; }
  setValueAtTime(v) { this.value = v; return this; }
  linearRampToValueAtTime(v) { this.value = v; return this; }
  exponentialRampToValueAtTime(v) { this.value = v; return this; }
  setTargetAtTime(v) { this.value = v; return this; }
  cancelScheduledValues() { return this; }
}
const PARAMS = new Set(['gain', 'frequency', 'detune', 'Q', 'pan', 'delayTime', 'threshold', 'knee', 'ratio', 'attack', 'release']);
function makeNode(counters) {
  counters.nodes++;
  const t = {
    connect(n) { return n; }, disconnect() {},
    start() { counters.started++; }, stop() {},
    getFloatTimeDomainData(a) { a[0] = 0.5; },
  };
  return new Proxy(t, {
    get(o, p) { if (p in o) return o[p]; if (PARAMS.has(p)) return (o[p] = new FakeParam()); return undefined; },
    set(o, p, v) { o[p] = v; return true; },
  });
}
function makeFakeContext() {
  const counters = { nodes: 0, started: 0 };
  const ctx = {
    counters, state: 'running', sampleRate: 8000, currentTime: 0, destination: makeNode(counters),
    resume: async () => { ctx.state = 'running'; },
    createBuffer: (ch, len) => { const d = Array.from({ length: ch }, () => new Float32Array(len)); return { getChannelData: (i) => d[i] }; },
  };
  for (const m of ['createGain', 'createOscillator', 'createBufferSource', 'createBiquadFilter', 'createConvolver',
    'createDynamicsCompressor', 'createAnalyser', 'createWaveShaper', 'createStereoPanner', 'createDelay']) {
    ctx[m] = () => makeNode(counters);
  }
  return ctx;
}
function makeBus() {
  const h = new Map();
  return {
    on(t, fn) { (h.get(t) || h.set(t, new Set()).get(t)).add(fn); return () => h.get(t).delete(fn); },
    emit(t, p) { for (const fn of h.get(t) || []) fn(p); },
    count: () => [...h.values()].reduce((n, s) => n + s.size, 0),
  };
}
const hud = (o = {}) => ({
  speed: 10, thrust: 0.6, gravityDepth: 0.4, proximity: { star: 0.5, blackHole: 0.5, pulsar: 0 },
  inAtmosphere: true, atmosphereDensity: 0.5, capture: { level: 0.6, hostId: 1 }, ...o,
});
const state = (o = {}) => ({
  status: 'playing', mass: 500, stageId: 'rocky_planet', health: 1, player: { id: 0, pos: [0, 0, 0] }, hud: hud(), ...o,
});

test('every method is a harmless no-op before unlock', () => {
  const a = createAudio({ context: makeFakeContext() });
  a.update(state(), 0.016); a.playUi('ui.click'); a.event('absorb', { ratio: 0.1 });
  a.setVolume({ master: 0.5 }); a.setMuted(true); a.setStage('star');
  assert.deepEqual(a.getStats().voices, 0);
  a.dispose();
});

test('no AudioContext available (Node) does not throw', async () => {
  const a = createAudio(); await a.unlock(); a.update(state(), 0.016); a.playUi('click'); a.dispose();
});

const ALL_EVENTS = {
  'run-start': { seed: 'x', genVersion: 1, stageId: 'meteorite' },
  status: { status: 'playing', prev: 'title' },
  absorb: { bodyId: 2, cls: 'asteroid', mass: 5, gained: 3, ratio: 0.3, relSpeed: 20, p: [5, 0, 1], dir: [1, 0, 0], chain: 0, tde: false },
  hit: { bodyId: 3, cls: 'asteroid', damage: 0.2, strength: 0.7, relSpeed: 80, p: [-4, 0, 0], normal: [1, 0, 0], health: 0.5, lethal: false },
  bounce: { bodyId: 3, relSpeed: 30, p: [1, 0, 0], normal: [1, 0, 0] },
  impact: { a: 1, b: 2, p: [3, 0, 0], normal: [0, 0, 1], energy: 0.6, relSpeed: 90, ejecta: 5, nearPlayer: true },
  'roche-disruption': { phase: 'start', bodyId: 4, cls: 'moon', mass: 9, victim: 'prey', p: [0, 0, 0], fragments: 8 },
  'near-miss': { bodyId: 5, cls: 'gasGiant', rel: 'threat', gap: 3, relSpeed: 200, p: [2, 0, 5] },
  'atmosphere-entry': { bodyId: 0, hostId: 7, intensity: 0.8, relSpeed: 100, p: [0, 0, 0] },
  'atmosphere-exit': { bodyId: 0, hostId: 7 },
  'orbit-acquired': { hostId: 7, hostCls: 'rockyPlanet', period: 20, p: [0, 0, 0] },
  slingshot: { hostId: 7, speedGain: 40, p: [0, 0, 0] },
  'choice-picked': { stageIndex: 3, choiceId: 'lava' },
  evolve: { fromId: 'meteorite', toId: 'asteroid', fromIndex: 0, toIndex: 1, mass: 25 },
  'health-low': { health: 0.29 },
  'invuln-end': {},
  'region-change': { inVoid: true, density: 0 },
  'beacon-ping': { dist: 100, bearing: 0.5 },
  'capture-warning': { bodyId: 9, level: 0.75, p: [0, 0, 0] },
  'capture-clear': { bodyId: 9 },
  'pulsar-beam': { bodyId: 8, p: [10, 0, 0], intensity: 0.9 },
  death: { cause: 'captured', killerId: 9, killerCls: 'blackHole', p: [0, 0, 0] },
  ending: { kind: 'eventHorizon', ending: null },
  // contract events that are deliberately silent, plus an unknown one: must be ignored
  rebase: { shift: [1, 0, 0] }, 'orbit-lost': { hostId: 7 }, 'choice-open': { stageIndex: 3, choices: [] }, 'made-up': { x: 1 },
};

test('every contract event is handled (or ignored) without throwing and makes nodes', async () => {
  const ctx = makeFakeContext();
  const a = createAudio({ context: ctx, debug: true });
  const bus = makeBus();
  a.attach(bus);
  await a.unlock();
  a.update(state(), 0.05);
  const before = ctx.counters.nodes;
  for (const [t, p] of Object.entries(ALL_EVENTS)) {
    ctx.currentTime += 1;                                  // clear the rate gates
    bus.emit(t, p);
    a.event(t, { ...p, chain: 3 });                        // also the chain/odd payload path
  }
  assert.ok(ctx.counters.nodes > before + 50);
  for (const n of ['click', 'hover', 'confirm', 'back', 'error', 'open', 'close', 'choice.select', 'choice.confirm', 'stagebanner', 'ui.click', 'bogus']) {
    ctx.currentTime += 1; a.playUi(n);
  }
  a.detach();
  assert.equal(bus.count(), 0);
  a.dispose();
});

test('event handlers swallow bad payloads (bus handlers must not throw)', async () => {
  const ctx = makeFakeContext(); const a = createAudio({ context: ctx });
  await a.unlock();
  for (const t of Object.keys(ALL_EVENTS)) { ctx.currentTime += 1; a.event(t, undefined); a.event(t, {}); a.event(t, { p: 'bad', ratio: NaN }); }
});

test('voice count never exceeds the cap under a flood of events', async () => {
  const ctx = makeFakeContext(); const a = createAudio({ context: ctx });
  await a.unlock();
  for (let i = 0; i < 400; i++) {
    ctx.currentTime += 0.001;
    a.event('hit', ALL_EVENTS.hit);
    a.event('impact', ALL_EVENTS.impact);
    a.event('pulsar-beam', ALL_EVENTS['pulsar-beam']);
    a.playUi(['hover', 'click', 'open'][i % 3]);
    a.event('near-miss', ALL_EVENTS['near-miss']);
    a.event('roche-disruption', ALL_EVENTS['roche-disruption']);
  }
  assert.ok(a.getStats().voices <= 28, `voices ${a.getStats().voices}`);
});

test('rate limiting collapses rapid absorbs; volume/mute persist-safe and clamped', async () => {
  const ctx = makeFakeContext(); const a = createAudio({ context: ctx });
  await a.unlock();
  const n0 = ctx.counters.nodes;
  for (let i = 0; i < 50; i++) a.event('absorb', ALL_EVENTS.absorb);       // same instant
  const perCall = (ctx.counters.nodes - n0);
  assert.ok(perCall < 80, `nodes ${perCall}`);                              // one chomp, not 50
  a.setVolume({ master: 3, music: -1, sfx: 0.2 });
  assert.deepEqual(a.getVolume(), { master: 1, music: 0, sfx: 0.2, muted: false });
  a.setMuted(true); assert.equal(a.getVolume().muted, true);
});

test('per-frame update creates no nodes in steady state', async () => {
  const ctx = makeFakeContext(); const a = createAudio({ context: ctx });
  await a.unlock();
  const s = state({ hud: hud({ inAtmosphere: false }) });
  for (let i = 0; i < 30; i++) { ctx.currentTime += 0.016; a.update(s, 0.016); }
  const n0 = ctx.counters.nodes;
  for (let i = 0; i < 300; i++) { ctx.currentTime += 0.016; a.update(s, 0.016); }
  // a stage-2 pad bed has no scheduled heartbeat; only sparse melody bells may add a few
  assert.ok(ctx.counters.nodes - n0 < 150, `nodes ${ctx.counters.nodes - n0}`);
});

for (const { name, fn } of queue) {
  try { await fn(); passed++; console.log(`ok   ${name}`); }
  catch (e) { console.error(`FAIL ${name}\n${e.stack}`); process.exitCode = 1; }
}
console.log(`${passed}/${queue.length} audio tests passed`);
