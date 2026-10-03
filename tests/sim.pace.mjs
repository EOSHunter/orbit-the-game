// Headless pacing estimate for the infinite-universe sim (adapted from the 2D tests/pace.mjs).
// Runs the real createSim with a simple bot (no renderer, no DOM) and reports time to reach each stage, early-game
// health, deaths and endings. Exit code 1 if the pacing targets are missed, so it doubles as a regression check.
//
//   node tests/sim.pace.mjs                       # 6 runs, default bot
//   node tests/sim.pace.mjs --runs 12 --seed 7 --max 2400 --immortal --verbose
//   node tests/sim.pace.mjs --set absorb.gentle=0.5 --set chase.enabled=false
//   node tests/sim.pace.mjs --sloppy              # human-ish bot: re-aims every 0.3 s, notices threats late
//   node tests/sim.pace.mjs --dt 60               # step at 60 Hz instead of 120 Hz (faster, slightly coarser)
//
// --immortal keeps the bot alive (pure pacing); without it deaths are counted as in a real run.
import { createSim } from '../src/sim/index.js';
import { CONFIG, mergeConfig } from '../src/sim/config.js';
import { STAGES, ABANDON_ID } from '../src/stages.js';
import { makeRng } from '../src/sim/rng.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : Number.isNaN(Number(v)) ? v : Number(v);
};
const RUNS = opt('runs', 6);
const SEED = opt('seed', 1);
const MAX_T = opt('max', 40 * 60);
const IMMORTAL = !!opt('immortal', false);
const VERBOSE = !!opt('verbose', false);
const SLOPPY = !!opt('sloppy', false);
const HZ = opt('dt', 120);
const STEP = 1 / HZ;

const overrides = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] !== '--set') continue;
  const [path, raw] = String(args[i + 1]).split('=');
  const keys = path.split('.');
  let o = overrides;
  for (const k of keys.slice(0, -1)) o = (o[k] ??= {});
  o[keys.at(-1)] = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
  console.log(`CONFIG.${path} = ${raw}`);
}
if (IMMORTAL) { overrides.ratio = { ...(overrides.ratio || {}), lethal: Infinity }; }

// ---- bot: seek the best nearby prey, flee threats ----------------------------------------------------------
function createBot(state, sim) {
  const steer = { x: 0, z: 0, stabilize: false };
  const flee = SLOPPY ? 0.5 : 1;
  let lastAim = -1;
  let heading = 0.7; // explore direction when nothing is worth chasing
  let lastCount = 0; let lastGain = 0; let exploreUntil = 0; let turn = 0;
  return function aim() {
    if (SLOPPY) {
      if (state.time - lastAim < 0.3) return steer;
      lastAim = state.time;
    }
    const p = state.player;
    let ax = 0; let az = 0;
    let best = null; let bestScore = 0;
    // stagnation: nothing eaten for a while (unreachable fast debris near a star, a barren pocket): go somewhere else
    if (state.stats.absorbed !== lastCount) { lastCount = state.stats.absorbed; lastGain = state.time; }
    if (state.time - lastGain > 20 && state.time > exploreUntil) { exploreUntil = state.time + 12; heading += 2.1 + (++turn % 3); lastGain = state.time; }
    const exploring = state.time < exploreUntil;
    const vmax = 14 * p.radius;
    // black holes that can capture us (4x to 300x our mass): stay out of their zone, and when the HUD warns, thrust away
    // from all of them at once (a player sees them on screen)
    const holes = sim.debug.wells.filter((w) => w.cls === 'blackHole' && w.mass >= 4 * state.mass && w.mass <= 300 * state.mass)
      .map((w) => ({ w, rc: Math.max(6 * w.radius, 40 * p.radius) }));
    if (state.hud.capture) {
      let fx = 0; let fz = 0;
      for (const { w, rc } of holes) {
        const dx = w.p[0] - p.p[0]; const dz = w.p[2] - p.p[2]; const d = Math.hypot(dx, dz) || 1;
        if (d > 2.2 * rc) continue;
        const k = (rc / d) ** 2;
        fx -= (dx / d) * k; fz -= (dz / d) * k;
      }
      const l = Math.hypot(fx, fz);
      if (l > 0) { steer.x = fx / l; steer.z = fz / l; steer.stabilize = false; return steer; }
    }
    const threats = state.bodies.filter((b) => b.rel === 'threat' && b.state === 'alive' && b.radius > 2 * p.radius);
    for (const b of state.bodies) {
      if (b.state !== 'alive') continue;
      const dx = b.p[0] - p.p[0]; const dz = b.p[2] - p.p[2];
      const d = Math.hypot(dx, dz) || 1e-6;
      const gap = Math.max(d - p.radius - b.radius, p.radius * 0.2);
      if (b.rel === 'prey') {
        if (exploring) continue;
        if (Math.hypot(b.v[0] - p.v[0], b.v[2] - p.v[2]) > 0.8 * vmax) continue; // cannot be caught
        if (threats.some((t) => Math.hypot(t.p[0] - b.p[0], t.p[2] - b.p[2]) < 2.2 * t.radius + 3 * p.radius)) continue; // inside a big threat's danger zone
        if (holes.some(({ w, rc }) => Math.hypot(w.p[0] - b.p[0], w.p[2] - b.p[2]) < 1.5 * rc)) continue; // inside a black hole's capture zone
        const score = b.mass / (gap + p.radius * 2);
        if (score > bestScore) { bestScore = score; best = b; }
      } else if (b.rel === 'threat') {
        const huge = b.cls === 'blackHole' ? 8 * b.radius : 0;
        const range = Math.max(p.radius * 7 * flee + b.radius + huge, 2.4 * b.radius + 3 * p.radius);
        if (d < range) {
          const w = (1 - d / range) ** 2 * 6;
          ax -= (dx / d) * w; az -= (dz / d) * w;
        }
      }
    }
    if (best) {
      const dx = best.p[0] - p.p[0]; const dz = best.p[2] - p.p[2]; const d = Math.hypot(dx, dz) || 1e-6;
      ax += dx / d; az += dz / d;
      heading = Math.atan2(dz, dx);
    } else {
      // nothing to eat in view: follow the HUD beacon out of a void, otherwise keep exploring along the heading
      const nm = state.hud.region.nearestMatter;
      if (nm) heading = Math.atan2(-Math.cos(nm.bearing), Math.sin(nm.bearing));
      ax += Math.cos(heading); az += Math.sin(heading);
    }
    const l = Math.hypot(ax, az);
    steer.x = l > 1e-6 ? ax / l : 0; steer.z = l > 1e-6 ? az / l : 0;
    steer.stabilize = false;
    return steer;
  };
}

function runOnce(seed) {
  const rng = makeRng(seed * 7919 + 1);
  const sim = createSim({ seed: `pace-${seed}`, config: overrides });
  const st = sim.getState();
  const log = { ending: null, choices: [], deathCause: null };
  sim.events.on('ending', (e) => { log.ending = e.ending; log.kind = e.kind; });
  sim.events.on('death', (e) => { log.deathCause = e.cause; });
  sim.events.on('choice-open', (e) => {
    const real = e.choices.filter((c) => c.id !== ABANDON_ID);
    const c = real[Math.floor(rng() * real.length)] || e.choices[0];
    log.choices.push(c.id);
    log.pending = c.id;
  });
  if (VERBOSE) {
    sim.events.on('capture-warning', (e) => {
      const host = st.bodies.find((b) => b.id === e.bodyId); const p = st.player;
      const d = host ? Math.hypot(host.p[0] - p.p[0], host.p[2] - p.p[2]) : NaN;
      console.log(`  [capture-warning ${e.level}] t=${st.stats.elapsed.toFixed(1)}s stage=${st.stageIndex} S=${p.radius.toFixed(0)} dist=${(d / p.radius).toFixed(1)} S (${host ? (d / host.radius).toFixed(1) : '?'} R)`
        + ` speed=${(st.hud.speed / p.radius).toFixed(1)} S/s hostMass/mine=${host ? (host.mass / p.mass).toFixed(1) : '?'}`);
    });
    sim.events.on('roche-disruption', (e) => { if (e.victim === 'player') console.log(`  [tidal ${e.phase}] t=${st.stats.elapsed.toFixed(1)}s host=${e.cls} mass/mine=${(e.mass / st.mass).toFixed(1)} health=${st.health.toFixed(2)}`); });
    sim.events.on('hit', (e) => console.log(`  [hit] t=${st.stats.elapsed.toFixed(1)}s ${e.cls} strength=${e.strength.toFixed(2)} health=${e.health.toFixed(2)} lethal=${e.lethal}`));
    sim.events.on('capture-clear', () => console.log(`  [capture-clear] t=${st.stats.elapsed.toFixed(1)}s`));
    sim.events.on('death', (e) => console.log(`  [death ${e.cause}] t=${st.stats.elapsed.toFixed(1)}s killer=${e.killerCls}`));
  }
  const aim = createBot(st, sim);
  sim.start();
  const reached = new Array(STAGES.length).fill(null);
  reached[0] = 0;
  let at60 = null; let steps = 0; let pickIn = 0;
  while (st.status !== 'ended' && st.stats.elapsed < MAX_T) {
    if (st.status === 'choice') { if (++pickIn > HZ * 0.4) { pickIn = 0; sim.pickChoice(log.pending); } } // the UI would pick ~0.4 s later
    if (IMMORTAL) st.health = 1;
    const inp = aim();
    sim.setInput(inp);
    sim.step(STEP);
    if (VERBOSE && st.hud.capture && steps % 15 === 0) {
      const host = st.bodies.find((b) => b.id === st.hud.capture.hostId) || sim.debug.wells.find((w) => w.id === st.hud.capture.hostId); const p = st.player;
      const dx = host ? host.p[0] - p.p[0] : 0; const dz = host ? host.p[2] - p.p[2] : 0; const d = Math.hypot(dx, dz) || 1;
      console.log(`    cap t=${st.stats.elapsed.toFixed(2)} level=${st.hud.capture.level.toFixed(2)} host=${host ? 'bodies' : 'NOT-IN-BODIES'} d=${(d / p.radius).toFixed(1)}S steer.host=${((inp.x * dx + inp.z * dz) / d).toFixed(2)} vIn=${(((p.v[0] * dx + p.v[2] * dz) / d) / p.radius).toFixed(1)}S/s`
        + ` BH=[${sim.debug.wells.filter((w) => w.cls === 'blackHole').map((w) => `${(Math.hypot(w.p[0] - p.p[0], w.p[2] - p.p[2]) / p.radius).toFixed(0)}S m${(w.mass / st.mass).toFixed(0)}`).filter((t) => parseInt(t) < 160).join(' ')}] thrust=${(Math.hypot(...st.player.thrust)).toFixed(2)}`);
    }
    const t = st.stats.elapsed;
    if (reached[st.stageIndex] === null) reached[st.stageIndex] = t;
    if (at60 === null && t >= 60) at60 = { mass: st.mass, stage: st.stageIndex, hits: st.stats.hits, absorbed: st.stats.absorbed };
    if (++steps % (HZ * 5) === 0 && VERBOSE) {
      console.log(`  t=${t.toFixed(0)}s stage=${st.stageIndex} mass=${st.mass.toFixed(1)} bodies=${st.bodies.length} far=${st.far.count}`
        + ` hits=${st.stats.hits} hp=${st.health.toFixed(2)} absorbed=${st.stats.absorbed} cap=${st.hud.capture ? st.hud.capture.level.toFixed(2) : '-'}`);
    }
  }
  return {
    seed, reached, at60, elapsed: st.stats.elapsed,
    ending: log.ending ? log.ending.id : 'timeout', died: !!st.deathCause, deathCause: st.deathCause, deathStage: st.deathCause ? st.stageIndex : null,
    hits: st.stats.hits, absorbed: st.stats.absorbed, nearMisses: st.stats.nearMisses, disruptions: st.stats.disruptions, choices: log.choices,
  };
}

const fmt = (s) => (s == null ? '   -  ' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`.padStart(6));
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : null; };

const t0 = Date.now();
const results = [];
for (let i = 0; i < RUNS; i++) {
  const r = runOnce(SEED + i);
  results.push(r);
  console.log(`run ${String(i + 1).padStart(2)}: ${r.ending.padEnd(16)} ${fmt(r.elapsed)}  stage ${r.reached.filter((x) => x !== null).length - 1}`
    + `  hits ${r.hits}  absorbed ${r.absorbed}  60s: mass ${r.at60 ? r.at60.mass.toFixed(1) : '-'} hits ${r.at60 ? r.at60.hits : '-'}  (${((Date.now() - t0) / 1000).toFixed(0)} s wall)`);
}

console.log(`\nStage pacing (${RUNS} runs, ${IMMORTAL ? 'immortal' : 'mortal'}${SLOPPY ? ' sloppy' : ''} bot, ${HZ} Hz)`);
console.log('stage               minMass   reached(median)  time in stage(median / max)');
const N = STAGES.length;
let worstStage = 0;
for (let s = 0; s < N; s++) {
  const reach = results.map((r) => r.reached[s]).filter((x) => x !== null);
  const dur = results.filter((r) => r.reached[s] !== null && s + 1 < N && r.reached[s + 1] !== null).map((r) => r.reached[s + 1] - r.reached[s]);
  const md = median(dur); const mx = dur.length ? Math.max(...dur) : null;
  if (md !== null) worstStage = Math.max(worstStage, md);
  console.log(`${String(s).padStart(2)} ${STAGES[s].name.padEnd(16)} ${String(STAGES[s].minMass).padStart(8)}   ${fmt(median(reach))} (${reach.length}/${RUNS})   ${fmt(md)} / ${fmt(mx)}`);
}

const finished = results.filter((r) => r.reached[N - 1] !== null && !r.died);
const fullRun = median(finished.map((r) => r.elapsed));
const deaths = results.filter((r) => r.died);
const early = results.filter((r) => r.at60);
const earlyDeaths = results.filter((r) => r.died && r.elapsed < 60).length;
console.log(`\nFull runs finished: ${finished.length}/${RUNS}, median length ${fmt(fullRun)}`);
console.log(`Deaths: ${deaths.length} (${deaths.map((r) => `${r.deathCause}@stage${r.deathStage}`).join(', ') || 'none'})`);
console.log(`First 60 s: median mass ${(median(early.map((r) => r.at60.mass)) ?? 0).toFixed(1)}, median stage ${median(early.map((r) => r.at60.stage))}, median hits ${median(early.map((r) => r.at60.hits))}, deaths before 60 s ${earlyDeaths}`);
console.log(`Near misses (median) ${median(results.map((r) => r.nearMisses))}, Roche disruptions (median) ${median(results.map((r) => r.disruptions))}`);
console.log(`Endings: ${Object.entries(results.reduce((m, r) => ((m[r.ending] = (m[r.ending] || 0) + 1), m), {})).map(([k, v]) => `${k} x${v}`).join(', ')}`);
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s wall)`);

const problems = [];
if (IMMORTAL || finished.length) {
  if (fullRun === null) problems.push('no run reached the final stage');
  else if (fullRun < 600 || fullRun > 1200) problems.push(`median full run ${fmt(fullRun).trim()} is outside 10:00-20:00`);
}
if (worstStage > 130) problems.push(`slowest stage median ${fmt(worstStage).trim()} is over ~2:00`);
const mass60 = median(early.map((r) => r.at60.mass));
if (mass60 !== null && mass60 < 2) problems.push(`first minute: median mass after 60 s is only ${mass60.toFixed(1)}`);
if (earlyDeaths > RUNS * 0.15) problems.push(`first minute: ${earlyDeaths}/${RUNS} runs died before 60 s`);
if (problems.length) { console.log(`\nPACING ISSUES:\n  ${problems.join('\n  ')}`); process.exitCode = 1; } else console.log('\nPacing targets met.');
void CONFIG; void mergeConfig;
