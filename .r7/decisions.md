# Vesper Drift decisions

- **2026-10-02 — Ship a dependency-free browser implementation.** `package.json` has no dependencies or build step; `src/main.js` loads ES modules and checks required exports so startup failures are visible. It uses a fixed 120 Hz simulation step and canvas rendering. Evidence: `package.json`, `src/main.js`, `docs/engine-notes.md`.
- **2026-10-02 — Separate reference research from implemented design.** `docs/game-design.md` identifies unconfirmed details of the referenced game and labels assumptions; the shipped Vesper Drift uses 2D canvas even though the design document discusses 3D. Evidence: `docs/game-design.md`, `src/render/index.js`, `README.md`.
- **2026-10-02 — Make progression and pacing testable.** `src/stages.js` owns stages, choices and endings; `tests/stages.test.mjs`, `tests/pace.mjs`, and `tests/smoke.mjs` cover rules, a deterministic headless run and browser flow. Evidence: `package.json`, `docs/engine-notes.md`.
