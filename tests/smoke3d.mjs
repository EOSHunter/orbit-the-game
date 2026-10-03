// Browser smoke test for the 3D build (the default): serves the repo, drives headless Chrome/Edge over the
// DevTools protocol and checks that src/main3d.js really wires sim + render3d + audio + ui end to end.
// Fails on any console error/warning, uncaught exception or failed request.
//
//   node tests/smoke3d.mjs                     # auto-detects Chrome / Edge
//   BROWSER="C:/path/to/chrome.exe" node tests/smoke3d.mjs
//   node tests/smoke3d.mjs --shots out-dir     # also save screenshots at a few points
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startServer } from '../tools/serve.mjs';

const shotsArg = process.argv.indexOf('--shots');
const SHOTS = shotsArg > 0 ? resolve(process.argv[shotsArg + 1] || 'shots') : null;

const server = await startServer(0);
const URL_ROOT = `http://127.0.0.1:${server.address().port}/`;

// ---- browser ------------------------------------------------------------------------------------
const CANDIDATES = [
  process.env.BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
].filter(Boolean);
const exe = CANDIDATES.find((p) => existsSync(p));
if (!exe) { console.error('No Chrome/Edge found; set BROWSER=/path/to/browser'); process.exit(2); }

const profile = join(tmpdir(), `vd-smoke3d-${process.pid}`);
const browser = spawn(exe, [
  // port 0: the browser picks a free port and writes it to <profile>/DevToolsActivePort (no clashes with other runs)
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1280,720',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
  // software WebGL2 in headless, and the real autoplay policy so the first-gesture unlock is what starts audio
  '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=user-gesture-required',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target = null, lastErr = null;
for (let i = 0; i < 150 && !target; i++) {
  await sleep(100);
  try {
    const port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0].trim();
    target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page');
  } catch (e) { lastErr = e; /* not up yet */ }
}
if (!target) { console.error('Browser did not start:', lastErr && lastErr.message); browser.kill(); process.exit(2); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0;
const pending = new Map();
let problems = [];
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve: res, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message)); else res(msg.result);
    return;
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails;
    problems.push(`exception: ${(d.exception && d.exception.description) || d.text}`);
  } else if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) {
    problems.push(`console.${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`);
  } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
    problems.push(`log: ${msg.params.entry.text} ${msg.params.entry.url || ''}`);
  }
};
const send = (method, params = {}) => new Promise((res, reject) => {
  const id = ++seq;
  const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP ${method} timed out (browser gone?)`)); }, 30000);
  pending.set(id, { resolve: (v) => { clearTimeout(timer); res(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
  ws.send(JSON.stringify({ id, method, params }));
});
async function js(expr) {
  const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true, userGesture: false });
  if (r.exceptionDetails) throw new Error(`page eval failed: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
  return r.result.value;
}
const keyDown = (k, code, vk, text) => send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, text });
const keyUp = (k, code, vk) => send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
async function key(k, code, vk, text) { await keyDown(k, code, vk, text); await keyUp(k, code, vk); }
async function click(selector) {
  const r = await js(`const b = document.querySelector(${JSON.stringify(selector)}); if (!b) return null; const q = b.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 };`);
  if (!r) throw new Error(`no element ${selector}`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 });
}
async function waitFor(expr, ms = 5000, label = expr) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await js(`return !!(${expr});`)) return;
    await sleep(50);
  }
  throw new Error(`timed out waiting for: ${label}`);
}
async function shot(name) {
  if (!SHOTS) return;
  await mkdir(SHOTS, { recursive: true });
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(join(SHOTS, `3d-${name}.png`), Buffer.from(data, 'base64'));
}

// ---- checks -------------------------------------------------------------------------------------
let passed = 0;
const failures = [];
async function check(name, fn) {
  try { await fn(); passed++; console.log(`ok   ${name}`); }
  catch (e) { failures.push(name); console.log(`FAIL ${name}\n     ${e.message}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m); };

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');
await send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});

// Audio probe: records every AudioContext and counts the source nodes (= sounds) it creates, so the test
// can tell that the context starts only on a gesture and that a sim event really produced sound.
const { identifier: probeId } = await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  window.__probe = { ctxs: [], nodes: 0 };
  if (window.AudioContext) {
    const AC = window.AudioContext;
    window.AudioContext = class extends AC { constructor(o) { super(o); window.__probe.ctxs.push(this); } };
    const B = window.BaseAudioContext.prototype;
    for (const m of ['createOscillator', 'createBufferSource']) {
      const f = B[m];
      B[m] = function () { window.__probe.nodes++; return f.apply(this, arguments); };
    }
  }` });

await send('Page.navigate', { url: URL_ROOT });

const V = 'window.__vd';
const S = `${V}.sim.getState()`;
const OV = (cls) => `document.querySelector('.vd-overlay.${cls}.is-on')`;
// Scripted bodies: sim.debug.spawnBody bodies have no universe descriptor and crash the live loader's unload
// pass (src/sim/index.js loaderTick reads b._desc.level), so the loader is paused while they exist.
const SPAWN = (props) => `const d = ${V}.sim.debug; d.setLoaderEnabled(false); (window.__spawned = window.__spawned || []).push(d.spawnBody(${props}));`;
const CLEANUP = `for (const b of window.__spawned || []) b._dead = true; window.__spawned = []; ${V}.sim.debug.setLoaderEnabled(true);`;

await check('default boot is the 3D build with the real sim, renderer, audio and UI (no fixtures)', async () => {
  await waitFor(V, 10000, 'window.__vd');
  const r = await js(`const v = ${V}; return { fixtures: v.fixtures, audio: !!v.audio, ui: !!v.ui, backend: v.renderer.getStats().backend,
    legacy: !!window.__orbit, cls: Array.isArray(${S}.bodies) && !!${S}.far, seed: ${S}.seed };`);
  assert(r.fixtures === false && r.audio && r.ui && r.backend === 'webgl2' && !r.legacy && r.cls, JSON.stringify(r));
  await waitFor(`${S}.status === 'title' && ${OV('vd-overlay--title')}`, 3000, 'title');
  // hook the bus: count sounds produced by each event (audio handlers run inside emit)
  await js(`window.__sound = {}; window.__events = {}; const bus = ${V}.sim.events, emit = bus.emit;
    bus.emit = function (t, p) { const n0 = window.__probe.nodes; emit.call(bus, t, p);
      window.__events[t] = (window.__events[t] || 0) + 1; window.__sound[t] = (window.__sound[t] || 0) + (window.__probe.nodes - n0); };`);
  await shot('01-title');
});

await check('audio stays silent until the first gesture; clicking "Initiate drift" unlocks it and starts the run', async () => {
  await sleep(300);
  assert(await js('return window.__probe.ctxs.length;') === 0, 'an AudioContext was created before any gesture');
  await click('.vd-overlay--title .vd-btn--primary');
  await waitFor(`${S}.status === 'playing'`, 3000, 'playing');
  await waitFor(`window.__probe.ctxs.length === 1 && window.__probe.ctxs[0].state === 'running'`, 3000, 'AudioContext running');
  const r = await js(`return { n: ${S}.bodies.length, far: ${S}.far.count, hud: !!document.querySelector('.vd-hud.is-on'), runStart: window.__events['run-start'] };`);
  assert(r.n > 10 && r.hud && r.runStart === 1, JSON.stringify(r));
  console.log(`     near bodies ${r.n}, far impostors ${r.far}`);
});

await check('UI sounds reach audio.playUi (onUiSound)', async () => {
  const n0 = await js('return window.__probe.nodes;');
  await js(`${V}.audio.playUi('ui.click');`);
  await sleep(100);
  // the click button on the title also played ui.confirm; this one is a direct, deterministic probe
  assert(await js('return window.__probe.nodes;') > n0, 'playUi produced no sound');
});

await check('keyboard (WASD) and mouse (hold to thrust toward the pointer) move the player', async () => {
  await keyDown('d', 'KeyD', 68);
  await sleep(500);
  const k = await js(`const p = ${S}.player; return { tx: p.thrust[0], vx: p.v[0], hud: ${S}.hud.thrust };`);
  await keyUp('d', 'KeyD', 68);
  assert(k.tx > 0.5 && k.vx > 0 && k.hud > 0.5, `keyboard: ${JSON.stringify(k)}`);
  await sleep(300);
  // pointer to the upper left of the player's screen position: thrust has -x and -z (north) components
  const pp = await js(`const v = ${V}.renderer.getView(); return v.project(${S}.player.p);`);
  const x = Math.max(5, pp.x - 300), y = Math.max(5, pp.y - 200);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await sleep(400);
  const m = await js(`const p = ${S}.player; return { tx: p.thrust[0], tz: p.thrust[1] };`);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  assert(m.tx < -0.1 && m.tz < -0.05, `mouse: ${JSON.stringify(m)}`);
  await shot('02-playing');
});

await check('absorbing a smaller body grows the player and plays the absorb sound', async () => {
  await js(`const s = ${S}, p = s.player; window.__m0 = p.mass;
    ${SPAWN("{ cls: 'meteorite', mass: p.mass * 0.3, p: [p.p[0] + p.radius * 1.3, 0, p.p[2]], v: [p.v[0], 0, p.v[2]] }")}`);
  await waitFor(`${S}.stats.absorbed > 0 && ${S}.player.mass > window.__m0`, 4000, 'absorb');
  await sleep(400);
  await js(CLEANUP);
  const r = await js('return { e: window.__events.absorb, snd: window.__sound.absorb };');
  assert(r.e > 0 && r.snd > 0, `absorb event/sound ${JSON.stringify(r)}`);
});

await check('a larger threat hits the player (damage) and plays the hit sound', async () => {
  // Placed inside the grace margin (0.85 x contact): a threat approaching from outside only ever bounces
  // in the current sim (see the PR notes), the same way tests/sim.contract.test.mjs stages its hits.
  await js(`const s = ${S}, p = s.player, rb = p.radius * Math.sqrt(1.6);
    ${SPAWN("{ cls: 'asteroid', mass: p.mass * 1.6, p: [p.p[0] + (p.radius + rb) * 0.75, 0, p.p[2]], v: [p.v[0], 0, p.v[2]] }")}`);
  try { await waitFor(`${S}.stats.hits > 0`, 5000, 'hit'); } finally { await js(CLEANUP); }
  await sleep(50);
  const r = await js(`return { h: ${S}.health, e: window.__events.hit, snd: window.__sound.hit };`);
  assert(r.h < 1 && r.e > 0 && r.snd > 0, JSON.stringify(r));
});

await check('growing advances stages (evolve + sound), opens the choice cards, key 1 picks', async () => {
  await js(`const { STAGES } = await import('/src/stages.js'); ${V}.sim.debug.setPlayer({ mass: STAGES[2].minMass * 1.05, natural: true });`);
  await waitFor(`${S}.status === 'choice' && ${OV('vd-overlay--dim')} && document.querySelectorAll('.vd-card').length >= 2`, 4000, 'choice overlay');
  const r = await js(`return { idx: ${S}.stageIndex, ev: window.__events.evolve, snd: window.__sound.evolve };`);
  assert(r.idx === 2 && r.ev >= 2 && r.snd > 0, JSON.stringify(r));
  await sleep(500);
  await shot('03-choice');
  await key('1', 'Digit1', 49, '1');
  await waitFor(`${S}.status === 'playing'`, 3000, 'back to playing');
  const f = await js(`return ${S}.flags;`);
  assert(f.choices && f.choices[2], `no choice recorded ${JSON.stringify(f)}`);
  const name = await js(`return document.querySelector('.vd-stage-name') && document.querySelector('.vd-stage-name').textContent;`);
  assert(/dwarf/i.test(name || ''), `HUD stage name ${name}`);
});

await check('Esc pauses the sim (Systems panel) and Esc resumes', async () => {
  await key('Escape', 'Escape', 27);
  await waitFor(`${S}.status === 'paused' && ${OV('vd-overlay--dim')}`, 2000, 'paused');
  const t1 = await js(`return ${S}.time;`);
  await sleep(400);
  assert(await js(`return ${S}.time;`) === t1, 'sim time advanced while paused');
  await key('Escape', 'Escape', 27);
  await waitFor(`${S}.status === 'playing' && !document.querySelector('.vd-overlay.is-on')`, 2000, 'resumed');
  await sleep(200);
  assert(await js(`return ${S}.time;`) > t1, 'time did not resume');
});

await check('Resume button and settings: volume sliders drive audio.setVolume/setMuted, quality drives the renderer', async () => {
  await key('Escape', 'Escape', 27);
  await waitFor(`${S}.status === 'paused'`, 2000, 'paused');
  const slide = (id, v) => js(`const i = document.querySelector('input[id^="vd-set-${id}-"]'); i.value = '${v}'; i.dispatchEvent(new Event('input', { bubbles: true }));`);
  try {
    await slide('master', 0);
    let a = await js(`return ${V}.audio.getVolume();`);
    assert(a.master === 0 && a.muted === true, `master 0 -> ${JSON.stringify(a)}`);
    await slide('master', 60); await slide('sfx', 40); await slide('music', 30);
    a = await js(`return ${V}.audio.getVolume();`);
    assert(a.master === 0.6 && a.sfx === 0.4 && a.music === 0.3 && a.muted === false, JSON.stringify(a));
    await click('.vd-seg-btn[data-q="low"]');
    assert(await js(`return ${V}.renderer.getStats().quality;`) === 'low', 'quality not applied');
    await click('.vd-seg-btn[data-q="auto"]');
  } finally {
    await slide('master', 60);
    await js(`[...document.querySelectorAll('.vd-btn')].find((b) => b.textContent === 'Resume').click();`);
    await waitFor(`${S}.status === 'playing'`, 2000, 'resumed by button');
  }
});

await check('trajectory setting (V) reaches the sim: hud.trajectory appears and clears', async () => {
  await key('v', 'KeyV', 86, 'v');
  await waitFor(`${S}.hud.trajectory && ${S}.hud.trajectory.length > 0`, 2000, 'trajectory on');
  await key('v', 'KeyV', 86, 'v');
  await waitFor(`${S}.hud.trajectory === null`, 2000, 'trajectory off');
});

await check('infinite universe: chunks stream around the player across 300k units, rebase shifts the origin, no bounds', async () => {
  const r = await js(`
    const sim = ${V}.sim, s = sim.getState(), d = sim.debug, cfg = d.CONFIG;
    let rebases = 0; const off = sim.events.on('rebase', () => rebases++);
    const o0 = s.originAbs.slice(), lim = Math.max(cfg.rebaseDistance, cfg.rebaseRadii * s.player.radius);
    const hops = 50, rows = [];
    let emptyNear = 0, emptyAll = 0, maxCells = 0, maxBodies = 0;
    for (let i = 0; i < hops; i++) {
      d.setPlayer({ p: [lim * 1.2, 0], v: [0, 0] });
      sim.step(1 / 120);                       // rebase happens first in the step
      d.loaderTick();
      for (let k = 0; k < 6; k++) sim.step(1 / 120);
      const st = d.stats();
      maxCells = Math.max(maxCells, st.cells); maxBodies = Math.max(maxBodies, s.bodies.length);
      if (!s.bodies.length) emptyNear++;
      if (!s.bodies.length && !s.far.count) emptyAll++;
      if (i % 10 === 0) rows.push(st);
    }
    off();
    const moved = s.originAbs[0] - o0[0];
    return { rebases, moved, lim, emptyNear, emptyAll, maxCells, maxBodies, rows, hasBounds: 'bounds' in s || 'edge' in s,
      region: !!s.hud.region, finite: s.bodies.every((b) => Number.isFinite(b.p[0]) && Number.isFinite(b.p[2])), pAbs: Math.hypot(s.player.p[0], s.player.p[2]) };`);
  console.log(`     ${r.rebases} rebases, origin moved ${Math.round(r.moved)} units, max near bodies ${r.maxBodies}, max cached cells ${r.maxCells}, hops with no near bodies ${r.emptyNear}`);
  assert(r.rebases >= 50 && r.moved > 50 * r.lim, `rebase ${JSON.stringify(r)}`);
  assert(r.emptyAll === 0, `${r.emptyAll} hops with nothing loaded at all`);
  assert(r.emptyNear < 25, `near field empty on ${r.emptyNear}/50 hops`);
  assert(!r.hasBounds && r.region && r.finite && r.pAbs < r.lim, JSON.stringify(r));
  // memory stays flat: the cell cache is capped (LRU at CONFIG universe cacheMax), whatever the distance
  const cap = await js(`const c = ${V}.sim.debug.CONFIG; return (c.universe && c.universe.cacheMax) || 5000;`);
  assert(r.maxCells <= cap * 1.05, `cell cache ${r.maxCells} above its cap ${cap}: ${r.rows.map((x) => x.cells)}`);
  await sleep(600);   // let the renderer draw the new neighbourhood
  const st = await js(`return ${V}.renderer.getStats();`);
  assert(st.bodies > 0 && st.drawCalls > 0, `renderer drew nothing after travelling: ${JSON.stringify(st)}`);
  await shot('04-far-away');
});

await check('a far larger body kills the player: death + ending sounds, end screen, "Drift again" restarts cleanly', async () => {
  await js(`const s = ${S}, p = s.player, rb = p.radius * Math.sqrt(8);
    ${SPAWN("{ cls: 'rockyPlanet', mass: p.mass * 8, p: [p.p[0] + (p.radius + rb) * 0.75, 0, p.p[2]], v: [p.v[0], 0, p.v[2]] }")}`);
  try { await waitFor(`window.__events.death > 0`, 5000, 'death event'); } finally { await js(CLEANUP); }
  await waitFor(`${S}.status === 'ended' && ${OV('vd-overlay--end')}`, 6000, 'end screen');
  await sleep(50);
  const r = await js(`return { title: document.querySelector('.vd-overlay--end h2').textContent, death: window.__sound.death, ending: window.__sound.ending, cause: ${S}.deathCause };`);
  assert(r.death > 0 && r.ending > 0 && r.title, JSON.stringify(r));
  console.log(`     ending: ${r.title}`);
  await sleep(500);
  await shot('05-end');
  // keyboard: Space on the focused "Drift again" button (input3d must not swallow it)
  await waitFor(`document.activeElement === document.querySelector('.vd-overlay--end .vd-btn--primary')`, 2000, 'restart focused');
  await key(' ', 'Space', 32, ' ');
  await waitFor(`${S}.status === 'playing'`, 3000, 'restarted');
  await sleep(200);
  const z = await js(`const s = ${S}; return { mass: s.mass, stage: s.stageIndex, hits: s.stats.hits, health: s.health, n: s.bodies.length,
    overlay: !!document.querySelector('.vd-overlay.is-on'), runStarts: window.__events['run-start'] };`);
  assert(z.mass === 1 && z.stage === 0 && z.hits === 0 && z.health === 1 && z.n > 10 && !z.overlay && z.runStarts === 2, JSON.stringify(z));
});

await check('render loop keeps running (frames advance) and stays within a sane budget', async () => {
  const r = await js(`const sim = ${V}.sim; const t0 = performance.now(); for (let i = 0; i < 120; i++) sim.step(1 / 120);
    const step = (performance.now() - t0) / 120; const st = ${V}.renderer.getStats(); return { step, ms: st.ms, calls: st.drawCalls, bodies: st.bodies };`);
  console.log(`     sim step ${r.step.toFixed(3)} ms, render ${r.ms.toFixed(2)} ms (software GL), draw calls ${r.calls}, bodies ${r.bodies}`);
  assert(r.step < 4, `sim step ${r.step} ms`);
});

await check('dev start: ?stage=&form= boots straight into that stage and form; backtick menu starts another with a visible cursor', async () => {
  await send('Page.navigate', { url: `${URL_ROOT}?stage=rocky_planet&form=lava` });
  await waitFor(`window.__vd && ${S}.status === 'playing'`, 10000, 'dev run playing');
  const r = await js(`const s = ${S}; return { id: s.stageId, pt: s.flags.planetType, title: !!${OV('vd-overlay--title')}, hud: !!document.querySelector('.vd-hud.is-on') };`);
  assert(r.id === 'rocky_planet' && r.pt === 'lava' && !r.title && r.hud, JSON.stringify(r));
  await key('`', 'Backquote', 192, '`');
  await waitFor(`${S}.status === 'paused' && document.querySelector('.vd-overlay.is-on .vd-dev')`, 3000, 'dev menu open (sim paused)');
  assert(await js(`return document.getElementById('game').style.cursor !== 'none';`), 'cursor hidden while the dev menu is open');
  await shot('dev-menu');
  await click('.vd-dev-stages .vd-seg-btn:nth-child(11)');
  await click('.vd-dev .vd-btn--primary');
  await waitFor(`${S}.status === 'playing' && ${S}.stageId === 'neutron_star'`, 3000, 'neutron star run');
  assert((await js('return location.search;')).includes('stage=neutron_star'), 'URL not updated');
  await shot('dev-neutron');
});

await check('quit to menu: pause screen (confirm) and game-over screen return to a clean title; new run and dev start work after', async () => {
  const titleClean = `${S}.status === 'title' && ${OV('vd-overlay--title')} && !document.querySelector('.vd-hud.is-on') && !document.querySelector('.vd-overlay.is-on:not(.vd-overlay--title)')`;
  // pause screen: first press arms, second confirms; no URL dev params remain
  await key('Escape', 'Escape', 27);
  await waitFor(`${S}.status === 'paused' && ${OV('vd-overlay--dim')}`, 3000, 'paused');
  await click('.vd-systems .vd-btn--ghost');
  assert((await js(`return ${S}.status;`)) === 'paused', 'quit must ask for confirmation');
  await click('.vd-systems .vd-btn--ghost');
  await waitFor(titleClean, 3000, 'clean title after quit from pause');
  const r = await js(`const s = ${S}; return { stage: s.stageId, mass: s.mass, cursor: document.getElementById('game').style.cursor, q: location.search, flags: s.flags.choiceCount };`);
  assert(r.stage === 'meteorite' && r.mass === 1 && r.cursor !== 'none' && !/stage=|form=/.test(r.q) && r.flags === 0, JSON.stringify(r));
  // normal start works again
  await click('.vd-overlay--title .vd-btn--primary');
  await waitFor(`${S}.status === 'playing' && document.querySelector('.vd-hud.is-on')`, 3000, 'playing again');
  assert((await js(`return document.getElementById('game').style.cursor;`)) === 'none', 'cursor should hide again in play');
  // game over screen -> Main menu (key M)
  await js(`const s = ${S}, p = s.player, rb = p.radius * Math.sqrt(8);
    ${SPAWN("{ cls: 'rockyPlanet', mass: p.mass * 8, p: [p.p[0] + (p.radius + rb) * 0.75, 0, p.p[2]], v: [p.v[0], 0, p.v[2]] }")}`);
  try { await waitFor(`${S}.status === 'ended' && ${OV('vd-overlay--end')}`, 8000, 'end screen'); } finally { await js(CLEANUP); }
  await sleep(300);
  await key('m', 'KeyM', 77, 'm');
  await waitFor(titleClean, 3000, 'clean title after quit from game over');
  // dev start from the title after quitting
  await key('`', 'Backquote', 192, '`');
  await waitFor(`document.querySelector('.vd-overlay.is-on .vd-dev')`, 3000, 'dev menu from title');
  await click('.vd-dev-stages .vd-seg-btn:nth-child(5)');
  await click('.vd-dev .vd-btn--primary');
  await waitFor(`${S}.status === 'playing' && ${S}.stageId === 'gas_giant'`, 3000, 'dev start after quit');
});

await check('no console errors, warnings, exceptions or failed requests (3D)', async () => {
  assert(problems.length === 0, problems.join('\n     '));
});

// ---- fallbacks ----------------------------------------------------------------------------------
await check('?renderer=2d still boots the 2D build', async () => {
  await send('Page.navigate', { url: `${URL_ROOT}?renderer=2d` });
  await waitFor('window.__orbit', 8000, 'window.__orbit');
  assert(!(await js('return !!window.__vd;')), '3D build started too');
  assert(problems.length === 0, problems.join('\n     '));
});

await check('without WebGL2 the default boot falls back to the 2D build', async () => {
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: probeId });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    const gc = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, o) { return t === 'webgl2' ? null : gc.call(this, t, o); };` });
  await send('Page.navigate', { url: URL_ROOT });
  await waitFor('window.__orbit', 8000, 'window.__orbit');
  assert(!(await js('return !!window.__vd;')), '3D build started without WebGL2');
  const expected = problems.filter((p) => /WebGL2 unavailable/.test(p));
  assert(expected.length === 1, `expected one fallback warning, got ${JSON.stringify(problems)}`);
  problems = problems.filter((p) => !/WebGL2 unavailable/.test(p));
  assert(problems.length === 0, problems.join('\n     '));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
ws.close();
browser.kill();
server.close();
await sleep(300);
await rm(profile, { recursive: true, force: true }).catch(() => {});
process.exit(failures.length ? 1 : 0);
