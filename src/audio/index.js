// Public entry point of the sound module (contract section 7). Web Audio only, fully synthesised.
//
//   const audio = createAudio();
//   audio.attach(sim.events);            // subscribes to the section 3 events
//   audio.unlock();                       // from the first user gesture (or audio.autoUnlock())
//   audio.update(state, dt);              // every frame
//
// Nothing here throws if the browser blocks audio: every method is a no-op until the context runs.
import { createEngine } from './engine.js';
import { createLayers, Bed } from './layers.js';
import * as sfx from './sfx.js';
import {
  clamp, createGate, massScale, resonanceHz, sfxCutoffHz, stageIndexOf, stageParams, panFrom, STAGE_IDS,
} from './params.js';

const STORAGE_KEY = 'vd.audio';
const BUS_EVENTS = [
  'run-start', 'status', 'absorb', 'hit', 'bounce', 'impact', 'roche-disruption', 'near-miss',
  'atmosphere-entry', 'atmosphere-exit', 'orbit-acquired', 'slingshot', 'choice-picked', 'evolve',
  'health-low', 'invuln-end', 'region-change', 'beacon-ping', 'capture-warning', 'capture-clear',
  'pulsar-beam', 'death', 'ending',
  // Deliberately silent (documented in docs/audio-direction.md): rebase, orbit-lost, choice-open.
];
// Rough relative size of a body class, for near-miss whoosh length/pitch.
const CLS_SIZE = {
  fragment: 0.2, debris: 0.2, meteorite: 0.5, asteroid: 1, comet: 1, dwarfPlanet: 2, rockyPlanet: 4,
  gasGiant: 8, brownDwarf: 10, neutronStar: 5, star: 20, blackHole: 30,
};

function loadVolumes() {
  const v = { master: 0.8, music: 0.5, sfx: 0.9, muted: false };
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(v, JSON.parse(raw));
  } catch { /* storage unavailable */ }
  return v;
}

export function createAudio(opts = {}) {
  const vol = loadVolumes();
  const gate = createGate();
  const S = { scale: 0, res: resonanceHz(0), mass: 0 };          // shared with the sound recipes
  let ctx = opts.context || null;
  let E = null, layers = null, bed = null;
  let stageIdx = 0, status = 'playing', playerPos = null, playerId = null;
  let dead = false, inVoid = false, offs = [], layerAcc = 0, disposed = false, lastHud = {};
  let duckUntil = 0;

  const running = () => !!(E && ctx && ctx.state === 'running' && !disposed);
  const T = () => ctx.currentTime;
  const setTarget = (param, v, tc = 0.05) => param.setTargetAtTime(v, T(), tc);

  function persist() {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(vol)); } catch { /* ignore */ }
  }

  function applyVolumes() {
    if (!E) return;
    const b = E.buses;
    setTarget(b.master.gain, vol.muted ? 0 : vol.master, 0.03);
    setTarget(b.sfxOut.gain, vol.sfx, 0.03);
    setTarget(b.uiOut.gain, vol.sfx * 0.7, 0.03);
    setTarget(b.musicOut.gain, vol.music * 0.4, 0.03);
  }

  function applyFilters() {
    if (!E) return;
    const b = E.buses;
    setTarget(b.sfxLP.frequency, dead ? 90 : sfxCutoffHz(S.scale), dead ? 0.5 : 0.3);
    setTarget(b.ambLP.frequency, dead ? 220 : inVoid ? 1800 : 6000, dead ? 0.6 : 0.5);
  }

  /** Sidechain-style duck of the ambience for big events, then recover. */
  function duck(depth, hold, release) {
    if (!E) return;
    const g = E.buses.ambDuck.gain, now = T();
    g.cancelScheduledValues(now);
    g.setTargetAtTime(depth, now, 0.05);
    g.setTargetAtTime(1, now + hold, release / 3);
    duckUntil = now + hold + release;
  }

  function startBed(idx, fadeIn = 4) {
    const p = stageParams(idx);
    const old = bed;
    bed = new Bed(E, p, fadeIn);
    E.setReverb(p.reverbSec);
    if (old) old.fadeOut(fadeIn);
  }

  function setStage(id) {
    const idx = typeof id === 'number' ? id : stageIndexOf(id);
    if (idx < 0 || idx > 11 || idx === stageIdx && bed) return;
    stageIdx = idx;
    if (running()) startBed(idx);
  }

  // ---- event dispatch --------------------------------------------------------------------------
  const pan = (p) => panFrom(p, playerPos);
  const H = {
    'run-start'(p) {
      dead = false; inVoid = false; gate.reset();
      if (layers) layers.silence();
      applyFilters();
      if (E) setTarget(E.buses.ambDuck.gain, 1, 0.3);
      if (p && p.stageId) setStage(p.stageId);
    },
    status(p) {
      status = p.status;
      if (p.status === 'title') { H['run-start']({ stageId: STAGE_IDS[0] }); }   // quit to menu: same clean slate as a new run
    },
    absorb(p) {
      const chain = p.chain || 0;
      if (!gate.allow(chain > 1 ? 'chew' : 'absorb', T(), chain > 1 ? 0.07 : 0.05)) return;
      sfx.absorb(E, S, { ratio: p.ratio, chain, cls: p.cls, pan: pan(p.p) });
      if (p.tde) { sfx.tdeSwell(E, S, p); duck(0.4, 3, 3); }
      else if (p.ratio > 0.4) duck(0.7, 0.3, 1);
    },
    hit(p) { if (gate.allow('hit', T(), 0.08)) sfx.hit(E, S, { ...p, pan: pan(p.p) }); duck(0.55, 0.4, 1.4); },
    bounce(p) { if (gate.allow('bounce', T(), 0.1)) sfx.bounce(E, S, { ...p, pan: pan(p.p) }); },
    impact(p) {
      if (p.nearPlayer && gate.allow('impact', T(), 0.12)) sfx.impactFar(E, S, { ...p, pan: pan(p.p) });
    },
    'roche-disruption'(p) {
      if (gate.allow('roche:' + p.phase, T(), p.phase === 'start' ? 0.8 : 0.3)) sfx.rocheTear(E, S, p);
      if (p.phase === 'start' && p.victim === 'player') duck(0.5, 2.5, 1.5);
    },
    'near-miss'(p) {
      if (gate.allow('nearmiss', T(), 0.25)) sfx.nearMiss(E, S, { ...p, sizeRatio: CLS_SIZE[p.cls] ?? 1, pan: pan(p.p) });
    },
    'atmosphere-entry'(p) {
      if (playerId != null && p.bodyId != null && p.bodyId !== playerId) return;     // player only
      layers.setEntry(clamp(p.intensity ?? 0.6));
      sfx.atmosphereEnter(E, S);
    },
    'atmosphere-exit'(p) {
      if (playerId != null && p.bodyId != null && p.bodyId !== playerId) return;
      layers.setEntry(0);
      sfx.atmosphereExit(E, S);
    },
    'orbit-acquired'() { sfx.orbitAcquired(E, S, {}); },
    slingshot(p) { if (gate.allow('sling', T(), 0.6)) sfx.slingshot(E, S, p); },
    'choice-picked'() { sfx.ui(E, 'choice.confirm'); },
    evolve(p) {
      sfx.evolve(E, S, { scaleTo: massScale(p.mass) });
      duck(0.35, 2.5, 3);
      setStage(p.toId ?? p.toIndex);
    },
    'health-low'() { sfx.healthLow(E, S); },
    'invuln-end'() { if (gate.allow('invuln', T(), 0.3)) sfx.invulnEnd(E); },
    'region-change'(p) { inVoid = !!p.inVoid; applyFilters(); sfx.regionChange(E, S, p); },
    'beacon-ping'(p) { sfx.beaconPing(E, S, { pan: clamp(Math.sin(p.bearing || 0) * 0.6, -0.6, 0.6) }); },
    'capture-warning'(p) { sfx.captureWarn(E, S, p); duck(0.6, 0.6, 1.2); },
    'capture-clear'() { sfx.captureClear(E, S); },
    'pulsar-beam'(p) { if (gate.allow('pulsar', T(), 0.05)) sfx.pulsarTick(E, S, { ...p, pan: pan(p.p) }); },
    death(p) {
      dead = true; applyFilters(); duck(0.3, 4, 3);
      if (layers) layers.silence();
      sfx.death(E, S, p);
    },
    ending(p) { sfx.ending(E, S, p); },
  };

  function event(type, payload) {
    if (!running()) { if (type === 'status' && payload) status = payload.status; return; }
    const h = H[type];
    if (!h) return;                                             // unknown events are ignored
    try { h(payload || {}); } catch (err) { if (opts.debug) console.warn('[audio]', type, err); }
  }

  // ---- public API ---------------------------------------------------------------------------------
  const audio = {
    async unlock() {
      if (disposed) return;
      try {
        if (!ctx) {
          const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
          if (!AC) return;
          ctx = new AC({ latencyHint: 'interactive' });
        }
        if (ctx.state === 'suspended') await ctx.resume();
        if (!E) {
          E = createEngine(ctx, vol);
          layers = createLayers(E);
          applyFilters();
          startBed(stageIdx, 3);
        }
      } catch (err) {
        if (opts.debug) console.warn('[audio] unlock failed', err);
      }
    },

    /** Convenience: unlock on the first pointer/key/touch gesture. */
    autoUnlock(target = typeof document !== 'undefined' ? document : null) {
      if (!target) return () => {};
      const evs = ['pointerdown', 'keydown', 'touchend'];
      const go = () => { evs.forEach((e) => target.removeEventListener(e, go, true)); audio.unlock(); };
      evs.forEach((e) => target.addEventListener(e, go, true));
      return () => evs.forEach((e) => target.removeEventListener(e, go, true));
    },

    attach(bus) {
      audio.detach();
      if (!bus || !bus.on) return;
      offs = BUS_EVENTS.map((t) => bus.on(t, (payload) => event(t, payload)));
    },
    detach() { offs.forEach((off) => { try { if (typeof off === 'function') off(); } catch { /* ignore */ } }); offs = []; },

    /** Direct event entry (what `attach` uses); handy for demos and tests. */
    event,

    update(state, dt) {
      if (!state) return;
      if (state.status) status = state.status;
      if (state.player) { playerPos = state.player.pos || playerPos; playerId = state.player.id ?? playerId; }
      if (typeof state.mass === 'number') {
        const sc = massScale(state.mass);
        if (Math.abs(sc - S.scale) > 0.002) { S.scale = sc; S.res = resonanceHz(sc); if (E) applyFilters(); }
        S.mass = state.mass;
      }
      if (state.stageId) setStage(state.stageId);
      if (!running()) return;
      const hud = state.hud || lastHud;
      lastHud = hud;
      layerAcc += dt;
      const active = status === 'playing' && !dead && state.health !== 0;
      // Pause / choice menus tuck the ambience down a little.
      if (T() > duckUntil) setTarget(E.buses.ambDuck.gain, status === 'paused' || status === 'choice' ? 0.55 : dead ? 0.35 : 1, 0.3);
      if (layerAcc >= 1 / 30) {                               // ~30 Hz is plenty for smoothed targets
        layers.update({
          active, scale: S.scale, thrust: hud.thrust, gravityDepth: hud.gravityDepth, proximity: hud.proximity,
          inAtmosphere: hud.inAtmosphere, density: hud.atmosphereDensity, capture: hud.capture ? hud.capture.level : 0,
        }, layerAcc);
        if (active) for (let n = layers.takeCrackles(); n > 0; n--) sfx.debrisTicks(E, S, { count: 2, spread: 0.05, level: 0.18 });
        if (bed) bed.update(layerAcc, S, status !== 'paused');
        layerAcc = 0;
      }
    },

    playUi(name) {
      if (!running() || typeof name !== 'string') return;
      const n = name.replace(/^ui\./, '');
      if (!gate.allow('ui:' + n, T(), 0.03)) return;
      try { sfx.ui(E, n); } catch (err) { if (opts.debug) console.warn('[audio]', err); }
    },

    setVolume(v = {}) {
      for (const k of ['master', 'music', 'sfx']) if (typeof v[k] === 'number') vol[k] = clamp(v[k]);
      applyVolumes(); persist();
    },
    setMuted(m) { vol.muted = !!m; applyVolumes(); persist(); },
    getVolume() { return { master: vol.master, music: vol.music, sfx: vol.sfx, muted: vol.muted }; },
    setStage,

    getStats() { return { voices: E ? E.activeVoices() : 0, peakDb: E ? E.peakDb() : -Infinity }; },

    dispose() {
      disposed = true; audio.detach();
      try { if (bed) bed.dispose(); if (!opts.context && ctx && ctx.close) ctx.close(); } catch { /* ignore */ }
      E = null; layers = null; bed = null;
    },
  };
  return audio;
}

export { STAGE_IDS };
