# UI direction: *Vesper Drift* holographic HUD

Owner: UI. Code: `src/ui/` (`index.js`, `hud.js`, `util.js`, `ui.css`, `demo.html`, `demo-fixtures.js`). Contract: `docs/interfaces.md` §6 (v1). The base palette and relation language come from `docs/creative-direction.md` §4 and §9.

## 1. Look

The look is a **holographic instrument panel**: a sensor overlay projected over the scene, not a game menu.

- **Panels:** dark glass (`backdrop-filter: blur(3px)`) with a 1 px cyan hairline. Each panel has **corner brackets** drawn as a CSS `::before` (eight gradient strokes, no images) and a faint **scanline** layer. A static **film-grain** tile (an SVG `feTurbulence` data URI at 5% opacity, nudged in steps) sits over everything.
- **Colour:** cyan `#5CE1FF` for the instrument layer, amber `#FFB547` for caution (voids, capture below 75%, hot meters), and relation colours for prey, neutral and threat. The relation colours come from `looks.js` `PRESETS.relation` when it exists; the fallback is mint, glacier and coral. Violet marks evolution choices and the Event Horizon ending. There is **no fire or ember imagery**: damage is a cool coral edge vignette, not flames.
- **Type:** a geometric display face for names (`Bahnschrift` → DIN/Eurostile → Segoe UI → system), uppercase with wide tracking. All numbers use a monospaced face (`JetBrains Mono`/`Cascadia Mono`/`Consolas` → `ui-monospace`) with tabular figures. Fonts are system-only: nothing is downloaded and no licence is needed. Self-hosted fonts can be dropped in later through the CSS variables `--font-display` and `--font-mono`.
- **Motion:**
  - Mass counts up (ease-out).
  - The stage name "decodes" from scrambled glyphs over 480 ms.
  - The progress bar has a ghost trail and a shimmer.
  - The radar sweep turns, and the stage glyph ring rotates.
  - Log lines slide in and fade.
  - The evolution banner unblurs with letter-spacing collapse.
  - The beacon ping is an amber ring on the radar.

  Every animation can be switched off (see §5).

## 2. Layout (reference 1280×720, scaled by `min(w/1280, h/720)` and clamped to 0.72–1.5)

| Zone | Widget | Data |
|---|---|---|
| Upper left | **Stage card** (per the reference screenshots): stage glyph in a rotating ring, `STG 07/12 // DST`, stage name, mass, cyan progress bar (ghost, quarter ticks, cursor), `NEXT ▸ …` and %, a 12-step **stage ladder**, and a **hull** meter | `stageIndex`, `mass`, `progress`, `health` (or `player.health`) |
| Under the card | Round **Esc / Settings** and **Q / Capture** buttons. Capture shows a lock badge when unavailable | settings; `opts.onAction` (§4) |
| Upper right | **Scanner**: radar (north-up, `bearing` 0 = up, sqrt range scale with auto-ranging), relation-shaped blips, amber **beacon chevron** toward nearest matter in a void, ping ring, `T+` clock, `RNG`, star/black-hole/pulsar proximity meters, seed | `hud.markers`, `hud.region`, `hud.proximity`, `time`, `seed` |
| Right | **Target analysis**: nearest THREAT, PREY and NEUTRAL, with class, distance, mass ratio, gap and bearing | `hud.nearestThreat`, `hud.nearestPrey`, nearest neutral in `hud.markers` |
| Top centre | **Alerts**: Gravitational capture (segmented meter at 25/50/75%; turns coral and "ESCAPE WINDOW CLOSING" at ≥75%), Deep void ("NEAREST MATTER 4.0k · BRG 057°"), Hull critical, an atmosphere chip, and the legacy edge warning | `hud.capture`, `hud.region`, `health`, `hud.inAtmosphere` |
| Bottom centre | **Action bar**: velocity with an escape-speed marker and BOUND/UNBOUND, steer %, gravity-well depth, orbit lock (host, period, altitude), and **T Top-down** / **V Trajectory** toggles | `hud.speed/speedMax/escapeSpeed/thrust/gravityDepth/orbit`, settings |
| Bottom left | **Comms log**: last 5 events. Absorb chains merge into one line | bus events |
| Full screen | **Edge markers** for off-screen prey and threats, clamped to the screen edge and kept above the action bar, with distance labels. On-screen **reticles** bracket the nearest threat and nearest prey | `hud.markers[].p` via `view.project` |
| Centre | Evolution banner; damage, low-hull and capture vignettes (edge only; the centre 60% stays clear) | `stageIndex`, events |

Each widget **hides itself when its data is absent**. On the 2D build's legacy state (no `hud`), only the stage card, buttons, clock, hint, overlays and the legacy edge warning remain.

**Prey, neutral and threat never rely on hue alone:** prey is a filled dot, neutral is a hollow ring, and threat is a diamond that blinks, with a thicker arrow and a pulsing reticle.

## 3. Screens

- **Title:** an orbital emblem, the `VESPER / DRIFT` wordmark, a status line with a blinking cursor, **Initiate drift** and **Settings** buttons, the seed (from `opts.seed` or `state.seed`), and the control keys.
- **Evolution choice:** "Evolution branch detected" with violet bracket cards (key number, branch letter, a small schematic, name and description). The `abandon_evolution` card is amber and labelled "HOLD FORM". Keys: `1–4` pick, arrows move, `Enter` confirms. The menu does not pause anything itself.
- **Systems** (pause and settings in one panel; Esc toggles it): Resume, audio sliders, a quality segment (`low/med/high/auto`), and switches for reduced motion, high readability, top-down camera and trajectory preview. Opened from the title it reads "Settings" and does not pause.
- **Ending:** a kicker by kind (`SIGNAL LOST`, coral / `CAPTURED // EVENT HORIZON CROSSED`, violet / `TRANSMISSION COMPLETE`), the ending title and text from `getEnding`, a stats grid (run time, final and peak mass, stage reached, absorbed, hits, near misses, disruptions; missing stats are hidden), and **Drift again**.

## 4. API notes for ENG (`main3d.js`)

The module exports both the contract API and the legacy factory:

```js
import * as ui from './ui/index.js';
ui.init({
  root: document.getElementById('ui'),
  onUiSound: (n) => audio.playUi(n),
  onSettings: (s) => { audio.setVolume(s); renderer.setQuality(s.quality); renderer.setOptions(s); },
  onPause: (p) => sim.setPaused(p),          // optional, see below
  onAction: (name) => { /* 'capture' */ },    // optional, see below
});
ui.attach(sim.events);
ui.showTitle(() => sim.start(), { seed: sim.getState().seed });
// on 'choice-open':  ui.showChoice(payload.choices, (id) => sim.pickChoice(id));
// on 'ending':       ui.showEnd(payload.ending, () => sim.restart());
// every frame:       ui.update(state, renderer.getView());
```

- **Additive, optional options (not yet in contract v1):** `onPause(paused)` and `onAction(name)`. They are needed because the contract has no way for the UI to request a pause, and the reference HUD has a **Q / Capture** button. Without `onAction`, Capture shows as locked. `state.flags.captureLocked === true` also locks it. Without `onPause`, the Systems panel still opens, and a sim-driven `status: 'paused'` is mirrored. I suggest a `contract change:` PR to add both.
- As merged, `main3d.js` passes `onPause: (p) => sim.setPaused(p)` and its own keydown handler returns early on `e.defaultPrevented`. That way Esc and T are handled once, by the UI, and the Resume button really resumes the sim.
- `showChoice` is not opened automatically on `choice-open`, because the UI cannot call `sim.pickChoice`. ENG wires it as shown above.
- `warnBoundary(on)` is a no-op in the 3D build (it only shows when the state has no `hud`). It still drives the edge warning in the 2D build, which still has a world edge.
- `view.project` is assumed to return CSS pixels in a `view.width × view.height` space. The UI rescales to its own root size.
- The legacy `createUI(root)` returns `{ update, showChoice, showTitle, showEnd, warnBoundary, onPause, setPaused, showHint, destroy, attach, detach, hide, dispose, getSettings }`, so `src/main.js` and `src/game.js` work unchanged.
- Settings persist in `localStorage['vd.settings']`, and `onSettings` fires once on init and on every change.
- The UI imports only `../stages.js` and `../data/looks.js`, both optional and wrapped in `try`. Until CD ships `looks.js`, the browser logs one 404 for it; that is harmless.

## 5. Accessibility, motion and input

- **Pointer:** the mount root and `.vd-ui` are `pointer-events: none`. Only buttons, sliders and open modal overlays take the pointer. A `pointerdown` on a UI control does not propagate to `window`, so clicking a HUD button does not also steer. After a mouse click a HUD button drops focus, so `Space` (stabilise) cannot press it again.
- **Keyboard:** `Esc` opens and closes Systems; `Q` captures; `T` and `V` toggle settings; `1–4` and the arrow keys work in the choice menu. Focus is trapped in modals and returned when they close. Every control has a visible focus ring and a label (`aria-keyshortcuts` where relevant).
- **Screen readers:** a polite live region announces evolution, choices, pause, orbit and void changes. An assertive region announces capture warnings, low hull, tidal disruption and death. Meters use `role="progressbar"` or `role="meter"` with values, and dialogs use `role="dialog"` and `aria-modal`. Decorative SVG is `aria-hidden`.
- **Reduced motion:** the OS `prefers-reduced-motion` setting or the in-game switch adds `.vd-rm`. That stops the sweep, grain, shimmer, ring spin, decode, banner animation, damage flash and pings, and sets numbers instantly. Nothing flashes faster than 3 Hz.
- **High readability:** larger text, near-opaque panels, no scanlines or grain, and stronger outlines. `forced-colors` is also respected.
- **Responsive:** below 720 px wide (`.vd-narrow`) the HUD drops the ladder, target panel, log, proximity, gravity and orbit cells; alerts move above the action bar; choice cards stack. Below 520 px tall (`.vd-short`) the secondary panels collapse. Verified at 1280×720 and 360×740.

## 6. Demo

Open `src/ui/demo.html` from any static server (for example `npx serve .` and then `/src/ui/demo.html`). It runs standalone: `demo-fixtures.js` provides a §3-compatible bus, a §2.3 `State` mock, a moving fake world and a fake `view.project`. The **DEMO CONTROLS** drawer (bottom right) drives the following:

- the flow: title, play, sim pause, stage up and down, choice;
- every event, including a "fire every event" button;
- void, beacon ping, capture ramp and capture clear;
- the three endings;
- compatibility toggles: legacy 2D state, no `view.project`, no capture handler.

Clicking empty space draws a ripple on the canvas, which shows that pointer events pass through the UI. Callback output (`onUiSound`, `onSettings`, `onPause`, `onAction`) is logged in the drawer.
