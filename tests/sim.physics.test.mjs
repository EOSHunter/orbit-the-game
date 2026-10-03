// Physics tests: gravity, orbits, conservation, absorb, Roche, impacts, entry, capture, slingshot-free scenarios.
import assert from 'node:assert/strict';
import { createSim } from '../src/sim/index.js';
import { CONFIG } from '../src/sim/config.js';
import {
  softenedAccel, escapeSpeed, absorbEfficiency, mergeVelocity, rocheDistance, mu as muOf,
} from '../src/sim/physics.js';
import { railOffset, orbitPeriod } from '../src/sim/orbits.js';
import { test, done, lab, run, recorder, STEP } from './sim.util.mjs';

const G = CONFIG.gravity;

test('softened gravity is finite at the centre and points at the source', () => {
  const out = [0, 0];
  const mag = softenedAccel(G, muOf(G, 100), 100, 0, 0, 0, 0, out);
  assert.ok(Number.isFinite(mag) && out[0] === 0 && out[1] === 0);
  out[0] = 0; out[1] = 0;
  softenedAccel(G, muOf(G, 100), 100, 500, 0, 0, 0, out);
  assert.ok(out[0] > 0 && Math.abs(out[1]) < 1e-12);
  out[0] = 0; out[1] = 0;
  assert.equal(softenedAccel(G, muOf(G, 100), 100, 1e6, 0, 0, 0, out), 0, 'range limited');
  // max acceleration is bounded by the softening
  let worst = 0;
  for (let d = 0; d < 1000; d += 1) { out[0] = 0; out[1] = 0; worst = Math.max(worst, softenedAccel(G, muOf(G, 100), 100, d, 0, 0, 0, out)); }
  assert.ok(worst < 1.2 * G.surfaceRate ** 2 * 100, `bounded accel ${worst}`);
});

test('free orbit around a softened well stays bound for 1000 periods (energy and radius)', () => {
  const R = 100; const m = muOf(G, R); const a0 = 3 * R;
  const out = [0, 0];
  softenedAccel(G, m, R, 0, 0, a0, 0, out);
  const acc = Math.hypot(out[0], out[1]);
  const v0 = Math.sqrt(acc * a0);
  const T = (2 * Math.PI * a0) / v0;
  let x = a0; let z = 0; let vx = 0; let vz = v0;
  const eps = G.soften * R;
  const energy = () => 0.5 * (vx * vx + vz * vz) - m / Math.sqrt(x * x + z * z + eps * eps);
  const e0 = energy();
  let rmin = Infinity; let rmax = 0;
  const dt = STEP; const steps = Math.round((1000 * T) / dt);
  for (let i = 0; i < steps; i++) {
    out[0] = 0; out[1] = 0;
    softenedAccel(G, m, R, 0, 0, x, z, out);
    vx += out[0] * dt; vz += out[1] * dt;
    x += vx * dt; z += vz * dt;
    const r = Math.hypot(x, z);
    if (r < rmin) rmin = r; if (r > rmax) rmax = r;
  }
  assert.ok(rmin > 0.97 * a0 && rmax < 1.03 * a0, `radius ${rmin}..${rmax}`);
  assert.ok(Math.abs((energy() - e0) / e0) < 0.01, 'energy drift under 1 %');
});

test('Kepler rails are exact: position after 1000 periods equals the start', () => {
  const o = { a: 5000, e: 0.18, w: 1.1, M0: 2.0, n: Math.sqrt(muOf(G, 1000) / 5000 ** 3) };
  const T = orbitPeriod(o);
  const p0 = [0, 0, 0]; const p1 = [0, 0, 0]; const v0 = [0, 0, 0]; const v1 = [0, 0, 0];
  railOffset(o, 12.5, p0, v0); railOffset(o, 12.5 + 1000 * T, p1, v1);
  assert.ok(Math.hypot(p0[0] - p1[0], p0[2] - p1[2]) < 1e-5 * o.a);
  assert.ok(Math.hypot(v0[0] - v1[0], v0[2] - v1[2]) < 1e-6 * Math.hypot(...v0));
  // angular momentum constant along the rail (|r x v| sampled at several times)
  const hs = [];
  for (const t of [0, 3, 17, 91]) { railOffset(o, t, p0, v0); hs.push(p0[0] * v0[2] - p0[2] * v0[0]); }
  for (const h of hs) assert.ok(Math.abs(h / hs[0] - 1) < 1e-9);
});

test('absorb efficiency: gentle contact keeps more than a fast hit', () => {
  const a = CONFIG.absorb;
  const gentle = absorbEfficiency(a, 0.1, 1);
  const fast = absorbEfficiency(a, 10, 1);
  assert.ok(gentle > fast && gentle <= 1 && fast > 0);
  assert.ok(Math.abs(gentle - a.gentle) < 1e-9 && Math.abs(fast - a.fast) < 1e-9);
  assert.ok(Math.abs(mergeVelocity(3, 10, 1, -2) - (30 - 2) / 4) < 1e-12);
  assert.ok(escapeSpeed(10, 5) > escapeSpeed(10, 50));
});

const momentum = (st) => {
  let px = 0; let pz = 0;
  px += st.player.mass * st.player.v[0]; pz += st.player.mass * st.player.v[2];
  for (const b of st.bodies) if (b.state !== 'absorbing') { px += b.mass * b.v[0]; pz += b.mass * b.v[2]; }
  return [px, pz];
};
const totalMass = (st) => st.player.mass + st.bodies.reduce((s, b) => s + (b.state !== 'absorbing' ? b.mass : 0), 0);

test('absorb conserves momentum and mass (debris carries the shed share)', () => {
  const sim = lab(createSim);
  const st = sim.getState();
  sim.debug.setPlayer({ mass: 1, v: [60, -2] });
  sim.debug.spawnBody({ cls: 'meteorite', mass: 0.3, p: [90, 0, -3], v: [-25, 0, 0.4] });
  const p0 = momentum(st); const m0 = totalMass(st);
  const log = recorder(sim);
  for (let i = 0; i < 400 && !log.some((e) => e.type === 'absorb'); i++) sim.step(STEP); // measure right at the absorb
  assert.ok(log.some((e) => e.type === 'absorb'), 'the prey was absorbed');
  const p1 = momentum(st);
  assert.ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 1e-9 * Math.hypot(...p0) + 1e-9, `momentum ${p0} -> ${p1}`);
  assert.ok(Math.abs(totalMass(st) - m0) < 1e-9, 'mass is conserved (shed mass became debris)');
});

test('body-body merge conserves momentum; fast heavy impacts shed debris', () => {
  const sim = lab(createSim);
  const st = sim.getState();
  sim.debug.setPlayer({ mass: 1, p: [1e5, 0], v: [0, 0] });
  sim.debug.spawnBody({ cls: 'asteroid', mass: 50, p: [0, 0, 0], v: [4, 0, 2] });   // below the gravity threshold: no external force
  sim.debug.spawnBody({ cls: 'meteorite', mass: 5, p: [60, 0, 0], v: [-30, 0, 1] });
  const p0 = momentum(st);
  const log = recorder(sim);
  run(sim, 2);
  const imp = log.find((e) => e.type === 'impact');
  assert.ok(imp, 'impact event');
  assert.ok(imp.payload.energy > 0 && imp.payload.relSpeed > 20);
  const p1 = momentum(st);
  assert.ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 1e-9 * Math.hypot(...p0) + 1e-9);
  assert.ok(st.bodies.some((b) => b.cls === 'debris'), 'debris spawned');
});

test('comparable bodies bounce (inelastic) and shatter when the energy is high', () => {
  const sim = lab(createSim);
  sim.debug.setPlayer({ mass: 1, p: [1e5, 0] });
  sim.debug.spawnBody({ cls: 'asteroid', mass: 40, p: [0, 0, 0], v: [3, 0, 0] });
  sim.debug.spawnBody({ cls: 'asteroid', mass: 40, p: [80, 0, 0], v: [-3, 0, 0] });
  const log = recorder(sim);
  run(sim, 2);
  assert.ok(log.some((e) => e.type === 'impact' && e.payload.ejecta >= 0));
  assert.ok(sim.getState().bodies.filter((b) => b.cls === 'asteroid').length === 2, 'low energy: both survive');
  const sim2 = lab(createSim);
  sim2.debug.setPlayer({ mass: 1, p: [1e5, 0] });
  sim2.debug.spawnBody({ cls: 'asteroid', mass: 40, p: [0, 0, 0], v: [150, 0, 0] });
  sim2.debug.spawnBody({ cls: 'asteroid', mass: 40, p: [100, 0, 0], v: [-150, 0, 0] });
  run(sim2, 1);
  const st2 = sim2.getState();
  assert.ok(st2.bodies.filter((b) => b.cls === 'fragment').length >= 4, 'fragments after a hard hit');
  assert.ok(st2.bodies.filter((b) => b.cls === 'asteroid').length === 0);
});

test('Roche: a much smaller body inside the limit is shredded into fragments that are absorbed', () => {
  const sim = lab(createSim, { absorb: { pullAccel: 7, debrisFraction: 1 } });
  const st = sim.getState();
  sim.debug.setPlayer({ mass: 1000, v: [0, 0] });
  const R = st.player.radius;
  const prey = sim.debug.spawnBody({ cls: 'asteroid', mass: 40, p: [1.2 * R, 0, 0], v: [0, 0, 0] });
  const log = recorder(sim);
  const before = st.player.mass;
  run(sim, 25);
  const starts = log.filter((e) => e.type === 'roche-disruption' && e.payload.phase === 'start');
  const ends = log.filter((e) => e.type === 'roche-disruption' && e.payload.phase === 'end');
  assert.equal(starts.length, 1); assert.equal(starts[0].payload.victim, 'prey'); assert.equal(starts[0].payload.bodyId, prey.id);
  assert.equal(ends.length, 1);
  assert.ok(log.filter((e) => e.type === 'absorb').length >= 5, 'fragments are absorbed individually');
  assert.ok(st.player.mass > before + 5, 'the mass ends up in the player');
  assert.equal(st.stats.disruptions, 1);
});

test('Roche: a body 10x larger damages the player over time (victim: player)', () => {
  const sim = lab(createSim);
  const st = sim.getState();
  sim.debug.setPlayer({ mass: 10, v: [0, 0] });
  const R = st.player.radius;
  const big = sim.debug.spawnBody({ cls: 'rockyPlanet', mass: 400, p: [0, 0, 0], static: true });
  sim.debug.setPlayer({ p: [big.radius * 1.5 + R, 0] });
  const log = recorder(sim);
  run(sim, 2);
  const start = log.find((e) => e.type === 'roche-disruption' && e.payload.victim === 'player');
  assert.ok(start, 'tidal damage started');
  assert.ok(st.health < 1, `health ${st.health}`);
  assert.ok(st.player.disrupt && st.player.disrupt.progress > 0);
});

test('atmospheric entry only for fast bodies inside a shell (rule R6)', () => {
  const sim = lab(createSim);
  const st = sim.getState();
  sim.debug.setPlayer({ mass: 1, p: [1e6, 0] });
  const host = sim.debug.spawnBody({ cls: 'rockyPlanet', mass: 600, p: [0, 0, 0], static: true, variant: 'terrestrial', atmosphere: { density: 0.7, shellHeight: 40 } });
  const vesc = Math.sqrt(2 * host._mu / host.radius);
  const fast = sim.debug.spawnBody({ cls: 'meteorite', mass: 0.5, p: [host.radius + 38, 0, 0], v: [-vesc * 0.9, 0, 0] });
  const slow = sim.debug.spawnBody({ cls: 'meteorite', mass: 0.5, p: [0, 0, host.radius + 38], v: [0, 0, -vesc * 0.1] });
  const log = recorder(sim);
  run(sim, 0.05);
  const entries = log.filter((e) => e.type === 'atmosphere-entry');
  assert.ok(entries.some((e) => e.payload.bodyId === fast.id && e.payload.hostId === host.id), 'fast body enters');
  assert.ok(!entries.some((e) => e.payload.bodyId === slow.id), 'slow body does not');
  assert.ok(fast.entry && fast.emissive && fast.emissive.cause === 'ablation');
  assert.equal(slow.entry, null); assert.equal(slow.emissive, null);
  run(sim, 5);
  assert.ok(log.some((e) => e.type === 'atmosphere-exit' && e.payload.bodyId === fast.id) || fast._dead || fast.entry === null);
});

test('capture: warnings come early, escape is possible, deep inside is the Event Horizon death', () => {
  // a hole 100x heavier than the player: capture radius = max(6 R, 40 S)
  const mkLab = () => {
    const sim = lab(createSim);
    sim.debug.setPlayer({ mass: 1e5, v: [0, 0] });
    const bh = sim.debug.spawnBody({ cls: 'blackHole', mass: 1e7, p: [0, 0, 0], static: true });
    const rc = Math.max(CONFIG.capture.radiusK * bh.radius, CONFIG.capture.radiusS * sim.getState().player.radius);
    return { sim, bh, rc };
  };
  const { sim, bh, rc } = mkLab();
  const st = sim.getState();
  sim.debug.setPlayer({ p: [0.65 * rc, 0], v: [0, 0] });
  const log = recorder(sim);
  run(sim, 2, () => ({ x: 1, z: 0, stabilize: false })); // thrust straight away from the hole
  assert.ok(log.some((e) => e.type === 'capture-warning' && e.payload.level === 0.25), 'early warning');
  assert.ok(sim.debug.captureLevel < 0.75 && st.status === 'playing', 'still alive and escaping');
  assert.ok(st.hud.capture && st.hud.capture.hostId === bh.id);
  run(sim, 40, () => ({ x: 1, z: 0, stabilize: false }));
  assert.ok(log.some((e) => e.type === 'capture-clear'), 'capture cleared after escaping');
  assert.equal(st.hud.capture, null);
  assert.ok(!log.some((e) => e.type === 'death'));
  // no-escape case: deep inside the pull is stronger than thrust
  const m2 = mkLab();
  m2.sim.debug.setPlayer({ p: [0.3 * m2.rc, 0], v: [0, 0] });
  const log2 = recorder(m2.sim);
  run(m2.sim, 20, () => ({ x: 1, z: 0, stabilize: false }));
  const death = log2.find((e) => e.type === 'death');
  assert.ok(death && death.payload.cause === 'captured' && death.payload.killerCls === 'blackHole', 'captured death');
  assert.deepEqual(log2.filter((e) => e.type === 'capture-warning').map((e) => e.payload.level), [0.25, 0.5, 0.75, 1]);
  const ending = log2.find((e) => e.type === 'ending');
  assert.ok(ending && ending.payload.kind === 'eventHorizon' && ending.payload.ending.id === 'event_horizon');
  assert.equal(m2.sim.getState().deathCause, 'captured');
  // a hole 1e5x heavier than the player is no hunter: no capture, and ordinary pull never beats the thrust
  const sim3 = lab(createSim);
  sim3.debug.setPlayer({ mass: 1, v: [0, 0] });
  const big = sim3.debug.spawnBody({ cls: 'blackHole', mass: 1e7, p: [0, 0, 0], static: true });
  sim3.debug.setPlayer({ p: [3 * big.radius, 0] });
  const log3 = recorder(sim3);
  run(sim3, 5, () => ({ x: 1, z: 0, stabilize: false }));
  assert.ok(!log3.some((e) => e.type === 'capture-warning' || e.type === 'death'));
  assert.ok(sim3.getState().player.p[0] - big.p[0] > 3 * big.radius, 'could always thrust away'); // positions are origin relative (rebased)
});

test('gravity assist: passing behind a fast-moving well gains speed (slingshot event)', () => {
  const sim = lab(createSim);
  const st = sim.getState();
  sim.debug.setPlayer({ mass: 1, p: [-6000, -700], v: [0, 0] });
  const R = 10 * Math.sqrt(20000);
  const host = sim.debug.spawnBody({ cls: 'star', mass: 20000, p: [0, 0, 0], v: [0, 0, 0] });
  // the host sweeps past the stationary player: relative frame equivalent of a moving flyby
  host.p[0] = -9 * R; host.p[2] = -3.4 * R; host.v[0] = 1500; host.v[2] = 0;
  sim.debug.setPlayer({ p: [0, 0], v: [0, 0] });
  const log = recorder(sim);
  run(sim, 40);
  assert.ok(Math.hypot(...st.player.v) > 30, `the player was flung: ${Math.hypot(...st.player.v)}`);
  assert.ok(log.some((e) => e.type === 'slingshot' && e.payload.speedGain > 0), 'slingshot event');
});

test('orbit acquired and lost around a well; orbit readout in the HUD', () => {
  const sim = lab(createSim);
  const st = sim.getState();
  sim.debug.setPlayer({ mass: 5, v: [0, 0] });
  const host = sim.debug.spawnBody({ cls: 'rockyPlanet', mass: 300, p: [0, 0, 0], static: true });
  const d = 4 * host.radius;
  const out = [0, 0];
  softenedAccel(G, host._mu, host.radius, 0, 0, d, 0, out);
  const v = Math.sqrt(Math.hypot(out[0], out[1]) * d);
  sim.debug.setPlayer({ p: [d, 0], v: [0, v] });
  const log = recorder(sim);
  run(sim, 4);
  const acq = log.find((e) => e.type === 'orbit-acquired');
  assert.ok(acq && acq.payload.hostId === host.id && acq.payload.hostCls === 'rockyPlanet', 'orbit acquired');
  assert.ok(st.hud.orbit && st.hud.orbit.hostId === host.id && Math.abs(st.hud.orbit.period - (2 * Math.PI * d) / v) < 0.25 * (2 * Math.PI * d) / v, 'period readout');
  assert.ok(Math.abs(st.hud.orbit.altitude - (d - host.radius)) < 0.2 * d);
  sim.debug.setPlayer({ v: [0, 4 * v] }); // fling it out
  run(sim, 4);
  assert.ok(log.some((e) => e.type === 'orbit-lost' && e.payload.hostId === host.id), 'orbit lost');
  assert.equal(st.hud.orbit, null);
});

test('near-miss: a threat passing close without contact is reported once with its gap', () => {
  const sim = lab(createSim);
  const st = sim.getState();
  sim.debug.setPlayer({ mass: 1, v: [0, 0] });
  const rr = st.player.radius + 10 * Math.sqrt(2);
  sim.debug.spawnBody({ cls: 'meteorite', mass: 2, p: [300, 0, 1.25 * rr], v: [-200, 0, 0] });
  const log = recorder(sim);
  run(sim, 3);
  const nm = log.filter((e) => e.type === 'near-miss');
  assert.equal(nm.length, 1);
  assert.equal(nm[0].payload.rel, 'threat');
  assert.ok(nm[0].payload.gap > 0 && nm[0].payload.gap < 0.5 * rr && nm[0].payload.relSpeed > 150);
  assert.equal(st.stats.nearMisses, 1);
  assert.ok(!log.some((e) => e.type === 'hit'));
});

test('neutral contact bounces (momentum exchange) without damage', () => {
  const sim = lab(createSim);
  const st = sim.getState();
  sim.debug.setPlayer({ mass: 1, v: [0, 0] });
  const b = sim.debug.spawnBody({ cls: 'meteorite', mass: 1.05, p: [60, 0, 0], v: [-40, 0, 0] });
  const p0 = momentum(st);
  const log = recorder(sim);
  run(sim, 2);
  assert.ok(log.some((e) => e.type === 'bounce' && e.payload.bodyId === b.id), 'bounce event');
  assert.ok(!log.some((e) => e.type === 'hit') && st.health === 1);
  assert.ok(st.player.v[0] < 0 && b.v[0] > -40, 'both changed velocity');
  const p1 = momentum(st);
  assert.ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) < 5, `momentum roughly kept (${p0} -> ${p1}) apart from the separation kick`);
});

test('pulsar beam sweeps are reported, rate limited, and proximity reads the neutron star', () => {
  const sim = lab(createSim);
  const st = sim.getState();
  sim.debug.setPlayer({ mass: 1, v: [0, 0] });
  const ns = sim.debug.spawnBody({ cls: 'neutronStar', mass: 1.5e6, p: [0, 0, 0], static: true, beam: { phase: 0, period: 1, width: 0.15 } });
  sim.debug.setPlayer({ p: [20 * ns.radius, 0] });
  const log = recorder(sim);
  run(sim, 6);
  const beams = log.filter((e) => e.type === 'pulsar-beam');
  assert.ok(beams.length >= 5 && beams.length <= 14, `${beams.length} sweeps in 6 s (two beams per rotation)`);
  assert.ok(beams.every((e) => e.payload.bodyId === ns.id && e.payload.intensity > 0));
  sim.debug.setPlayer({ p: [ns.p[0] + 3 * ns.radius, ns.p[2]], v: [0, 0] }); // positions are origin relative: the origin was rebased
  run(sim, 0.1);
  assert.ok(st.hud.proximity.pulsar > 0.5, 'close to the pulsar');
});

done('sim.physics');
