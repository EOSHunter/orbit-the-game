// Developer start: sim.startAt must land on the same state normal evolution produces, and the URL helpers must round-trip.
import assert from 'node:assert/strict';
import { createSim } from '../src/sim/index.js';
import { STAGES } from '../src/stages.js';
import { devStages, parseDevQuery, devQuery } from '../src/devstart.js';
import { test, done, recorder, run, STEP } from './sim.util.mjs';

const fresh = () => createSim({ seed: 'dev-test' });

test('devStages lists every stage from stages.js with its forms', () => {
  const list = devStages();
  assert.equal(list.length, STAGES.length);
  assert.deepEqual(list.map((s) => s.id), STAGES.map((s) => s.id));
  assert.deepEqual(list.find((s) => s.id === 'rocky_planet').forms.map((f) => f.id), ['terrestrial', 'lava', 'metallic']);
  assert.deepEqual(list.find((s) => s.id === 'asteroid').forms, []);
});

test('parseDevQuery / devQuery', () => {
  assert.equal(parseDevQuery(''), null);
  assert.equal(parseDevQuery('?stage=nope'), null);
  assert.deepEqual(parseDevQuery('?stage=rocky_planet&form=lava'), { stage: 'rocky_planet', forms: ['lava'] });
  assert.deepEqual(parseDevQuery('?stage=4&form=war_planet,metallic,bogus,red_dwarf'), { stage: 'gas_giant', forms: ['war_planet', 'metallic'] });
  const spec = { stage: 'star', forms: ['lava', 'blue_dwarf'] };
  assert.deepEqual(parseDevQuery(`?${devQuery(spec)}`), spec);
});

test('startAt reaches every stage with matching mass, size and run-start only', () => {
  for (const st of STAGES) {
    const sim = fresh(); const log = recorder(sim);
    assert.equal(sim.startAt({ stage: st.id }), true);
    const s = sim.getState();
    assert.equal(s.stageId, st.id); assert.equal(s.status, 'playing');
    assert.ok(s.mass >= (st.minMass || 1) && s.player.mass === s.mass);
    assert.ok(Math.abs(s.player.radius - 10 * Math.sqrt(s.mass)) < 1e-6 * s.player.radius);
    assert.equal(s.hud && s.health, 1);
    assert.deepEqual(log.map((e) => e.type).filter((t) => t !== 'status'), ['run-start'], st.id);
    run(sim, 0.5);   // and it simulates
    assert.equal(sim.getState().status, 'playing');
  }
});

test('startAt applies the chosen forms through applyChoice, abandons the rest', () => {
  const sim = fresh();
  sim.startAt({ stage: 'dwarf_star', forms: ['war_planet', 'lava', 'storm_giant', 'red_dwarf'] });
  const f = sim.getState().flags;
  assert.equal(f.trajectory, 'war_planet'); assert.equal(f.planetType, 'lava'); assert.equal(f.gasType, 'storm_giant'); assert.equal(f.starType, 'red_dwarf');
  assert.ok(Math.abs(f.speedMult - 1.15 * 1.1 * 1.1 * 1.1) < 1e-9);
  assert.equal(f.choiceCount, 4); assert.equal(f.abandonCount, 0);
  sim.startAt({ stage: 'rocky_planet', forms: ['metallic'] });
  const g = sim.getState().flags;
  assert.equal(g.planetType, 'metallic'); assert.equal(g.trajectory, null); assert.equal(g.abandonCount, 1);
  assert.equal(sim.getState().status, 'playing');
});

test('a dev-started look matches the one normal evolution produces', () => {
  const dev = fresh(); dev.startAt({ stage: 'rocky_planet', forms: ['lava'] });
  const nat = fresh(); nat.startAt({ stage: 'dwarf_planet' });
  nat.debug.setLoaderEnabled(false);
  nat.debug.setPlayer({ mass: STAGES[3].minMass, natural: true });
  run(nat, 0.1);
  assert.equal(nat.getState().status, 'choice');
  nat.pickChoice('lava');
  const a = dev.getState().player, b = nat.getState().player;
  for (const k of ['cls', 'stageId', 'variant', 'seed', 'temperatureK']) assert.deepEqual(a[k], b[k], k);
});

test('unknown stage is rejected and leaves the run alone', () => {
  const sim = fresh(); sim.start();
  assert.equal(sim.startAt({ stage: 'nope' }), false);
  assert.equal(sim.getState().stageId, 'meteorite');
});

test('normal restart is unchanged by a prior dev start', () => {
  const sim = fresh(); sim.startAt({ stage: 'black_hole' });
  sim.restart();
  const s = sim.getState();
  assert.equal(s.stageId, 'meteorite'); assert.equal(s.flags.choiceCount, 0);
});

test('quitToTitle fully resets a run; start and dev start work again afterwards', () => {
  const sim = fresh(); sim.startAt({ stage: 'dwarf_star', forms: ['lava', 'red_dwarf'] });
  run(sim, 0.5);
  sim.setPaused(true);
  const log = recorder(sim);
  sim.quitToTitle();
  const s = sim.getState();
  assert.equal(s.status, 'title'); assert.equal(s.stageId, 'meteorite'); assert.equal(s.mass, 1);
  assert.equal(s.flags.choiceCount, 0); assert.equal(s.flags.planetType, null); assert.equal(s.stats.elapsed, 0); assert.equal(s.time, 0);
  assert.equal(s.health, 1); assert.equal(s.player.variant, 'stony'); assert.equal(s.player.thrust[0], 0);
  assert.deepEqual(log.filter((e) => e.type === 'status').map((e) => e.payload.status), ['title']);
  run(sim, 0.5);                               // the title world idles without errors
  sim.start();
  assert.equal(sim.getState().status, 'playing');
  run(sim, 0.5);
  sim.quitToTitle(); sim.quitToTitle();        // idempotent
  assert.equal(sim.startAt({ stage: 'rocky_planet', forms: ['metallic'] }), true);
  assert.equal(sim.getState().flags.planetType, 'metallic'); assert.equal(sim.getState().status, 'playing');
  // identical to a never-quit sim with the same seed
  const ref = fresh(); ref.startAt({ stage: 'rocky_planet', forms: ['metallic'] });
  assert.equal(sim.getState().player.mass, ref.getState().player.mass);
  assert.equal(sim.getState().bodies.length > 0, true);
});

done('devstart');
