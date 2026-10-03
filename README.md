# Vesper Drift

A browser space-evolution game inspired by *Drifter Star: Evolution*. You start as a drifting pebble, absorb anything
smaller, dodge anything bigger, and grow through 12 forms from Meteorite to Black Hole. At milestone stages you pick an
evolution that changes your speed, toughness or appetite and decides which of the endings you earn. A full run takes
about 13-16 minutes. The universe is procedural, deterministic per seed, and effectively infinite.

Plain JavaScript ES modules, Three.js vendored in `vendor/three`. No build step and no npm dependencies.

## Run it

```
npm start        # serves the repo on http://localhost:8000/  (Node 22+)
```

`npm start` runs `tools/serve.mjs`, a tiny zero-dependency static server. You need a server because the game uses ES
modules and an import map, and **browsers do not load those from `file://`**: double-clicking `index.html` gives a blank
page. Any static server works (`npx serve`, `python -m http.server 8000`).

| URL | What |
|---|---|
| `/index.html` | The game (2D renderer by default) |
| `/index.html?renderer=2d` or `?renderer=3d` | Pick the renderer. 3D needs WebGL2 and falls back to 2D if it is missing or fails |
| `/src/render3d/demo.html` | Standalone 3D renderer demo |
| `/src/audio/demo.html` | Sound designer demo |
| `/src/ui/demo.html`, `/src/render/demo.html` | HUD demo and 2D renderer demo |

## Controls

| Input | Action |
|---|---|
| Mouse (hold) | Thrust toward the pointer; the farther away it is, the harder the thrust |
| WASD / arrow keys | Steer with the keyboard |
| Space (or Shift) | Stabilise (3D build): kill drift and settle |
| Q | Capture (HUD action; shows as locked unless the host wires it up) |
| Esc | Pause / open the menu |
| T | Toggle top-down camera (3D build) |
| 1-4 or click | Pick an evolution card |

Rim colours show what is safe: **mint** = smaller (absorb), **blue** = about your size (bounce), **coral** = bigger
(it hurts). See [docs/how-to-play.md](docs/how-to-play.md) for the stages, mass rules and endings.

## Tests

```
npm test             # runs every tests/*.test.mjs with node --test (Node 21+ for the glob)
npm run test:pace    # pacing simulations (slower; checks a run lasts ~13-16 minutes)
npm run test:smoke   # end-to-end test in headless Chrome/Edge
```

## Folder map

| Path | Contents |
|---|---|
| `index.html`, `src/boot.js` | Entry point; `boot.js` chooses the 2D or 3D stack |
| `src/sim/` | Deterministic infinite-universe simulation (no DOM, runs in Node); see `src/sim/README.md` |
| `src/render3d/` | Three.js renderer, shaders (`glsl/`), camera, effects, demo |
| `src/render/` | Original 2D canvas renderer |
| `src/audio/` | Procedural sound engine and demo |
| `src/ui/` | Holographic HUD, menus, evolution cards, `ui.css` |
| `src/data/` | Shared data tables (`looks.js`) |
| `src/*.js` | 2D game loop, stages and endings (`stages.js`), physics, input |
| `vendor/three/` | Vendored Three.js build |
| `tools/` | Static dev server |
| `tests/` | Plain-node test scripts |
| `docs/` | Design, art, audio and engine docs |

## Docs

- [docs/how-to-play.md](docs/how-to-play.md): stages, mass rules, endings
- [docs/game-design.md](docs/game-design.md): research and design spec
- [docs/engine-notes.md](docs/engine-notes.md), [docs/interfaces.md](docs/interfaces.md): architecture and module contracts
- [docs/creative-direction.md](docs/creative-direction.md), [docs/ui-direction.md](docs/ui-direction.md), [docs/audio-direction.md](docs/audio-direction.md)
