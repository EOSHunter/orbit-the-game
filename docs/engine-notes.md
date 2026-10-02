# Engine notes

Vanilla JS ES modules + HTML5 canvas. No build step, no dependencies.

## Run

ES modules do not load from `file://`, so use any static server from the repo root:

```
npm start            # npx serve .
# or: python -m http.server 8000
```

Then open the printed URL (`index.html` is served at `/`). Steer with the mouse (thrust grows with the
cursor's distance from the player) or WASD / arrows.

`src/main.js` tries to import the real `src/stages.js`, `src/render/index.js` and `src/ui/index.js`. Any
module (or individual export) that is missing is filled in from `src/dev-stubs.js`, which is itself imported
lazily, so deleting it once the real modules land is safe. The console logs which stubs were used.

## Files

| File | Role |
|---|---|
| `src/main.js` | Module loading with stub fallback, canvas/camera/input setup, the loop |
| `src/game.js` | State machine, collisions, evolution + choices, boundary, endings |
| `src/world.js` | State creation, spawn/despawn around the player, drift + chase AI |
| `src/physics.js` | **`CONFIG` (all tunables)**, mass/radius, player movement, bounce |
| `src/camera.js` | Follow + zoom + shake camera and world/screen helpers |
| `src/input.js` | Keyboard + pointer steering |
| `src/dev-stubs.js` | Throwaway stages / renderer / UI so the engine runs alone |

## The loop

`main.js` runs `requestAnimationFrame` with a fixed 1/120 s simulation step and an accumulator (max 12 steps
per frame, frame gaps clamped to 0.25 s, paused while the tab is hidden). Each frame: `game.step(1/120)` as many
times as needed, then `game.render(dt)` = `renderer.drawFrame(state, camera, dt)` then `ui.update(state)`.
There is no interpolation between steps, so the renderer sees the latest step.

`game.step` by `state.status`:

- `title`: world drifts, nothing can hurt the player, camera is zoomed out. `ui.showTitle(onStart)` starts a run.
- `playing`: steer, move, update world (drift + chase), collide, grow, stage check, boundary, finale check.
  Hit-stop and the death slow-motion scale only the world, not the camera.
- `choice`: world runs at 15% speed, collisions are off. `ui.showChoice(choices, onPick)`; picking calls
  `applyChoice(state, id)` and resumes play.
- `ended`: `ui.showEnd(ending, onRestart)`; restart begins a new run (state object is reused, mutated in place).

## Rules implemented

- **Units.** Mass is the single scalar. `radius = 10 * sqrt(mass)` (`CONFIG.radiusUnit`). The player starts at mass
  `CONFIG.startMass` = 1, so **`stages.js` `minMass` values must be in the same units** (stage 0 may use 0 or 1).
  Gain per absorb = `prey.mass * CONFIG.absorbEfficiency` (0.4). Tune that if your thresholds make a run too long or short.
- **Speeds are in player radii per second**, so every stage feels the same; when the player grows, existing velocities are
  rescaled. The camera keeps the player about 26 px (at 1280x720) on screen.
- **Relative state.** Every body's `kind` is reclassified each step from the mass ratio with 1.2x and 5% hysteresis:
  `prey` (player >= 1.2x), `threat` (body >= 1.2x), else `neutral`. `kind` is relative, not a type.
- **Absorb:** prey is pulled in (range grows with stage) and absorbed on contact. **Hurt:** a threat touching deeper than
  the grace margin (centre distance < 0.85 x (rp + rb)) costs health and knocks the player back, then 1.2 s of
  invulnerability. A body >= 3x mass kills outright. Health regenerates after 3 s. Death shows an effect, slow-mo, then the ending.
  Neutral bodies and shallow threat contact just bounce (mass-weighted).
- **Chase AI** (`CONFIG.chase`, all knobs exposed): from stage 3, a growing share of threats are chasers. They pursue within
  `detectionRadius` (player radii), give up after `giveUpDelay`, move slower the bigger they are, and are kept from stacking.
  Set `__orbit.CONFIG.chase.enabled = false` in the console to turn it off.
- **Boundary:** `state.bounds.radius` = 220 x player radius at the stage's `minMass`, easing outward on evolve. The warning
  starts at 85% (`ui.warnBoundary(true)`, `state.edge` 0..1); outside the edge for 2.5 s ends the run as Event Horizon.
- **Evolution:** `getStage(player.mass)` is checked every step; the engine advances one stage at a time, calling
  `getChoicesFor(newIndex)`. If it returns options the game pauses for them. Evolve triggers `spawnEffect('evolve')`,
  a camera pull-back and shake.
- **Finale:** after reaching the last stage, the run ends when mass reaches 1.6x that stage's `minMass` or after 30 s.
- **Endings:** the engine sets flags then calls `getEnding(state)`; a `null` result uses a built-in fallback. Flags set:
  `flags.death` (`'stellar-fragment'` | `'event-horizon'`), `flags.died`, `flags.eventHorizon`, `flags.finale`, and
  `flags.ending` (`'death'` | `'eventHorizon'` | `'finale'`).
- **Spawning:** body budget falls from 200 (stage 0) to 60 (last stage). Bodies spawn just outside the view and despawn
  beyond 2.8 view radii. Sizes are relative to the player's current radius, mixed by `stage.spawnMix`
  (`{prey, neutral, threat}` weights, or `[prey, neutral, threat]`; a default curve is used if absent or unrecognised).
  A body's `stageIndex` is the stage matching its own mass (`getStage(body.mass)`).

## Contracts other modules can rely on

`state` has everything in the shared contract, plus these engine extras: `effects`, `health` (0..1), `progress`
(0..1 toward the next stage), `edge` (0..1 into the boundary warning), `edgeDoom` (0..1 toward Event Horizon), and
`stats` `{absorbed, hits, elapsed, maxMass}`. Optional perk flags the engine reads (set them in `applyChoice`):
`flags.absorbRange` (multiplier, default 1) and `flags.armor` (0..0.9 damage reduction; also disables one-hit kills).
If `applyChoice` edits `state.mass`, the engine adopts it.

`camera` (passed to `drawFrame`): `{x, y, zoom, width, height, scale, rotation}`. `x,y` is the world point at the
viewport centre (shake already applied), `zoom` is CSS px per world unit, and `width/height` are CSS px. Screen position =
`(world - cam) * zoom + size / 2`. Helpers in `camera.js`: `worldToScreen`, `screenToWorld`, `viewRadius`. The renderer
owns DPR scaling and canvas sizing (`resize()` is called on window resize before the camera size is updated; the camera
size comes from `canvas.clientWidth/Height`).

Effects: the engine only calls `spawnEffect(state, type, x, y, opts)` and trims `state.effects` to the newest 300; the
renderer should age and remove its own effects. Types and opts: `absorb` `{radius, mass, stageIndex, targetId, dx, dy}`,
`hit` `{radius, strength, stageIndex}`, `evolve` `{radius, stageIndex, stage}`, `death` `{radius, reason, stageIndex}`.

`window.__orbit` exposes `{game, state, camera, CONFIG, mod}` for tuning from the console.
