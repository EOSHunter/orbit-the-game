# R7 Orbit × Vesper Drift: video brand guide

> Confirmed: agent roles and colours, audio from the creator's clips, video title **Vesper Drift**, creator on-screen name **Hunter**. Final logo masters (SVG + 2048/4096 PNG) are in the kit.

For the casual vlog "I built a game by directing a team of AI agents in R7 Orbit" (under 10 min, Remotion, 1920×1080 @ 30 fps).
Machine-readable twin of this document: [`theme.ts`](./theme.ts). Every value below is lifted from the game's own code and docs unless marked *(video decision)*.

## 0. Two names, one look

| Name | What it is | Where it appears in the video |
|---|---|---|
| **R7 Orbit** | The tool / studio. Logo: gold "7" with an orbiting dot on a near-black tile | Intro/outro sign-off, "made with" bug, corner watermark |
| **Vesper Drift** | The game (title in `index.html`, title screen, code). Cyan holographic HUD | Everything that is the game, plus the visual language of the whole video |

The video is **dressed like the game** (void navy, cyan holographic panels, corner brackets, letter-spaced uppercase), and the **R7 Orbit gold** is the single warm "studio" accent: use it sparingly for the logo and sign-offs. Never put gold into HUD-style graphics, and never put cyan on the logo.

Tone (from `docs/art-bible.md`): calm, awe-struck, slightly melancholic; tension comes from scale, not noise. A casual voice-over sits comfortably on top of a precise, quiet visual system.

---

## 1. Palette

### 1.1 Core (HUD / video chrome)

| Role | Name | Hex | Use in video |
|---|---|---|---|
| Background, deepest | Void | `#050812` | Letterbox, card backgrounds, subtitle box base |
| Background, panels | Void mid | `#0A1424` | Panel fill base |
| Sky | Void blue | `#0A1530` | Gradient mid-tone behind nebula |
| **Primary accent** | Holo cyan | `#5CE1FF` | Lines, brackets, progress bars, kickers, active states |
| Accent highlight | Holo hi | `#B8F3FF` | Glow cores, cursors, "T+" values, hover |
| Border | Holo dim / faint | `rgba(92,225,255,0.42)` / `rgba(92,225,255,0.14)` | Panel borders / hairlines |
| Text | Moon white | `#E6F6FF` (UI) · `#EAF0FF` (art-bible) | Primary text |
| Secondary text | Mist | `#86A3BF` | Labels, captions, "NEXT ▸" lines |
| Body copy on glass | Card desc | `#C9D4EE` | Longer sentences |
| Caution / dev / emphasis | Amber | `#FFB547` | Warnings, "hold form", callouts, timers running out |
| Evolution / choice | Violet | `#B48CFF` | Evolution choices, big "decision" moments |
| Good / prey | Aurora mint | `#5FF0C0` | Success, wins, "it worked" |
| Danger / threat | Flare coral | `#FF5E73` | Bugs, crashes, QA, "it broke" |
| Neutral | Glacier | `#7FD6FF` | Neutral markers |

Meaning is part of the brand: **mint = prey/good, coral = threat/bad, amber = caution, violet = evolution, cyan = instrument**. Use them with those meanings in graphics (bug counters coral, passing tests mint…). There is **no fire or ember imagery anywhere in the brand**: damage and warnings are cool coral edge vignettes, not flames.

### 1.2 Space (backgrounds)

Nebula body `#2E5F8C`, nebula core `#8FB3D9`, H-alpha `#C8456E`, O-III `#3FB8B0`, violet emission `#7A5BB0`, dust lane `#060B14`, ambient fill `#1A2B42`. Star colours are blackbody (never saturated green): 3300 K `#FFBB81`, 5772 K `#FFF2E6`, 12000 K `#BFD3FF`. Per-stage background gradients are in `theme.ts` (`stageTints`).

### 1.3 R7 Orbit logo gold (studio accent)

Sampled from the logo file: `#CAAB6C` (main), `#E6C98C` (highlight / orbit dot), `#8A6A36` (shadow side), tile `#0D0D0F`.

### 1.4 Gradients and glass

- **Panel glass:** `linear-gradient(140deg, rgba(10,34,52,.66), rgba(6,14,30,.5) 60%, rgba(10,26,44,.6))`, 1 px `holoFaint` border, background blur.
- **Progress fill:** `linear-gradient(90deg, #1AA9D6, #5CE1FF 70%, #B8F3FF)` with `0 0 12px rgba(92,225,255,.6)` glow, on a near-black track `rgba(0,0,0,.55)` with 1 px faint border and quarter ticks.
- **Title-screen vignette:** `radial-gradient(ellipse at 50% 45%, rgba(10,30,50,.25), rgba(2,5,12,.75) 75%)`.

---

## 2. Typography

**What the game uses:** it loads **no web fonts**. `src/ui/ui.css` (lines 23-24) uses local system stacks:

- Display: `"Bahnschrift", "DIN Alternate", "Eurostile", "Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif` at semi-condensed width, weight 300/600.
- Mono: `"JetBrains Mono", "Cascadia Mono", "SF Mono", Consolas, ui-monospace, monospace`.

Bahnschrift is a Windows system font under Microsoft's licence: **it cannot be redistributed, so it is not in this kit.** The mono in the game screenshots rendered with the Cascadia/Consolas fallback because JetBrains Mono wasn't installed.

**What the video uses (bundled, SIL OFL 1.1, free for commercial use and embedding), in `assets/fonts/`:**

| Role | Font | Weights | Notes |
|---|---|---|---|
| Display / titles / lower-thirds / subtitles | **Barlow Semi Condensed** | 400 / 500 / 600 / 700 | Closest open match to Bahnschrift SemiCondensed (DIN-style). Licence: `Barlow-OFL.txt` |
| Kickers, labels, numbers, speaker tags | **JetBrains Mono** | 400 / 500 / 700 | The game's first-choice mono. Licence: `JetBrainsMono-OFL.txt` |

If rendering on Windows, `fonts.displayExact` puts Bahnschrift first for pixel-exact match with the game's own capture; keep the Barlow fallback so renders are reproducible elsewhere. Don't mix: **one display + one mono, max 3 sizes per screen.**

**Treatment rules (copied from the game):**
- Titles, stage names, buttons: **UPPERCASE**, wide tracking (`0.12em`–`0.28em`; wordmark `0.42em`; "DRIFT" `1.1em`).
- Kickers/labels: mono, uppercase, `0.16em`–`0.3em`, in cyan or mist, in the form `STG 07/12 // DST`, `ACCRETION SURVEY // CLASS-0 BODY`. A blinking `_` caret may follow a status line.
- Numbers: mono, tabular, **italic** for the big mass-style counter (`MASS 1.90M`).
- Glow: titles get `text-shadow: 0 0 24px rgba(92,225,255,.45)`.
- Sizes @1080p: wordmark 168 / chapter title 96 / heading 64 / lower-third name 44 / kicker 22 / label 20 / body 32 / subtitle 42. See `theme.ts › type`.

---

## 3. Logo

Final masters supplied by the creator, in `assets/logo/`:

| File | Use |
|---|---|
| `r7-orbit-icon.svg` | **Vector master**: rounded tile + mark. Use for anything large. |
| `r7-orbit-mark-transparent.svg` | **Vector master**: mark only, no tile, transparent. Default for the video on dark backgrounds. |
| `r7-orbit-icon-2048.png` / `-4096.png` | Raster tile (use 4096 for scale-up animation / zooms). |
| `r7-orbit-mark-gold-transparent-2048.png` | Mark only, gold, transparent PNG. |
| `r7-orbit-mark-bronze-for-light-bg-2048.png` | Deep-bronze recolour for light backgrounds. |
| `r7-orbit-mark-white-2048.png` / `r7-orbit-mark-ink-2048.png` | One-colour silhouettes (watermark / light backgrounds). Recoloured from the 2048 mark by me. |
| `legacy-512/` | My earlier keyed-out 512 px stand-ins and the old 512 px original. Superseded; don't use. |

Rules:
- **Clear space** = half the mark's height on all sides. **Min width 96 px** at 1080p.
- Place on the void background or over dimmed footage (scrim ≥ 50%). Never on a busy bright frame without the tile.
- Don't recolour into cyan, don't add glow to the gold, don't stretch, don't put the tile inside a HUD panel.
- The orbit dot is the animatable part: in motion, let the dot travel once around the ellipse (1.2 s, `ease.inOut`) as the mark fades in. *(video decision)*
- Game wordmark is **typeset**, not an image: "VESPER" (300, `0.42em`) over "DRIFT" (600, `1.1em`, cyan→hi gradient), with the orbital emblem above. Emblem artwork: `assets/ui/vesper-drift-emblem.svg` (transcribed from the game's SVG; animate the dashed ring spinning 40 s/rev and the dot orbiting 9 s/rev).

---

## 4. Game UI style (what to imitate)

Reference captures are in `screenshots/` (all captured from the real game in WebGL, 1920×1080).

- **Panels:** dark glass, 1 px cyan hairline, **square corners**, **8 corner brackets** (9 px arms, 1.5 px stroke, cyan with `drop-shadow(0 0 3px rgba(92,225,255,.6))`), a faint scanline layer (1 px line every 3 px at 3.5% cyan, `screen` blend) and a header like `▮ TARGET ANALYSIS` (the `▮` blinks, 1.6 s).
- **Buttons:** 1 px cyan-dim border, 12%→3% cyan vertical gradient, label uppercase 600 weight at `0.28em`; primary has white text with cyan glow; hover brightens fill + `0 0 22px` glow and a skewed light **sheen** sweeps across (700 ms); press scales 0.98. Ghost = darker, mist text. Dev/amber variant uses amber instead of cyan.
- **Keycaps:** `kbd` = mono 0.82 em, 1 px cyan-dim border, 2 px radius, 7% cyan fill, hi-cyan text.
- **Meters:** thin, near-black track, gradient fill with glow, a **ghost trail** that lags 900 ms, a **shimmer** pass every 2.6 s, quarter ticks, a white cursor with glow.
- **Stage ladder:** 12 short underlines; done = 60% cyan, current = hi-cyan with glow.
- **Grain:** a static 5% cyan-tinted film grain nudged in 4 steps over 0.9 s over everything. **Scanlines** on dim overlays.
- **Relation shapes:** prey = filled dot (mint), neutral = hollow ring (glacier), threat = diamond (coral, blinks). Reuse these as bullets/markers.
- **Banner:** stage-up banner: kicker (`0.5em`, cyan) → name 46 px `0.24em` with glow → a 1 px cyan line that draws outward; the name **un-blurs while its tracking collapses from 0.6em to 0.24em** (2.2 s total).
- **Stage-name decode:** names scramble through random glyphs before settling (`vd-sc-name.is-decoding`).
- **Accessibility spirit:** nothing flashes faster than 3 Hz. Keep this for the video (YouTube viewers, photosensitivity).

### Assets in the kit

```
assets/
  logo/        R7 Orbit logo + transparent/mono variants
  fonts/       Barlow Semi Condensed + JetBrains Mono (+ OFL licences)
  ui/          vesper-drift-emblem.svg, hud-corner-bracket.svg
  backgrounds/ 6 clean (no HUD) 1920×1080 game frames: asteroid, rocky/lava, ringed gas giant, star, neutron star, black hole
  audio-reference/README.md   (the game has no audio files; see §8)
screenshots/
  01-title … 08-settings, 03-07 HUD at stages 4, 5, 8, 11, 12
  mock-lowerthird-and-agent-subtitle.png   (how §6 and §7 look)
```

There are **no sprite sheets, icon files or textures**: everything in the game is procedural (shaders and canvas) with inline SVG icons. For more footage, run the game (`npm start`, then open `http://localhost:8000`; add `?stage=black_hole` to jump to a stage, or `?stage=rocky_planet&form=lava` for a form) or screen-record it. The nebula/stars/planets are the footage; recording them live is better than stills.

---

## 5. Background treatment

1. **Base:** the void gradient `#050812 → #0A1530`, or **a dimmed clean game frame** from `assets/backgrounds/` (scale 105%, slow 1.5%/10 s drift, `ease.inOut`). Dim to ~55% brightness and add the title vignette.
2. **Stage-matched tint** for chapters: use `stageTints[stage]` as a 40% overlay so each chapter takes on its stage's colour (early = cool blue, star era = magenta/teal emission, black hole = deep violet).
3. **Always on:** film grain (5%), scanlines (3.5%) and a soft vignette. Subtle! If you can see them on a still, reduce.
4. **Starfield parallax:** two or three dot layers (tiny, mostly white-blue, a few warm `#FFBB81`) drifting at different speeds. No fast zooms or warp streaks: this world is calm.
5. Talking-head/screen-recording footage sits **inside** a bracketed panel (glass border + 4 corner brackets) over the background, not full-bleed, unless it's gameplay.

---

## 6. MOTION STYLE GUIDE

### 6.1 Principles
- **Instrument, not game show.** Elements *scan on* (a line draws, a panel fades and slides 12 px, text un-blurs), never bounce, spin wildly or shake.
- **One easing.** Everything uses the game's `--ease` = `cubic-bezier(0.215, 0.61, 0.355, 1)`; `ease.pop` (`0.34, 1.56, 0.64, 1`) only for tiny chips/badges. Exits use `ease.in` and are faster than entrances (≈ 70%).
- **Calm rhythm:** let frames breathe; hold titles 2.4-2.6 s.
- **Glow, not shadow.** Depth comes from cyan glow and blur, never from drop shadows.

### 6.2 Timing table (30 fps; also in `theme.ts › timing`)

| Motion | Duration | Frames | Easing |
|---|---|---|---|
| Hover/press-level micro | 160 ms | 5 | out |
| Panel in (fade + 12 px slide) | 320 ms | 10 | out |
| Panel out | 240 ms | 7 | in |
| Progress bar fill / ghost | 200 ms / 900 ms (+150 ms delay) | 6 / 27 | out |
| Stage-name decode (scramble) | 500 ms | 15 | linear steps |
| Banner blur-in + tracking collapse | 300 ms in, 2.2 s total | 9 / 66 | out |
| Line draw (scaleX 0→1) | 700 ms | 21 | out |
| Crossfade between scenes | 400 ms | 12 | inOut |
| Glitch cut accent | 120 ms | 4 | n/a |
| Per-letter / per-item stagger | 60 ms | 2 | n/a |
| Caret blink | 1 s period (500 ms on/off), `steps(2)` | 15 | n/a |

### 6.3 Title card (cold-open / video title)
Layout (centre, on dimmed starfield or `bg-stage01`):
1. 0.0 s: void; the **emblem** (rings, two orbits) fades in 0→1 over 600 ms, dot already orbiting.
2. 0.4 s: mono status line types in, letter-spaced `0.3em`, cyan, with `_` caret: `AGENT SURVEY // 7 ROLES // BUILD LINK ESTABLISHED`.
3. 0.7 s: **VESPER** un-blurs and its tracking collapses `0.6em → 0.42em` (weight 300, glow). **DRIFT** follows 200 ms later with the cyan gradient sweep.
4. 1.6 s: tagline in mist; the R7 Orbit mark (gold) fades in small beneath with "BUILT WITH R7 ORBIT" in mono, mist. This is the only place the gold and the cyan are on screen together.
5. Hold to 2.6 s, then 400 ms crossfade out.
Title can read "VESPER DRIFT" or a custom vlog title set the same way (heading 64 / `0.18em` uppercase, kicker above in mono). **

### 6.4 Chapter cards
One per stage-like chapter ("01 // THE IDEA"). Full-screen, 2.4 s.
- Mono kicker `CHAPTER 03/09 // QA` (cyan, `0.3em`), then the chapter title uppercase 96 px / `0.24em` with glow; a **1 px cyan line draws outward** from centre under it (700 ms).
- A 12-segment **stage ladder** runs along the bottom (the game's own motif): done segments filled 60% cyan, current segment hi-cyan with glow. It advances one tick per chapter, so viewers always know where they are in the "evolution". Chapter 1 = Meteorite, last chapter = Black Hole (mapping chapters to stages is a nice running gag).
- Background = clean frame of that stage from `assets/backgrounds/` with `stageTints` overlay.
- Animation: banner choreography from §4 (un-blur + tracking collapse).

### 6.5 Lower-thirds (agent introductions)
Appear the first time a role speaks or is shown; hold 4.5 s; panel-in 320 ms, text staggered 60 ms, panel-out 240 ms.

```
 ┃ AGENT 05/07 // RN            <- mono kicker, role colour
 ┃ RENDERER                     <- 44 px, 600, uppercase, 0.12em, white + glow
 ┃ Planets, stars, nebulae in 3D   <- mono 20 px, mist (optional blurb)
```
- Glass panel with the game's corner brackets, **6 px left accent bar in the role colour** (with glow), 28 px padding, 640 px wide. Position: left edge at 120 px, bottom at 330 px (kept above the two-line subtitle zone; see `lowerThird` in `theme.ts`).
- The kicker's `AGENT nn/07 // code` uses the game's `STG 07/12 // DST` pattern.

| # | Role (lower-third title) | Code | Accent colour | Suggested blurb |
|---|---|---|---|---|
| 1 | CREATIVE DIRECTOR | CD | `#B48CFF` violet | Vision, art bible, what the game should feel like |
| 2 | UI DESIGNER | UI | `#5CE1FF` cyan | The holographic HUD, menus and screens |
| 3 | SOUND DESIGNER | SN | `#FFB547` amber | Everything you hear, synthesised live |
| 4 | ENGINE | EN | `#5FF0C0` mint | Game loop, input, camera, wiring it together |
| 5 | RENDERER | RN | `#E0608F` magenta (H-alpha family) | Planets, stars, nebulae and black holes in 3D |
| 6 | SIMULATION | SM | `#6EA2FF` ice blue | Gravity, absorption, stages and the infinite universe |
| 7 | QA | QA | `#FF5E73` coral | Playtests, balance runs, finding what breaks |

The colours come from the game's signal palette so the agents feel like part of the same universe. The same role colour is used for that agent's subtitle tag, so the viewer learns the cast within a minute. The creator (you) gets **no colour**: white, always. (The "7" in "05/07" is the cast size; renumber if you drop or add roles.)

### 6.6 Transitions
- **Default cut:** 400 ms crossfade with a 1.5 % scale drift on the outgoing shot.
- **Between chapters:** "scan wipe": a 1 px cyan horizontal line travels top→bottom in 500 ms (`ease.inOut`), revealing the next scene beneath it; a faint scanline flash (≤ 15% opacity, never faster than 3 Hz).
- **Entering a new topic mid-chapter:** panel-out → panel-in with 12 px slide, 240/320 ms.
- **"Something broke" moments:** 120 ms glitch accent (horizontal 6 px RGB-split in coral/cyan, 4 frames) and a coral edge vignette (no flash).
- **Evolution moment** (a big milestone): violet `#B48CFF` banner, un-blur choreography, subtle bloom up for 600 ms.
- Avoid: spins, zoom-whips, bounces, star-wipes, shake, fire.

### 6.7 Screen-recording and gameplay presentation
- Gameplay full-bleed with the **game's own HUD visible**; add a bracket frame only for non-game recordings (editor, terminal, R7 Orbit UI).
- Callouts use the target-bracket motif: 4 cyan corner brackets that contract onto the thing (300 ms, out) plus a mono label chip.
- Counters (mass, tests passed, lines changed…) animate as the game does: numbers count up with ease-out over 300 ms, mono tabular, italic for the hero stat.

---

## 7. Burned-in subtitles

Goals: legible on a phone, over any frame (bright stars, nebula), and obvious about **who is speaking**.

| Property | Value |
|---|---|
| Font | **Barlow Semi Condensed** 500 (fallback Bahnschrift, Segoe UI) |
| Size | **42 px @1080p** (never below 40; scale ×`width/1920`) |
| Line height / tracking | 1.28 / `0.01em` |
| Layout | Centred, max 2 lines, max width 1280 px (~42 characters/line), `text-wrap: balance` |
| Position | Bottom-centre; box bottom edge **90 px** from the bottom of the frame (YouTube's control bar and the 10% title-safe zone stay clear) |
| Safe margins | Sides ≥ 192 px (title safe); never closer than 96 px (action safe) to any edge |
| Box | `rgba(5,8,18,0.78)` void glass, 1 px `holoFaint` border, 4 px radius, padding 14 × 28 px |
| Text outline | 3 px dark stroke (`paint-order: stroke fill`) + `0 2px 4px rgba(0,0,0,.9)` shadow, so it survives if you ever remove the box |
| In/out | 120 ms opacity fade; no slide, no pop. Never animate per word unless emphasising |
| Break rules | Split at clauses, never leave a one-word orphan, no more than 2 lines. Keep each cue 1-7 s |

### Who is speaking

| Speaker | Text colour | Style | Left bar (6 px) | Label (mono 20 px, `0.16em`, uppercase) |
|---|---|---|---|---|
| **Creator (you)** | `#FFFFFF` | Upright | White | none by default; show `HUNTER` only after an agent has been speaking, to mark the switch back |
| **Agent (any role)** | `#D6F4FF` (cool tint) | *Italic* | **Role colour** (§6.5) | `◆ RENDERER`, `◆ QA`, etc., in the role colour, above the text, shown on the first cue of a run and whenever the speaker changes |

So it's readable three ways even in greyscale: **italic vs upright**, **a label vs none**, and **coloured bar vs white bar**. When two agents talk in one cue, stack two cues rather than mixing colours in one box. Sound-effect/system captions (if used): mono, mist, in brackets, no box.

See `screenshots/mock-lowerthird-and-agent-subtitle.png` for the look (the lower-third's accent bar should use the role colour; the mock shows cyan). In code use `subtitle` and `subtitleSpeaker(who)` from `theme.ts`.

---

## 8. Sound (reference only)

**Decision:** the video's audio comes from the creator's own clips (no separate music/SFX library). The notes below are only for matching the game's feel if you add small UI blips.

The game ships **no audio files**: everything is synthesised live (`src/audio/`, `docs/audio-direction.md`). UI sound names: `ui.click ui.hover ui.confirm ui.back ui.error ui.open ui.close ui.choice.select ui.choice.confirm ui.stagebanner`. Character: dry, bright, non-diegetic blips; low "felt" rumbles; sonar pings; a stage ambience that drops from A3 to B1 as the player grows. For the video: UI blips for panel in/out, a soft sub-bass swell under chapter cards, a quiet sonar ping for lower-thirds. Capture real audio by screen-recording the game with sound, or the demo page `src/audio/demo.html`.

---

## 9. Do / don't

**Do:** uppercase letter-spaced titles · cyan hairlines + corner brackets · calm eased motion · restrained gold for R7 Orbit only · meaning-colours (mint good, coral bad) · let real game footage carry the imagery.

**Don't:** fire/ember/orange glows · rounded-corner cards · drop shadows · neon pink/purple gradients not in the palette · bounce/shake/zoom-whip · more than 2 font families · flashing faster than 3 Hz · copying the reference game's art (`docs/references/` shows *Drifter Star: Evolution*, a different game, study only; none of it is in this kit).

---

## 10. Using the kit in Remotion

```ts
import {theme, colors, fonts, fontFaceCss, ease, timing, subtitleSpeaker} from './brand-kit/theme';
import {Easing, interpolate, useCurrentFrame} from 'remotion';

// In public/: copy brand-kit/assets (fonts, logo, backgrounds) and inject fontFaceCss('/brand-kit/') once in the root.
const f = useCurrentFrame();
const p = interpolate(f, [0, timing.panelIn], [0, 1], {easing: Easing.bezier(...ease.out), extrapolateRight: 'clamp'});
```

Fonts: `fontFaceCss()` emits `@font-face` rules (`font-display: block` so renders never show a fallback); with `@remotion/fonts` use `loadFont({family, url: staticFile(...), weight})` over `fontFiles`.
