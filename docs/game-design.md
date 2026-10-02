# Game Design Spec: Browser "Drifter Star"-inspired Game

> **Research status (read first).** Web access was available. I found the game and read its Steam store page, Steam community hub, one discussion thread, the achievement list, and one review summary. Several other Steam pages (two guides) returned HTTP 429 and could not be read.
> No trailer text, wiki, dev blog or control scheme was found. **Controls, camera, numeric stats, upgrade lists and enemy behaviour are therefore mostly not confirmed.** Anything not backed by a source below is labelled **ASSUMPTION** or is plainly part of "Our design decisions".
>
> **Which game?** The closest match to "Drifter Star (a space game)" is **Drifter Star: Evolution** (Kayla Studio / Happy Kayla, released 2025-12-10, $3.99). It is not the unrelated *Drifter* (a space trading sandbox) or *Star Drifter* (an arcade shooter). **Please confirm this is the intended game** (see Open Questions).

---

## Part A. Confirmed from sources

### A1. Facts about the game
| Item | Detail | Source |
|---|---|---|
| Title / devs | *Drifter Star: Evolution*, developer Kayla Studio, publisher Happy Kayla | [1] |
| Release / price | 2025-12-10, $3.99 | [1] |
| Premise | "Evolve by devouring everything. Grow from a tiny rock into a massive galaxy." Start as a tiny asteroid, consume surrounding matter to grow and transform through celestial forms ("from stardust to cosmic sovereign") | [1][2] |
| Genre tags | Space, Casual, Indie, Physics, Strategy, Relaxing, Roguelike, 3D, Exploration, Singleplayer, Combat, Space Sim | [1] |
| Structure | Single-player, real-time. Evolution stages with strategic choices at milestones. Risk/reward: avoid larger bodies while seeking growth. Environments change with scale (asteroid belts up to galaxy clusters) | [1] |
| Three evolution "trajectories" named on the store page | Frozen Fortress, Cradle of Life, War Planet (store-page wording only; I could not map these to in-game choices) | [1] |
| Reception | Mostly Positive, about 72% of about 1,190 reviews at time of research | [1] |
| Length | Roughly 1 to 3 hours to complete; some reviewers say under 2 hours | [2][3] |
| Platform | Windows, 3D. The recommended spec is high for the scope (i7-10700, GTX 1660) | [1] |

### A2. The 12 evolution stages (from a review)
Meteorite → Asteroid → Dwarf Planet → Rocky Planet → Gas Giant → Gas Planet → Dwarf Star → Star → Giant Star → Supergiant Star → Neutron Star → Black Hole. [3]
The reviewer lists these 12 names in order. The store page says only "asteroids → planets → stars → black holes". Forum posts show the same style of choice labels appearing at the planet, gas-giant and dwarf-star stages. [4][5]

### A3. Core mechanics
- You grow by collecting smaller bodies and avoiding heavier ones; collisions have some "room" (a grace margin). [3]
- Passing a threshold lets you evolve. Some evolutions are **choices** that determine the ending. [3][4][5]
- **Phase-specific upgrades** affect resource collection and collision damage, and most expire after their phase unless stated otherwise. [3]
- Larger bodies chase the player aggressively in mid and late game. Many reviewers say this is the main frustration ("everything will chase you regardless of mass"; bodies "form a conga line to dogpile you"). [2][3]
- A map boundary exists. Going too far shows a warning, and ignoring it kills you or ends the run ("Event Horizon"). [4][5][6]
- Losing is possible by being destroyed by a larger body ("Stellar Fragment"). [4][6]
- The game ends shortly after becoming a black hole; reviewers call the ending anticlimactic. [3]

### A4. Choices and endings (from the achievements and an achievement thread)
| Achievement | Description (store text) | How to get it (per community) |
|---|---|---|
| Stellar Fragment | Turned into endless stellar fragments | Die or lose |
| Creator God | Worshipped as a deity | Win a normal run with an "explosion" ending, avoiding the Cradle of Life picks |
| Cradle of Life | Built the Milky Way where a blue planet was born | Pick **Terrestrial Planet** and **Yellow Dwarf** (other picks are free) → "Milky Way" ending |
| Event Horizon | Crossed the event horizon and became eternal | Cross the map edge and ignore the warning |
| Quantum Cosmos (called "Quantum Universe" in one thread) | A secret, an infinitely recursive secret | Choose only "Abandon evolution" every time → "atom" ending |

One user-reported full Cradle of Life path: Metallic → Lava Planet → Terrestrial Planet → Impregnable → Yellow Dwarf → Asteroid Belt → Red Giant → Yellow Supergiant → Giant Killer → Material Universe. [5] That list mixes stage names with perk or choice names. I cannot tell which is which, so treat it as **evidence that a choice menu with named options appears at most stages**, not as exact data.

### A5. Sources
1. Steam store page: https://store.steampowered.com/app/4067130/Drifter_Star_Evolution/
2. Steam community hub: https://steamcommunity.com/app/4067130
3. Steam reviews (top rated): https://steamcommunity.com/app/4067130/reviews/?browsefilter=toprated
4. Achievement how-to thread: https://steamcommunity.com/app/4067130/discussions/0/691998095298436258/
5. Cradle of Life thread: https://steamcommunity.com/app/4067130/discussions/0/694248809816957969/
6. Achievement list: https://steamcommunity.com/stats/4067130/achievements
7. Not readable (HTTP 429), worth checking manually: https://steamcommunity.com/sharedfiles/filedetails/?id=3631439893 and https://steamcommunity.com/sharedfiles/filedetails/?id=3739268349

Reviews mention the older game *Solar 2* as a comparison ("lacks the intuitive features of Solar 2") [3]. It is a natural design reference, though I did not read its sources.

### A6. What is NOT confirmed
Controls, camera, exact growth thresholds, per-stage choice menus, upgrade lists, enemy types other than "bigger celestial bodies", pickups other than smaller bodies, economy (there is probably none), and the mapping of Frozen Fortress / War Planet to in-game choices.

---

## Part B. Our design decisions and assumptions

Everything below is **our design** unless it cites Part A. Items resting on guesses about the original are marked **ASSUMPTION**.

> **Update 2026-10-02:** the user chose 3D, all 12 stages, mouse-only input and a faithful clone. Sections B3, B4, B6 and Part C reflect that.

### B1. Pitch
You are a drifting rock in a physics sandbox of space bodies. Absorb anything smaller, dodge anything bigger, and grow through a chain of celestial forms from meteorite to black hole. At milestone evolutions you choose a branch that shapes your abilities, how the world treats you, and which ending you earn. Runs are short (about 10 to 20 minutes in our version) and replayable for different endings.

### B2. Core loop
1. Drift and steer, and absorb smaller bodies to gain **mass**.
2. Read the field: which bodies are prey, which are threats, which are roughly equal.
3. Reach a mass threshold, which fills the **evolution meter**.
4. Pick an evolution branch (a choice of 2 to 3 options). This sets perks, the form's look, and the path to an ending.
5. The world re-scales and new threats appear. Repeat through the stages.
6. Reach the final form and trigger an ending (or lose by being destroyed or leaving the map).

### B3. Controls and camera
**Decided by the user (2026-10-02): 3D like the original, 12 stages, mouse only, faithful clone.**
The original's exact controls and camera are not confirmed (A6), so the following is **ASSUMPTION** until footage or a guide confirms it:
- **Camera:** 3D third-person camera that follows the player and pulls back as mass grows, so the player stays about the same on-screen size. Environment changes with scale (belts up to galaxy clusters [1]).
- **Movement:** mouse only. Mouse position or drag steers toward a point in 3D space, with thrust and light inertia. Depth/plane handling (full 3D movement vs. a flat plane with a 3D look) is an open question.
- **Actions:** no keyboard needed. Evolution choices are clicked on cards. Any perk ability is click-triggered.
- **UI:** a mass bar, a stage name, an evolution prompt with choice cards, and an edge-of-map warning.

### B4. Entities

Sizes are relative to the player's mass. All numbers are **tunable placeholders** (ASSUMPTION).

**Player forms (stage ladder, confirmed names [3])**
| # | Form | Role in our design |
|---|---|---|
| 1 | Meteorite | Tutorial scale; dust and pebbles are prey |
| 2 | Asteroid | Asteroid belt appears |
| 3 | Dwarf Planet | First choice menu |
| 4 | Rocky Planet | Choice: e.g. Terrestrial / Lava / Metallic (names from [5]) |
| 5 | Gas Giant | Choice of gas-giant type |
| 6 | Gas Planet | Transitional stage |
| 7 | Dwarf Star | Choice: e.g. Yellow Dwarf / other (the Yellow Dwarf name is from [4][5]) |
| 8 | Star | Gravity well becomes meaningful |
| 9 | Giant Star | Large threats only |
| 10 | Supergiant Star | Very few equals |
| 11 | Neutron Star | Compact, fast, high density |
| 12 | Black Hole | Final form; endgame absorb everything |

**Other entities (ASSUMPTION about behaviour; names generic)**
| Entity | Behavior | Interaction |
|---|---|---|
| Dust / debris | Drifts or orbits; very small | Always absorbed; small mass gain |
| Meteoroids, asteroids, comets | Drift, some on orbits | Prey if smaller than you; a collision hazard if larger |
| Moons / planets / gas giants (NPC bodies) | Orbit or drift; may pursue | Prey, equal or threat by relative mass |
| Stars (NPC) | Strong gravity; late-game chasers per [2][3] | Threat when bigger; destroy the player on contact |
| Rival bodies of similar mass | **ASSUMPTION:** bump with grace margin [3]; exact resolution unknown | Tune from playtesting against the original |
| Map-edge field | Warning zone then a kill or "event horizon" ending [4][6] | Confirmed concept |
| Evolution choice cards | Menu, not a world object | Sets branch and perks |

**Interaction rule (ASSUMPTION):** for body *B* touching the player *P*, compare masses. If P > B × 1.2, P absorbs B. If B > P × 1.2, B damages or destroys P. In between, both bounce with a grace margin [3]. Because we are cloning faithfully, threat AI follows the original's aggressive chase [2][3] (see B6), but every chase parameter is exposed as a tunable so it can be softened later.

### B5. Progression, upgrades, economy, win and lose
- **Progression:** the mass threshold per stage grows geometrically. Each stage has 1 evolution prompt, and about half of them offer a real branch choice. Phase-limited perks (expire at the end of their stage) match [3].
- **Perks (ASSUMPTION examples):** wider absorb radius, collision armour, short dash, gravity pull, slower threat tracking.
- **Economy:** none. Mass is the only resource. (No evidence of a currency in the sources.)
- **Win:** reach Black Hole and trigger an ending. Ending variants: Creator God (default), Cradle of Life (Terrestrial + Yellow Dwarf), Quantum Cosmos (always "abandon evolution"). All three follow [4][5][6].
- **Lose:** destroyed by a larger body (Stellar Fragment); leaving the map after ignoring the warning (Event Horizon, which the original treats as an ending/achievement, so in our design it can be a secret "ending" rather than a pure fail).
- **Extra ending content:** the original ending is called anticlimactic [3], so we add a short epilogue and a post-run summary (stats, ending unlocked).

### B6. World and level structure
- Single contiguous arena per run with a boundary and warning zone [4][6]. Spawn density scales with the current stage rather than fixed levels.
- Zones by scale: debris field → asteroid belt → planetary system → stellar neighbourhood → galactic core. **ASSUMPTION** that the original does something similar ("belts to galaxy clusters" [1]).
- **Threat AI (faithful clone, per user decision):** larger bodies pursue the player aggressively in mid and late game, the behaviour reviewers describe as a "conga line" [2][3]. We replicate this by default. Tunables (all off by default): detection radius, give-up delay, and a mass-ratio cutoff for who chases. Reviewers dislike this behaviour, so these knobs exist for a later difficulty pass.

---

## Part C. Browser MVP scope

### Decisions locked in by the user (2026-10-02)
- The target is **Drifter Star: Evolution** (confirmed by the user's Steam link).
- **3D**, like the original.
- **All 12 stages.**
- **Mouse-only** input.
- **Faithful clone**, including the aggressive chase AI (with tunables).

### C1. Tech approach
**Three.js (WebGL) with TypeScript, built with Vite.** Reasons: the original is 3D, the browser needs a lightweight scene (spheres, particles, a starfield, and glow shaders), and Three.js has the largest ecosystem. Babylon.js is an equal alternative. Physics: hand-written sphere-sphere collision plus simple gravity, with no physics library at first. Use instanced meshes for debris to handle many small bodies. The original's recommended spec is high (GTX 1660 [1]), so budget body counts and add a quality setting.

### C2. Smallest fun slice (revised)
Because 12 stages and 3D are now in scope, the "slice" is a vertical one, not a smaller game:
- **Slice 1 (playable core):** one 3D arena, stages 1 to 4 (Meteorite → Rocky Planet), mouse steering, follow-and-pull-back camera, absorb/avoid rules, the original-style chase AI, the first choice menu (Rocky Planet type), map-edge warning, lose state.
- **Slice 2 (full ladder):** stages 5 to 12 with their choices and the Black Hole ending.
- **Slice 3 (endings and polish):** Cradle of Life, Event Horizon and Quantum Cosmos endings, audio, visual polish.

### C3. Cut or deferred
Keyboard and gamepad support, touch and mobile, localisation (the original has 10 languages [1]), Steam-style achievements (use a simple in-game ending log instead), and any content beyond what the sources confirm.

### C4. Prioritized build order
1. Three.js scene, the player sphere with mouse steering and inertia, the follow-and-pull-back camera.
2. Body spawner (instanced debris plus NPC spheres) and absorb/avoid mass rules with visual size scaling.
3. Mass bar and stage thresholds; form changes with a visual swap (stages 1 to 4 first).
4. Original-style chase AI with tunables.
5. Lose state, restart, and the map-edge warning.
6. Evolution choice UI (click cards) and phase-limited perks.
7. Stages 5 to 12 and their choice menus; the Black Hole ending.
8. The remaining endings (Cradle of Life, Event Horizon, Quantum Cosmos) and an epilogue.
9. Sound, particles, shaders, performance tuning.

### C5. Open questions, resolved by "go with whatever you recommend" (2026-10-02)
These are our design decisions, not confirmed facts, and can be revisited.
1. **Movement in 3D:** a flat movement plane with a fully 3D look (3D models, lighting, a tilted camera). Full 3D steering is awkward with a mouse only. Revisit if footage shows the original uses full 3D flight.
2. **Choice menus:** keep the confirmed options (Terrestrial Planet, Yellow Dwarf, "Abandon evolution", plus the names listed in A4) and invent the rest as **ASSUMPTION** content: 2 to 3 options at the Rocky Planet, Gas Giant, Dwarf Star and Supergiant stages, with the other stages evolving automatically. Replace with real data if footage or the unreadable guides (A5 item 7) become available.
3. **Event Horizon:** treated as a secret ending, matching the original's achievement text ("you became eternal"), not a plain fail.
4. **Epilogue:** add a short epilogue and a run summary. It is the one deliberate departure from a faithful clone, because reviewers call the original ending anticlimactic [3].
5. **Art direction:** defer to `docs/creative-direction.md` when it lands; until then, stylised rather than photoreal, which also keeps the performance cost down.
6. **Performance target:** mid-range desktops first, with a quality setting that lowers body counts for low-end laptops.

**Still genuinely open:** exact growth thresholds, stat numbers, and the original's real controls and camera. These need footage or hands-on play of the original.
