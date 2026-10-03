// Audio graph, buses, noise buffers and the voice pool. Only the Web Audio API is used.
//
//  one-shots ─> voice.out ─> [panner] ─> sfxIn ─> sfxLP ─> sfxOut ──┐
//  UI blips ───────────────────────────────────────> uiOut ──────────┼─> preMaster ─> master ─> limiter ─> trim ─> destination
//  ambience ─> ambIn ─> ambLP ─> ambDuck ─> musicOut ───────────────┤
//  sfxOut/musicOut ─> reverbSend ─> convolver ─> reverbReturn ──────┘
import {
  clamp, fillWhite, fillPink, fillBrown, fillImpulse, saturationCurve, pickVictim,
} from './params.js';

export const MAX_VOICES = 28;
const LOOKAHEAD = 0.005;
const MUSIC_TRIM = 0.4;           // music sits ~ -8 dB under SFX at equal slider values (plus the bed's own level)

export function createEngine(ctx, vol) {
  const sr = ctx.sampleRate || 44100;
  const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };

  // ---- buses --------------------------------------------------------------------------------
  const preMaster = g(1);
  const master = g(vol.muted ? 0 : vol.master);
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8; limiter.knee.value = 0; limiter.ratio.value = 20;
  limiter.attack.value = 0.002; limiter.release.value = 0.15;
  const trim = g(0.85);                                  // ~ -1.4 dBFS ceiling after the limiter
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  preMaster.connect(master); master.connect(limiter); limiter.connect(trim);
  trim.connect(ctx.destination); trim.connect(analyser);

  const sfxIn = g(1);
  const sfxLP = ctx.createBiquadFilter(); sfxLP.type = 'lowpass'; sfxLP.frequency.value = 900; sfxLP.Q.value = 0.5;
  const sfxOut = g(vol.sfx);
  sfxIn.connect(sfxLP); sfxLP.connect(sfxOut); sfxOut.connect(preMaster);

  const uiOut = g(vol.sfx * 0.7);
  uiOut.connect(preMaster);

  const ambIn = g(1);
  const ambLP = ctx.createBiquadFilter(); ambLP.type = 'lowpass'; ambLP.frequency.value = 6000; ambLP.Q.value = 0.4;
  const ambDuck = g(1);
  const musicOut = g(vol.music * MUSIC_TRIM);
  ambIn.connect(ambLP); ambLP.connect(ambDuck); ambDuck.connect(musicOut); musicOut.connect(preMaster);

  const convolver = ctx.createConvolver();
  const reverbSend = g(0.5);
  const reverbReturn = g(0.55);
  musicOut.connect(reverbSend); sfxOut.connect(reverbSend);
  reverbSend.connect(convolver); convolver.connect(reverbReturn); reverbReturn.connect(preMaster);

  // ---- shared buffers -------------------------------------------------------------------------
  const noiseBuf = {};
  for (const [kind, fill] of [['white', fillWhite], ['pink', fillPink], ['brown', fillBrown]]) {
    const b = ctx.createBuffer(1, sr * 4, sr);
    fill(b.getChannelData(0));
    noiseBuf[kind] = b;
  }
  const satCurve = saturationCurve();

  function setReverb(seconds) {
    const len = Math.floor(sr * clamp(seconds, 0.5, 8));
    const b = ctx.createBuffer(2, len, sr);
    fillImpulse(b.getChannelData(0), sr, seconds);
    fillImpulse(b.getChannelData(1), sr, seconds);
    convolver.buffer = b;
  }
  setReverb(3);

  // ---- voice pool -----------------------------------------------------------------------------
  const voices = [];
  const E = {
    ctx, g, vol,
    buses: { sfxIn, sfxLP, sfxOut, uiOut, ambIn, ambLP, ambDuck, musicOut, master, preMaster, convolver, reverbSend },
    noiseBuf, setReverb, voices,
    now: () => ctx.currentTime,

    /** Reports the ceiling of the last analysis window in dBFS (cheap; only called from getStats). */
    peakDb() {
      const a = new Float32Array(analyser.fftSize);
      if (!analyser.getFloatTimeDomainData) return -Infinity;
      analyser.getFloatTimeDomainData(a);
      let m = 0;
      for (let i = 0; i < a.length; i++) { const v = Math.abs(a[i]); if (v > m) m = v; }
      return m > 0 ? 20 * Math.log10(m) : -Infinity;
    },

    activeVoices() {
      const now = ctx.currentTime;
      for (let i = voices.length - 1; i >= 0; i--) {
        if (voices[i].released || voices[i].end + 0.3 < now) voices.splice(i, 1);
      }
      return voices.length;
    },

    /**
     * Start a pooled voice. `dest` defaults to the felt SFX bus. Returns null if the pool is full of
     * more important voices. `prio`: 1 texture .. 5 critical.
     */
    voice(prio, dur, { dest = sfxIn, pan = 0, delay = 0 } = {}) {
      if (E.activeVoices() >= MAX_VOICES) {
        const victim = pickVictim(voices, prio);
        if (!victim) return null;
        victim.steal();
      }
      const v = new Voice(E, prio, dur, dest, pan, ctx.currentTime + LOOKAHEAD + delay);
      voices.push(v);
      return v;
    },

    // ---- primitives: each schedules a source on voice `v` at v.t0 + delay ------------------------
    /** Enveloped sine/triangle/... with an optional exponential glide f0 -> f1. */
    tone(v, type, f0, f1, peak, attack, dur, delay = 0, to = v.out) {
      const t = v.t0 + delay;
      const o = ctx.createOscillator(); o.type = type;
      o.frequency.setValueAtTime(Math.max(1, f0), t);
      if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur * 0.8);
      const e = g(0); env(e.gain, t, peak, attack, dur);
      o.connect(e); e.connect(to);
      v.source(o, t, dur, [e]);
      return o;
    },
    /** Enveloped filtered-noise burst/sweep. */
    noise(v, kind, ft, f0, f1, q, peak, attack, dur, delay = 0) {
      const t = v.t0 + delay;
      const s = ctx.createBufferSource(); s.buffer = noiseBuf[kind]; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = ft; f.Q.value = q;
      f.frequency.setValueAtTime(Math.max(10, f0), t);
      if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
      const e = g(0); env(e.gain, t, peak, attack, dur);
      s.connect(f); f.connect(e); e.connect(v.out);
      v.source(s, t, dur, [f, e], Math.random() * 3);
      return f;
    },
    saturator() { const w = ctx.createWaveShaper(); w.curve = satCurve; return w; },
    env,
  };
  return E;
}

/** Attack/decay envelope: 0 -> peak (linear) -> ~0 (exponential). No clicks. */
function env(param, t, peak, attack, dur) {
  param.setValueAtTime(0.0001, t);
  param.linearRampToValueAtTime(Math.max(0.0002, peak), t + Math.max(0.002, attack));
  param.exponentialRampToValueAtTime(0.0001, t + dur);
}

class Voice {
  constructor(E, prio, dur, dest, pan, t0) {
    const ctx = E.ctx;
    this.E = E; this.prio = prio; this.t0 = t0; this.start = t0; this.end = t0 + dur;
    this.released = false; this.live = 0; this.nodes = []; this.srcs = [];
    this.out = ctx.createGain();
    this.nodes.push(this.out);
    let tail = this.out;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      this.out.connect(p); tail = p; this.nodes.push(p);
    }
    tail.connect(dest);
  }

  /** Register a source (started now at t, stopped at t + dur + tail). Frees nodes when all end. */
  source(src, t, dur, nodes = [], offset) {
    this.live++;
    this.srcs.push(src);
    nodes.forEach((n) => this.nodes.push(n));
    this.nodes.push(src);
    const stopAt = t + dur + 0.05;
    if (stopAt > this.end) this.end = stopAt;
    if (offset !== undefined) src.start(t, offset); else src.start(t);
    src.stop(stopAt);
    src.onended = () => { if (--this.live <= 0) this.release(); };
  }

  steal() {
    const now = this.E.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setTargetAtTime(0, now, 0.006);
    for (const s of this.srcs) { try { s.stop(now + 0.04); } catch { /* already stopped */ } }
    this.released = true;
  }

  release() {
    this.released = true;
    for (const n of this.nodes) { try { n.disconnect(); } catch { /* ignore */ } }
    this.nodes.length = 0; this.srcs.length = 0;
  }
}
