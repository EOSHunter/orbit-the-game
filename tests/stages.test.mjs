import assert from 'node:assert/strict';
import {
  STAGES, ABANDON_ID, CHOICE_STAGES, getStage, getStageIndex, getChoicesFor, applyChoice, getEnding,
} from '../src/stages.js';

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`ok   ${name}`); }
  catch (e) { console.error(`FAIL ${name}\n${e.stack}`); process.exitCode = 1; }
}
const fresh = (stageIndex = 0, extra = {}) => ({ mass: STAGES[stageIndex].minMass, stageIndex, flags: {}, status: 'playing', ...extra });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !~ ${b}`);

test('12 stages in the right order with required fields', () => {
  assert.deepEqual(STAGES.map((s) => s.name), [
    'Meteorite', 'Asteroid', 'Dwarf Planet', 'Rocky Planet', 'Gas Giant', 'Gas Planet',
    'Dwarf Star', 'Star', 'Giant Star', 'Supergiant Star', 'Neutron Star', 'Black Hole',
  ]);
  for (const s of STAGES) {
    assert.equal(typeof s.id, 'string');
    assert.ok(s.radiusScale > 0 && s.worldScale > 0);
    near(s.spawnMix.prey + s.spawnMix.threat + s.spawnMix.neutral, 1);
  }
  assert.equal(new Set(STAGES.map((s) => s.id)).size, 12);
});

test('minMass and worldScale strictly increase, growth is exponential-ish', () => {
  assert.equal(STAGES[0].minMass, 0);
  for (let i = 1; i < STAGES.length; i++) {
    assert.ok(STAGES[i].minMass > STAGES[i - 1].minMass);
    assert.ok(STAGES[i].worldScale > STAGES[i - 1].worldScale);
    if (i > 1) {
      const ratio = STAGES[i].minMass / STAGES[i - 1].minMass;
      assert.ok(ratio >= 2.5 && ratio <= 5, `ratio ${ratio} at ${i}`);
    }
  }
});

test('getStage at exact boundaries and just below', () => {
  for (let i = 0; i < STAGES.length; i++) {
    assert.equal(getStage(STAGES[i].minMass), STAGES[i]);
    assert.equal(getStageIndex(STAGES[i].minMass), i);
    if (i > 0) assert.equal(getStageIndex(STAGES[i].minMass - 0.001), i - 1);
  }
});

test('getStage handles extremes and bad input', () => {
  assert.equal(getStage(1), STAGES[0]);
  assert.equal(getStage(0), STAGES[0]);
  assert.equal(getStage(-5), STAGES[0]);
  assert.equal(getStage(NaN), STAGES[0]);
  assert.equal(getStage(undefined), STAGES[0]);
  assert.equal(getStage(1e15), STAGES[11]);
  assert.equal(getStage(Infinity), STAGES[11]);
});

test('getChoicesFor: menus at milestones, null elsewhere', () => {
  assert.deepEqual(CHOICE_STAGES, [2, 3, 4, 6, 9]);
  for (let i = -1; i <= 13; i++) {
    const c = getChoicesFor(i);
    if (CHOICE_STAGES.includes(i)) {
      assert.ok(Array.isArray(c) && c.length >= 3);
      for (const o of c) assert.ok(o.id && o.label && o.description);
      assert.equal(c.at(-1).id, ABANDON_ID);
      assert.equal(c.at(-1).label, 'Abandon evolution');
      assert.equal(new Set(c.map((o) => o.id)).size, c.length);
    } else assert.equal(c, null);
  }
  assert.equal(getChoicesFor(STAGES.findIndex((s) => s.id === 'rocky_planet')).some((o) => o.id === 'terrestrial'), true);
  assert.equal(getChoicesFor(6).some((o) => o.id === 'yellow_dwarf'), true);
  assert.deepEqual(getChoicesFor(2).slice(0, 3).map((o) => o.label), ['Frozen Fortress', 'Cradle of Life', 'War Planet']);
});

test('getChoicesFor returns copies', () => {
  getChoicesFor(2)[0].label = 'hacked';
  assert.equal(getChoicesFor(2)[0].label, 'Frozen Fortress');
});

test('every choice applies without throwing and records the pick', () => {
  for (const stage of CHOICE_STAGES) {
    for (const c of getChoicesFor(stage)) {
      const s = fresh(stage);
      const mass = s.mass;
      assert.equal(applyChoice(s, c.id), s);
      assert.equal(s.mass, mass);
      assert.equal(s.flags.choices[stage], c.id);
      assert.equal(s.flags.choiceCount, 1);
      assert.equal(s.flags.abandonOnly, c.id === ABANDON_ID);
      assert.equal(s.flags.abandonCount, c.id === ABANDON_ID ? 1 : 0);
    }
  }
});

test('abandon changes no modifiers', () => {
  for (const stage of CHOICE_STAGES) {
    const s = fresh(stage);
    applyChoice(s, ABANDON_ID);
    assert.equal(s.flags.speedMult, 1);
    assert.equal(s.flags.damageResist, 0);
    assert.equal(s.flags.absorbBonus, 0);
  }
});

test('trajectory effects', () => {
  let s = fresh(2); applyChoice(s, 'frozen_fortress');
  near(s.flags.damageResist, 0.25); near(s.flags.speedMult, 0.95); assert.equal(s.flags.trajectory, 'frozen_fortress');
  s = fresh(2); applyChoice(s, 'cradle_of_life_seed');
  near(s.flags.absorbBonus, 0.10); assert.equal(s.flags.trajectory, 'cradle_of_life_seed');
  s = fresh(2); applyChoice(s, 'war_planet');
  near(s.flags.speedMult, 1.15); assert.equal(s.flags.trajectory, 'war_planet');
});

test('planet, gas, star and supergiant effects', () => {
  let s = fresh(3); applyChoice(s, 'terrestrial');
  near(s.flags.absorbBonus, 0.05); near(s.flags.damageResist, 0.05); assert.equal(s.flags.planetType, 'terrestrial');
  s = fresh(3); applyChoice(s, 'lava'); near(s.flags.speedMult, 1.10);
  s = fresh(3); applyChoice(s, 'metallic'); near(s.flags.damageResist, 0.15);
  s = fresh(4); applyChoice(s, 'ringed_giant'); near(s.flags.absorbBonus, 0.10); assert.equal(s.flags.gasType, 'ringed_giant');
  s = fresh(4); applyChoice(s, 'storm_giant'); near(s.flags.speedMult, 1.10);
  s = fresh(4); applyChoice(s, 'ice_giant'); near(s.flags.damageResist, 0.10);
  s = fresh(6); applyChoice(s, 'yellow_dwarf'); assert.equal(s.flags.starType, 'yellow_dwarf'); near(s.flags.absorbBonus, 0.05);
  s = fresh(6); applyChoice(s, 'red_dwarf'); near(s.flags.speedMult, 1.10);
  s = fresh(6); applyChoice(s, 'blue_dwarf'); near(s.flags.absorbBonus, 0.10);
  s = fresh(9); applyChoice(s, 'giant_killer'); near(s.flags.damageResist, 0.20); assert.equal(s.flags.supergiantPerk, 'giant_killer');
  s = fresh(9); applyChoice(s, 'material_universe'); near(s.flags.absorbBonus, 0.15);
});

test('effects stack across stages and damageResist is capped', () => {
  const s = fresh(2);
  applyChoice(s, 'frozen_fortress');
  s.stageIndex = 3; applyChoice(s, 'metallic');
  s.stageIndex = 4; applyChoice(s, 'ice_giant');
  s.stageIndex = 9; applyChoice(s, 'giant_killer');
  near(s.flags.damageResist, 0.70);
  s.flags.damageResist = 0.7; s.stageIndex = 6; s.flags.choices = {};
  applyChoice(s, 'yellow_dwarf');
  near(s.flags.damageResist, 0.75);
  assert.equal(s.flags.choiceCount, 5);
});

test('applyChoice preserves unrelated flags and reuses existing ones', () => {
  const s = fresh(3, { flags: { custom: 42, speedMult: 2 } });
  applyChoice(s, 'lava');
  assert.equal(s.flags.custom, 42);
  near(s.flags.speedMult, 2.2);
});

test('applyChoice rejects invalid input', () => {
  assert.throws(() => applyChoice(fresh(0), ABANDON_ID), /No choice/);
  assert.throws(() => applyChoice(fresh(5), 'lava'), /No choice/);
  assert.throws(() => applyChoice(fresh(3), 'yellow_dwarf'), /Unknown choice/);
  assert.throws(() => applyChoice(fresh(3), 'nope'), /Unknown choice/);
  const s = fresh(3); applyChoice(s, 'lava');
  assert.throws(() => applyChoice(s, 'metallic'), /already/);
  assert.equal(s.flags.choiceCount, 1);
});

// Walks every milestone with picks[stage] and returns the final state at the Black Hole.
function runTo(blackHole, picks) {
  const s = fresh(0);
  for (let i = 0; i <= 11; i++) {
    s.stageIndex = i; s.mass = STAGES[i].minMass;
    if (picks[i]) applyChoice(s, picks[i]);
  }
  return blackHole ? s : s;
}
const ALL_ABANDON = { 2: ABANDON_ID, 3: ABANDON_ID, 4: ABANDON_ID, 6: ABANDON_ID, 9: ABANDON_ID };

test('ending: Stellar Fragment on collision death (any stage)', () => {
  for (const i of [0, 5, 11]) {
    const e = getEnding(fresh(i, { status: 'dead', deathCause: 'collision' }));
    assert.equal(e.id, 'stellar_fragment'); assert.equal(e.title, 'Stellar Fragment'); assert.ok(e.text.length > 20);
  }
  assert.equal(getEnding(fresh(3, { status: 'dead' })).id, 'stellar_fragment');
});

test('ending: Event Horizon on boundary death, beats other states', () => {
  const e = getEnding(fresh(4, { status: 'dead', deathCause: 'boundary' }));
  assert.equal(e.id, 'event_horizon'); assert.equal(e.title, 'Event Horizon');
  const bh = runTo(true, ALL_ABANDON); bh.status = 'dead'; bh.deathCause = 'boundary';
  assert.equal(getEnding(bh).id, 'event_horizon');
});

test('ending: collision death at the Black Hole stage is still Stellar Fragment', () => {
  const bh = runTo(true, {}); bh.status = 'dead'; bh.deathCause = 'collision';
  assert.equal(getEnding(bh).id, 'stellar_fragment');
});

test('ending: null while the run is in progress', () => {
  for (let i = 0; i < 11; i++) assert.equal(getEnding(fresh(i)), null);
  assert.equal(getEnding({ mass: 5, stageIndex: 0, flags: {}, status: 'playing' }), null);
});

test('ending: Quantum Cosmos on abandon-only path', () => {
  const e = getEnding(runTo(true, ALL_ABANDON));
  assert.equal(e.id, 'quantum_cosmos'); assert.equal(e.title, 'Quantum Cosmos');
});

test('ending: one non-abandon pick breaks the Quantum path', () => {
  const e = getEnding(runTo(true, { ...ALL_ABANDON, 3: 'lava' }));
  assert.equal(e.id, 'black_hole');
});

test('ending: Cradle of Life with Terrestrial + Yellow Dwarf, other picks free', () => {
  let e = getEnding(runTo(true, { 2: 'war_planet', 3: 'terrestrial', 4: 'storm_giant', 6: 'yellow_dwarf', 9: 'giant_killer' }));
  assert.equal(e.id, 'cradle_of_life'); assert.equal(e.title, 'Cradle of Life');
  e = getEnding(runTo(true, { 2: ABANDON_ID, 3: 'terrestrial', 4: ABANDON_ID, 6: 'yellow_dwarf', 9: ABANDON_ID }));
  assert.equal(e.id, 'cradle_of_life');
});

test('ending: only one of Terrestrial / Yellow Dwarf is not Cradle of Life', () => {
  assert.notEqual(getEnding(runTo(true, { 2: 'war_planet', 3: 'terrestrial', 4: 'storm_giant', 6: 'red_dwarf', 9: 'giant_killer' })).id, 'cradle_of_life');
  assert.notEqual(getEnding(runTo(true, { 2: 'war_planet', 3: 'lava', 4: 'storm_giant', 6: 'yellow_dwarf', 9: 'giant_killer' })).id, 'cradle_of_life');
});

test('ending: Creator God when fully committed and not Cradle', () => {
  const e = getEnding(runTo(true, { 2: 'frozen_fortress', 3: 'metallic', 4: 'ice_giant', 6: 'red_dwarf', 9: 'material_universe' }));
  assert.equal(e.id, 'creator_god'); assert.equal(e.title, 'Creator God');
});

test('ending: normal Black Hole ending for mixed picks and for no picks', () => {
  let e = getEnding(runTo(true, { 2: 'war_planet', 3: ABANDON_ID, 4: 'storm_giant', 6: 'red_dwarf', 9: 'giant_killer' }));
  assert.equal(e.id, 'black_hole'); assert.equal(e.title, 'Black Hole');
  e = getEnding({ mass: 4e6, stageIndex: 11, flags: {}, status: 'playing' });
  assert.equal(e.id, 'black_hole');
});

test('getEnding returns copies and tolerates missing flags', () => {
  const s = { mass: 4e6, stageIndex: 11, status: 'playing' };
  const e = getEnding(s); e.title = 'x';
  assert.equal(getEnding(s).title, 'Black Hole');
});

test('all six ending ids are reachable and distinct', () => {
  const ids = new Set([
    getEnding(fresh(2, { deathCause: 'collision' })).id,
    getEnding(fresh(2, { deathCause: 'boundary' })).id,
    getEnding(runTo(true, ALL_ABANDON)).id,
    getEnding(runTo(true, { 3: 'terrestrial', 6: 'yellow_dwarf' })).id,
    getEnding(runTo(true, { 2: 'war_planet' })).id,
    getEnding(runTo(true, { 2: 'war_planet', 3: ABANDON_ID })).id,
  ]);
  assert.equal(ids.size, 6);
});

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`);
