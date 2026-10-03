// Browser smoke test: serves the repo, drives headless Chrome/Edge over the DevTools protocol, and checks
// every integration point end to end. Fails on any console error, uncaught exception or failed request.
//
//   node tests/smoke.mjs                       # auto-detects Chrome / Edge
//   BROWSER="C:/path/to/chrome.exe" node tests/smoke.mjs
//   node tests/smoke.mjs --shots out-dir       # also save screenshots at a few stages
import { mkdir, writeFile, rm } from 'node:fs/promises';
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

const profile = join(tmpdir(), `vd-smoke-${process.pid}`);
const PORT = 9300 + (process.pid % 500);
const browser = spawn(exe, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1280,720',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target = null;
for (let i = 0; i < 100 && !target; i++) {
  await sleep(100);
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
}
if (!target) { console.error('Browser did not start'); browser.kill(); process.exit(2); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let seq = 0;
const pending = new Map();
const problems = [];
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
  pending.set(id, { resolve: res, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
async function js(expr) {
  const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`page eval failed: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
  return r.result.value;
}
async function key(k, code, vk, text) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, text });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk });
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
  await writeFile(join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'));
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
await send('Page.navigate', { url: `${URL_ROOT}?renderer=2d` });   // the 2D build (3D is the default; see smoke3d.mjs)

const S = 'window.__orbit.state';
const OV = (cls) => `document.querySelector('.vd-overlay.${cls}.is-on')`;

await check('boots with the real modules and shows the title', async () => {
  await waitFor('window.__orbit', 8000, 'window.__orbit');
  await waitFor(`${S}.status === 'title' && ${OV('vd-overlay--title')}`);
  const names = await js(`return Object.keys(window.__orbit.mod).sort().join(',');`);
  assert(names === 'STAGES,applyChoice,createRenderer,createUI,getChoicesFor,getEnding,getStage,spawnEffect', names);
  const css = await js(`return getComputedStyle(document.querySelector('.vd-ui')).pointerEvents;`);
  assert(css === 'none', 'ui.css did not load');
  await shot('01-title');
});

await check('start button begins a run with ~200 bodies', async () => {
  await js(`document.querySelector('.vd-overlay--title .vd-btn--primary').click();`);
  await waitFor(`${S}.status === 'playing'`);
  const n = await js(`return ${S}.bodies.length;`);
  assert(n >= 150 && n <= 200, `bodies ${n}`);
});

await check('mouse steering moves the player', async () => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1100, y: 360 });
  await sleep(700);
  const vx = await js(`return ${S}.player.vx;`);
  assert(vx > 0, `player vx ${vx}`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 640, y: 360 });
  await shot('02-playing');
});

await check('Esc pauses the engine (ui.onPause) and Esc resumes', async () => {
  await key('Escape', 'Escape', 27);
  await waitFor(`window.__orbit.game.paused && ${OV('vd-overlay--dim')}`, 2000, 'paused');
  const t1 = await js(`return ${S}.time;`);
  await sleep(400);
  const t2 = await js(`return ${S}.time;`);
  assert(t1 === t2, `time advanced while paused ${t1} -> ${t2}`);
  await key('Escape', 'Escape', 27);
  await waitFor(`!window.__orbit.game.paused && !document.querySelector('.vd-overlay.is-on')`, 2000, 'resumed');
  await sleep(200);
  assert(await js(`return ${S}.time;`) > t2, 'time did not resume');
});

await check('pause button also pauses; resume button resumes', async () => {
  await js(`document.querySelector('.vd-icon-btn').click();`);
  await waitFor('window.__orbit.game.paused', 2000);
  await js(`[...document.querySelectorAll('.vd-btn')].find((b) => b.textContent === 'Resume').click();`);
  await waitFor('!window.__orbit.game.paused', 2000);
});

await check('absorbing prey spawns absorb effects and grows mass', async () => {
  // Drop a prey body on the player.
  await js(`
    const { createBody } = await import('/src/physics.js');
    const p = ${S}.player;
    const b = createBody({ x: p.x + p.radius * 0.5, y: p.y, radius: p.radius * 0.6, kind: 'prey' });
    b.dvx = b.dvy = 0;
    ${S}.bodies.push(b);
    window.__m0 = p.mass;`);
  await waitFor(`${S}.stats.absorbed > 0 && ${S}.player.mass > window.__m0`, 2000, 'absorb');
});

await check('evolving to a choice stage opens the cards; key 1 applies the choice', async () => {
  await js(`${S}.player.mass = window.__orbit.mod.STAGES[2].minMass + 0.5;`);
  await waitFor(`${S}.status === 'choice' && ${OV('vd-overlay--dim')} && document.querySelectorAll('.vd-card').length === 4`, 3000, 'choice overlay');
  const fx = await js(`return ${S}.effects.some((e) => e.type === 'evolve');`);
  assert(fx, 'no evolve effect');
  const shake = await js(`const m = await import('/src/render/index.js'); return m.getShake(${S}).amount;`);
  assert(shake > 0, 'renderer getShake returned no shake after evolve');
  assert(!(await js(`return !!document.querySelector('.vd-banner.is-on');`)), 'stage banner overlaps the choice cards');
  await sleep(500); // cards animate in
  await shot('03-choice');
  await key('1', 'Digit1', 49, '1');
  await waitFor(`${S}.status === 'playing'`, 3000, 'back to playing');
  await waitFor(`document.querySelector('.vd-banner.is-on')`, 1000, 'stage banner after the pick');
  const f = await js(`return ${S}.flags;`);
  assert(f.choices && f.choices[2] === 'frozen_fortress' && f.trajectory === 'frozen_fortress', JSON.stringify(f));
  assert(f.damageResist === 0.25 && Math.abs(f.speedMult - 0.95) < 1e-9, JSON.stringify(f));
});

await check('HUD shows stage name, mass and progress', async () => {
  const name = await js(`return document.querySelector('.vd-stage-name').textContent;`);
  assert(name === 'Dwarf Planet', name);
  const hud = await js(`return !!document.querySelector('.vd-hud.is-on');`);
  assert(hud, 'hud hidden');
});

await check('a threat hit damages the player and spawns a hit effect', async () => {
  await js(`
    const { createBody } = await import('/src/physics.js');
    const p = ${S}.player;
    const b = createBody({ x: p.x + p.radius * 1.2, y: p.y, radius: p.radius * 1.25, kind: 'threat' });
    b.dvx = b.dvy = 0; b.vx = -p.radius * 4; b.vy = 0;
    ${S}.bodies.push(b);`);
  await waitFor(`${S}.stats.hits > 0`, 3000, 'hit');
  const r = await js(`return { h: ${S}.health, fx: ${S}.effects.some((e) => e.type === 'hit') };`);
  assert(r.h < 1 && r.fx, JSON.stringify(r));
});

await check('boundary warning shows, then leaving ends the run as Event Horizon', async () => {
  await js(`
    const s = ${S};
    window.__pin = setInterval(() => { const R = s.bounds.radius; s.player.x = R * 0.9; s.player.y = 0; s.player.vx = s.player.vy = 0; }, 16);`);
  await waitFor(`document.querySelector('.vd-warn.is-on')`, 2000, 'boundary warning');
  await shot('04-boundary');
  await js(`clearInterval(window.__pin); const s = ${S};
    window.__pin = setInterval(() => { const R = s.bounds.radius; s.player.x = R * 1.2; s.player.y = 0; s.player.vx = s.player.vy = 0; }, 16);`);
  await waitFor(`${S}.status === 'ended' && ${OV('vd-overlay--dim')}`, 8000, 'ended');
  await js('clearInterval(window.__pin);');
  const title = await js(`return document.querySelector('.vd-overlay.is-on h2').textContent;`);
  assert(title === 'Event Horizon', title);
  assert(!(await js(`return !!document.querySelector('.vd-warn.is-on');`)), 'warning still on after the run ended');
  await shot('05-end');
});

await check('restart resets the run cleanly', async () => {
  await js(`[...document.querySelectorAll('.vd-btn')].find((b) => b.textContent === 'Drift again').click();`);
  await waitFor(`${S}.status === 'playing'`, 3000);
  await sleep(200); // let the HUD update on the next frame
  const r = await js(`const s = ${S}; return { mass: s.mass, stage: s.stageIndex, flags: Object.keys(s.flags).length, hits: s.stats.hits,
    health: s.health, death: s.deathCause, alive: s.player.alive, n: s.bodies.length,
    name: document.querySelector('.vd-stage-name').textContent, overlay: !!document.querySelector('.vd-overlay.is-on') };`);
  assert(r.mass === 1 && r.stage === 0 && r.flags === 0 && r.hits === 0 && r.health === 1 && !r.death && r.alive && r.n > 150
    && r.name === 'Meteorite' && !r.overlay, JSON.stringify(r));
});

await check('a far larger body kills the player: Stellar Fragment ending', async () => {
  await js(`
    const { createBody } = await import('/src/physics.js');
    const p = ${S}.player;
    const b = createBody({ x: p.x + p.radius * 2, y: p.y, radius: p.radius * 3, kind: 'threat' });
    b.dvx = b.dvy = 0; b.vx = -p.radius * 6;
    ${S}.bodies.push(b);`);
  await waitFor(`${S}.effects.some((e) => e.type === 'death')`, 3000, 'death effect');
  await waitFor(`${S}.status === 'ended'`, 5000, 'ended');
  const title = await js(`return document.querySelector('.vd-overlay.is-on h2').textContent;`);
  assert(title === 'Stellar Fragment', title);
  await js(`[...document.querySelectorAll('.vd-btn')].find((b) => b.textContent === 'Drift again').click();`);
  await waitFor(`${S}.status === 'playing'`, 3000);
});

await check('performance: 200 bodies, sim step and render frame within budget', async () => {
  const r = await js(`
    const g = window.__orbit.game;
    const t0 = performance.now();
    for (let i = 0; i < 240; i++) g.step(1 / 120);
    const step = (performance.now() - t0) / 240;
    const r = window.__orbit.renderer;
    const t1 = performance.now();
    for (let i = 0; i < 30; i++) g.render(1 / 60);
    const frame = (performance.now() - t1) / 30;
    return { step, frame, n: window.__orbit.state.bodies.length, drawn: r.getStats().drawn };`);
  console.log(`     bodies ${r.n}, drawn ${r.drawn}, step ${r.step.toFixed(3)} ms, render+ui ${r.frame.toFixed(2)} ms`);
  assert(r.step < 1.0, `sim step ${r.step} ms`);
  assert(r.frame < 12, `render ${r.frame} ms`);
});

await check('every stage renders, picking each choice menu with keys, up to the finale ending', async () => {
  const seen = [];
  for (let guard = 0; guard < 80; guard++) {
    const s = await js(`const s = ${S}; return { st: s.status, i: s.stageIndex };`);
    if (s.st === 'ended') break;
    if (s.st === 'choice') { await key('2', 'Digit2', 50, '2'); await waitFor(`${S}.status !== 'choice'`, 3000); continue; }
    if (!seen.includes(s.i)) {
      seen.push(s.i);
      await sleep(900); // let the morph / background fade play out
      const t = await js(`const g = window.__orbit.game; const t0 = performance.now(); for (let k = 0; k < 10; k++) g.render(1 / 60); return (performance.now() - t0) / 10;`);
      console.log(`     stage ${String(s.i).padStart(2)}: render ${t.toFixed(2)} ms, bodies ${await js(`return ${S}.bodies.length;`)}`);
      if (s.i % 3 === 0 || s.i === 11) await shot(`stage-${String(s.i).padStart(2, '0')}`);
    }
    // Grow straight to the next threshold (or to the finale mass at the last stage).
    await js(`const s = ${S}, st = window.__orbit.mod.STAGES; s.player.mass = s.stageIndex < 11 ? st[s.stageIndex + 1].minMass * 1.01 : st[11].minMass * 1.7;`);
    await sleep(150);
  }
  assert(seen.length === 12, `stages seen ${seen}`);
  await waitFor(`${S}.status === 'ended'`, 3000, 'finale');
  const r = await js(`return { t: document.querySelector('.vd-overlay.is-on h2').textContent, c: ${S}.flags.choices };`);
  assert(r.t === 'Black Hole' || r.t === 'Creator God' || r.t === 'Cradle of Life', JSON.stringify(r));
  console.log(`     ending: ${r.t}, picks ${JSON.stringify(r.c)}`);
});

await check('no console errors, exceptions or failed requests', async () => {
  assert(problems.length === 0, problems.join('\n     '));
});

console.log(`\n${passed} passed, ${failures.length} failed`);
ws.close();
browser.kill();
server.close();
await sleep(300);
await rm(profile, { recursive: true, force: true }).catch(() => {});
process.exit(failures.length ? 1 : 0);
