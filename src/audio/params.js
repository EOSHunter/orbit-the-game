// Pure, DOM-free audio math: scaling curves, stage parameters, rate limiting, voice stealing and
// buffer generators. Nothing here touches Web Audio, so it runs under Node for tests.

export const STAGE_IDS = [
  'meteorite', 'asteroid', 'dwarf_planet', 'rocky_planet', 'gas_giant', 'gas_planet',
  'dwarf_star', 'star', 'giant_star', 'supergiant_star', 'neutron_star', 'black_hole',
];

export const clamp = (x, lo = 0, hi = 1) => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const dbToGain = (db) => Math.pow(10, db / 20);

/** Accepts 'dwarf_planet', 'dwarf-planet', 'Dwarf Planet'. Returns 0..11 or -1. */
export function stageIndexOf(id) {
  if (typeof id !== 'string') return -1;
  return STAGE_IDS.indexOf(id.toLowerCase().replace(/[\s-]+/g, '_'));
}

/** Mass -> 0..1 "scale" on a log axis (mass 0 -> 0, ~3.2M (black hole) -> ~1). */
export function massScale(mass) {
  if (!(mass > 0)) return 0;
  return clamp(Math.log10(1 + mass) / Math.log10(1 + 4e6));
}

/** Body resonance in Hz: bigger = lower. 190 Hz at scale 0 down to ~24 Hz at scale 1. */
export function resonanceHz(scale) {
  return Math.max(24, 190 * Math.pow(2, -3 * clamp(scale)));
}

/** Cut-off of the felt SFX bus: opens up a little as the player grows (feels bigger). */
export function sfxCutoffHz(scale) {
  return 700 + 1800 * clamp(scale);
}

/** Per-stage ambience parameters; continuous in the stage index (fractional input allowed). */
export function stageParams(index) {
  const i = clamp(index, 0, 11);
  const t = i / 11;
  const kind = i >= 10.5 ? 'blackhole' : i >= 9.5 ? 'neutron' : 'pad';
  const chords = [
    [1, 1.5, 2, 2.25],          // open fifths + ninth: bell-like, hollow
    [1, 1.5, 2, 2.4],           // adds a minor third an octave up: melancholic
    [1, 1.5, 1.8, 2.4],         // minor 7th flavour: heavier
  ];
  return {
    kind,
    rootHz: midiToHz(57 - 22 * t),
    cutoffHz: 650 + 1400 * t,
    detuneCents: 4 + 10 * t,
    chord: chords[Math.min(2, Math.floor(i / 4))],
    padLevel: kind === 'blackhole' ? 0.12 : kind === 'neutron' ? 0.35 : 0.5,
    subLevel: 0.15 + 0.6 * t,
    heartbeatBpm: i >= 5.5 && kind === 'pad' ? 50 + 3 * (i - 6) : 0,
    reverbSec: 2 + 4 * t,
    melodyRate: kind === 'pad' ? 0.28 - 0.16 * t : 0,        // notes per second, sparse
    melodyLevel: 0.18 - 0.08 * t,
    shimmer: i >= 4 ? 0.5 : 0.2,
  };
}

/** Absorb ("chomp") parameters scaled by prey ratio (prey mass / player mass) and player scale. */
export function absorbParams(ratio, scale, chain = 0) {
  const r = clamp(Math.sqrt(clamp(ratio, 0, 1)));
  const res = resonanceHz(scale);
  return {
    thumpHz: clamp(res * (2.2 - 1.2 * r), 28, 240),
    peak: 0.22 + 0.55 * r,
    dur: 0.16 + 0.35 * r,
    tickHz: 600 + 900 * (1 - r),
    chew: chain > 1,                            // collapse into granular texture
    chewHz: res * (1.4 + 0.12 * Math.min(chain, 12)),
  };
}

/** Near-miss whoosh: a Doppler-like downward filtered sweep, longer and lower for bigger bodies. */
export function nearMissParams(relSpeed, sizeRatio, scale) {
  const sp = clamp((relSpeed || 0) / 400);
  const big = clamp(Math.log10(1 + Math.max(0, sizeRatio || 1)) / 2);
  return {
    fromHz: lerp(1100, 380, big) * (0.8 + 0.4 * sp),
    toHz: lerp(260, 70, big),
    dur: lerp(0.45, 1.1, big),
    peak: 0.12 + 0.32 * sp,
    sineHz: resonanceHz(scale) * 2.5,
  };
}

/** Slingshot gain (world speed units, scale unknown to us) -> 0..1 intensity. */
export function slingIntensity(speedGain) {
  return clamp(1 - Math.exp(-Math.max(0, speedGain || 0) / 30));
}

/** Stereo pan in -1..1 from an event position relative to the player (x-z play plane). */
export function panFrom(p, playerPos) {
  if (!p || !playerPos) return 0;
  const dx = p[0] - playerPos[0], dz = p[2] - playerPos[2];
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return 0;
  return clamp((dx / d) * 0.65, -0.65, 0.65);
}

/** Rate limiter. `allow(key, now, minInterval)` is true at most once per interval per key. */
export function createGate() {
  const last = new Map();
  return {
    allow(key, now, minInterval) {
      const t = last.get(key);
      if (t !== undefined && now - t < minInterval && now >= t) return false;
      last.set(key, now);
      return true;
    },
    reset() { last.clear(); },
  };
}

/**
 * Choose which voice to steal for a new voice of priority `prio`.
 * voices: [{prio, start}]. Returns the victim, or null if the newcomer should be dropped
 * (every live voice is strictly more important).
 */
export function pickVictim(voices, prio) {
  let v = null;
  for (const c of voices) {
    if (!v || c.prio < v.prio || (c.prio === v.prio && c.start < v.start)) v = c;
  }
  return v && v.prio <= prio ? v : null;
}

// ---- buffer generators (fill Float32Arrays; `rnd` defaults to Math.random) ----------------------

export function fillWhite(out, rnd = Math.random) {
  for (let i = 0; i < out.length; i++) out[i] = rnd() * 2 - 1;
  return out;
}

/** Paul Kellet's economy pink filter. */
export function fillPink(out, rnd = Math.random) {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < out.length; i++) {
    const w = rnd() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return out;
}

export function fillBrown(out, rnd = Math.random) {
  let last = 0;
  for (let i = 0; i < out.length; i++) {
    last = (last + 0.02 * (rnd() * 2 - 1)) / 1.02;
    out[i] = last * 3.5;
  }
  return out;
}

/** Decaying-noise impulse response for a cheap convolution reverb. */
export function fillImpulse(out, sampleRate, seconds, rnd = Math.random) {
  const n = out.length;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const lowpassed = (rnd() * 2 - 1) * Math.exp((-6.9 * t) / seconds);
    out[i] = lowpassed * Math.min(1, i / (0.01 * sampleRate));   // 10 ms fade-in: soft pre-delay
  }
  return out;
}

/** tanh soft-clip curve for a WaveShaperNode. */
export function saturationCurve(n = 1024, drive = 2.2) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * drive);
  return c;
}
