// Demo driver: renders fixture states with no SIM present.  ?stage=<id|gallery>  ?quality=low|med|high
import { createRenderer } from './index.js';
import { makeBody, makeFixtureState, stepFixture, makeFixtureEvents, STAGE_IDS } from './fixtures.js';

function createBus() {
  const m = new Map();
  return {
    on(t, f) { if (!m.has(t)) m.set(t, new Set()); m.get(t).add(f); return () => m.get(t).delete(f); },
    off(t, f) { if (m.has(t)) m.get(t).delete(f); },
    emit(t, p) { for (const k of [t, '*']) if (m.has(k)) for (const f of m.get(k)) f(p, t); },
  };
}

const q = new URLSearchParams(location.search);
const canvas = document.getElementById('game');
const renderer = createRenderer({ canvas });
const bus = createBus();
let state = makeFixtureState(q.get('stage') || 'asteroid');
// ?n=<count> adds that many extra rocks/planets around the player (stress test), ?far=<count> resizes the far field
const stress = (st) => {
  const n = +q.get('n') || 0; if (!n) return st;
  const R = st.player.radius; let a = 12345;
  const rnd = () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; };
  const kinds = ['asteroid', 'asteroid', 'meteorite', 'debris', 'dwarfPlanet', 'rockyPlanet', 'gasGiant'];
  for (let i = 0; i < n; i++) {
    const c = kinds[Math.floor(rnd() * kinds.length)], big = c === 'rockyPlanet' || c === 'gasGiant';
    const ang = rnd() * 6.283, d = R * (3 + rnd() * 40);
    st.bodies.push(makeBody(c, { r: Math.max(2, R * (big ? 0.5 + rnd() : 0.1 + rnd() * 0.6)), x: Math.cos(ang) * d, z: Math.sin(ang) * d, stageId: 'asteroid', rel: ['prey', 'neutral', 'threat'][i % 3], seed: Math.floor(rnd() * 4e9), variant: c === 'rockyPlanet' ? 'terrestrial' : null, atmosphere: c === 'rockyPlanet' ? { density: 0.8, shellHeight: 0.06 } : null }));
  }
  return st;
};
const solo = (st) => { stress(st); if (q.get('solo')) { st.bodies.length = 0; st.far.count = 0; } return st; };
solo(state);
let events = makeFixtureEvents(state);
const el = (id) => document.getElementById(id);

function fit() { renderer.resize(innerWidth, innerHeight, devicePixelRatio || 1); }
addEventListener('resize', fit);

const stages = el('stages');
for (const id of [...STAGE_IDS, 'gallery', 'entry']) {
  const b = document.createElement('button'); b.textContent = id; b.onclick = () => setStage(id); stages.appendChild(b);
}
const evs = el('events');
for (const ev of events) {
  const b = document.createElement('button'); b.textContent = ev.type;
  b.onclick = () => { const e = makeFixtureEvents(state).find((x) => x.type === ev.type); if (e.type === 'evolve') bus.emit('evolve', e.payload); else bus.emit(e.type, e.payload); };
  evs.appendChild(b);
}

function setStage(id) {
  const prevStage = state.stageId;
  state = solo(makeFixtureState(id));
  if (prevStage !== state.stageId) bus.emit('evolve', { fromId: prevStage, toId: state.stageId, fromIndex: 0, toIndex: 1, mass: state.mass });
  window.__demo.state = state;
}

el('td').onchange = (e) => renderer.setOptions({ topDown: e.target.checked });
el('rd').onchange = (e) => renderer.setOptions({ readability: e.target.checked });
el('rm').onchange = (e) => renderer.setOptions({ reducedMotion: e.target.checked });
el('q').onchange = (e) => renderer.setQuality(e.target.value);
if (q.get('hideui')) el('p').style.display = 'none';

let frames = 0;
window.__demo = { renderer, state, bus, frames: 0, setStage, errors: [] };
window.addEventListener('error', (e) => window.__demo.errors.push(String(e.message)));

(async () => {
  const ok = await renderer.init();
  if (!ok) { document.body.insertAdjacentHTML('beforeend', '<h3 style="position:fixed;top:40%;left:30%;color:#f88">WebGL2 renderer failed to init (see console)</h3>'); window.__demo.failed = true; return; }
  if (q.get('quality')) { renderer.setQuality(q.get('quality')); el('q').value = q.get('quality'); }
  if (q.get('topdown')) { renderer.setOptions({ topDown: true }); el('td').checked = true; }
  renderer.attach(bus); fit();
  bus.emit('run-start', { seed: 'fixture', genVersion: 1, stageId: state.stageId });
  let last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    stepFixture(window.__demo.state, dt);
    renderer.drawFrame(window.__demo.state, dt);
    frames++; window.__demo.frames = frames;
    if (frames === 20 && q.get('fire')) for (const t of q.get('fire').split(',')) { const e = makeFixtureEvents(window.__demo.state).find((x) => x.type === t); if (e) bus.emit(e.type, e.payload); }
    if (frames % 20 === 0) { const s = renderer.getStats(); el('st').textContent = `${s.ms.toFixed(1)} ms js | ${s.drawCalls} calls | ${(s.triangles / 1000).toFixed(0)}k tris | ${s.bodies} bodies | ${s.quality}`; }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
})();
