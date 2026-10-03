# Script: "I built this game by directing a team of AI agents in R7 Orbit"

**On-screen title:** BUILDING A GAME WITH A TEAM OF AI AGENTS
**Runtime:** 8:03 (target ~8:00, hard limit 10:00) · 1920×1080, 16:9, 30 fps · Remotion
**Tone:** casual vlog. On-screen text only, no AI voiceover. Look follows `docs/video/brand-kit/brand-guide.md`.

Built from `docs/video/analysis/` (footage index, speaker labels, word-level transcripts) and `docs/video/brand-kit/`. Every quoted line below was checked against the word-level timestamps in `analysis/transcripts/N.json`.

## How to read the beat table

- **Source.** `clip N` = `N.mp4` in the main checkout's `docs/video/` folder (untracked, read in place). Timestamps are `m:ss.s` *within that clip*. In/outs come from word timings, with about 0.1-0.3 s of handle. A `+` joins two cuts inside one beat. `asset:` paths are relative to `docs/video/`.
- **Duration** is the exact sum of the source in/outs. **Start** and **Running total** assume back-to-back hard cuts (see the Runtime summary for transitions).
- **Hunter's line**
  - `"..."` = Hunter's real recorded words, cleaned of filler words (um, uh, like, you know, repeated starts) but not paraphrased. `...` marks a cut inside the beat.
  - `(reading Orbit)` = Hunter reading Orbit's on-screen text aloud. Subtitle it as Hunter (white), because it is Hunter's voice.
  - `[NARRATION]` = new line, written from Hunter's narration script. **Nothing new is recorded:** the line appears as on-screen text only (typed on, brand style, also in the subtitles), with no voice and no AI voiceover. On these beats the source clip's mic is muted; only the clip's system audio and the game music bed play. The edit lengthens a beat if needed so the text can be read.
  - `[AGENT TTS, Orbit]` = Orbit's built-in text-to-speech, taken from the system-audio stream and kept as-is. Use the agent subtitle style (italic, coloured bar, `◆ ORBIT` label), per brand §7.
  - `(none)` = nothing spoken (game sound or music bed only).
- **Audio streams** (see `analysis/speaker-labels.md`): `a:0` = mix, `a:1` = system audio (game sound, Orbit dings, TTS), `a:2` = mic only. Real-line beats: use `a:2` for the voice, plus `a:1` on clips 8-11. "Mic muted" = drop `a:2` and keep only `a:1` and/or the bed.
- **Subtitles.** Every spoken line, including `[NARRATION]` and TTS, is burned in (brand §7) and exported to a separate `.srt` using the text exactly as in the "Hunter's line" column.
- **Lower-thirds and roster panel** use the role codes and colours from brand §6.5. Hunter's own lower-third uses a white bar, never a colour.
- **Hard rule:** nothing from **clip 1, 13:55-14:06** (profanity). Beat 44 ends at 13:51.9. Every clip-1 range in the table was checked programmatically against that window.

## Chapter overview

| Ch | Chapter | Start | Length | Ends |
|---|---|---|---|---|
| 1 | Cold open | 0:00 | 0:20 | 0:20 |
| 2 | The research | 0:20 | 1:33 | 1:52 |
| 3 | The first team | 1:52 | 0:31 | 2:23 |
| 4 | Pulling it together: merging, QA and version 1 | 2:23 | 1:17 | 3:40 |
| 5 | Hiring the specialists: going 3D | 3:40 | 1:18 | 4:58 |
| 6 | The comeback: 3D, cost, R7 Orbit upgrades, iterating | 4:58 | 3:00 | 7:58 |
| 7 | This is the game + end card | 7:58 | 1:45 | 9:43 |

## Beat table

> **Re-cut (Hunter's notes, story audit).** Chapters now run in the order things happened: research → the first build team → merging, QA and version 1 (2D) → the Phase 3 specialists going 3D → Phase 4, the 3D flop, the cost, R7 Orbit upgrading itself and the iteration loop → the finished game. Beat numbers are kept as IDs (new beats get letter suffixes, e.g. `64a`), so they are no longer in numeric order. Removed: beats 36-37 (Hunter's personal smart assistant "R7", which is **not** part of R7 Orbit) and beat 82 (its sun shot now plays in context in beat 73a). Start / Running total assume hard cuts; the edit (`video/scripts/build-edl.mjs`) also adds breathing room after spoken lines and reading time on on-screen text, so the cut runs longer than this table.

| # | Ch | Start | Dur | Source (clip in-out / asset) | On screen | Hunter's line | On-screen text / lower-third | Running total |
|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 0:00 | 5.0s | clip 11 1:40.0-1:45.0 | Black-hole stage, full-bleed gameplay (cold-open teaser). Audio: game sound only (a:1); mic muted. | [NARRATION] "I didn't want one AI to build my game. I wanted a team." | Narration as burned-in subtitle only | 0:05 |
| 2 | 1 | 0:05 | 2.4s | clip 1 0:04.8-0:07.2 | R7 Orbit start screen "Direct every agent, in one view." in bracketed panel. | "Welcome to R7 Orbit." | Lower-third (white bar): `CREATOR // R7 ORBIT` / **HUNTER** | 0:07 |
| 3 | 1 | 0:07 | 2.8s | clip 1 0:18.5-0:21.3 | Same start screen, slow 1.5% push-in. | "Basically, vibe coding on steroids." | (none) | 0:10 |
| 4 | 1 | 0:10 | 3.5s | clip 1 1:08.5-1:12.0 | Empty canvas with the "orbit-the-game" hub. | "What ideas do I have? I literally have no ideas." | (none) | 0:14 |
| 5 | 1 | 0:14 | 3.0s | clip 2 1:00.0-1:03.0 | Four build agents "working" around the hub (best team-on-one-canvas shot). Mic muted. | (none) | Mono kicker types on: `1 CREATOR // A TEAM OF AGENTS // 1 CANVAS_` | 0:17 |
| 6 | 1 | 0:17 | 3.0s | asset: `brand-kit/assets/ui/vesper-drift-emblem.svg + logo/r7-orbit-mark-gold-transparent-2048.png over backgrounds/bg-stage01-asteroid-clean.png` | Title card (brand §6.3): emblem fades in, status line, title un-blurs, gold R7 mark + "BUILT WITH R7 ORBIT". | (none) | **BUILDING A GAME WITH A TEAM OF AI AGENTS**; status `AGENT SURVEY // 7 ROLES // BUILD LINK ESTABLISHED` | 0:20 |
| 7 | 2 | 0:20 | 2.5s | asset: `brand-kit/assets/backgrounds/bg-stage01-asteroid-clean.png` | Chapter card (brand §6.4): bg-stage01-asteroid-clean.png + stageTints.asteroid overlay, stage ladder advances one tick. | (none) | Kicker `CHAPTER 02/07 // RS`; title **THE RESEARCH** | 0:22 |
| 8 | 2 | 0:22 | 5.5s | clip 1 0:30.0-0:35.5 | "Open a repository" dialog: new repo `orbit-the-game`, "also create on GitHub". Mic muted. | [NARRATION] "So I opened R7 Orbit, and I started like any studio would: with research." | (none) | 0:28 |
| 8a | 2 | 0:28 | 8.1s | clip 1 1:19.9-1:25.3 + clip 1 1:27.5-1:30.2 | Creating the first agent (Sonnet 5.5) and typing the ask for game ideas. | "Create an agent and use Sonnet 5.5, set to high... and help me come up with some..." | (none) | 0:36 |
| 9 | 2 | 0:36 | 3.9s | clip 1 2:13.0-2:16.9 | First agent's list of game ideas (zoom on the text). | "Gravity wells to hit targets using as little fuel as possible. That sounds boring." | Bracket callout on the idea list | 0:40 |
| 10 | 2 | 0:40 | 7.0s | clip 1 2:53.5-2:58.7 + clip 1 3:05.7-3:07.5 | Cut to Steam: Drifter Star: Evolution store page. | "Actually, I have an idea. There's this one game that I like on Steam... There it is, Drifter Star." | Chip: `REFERENCE // DRIFTER STAR: EVOLUTION` | 0:47 |
| 11 | 2 | 0:47 | 7.7s | clip 1 3:28.3-3:36.0 | Prompt being typed to the agent. | "I want to build my own clone version of this, because I'm really creative and have so many ideas." | Amber chip on "creative": `▮ SARCASM DETECTED` | 0:54 |
| 12 | 2 | 0:54 | 2.4s | clip 1 3:55.6-3:58.0 | Chat panel, switching to Orbit. | "Let's just use Orbit to orchestrate it all." | (none) | 0:57 |
| 13 | 2 | 0:57 | 7.9s | clip 1 4:10.6-4:13.4 + clip 1 4:22.6-4:27.7 | Hunter's brief to Orbit in the chat panel (zoom). | "Come up with a plan to create a clone of it... then we'll go from there with a creative director agent to figure out the look and feel." | (none) | 1:05 |
| 14 | 2 | 1:05 | 3.5s | clip 1 4:58.0-5:01.5 | "Game Design Research" (Atlas) and "Creative Director" cards on the canvas. Mic muted. | [NARRATION] "One agent studied what makes a space game fun." | Lower-third (cyan): `AGENT // RS` / **ATLAS: GAME DESIGN RESEARCH** | 1:08 |
| 15 | 2 | 1:08 | 5.0s | asset: `brand-kit/assets/backgrounds/bg-stage08-star-clean.png` | Clean star stage frame, dimmed to ~55% with the title vignette and a slow 1.5% drift (brand §5); faint starfield parallax. Glen's task is not in the recordings, so no footage is used here. | [NARRATION] "Another dug into how space actually works, so the game would feel real." (narration only, see Gaps #1) | Lower-third (cyan): `AGENT // RS` / **GLEN: SPACE REALISM RESEARCH** | 1:13 |
| 16 | 2 | 1:13 | 7.7s | clip 1 5:45.3-5:53.0 | Model picker / canvas. | "I'm sure what we're going to get is going to be very decent at best. Maybe. But Opus crushes it." | Small amber mono chip: `REMEMBER THIS_` (paid off in beat "Opus did not cook") | 1:21 |
| 53 | 2 | 1:21 | 6.0s | clip 1 8:31.1-8:37.1 | Canvas after the research agents completed. | "I'm going to sit the passenger seat for this one, provide a little direction here and there, a little bit of help." | (none) | 1:27 |
| 17 | 2 | 1:27 | 8.0s | clip 1 9:06.2-9:12.9 + clip 1 9:16.1-9:17.4 | Orbit chat panel; Hunter hands over control. | "I want to let you loose, and I want you to just control everything from here on out. I want you to be the orchestrator... and I want you to run the show." | (none) | 1:35 |
| 18 | 2 | 1:35 | 6.1s | clip 1 9:40.2-9:46.3 | Orbit/Briar's question card: 2D top-down or 3D? (Hunter reads it aloud, then answers). | (reading Orbit) "Which is: 2D top-down, or 3D like the original?" / "3D like the original." | Lower-third (violet): `AGENT 01/07 // CD` / **CREATIVE DIRECTOR** (Briar) | 1:41 |
| 54 | 2 | 1:41 | 11.3s | clip 1 12:32.6-12:43.9 | Canvas with cards working. | "If robots ever become real workers, it's going to be so easy to manage them until they get upset. You fire one of their friends and then they try to kill you." | (none) | 1:52 |
| 27 | 3 | 1:52 | 2.5s | asset: `brand-kit/assets/backgrounds/bg-stage04-rocky-lava-clean.png` | Chapter card (brand §6.4): bg-stage04-rocky-lava-clean.png + stageTints.dwarf_planet overlay, stage ladder advances one tick. | (none) | Kicker `CHAPTER 03/07 // TEAM`; title **THE FIRST TEAM** | 1:55 |
| 28 | 3 | 1:55 | 3.5s | clip 2 1:00.0-1:03.5 | Four build agents all "working" at once. Mic muted. | [NARRATION] "They all worked at the same time, on one canvas." | (none) | 1:58 |
| 29 | 3 | 1:58 | 3.1s | clip 2 1:32.0-1:35.1 | Same shot, slow push-in. | "They're probably all doing the same thing. They are." | (none) | 2:01 |
| 30 | 3 | 2:01 | 6.0s | clip 2 1:23.5-1:29.5 | Card IDs (e.g. `build-core-engine-bfc394`) zoomed; motion-graphic overlay: `main` splits into four cyan branch lines, one per agent. Mic muted. | [NARRATION] "Each had its own private copy of the project, so no one could break anyone else's work." | Overlay label: `1 AGENT = 1 BRANCH + 1 WORKTREE` | 2:07 |
| 32 | 3 | 2:07 | 3.5s | clip 2 0:00.0-0:03.5 | Three "Read wants permission: Allow once / Deny" cards at once. Mic muted. | [NARRATION] "When an agent needed permission, the card told me." | Target-bracket callout contracts onto a permission card | 2:11 |
| 33 | 3 | 2:11 | 4.0s | clip 1 4:53.8-4:57.8 | WebSearch permission card; cursor clicking Allow. | "We're going to allow, allow, allow, allow." | (none) | 2:15 |
| 34 | 3 | 2:15 | 3.3s | clip 1 6:21.5-6:24.8 | Agent permissions settings panel. | "I really wish it would stop asking me for permission to do things." | (none) | 2:18 |
| 35 | 3 | 2:18 | 5.2s | clip 2 0:25.0-0:30.2 | Permission cards on Dune and Cedar. | "Go ahead and allow all of these to run free, and we're gonna see what happens." | (none) | 2:23 |
| 41 | 4 | 2:23 | 2.5s | asset: `brand-kit/assets/backgrounds/bg-stage05-gas-giant-clean.png` | Chapter card (brand §6.4): bg-stage05-gas-giant-clean.png + stageTints.rocky_planet overlay, stage ladder advances one tick. | (none) | Kicker `CHAPTER 04/07 // MRG`; title **PULLING IT TOGETHER** | 2:26 |
| 42 | 4 | 2:26 | 3.5s | clip 3 0:01.0-0:04.5 | Four build cards showing "Pull request #... merged". Mic muted. | [NARRATION] "Then came the hard part: pulling it all together." | (none) | 2:29 |
| 31 | 4 | 2:29 | 5.6s | clip 3 0:36.8-0:42.4 | Orbit's chat summary (Hunter reads it aloud). | (reading Orbit) "Next, you need to merge all four branches into main. Each task worktree is separate." | Bracket callout on that sentence in the chat panel | 2:35 |
| 43 | 4 | 2:35 | 5.8s | clip 3 1:14.8-1:20.6 | Agent chat, merge instruction being dictated. | "Go ahead and merge this to main. To main, not me." | (none) | 2:41 |
| 44 | 4 | 2:41 | 4.6s | clip 1 13:40.2-13:43.7 + clip 1 13:50.8-13:51.9 | "Pull request #2 merged" cards. HARD OUT 13:52.0 (excluded window starts 13:55). | "Merge it. Regular merge... Merge it." | Mint chip: `PR #2 // MERGED` | 2:45 |
| 55 | 4 | 2:45 | 6.0s | clip 3 2:10.0-2:16.0 | "Integrate & playtest" card appears on the canvas (zoom on the card). Mic muted. | [NARRATION] "Then I handed one agent the job of playing the game and checking that everything worked together." (adapted from "Last, ...", see Gaps #2) | Lower-third (coral): `AGENT 07/07 // QA` / **HARBOR: INTEGRATE & PLAYTEST** | 2:51 |
| 56 | 4 | 2:51 | 4.4s | clip 4 0:03.5-0:07.9 | Harbor's "Integrate & playtest (Opus)" card, Opus 5.5 medium. | "It was integrating. I stopped it because I wanted to use Opus 5.5 instead." | (none) | 2:56 |
| 57 | 4 | 2:56 | 7.5s | asset: `brand-kit/assets/backgrounds/bg-stage05-gas-giant-clean.png` | Illustration, not a recording: clean gas-giant stage frame (dimmed, slow drift), with a cut-out of Harbor's card (from clip 4) in a bracketed glass panel and a coral meter filling across it (brand §4 meter). No gameplay, so it doesn't look like we're watching Harbor play. | [NARRATION] "From there it worked on its own. It pulled everyone's work together and played the game by itself, off camera." | Mono status line under the card: `QA // HARBOR // RUNNING ON ITS OWN_` | 3:03 |
| 58 | 4 | 3:03 | 4.6s | clip 5 0:03.3-0:07.9 | Harbor's card shows finished; zoom on its summary and "PR #7 merged" in the chat panel. | "The integrate and playtest agent finished." | Mint chips `QA // DONE`, `PR #7 // MERGED` | 3:08 |
| 59 | 4 | 3:08 | 4.4s | clip 5 0:10.1-0:14.5 | Same. | "It had issues actually merging though, so I had to get those fixed." | (none) | 3:12 |
| 60 | 4 | 3:12 | 6.1s | clip 5 0:45.0-0:45.9 + clip 5 0:50.2-0:55.4 | Hunter typing in the chat. | "Is the game ready to be played? And if so, can you open it in the browser?" | (none) | 3:18 |
| 61 | 4 | 3:18 | 4.4s | clip 5 1:05.6-1:10.0 | Title screen: "VESPER DRIFT: Grow from a glowing pebble into a black hole." | "All right, so this is Vesper Drift." | Kicker: `VERSION 1 // 2D` | 3:23 |
| 62 | 4 | 3:23 | 3.8s | clip 5 1:35.7-1:39.5 | First 2D gameplay, meteorite (no game sound exists in clip 5). | "I was hoping for better. I'm also not hearing any sound effects." | (none) | 3:27 |
| 63 | 4 | 3:27 | 2.6s | clip 5 2:31.2-2:33.8 | 2D: evolves to Asteroid. | "I've evolved into an asteroid. Nice." | Stage-up banner style chip: `ASTEROID` | 3:29 |
| 64 | 4 | 3:29 | 3.8s | clip 5 3:32.1-3:35.9 | 2D gameplay / pause screen. | "It's not bad. I can work with it." | (none) | 3:33 |
| 64a | 4 | 3:33 | 7.4s | clip 5 3:40.5-3:45.8 + clip 5 3:47.6-3:49.7 | 2D game / pause screen. | "I'm gonna get some sound effects added, and... fix some other stuff." | (none) | 3:40 |
| 19 | 5 | 3:40 | 2.5s | asset: `brand-kit/assets/backgrounds/bg-stage08-star-clean.png` | Chapter card (brand §6.4): bg-stage08-star-clean.png + stageTints.gas_giant overlay, stage ladder advances one tick. | (none) | Kicker `CHAPTER 05/07 // SPEC`; title **HIRING THE SPECIALISTS** | 3:43 |
| 20 | 5 | 3:43 | 5.5s | clip 6 0:00.0-0:05.5 | "Phase 3" canvas: five agent cards around the hub. Mic muted. | [NARRATION] "Then I hired the specialists. A creative director to set the look and feel." | Roster panel starts building (one row per role, role colours §6.5): CREATIVE DIRECTOR (violet) | 3:48 |
| 64b | 5 | 3:48 | 8.8s | clip 6 0:03.6-0:08.7 + clip 6 0:11.2-0:14.9 | Phase 3 canvas: the five specialist cards working around the hub. | "I have more agents working on the fixes... making things actually 3D." | Kicker: `PHASE 3 // MAKING IT 3D` | 3:57 |
| 21 | 5 | 3:57 | 7.5s | clip 6 0:15.2-0:21.4 + clip 6 0:28.7-0:30.0 | Canvas, then Windows file dialog with the Steam reference screenshots. | "I have a new creative director agent that is going to be referencing the images that I gave it... literally just grab these from Steam." | Lower-third (violet): `AGENT 01/07 // CD` / **CREATIVE DIRECTOR** (Iris) | 4:05 |
| 22 | 5 | 4:05 | 4.5s | clip 7 0:13.5-0:18.0 | Zoom on the Juno (UI Designer) and Kestrel (Sound Designer) cards. Mic muted. | [NARRATION] "A UI designer for the screens. A sound designer for the audio." | Roster rows: `02/07 UI DESIGNER` (cyan, Juno), `03/07 SOUND DESIGNER` (amber, Kestrel) | 4:09 |
| 23 | 5 | 4:09 | 5.0s | clip 2 1:12.7-1:17.7 | Build canvas: zoom on the Core engine (Cedar) and Renderer & VFX cards. Mic muted. | [NARRATION] "An engine agent built the core, and a renderer agent took it into 3D," | Roster rows: `04/07 ENGINE` (mint), `05/07 RENDERER` (magenta) | 4:14 |
| 24 | 5 | 4:14 | 4.0s | clip 6 0:54.0-0:58.0 | Zoom on the "Simulation & Infinite Universe" card. Mic muted. | [NARRATION] "while a simulation agent worked on a universe that never ends." | Roster row: `06/07 SIMULATION` (ice blue) | 4:18 |
| 25 | 5 | 4:18 | 6.1s | clip 6 0:58.9-1:05.0 | Same card, held. | "Yeah, an infinite universe. It's literally right there in front of my face. So everything will be procedurally generated." | (none) | 4:24 |
| 64c | 5 | 4:24 | 6.4s | clip 6 1:10.7-1:17.1 | Same Phase 3 canvas. | "Having actual 3D assets with Three.js. So we'll see how long this takes." | (none) | 4:31 |
| 45 | 5 | 4:31 | 4.6s | clip 7 0:01.4-0:06.0 | Phase-3 canvas: Iris and Kestrel finished, Juno and Lark still open. | "It's a new day. There were some merge conflicts." | 120 ms coral/cyan glitch accent on "conflicts" + coral edge vignette (brand §6.6) | 4:35 |
| 46 | 5 | 4:35 | 4.2s | clip 7 0:07.8-0:12.0 | Target brackets contract onto the Lark (PR #13) and Juno (PR #14) cards. | "Between Lark and Juno here: the engine and 3D renderer, and the UI designer." | Coral chips: `LARK // PR #13`, `JUNO // PR #14` | 4:40 |
| 47 | 5 | 4:40 | 6.0s | clip 7 0:18.0-0:24.0 | Orbit chat: "...if there's a conflict or a failing check... I can send the fix to the agent." Mic muted. | [NARRATION] "When two agents changed the same lines, Orbit sent the problem back to them to sort out." | Bracket callout on that chat line | 4:46 |
| 48 | 5 | 4:46 | 9.3s | clip 7 0:33.3-0:42.6 | Same canvas + chat. | "So I let Orbit know, and then it went ahead and just sent follow-ups to each of them, on its own." | (none) | 4:55 |
| 49 | 5 | 4:55 | 3.2s | clip 7 0:44.5-0:47.7 | Lark card shows merged. | "So Lark is merged, no conflicts. Now we're just waiting on Juno." | Mint chip `LARK // MERGED ✓`; amber chip `JUNO // WAITING_` | 4:58 |
| 52 | 6 | 4:58 | 2.5s | asset: `brand-kit/assets/backgrounds/bg-stage11-neutron-clean.png` | Chapter card (brand §6.4): bg-stage11-neutron-clean.png + stageTints.star overlay, stage ladder advances one tick. | (none) | Kicker `CHAPTER 06/07 // DIR`; title **THE COMEBACK** | 5:01 |
| 65 | 6 | 5:01 | 15.4s | clip 8 0:01.2-0:06.6 + clip 8 0:11.0-0:21.0 | Phase-4 cards on the canvas, then the 3D game loads (0:20). | "I'm back after a little bit, and ended up starting phase four... Whenever I was testing, some of the audio didn't work and 3D wasn't loading, so I got all that fixed. This is the game now." | Kicker: `PHASE 4 // NOW IN 3D` (as the game loads) | 5:16 |
| 66 | 6 | 5:16 | 4.9s | clip 8 0:28.7-0:33.6 | 3D Vesper Drift with sci-fi HUD and radar; game sound. | "Graphics-wise, I like the 3D meteors." | (none) | 5:21 |
| 66a | 6 | 5:21 | 23.4s | clip 8 1:22.9-1:36.7 + clip 8 1:47.3-1:54.3 + clip 8 1:56.7-1:59.3 | 3D gameplay with outlines and radar (game sound). | "There still is no gravity though. Eventually these smaller pieces should just automatically start floating towards me, because I'm the bigger body... Having all these outlines is kinda annoying... So definitely gonna be removing the radar." | (none) | 5:44 |
| 67 | 6 | 5:44 | 2.0s | clip 8 2:31.6-2:33.6 | Chaotic 3D gameplay. | "This is not really playable." | (none) | 5:46 |
| 68 | 6 | 5:46 | 4.4s | clip 8 2:43.2-2:47.6 | Same, overwhelming screen. | "Opus did not cook with this, not gonna lie." | Glitch accent + callback chip (amber, mono): `EARLIER: "OPUS CRUSHES IT"` | 5:51 |
| 69 | 6 | 5:51 | 7.3s | clip 8 3:52.9-3:56.2 + clip 8 4:14.0-4:18.0 | Pause menu / gameplay. | "Oh well. The first version was better... This is more so just to see if I could actually build something with Orbit." | (none) | 5:58 |
| 70 | 6 | 5:58 | 12.8s | clip 8 4:32.4-4:39.4 + clip 8 4:51.8-4:57.6 | Usage screen with **$445.97** and per-agent bars; then the Claude usage page. | "$446... just on this game, which is not playable. Granted, this is not money I'm actually spending... I'm on the Max plan, and I've only used 17% for the week." | Counter animates up to `$445.97` (mono italic); label `API-EQUIVALENT // COVERED BY CLAUDE MAX PLAN` | 6:11 |
| 38 | 6 | 6:11 | 5.0s | clip 8 7:10.6-7:15.6 | Settings, then Sounds panel. The bell plays (system audio present in clip 8). | "So if an agent is waiting on me, I will hear this ding here, that bell." | (none) | 6:16 |
| 40 | 6 | 6:16 | 4.6s | clip 8 7:54.3-7:58.9 | Voice picker preview. | [AGENT TTS, Orbit] *"This is how I will read answers to you."* / "I hate that voice." | Two stacked cues: agent (italic, `◆ ORBIT`) then creator (white, `HUNTER` label to mark the switch back) | 6:20 |
| 70a | 6 | 6:20 | 14.3s | clip 9 0:05.8-0:13.9 + clip 9 0:14.3-0:17.0 + clip 9 0:22.4-0:25.9 | Phase-4 canvas with the new fix cards; EVENT HORIZON end screen at right. | "I made some changes to R7 Orbit itself, not specifically this game... I was having some GitHub issues... I want this to be as autonomous as it can be." | Kicker: `R7 ORBIT UPDATE // MORE AUTONOMY` | 6:35 |
| 71 | 6 | 6:35 | 5.7s | clip 9 1:06.2-1:11.9 | Canvas + "EVENT HORIZON" end screen at right. | "I just played through it. It took 12 minutes. I died to a black hole." | (none) | 6:40 |
| 72 | 6 | 6:40 | 5.6s | clip 9 1:17.0-1:22.6 | Phase-4 cards: "Add gravity", "Remove outlines", "Remove radar"... | "I just gave it a new prompt. As I was playing, I was just telling it things to fix." | Bracket callouts tick across the fix cards | 6:46 |
| 39 | 6 | 6:46 | 2.0s | clip 9 2:17.0-2:19.0 | Settings, then Sounds (clip 9). Agent voice announcement. | [AGENT TTS, Orbit] *"Atlas needs you."* | Agent subtitle style (italic, cyan bar, label `◆ ORBIT`) | 6:48 |
| 50 | 6 | 6:48 | 5.5s | clip 9 2:52.0-2:57.5 | Phase-4 canvas with the GitHub sync banner at the top. Mic muted. | [NARRATION] "Their work flowed into the game on its own, and I decided what went on to GitHub." | (none) | 6:53 |
| 51 | 6 | 6:53 | 8.8s | clip 9 2:57.8-3:05.2 + clip 9 3:11.7-3:13.1 | Hunter tells Orbit to push; the GitHub banner disappears (3:08-3:17). | "Everything here is done. Go ahead, push this to GitHub... All right, so then it's done." | Callout on the banner as it clears | 7:02 |
| 26 | 6 | 7:02 | 8.0s | clip 9 4:05.4-4:13.4 | Orbit's agent summary in the chat panel. | "So you have Voyager, Quasar, Polaris, Laika." | Name chips appear one per name: VOYAGER / QUASAR / POLARIS / LAIKA | 7:10 |
| 73 | 6 | 7:10 | 6.1s | clip 9 8:10.9-8:16.1 + clip 9 8:18.8-8:19.7 | Pause screen over a dark, empty background. | "We need some stars in the background still. It sort of just feels like we're in a void, or underwater." | (none) | 7:16 |
| 73a | 6 | 7:16 | 19.0s | clip 10 0:06.7-0:18.0 + clip 10 0:20.8-0:28.5 | Gameplay with the new stars; the bright white sun fills the screen (0:20). Game sound. | "I have Polaris working on the background. It added some stars, but I still don't like everything else... So I asked it to add galaxies, nebula, that type of stuff, closer to the Drifter Star game." | (none) | 7:35 |
| 74 | 6 | 7:35 | 10.0s | clip 10 1:36.5-1:46.5 | Typing the request; "Developer start menu" card appears. | "Can we add a menu, like a developer menu, where I can choose what planet or evolution stage to start as, so I can test them?" | (none) | 7:45 |
| 75 | 6 | 7:45 | 1.5s | clip 10 1:57.5-1:59.0 | Agent voice announcement over the canvas. Mic muted (Hunter talks over it). | [AGENT TTS, Orbit] *"Polaris is done."* | Agent subtitle (italic, `◆ ORBIT`) | 7:47 |
| 76 | 6 | 7:47 | 3.0s | clip 10 2:16.6-2:17.7 + clip 10 2:25.9-2:27.8 | New purple/teal nebula background in game. | "This looks a lot better. I like this a lot, actually." | (none) | 7:50 |
| 77 | 6 | 7:50 | 3.8s | clip 11 0:06.1-0:08.2 + clip 11 0:21.3-0:23.0 | Rigel "Developer start menu" card, then the DEV START screen. | "The developer start menu is done. Here's the dev start menu." | Mint chip: `REQUESTED → SHIPPED` | 7:54 |
| 78 | 6 | 7:54 | 4.5s | clip 11 0:24.0-0:28.5 | DEV START screen (stage list). Mic muted. | [NARRATION] "By the end, I had been less of a coder and more of a director." | (none) | 7:58 |
| 79 | 7 | 7:58 | 2.5s | asset: `brand-kit/assets/backgrounds/bg-stage12-black-hole-clean.png` | Chapter card (brand §6.4): bg-stage12-black-hole-clean.png + stageTints.black_hole overlay, stage ladder advances one tick. | (none) | Kicker `CHAPTER 07/07 // BH`; title **THIS IS THE GAME** | 8:01 |
| 80 | 7 | 8:01 | 2.5s | clip 9 4:20.0-4:22.5 | Game title screen "VESPER DRIFT" + tagline. Mic muted; game sound. | [NARRATION] "This is the game." | (none) | 8:03 |
| 81 | 7 | 8:03 | 6.0s | clip 9 4:44.0-4:50.0 | 3D meteorite play, mouse hidden. Game sound only (a:1). | (none) | (none) | 8:09 |
| 83 | 7 | 8:09 | 5.0s | clip 10 0:30.0-0:35.0 | Blue striped gas giant, "DEEP VOID" banner. Game sound only. | (none) | (none) | 8:14 |
| 84 | 7 | 8:14 | 15.2s | clip 9 5:22.3-5:29.2 + clip 9 5:33.1-5:35.4 + clip 9 5:52.0-5:58.0 | 3D play-through: gravity test, then asteroids and planets. | "Added gravity, so larger planets and objects should pull the other ones in... I feel like I can kind of feel it pulling me... I will say, this feels very, very, very much like Drifter Star." | (none) | 8:29 |
| 85 | 7 | 8:29 | 7.2s | clip 10 2:38.0-2:43.3 + clip 10 2:45.0-2:46.9 | Nebula gameplay. | "I might leave that out, so it's not copying every single thing from Drifter Star... even though it's copied everything else." | (none) | 8:37 |
| 86 | 7 | 8:37 | 8.2s | clip 9 7:28.8-7:37.0 | 3D gameplay with ringed planet. | "It looks so good. This is all in the browser. Very impressed." | (none) | 8:45 |
| 87 | 7 | 8:45 | 5.0s | clip 9 7:40.0-7:45.0 | "Evolution branch detected" cards: Frozen Fortress / Cradle of Life / War Planet. Mic muted. | (none) | Violet evolution banner (brand §6.6): `EVOLUTION BRANCH DETECTED` | 8:50 |
| 88 | 7 | 8:50 | 7.8s | clip 11 0:58.0-1:05.8 | Playing as a Gas Giant in the nebula, then the huge sun. | "This just shows you how big things are." | (none) | 8:58 |
| 89 | 7 | 8:58 | 3.7s | clip 11 1:39.6-1:43.3 | Black-hole stage: accretion disk, jet star. | "This is what happens when you get to the black hole stage. It gets kind of crazy." | (none) | 9:01 |
| 90 | 7 | 9:01 | 5.6s | clip 11 1:50.0-1:55.6 | End screen "BLACK HOLE: Transmission complete..." with Drift Again. Mic muted until 1:54.0. | "Oh, beat it." | (none) | 9:07 |
| 91 | 7 | 9:07 | 10.1s | clip 11 2:04.1-2:12.6 + clip 11 2:14.7-2:16.3 | Restart as a meteorite, calm gameplay. | "So far I'd say the clone is a big success. This is definitely a game I could see myself just playing when I'm bored." | (none) | 9:17 |
| 92 | 7 | 9:17 | 13.1s | clip 11 3:20.1-3:31.5 + clip 11 3:32.6-3:34.3 | Rigel card on the canvas (outro). | "I might start another project and have Orbit actually just edit this video for me, and choose all the highlights, and just make it for me. Okay, goodbye." | After "goodbye": mono chip `// THIS VIDEO WAS PLANNED BY AGENTS IN R7 ORBIT_` | 9:30 |
| 93 | 7 | 9:30 | 1.4s | clip 11 2:50.0-2:51.4 | Hold on canvas. Mic muted (sting). | [AGENT TTS, Orbit] *"Rigel is done."* | Agent subtitle (italic, `◆ ORBIT`) | 9:31 |
| 94 | 7 | 9:31 | 12.0s | asset: `brand-kit/assets/ui/vesper-drift-emblem.svg + logo/r7-orbit-mark-gold-transparent-2048.png over backgrounds/bg-stage12-black-hole-clean.png` | End card: Centred: VESPER / DRIFT wordmark (typeset), then the gold R7 Orbit mark and the made-by reveal. No end-screen placeholders. Audio: black-hole ambience bed (see Audio plan). | (none) | The reveal (only here, for the wow factor): `THIS VIDEO WAS MADE ENTIRELY BY R7 ORBIT` / `EDITED, SCRIPTED AND BUILT BY A TEAM OF AI AGENTS IN R7 ORBIT` / `DIRECTED BY HUNTER` | 9:43 |

## Audio plan (music from the game)

The game ships no audio files. Its music is the live-synthesised stage ambience (`brand-kit/assets/audio-reference/README.md`). **Clips 1-7 recorded no system audio**, so those chapters need a bed lifted from the `a:1` stream of clips 8-11. Pick beds that follow the game's own descent from A3 down to B1, so the soundtrack "grows" with the chapters:

| Chapters | Bed source (`a:1` only) | Stage |
|---|---|---|
| 1-2 | clip 9 4:44-5:50 | Meteorite / asteroid (highest, lightest) |
| 3-4 | clip 9 9:03-10:15 | Dwarf planet |
| 5 | clip 10 0:30-0:55 (stop before the 1:00 "hull integrity" alarm) | Gas giant |
| 6 | clip 11 0:40-1:00 under the clip 1-5 beats; native `a:1` on the clip 8-11 beats | Gas giant / nebula |
| 7 + end card | native `a:1` per shot; end card on clip 11 1:40-1:50 (black hole), looped with a long crossfade | Black hole (lowest) |

- Bed sits about 18 dB under speech and ducks on every spoken line. It comes up to full level on the "game sound only" beats (1, 81-83, 87).
- **Keep beds clear of Orbit's own sounds**, which are also on `a:1`: TTS at 8 7:54 and 8:05, 9 2:17 and 10:21, 10 1:57, 11 2:50; the sound-cue demos at 8 7:00-8:10 and 9 1:21-2:50. None of the bed ranges above overlap these, but listen through before locking.
- Fallback for clean, loopable stems: render offline from `src/audio/demo.html`, as brand §11 describes.

## Runtime summary

| | Time |
|---|---|
| **Total** | **8:03** (482.8 s, 94 beats) |
| Hunter's real recorded lines + Orbit TTS | 5:39 (338.8 s) |
| `[NARRATION]` to record | 1:30 (90.0 s) |
| Game-sound-only / silent visual beats | 0:24 (24.0 s) |
| Title, chapter and end cards | 0:30 (30.0 s) |

- **Under 10:00: yes** (8:03). **Target ~8:00: yes.**
- Totals assume hard cuts. If every cut used the brand's overlapping 400 ms crossfade, the runtime would drop by about 0.4 s × 93 = ~37 s (to about 7:26). Recommended: hard cuts inside chapters (vlog rhythm), with crossfades or the scan-wipe only between chapters. That costs about 3 s.
- **Trim reserve**, if it needs to come in shorter: beat 54 (robot-workers joke, 11.3 s), beat 66 ("Graphics-wise...", 4.9 s), beat 70 second half (Max plan, 5.8 s), beat 26 (agent names, 8.0 s). That is about 30 s without losing any chapter's point.
- **Room to grow**, if it needs to be longer: the end card can run up to 20 s for YouTube end-screen elements, and beats 81-83 can hold longer on gameplay.

## Gaps and risks

1. **Space-realism research is narration-only** (beat 15). Hunter confirms the Space Realism Research task (agent **Glen**) really happened. It is the research agent that looked into how space works. But neither Glen nor that task appears in any of the 11 recordings or transcripts. So the line "Another dug into how space actually works, so the game would feel real" plays over a brand asset (a clean star-stage background) with a lower-third naming Glen. It does not play over footage, and the script makes no claim that it is on camera. Optional upgrade: if Glen's card or its PR is still visible in R7 Orbit, a new screen capture of it could replace the background.
2. **Harbor (Integrate & playtest) works on its own, so it is never seen playtesting.** This is expected, not a defect. On camera it is only created (clip 3), switched to Opus (clip 4) and shown finished, with its summary and PR #7 (clip 5). Chapter 6 tells the rest through narration ("handed the job off... played the game by itself, off camera", beats 55 and 57), shown with Harbor's card, its summary/PR and a stage-background illustration. The illustration beat deliberately has no gameplay, so it doesn't look as if we are watching Harbor play. The lower-third names Harbor at beat 55. Two notes:
   - Chronology: Harbor ran *before* the specialists, not "last". The narration reads "Then I handed...", and chapter 6 jumps back in time, labelled `EARLIER // VERSION 1`.
   - All on-camera gameplay is Hunter playing. Keep it clearly separate from the Harbor beats.
3. **Hiring is never shown.** No agent-creation dialogs exist for the specialists, only finished cards and Hunter's description (clip 6). The roster panel graphic carries chapter 3. Beat 23's picture is the *first* build team (clip 2: Core engine, Renderer & VFX). Lark (Engine & 3D Renderer) appears only as a card in clip 7.
4. **"Private copies" (worktrees) is only spoken**, at clip 3 0:41 and as tiny card IDs. Beat 30 depends on a motion graphic (`main` → one branch per agent) that still has to be built.
5. **Conflict resolution itself (diffs, fixes) is never on screen.** Only Orbit's chat text, Hunter's account and the PR cards are.
6. **Narration is on-screen text, not voice** (decided by Hunter: no new recordings, R7 Orbit makes the whole video). The 19 lines (about 1:30) are typed on screen and subtitled. The edit (`video/scripts/build-edl.mjs`) lengthens any beat whose line needs more reading time (about 15 characters/s plus 1 s), so the cut runs a little longer than this table.
7. **Speaker labels:** speakers were separated by audio stream (mic vs system), so the creator/agent split is reliable. However:
   - (a) In beats 18 and 31, Hunter reads Orbit's text aloud. Those are subtitled as Hunter.
   - (b) At clip 9 10:21, Whisper heard the TTS as "This is done", but it is probably "Polaris is done". Not used.
   - (c) Whisper wrote "Atlus"; the transcripts now read Atlas.
   - (d) There is **no spoken agent dialogue anywhere**, only the short Orbit TTS lines (beats 39, 40, 75, 93).
8. **Words to check by ear before subtitling:**
   - Beat 70, "$446, $409": the screen shows $445.97, and the second figure is unclear. The subtitle keeps only "$446...".
   - Beat 53, "sit the passenger seat": probably "sit in". Left as transcribed; fix it if the audio says "in".
   - Beat 35: transcribed as "It's gonna go ahead". The cut starts at "go ahead" to avoid the issue.
   - Beat 21: "grab" vs "grabbed".
   - Beat 31: "word tree" was corrected to "worktree".
9. **Agent name spellings (confirmed by Hunter):** Quasar and Laika (Whisper heard "Kaisar" and "Leica"; transcripts corrected). Beat 26 ends at 4:13.4, before the Laika joke (4:13.6-4:26), which is deliberately left out.
10. **"Ay yi yi" (clip 1, 13:56.0) falls inside the excluded window**, even though the footage index lists 13:40-13:56 as a best moment. Beat 44 stops at 13:51.9 ("Merge it."). Do not extend it.
11. **Third-party and personal content on screen:**
    - The Drifter Star: Evolution Steam page (beat 10) and its screenshots in the file dialog (beat 21). Keep them brief, as commentary. Per brand §9, none of that art goes into graphics.
    - The Claude usage page (clip 8, 4:50-5:00, beat 70) and the Windows taskbar may show account details or notifications. Check, then blur or crop.
12. **Moments wanted but not found:**
    - Hunter saying "I wanted a team" on camera. It exists only as narration.
    - Any recorded agent creation for the phase-3 specialists.
    - Agents "talking" beyond TTS.
    - Game audio for the 2D version (clip 5 is silent).
    - A wide all-agents shot *with* sound (clips 1-7 have no system audio).
    - Glen's Space Realism Research task (covered by narration over a brand asset, see #1).
    - The "Opus 5.5 set to high" polish pass that Hunter planned in clip 1 at 5:35.
13. **Picture quality:** the Orbit UI is small and dark on a 1080p capture. Zoom 150-200% on cards and chat, and crop the taskbar (about 40 px) and title bar on every clip.
14. **Chronology (re-cut).** Chapters now follow the order things happened (see the note above the beat table). Small exceptions inside a chapter: the clip 1 permission moments (beats 33-34) sit with the build team's permission cards in chapter 3, beat 44's clip 1 "Merge it" sits with the clip 3 merges in chapter 4, and beat 23's picture is the first build team's cards under the specialist roster.
15. **Content flags left out:** clip 1 13:55-14:06 (profanity), clip 9 about 1:42 (burp joke, "my girlfriend"), and clip 9 4:13-4:25 (Laika joke). Beat 54 ("they try to kill you") is a mild dark joke. Keep it or cut it; it's in the trim reserve.
16. **Hunter's smart assistant "R7" is not R7 Orbit.** The clip 1 10:19-11:52 exchange (blue robot bubble, "Shut up, R7…") was removed so viewers don't mistake it for an R7 Orbit feature.
