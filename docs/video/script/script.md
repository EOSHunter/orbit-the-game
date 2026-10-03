# Script: "I built this game by directing a team of AI agents in R7 Orbit"

**On-screen title:** BUILDING A GAME WITH A TEAM OF AI AGENTS
**Runtime:** 7:55 (target ~8:00, hard limit 10:00) · 1920×1080, 16:9, 30 fps · Remotion
**Tone:** casual vlog. On-screen text only, no AI voiceover. Look follows `docs/video/brand-kit/brand-guide.md`.

Built from `docs/video/analysis/` (footage index, speaker labels, word-level transcripts) and `docs/video/brand-kit/`. Every quoted line below was checked against the word-level timestamps in `analysis/transcripts/N.json`.

## How to read the beat table

- **Source.** `clip N` = `N.mp4` in the main checkout's `docs/video/` folder (untracked, read in place). Timestamps are `m:ss.s` *within that clip*. In/outs come from word timings, with about 0.1-0.3 s of handle. A `+` joins two cuts inside one beat. `asset:` paths are relative to `docs/video/`.
- **Duration** is the exact sum of the source in/outs. **Start** and **Running total** assume back-to-back hard cuts (see the Runtime summary for transitions).
- **Hunter's line**
  - `"..."` = Hunter's real recorded words, cleaned of filler words (um, uh, like, you know, repeated starts) but not paraphrased. `...` marks a cut inside the beat.
  - `(reading Orbit)` = Hunter reading Orbit's on-screen text aloud. Subtitle it as Hunter (white), because it is Hunter's voice.
  - `[NARRATION]` = new line, written from Hunter's narration script. **Hunter records it on their own mic** (no AI voice). On these beats the source clip's mic is muted.
  - `[AGENT TTS, Orbit]` = Orbit's built-in text-to-speech, taken from the system-audio stream and kept as-is. Use the agent subtitle style (italic, coloured bar, `◆ ORBIT` label), per brand §7.
  - `(none)` = nothing spoken (game sound or music bed only).
- **Audio streams** (see `analysis/speaker-labels.md`): `a:0` = mix, `a:1` = system audio (game sound, Orbit dings, TTS), `a:2` = mic only. Real-line beats: use `a:2` for the voice, plus `a:1` on clips 8-11. "Mic muted" = drop `a:2` and keep only `a:1` and/or the bed.
- **Subtitles.** Every spoken line, including `[NARRATION]` and TTS, is burned in (brand §7) and exported to a separate `.srt` using the text exactly as in the "Hunter's line" column.
- **Lower-thirds and roster panel** use the role codes and colours from brand §6.5. Hunter's own lower-third uses a white bar, never a colour.
- **Hard rule:** nothing from **clip 1, 13:55-14:06** (profanity). Beat 43 ends at 13:51.9. Every clip-1 range in the table was checked programmatically against that window.

## Chapter overview

| Ch | Chapter | Start | Length | Ends |
|---|---|---|---|---|
| 1 | Cold open | 0:00 | 0:20 | 0:20 |
| 2 | Research agents | 0:20 | 1:07 | 1:27 |
| 3 | Hiring the specialists | 1:27 | 0:43 | 2:10 |
| 4 | Everyone at once, one canvas | 2:10 | 0:57 | 3:07 |
| 5 | Merging | 3:07 | 0:58 | 4:05 |
| 6 | Director, not coder + QA agent | 4:05 | 2:09 | 6:14 |
| 7 | This is the game + end card | 6:14 | 1:41 | 7:55 |

## Beat table

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
| 9 | 2 | 0:28 | 3.9s | clip 1 2:13.0-2:16.9 | First agent's list of game ideas (zoom on the text). | "Gravity wells to hit targets using as little fuel as possible. That sounds boring." | Bracket callout on the idea list | 0:32 |
| 10 | 2 | 0:32 | 7.0s | clip 1 2:53.5-2:58.7 + clip 1 3:05.7-3:07.5 | Cut to Steam: Drifter Star: Evolution store page. | "Actually, I have an idea. There's this one game that I like on Steam... There it is, Drifter Star." | Chip: `REFERENCE // DRIFTER STAR: EVOLUTION` | 0:39 |
| 11 | 2 | 0:39 | 7.7s | clip 1 3:28.3-3:36.0 | Prompt being typed to the agent. | "I want to build my own clone version of this, because I'm really creative and have so many ideas." | Amber chip on "creative": `▮ SARCASM DETECTED` | 0:46 |
| 12 | 2 | 0:46 | 2.4s | clip 1 3:55.6-3:58.0 | Chat panel, switching to Orbit. | "Let's just use Orbit to orchestrate it all." | (none) | 0:49 |
| 13 | 2 | 0:49 | 7.9s | clip 1 4:10.6-4:13.4 + clip 1 4:22.6-4:27.7 | Hunter's brief to Orbit in the chat panel (zoom). | "Come up with a plan to create a clone of it... then we'll go from there with a creative director agent to figure out the look and feel." | (none) | 0:57 |
| 14 | 2 | 0:57 | 8.5s | clip 1 4:58.0-5:06.5 | "Game Design Research" and "Creative Director" cards on the canvas. Mic muted. | [NARRATION] "One agent studied what makes a space game fun. Another dug into how space actually works, so the game would feel real." ⚠ see Gaps #1 | Lower-third (cyan): `AGENT // RS` / **ATLAS: GAME DESIGN RESEARCH** | 1:05 |
| 15 | 2 | 1:05 | 7.7s | clip 1 5:45.3-5:53.0 | Model picker / canvas. | "I'm sure what we're going to get is going to be very decent at best. Maybe. But Opus crushes it." | Small amber mono chip: `REMEMBER THIS_` (paid off in beat "Opus did not cook") | 1:13 |
| 16 | 2 | 1:13 | 8.0s | clip 1 9:06.2-9:12.9 + clip 1 9:16.1-9:17.4 | Orbit chat panel; Hunter hands over control. | "I want to let you loose, and I want you to just control everything from here on out. I want you to be the orchestrator... and I want you to run the show." | (none) | 1:21 |
| 17 | 2 | 1:21 | 6.1s | clip 1 9:40.2-9:46.3 | Orbit/Briar's question card: 2D top-down or 3D? (Hunter reads it aloud, then answers). | (reading Orbit) "Which is: 2D top-down, or 3D like the original?" / "3D like the original." | Lower-third (violet): `AGENT 01/07 // CD` / **CREATIVE DIRECTOR** (Briar) | 1:27 |
| 18 | 3 | 1:27 | 2.5s | asset: `brand-kit/assets/backgrounds/bg-stage04-rocky-lava-clean.png` | Chapter card (brand §6.4): bg-stage04-rocky-lava-clean.png + stageTints.dwarf_planet overlay, stage ladder advances one tick. | (none) | Kicker `CHAPTER 03/07 // TEAM`; title **HIRING THE SPECIALISTS** | 1:29 |
| 19 | 3 | 1:29 | 5.5s | clip 6 0:00.0-0:05.5 | "Phase 3" canvas: five agent cards around the hub. Mic muted. | [NARRATION] "Then I hired the specialists. A creative director to set the look and feel." | Roster panel starts building (one row per role, role colours §6.5): CREATIVE DIRECTOR (violet) | 1:35 |
| 20 | 3 | 1:35 | 7.5s | clip 6 0:15.2-0:21.4 + clip 6 0:28.7-0:30.0 | Canvas, then Windows file dialog with the Steam reference screenshots. | "I have a new creative director agent that is going to be referencing the images that I gave it... literally just grab these from Steam." | Lower-third (violet): `AGENT 01/07 // CD` / **CREATIVE DIRECTOR** (Iris) | 1:42 |
| 21 | 3 | 1:42 | 4.5s | clip 7 0:13.5-0:18.0 | Zoom on the Juno (UI Designer) and Kestrel (Sound Designer) cards. Mic muted. | [NARRATION] "A UI designer for the screens. A sound designer for the audio." | Roster rows: `02/07 UI DESIGNER` (cyan, Juno), `03/07 SOUND DESIGNER` (amber, Kestrel) | 1:47 |
| 22 | 3 | 1:47 | 5.0s | clip 2 1:12.7-1:17.7 | Build canvas: zoom on the Core engine (Cedar) and Renderer & VFX cards. Mic muted. | [NARRATION] "An engine agent built the core, and a renderer agent took it into 3D," | Roster rows: `04/07 ENGINE` (mint), `05/07 RENDERER` (magenta) | 1:52 |
| 23 | 3 | 1:52 | 4.0s | clip 6 0:54.0-0:58.0 | Zoom on the "Simulation & Infinite Universe" card. Mic muted. | [NARRATION] "while a simulation agent worked on a universe that never ends." | Roster row: `06/07 SIMULATION` (ice blue) | 1:56 |
| 24 | 3 | 1:56 | 6.1s | clip 6 0:58.9-1:05.0 | Same card, held. | "Yeah, an infinite universe. It's literally right there in front of my face. So everything will be procedurally generated." | (none) | 2:02 |
| 25 | 3 | 2:02 | 8.0s | clip 9 4:05.4-4:13.4 | Orbit's agent summary in the chat panel. | "So you have Voyager, Kaisar, Polaris, Leica." | Name chips appear one per name: VOYAGER / KAISAR / POLARIS / LEICA (verify spelling, Gaps #9) | 2:10 |
| 26 | 4 | 2:10 | 2.5s | asset: `brand-kit/assets/backgrounds/bg-stage05-gas-giant-clean.png` | Chapter card (brand §6.4): bg-stage05-gas-giant-clean.png + stageTints.rocky_planet overlay, stage ladder advances one tick. | (none) | Kicker `CHAPTER 04/07 // SYNC`; title **ONE CANVAS** | 2:12 |
| 27 | 4 | 2:12 | 3.5s | clip 2 1:00.0-1:03.5 | Four build agents all "working" at once. Mic muted. | [NARRATION] "They all worked at the same time, on one canvas." | (none) | 2:16 |
| 28 | 4 | 2:16 | 3.1s | clip 2 1:32.0-1:35.1 | Same shot, slow push-in. | "They're probably all doing the same thing. They are." | (none) | 2:19 |
| 29 | 4 | 2:19 | 6.0s | clip 2 1:23.5-1:29.5 | Card IDs (e.g. `build-core-engine-bfc394`) zoomed; motion-graphic overlay: `main` splits into four cyan branch lines, one per agent. Mic muted. | [NARRATION] "Each had its own private copy of the project, so no one could break anyone else's work." | Overlay label: `1 AGENT = 1 BRANCH + 1 WORKTREE` | 2:25 |
| 30 | 4 | 2:25 | 5.6s | clip 3 0:36.8-0:42.4 | Orbit's chat summary (Hunter reads it aloud). | (reading Orbit) "Next, you need to merge all four branches into main. Each task worktree is separate." | Bracket callout on that sentence in the chat panel | 2:31 |
| 31 | 4 | 2:31 | 3.5s | clip 2 0:00.0-0:03.5 | Three "Read wants permission: Allow once / Deny" cards at once. Mic muted. | [NARRATION] "When an agent needed permission, the card told me." | Target-bracket callout contracts onto a permission card | 2:34 |
| 32 | 4 | 2:34 | 4.0s | clip 1 4:53.8-4:57.8 | WebSearch permission card; cursor clicking Allow. | "We're going to allow, allow, allow, allow." | (none) | 2:38 |
| 33 | 4 | 2:38 | 3.3s | clip 1 6:21.5-6:24.8 | Agent permissions settings panel. | "I really wish it would stop asking me for permission to do things." | (none) | 2:41 |
| 34 | 4 | 2:41 | 5.2s | clip 2 0:25.0-0:30.2 | Permission cards on Dune and Cedar. | "Go ahead and allow all of these to run free, and we're gonna see what happens." | (none) | 2:47 |
| 35 | 4 | 2:47 | 3.5s | clip 1 10:30.0-10:33.5 | Blue R7 robot bubble "Listening..." on screen. Mic muted. | [NARRATION] "I could answer, or watch it work, or talk to it." | (none) | 2:50 |
| 36 | 4 | 2:50 | 5.4s | clip 1 11:17.0-11:22.4 | Same robot bubble (it misheard Hunter). | "Shut up, R7, you didn't let me talk long enough. I'm upset with you." | (none) | 2:56 |
| 37 | 4 | 2:56 | 5.0s | clip 8 7:10.6-7:15.6 | Settings, then Sounds panel. The bell plays (system audio present in clip 8). | "So if an agent is waiting on me, I will hear this ding here, that bell." | (none) | 3:01 |
| 38 | 4 | 3:01 | 2.0s | clip 9 2:17.0-2:19.0 | Settings, then Sounds (clip 9). Agent voice announcement. | [AGENT TTS, Orbit] *"Atlas needs you."* | Agent subtitle style (italic, cyan bar, label `◆ ORBIT`) | 3:03 |
| 39 | 4 | 3:03 | 4.6s | clip 8 7:54.3-7:58.9 | Voice picker preview. | [AGENT TTS, Orbit] *"This is how I will read answers to you."* / "I hate that voice." | Two stacked cues: agent (italic, `◆ ORBIT`) then creator (white, `HUNTER` label to mark the switch back) | 3:07 |
| 40 | 5 | 3:07 | 2.5s | asset: `brand-kit/assets/backgrounds/bg-stage08-star-clean.png` | Chapter card (brand §6.4): bg-stage08-star-clean.png + stageTints.gas_giant overlay, stage ladder advances one tick. | (none) | Kicker `CHAPTER 05/07 // MRG`; title **PULLING IT TOGETHER** | 3:10 |
| 41 | 5 | 3:10 | 3.5s | clip 3 0:01.0-0:04.5 | Four build cards showing "Pull request #... merged". Mic muted. | [NARRATION] "Then came the hard part: pulling it all together." | (none) | 3:13 |
| 42 | 5 | 3:13 | 5.8s | clip 3 1:14.8-1:20.6 | Agent chat, merge instruction being dictated. | "Go ahead and merge this to main. To main, not me." | (none) | 3:19 |
| 43 | 5 | 3:19 | 4.6s | clip 1 13:40.2-13:43.7 + clip 1 13:50.8-13:51.9 | "Pull request #2 merged" cards. HARD OUT 13:52.0 (excluded window starts 13:55). | "Merge it. Regular merge... Merge it." | Mint chip: `PR #2 // MERGED` | 3:24 |
| 44 | 5 | 3:24 | 4.6s | clip 7 0:01.4-0:06.0 | Phase-3 canvas: Iris and Kestrel finished, Juno and Lark still open. | "It's a new day. There were some merge conflicts." | 120 ms coral/cyan glitch accent on "conflicts" + coral edge vignette (brand §6.6) | 3:28 |
| 45 | 5 | 3:28 | 4.2s | clip 7 0:07.8-0:12.0 | Target brackets contract onto the Lark (PR #13) and Juno (PR #14) cards. | "Between Lark and Juno here: the engine and 3D renderer, and the UI designer." | Coral chips: `LARK // PR #13`, `JUNO // PR #14` | 3:32 |
| 46 | 5 | 3:32 | 6.0s | clip 7 0:18.0-0:24.0 | Orbit chat: "...if there's a conflict or a failing check... I can send the fix to the agent." Mic muted. | [NARRATION] "When two agents changed the same lines, Orbit sent the problem back to them to sort out." | Bracket callout on that chat line | 3:38 |
| 47 | 5 | 3:38 | 9.3s | clip 7 0:33.3-0:42.6 | Same canvas + chat. | "So I let Orbit know, and then it went ahead and just sent follow-ups to each of them, on its own." | (none) | 3:48 |
| 48 | 5 | 3:48 | 3.2s | clip 7 0:44.5-0:47.7 | Lark card shows merged. | "So Lark is merged, no conflicts. Now we're just waiting on Juno." | Mint chip `LARK // MERGED ✓`; amber chip `JUNO // WAITING_` | 3:51 |
| 49 | 5 | 3:51 | 5.5s | clip 9 2:52.0-2:57.5 | Phase-4 canvas with the GitHub sync banner at the top. Mic muted. | [NARRATION] "Their work flowed into the game on its own, and I decided what went on to GitHub." | (none) | 3:56 |
| 50 | 5 | 3:56 | 8.8s | clip 9 2:57.8-3:05.2 + clip 9 3:11.7-3:13.1 | Hunter tells Orbit to push; the GitHub banner disappears (3:08-3:17). | "Everything here is done. Go ahead, push this to GitHub... All right, so then it's done." | Callout on the banner as it clears | 4:05 |
| 51 | 6 | 4:05 | 2.5s | asset: `brand-kit/assets/backgrounds/bg-stage11-neutron-clean.png` | Chapter card (brand §6.4): bg-stage11-neutron-clean.png + stageTints.star overlay, stage ladder advances one tick. | (none) | Kicker `CHAPTER 06/07 // DIR`; title **DIRECTOR, NOT CODER** | 4:08 |
| 52 | 6 | 4:08 | 6.0s | clip 1 8:31.1-8:37.1 | Canvas after the research agents completed. | "I'm going to sit the passenger seat for this one, provide a little direction here and there, a little bit of help." | (none) | 4:14 |
| 53 | 6 | 4:14 | 11.3s | clip 1 12:32.6-12:43.9 | Canvas with cards working. | "If robots ever become real workers, it's going to be so easy to manage them until they get upset. You fire one of their friends and then they try to kill you." | (none) | 4:25 |
| 54 | 6 | 4:25 | 6.0s | clip 3 2:10.0-2:16.0 | "Integrate & playtest" card appears on the canvas. Mic muted. | [NARRATION] "Then I handed one agent the job of playing the game and checking that everything worked together." (adapted from "Last, ...", see Gaps #2) | Lower-third (coral): `AGENT 07/07 // QA` / **INTEGRATE & PLAYTEST** (Harbor) | 4:31 |
| 55 | 6 | 4:31 | 4.4s | clip 4 0:03.5-0:07.9 | "Integrate & playtest (Opus)" card, Opus 5.5 medium. | "It was integrating. I stopped it because I wanted to use Opus 5.5 instead." | (none) | 4:35 |
| 56 | 6 | 4:35 | 4.6s | clip 5 0:03.3-0:07.9 | Integrate & playtest card finished; chat shows PR #7 merged. | "The integrate and playtest agent finished." | Mint chip `QA // DONE` | 4:40 |
| 57 | 6 | 4:40 | 4.4s | clip 5 0:10.1-0:14.5 | Same. | "It had issues actually merging though, so I had to get those fixed." | (none) | 4:44 |
| 58 | 6 | 4:44 | 6.1s | clip 5 0:45.0-0:45.9 + clip 5 0:50.2-0:55.4 | Hunter typing in the chat. | "Is the game ready to be played? And if so, can you open it in the browser?" | (none) | 4:50 |
| 59 | 6 | 4:50 | 4.4s | clip 5 1:05.6-1:10.0 | Title screen: "VESPER DRIFT: Grow from a glowing pebble into a black hole." | "All right, so this is Vesper Drift." | Kicker: `EARLIER // VERSION 1 // 2D` (marks the time jump) | 4:55 |
| 60 | 6 | 4:55 | 3.8s | clip 5 1:35.7-1:39.5 | First 2D gameplay, meteorite (no game sound exists in clip 5). | "I was hoping for better. I'm also not hearing any sound effects." | (none) | 4:59 |
| 61 | 6 | 4:59 | 2.6s | clip 5 2:31.2-2:33.8 | 2D: evolves to Asteroid. | "I've evolved into an asteroid. Nice." | Stage-up banner style chip: `ASTEROID` | 5:01 |
| 62 | 6 | 5:01 | 3.8s | clip 5 3:32.1-3:35.9 | 2D gameplay / pause screen. | "It's not bad. I can work with it." | (none) | 5:05 |
| 63 | 6 | 5:05 | 1.5s | clip 8 0:19.1-0:20.6 | Phase-4 cards, then the 3D game loads. | "This is the game now." | Kicker: `PHASE 4 // NOW IN 3D` | 5:07 |
| 64 | 6 | 5:07 | 4.9s | clip 8 0:28.7-0:33.6 | 3D Vesper Drift with sci-fi HUD and radar; game sound. | "Graphics-wise, I like the 3D meteors." | (none) | 5:11 |
| 65 | 6 | 5:11 | 2.0s | clip 8 2:31.6-2:33.6 | Chaotic 3D gameplay. | "This is not really playable." | (none) | 5:13 |
| 66 | 6 | 5:13 | 4.4s | clip 8 2:43.2-2:47.6 | Same, overwhelming screen. | "Opus did not cook with this, not gonna lie." | Glitch accent + callback chip (amber, mono): `EARLIER: "OPUS CRUSHES IT"` | 5:18 |
| 67 | 6 | 5:18 | 3.3s | clip 8 3:52.9-3:56.2 | Pause menu / gameplay. | "Oh well. The first version was better." | (none) | 5:21 |
| 68 | 6 | 5:21 | 12.8s | clip 8 4:32.4-4:39.4 + clip 8 4:51.8-4:57.6 | Usage screen with **$445.97** and per-agent bars; then the Claude usage page. | "$446... just on this game, which is not playable. Granted, this is not money I'm actually spending... I'm on the Max plan, and I've only used 17% for the week." | Counter animates up to `$445.97` (mono italic); label `API-EQUIVALENT // COVERED BY CLAUDE MAX PLAN` | 5:34 |
| 69 | 6 | 5:34 | 5.7s | clip 9 1:06.2-1:11.9 | Canvas + "EVENT HORIZON" end screen at right. | "I just played through it. It took 12 minutes. I died to a black hole." | (none) | 5:40 |
| 70 | 6 | 5:40 | 5.6s | clip 9 1:17.0-1:22.6 | Phase-4 cards: "Add gravity", "Remove outlines", "Remove radar"... | "I just gave it a new prompt. As I was playing, I was just telling it things to fix." | Bracket callouts tick across the fix cards | 5:45 |
| 71 | 6 | 5:45 | 6.1s | clip 9 8:10.9-8:16.1 + clip 9 8:18.8-8:19.7 | Pause screen over a dark, empty background. | "We need some stars in the background still. It sort of just feels like we're in a void, or underwater." | (none) | 5:51 |
| 72 | 6 | 5:51 | 10.0s | clip 10 1:36.5-1:46.5 | Typing the request; "Developer start menu" card appears. | "Can we add a menu, like a developer menu, where I can choose what planet or evolution stage to start as, so I can test them?" | (none) | 6:01 |
| 73 | 6 | 6:01 | 1.5s | clip 10 1:57.5-1:59.0 | Agent voice announcement over the canvas. Mic muted (Hunter talks over it). | [AGENT TTS, Orbit] *"Polaris is done."* | Agent subtitle (italic, `◆ ORBIT`) | 6:03 |
| 74 | 6 | 6:03 | 3.0s | clip 10 2:16.6-2:17.7 + clip 10 2:25.9-2:27.8 | New purple/teal nebula background in game. | "This looks a lot better. I like this a lot, actually." | (none) | 6:06 |
| 75 | 6 | 6:06 | 3.8s | clip 11 0:06.1-0:08.2 + clip 11 0:21.3-0:23.0 | Rigel "Developer start menu" card, then the DEV START screen. | "The developer start menu is done. Here's the dev start menu." | Mint chip: `REQUESTED → SHIPPED` | 6:10 |
| 76 | 6 | 6:10 | 4.5s | clip 11 0:24.0-0:28.5 | DEV START screen (stage list). Mic muted. | [NARRATION] "By the end, I had been less of a coder and more of a director." | (none) | 6:14 |
| 77 | 7 | 6:14 | 2.5s | asset: `brand-kit/assets/backgrounds/bg-stage12-black-hole-clean.png` | Chapter card (brand §6.4): bg-stage12-black-hole-clean.png + stageTints.black_hole overlay, stage ladder advances one tick. | (none) | Kicker `CHAPTER 07/07 // BH`; title **THIS IS THE GAME** | 6:17 |
| 78 | 7 | 6:17 | 2.5s | clip 9 4:20.0-4:22.5 | Game title screen "VESPER DRIFT" + tagline. Mic muted; game sound. | [NARRATION] "This is the game." | (none) | 6:19 |
| 79 | 7 | 6:19 | 6.0s | clip 9 4:44.0-4:50.0 | 3D meteorite play, mouse hidden. Game sound only (a:1). | (none) | (none) | 6:25 |
| 80 | 7 | 6:25 | 5.0s | clip 10 0:18.0-0:23.0 | Bright white sun fills the screen. Game sound only. | (none) | (none) | 6:30 |
| 81 | 7 | 6:30 | 5.0s | clip 10 0:30.0-0:35.0 | Blue striped gas giant, "DEEP VOID" banner. Game sound only. | (none) | (none) | 6:35 |
| 82 | 7 | 6:35 | 6.0s | clip 9 5:52.0-5:58.0 | 3D play-through (asteroids, planets). | "I will say, this feels very, very, very much like Drifter Star." | (none) | 6:41 |
| 83 | 7 | 6:41 | 7.2s | clip 10 2:38.0-2:43.3 + clip 10 2:45.0-2:46.9 | Nebula gameplay. | "I might leave that out, so it's not copying every single thing from Drifter Star... even though it's copied everything else." | (none) | 6:48 |
| 84 | 7 | 6:48 | 8.2s | clip 9 7:28.8-7:37.0 | 3D gameplay with ringed planet. | "It looks so good. This is all in the browser. Very impressed." | (none) | 6:57 |
| 85 | 7 | 6:57 | 5.0s | clip 9 7:40.0-7:45.0 | "Evolution branch detected" cards: Frozen Fortress / Cradle of Life / War Planet. Mic muted. | (none) | Violet evolution banner (brand §6.6): `EVOLUTION BRANCH DETECTED` | 7:02 |
| 86 | 7 | 7:02 | 7.8s | clip 11 0:58.0-1:05.8 | Playing as a Gas Giant in the nebula, then the huge sun. | "This just shows you how big things are." | (none) | 7:09 |
| 87 | 7 | 7:09 | 3.7s | clip 11 1:39.6-1:43.3 | Black-hole stage: accretion disk, jet star. | "This is what happens when you get to the black hole stage. It gets kind of crazy." | (none) | 7:13 |
| 88 | 7 | 7:13 | 5.6s | clip 11 1:50.0-1:55.6 | End screen "BLACK HOLE: Transmission complete..." with Drift Again. Mic muted until 1:54.0. | "Oh, beat it." | (none) | 7:19 |
| 89 | 7 | 7:19 | 10.1s | clip 11 2:04.1-2:12.6 + clip 11 2:14.7-2:16.3 | Restart as a meteorite, calm gameplay. | "So far I'd say the clone is a big success. This is definitely a game I could see myself just playing when I'm bored." | (none) | 7:29 |
| 90 | 7 | 7:29 | 13.1s | clip 11 3:20.1-3:31.5 + clip 11 3:32.6-3:34.3 | Rigel card on the canvas (outro). | "I might start another project and have Orbit actually just edit this video for me, and choose all the highlights, and just make it for me. Okay, goodbye." | After "goodbye": mono chip `// THIS VIDEO WAS PLANNED BY AGENTS IN R7 ORBIT_` | 7:42 |
| 91 | 7 | 7:42 | 1.4s | clip 11 2:50.0-2:51.4 | Hold on canvas. Mic muted (sting). | [AGENT TTS, Orbit] *"Rigel is done."* | Agent subtitle (italic, `◆ ORBIT`) | 7:43 |
| 92 | 7 | 7:43 | 12.0s | asset: `brand-kit/assets/ui/vesper-drift-emblem.svg + logo/r7-orbit-mark-gold-transparent-2048.png over backgrounds/bg-stage12-black-hole-clean.png` | End card: VESPER / DRIFT wordmark (typeset), gold R7 Orbit mark, space for YouTube end-screen elements. Audio: black-hole ambience bed (see Audio plan). | (none) | `BUILT WITH R7 ORBIT` / `DIRECTED BY HUNTER` / `BUILT BY A TEAM OF AI AGENTS` | 7:55 |

## Audio plan (music from the game)

The game ships no audio files. Its music is the live-synthesised stage ambience (`brand-kit/assets/audio-reference/README.md`). **Clips 1-7 recorded no system audio**, so those chapters need a bed lifted from the `a:1` stream of clips 8-11. Pick beds that follow the game's own descent from A3 down to B1, so the soundtrack "grows" with the chapters:

| Chapters | Bed source (`a:1` only) | Stage |
|---|---|---|
| 1-2 | clip 9 4:44-5:50 | Meteorite / asteroid (highest, lightest) |
| 3-4 | clip 9 9:03-10:15 | Dwarf planet |
| 5 | clip 10 0:30-0:55 (stop before the 1:00 "hull integrity" alarm) | Gas giant |
| 6 | clip 11 0:40-1:00 under the clip 1-5 beats; native `a:1` on the clip 8-11 beats | Gas giant / nebula |
| 7 + end card | native `a:1` per shot; end card on clip 11 1:40-1:50 (black hole), looped with a long crossfade | Black hole (lowest) |

- Bed sits about 18 dB under speech and ducks on every spoken line. It comes up to full level on the "game sound only" beats (1, 79-81, 85).
- **Keep beds clear of Orbit's own sounds**, which are also on `a:1`: TTS at 8 7:54 and 8:05, 9 2:17 and 10:21, 10 1:57, 11 2:50; the sound-cue demos at 8 7:00-8:10 and 9 1:21-2:50. None of the bed ranges above overlap these, but listen through before locking.
- Fallback for clean, loopable stems: render offline from `src/audio/demo.html`, as brand §11 describes.

## Runtime summary

| | Time |
|---|---|
| **Total** | **7:55** (475.3 s, 92 beats) |
| Hunter's real recorded lines + Orbit TTS | 5:39 (338.8 s) |
| `[NARRATION]` to record | 1:23 (82.5 s) |
| Game-sound-only / silent visual beats | 0:24 (24.0 s) |
| Title, chapter and end cards | 0:30 (30.0 s) |

- **Under 10:00: yes** (7:55). **Target ~8:00: yes.**
- Totals assume hard cuts. If every cut used the brand's overlapping 400 ms crossfade, the runtime would drop by about 0.4 s × 91 = ~36 s (to about 7:19). Recommended: hard cuts inside chapters (vlog rhythm), with crossfades or the scan-wipe only between chapters. That costs about 3 s.
- **Trim reserve**, if it needs to come in shorter: beat 53 (robot-workers joke, 11.3 s), beat 64 ("Graphics-wise...", 4.9 s), beat 68 second half (Max plan, 5.8 s), beat 25 (agent names, 8.0 s). That is about 30 s without losing any chapter's point.
- **Room to grow**, if it needs to be longer: the end card can run up to 20 s for YouTube end-screen elements, and beats 79-81 can hold longer on gameplay.

## Gaps and risks

1. **"How space actually works" research is not in the footage** (beat 14). No agent is seen or heard doing physics or space-science research. If it didn't happen off-camera, use this true alternative instead: *"Another worked out what would actually be in the game."* (It matches Hunter's brief in clip 1, 4:13-4:21.)
2. **The QA agent is never seen playing the game.** The "Integrate & playtest" agent (Harbor) is only shown being created (clip 3), switched to Opus (clip 4) and finishing with merge trouble (clip 5). Hunter does all the on-camera playing. Also, it ran *before* the specialists, not "last", so the narration is adapted to "Then I handed...", and chapter 6 jumps back in time, labelled `EARLIER // VERSION 1`. To show it literally, record a new screen capture of an agent's playtest report.
3. **Hiring is never shown.** No agent-creation dialogs exist for the specialists, only finished cards and Hunter's description (clip 6). The roster panel graphic carries chapter 3. Beat 22's picture is the *first* build team (clip 2: Core engine, Renderer & VFX). Lark (Engine & 3D Renderer) appears only as a card in clip 7.
4. **"Private copies" (worktrees) is only spoken**, at clip 3 0:41 and as tiny card IDs. Beat 29 depends on a motion graphic (`main` → one branch per agent) that still has to be built.
5. **Conflict resolution itself (diffs, fixes) is never on screen.** Only Orbit's chat text, Hunter's account and the PR cards are.
6. **Narration is not recorded yet** (about 1:23 (82.5 s) across 17 lines). If Hunter decides not to record it, these beats become on-screen text cards and need re-timing (reading speed is slower than speaking).
7. **Speaker labels:** speakers were separated by audio stream (mic vs system), so the creator/agent split is reliable. However:
   - (a) In beats 17 and 30, Hunter reads Orbit's text aloud. Those are subtitled as Hunter.
   - (b) At clip 9 10:21, Whisper heard the TTS as "This is done", but it is probably "Polaris is done". Not used.
   - (c) "Atlus" in the transcript is Atlas.
   - (d) There is **no spoken agent dialogue anywhere**, only the short Orbit TTS lines (beats 38, 39, 73, 91).
8. **Words to check by ear before subtitling:**
   - Beat 68, "$446, $409": the screen shows $445.97, and the second figure is unclear. The subtitle keeps only "$446...".
   - Beat 52, "sit the passenger seat": probably "sit in". Left as transcribed; fix it if the audio says "in".
   - Beat 34: transcribed as "It's gonna go ahead". The cut starts at "go ahead" to avoid the issue.
   - Beat 20: "grab" vs "grabbed".
   - Beat 30: "word tree" was corrected to "worktree".
9. **Agent name spellings:** "Leica" (Hunter's pronunciation; the dog was Laika) and "Kaisar". Use whatever is on the agent cards. Beat 25 ends at 4:13.4, before the Laika joke (4:13.6-4:26), which is deliberately left out.
10. **"Ay yi yi" (clip 1, 13:56.0) falls inside the excluded window**, even though the footage index lists 13:40-13:56 as a best moment. Beat 43 stops at 13:51.9 ("Merge it."). Do not extend it.
11. **Third-party and personal content on screen:**
    - The Drifter Star: Evolution Steam page (beat 10) and its screenshots in the file dialog (beat 20). Keep them brief, as commentary. Per brand §9, none of that art goes into graphics.
    - The Claude usage page (clip 8, 4:50-5:00, beat 68) and the Windows taskbar may show account details or notifications. Check, then blur or crop.
12. **Moments wanted but not found:**
    - Hunter saying "I wanted a team" on camera. It exists only as narration.
    - Any recorded agent creation for the phase-3 specialists.
    - Agents "talking" beyond TTS.
    - Game audio for the 2D version (clip 5 is silent).
    - A wide all-agents shot *with* sound (clips 1-7 have no system audio).
    - The QA agent's bug report.
    - The "Opus 5.5 set to high" polish pass that Hunter planned in clip 1 at 5:35.
13. **Picture quality:** the Orbit UI is small and dark on a 1080p capture. Zoom 150-200% on cards and chat, and crop the taskbar (about 40 px) and title bar on every clip.
14. **Chronology is compressed on purpose.** The chapters are thematic. Chapter 4 mixes phase-2 permission cards with phase-4 sound settings, chapter 5 mixes the phase-2 merges with the phase-3 conflicts, and chapter 6 rewinds to version 1 (labelled on screen).
15. **Content flags left out:** clip 1 13:55-14:06 (profanity), clip 9 about 1:42 (burp joke, "my girlfriend"), and clip 9 4:13-4:25 (Laika joke). Beat 53 ("they try to kill you") is a mild dark joke. Keep it or cut it; it's in the trim reserve.
