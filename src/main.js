// Bootstrap: load the shared modules (falling back to src/dev-stubs.js for anything missing),
// create canvas/camera/input/game, then run a fixed-timestep loop.
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

let stubs = null;
async function loadStubs() {
  stubs ||= await import('./dev-stubs.js');
  return stubs;
}

// Import the real module if it exists; fill in any missing export from the dev stubs.
async function loadModules() {
  const out = {};
  for (const [path, names] of Object.entries(EXPECTED)) {
    let real = {};
    try {
      real = await import(path);
    } catch (err) {
      console.warn(`[engine] ${path} unavailable, using dev stub (${err && err.message})`);
    }
    for (const name of names) {
      if (real[name] !== undefined) out[name] = real[name];
      else out[name] = (await loadStubs())[name];
    }
  }
  return out;
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
  });

  function frame(now) {
    requestAnimationFrame(frame);
    if (hidden) return;
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
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
  window.__orbit = { game, state: game.state, camera, CONFIG, mod };
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#FF5E73;position:fixed;left:8px;top:8px">${String(err && err.stack || err)}</pre>`);
});
