// Bootstrap: load the stages / renderer / UI modules, create canvas/camera/input/game, then run a
// fixed-timestep loop.
import { createCamera, resizeCamera } from './camera.js';
import { createInput } from './input.js';
import { createGame } from './game.js';
import { CONFIG } from './physics.js';

const STEP = 1 / 120;      // fixed simulation step (seconds)
const MAX_FRAME = 0.25;    // clamp huge frame gaps (tab switch, breakpoints)
const MAX_STEPS = 12;

const EXPECTED = {
  './stages.js': ['STAGES', 'getStage', 'getChoicesFor', 'applyChoice', 'getEnding'],
  './render/index.js': ['createRenderer', 'spawnEffect'],
  './ui/index.js': ['createUI'],
};

// Import every module and check its exports, so a broken file fails with a readable message.
async function loadModules() {
  const out = {};
  const problems = [];
  for (const [path, names] of Object.entries(EXPECTED)) {
    let mod;
    try {
      mod = await import(path);
    } catch (err) {
      problems.push(`${path} failed to load: ${err && err.message}`);
      continue;
    }
    for (const name of names) {
      if (mod[name] === undefined) problems.push(`${path} does not export ${name}`);
      else out[name] = mod[name];
    }
  }
  if (problems.length) throw new Error(`Vesper Drift could not start:\n  ${problems.join('\n  ')}`);
  return out;
}

function showFatal(err) {
  console.error(err);
  const pre = document.createElement('pre');
  pre.style.cssText = 'color:#FF5E73;background:#070914;position:fixed;left:8px;top:8px;right:8px;margin:0;'
    + 'padding:12px;font:13px/1.4 monospace;white-space:pre-wrap;z-index:9999';
  pre.textContent = String((err && err.message) || err);
  document.body.appendChild(pre);
}

async function main() {
  const canvas = document.getElementById('game');
  const uiRoot = document.getElementById('ui');
  const mod = await loadModules();

  const camera = createCamera();
  const syncSize = () => resizeCamera(camera, canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight);
  syncSize();

  const renderer = mod.createRenderer(canvas);
  const ui = mod.createUI(uiRoot);
  const input = createInput(canvas);
  const game = createGame({ mod, renderer, ui, camera, input });

  // The UI owns the pause menu (Esc / pause button); the engine just stops stepping.
  ui.onPause((paused) => game.setPaused(paused));

  window.addEventListener('resize', () => {
    renderer.resize();
    syncSize();
  });

  game.showTitle();

  let last = performance.now();
  let acc = 0;
  let hidden = document.hidden;
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    last = performance.now(); // do not fast-forward after the tab comes back
    acc = 0;
    // Leaving the tab mid-run opens the pause menu so the player comes back to a paused game.
    if (hidden && game.state.status === 'playing' && !game.paused) {
      ui.setPaused(true);
      game.setPaused(true);
    }
  });

  function frame(now) {
    requestAnimationFrame(frame);
    if (hidden) return;
    canvas.style.cursor = game.state.status === 'playing' && !game.paused ? 'none' : ''; // hide the system cursor only during active play
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    if (game.paused) {
      acc = 0;
      game.render(0); // dt 0 freezes effects and particles
      return;
    }
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < MAX_STEPS) {
      game.step(STEP);
      acc -= STEP;
      n++;
    }
    if (n === MAX_STEPS) acc = 0; // fell too far behind; drop the backlog
    game.render(dt);
  }
  requestAnimationFrame(frame);

  // Handy for tuning from the console: __orbit.CONFIG.chase.enabled = false
  window.__orbit = { game, state: game.state, camera, CONFIG, mod, renderer, ui };
}

main().catch(showFatal);
