// Emitter whitelist (contract 2.1): nothing may glow, burn or trail unless the table allows it.
import assert from 'node:assert/strict';
import { createSim, CLS_LIST } from '../src/sim/index.js';
import { EMITTER_ALLOWED, EMITTER_CAUSES, validateEmissive } from '../src/sim/classes.js';
import { test, done, lab, run, recorder, STEP } from './sim.util.mjs';

const seen = new Set();
function audit(st, where) {
  const bodies = [st.player, ...st.bodies];
  for (const b of bodies) {
    const err = validateEmissive(b);
    assert.equal(err, null, `${where}: body ${b.id} (${b.cls}/${b.variant}) ${err}`);
    if (b.emissive) seen.add(`${b.cls}:${b.emissive.cause}`);
    // small rocks never get a halo, rim, flame or trail of any kind
    if (['meteorite', 'asteroid', 'debris'].includes(b.cls) && b.emissive) {
      assert.ok(b.emissive.cause === 'impact-flash' || (b.emissive.cause === 'ablation' && b.entry), `${where}: ${b.cls} glows without a reason`);
    }
    if (b.cls === 'gasGiant') assert.equal(b.emissive, null, 'gas giants never emit');
    if (b.cls === 'dwarfPlanet') assert.ok(!b.emissive || b.emissive.cause === 'impact-flash');
  }
}

test('the whitelist table matches the contract', () => {
  assert.deepEqual(Object.keys(EMITTER_ALLOWED).sort(), [...CLS_LIST].sort());
  assert.deepEqual(EMITTER_ALLOWED.meteorite, ['impact-flash', 'ablation']);
  assert.deepEqual(EMITTER_ALLOWED.gasGiant, []);
  assert.deepEqual(EMITTER_ALLOWED.brownDwarf, ['stellar-remnant']);
  assert.deepEqual(EMITTER_ALLOWED.star, ['star']);
  assert.deepEqual(EMITTER_ALLOWED.neutronStar, ['stellar-remnant', 'pulsar-beam']);
  assert.deepEqual(EMITTER_ALLOWED.blackHole, ['accretion', 'jet']);
  assert.deepEqual(EMITTER_ALLOWED.fragment, ['impact-flash', 'hot-debris']);
  assert.ok(EMITTER_CAUSES.includes('atmospheric-entry'));
});

test('validateEmissive rejects every disallowed (class, cause) pair and conditional misuse', () => {
  for (const cls of CLS_LIST) {
    for (const cause of EMITTER_CAUSES) {
      const body = { cls, variant: 'lava', entry: { hostId: 1, intensity: 0.5 }, feeding: 0.5, emissive: { cause, intensity: 0.5 } };
      const ok = validateEmissive(body) === null;
      const expected = EMITTER_ALLOWED[cls].includes(cause);
      // 'atmospheric-entry' is listed in the enum but no class may use it as an emitter
      assert.equal(ok, expected, `${cls} ${cause}`);
    }
  }
  assert.ok(validateEmissive({ cls: 'asteroid', entry: null, feeding: 0, emissive: { cause: 'ablation', intensity: 1 } }), 'ablation needs entry');
  assert.ok(validateEmissive({ cls: 'rockyPlanet', variant: 'terrestrial', entry: null, feeding: 0, emissive: { cause: 'hot-ground', intensity: 1 } }), 'hot ground only on lava');
  assert.ok(validateEmissive({ cls: 'blackHole', variant: null, entry: null, feeding: 0, emissive: { cause: 'jet', intensity: 1 } }), 'jet needs feeding');
  assert.equal(validateEmissive({ cls: 'asteroid', entry: null, feeding: 0, emissive: null }), null);
});

test('natural runs on several seeds never violate the whitelist', () => {
  for (const seed of ['e1', 'e2', 'e3']) {
    const sim = createSim({ seed });
    sim.start();
    const st = sim.getState();
    sim.debug.setPlayer({ mass: 1 });
    for (const m of [1, 30, 150, 600, 2000, 6000, 20000]) {
      sim.debug.setPlayer({ mass: m });
      sim.debug.teleport([1000 * m % 90000, 0, -500 * m % 70000]);
      for (let i = 0; i < 600; i++) {
        sim.setInput({ x: Math.cos(i * 0.01), z: Math.sin(i * 0.013), stabilize: false });
        sim.step(STEP);
        if (st.status === 'choice') sim.pickChoice(st.status && 'abandon_evolution');
        if (i % 6 === 0) audit(st, `${seed}/m${m}/${i}`);
      }
    }
  }
});

test('forced scenarios: flashes, ablation, hot debris, stars, remnants and black holes obey the table', () => {
  // impacts
  let sim = lab(createSim);
  sim.debug.setPlayer({ mass: 1, p: [1e6, 0] });
  sim.debug.spawnBody({ cls: 'asteroid', mass: 70, p: [0, 0, 0], v: [0, 0, 0] });
  sim.debug.spawnBody({ cls: 'dwarfPlanet', mass: 150, p: [500, 0, 0], v: [0, 0, 0] });
  sim.debug.spawnBody({ cls: 'meteorite', mass: 6, p: [60, 0, 0], v: [-90, 0, 0] });
  sim.debug.spawnBody({ cls: 'meteorite', mass: 12, p: [560, 0, 0], v: [-90, 0, 0] });
  for (let i = 0; i < 40; i++) { sim.step(STEP); audit(sim.getState(), 'impacts'); }
  // shattering bodies leave cooling hot debris
  sim = lab(createSim);
  sim.debug.setPlayer({ mass: 1, p: [1e6, 0] });
  sim.debug.spawnBody({ cls: 'asteroid', mass: 40, p: [0, 0, 0], v: [150, 0, 0] });
  sim.debug.spawnBody({ cls: 'asteroid', mass: 40, p: [100, 0, 0], v: [-150, 0, 0] });
  let sawHot = false;
  for (let i = 0; i < 700; i++) {
    sim.step(STEP); audit(sim.getState(), 'shatter');
    if (sim.getState().bodies.some((b) => b.cls === 'fragment' && b.emissive && b.emissive.cause === 'hot-debris')) sawHot = true;
  }
  assert.ok(sawHot, 'fragments glow while hot');
  assert.ok(sim.getState().bodies.every((b) => !(b.cls === 'fragment' && b.emissive && b.emissive.cause === 'hot-debris' && b._hot <= 0)), 'and cool down');
  // entry
  sim = lab(createSim);
  sim.debug.setPlayer({ mass: 1, p: [1e6, 0] });
  const host = sim.debug.spawnBody({ cls: 'rockyPlanet', mass: 600, p: [0, 0, 0], static: true, variant: 'lava', atmosphere: { density: 0.7, shellHeight: 40 } });
  const vesc = Math.sqrt(2 * host._mu / host.radius);
  sim.debug.spawnBody({ cls: 'asteroid', mass: 0.5, p: [host.radius + 38, 0, 0], v: [-vesc * 0.9, 0, 0] });
  for (let i = 0; i < 60; i++) { sim.step(STEP); audit(sim.getState(), 'entry'); }
  // lava planet, star, brown dwarf, neutron star, black hole (feeding)
  sim = lab(createSim);
  sim.debug.setPlayer({ mass: 1, p: [1e8, 0] });
  const lava = sim.debug.spawnBody({ cls: 'rockyPlanet', mass: 500, p: [0, 0, 0], static: true, variant: 'lava' });
  sim.debug.spawnBody({ cls: 'star', mass: 20000, p: [1e5, 0, 0], static: true, temperatureK: 5800 });
  sim.debug.spawnBody({ cls: 'brownDwarf', mass: 5000, p: [-1e5, 0, 0], static: true });
  sim.debug.spawnBody({ cls: 'neutronStar', mass: 2e6, p: [0, 0, 1e6], static: true });
  const bh = sim.debug.spawnBody({ cls: 'blackHole', mass: 5e6, p: [0, 0, -1e6], static: true });
  sim.debug.spawnBody({ cls: 'gasGiant', mass: 1500, p: [2e5, 0, 0], static: true });
  for (let i = 0; i < 20; i++) { sim.step(STEP); audit(sim.getState(), 'classes'); }
  bh.feeding = 1;
  sim.step(STEP); audit(sim.getState(), 'jet');
  assert.equal(lava.emissive.cause, 'hot-ground');
  assert.equal(bh.emissive.cause, 'jet');
  bh.feeding = 0; sim.step(STEP); assert.equal(bh.emissive.cause, 'accretion');
  for (const need of ['star:star', 'brownDwarf:stellar-remnant', 'neutronStar:stellar-remnant', 'blackHole:accretion', 'blackHole:jet', 'rockyPlanet:hot-ground', 'asteroid:impact-flash', 'asteroid:ablation', 'fragment:hot-debris']) {
    assert.ok(seen.has(need), `observed ${need}`);
  }
});

test('the player follows the same rules at every stage (no thruster flame, no heat rim)', () => {
  const sim = createSim({ seed: 'player-emit' });
  sim.start();
  const st = sim.getState();
  for (const m of [1, 30, 100, 400, 1500, 4000, 15000, 50000, 150000, 500000, 1.5e6, 4e6]) {
    sim.debug.setPlayer({ mass: m });
    for (let i = 0; i < 30; i++) {
      sim.setInput({ x: 1, z: 0.2, stabilize: false });
      sim.step(STEP);
      if (st.status === 'choice') sim.pickChoice('abandon_evolution');
      assert.equal(validateEmissive(st.player), null, `${st.player.cls}`);
      if (['meteorite', 'asteroid'].includes(st.player.cls)) assert.equal(st.player.emissive, null, 'thrusting never makes a small rock glow');
    }
  }
});

done('sim.emitters');
