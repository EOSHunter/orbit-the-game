# Engine notes

Vanilla JS ES modules + HTML5 canvas. No build step, no dependencies.

## Run

ES modules do not load from `file://`, so use any static server from the repo root:

```
npm start            # node tools/serve.mjs 8000 (zero-dependency) -> http://localhost:8000/
# or: python -m http.server 8000
```

Steer with the mouse (thrust grows with the cursor's distance from the player) or WASD / arrows. Esc pauses,
1-4 pick an evolution card.

`src/main.js` imports `src/stages.js`, `src/render/index.js` and `src/ui/index.js` and checks every expected
export. If a module fails to load or an export is missing, the page shows a readable error listing what is
wrong (and logs it) instead of a blank canvas. The old `src/dev-stubs.js` fallback has been removed.

## Tests and tools

| Command | What it does |
|---|---|
| `node tests/stages.test.mjs` | Unit tests for stages, choices and endings |
| `node tests/pace.mjs` | Headless pacing simulation: real engine + a bot, no DOM. Prints time to reach each stage, first-minute stats and endings; exits 1 if the pacing targets are missed |
| `node tests/smoke.mjs` | Browser smoke test: serves the repo, drives headless Chrome/Edge over the DevTools protocol, plays through title, steering, pause, absorb, hit, choice keys, boundary, both deaths, restart, all 12 stages and the finale, and fails on any console error. `BROWSER=/path/to/chrome` picks a browser, `--shots dir` saves screenshots |
| `npm test` | `stages.test.mjs` + `pace.mjs` |
| `npm run test:smoke` | `smoke.mjs` |

`pace.mjs` options: `--runs N`, `--seed S`, `--immortal` (pure pacing, no deaths), `--sloppy` (human-ish bot: re-aims
every 0.3 s and notices threats late), `--verbose`, and `--set path=value` to override any `CONFIG` value for a
sweep, e.g. `--set absorbEfficiency=0.2 --set chase.enabled=false`. Runs are deterministic per seed.

## Files

| File | Role |
|---|---|
| `src/main.js` | Module loading + export check, canvas/camera/input setup, pause wiring, the loop |
| `src/game.js` | State machine, collisions, evolution + choices, perk flags, boundary, endings |
| `src/world.js` | State creation, spawn/despawn around the player, drift + chase AI |
| `src/physics.js` | **`CONFIG` (all tunables)**, mass/radius, player movement, bounce |
| `src/camera.js` | Follow + zoom camera and world/screen helpers (screen shake lives in the renderer) |
| `src/input.js` | Keyboard + pointer steering |
| `tools/serve.mjs` | Zero-dependency static server (`npm start`; also used by the smoke test) |

## The loop

`main.js` runs `requestAnimationFrame` with a fixed 1/120 s simulation step and an accumulator (max 12 steps
per frame, frame gaps clamped to 0.25 s, paused while the tab is hidden). Each frame: `game.step(1/120)` as many
times as needed, then `game.render(dt)` = `renderer.drawFrame(state, camera, dt)` then `ui.update(state)`.
There is no interpolation between steps, so the renderer sees the latest step.

**Pause** is owned by the UI: `ui.onPause(cb)` is wired to `game.setPaused`. While paused, `main.js` stops calling
`game.step` and renders with `dt = 0`, which freezes effects and particles. Hiding the tab mid-run opens the pause
menu (`ui.setPaused(true)` + `game.setPaused(true)`), so the player comes back to a paused game.

`game.step` by `state.status`:

- `title`: world drifts, nothing can hurt the player, camera is zoomed out. `ui.showTitle(onStart)` starts a run.
- `playing`: steer, move, update world (drift + chase), collide, grow, stage check, boundary, finale check.
  Hit-stop and the death slow-motion scale only the world, not the camera.
- `choice`: world runs at 15% speed, collisions are off. `ui.showChoice(choices, onPick)`; picking (click or keys 1-4)
  calls `applyChoice(state, id)` and resumes play.
- `ended`: `ui.showEnd(ending, onRestart)`; restart begins a new run (state object is reused, mutated in place).

## Rules implemented

- **Units.** Mass is the single scalar. `radius = 10 * sqrt(mass)` (`CONFIG.radiusUnit`). The player starts at mass
  `CONFIG.startMass` = 1, so **`stages.js` `minMass` values must be in the same units** (stage 0 may use 0 or 1).
  Gain per absorb = `prey.mass * CONFIG.absorbEfficiency * (1 + flags.absorbBonus)`; efficiency is 0.14 (see Pacing).
- **Speeds are in player radii per second**, so every stage feels the same; when the player grows, existing velocities are
  rescaled. The camera keeps the player about 26 px (at 1280x720) on screen.
- **Relative state.** Every body's `kind` is reclassified each step from the mass ratio with 1.2x and 5% hysteresis:
  `prey` (player >= 1.2x), `threat` (body >= 1.2x), else `neutral`. `kind` is relative, not a type.
- **Absorb:** prey is pulled in (range grows with stage) and absorbed on contact. **Hurt:** a threat touching deeper than
  the grace margin (centre distance < 0.85 x (rp + rb)) costs health and knocks the player back, then 1.2 s of
  invulnerability. Damage is scaled by `1 - flags.damageResist`. A body >= 3x mass kills outright (with resistance the
  lethal ratio becomes `3 / (1 - damageResist)`). Health regenerates after 3 s. Death shows an effect, slow-mo, then the ending.
  Neutral bodies and shallow threat contact just bounce (mass-weighted).
- **Chase AI** (`CONFIG.chase`, all knobs exposed): from stage 3, a growing share of threats are chasers. They pursue within
  `detectionRadius` (player radii), give up after `giveUpDelay` out of range, move slower the bigger they are, and are kept
  from stacking. At most `maxChasers` (3) chase at once; each chases for at most `maxChaseTime` (8 s) and then gives up for
  good; after any chaser gives up, no new chase starts for `respite` (12 s). Without the cap and respite the chasers never
  let go from stage 6 on, they fill the body budget, and growth stalls (stages took 3-5 min in the pace sim).
  Set `__orbit.CONFIG.chase.enabled = false` in the console to turn it off.
- **Boundary:** `state.bounds.radius` = 220 x player radius, measured at the larger of the stage's `minMass` and the
  player's current mass, easing outward (it never shrinks). Using the current mass matters: stage 0 alone spans 3x in
  mass, and sizing only by `minMass` left the spawn ring outside the arena late in a stage. The warning
  starts at 85% (`ui.warnBoundary(true)`, `state.edge` 0..1); outside the edge for 2.5 s ends the run as Event Horizon.
- **Evolution:** `getStage(player.mass)` is checked every step; the engine advances one stage at a time, calling
  `getChoicesFor(newIndex)`. If it returns options the game pauses for them. Evolve triggers `spawnEffect('evolve')`
  and a camera pull-back.
- **Finale:** after reaching the last stage, the run ends when mass reaches 1.6x that stage's `minMass` or after 30 s.
- **Endings:** the engine sets `state.deathCause` (`'collision'` | `'boundary'`, which `stages.js` `getEnding` reads) and
  flags, then calls `getEnding(state)`; a `null` result uses a built-in fallback. Flags set: `flags.death`
  (`'stellar-fragment'` | `'event-horizon'`), `flags.died`, `flags.eventHorizon`, `flags.finale`, and
  `flags.ending` (`'death'` | `'eventHorizon'` | `'finale'`).
- **Spawning:** body budget falls from 200 (stage 0) to 90 (last stage). Bodies spawn just outside the view and despawn
  beyond 2.8 view radii. Sizes are relative to the player's current radius, mixed by `stage.spawnMix`
  (`{prey, neutral, threat}` weights, or `[prey, neutral, threat]`; a default curve is used if absent or unrecognised).
  A body's `stageIndex` is the stage matching its own mass (`getStage(body.mass)`).

## Contracts other modules can rely on

`state` has everything in the shared contract, plus these engine extras: `effects`, `health` (0..1), `progress`
(0..1 toward the next stage), `edge` (0..1 into the boundary warning), `edgeDoom` (0..1 toward Event Horizon),
`stats` `{absorbed, hits, elapsed, maxMass}`, `deathCause` and `chaseRest`.

Perk flags the engine reads (set by `stages.js` `applyChoice`, all optional):

| Flag | Default | Effect in the engine |
|---|---|---|
| `flags.speedMult` | 1 | Multiplies player thrust **and** the speed cap (`stepPlayer`), so top speed scales with it |
| `flags.damageResist` | 0 | Damage x `(1 - resist)`, capped at `CONFIG.player.maxResist` (0.75); also raises the one-hit-kill ratio |
| `flags.absorbBonus` | 0 | Extra fraction of mass per absorb: gain x `(1 + absorbBonus)` |

The earlier stub-only flags `flags.armor` and `flags.absorbRange` were dropped, since nothing sets them any more.
If `applyChoice` edits `state.mass`, the engine adopts it.

`camera` (passed to `drawFrame`): `{x, y, zoom, width, height, scale, rotation}`. `x,y` is the world point at the
viewport centre (no shake: the renderer applies `getShake(state)` itself), `zoom` is CSS px per world unit, and
`width/height` are CSS px. Screen position = `(world - cam) * zoom + size / 2`. Helpers in `camera.js`: `worldToScreen`,
`screenToWorld`, `viewRadius`. The renderer owns DPR scaling and canvas sizing: it sizes the canvas when created and on
every `resize()` (called on window resize before the camera size is updated; the camera size comes from
`canvas.clientWidth/Height`). A restarted run (stage index going backwards) snaps the background and player look
instead of playing an evolve morph.

Effects: the engine only calls `spawnEffect(state, type, x, y, opts)` and trims `state.effects` to the newest 300; the
renderer ages and removes its own effects. Types and opts: `absorb` `{radius, mass, stageIndex, targetId, dx, dy, trauma}`,
`hit` `{radius, strength 0..1, damage: true, stageIndex}`, `evolve` `{radius, stageIndex, stage}`, `death`
`{radius, reason, stageIndex}`.

**Screen shake** belongs to the renderer only: `getShake(state)` sums each effect's `trauma` (the engine passes a
size-scaled `trauma` for absorbs; hit/evolve/death use the renderer's defaults). The engine's old camera trauma shake was
removed so the two never stack. Hit-stop (world slow-down on big impacts) is still done by the engine.

`window.__orbit` exposes `{game, state, camera, CONFIG, mod, renderer, ui}` for tuning from the console.

## Pacing

Measured with `node tests/pace.mjs --runs 12` (precise bot) and `--sloppy` (human-ish bot):

| | Precise bot | Sloppy bot |
|---|---|---|
| Full run (median) | 13:29 | 15:46 |
| Slowest stage (median) | ~1:55 (Neutron Star) | ~2:04 (Neutron Star) |
| First 60 s | stage 1, mass ~8, 0 deaths | stage 1, mass ~5, 0 deaths |
| Deaths | 0 / 12 | 1 / 12 (one-hit kill at stage 9) |

Stage 0 takes ~25-45 s and the rest ~40-115 s each, rising slowly as chasers appear. Before tuning, stages 1-4 took ~15 s
each, stage 0 ~40 s, and runs stalled at stages 5-7 behind permanent chasers. What changed:

- `CONFIG.absorbEfficiency` 0.4 -> 0.14. Spawns are relative to the player, so growth is exponential and this sets the
  per-stage time almost uniformly.
- `stages.js` `minMass` ladder: `0, 3, 12, 45, 170, 650, 2500, 10k, 38k, 140k, 500k, 1.8M` (was `0, 20, 80, ... 3.2M`).
  Stage 0 used to span 1 -> 20, about 2.6x the log range of any other stage; every stage now spans ~3.6-3.9x.
- Chase cap / stamina / respite (above), and `world.countLate` 60 -> 90 so late stages are not starved of prey.
- The arena grows with the player's current mass (above), which stopped spurious Event Horizon endings.

The bots barely get hit (0-1 hits per run), so the sims say little about how dangerous threats feel to a human. Tune
`CONFIG.collision`, `ratio.lethal` and the chase speeds from real playtests.

---

# 3D (Three.js renderer) — owner: ENG

Contract: `docs/interfaces.md` v1, section 5. Everything here runs with **no build step**: vanilla ES modules, an importmap, and a vendored Three.js.

## Run it

```
npx serve .                       # or any static server at the repo root
/index.html?renderer=3d           # the game (uses ./sim if present, otherwise ENG fixtures)
/index.html?renderer=2d           # the 2D build (default until cutover; flip DEFAULT_RENDERER in src/boot.js)
/src/render3d/demo.html           # renderer-only demo on fixture states, no SIM needed
   ?stage=<meteorite|asteroid|dwarf_planet|rocky_planet|gas_giant|gas_planet|dwarf_star|star|giant_star|supergiant_star|neutron_star|black_hole|gallery|entry>
   &quality=low|med|high   &topdown=1   &solo=1 (player only)   &fire=hit,impact,absorb,evolve,death,...   &hideui=1
   &debug=emitters         (works on every page that creates the renderer)
```

The demo panel has buttons for every stage, every contract event, top-down / readability / reduced motion / quality.

## Files (all ENG-owned)

| Path | What |
|---|---|
| `index.html`, `src/boot.js` | importmap + entry; `?renderer=2d|3d`, WebGL2 feature test, automatic fallback to `src/main.js` (fresh canvas element so a 2D context can be created) |
| `src/main3d.js` | the **only** cross-module wiring: sim + renderer + audio + ui, fixed-step accumulator (1/120, max 12 steps, 0.25 s clamp, paused when hidden), death slow-motion, settings wiring. Each of `sim/`, `audio/`, `ui/` is imported defensively; with no SIM it runs on fixtures |
| `src/input3d.js` | mouse/touch hold-to-thrust (strength grows with distance from the player's screen position), WASD/arrows, Space/Shift = stabilise, `T` toggles top-down |
| `src/render3d/index.js` | `createRenderer` (init/attach/detach/resize/drawFrame/setQuality/setOptions/getView/getStats/dispose, plus `getEmitters()` for tests) |
| `src/render3d/bodies.js` | per-frame body layer (instancing, pooled meshes, atmosphere shells, rings, glow, beams, black hole, relation outlines) |
| `src/render3d/glsl/*.js` | GLSL as string modules: `noise.js` (hash/value noise/fBm/ridged/Worley/craters/blackbody/sky), `rock.js`, `bodies.js` (planet, gas, star, atmosphere, ring, glow, beam), `misc.js` (black hole, sky, dots, particles, outlines, grade), `common.js` (lighting chunk) |
| `src/render3d/sky.js`, `dots.js`, `vfx.js`, `camera.js`, `util.js` | skybox, far-field points, event VFX, chase camera, helpers (incl. the **emitter whitelist**) |
| `src/render3d/fallback-looks.js` | same shape as `src/data/looks.js`; used only if `../data/looks.js` fails to import |
| `src/render3d/fixtures.js`, `demo.html`, `demo.js` | fixture `State`s (contract 2.3 shape) and the demo page |
| `vendor/three/` | Three.js **0.186.1** (`VERSION`): `build/three.module.js` + `three.core.js`, plus `examples/jsm/postprocessing` and `shaders` only. No CDN |

## Rendering design

* **Render from `state` only.** Nothing is written to the snapshot; bodies are tracked by `id`, never by reference across frames.
* **Rock family** (meteorite, asteroid, debris, fragment, comet, dwarf planet, airless/lava/metallic rocky planet) = one `ShaderMaterial` on three `InstancedMesh` LOD batches (`lo` icosphere 3, `mid` 7, `big` 24). Per-instance attributes carry seed, palette, crater density/size exponent, roughness, elongation/lumpiness, metalness, emission, eclipse occluders and Roche stretch. Shape = vertex displacement (elongated lumpy "potato"), surface = power-law crater field + fBm + derivative bump mapping, opposition surge, slope brightening, no specular on rock, hard terminator.
* **Few-and-large bodies** are pooled meshes with their own shaders: terrestrial planet (height > biome > ocean glint > ice > clouds), gas giant (latitude bands, domain warp, differential rotation, vortices, great storm), brown dwarf (same shader, plus the whitelisted `stellar-remnant` emission), star/neutron star (Worley granulation, limb darkening `I = 1-u(1-mu)`, spots, blackbody colour from `temperatureK`, soft corona sprite), black hole (below).
* **Black hole** = billboard that ray-marches Schwarzschild null geodesics (`a = -1.5 rs L^2 r^-5 x`, shadow radius = `body.radius`), crossing the disc plane for blackbody + Doppler beaming (`D^2.2`) accretion disc, secondary image over/under the shadow, lensed sky (cubemap + live star layer). Only the lensed/disc/shadow pixels are opaque. Disc is drawn only if `emissive.cause` is `accretion`/`jet`; jets are two additive cones only while `feeding > 0`. Capture level (`hud.capture`, `capture-warning`) widens the lens.
* **Atmosphere** = a shell sphere with a 7-sample single-scattering ray march (Rayleigh-leaning tint + Henyey–Greenstein Mie), lit by the key light, composed additively; it is *scatter*, listed nowhere as an emitter. Only drawn when `body.atmosphere != null`. If the camera is inside the shell it switches to back faces without depth test.
* **Rings** = annulus with radial opacity ramp and gaps, planet shadow on the ring (analytic), lit by the key light.
* **Light:** exactly one hard key light (`state.key`), colour from blackbody(`key.temperatureK`) × `looks.PRESETS.stages[stageId].keyIntensity` × `key.intensity`, plus a tiny cool ambient. Sphere-sphere eclipses (analytic, up to 2 occluders per large body). No shadow maps.
* **Exposure:** HDR (`HalfFloat`, MSAA 4 on `high`) → thresholded `UnrealBloomPass` → grade pass (vignette, hit chromatic aberration, death desaturation, evolve flash) → `OutputPass` (Khronos Neutral tone map). Exposure adapts between `PRESETS.exposure.day` and `.deepSpace` from `key.intensity` with `adaptSeconds`.
* **Sky** = nebula + dust baked **once** into half-float cubemaps (re-baked only when `sky.seed/level/density` or the stage tint changes; two cubes cross-fade over 2.5 s on `evolve`), plus a crisp `Points` layer of bright stars (deterministic from `sky.seed`).
* **Far field & tiny bodies** = one `Points` draw call (`dots.js`). `state.far` impostors fade out by projected size (2.5-7 px) while the near mesh takes over; near bodies under 1.25 px are drawn as dots instead of meshes.
* **Floating origin:** positions are origin-relative float64 → float32 at upload; the camera near plane is adaptive (`0.04 × distance`), so a plain 24-bit depth buffer is sufficient (no log/reversed Z needed). `rebase` shifts the camera target and every particle.
* **Camera:** north-up (`-z` is up), pitch/FOV/distance factor from `PRESETS.camera`, distance ∝ `player.radius`, look-ahead along velocity, damped auto-tilt (up when a threat is near, down when thrusting), `topDown` / `readability` toggle (pitch → `topDownPitchDeg`), pull-back + ~15° pitch bump on `evolve`, shake on `hit`/`impact`/`death` (off under reduced motion).
* **Relation outlines** (`PRESETS.relation`) are a separate overlay pass (`overlayScene`, screen-facing rings, minimum 9 px radius), never in lit materials. Neutral outlines show only in readability mode.

## Emission rules (the hard requirement)

* `util.causeAllowed(cls, cause, variant, entry)` is the single implementation of the contract 2.1 table. `bodies.js` only ever writes a body's emission after it passes; anything else is ignored and warned once (`[render3d] emitter cause not allowed`).
* Shader emission exists in exactly these places: star/neutron-star surface (`star`, `stellar-remnant`), brown-dwarf bands (`stellar-remnant`), lava cracks (`hot-ground`, only `variant === 'lava'`), uniform hot bodies for `hot-debris` / `ablation` / `impact-flash`, black-hole disc (`accretion`/`jet`). Nothing glows on airless rock otherwise; there is **no thruster, heat rim, halo or additive glow on any rock**.
* Event VFX: impact/hit/absorb flashes and ballistic ejecta that cool as a blackbody (≈5500 K → 650 K, then fade — no smoke, no flame); Roche streams and thrust motes are **grey, non-additive dust**; the atmospheric-entry streak is spawned **only while `body.entry != null`**; the evolve ring/inhale and the death burst are scripted events.
* `?debug=emitters` shows every emissive body with its cause (plus active atmospheric-entry streaks and the live event-particle count).

## Looks data

`createRenderer` does `import('../data/looks.js')` and uses it when it exports `getLook` and `PRESETS`; otherwise `fallback-looks.js`. Conventions ENG relies on (please mirror in `looks.js` / `material-spec.md`, or tell ENG what to change):

* `Look.palette`: rocks use `base`+`accent`; terrestrial planet `base`=lowland, `accent`=ocean, `shadow`=highland, `extra[0]`=ice; gas giants/brown dwarfs `base`/`accent`/`shadow` band tones, `extra[0]` storm tint; stars/NS/BH colour from `emission.temperatureK`.
* `Look.extras` read: `elongation`, `lump`, `kind` (2 lava, 3 ice), `terrestrial` (1 → planet shader), `cloud`, `water`, `cells`, `spots`, `limbU`, `corona`.
* `Look.albedo` is a target reflectance: palette colours are rescaled so the mean luminance matches it (clamped 0.4–1.7×).
* Missing/unknown fields fall back to safe defaults (unknown variants => default look).

## Assumptions to confirm with SIM / lead

1. `state.key.dir` is the unit vector **toward** the light (one constant if SIM disagrees: `keyW` in `render3d/index.js`).
2. `atmosphere.shellHeight` ≤ 0.6 is a fraction of the radius, larger values are absolute world units.
3. `emissive.intensity` ~0..1.5 scales the look's own emission; `beam.phase` is the current beam angle in radians; `disrupt.stretch` is an extra scale along `disrupt.axis` (× a progress ramp).
4. `main3d.js` calls `ui.showChoice` on `choice-open` and `ui.showEnd` on `ending`. If `ui.attach` already does that, delete those two lines (otherwise the screens would open twice).
5. `ui.getSettings().topDown` / `readability` / `reducedMotion` arrive through `onSettings` → `renderer.setOptions`.

## Budgets and quality ladder

| Tier | DPR cap | MSAA | Bloom | Sky cube | Black hole steps |
|---|---|---|---|---|---|
| `low` | 1 | off | off | 512 | 40 |
| `med` | 1.5 | off | on | 768 | 72 |
| `high` | 2 | 4× | on | 1024 | 110 |
| `auto` | high features + dynamic resolution 0.6–1.0 (drops 0.1 after ~40 frames over 21 ms, recovers 0.05 after 300 frames under 15 ms) | | | | |

Measured on the fixture demo under headless Chrome/SwiftShader (software GL, so GPU numbers are meaningless): JS cost of `drawFrame` ≈ 0.3–0.8 ms for 36 bodies, 22–38 draw calls, 40k–240k triangles, well inside the 2 ms JS budget; still **to be profiled on real GPUs** (research §4.6).

## Known limitations / next steps

* The black-hole billboard lenses the sky only; other bodies behind the hole are not bent (they are hidden only where the shadow/disc is opaque).
* No shadow maps; eclipses are analytic for large bodies only (2 occluders each). Rock instances in the `lo`/`mid` LODs receive no eclipses.
* Sky `level` parallax is not implemented (stars are at infinity; `sky.level` only seeds the bake via the key).
* Comet coma/tail (`body.coma`) is not drawn yet (the nucleus is). Planned: non-emissive dust sprites pointing away from `state.key.dir`.
* Cutover (default `3d`, deletion of the 2D files, the 2D fire fix in `src/render/**`) is deliberately **not** part of this change.
