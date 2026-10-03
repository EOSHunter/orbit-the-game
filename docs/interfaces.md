# Interfaces: the single contract for the 3D rebuild of *Vesper Drift*

**Contract version: 1.** Derived from `docs/space-realism-research.md` §6 (plan and decisions). Five agents code against this file in parallel: **Creative Director (CD)**, **Sound Designer (SND)**, **UI Designer (UI)**, **Engine/3D/Renderer (ENG)** and **Simulation/Universe (SIM)**. Docs only; the signatures below are the contract, not implementation.

**Rules of this document**
- MUST/SHOULD are normative. Anything not specified is the owner's choice, but must not leak across a module boundary.
- Only the lead edits this file. A change needs a PR titled `contract change: ...` and a bump of the version above; owners rebase on it.
- Modules talk **only** through: (1) the **snapshot** (`sim.getState()`), (2) the **event bus**, (3) the **looks data** (`src/data/looks.js`), (4) the function signatures in §3-§7. No module imports another module's internals.
- Decisions inherited from the research doc (§6.8): Gas Planet = brown dwarf; movement is "gravitational steering" (no rockets, no exhaust); angled top-down camera plus a top-down toggle; no world wall (voids plus beacon; "Event Horizon" ending = captured by a larger black hole); Three.js via importmap with a vendored, pinned build; no Vite; the 2D renderer stays as a fallback.

---

## 1. Conventions

| Item | Rule |
|---|---|
| Language/modules | Vanilla JS ES modules, no build step, no npm runtime dependencies. Only `three` (vendored, ENG-owned) is allowed, and **only inside `src/render3d/`** |
| Units | Mass is a scalar. `radius = 10 * sqrt(mass)` (same as the 2D game's `CONFIG.radiusUnit`). Distances = world units; speeds = world units/s; time = sim seconds; angles = radians |
| Axes (Three.js convention) | `x` right, `y` up, `z` toward the viewer. **The play plane is x-z.** `y` is presentation depth only (small, within a few percent of the body radius) and never affects physics. "North" on the default camera is `-z` |
| Vectors | `[x, y, z]` plain arrays of float64 numbers |
| Floating origin | All positions in the snapshot and events are **relative to the current render origin** (the player is kept near `[0,0,0]`). Absolute position = `state.originAbs + p` (float64 add). SIM rebases when `|player.p| > CONFIG.rebaseDistance` (default 5000) by shifting every position and emitting `rebase` first. Consumers that cache positions (trails, particles) MUST subtract `shift` on `rebase` |
| Sim step | Fixed `1/120 s`. ENG owns the accumulator loop (max 12 steps/frame, frame gap clamped to 0.25 s, paused when the tab is hidden), and calls `sim.step(1/120)` |
| Determinism | SIM uses no `Math.random`, no `Date`, and no iteration-order-dependent code. Same `seed` + same inputs => same universe and same run. Visual-only randomness (particles) lives in ENG and may use `Math.random` |
| Ids | `id: number`, a 53-bit-safe integer. Stable for a body across load/unload |
| Hex colours | `'#RRGGBB'` strings |
| Frame budget | 16.6 ms total at 60 fps (research §4.6). SIM <= 4 ms per frame, ENG JS <= 2 ms, all allocation-free in the steady state where practical |
| Read-only snapshot | `getState()` returns the **same object every call**, mutated in place each step. Consumers MUST NOT write to it or keep references to `bodies[i]` across frames (use `id`) |

---

## 2. Shared data shapes

### 2.1 Body classes (`cls`) and the no-fire / emitter rules (normative)

`cls` is one of: `meteorite`, `asteroid`, `comet`, `dwarfPlanet`, `rockyPlanet`, `gasGiant`, `brownDwarf`, `star`, `neutronStar`, `blackHole`, `debris`, `fragment`.

Stage -> player `cls`: `meteorite`->meteorite, `asteroid`->asteroid, `dwarf_planet`->dwarfPlanet, `rocky_planet`->rockyPlanet, `gas_giant`->gasGiant, `gas_planet`->brownDwarf, `dwarf_star|star|giant_star|supergiant_star`->star (with `starClass`), `neutron_star`->neutronStar, `black_hole`->blackHole. Other bodies take the cls matching their own mass (as in the 2D game's `stageOf(mass)`).

**Emitter whitelist.** `body.emissive` is `null` or `{ cause, intensity }`. `cause` MUST be one of the values allowed for that `cls`; nothing else may glow, burn, or trail:

| `cls` | Allowed `emissive.cause` | Notes |
|---|---|---|
| meteorite, asteroid, debris | `impact-flash` (transient, ms), `ablation` (only while `body.entry != null`) | **No thruster flame, no heat rim, no halo, ever** |
| comet | as above, plus none else | Coma/tail is a **non-emissive** dust/ion effect and only near a star (`body.coma` 0..1 set by SIM) |
| dwarfPlanet | `impact-flash` | Airless ones: no limb glow |
| rockyPlanet | `hot-ground` only when `variant === 'lava'`; `impact-flash` | Atmosphere scatter is a **lit** effect, not emission |
| gasGiant | none | Soft haze limb is scatter, not emission |
| brownDwarf | `stellar-remnant` (very dim, deep red) | |
| star | `star` | |
| neutronStar | `stellar-remnant`, `pulsar-beam` | |
| blackHole | `accretion`, `jet` (jet only while `feeding > 0`) | |
| fragment | `impact-flash`, and a cooling `hot-debris` ramp for a few seconds | |

**Enum `EmitterCause`:** `star | stellar-remnant | hot-ground | atmospheric-entry | ablation | impact-flash | hot-debris | accretion | jet | pulsar-beam`. (`atmospheric-entry` is the only cause that may produce a fireball, and only when `entry != null`.)

**Enforcement.** SIM only sets `emissive` per this table (test: `tests/sim.emitters.test.mjs`). ENG renders emission **only** from `emissive`, `entry`, event-driven impact/debris effects and `looks`, and exposes `?debug=emitters` listing every emissive element with its cause. A thrust effect, if any, is a grey, non-additive dust mote spray (research R4) and carries no `emissive`.

### 2.2 `Body`

```js
Body {
  id: number,
  cls: BodyCls,                       // §2.1
  stageId: string,                    // stages.js id matching this body's own mass
  starClass?: 'dwarf'|'main'|'giant'|'supergiant',   // cls === 'star'
  variant: string|null,               // 'terrestrial'|'lava'|'metallic' | 'ringed'|'storm'|'ice' | 'yellow'|'red'|'blue' | 'rubble'|'monolith'|'iron'|... (open set; unknown => default look)
  seed: number,                       // uint32, drives all procedural looks
  rel: 'prey'|'neutral'|'threat'|'self',   // relative to the player, hysteresis as in the 2D game (ratio 1.2, +-5%)
  mass: number, radius: number,
  p: [x,y,z], v: [x,y,z],             // origin-relative, float64
  spin: { axis: [x,y,z], rate: number, phase: number },   // rad/s and current angle (game-time scaled)
  temperatureK: number|null,          // stars, remnants; blackbody colour source
  atmosphere: { density: number, shellHeight: number }|null,   // density 0..1; colour comes from looks, not SIM
  ring: { inner: number, outer: number, tilt: number }|null,   // multiples of radius
  emissive: { cause: EmitterCause, intensity: number }|null,   // §2.1
  entry: { hostId: number, intensity: number }|null,           // atmospheric entry in progress (rule R6)
  feeding: number,                    // 0..1, black hole recently fed (jet/disc flare)
  coma: number,                       // 0..1, comet outgassing near a star
  beam: { phase: number, period: number, width: number }|null, // neutron-star pulsar beam
  parentId: number|null, onRails: boolean,
  state: 'alive'|'disrupting'|'absorbing',
  disrupt: { progress: number, axis: [x,y,z], stretch: number }|null, // Roche tidal disruption (0..1)
  absorbT: number                     // 0..1 while 'absorbing' (being pulled into the player)
}
```
The player is a `Body` with `rel: 'self'` plus `health` (0..1), `invuln: boolean`, `thrust: [x,z]` (actual applied, normalised -1..1).

### 2.3 `State` (what `sim.getState()` returns)

```js
State {
  // legacy-compatible superset (the old 2D UI reads these)
  status: 'title'|'playing'|'choice'|'ended'|'paused',
  time: number,                       // sim seconds since run start
  mass: number, stageIndex: number, stageId: string,
  progress: number,                   // 0..1 toward the next stage
  health: number,                     // 0..1
  flags: object,                      // same flags as stages.js (speedMult, damageResist, absorbBonus, trajectory, planetType, ...)
  stats: { absorbed, hits, elapsed, maxMass, nearMisses, disruptions },
  deathCause?: 'collision'|'captured',     // legacy 'boundary' is no longer produced

  // new
  seed: string, genVersion: number,
  originAbs: [x,y,z],                 // float64 absolute position of the render origin
  player: Body & { health, invuln, thrust },
  bodies: Body[],                     // near field, <= CONFIG.maxNearBodies (default 300), excludes the player
  far: FarField,                      // impostors for the far field (below)
  sky: { seed: number, level: number, density: number },   // backdrop parameters
  key: { dir: [x,y,z], temperatureK: number, intensity: number, hostId: number|null }, // the single hard key light (research R8)
  hud: Hud
}

FarField {                            // struct-of-arrays, no per-frame allocation
  count: number,
  p: Float32Array,                    // 3*count, origin-relative
  size: Float32Array,                 // radius
  cls: Uint8Array,                    // index into CLS_LIST (exported by sim)
  seed: Uint32Array,
  temp: Float32Array                  // temperatureK or 0
}

Hud {                                 // sensor summary; UI and audio read ONLY this, never `bodies`
  speed: number, speedMax: number, escapeSpeed: number|null,   // relative to the dominant well, if any
  thrust: number,                     // 0..1 magnitude
  gravityDepth: number,               // 0..1 how deep in a well
  proximity: { star: number, blackHole: number, pulsar: number },   // 0..1, 0 = far
  inAtmosphere: boolean, atmosphereDensity: number,
  nearestThreat: { id, cls, bearing, dist, gap, ratio }|null,       // bearing = atan2(dx, -dz) rad, 0 = north
  nearestPrey:   { id, cls, bearing, dist, gap, ratio }|null,
  markers: Array<{ id, rel, cls, bearing, dist, p:[x,y,z] }>,       // up to 12, for edge/radar markers
  region: { inVoid: boolean, density: number, nearestMatter: { dist: number, bearing: number }|null },   // boundary replacement
  capture: { level: number, hostId: number|null }|null,            // 0..1 toward being captured by a larger black hole
  orbit: { hostId: number, hostCls: string, period: number, altitude: number }|null,
  trajectory: Float32Array|null,      // predicted path, 3*N origin-relative points, null when disabled
  beaconAudio: { pulsar: number }     // reserved
}
```
Legacy fields **removed**: `bounds`, `edge`, `edgeDoom`, `effects`. New code MUST NOT read them. (The old 2D stack keeps its own state; see §9.)

### 2.4 Looks data (`src/data/looks.js`, owner CD, data only)

```js
export const LOOK_VERSION = 1;
export function getLook(cls, stageId, seed, variant): Look;
export const PRESETS: {
  exposure: { day: number, deepSpace: number, adaptSeconds: number },
  bloom: { threshold: number, strength: number, radius: number },
  camera: { pitchDeg: number, fovDeg: number, distanceFactor: number, topDownPitchDeg: number },
  stages: { [stageId]: { skyTint: [hex,hex], keyColorK: number, keyIntensity: number, ambient: hex, ambientIntensity: number } },
  relation: { prey: hex, neutral: hex, threat: hex }       // HUD/outline colours only, never applied to lit materials
};
Look {
  palette: { base: hex, accent: hex, shadow: hex, extra?: hex[] },
  albedo: [min, max], roughness: number, metalness: number,
  craters: { density: number, sizeExp: number }|null,
  bands: { count: number, warp: number }|null,
  emission: { temperatureK: number, intensity: number, cause: EmitterCause }|null,   // must satisfy §2.1
  atmosphere: { tint: hex, thickness: number, mie: number }|null,
  extras: object                       // class-specific numbers named in docs/material-spec.md
}
```
`getLook` is pure and deterministic. Until CD ships it, ENG uses its own `src/render3d/fallback-looks.js` with the same shape; the swap is one import.

---

## 3. Event bus (SIM emits; ENG, SND, UI consume)

**API (`src/sim/events.js`):** `createBus() -> { on(type, fn) -> off, off(type, fn), emit(type, payload) }`. `'*'` subscribes to all. Handlers run **synchronously** in the emitting step; they MUST be cheap and MUST NOT mutate the payload, throw, or call back into the sim. `sim.events` is the one bus. Positions in payloads are in the **origin frame at emit time** (`rebase` is always emitted first). `rel` values as in §2.2.

| Event | Payload | Emitted when | Main consumers |
|---|---|---|---|
| `run-start` | `{ seed, genVersion, stageId }` | Run begins/restarts | SND (reset), ENG (reset), UI |
| `status` | `{ status, prev }` | State machine change | UI, SND |
| `rebase` | `{ shift: [x,y,z] }` | Floating-origin shift | ENG (shift caches) |
| `absorb` | `{ bodyId, cls, mass, gained, ratio, relSpeed, p, dir: [x,y,z], chain: number, tde: boolean }` | Player absorbs a body (`ratio` = prey mass / player mass; `chain` counts absorbs within 1.5 s; `tde` = stage-11 star absorb) | SND, ENG (spiral/flash), UI (gain toast) |
| `hit` | `{ bodyId, cls, damage, strength, relSpeed, p, normal: [x,y,z], health, lethal }` | A threat damages the player; `strength` 0..1 | SND, ENG (shake, debris), UI (vignette) |
| `bounce` | `{ bodyId, relSpeed, p, normal }` | Player touches a neutral or shallow-contact threat | SND, ENG |
| `impact` | `{ a: id, b: id, p, normal, energy, relSpeed, ejecta: number, nearPlayer: boolean }` | Collision **not** involving the player; `energy` 0..1 relative to the larger body's binding energy | ENG (flash/ejecta), SND (if `nearPlayer`) |
| `roche-disruption` | `{ phase: 'start'\|'end', bodyId, cls, mass, victim: 'prey'\|'player', p, fragments: number }` | A body crosses the Roche limit and is shredded (`start`) / fully consumed or dispersed (`end`). Progress is `body.disrupt.progress`. Fragments appear as `cls: 'fragment'` bodies | ENG (stretch, stream), SND (`body.tidal`), UI |
| `near-miss` | `{ bodyId, cls, rel, gap, relSpeed, p }` | A non-prey body passes within 1.5 * (rp + rb) of the player without contact (once per body per pass, >= 1.5 s apart) | SND (whoosh-as-felt-sweep), UI (score flavour) |
| `atmosphere-entry` | `{ bodyId, hostId, intensity, relSpeed, p }` | Rule R6 starts (player or a body within view) | ENG (fireball), SND (player only) |
| `atmosphere-exit` | `{ bodyId, hostId }` | Rule R6 ends | ENG, SND |
| `orbit-acquired` | `{ hostId, hostCls, period, p }` | Player becomes bound to a body | SND, UI |
| `orbit-lost` | `{ hostId }` | Bound orbit ends | UI |
| `slingshot` | `{ hostId, speedGain, p }` | Gravity assist gain above threshold | SND, UI |
| `choice-open` | `{ stageIndex, choices: [{ id, label, description }] }` | Milestone menu opens (`status` -> `choice`) | UI |
| `choice-picked` | `{ stageIndex, choiceId }` | After `sim.pickChoice` | SND, UI |
| `evolve` | `{ fromId, toId, fromIndex, toIndex, mass }` | Stage advance | ENG (pull-back, transition), SND, UI (banner) |
| `health-low` | `{ health }` | Health crosses 0.3 downward | SND, UI |
| `invuln-end` | `{}` | Post-hit invulnerability ends | SND |
| `region-change` | `{ inVoid, density }` | Player enters/leaves a void (**boundary replacement**) | UI, SND |
| `beacon-ping` | `{ dist, bearing }` | Every 6 s while in a void (HUD/sonar ping) | UI, SND |
| `capture-warning` | `{ bodyId, level, p }` | Capture level crosses 0.25/0.5/0.75/1.0 (**boundary replacement**: a larger black hole is pulling the player) | UI, SND, ENG (lensing intensity) |
| `capture-clear` | `{ bodyId }` | Player escapes | UI, SND |
| `pulsar-beam` | `{ bodyId, p, intensity }` | A pulsar beam sweeps past the player (rate-limited) | SND, ENG |
| `death` | `{ cause: 'collision'\|'captured', killerId, killerCls, p }` | Player dies; slow-motion begins | SND, ENG, UI |
| `ending` | `{ kind: 'death'\|'eventHorizon'\|'finale', ending: object\|null }` | `ending` is the `getEnding(state)` result from `stages.js` | UI, SND |

`death.cause === 'captured'` maps to `flags.ending = 'eventHorizon'` (the "Event Horizon" ending is kept). Events not listed MUST NOT be emitted without a contract change. Consumers MUST ignore unknown events and unknown payload fields.

---

## 4. Module: Simulation / Universe (SIM)

**Owns (exclusive write):** `src/sim/**`, `src/stages.js` (additive changes only; existing exports unchanged: `STAGES`, `ABANDON_ID`, `CHOICE_STAGES`, `getStageIndex`, `getStage`, `getChoicesFor`, `applyChoice`, `getEnding`; the `deathCause` comment gains `'captured'`), `tests/sim.*.test.mjs`, `tests/stages.test.mjs`.
**Must not import:** DOM, Three.js, Web Audio, anything from `src/render*`, `src/ui`, `src/audio`. Runs in Node for tests.

```js
// src/sim/index.js
export const CLS_LIST: string[];                         // index -> BodyCls for FarField.cls
export function createSim(opts: {
  seed?: string,                                          // default: random, reported in state.seed
  stages?: typeof STAGES,                                 // default: ../stages.js
  config?: Partial<CONFIG>,                               // overrides, for tests/tuning
}): Sim;

Sim {
  events: Bus;
  getState(): State;                                      // §2.3, same object each call
  step(dt: number): void;                                 // fixed 1/120
  setInput(i: { x: number, z: number, stabilize: boolean }): void;  // x,z in [-1,1], world-aligned (right, +z toward the viewer); magnitude = thrust fraction
  start(): void;                                          // title -> playing; emits run-start
  restart(seed?: string): void;                           // new run, state object reused
  pickChoice(id: string): void;                           // resolves a pending choice; no-op otherwise
  setPaused(p: boolean): void;
  exportSave(): { seed, genVersion, deltas: object, run: object };   // seed + consumed ids + knocked-off bodies + player
  importSave(s): boolean;
  debug: { CONFIG, universe, teleport(absPos: [x,y,z]) };   // for tuning from the console
}

// src/sim/config.js
export const CONFIG: {...};                               // every tunable (G, absorbEfficiency, pull, softening, rebaseDistance, maxNearBodies, levels...)

// src/sim/universe.js  (pure, deterministic; usable standalone in tests)
export const GEN_VERSION = 1;
export function createUniverse(seed: string): Universe;
Universe {
  query(center: [x,y,z], viewRadius: number, levelRange: [number, number]): { near: BodyDesc[], far: FarDesc[] };
  getRegion(absPos: [x,y,z], level: number): { density: number, inVoid: boolean, nearestMatter: { dist: number, bearing: number }|null };
  consume(id: number): void;
  exportDeltas(): object;  importDeltas(d: object): void;
}

// src/sim/rng.js
export function hash32(...ints: number[]): number;        // stable integer mix, order matters
export function makeRng(seed32: number): () => number;     // mulberry32/sfc32; [0,1)

// src/sim/events.js
export function createBus(): Bus;

// src/sim/fixtures.js   (FIRST deliverable, see §10)
export function makeFixtureState(stageId: string, opts?): State;       // valid, static State for UI/ENG development
export function makeFixtureEvents(): Array<{ type: string, payload: object }>;   // one of every event in §3
```

**Behaviour requirements**
1. **Infinite chunk universe.** Per research §3: hierarchical scale levels, cell content = pure function of `(seed, genVersion, level, cx, cz)` with a fixed draw order; density noise gives clusters, filaments and voids; systems (star > planets > moons, belts) are generated from sub-seeds and placed on **analytic Kepler rails**. No world boundary of any kind. Hysteresis load/unload; <= 2 ms generation per frame; stable ids.
2. **Physics** (research §2.3): free bodies integrate with softened gravity from the SOI body plus <= 8 nearest heavier bodies; rail bodies are demoted when hit and promoted when stable; non-player bodies are fully inertial; the player has a labelled stabiliser (`input.stabilize` and a perk-scaled auto-brake); momentum-conserving merges; absorb efficiency depends on `relSpeed` vs mutual escape speed (gentle = more mass; research §2.2); angular momentum goes to `spin`.
3. **Roche disruption** (research §2.4): bodies with mass ratio >= `CONFIG.roche.minRatio` (default 10) entering the Roche limit become `state:'disrupting'` and shed `fragment` bodies that spiral in and are absorbed individually. A body >= ratio larger does the same to the player (`victim:'player'`, damage over time, readable).
4. **Chase AI** stays (stage >= 3 chasers, same knobs as the 2D `CONFIG.chase`), but it must be force-based and use the same gravity model.
5. **Boundary replacement** (research §3.5): no edge. `hud.region` and `beacon-ping`/`region-change` implement voids plus the beacon, with a gentle drift toward matter in voids. `capture` rises when the player is inside a much larger black hole's capture radius and escape is not possible, emits `capture-warning`, and at level 1 emits `death {cause:'captured'}`. Warnings begin early and escape is always possible until level ~0.75.
6. **Atmospheric entry** (rule R6): set `body.entry` and emit `atmosphere-entry/exit` only if `relSpeed > CONFIG.entryMinSpeed` and the body is inside the shell of a host with `atmosphere != null`.
7. **Emitters** follow §2.1 exactly; `key` is always the brightest nearby star (or a dim "galactic glow" key in deep space).
8. **Budgets and tests:** determinism (byte-identical cells after unload/reload), no overlap, memory flat over a 1e6-unit fly-through, momentum/energy conservation within tolerance, stable orbits over 1000 periods, emitters test, boundary-code-free (`grep -i boundary` returns nothing in `src/sim/**` outside comments).
9. The finale and `getEnding` flow of the 2D game is preserved (finale after 1.6x last-stage mass or 30 s).

---

## 5. Module: Engine / 3D / Renderer (ENG)

**Owns (exclusive write):** `index.html`, `src/boot.js` (new), `src/main3d.js` (new), `src/input3d.js` (new), `src/render3d/**`, `vendor/three/**`, the "3D" section of `docs/engine-notes.md`, and (until cutover) the 2D fire fix in `src/render/**` (§9).
**Must not import:** `src/sim/**` internals (except `import { createSim, CLS_LIST } from './sim/index.js'` in `main3d.js` only), `src/audio/**` or `src/ui/**` internals (only their public entry points, in `main3d.js` only). `src/render3d/**` imports only `three`, `src/data/looks.js` and its own files.

```js
// src/render3d/index.js
export function createRenderer(opts: { canvas: HTMLCanvasElement, looks?: LooksModule }): Renderer;

Renderer {
  init(): Promise<boolean>;                    // false => caller falls back to the 2D renderer
  attach(bus: Bus): void;  detach(): void;     // consumes §3 events for VFX/camera shake/transitions
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  drawFrame(state: State, dt: number): void;   // read-only; also advances visual-only particles
  setQuality(q: 'low'|'med'|'high'|'auto'): void;
  setOptions(o: { reducedMotion?: boolean, topDown?: boolean, readability?: boolean }): void;
  getView(): { project(p: [x,y,z]): { x: number, y: number, visible: boolean }, unproject(sx: number, sy: number): [x,y,z] /* on the y=0 play plane */, width: number, height: number };
  getStats(): { ms: number, drawCalls: number, triangles: number, bodies: number, quality: string, backend: 'webgl2' };
  dispose(): void;
}

// src/input3d.js
export function createInput(canvas, getView: () => ReturnType<Renderer['getView']>): { poll(): { x: number, z: number, stabilize: boolean }, dispose(): void };
  // mouse/touch: thrust grows with distance from the player's screen position; WASD/arrows; Space = stabilize

// src/main3d.js
export async function start3d(): Promise<void>;   // wires sim + renderer + audio + ui, owns the loop
```

**Three.js delivery (no build step).**
- Vendor a **pinned** Three.js build under `vendor/three/` (the whole `build/` directory, since recent releases split `three.module.js` and `three.core.js`, plus the specific `examples/jsm/` addons used, e.g. postprocessing). Record the exact version in `vendor/three/VERSION`. No CDN at run time.
- `index.html` contains:
```html
<script type="importmap">
{ "imports": {
  "three": "./vendor/three/build/three.module.js",
  "three/addons/": "./vendor/three/examples/jsm/"
} }
</script>
<canvas id="game"></canvas><div id="ui"></div>
<script type="module" src="./src/boot.js"></script>
```
- `boot.js` reads `?renderer=2d|3d` (default `2d` until cutover, then `3d`), feature-detects WebGL2, and dynamic-imports `src/main.js` (2D) or `src/main3d.js`. If `renderer.init()` returns false it falls back to `main.js`.
- Classic `WebGLRenderer` + GLSL in v1; keep shaders in isolated GLSL string modules under `src/render3d/glsl/` so a later WebGPU/TSL port is possible.

**Behaviour requirements**
1. Render from `state` only: near `bodies` (instanced per class, shader-driven procedural surfaces from `seed` and `looks`), `far` as instanced points/billboards, `sky` as a procedural skybox, a **single hard key light** from `state.key`, tiny cool ambient from `looks.PRESETS.stages`.
2. Camera: angled top-down chase (default pitch/FOV/distance from `PRESETS.camera`), distance proportional to `player.radius`, north-up, look-ahead along velocity, `topDown` toggle, pull-back on `evolve`. Camera-relative rendering: positions are already origin-relative, so convert float64 -> float32 only at upload. Reversed-Z or a logarithmic depth buffer. Cross-fade near/far impostors.
3. Post: HDR target, thresholded bloom, tone map, light vignette. Honour `reducedMotion` (also read `prefers-reduced-motion`).
4. Emission rules per §2.1 only; relation outlines (`PRESETS.relation`) are drawn in a HUD-style overlay pass, never in the lit materials; `?debug=emitters` overlay.
5. VFX from events: `absorb` (spiral/flash), `hit`/`impact` (flash + ballistic ejecta that cools white -> yellow -> orange -> red -> black, **no smoke, no flame**), `roche-disruption` (stretch + stream), `atmosphere-entry` (scripted fireball, only while `body.entry`), `capture-warning` (lensing strengthens), `evolve` (inhale, flash ring, morph, palette cross-fade), `death`.
6. Budgets and quality ladder per research §4.6; dynamic resolution scaling in `auto`.
7. `main3d.js`: wiring order each frame is `input.poll() -> sim.setInput -> sim.step * n -> renderer.drawFrame(state, dt) -> ui.update(state, renderer.getView()) -> audio.update(state, dt)`. Wire settings: `ui` `onSettings` -> `audio.setVolume/setMuted`, `renderer.setQuality/setOptions`. Wire `onUiSound` -> `audio.playUi`. First user gesture -> `audio.unlock()`.

---

## 6. Module: UI (UI)

**Owns (exclusive write):** `src/ui/**` (`index.js`, `ui.css`, `demo.html`, widgets), `docs/ui-direction.md`.
**Must not import:** `src/sim/**`, `src/render3d/**`, `src/audio/**`, Three.js. May import `src/stages.js` (read-only: names, `STAGES`) and `src/data/looks.js` (`PRESETS.relation`, palettes).
**Technology:** plain DOM + SVG + CSS (no canvas drawing for the HUD, no framework). Mounts into `#ui`. Respects `prefers-reduced-motion`; keyboard accessible; works at 1280x720 and 360 px wide.

```js
// src/ui/index.js  (replaces the 2D UI in place; the old signatures stay valid)
export function init(opts?: {
  root?: HTMLElement,                              // default #ui
  onUiSound?: (name: UiSound) => void,
  onSettings?: (s: Settings) => void,
}): void;
export function showTitle(onStart: () => void, opts?: { seed?: string }): void;
export function showChoice(choices: Array<{ id, label, description }>, onPick: (id: string) => void): void;
export function showEnd(ending: object|null, onRestart: () => void): void;
export function update(state: State, view?: { project, width, height }): void;   // every frame; must be cheap; tolerates missing hud/far/region (2D legacy state)
export function attach(bus: Bus): void;  export function detach(): void;          // toasts, stage banner, damage vignette, warnings from §3
export function getSettings(): Settings;
export function warnBoundary(on: boolean): void;                                 // DEPRECATED no-op, kept for the 2D build
export function hide(): void;  export function dispose(): void;

type UiSound = 'ui.click'|'ui.hover'|'ui.confirm'|'ui.back'|'ui.error'|'ui.open'|'ui.close'|'ui.choice.select'|'ui.choice.confirm'|'ui.stagebanner';
type Settings = { master: number, music: number, sfx: number, quality: 'low'|'med'|'high'|'auto', reducedMotion: boolean, readability: boolean, topDown: boolean, trajectory: boolean };
```
**Requirements:** HUD reads only legacy fields (`mass`, `stageIndex`, `stageId`, `progress`, `health`, `stats`, `flags`, `status`, `time`) plus `state.hud` and `state.seed`; widgets (mass/stage/progress, speed + escape speed, edge markers via `view.project`, region/beacon readout "NEAREST MATTER", capture warning, orbit readout) hide themselves when their data is absent. The `choice` menu pauses nothing itself (SIM does). Persist settings in `localStorage['vd.settings']` and call `onSettings` on load and change. Never play sounds directly; call `onUiSound`. No fire/ember imagery in HUD art. Relation colours come from `PRESETS.relation` or a local fallback.

---

## 7. Module: Sound (SND)

**Owns (exclusive write):** `src/audio/**`, `docs/audio-direction.md`, `tests/audio.test.mjs` (pure-function parts only).
**Must not import:** anything except its own files (it receives the bus and state by argument). **Web Audio only; no asset files; fully synthesised.**

```js
// src/audio/index.js
export function createAudio(opts?: { context?: AudioContext }): Audio;

Audio {
  unlock(): Promise<void>;                           // create/resume the AudioContext; call from a user gesture
  attach(bus: Bus): void;  detach(): void;           // subscribes to §3 events
  update(state: State, dt: number): void;            // every frame: continuous layers from state.hud, mass, stageId, health, status
  playUi(name: UiSound): void;                       // UI owner calls via onUiSound
  setVolume(v: { master?: number, music?: number, sfx?: number }): void;   // 0..1
  setMuted(m: boolean): void;
  setStage(stageId: string): void;                   // also driven by `evolve` and `run-start`
  getStats(): { voices: number, peakDb: number };
  dispose(): void;
}
```
**Requirements**
1. Sound design per research §5: the player's body is heard as felt/structure-borne low-frequency sound; UI is clean and non-diegetic; fields, pulsar and black hole are sensor sonification; **air sounds only when `hud.inAtmosphere`** (and for `atmosphere-entry`). No engine roar, no explosion heard through vacuum.
2. Every event in §3 has a defined sound or an explicit "silent" decision documented in `audio-direction.md`. Continuous layers: `thrust` (felt rumble from `hud.thrust`), `gravity.well` (`hud.gravityDepth`), `star.proximity`, `blackhole.proximity` (sub-bass that slows and drops with proximity), `pulsar` (from `pulsar-beam`), ambience bed per `stageId` with cross-fade on `evolve`.
3. Pitch/filter scale with mass and stage by continuous functions (bigger = lower), not twelve hand-made sets.
4. Polyphony cap (24-32), voice stealing by priority, rate-limiting of repeated events (e.g. `absorb` chains collapse to a granular texture using `chain`). Master limiter, peak below -1 dBFS, no clicks (all gains ramped).
5. Silent until `unlock()`. Starts muted-safe: never throws if the context is blocked; every method is a no-op until unlocked.
6. A `demo.html` is allowed at `src/audio/demo.html` that drives `createAudio` from `makeFixtureEvents()` and `makeFixtureState()` (from `src/sim/fixtures.js`, read-only import in the demo only).

---

## 8. Module: Creative Director (CD)

**Owns (exclusive write):** `docs/art-bible.md`, `docs/material-spec.md`, `src/data/looks.js`, `docs/creative-direction.md` (may revise for 3D; keep a "2D legacy" section).
**Produces no engine code.** `looks.js` is pure data plus the pure function `getLook` of §2.4 (no DOM, no Three.js, no randomness except a seeded hash of its own arguments).

- **`docs/art-bible.md`:** the 3D look for all 12 stages and variants (surface, palette, lighting, atmosphere, scale feel), the single-hard-sun lighting rule, the emitter table filled in per stage with `cause` (rules R1-R10 of the research doc are binding), camera and composition guidance, transitions, relation (prey/neutral/threat) readability strategy that does not break realism, and an accessibility pass (contrast, reduced motion).
- **`docs/material-spec.md`:** per-`cls` shader/material spec ENG implements: inputs (`seed`, `Look` fields, `state.key`), noise recipes and ranges (displacement, craters with power-law sizes, bands/domain warp, granulation, limb darkening, blackbody ramp as a function of `temperatureK`), uniform names and semantics, LOD tiers by on-screen size, atmosphere shell model, ring/disc/jet/beam models, lensing model, and performance cost notes. Numeric defaults live in `looks.js`, not in the prose.
- **Deadlines drive the order (§10):** `looks.js` skeleton (schema + the 12 stage presets) first, so ENG can swap off its fallback early.

---

## 9. Old 2D modules: replaced or kept during the transition

| Old path | Fate | Owner of the change |
|---|---|---|
| `src/main.js`, `src/game.js`, `src/world.js`, `src/physics.js`, `src/camera.js`, `src/input.js`, `src/dev-stubs.js` | **Kept untouched** as the self-contained 2D build until cutover; **deleted at cutover** (Phase 4) | ENG (deletion only, after lead sign-off) |
| `src/render/**` (2D canvas renderer) | **Kept** as the `lite` fallback through cutover; receives only the fire fix below. Deleted in Phase 4 unless the lead decides to keep a lite mode | ENG |
| `src/ui/**` | **Replaced in place** by UI. Public functions of the old UI (`showTitle`, `showChoice`, `showEnd`, `update`, `warnBoundary`) keep their signatures, so the 2D build keeps working with the new UI | UI |
| `src/stages.js` | **Shared and kept**; used by both stacks; additive changes only | SIM |
| `tests/stages.test.mjs` | Kept | SIM |
| `index.html` | Becomes the importmap + `boot.js` entry (still starts the 2D build when `?renderer=2d`) | ENG |
| `docs/engine-notes.md` | 2D section kept as history; a "3D" section is added | ENG |

**Switch.** `boot.js` chooses the stack with `?renderer=2d|3d`. Until Phase 3 the default is `2d`; at cutover the default flips to `3d` with automatic fallback to `2d` if WebGL2 is missing or `renderer.init()` returns false. `window.__orbit` stays on the 2D build; the 3D build exposes `window.__vd = { sim, renderer, audio, ui }`.

**2D fire fix (NOTE ONLY, no code here; owner ENG, done in Phase 0).** The "asteroids show fire" bug comes from `thruster: true` on stages 0-3 in `src/render/palette.js`, which drives `emitThrust()` (warm streak particles) and the orange `#FFB067` leading-edge "heat" arc in `src/render/index.js`, plus warm additive glows from `glowsFor()` in `src/render/bodies.js`. Fix: set `thruster: false` for stages 0-3; delete the leading-edge heat arc; replace the thrust streaks with grey non-additive regolith motes or nothing; remove warm additive glow from airless looks (keep lava emission only for the `lava` variant, cause `hot-ground`); add a comment table of emitter causes per research R2. Acceptance: no warm additive element is drawn on any airless body at any speed.

---

## 10. Order of work and parallelism

Everything below the "Step 0" row runs **in parallel** against fixtures and stubs; the only hard ordering is where "blocks" is stated.

| Step | SIM | ENG | UI | SND | CD |
|---|---|---|---|---|---|
| **0 (day 0, small)** | **S0: ship `src/sim/events.js`, `rng.js`, `fixtures.js`, `CLS_LIST` and the `State` shape as real code**; this unblocks everyone's mocks. Blocks: UI, SND, ENG integration (not their start) | **E0: 2D fire fix (§9)**; vendor Three.js, `index.html` importmap, `boot.js`; empty `render3d` that draws one lit asteroid from a fixture | U0: HUD on `makeFixtureState` (or a local mock matching §2.3 until S0 lands) | A0: audio graph, buses, limiter, 10 core sounds, `demo.html` | C0: `looks.js` skeleton (schema, `PRESETS`, 12 stage presets) and the art-bible outline |
| **1 (parallel)** | S1: universe core (cells, levels, density, determinism tests); S2: physics core (gravity, rails, momentum, collisions, absorb) | E1: instanced procedural bodies for all `cls`, camera B, post, skybox, floating-origin handling, LOD, quality ladder | U1: all screens, settings persistence, edge markers, region/beacon, capture warning | A1: all events of §3, continuous layers, ambience beds | C1: full art bible, `material-spec.md`, final `looks.js` |
| **2 (needs S1+S2 for real data)** | S3: Roche disruption, chase AI, boundary replacement, atmospheric entry, save/deltas; balance pass of `CONFIG` | E2: `main3d.js` integration with the real sim, VFX from events, transitions (needs S3 events) | U2: polish with real state | A2: tuning with real events | C2: review of ENG output against the art bible (visual QA notes only) |
| **3** | Playtest balance with ENG | Performance pass vs research §4.6; cutover flag default `3d` | Accessibility pass | Mix pass | Final sign-off |
| **4** | | Delete old 2D modules per §9 (after lead sign-off) | | | |

**Dependencies in one line:** S0 -> everything's integration; S1+S2 -> E2 (real data) and A2/U2 (real state); C0/C1 -> E1 look fidelity (ENG uses `fallback-looks.js` until then); S3 -> E2 VFX for Roche/entry/capture. UI, SND and CD do not depend on ENG's renderer at all.

---

## 11. File ownership map (no overlaps)

| Path | Owner |
|---|---|
| `src/sim/**`, `src/stages.js`, `tests/sim.*.test.mjs`, `tests/stages.test.mjs` | SIM |
| `src/render3d/**`, `vendor/three/**`, `index.html`, `src/boot.js`, `src/main3d.js`, `src/input3d.js`, `src/render/**` (fire fix and deletion), old `src/main.js`/`game.js`/`world.js`/`physics.js`/`camera.js`/`input.js`/`dev-stubs.js` (deletion at cutover), `docs/engine-notes.md` | ENG |
| `src/ui/**`, `docs/ui-direction.md` | UI |
| `src/audio/**`, `docs/audio-direction.md`, `tests/audio.test.mjs` | SND |
| `docs/art-bible.md`, `docs/material-spec.md`, `src/data/looks.js`, `docs/creative-direction.md` | CD |
| `docs/interfaces.md`, `docs/space-realism-research.md`, `README.md`, `package.json` | Lead only |

Cross-module wiring happens in exactly one place: `src/main3d.js` (ENG). It is the only file allowed to import from more than one module's public entry point.

## 12. Shared definition of done and top risks

**Done (all):** works with the contract only (no private imports); no `Math.random` in SIM; no allocation in per-frame hot paths where avoidable; documented in the owner's doc file; runs from `npm start` with no build step; passes the owner's tests.
**Top risks and the contract's answer:**
- *Interface drift* -> single file, version number, fixtures from S0, unknown-field tolerance.
- *Float precision across scales* -> floating origin in SIM, camera-relative upload in ENG, `rebase` event.
- *Readability in 3D* -> relation colours confined to the HUD overlay; `topDown` and `readability` settings.
- *Gravity feel* -> `CONFIG` knobs and the stabiliser in SIM; tuning via `sim.debug`.
- *Merge conflicts* -> exclusive ownership (§11); only `main3d.js` wires modules.
- *Performance* -> budgets in §1; ENG quality ladder and 2D fallback.
