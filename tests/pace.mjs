// Headless pacing estimate: runs the real engine (game.js + world.js + physics.js + stages.js) with a
// simple bot, no renderer or DOM. Reports time to reach each stage, early-game health, and endings.
//
//   node tests/pace.mjs                 # 8 runs, default bot
//   node tests/pace.mjs --runs 20 --seed 7 --max 2400 --immortal --verbose
//   node tests/pace.mjs --set absorbEfficiency=0.2 --set chase.enabled=false
//   node tests/pace.mjs --sloppy        # human-ish bot: re-aims every 0.3 s, notices threats late
//
// --immortal keeps the bot alive (pure pacing); without it deaths are counted as in a real run.
// Exit code 1 if the pacing targets are missed (full run 10-20 min, no stage over ~2 min,
// first minute not too slow or too deadly), so it can double as a regression check.
import { createGame } from '../src/game.js';
import { createCamera, resizeCamera } from '../src/camera.js';
import { CONFIG } from '../src/physics.js';
import * as stages from '../src/stages.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : Number.isNaN(Number(v)) ? v : Number(v);
};
const RUNS = opt('runs', 8);
const SEED = opt('seed', 1);
const MAX_T = opt('max', 40 * 60);  // seconds of play per run before giving up
const IMMORTAL = !!opt('immortal', false);
const VERBOSE = !!opt('verbose', false);
const SLOPPY = !!opt('sloppy', false); // human-ish bot: slow reactions, notices threats late
const STEP = 1 / 120;
if (IMMORTAL) CONFIG.ratio.lethal = Infinity; // no one-hit kills either

// --set chase.enabled=false --set absorbEfficiency=0.2 : override CONFIG values for tuning sweeps.
for (let i = 0; i < args.length; i++) {
  if (args[i] !== '--set') continue;
  const [path, raw] = String(args[i + 1]).split('=');
  const keys = path.split('.');
  let o = CONFIG;
  for (const k of keys.slice(0, -1)) o = o[k];
  o[keys.at(-1)] = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
  console.log(`CONFIG.${path} = ${o[keys.at(-1)]}`);
}

// Deterministic Math.random so runs are reproducible.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- bot: seek the best nearby prey, flee threats, stay inside the arena ----------------------
function createBot(state) {
  const steer = { x: 0, y: 0 };
  const flee = SLOPPY ? 0.5 : 1; // flee-range multiplier
  let lastAim = -1;
  return {
    getSteer(camera, p) {
      if (SLOPPY) {
        if (state.time - lastAim < 0.3) return steer;
        lastAim = state.time;
      }
      let ax = 0, ay = 0;
      let best = null, bestScore = 0;
      for (const b of state.bodies) {
        if (!b.alive) continue;
        const dx = b.x - p.x, dy = b.y - p.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const gap = Math.max(d - p.radius - b.radius, p.radius * 0.2);
        if (b.kind === 'prey') {
          const score = b.mass / (gap + p.radius * 2);
          if (score > bestScore) { bestScore = score; best = b; }
        } else if (b.kind === 'threat') {
          // Flee, harder the closer and the more it outweighs us; chasers get extra room.
          const range = p.radius * (b.chasing ? 14 : 7) * flee + b.radius;
          if (d < range) {
            const w = (1 - d / range) ** 2 * 6 * (b.chasing ? 1.5 : 1);
            ax -= (dx / d) * w; ay -= (dy / d) * w;
          }
        }
      }
      if (best) {
        const dx = best.x - p.x, dy = best.y - p.y, d = Math.hypot(dx, dy) || 1e-6;
        ax += dx / d; ay += dy / d;
      }
      // Turn back well before the warning ring: drop any outward component, then pull inward.
      const e = Math.hypot(p.x, p.y) / state.bounds.radius;
      if (e > 0.6) {
        const ox = p.x / (e * state.bounds.radius), oy = p.y / (e * state.bounds.radius);
        const out = ax * ox + ay * oy;
        if (out > 0) { ax -= ox * out; ay -= oy * out; }
        const k = (e - 0.6) * 25;
        ax -= ox * k; ay -= oy * k;
      }
      const l = Math.hypot(ax, ay);
      steer.x = l > 1e-6 ? ax / l : 0;
      steer.y = l > 1e-6 ? ay / l : 0;
      return steer;
    },
  };
}

function runOnce(seed) {
  Math.random = mulberry32(seed);
  const camera = createCamera();
  resizeCamera(camera, 1280, 720);
  const log = { ending: null, choices: [] };
  let pickNext = null;
  const ui = {
    update() {}, warnBoundary() {}, onPause() {},
    showTitle() {},
    showEnd(ending) { log.ending = ending; },
    showChoice(choices, onPick) {
      // Pick a random non-abandon option (abandon is a niche path).
      const real = choices.filter((c) => c.id !== stages.ABANDON_ID);
      const c = real[Math.floor(Math.random() * real.length)] || choices[0];
      log.choices.push(c.id);
      pickNext = () => onPick(c.id, c);
    },
  };
  const renderer = { drawFrame() {}, resize() {} };
  const mod = { ...stages, spawnEffect() {} };
  let bot = null;
  const input = { getSteer: (cam, p) => bot.getSteer(cam, p) };
  const game = createGame({ mod, renderer, ui, camera, input });
  const { state } = game;
  bot = createBot(state);
  game.begin();

  const reached = new Array(stages.STAGES.length).fill(null);
  reached[0] = 0;
  let at60 = null;
  let steps = 0;
  while (state.status !== 'ended' && state.stats.elapsed < MAX_T) {
    if (IMMORTAL) state.health = CONFIG.player.maxHealth;
    game.step(STEP);
    if (pickNext) { const f = pickNext; pickNext = null; f(); } // the UI would pick ~0.4 s later
    const t = state.stats.elapsed;
    if (reached[state.stageIndex] === null) reached[state.stageIndex] = t;
    if (at60 === null && t >= 60) at60 = { mass: state.mass, stage: state.stageIndex, hits: state.stats.hits, absorbed: state.stats.absorbed };
    if (++steps % (120 * 5) === 0 && VERBOSE) {
      const edge = Math.hypot(state.player.x, state.player.y) / state.bounds.radius;
      const chasing = state.bodies.filter((b) => b.chasing).length;
      console.log(`  t=${t.toFixed(0)}s stage=${state.stageIndex} mass=${state.mass.toFixed(1)} bodies=${state.bodies.length}`
        + ` edge=${edge.toFixed(2)} chasing=${chasing} hits=${state.stats.hits} hp=${state.health.toFixed(2)}`);
    }
  }
  return {
    seed, reached, at60,
    elapsed: state.stats.elapsed,
    ending: log.ending ? log.ending.id : 'timeout',
    died: !!state.deathCause, deathCause: state.deathCause, deathStage: state.deathCause ? state.stageIndex : null,
    hits: state.stats.hits, absorbed: state.stats.absorbed, choices: log.choices,
  };
}

const fmt = (s) => (s == null ? '   -  ' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`.padStart(6));
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : null; };

const t0 = Date.now();
const results = [];
for (let i = 0; i < RUNS; i++) {
  const r = runOnce(SEED + i * 7919);
  results.push(r);
  console.log(`run ${String(i + 1).padStart(2)}: ${r.ending.padEnd(16)} ${fmt(r.elapsed)}  stage ${r.reached.filter((x) => x !== null).length - 1}`
    + `  hits ${r.hits}  absorbed ${r.absorbed}  60s: mass ${r.at60 ? r.at60.mass.toFixed(1) : '-'} hits ${r.at60 ? r.at60.hits : '-'}`);
}

console.log(`\nStage pacing (${RUNS} runs, ${IMMORTAL ? 'immortal' : 'mortal'}${SLOPPY ? ' sloppy' : ''} bot, absorbEfficiency ${CONFIG.absorbEfficiency})`);
console.log('stage               minMass   reached(median)  time in stage(median / max)');
const N = stages.STAGES.length;
let worstStage = 0;
for (let s = 0; s < N; s++) {
  const reach = results.map((r) => r.reached[s]).filter((x) => x !== null);
  const dur = results
    .filter((r) => r.reached[s] !== null && s + 1 < N && r.reached[s + 1] !== null)
    .map((r) => r.reached[s + 1] - r.reached[s]);
  const md = median(dur), mx = dur.length ? Math.max(...dur) : null;
  if (md !== null) worstStage = Math.max(worstStage, md);
  console.log(`${String(s).padStart(2)} ${stages.STAGES[s].name.padEnd(16)} ${String(stages.STAGES[s].minMass).padStart(8)}   `
    + `${fmt(median(reach))} (${reach.length}/${RUNS})   ${fmt(md)} / ${fmt(mx)}`);
}

const finished = results.filter((r) => r.reached[N - 1] !== null && !r.died);
const fullRun = median(finished.map((r) => r.elapsed));
const deaths = results.filter((r) => r.died);
const early = results.filter((r) => r.at60);
const earlyDeaths = results.filter((r) => r.died && r.elapsed < 60).length;
const mass60 = median(early.map((r) => r.at60.mass));
const stage60 = median(early.map((r) => r.at60.stage));
const hits60 = median(early.map((r) => r.at60.hits));

console.log(`\nFull runs finished: ${finished.length}/${RUNS}, median length ${fmt(fullRun)}`);
console.log(`Deaths: ${deaths.length} (${deaths.map((r) => `${r.deathCause}@stage${r.deathStage}`).join(', ') || 'none'})`);
console.log(`First 60 s: median mass ${mass60 && mass60.toFixed(1)}, median stage ${stage60}, median hits ${hits60}, deaths before 60 s ${earlyDeaths}`);
console.log(`Endings: ${Object.entries(results.reduce((m, r) => ((m[r.ending] = (m[r.ending] || 0) + 1), m), {})).map(([k, v]) => `${k} x${v}`).join(', ')}`);
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s wall)`);

// Pacing targets.
const problems = [];
if (IMMORTAL || finished.length) {
  if (fullRun === null) problems.push('no run reached the final stage');
  else if (fullRun < 600 || fullRun > 1200) problems.push(`median full run ${fmt(fullRun).trim()} is outside 10:00-20:00`);
}
if (worstStage > 130) problems.push(`slowest stage median ${fmt(worstStage).trim()} is over ~2:00`);
if (stage60 !== null && stage60 < 1) problems.push('first minute: the bot has not left stage 0 after 60 s');
if (earlyDeaths > RUNS * 0.15) problems.push(`first minute: ${earlyDeaths}/${RUNS} runs died before 60 s`);
if (problems.length) {
  console.log(`\nPACING ISSUES:\n  ${problems.join('\n  ')}`);
  process.exitCode = 1;
} else {
  console.log('\nPacing targets met.');
}
