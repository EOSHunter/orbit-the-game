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
