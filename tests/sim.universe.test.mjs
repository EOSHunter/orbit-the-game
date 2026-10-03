// Universe tests: determinism, order independence, no overlap, voids, no edge, bounded memory.
import assert from 'node:assert/strict';
import { createUniverse, makeLevels } from '../src/sim/universe.js';
import { CONFIG } from '../src/sim/config.js';
import { test, done } from './sim.util.mjs';

const lv = makeLevels(CONFIG);
const FULL = [0, CONFIG.levels.count - 1];

test('same seed => identical universe; different seed => different', () => {
  const a = createUniverse('alpha').query([100, 0, -50], 800, FULL);
  const b = createUniverse('alpha').query([100, 0, -50], 800, FULL);
  const c = createUniverse('beta').query([100, 0, -50], 800, FULL);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.notEqual(JSON.stringify(a), JSON.stringify(c));
  assert.ok(a.near.length > 20, 'a populated neighbourhood');
});

test('cells are byte identical after unload/reload and independent of visit order', () => {
  const u1 = createUniverse('order');
  const u2 = createUniverse('order');
  const cells = [];
  for (let l = 0; l < CONFIG.levels.count; l++) for (const cx of [-2, 0, 3]) for (const cz of [-1, 5]) cells.push([l, cx, cz]);
  const first = cells.map(([l, x, z]) => JSON.stringify(u1.getCell(l, x, z).bodies));
  u1.clearCache(); // "unload everything"
  const again = cells.map(([l, x, z]) => JSON.stringify(u1.getCell(l, x, z).bodies));
  assert.deepEqual(again, first);
  const rev = [...cells].reverse().map(([l, x, z]) => JSON.stringify(u2.getCell(l, x, z).bodies)).reverse();
  assert.deepEqual(rev, first, 'visit order must not matter');
});

test('same cell seen from two directions is identical', () => {
  const u1 = createUniverse('dir'); const u2 = createUniverse('dir');
  const L = 10; const cs = lv.cellSize(L);
  const a = u1.query([0.5 * cs, 0, 0.5 * cs], 1e12, [L, L]).near.filter((d) => d.level === L);
  const b = u2.query([1.6 * cs, 0, 0.5 * cs], 1e12, [L, L]).near.filter((d) => d.level === L);
  const bm = new Map(b.map((d) => [d.id, JSON.stringify(d)]));
  let shared = 0;
  for (const d of a) if (bm.has(d.id)) { shared++; assert.equal(bm.get(d.id), JSON.stringify(d)); }
  assert.ok(shared > 0, 'the two views share bodies');
});

test('ids are unique, 53-bit safe and stable', () => {
  const u = createUniverse('ids');
  const { near, far } = u.query([0, 0, 0], 2000, FULL);
  const ids = new Set();
  for (const d of [...near, ...far]) {
    assert.ok(Number.isSafeInteger(d.id) && d.id > 0 && d.id < 2 ** 52, 'id range');
    ids.add(d.id);
  }
  const all = [...near, ...far.filter((f) => !near.includes(f))];
  assert.equal(ids.size, new Set(all.map((d) => d.id)).size);
  const again = createUniverse('ids').query([0, 0, 0], 2000, FULL);
  assert.deepEqual(again.near.map((d) => d.id), near.map((d) => d.id));
});

test('no overlap: no two bodies intersect at any time (rails included)', () => {
  const u = createUniverse('overlap');
  const { near } = u.query([0, 0, 0], 30000, FULL);
  const pos = [0, 0, 0]; const vel = [0, 0, 0];
  let systems = 0;
  for (const t of [0, 13.7, 211.3, 1000.9]) {
    const pts = near.map((d) => { u.railState(d, t, pos, vel); return [pos[0], pos[2], d.radius, d.id]; });
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[i][0] - pts[j][0]; const dz = pts[i][1] - pts[j][1]; const r = pts[i][2] + pts[j][2];
        assert.ok(dx * dx + dz * dz >= r * r * 0.999, `bodies ${pts[i][3]} and ${pts[j][3]} overlap at t=${t}`);
      }
    }
  }
  for (const d of near) if (d.hasSystem) systems++;
  assert.ok(systems > 0, 'the sample contains systems with rails');
});

test('systems stay inside their cell', () => {
  const u = createUniverse('cells');
  for (let l = 3; l < 14; l++) {
    const cs = lv.cellSize(l);
    for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++) {
      const c = u.getCell(l, cx, cz);
      for (const e of c.envs) {
        assert.ok(e.x - e.e >= cx * cs - 1e-6 && e.x + e.e <= (cx + 1) * cs + 1e-6 && e.z - e.e >= cz * cs - 1e-6 && e.z + e.e <= (cz + 1) * cs + 1e-6, 'envelope inside cell');
      }
    }
  }
});

test('density changes with scale: every level has bodies, mass bands match the level', () => {
  const u = createUniverse('levels');
  let nonEmpty = 0;
  for (let l = 0; l < CONFIG.levels.count; l++) {
    let n = 0;
    for (let cx = -6; cx <= 6; cx++) for (let cz = -6; cz <= 6; cz++) {
      for (const root of u.getCell(l, cx, cz).roots) {
        n++;
        assert.ok(root.mass >= lv.massMin(l) * 0.999 && root.mass < lv.massMin(l + 1) * 1.001, `level ${l} mass ${root.mass}`);
      }
    }
    if (n > 0) nonEmpty++;
  }
  assert.equal(nonEmpty, CONFIG.levels.count);
});

test('voids exist, are bounded, and point to nearby matter', () => {
  const u = createUniverse('voids');
  let voids = 0; let n = 0; let nearest = 0;
  const cs = lv.cellSize(4);
  for (let i = -30; i < 30; i++) for (let j = -30; j < 30; j++) {
    const r = u.getRegion([i * cs * 0.9, 0, j * cs * 0.9], 4);
    n++;
    if (r.inVoid) {
      voids++;
      assert.ok(r.nearestMatter && r.nearestMatter.dist > 0 && Number.isFinite(r.nearestMatter.bearing));
      nearest++;
    } else assert.equal(r.nearestMatter, null);
  }
  const f = voids / n;
  assert.ok(f > 0.02 && f < 0.5, `void fraction ${f.toFixed(3)}`);
  assert.ok(nearest > 0);
});

test('no edge: far-away space is populated and deterministic', () => {
  for (const x of [1e6, -3e7, 1e9]) {
    const u = createUniverse('edge');
    const a = u.query([x, 0, -x / 3], 1500, FULL);
    const b = createUniverse('edge').query([x, 0, -x / 3], 1500, FULL);
    assert.ok(a.near.length + a.far.length > 20, `populated at ${x}`);
    assert.equal(JSON.stringify(a.near.map((d) => d.id)), JSON.stringify(b.near.map((d) => d.id)));
  }
});

test('consume removes a body for good; deltas round trip', () => {
  const u = createUniverse('consume');
  const q1 = u.query([0, 0, 0], 800, FULL).near;
  const victim = q1[0];
  u.consume(victim.id);
  assert.ok(!u.query([0, 0, 0], 800, FULL).near.some((d) => d.id === victim.id));
  const d = u.exportDeltas();
  const u2 = createUniverse('consume');
  u2.importDeltas(JSON.parse(JSON.stringify(d)));
  assert.ok(!u2.query([0, 0, 0], 800, FULL).near.some((x) => x.id === victim.id));
  assert.ok(u2.isConsumed(victim.id));
});

test('memory is flat over a 1e6-unit fly-through', () => {
  const u = createUniverse('fly');
  let maxCache = 0; let maxNear = 0; let maxFar = 0;
  for (let x = 0; x <= 1e6; x += 1000) {
    const { near, far } = u.query([x, 0, x * 0.2], 900, [0, CONFIG.levels.count - 1]);
    maxNear = Math.max(maxNear, near.length); maxFar = Math.max(maxFar, far.length);
    maxCache = Math.max(maxCache, u.cacheSize());
  }
  assert.ok(maxCache <= CONFIG.universe.cacheMax, `cache ${maxCache}`);
  assert.ok(maxNear < 800 && maxFar < 4000, `near ${maxNear} far ${maxFar}`);
});

test('a fresh start position is calm: dense region, nothing big close by', () => {
  const u = createUniverse('start');
  const s = u.findStart(3, 120);
  assert.ok(u.getRegion(s, 3).density >= 0.5);
  const { near } = u.query(s, 300, [3, CONFIG.levels.count - 1]);
  for (const d of near) {
    const dx = (d.p0 ? d.p0[0] : 0) - s[0]; const dz = (d.p0 ? d.p0[2] : 0) - s[2];
    if (d.root) assert.ok(Math.hypot(dx, dz) > 120, 'no big envelope at the start');
  }
});

done('sim.universe');
