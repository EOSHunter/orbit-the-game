// Every SIM tunable. Distances are world units; speeds and accelerations are given in "player radii" (S) per second
// wherever the comment says (S), exactly like the 2D game, so the feel is the same at every scale.
// createSim({ config }) deep-merges overrides onto a private copy; this module's object is never mutated by the sim.

export const CONFIG = {
  radiusUnit: 10,          // radius = radiusUnit * sqrt(mass)
  startMass: 1,
  absorbEfficiency: 0.4,   // reference value (mid point of absorb.gentle / absorb.fast)

  rebaseDistance: 5000,    // |player.p| above this triggers a rebase ...
  rebaseRadii: 30,         // ... or this many player radii, whichever is larger
  maxNearBodies: 300,
  maxFar: 4096,
  maxDynamic: 140,         // live debris + fragments

  ratio: { dominate: 1.2, hysteresis: 0.05, lethal: 3.0 },

  // Scale levels: level L holds bodies with mass in [mass0 * ratio^L, mass0 * ratio^(L+1)); cell = cellK * ref radius.
  levels: { count: 18, mass0: 0.02, ratio: 3.5, cellK: 60, belowLevels: 4 },

  universe: {
    lambda: 2.5,           // mean root bodies per cell at density multiplier 1
    profileSlope: 0,       // lambda *= 1 + slope * level (0 = every level equally rich)
    maxPerCell: 7,
    noiseCells: 5,         // lattice spacing of the density field, in cells
    voidLo: 0.30, voidHi: 0.50,   // value-noise thresholds that carve voids
    voidDensity: 0.22,     // region density below this counts as "in a void"
    nearK: 100,            // near window of a level = nearK * its max radius (apparent-size cull), capped by view radius
    farCells: 3,           // far window = farCells cells of the level
    placeTries: 8,
    cometChance: 0.10,
    heavyMass: 3.2e6, heavyFactor: 0.15,   // black-hole mass range is rarer (the hunters)
    driftMin: 0.15, driftMax: 1.2,   // field-body speed = driftK * refRadius^driftExp * U(driftMin, driftMax): sub-linear, so huge bodies are nearly static
    driftK: 2, driftExp: 0.7,
    cacheMax: 5000,
  },

  view: { radiusS: 60, unloadK: 1.35, tickSteps: 6, loadBudget: 90, farRefreshSteps: 12, genBudget: 40 },

  gravity: {
    surfaceRate: 0.4,      // Omega0: mu = Omega0^2 * R^3 (circular surface orbit rate, rad/s); low so gravity bends paths without sweeping the field clean
    soften: 0.6,           // softening length = soften * R of the source
    wellMass: 80,          // bodies at least this heavy exert gravity
    rangeK: 14,            // gravity reaches rangeK * R, tapering over the outer 30 %
    minRatio: 1.0,         // a source must be this much heavier than the body it pulls (player: 1.0)
    playerMaxPull: 0.85,   // ordinary wells never pull the player harder than this fraction of its thrust (only capture can)
    maxSources: 8,
    playerPull: 1,         // multiplier on the player's own pull on smaller free bodies (0 disables)
  },

  player: {
    accelEarly: 12, accelLate: 6.6,      // S/s^2 thrust
    brakeEarly: 1.0, brakeLate: 0.5,     // 1/s auto-brake when no input (stabiliser, weaker at late stages)
    lateralEarly: 2.0, lateralLate: 1.2, // 1/s sideways damping while thrusting (flight assist)
    stabilize: 3.5,                      // 1/s when Space is held
    maxSpeed: 14,                        // S/s soft cap on thrust-added speed
    capDecay: 2.0,
    maxHealth: 1, regenDelay: 3, regenRate: 0.07, invulnTime: 1.2,
    orbitLock: true,                     // auto-brake yields while bound to a well
  },

  // Pacing governor: a gentle rubber band on absorb gains so a run lasts about 13-16 minutes for any seed and skill.
  // Gain multiplier = ((expected + delta) / (progress + delta))^power, where expected = time in stage / targetStageTime and
  // progress is the log-progress through the stage; clamped to [min, max].
  pace: { enabled: true, targetStageTime: 95, delta: 0.08, power: 5, min: 0.04, max: 3 },

  absorb: {
    contact: 0.25,
    pullBase: 0.6, pullPerStage: 0.12, pullAccel: 7,   // gravity "scoop" range (S) and accel (S/s^2)
    gentle: 0.55, fast: 0.30,            // efficiency at relSpeed <= v_esc and >= 6 v_esc
    gentleX: 1, fastX: 6,
    debrisFraction: 0.25,                // share of shed mass that survives as debris bodies
    debrisMax: 3,
    chainWindow: 1.5,
  },

  collision: { grace: 0.85, restitution: 0.6, minSeparation: 2.5 },   // minSeparation in S/s

  mergeRatio: 5,           // body-body: heavier absorbs lighter at least this much lighter
  impact: { shatterEnergy: 0.55, maxEjecta: 8, flashTime: 0.18, hotTime: 4 },

  roche: {
    minRatio: 10, maxRatio: 50,
    k: 1.6,                // between the rigid (1.26) and fluid (2.44) coefficients of research 2.4
    maxRadii: 4, minRadii: 1.15,
    duration: 2.2,
    fragmentsMin: 6, fragmentsMax: 12,
    shedFraction: 0.85,
    maxConcurrent: 3,
    playerDps: 0.18,
  },

  chase: {
    enabled: true, minStage: 3, chanceStart: 0.35, chanceEnd: 0.95,
    detectionRadius: 30, giveUpDelay: 4, massRatioCutoff: 1.2,
    speed: 6.5, speedLate: 8.5, accel: 5, lead: 0.3, heavyDrag: 0.04, separation: 0.2,
  },

  entryMinSpeed: 0.6,      // fraction of the host's surface escape speed
  entry: { ablation: 0.12 },

  nearMiss: { factor: 1.5, minGap: 1.5 },
  slingshot: { minGain: 2.0 },            // S/s of gravity-assist speed
  orbit: { soiK: 30, acquire: 1.5, lose: 1.0 },

  void: { drift: 0.4, ping: 6, hysteresis: 1.3, nearThreshold: 0.6, rings: 20, steps: 16 },

  capture: {
    massRatio: 4,          // only a black hole at least this much heavier captures ...
    maxRatio: 300,         // ... and at most this much (a hole 1e5x heavier is not a fair hunter for a pebble)
    radiusK: 6,            // capture radius = max(radiusK * R of the hole, radiusS * player radius)
    radiusS: 40,           // ... so even a small hole gives a fast player about 3 s of warning
    pull: 0.2,             // accel at the capture radius, as a fraction of the player's thrust
    loadK: 7,              // gravity reach (taper) in R (at least 1.15 x the capture radius)
    reachK: 2.0,           // the pull tapers to zero at reachK x the capture radius (early notice)
    target0: 0.05,         // pull ratio where the level starts to rise
    rise: 0.35, fall: 0.5, // level change per second
    warnAt: [0.25, 0.5, 0.75, 1.0],
  },

  pulsar: { range: 60, minInterval: 0.6 },
  trajectory: { enabled: false, points: 120, step: 0.1, every: 6 },

  finale: { massFactor: 1.6, maxTime: 30 },
  death: { slowmo: 0.35, delay: 1.6 },
  hitStop: 0.06,
};

export function mergeConfig(base, over) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!over) return structuredCloneSafe(out);
  for (const k of Object.keys(over)) {
    const v = over[k];
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') out[k] = mergeConfig(base[k], v);
    else out[k] = v;
  }
  return out;
}

function structuredCloneSafe(o) {
  const out = Array.isArray(o) ? [] : {};
  for (const k of Object.keys(o)) {
    const v = o[k];
    out[k] = v && typeof v === 'object' ? structuredCloneSafe(v) : v;
  }
  return out;
}
