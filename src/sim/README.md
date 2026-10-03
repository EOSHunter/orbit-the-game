# SIM: the simulation / universe module

Pure JS ES modules. No DOM, no Three.js, no audio, no `Math.random`, no `Date`. Runs in Node.
Contract: `docs/interfaces.md` section 4 (shapes in 2.2 / 2.3, events in 3).

```js
import { createSim, CLS_LIST } from './sim/index.js';
const sim = createSim({ seed: 'VD-7K3Q', config: { /* partial CONFIG overrides */ } });
sim.events.on('absorb', (e) => ...);          // or '*' for everything
sim.start();                                   // title -> playing (emits status, run-start)
// every frame: sim.setInput({ x, z, stabilize }); sim.step(1 / 120) * n; const state = sim.getState();
```

## Files

| File | Role |
|---|---|
| `index.js` | `createSim`: state machine, loader, forces, collisions, events, HUD, save/load, `debug` |
| `universe.js` | `createUniverse(seed)`: chunked, deterministic, infinite; systems on Kepler rails; regions/voids |
| `config.js` | `CONFIG`, every tunable (`createSim({config})` deep-merges onto a private copy) |
| `classes.js` | `CLS_LIST`, stage to class map, **emitter whitelist** + `validateEmissive`, per-class generation |
| `body.js` | live body construction, `emissive` choice, spin/flash/beam bookkeeping, player look per stage |
| `physics.js` | pure helpers: softened gravity, escape speed, Roche limit, absorb efficiency, merges |
| `orbits.js` | analytic Kepler rails (`railOffset`) |
| `rng.js` | `hash32`, `makeRng` (mulberry32), `makeId`, value noise |
| `events.js` | `createBus`, `EVENT_TYPES` |
| `fixtures.js` | `makeFixtureState(stageId)`, `makeFixtureEvents()` for UI/ENG/SND development |

## Tests (plain node, no dependencies)

```
node tests/sim.universe.test.mjs     # determinism, order independence, no overlap, voids, no edge, flat memory over 1e6 units
node tests/sim.physics.test.mjs      # softened gravity, 1000-period orbits, exact rails, momentum, Roche, impacts, entry, capture, slingshot
node tests/sim.emitters.test.mjs     # the emitter whitelist (contract 2.1) on natural runs and forced scenarios
node tests/sim.contract.test.mjs     # snapshot shape, events, fixtures, lifecycle, endings, rebase, save/load, source hygiene
node tests/stages.test.mjs           # stages.js (unchanged behaviour, plus 'captured' ending)
node tests/sim.pace.mjs --runs 6 --dt 60            # pacing bot (see its header for options); exit code 1 if targets are missed
```
Run them all: `for f in tests/sim.*.test.mjs tests/stages.test.mjs; do node $f || exit 1; done`

## The universe (research section 3)

- **Levels.** Level `L` holds bodies with mass in `[0.02 * 3.5^L, 0.02 * 3.5^(L+1))` (18 levels: 0.02 .. ~1e8). The cell edge is
  `cellK (60) x` the level's reference radius, so the number of cells in view at the scale where a level matters is the
  same at every stage. Each level carries about the same mass per area, so pacing is scale-invariant ("density by scale").
- **Cell = pure function** of `(seed, GEN_VERSION, level, cx, cz)` with a fixed draw order. Each body draws from its own
  sub-seed, so the count of bodies never shifts another body. Ids are `makeId(level, cx, cz, i)` (53-bit safe, stable).
- **Density** is value noise over the cell lattice (clusters, filaments, **voids**). `getRegion(abs, level)` averages the
  levels the player eats and reports `{ density, inVoid, nearestMatter }`.
- **Systems** (star > planets > moons, belts, black-hole companions) are built in a local frame; every orbit band is
  disjoint (so rails never overlap, tested at several times) and the whole system lives inside its cell. Roots are static,
  satellites follow `parent.p + railOffset(orbit, t)` exactly (no drift, no integration).
- **Cross-level exclusion.** A body avoids the envelopes of all *higher* levels (pure, so order independent).
- **Field bodies** (no system) start with a small drift velocity (`driftK * refRadius^0.7`, so huge bodies are nearly static)
  and are integrated once loaded; comets are 3x faster field bodies. Unloaded field bodies reappear at their epoch position.
- **Loading.** Every `view.tickSteps` (6) steps the sim queries the universe around the player, loads whole systems that
  touch the near window of their level (apparent-size cull `nearK x max radius`, capped by `view.radiusS` player radii),
  unloads with hysteresis (`unloadK` 1.35), and fills the far-field struct-of-arrays. Cells are LRU cached.
- **No world edge anywhere.** Voids + the beacon (`hud.region`, `region-change`, `beacon-ping`, a gentle tide toward matter)
  and **capture** by a far larger black hole (4x to 300x your mass) replace the old world wall. Ordinary wells never pull the player harder than 0.85 of its thrust, so only capture can be inescapable. The capture radius is `max(6 x the hole's radius, 40 x your radius)` so a fast player always gets a few seconds of warning. The pull tapers out at twice that radius, so notice comes early; the level starts rising at pull 0.05 of your thrust,
  escape stays possible until level ~0.75; level 1.0 emits `death { cause: 'captured' }` and the Event Horizon ending.

## Physics (research section 2)

- Mass is a scalar, `radius = 10 sqrt(mass)`, `mu = Omega0^2 R^3` (`gravity.surfaceRate`). Bodies with mass >= 80 are wells.
- Free bodies and the player feel softened, range-limited gravity (`a = mu d / (d^2 + eps^2)^1.5`, `eps = 0.6 R`) from heavier
  wells (including static far wells outside the loaded set, so nothing pops in at the load radius).
- **Player:** thrust accel in player radii (as in 2D), no drag. Two labelled **stabiliser** assists (both off while in a bound
  orbit): a *lateral* damper while thrusting (sideways velocity decays at 2.0 to 1.2 per second, so the craft follows the stick
  instead of orbiting its target; speed along the thrust axis keeps its inertia) and an auto-*brake* when there is no input
  (relative to the dominant well, weaker at late stages), strong on Space. Thrust cannot add speed past the soft cap; gravity can (slingshots).
- **Absorb:** prey is scooped with the old range-limited pull, absorbed on contact. Efficiency falls from 0.55 (gentle, relSpeed
  <= escape speed) to 0.30 (>= 6x), the rest becomes a few `debris` bodies. Momentum is conserved; off-centre contact feeds `spin`.
- **Hurt/bounce/lethal:** same rules as 2D (ratio 1.2 with 5 % hysteresis, grace 0.85, 1.2 s invulnerability, >= 3x kills),
  but the bounce is a momentum exchange with a minimum separation speed.
- **Body-body impacts:** heavier absorbs a >= 5x lighter body (gentle) or crushes it (hard, with debris); comparable bodies
  bounce inelastically, or shatter into fragments above `impact.shatterEnergy`. `impact` events carry energy relative to binding energy.
- **Roche:** a prey 10 to 50 times lighter that enters the limit of its primary becomes `state: 'disrupting'`, sheds
  `fragment` bodies that spiral in and are absorbed one by one. A body >= 10x heavier does tidal damage to the player (`victim: 'player'`, 0.25x at the edge of the limit up to 1x at contact, 0.18 health/s).
- **Atmospheric entry (R6):** only meteorite/asteroid/comet/debris, only inside a host shell, only above
  `entryMinSpeed` (a fraction, 0.6, of the host's surface escape speed). Sets `entry`, emits entry/exit, drag and ablation.
- **Near misses, slingshots** (gravity work of the dominant well), **orbit acquired/lost**, **pulsar beam** sweeps, **capture**.
- **Chase AI:** stage >= 3, threats heavier than 1.2x that are free field bodies (not rail members) pursue within 30 radii
  using bounded acceleration toward a desired velocity (same knobs as 2D `CONFIG.chase`), on top of the same gravity.

## Pacing (target: a full run of about 13-16 minutes)

The universe is scale invariant (equal mass per area per level), so growth is exponential at every stage. Raw density alone
makes run length swing with seed and skill, so `CONFIG.pace` adds a gentle, explicit governor: absorb gains are multiplied by
`((expected + delta) / (logProgress + delta)) ^ power` (expected = time in stage / `targetStageTime`, 95 s), clamped to [0.04, 3]. A player who is
ahead of the schedule gains less, one who is behind gains more. Turn it off with `config: { pace: { enabled: false } }` (the pace test
does this with `--set pace.enabled=false`). `node tests/sim.pace.mjs` reports per-stage times with the bot.

## Emitters

`body.emissive` is set only by `body.js:updateEmissive` from the table in `classes.js:EMITTER_ALLOWED` (identical to contract 2.1).
`validateEmissive(body)` returns a reason string for any violation; `tests/sim.emitters.test.mjs` runs it on every body of
natural runs and forced scenarios. Ablation only while `entry != null`, `hot-ground` only for `variant === 'lava'`, `jet` only
while `feeding > 0`. Thrust never emits anything.

## Notes for ENG / UI / SND

- `state.key.dir` points **from the player toward the light** (unit vector, slight upward y).
- Rebase threshold is `max(CONFIG.rebaseDistance, CONFIG.rebaseRadii x player radius)` so that late-game giants do not rebase every step.
- `state.bodies` objects are live and reused; positions are origin-relative. Extra underscore fields are internal.
- Optional extra: `sim.setOptions({ trajectory: true })` enables `hud.trajectory` (the contract leaves the switch unspecified).
- `createSim()` with no seed picks one from `crypto.getRandomValues` (the only entropy point); pass a seed for determinism.
- `sim.debug`: `CONFIG`, `universe`, `teleport(abs)`, `spawnBody`, `clearBodies`, `setLoaderEnabled`, `setPlayer` for tests and tuning.
