// The 3D build's loop and the ONE place that wires modules together (contract section 5/11).
//   frame order: input.poll -> sim.setInput -> sim.step * n -> renderer.drawFrame -> ui.update -> audio.update
// Every module except the renderer is loaded defensively: while SIM / UI / SND are not merged yet this
// file runs on ENG's fixture states with silent audio and a bare HUD, so the renderer is always testable.
import { createRenderer } from './render3d/index.js';
import { createInput } from './input3d.js';

const STEP = 1 / 120, MAX_FRAME = 0.25, MAX_STEPS = 12;

async function tryImport(path) {
  try { return await import(path); } catch (err) { console.warn(`[main3d] ${path} unavailable (${err && err.message})`); return null; }
}

function createBus() {
  const m = new Map();
  return {
    on(t, f) { if (!m.has(t)) m.set(t, new Set()); m.get(t).add(f); return () => m.get(t) && m.get(t).delete(f); },
    off(t, f) { if (m.has(t)) m.get(t).delete(f); },
    emit(t, p) { for (const k of [t, '*']) if (m.has(k)) for (const f of m.get(k)) f(p, t); },
  };
}

// Stand-in used only when src/sim is not present: static fixture world with cosmetic motion.
async function createFixtureSim() {
  const fx = await import('./render3d/fixtures.js');
  const events = createBus();
  let state = fx.makeFixtureState('asteroid');
  let paused = false;
  const sim = {
    events, getState: () => state,
    step(dt) { if (!paused) fx.stepFixture(state, dt); },
    setInput() {}, start() { state.status = 'playing'; events.emit('run-start', { seed: state.seed, genVersion: 1, stageId: state.stageId }); },
    restart() { state = fx.makeFixtureState('asteroid'); sim.start(); }, pickChoice() {}, setPaused(p) { paused = p; },
    exportSave() { return null; }, importSave() { return false; }, debug: {},
  };
  return { sim, CLS_LIST: state.CLS_LIST, fixture: true };
}

export async function start3d() {
  const canvas = document.getElementById('game');
  const uiRoot = document.getElementById('ui');
  const params = new URLSearchParams(location.search);

  // ---- sim (real, or fixtures) ----
  const simMod = await tryImport('./sim/index.js');
  let sim, CLS_LIST, usingFixtures = false;
  if (simMod && simMod.createSim) {
    sim = simMod.createSim({ seed: params.get('seed') || undefined });
    CLS_LIST = simMod.CLS_LIST;
  } else {
    const f = await createFixtureSim(); sim = f.sim; CLS_LIST = f.CLS_LIST; usingFixtures = true;
  }

  // ---- renderer first: if it cannot init, throw before touching the UI so boot.js can fall back to 2D ----
  const renderer = createRenderer({ canvas, clsList: CLS_LIST });
  if (!(await renderer.init())) throw new Error('render3d init() returned false');

  // ---- optional modules ----
  const audioMod = await tryImport('./audio/index.js');
  const audio = audioMod && audioMod.createAudio ? audioMod.createAudio() : null;
  const uiMod = await tryImport('./ui/index.js');
  const ui = uiMod && uiMod.init ? uiMod : null;       // new-contract UI exports init(); the old 2D UI does not

  const bus = sim.events;
  renderer.attach(bus);
  if (audio) audio.attach(bus);

  const applySettings = (s) => {
    if (!s) return;
    if (audio) { audio.setVolume({ master: s.master, music: s.music, sfx: s.sfx }); }
    renderer.setQuality(s.quality || 'auto');
    renderer.setOptions({ reducedMotion: !!s.reducedMotion, readability: !!s.readability, topDown: !!s.topDown });
  };
  if (ui) {
    // onPause: the UI's Systems panel (Esc / Resume / close) drives the sim pause.
    ui.init({ root: uiRoot, onUiSound: (n) => audio && audio.playUi(n), onSettings: applySettings, onPause: (p) => sim.setPaused(p) });
    if (ui.attach) ui.attach(bus);
    applySettings(ui.getSettings && ui.getSettings());
    ui.showTitle(() => sim.start(), { seed: sim.getState().seed });
    bus.on('choice-open', (e) => ui.showChoice(e.choices, (id) => sim.pickChoice(id)));
    bus.on('ending', (e) => ui.showEnd(e.ending, () => sim.restart()));
  } else {
    // no UI yet: start straight away so the world is visible
    sim.start();
  }

  // ---- input ----
  const input = createInput(canvas, () => renderer.getView(), () => sim.getState().player.p);

  const resize = () => renderer.resize(innerWidth, innerHeight, devicePixelRatio || 1);
  addEventListener('resize', resize); resize();

  // first user gesture unlocks audio (autoplay policy)
  const unlock = () => { if (audio) audio.unlock(); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);

  let topLocal = false;
  addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;   // the UI already handled it (Esc menu, T/V toggles); avoid a double toggle
    if (e.code === 'Escape') { const s = sim.getState().status; if (s === 'playing') sim.setPaused(true); else if (s === 'paused') sim.setPaused(false); }
    if (e.code === 'KeyT') { topLocal = !topLocal; renderer.setOptions({ topDown: topLocal }); }
  });

  // death slow motion (sim time dilation), purely a loop concern
  let timeScale = 1, slowUntil = 0;
  bus.on('death', () => { slowUntil = performance.now() + 2600; });

  // ---- loop ----
  let acc = 0, last = performance.now(), hidden = document.hidden;
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; last = performance.now(); });

  function frame(now) {
    requestAnimationFrame(frame);
    if (hidden) { last = now; return; }                       // paused when the tab is hidden
    const raw = Math.min(MAX_FRAME, Math.max(0, (now - last) / 1000)); last = now;
    timeScale += ((performance.now() < slowUntil ? 0.25 : 1) - timeScale) * Math.min(1, raw * 6);
    acc += raw * timeScale;
    const inp = input.poll();
    sim.setInput(inp);
    let n = 0;
    while (acc >= STEP && n < MAX_STEPS) { sim.step(STEP); acc -= STEP; n++; }
    if (n === MAX_STEPS) acc = 0;                             // never spiral
    const state = sim.getState();
    renderer.drawFrame(state, raw * timeScale);
    if (ui) ui.update(state, renderer.getView());
    if (audio) audio.update(state, raw);
  }
  requestAnimationFrame(frame);

  window.__vd = { sim, renderer, audio, ui, fixtures: usingFixtures };
}
