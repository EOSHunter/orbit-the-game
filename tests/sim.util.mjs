// Shared helpers for the sim tests (plain node, no framework).
let passed = 0;
export function test(name, fn) {
  try {
    const r = fn();
    if (r && typeof r.then === 'function') throw new Error('async tests are not supported');
    passed++; console.log(`ok   ${name}`);
  } catch (e) { console.error(`FAIL ${name}\n${e.stack}`); process.exitCode = 1; }
}
export function done(label) { console.log(`\n${label}: ${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`); }

export const STEP = 1 / 120;

/** Step a sim n times, collecting events from the whole bus. */
export function recorder(sim) {
  const log = [];
  sim.events.on('*', (payload, type) => log.push({ type, payload, t: sim.getState().time }));
  return log;
}

export function run(sim, seconds, inputFn) {
  const n = Math.round(seconds / STEP);
  for (let i = 0; i < n; i++) {
    if (inputFn) sim.setInput(inputFn(sim.getState(), i));
    sim.step(STEP);
  }
}

/** A sim with no universe loading, no brake and no scoop, for controlled physics scenarios. */
export function lab(createSim, extra = {}) {
  const sim = createSim({
    seed: 'lab',
    config: { pace: { enabled: false }, player: { brakeEarly: 0, brakeLate: 0 }, absorb: { pullAccel: 0, debrisFraction: 1 }, ...extra },
  });
  sim.debug.setLoaderEnabled(false);
  sim.debug.clearBodies();
  sim.start();
  return sim;
}
