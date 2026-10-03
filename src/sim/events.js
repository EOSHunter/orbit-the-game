// Synchronous event bus (contract section 3). Handlers must be cheap and must not throw or call back into the sim.

export function createBus() {
  const handlers = new Map(); // type -> Set<fn>

  function on(type, fn) {
    let set = handlers.get(type);
    if (!set) handlers.set(type, (set = new Set()));
    set.add(fn);
    return () => off(type, fn);
  }

  function off(type, fn) {
    const set = handlers.get(type);
    if (set) set.delete(fn);
  }

  function emit(type, payload) {
    const direct = handlers.get(type);
    if (direct) for (const fn of direct) { try { fn(payload, type); } catch (e) { /* a bad consumer must not break the sim */ } }
    const all = handlers.get('*');
    if (all) for (const fn of all) { try { fn(payload, type); } catch (e) { /* ignore */ } }
  }

  return { on, off, emit };
}

/** Every event type the sim may emit (contract section 3). Anything else is a contract violation. */
export const EVENT_TYPES = [
  'run-start', 'status', 'rebase', 'absorb', 'hit', 'bounce', 'impact', 'roche-disruption', 'near-miss',
  'atmosphere-entry', 'atmosphere-exit', 'orbit-acquired', 'orbit-lost', 'slingshot', 'choice-open',
  'choice-picked', 'evolve', 'health-low', 'invuln-end', 'region-change', 'beacon-ping', 'capture-warning',
  'capture-clear', 'pulsar-beam', 'death', 'ending',
];
