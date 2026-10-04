# Vesper Drift: process timeline (evidence record)

Research notes for the blog post on how Vesper Drift was built with R7 Orbit. Every claim below cites a commit hash, a file, or both. Anything I could not confirm from the repo is in the **Unverified / not found in repo** section at the end. Nothing in the game code was changed to produce this.

## How to read this

- **Source of truth:** `git log --all` on this repo (126 commits across 28 `orbit/*` branches plus `main`, measured with `git log --all --oneline | wc -l` and `git branch`). Snapshot is `main` at `b094227`.
- **Times:** commit author timestamps, all in UTC-04:00. Everything happened on **2026-10-02 (17:26 to 21:22)** and **2026-10-03 (09:27 to 19:07)**.
- **Authorship in git:** "Orbit" = agent commits (`orbit: <task name>`, author `Orbit <orbit@localhost>`). "Hunter" / "Hunter Newton" = commits made through the human's account, including squash-merged PRs (`(#N)`) and a few hand-written commits. Several carry `Co-Authored-By: Claude Opus 5.5` or `Claude Sonnet 5.5` trailers.
- **Agent names and spoken quotes** (Atlas, Briar, Harbor, Lark, Juno, Polaris, and so on) do not come from git. They come from `docs/video/analysis/footage-index.md`, the Footage Analyst's index of Hunter's screen recordings. Where I use them, the source is labelled "footage index". That index describes recordings I cannot see here (see Unverified).
- **PR numbers:** git shows PRs **#1 to #19** (as `(#N)` in squash-merge subjects, plus a `Merge pull request #1` commit). I found **no trace of #20 to #24** (see Unverified). Phases after PR #19 show up only as local `Integrate orbit/<branch>` merge commits.
- Every `orbit/*` branch tip is an ancestor of `main` (checked with `git merge-base --is-ancestor`), so nothing is left unmerged.

## Overview table

| Phase | Orbit tasks | Date / time (2026) | PRs | Key commits |
|---|---|---|---|---|
| 1. Plan | Game Design Research; Creative Director | Oct 2, 17:26-17:40 | #1, #2 | `c095187` `2a72525` `687f8b1` `dce5f11`; `32e2702` `1fcdd49` |
| 2. Build (parallel) | Core engine; Stages & choices; Renderer & VFX; HUD & screens | Oct 2, 17:43-18:08 | #3, #4, #5, #6 | `80749c8` `c259ffc` `74fba93` `be77103`; squash `f5f1108` `8fbbe55` `fbb8e43` `877032a` |
| 3. Playtest | Integrate & playtest (Opus) | Oct 2, 18:12-18:46 | #7 | `548e81b` `2adb734` `3be8a18` |
| 4. Research | Space Realism Research | Oct 2, 19:29-19:37 | #8, #9 | `e3e31b2` `265f575` `984e196`; `2be371c` `867cee9` `35ccd9c` |
| 5. "Phase 3" (parallel) | Creative Director; UI Designer; Sound Designer; Engine & 3D Renderer; Simulation & Infinite Universe | Oct 2, 19:47-21:22 (agents), Oct 3, 09:27-10:16 (PRs) | #10, #11, #12, #13, #14, #15 | `198da5d` `815de5e` `b3a78e1` `ca19b83` `7a08649`; PRs `b3f015e` `a257a73` `07087f7` `54f6d1b` `f88a306` `9b3270a` |
| 6. "Phase 4" | README & run scripts; 3D renderer polish & performance; Integrate 3D as default; Sim progression & balance | Oct 3, 10:40-11:24 | #16, #17, #18, #19 | `5688589` `68ae110` `ad5f1ff` `314ea25`; PRs `7f9032a` `9d2375c` `d005fef` `a62c74c` |
| 7. Polish pass | Remove radar and hide cursor; Remove outlines and simplify background; Add gravity and absorption; Evolution choice previews | Oct 3, 13:31-14:14 | none found | `01b85a1` `b458778` `3604706` `e59bd03` `88a7c5b` `c694d41` `c9c6b7f` |
| 8. Dev tools | Developer start menu | Oct 3, 14:26-14:34 | none found | `b28c949` `a36bcf1` |
| 9. Video | Footage Analyst; Brand & Asset Collector; Scriptwriter; Remotion Editor (rough cut) | Oct 3, 15:18-19:07 | none found | see Phase 9 |

Between phase 5 and phase 7 there is a block of 16 near-simultaneous `Integrate orbit/...` commits (Oct 3, 12:22-13:01). See "Housekeeping" below.

---

## Phase 1: Plan (Oct 2, 17:26-17:40)

**What changed**
- `3369890` (17:26) Initial commit: 2 files, 11 lines.
- Game Design Research: `c095187` added `docs/game-design.md` (165 lines), refined by `2a72525` and `687f8b1`. Merged as **PR #1** (`dce5f11`, "Merge pull request #1 from EOSHunter/orbit/game-design-research-b9fb0f").
- Creative Director: `32e2702` added `docs/creative-direction.md` (266 lines). Merged as **PR #2** (`1fcdd49`).

**What was decided**
- The game to clone is *Drifter Star: Evolution* (Kayla Studio, released 2025-12-10). Evidence: `docs/game-design.md` Part A. The doc is explicit that it is a best guess and asks the human to confirm; the header says controls, stats and enemy behaviour are "mostly not confirmed" because only a Steam store page, a community hub, a thread and a review summary could be read, and two guide pages returned HTTP 429.
- The 12-stage ladder (Meteorite to Black Hole) came from a Steam review, not from the game files (`docs/game-design.md` A2). It is the ladder still in `src/stages.js` (12 stage entries, lines 33-44).
- Working title **Vesper Drift** and the "Luminous Vector Dusk" 2D look come from `docs/creative-direction.md`. The original plan was top-down 2D: `docs/space-realism-research.md` §0.1 describes the first build as "Top-down 2D" on canvas.

**What went wrong / caveats**
- The agent could not read the Steam page's deeper content. The design doc says so itself (research status banner), and the footage index (clip 1, 6:46-8:30) records that the Steam page "cannot be read by the agent".
- Footage index (clip 1, 9:27-9:44): Orbit asked 2D top-down or 3D, and Hunter answered "3D like the original". The first build nevertheless shipped as 2D (`.r7/README.md`: "The current code renders in a 2D HTML canvas"). I found no document explaining why the answer did not take effect. See Unverified.
- Footage index (clip 1, 1:40-2:00): the first ideas agent was set to Low effort by mistake.

## Phase 2: Build, four agents in parallel (Oct 2, 17:43-18:08)

**What changed** (one agent commit each, then one squash-merged PR each, all merged within the same minute, 18:08)

| Task | Agent commit | Size | PR |
|---|---|---|---|
| HUD & screens | `80749c8` (17:43) | 3 files, +1007 | #3 `f5f1108` |
| Stages & choices | `c259ffc` (17:43) | 2 files, +463 | #5 `fbb8e43` |
| Core engine | `74fba93` (17:58) | 10 files, +1349 | #4 `8fbbe55` |
| Renderer & VFX | `be77103` (18:06) | 8 files, +2637 | #6 `877032a` |

Total: about 5,456 added lines across four branches in roughly 25 minutes (sum of the four stat lines above).

**Process evidence**
- Each task ran on its own branch (`orbit/build-core-engine-bfc394`, `orbit/build-stages-choices-90faf0`, `orbit/build-renderer-vfx-7327e0`, `orbit/build-hud-screens-57638b`).
- `docs/engine-notes.md` and `.r7/README.md` say agents built against stubs: a `src/dev-stubs.js` fallback existed and was later removed (see Phase 3).
- Footage index (clip 2): the four build agents appear on a "build" canvas; three permission cards appear at once and Hunter allows them. Clip 3 records Hunter telling each agent to merge its own branch ("merge this to main, not me").

## Phase 3: Integrate and playtest (Opus) (Oct 2, 18:12-18:46)

**What changed**
- `548e81b` merged the six earlier branches into `orbit/integrate-playtest-opus-e08bc6` locally.
- `2adb734` (18:34): 16 files, +831/-321. It deleted `src/dev-stubs.js` (198 lines), rewrote `src/game.js`, `src/main.js`, `src/physics.js`, `src/stages.js`, added `tests/pace.mjs` (215 lines), `tests/smoke.mjs` (304 lines) and `tools/serve.mjs` (35 lines), and extended `docs/engine-notes.md` and `README.md`.
- Squash-merged as **PR #7** (`3be8a18`, "Integrate modules, wire perks/pause/shake, tune pacing, add tests"). `3c40a6d` first merged `origin/main` (module PRs #1-#6) into the branch.

**What was decided**
- Pacing was tuned with a headless bot. `docs/engine-notes.md` (as of `2adb734`) records: `absorbEfficiency` 0.4 to 0.14; the `minMass` ladder changed from `0, 20, 80 ... 3.2M` to `0, 3, 12, 45, 170, 650, 2500, 10k, 38k, 140k, 500k, 1.8M`; "before tuning, stages 1-4 took ~15 s each, stage 0 ~40 s, and runs stalled at stages 5-7 behind permanent chasers". Resulting measured bot median full run: 13:29 (precise bot), 15:46 (sloppy bot).
- The model for this agent was Opus. The task name is "Integrate & playtest (Opus)". Footage index (clip 4): Hunter stopped the Sonnet integrator and switched to Opus 5.5 at medium effort.

**What went wrong**
- Footage index (clip 5, 0:10-0:30): the merge had problems and Hunter "had to run something in terminal"; the merge then succeeded. Git confirms an odd history: `3c40a6d` "Merge origin/main (module PRs #1-#6, identical content to the local module merge)".
- The same doc states the bots "barely get hit (0-1 hits per run), so the sims say little about how dangerous threats feel to a human" (`docs/engine-notes.md`, Pacing section).
- Footage index (clip 5): Hunter's first look at the 2D game: "I was hoping for better", no sound effects, wants it to look better, wants more gravity, then "not bad, I can work with it". The "playtest" in the Orbit task name was an automated bot and smoke test (`tests/smoke.mjs`, `tests/pace.mjs`); the footage index (chapter table) says no footage shows an agent playing the game. The Scriptwriter's later note (`2b2a6a8` commit body) says Harbor (the integrator) "played the game on its own, off camera".

## Phase 4: Space Realism Research (Oct 2, 19:26-19:41)

**What changed**
- `e657a77` (19:26, author "R7 Repo Notes") added `.r7/README.md`, `.r7/decisions.md`, `.r7/changes/2026-10.md`. These are repository notes written by R7 itself, covering only the 11 commits up to `3be8a18`.
- `e3e31b2` + `265f575` added `docs/space-realism-research.md` (743 + 13 lines). Merged as **PR #8** (`984e196`, "Space realism research and plan of attack"). The doc is now 92,113 bytes.
- `2be371c` added `docs/interfaces.md` (452 lines, now 40,029 bytes) and `867cee9` added 12 reference screenshots in `docs/references/` (all 0 text lines, they are images dated 2026-10-02 19:34-19:36 by filename). Merged as **PR #9** (`35ccd9c`, "Add interfaces contract and reference images").

**What was decided** (`docs/space-realism-research.md` §6, quoted from the doc)
- The 2D build had a visual bug: asteroids "showed fire". §0.2 traced it to `src/render/palette.js` / `src/render/index.js`: stages 0-3 had `thruster: true`, producing teardrop streak particles in `#FFD9A0` and an orange `#FFB067` heat arc. The doc says it was a deliberate art choice applied to a body in vacuum. §6.7 describes a hotfix.
- Plan: six workstreams with strict file ownership (W1 creative direction, W2 engine/3D renderer, W3 procedural universe, W4 physics, W5 UI, W6 sound), contracts frozen in `docs/interfaces.md` ("Contract version: 1"), 2D kept running until 3D passes a smoke test (§6.1).
- §6.8 "Decisions taken (user delegated: 'use your best judgment and whatever you recommend')": Gas Planet = brown dwarf; movement is "gravitational steering"; angled top-down camera with toggle; voids plus beacon, no wall, with "Event Horizon" meaning capture by a larger black hole; vendored Three.js through an importmap, no bundler; mid-range integrated GPU at 60 fps target; 2D lite mode retained.
- The doc's confidence tags: only tooling facts in §4 were web-verified; physics constants are tagged [K] (from memory), not re-verified (§0). The doc used two web searches.

**Process note:** the research agent's branch only contained `README.md`, so it read `docs/` and `src/` from `origin/main` at `3c40a6d` (§0 "What was read").

## Phase 5: "Phase 3": five specialists in parallel (Oct 2, 19:47 to Oct 3, 10:16)

The Phase-3 agents committed on the evening of Oct 2; their PRs were opened and merged the next morning.

| Task | Agent commit (Oct 2) | Size | PR (Oct 3) |
|---|---|---|---|
| Sound Designer | `815de5e` 19:47 | 8 files, +1687 | #11 `a257a73` (09:27) |
| Creative Director | `198da5d` 19:54 | 3 files, +1461 (art bible, material spec, `looks.js`) | #10 `b3f015e` (09:27) |
| UI Designer | `b3a78e1` 20:11 | 7 files, +2223/-774 | #14 `f88a306` (10:10) "UI: holographic sci-fi HUD redesign (2D + 3D contract)" |
| Engine & 3D Renderer | `ca19b83` 20:25 | 105 files, +18,365 | #13 `54f6d1b` (09:37) |
| Simulation & Infinite Universe | `7a08649` 21:22 | 18 files, +4124/-3 | #12 `07087f7` (09:28) "SIM: deterministic infinite-universe simulation (src/sim) + tests" |

Files created (verified with `git ls-files`): `docs/art-bible.md`, `docs/material-spec.md`, `docs/audio-direction.md`, `docs/ui-direction.md`, `src/audio/*`, `src/render3d/*`, `src/sim/*`, `src/data/looks.js`.

**What went wrong / was reversed**
- **Merge conflicts.** The #13/#14 squash-merges needed manual resolution. Commit bodies record it: `3bf1f65` / `f88a306` ("Conflict: src/ui/index.js. Kept the redesigned UI and ported main's #7 change"), and a conflict in `src/main3d.js` described as "add/add: this branch carried Lark's pre-merge copy", resolved "by taking main's version and re-applying only the two UI wiring fixes". Footage index (clip 7): "It's a new day. There were some merge conflicts" between the Engine and UI agents; Orbit sent follow-ups to each agent; "Lark has merged, no conflicts, now we're waiting on Juno".
- **3D silently fell back to 2D.** `9b3270a` (**PR #15**, Oct 3 10:16, "Fix: track vendor/three/build so ?renderer=3d stops falling back to 2D"): `.gitignore` had `build/`, which ignored `vendor/three/build/`, so Three.js was not in the repo. The fix changed `build/` to `/build/` and committed `three.core.js` (60,586 lines) and `three.module.js` (19,719 lines): +80,306 lines (`5b7775b`). This single commit is why the repo's line total is dominated by vendor code (see numbers).
- **Merge history cleanup.** `d15cfa9` "Merge old branch history (already squash-merged in #13); tree = main + gitignore fix".

## Phase 6: "Phase 4": make 3D the default (Oct 3, 10:40-11:24)

| Task | Agent commit | PR |
|---|---|---|
| README & run scripts | `5688589` 10:40 (3 files, +118/-22; adds `docs/how-to-play.md`) | #16 `7f9032a` 10:55 |
| 3D renderer polish & performance | `68ae110` 10:51 (6 files, +108/-34) | #17 `9d2375c` 11:00 |
| Integrate 3D as default | `ad5f1ff` 11:04 (5 files, +416/-27, by Hunter, Opus 5.5 co-author) | #18 `d005fef` 11:20 "Cutover: 3D is the default build; fix main3d wiring; add 3D smoke test" |
| Sim progression & balance | `314ea25` 11:14 (5 files, +240/-6) | #19 `a62c74c` 11:24 |

**What changed** (from the `ad5f1ff` commit body)
- `src/boot.js` `DEFAULT_RENDERER = '3d'`, with `?renderer=2d` and a WebGL2 fallback kept. Confirmed in `src/boot.js:3` at HEAD.
- `src/main3d.js` wiring fixes: settings drive audio mute and trajectory; audio unlock on any gesture; Esc/T handled once; removal of a stacked death slow-motion; cached renderer view.
- `tests/smoke3d.mjs` added: headless CDP test of the real 3D game, covering boot, audio unlock, input, absorb/hit/evolve/choice, pause, settings, chunk streaming, death/restart and the 2D and no-WebGL2 fallbacks. `tests/smoke.mjs` was pointed at `?renderer=2d`.
- `docs/sim-balance.md` (from `314ea25`): a headless bot played 24 seeds; 18/24 finished all 12 stages (median 14:55), 6 deaths, 0 stuck. Config was left unchanged. The doc also records two sim tests that had been failing on `main` because they predated later changes, fixed in this PR with no sim code touched. An early stuck run (seed 13) was traced to a bot issue, not a game bug.

**Caveats / what was wrong**
- The `ad5f1ff` commit was authored by the human's account with a `Claude Opus 5.5` trailer. It is not a task-branch `orbit:` commit. I cannot say from git whether Hunter wrote it or directed an agent to.
- The README is stale about the default renderer: `README.md` still says "`/index.html` | The game (2D renderer by default)" while `src/boot.js` defaults to 3D. The README was written in `5688589` (10:40), 24 minutes before the cutover `ad5f1ff` (11:04).
- Footage index (clip 8, 0:00-0:20, 2:26-4:17): Hunter describes starting "phase four" with "audio didn't work and 3D wasn't loading". Playing the 3D build he found it near-unplayable and overwhelming, said "the 2D version is better", and "the first version was better... I'm just gonna not continue it". The cost screen shows **$445.97** in API-equivalent usage, and Hunter says it used about 17% of his weekly Max plan allowance. These are statements in the footage index, not repo data.

## Housekeeping: the Oct 3 12:22-13:01 "Integrate" block

Sixteen commits titled `Integrate orbit/<branch>` (Author "Orbit", Oct 3 12:22-13:01), plus `Merge branch 'main' into ...` commits by Hunter and `1807f1b` "Resolve package.json conflict markers: keep test:smoke and test:balance". I diffed each against its first parent (`git diff <c>^1 <c>`): 8987de1, 983f757, 230907a, 81b14df and f2fc647 are empty, i.e. they only mark branches already merged by PR. Only `fbc0b48` (3 lines changed) differs. These are Orbit's bookkeeping for branches whose work had already landed via squash-merge PRs. They are not new work. Note the squash-merges meant the original branches' commits were never ancestors of `main`; these merges make them so.

---

## Phase 7: Polish pass (Oct 3, 13:31-14:14)

All four tasks were agent commits integrated locally by Orbit (`Integrate orbit/...`), with **no PR number in git**.

**Remove radar and hide cursor.** `01b85a1` (13:31): 4 files, +8/-87. `src/ui/hud.js` -66 lines, `src/ui/ui.css` -27, plus a one-line change each in `src/main.js` and `src/main3d.js`. Integrated by `ae996aa`. Footage index (clip 8, 1:54-2:00): Hunter: "I'm definitely removing the radar". This is a reversal of the UI Designer's own radar from Phase 5 (`docs/ui-direction.md` is the owner doc; I did not check whether it still describes the radar, see Unverified).

**Remove outlines and simplify background.** Four commits: `b458778` (13:32, 5 files, +19/-67, removes target outlines in `src/render3d/bodies.js` and simplifies `src/render/starfield.js`, `src/render3d/glsl/noise.js`, `src/render3d/sky.js`), then `3604706` (13:43), `e59bd03` (13:47, adds sky/nebula code to `src/render3d/sky.js` and `glsl/misc.js`) and `88a7c5b` (14:14, +128/-22, more `starfield.js`/`noise.js`/`sky.js`). Integrated by `52b6a7c`, `c32b150`, `b4c69be`, `ede1f29`. Four integrations of one task show it was iterated. Footage index: clip 9 (8:11-8:28) "feels like we're in a void or underwater", then "flat speckles" (11:33-11:50), then clip 10 (2:14-2:31) a new purple/teal nebula: "this looks a lot better, I like this a lot actually".

**Evolution choice previews.** `c694d41` (13:34): 7 files, +132/-9; new `src/render3d/preview.js` (93 lines), changes in `src/ui/index.js`, `src/sim/index.js`, `src/stages.js`. Integrated by `ecbef51`. Footage index (clip 9, 7:32-7:50): Hunter wanted "images so you can see what you'll evolve into" and noted they looked "a little pixelated".

**Add gravity and absorption.** `c9c6b7f` (13:35): 4 files, +71/-4. Adds tunable gravity constants and `gravityPull`/`capPull` to `src/physics.js` (2D), a gravity pass in `src/world.js`, and in `src/sim/index.js` (3D) makes the **player a gravity source** that drags smaller free bodies and receives the reaction. Integrated by `6940109`.
- **Stopped part-way?** The task brief describes this one as stopped part-way. The repo shows **one commit, 71 lines, and no later commit on that branch**; the code in it is coherent (constants, functions, wiring in both sims). It adds no tests and no doc. The branch name `add-gravity-and-absorption` implies absorption work too, but the diff only contains gravity code. I did not find any "absorption" change in this commit. I cannot confirm from git that it was *stopped*, only that it is small and has no follow-up.
- Why it mattered to the story: footage index repeatedly records Hunter asking for more gravity: clip 5 (2D: "there's a little bit of gravity... there should be more"), clip 8 (1:18-1:35, 3D: "no gravity though"), clip 9 (5:22-6:13: "I guess its gravity isn't strong enough"). Clip 9 (9:42-10:04): Hunter wanted to ram big asteroids to break off pieces and capture them. Clip 10 (2:31-2:48): he decides to skip the original game's "capture" feature (the README keeps Q = Capture as locked: "shows as locked unless the host wires it up").

## Phase 8: Dev tools (Oct 3, 14:26-14:34)

**Developer start menu.** `b28c949` (14:26): 7 files, +323/-12. New `src/devstart.js` (34 lines), `tests/devstart.test.mjs` (80 lines), UI additions in `src/ui/index.js` (+124), `src/sim/index.js` (+50), smoke-test additions. `a36bcf1` (14:34): 9 files, +132/-8 (audio, input, render hooks, more tests). Integrated by `3596cf1` and `5255983`.
- Purpose, per footage index (clip 10, 1:28-1:45): Hunter asked for a menu "to start as any planet/evolution stage so I can test them". Clip 11 (0:01-0:20) confirms it was done and also that a "back-to-main-menu button" was added to the pause menu. I did not verify the pause-menu button in code.
- Clip 11 (1:50-2:14): Hunter's verdict after starting directly as a Black Hole: "so far I'd say the clone is a big success".

## Phase 9: Video (Oct 3, 15:18-19:07)

This phase turned Hunter's 11 screen recordings (54:17 total, 1080p, per the footage index; the videos are untracked and not in the repo) into an edited vlog using agents.

| Task | Commits | Result in repo |
|---|---|---|
| Footage Analyst | `22a35e8` (15:18, **473 files, +38,112**: transcripts, ~345 frame JPEGs, index), `49c3631`, `4e9984d`, `2158db8` (105 files, -179: removed frame files) | `docs/video/analysis/` (footage index, speaker labels, word-timed transcripts for 11 clips). Integrated `5df3517`, `76b64a9`, `1ead0cd` |
| Brand & Asset Collector | `d769dd0` (15:18, 34 files, +822), `98aec71`, `4c16046` (higher-res logo masters, SVGs), `8ab0f8b`; Hunter's `9948f02` (15:52, "brand kit for the Vesper Drift vlog", recorded production decisions) | `docs/video/brand-kit/` (brand guide, `theme.ts`, fonts, backgrounds, 8 game screenshots). Integrated `9a643d5`, `7f25fe3`, `5fa1b95` |
| Scriptwriter | `175b304` (16:14, Hunter's account, Opus 5.5 trailer): "92 beats across 7 chapters, 7:55 total"; `2b2a6a8` (16:24) applies Hunter's notes | `docs/video/script/script.md`. Integrated `d608f83`, `5021695` |
| Remotion Editor (rough cut) | `1e4f37f` (16:52, 26 files, +12,100: Remotion project, EDL builder, proxies, verify script); agent commits `17e25e4` (17:13), `a8da442` (17:17, +1173/-1475), `60a3f1a` (17:37); `5b43b78` (18:05); `43ed14b` (19:07, 14 files, +3307/-2385) | `video/` (Remotion project, 26 tracked files). Integrated `31abb62`, `1ec36ce`, `d3136e2`, `37d127f`, `b094227` |

**What was decided** (commit bodies)
- Hunter's cut decisions, `docs/video/analysis/footage-index.md`: skip a profanity at clip 1 13:55-14:06; subtitles word-for-word with filler removed; agent TTS voices kept; 1080p 16:9; music comes from the game's own audio (only clips 8-11 captured game sound).
- `2b2a6a8`: keep the "how space actually works" narration over a star-stage brand asset; chapter-6 QA beats explain through narration that the integrator "worked and played the game on its own, off camera", shown with its card and summary, not with gameplay.
- `5b43b78`: no new recordings; "narration" lines are on-screen text only; footage clean and full-frame (scanlines, glow, vignette removed); agent names fixed (Quasar, Laika, Atlas); beats lengthened for reading time (8:03 to 8:16).
- `43ed14b`, "Hunter's notes on the final 1080p": the story was **re-cut chronologically** (research, first team, merging/QA/version 1, Phase 3 specialists going 3D, the comeback, the game), with new bridging beats (8a, 64a-64c, 65, 66a, 69, 70a, 73a, 84); Hunter's personal "R7" smart-assistant exchange removed ("not R7 Orbit"); every spoken beat holds at least 0.6 s after the last word; footage dissolves (8 frames between beats, 4 at joins) replace hard cuts; flicker fixed by removing `backdrop-filter` on glass panels. Result stated in the commit: **final 1080p 10:51.3, all checks pass**.

**What went wrong / was reversed**
- Footage index: the Footage Analyst found the "how space really works" research and the QA agent playing the game are essentially absent from the footage (chapter table, "Weak" ratings). The Scriptwriter worked around this with brand assets and narration (`2b2a6a8`).
- First-pass Remotion render needed several fix rounds: three agent commits in one hour (`17e25e4`, `a8da442`, `60a3f1a`) then two human-authored feature commits (`5b43b78`, `43ed14b`). `video/README.md` documents "verify" checks that were added (runtime ceiling, profanity window, subtitle timing, name spelling, reading time, flicker).
- The target runtime drifted: script said "target ~8:00, limit 10:00" (`script.md` header) and 7:55 at first (`175b304`), then 8:03, 8:16, and finally 10:51.3 (`43ed14b`). `video/README.md` (Runtime) says "Hunter agreed a little over 10:00 is fine, so `verify` passes up to 11:00".
- The rendered MP4s are not tracked in git (I looked for `*.mp4` / `*.mov` in `git ls-files`: none). I only have the commit messages' word that they were rendered.

---

## Notable numbers (measured by me on `main` / HEAD `b094227`)

| Measure | Value | How measured |
|---|---|---|
| Commits, all branches | 126 | `git log --all --oneline \| wc -l` |
| `orbit/*` branches | 28 (every tip merged into `main`) | `git branch` |
| Tracked files | 628 | `git ls-files \| wc -l` |
| Of which: docs / vendor / src / video / tests | 435 / 86 / 60 / 26 / 13 | `git ls-files \| sed 's#/.*##' \| uniq -c` |
| Net change since initial commit | 628 files, +168,502 / -3 | `git diff --shortstat 3369890 HEAD` |
| Game source JS (`src/**/*.js`) | 54 files, 13,408 lines | `wc -l` |
| `src/sim` / `src/render3d` / `src/render` | 2,858 / 3,026 (all file types) / 2,700 lines | `wc -l` |
| Tests | 13 files, 2,962 lines | `git ls-files tests` |
| Markdown docs in `docs/*.md` | 11 files; 3,661 lines across all tracked `docs/**/*.md` | `wc -l` |
| Vendored Three.js | 95,548 lines across 86 tracked files | `wc -l` |
| Remotion `.ts/.tsx/.mjs` under `video/` | 1,886 lines | `wc -l` |
| Evolution stages | 12 in `src/stages.js`; 6 ending ids (`stellar_fragment`, `event_horizon`, `quantum_cosmos`, `cradle_of_life`, `creator_god`, `black_hole`) | read `src/stages.js` |
| PRs visible in git | 19 (#1-#19) | commit subjects |
| Work window | 2026-10-02 17:26 to 2026-10-03 19:07 (about 25.7 hours elapsed, with an overnight gap between 21:22 and 09:27) | commit timestamps |
| Bot balance run | 24 seeds, 18 finished, 6 died, 0 stuck, median 14:55 | `docs/sim-balance.md` (reported by the doc; I did not rerun it) |
| Cost of the build | $445.97 API-equivalent, ~17% of weekly Max plan | footage index clip 8 only; not in repo data |
| Footage | 11 clips, 54:17 | footage index |

I did **not** run `npm test`, the smoke tests, or the game, so I make no claim that tests pass or that the game works at HEAD.

The big vendored `three.*.js` files make raw line counts misleading; use the "Game source JS" row (13,408) for the game itself.

---

## Unverified / not found in repo

1. **PRs #20 to #24.** I found no git evidence for them: no `(#20)`-style subject, no "Merge pull request" commit, and `git log --all --grep='#2[0-4]'` returned nothing. The post-#19 phases (Polish pass, Dev tools, Video) appear only as local `Integrate orbit/...` commits. `gh` is not installed here and I cannot fetch GitHub, so the PR list could not be checked directly. Do not map PR numbers to those phases without checking GitHub.
2. **PR titles/descriptions beyond what is in commit messages.** Squash-merge commit bodies list the agent commits; no PR description text is in the repo.
3. **Agent names and their roles** (Atlas, Briar, Cedar, Dune, Fern, Harbor, Iris, Juno, Kestrel, Lark, Voyager, Quasar, Polaris, Rigel, Laika). Only Lark appears in git (a commit body). The rest are from the footage index, which depends on videos not in the repo.
4. **Which model ran which task**, apart from: "(Opus)" in the Integrate & playtest task name; `Claude Opus 5.5` / `Claude Sonnet 5.5` co-author trailers on specific commits (not mapped to tasks beyond what is quoted above); and footage index statements (Sonnet 5.5 medium to build, Opus 5.5 high to polish; Opus for the integrator and the Phase 3 Creative Director).
5. **Why the first build was 2D** when Hunter said "3D like the original" (footage index, clip 1). No decision record found.
6. **Whether "Add gravity and absorption" was stopped part-way** (see Phase 7). Repo shows one small commit with no absorption change and no follow-up; "stopped" is from the task brief, not from git.
7. **What exactly the human did vs. directed an agent to do** on the commits authored under "Hunter" (e.g. `ad5f1ff`, `175b304`, `1e4f37f`, `5b43b78`, `43ed14b`). Git shows only the author and a model trailer.
8. **The $445.97 cost, the 17% Max-plan figure, the "Opus did not cook" reaction, and all of Hunter's spoken quotes.** They come only from `docs/video/analysis/footage-index.md`, which summarises recordings I cannot see; I did not verify them against the transcripts in `docs/video/analysis/transcripts/`.
9. **Whether the 3D game was ever judged playable after Phase 4** other than via footage-index clips 9-11 ("very impressed", "the clone is a big success").
10. **Player-visible results of any change** (the radar really gone, outlines gone, previews rendering well): I only read diffs, never ran the game.
11. **Whether `docs/ui-direction.md` and `README.md` were updated after the radar removal / 3D cutover.** I confirmed only that the README still calls 2D the default.
12. **The `asset-quote-scout-7f2592` branch.** It exists locally with its tip at `b094227` (same as `main`) and no commits of its own. No Orbit task by that name is in your phase list and I found no content for it.
13. **Final video files and their existence.** The commit messages mention a rough render and a 1080p final (10:51.3) but no media is tracked. I did not check the main checkout's `video/out/`.
14. **Total number of agents, total tokens, total hours of agent work.** Not recorded in the repo. The 25.7-hour figure is just first-to-last commit.
15. **The meaning of `fbc0b48`'s 3-line change** (the only non-empty one of the Integrate commits I checked); not inspected.
