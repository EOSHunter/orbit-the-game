# Footage index - "I built this game by directing a team of AI agents in R7 Orbit"

**Source videos (do not modify): `C:\Users\hunte\R7 Orbit Projects\orbit-the-game\docs\video\`** (main checkout; files `1.mp4` ... `11.mp4`, plus `r7-orbit-logo.png`). Read in place; they are untracked/ignored by git.

Total footage: 11 clips, 54:17 (3257 s). All timestamps below are `m:ss` (or `h:mm:ss`) **within the named clip**.

Companion files in this folder: `transcripts/N.json|.srt` (word-level, speaker-labelled), `speaker-labels.md` + `speaker-samples.json`, `frames/N/` (see "Frames"). Technical data is in the table below.

## 0. Health check and technical data

| Clip | Duration | Res / fps | Codec | Audio streams | Status |
|---|---|---|---|---|---|
| 1 | 14:34 | 1920x1080 / 59.9 | HEVC 5.2 Mbps | 3 x AAC 48k stereo | OK |
| 2 | 1:40 | 1920x1080 / 59.9 | HEVC 5.0 Mbps | 3 | OK |
| 3 | 3:12 | 1920x1080 / 59.7 | HEVC 6.0 Mbps | 3 | OK |
| 4 | 0:22 | 1920x1080 / 60 | HEVC 5.9 Mbps | 3 | OK (very short) |
| 5 | 4:00 | 1920x1080 / 59.3 | HEVC 8.8 Mbps | 3 | OK |
| 6 | 1:22 | 1920x1080 / 60 | HEVC 4.7 Mbps | 3 | OK |
| 7 | 0:53 | 1920x1080 / 60 | HEVC 7.8 Mbps | 3 | OK |
| 8 | 8:26 | 1920x1080 / 59.5 | HEVC 6.0 Mbps | 3 | OK |
| 9 | 12:18 | 1920x1080 / 60 | HEVC 8.4 Mbps | 3 | OK |
| 10 | 3:11 | 1920x1080 / 60 | HEVC 9.1 Mbps | 3 | OK |
| 11 | 3:36 | 1920x1080 / 60 | HEVC 9.2 Mbps | 3 | OK |

* **No corrupt clips**: every clip probed cleanly, and audio plus 10-second frames were decoded to the very end of each.
* **No clip lacks audio, and none lacks the creator's voice.**
* **IMPORTANT audio finding: the three streams are `a:0` mix, `a:1` system audio, `a:2` mic only** (details in `speaker-labels.md`). In **clips 1-7 the system-audio stream is effectively silent**: no game sound effects, music, or Orbit dings were captured, and the game in clip 5 plays with no sound (the creator remarks on it). **Only clips 8-11 contain game sound and Orbit sound cues/TTS.** For payoff gameplay with audio, use clips 8-11. For voice-over editing, use `a:2` (mic) when you need a clean voice with no game sound under it.
* Frame rate is ~60 fps (variable-ish: 59.3-60). Everything is a 16:9 full-screen capture **including the Windows taskbar at the bottom (~40 px) and a thin title bar at the top**, so crop/zoom for the final cut. The Orbit UI is small and dark on a 1080p canvas; zooming to cards/panels is advisable.
* **Creator decision: skip the profanity (clip 1 at 13:56) to keep the video clean.** Treat clip 1 13:55-14:06 as excluded; usable footage on either side.
* Language: English. Language/content flags for editing: **clip 1 at 13:56 contains an f-word** ("I'm probably f***ing sh** up by doing all this"); clip 9 at ~1:42 has an audible burp joke; clip 9 ~1:42 mentions "my girlfriend"; clip 9 4:13-4:25 jokes about the dog Laika.

## Frames
`frames/N/tSSSSS.jpg` = one frame every 10 s at 640 px wide (file number = seconds into clip, e.g. `t00290.jpg` = 4:50). `frames/N/sSSSSS_D.jpg` = scene-change frames (threshold 0.25, so only big visual changes; the dark Orbit UI changes subtly, so there are few: clip 1 @2:58, clip 8 @1:39 and 3:06, clip 9 @5:27, 5:59, 6:24, 7:36, 9:59, 10:02, 10:17, 11:57, 12:12, clip 10 @0:18, 0:24, 0:36, 1:06, clip 11 @0:17, 0:37, 1:26, 1:27, 1:46, 1:51). Total ~345 JPEGs, 5.3 MB.

## Cast (agents and names seen on screen)
* **R7 Orbit** = the creator's own agent-orchestration app (dark "canvas" with a hub "orbit-the-game" and agent cards around it; chat panel right; whiteboard; settings). "Orbit" is also the lead/orchestrator agent the creator chats with.
* Agents named on cards: **Atlas** (Game Design Research), **Briar** (Creative Director, clips 1-2), **Cedar** (Build: Core engine), **Dune** (Build: Stages & choices), **Fern** (Build: HUD & screens), an agent for Renderer & VFX, **Harbor** ("Integrate & playtest", Opus 5.5), Phase-3 team: **Iris** (Creative Director, Opus 5.5), **Juno** (UI Designer), **Kestrel** (Sound Designer, Sonnet 5.5), **Lark** (Engine & 3D Renderer), and a "Simulation & Infinite Universe" agent (clips 6-7). Later renamed space-themed (Voyager, Kaisar, **Polaris** (background/dev-menu agent), **Rigel**, Laika/Leica) per clip 9 3:56-4:25.
* Game: **Vesper Drift**, a browser clone of the Steam game *Drifter Star: Evolution*. Evolution chain: Meteorite -> Asteroid -> Dwarf Planet -> Rocky/Gas planet -> Star -> Black Hole. Two versions exist: 2D top-down (clip 5) and 3D with radar HUD (clips 8-11).

---

## 1. Clip-by-clip timelines

### Clip 1 (14:34) - Kickoff, research agents, orchestration, first PR merge
Speaker: creator only (no agent voice; the R7 assistant bubble answers in text only).
Summary: The creator introduces R7 Orbit, creates the `orbit-the-game` repo, asks an agent for game ideas, picks *Drifter Star*, then lets Orbit orchestrate research agents and a creative director while clicking permission cards; ends with merging pull requests.
Chapters: **1 (cold open), 2 (research), 4 (permission cards), 5 (PRs/merge), 6 (director in passenger seat)**.

| Time | What happens |
|---|---|
| 0:00-0:30 | R7 Orbit start screen "Direct every agent, in one view."; creator intro: "welcome to R7 Orbit... basically vibe coding on steroids" (0:04-0:27). |
| 0:30-0:50 | "Open a repository" dialog: new repo `orbit-the-game`, "also create on GitHub". |
| 0:50-1:20 | Empty canvas with the hub; creator: "I literally have no ideas." (1:00-1:11). |
| 1:20-2:00 | Creates an agent (Sonnet 5.5) asking for space-game ideas; it was set to Low by mistake (1:40-2:00, "silly me"). |
| 2:00-2:50 | Agent's reply with game ideas (gravity slingshot, orbital station, Dyson Drift...). Creator reads, "that sounds boring" (2:12-2:20). |
| 2:55-3:15 | Switches to Steam: finds **Drifter Star: Evolution** page (frames 3:00, 3:10). |
| 3:19-3:50 | Prompts agent to clone it ("because I'm really creative and have so many ideas" - joke); denies the Low-effort agent. |
| 3:55-4:40 | Delegates to Orbit: research the game, plan a clone, a second agent for functionality, a creative director for look and feel, build in the browser. |
| 4:50-5:50 | **First permission cards**: "WebSearch wants permission - Allow once / Deny"; "Game Design Research" and "Creative Director" cards; creator: "allow, allow, allow" (4:46-4:55). |
| 5:28-5:55 | Model plan: Sonnet 5.5 medium to build, Opus 5.5 high to polish. |
| 6:02-6:46 | Rant about permission prompts and the lost "allow all" button; Agent permissions settings panel (6:10). |
| 6:30, 7:30, 9:30-9:50 | More permission cards ("Write wants permission", "Read wants permission"). |
| 6:46-8:30 | Gives agents the Steam link; page cannot be read by the agent; two research chats side by side. |
| 8:20-9:20 | **"I'm gonna sit in the passenger seat... I want you to be the orchestrator... run the show."** (8:23-9:15) |
| 9:27-10:07 | Orbit/Briar asks questions: 2D top-down or 3D? ("3D like the original", 9:44); 12 stages, mouse-only, faithful clone. |
| 10:19-11:22 | **Funny**: addresses the R7 assistant by voice ("Hey R7, create another note..."), a blue robot bubble ("Listening...") appears (10:30-11:50 frames); assistant mishears; "shut up R7, you didn't let me talk long enough, I'm upset" (11:15). |
| 11:39-11:52 | Reflection: should have prompted for more autonomy. |
| 12:32-12:46 | Joke: "if robots ever become real workers, it's going to be so easy to manage them until they get upset... fire one of their friends and they try to kill you." |
| 12:48-14:20 | Asks agents to push, open a pull request and merge: cards show "Pull request #2 merged" etc. "Merge it. Regular merge." (13:40) "Merge it. Ay yi yi." (13:50). Language flag at 13:56. |
| 14:07-14:34 | Wrap-up: "right now it's just me yapping constantly", stops recording. |

Best moments (in-out):
* **0:04-0:27** Cold-open pitch (ch.1).
* **3:19-3:40** "I want to build my own clone... because I'm really creative and have so many ideas" (comic beat, ch.1/2).
* **4:46-5:00** "allow, allow, allow, allow" + WebSearch permission card on the canvas (ch.4). Frame `t00290.jpg`.
* **6:12-6:46** Permission-fatigue rant (ch.4/6).
* **8:23-9:15** "Passenger seat... be the orchestrator, run the show" (ch.6 thesis line).
* **10:19-11:22** Hey R7 / "shut up R7, I'm upset" (comedy).
* **12:32-12:46** Robot-workers joke (comedy/ch.6).
* **13:40-13:56** "Merge it. Regular merge." / "Ay yi yi." with PR-merged cards (ch.5). (Cut before 13:56 for language.)

### Clip 2 (1:40) - Build agents start (private branches), permission cards, canvases
Speaker: creator only.
Summary: Quick update; the creator moves the planning agents to a "plan" canvas, then asks Orbit to create a "build" canvas and spin up four build agents that work in sibling branches.
Chapters: **4 (everyone at once, permission cards), 3 (specialists)**.
* 0:00-0:03 "that was like so fast." 0:00-0:30: three **permission cards at once** ("Read wants permission - Allow once / Deny") on cards **Build: Stages & choices (Dune)** and **Build: Core engine (Cedar)** next to finished cards Atlas (PR #1 merged) and Briar (PR #2 merged); creator "allow all of these to run free" (0:24-0:31).
* 0:34-0:55 Voice-style prompts: "Create a new canvas called build. Now move all the build agents to the build canvas." Canvas tabs "plan"/"build"; "Tidy" (0:40-0:55 transition frames).
* 1:00-1:40 Four build agents around the hub: **Core engine, Renderer & VFX, Stages & choices, HUD & screens**, all "working". Creator: "they're probably all doing the same thing" (1:31); mentions "sibling branches" (1:23).
Best moments: **0:00-0:31** (several permission cards at once, ch.4); **1:00-1:40** (four agents on one canvas, ch.4/3; best clean "team on one canvas" shot, frames t00060-t00090).

### Clip 3 (3:12) - Four builds finished, merge to main, integration agent
Speaker: creator only.
Summary: All build agents finished; Orbit says to merge four branches; the creator tells each agent to merge to main ("Each task worktree is separate"), then asks for an Integrate / play-test agent.
Chapters: **5 (merge, creator decides), 4 (private copies), 6 (QA agent introduced)**.
* 0:01-0:40 "all the agents just finished the build agents at least"; Orbit's summary says all four reviewed cleanly; "next you need to merge all four branches into main. Each task worktree is separate" (0:33-0:45). Canvas shows four cards with "Pull request #... merged".
* 0:43-2:05 Creator: "I'm just going to tell each one of these to merge... merge this to main, not me" (0:52-1:35); long chat reply.
* 2:06-2:40 Orbit proposes a new agent to integrate and play-test; card **"Integrate & playtest"** appears (2:10-2:30).
* 2:40-3:10 Creates canvas named "Integrate" -> "play test" (2:30-3:00); empty canvas at 2:50-3:12.
Best moments: **0:33-0:50** (explains separate task worktrees/branches, ch.4/5); **0:52-1:35** ("merge this to main, not me", ch.5 creator-decides); **2:06-2:30** (integrate+play-test agent appears, ch.6).

### Clip 4 (0:22) - Switch integrator to Opus 5.5
Speaker: creator only. Very short.
* 0:01-0:20 "It was integrating, I stopped it because I wanted to use Opus 5.5 instead... set to medium" (0:01-0:20). Screen: **"Integrate & playtest (Opus)"** card, Harbor, Opus 5.5 medium, "PR #5 merged".
Chapter: 5/6 (model choice). Best moment: **0:01-0:20** (picks model per task; director role).

### Clip 5 (4:00) - Merge issue, then first look at Vesper Drift (2D)
Speaker: creator only (no game audio recorded).
* 0:01-0:30 Integrate & playtest finished but had merge problems: "I had to run something in terminal" (0:10-0:22); merge succeeds (0:27-0:30). Chat panel shows PR #7 merged.
* 0:32-0:60 "Perfect, I ran everything"; asks "Is the game ready to be played? Can you open it in the browser?" (0:45-0:55); "I typed this in the wrong chat" (1:00-1:02).
* 1:06-1:15 **Title screen "VESPER DRIFT - Grow from a glowing pebble into a black hole. Absorb what is smaller, avoid what is larger."**
* 1:15-3:36 **First 2D gameplay**: Meteorite -> Asteroid (HUD "METEORITE 1.1 / ASTEROID 3.1", run timer). 2:20 "Leaving the known set - turn back" banner. Evolves to Asteroid ~2:30 (frame t00150). Creator critique: "I was hoping for better", "no sound effects", "I'd like it to look better", "should chip away at larger ones", "there's a little bit of gravity... there should be more" (1:31-3:12).
* 3:36-3:57 Pause screen; verdict: "not bad, I can work with it" (3:29-3:43), plans sound effects. Ends 3:57.
Best moments: **1:06-1:20** (title screen with tagline - great chapter-7 sting or ch.6 bridge); **1:35-2:40** (clean 2D gameplay, no HUD clutter, silent; needs music/sfx added in edit); **3:29-3:43** ("it's not bad, I can work with it", honest first reaction).

### Clip 6 (1:22) - Phase 3: hiring the specialist team
Speaker: creator only.
Summary: Creator describes new agents on a "Phase 3" canvas: a new creative director with Steam screenshots as reference, UI, sound design, simulation/gravity, an "infinite universe" map and real 3D with Three.js.
Chapters: **3 (hiring specialists), 4 (everyone at once)**.
* 0:00-0:20 Canvas with five cards: Creative Director, UI Designer, Sound Designer, Simulation & Infinite Universe, Engine & 3D Renderer around the hub.
* 0:02-0:31 "I have more agents working on the fixes... making things actually 3D... a new creative director agent referencing the images I gave it" (0:09-0:31). 0:20-0:30: Windows file-explorer dialog with Steam screenshots (the reference images).
* 0:35-0:80 Voice-over listing roles: UI ("I want better UI", 0:35), sound design (0:39), simulation of gravity and "other things" (0:43-0:49), "an infinite universe... procedurally generated" (0:54-1:05), "actual 3D assets with Three.js" (1:10-1:15).
Best moment: **0:35-1:20** (the roster speech; use over the canvas shot 0:00-0:20 and 1:00-1:10, ch.3).
Gap: the actual act of *creating* these agents is not on screen; only the finished canvas and narration.

### Clip 7 (0:53) - "It's a new day": merge conflicts sent back to agents
Speaker: creator only.
* 0:01-0:06 "It's a new day. There were some merge conflicts."
* 0:08-0:18 Conflicts "between Lark and Juno, the engine and 3D renderer and the UI designer".
* 0:18-0:50 "I let Orbit know and it went ahead and sent follow-ups to each of them"; "Lark has merged, no conflicts, now we're waiting on Juno" (0:30-0:50). On screen: five agent cards (Iris - Creative Director **finished, PR #10 merged**; Kestrel - Sound Designer **finished, PR #11 merged**; Juno - UI Designer **working, PR #14**; Lark - Engine **PR #13**; Simulation) and Orbit chat: "Nothing has changed... Lark (PR #13) and Juno (PR #14) are still pushed with open PRs... if there's a conflict or a failing check, tell me what it says and I can send the fix to the agent."
Chapters: **5 (conflicts sent back to agents)**, 4 (parallel agents).
Best moment: **0:04-0:50** whole clip (best and only explicit conflict footage; strongest ch.5 clip). Tight cut **0:08-0:18 + 0:30-0:50**.

### Clip 8 (8:26) - 3D version flops; cost; new Orbit features (whiteboard, sounds, TTS voice)
Speaker: creator, plus Orbit TTS at 7:54 and 8:05. **Game sound IS present (system stream) from 0:23-3:48.**
* 0:00-0:20 "Ended up starting phase four... audio didn't work and 3D wasn't loading... this is the game now" (0:00-0:20). Cards visible; game loads at 0:20.
* 0:20-2:05 3D Vesper Drift with sci-fi HUD (METEORITE, radar, target analysis). Critique: "I like the 3D meteors... going way too fast... don't like the targeting outlines... I like the UI... radar unnecessary" (0:28-1:00); "no gravity though" (1:18-1:35); "nice animation, like the sound effects" (1:40); "I'm definitely removing the radar" (1:54-2:00); "explosions are pretty cool" (2:04). Bloom glows at 1:00-1:10, 2:20-2:50.
* 2:10-3:50 Restart title screen then near-unplayable moments: "alright this is not really playable" (2:26), **"Opus did not cook with this, not gonna lie"** (2:40-2:47), "the 2D version is better" (2:47), "this is very overwhelming, what is happening" (3:36). Pause menu (3:10-3:30).
* 3:46-4:20 Verdict: "the first version was better... I'm just gonna not continue it" (3:46-4:17).
* 4:20-5:10 **Cost screen: "$445.97"** usage in API-equivalent terms; creator: "$446... on a game which is not playable... it's just using my Claude account... Max plan, 17% for the week" (4:32-5:06). Frame t00270 shows the $445.97 and per-agent usage bars; Claude usage page at 4:50-5:00.
* 5:16-6:10 Shows new R7 features: "dev" project, a **whiteboard** (tldraw-style) for diagrams/mood boards agents can read (6:08-6:47; frames 5:50-6:50), multiple boards.
* 7:00-8:10 **Settings -> Sounds**: bell when agent waits, different cues for Orbit needs you / done / problem; "agent speaks its name... 'Atlas needs you'" (7:10-7:46); voice picker; TTS preview at **7:54 and 8:05** ("This is how I will read answers to you") and creator "I hate that voice" (7:58-8:05); idea of ElevenLabs voice for R7 (8:10-8:20).
* 8:23 "that's it."
Chapters: **7 (payoff - mixed/negative), 6 (director honesty about failures), whiteboard/TTS = optional B-roll for ch.4/6**.
Best moments:
* **2:40-2:47** "Opus did not cook with this" (comic beat; ch.6/7 "not everything works").
* **3:46-4:17** Honest verdict "first version was better".
* **4:32-5:06** "$446 ... Max plan 17%" cost reveal (strong for ch.6 / outro; text on screen 4:30-4:35).
* **7:10-8:08** Orbit sounds + TTS voice demo (only place with real agent TTS voices, ch.4 "everyone working at once" B-roll for "Orbit tells you when an agent needs you").

### Clip 9 (12:18) - GitHub sync fixes, play-through with gravity, evolution cards, agents renamed, backgrounds
Speaker: creator; Orbit TTS at 2:17 ("Atlas needs you") and 10:21 ("Polaris is done"). **Game sound IS present** (system stream) 0:00-1:33, 4:31-8:06, 9:03-10:55, 11:30-12:17.
* 0:00-0:58 R7 Orbit self-improvement: fixed GitHub issues, sync of repo state "I want this to be as autonomous as it can be" (0:00-0:35). Screen: Phase-4 canvas with cards (Add gravity..., Remove outlines..., Evolution choice preview, Remove radar), Vesper Drift ("**EVENT HORIZON**" end-screen after dying to a black hole) at right (0:00-1:20).
* 0:58-1:21 "I just played through it. It took 12 minutes. I died to a black hole." Gave new prompts as it played.
* 1:21-2:50 New sound cues explanation; pause menu (1:30-2:10) and settings -> sounds (2:10-2:50). **Agent TTS "Atlas needs you" at 2:17.** Reminder every 5 minutes if away (2:38-2:50).
* 2:53-3:17 "everything here is done. Go ahead, push this to GitHub." -> GitHub banner disappears (3:08-3:17) (ch.5 creator pushes).
* 3:24-4:25 Asks Orbit for the update on what each agent did; agent chat summary 3:34-3:56; **agents renamed space-themed: Voyager, Kaisar, Polaris, Leica** + Laika joke (4:02-4:25).
* 4:20-4:30 Title "VESPER DRIFT" tagline screen.
* 4:28-7:20 **3D play-through**: HUD METEORITE -> ASTEROID -> DWARF PLANET (stats up top left), asteroids, planets with lava texture (6:00), ringed planet (7:00), gravity test ("I feel like I can kind of feel it pulling me... I guess its gravity isn't strong enough", 5:22-6:13), "this feels very very very much like Drifter Star" (5:55-6:03), asteroid spawning-on-screen complaint (6:13-6:27).
* 7:20-7:55 **"Evolution branch detected" cards**: Frozen Fortress / Cradle of Life / War Planet / Abandon Evolution (7:40-7:50); creator: "it just looks so good, this is all in the browser, very impressed" (7:20-7:32); "images so you can see what you'll evolve into... a little pixelated" (7:32-7:50).
* 7:55-9:00 Needs stars in background ("feels like we're in a void or underwater", 8:11-8:28); pause screen at 8:00-8:40; dispatches fix; agent "Remove outlines and simplify background" card (8:30-9:00).
* 9:19-10:20 Game plays DWARF PLANET; wants to bang into big asteroids to break off pieces and capture them (9:42-10:04); more gravity talk (10:07-10:18). Evolution cards (planet branch: Terrestrial / Lava / Metallic / Abandon) at 10:20-10:55.
* **10:18-10:21 "Polaris is done" (creator) + TTS "This is done" (10:21)**.
* 10:30-11:50 Reviews new star background: "they look like very far away planets... flat speckles" (11:33-11:50).
* 12:04-12:18 "I'm not going to keep recording... I will be back." Last gameplay frames 12:00-12:10.
Chapters: **5 (push to GitHub), 6 (director), 7 (gameplay payoff, mid-quality), 4 (agent notifications)**.
Best moments:
* **0:58-1:10** "12 minutes, I died to a black hole" (creator has *played* his game; ch.7 hook). Pairs with EVENT HORIZON end screen (0:00-1:20).
* **2:17-2:19** Orbit TTS "Atlas needs you" (agent voice, ch.4).
* **2:53-3:17** "push this to GitHub" (ch.5).
* **3:56-4:25** Agents renamed: Voyager, Kaisar, Polaris, Leica / Laika (ch.3/6 charm).
* **5:50-6:05** "feels very much like Drifter Star" + 3D gameplay (ch.7).
* **7:20-7:50** Evolution-branch cards + "very impressed, this is all in the browser" (ch.7; best single reaction in clip).
* **10:18-10:22** "Polaris is done" + TTS.

### Clip 10 (3:11) - Background/nebula update, developer start menu requested
Speaker: creator; Orbit TTS "Polaris is done" at 1:57. **Game sound present** (system stream) most of 0:00-2:51.
* 0:01-0:28 Polaris added stars; asks for galaxies/nebula "closer to Drifter Star" (0:15-0:28). Gameplay: Asteroid; **bright white sun fills the screen at 0:20**, gas giant (blue striped) at 0:30-0:55 with "DEEP VOID" banner, **red-tinted "hull integrity critical" damage alert at 1:00** (frame t00060).
* 0:55-1:10 "running into bigger objects... not damaging me. Oh no, it's definitely damaging me."
* 1:10-1:45 Asks for a developer menu to start as any planet/evolution stage "so I can test them" (1:28-1:45); agent card "Developer start menu" (1:20-1:50 frames).
* **1:57-1:59 TTS "Polaris is done."**
* 2:00-2:50 **New purple/teal nebula background** (frames 2:10-2:50); "this looks a lot better, I like this a lot actually" (2:14-2:31); pause menu 2:50.
* 2:31-2:48 Decides to skip Drifter Star's "capture" feature; asks for dev start menu and signs off.
Chapters: **6 (director iterating), 7 (visual improvement)**.
Best moments: **0:00-0:55** (gameplay with sound, big sun + gas giant, ch.7 B-roll); **1:28-1:50** (director gives a one-sentence feature request, ch.6); **1:57-2:20** (TTS + new nebula + "this looks a lot better", ch.6/7).

### Clip 11 (3:36) - Dev start menu done, black hole stage, verdict, outro
Speaker: creator; Orbit TTS "Rigel is done" at 2:50. **Game sound present** 0:22-2:25.
* 0:01-0:20 "Developer start menu is done... also added a back-to-main-menu button in the pause menu" (0:06-0:20). Developer start menu card (Rigel) at 0:00-0:17.
* 0:20-0:40 **DEV START screen** (choose Meteorite/Asteroid/Dwarf/Rocky/Gas giant/Star/.../Black hole + branch variants) (0:20-0:35).
* 0:40-1:20 Starts as Gas Giant in a nebula; sizes shown (mass stat 237 -> 270); **huge orange sun at 1:00-1:10** ("this just shows you how big things are"; 1:03-1:12).
* 1:20-1:35 Pause menu, back to Dev Start, pick Black Hole (1:26-1:35).
* **1:40-1:50 Black-hole stage**: black hole with orange accretion disk and bright jet star; "it gets kind of crazy... there are other black holes way bigger" (1:39-1:50); then end screen **"BLACK HOLE - Transmission complete: You collapsed into a singularity and become the light around you. Silence rushes over the stars you consumed" with Drift Again button** (1:50-1:55).
* 1:55-2:20 **"Oh, beat it. Never thought I'd have to get bigger like the other ones... so far I'd say the clone is a big success... definitely a game I could see myself playing when I'm bored."** (1:50-2:14).
* 2:00-2:30 Meteorite play after restart; pause; agent card Rigel "Developer start menu" (2:30-3:30).
* 2:21-2:50 Plans to host browser projects on a website. **TTS "Rigel is done." 2:50**.
* 3:16-3:28 **"I might start another project and have Orbit actually just edit this video for me and choose all the highlights, just make it for me."** (3:16-3:28) 3:28 "okay goodbye".
Chapters: **7 (gameplay payoff, best), 6 (director), outro**.
Best moments:
* **1:39-1:55** Black-hole stage + "Transmission complete" end screen (strongest visual payoff; with sound).
* **1:55-2:14** "clone is a big success" verdict (ch.7 closer).
* **3:16-3:30** "have Orbit edit this video for me... okay goodbye" (perfect meta outro for the vlog).
* **0:20-0:40** dev start menu (shows the team shipping a feature on request).

---

## 2. Chapter-to-clip coverage

Rating: **Strong** = enough clean, usable footage with matching narration; **OK** = usable but needs B-roll or voice-over; **Weak** = thin or indirect; **Missing**.

| # | Chapter | Best footage (clip: in-out) | Rating | Notes / gaps |
|---|---|---|---|---|
| 1 | Cold open: "I wanted a team, not one AI" | 1: 0:04-0:27 (intro), 1: 8:23-9:15 (passenger seat), 1: 12:32-12:46 (robot-workers joke), 11: 3:16-3:28 | **OK** | The creator never says the exact "team, not one AI" line; the hook must be assembled from voice-over or from 1: 3:55-4:40 (delegating to Orbit). Footage opens on a dark mostly-empty screen (1: 0:00-0:50) so the visual hook is weak; consider a punchy gameplay flash (11: 1:40-1:55) as a cold-open teaser. |
| 2 | Research agents: what makes a space game fun; how space really works | 1: 1:20-2:50 (ideas agent), 1: 2:55-3:15 (Steam page), 1: 4:40-8:20 (Game Design Research + Creative Director with permission cards) | **Weak-OK** | The *fun* research is covered. **"How space really works" research is not in the footage**: no agent doing physical/space-science research, and no spoken mention. Closest is the Simulation & Infinite Universe agent (clip 6, gravity). Needs voice-over or a screen recording not currently shot. Research outputs are walls of tiny text on screen; zoom needed. |
| 3 | Hiring specialists (creative director, UI, sound, engine, renderer, simulation) | 6: 0:00-1:20 (roster speech + canvas), 2: 1:00-1:40 (build agents), 7: 0:00-0:50 cards (Iris, Kestrel, Juno, Lark), 9: 3:56-4:25 (renamed agents) | **OK** | Never see "hiring" happen (agent creation dialogs only in clip 1 1:40-2:00 for the first research agent). Creative director appears in clip 1 and 6; all six roles appear together only in clips 6-7 as cards. Names/roles are legible only when zoomed. |
| 4 | Everyone working at once on one canvas, private copies, permission cards | 2: 0:00-0:31 (multiple permission cards), 2: 1:00-1:40 (four agents), 1: 4:46-5:50 / 6:30 / 7:30 / 9:30-9:50 (permission cards), 3: 0:33-0:45 ("each task worktree is separate"), 2: 1:23 ("sibling branches"), 6 and 7 (5 cards), 8: 7:10-7:46 + 9: 2:17 (Orbit sound/TTS alerts) | **Strong (visual) / Weak (private copies)** | Parallel agents plus permission cards are well covered. "Private copies" (git worktrees/branches per agent) is only said in passing; no screen showing the separate worktree/branch names (cards show tiny ids such as `build-core-engine-bfc394`). Consider an animated overlay. No all-at-once footage with sound (system audio silent in clips 1-7). |
| 5 | Merging: conflicts sent back to agents; creator decides what goes to GitHub | 7: 0:04-0:50 (conflicts, follow-ups), 3: 0:33-1:35 (merge instructions), 1: 12:48-14:07 (PRs and merge), 5: 0:10-0:30 (terminal fix), 9: 2:53-3:17 (push to GitHub), 4: 0:01-0:20 | **Strong** | Clip 7 is excellent. Conflict resolution itself (diffs) is never shown, only narrated plus Orbit chat text; PR cards "merged" are the visual. Clip 1 13:56 profanity must be cut. |
| 6 | Director, not coder; plus a QA agent playing the game | 1: 8:23-9:15, 10: 1:28-1:50, 9: 5:50-6:05 + 8:11-8:30, 8: 2:40-2:47, 3: 2:06-2:30, 4: 0:01-0:20, 8: 4:32-5:06 | **OK / QA = Weak** | Director theme is well covered (passenger seat, one-line feature requests, "Opus did not cook", cost reveal). **QA agent playing the game is essentially missing**: an "Integrate & playtest" agent (Harbor) is created (clip 3 2:06-2:30, clip 4) and the card is visible in clips 4-5 (0:00-0:30), but no footage shows it playing or reporting bugs; the creator plays the game themself. Needs new footage, or reframe as the integrator agent that "plays tests". |
| 7 | "This is the game" gameplay payoff | 11: 1:39-2:14 (black hole + verdict), 9: 5:50-7:55 (3D play + evolution cards), 10: 0:00-0:55 and 2:00-2:50 (nebula, sun, gas giant), 8: 0:20-2:05 (3D HUD), 5: 1:06-2:40 (first 2D) | **Strong** | Several minutes of decent gameplay with sound (clips 8-11). Weaker visuals: stars look "flat speckles" (9: 11:33-11:50). The best-looking continuous sequences are 10: 2:00-2:50 and 11: 0:40-1:55. Clips 8-11 show browser gameplay with the HUD; crop out the taskbar. |

Other usable segments outside the seven chapters: **outro**: 11: 3:16-3:30 (Orbit edits this video). **Cost transparency**: 8: 4:30-5:10 ($445.97 equivalent, 17 % of Max weekly). **Orbit product features** (whiteboard 8: 5:50-6:50, sound/voice settings 8: 7:00-8:10).

## 3. Overall suggested shape (for the next stage; flexible)
* **Ch.1** 1: 0:04-0:27, 1: 8:23-9:15 (or voice-over), flash of 11: 1:40-1:55 as teaser.
* **Ch.2** 1: 3:00-3:15, 1: 3:55-4:40, 1: 4:46-5:00.
* **Ch.3** 6: 0:00-1:20 (+ 9: 3:56-4:25 for names).
* **Ch.4** 2: 0:00-0:31 and 2: 1:00-1:40, 1: 6:12-6:46 (permission fatigue), 3: 0:33-0:50.
* **Ch.5** 7: 0:04-0:50, 3: 0:52-1:35, 1: 13:40-13:56, 9: 2:53-3:17.
* **Ch.6** 8: 2:40-2:47 / 3:46-4:17 / 4:32-5:06, 10: 1:28-1:50; QA agent: needs new footage.
* **Ch.7** 11: 1:39-2:14, 10: 2:00-2:50, 9: 7:20-7:50, then 11: 3:16-3:30 outro.
