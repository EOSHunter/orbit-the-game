// Evolution stages, milestone choices and endings. Dependency-free ES module.
//
// state shape: { mass, stageIndex, flags: {}, status, deathCause?: 'collision' | 'captured' | 'boundary' }
// ('captured' = pulled in by a far larger black hole, the 3D build's Event Horizon ending; 'boundary' is legacy 2D.)
//
// flags (all created on demand by applyChoice; the engine may read them any time):
//   speedMult     number, default 1    Multiplier on steering/thrust speed. Stacks multiplicatively.
//   damageResist  number, default 0    Fraction (0..0.75) of collision damage ignored. Stacks additively, capped.
//   absorbBonus   number, default 0    Extra fraction of mass gained per absorb (0.1 = +10%). Stacks additively.
//   choices       object, default {}   Map of stageIndex -> chosen choice id (the pick log).
//   choiceCount   number, default 0    Number of milestone picks made, including abandons.
//   abandonCount  number, default 0    Number of times 'abandon_evolution' was picked.
//   abandonOnly   boolean, default true  True while every pick so far was 'abandon_evolution'
//                                      (secret Quantum Cosmos path). Flips to false on any other pick.
//   trajectory    string|null          'frozen_fortress' | 'cradle_of_life_seed' | 'war_planet' (Dwarf Planet pick).
//   planetType    string|null          'terrestrial' | 'lava' | 'metallic' (Rocky Planet pick).
//   gasType       string|null          'ringed_giant' | 'storm_giant' | 'ice_giant' (Gas Giant pick).
//   starType      string|null          'yellow_dwarf' | 'red_dwarf' | 'blue_dwarf' (Dwarf Star pick).
//   supergiantPerk string|null         'giant_killer' | 'material_universe' (Supergiant pick).
//
// Choices never change state.mass; they only touch flags. The engine decides when the
// menu is shown (when state.stageIndex reaches a stage where getChoicesFor() is non-null).

export const ABANDON_ID = 'abandon_evolution';

// minMass grows ~3.2x per stage (start mass 1). At ~70-80s per stage this lands a full run
// at roughly 13-16 minutes. Tune GROWTH timing in the engine, not here.
// radiusScale: visual radius multiplier (neutron star is deliberately compact).
// worldScale: arena / spawn-field / camera multiplier; strictly increasing.
// spawnMix: share of spawned bodies that are prey (smaller), threat (bigger), neutral (similar). Sums to 1.
export const STAGES = [
  { id: 'meteorite',       name: 'Meteorite',       minMass: 0,       radiusScale: 1,    worldScale: 1,    spawnMix: { prey: 0.80, threat: 0.05, neutral: 0.15 } },
  { id: 'asteroid',        name: 'Asteroid',        minMass: 20,      radiusScale: 2,    worldScale: 2,    spawnMix: { prey: 0.75, threat: 0.10, neutral: 0.15 } },
  { id: 'dwarf_planet',    name: 'Dwarf Planet',    minMass: 80,      radiusScale: 4,    worldScale: 4,    spawnMix: { prey: 0.70, threat: 0.15, neutral: 0.15 } },
  { id: 'rocky_planet',    name: 'Rocky Planet',    minMass: 300,     radiusScale: 8,    worldScale: 8,    spawnMix: { prey: 0.65, threat: 0.20, neutral: 0.15 } },
  { id: 'gas_giant',       name: 'Gas Giant',       minMass: 1000,    radiusScale: 16,   worldScale: 16,   spawnMix: { prey: 0.60, threat: 0.25, neutral: 0.15 } },
  { id: 'gas_planet',      name: 'Gas Planet',      minMass: 3200,    radiusScale: 32,   worldScale: 32,   spawnMix: { prey: 0.55, threat: 0.30, neutral: 0.15 } },
  { id: 'dwarf_star',      name: 'Dwarf Star',      minMass: 10000,   radiusScale: 64,   worldScale: 64,   spawnMix: { prey: 0.55, threat: 0.30, neutral: 0.15 } },
  { id: 'star',            name: 'Star',            minMass: 32000,   radiusScale: 128,  worldScale: 128,  spawnMix: { prey: 0.50, threat: 0.35, neutral: 0.15 } },
  { id: 'giant_star',      name: 'Giant Star',      minMass: 100000,  radiusScale: 256,  worldScale: 256,  spawnMix: { prey: 0.50, threat: 0.35, neutral: 0.15 } },
  { id: 'supergiant_star', name: 'Supergiant Star', minMass: 320000,  radiusScale: 512,  worldScale: 512,  spawnMix: { prey: 0.55, threat: 0.35, neutral: 0.10 } },
  { id: 'neutron_star',    name: 'Neutron Star',    minMass: 1000000, radiusScale: 128,  worldScale: 1024, spawnMix: { prey: 0.60, threat: 0.30, neutral: 0.10 } },
  { id: 'black_hole',      name: 'Black Hole',      minMass: 3200000, radiusScale: 256,  worldScale: 2048, spawnMix: { prey: 0.75, threat: 0.15, neutral: 0.10 } },
];

const ABANDON = {
  id: ABANDON_ID,
  label: 'Abandon evolution',
  description: 'Refuse the change. Grow on without a new ability. A path of only refusals leads somewhere secret.',
};

// Effects: speed multiplies; resist and absorb add. flag sets a named flag.
const CHOICE_DEFS = {
  // Dwarf Planet: the three trajectories (our interpretation of the store-page names).
  2: [
    { id: 'frozen_fortress', label: 'Frozen Fortress', description: 'Harden into an icy bulwark. Much tougher, a little slower.',
      effect: { speed: 0.95, resist: 0.25, flag: ['trajectory', 'frozen_fortress'] } },
    { id: 'cradle_of_life_seed', label: 'Cradle of Life', description: 'Gentle, fertile orbits draw matter in. Absorb more from everything you eat.',
      effect: { absorb: 0.10, flag: ['trajectory', 'cradle_of_life_seed'] } },
    { id: 'war_planet', label: 'War Planet', description: 'A scarred, aggressive world. Faster and bolder.',
      effect: { speed: 1.15, flag: ['trajectory', 'war_planet'] } },
  ],
  // Rocky Planet
  3: [
    { id: 'terrestrial', label: 'Terrestrial Planet', description: 'Air and oceans. Balanced, and a prerequisite for life.',
      effect: { absorb: 0.05, resist: 0.05, flag: ['planetType', 'terrestrial'] } },
    { id: 'lava', label: 'Lava Planet', description: 'A molten surface. Quicker, but fragile.',
      effect: { speed: 1.10, flag: ['planetType', 'lava'] } },
    { id: 'metallic', label: 'Metallic Planet', description: 'A dense iron core. Shrugs off impacts.',
      effect: { resist: 0.15, flag: ['planetType', 'metallic'] } },
  ],
  // Gas Giant
  4: [
    { id: 'ringed_giant', label: 'Ringed Giant', description: 'Wide rings sweep up debris. More mass per absorb.',
      effect: { absorb: 0.10, flag: ['gasType', 'ringed_giant'] } },
    { id: 'storm_giant', label: 'Storm Giant', description: 'Raging winds drive you faster.',
      effect: { speed: 1.10, flag: ['gasType', 'storm_giant'] } },
    { id: 'ice_giant', label: 'Ice Giant', description: 'A deep frozen mantle absorbs punishment.',
      effect: { resist: 0.10, flag: ['gasType', 'ice_giant'] } },
  ],
  // Dwarf Star
  6: [
    { id: 'yellow_dwarf', label: 'Yellow Dwarf', description: 'A calm, life-friendly sun.',
      effect: { absorb: 0.05, resist: 0.05, flag: ['starType', 'yellow_dwarf'] } },
    { id: 'red_dwarf', label: 'Red Dwarf', description: 'Dim, frugal and quick.',
      effect: { speed: 1.10, flag: ['starType', 'red_dwarf'] } },
    { id: 'blue_dwarf', label: 'Blue Dwarf', description: 'Hot and hungry. Pulls in more mass.',
      effect: { absorb: 0.10, flag: ['starType', 'blue_dwarf'] } },
  ],
  // Supergiant Star
  9: [
    { id: 'giant_killer', label: 'Giant Killer', description: 'Brace for the largest rivals. Heavy damage resistance.',
      effect: { resist: 0.20, flag: ['supergiantPerk', 'giant_killer'] } },
    { id: 'material_universe', label: 'Material Universe', description: 'Everything is fuel. Much more mass per absorb.',
      effect: { absorb: 0.15, flag: ['supergiantPerk', 'material_universe'] } },
  ],
};

export const CHOICE_STAGES = Object.keys(CHOICE_DEFS).map(Number);

const MAX_RESIST = 0.75;

/** Index of the stage for a given mass (last stage whose minMass <= mass). Bad input -> 0. */
export function getStageIndex(mass) {
  if (!(mass > 0)) return 0;
  let idx = 0;
  for (let i = 1; i < STAGES.length; i++) {
    if (mass >= STAGES[i].minMass) idx = i;
    else break;
  }
  return idx;
}

export function getStage(mass) {
  return STAGES[getStageIndex(mass)];
}

/** Choice menu for a stage, or null when that stage has none. Always includes 'Abandon evolution'. */
export function getChoicesFor(stageIndex) {
  const defs = CHOICE_DEFS[stageIndex];
  if (!defs) return null;
  return [...defs.map(({ id, label, description }) => ({ id, label, description })), { ...ABANDON }];
}

function ensureFlags(state) {
  const f = (state.flags ??= {});
  f.speedMult ??= 1;
  f.damageResist ??= 0;
  f.absorbBonus ??= 0;
  f.choices ??= {};
  f.choiceCount ??= 0;
  f.abandonCount ??= 0;
  f.abandonOnly ??= true;
  for (const k of ['trajectory', 'planetType', 'gasType', 'starType', 'supergiantPerk']) f[k] ??= null;
  return f;
}

/**
 * Apply a milestone pick for state.stageIndex. Mutates state.flags only.
 * Throws if the stage has no menu, the id is not offered there, or the stage was already decided.
 */
export function applyChoice(state, choiceId) {
  const stageIndex = state.stageIndex;
  const defs = CHOICE_DEFS[stageIndex];
  if (!defs) throw new Error(`No choice available at stage ${stageIndex}`);
  const def = defs.find((d) => d.id === choiceId);
  if (!def && choiceId !== ABANDON_ID) throw new Error(`Unknown choice "${choiceId}" for stage ${stageIndex}`);
  const f = ensureFlags(state);
  if (stageIndex in f.choices) throw new Error(`Choice already made at stage ${stageIndex}`);

  f.choices[stageIndex] = choiceId;
  f.choiceCount += 1;
  if (!def) {
    f.abandonCount += 1;
    return state;
  }
  f.abandonOnly = false;
  const e = def.effect;
  if (e.speed) f.speedMult *= e.speed;
  if (e.resist) f.damageResist = Math.min(MAX_RESIST, f.damageResist + e.resist);
  if (e.absorb) f.absorbBonus += e.absorb;
  if (e.flag) f[e.flag[0]] = e.flag[1];
  return state;
}

const ENDINGS = {
  stellar_fragment: {
    id: 'stellar_fragment',
    title: 'Stellar Fragment',
    text: 'A greater body swallowed you whole. You scatter into endless stellar fragments, drifting until something else gathers them.',
  },
  event_horizon: {
    id: 'event_horizon',
    title: 'Event Horizon',
    text: 'You ignored the warning and drifted past the edge of everything. Beyond the horizon, time stops, and you become eternal.',
  },
  quantum_cosmos: {
    id: 'quantum_cosmos',
    title: 'Quantum Cosmos',
    text: 'Every time evolution beckoned, you refused. Down you went, into the atom, and inside it a universe, and inside that, another. An infinitely recursive secret.',
  },
  cradle_of_life: {
    id: 'cradle_of_life',
    title: 'Cradle of Life',
    text: 'A blue planet circled a gentle yellow sun, and life took hold. Around it you built the Milky Way.',
  },
  creator_god: {
    id: 'creator_god',
    title: 'Creator God',
    text: 'You committed to every transformation and ended in a blaze of creation. Peoples that never existed worship you as a deity.',
  },
  black_hole: {
    id: 'black_hole',
    title: 'Black Hole',
    text: 'You collapsed into a singularity and devoured the light around you. Silence settles over the cosmos you consumed.',
  },
};

/**
 * Ending for the current state, or null while the run is still going.
 * Death/boundary/captured take priority; otherwise endings only resolve at the Black Hole stage:
 *   abandon-only picks -> Quantum Cosmos; Terrestrial + Yellow Dwarf -> Cradle of Life;
 *   no abandons at all -> Creator God; any mix -> the normal Black Hole ending.
 */
export function getEnding(state) {
  if (state.deathCause === 'boundary' || state.deathCause === 'captured') return { ...ENDINGS.event_horizon };
  if (state.deathCause === 'collision' || state.status === 'dead') return { ...ENDINGS.stellar_fragment };

  if (state.stageIndex !== STAGES.length - 1) return null;

  const f = state.flags ?? {};
  const picks = f.choiceCount ?? 0;
  const abandons = f.abandonCount ?? 0;
  if (picks > 0 && f.abandonOnly !== false && abandons === picks) return { ...ENDINGS.quantum_cosmos };
  if (f.planetType === 'terrestrial' && f.starType === 'yellow_dwarf') return { ...ENDINGS.cradle_of_life };
  if (picks > 0 && abandons === 0) return { ...ENDINGS.creator_god };
  return { ...ENDINGS.black_hole };
}
