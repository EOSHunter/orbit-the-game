// One-shot sound recipes. All synthesised from oscillators + filtered noise.
// Every recipe takes (E, S, p): E = engine, S = shared audio state {scale, res, mass, ...}, p = args.
// Priorities: 1 texture, 2 minor, 3 normal, 4 important, 5 critical.
import {
  clamp, lerp, absorbParams, nearMissParams, slingIntensity, resonanceHz,
} from './params.js';

const R = Math.random;

// ---- diegetic "felt" sounds ----------------------------------------------------------------------

export function absorb(E, S, p) {
  const a = absorbParams(p.ratio, S.scale, p.chain);
  const pan = p.pan || 0;
  if (p.chain > 1) {                         // chain: a quiet granular chew instead of a full chomp
    const v = E.voice(1, 0.1, { pan });
    if (!v) return;
    E.tone(v, 'sine', a.chewHz * 1.5, a.chewHz, 0.16, 0.004, 0.08);
    E.noise(v, 'brown', 'lowpass', 500 + R() * 400, 300, 0.7, 0.1, 0.003, 0.05);
    return;
  }
  const v = E.voice(3, a.dur + 0.1, { pan });
  if (!v) return;
  const sat = E.saturator(); sat.connect(v.out);
  E.tone(v, 'sine', a.thumpHz * 1.9, a.thumpHz, a.peak, 0.006, a.dur, 0, sat);   // saturated for weight on big bites
  E.tone(v, 'sine', a.thumpHz * 0.5, a.thumpHz * 0.5, a.peak * 0.4, 0.02, a.dur * 1.2);        // sub body
  E.noise(v, 'pink', 'lowpass', a.tickHz, a.tickHz * 0.4, 0.8, a.peak * 0.45, 0.003, 0.07);    // tick
  E.tone(v, 'sine', a.thumpHz * 3, a.thumpHz * 1.2, a.peak * 0.22, 0.01, a.dur * 0.8, 0.03);   // gulp glide
  if (p.cls === 'star' || p.cls === 'neutronStar' || p.cls === 'blackHole') {
    E.tone(v, 'sine', 523.25 * 0.5, 523.25 * 0.5, 0.05, 0.05, 1.2, 0.05);                       // warm shimmer
  }
}

export function tdeSwell(E, S, p) {
  const v = E.voice(5, 5);
  if (!v) return;
  E.tone(v, 'sine', 30, 18, 0.7, 0.9, 4.5);
  E.noise(v, 'pink', 'bandpass', 200, 2400, 1.2, 0.35, 1.8, 4.5);
  E.tone(v, 'sine', 1760, 2093, 0.07, 1.4, 4.2, 0.2);
  E.tone(v, 'sine', 1768, 2105, 0.06, 1.4, 4.2, 0.2);
}

export function hit(E, S, p) {
  const k = clamp(p.strength ?? 0.5);
  const res = S.res;
  const v = E.voice(5, 0.9 + k * 0.6, { pan: p.pan || 0 });
  if (!v) return;
  const sat = E.saturator(); sat.connect(v.out);
  E.tone(v, 'sine', res * 2.4, res * 0.7, 0.45 + 0.45 * k, 0.003, 0.5 + 0.5 * k, 0, sat);
  E.tone(v, 'triangle', res * 4, res * 1.3, 0.2 * k, 0.003, 0.25);
  E.noise(v, 'brown', 'lowpass', 900 + 900 * k, 160, 0.9, 0.4 + 0.4 * k, 0.002, 0.28);        // crunch
  E.noise(v, 'pink', 'bandpass', 220, 90, 4, 0.18 * k, 0.04, 0.5 + 0.3 * k, 0.04);              // grind
  debrisTicks(E, S, { count: 2 + Math.round(5 * k), spread: 0.45, level: 0.3 * k + 0.1, pan: p.pan });
}

export function bounce(E, S, p) {
  const k = clamp((p.relSpeed || 0) / 300) * 0.7 + 0.2;
  const v = E.voice(3, 0.4, { pan: p.pan || 0 });
  if (!v) return;
  E.tone(v, 'sine', S.res * 1.8, S.res * 0.9, 0.3 * k + 0.1, 0.004, 0.3);
  E.noise(v, 'brown', 'lowpass', 500, 200, 0.7, 0.2 * k, 0.003, 0.1);
}

export function impactFar(E, S, p) {          // collision near the player that does not involve them: muffled
  const k = clamp(p.energy ?? 0.3);
  const v = E.voice(2, 0.8, { pan: p.pan || 0 });
  if (!v) return;
  E.tone(v, 'sine', S.res * 1.6, S.res * 0.6, 0.12 + 0.35 * k, 0.01, 0.5 + 0.3 * k);
  E.noise(v, 'brown', 'lowpass', 350, 120, 0.6, 0.12 + 0.2 * k, 0.01, 0.3);
  debrisTicks(E, S, { count: Math.min(6, p.ejecta || 0), spread: 0.6, level: 0.15, pan: p.pan });
}

/** A short shower of tiny filtered ticks (debris pattering on the hull, felt not heard). */
export function debrisTicks(E, S, { count = 4, spread = 0.4, level = 0.2, pan = 0 } = {}) {
  if (count <= 0) return;
  const v = E.voice(1, spread + 0.1, { pan });
  if (!v) return;
  for (let i = 0; i < count; i++) {
    const d = R() * spread;
    const f = 500 + R() * 1400;
    E.noise(v, 'white', 'bandpass', f, f * 0.7, 3 + R() * 3, level * (0.5 + R() * 0.5), 0.001, 0.025, d);
    if (R() < 0.5) E.tone(v, 'sine', S.res * (2 + R()), S.res, level * 0.5, 0.002, 0.05, d);
  }
}

export function rocheTear(E, S, p) {
  const player = p.victim === 'player';
  if (p.phase === 'end') {
    const v = E.voice(3, 1.2);
    if (!v) return;
    E.tone(v, 'sine', S.res * 1.4, S.res * 0.6, 0.3, 0.01, 0.8);
    debrisTicks(E, S, { count: 8, spread: 0.9, level: 0.22 });
    return;
  }
  const dur = player ? 3.2 : 1.9;
  const v = E.voice(4, dur + 0.2);
  if (!v) return;
  const peak = player ? 0.5 : 0.3;
  // tearing: noise gated by a fast, wobbling tremolo = ripping fabric/rock
  const tear = E.noise(v, 'pink', 'bandpass', 700, 260, 1.4, peak, 0.08, dur);
  const lfo = E.ctx.createOscillator(); lfo.type = 'sawtooth'; lfo.frequency.value = 28 + R() * 14;
  const lg = E.g(240); lfo.connect(lg); lg.connect(tear.frequency);      // growling cut-off flutter
  v.source(lfo, v.t0, dur, [lg]);
  // groaning stress: detuned low saws gliding down through a lowpass
  const lp = E.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 3;
  lp.connect(v.out); v.nodes.push(lp);
  for (const det of [-9, 11]) {
    const o = E.tone(v, 'sawtooth', S.res * 3, S.res * 1.2, peak * 0.22, 0.4, dur, 0, lp);
    o.detune.value = det * 6;
  }
  E.tone(v, 'sine', S.res * 0.9, S.res * 0.5, peak * 0.9, 0.6, dur);
  for (let i = 0; i < 6; i++) {            // cracks as it fractures
    E.noise(v, 'white', 'bandpass', 1200 + R() * 1800, 400, 2, 0.12, 0.001, 0.03, 0.2 + R() * (dur - 0.4));
  }
}

export function nearMiss(E, S, p) {
  const m = nearMissParams(p.relSpeed, p.sizeRatio ?? 1, S.scale);
  const v = E.voice(2, m.dur + 0.1, { pan: p.pan || 0 });
  if (!v) return;
  // stylised Doppler: pressure sweep high -> low, plus a felt sine falling with it
  E.noise(v, 'pink', 'bandpass', m.fromHz, m.toHz, 2.2, m.peak, m.dur * 0.35, m.dur);
  E.tone(v, 'sine', m.sineHz * 1.5, m.sineHz * 0.6, m.peak * 0.7, m.dur * 0.3, m.dur);
}

export function slingshot(E, S, p) {
  const k = slingIntensity(p.speedGain);
  const dur = 1.1 + 0.8 * k;
  const v = E.voice(3, dur + 0.1);
  if (!v) return;
  E.noise(v, 'pink', 'bandpass', 180, 1500 + 800 * k, 1.6, 0.14 + 0.2 * k, dur * 0.7, dur);
  E.tone(v, 'sine', S.res * 2, S.res * 5, 0.12 + 0.2 * k, dur * 0.6, dur);
  E.tone(v, 'sine', S.res * 3, S.res * 7.5, 0.05 * k, dur * 0.6, dur, 0.05);
}

export function orbitAcquired(E, S, p) {
  const f = clamp(S.res * 4, 110, 440);
  const v = E.voice(3, 1.6);
  if (!v) return;
  E.tone(v, 'sine', f, f, 0.16, 0.015, 1.5);
  E.tone(v, 'sine', f * 1.5, f * 1.5, 0.12, 0.015, 1.4, 0.09);   // a fifth apart
}

export function evolve(E, S, p) {
  const res = resonanceHz(p.scaleTo ?? S.scale);
  const v = E.voice(5, 5.5);
  if (!v) return;
  E.noise(v, 'pink', 'bandpass', 150, 3200, 0.9, 0.38, 2.4, 3.2);                       // swell
  E.tone(v, 'sine', res * 0.5, res * 0.5, 0.8, 1.2, 4.8);                                // sub boom
  E.tone(v, 'sine', res, res * 2, 0.22, 2.0, 4.5);
  const base = clamp(res * 4, 110, 330);
  [1, 1.25, 1.5, 2, 3].forEach((r, i) => E.tone(v, 'sine', base * r, base * r, 0.1, 0.05, 2.6, 2.0 + i * 0.09));
}

export function death(E, S, p) {
  const v = E.voice(5, 4.5);
  if (!v) return;
  const captured = p.cause === 'captured';
  E.tone(v, 'sine', 70, 22, 0.95, 0.01, 3.2);                       // boom
  E.noise(v, 'brown', 'lowpass', 600, 60, 0.8, 0.5, 0.01, 2.4);
  if (captured) E.tone(v, 'sine', 330, 40, 0.14, 0.05, 4.0, 0.2);   // falling tone
  E.tone(v, 'sine', 110, 110, 0.0001 + 0.12, 1.0, 3.5, 0.5);
}

export function ending(E, S, p) {
  const v = E.voice(4, 7);
  if (!v) return;
  if (p.kind === 'eventHorizon') {
    E.tone(v, 'sine', 440, 30, 0.2, 0.2, 6);
    E.tone(v, 'sine', 660, 45, 0.1, 0.2, 6);
  } else if (p.kind === 'finale') {
    [1, 1.25, 1.5, 2, 2.5].forEach((r, i) => E.tone(v, 'sine', 220 * r, 220 * r, 0.12, 1.2 + i * 0.2, 6.5));
  } else {
    [1, 1.2, 1.5].forEach((r, i) => E.tone(v, 'sine', 196 * r, 196 * r, 0.1, 1.5, 6.5, i * 0.25));
  }
}

export function healthLow(E, S) {
  const v = E.voice(4, 1.4);
  if (!v) return;
  for (let i = 0; i < 2; i++) {
    E.tone(v, 'sine', 105, 80, 0.38, 0.01, 0.35, i * 0.5);
    E.tone(v, 'sine', 210, 160, 0.06, 0.01, 0.3, i * 0.5);
  }
}

export function invulnEnd(E) {
  const v = E.voice(2, 0.2);
  if (v) E.tone(v, 'sine', 660, 990, 0.05, 0.005, 0.12);
}

// ---- sensor sonification / warnings --------------------------------------------------------------

/** Capture alarm pulse: low and pulsing (felt), never a siren. Count and level rise with `level`. */
export function captureWarn(E, S, p) {
  const k = clamp(p.level ?? 0.25);
  const pulses = 1 + Math.round(k * 3);
  const gap = lerp(0.34, 0.2, k);
  const v = E.voice(4, pulses * gap + 0.6);
  if (!v) return;
  const f = 96 + 40 * k;
  for (let i = 0; i < pulses; i++) {
    E.tone(v, 'sine', f, f * 0.93, 0.28 + 0.3 * k, 0.012, 0.28, i * gap);
    E.tone(v, 'sine', f * 1.5, f * 1.4, 0.1 + 0.12 * k, 0.012, 0.24, i * gap);
  }
  E.tone(v, 'sine', 32, 28, 0.2 + 0.5 * k, 0.1, pulses * gap + 0.5);
}

export function captureClear(E, S) {
  const v = E.voice(4, 1.8);
  if (!v) return;
  E.tone(v, 'sine', 90, 360, 0.2, 0.2, 1.4);
  E.tone(v, 'sine', 135, 540, 0.1, 0.3, 1.4, 0.1);
  E.noise(v, 'pink', 'bandpass', 200, 1400, 1, 0.1, 0.6, 1.4);
}

export function beaconPing(E, S, p) {
  const v = E.voice(3, 2.4, { pan: p.pan || 0 });
  if (!v) return;
  E.tone(v, 'sine', 900, 880, 0.2, 0.004, 1.2);
  E.tone(v, 'sine', 1800, 1790, 0.04, 0.004, 0.6);
  for (let i = 1; i <= 4; i++) {            // sonar echo trail: decaying repeats, darker each time
    E.tone(v, 'sine', 900 - i * 12, 880 - i * 12, 0.2 * Math.pow(0.45, i), 0.004, 0.9, i * 0.42);
  }
}

export function pulsarTick(E, S, p) {
  const k = clamp(p.intensity ?? 0.6);
  const v = E.voice(2, 0.2, { pan: p.pan || 0 });
  if (!v) return;
  E.noise(v, 'white', 'bandpass', 3200, 2800, 8, 0.1 + 0.2 * k, 0.001, 0.03);
  E.tone(v, 'sine', 2400, 2300, 0.05 + 0.1 * k, 0.001, 0.09);
}

export function regionChange(E, S, p) {
  const v = E.voice(3, 2.4);
  if (!v) return;
  if (p.inVoid) {            // sounds drain away: a downward hush
    E.noise(v, 'pink', 'lowpass', 1200, 90, 0.7, 0.18, 0.2, 2.0);
    E.tone(v, 'sine', S.res * 3, S.res * 0.9, 0.2, 0.1, 2.0);
  } else {
    E.noise(v, 'pink', 'lowpass', 120, 1600, 0.7, 0.14, 0.8, 1.6);
    E.tone(v, 'sine', S.res * 1.2, S.res * 3, 0.16, 0.5, 1.6);
  }
}

// ---- atmosphere (air only exists here) -----------------------------------------------------------

export function atmosphereEnter(E, S) {      // a hush, then the air arrives
  const v = E.voice(3, 1.6);
  if (!v) return;
  E.noise(v, 'pink', 'bandpass', 300, 1100, 0.8, 0.2, 0.7, 1.4);
}

export function atmosphereExit(E, S) {
  const v = E.voice(3, 1.4);
  if (!v) return;
  E.noise(v, 'pink', 'bandpass', 1100, 250, 0.8, 0.15, 0.05, 1.2);
}

// ---- UI (clean, dry, bright, non-diegetic; routed to the UI bus) ----------------------------------

export function ui(E, name) {
  const dest = E.buses.uiOut;
  const o = { dest };
  const tone = (v, f0, f1, pk, dur, d = 0, type = 'sine') => E.tone(v, type, f0, f1, pk, 0.004, dur, d);
  switch (name) {
    case 'hover': { const v = E.voice(1, 0.08, o); if (v) tone(v, 1400, 1500, 0.045, 0.05); break; }
    case 'click': { const v = E.voice(2, 0.14, o); if (v) { tone(v, 900, 700, 0.14, 0.07, 0, 'triangle'); tone(v, 1800, 1500, 0.04, 0.05); } break; }
    case 'confirm': { const v = E.voice(3, 0.35, o); if (v) { tone(v, 660, 660, 0.13, 0.12); tone(v, 990, 990, 0.13, 0.2, 0.07); } break; }
    case 'back': { const v = E.voice(2, 0.25, o); if (v) { tone(v, 760, 520, 0.12, 0.1); tone(v, 520, 380, 0.1, 0.14, 0.06); } break; }
    case 'error': { const v = E.voice(3, 0.3, o); if (v) { tone(v, 220, 200, 0.14, 0.12, 0, 'triangle'); tone(v, 208, 190, 0.14, 0.14, 0.11, 'triangle'); } break; }
    case 'open': { const v = E.voice(2, 0.45, o); if (v) { E.noise(v, 'white', 'bandpass', 500, 3000, 1.2, 0.06, 0.12, 0.35); tone(v, 500, 900, 0.07, 0.3); } break; }
    case 'close': { const v = E.voice(2, 0.4, o); if (v) { E.noise(v, 'white', 'bandpass', 3000, 500, 1.2, 0.05, 0.05, 0.3); tone(v, 900, 480, 0.06, 0.25); } break; }
    case 'choice.select': { const v = E.voice(3, 0.6, o); if (v) { [523.25, 659.25, 783.99].forEach((f, i) => tone(v, f, f, 0.07, 0.45, i * 0.02)); } break; }
    case 'choice.confirm': {
      const v = E.voice(4, 1.6, o);
      if (v) {
        [392, 523.25, 659.25, 783.99].forEach((f, i) => tone(v, f, f, 0.09, 1.2, i * 0.015));
        E.noise(v, 'white', 'bandpass', 4000, 3000, 6, 0.1, 0.001, 0.02, 0.05);      // the "lock" tick
        tone(v, 150, 90, 0.18, 0.2, 0.04);
      }
      break;
    }
    case 'stagebanner': {
      const v = E.voice(4, 2.4, o);
      if (v) [392, 494, 587, 784].forEach((f, i) => E.tone(v, 'sine', f, f, 0.08, 0.3 + i * 0.05, 1.6, i * 0.14));
      break;
    }
    default: break;
  }
}
