# Creative Direction — *Vesper Drift*

> Working title: **Vesper Drift**. Look-and-feel guide for the build team. No game code here. Companion to `docs/game-design.md` (stage ladder, mass rules, top-down 2D camera), which this guide follows.

## 0. Research status (read first)

Web access was available, but the evidence about the original's look and sound is thin.

**Verified** (Steam store page https://store.steampowered.com/app/4067130/Drifter_Star_Evolution/, plus the findings in `docs/game-design.md` Part A):
- The reference is **Drifter Star: Evolution** (Kayla Studio / Happy Kayla, released 10 Dec 2025, $3.99). You start as a tiny asteroid and grow by devouring cosmic matter, through planets, stars and black holes. Environments scale from asteroid belts to galaxy clusters. You avoid larger bodies while seeking growth.
- Tags: Space, Casual, Relaxing, Physics, Roguelike, 3D. The style is listed as "3D, realistic, and surreal". Windows only.
- A reviewer lists 12 stages: Meteorite, Asteroid, Dwarf Planet, Rocky Planet, Gas Giant, Gas Planet, Dwarf Star, Star, Giant Star, Supergiant Star, Neutron Star, Black Hole. Reviewers say larger bodies chase the player.

**Not found:** screenshot or trailer descriptions, music or sound information, and any review that describes the art. SteamDB returned 403. So everything below about the *original's* palette, UI, audio or camera is **ASSUMPTION** or omitted. The look of Vesper Drift is our own invention, not a description of the original.

## 1. Vision and tone

**One line:** a quiet, luminous drift through a dark sky where you grow from a glowing pebble into a black hole, and every size feels different.

- **Tone:** calm, awe-struck, a little melancholic. Relaxing on the surface, with tension from scale and from things bigger than you.
- **Feeling targets:** *wonder* (the universe gets bigger as you do), *tactility* (everything has weight and momentum), *instant readability* (you always know what is prey, what is an equal and what is a threat).
- **Not:** gritty sci-fi, photoreal, or neon-cyberpunk noise.
- **Pillars:** (1) Glow over detail. (2) Silhouette and color over texture. (3) Motion is the personality. (4) Scale is the story: every stage changes the palette, sound and pace.

## 2. Reference points and how we differ

| Aspect | Original | Vesper Drift |
|---|---|---|
| Rendering | 3D, "realistic, surreal" (**verified** tag) | Top-down 2D, procedural vector art (matches the design doc's decision to cut 3D) |
| Mood | Relaxing (**verified** tag) | Relaxing with a dusk-and-ember, slightly melancholic feel |
| Scale feel | Asteroid belts up to galaxy clusters (**verified**) | Size-relative zoom keeps you at a steady on-screen size while the world shrinks around you. Each of the 12 stages gets its own palette and background |
| Art | Unknown | 100% original, drawn in code. No sprites, no ripped or traced assets |
| Brand | Drifter Star | **Vesper Drift**, our own name, logo, icons and branch names |

**Distinctness rules:** no copied names, UI layouts, icons, music or sounds. Do not trace screenshots. Branch and ending names that the design doc borrows from the store page (Frozen Fortress, Cradle of Life, War Planet and so on) should be given our own names in UI copy. Our identity is *ember-on-indigo* color, *rounded-geometric* shapes and *soft-glow line art*.

## 3. Recommended single style: "Luminous Vector Dusk"

Flat-filled geometric shapes with a thin bright rim light and additive glow, drawn procedurally on a deep indigo void. No black outlines, no textures except a faint film grain.

- Everything is built from circles, arcs and rounded polygons. That is cheap to draw, scales cleanly and suits Canvas 2D (and WebGL later).
- Depth comes from **value and saturation falloff**: far things are darker, bluer and more desaturated; near things are warmer and brighter.
- Each body uses 3 tones: body (mid), shadow side (dark crescent), rim (bright, 1.5–2 px). The light direction is fixed at upper-left, except for stars, which light themselves.
- Glow is the only "expensive" look, so it is reserved for things that matter: the player, threats, prey highlights, UI focus.

### Alternatives considered (short)
1. **Neon Wireframe Arcade.** Outline-only neon shapes on black, heavy bloom. Cheap and readable, but a crowded genre and less relaxing.
2. **Paper-Cut Cosmos.** Matte layered shapes with soft drop shadows and paper grain. Charming and distinct, but needs baked textures and a bigger budget.
3. **Faux-3D Shaded Spheres.** Lit gradient spheres with normal-map-style shading, closest to the original's "realistic" 3D. Most faithful, but the most work for the least originality, and it is riskier for performance.

**Recommendation: Luminous Vector Dusk.** It suits the verified "relaxing, surreal, space" signals, the 2D top-down design, the Canvas 2D tech choice, and a 12-stage ladder that needs cheap recoloring and re-scaling.

## 4. Color palettes

**Core (always on)**

| Role | Name | Hex |
|---|---|---|
| Void deep | Vesper Black | `#070914` |
| Void mid | Night Indigo | `#10142B` |
| Void haze | Dusk Violet | `#2A1F4D` |
| UI panel | Slate Glass | `#161B38` (70–85% alpha) |
| UI border | Slate Line | `#2F3A73` |
| Text primary | Moon White | `#EAF0FF` |
| Text secondary | Mist | `#8F9BC7` |

**Relative-mass colors (the readability system)**

The design doc decides outcomes by mass ratio: prey if the player is ≥ 1.2× the other body, threat if the other is ≥ 1.2× the player, otherwise an equal. So **rim color is driven by that ratio, not by body type.** A planet can be prey one minute and a threat the next, and the color changes with it.

| State | Name | Hex | Rim treatment |
|---|---|---|---|
| Player | Ember Gold | `#FFC15A` (glow `#FF8A3D`) | Warm, brightest thing on screen |
| Prey (player ≥ 1.2×) | Aurora Mint | `#5FF0C0` | Thin rim, faint pulse |
| Equal (within 1.2×) | Glacier | `#7FD6FF` | Thin rim, steady |
| Threat (other ≥ 1.2×) | Flare Coral | `#FF5E73` | Thick rim + slow pulsing outer ring |
| Neutral / dust | Ash Blue | `#5E6C9E` | No rim |
| Rare / choice | Orchid | `#C48BFF` | Used for evolution cards and special bodies |

The body fill keeps its natural stage color (see section 6). Only the rim and ring carry the threat language. The state change is crossfaded over ~250 ms, so it never flickers when masses are near the 1.2× boundary (use hysteresis of ±5%).

**Accessibility:** do not rely on hue alone. Threats also get a thicker rim and a pulsing ring, prey gets a gentle inward pulse, and equals get nothing. A high-contrast setting swaps coral for `#FF9F1C` and thickens rims. Moon White on Slate Glass is ≥ 4.5:1.

## 5. Typography

- **Display / logo / big numbers:** a rounded geometric sans such as *Sora*, *Outfit* or *Exo 2* (Google Fonts, OFL). Pick one and self-host it. Uppercase with +8% tracking for titles and stage names.
- **UI body / labels:** *Inter* or system-ui, 12–14 px, medium. Secondary labels in Mist, uppercase, +6% tracking, 11 px.
- **Numerals:** tabular figures (`font-variant-numeric: tabular-nums`) for the mass counter so it doesn't jitter.
- Draw text in the DOM over the canvas for crispness and accessibility. In-world labels may use canvas text.
- Max 2 font families and 3 HUD sizes (caption 11, body 14, stat 28).

## 6. Per-stage visual progression

The 12 stages follow the design doc's ladder. Because the camera zooms out so the player stays roughly the same on-screen size, **the visual change per stage comes from the player's look, the background tint, and what fills the field**, rather than from raw pixel size. Player on-screen radius is a constant ~22–30 px, growing slightly across stages (see the "Player radius" column), and the *world* shrinks around it.

Branch choices (design doc B4) recolor the stage within its palette family. For example, the Rocky Planet choices (terrestrial, lava, metallic) become three body palettes, listed as "variants".

| # | Stage | Player look (procedural) | Player radius | Core colors | Background / fog tint | Field contents (prey / threats) | Signature VFX | Music & sound mood |
|---|---|---|---|---|---|---|---|---|
| 1 | Meteorite | Small jagged rock (7–9 vertex polygon), ember-hot leading edge with a thin trail, tiny glow | 20 px | `#8A7F9E` body, `#FFB067` heat rim | `#10142B` → `#161B38`, dense dust motes | Dust, pebbles / near-none | Reentry-style sparks and a streak trail | Sparse bell, soft wind-like pad, low thruster hiss |
| 2 | Asteroid | Larger rounded polygon with crater dimples (2–3 dark arcs) | 22 px | `#8E8A9B` body, `#5E6C9E` shadow | `#12162E` → `#1B2447`, a drifting belt band | Meteoroids, small rocks / bigger asteroids | Rock-chip particles on absorb | Pad + a low pulse, slow felt-piano motif |
| 3 | Dwarf Planet | Near-circle, icy, a faint surface patch and a hint of atmosphere haze | 24 px | `#B9C7E6` body, `#7FD6FF` haze | `#161A3A` → `#22305A`, scattered ice dust | Asteroids, comets / larger moons | Comet-tail pass-bys, cold shimmer ring | Glassy chimes, airy pad. **First choice menu** gets an Orchid card glow |
| 4 | Rocky Planet | Circle with terminator shadow, continents as 2–4 baked blobs, thin atmosphere ring. Variants: terrestrial `#4FA3C7`/`#5FBF8F`, lava `#C2452D`/`#FF8A3D`, metallic `#9AA7B8`/`#5E6C9E` | 25 px | variant-driven | `#1A1238` → `#2F2160`, a faint planetary-system haze | Dwarf planets, moons / rocky planets, gas giants | Impact flash and a shockwave ring on large absorbs | Warmer pad, a gentle arpeggio, a first sub-bass |
| 5 | Gas Giant | Big circle with 4–6 horizontal bands that slowly shear, a storm eye (animated ellipse), a faint ring option | 27 px | `#D9A066`, `#B5704A`, `#F2D3A0` bands | `#1F1440` → `#3A1E5C`, Orchid haze | Rocky planets, moons / other gas giants | Band drift, storm swirl, swallowed-body streaks pulled into the surface | Slow, wide chords; a deep drone |
| 6 | Gas Planet | A softer, lighter band version, with more atmosphere glow and a soft haze edge, almost no hard rim | 27 px | `#C9B8E8`, `#8FB4E8`, `#E9D8FF` | `#241446` → `#43266B` | Gas giants, small stars-in-making / stars | Misty particle shedding, gentle pulse | Dreamier reverb, long pad swells (a transitional stage) |
| 7 | Dwarf Star | A bright disc with radial-gradient core, soft corona, 6–8 slow rays. Variants: yellow `#FFD66B`, red `#FF6B4A` | 28 px | `#FFE9A0` core → `#FFB347` edge | `#2A1030` → `#5A1F3A`, Ember haze | Gas planets, planets / bigger stars | The player now lights nearby bodies (a dynamic warm light on the near rim) | Warm swell, first soft percussion (a heartbeat kick) |
| 8 | Star | Brighter disc, a double corona, animated granulation as 3–4 moving blobs, rays | 29 px | `#FFF3C4` core → `#FF9A3D` | `#2F0F2B` → `#6A2338` | Dwarf stars, planets / giant stars | Flares: small arcs that lick outward, with the gravity well visible as faint concentric rings | Full pad, rising bass, driving but soft |
| 9 | Giant Star | A huge red-orange disc, a thick diffuse corona, slow breathing pulse (±8% over 4 s) | 30 px | `#FF8A4D` core, `#C2452D` edge | `#2A0D1F` → `#5A1A2E` | Stars / supergiants | Pulsing shockwave rings, ejected plasma wisps | Heavy, slow chords, deeper drone |
| 10 | Supergiant Star | A blue-white or deep-red giant, a very wide glow, 8–12 long rays, faint instability flicker | 30 px | `#CFE4FF` core → `#7FB0FF`, or red variant `#FF5E73` | `#10153A` → `#1B2A6A`, Glacier haze | Few equals / a handful of other supergiants | Large flares, screen-edge light bleed | Orchestral-style pad, choir-like swells, tension rising |
| 11 | Neutron Star | A tiny, dense, very bright core with 2 thin opposing jets (beams) that rotate fast, a hard glow | 24 px (smaller on purpose) | `#EAF6FF` core, `#7FD6FF` beams | `#05060F` → `#0E1A33`, near-black, a sparse star field | Remnants / other neutron stars and black holes | Pulsar sweep (a rotating beam with a lighthouse flash), sharp rings | Pulse-based rhythm (the pulsar tick is audible), cold bell tones |
| 12 | Black Hole | A pure black disc, a thin photon ring, a warm accretion disc as 2–3 tilted ellipses with a gradient, light bending as a faint distortion ring | 32 px | `#000000` core, ring `#FFC15A`, disc `#FF8A3D` → `#C48BFF` | `#05060F` → `#2A1F4D`, lensed star streaks | Everything else is smaller | Absorb pulls things in a spiral and stretches them (spaghettification), a slow gravitational lens swirl | Sub-bass drone, reversed-bell swells, a final Triumph stem |

**Transition ("evolve") moment, same pattern at every stage:** a 0.4 s freeze-and-inhale (world dims, audio low-passes), a bright white-gold flash ring at 0.4 s, the form morphs over 0.8 s (cross-fade between baked sprites with a scale pop), the palette cross-fades over 1.5 s, and a stage-name banner appears. Branch-choice stages (3, 4, 5, 7 per the design doc) pause on three Orchid cards before the morph.

**Rules that hold across stages**
- The player is always the warmest and brightest thing in frame, even as a black hole (its ring is the bright part).
- Prey/equal/threat rim colors from section 4 are laid over every stage's natural body colors.
- Non-player bodies use the same procedural generators as the player forms, at lower detail, so the world visibly contains "smaller versions" of what you are about to become.
- Visual density per stage: Stage 1–3 have many tiny items (200–300 dust and small bodies, mostly cheap), and stage 9–12 have a handful of huge ones (20–40), so the draw cost stays flat.

## 7. Silhouette and shape language

- **Player:** reads at 16 px as a warm, glowing round form. Stages 1–2 are irregular, stage 3 onward is circular, stage 11 is a small disc with beams, stage 12 is a dark disc with a ring. Silhouette changes at those moments mark each "era" (rock, planet, star, remnant).
- **Rocks / debris:** irregular rounded polygons (7–11 vertices, jittered), no sharp spikes.
- **Planets:** perfect circles with an atmosphere ring and a terminator crescent. **Gas bodies:** circles with bands. **Stars:** circles with radial glow and rays.
- **Danger is signalled by rim, ring and pulse (section 4), not by shape,** because every large body is a circle. Do not add spikes to threats.
- Silhouette test: the player and a same-size threat must be distinguishable in a flat black fill. The player is the only body with a trail and a glow halo, which gives a distinct outline.
- Procedural variation: seed-based vertex jitter, hue shift ±6° and size variance ±15% so no two rocks match.

## 8. VFX

**Thrusters / movement:** a small teardrop flame in Ember Hot → Ember Gold → transparent, 4–10 particles per frame, additive blend. In stages 1–4 it reads as a thruster or heat trail. From stage 5 on it fades to a soft "gravity wake" (a faint ribbon) so planets and stars are not thrusting rockets. A trail ribbon (the last ~20 positions, alpha falloff) conveys momentum.

**Absorb:** the prey is pulled in, shrinking, and streams of mint particles flow toward the player along a curve. A small mint ring pulses on contact. Bigger prey means a longer stream.

**Collisions / destruction:** 3 layers over about 0.5 s: (1) a 2-frame white flash disc, (2) an expanding shockwave ring (stroke only), (3) 12–30 shard particles with drag and spin, tinted to the object. Large bodies add a slow 1.2 s ember dust cloud. Player death ("Stellar Fragment") breaks the player into fragments that drift apart and fade to dust.

**Parallax starfield:** 3–4 layers: dust (0.1× camera speed), far stars (0.2×), mid stars (0.4×), nebula blobs (0.05×, low-alpha radial gradients in the stage tint). A rare foreground layer of out-of-focus motes at 1.3×. Because the camera zooms, scale layers by the zoom factor raised to a small power (≈0.1–0.3), so deep layers barely move on zoom and the zoom reads as pulling away from the field. Stars twinkle with sine alpha, 2–4 s period. Layers wrap by modulo tiling and are pre-rendered into offscreen tiles.

**Glow / bloom:** the default is additive blending (`globalCompositeOperation = 'lighter'`) with cached radial-gradient glow bitmaps per color. The optional "high" setting is a WebGL bloom pass (downsample, blur, composite). Do not use `shadowBlur` or CSS `filter: blur` on animating full-screen content.

**Map edge:** a coral-to-violet vignette creeping from the boundary, a low pulsing hum, and a text warning. Crossing it plays the "Event Horizon" event as a stylized stretch-and-fade, so it can work as a secret ending.

**Ambient:** a subtle vignette and a very faint film grain (≤ 3% alpha, a pre-rendered tile jittered per frame).

## 9. UI / HUD

**Layout (16:9 reference; scale by `min(w/1280, h/720)`)**
- **Top-left:** stage name (display caps), a thin evolution/mass bar in Aurora Mint with a soft glow and a "ghost" trailing fill, and a small next-stage hint.
- **Top-right:** run time and score (tabular numerals), pause and settings icons beneath.
- **Bottom-center:** a context hint that fades after 4 s (controls on the first run).
- **Bottom-right (optional):** the single ability button (Space), a 56 px round button with a ring cooldown sweep, shown once a perk unlocks it.
- **Edge warning:** a banner under the top bar, with a coral pulse.
- Keep the central 60% of the screen free of UI.

**Evolution choice cards:** 2–3 glass cards centered, each with an Orchid-glow outline, a line icon, a name (our own naming), and a 1-line perk. The world is dimmed and slowed to 15% while the cards show. Hover lifts a card 6 px with a glow.

**Style:** glass panels (`#161B38` ~80% alpha, 1 px `#2F3A73` border, 10–12 px radius, no heavy shadows). Accent color only on the active or changed element. Icons are 2 px stroke line icons with rounded caps, inline SVG.

**Motion:** numbers count up with ease-out over 300 ms. Panels slide 12 px and fade over 200 ms. A stage-up banner (display font, letter-spaced) lasts 1.8 s.

**Screens:** Title (the logo over a slow-drifting starfield and a demo body), Pause (dim overlay, 3 big buttons), Game over / Ending (stats, ending name, a prominent "Drift again" button, plus a short epilogue per the design doc), Settings (music/SFX volume, quality, reduced motion, high contrast, screen shake).

## 10. Camera and screen feel ("juice")

- **Camera:** top-down, smooth follow with a critically damped spring (~0.15 s lag) and look-ahead along velocity (~10% of speed). **Zoom is size-relative:** it eases out as mass grows so the player stays about the same on-screen size (design doc B3). Ease zoom continuously, and on stage-up add an extra 1.5 s ease-out "pull back" with a whoosh as the signature wow beat.
- **Screen shake:** trauma-based. Shake = trauma² × max offset (6–10 px, scaled with the zoom so it looks constant on screen), decaying at ~1.5/s. Small absorb 0.1, equal bump 0.2, big hit 0.5, stage-up 0.35 (slow, low frequency). Rotation ≤ 1.5°.
- **Hit-stop:** 40–70 ms on world only, on big impacts and on the final black-hole absorb.
- **Squash and stretch:** the player stretches along velocity up to 8% and squashes 10% on bumps (disabled for the black hole, which should feel inevitable).
- **Feedback stack for absorb:** particle stream, ring pulse, a pitched blip, a bar flash and a mass number pop. Layer 3 or more, each subtle.
- **Weight by stage:** early stages are twitchy (higher acceleration, quick shake). Late stages are heavy (slower turning, longer trails, deeper sounds, longer ease). This is as much art direction as tuning.
- **Damage feedback:** a coral vignette flash (150 ms), a low thump, a brief desaturation.
- **Accessibility:** a "Reduced motion" setting disables shake and flashes and limits parallax. Never flash faster than 3 Hz.

## 11. Sound and music direction

All audio is original. The original's audio is **unknown** (not found in research), and nothing here claims otherwise.

**Music**
- Ambient, slow and warm: soft pads, a sparse felt-piano or bell motif, deep sub drone, a gentle shimmer arpeggio. 60–80 BPM or beatless. A pulse arrives from stage 7.
- 3 adaptive stems that crossfade: *Calm* (pad + bell), *Tension* (low pulse + dissonant interval, when a threat is near), *Triumph* (rising pad on stage-up and the ending).
- Key and timbre by era: **Rock era (1–2)** sparse, dry, A Dorian. **Planet era (3–6)** wider, airy, reverb-heavy, A minor to C lydian. **Star era (7–10)** warm, fuller, with a heartbeat pulse, D major/lydian. **Remnant era (11–12)** cold and spare: the pulsar tick, then sub-bass and reversed swells.
- Loops must be seamless, 60–120 s each, in Opus/OGG with an MP3/AAC fallback, ≤ 1.5 MB per loop. For a small download, build one shared set of stems and layer era-specific instruments on top instead of 12 tracks.

**SFX** (synthesized or recorded, original)
- Thruster: filtered noise whose cutoff follows thrust, kept low (under −24 dB), fading out after stage 4.
- Absorb: a short rising sine blip whose pitch climbs up a pentatonic scale on a combo chain (up to 8 steps, then reset). **Pitch and weight drop with body size,** so a planet absorb sounds deeper than a pebble.
- Threat proximity: a low rumble whose volume rises as a bigger body nears, plus a subtle heartbeat.
- Hit / explosion: layered thump + filtered noise burst + short glassy shards; larger means a longer low tail.
- Evolve: inhale (low-pass sweep), a bell-cluster chord, and a swell.
- UI: soft clicks and airy ticks, never harsh.
- **Mix:** music about 6 dB under SFX peaks, with ducking (music −3 dB for 300 ms on big events). Audio unlocks on first user gesture. Separate music and SFX sliders.
- Tech: Web Audio API. Most SFX can be generated procedurally (oscillators + noise + envelopes), keeping the file count low.

## 12. Animation principles

1. **Ease everything.** Default `easeOutCubic`. Use overshoot (`easeOutBack`) only for celebratory pops.
2. **Anticipation and follow-through:** a 60–100 ms wind-up before big actions, a springy settle after.
3. **Secondary motion:** trails, rim glints and particle drag follow the main motion.
4. **Idle life:** nothing is fully still. Slow rotation, a breathing glow (±6% over 3 s), twinkling stars, shearing gas bands, pulsing coronas.
5. **Weight through scale:** large bodies rotate and move slower and sound deeper.
6. **Timing:** UI 150–300 ms, gameplay feedback 60–200 ms, cinematic beats 1–2 s.
7. **Consistency:** one easing family and one duration scale. Everything uses delta time and behaves the same at 30, 60 and 144 fps.

## 13. Technical constraints for the browser

**Targets:** 60 fps on a mid-range integrated-GPU laptop, ≥ 30 fps on a 3-year-old phone. Load in under 3 s on broadband. Total download (code + audio + fonts) ≤ 5 MB, ideally ≤ 2.5 MB.

**Performance budget (16.6 ms at 60 fps):** update/sim ≤ 4 ms, render ≤ 8 ms, headroom ≥ 4 ms.
- Active particles: ≤ 800 (desktop), ≤ 300 (mobile). Pool them, with no allocation in the hot loop.
- Live bodies: ≤ 300 early, falling to ≤ 60 late (see section 6). Cull bodies off-screen, use a spatial hash for collisions, and draw tiny bodies (< 3 px on screen) as single-pixel dots or skip their rims.
- Cache gradients and glow sprites. Never create gradients per entity per frame.
- Cap devicePixelRatio at 2 (1.5 on low quality). An auto quality governor steps quality down when the average frame time exceeds 20 ms for 2 s (bloom off, then fewer particles, then lower DPR).

**Procedural vector vs sprites:** **prefer procedural, vector-drawn art.** It gives a tiny download, resolution independence (important with the constant zoom changes), trivial palette and stage recoloring, seeded variety, and no asset-licensing risk for a clone-inspired game. **Bake** expensive pieces (glows, nebula tiles, star tiles, planet bodies with bands, corona gradients) into offscreen canvases or `ImageBitmap`s at a few resolutions, and blit them. Re-bake a body's sprite when the zoom crosses a threshold, so edges stay crisp. Use hand-made sprites only for the logo, if at all.

**Renderer recommendation**
- **Default: Canvas 2D** with baked sprites and additive blending. It fits the design doc's plan (Canvas 2D, Vite, no engine) and is enough for this style.
- **Upgrade path: WebGL** (PixiJS or raw WebGL2) if particle counts or the bloom pass demand it. Hide the renderer behind a thin interface so it can be swapped. WebGL is also the right place for the black hole's lensing distortion if we want it, but a fake with ring gradients is fine for MVP.
- Fixed-timestep simulation (1/60 s) with interpolated rendering; pause on tab hidden; handle resize and DPR changes.
- Layer plan: (1) background canvas (starfield, redrawn only when the camera moves), (2) main game canvas, (3) DOM HUD. No more than 2 canvases.

**Other:** keyboard, mouse and touch input. Respect `prefers-reduced-motion`. Settings in `localStorage`. Fonts self-hosted with `font-display: swap`. No third-party trackers.

**MVP slice (matches design doc C2):** the 6 stages Meteorite → Asteroid → Dwarf Planet → Rocky Planet → Gas Giant → Star need generators for rock, icy planet, rocky planet (3 variants), banded gas giant and a star. Defer Gas Planet, Dwarf Star, Giant, Supergiant, Neutron Star and Black Hole. The star generator can be recolored for Dwarf, Giant and Supergiant later, so build it parameterized (core color, edge color, corona radius, ray count).

## 14. Asset checklist for the build team

**Art (all procedural)**
- [ ] Palette constants, relative-mass rim colors and the 12-stage tint table (sections 4 and 6) in one config module
- [ ] Rock generator (seeded jittered polygon, crater arcs, rim/shadow) for stages 1–2 and debris
- [ ] Planet generator (circle, terminator, atmosphere ring, 2–4 baked continent blobs, 3 variants: terrestrial/lava/metallic)
- [ ] Gas body generator (bands, storm eye, optional ring) for gas giant and gas planet
- [ ] Star generator parameterized by core color, edge color, corona radius, ray count and flare rate (dwarf, star, giant, supergiant)
- [ ] Neutron star (core + rotating jets) and black hole (dark disc, photon ring, accretion ellipses)
- [ ] Rim / ring / pulse renderer for prey, equal and threat states (with ±5% hysteresis and a 250 ms crossfade)
- [ ] Baked glow sprites per accent color
- [ ] Parallax starfield (3–4 baked layers) and a nebula layer per stage tint
- [ ] Vignette and grain overlays
- [ ] Logo "Vesper Drift" (SVG, original) and favicon

**VFX**
- [ ] Thruster flame / trail, fading to a gravity wake from stage 5
- [ ] Absorb stream and ring pulse, with a spiral version for the black hole
- [ ] Explosion (flash, ring, shards, dust) and player fragment death
- [ ] Evolve sequence (inhale, flash ring, morph, palette cross-fade, banner)
- [ ] Map-edge warning vignette
- [ ] Screen shake (trauma), hit-stop and damage vignette

**UI**
- [ ] HUD (stage name, mass bar, time/score, hint line, edge warning, ability button)
- [ ] Evolution choice cards (Orchid glow; our own branch names)
- [ ] Title, Pause, Game Over / Ending and Settings screens
- [ ] Inline SVG line icon set (pause, settings, sound, close, arrow, ability icons per perk)
- [ ] Self-hosted display and UI fonts

**Audio (all original)**
- [ ] 3-stem adaptive music (Calm/Tension/Triumph) with era layers
- [ ] SFX: thruster loop, absorb (pitch chain, size-scaled), threat rumble, hit, explosion S/M/L, evolve, UI click/hover, game over, event horizon
- [ ] Web Audio manager (unlock on gesture, buses, ducking, volume sliders)

**Quality / accessibility**
- [ ] Quality governor and settings (quality, reduced motion, high contrast, shake)
- [ ] Color-blind check of prey/equal/threat (rim thickness and pulse must work without hue)
- [ ] Performance test on an integrated GPU and a mid-range phone against the section 13 budget
- [ ] Licence audit: no third-party or copied assets, and record font licences
