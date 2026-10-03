// Looks data for the 3D renderer of Vesper Drift. Owner: Creative Director.
//
// Data plus one pure function (getLook). No DOM, no Three.js, no Math.random.
// Contract: docs/interfaces.md §2.4. Visual intent: docs/art-bible.md.
// Shader meaning of every field and of every `extras` key: docs/material-spec.md.
//
// Units and conventions
//   hex           '#RRGGBB', authored in sRGB. Shaders convert to linear before lighting.
//   albedo        [min, max] linear reflectance (0..1). Real values (research §1.3); never brightened for readability (R9).
//   intensity     HDR radiance multiplier in linear space. Bloom only starts at PRESETS.bloom.threshold,
//                 so anything reflective must stay below it: max albedo * max key intensity < threshold.
//   temperatureK  physical temperature. Colour comes from kelvinToRgb(); shaders clamp display colour at 40000 K.
//   sizes         multiples of the body's own radius unless named otherwise.
//
// Emission rule (contract §2.1): look.emission describes HOW a cause looks. ENG draws it only when the
// body's own state allows it (body.emissive.cause === look.emission.cause, or cls star/neutronStar/blackHole
// which always carry their cause). Nothing in this file adds glow to an airless body.

export const LOOK_VERSION = 1;

export const STAGE_IDS = [
  'meteorite', 'asteroid', 'dwarf_planet', 'rocky_planet', 'gas_giant', 'gas_planet',
  'dwarf_star', 'star', 'giant_star', 'supergiant_star', 'neutron_star', 'black_hole',
];

// The atmospheric-entry fireball is an event/entry-driven VFX (PRESETS.vfx.entry), not a body.emissive cause.
// Mirror of interfaces.md §2.1 so ENG's ?debug=emitters overlay and tests can check looks against it.
export const ALLOWED_CAUSES = {
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

// ---------------------------------------------------------------------------------------------
// PRESETS: global render settings and the 12 stage presets
// ---------------------------------------------------------------------------------------------

export const PRESETS = {
  // toneMappingExposure multipliers. "day" = within a star's light; "deepSpace" = galactic-glow key only.
  exposure: { day: 1.0, deepSpace: 1.55, adaptSeconds: 1.6 },

  // UnrealBloomPass-style values on the half-float HDR target. Threshold is linear luminance.
  bloom: { threshold: 2.2, strength: 0.85, radius: 0.55 },

  // pitchDeg from the play plane (90 = straight down). distanceFactor * player.radius = camera distance,
  // which keeps the player at ~26-30 px radius on a 1080 px tall view at fovDeg.
  camera: { pitchDeg: 58, fovDeg: 38, distanceFactor: 54, topDownPitchDeg: 90 },

  // Per stage. skyTint = [deep void, nebula body]; keyColorK/keyIntensity = fallback key when SIM's
  // state.key has no host (deep space) and the reference brightness for that stage; ambient is the tiny
  // cool fill (R8: 0.02-0.05 of key, never warm). Extra fields (fovDeg, sky) are additive to the contract.
  stages: {
    meteorite: {
      skyTint: ['#07111F', '#2E5F8C'], keyColorK: 5800, keyIntensity: 2.2, ambient: '#1B2C44', ambientIntensity: 0.035,
      fovDeg: 38,
      sky: { nebula: 0.95, reflection: '#5E8FBF', emissionA: null, emissionB: null, dust: '#060B14', dustAmount: 0.45, starDensity: 1.0, galaxyBand: 0.15, sparkleFraction: 0.004, warp: 0.55 },
    },
    asteroid: {
      skyTint: ['#07101E', '#2C5A87'], keyColorK: 5800, keyIntensity: 2.2, ambient: '#1A2B42', ambientIntensity: 0.035,
      fovDeg: 38,
      sky: { nebula: 0.95, reflection: '#5A8BBB', emissionA: null, emissionB: null, dust: '#060A13', dustAmount: 0.5, starDensity: 1.0, galaxyBand: 0.15, sparkleFraction: 0.004, warp: 0.55 },
    },
    dwarf_planet: {
      skyTint: ['#070F1E', '#2B5784'], keyColorK: 5700, keyIntensity: 2.15, ambient: '#192A42', ambientIntensity: 0.035,
      fovDeg: 38,
      sky: { nebula: 0.9, reflection: '#5887B8', emissionA: null, emissionB: null, dust: '#060A13', dustAmount: 0.5, starDensity: 1.05, galaxyBand: 0.2, sparkleFraction: 0.004, warp: 0.6 },
    },
    rocky_planet: {
      skyTint: ['#070F20', '#2F5A8C'], keyColorK: 5772, keyIntensity: 2.2, ambient: '#182943', ambientIntensity: 0.04,
      fovDeg: 39,
      sky: { nebula: 0.9, reflection: '#5B8AC0', emissionA: null, emissionB: null, dust: '#050A14', dustAmount: 0.45, starDensity: 1.05, galaxyBand: 0.2, sparkleFraction: 0.004, warp: 0.6 },
    },
    gas_giant: {
      skyTint: ['#080E22', '#30508F'], keyColorK: 5772, keyIntensity: 2.15, ambient: '#1A2745', ambientIntensity: 0.04,
      fovDeg: 40,
      sky: { nebula: 0.85, reflection: '#5F84C6', emissionA: '#7A5BB0', emissionB: null, dust: '#060915', dustAmount: 0.45, starDensity: 1.1, galaxyBand: 0.25, sparkleFraction: 0.004, warp: 0.65 },
    },
    gas_planet: {
      skyTint: ['#090D22', '#3A4683'], keyColorK: 5400, keyIntensity: 2.0, ambient: '#1C2446', ambientIntensity: 0.04,
      fovDeg: 40,
      sky: { nebula: 0.85, reflection: '#6680C4', emissionA: '#8A4E9E', emissionB: null, dust: '#070914', dustAmount: 0.5, starDensity: 1.1, galaxyBand: 0.3, sparkleFraction: 0.004, warp: 0.65 },
    },
    dwarf_star: {
      skyTint: ['#080E22', '#355088'], keyColorK: 6000, keyIntensity: 2.0, ambient: '#1A2445', ambientIntensity: 0.045,
      fovDeg: 41,
      sky: { nebula: 1.0, reflection: '#5F88BE', emissionA: '#C8456E', emissionB: '#3FB8B0', dust: '#05080F', dustAmount: 0.6, starDensity: 1.2, galaxyBand: 0.35, sparkleFraction: 0.005, warp: 0.8 },
    },
    star: {
      skyTint: ['#080E22', '#33508A'], keyColorK: 6000, keyIntensity: 2.2, ambient: '#1A2545', ambientIntensity: 0.045,
      fovDeg: 41,
      sky: { nebula: 1.0, reflection: '#5D88C2', emissionA: '#C8456E', emissionB: '#3FB8B0', dust: '#05080F', dustAmount: 0.55, starDensity: 1.25, galaxyBand: 0.4, sparkleFraction: 0.005, warp: 0.8 },
    },
    giant_star: {
      skyTint: ['#0B0D1E', '#463F6C'], keyColorK: 4600, keyIntensity: 2.0, ambient: '#1E2142', ambientIntensity: 0.04,
      fovDeg: 42,
      sky: { nebula: 0.95, reflection: '#5C7AB4', emissionA: '#B8475A', emissionB: '#C98A5A', dust: '#08070C', dustAmount: 0.65, starDensity: 1.3, galaxyBand: 0.5, sparkleFraction: 0.005, warp: 0.85 },
    },
    supergiant_star: {
      skyTint: ['#080B1E', '#3A3F72'], keyColorK: 7000, keyIntensity: 2.1, ambient: '#1B2146', ambientIntensity: 0.04,
      fovDeg: 42,
      sky: { nebula: 1.0, reflection: '#6A86CC', emissionA: '#C8456E', emissionB: '#4FC2C8', dust: '#06070F', dustAmount: 0.6, starDensity: 1.4, galaxyBand: 0.6, sparkleFraction: 0.006, warp: 0.9 },
    },
    neutron_star: {
      skyTint: ['#04070E', '#1F2E55'], keyColorK: 8000, keyIntensity: 1.6, ambient: '#111A2E', ambientIntensity: 0.03,
      fovDeg: 40,
      sky: { nebula: 0.7, reflection: '#4A6AA6', emissionA: '#B2405E', emissionB: '#3FB8B0', dust: '#03050A', dustAmount: 0.55, starDensity: 1.3, galaxyBand: 0.75, sparkleFraction: 0.005, warp: 1.0, filaments: 0.8 },
    },
    black_hole: {
      skyTint: ['#03050B', '#1C2B4E'], keyColorK: 6500, keyIntensity: 1.4, ambient: '#0E1528', ambientIntensity: 0.025,
      fovDeg: 40,
      sky: { nebula: 0.75, reflection: '#4E6FA8', emissionA: null, emissionB: null, dust: '#03040A', dustAmount: 0.5, starDensity: 1.5, galaxyBand: 1.0, sparkleFraction: 0.005, warp: 0.7 },
    },
  },

  // HUD/outline colours only. NEVER applied to lit materials (contract §2.1, §5 req. 4).
  relation: { prey: '#5FF0C0', neutral: '#A9BCD9', threat: '#FF5E73' },

  // ---- Additive presets (not in the contract shape; consumers ignore what they do not use) ----

  // Accessibility swap for relation colours (art-bible §12).
  relationHighContrast: { prey: '#7CFFD4', neutral: '#E6EEFA', threat: '#FF9F1C' },

  // HUD art direction hints for UI (art-bible §2). UI owns layout; no fire/ember imagery.
  ui: { accent: '#22D3EE', track: '#05080F', text: '#EAF0FF', textDim: '#8F9BC7', panel: '#0A1530', panelAlpha: 0.72, line: '#DCE6F5' },

  // Post-processing recipe (art-bible §8). Order: HDR scene > bloom > tone map > grade > vignette > grain.
  post: {
    toneMapping: 'AgX',              // fallback 'ACESFilmic' if AgX is unavailable in the pinned build
    hdrType: 'HalfFloat',
    bloomMips: 5,
    bloomResolutionScale: 0.5,
    grade: { lift: '#05080F', gamma: 1.0, gain: '#FFFFFF', saturation: 0.95, contrast: 1.04, shadowTint: '#0A1424', shadowTintAmount: 0.08 },
    vignette: { darkness: 0.32, offset: 1.05 },
    grain: { intensity: 0.035, size: 1.4, animated: true, lumaWeight: 0.6 },
    chromaticAberration: { idle: 0.0, onHit: 0.0025, decaySeconds: 0.25 },
    hitDesaturate: { amount: 0.35, decaySeconds: 0.4 },
    reducedMotion: { grainAnimated: false, chromaticAberration: 0, shakeScale: 0, flashScale: 0.5 },
  },

  // HUD-style overlay pass drawn by ENG over the lit scene (screen-constant widths).
  overlay: {
    orbitLine: { color: '#DCE6F5', alpha: 0.28, alphaFar: 0.08, widthPx: 1.25, segments: 128 },
    trajectory: { color: '#DCE6F5', alpha: 0.45, widthPx: 1.5, dashPx: [6, 6], fadeEnd: 0.15 },
    relationRing: { widthPx: 1.5, threatWidthPx: 2.5, gapPx: 4, alpha: 0.55, pulseHz: 0.6, crossfadeSeconds: 0.25, minScreenRadiusPx: 4 },
    targetBracket: { color: '#DCE6F5', alpha: 0.7, widthPx: 1.5, segments: 4, gapDeg: 30, radiusScale: 1.6 },
    readability: { relationRingAlpha: 0.9, widthScale: 1.6 },
  },

  // VFX looks (art-bible §9). Temperatures drive kelvinToRgb; no smoke, no flame, no warm additive on rocks.
  vfx: {
    impactFlash: { temperatureK: 7000, intensity: 9, durationMs: 80, radiusScale: 0.6, cause: 'impact-flash' },
    ejecta: {
      cause: 'hot-debris',
      startK: 5500, coolingK: [5500, 3500, 2200, 1400, 900], coolSeconds: [0.3, 2.0],
      startIntensity: 4.0, minVisibleK: 800, countPerEnergy: [12, 90], cone: 0.6, ballistic: true,
    },
    dust: { color: '#8C8F96', alpha: 0.45, blending: 'normal', lifeSeconds: [0.8, 2.5], expand: 2.2 }, // lit, non-additive
    thrustMotes: { color: '#7D7F86', alpha: 0.5, blending: 'normal', perSecond: 18, speed: 0.6, lifeSeconds: 0.9, size: 0.03 },
    absorb: {
      gentle: { mode: 'lit-dust', color: '#B9BEC8', spiralTurns: 1.25, seconds: 0.7 },
      energetic: { mode: 'hot-debris', startK: 4500, spiralTurns: 1.5, seconds: 0.9 },
      shells: { count: [2, 4], particlesPerShell: [40, 160], shellSpacing: 0.35, sizePx: [1.0, 2.2] },
      contactFlash: { temperatureK: 6500, intensity: 3.5, durationMs: 120 },
    },
    roche: {
      stretchMax: 2.6, streamWidth: 0.18, fragmentSizeRange: [0.04, 0.2], spiralTurns: 1.75,
      starStreamK: [6000, 3800], starStreamIntensity: 5.5,
      tdeFlare: { temperatureK: 18000, intensity: 22, seconds: 1.4 },
    },
    entry: {
      cause: 'atmospheric-entry', headK: 5200, tailK: 2400, intensity: 6, tailLength: 6, bowWidth: 1.4,
      sparksPerSecond: 60, airTint: { terrestrial: '#9FC4FF', desert: '#E8B48A', venusian: '#F2DFA6', default: '#C9D7EE' },
    },
    evolve: {
      inhaleSeconds: 0.4, flashRing: { color: '#EAF0FF', intensity: 6, seconds: 0.5, widthScale: 0.08 },
      morphSeconds: 0.8, paletteCrossfadeSeconds: 1.5, pullbackFactor: 1.9, pitchSwingDeg: 14,
    },
    death: { slowmo: 0.25, seconds: 2.2, flashK: 7000 },
    capture: { lensingBoost: [0, 0.35, 0.7, 1.1, 1.6], vignetteTint: '#000000', starStretch: 0.5 },
    shake: { absorbSmall: 0.08, bump: 0.18, hit: 0.5, evolve: 0.3, maxOffsetScreen: 0.008, rollDeg: 1.2, decay: 1.6 },
  },
};

// ---------------------------------------------------------------------------------------------
// Pure helpers (exported for ENG/UI; deterministic)
// ---------------------------------------------------------------------------------------------

/** Blackbody colour as sRGB [r,g,b] in 0..1 (Tanner Helland fit, clamped 1000..40000 K). */
export function kelvinToRgb(tempK) {
  const t = Math.min(40000, Math.max(1000, tempK || 0)) / 100;
  let r, g, b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v) => Math.min(255, Math.max(0, v)) / 255;
  return [c(r), c(g), c(b)];
}

/** Blackbody colour as '#RRGGBB'. */
export function kelvinToHex(tempK) {
  return rgbToHex(kelvinToRgb(tempK));
}

function rgbToHex([r, g, b]) {
  const h = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function mixHex(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

function shadeHex(a, k) {
  const x = hexToRgb(a);
  return rgbToHex([x[0] * k, x[1] * k, x[2] * k]);
}

// FNV-1a over a string, then a murmur-style finaliser. Seeded only by getLook's own arguments.
function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

function mix32(a, b) {
  let h = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

function makeRng(seed32) {
  let a = seed32 >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a, b, t) => a + (b - a) * t;
const range = (rnd, [a, b]) => lerp(a, b, rnd());
const round3 = (v) => Math.round(v * 1000) / 1000;

function pickWeighted(rnd, table) {
  let total = 0;
  for (const k in table) total += table[k];
  let x = rnd() * total;
  for (const k in table) { x -= table[k]; if (x <= 0) return k; }
  return Object.keys(table)[0];
}

// ---------------------------------------------------------------------------------------------
// Variant aliases: SIM may pass stage-choice ids (stages.js flags) or short names; both work.
// ---------------------------------------------------------------------------------------------

const VARIANT_ALIASES = {
  // stage 2 trajectory
  frozen_fortress: 'ice', cradle_of_life_seed: 'tholin', war_planet: 'scarred',
  // stage 3 planetType (already short)
  // stage 4 gasType
  ringed_giant: 'ringed', storm_giant: 'storm', ice_giant: 'ice',
  // stage 6 starType
  yellow_dwarf: 'yellow', red_dwarf: 'red', blue_dwarf: 'blue',
  // generic
  stony: 'stony', chondrite: 'stony', 'c-type': 'carbonaceous', 's-type': 'silicate', 'm-type': 'metal',
  ceres: 'ceres', pluto: 'tholin', eris: 'ice', mercury: 'barren', mars: 'desert', venus: 'venusian',
  jupiter: 'jovian', saturn: 'ringed', neptune: 'ice', uranus: 'ice',
};

function normVariant(v) {
  if (v == null || v === '') return null;
  const k = String(v).toLowerCase();
  return VARIANT_ALIASES[k] || k;
}

// ---------------------------------------------------------------------------------------------
// Class and variant tables. `extras` keys are specified in docs/material-spec.md §4.
// Ranges [a, b] are sampled per seed; scalars are fixed.
// ---------------------------------------------------------------------------------------------

// Small bodies: meteorite, asteroid, debris, fragment, comet nucleus.
const ROCK = {
  stony: {
    palette: { base: '#6E6862', alt: '#5A554F', accent: '#8C857C', shadow: '#1C1A18', extra: ['#3A3734'] },
    albedo: [0.10, 0.22], roughness: [0.88, 0.96], metalness: 0.0,
    craters: { density: [0.55, 0.8], sizeExp: 2.0 },
    regolith: { grainScale: 38, grainAmp: 0.22, slopeBrighten: 0.18, fresh: '#9A938A' },
  },
  iron: {
    palette: { base: '#6C6E72', alt: '#5B5D61', accent: '#9EA2A8', shadow: '#17181A', extra: ['#3D3A36'] },
    albedo: [0.14, 0.28], roughness: [0.42, 0.6], metalness: 0.8,
    craters: { density: [0.15, 0.3], sizeExp: 2.2 },
    regolith: { grainScale: 24, grainAmp: 0.1, slopeBrighten: 0.06, fresh: '#B4B8BE' },
    regmaglypts: { scale: 7, depth: 0.035 },
  },
  carbonaceous: {
    palette: { base: '#3A3734', alt: '#2F2D2B', accent: '#4E4A45', shadow: '#0C0B0A', extra: ['#55504A'] },
    albedo: [0.03, 0.08], roughness: [0.92, 0.98], metalness: 0.0,
    craters: { density: [0.6, 0.9], sizeExp: 2.0 },
    regolith: { grainScale: 42, grainAmp: 0.25, slopeBrighten: 0.22, fresh: '#6A645C' },
  },
  silicate: {
    palette: { base: '#7E7368', alt: '#8A7C6C', accent: '#A39684', shadow: '#1E1A16', extra: ['#5F564C'] },
    albedo: [0.15, 0.25], roughness: [0.85, 0.94], metalness: 0.0,
    craters: { density: [0.55, 0.85], sizeExp: 2.0 },
    regolith: { grainScale: 36, grainAmp: 0.2, slopeBrighten: 0.2, fresh: '#B0A390' },
  },
  metal: {
    palette: { base: '#76787C', alt: '#686A6F', accent: '#A7ABB2', shadow: '#18191B', extra: ['#4F4A44'] },
    albedo: [0.10, 0.20], roughness: [0.5, 0.68], metalness: 0.7,
    craters: { density: [0.35, 0.6], sizeExp: 2.1 },
    regolith: { grainScale: 30, grainAmp: 0.12, slopeBrighten: 0.1, fresh: '#B8BCC2' },
  },
  icy: {
    palette: { base: '#2E2C2B', alt: '#3A3633', accent: '#C9D6E2', shadow: '#0A0A0B', extra: ['#7F8C99'] },
    albedo: [0.03, 0.06], roughness: [0.9, 0.97], metalness: 0.0,
    craters: { density: [0.3, 0.5], sizeExp: 2.0 },
    regolith: { grainScale: 40, grainAmp: 0.2, slopeBrighten: 0.15, fresh: '#8E9AA6' },
    icePatches: { coverage: [0.04, 0.12], color: '#C9D6E2', albedo: 0.55 },
  },
};

const ROCK_DEFAULTS = {
  meteorite: { stony: 0.6, iron: 0.2, carbonaceous: 0.2 },
  asteroid: { carbonaceous: 0.55, silicate: 0.3, metal: 0.15 },
  debris: { stony: 0.5, carbonaceous: 0.3, silicate: 0.2 },
  fragment: { stony: 0.6, carbonaceous: 0.4 },
  comet: { icy: 1 },
};

// Shape families for irregular bodies (research §1.3 "not spheres").
const SHAPES = {
  meteorite: { potato: 0.55, shard: 0.35, peanut: 0.1 },
  asteroid: { potato: 0.45, peanut: 0.2, spinningTop: 0.15, contactBinary: 0.1, rubble: 0.1 },
  debris: { shard: 0.6, potato: 0.4 },
  fragment: { shard: 0.7, potato: 0.3 },
  comet: { peanut: 0.5, potato: 0.5 },
};

const SHAPE_PARAMS = {
  potato: { elong: [[1.0, 1.0], [0.72, 0.9], [0.6, 0.8]], lumpAmp: [0.18, 0.28], lumpFreq: [0.9, 1.4], ridge: 0.15 },
  shard: { elong: [[1.0, 1.0], [0.55, 0.75], [0.4, 0.6]], lumpAmp: [0.22, 0.34], lumpFreq: [1.3, 2.0], ridge: 0.55 },
  peanut: { elong: [[1.0, 1.0], [0.6, 0.72], [0.55, 0.68]], lumpAmp: [0.14, 0.22], lumpFreq: [0.8, 1.2], ridge: 0.1, waist: [0.25, 0.4] },
  spinningTop: { elong: [[1.0, 1.0], [0.95, 1.0], [0.75, 0.85]], lumpAmp: [0.08, 0.14], lumpFreq: [1.0, 1.5], ridge: 0.1, equatorRidge: [0.12, 0.2] },
  contactBinary: { elong: [[1.0, 1.0], [0.58, 0.68], [0.5, 0.62]], lumpAmp: [0.12, 0.2], lumpFreq: [0.9, 1.3], ridge: 0.1, waist: [0.45, 0.6] },
  rubble: { elong: [[1.0, 1.0], [0.8, 0.95], [0.7, 0.88]], lumpAmp: [0.2, 0.3], lumpFreq: [2.0, 3.0], ridge: 0.3, boulders: [0.5, 0.9] },
};

// Spin presentation per class (rad/s of game time; SIM's body.spin is authoritative, this is the visual tumble).
const TUMBLE = {
  meteorite: { wobble: [0.25, 0.6], precession: [0.05, 0.2] },
  asteroid: { wobble: [0.1, 0.35], precession: [0.03, 0.12] },
  debris: { wobble: [0.4, 0.9], precession: [0.1, 0.3] },
  fragment: { wobble: [0.5, 1.2], precession: [0.1, 0.4] },
  comet: { wobble: [0.05, 0.2], precession: [0.02, 0.06] },
};

const DWARF = {
  ceres: {
    palette: { base: '#5E5A55', alt: '#6A655E', accent: '#E8ECEF', shadow: '#151413', extra: ['#3E3B37'] },
    albedo: [0.08, 0.12], roughness: 0.92, metalness: 0,
    craters: { density: [0.7, 0.9], sizeExp: 2.0 },
    atmosphere: null,
    extras: { saltSpots: { count: [1, 3], size: [0.03, 0.07], color: '#F2F4F5', albedo: 0.6 }, plains: null, iceCaps: null, rays: { count: [1, 3], brightness: 0.12 } },
  },
  tholin: { // Pluto-like: nitrogen plains, reddish tholins, thin haze (Cradle of Life)
    palette: { base: '#9A6F55', alt: '#B08466', accent: '#EDE6DC', shadow: '#1C130F', extra: ['#5B3426', '#D9C9B8'] },
    albedo: [0.35, 0.6], roughness: 0.8, metalness: 0,
    craters: { density: [0.25, 0.45], sizeExp: 2.1 },
    atmosphere: { tint: '#8FB3E8', thickness: 0.18, mie: 0.55 },
    extras: { plains: { coverage: [0.2, 0.35], color: '#EDE6DC', cellScale: 9, smooth: 0.85 }, saltSpots: null, iceCaps: { lat: [0.7, 0.85], color: '#E6EDF2' }, rays: null, hazeLayers: 3 },
  },
  ice: { // Eris-like bright ice (Frozen Fortress)
    palette: { base: '#C9D3DC', alt: '#DCE3EA', accent: '#F4F7FA', shadow: '#2A3442', extra: ['#8EA3B8', '#6E8197'] },
    albedo: [0.55, 0.85], roughness: 0.55, metalness: 0,
    craters: { density: [0.2, 0.4], sizeExp: 2.1 },
    atmosphere: null,
    extras: { plains: { coverage: [0.1, 0.25], color: '#F4F7FA', cellScale: 7, smooth: 0.9 }, fractures: { scale: 5, width: 0.04, color: '#6E8197' }, shadowTint: '#3A5A85', iceCaps: null, saltSpots: null, rays: null, subsurface: 0.2 },
  },
  scarred: { // War Planet: ancient, saturated with craters, bright fresh ejecta rays
    palette: { base: '#4C4844', alt: '#57524C', accent: '#A69E93', shadow: '#0F0E0D', extra: ['#2B2826', '#7A2E22'] },
    albedo: [0.07, 0.14], roughness: 0.94, metalness: 0,
    craters: { density: [0.95, 1.0], sizeExp: 1.8 },
    atmosphere: null,
    extras: { rays: { count: [3, 6], brightness: 0.25 }, saltSpots: null, plains: null, iceCaps: null, basins: { count: [1, 2], size: [0.25, 0.4], depth: 0.04 } },
  },
  snowcap: { // Generic icy-rock dwarf: rock with bright polar ice (reference images 2 and 9)
    palette: { base: '#6F6A64', alt: '#7C766E', accent: '#F2F5F8', shadow: '#16151A', extra: ['#AFC3D6'] },
    albedo: [0.12, 0.55], roughness: 0.82, metalness: 0,
    craters: { density: [0.5, 0.75], sizeExp: 2.0 },
    atmosphere: null,
    extras: { iceCaps: { lat: [0.35, 0.6], color: '#F2F5F8', noise: 0.25 }, saltSpots: null, plains: null, rays: { count: [0, 2], brightness: 0.1 } },
  },
};
const DWARF_DEFAULTS = { ceres: 0.3, snowcap: 0.3, tholin: 0.2, ice: 0.1, scarred: 0.1 };

const ROCKY = {
  terrestrial: {
    palette: { base: '#2F5F3A', alt: '#6E6247', accent: '#F2F4F6', shadow: '#0A1420', extra: ['#0E2F5A', '#163E70', '#C9B38A', '#E8EEF2'] },
    albedo: [0.06, 0.8], roughness: 0.85, metalness: 0,
    craters: null, bands: null,
    atmosphere: { tint: '#5C9BFF', thickness: 0.55, mie: 0.72 },
    extras: {
      seaLevel: [0.48, 0.6], ocean: { deep: '#0A2347', shallow: '#17507F', roughness: 0.22, specular: 0.5 },
      land: { low: '#3D6B37', mid: '#7A7150', high: '#A79A86', desert: '#B79A6B' }, iceCaps: { lat: [0.72, 0.85], color: '#EEF3F7' },
      clouds: { coverage: [0.4, 0.58], scale: 3.2, warp: 0.9, speed: 0.004, color: '#F4F6F8', albedo: 0.7, shadow: 0.35 },
      heightOctaves: 6, mountainRidge: 0.35,
    },
  },
  lava: {
    palette: { base: '#1E1A19', alt: '#2A2321', accent: '#FF8A3D', shadow: '#070606', extra: ['#3B302B'] },
    albedo: [0.04, 0.09], roughness: 0.9, metalness: 0,
    craters: { density: [0.1, 0.25], sizeExp: 2.2 }, bands: null,
    atmosphere: { tint: '#9A8C80', thickness: 0.12, mie: 0.8 },
    emission: { temperatureK: 1250, intensity: 2.4, cause: 'hot-ground' },
    extras: {
      cracks: { scale: [5, 8], width: [0.035, 0.06], tempK: [1100, 1450], falloff: 2.2, flowSpeed: 0.002 },
      meltSeas: { level: [0.3, 0.42], tempK: 1050, crustNoise: 0.6 },
      daySideEmissionScale: 0.35, // emission is under the sun on the lit side; dominant on the night side (R2)
    },
  },
  metallic: {
    palette: { base: '#7C8087', alt: '#6B6F76', accent: '#B9BEC6', shadow: '#121315', extra: ['#4A4540', '#9A8E80'] },
    albedo: [0.12, 0.3], roughness: 0.38, metalness: 0.85,
    craters: { density: [0.15, 0.35], sizeExp: 2.2 }, bands: null,
    atmosphere: null,
    extras: { fractures: { scale: 4, width: 0.02, depth: 0.03 }, scarps: { count: [2, 5], height: 0.02 }, anisotropy: 0.3 },
  },
  desert: { // Mars-like
    palette: { base: '#A0583A', alt: '#B8754F', accent: '#E8D6C2', shadow: '#1D0F0A', extra: ['#5E2F1F', '#D8A47E'] },
    albedo: [0.15, 0.3], roughness: 0.9, metalness: 0,
    craters: { density: [0.35, 0.55], sizeExp: 2.0 }, bands: null,
    atmosphere: { tint: '#D9A27A', thickness: 0.12, mie: 0.6 },
    extras: { iceCaps: { lat: [0.82, 0.92], color: '#F0EEEA' }, dustAlbedo: '#C98A63', canyons: { scale: 3, width: 0.03 } },
  },
  barren: { // Mercury-like
    palette: { base: '#6A6662', alt: '#7A7570', accent: '#A9A39C', shadow: '#121110', extra: ['#4A4643'] },
    albedo: [0.09, 0.15], roughness: 0.93, metalness: 0,
    craters: { density: [0.8, 1.0], sizeExp: 1.9 }, bands: null,
    atmosphere: null,
    extras: { rays: { count: [2, 4], brightness: 0.18 }, scarps: { count: [1, 3], height: 0.015 } },
  },
  venusian: {
    palette: { base: '#D8C08A', alt: '#E6D3A4', accent: '#F4EAD0', shadow: '#2A2214', extra: ['#BFA06A'] },
    albedo: [0.65, 0.78], roughness: 1.0, metalness: 0,
    craters: null, bands: { count: 5, warp: 0.6 },
    atmosphere: { tint: '#F0DCA8', thickness: 0.9, mie: 0.8 },
    extras: { clouds: { coverage: [1, 1], scale: 2.0, warp: 1.4, speed: 0.008, color: '#EFE2BE', albedo: 0.75, shadow: 0.0 }, chevrons: 0.5 },
  },
};
const ROCKY_DEFAULTS = { terrestrial: 0.2, desert: 0.25, barren: 0.25, metallic: 0.1, lava: 0.1, venusian: 0.1 };

const GAS = {
  jovian: {
    palette: { base: '#C9A27A', alt: '#D8B892', accent: '#EFE2CC', shadow: '#2B1C12', extra: ['#8E5A3A', '#B87A50', '#E8D7BC', '#A0522D'] },
    albedo: [0.45, 0.55], bands: { count: 14, warp: 0.32 },
    atmosphere: { tint: '#E4D2B6', thickness: 0.22, mie: 0.6 },
    extras: { shear: 0.45, turbulence: 0.35, storms: { count: [2, 6], size: [0.03, 0.08], greatSpot: [0.12, 0.18], spotColor: '#B5553A' }, flowSpeed: 0.006, polarDarken: 0.35, ringChance: 0.15 },
  },
  ringed: { // Saturn-like
    palette: { base: '#D9C59A', alt: '#E4D3AE', accent: '#F3EAD3', shadow: '#2E2516', extra: ['#BFA270', '#C9B07E', '#EADDBB'] },
    albedo: [0.45, 0.55], bands: { count: 18, warp: 0.18 },
    atmosphere: { tint: '#EADFC4', thickness: 0.28, mie: 0.65 },
    extras: {
      shear: 0.25, turbulence: 0.15, storms: { count: [0, 2], size: [0.02, 0.05], greatSpot: [0, 0], spotColor: '#E8DCC0' }, flowSpeed: 0.004, polarDarken: 0.25, polarHexagon: 0.4,
      ring: { inner: 1.3, outer: 2.35, opacity: 0.8, gaps: [3, 6], cassini: [0.6, 0.66], colors: ['#CDBB98', '#A8987C', '#E6D8BC'], forwardScatter: 0.6, grain: 0.35 },
      ringChance: 1.0,
    },
  },
  storm: {
    palette: { base: '#B88560', alt: '#C99872', accent: '#F2E6D4', shadow: '#24150D', extra: ['#7A4128', '#A85E36', '#E3CFB1', '#8C2F1F'] },
    albedo: [0.4, 0.52], bands: { count: 16, warp: 0.55 },
    atmosphere: { tint: '#E0CCAE', thickness: 0.2, mie: 0.6 },
    extras: { shear: 0.8, turbulence: 0.7, storms: { count: [5, 12], size: [0.03, 0.1], greatSpot: [0.16, 0.24], spotColor: '#A8432C' }, flowSpeed: 0.01, polarDarken: 0.4, lightning: 0, ringChance: 0.05 },
  },
  ice: { // Neptune/Uranus-like ice giant
    palette: { base: '#4C7FC4', alt: '#5E93D2', accent: '#BFD9F2', shadow: '#0B1A33', extra: ['#2E5AA0', '#7FB0E0', '#E8F2FA'] },
    albedo: [0.28, 0.42], bands: { count: 8, warp: 0.2 },
    atmosphere: { tint: '#8FC0FF', thickness: 0.5, mie: 0.4 },
    extras: { shear: 0.3, turbulence: 0.2, storms: { count: [1, 3], size: [0.04, 0.09], greatSpot: [0.08, 0.12], spotColor: '#22447E' }, brightClouds: { count: [2, 6], color: '#F2F7FC' }, flowSpeed: 0.005, polarDarken: 0.15, ringChance: 0.25 },
  },
};
const GAS_DEFAULTS = { jovian: 0.45, ringed: 0.25, storm: 0.1, ice: 0.2 };

// Star classes and variants: temperatureK range, emission intensity, granulation (reference: "granulated textured stars").
const STAR_CLASS = {
  dwarf: { gran: { cellsPerRadius: [22, 30], contrast: [0.22, 0.3] }, intensity: 7, limbU: 0.62, corona: { size: 1.6, intensity: 0.5 }, flares: 0.15, spots: [0.02, 0.08] },
  main: { gran: { cellsPerRadius: [18, 26], contrast: [0.2, 0.28] }, intensity: 10, limbU: 0.6, corona: { size: 1.8, intensity: 0.55 }, flares: 0.1, spots: [0.01, 0.06] },
  giant: { gran: { cellsPerRadius: [6, 10], contrast: [0.3, 0.4] }, intensity: 8, limbU: 0.7, corona: { size: 2.0, intensity: 0.45 }, flares: 0.05, spots: [0.0, 0.03], massLoss: 0.35 },
  supergiant: { gran: { cellsPerRadius: [3, 6], contrast: [0.35, 0.48] }, intensity: 12, limbU: 0.72, corona: { size: 2.3, intensity: 0.6 }, flares: 0.04, spots: [0.0, 0.02], massLoss: 0.55 },
};
const STAR_TEMP = {
  dwarf: { red: [3000, 3500], yellow: [5300, 5900], blue: [9500, 12000], default: { red: 0.6, yellow: 0.3, blue: 0.1 } },
  main: { red: [4000, 4800], yellow: [5500, 6300], blue: [7000, 9500], default: { red: 0.25, yellow: 0.55, blue: 0.2 } },
  giant: { red: [3500, 4000], yellow: [4300, 5200], blue: [8000, 11000], default: { red: 0.55, yellow: 0.35, blue: 0.1 } },
  supergiant: { red: [3300, 3800], yellow: [5500, 7000], blue: [11000, 20000], default: { red: 0.5, yellow: 0.1, blue: 0.4 } },
};
const STAGE_TO_STARCLASS = { dwarf_star: 'dwarf', star: 'main', giant_star: 'giant', supergiant_star: 'supergiant' };

// ---------------------------------------------------------------------------------------------
// Builders (one per class family). Each returns a fresh Look.
// ---------------------------------------------------------------------------------------------

function buildRock(cls, variant, rnd) {
  const type = ROCK[variant] ? variant : pickWeighted(rnd, ROCK_DEFAULTS[cls] || ROCK_DEFAULTS.asteroid);
  const t = ROCK[type];
  const shapeName = pickWeighted(rnd, SHAPES[cls] || SHAPES.asteroid);
  const sp = SHAPE_PARAMS[shapeName];
  const tumble = TUMBLE[cls] || TUMBLE.asteroid;
  const base = mixHex(t.palette.base, t.palette.alt, rnd());
  const extras = {
    rockType: type,
    shape: {
      family: shapeName,
      axes: sp.elong.map((r) => round3(range(rnd, r))),
      lumpAmp: round3(range(rnd, sp.lumpAmp)),
      lumpFreq: round3(range(rnd, sp.lumpFreq)),
      ridge: sp.ridge,
      waist: sp.waist ? round3(range(rnd, sp.waist)) : 0,
      equatorRidge: sp.equatorRidge ? round3(range(rnd, sp.equatorRidge)) : 0,
      boulders: sp.boulders ? round3(range(rnd, sp.boulders)) : 0,
    },
    regolith: { ...t.regolith },
    craterProfile: { rimHeight: 0.18, rimWidth: 0.55, floor: -0.35, depth: 0.12, smooth: 0.25, ejecta: 0.12, layers: 3 },
    lighting: { model: 'lommel-seeliger', lambertMix: 0.35, opposition: 0.35, oppositionWidth: 0.08, wrap: 0.0 },
    tumble: { wobble: round3(range(rnd, tumble.wobble)), precession: round3(range(rnd, tumble.precession)) },
    fusionCrust: cls === 'meteorite' ? round3(rnd() * 0.6) : 0,
  };
  if (t.regmaglypts) extras.regmaglypts = { ...t.regmaglypts };
  if (t.icePatches) extras.icePatches = { ...t.icePatches, coverage: round3(range(rnd, t.icePatches.coverage)) };
  if (cls === 'comet') {
    extras.coma = { dustTint: '#CBBFA8', ionTint: '#7FB8FF', size: 6, dustTailLength: 22, ionTailLength: 40, dustCurve: 0.35, litOnly: true };
  }
  if (cls === 'fragment') {
    // Cooling ramp for fragment.emissive.cause === 'hot-debris'. SIM may pass the parent cls as variant ('star' => star matter).
    extras.hotDebris = { cause: 'hot-debris', startK: variant === 'star' ? 5800 : 2600, coolSeconds: 3.0, intensity: variant === 'star' ? 5.5 : 2.5 };
  }
  return {
    palette: { base, accent: t.palette.accent, shadow: t.palette.shadow, extra: [...t.palette.extra] },
    albedo: [...t.albedo],
    roughness: round3(range(rnd, t.roughness)),
    metalness: t.metalness,
    craters: { density: round3(range(rnd, t.craters.density)), sizeExp: t.craters.sizeExp },
    bands: null,
    emission: null,
    atmosphere: null,
    extras,
  };
}

function buildDwarf(variant, rnd) {
  const key = DWARF[variant] ? variant : pickWeighted(rnd, DWARF_DEFAULTS);
  const d = DWARF[key];
  const extras = { variant: key, lighting: { model: 'lommel-seeliger', lambertMix: key === 'ice' ? 0.7 : 0.4, opposition: 0.25, oppositionWidth: 0.08, wrap: 0.0 }, craterProfile: { rimHeight: 0.12, rimWidth: 0.5, floor: -0.3, depth: 0.05, smooth: 0.3, ejecta: 0.15, layers: 4 }, displacement: { amp: 0.025, freq: 1.6, octaves: 5 } };
  for (const [k, v] of Object.entries(d.extras)) extras[k] = sampleObj(v, rnd);
  return {
    palette: { base: mixHex(d.palette.base, d.palette.alt, rnd()), accent: d.palette.accent, shadow: d.palette.shadow, extra: [...d.palette.extra] },
    albedo: [...d.albedo], roughness: d.roughness, metalness: d.metalness,
    craters: d.craters ? { density: round3(range(rnd, d.craters.density)), sizeExp: d.craters.sizeExp } : null,
    bands: null, emission: null,
    atmosphere: d.atmosphere ? { ...d.atmosphere } : null,
    extras,
  };
}

function buildRocky(variant, rnd) {
  const key = ROCKY[variant] ? variant : pickWeighted(rnd, ROCKY_DEFAULTS);
  const p = ROCKY[key];
  const extras = { variant: key, lighting: { model: p.atmosphere ? 'lambert' : 'lommel-seeliger', lambertMix: 0.6, opposition: p.atmosphere ? 0 : 0.2, oppositionWidth: 0.08, wrap: p.atmosphere ? 0.06 : 0.0 }, displacement: { amp: key === 'venusian' ? 0 : 0.012, freq: 1.4, octaves: 6 } };
  for (const [k, v] of Object.entries(p.extras)) extras[k] = sampleObj(v, rnd);
  return {
    palette: { base: mixHex(p.palette.base, p.palette.alt, rnd() * 0.5), accent: p.palette.accent, shadow: p.palette.shadow, extra: [...p.palette.extra] },
    albedo: [...p.albedo], roughness: p.roughness, metalness: p.metalness,
    craters: p.craters ? { density: round3(range(rnd, p.craters.density)), sizeExp: p.craters.sizeExp } : null,
    bands: p.bands ? { ...p.bands } : null,
    emission: p.emission ? { ...p.emission, temperatureK: Math.round(p.emission.temperatureK + (rnd() - 0.5) * 150) } : null,
    atmosphere: p.atmosphere ? { ...p.atmosphere } : null,
    extras,
  };
}

function buildGas(variant, rnd) {
  const key = GAS[variant] ? variant : pickWeighted(rnd, GAS_DEFAULTS);
  const g = GAS[key];
  const extras = { variant: key, lighting: { model: 'lambert', lambertMix: 1, opposition: 0, oppositionWidth: 0, wrap: 0.1 }, limbDarkening: 0.4, bandSeed: round3(rnd() * 100) };
  for (const [k, v] of Object.entries(g.extras)) extras[k] = sampleObj(v, rnd);
  if (!extras.ring) {
    extras.ring = { inner: 1.4, outer: 2.0, opacity: 0.3, gaps: 1 + Math.floor(rnd() * 2), cassini: 0.55, colors: ['#8C8580', '#6E6A66', '#B3ADA6'], forwardScatter: 0.5, grain: 0.5 };
  }
  extras.ringVisibleByDefault = rnd() < (g.extras.ringChance ?? 0);
  return {
    palette: { base: mixHex(g.palette.base, g.palette.alt, rnd()), accent: g.palette.accent, shadow: g.palette.shadow, extra: [...g.palette.extra] },
    albedo: [...g.albedo], roughness: 1.0, metalness: 0,
    craters: null,
    bands: { count: g.bands.count + Math.floor(rnd() * 5) - 2, warp: round3(g.bands.warp * lerp(0.85, 1.15, rnd())) },
    emission: null,
    atmosphere: { ...g.atmosphere },
    extras,
  };
}

function buildBrownDwarf(rnd) {
  const T = Math.round(lerp(1100, 1600, rnd()));
  return {
    palette: { base: '#4A1F2E', accent: '#8A3A4C', shadow: '#12070C', extra: ['#2C1019', '#6B2A3A', '#B0485A'] },
    albedo: [0.02, 0.06], roughness: 1.0, metalness: 0,
    craters: null,
    bands: { count: 12 + Math.floor(rnd() * 6), warp: round3(lerp(0.25, 0.45, rnd())) },
    // Very dim deep-red self-emission (research §1.3): stays BELOW the bloom threshold on purpose.
    emission: { temperatureK: T, intensity: 0.55, cause: 'stellar-remnant' },
    atmosphere: { tint: '#6A2C3E', thickness: 0.25, mie: 0.5 },
    extras: {
      shear: 0.35, turbulence: 0.3, flowSpeed: 0.004, polarDarken: 0.3, limbDarkening: 0.55,
      storms: { count: [1, 4], size: [0.04, 0.08], greatSpot: [0, 0], spotColor: '#2C1019' },
      emissionPattern: { beltBoost: 0.6, limbFade: 0.5 }, // belts (darker, deeper) leak more IR glow
      lighting: { model: 'lambert', lambertMix: 1, opposition: 0, oppositionWidth: 0, wrap: 0.08 },
    },
  };
}

function buildStar(stageId, variant, rnd) {
  const sc = STAGE_TO_STARCLASS[stageId] || 'main';
  const cls = STAR_CLASS[sc];
  const temps = STAR_TEMP[sc];
  const v = temps[variant] ? variant : pickWeighted(rnd, temps.default);
  const T = Math.round(range(rnd, temps[v]));
  return {
    palette: { base: kelvinToHex(T), accent: kelvinToHex(T * 1.25), shadow: kelvinToHex(T * 0.6), extra: [kelvinToHex(T * 0.8)] },
    albedo: [0, 0], roughness: 1, metalness: 0,
    craters: null, bands: null,
    emission: { temperatureK: T, intensity: cls.intensity, cause: 'star' },
    atmosphere: null,
    extras: {
      starClass: sc, variant: v,
      granulation: {
        cellsPerRadius: round3(range(rnd, cls.gran.cellsPerRadius)), contrast: round3(range(rnd, cls.gran.contrast)),
        laneWidth: 0.12, flowSpeed: sc === 'supergiant' ? 0.015 : 0.04, octaves: 2, superGranulation: 0.25,
      },
      spots: { coverage: round3(range(rnd, cls.spots)), umbraScale: 0.65, penumbraScale: 0.85, scale: 3.5 },
      faculae: 0.12,
      limbU: cls.limbU, limbRedden: 0.15,
      corona: { ...cls.corona }, // billboard halo; keep below threshold except near the disc edge
      flares: { rate: cls.flares, prominenceHeight: 0.15 },
      massLoss: cls.massLoss ? { shell: cls.massLoss, radius: 2.2, color: kelvinToHex(T * 0.7) } : null,
      pulse: sc === 'giant' ? { amp: 0.03, periodSeconds: 9 } : null,
    },
  };
}

function buildNeutron(rnd) {
  const T = Math.round(lerp(4e5, 1e6, rnd()));
  return {
    palette: { base: '#DCE8FF', accent: '#B9A8FF', shadow: '#7F9CFF', extra: ['#F4F8FF'] },
    albedo: [0, 0], roughness: 1, metalness: 0,
    craters: null, bands: null,
    emission: { temperatureK: T, intensity: 40, cause: 'stellar-remnant' },
    atmosphere: null,
    extras: {
      halo: { size: 7, intensity: 1.6, color: '#C9D8FF' },
      beam: { cause: 'pulsar-beam', color: '#C7BDFF', core: '#F4F6FF', length: 34, halfAngleDeg: 2.2, intensity: 6, tiltDeg: round3(lerp(25, 50, rnd())), noiseScroll: 1.2 },
      magnetosphere: { sheen: 0.25, color: '#8FA6FF' },
      windNebula: { size: 14, intensity: 0.25, colors: ['#3FB8B0', '#B2405E'] },
    },
  };
}

function buildBlackHole(rnd) {
  return {
    palette: { base: '#000000', accent: '#FF6A2B', shadow: '#000000', extra: ['#FFB27A', '#FFE6C7'] },
    albedo: [0, 0], roughness: 1, metalness: 0,
    craters: null, bands: null,
    // The thin hot rim at rest; the disc brightens with body.feeding (art-bible §5 stage 11).
    emission: { temperatureK: 4200, intensity: 5, cause: 'accretion' },
    atmosphere: null,
    extras: {
      photonRing: { radius: 1.04, width: 0.035, temperatureK: 4200, intensity: 5, softness: 0.5 },
      disc: {
        inner: 1.5, outer: 5.5, innerTempK: 9000, outerTempK: 1800, tempExponent: 0.75,
        idleOpacity: 0.12, feedOpacity: 1.0, idleIntensity: 0.8, feedIntensity: 8,
        doppler: 0.55, dopplerPower: 3, turbulence: 0.6, spiralArms: 2 + Math.floor(rnd() * 3), flowSpeed: 0.6, thickness: 0.04,
      },
      lensing: { einsteinRadius: 1.9, strength: 1.0, haloRadius: 2.8, haloDarken: 0.4, starStretch: 0.6, maxScreenFraction: 0.45 },
      jet: { cause: 'jet', color: '#BFD4FF', core: '#F4F8FF', length: 14, halfAngleDeg: 3, intensity: 7, knots: 4, scrollSpeed: 2.0 },
    },
  };
}

// Sample [a,b] number ranges inside a nested object; leave strings/fixed numbers.
function sampleObj(v, rnd) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) {
    if (v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number') {
      const x = range(rnd, v);
      return Number.isInteger(v[0]) && Number.isInteger(v[1]) && v[1] - v[0] >= 1 ? Math.round(x) : round3(x);
    }
    return v.slice();
  }
  const out = {};
  for (const [k, x] of Object.entries(v)) out[k] = sampleObj(x, rnd);
  return out;
}

const CLS_HASH = {};

/**
 * Pure, deterministic look for a body. Same (cls, stageId, seed, variant) -> deep-equal result.
 * ENG should call it once per body id (or per instance seed) and cache; it allocates.
 * Unknown cls falls back to 'asteroid'; unknown variant falls back to a seed-picked default.
 */
export function getLook(cls, stageId, seed, variant) {
  const c = cls || 'asteroid';
  const v = normVariant(variant);
  const h = CLS_HASH[c] ?? (CLS_HASH[c] = hashStr(c));
  const s = mix32(mix32(mix32((seed >>> 0) || 0, h), hashStr(stageId || '')), hashStr(v || ''));
  const rnd = makeRng(s);
  switch (c) {
    case 'meteorite': case 'asteroid': case 'debris': case 'fragment': case 'comet':
      return buildRock(c, v, rnd);
    case 'dwarfPlanet': return buildDwarf(v, rnd);
    case 'rockyPlanet': return buildRocky(v, rnd);
    case 'gasGiant': return buildGas(v, rnd);
    case 'brownDwarf': return buildBrownDwarf(rnd);
    case 'star': return buildStar(stageId, v, rnd);
    case 'neutronStar': return buildNeutron(rnd);
    case 'blackHole': return buildBlackHole(rnd);
    default: return buildRock('asteroid', v, rnd);
  }
}

/** Palette hint for the player's stage icon / HUD (UI may read this; never used for lighting). */
export const STAGE_ICON = {
  meteorite: '#8A847C', asteroid: '#6E6862', dwarf_planet: '#B9C3CC', rocky_planet: '#4F7FA8',
  gas_giant: '#C9A27A', gas_planet: '#6B2A3A', dwarf_star: kelvinToHex(3300), star: kelvinToHex(5800),
  giant_star: kelvinToHex(3800), supergiant_star: kelvinToHex(12000), neutron_star: '#DCE8FF', black_hole: '#FF6A2B',
};

// Shade helper kept for UI tints of palette colours (pure).
export { shadeHex, mixHex };
