# R7 repository context: orbit-the-game (Vesper Drift)

This repository contains **Vesper Drift**, a browser space-evolution game. The player steers a growing body, absorbs smaller bodies, avoids larger ones, selects evolution perks, and can reach several endings. The current code renders in a 2D HTML canvas using JavaScript modules, without a build step or package dependencies (`README.md`, `src/main.js`, `src/render/`). Design research in `docs/game-design.md` discusses a 3D reference game and assumptions; that is not the current renderer.

- `src/main.js` loads the game modules, reports missing exports and runs a fixed-step loop.
- `src/game.js`, `src/physics.js`, `src/world.js`, `src/camera.js`: game state, motion/collisions, spawning and camera.
- `src/stages.js`: twelve named stages, evolution choices and endings.
- `src/render/`, `src/ui/`, `src/input.js`: procedural visuals, menus/HUD and controls.
- `tests/`: stage/choice tests, pacing simulation and headless browser smoke test. `npm test` runs the first two; `npm run test:smoke` runs the browser test (`package.json`).
- `docs/engine-notes.md` explains the implemented mechanics and test commands; `docs/creative-direction.md` records visual/audio direction.

Run with `npm start` and open `http://localhost:8000/`; ES modules require a local server (`README.md`). See [decisions](decisions.md) and [October 2026 changes](changes/2026-10.md). These notes cover the eleven reachable `main` commits through `3be8a182540c22e7a9be0d4b9008a875fde05a02` on 2026-10-02. They describe repository code, not an external deployment or a verified live playtest.
