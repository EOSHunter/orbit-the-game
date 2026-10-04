# R7 repository context: orbit-the-game (Vesper Drift)

This repository contains **Vesper Drift**, a browser space-evolution game. The player steers a growing body, absorbs smaller bodies, avoids larger ones, selects evolution perks, and can reach several endings. Plain JavaScript modules now boot the Three.js/WebGL2 renderer by default, with a 2D canvas fallback (`src/boot.js`, `src/main3d.js`, `src/main.js`). The game has no build step or npm dependencies; Three.js is vendored in `vendor/three/`.

- `src/boot.js` selects 3D by default and falls back to 2D when WebGL2 or initialization fails; `src/main3d.js` wires the 3D loop, simulation, interface and audio.
- `src/main.js` remains the 2D game loop; `src/render/` remains the canvas renderer.
- `src/sim/`, `src/render3d/`, `vendor/three/`: deterministic seeded infinite-universe simulation, Three.js renderer and vendored library.
- `src/game.js`, `src/physics.js`, `src/world.js`, `src/camera.js`: game state, motion/collisions, spawning and camera.
- `src/stages.js`: twelve named stages, evolution choices and endings.
- `src/render/`, `src/ui/`, `src/input.js`: procedural visuals, menus/HUD and controls.
- `tests/`: rules, simulation and audio tests, pace/balance checks and headless browser smoke tests (`package.json`, `tests/smoke3d.mjs`).
- `video/`: separate Remotion vlog project driven by an edit list; see `video/README.md`. Rendering needs original recordings and ffmpeg, which are outside the tracked game code.
- `docs/blog/`, `docs/video/`: draft article/process material and video script/brand assets; these are source artifacts, not published pages or a confirmed final video.
- `docs/engine-notes.md` explains the implemented mechanics and test commands; `docs/creative-direction.md` records visual/audio direction.

Run with `npm start` and open `http://localhost:8000/`; ES modules require a local server (`README.md`). See [decisions](decisions.md) and [October 2026 changes](changes/2026-10.md). These notes cover the prior baseline through `3be8a182540c22e7a9be0d4b9008a875fde05a02` and mainline changes after the previously processed `e657a77af82fdfa24bb15d0d9451ffd1cdbadedc` through `3ed2d3517cc6578fec753b1d2f36f6fdec16c35b` on 2026-10-04. They describe repository code, not an external deployment or verified live playtest.
