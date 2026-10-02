// Continuous layers (felt thrust, gravity well, star / black-hole beds, atmosphere, capture alarm,
// entry roar) and the per-stage ambience bed. Persistent nodes, updated by smoothed param targets.
import { clamp, lerp, stageParams, resonanceHz } from './params.js';

const R = Math.random;

function loopNoise(E, kind) {
  const s = E.ctx.createBufferSource();
  s.buffer = E.noiseBuf[kind]; s.loop = true;
  s.start(0, R() * 3);
  return s;
}
function osc(E, type, f) {
  const o = E.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o;
}
function filt(E, type, f, q = 0.7) {
  const b = E.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b;
}
/** Smooth a param toward v (time constant tc); cheap enough to call at 30 Hz. */
function glide(param, v, now, tc = 0.12) { param.setTargetAtTime(v, now, tc); }

export function createLayers(E) {
  const ctx = E.ctx;
  const sfx = E.buses.sfxIn;
  const L = { entry: 0, entryTarget: 0, crackleAcc: 0 };

  // thrust: brown noise through a low-pass + faint sub. Felt, no hiss.
  const thrustG = E.g(0), thrustLP = filt(E, 'lowpass', 90, 0.6), thrustSubG = E.g(0);
  loopNoise(E, 'brown').connect(thrustLP); thrustLP.connect(thrustG); thrustG.connect(sfx);
  const thrustSub = osc(E, 'sine', 40); thrustSub.connect(thrustSubG); thrustSubG.connect(sfx);

  // gravity well: a sonified sensor tone (pitch and level follow depth)
  const gravG = E.g(0), gravO = osc(E, 'triangle', 80), gravLP = filt(E, 'lowpass', 400);
  const gravLfo = osc(E, 'sine', 0.35), gravLfoG = E.g(0.25);
  gravO.connect(gravLP); gravLP.connect(gravG); gravG.connect(sfx);
  gravLfo.connect(gravLfoG); gravLfoG.connect(gravG.gain);

  // star proximity: warm detuned saw pair, slow LFO on the filter
  const starG = E.g(0), starLP = filt(E, 'lowpass', 300, 0.9);
  const starA = osc(E, 'sawtooth', 55), starB = osc(E, 'sawtooth', 55.4);
  const starLfo = osc(E, 'sine', 0.13), starLfoG = E.g(120);
  starA.connect(starLP); starB.connect(starLP); starLP.connect(starG); starG.connect(sfx);
  starLfo.connect(starLfoG); starLfoG.connect(starLP.frequency);

  // black-hole proximity: sub-bass that slows and falls as you get closer
  const bhG = E.g(0), bhO = osc(E, 'sine', 45), bhO2 = osc(E, 'sine', 90), bhO2G = E.g(0.25);
  const bhLfo = osc(E, 'sine', 3), bhLfoG = E.g(0.4), bhAm = E.g(0.6);
  bhO.connect(bhAm); bhO2.connect(bhO2G); bhO2G.connect(bhAm); bhAm.connect(bhG); bhG.connect(sfx);
  bhLfo.connect(bhLfoG); bhLfoG.connect(bhAm.gain);

  // atmosphere: air exists only here
  const atmG = E.g(0), atmBP = filt(E, 'bandpass', 600, 0.6);
  loopNoise(E, 'pink').connect(atmBP); atmBP.connect(atmG); atmG.connect(sfx);

  // capture alarm: low pulsing pair, tremolo rate rises with level
  const capG = E.g(0), capAm = E.g(0.5), capA = osc(E, 'sine', 96), capB = osc(E, 'sine', 144);
  const capLfo = osc(E, 'sine', 1.5), capLfoG = E.g(0.5);
  capA.connect(capAm); capB.connect(capAm); capAm.connect(capG); capG.connect(sfx);
  capLfo.connect(capLfoG); capLfoG.connect(capAm.gain);

  // entry roar (R6)
  const entG = E.g(0), entBP = filt(E, 'bandpass', 900, 0.5), entRumG = E.g(0), entRum = osc(E, 'sine', 45);
  loopNoise(E, 'white').connect(entBP); entBP.connect(entG); entG.connect(sfx);
  entRum.connect(entRumG); entRumG.connect(sfx);

  /** Per-frame continuous update. `s` = { thrust, gravityDepth, proximity, inAtmosphere, density, capture, scale }. */
  L.update = function update(s, dt) {
    const now = ctx.currentTime;
    const res = resonanceHz(s.scale);
    const on = s.active ? 1 : 0;

    const th = clamp(s.thrust) * on;
    glide(thrustG.gain, th * th * 0.55, now);
    glide(thrustLP.frequency, 70 + 140 * th, now);
    glide(thrustSub.frequency, clamp(res * 0.8, 26, 60), now);
    glide(thrustSubG.gain, th * 0.16, now);

    const gd = clamp(s.gravityDepth) * on;
    glide(gravG.gain, Math.pow(gd, 1.5) * 0.14, now, 0.25);
    glide(gravO.frequency, clamp(res * (1.3 + 1.6 * gd), 40, 260), now, 0.2);
    glide(gravLP.frequency, 180 + 400 * gd, now);

    const sp = clamp(s.proximity?.star) * on;
    const base = clamp(res * 1.5, 36, 110);
    glide(starG.gain, Math.pow(sp, 1.3) * 0.24, now, 0.3);
    glide(starA.frequency, base, now, 0.4); glide(starB.frequency, base * 1.007, now, 0.4);
    glide(starLP.frequency, 220 + 520 * sp, now, 0.3);

    const bp = clamp(s.proximity?.blackHole) * on;
    const bf = lerp(46, 24, bp);
    glide(bhG.gain, bp * 0.5, now, 0.35);
    glide(bhO.frequency, bf, now, 0.5); glide(bhO2.frequency, bf * 2.003, now, 0.5);
    glide(bhLfo.frequency, lerp(3.2, 0.25, bp), now, 0.5);        // slows with proximity (time dilation)

    const air = s.inAtmosphere ? clamp(0.25 + (s.density ?? 0.5)) : 0;
    glide(atmG.gain, air * 0.24 * on, now, 0.4);
    glide(atmBP.frequency, 450 + 700 * clamp(s.density ?? 0.5), now, 0.5);

    const cap = clamp(s.capture) * on;
    glide(capG.gain, cap > 0 ? 0.06 + cap * 0.3 : 0, now, 0.2);
    glide(capLfo.frequency, 1.2 + cap * 5.5, now, 0.2);
    glide(capA.frequency, 90 + 28 * cap, now, 0.3); glide(capB.frequency, 135 + 42 * cap, now, 0.3);

    // entry roar level follows its own slow envelope
    L.entry += (L.entryTarget - L.entry) * clamp(dt * 3);
    glide(entG.gain, L.entry * 0.3 * on, now, 0.1);
    glide(entBP.frequency, 500 + 1400 * L.entry, now, 0.2);
    glide(entRumG.gain, L.entry * 0.4 * on, now, 0.2);
    glide(entRum.frequency, clamp(res * 1.2, 30, 70), now, 0.3);
    L.crackleAcc = L.entry > 0.05 ? L.crackleAcc + dt * 18 * L.entry : 0;
  };
  /** Returns how many crackle grains are due this frame (consumed by the caller). */
  L.takeCrackles = () => { const n = Math.floor(L.crackleAcc); L.crackleAcc -= n; return Math.min(n, 3); };
  L.setEntry = (level) => { L.entryTarget = clamp(level); };
  L.silence = () => {
    const now = ctx.currentTime;
    for (const gn of [thrustG, thrustSubG, gravG, starG, bhG, atmG, capG, entG, entRumG]) glide(gn.gain, 0, now, 0.05);
    L.entryTarget = 0; L.entry = 0;
  };
  return L;
}

// ---- ambience bed --------------------------------------------------------------------------------

const MELODY = [1, 9 / 8, 6 / 5, 3 / 2, 8 / 5];     // minor pentatonic-ish, sparse and wistful

export class Bed {
  constructor(E, params, fadeIn = 4) {
    this.E = E; this.p = params;
    const ctx = E.ctx, now = ctx.currentTime;
    this.out = E.g(0);
    this.out.gain.setValueAtTime(0, now);
    this.out.gain.linearRampToValueAtTime(1, now + fadeIn);
    this.out.connect(E.buses.ambIn);
    this.nodes = [this.out]; this.oscs = [];
    this.beatAcc = 0; this.melodyAcc = 0; this.tickAcc = 0; this.swellAcc = 8 + R() * 6;

    const sub = (f, lvl) => { const o = this._osc('sine', f), gn = E.g(lvl); o.connect(gn); gn.connect(this.out); this.nodes.push(gn); return o; };
    if (params.kind === 'pad') {
      const lp = filt(E, 'lowpass', params.cutoffHz, 0.6);
      const padG = E.g(params.padLevel * 0.35);
      lp.connect(padG); padG.connect(this.out); this.nodes.push(lp, padG);
      this.lp = lp;
      const lfo = this._osc('sine', 0.05 + R() * 0.05), lfoG = E.g(params.cutoffHz * 0.25);
      lfo.connect(lfoG); lfoG.connect(lp.frequency); this.nodes.push(lfoG);
      for (const ratio of params.chord) {
        for (const sign of [-1, 1]) {
          const o = this._osc(ratio > 1.9 ? 'sine' : 'triangle', params.rootHz * ratio);
          o.detune.value = sign * params.detuneCents;
          const gn = E.g(1 / (1 + ratio * 0.5));
          o.connect(gn); gn.connect(lp); this.nodes.push(gn);
        }
      }
    }
    if (params.kind !== 'neutron') sub(params.rootHz / 2, params.subLevel * (params.kind === 'blackhole' ? 0.9 : 0.35));
    if (params.kind === 'neutron') sub(30, 0.8);
    if (params.kind === 'blackhole') sub(27, 0.5);
  }

  _osc(type, f) {
    const o = this.E.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start();
    this.oscs.push(o); this.nodes.push(o); return o;
  }

  /** Schedules the sparse events (melody bells, heartbeat, pulsar ticks, reversed swells). */
  update(dt, S, active = true) {
    if (!active) return;
    const E = this.E, p = this.p;
    if (p.heartbeatBpm) {
      this.beatAcc += dt * p.heartbeatBpm / 60;
      if (this.beatAcc >= 1) {
        this.beatAcc -= 1;
        const v = E.voice(1, 0.4, { dest: E.buses.ambIn });
        if (v) {
          E.tone(v, 'sine', 62, 38, 0.3, 0.008, 0.28);
          E.tone(v, 'sine', 58, 36, 0.18, 0.008, 0.24, 0.2);
        }
      }
    }
    if (p.melodyRate) {
      this.melodyAcc += dt * p.melodyRate * (0.5 + R());
      if (this.melodyAcc >= 1) {
        this.melodyAcc = 0;
        const f = p.rootHz * 2 * (1 + (R() < 0.3 ? 1 : 0)) * MELODY[(R() * MELODY.length) | 0];
        const v = E.voice(1, 3.2, { dest: E.buses.ambIn, pan: (R() - 0.5) * 0.8 });
        if (v) {                                                   // soft bell: partial at 2.76x
          E.tone(v, 'sine', f, f, p.melodyLevel, 0.01, 3.0);
          E.tone(v, 'sine', f * 2.76, f * 2.76, p.melodyLevel * 0.25 * p.shimmer, 0.005, 1.2);
        }
      }
    }
    if (p.kind === 'neutron') {                                    // short high ticks over a huge sub
      this.tickAcc += dt * 1.9;
      if (this.tickAcc >= 1) {
        this.tickAcc -= 1;
        const v = E.voice(1, 0.15, { dest: E.buses.ambIn });
        if (v) {
          E.noise(v, 'white', 'bandpass', 3400, 3000, 9, 0.07, 0.001, 0.02);
          E.tone(v, 'sine', 2600, 2500, 0.025, 0.001, 0.08);
        }
      }
    }
    if (p.kind === 'blackhole') {                                  // reversed swells: slow rise, abrupt cut
      this.swellAcc -= dt;
      if (this.swellAcc <= 0) {
        this.swellAcc = 9 + R() * 6;
        const v = E.voice(1, 6.2, { dest: E.buses.ambIn });
        if (v) {
          const t = v.t0;
          E.noise(v, 'pink', 'bandpass', 120, 900, 1.2, 0.0001, 5.9, 6);
          // custom gain: ramp up for 5.8 s and cut hard at the end
          const n = v.nodes[v.nodes.length - 2];       // the envelope gain created by E.noise
          n.gain.cancelScheduledValues(t);
          n.gain.setValueAtTime(0.0001, t);
          n.gain.exponentialRampToValueAtTime(0.16, t + 5.8);
          n.gain.linearRampToValueAtTime(0, t + 5.85);
        }
      }
    }
  }

  fadeOut(sec) {
    const ctx = this.E.ctx, now = ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + sec);
    this.oscs.forEach((o) => { try { o.stop(now + sec + 0.1); } catch { /* ignore */ } });
    const last = this.oscs[this.oscs.length - 1];
    if (last) last.onended = () => this.dispose();
    else this.dispose();
  }

  dispose() {
    for (const n of this.nodes) { try { n.disconnect(); } catch { /* ignore */ } }
    this.nodes.length = 0;
  }
}

export const bedParams = stageParams;
