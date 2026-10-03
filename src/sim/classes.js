// Body classes, the emitter whitelist (contract 2.1) and per-class generation helpers. Pure, no state.
import { STAGES, getStageIndex } from '../stages.js';

export const CLS_LIST = [
  'meteorite', 'asteroid', 'comet', 'dwarfPlanet', 'rockyPlanet', 'gasGiant', 'brownDwarf', 'star',
  'neutronStar', 'blackHole', 'debris', 'fragment',
];
export const CLS_INDEX = Object.fromEntries(CLS_LIST.map((c, i) => [c, i]));

export const STAGE_CLS = {
  meteorite: 'meteorite', asteroid: 'asteroid', dwarf_planet: 'dwarfPlanet', rocky_planet: 'rockyPlanet',
  gas_giant: 'gasGiant', gas_planet: 'brownDwarf', dwarf_star: 'star', star: 'star', giant_star: 'star',
  supergiant_star: 'star', neutron_star: 'neutronStar', black_hole: 'blackHole',
};
const STAR_CLASS = { dwarf_star: 'dwarf', star: 'main', giant_star: 'giant', supergiant_star: 'supergiant' };

export const stageIndexForMass = (mass) => getStageIndex(mass);
export const stageIdForMass = (mass) => STAGES[getStageIndex(mass)].id;
export const clsForStageId = (id) => STAGE_CLS[id] || 'meteorite';
export const clsForMass = (mass) => clsForStageId(stageIdForMass(mass));
export const starClassForStageId = (id) => STAR_CLASS[id] || null;

// Relative density (arbitrary units), only used for the Roche limit.
export const DENSITY = {
  meteorite: 3.2, asteroid: 2.6, comet: 0.8, dwarfPlanet: 2.0, rockyPlanet: 5.0, gasGiant: 1.3, brownDwarf: 8,
  star: 1.4, neutronStar: 1e5, blackHole: 1e6, debris: 2.5, fragment: 2.5,
};

// ---- emitter whitelist (the normative table of contract 2.1) ----------------------------------------------
export const EMITTER_CAUSES = [
  'star', 'stellar-remnant', 'hot-ground', 'atmospheric-entry', 'ablation', 'impact-flash', 'hot-debris', 'accretion',
  'jet', 'pulsar-beam',
];

export const EMITTER_ALLOWED = {
  meteorite: ['impact-flash', 'ablation'],
  asteroid: ['impact-flash', 'ablation'],
  debris: ['impact-flash', 'ablation'],
  comet: ['impact-flash', 'ablation'],
  dwarfPlanet: ['impact-flash'],
  rockyPlanet: ['hot-ground', 'impact-flash'],
  gasGiant: [],
  brownDwarf: ['stellar-remnant'],
  star: ['star'],
  neutronStar: ['stellar-remnant', 'pulsar-beam'],
  blackHole: ['accretion', 'jet'],
  fragment: ['impact-flash', 'hot-debris'],
};

/** Returns null when `body.emissive` obeys the whitelist, otherwise a reason string. */
export function validateEmissive(body) {
  const e = body.emissive;
  if (e == null) return null;
  const allowed = EMITTER_ALLOWED[body.cls];
  if (!allowed) return `unknown cls ${body.cls}`;
  if (!EMITTER_CAUSES.includes(e.cause)) return `unknown cause ${e.cause}`;
  if (!allowed.includes(e.cause)) return `${body.cls} may not emit ${e.cause}`;
  if (!(e.intensity >= 0 && e.intensity <= 1.0001)) return `bad intensity ${e.intensity}`;
  if (e.cause === 'ablation' && body.entry == null) return 'ablation without atmospheric entry';
  if (e.cause === 'hot-ground' && body.variant !== 'lava') return 'hot-ground on a non-lava planet';
  if (e.cause === 'jet' && !(body.feeding > 0)) return 'jet while not feeding';
  return null;
}

/** Classes that may burn up in an atmosphere (set `entry`). */
export const ENTRY_CLASSES = new Set(['meteorite', 'asteroid', 'comet', 'debris']);
/** Classes that may exert gravity are decided by mass (gravity.wellMass), not class. */

// ---- per-class physical description ----------------------------------------------------------------------
function pick(rng, table) {
  let total = 0;
  for (const [, w] of table) total += w;
  let r = rng() * total;
  for (const [v, w] of table) { if ((r -= w) < 0) return v; }
  return table[table.length - 1][0];
}

const STAR_VARIANTS = {
  dwarf: [['red', 0.5], ['yellow', 0.35], ['blue', 0.15]],
  main: [['yellow', 0.4], ['red', 0.3], ['blue', 0.3]],
  giant: [['red', 0.6], ['yellow', 0.25], ['blue', 0.15]],
  supergiant: [['red', 0.4], ['blue', 0.6]],
};
// [min, max] kelvin by star class and variant
const STAR_TEMP = {
  dwarf: { red: [3000, 3700], yellow: [5200, 5900], blue: [8500, 11000] },
  main: { red: [3400, 4000], yellow: [5400, 6200], blue: [10000, 20000] },
  giant: { red: [3600, 4600], yellow: [5000, 6000], blue: [8000, 11000] },
  supergiant: { red: [3300, 4000], yellow: [5500, 7500], blue: [15000, 30000] },
};

export function starTemperature(starClass, variant, u) {
  const t = (STAR_TEMP[starClass] || STAR_TEMP.main)[variant] || [5500, 6000];
  return Math.round(t[0] + (t[1] - t[0]) * u);
}

/**
 * Class-specific descriptive fields from a body's own rng. Fixed draw order (never reorder; bump GEN_VERSION if you do).
 * Returns { variant, starClass, temperatureK, atmosphere, ring, beam }.
 */
export function describeBody(cls, mass, stageId, rng, radius) {
  const out = { variant: null, starClass: null, temperatureK: null, atmosphere: null, ring: null, beam: null };
  const r1 = rng(); const r2 = rng(); const r3 = rng(); const r4 = rng();
  switch (cls) {
    case 'meteorite': out.variant = r1 < 0.25 ? 'iron' : 'stony'; break;
    case 'asteroid':
      out.variant = r1 < 0.004 ? 'monolith' : r1 < 0.30 ? 'iron' : r1 < 0.65 ? 'carbonaceous' : 'rubble';
      break;
    case 'comet': out.variant = 'icy'; break;
    case 'dwarfPlanet': out.variant = r1 < 0.4 ? 'ice' : r1 < 0.75 ? 'rocky' : 'iron'; break;
    case 'rockyPlanet': {
      out.variant = r1 < 0.45 ? 'terrestrial' : r1 < 0.7 ? 'lava' : 'metallic';
      if (out.variant === 'terrestrial') out.atmosphere = { density: 0.45 + 0.35 * r2, shellHeight: radius * (0.14 + 0.08 * r3) };
      else if (out.variant === 'lava') out.atmosphere = { density: 0.15 + 0.15 * r2, shellHeight: radius * 0.08 };
      break;
    }
    case 'gasGiant':
      out.variant = r1 < 0.34 ? 'ringed' : r1 < 0.67 ? 'storm' : 'ice';
      out.atmosphere = { density: 0.9 + 0.1 * r2, shellHeight: radius * (0.3 + 0.1 * r3) };
      if (out.variant === 'ringed' || r4 < 0.2) out.ring = { inner: 1.35 + 0.15 * r2, outer: 2.1 + 0.5 * r3, tilt: (r4 - 0.5) * 0.7 };
      break;
    case 'brownDwarf': out.variant = r1 < 0.5 ? 't-dwarf' : 'l-dwarf'; out.temperatureK = Math.round(900 + 900 * r2); break;
    case 'star': {
      const sc = starClassForStageId(stageId) || 'main';
      out.starClass = sc;
      out.variant = pick(() => r1, STAR_VARIANTS[sc]);
      out.temperatureK = starTemperature(sc, out.variant, r2);
      break;
    }
    case 'neutronStar':
      out.variant = r1 < 0.8 ? 'pulsar' : 'magnetar';
      out.temperatureK = Math.round(400000 + 400000 * r2);
      out.beam = { phase: r3 * Math.PI * 2, period: 0.6 + 2.4 * r4, width: 0.12 + 0.1 * r2 };
      break;
    case 'blackHole': out.variant = mass > 2e7 ? 'supermassive' : 'stellar'; break;
    default: break;
  }
  return out;
}

/** Spin rate (rad/s) typical per class. */
export function spinRate(cls, u) {
  switch (cls) {
    case 'meteorite': case 'asteroid': case 'comet': case 'debris': case 'fragment': return 0.3 + 1.6 * u;
    case 'dwarfPlanet': return 0.1 + 0.4 * u;
    case 'rockyPlanet': return 0.08 + 0.3 * u;
    case 'gasGiant': return 0.15 + 0.35 * u;
    case 'brownDwarf': return 0.15 + 0.3 * u;
    case 'star': return 0.03 + 0.12 * u;
    case 'neutronStar': return 3 + 5 * u;
    default: return 0.05 + 0.1 * u;
  }
}
