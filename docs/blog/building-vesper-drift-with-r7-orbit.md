---
title: "Building Vesper Drift with R7 Orbit"
subtitle: "What actually happened when I directed a team of AI agents to build a browser game, including the parts that went wrong"
author: Hunter Newton
date: 2026-10-04
tags:
  - R7 Orbit
  - AI agents
  - game development
  - Claude
  - git worktrees
  - Three.js
summary: "Over two days I directed Claude agents in R7 Orbit, each in its own git worktree, to build Vesper Drift, a browser space-evolution game. This is the real order of events: a 2D first build I didn't ask for, a 3D rebuild that came out unplayable, a small polish pass that saved it, and an agent-made video about the whole thing."
# featuredImage: docs/video/brand-kit/screenshots/07-hud-black-hole.png
---

Vesper Drift is a browser game where you start as a pebble in space and grow, one absorbed body at a time, into a black hole. I built it by directing AI agents in R7 Orbit, a desktop app where I hand tasks to Claude or Codex agents. Each agent works in its own git worktree on its own `orbit/*` branch, and its work comes back to `main` through a pull request.

I said on my recording at the start that I was going to "sit the passenger seat for this one". That turned out to be only half true. The agents wrote nearly all of the code. I made the calls that changed the direction of the project, and some of those calls were reversals.

The git history covers 2 October 2026 at 17:26 to 3 October at 19:07, with an overnight gap. It has 126 commits across 28 `orbit/*` branches. This post follows that history in order, because the order is the story.

![Vesper Drift at stage 12 of 12, the black hole, with the holographic HUD and Target Analysis panel](docs/video/brand-kit/screenshots/07-hud-black-hole.png)

*Stage 12 of 12: the black hole, in the 3D build that shipped.*

## The whole thing at a glance

| Phase | When (2026) | Orbit tasks | PRs |
|---|---|---|---|
| Plan | Oct 2, 17:26-17:40 | Game Design Research; Creative Director | #1, #2 |
| Build (4 in parallel) | Oct 2, 17:43-18:08 | Core engine; Stages & choices; Renderer & VFX; HUD & screens | #3-#6 |
| Playtest | Oct 2, 18:12-18:46 | Integrate & playtest (Opus) | #7 |
| Research | Oct 2, 19:26-19:41 | Space Realism Research | #8, #9 |
| "Phase 3" (5 in parallel) | Agents Oct 2, 19:47-21:22; PRs Oct 3, 09:27-10:16 | Creative Director; UI Designer; Sound Designer; Engine & 3D Renderer; Simulation & Infinite Universe | #10-#15 |
| "Phase 4" | Oct 3, 10:40-11:24 | README & run scripts; 3D renderer polish & performance; Integrate 3D as default; Sim progression & balance | #16-#19 |
| Polish pass | Oct 3, 13:31-14:14 | Remove radar and hide cursor; Remove outlines and simplify background; Add gravity and absorption; Evolution choice previews | merged locally |
| Dev tools | Oct 3, 14:26-14:34 | Developer start menu | merged locally |
| Video | Oct 3, 15:18-19:07 | Footage Analyst; Brand & Asset Collector; Scriptwriter; Remotion Editor (rough cut) | merged locally |

"Phase 3" and "Phase 4" are the names I used at the time. They don't match the row numbers.

## Plan

The repo started with an initial commit of two files and 11 lines. The first two agents wrote documents, not code.

The Game Design Research agent wrote `docs/game-design.md`. It identified the game I meant as *Drifter Star: Evolution* (Kayla Studio, released 2025-12-10) and asked me to confirm. It was also upfront about how little it could read:

> "Controls, camera, numeric stats, upgrade lists and enemy behaviour are therefore mostly not confirmed."
>
> — `docs/game-design.md`

Two Steam guide pages returned HTTP 429. The 12-stage ladder, Meteorite to Black Hole, came from a Steam review, and it is still the ladder in the game today.

The Creative Director agent wrote `docs/creative-direction.md`. That is where the name Vesper Drift comes from, along with the one-line pitch I still like best:

> "a quiet, luminous drift through a dark sky where you grow from a glowing pebble into a black hole, and every size feels different."
>
> — `docs/creative-direction.md`

Then came the first decision that didn't stick. Orbit asked me, "2D top-down or 3D like the original?" I answered, "3D like the original." The first build shipped as 2D anyway. Later docs describe the first build as "Top-down 2D" on a canvas (`docs/space-realism-research.md`). I can't find any record of why my answer didn't carry through. It's a good reminder that answering a question in the moment doesn't mean the answer reaches every agent that needs it.

<!-- IMAGE NEEDED: Orbit asking "2D top-down, or 3D like the original?" Capture from raw clip 1 at about 9:40: ffmpeg -ss 580 -i 1.mp4 -frames:v 1 question.png. Crop out taskbar notifications. -->

*Orbit asks the 2D-or-3D question. I said 3D. The first build was 2D.*

## Build: four agents at once

Next I started four build agents in parallel, each on its own branch: core engine, stages and choices, renderer and VFX, and HUD and screens. Their commits landed between 17:43 and 18:06, and all four PRs (#3 to #6) were merged in the same minute, 18:08. Together that was about 5,400 added lines in roughly 25 minutes.

Three permission cards came up at once and I approved them. When it was time to merge, I told each agent to do it itself: "Go ahead and merge this to main."

There was a catch. Because the four ran at the same time, none of them had the others' real code. They built against stubs, and a `src/dev-stubs.js` fallback held things together until the next agent removed it.

The progression they built is one data table. This is the current version in `src/stages.js`; the numbers were tuned in the next phase:

`src/stages.js`
```js
export const STAGES = [
  { id: 'meteorite',       name: 'Meteorite',       minMass: 0,       radiusScale: 1,    worldScale: 1,    spawnMix: { prey: 0.80, threat: 0.05, neutral: 0.15 } },
  { id: 'asteroid',        name: 'Asteroid',        minMass: 3,       radiusScale: 2,    worldScale: 2,    spawnMix: { prey: 0.75, threat: 0.10, neutral: 0.15 } },
  { id: 'dwarf_planet',    name: 'Dwarf Planet',    minMass: 12,      radiusScale: 4,    worldScale: 4,    spawnMix: { prey: 0.70, threat: 0.15, neutral: 0.15 } },
  { id: 'rocky_planet',    name: 'Rocky Planet',    minMass: 45,      radiusScale: 8,    worldScale: 8,    spawnMix: { prey: 0.65, threat: 0.20, neutral: 0.15 } },
  { id: 'gas_giant',       name: 'Gas Giant',       minMass: 170,     radiusScale: 16,   worldScale: 16,   spawnMix: { prey: 0.60, threat: 0.25, neutral: 0.15 } },
  { id: 'gas_planet',      name: 'Gas Planet',      minMass: 650,     radiusScale: 32,   worldScale: 32,   spawnMix: { prey: 0.55, threat: 0.30, neutral: 0.15 } },
  { id: 'dwarf_star',      name: 'Dwarf Star',      minMass: 2500,    radiusScale: 64,   worldScale: 64,   spawnMix: { prey: 0.55, threat: 0.30, neutral: 0.15 } },
  { id: 'star',            name: 'Star',            minMass: 10000,   radiusScale: 128,  worldScale: 128,  spawnMix: { prey: 0.50, threat: 0.35, neutral: 0.15 } },
  { id: 'giant_star',      name: 'Giant Star',      minMass: 38000,   radiusScale: 256,  worldScale: 256,  spawnMix: { prey: 0.50, threat: 0.35, neutral: 0.15 } },
  { id: 'supergiant_star', name: 'Supergiant Star', minMass: 140000,  radiusScale: 512,  worldScale: 512,  spawnMix: { prey: 0.55, threat: 0.35, neutral: 0.10 } },
  { id: 'neutron_star',    name: 'Neutron Star',    minMass: 500000,  radiusScale: 128,  worldScale: 1024, spawnMix: { prey: 0.60, threat: 0.30, neutral: 0.10 } },
  { id: 'black_hole',      name: 'Black Hole',      minMass: 1800000, radiusScale: 256,  worldScale: 2048, spawnMix: { prey: 0.75, threat: 0.15, neutral: 0.10 } },
];
```

<!-- IMAGE NEEDED: the four build agents on one Orbit canvas. Capture from raw clip 2 at 1:00: ffmpeg -ss 60 -i 2.mp4 -frames:v 1 team.png. Crop out the Claude usage page and taskbar. -->

*Four build agents, four branches, one canvas.*

## Playtest

Someone had to wire the four modules together. I started an integrator on Sonnet, then stopped it partway through because I wanted Opus 5.5 at medium effort instead. The task kept that in its name: "Integrate & playtest (Opus)".

That agent's main commit touched 16 files. It deleted the 198-line `src/dev-stubs.js`, rewrote the game loop and physics wiring, and added `tests/pace.mjs` and `tests/smoke.mjs`. The merge itself didn't go smoothly: I had to run something in a terminal before it went through. The history still shows it, with a commit that merges `origin/main` into the branch with "identical content to the local module merge".

"Playtest" in that task name meant a headless bot, not someone playing. According to `docs/engine-notes.md`, before tuning, stages 1 to 4 took about 15 seconds each and runs stalled at stages 5 to 7. After tuning, the bot's median full run was 13:29. The same doc is honest about what that's worth:

> "The bots barely get hit (0-1 hits per run), so the sims say little about how dangerous threats feel to a human."
>
> — `docs/engine-notes.md`

So I was the real playtest. My first reaction on the recording was "I was hoping for better." There were no sound effects, and I wanted more gravity. A bit later I said, "it's not bad I can work with it." That became PR #7, and version 1 was a 2D canvas game.

<!-- IMAGE NEEDED: the 2D build (version 1). Run `npm start`, open http://localhost:8000/?renderer=2d, play to stage 2 or 3, screenshot at 1920x1080 with the cursor hidden. Ideally pair it with a 3D shot at the same stage (?renderer=3d). -->

*Version 1: the 2D canvas build that came out of the first team.*

## Research

Before going further I had an agent look into how space actually works. The trigger was a bug I'd noticed: asteroids looked like they were on fire. The research doc traced it to a thruster flag on the early stages and named the cause plainly:

> "So the 'fire' is a deliberate art choice (a rocket-like exhaust and a re-entry-style heat rim) applied to a body that is in vacuum."
>
> — `docs/space-realism-research.md`

That doc ended up being more than a physics report. It was a plan of attack: six workstreams with strict file ownership, and a frozen contract in `docs/interfaces.md` ("Contract version: 1") that the next team would code against. It also said to keep the 2D game running until 3D passed a smoke test. I delegated the open decisions, and the doc records my words: "use your best judgment and whatever you recommend." The agent chose things like "gravitational steering" as the explanation for movement, an angled top-down camera, Three.js vendored through an importmap with no bundler, and keeping a 2D lite mode.

The doc also states its own limits: only the tooling facts were checked on the web, and the physics constants are tagged as coming from memory.

## "Phase 3": five specialists in parallel

This was the big swing. Five specialists worked at the same time against the contract: Creative Director, UI Designer, Sound Designer, Engine & 3D Renderer, and Simulation & Infinite Universe. They committed on the evening of October 2. I opened and merged their PRs the next morning.

The output was a lot. The Engine & 3D Renderer commit alone was 105 files and +18,365 lines. The specialists also wrote their own direction docs, and the writing is good:

> "The game should read like a calm astrophotograph you can play."
>
> — `docs/art-bible.md`

> "Space is silent, the game is not."
>
> — `docs/audio-direction.md`

The sound agent synthesised everything with the Web Audio API, so the repo has no audio files. The simulation agent made the universe deterministic. Every random number comes from a seeded generator:

`src/sim/rng.js`
```js
/** mulberry32: returns a function giving floats in [0, 1). */
export function makeRng(seed32) {
  let a = seed32 | 0;
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / U32;
  };
}
```

![Vesper Drift title screen with the VESPER DRIFT wordmark, orbital emblem, and INITIATE DRIFT, SETTINGS and DEV START buttons](docs/video/brand-kit/screenshots/01-title.png)

*The title screen from the UI Designer's holographic redesign. The DEV START button came later, in the dev tools phase.*

### What broke

**Merge conflicts.** A shared contract didn't prevent overlap. The Engine and UI branches collided, and the merge commit spells out what happened:

> "Conflict: src/main3d.js (add/add: this branch carried Lark's pre-merge copy). Resolved by taking main's version and re-applying only the two UI wiring fixes"
>
> — commit `3bf1f65`

Orbit sent follow-ups to each agent and they sorted it out, but merging five parallel branches took real time the next morning.

**3D quietly fell back to 2D.** The new entry point falls back to the 2D renderer if 3D fails, and 3D was failing because Three.js wasn't in the repo. `.gitignore` had `build/`, which also ignored `vendor/three/build/`. The fix was one character, plus the 80,306 lines of Three.js it let in:

`.gitignore` (commit `5b7775b`)
```diff
 dist/
-build/
+/build/
 .DS_Store
```

That one commit is why the repo's raw line count is mostly vendor code.

## "Phase 4": making 3D the default

Four more tasks: README and run scripts, 3D polish and performance, integrating 3D as the default, and sim progression and balance. The cutover commit is under my account with an Opus 5.5 co-author line. It set the default in `src/boot.js` and kept the fallback:

`src/boot.js`
```js
async function boot() {
  const q = new URLSearchParams(location.search).get('renderer');
  let mode = q === '2d' || q === '3d' ? q : DEFAULT_RENDERER;
  if (mode === '3d') {
    if (!hasWebGL2()) { console.warn('[boot] WebGL2 unavailable, using the 2D renderer'); mode = '2d'; }
    else {
      try {
        const m = await import('./main3d.js');
        await m.start3d();
        return;
      } catch (err) {
        console.warn('[boot] 3D failed, falling back to 2D:', err && err.message ? err.message : err);
        freshCanvas();
        mode = '2d';
      }
    }
  }
  await import('./main.js');
}
```

It also added `tests/smoke3d.mjs`, a headless test of the real 3D game. The balance agent ran a bot over 24 seeds: 18 finished all 12 stages (median 14:55), 6 died, and none got stuck. The one early stuck run turned out to be a bot problem:

> "A gravity fling past a star pushed the bot to 1700+ units/s ... It overshot every small prey and spent 30 minutes in a void."
>
> — `docs/sim-balance.md`

Then I played it. I had opened this phase by saying "some of the audio didn't work and 3d wasn't loading." Once it did load, it wasn't good. From my recording: "this is very overwhelming," "I think the 2d version is better," and "the first version was better." I also said I was probably not going to continue. For scale, I noted that I'd used 17% of my weekly Max plan by then.

One more thing from this phase: the README was written 24 minutes before the cutover, and it still says the game uses the "2D renderer by default". That's stale. `src/boot.js` defaults to 3D.

## Polish pass

I didn't stop. Instead of another big team, I gave Orbit four small, specific tasks. They ran between 13:31 and 14:14 on October 3, and Orbit merged them locally, so they have no PR numbers in git.

- **Remove radar and hide cursor.** +8/-87 lines. The radar was the UI agent's own work from Phase 3, and I took it out: "definitely gonna be removing the radar."
- **Remove outlines and simplify background.** This one took four commits and four integrations. After the first pass I said it felt "like we're in a void or like underwater" and asked for stars back. The last pass added a new nebula, and my reaction was "This looks a lot better. I like this a lot actually."
- **Evolution choice previews.** A new `src/render3d/preview.js` renders what you'd evolve into. They came out "a little pixelated", but they worked.
- **Add gravity and absorption.** I stopped this task part-way. What landed is one 71-line commit, and it only contains gravity code, with no absorption change. It made the player a gravity source:

`src/sim/index.js`
```js
      // the player is a gravity source too: it drags smaller free bodies toward it (finite reach, softened)
      if (playerAlive && G.playerPull > 0 && pm >= bm * G.minRatio) {
        tmp2[0] = 0; tmp2[1] = 0;
        softenedAccel(G, playerMu * G.playerPull, S, player.p[0], player.p[2], bx, bz, tmp2);
        ax += tmp2[0]; az += tmp2[1];
        const back = (bm / pm) * sdt; // Newton's third law: the player feels the (tiny) reaction
        player.v[0] -= tmp2[0] * back; player.v[2] -= tmp2[1] * back;
      }
```

Gravity was the request I made more than any other. I asked for it after the 2D build, then in 3D ("there still is like no gravity though"), then again ("I guess its gravity isn't strong enough"). I also decided to skip the original game's capture feature; the README lists Q = Capture as locked.

<!-- IMAGE NEEDED: before/after of the background pass. "Before": check out a commit before b458778 and screenshot a stage at ?renderer=3d. "After": same stage at HEAD. Same seed, same stage, 1920x1080. -->

*The background pass took four tries to get right.*

## Dev tools

To test late stages without playing for 15 minutes, I asked for a menu to "start as any" stage. The Developer start menu landed in two commits, with `src/devstart.js`, tests, and a DEV START button on the title screen. It also works as a deep link, like `?stage=rocky_planet&form=lava`.

The first thing I did was start as a black hole. On the recording I said: "so far I'd say the clone is a big success." A few hours earlier I'd said "the first version was better."

![The black hole background with the HUD removed](docs/video/brand-kit/assets/backgrounds/bg-stage12-black-hole-clean.png)

*The black hole stage with the HUD removed.*

## Video

I'd recorded the whole process: 11 screen recordings, 54:17 in total. The last phase turned them into an edited video, again with agents. A Footage Analyst indexed and transcribed the clips. A Brand & Asset Collector built a brand kit, including the screenshots in this post. A Scriptwriter wrote the script, and a Remotion Editor built the edit as code in `video/`.

It had its own problems. The Footage Analyst found that the space research and the integrator playing the game were barely on camera, so the Scriptwriter covered them with narration over brand assets. The first render needed several rounds of fixes. The script aimed for about 8:00. After my notes, the cut was rearranged into the order things actually happened, and the final commit reports 10:51.3. I agreed that a little over 10 minutes was fine. I also had an exchange with my personal smart assistant cut, because that assistant is called "R7" and has nothing to do with R7 Orbit. The rendered files aren't in the repo.

![Mock of the making-of video's lower-third and agent subtitle style](docs/video/brand-kit/screenshots/mock-lowerthird-and-agent-subtitle.png)

*A mock of the video's lower-third and agent subtitle style. This is a design mock, not a frame from the final render.*

<!-- IMAGE NEEDED: a poster frame from the final video. Render with `cd video && npm install && npm run render:final` (needs ffmpeg and the raw clips via FOOTAGE_DIR), then ffmpeg -ss 5 -i out/final-1080p.mp4 -frames:v 1 poster.png -->

*A frame from the finished making-of video.*

## What I'd tell someone trying this

- **Questions get answered, then lost.** I said 3D at the start and got 2D. Now I check that a decision made it into a doc the agents actually read.
- **Agents tell you what they don't know. Read it.** The design doc said its facts were mostly unconfirmed. The research doc tagged physics constants from memory. Those warnings were accurate.
- **A bot can test pacing, not fun.** The bot said version 1 paced fine. I didn't think so. The 3D build passed its smoke test and I found it unplayable.
- **Contracts reduce conflicts but don't remove them.** Five agents with a frozen interface and file ownership still collided in `src/main3d.js`.
- **Check git, not just the summary.** 3D "worked" while quietly falling back to 2D, because a `.gitignore` line kept Three.js out of the repo.
- **Docs go stale quickly.** The README still calls 2D the default, and `docs/engine-notes.md` has absorb numbers the current config doesn't use.
- **The fix was smaller, not bigger.** The project turned around with four narrow tasks and a dev menu, not another big parallel team.

## Closing

Vesper Drift exists: 12 stages, six endings, a deterministic universe, and synthesised sound. The game source is about 13,400 lines of JavaScript, plus a lot of vendored Three.js. I didn't write most of that code. What I did was decide what to keep, what to cut, and when something wasn't good enough, including when a lot of agent work was the thing that wasn't good enough. That part was still my job.

<!--
FACT-CHECK NOTES: claims I was less than certain of

1. "I said 'sit the passenger seat for this one'", "Go ahead and merge this to main", "I was hoping for better", "it's not bad I can work with it", "this is very overwhelming", "I think the 2d version is better", "the first version was better", "definitely gonna be removing the radar", "like we're in a void or like underwater", "This looks a lot better. I like this a lot actually", "a little pixelated", "there still is like no gravity though", "I guess its gravity isn't strong enough", "start as any", "so far I'd say the clone is a big success", "some of the audio didn't work and 3d wasn't loading": all checked against the auto-generated transcripts in docs/video/analysis/transcripts/*.srt (clips 1, 3, 5, 8, 9, 10, 11), not against the video itself. The transcripts may have recognition errors. Some quotes are trimmed or lightly cleaned (e.g. "I think the the 2d version" became "I think the 2d version"; "it's not bad I can work with it" is preceded by "noticing that").
2. "Orbit asked me, '2D top-down or 3D like the original?'": the transcript (1.srt) labels this line [creator], so I may have been reading Orbit's question aloud. The footage index says Orbit asked it.
3. Why the first build was 2D despite my "3D" answer: no record found. The post says so. Do not add a reason without evidence.
4. "Three permission cards came up at once and I approved them": footage index (clip 2) only.
5. Sonnet integrator stopped and switched to Opus 5.5 at medium effort: from transcript 4.srt plus the footage index. The model used for the original integrator ("Sonnet") is from the footage index only.
6. "I had to run something in a terminal before it went through": footage index (clip 5) only. Git shows only the odd merge commit 3c40a6d.
7. "There were no sound effects, and I wanted more gravity" after the 2D build: transcript 5.srt mentions no sound effects; the gravity request after the 2D build is from the footage index (clip 5).
8. "about 5,400 added lines in roughly 25 minutes": the timeline sums the four stat lines to ~5,456 (17:43-18:08).
9. Pre-tuning pacing ("stages 1-4 ~15 s each, stalled at 5-7") and the 13:29 bot median: from docs/engine-notes.md as of commit 2adb734, a historical measurement. engine-notes.md is flagged as stale elsewhere (absorb efficiency); I deliberately did not quote its 0.14 figure.
10. "The trigger was a bug I'd noticed: asteroids looked like they were on fire": the research doc's §0.2 is titled "The reported bug"; that I was the one who reported it is an inference.
11. "Orbit sent follow-ups to each agent and they sorted it out": footage index (clip 7) only.
12. "I opened and merged their PRs the next morning": the PR merge times are in git (Oct 3, 09:27-10:16). Who clicked merge (me or the agents) is not recorded.
13. The cutover commit ad5f1ff is under my account with an Opus 5.5 trailer. Git doesn't show whether I wrote it or directed an agent; the post only states the authorship line.
14. Phase 4 ordering: the 3D "flop" reactions are from clip 8. I did not confirm whether I played the build before or after the #18 cutover merged (11:20).
15. "I'd used 17% of my weekly Max plan": transcript 8.srt. I left out the $445.97 API-equivalent figure because it appears only in the footage index (an on-screen usage page), not in the transcript or the repo. Add it only after checking the recording.
16. "I stopped this task part-way" (Add gravity and absorption): this comes from my own brief. Git shows only one 71-line commit with gravity code and no absorption change, and no follow-up commit. Git does not record the stop.
17. "I decided to skip the original game's capture feature": footage index (clip 10) plus the README's locked Q = Capture. Not otherwise recorded.
18. Polish and dev-tools results (radar gone, outlines gone, previews rendering, DEV START button working): the tasks are confirmed from diffs, and DEV START is visible in 01-title.png. Nobody ran the game for this draft to confirm the rest.
19. Polish, Dev tools and Video "merged locally, no PR numbers": no #20-#24 in git, but GitHub was not checked. PRs may exist there.
20. (Removed from the body for length) The 16-commit "Integrate" block on Oct 3 12:22-13:01 is bookkeeping per the timeline. Five were checked as empty diffs and only fbc0b48 (3 lines) differed. Not every one was inspected.
21. Video: "the final commit reports 10:51.3" and "I agreed a little over 10 minutes was fine" come from commit 43ed14b and video/README.md. No MP4 is tracked, so the final render's existence and length are unverified.
22. Screenshot images: 01-title.png and 07-hud-black-hole.png were viewed by the asset scout. bg-stage12-black-hole-clean.png and mock-lowerthird-and-agent-subtitle.png were not viewed, so check them before publishing. Image paths are repo-root-relative; adjust them for the blog's hosting.
23. "about 13,400 lines of JavaScript": the timeline counts 13,408 lines in src/**/*.js. The asset inventory counts 14,107 lines under src/ (all tracked non-HTML files). Pick one definition.
24. "six endings" and "12 stages": from src/stages.js. "deterministic universe" is from the src/sim/rng.js header ("No Math.random, no Date") and the universe.js header comment.
25. Research phase start time: the overview table in process-timeline.md says 19:29-19:37, while its phase heading says 19:26-19:41 (19:26 is the R7 Repo Notes commit). I used 19:26-19:41.
-->
