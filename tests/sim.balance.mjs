// Headless balance bot: plays the real sim (no DOM/renderer) with a simple greedy bot over many seeds and reports,
// per stage, the time spent, deaths, prey availability and where runs got stuck. Also checks that the universe is
// deterministic by seed and unbounded, and that the ending fires.
//
//   node tests/sim.balance.mjs                       # 12 seeds, mortal bot, 60 Hz
//   node tests/sim.balance.mjs --runs 30 --seed 100 --max 1500 --dt 60
//   node tests/sim.balance.mjs --set absorb.gentle=0.5      # config override (dotted path)
//
// Bot: steer toward the best prey (mass / distance), push away from larger bodies, flee black-hole capture zones
// when the HUD warns, and wander in a new direction when nothing was eaten for 20 s. Exit code 1 when a target is missed.
import { createSim } from '../src/sim/index.js';
import { createUniverse } from '../src/sim/universe.js';
import { CONFIG } from '../src/sim/config.js';
import { STAGES, ABANDON_ID } from '../src/stages.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = args[i + 1];
  return v === undefined || v.startsWith('--') ? true : Number.isNaN(Number(v)) ? v : Number(v);
};
const RUNS = opt('runs', 12);
const SEED0 = opt('seed', 1);
const MAX_T = opt('max', 30 * 60);
const HZ = opt('dt', 60);
const STEP = 1 / HZ;
const N = STAGES.length;
const VERBOSE = !!opt('verbose', false);
const STAGE_LIMIT = 240; // s: "a stage taking over ~4 minutes" is a pacing failure

const overrides = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] !== '--set') continue;
  const [path, raw] = String(args[i + 1]).split('=');
  const keys = path.split('.');
  let o = overrides;
  for (const k of keys.slice(0, -1)) o = (o[k] ??= {});
  o[keys.at(-1)] = raw === 'true' ? true : raw === 'false' ? false : Number(raw);
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] : null; };
const fmt = (s) => (s == null ? '  -  ' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`.padStart(5));

// ---- the bot ---------------------------------------------------------------------------------------------------
function createBot(state, sim) {
  const steer = { x: 0, z: 0, stabilize: false };
  let heading = 0.7; let lastCount = 0; let lastGain = 0; let wanderUntil = 0; let turns = 0;
  return function aim() {
    const p = state.player;
    if (state.stats.absorbed !== lastCount) { lastCount = state.stats.absorbed; lastGain = state.time; }
    if (state.time - lastGain > 20 && state.time > wanderUntil) { wanderUntil = state.time + 12; heading += 2.1 + (++turns % 3); lastGain = state.time; }
    const wandering = state.time < wanderUntil;
    const vmax = 14 * p.radius;
    const holes = sim.debug.wells.filter((w) => w.cls === 'blackHole' && w.mass >= 4 * state.mass && w.mass <= 300 * state.mass)
      .map((w) => ({ w, rc: Math.max(6 * w.radius, 40 * p.radius) }));
    if (state.hud.capture) {
      let fx = 0; let fz = 0;
      for (const { w, rc } of holes) {
        const dx = w.p[0] - p.p[0]; const dz = w.p[2] - p.p[2]; const d = Math.hypot(dx, dz) || 1;
        if (d > 2.2 * rc) continue;
        const k = (rc / d) ** 2; fx -= (dx / d) * k; fz -= (dz / d) * k;
      }
      const l = Math.hypot(fx, fz);
      if (l > 0) { steer.x = fx / l; steer.z = fz / l; steer.stabilize = false; return steer; }
    }
    let ax = 0; let az = 0; let best = null; let bestScore = 0;
    // keep clear of any hole that could capture us (a player sees it coming): repel inside 1.8 capture radii
    for (const { w, rc } of holes) {
      const dx = w.p[0] - p.p[0]; const dz = w.p[2] - p.p[2]; const d = Math.hypot(dx, dz) || 1;
      if (d < 1.8 * rc) { const k = 8 * (1.8 * rc / d - 1); ax -= (dx / d) * k; az -= (dz / d) * k; }
    }
    const threats = state.bodies.filter((b) => b.rel === 'threat' && b.state === 'alive' && b.radius > 2 * p.radius);
    for (const b of state.bodies) {
      if (b.state !== 'alive') continue;
      const dx = b.p[0] - p.p[0]; const dz = b.p[2] - p.p[2];
      const d = Math.hypot(dx, dz) || 1e-6;
      const gap = Math.max(d - p.radius - b.radius, p.radius * 0.2);
      if (b.rel === 'prey') {
        if (wandering) continue;
        if (Math.hypot(b.v[0] - p.v[0], b.v[2] - p.v[2]) > 0.8 * vmax) continue;
        if (threats.some((t) => Math.hypot(t.p[0] - b.p[0], t.p[2] - b.p[2]) < 2.2 * t.radius + 3 * p.radius)) continue;
        if (holes.some(({ w, rc }) => Math.hypot(w.p[0] - b.p[0], w.p[2] - b.p[2]) < 1.5 * rc)) continue;
        const score = b.mass / (gap + p.radius * 2);
        if (score > bestScore) { bestScore = score; best = b; }
      } else if (b.rel === 'threat') {
        const huge = b.cls === 'blackHole' ? 8 * b.radius : 0;
        const range = Math.max(p.radius * 7 + b.radius + huge, 2.4 * b.radius + 3 * p.radius);
        if (d < range) { const w = (1 - d / range) ** 2 * 6; ax -= (dx / d) * w; az -= (dz / d) * w; }
      }
    }
    if (best) {
      const dx = best.p[0] - p.p[0]; const dz = best.p[2] - p.p[2]; const d = Math.hypot(dx, dz) || 1e-6;
      ax += dx / d; az += dz / d; heading = Math.atan2(dz, dx);
    } else {
      const nm = state.hud.region.nearestMatter;
      if (nm) heading = Math.atan2(-Math.cos(nm.bearing), Math.sin(nm.bearing));
      ax += Math.cos(heading); az += Math.sin(heading);
    }
    const l = Math.hypot(ax, az);
    steer.x = l > 1e-6 ? ax / l : 0; steer.z = l > 1e-6 ? az / l : 0;
    steer.stabilize = Math.hypot(p.v[0], p.v[2]) > 1.3 * vmax; // a player holds Space after a gravity fling
    return steer;
  };
}

function playOne(seed) {
  const sim = createSim({ seed: `bal-${seed}`, config: overrides });
  const st = sim.getState();
  const log = { ending: null, deathCause: null, pending: null };
  sim.events.on('ending', (e) => { log.ending = e.ending && e.ending.id; });
  sim.events.on('death', (e) => { log.deathCause = e.cause; });
  sim.events.on('choice-open', (e) => { const real = e.choices.filter((c) => c.id !== ABANDON_ID); log.pending = (real[seed % Math.max(1, real.length)] || e.choices[0]).id; });
  const aim = createBot(st, sim);
  sim.start();
  const enter = new Array(N).fill(null); enter[0] = 0;
  const preyMin = new Array(N).fill(Infinity); const preySum = new Array(N).fill(0); const preyN = new Array(N).fill(0);
  const stuck = new Array(N).fill(0); // seconds with no absorb for >= 30 s, per stage
  let lastAbsorb = 0; let lastCount = 0; let pickIn = 0; let steps = 0;
  while (st.status !== 'ended' && st.status !== 'dead' && st.status !== 'gameover' && !st.deathCause && st.stats.elapsed < MAX_T) {
    if (st.status === 'choice') { if (++pickIn > HZ * 0.4) { pickIn = 0; sim.pickChoice(log.pending); } }
    sim.setInput(aim());
    sim.step(STEP);
    const t = st.stats.elapsed; const s = st.stageIndex;
    if (enter[s] === null) enter[s] = t;
    if (st.stats.absorbed !== lastCount) { lastCount = st.stats.absorbed; lastAbsorb = t; }
    if (t - lastAbsorb > 30) stuck[s] += STEP;
    if (VERBOSE && steps % (HZ * 10) === 0) console.log(`  t=${t.toFixed(0)} stage=${s} mass=${st.mass.toFixed(2)} bodies=${st.bodies.length} p=(${st.player.p.map((x) => x.toFixed(0))}) v=${Math.hypot(...st.player.v).toFixed(1)} prey=${st.bodies.filter((b) => b.rel === 'prey').length} region=${JSON.stringify(st.hud.region)} hp=${st.health.toFixed(2)}`);
    if (++steps % HZ === 0) { // once a second: prey within 40 player radii
      const p = st.player; let n = 0;
      for (const b of st.bodies) if (b.rel === 'prey' && b.state === 'alive' && Math.hypot(b.p[0] - p.p[0], b.p[2] - p.p[2]) < 40 * p.radius) n++;
      preyMin[s] = Math.min(preyMin[s], n); preySum[s] += n; preyN[s]++;
    }
  }
  return { seed, enter, end: st.stats.elapsed, ending: log.ending, died: !!st.deathCause, cause: st.deathCause, deathStage: st.stageIndex, stuck, preyMin, preyAvg: preySum.map((v, i) => (preyN[i] ? v / preyN[i] : null)), absorbed: st.stats.absorbed, ended: st.status === 'ended' };
}

// ---- universe checks: deterministic by seed, unbounded, enough matter at every scale ----------------------------
function universeChecks() {
  const problems = [];
  const FULL = [0, CONFIG.levels.count - 1];
  const far = [[1e6, 0, 1e6], [-3e7, 0, 2e7], [5e9, 0, -5e9], [-1e12, 0, 7e11]];
  for (const c of far) {
    const a = JSON.stringify(createUniverse('infinite').query(c, 2000, FULL));
    const b = JSON.stringify(createUniverse('infinite').query(c, 2000, FULL));
    if (a !== b) problems.push(`universe not deterministic near ${c}`);
    if (!(JSON.parse(a).near.length + JSON.parse(a).far.length > 0)) problems.push(`universe empty near ${c} (edge?)`);
  }
  return problems;
}

const t0 = Date.now();
const problems = universeChecks();
const results = [];
for (let i = 0; i < RUNS; i++) {
  const r = playOne(SEED0 + i);
  results.push(r);
  const lastStage = r.enter.reduce((m, v, k) => (v !== null ? k : m), 0);
  console.log(`seed ${String(r.seed).padStart(4)}: ${r.died ? `DIED ${r.cause}@${lastStage}` : r.ended ? `ended ${r.ending}` : `TIMEOUT@${lastStage}`} ${fmt(r.end)}  absorbed ${r.absorbed}  (${((Date.now() - t0) / 1000).toFixed(0)} s wall)`);
}

console.log(`\nBalance (${RUNS} seeds, ${HZ} Hz, mortal greedy bot)`);
console.log('stage               reached  time median / max   deaths  prey<40S min / avg   stuck>30s');
let worst = 0;
for (let s = 0; s < N; s++) {
  const reached = results.filter((r) => r.enter[s] !== null);
  const dur = results.filter((r) => r.enter[s] !== null && (s + 1 < N ? r.enter[s + 1] !== null : r.ended)).map((r) => (s + 1 < N ? r.enter[s + 1] : r.end) - r.enter[s]);
  const deaths = results.filter((r) => r.died && r.deathStage === s).length;
  const pm = Math.min(...reached.map((r) => r.preyMin[s]));
  const pa = reached.length ? reached.reduce((a, r) => a + (r.preyAvg[s] || 0), 0) / reached.length : 0;
  const stuck = reached.filter((r) => r.stuck[s] > 0).length;
  const mx = dur.length ? Math.max(...dur) : null;
  if (mx !== null) worst = Math.max(worst, mx);
  console.log(`${String(s).padStart(2)} ${STAGES[s].name.padEnd(16)} ${String(reached.length).padStart(3)}/${RUNS}   ${fmt(median(dur))} / ${fmt(mx)}        ${String(deaths).padStart(2)}      ${String(Number.isFinite(pm) ? pm : '-').padStart(3)} / ${pa.toFixed(1).padStart(5)}        ${stuck}`);
  if (reached.length && pa < 2) problems.push(`stage ${s} ${STAGES[s].name}: only ${pa.toFixed(1)} prey on average within 40 radii`);
  if (mx !== null && mx > STAGE_LIMIT) problems.push(`stage ${s} ${STAGES[s].name}: slowest run ${fmt(mx).trim()} exceeds ${STAGE_LIMIT / 60} min`);
}
const finished = results.filter((r) => r.ended);
const deathsAll = results.filter((r) => r.died);
console.log(`\nFinished (ending fired): ${finished.length}/${RUNS}, median ${fmt(median(finished.map((r) => r.end)))}`);
console.log(`Deaths: ${deathsAll.length}/${RUNS} (${deathsAll.map((r) => `${r.cause}@${r.deathStage}`).join(', ') || 'none'})`);
console.log(`Endings: ${Object.entries(finished.reduce((m, r) => ((m[r.ending] = (m[r.ending] || 0) + 1), m), {})).map(([k, v]) => `${k} x${v}`).join(', ') || 'none'}`);
const timeouts = results.filter((r) => !r.ended && !r.died);
if (timeouts.length) problems.push(`${timeouts.length} run(s) timed out at ${MAX_T}s without finishing: seeds ${timeouts.map((r) => r.seed).join(', ')}`);
if (!finished.length) problems.push('no run triggered the ending');
if (deathsAll.length > RUNS * 0.35) problems.push(`${deathsAll.length}/${RUNS} runs died; a simple bot should survive more often`);
console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s wall)`);
if (problems.length) { console.log(`\nBALANCE ISSUES:\n  ${problems.join('\n  ')}`); process.exitCode = 1; } else console.log('\nBalance targets met.');
