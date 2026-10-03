# Engine notes

> The 2D section of this file (loop, camera, physics of the old build) lives on `main`. When merging, keep it and
> append everything below as the "3D" section. This branch only adds the 3D part.

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
