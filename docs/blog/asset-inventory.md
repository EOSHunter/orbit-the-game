# Blog asset inventory: how Vesper Drift was built with R7 Orbit

Research only. No game code was changed and no files were moved. Everything below was checked against the repo at commit
`b094227` (branch `orbit/asset-quote-scout-7f2592`). Paths are repo-relative. Line ranges refer to that commit.

## Build phases used for tagging

| Phase | When (commit dates) | What happened |
|---|---|---|
| **P1 Research** | 2 Oct | Research agents study the reference game (Drifter Star: Evolution) and space physics; a Creative Director agent writes the look. `docs/game-design.md`, `docs/creative-direction.md`, `docs/space-realism-research.md` |
| **P2 First team / v1 (2D)** | 2 Oct | Four parallel build agents (core engine, stages and choices, renderer, HUD), one branch and worktree each, then an integrate and playtest agent. Output: the 2D canvas game, `src/main.js`, `src/render/` |
| **P3 Specialists go 3D** | 2 Oct | `docs/interfaces.md` contract, then SIM (infinite universe), ENG (Three.js), SND (sound), UI (holographic HUD), art bible, material spec |
| **P4 Comeback / iteration** | 2 to 3 Oct | 3D becomes the default (`src/boot.js`), dev start menu, balance bot, polish |
| **P5 The making-of video** | 3 Oct | Brand kit, footage analysis, script, Remotion project in `video/` |

Boundaries come from commit messages (`git log`) and the video script's chapter list (`docs/video/script/script.md`,
"Chapter overview"). Check git history for exact merge order before stating dates in the post.

---

## 1. Warnings first

- **No GIFs and no rendered video files are in the repo.** `video/.gitignore` excludes `out/` and `public/media/`. The 11 raw
  screen recordings (`1.mp4` to `11.mp4`, about 2.8 GB, 54:17 total) are untracked in the main checkout at
  `C:\Users\hunte\R7 Orbit Projects\orbit-the-game\docs\video\`. No `video/out/*.mp4` exists on disk, so the rough cut and
  1080p final named in commits `5b43b78` and `43ed14b` must be re-rendered (see gap G8).
- **`docs/references/` is NOT ours.** The 12 `Screenshot 2026-10-02 *.png` files show the commercial reference game (the one
  I opened shows its Meteorite HUD). They were collected as art references. **Do not publish them.**
- **Stale docs, do not quote these numbers:** `docs/engine-notes.md:71` says absorb efficiency is 0.14; the real config is
  `absorbEfficiency: 0.4` with a per-contact curve of 0.55 down to 0.30 (`src/sim/config.js:8,70`). `docs/how-to-play.md`
  says "roughly 40%". `README.md` and `.r7/README.md` describe 2D as the default; `src/boot.js:3` makes **3D the default**.

---

## 2. Screenshots and key art

All tracked, in `docs/video/brand-kit/screenshots/`, 1920x1080 PNG. Real captures of the 3D build's UI. I opened `01` and `07`;
the others are named in the same series but I did not view them, so check each before use.

| # | Path | Shows | Phase | Suggested caption |
|---|---|---|---|---|
| S1 | `01-title.png` | Title screen: VESPER / DRIFT wordmark, orbital emblem, "Grow from a drifting pebble into a black hole. Absorb what is smaller; avoid what is larger.", INITIATE DRIFT / SETTINGS / DEV START, seed `VD-1PZM-QKS5` | P3/P4 | "The title screen, built by a UI agent from a written design brief." |
| S2 | `02-hud-meteorite.png` | HUD at stage 1, Meteorite (name only) | P3/P4 | "Stage 1: you are a pebble." |
| S3 | `03-hud-rocky-lava.png` | HUD at Rocky Planet (name only) | P3/P4 | "Stage 4: bigger bodies start chasing you." |
| S4 | `04-hud-gas-giant.png` | HUD at Gas Giant (name only) | P3/P4 | "Stage 5." |
| S5 | `05-hud-star.png` | HUD at Star (name only) | P3/P4 | "Stage 8: stars are prey now." |
| S6 | `06-hud-neutron-star.png` | HUD at Neutron Star (name only) | P3/P4 | "Stage 11." |
| **S7** | `07-hud-black-hole.png` | **Best hero shot.** 12/12 BHO, mass 1.90M, lensed accretion disc, Target Analysis panel (THREAT black hole 689k, PREY star 60k), velocity / gravity / orbit action bar | P3/P4 | "Stage 12 of 12: 1.9 million times the starting mass. The disc is a ray-marched lensing shader, not a sprite." |
| S8 | `08-settings.png` | Systems / settings panel (name only) | P3/P4 | "Pause and settings in one panel." |
| S9 | `mock-lowerthird-and-agent-subtitle.png` | A mock of the video's lower-third and agent subtitle style, not a real capture | P5 | "Making-of video styling: agents get role colours." |

`docs/video/brand-kit/index.html` is a browsable contact sheet of the kit.

### Stage backgrounds (clean, no HUD), `docs/video/brand-kit/assets/backgrounds/`

`bg-stage01-asteroid-clean.png`, `bg-stage04-rocky-lava-clean.png`, `bg-stage05-gas-giant-clean.png`,
`bg-stage08-star-clean.png`, `bg-stage11-neutron-clean.png`, `bg-stage12-black-hole-clean.png`. Phase P3/P4.
Caption: "Six of the twelve stages, HUD removed." Only six of twelve exist (see G4).

---

## 3. Brand assets and logos (`docs/video/brand-kit/assets/`)

| Path | What | Use |
|---|---|---|
| `logo/r7-orbit-icon.svg` | R7 Orbit icon (gold "7" with orbiting dot on a near-black tile), vector | Byline / sign-off; best for web |
| `logo/r7-orbit-mark-transparent.svg` | Mark without the tile, vector | Over dark images |
| `logo/r7-orbit-icon-2048.png`, `-4096.png` | Raster icon masters | Hero / social card |
| `logo/r7-orbit-mark-{gold-transparent,white,ink,bronze-for-light-bg}-2048.png` | Colour variants (bronze is for **light** backgrounds) | Pick by page theme |
| `logo/legacy-512/*` | Older 512 px versions | Skip unless small size is needed |
| `ui/vesper-drift-emblem.svg` | The game's orbital emblem | Post header image |
| `ui/hud-corner-bracket.svg` | HUD bracket graphic | Frame for pull quotes |
| `fonts/` | Barlow Semi Condensed, JetBrains Mono (both OFL, licences included) | Match the video look |
| `../brand-guide.md`, `../theme.ts` | Palette and rules | See below |

**Palette** (`docs/video/brand-kit/brand-guide.md` §1.1, §1.3): holo cyan `#5CE1FF`, void `#050812`, mint `#5FF0C0` (prey),
coral `#FF5E73` (threat), amber `#FFB547`, violet `#B48CFF`, R7 gold `#CAAB6C`. Guide rule: gold only for the R7 Orbit logo,
never in HUD-style graphics.

Not present: no favicon, no social / OG card, no standalone key-art painting. S1 and S7 are the closest.

---

## 4. Video and Remotion material

| Path | What | Phase |
|---|---|---|
| `video/README.md` | Pipeline: script -> `edl.json` -> Remotion; quotes in §6 | P5 |
| `video/src/data/edl.json`, `video/props/{rough,final}.json` | Edit list and render props | P5 |
| `video/src/` (`Video.tsx`, `components/Cards.tsx`, `Overlays.tsx`, `Subtitles.tsx`) | Remotion composition `VesperDrift`; good for a file-tree figure | P5 |
| `docs/video/script/script.md` | 8:03 beat-by-beat script, 7 chapters | P5 |
| `docs/video/analysis/footage-index.md` | Per-clip index of the 11 recordings | P5 |
| `docs/video/analysis/frames/N/tNNNNN.jpg` | About 500 contact frames across clips 1 to 11. **The only tracked images of the Orbit app itself** (agent cards, canvas, PR merges, permission cards). Check the frame interval in `footage-index.md` before citing a time. Probably too small for a hero image; re-grab from the MP4 (G9) | P1 to P4 |
| `docs/video/analysis/transcripts/N.srt` | Subtitles of the narration per clip | all |

Beat suggestions from the script's table: clip 2 at 1:00 (four build agents on one canvas, called the "best team-on-one-canvas
shot"); clip 3 at 0:01 (four "Pull request merged" cards); clip 1 at 9:40 (Orbit asks "2D top-down, or 3D like the
original?"); clip 11 at 1:40 (black-hole stage gameplay).

---

## 5. Code snippets (short, verified line ranges)

| # | File : lines | What it shows | Phase | Suggested caption |
|---|---|---|---|---|
| C1 | `src/stages.js:32-45` | The `STAGES` table: 12 forms, `minMass` 0 to 1,800,000, `radiusScale`, `spawnMix` (prey / threat / neutral) | P2 | "The whole progression is one 12-row table. Prey share falls from 80% to 50%, then returns at the black hole." |
| C2 | `src/stages.js:54-62` (trim) + `149-171` | Evolution choices as data (`effect: { speed, resist, absorb, flag }`) and `applyChoice`, which only touches flags | P2 | "Choices never touch mass, only flags, so the ending logic can read the pick log." |
| C3 | `src/sim/index.js:401-452` | `paceFactor()` (rubber-band governor) and `playerAbsorb()`: mass transfer, momentum-conserving merge, spin from off-centre hits, debris, chain counter, `absorb` event | P3 | "Eating something gives you only 30 to 55% of its mass. The rest becomes debris." |
| C4 | `src/sim/physics.js:11-27`, `38-42` | `softenedAccel` (softened, range-limited gravity with taper) and `absorbEfficiency` | P3 | "Gravity in 15 lines: wells bend your path without vacuuming the map." |
| C5 | `src/sim/universe.js:226-250` (header comment `1-17`) | `generateCell`: body count and every body's RNG stream derived from `hash32(cellH, ...)` | P3 | "The universe is a pure function of (seed, level, cell). Nothing is stored, so it is effectively infinite." |
| C6 | `src/sim/rng.js:14-28`, `45-54` | `hash32` and `mulberry32` | P3 | "No `Math.random` in the sim. Same seed, same universe." (file header says "No Math.random, no Date") |
| C7 | `src/main3d.js:149-170` (constants `:9`) | Fixed-step loop: 1/120 s accumulator, max 12 steps, pause when the tab is hidden | P3/P4 | "The core loop: a fixed 120 Hz simulation decoupled from rendering." |
| C8 | `src/sim/index.js:1301-1396` | `step(dt)` orchestration: rebase, stepPlayer, stepFree, collisions, evolve, finale. Long; trim to the calls around lines 1330-1346 | P3 | "One tick of the universe." |
| C9 | `src/audio/params.js:20-62` | `massScale`, `resonanceHz` (190 Hz down to 24 Hz), `stageParams` (root note falls from A3 to B1) | P3 | "Sound design as math: the bigger you are, the lower you hum." |
| C10 | `src/audio/sfx.js:12-33` | The absorb "chomp" built from oscillators and noise | P3 | "Eating a moon is a sine, a sub sine, filtered pink noise and a gulp glide. No audio files." |
| C11 | `src/render3d/glsl/misc.js:4-60` | Black hole shader: ray-marched Schwarzschild null geodesics inside a billboard | P3 | "The black hole bends light by marching rays inside a flat quad." |
| C12 | `src/boot.js:1-33` | 3D by default, automatic fallback to 2D if WebGL2 is missing | P4 | "Try 3D, fall back to 2D." |
| C13 | `src/sim/config.js:1-8`, `62-65` | `CONFIG`: every tunable in one file, plus the pacing-governor comment | P3 | "Every number that matters, in one file." |

---

## 6. Passages to quote verbatim

| # | Quote | File : line | Phase |
|---|---|---|---|
| Q1 | "a quiet, luminous drift through a dark sky where you grow from a glowing pebble into a black hole, and every size feels different." | `docs/creative-direction.md:18` | P1 |
| Q2 | "calm, awe-struck, a little melancholic. Relaxing on the surface, with tension from scale and from things bigger than you." | `docs/creative-direction.md:20` | P1 |
| Q3 | "Scale is the story: every stage changes the palette, sound and pace." | `docs/creative-direction.md:23` | P1 |
| Q4 | "The game should read like a calm astrophotograph you can play." | `docs/art-bible.md:11` | P3 |
| Q5 | "Rocks never burn. There is no fire, smoke or thruster flame in vacuum" | `docs/art-bible.md:20` | P3 |
| Q6 | "Darkness is a colour. The void is a deep blue-black, not pure black." | `docs/art-bible.md:15` | P3 |
| Q7 | "Space is silent, the game is not." | `docs/audio-direction.md:7` | P3 |
| Q8 | "Everything is synthesised with the Web Audio API (no asset files)." | `docs/audio-direction.md:3` | P3 |
| Q9 | "Controls, camera, numeric stats, upgrade lists and enemy behaviour are therefore mostly not confirmed." (agents flagging what they did not know) | `docs/game-design.md:4` | P1 |
| Q10 | "So the 'fire' is a deliberate art choice (a rocket-like exhaust and a re-entry-style heat rim) applied to a body that is in vacuum." (a bug report that drove the realism rewrite) | `docs/space-realism-research.md:38` | P1/P3 |
| Q11 | "The pacing governor (`CONFIG.pace`) holds every stage near 95 s regardless of seed, so no stage is close to the ~4 minute limit." | `docs/sim-balance.md:20` | P4 |
| Q12 | "A gravity fling past a star pushed the bot to 1700+ units/s ... It overshot every small prey and spent 30 minutes in a void." | `docs/sim-balance.md:25-27` | P4 |
| Q13 | Quantum Cosmos ending: "Every time evolution beckoned, you refused. Down you went, into the atom, and inside it a universe, and inside that, another." | `src/stages.js:187` | P2 |
| Q14 | "Prey, neutral and threat never rely on hue alone" | `docs/ui-direction.md` §2 | P3 |
| Q15 | "I didn't want one AI to build my game. I wanted a team." | `docs/video/script/script.md`, beat 1 (on-screen text) | P5 |
| Q16 | Hunter, recorded: "Basically, vibe coding on steroids." / "I'm going to sit the passenger seat for this one" / "I want you to be the orchestrator... and I want you to run the show." | script beats 3, 53, 17 (cleaned of filler words, per the script's own rules) | P1 |
| Q17 | "Nothing is recorded for the video, and there is no AI voiceover: R7 Orbit makes the whole thing from the existing footage." | `video/README.md` | P5 |
| Q18 | "THIS VIDEO WAS MADE ENTIRELY BY R7 ORBIT" | `video/README.md` ("The R7 Orbit reveal") | P5 |

Story hook: script beat 18 shows Orbit asking "2D top-down, or 3D like the original?" and Hunter answering "3D like the
original." The repo shows 2D shipped first (P2), and 3D came in P3.

Quotes were copied from the files; re-check line numbers if the docs change.

---

## 7. Stats safe to cite

| Stat | Value | Evidence |
|---|---|---|
| Forms | 12, Meteorite to Black Hole | `src/stages.js:32-45` |
| Mass range | start 1; Black Hole threshold 1,800,000 | `stages.js:44`, `config.js:7` |
| Choice points | 5 stages (Dwarf Planet, Rocky Planet, Gas Giant, Dwarf Star, Supergiant), 14 perks plus "Abandon evolution" | `stages.js:54-100` |
| Endings | 6 | `stages.js:173-204`; test "all six ending ids are reachable and distinct" passes |
| Radius rule | `radius = 10 * sqrt(mass)` | `config.js:6` |
| Sim step | fixed 1/120 s | `src/main3d.js:9` |
| Universe | 18 mass levels, each 3.5x the last, from mass 0.02; deterministic per seed | `config.js:19`; `universe.js:1-17` |
| Dependencies | 0 npm dependencies, no build step, Three.js vendored, Node 22+ | `package.json`, `README.md` |
| Audio files | 0, all synthesised | `src/audio/`, audio-reference README |
| Voice cap | 28 pooled voices | `src/audio/engine.js:11` |
| Source size | 14,107 lines under `src/` (tracked, html excluded); sim 2,966, render3d 3,026, UI 2,474, audio 1,384; tests 2,962 | `wc -l` run by me at this commit |
| Tests | 7 `tests/*.test.mjs` files pass (`node --test "tests/*.test.mjs"`, run by me, 14 s) | local run |
| Git | 126 commits, 2 to 3 Oct 2026; author lines Orbit 80, Hunter 26, Hunter Newton 19, R7 Repo Notes 1 | `git log` |
| Pacing target | about 13 to 16 min; 95 s per stage | `README.md`; `config.js:65` |
| Balance bot | 18 of 24 seeds finish, median 14:55, 0 stuck | `docs/sim-balance.md:14` (**from the report; I did not re-run it**) |
| Footage | 11 recordings, 54:17 | `footage-index.md` |

Do not cite: "about 40% absorbed" (`how-to-play.md`) or 0.14 efficiency (`engine-notes.md`), both outdated; the 2D 220-radius
boundary (legacy). The reference game's facts live in `docs/game-design.md` Part A with their own source tags.

---

## 8. Missing material and how to capture it

I did not launch the game, so none of the existing screenshots were made by me. Deep-link format (verified in
`src/devstart.js:3-5,18-24`): `?stage=<stage id or 0-based index>&form=<choice id>`, e.g. `?stage=rocky_planet&form=lava`.
Start the server with `npm start` (http://localhost:8000/).

| # | Gap | Steps |
|---|---|---|
| G1 | Gameplay GIF: absorb chain | Open `/?renderer=3d&stage=asteroid`. Hold the mouse toward a small mint-rimmed body. Record 5 s at 1080p60 (OBS or Win+G), trim to 3 s, then `ffmpeg -i in.mp4 -vf "fps=20,scale=800:-1" out.gif` |
| G2 | Evolution card screen | Open `/?renderer=3d&stage=dwarf_planet`; wait for the "Evolution branch detected" cards (not verified that startAt pauses on the menu; otherwise use the title "Dev start" button). Screenshot at 1920x1080. Repeat for the amber "HOLD FORM" abandon card |
| G3 | Capture warning HUD | `/?renderer=3d&stage=supergiant_star`, steer toward a large black hole until the segmented capture meter reads 50 to 75% |
| G4 | Missing HUD stage shots (Dwarf Planet, Gas Planet, Dwarf Star, Giant Star, Supergiant) | For each `?stage=N` (0 to 11), press Esc, screenshot, hide the cursor |
| G5 | Roche tearing | `?stage=rocky_planet`; drift near a body 10 to 50x heavier (`config.js:83`); capture within the 2.2 s disruption |
| G6 | 2D vs 3D side by side (the P2 to P3 story) | Same seed: `/?renderer=2d` and `/?renderer=3d`; screenshot both at the same stage |
| G7 | Sound clip | Open `/src/audio/demo.html`, screen-record with system audio. No audio files exist in the repo |
| G8 | Rendered making-of video and poster frame | `cd video && npm install && npm run render:final` (needs ffmpeg; set `FOOTAGE_DIR` if the clips are elsewhere). Output `video/out/final-1080p.mp4`. Poster: `ffmpeg -ss 5 -i out/final-1080p.mp4 -frames:v 1 poster.png` |
| G9 | R7 Orbit app screenshots (not the game) | From the raw clips: `ffmpeg -ss 60 -i 2.mp4 -frames:v 1 team.png` (four agents), `ffmpeg -ss 1 -i 3.mp4 -frames:v 1 prs.png`. Crop out the Claude usage page and taskbar notifications (script "Gaps #11") |
| G10 | Test / balance terminal shot | `node tests/sim.balance.mjs --runs 3 --seed 1` (about 25 s per run); screenshot the table |
| G11 | Architecture diagram | Draw from `docs/interfaces.md` §3 (event bus: SIM emits; ENG, SND, UI consume) and §11 (file ownership) |
| G12 | Social / OG image | Compose the emblem SVG and title over `bg-stage12-black-hole-clean.png` at 1200x630 |

---

## 9. Suggested outline mapped to assets

1. Hook: Q15 + S7.
2. Research (P1): Q9, Q1, Q2.
3. The team of agents: G9, script beats 28 to 32 (one branch and worktree per agent).
4. The rules: C1, C3, S1.
5. Making it real (P3): Q4, Q5, Q10, C11.
6. Sound with no files: Q7, C9, C10.
7. Infinite universe: C5, C6.
8. Testing with a bot: Q11, Q12, G10.
9. The video made by the same agents: Q17, Q18, G8.
