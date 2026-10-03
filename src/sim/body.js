// Live body construction and per-body visual state (emissive per the whitelist, spin, coma, beam).
// Live bodies ARE the snapshot bodies: public fields follow contract 2.2, internal fields start with an underscore.
import { hash32 } from './rng.js';
import { mu as muOfRadius } from './physics.js';
import { clsForStageId } from './classes.js';

export function blankBody(cfg) {
  return {
    id: 0, cls: 'meteorite', stageId: 'meteorite', variant: null, seed: 0, rel: 'neutral',
    mass: 1, radius: 10,
    p: [0, 0, 0], v: [0, 0, 0],
    spin: { axis: [0, 1, 0], rate: 0, phase: 0 },
    temperatureK: null, atmosphere: null, ring: null,
    emissive: null, entry: null, feeding: 0, coma: 0, beam: null,
    parentId: null, onRails: false, state: 'alive', disrupt: null, absorbT: 0,
    // internal
    _dead: false, _dyn: false, _desc: null, _orbit: null, _parent: null, _mu: 0, _em: { cause: 'impact-flash', intensity: 0 },
    _entryObj: { hostId: 0, intensity: 0 }, _flash: 0, _hot: 0, _age: 0, _ttl: Infinity, _win: 0, _static: false,
    _chaser: -1, _chasing: false, _giveUp: 0, _atmHost: null, _atmRho: 0, _atmK: 0,
    _nmIn: false, _nmMin: 0, _nmSpeed: 0, _nmLast: -9, _touch: false, _lastImpact: -9, _pf: 0, _lastBeam: -9,
    _range: 0, _dsr: null, _a0x: 0, _a0z: 0, _beam0: 0, _starT: 0, _cfg: cfg,
  };
}

/** Set mass, radius, gravitational parameter and mass-scaled atmosphere in one place. */
export function setMass(cfg, b, mass) {
  b.mass = mass;
  b.radius = cfg.radiusUnit * Math.sqrt(mass);
  b._mu = muOfRadius(cfg.gravity, b.radius);
  b._range = cfg.gravity.rangeK * b.radius;
  if (b.atmosphere && b._atmK) b.atmosphere.shellHeight = b._atmK * b.radius;
}

export function bodyFromDesc(cfg, d, originAbs) {
  const b = blankBody(cfg);
  b.id = d.id; b.cls = d.cls; b.stageId = d.stageId; b.starClass = d.starClass || undefined; b.variant = d.variant; b.seed = d.seed;
  setMass(cfg, b, d.mass);
  b.radius = d.radius;
  b._mu = muOfRadius(cfg.gravity, b.radius);
  b._range = cfg.gravity.rangeK * b.radius;
  b.spin = { axis: d.spin.axis.slice(), rate: d.spin.rate, phase: d.spin.phase };
  b.temperatureK = d.temperatureK;
  if (d.atmosphere) { b.atmosphere = { density: d.atmosphere.density, shellHeight: d.atmosphere.shellHeight }; b._atmK = d.atmosphere.shellHeight / d.radius; }
  b.ring = d.ring ? { ...d.ring } : null;
  b.beam = d.beam ? { phase: d.beam.phase, period: d.beam.period, width: d.beam.width } : null;
  b._beam0 = d.beam ? d.beam.phase : 0;
  b._desc = d;
  b.p = [d.p0 ? d.p0[0] - originAbs[0] : 0, d.yo || 0, d.p0 ? d.p0[2] - originAbs[2] : 0];
  b.v = [d.v0[0], 0, d.v0[2]];
  if (d.orbit) { b._orbit = d.orbit; b.parentId = d.parentId; b.onRails = true; } else if (d.hasSystem) { b.onRails = true; b._static = true; }
  return b;
}

export const DYN_BASE = 2 ** 52;

/** A debris/fragment body created at run time (not part of any cell). */
export function makeDynamic(cfg, kind, mass, p, v, seed, idCounter) {
  const b = blankBody(cfg);
  b.id = DYN_BASE + idCounter;
  b.cls = kind; b.stageId = 'meteorite'; b.variant = 'rubble'; b.seed = hash32(seed, idCounter);
  setMass(cfg, b, mass);
  b.p = [p[0], p[1], p[2]]; b.v = [v[0], 0, v[2]];
  b._dyn = true; b._ttl = kind === 'fragment' ? 45 : 25;
  const u = hash32(b.seed, 1) / 4294967296; const w = hash32(b.seed, 2) / 4294967296;
  const t = u * 0.9; const ph = w * Math.PI * 2;
  b.spin = { axis: [Math.sin(t) * Math.cos(ph), Math.cos(t), Math.sin(t) * Math.sin(ph)], rate: 1 + 3 * u, phase: w * 6 };
  return b;
}

function setEm(b, cause, intensity) {
  const e = b._em; e.cause = cause; e.intensity = intensity > 1 ? 1 : intensity < 0 ? 0 : intensity;
  b.emissive = e;
}

/** Choose `emissive` strictly from the whitelist (contract 2.1). */
export function updateEmissive(b) {
  b.emissive = null;
  switch (b.cls) {
    case 'meteorite': case 'asteroid': case 'comet': case 'debris':
      if (b.entry) setEm(b, 'ablation', b.entry.intensity); else if (b._flash > 0) setEm(b, 'impact-flash', b._flash);
      break;
    case 'dwarfPlanet':
      if (b._flash > 0) setEm(b, 'impact-flash', b._flash);
      break;
    case 'rockyPlanet':
      if (b._flash > 0) setEm(b, 'impact-flash', b._flash); else if (b.variant === 'lava') setEm(b, 'hot-ground', 0.55);
      break;
    case 'brownDwarf': setEm(b, 'stellar-remnant', 0.12); break;
    case 'star': setEm(b, 'star', 0.55 + 0.45 * Math.min(1, Math.max(0, ((b.temperatureK || 5800) - 3000) / 12000))); break;
    case 'neutronStar': setEm(b, 'stellar-remnant', 0.7); break;
    case 'blackHole':
      if (b.feeding > 0.15) setEm(b, 'jet', b.feeding); else setEm(b, 'accretion', 0.55);
      break;
    case 'fragment':
      if (b._hot > 0) setEm(b, 'hot-debris', b._hot); else if (b._flash > 0) setEm(b, 'impact-flash', b._flash);
      break;
    default: break;
  }
}

/** Per-step visual bookkeeping: spin phase, flash/heat decay, feeding decay, pulsar beam phase. */
export function stepVisuals(b, dt, worldTime, cfg) {
  b.spin.phase += b.spin.rate * dt;
  if (b.spin.phase > 1e6 || b.spin.phase < -1e6) b.spin.phase %= Math.PI * 2;
  if (b._flash > 0) b._flash = Math.max(0, b._flash - dt / cfg.impact.flashTime);
  if (b._hot > 0) b._hot = Math.max(0, b._hot - dt / cfg.impact.hotTime);
  if (b.feeding > 0) b.feeding = Math.max(0, b.feeding - dt);
  if (b.beam) b.beam.phase = (b._beam0 + (Math.PI * 2 * worldTime) / b.beam.period) % (Math.PI * 2);
  updateEmissive(b);
}

/** Variant, atmosphere, ring etc. of the player for a given stage and the perk flags picked so far. */
export function playerLook(cfg, player, stageId, flags, seed) {
  const cls = clsForStageId(stageId);
  player.cls = cls; player.stageId = stageId;
  const u = (k) => hash32(seed, 0x91a, k) / 4294967296;
  player.starClass = undefined; player.variant = null; player.temperatureK = null; player.atmosphere = null; player.ring = null; player.beam = null;
  player._atmK = 0;
  switch (cls) {
    case 'meteorite': player.variant = 'stony'; break;
    case 'asteroid': player.variant = 'rubble'; break;
    case 'dwarfPlanet': player.variant = flags.trajectory === 'frozen_fortress' ? 'ice' : flags.trajectory === 'war_planet' ? 'iron' : 'rocky'; break;
    case 'rockyPlanet':
      player.variant = flags.planetType || 'terrestrial';
      if (player.variant === 'terrestrial') { player.atmosphere = { density: 0.6, shellHeight: 0.16 * player.radius }; player._atmK = 0.16; }
      else if (player.variant === 'lava') { player.atmosphere = { density: 0.2, shellHeight: 0.08 * player.radius }; player._atmK = 0.08; }
      break;
    case 'gasGiant': {
      const g = flags.gasType;
      player.variant = g === 'storm_giant' ? 'storm' : g === 'ice_giant' ? 'ice' : 'ringed';
      player.atmosphere = { density: 0.95, shellHeight: 0.33 * player.radius }; player._atmK = 0.33;
      if (player.variant === 'ringed') player.ring = { inner: 1.4, outer: 2.4, tilt: 0.2 };
      break;
    }
    case 'brownDwarf': player.variant = 't-dwarf'; player.temperatureK = 1200; break;
    case 'star': {
      const sc = { dwarf_star: 'dwarf', star: 'main', giant_star: 'giant', supergiant_star: 'supergiant' }[stageId];
      const sv = flags.starType === 'red_dwarf' ? 'red' : flags.starType === 'blue_dwarf' ? 'blue' : flags.starType === 'yellow_dwarf' ? 'yellow' : null;
      player.starClass = sc;
      player.variant = sv || (sc === 'giant' ? 'red' : sc === 'supergiant' ? 'blue' : 'yellow');
      const T = {
        dwarf: { red: 3400, yellow: 5600, blue: 9500 }, main: { red: 3600, yellow: 5800, blue: 15000 },
        giant: { red: 4200, yellow: 5200, blue: 9000 }, supergiant: { red: 3700, yellow: 6500, blue: 22000 },
      };
      player.temperatureK = T[sc][player.variant];
      break;
    }
    case 'neutronStar':
      player.variant = 'pulsar'; player.temperatureK = 600000;
      player.beam = { phase: 0, period: 1.2, width: 0.15 }; player._beam0 = u(1) * 6;
      break;
    case 'blackHole': player.variant = 'stellar'; break;
    default: break;
  }
  void cfg;
}
