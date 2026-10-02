# Space Realism Research: *Vesper Drift* goes 3D, procedural and believable

> Research and plan only. **No game code.** Companion to `docs/game-design.md`, `docs/creative-direction.md` and `docs/engine-notes.md`.

## 0. Research status and how to read this

**What was read.** This worktree's branch only contained `README.md`, so the three docs and `src/` were read from `origin/main` (merge commit `3c40a6d`): `docs/game-design.md`, `docs/creative-direction.md`, `docs/engine-notes.md`, `src/stages.js`, `src/world.js`, `src/physics.js`, `src/camera.js`, `package.json`, `index.html`, and the flame/heat/boundary code in `src/render/index.js`, `src/render/bodies.js`, `src/game.js`.

**Confidence tags used below.**

| Tag | Meaning |
|---|---|
| **[V]** | Verified this session by web search (source linked). Only the Three.js/Babylon.js tooling facts in §4 are tagged this way. |
| **[K]** | Standard astronomy / graphics / audio knowledge from memory, **not re-verified here**. Well established, but numbers should be spot-checked before being quoted publicly. |
| **ASSUMPTION** | A design choice, an estimate, or something I could not verify. Treat as a proposal to be tested. |

Web search was available but was used sparingly (two queries, both about browser 3D tooling). Physics constants are therefore **[K]**, not **[V]**.

### 0.1 What the current game is (so the plan fits it)

- Vanilla JS ES modules + HTML5 Canvas 2D, no build step, no dependencies (`package.json`: `"start": "npx serve ."`).
- Top-down 2D. Fixed 1/120 s sim step; camera zooms so the player stays about 26 px on screen (`CONFIG.camera.playerScreenRadius`).
- Mass is one scalar; `radius = 10 * sqrt(mass)`. 12 stages in `src/stages.js`, `minMass` rising about 3.2x per stage, `radiusScale` doubling per stage, except the Neutron Star (deliberately compact) and Black Hole.
- Bodies spawn in a ring just outside the view and despawn at 2.8 view radii (`src/world.js`). **Spawning is random (`Math.random`) and non-persistent**: fly away and come back, and the sky is different.
- A hard world edge: `state.bounds.radius` = 220 player radii. Outside it for 2.5 s ends the run as "Event Horizon" (`game.js`, `CONFIG.boundary`).
- Kinds are relative (`prey` / `neutral` / `threat`) by mass ratio 1.2x with hysteresis. Threats from stage 3 chase the player.
- Physics is arcade: drag, mass-weighted bounce, a short-range "pull" on prey. No orbits, no gravity beyond that pull.

### 0.2 The reported bug: "asteroids show fire"

Root cause, found in `src/render/palette.js` and `src/render/index.js` on main:

- Stages 0-3 (Meteorite, Asteroid, Dwarf Planet, Rocky Planet) have `thruster: true`.
- `emitThrust()` spawns teardrop **streak particles** in `#FFD9A0` and the player's colours behind the body, "thruster flame" per the code comment.
- A second block draws an orange `#FFB067` additive arc, "heat on the leading edge (rocky stages)", on the front of the player.
- `bodies.js` also gives the Rocky Planet a lava look with `#FF8A3D` glow, and several stage looks use warm additive glows.

So the "fire" is a deliberate art choice (a rocket-like exhaust and a re-entry-style heat rim) applied to a body that is in vacuum. In §1.2 it is replaced by rules a renderer can follow mechanically.

---

## 1. How bodies look and behave in space

### 1.1 Design stance: what "realistic" means for a game at this scale range

- The 12 stages span about 20+ orders of magnitude in real physical size (a pebble to a stellar-mass black hole). No single faithful camera works, so we use **relative-scale realism**: every stage is shown correctly *relative to the player*, with the player at roughly constant screen size (this is what the game already does).
- "Realistic" here means: **correct light, correct materials, correct motion cues, correct causes for glow**. It does not mean real distances (space is almost empty; the game needs it dense enough to play). We **compress distances, never mislabel physics.** [A]
- **Stage mapping (ASSUMPTION).** The 12-stage ladder is the game's, not astronomy's. Proposed physical identity for each stage, so the look has something true to be based on:

| # | Stage | Physical identity we render | Notes |
|---|---|---|---|
| 0 | Meteorite | Metre-scale rock/metal fragment | Mostly stony (ordinary chondrite) or iron |
| 1 | Asteroid | Km-scale rubble pile or monolith | C-type dark, S-type bright, M-type metallic |
| 2 | Dwarf Planet | Ceres/Pluto-class, 500-2400 km | Round, airless or a thin atmosphere (Pluto); ice or rock |
| 3 | Rocky Planet | Terrestrial / lava / metallic (the three branches) | Atmosphere varies by branch |
| 4 | Gas Giant | Jupiter/Saturn class | Banded, optional ring, storms |
| 5 | Gas Planet | **Brown dwarf / "failed star"** (about 13-80 Jupiter masses) [K] | Fits between "gas giant" and "dwarf star" and is visually distinct (dim, magenta-red, banded). If the design prefers a Neptune-like ice giant, swap this look |
| 6 | Dwarf Star | Red dwarf (or the yellow/blue branches as stylised variants) | Real blue dwarfs are hypothetical [K]; keep the branch as a stylised "hot dwarf" (spectral type A/B-ish) or relabel it |
| 7 | Star | Sun-like main-sequence star | |
| 8 | Giant Star | Red giant | Bloated, cool surface, convective cells |
| 9 | Supergiant | Red supergiant (Betelgeuse) or blue supergiant (Rigel) | Matches the existing two-variant palette |
| 10 | Neutron Star | Pulsar / magnetar | About 20 km real diameter [K], so very small and very bright |
| 11 | Black Hole | Stellar-mass black hole with accretion disc | Jets optional |

### 1.2 Hard rules: when glow, heat and fire are physically correct

These are the **renderer rules**. They are written so they can be checked in code review and with a debug overlay.

**R1. No atmosphere, no flame.** Fire is a chemical reaction needing an oxidiser. Vacuum has none. A body in vacuum never gets flames, smoke trails, billowing smoke or "burning" particles. Exhaust plumes also do not curl or rise: gas expands in straight, spreading lines.

**R2. Glow requires a cause.** Allowed emitters, and nothing else:

| Cause | When it is correct | Appearance rule |
|---|---|---|
| **Being a star or stellar remnant** (stages 6-11) | Always | Colour from temperature (§1.9); limb darkening; bloom allowed |
| **Hot ground** (lava planet, fresh impact melt) | Surface at about 800 K and up glows dull red; about 1000-1500 K orange-yellow [K] | Emission only on cracks/melt pools and on the **night side** it is the main light; sunlit side is dominated by the sun |
| **Atmospheric entry** | **Only** while a fast body is *inside* a significant atmosphere (kinda below about 100-120 km altitude on Earth [K]) | A short-lived ablation glow/fireball and bright streak that fades with air density. Scripted event, see R6 |
| **Impact flash** | At the instant of a high-speed collision [K] | A brief (tens to hundreds of ms) white-hot flash, then incandescent ejecta cooling white > yellow > orange > red > dark (§2.1) |
| **Accretion disc / jets / pulsar beam** | Stage 10-11 and bodies being swallowed | Hot inner disc, §1.11-1.12 |
| **Thin atmospheric scattering** (planets with atmospheres) | The planet has an atmosphere | Rim light, not fire (§1.8) |
| **Starlight on a surface** | Always | This is *reflection*, not glow; drawn by lighting, not by additive blobs |

**R3. Airless bodies (meteorite, asteroid, dwarf planet, airless rocky planet) have:** no haze, no rim glow, no halo, hard terminator, hard shadows, deep black shadow with only faint secondary fill (§1.7). Their "glow" in the old art is replaced by **lighting contrast and a thin specular-free rim from the sun direction**.

**R4. Thrust is not fire.** The player is a lump of rock; a rocket flame is meaningless. Replacement cues (pick in the visual-direction pass, all physically plausible):
  1. A faint **shed-regolith particle kick** (grey dust grains, ballistic, no glow) when accelerating. Dust in vacuum flies on straight, non-billowing paths.
  2. **UI/HUD thrust vector** and a **felt audio** pulse (§5) to communicate acceleration.
  3. (Optional later perk: a cold-gas puff, white-blue and brief, for a "Rocket Core" upgrade. Still not fire.)
  Diegetic explanation for the controls: "**gravitational steering**" (the body tugs itself using its own mass distribution). **ASSUMPTION**, but it keeps the controls and removes the fire.

**R5. Heat is shown by colour temperature, not by "orange = hot".** Use a blackbody ramp for anything incandescent: 800 K dull red, 1500 K orange, 3000 K warm yellow-white, 5800 K white, 10,000 K+ blue-white [K]. No pure saturated orange fire palette on cold things.

**R6. Atmospheric entry is a scripted exception, not a default.** Trigger only when `speed_rel > ~3 km/s` (ASSUMPTION; real meteors start glowing around 11-72 km/s at 80-100 km altitude [K]) **and** the body is inside the atmosphere shell of a planet whose `atmosphereDensity > 0`. The effect is: a bright head, a short tapered tail pointing *opposite the velocity relative to the air*, ablation sparks, bow glow that scales with density and speed, and **it ends the moment the body leaves the shell**. For a player-sized meteorite descending into a terrestrial planet this is a delightful moment and is physically correct. **Never** apply it in open space.

**R7. Impacts are flashes and debris, not explosions-with-flame.** See §2.1 and §2.2.

**R8. One sun, one hard light.** A scene has a *key light* chosen from the brightest nearby star, hard and directional. Fill is a very dim blue-black ambient (starlight, planet-shine, nebula tint), never a warm fire-coloured ambient.

**R9. Black and dark things must stay dark.** Real albedos are low (§1.3). The art must not brighten rocks to make them readable; use **rim-less lighting, orbit/lens cues and the HUD outline-on-proximity** instead (accessibility; §4.6 and UI doc).

**R10. Debug check.** The renderer should expose a `?debug=emitters` overlay that lists every emissive element with its R2 cause. Anything without a cause fails review.

### 1.3 Surface appearance by body type

All values **[K]** unless noted. Albedo = fraction of light reflected.

| Class | Albedo | Surface character | Rendering approach |
|---|---|---|---|
| **Meteorite** (stony) | 0.03-0.25 | Dark, a **fusion crust** if it ever entered an atmosphere (black, glassy), otherwise bare grey-brown | Low-poly irregular mesh + fractal noise displacement, dark grey-brown albedo, rough |
| **Meteorite** (iron) | 0.1-0.3, metallic | Grey, faint Widmanstatten pattern, regmaglypts (thumbprint pits) | Higher specular/metalness, shallow dimples |
| **Asteroid** C-type | 0.03-0.10 | Very dark, like charcoal, most common | Dark brown-grey; low albedo variation |
| **Asteroid** S-type | 0.15-0.25 | Greyer, slightly reddish silicate | Medium grey with warm tint |
| **Asteroid** M-type | 0.1-0.2 | Metallic | Metallic spec, cool grey |
| **Shape** | n/a | Irregular (potato, peanut/contact binary like Arrokoth, spinning-top like Bennu/Ryugu), **not spheres** | Generate by low-frequency noise + elongation axes + craters. Real small bodies are lumpy; below about 400 km radius gravity cannot round them [K] |
| **Regolith** | n/a | Fine dust and rubble coating, **fine, dark, powdery**; slopes show brighter fresh material, ejecta rays | Slope-based albedo (brighten steep faces), grain-scale normal noise |
| **Craters** | n/a | Bowl, raised rim, ejecta blanket; **many small, few large** (power-law size distribution) [K]; older surfaces are more cratered; craters overlap and erode | Worley/cellular noise or analytic crater stamps in a shader; size frequency roughly N(>D) proportional to D^-2 [K] |
| **Opposition surge** | n/a | Bodies look sharply brighter when the sun is directly behind the viewer, fading quickly with phase angle [K] | Cheap: boost albedo near phase 0 |
| **Dwarf planet** (Ceres/Pluto/Eris types) | 0.09 (Ceres) up to 0.5-0.8 (icy) [K] | Round, cratered; Ceres has bright salt spots; Pluto has nitrogen ice plains, tholins (reddish-brown) and a thin haze | Sphere + height noise + palette by composition; ice types need bright with blue shadows |
| **Rocky planet: terrestrial** | about 0.3 | Oceans, continents, clouds, thin blue limb, white cloud layer, city lights on the night side | Layered shader: height > biome > clouds > atmosphere (§1.8) |
| **Rocky planet: lava** | 0.05-0.1 | Dark crust with glowing cracks and melt seas, thin hot-silicate haze | Emissive crack mask from noise ridges, blackbody colour (R5) |
| **Rocky planet: metallic** | 0.1-0.3 | Grey, bare, few craters if the surface is young, high specular | Metalness up, almost no atmosphere |
| **Gas giant** | 0.5 (Jupiter), 0.3 (Neptune) [K] | Latitudinal bands with shear at the boundaries, vortices/storms, cloud turbulence, optional **rings** (flat, thin, with gaps and shadows) | Domain-warped noise sampled along latitude, animated slowly; ring as a flat annulus with a radial opacity ramp and planet shadow |
| **Brown dwarf (Gas Planet)** | very dark | Dim magenta/red-brown banded, faintly self-luminous in the infrared so almost black visibly [K] | Dark bands + faint deep-red emission rim |
| **Star** | emissive | Granulation (convection cells), sunspots (cooler = darker), prominences and flares | Emissive noise, limb darkening (§1.9) |
| **Neutron star** | emissive | Tiny, blinding blue-white point with a pulsing lighthouse beam | Point-like with a bloom halo plus two beam cones |
| **Black hole** | none | A black disc (the shadow) surrounded by a lensed ring and a hot disc | §1.11 |

**Texture, scale, and crispness** [A]: surface detail should come from **procedural 3D noise on the sphere, evaluated in the fragment shader**, with level of detail by screen size. No texture assets (consistent with "procedural, tiny download").

### 1.4 Rotation and tumbling

- Every body has a **spin axis and spin rate**; the player too (cosmetic, from impacts). [K]
- Small bodies: rotation periods from minutes to hours; many **tumble** (non-principal-axis rotation, with precession and nutation) when torqued by impacts. A tumbling elongated body flashes brightness as it turns. [K]
- Big bodies are slow and stable: Earth 24 h, Jupiter about 10 h, the Sun about 25-35 days, **pulsars from about 1 ms to seconds** [K].
- **Game rule (ASSUMPTION):** the rotation rate is shown in *game time*, so scale it (sim time x about 20-200 for planets) while keeping the ratio (small = faster, big = slower, **neutron star the fastest by far**). Impacts transfer angular momentum so a hit visibly sets the rock spinning. Conserve angular momentum: absorbing a body from off-axis changes the spin.
- Tumbling for stages 0-1 is a visual treat and cheap: integrate a quaternion with a torque-free rigid-body step or fake it with two incommensurate rotation rates.

### 1.5 Orbits

- **Real behaviour [K].** Bodies in a system orbit their star on ellipses (Kepler); a smaller body in orbit does not "fall in" unless perturbed. Moons orbit planets. Orbital speed v = sqrt(GM/r) (circular). Tidal locking is common for close moons (same face always toward the planet).
- **What is game-worthy.** Orbits are *beautiful* and give the world "structure": planetary systems with moons and a debris belt feel real, and they let the player **slingshot** and **drop into orbit around bigger bodies**. But a real orbit means the player cannot simply "move toward" a target. Our model (§2.3) keeps a simple rule: *bodies that belong to a system are placed on analytic Kepler orbits (no integration drift, deterministic from the seed and time); only bodies that have been disturbed are simulated by gravity.*
- **Binary and multiple stars** (about half of Sun-like stars are in multiples [K]) provide great Giant/Supergiant-stage set pieces.
- **Gravity assist / slingshot.** A body passing a moving heavier body can gain speed relative to a third frame. It is a perfect "skill" reward for stage 4+ and only needs the planet's velocity to be real (analytic orbit gives it).

### 1.6 Gravity: what is physical and what is game-worthy

| Fact [K] | Consequence | Game use |
|---|---|---|
| Force is G m1 m2 / r^2, long range, always attractive | Everything pulls on everything | Use **softened gravity from heavier neighbours only** (§2.3) |
| Surface gravity g = G M / R^2; escape speed v_esc = sqrt(2GM/R) | Small rocks: 1 m/s or less. Earth 11.2 km/s. Sun 618 km/s. Neutron star about 0.5 c [K] | Escape speed is a fun **HUD value** and the real basis of "can I get out of this well" |
| Bound orbit if E < 0; escape if E >= 0 | Player can be captured | Capture by a larger body (a "threat") should read as a clear, readable danger |
| Tides: difference in pull across a body | Squeezes, stretches, heats, can **break bodies at the Roche limit** (§2.4) | Our signature absorb effect for large bodies |
| Gravity is weak for small bodies | An asteroid cannot pull a pebble in from far away | Pull range should scale as about r_pull proportional to (m)^(1/3), not constant |

### 1.7 Light and shadow

- **A single hard sun.** The key light is the nearest/brightest star: parallel rays, hard-edged shadows (the sun subtends only 0.5 degrees from Earth [K]), a sharp terminator. Per-scene, choose the dominant star within the relevant range. Between star systems (deep space) use a very dim "galactic glow" key light so bodies are barely visible, which is also a visibility problem (§4.6). [A]
- **No ambient fire/warm fill.** Ambient = tiny cool value (about 0.02-0.05 of key) plus **planet-shine** (a nearby big lit planet bounces light, tinted by its albedo) and **star-tinted** rim from other stars. [A]
- **Shadows in the game:** self-shadowing by normals (cheap, always), **eclipses and occlusion** for the big cases (moon in front of the sun, planet shadow on rings), shadow maps only for the key light and only near the player (cascade of 1-2). Cast shadows across a 20-order-of-magnitude range are impractical; **fake it analytically** (sphere-sphere occlusion) for the few important pairs. [A]
- **Phase.** Crescents and half-lit worlds are the cheap, most convincing "this is real" signal, so the angled camera (§4.7) must not wash out the terminator.
- **Exposure.** Use a physically inspired exposure: starfield is dim next to a sunlit surface. Auto-exposure between "near a star" and "deep space" with a slow adaptation (eye-like, 1-2 s). Bloom should only exceed a threshold on genuinely over-bright pixels.

### 1.8 Atmospheres

- **Rayleigh scattering** [K]: intensity proportional to 1/wavelength^4, so blue scatters most: blue day sky, red sunsets, a **thin blue limb** from orbit. **Mie scattering** (aerosols, clouds, large particles) is white/grey, forward-peaked, making sun halos and hazy horizons.
- **Per planet.** Terrestrial: blue limb + cloud layer + optical thickness. Mars-like: thin, butterscotch/blue sunset (inverse). Venus-like: thick, pale yellow, hides the surface. Gas giants: no surface; the "limb" is a soft haze. Lava: thin hot silicate haze, dim.
- **Cheap, good-enough implementation (recommended) [A]:** render the atmosphere as a **fresnel/rim shader on a slightly larger sphere** that reads sun direction, with a one-pass analytic approximation of single scattering (an "atmosphere shell" like the Sean O'Neil / Bruneton-style approximations: precomputed or analytic optical depth along a ray through a spherical shell). We are not doing a full multiple-scattering Bruneton LUT: too heavy for a 12-stage game on integrated GPUs.
- **Where atmosphere matters in gameplay:** only a rocky/gas body has one, and **only** these bodies can host the re-entry effect (R6). Airless bodies never show a limb glow.

### 1.9 Star colour by temperature, and what stars look like

Spectral classes [K]:

| Class | Temp (K) | Colour as seen | Example |
|---|---|---|---|
| M | under 3700 | orange-red | Red dwarfs, Betelgeuse (about 3600 K) |
| K | 3700-5200 | orange | Epsilon Eridani |
| G | 5200-6000 | yellow-white | Sun (5772 K) |
| F | 6000-7500 | pale yellow-white | Procyon |
| A | 7500-10,000 | white | Sirius |
| B | 10,000-30,000 | blue-white | Rigel (about 12,000 K) |
| O | over 30,000 | blue | Rare, hottest |

- **Do not draw stars as saturated pure colours.** No star is green. The "colour" is a **blackbody**: use the Planck-to-sRGB approximation (e.g. Mitchell Charity's blackbody table) or an analytic fit (Tanner Helland's polynomial fit is common in shaders [K]). Pass temperature as a single float and derive RGB in the shader.
- **Size and luminosity are linked to temperature but not equal:** giants are huge and cool/red; main-sequence hot stars are blue; dwarfs small and dim. Luminosity proportional to R^2 T^4 [K]. This gives the *stage ladder* a real logic (a Giant is big and red).
- **Appearance of a star surface:** limb darkening (edges dimmer and redder, I(mu) = 1 - u(1 - mu) with u about 0.6 [K]), granulation, sunspots, prominences/flares at the limb, a corona (only visible in eclipse, so keep it subtle or a "bloom"). Red supergiants and giants show a few huge convection cells and a mottled surface. A soft **bloom** is the right treatment for the brightness (and it is a camera/eye effect, not a physical glow). Optional "diffraction spikes" are a *telescope* artifact; **do not use** by default (reads as sci-fi lens flare). [A]
- **White dwarfs** (not in our ladder) are small, hot, and white-blue. Not needed.

### 1.10 Neutron stars and pulsars [K]

- 1.1-2.2 solar masses in about 20 km diameter; density about 10^17 kg/m3; escape speed up to about half of c; magnetic field up to 10^8-10^11 tesla (magnetars).
- **Pulsar:** a rotating neutron star whose magnetic axis is misaligned with its spin axis sweeps two narrow beams of radio (and sometimes X-ray/gamma) through space like a lighthouse. Periods about 1.4 ms to several seconds. The game's "pulse" is therefore **physically real** and a gift for audio design (§5.2).
- **Look:** a tiny intense blue-white sphere with a strong bloom halo, a faint polar tilt, two thin conical beams and (optionally) a magnetosphere sheen; a fading debris/pulsar-wind nebula around young ones. [A]
- **Gameplay hooks:** extreme gravity; tidal destruction of anything close (§2.4); **very visible lighthouse** timing for a "dodge the beam" mechanic (ASSUMPTION, optional).

### 1.11 Black holes, accretion discs and gravitational lensing [K]

- **Schwarzschild radius** r_s = 2GM/c^2 (about 3 km per solar mass). The **photon sphere** is at 1.5 r_s; the **innermost stable circular orbit** at 3 r_s (non-spinning); the **shadow** seen from far away is about 2.6 r_s in radius (5.2 GM/c^2). [K]
- **Accretion disc:** a thin, hot, differentially rotating disc. Inner region is hotter (blue-white, X-ray), outer cooler (orange-red). **Doppler beaming**: the side moving toward you is brighter and bluer, the receding side dimmer and redder. This asymmetry is the single best "this is a real black hole" visual cue [K].
- **Gravitational lensing:** light is bent, so the far side of the disc is visible *over the top and under the bottom* of the hole (the "Interstellar" look), and background stars are smeared into an **Einstein ring**. For a game, it is enough to **warp the background sampling around the hole** with a screen-space distortion: offset UV by an analytic deflection (about proportional to 1/b for impact parameter b, a Schwarzschild-like approximation), and draw the disc once flat plus once as an "arch" over the shadow. A true ray-marched geodesic solution (like Riazuelo or James et al.) is possible but not needed at 60 fps on integrated GPUs. **ASSUMPTION** (the visual approximation is standard practice in real-time demos, but I did not verify a specific reference this session).
- **Jets:** relativistic bipolar jets along the spin axis, narrow, bright, synchrotron-blue/white, with knots. They exist for actively accreting black holes (and for pulsars/some neutron stars) [K]. Draw as two narrow additive cones with a noise-scrolling texture, **only while the hole is actively feeding** (ties them to gameplay: a recent absorb makes the jet flare).
- **Event horizon is not a wall.** There is no physical "edge-of-world" meaning. Use this in the boundary replacement (§3.5).

### 1.12 Jets and winds for other bodies

- Active **comets/asteroids** can outgas near stars (a *coma* and two tails: a blue **ion tail** pointing directly away from the sun and a curved dusty tail). This is the **only correct "smoky" plume** for a small body, and it only happens when it is **close to a star and icy/volatile-rich**. Good optional detail for stage 1-2 near a star; **not** a thruster. Never on a bare rock far from a star. [K]
- **Stellar wind / coronal mass ejections** (stage 7-9): subtle particle streaks flowing outward, and prominences. Visual only.
- **Giant-star mass loss:** a diffuse, slow, expanding shell; fits stage 8-9.

### 1.13 Summary table: per-stage look rules (what the renderer should do)

| # | Stage | Light source | Allowed glow | Forbidden |
|---|---|---|---|---|
| 0 | Meteorite | Sun-lit only | Impact flash; entry glow inside an atmosphere | Thruster flame, heat rim, halo |
| 1 | Asteroid | Sun-lit only | Impact flash; coma only if icy and near a star | Flame, halo |
| 2 | Dwarf Planet | Sun-lit | Impact flash; thin-haze limb for Pluto-likes | Flame, any rim glow on airless ones |
| 3 | Rocky Planet | Sun-lit; lava = emissive cracks | Terrestrial limb scatter; lava emission by temperature; entry glow for things falling in | Halo on a bare rock |
| 4 | Gas Giant | Sun-lit; faint self-heat | Soft haze limb; aurora at poles (optional) | Hard rim "ember" glow |
| 5 | Gas Planet (brown dwarf) | Self-emission faint IR-red | Very dim red emission | Bright yellow stars colours |
| 6 | Dwarf Star | Emissive (M-K class) | Bloom, flares | |
| 7 | Star | Emissive (G-F) | Bloom, flares, corona | |
| 8 | Giant Star | Emissive (K-M, huge) | Bloom, mass-loss haze | |
| 9 | Supergiant | Emissive red or blue | Bloom, shell | |
| 10 | Neutron Star | Emissive, tiny | Bloom, beams, pulsar wind | |
| 11 | Black Hole | Lensed disc | Disc (blackbody + Doppler), photon ring, jets | A flat 2D ring with no lensing |

---

## 2. Physics for collisions, absorption and scale

### 2.1 Impacts

- **Energy scales with v^2.** KE = 1/2 m v^2. At typical solar-system impact speeds (about 5-30 km/s [K]) the energy per kilogram (12-450 MJ/kg) is many times the energy of TNT (4.2 MJ/kg) [K], so impacts vaporise and melt material. Collisions in vacuum between bodies **do not** make fire; they make a **flash** (vapor/plasma, briefly incandescent), an **expanding vapour plume** (spherical, not buoyant), **ejecta** (ballistic particles) and a **crater**.
- **Look of a good impact (recommended event, §5/§6 contract name: `impact`):**
  1. T+0 to about 80 ms: a white-hot **flash** (point + small bloom), scales with impact energy relative to the target (not absolute).
  2. T+0 to about 1.5 s: **ejecta particles** in a cone around the surface normal (more if oblique), ballistic (gravity-aware), each cooling along the blackbody ramp white > yellow > orange > red > black over about 0.3-2 s (R5). Small bodies lose them to space (low escape speed); big bodies re-capture them.
  3. A **shock ring** only as a stylised UI cue (no physical shockwave in vacuum). Keep it faint and short, or draw it as a *lens/refraction ripple in the HUD layer*. Do not make it a fire ring.
  4. Optional: a **crater decal** or a deformation mark on the target (for bodies that persist), and a brief **dust cloud** that disperses as a sphere.
  5. **No smoke, no flame, no mushroom cloud** (those require an atmosphere and buoyancy).
- **Hit-stop and screen shake are for feel, not realism** and are allowed (already in the engine).

### 2.2 Absorption and momentum

- **Conservation of momentum** in a merger: p = m1 v1 + m2 v2, so the merged velocity v = p / (m1 + m2). A big body is barely deflected by a small one; the player's own velocity change when it eats a small body is tiny, and when it hits a large one it is big. This replaces the current mass-weighted bounce and the "knockback" constant. [K]
- **Not all mass is gained.** Real collisions eject material (inefficient accretion): the existing `absorbEfficiency = 0.4` is, in physical terms, a fair model of "some mass is blasted away" for high-speed hits and about 100% for slow, gentle merges. **Recommendation:** make the efficiency depend on **relative speed vs the mutual escape speed**: gentle contact (v_rel below about v_esc) accretes about 90%+, fast hits shed more as debris. That gives skill expression (approach gently to gain more) and real-looking debris. **ASSUMPTION** (design choice; the underlying principle is standard in planetary-collision simulations [K]).
- **Angular momentum** goes into spin: off-centre impacts spin the body up (physical flavour for §1.4).
- **Energy** that is not kinetic (the "lost" part) becomes heat, shown via R5 as the brief glow of the debris and a short warm tint on the impact site that cools over seconds.
- **Inertia in vacuum.** With no drag, bodies keep their velocity forever (Newton 1). The current game uses `drag` (1.2 to 0.8 per second) and a "relax to cruise velocity" for neutral bodies. Both are un-physical but **good for control feel**. Recommendation: **keep a small, explicitly-labelled "stabiliser" assist** for the player (auto-brake when no input, switchable as a perk, or reduce its strength with stage), and make **non-player bodies fully inertial** (no relax-to-drift) so orbits, slingshots and collisions work. The drag should be framed as a "gravity-lock brake" in UI language, not hidden. [A]

### 2.3 Recommended believable-but-fun model

The aim: a **small, cheap, deterministic** physics core that looks like space and is fun.

**Model: "hierarchical gravity" (patched-conics-inspired, softened, local N-body).** [A]

1. **Bodies belong to a system tree** (star > planets > moons; a belt around a star; a galaxy arm; etc.) generated by the universe (§3). A system member follows an **analytic Kepler orbit** around its parent as a function of time (or a circular approximation): `pos(t)`; **no numerical integration** and thus no drift, no loading error, and exact determinism. This is "on rails" in the sense of KSP-style *patched conics* [K]: far-away motion is a clean two-body conic around the dominant body.
2. **Free bodies** (the player, any body knocked off its rail, debris, ejecta) are **integrated** with a semi-implicit (symplectic) Euler or velocity-Verlet step [K]. Their acceleration comes from **the few dominant sources only**: the "sphere of influence" body (SOI, with radius a (m/M)^(2/5) [K]) and at most the K nearest heavier bodies (K about 4-8). This keeps cost O(free x K) and avoids full N-body.
3. **Softening.** Use a = G M r / (r^2 + eps^2)^(3/2) with eps about the body's radius, to avoid infinities and slingshot explosions at contact. Clamp acceleration. [K]
4. **Capture/promotion.** If a free body with low relative energy enters a body's SOI it becomes **bound**; optionally *re-parent it on rails* once its orbit is stable (cheap and stops jitter). If hit hard, a rail body is **demoted** to a free body with its current rail velocity. This is how the world stays stable *and* reactive.
5. **Game gravity constant is a tunable.** G is chosen so that circular orbit periods near the player are **5-60 s in game time** at every stage. Because everything is **relative to player radius**, the orbit scale rule is: orbital speed at distance r is v = sqrt(G M / r), so choose G per stage (or equivalently scale time) to keep v on the order of the player's top speed. [A]
6. **Fixed timestep** (keep the existing 1/120 s) with an accumulator; the orbit solver for rail bodies is evaluated at the interpolated time.
7. **Player control** is thrust (force) plus the stabiliser assist (2.2). The player is a free body; the player's *gravity* on others is allowed only above a mass ratio (otherwise ignore), which keeps threat bodies from being dragged by a pebble.
8. **Pull range of prey** (existing `CONFIG.absorb.pull*`) becomes a **real gravity well** with softened, **range-limited** acceleration (r_pull proportional to m^(1/3)). This preserves "I can scoop things close" but looks like gravity.
9. **Collision shapes:** spheres (or spheres + irregular render mesh). Irregular meshes are visual only.
10. **Chase AI** stays. In-universe justification: big bodies **are** pulled, and the "chasers" are *gravitational captures*: they follow because their orbit around the player's mass shrinks. For readability keep the existing AI; swap its steering for **force-based gravity-influenced steering** later. (Out of scope for the first pass.) [A]

**Alternatives considered.**

| Model | Pro | Con | Verdict |
|---|---|---|---|
| Full N-body, all bodies | "True" | O(n^2), chaotic, unfun, unstable at scale | No |
| Gravity only from the player | Simple | Not "space-like"; no orbits | No |
| **Hierarchical rails + local softened gravity (above)** | Cheap, deterministic, stable, reactive | More concepts | **Yes** |
| Pure arcade (current) | Already works | Unrealistic; user asked for realism | Keep as fallback tuning |

### 2.4 Tidal disruption (Roche limit) as the signature "big absorb" effect

- **Roche limit** [K]: the distance inside which a satellite held together only by its own gravity is pulled apart by the tidal force of the primary. For a fluid body: d = 2.44 R_M (rho_M / rho_m)^(1/3), where M is the primary and m the satellite. For a rigid body, about 1.26 R_M (rho_M/rho_m)^(1/3). Real examples: Saturn's rings lie inside its Roche limit; comet Shoemaker-Levy 9 was torn up by Jupiter in 1992; stars shredded by black holes produce **tidal disruption events (TDEs)** [K].
- **Why it is the perfect absorb effect.** Once the player is much bigger than the prey, instead of the prey "popping" on contact, it **stretches into a stream, breaks into fragments, and spirals into the player**, forming a brief **ring/arc** that then falls in. This is both **true to physics** and **the best-looking** reaction in the game, and it makes the existing creative idea ("spaghettification" at the black hole, `docs/creative-direction.md` §6 row 12) a general mechanic.
- **Rules:**
  1. Compute the Roche distance each step for (player, nearby prey) pairs where the player is the primary and the mass ratio exceeds about 10x (ASSUMPTION).
  2. When the prey's centre enters it: switch the prey from a **rigid mesh** to a **fragment swarm** (spawn N = 8-64 particles from the prey's volume, positions/velocities from the prey's own, tidal acceleration `a_tidal = 2GM/r^3 * dr` along the radial axis; keep it simple: stretch along the radial direction and compress perpendicular).
  3. Fragments continue to be **softened-gravity particles** around the player and are individually absorbed as they touch (each adds its share of mass). Visual: a spiral accretion arc.
  4. Bodies of comparable mass: **no** disruption (they bounce or merge). Bodies much *larger*: they disrupt *you* (a "threat" encounter near the Roche limit is visibly dangerous: the player's mesh stretches and sheds debris, hurting health). That is a readable, physical danger signal.
  5. At the black hole stage, the effect extends: the stream heats into the **accretion disc** (R5 blackbody), and a **TDE flare** (brief bright pulse + jet flare) rewards absorbing a *star-sized* prey.
- **Cost:** swarm is a pooled particle system (a few hundred particles, GPU-instanced). **No new rigid bodies.**

### 2.5 Gravity assists and orbital play

- With analytic orbits, a planet/star has a **velocity**. A player that passes **behind** a moving body (relative to its motion) gains speed; **in front** loses speed [K]. Implement via the real gravity (§2.3), not a scripted boost.
- **HUD aid:** a **trajectory predictor** (draw the next N seconds of the player's path under the same gravity model, e.g. 100-200 integration steps at a coarse step) is the canonical way to make gravity readable and fun (a la KSP/Outer Wilds) [K]. Optional per stage (it should come with a perk or be on by default early and toggleable).
- **Capture:** low-relative-energy approach to a body below its SOI becomes a **bound orbit**; a short reward SFX and HUD tag "ORBIT ACQUIRED" is a nice sci-fi moment.

### 2.6 Handling the enormous scale range

The 12 stages span far beyond float32 (about 7 decimal digits) [K], and `Number` in JS is already float64 (about 16 digits), which gives plenty on the CPU.

**Three techniques, used together:**

1. **Floating origin / camera-relative rendering** [K]. Store positions in **float64** on the CPU, in **"universe units"** (see item 3). Each frame, subtract the camera position (in float64) from every visible body, and only then convert to float32 for the GPU. The camera is *always at the origin* in render space. This removes jitter and z-fighting at any distance. Rebase the **simulation** origin whenever the player moves further than about 10^6 units from it (shifting all body positions by the same offset in float64), mostly as hygiene because float64 will not break for a long time.
2. **Per-stage "world unit" rescaling.** The current game already makes player radius the unit of speed and size, and the camera keeps the player at a constant pixel size. In 3D: define `S = playerRadius`; all tuned values (speeds, ranges, spawn distances) are in multiples of S. The camera distance is also c * S. Because bodies are *relative to the player*, **the camera never has to represent huge numbers** and the depth buffer stays well-conditioned.
3. **Logarithmic scale presentation.** For sizes spanning 10^20, there are two layers:
   - **Near field** (within about 100-300 S): true 3D bodies at correct relative scale. Depth range for the camera: near = 0.05 S, far = 5000 S; use **reversed-Z with a floating-point depth buffer** (`DEPTH_COMPONENT32F`) or a **logarithmic depth buffer** to avoid z-fighting [K].
   - **Far field** (beyond about 300 S): bodies drawn as **billboards/impostors at "angular size"**: positions are projected onto a large sphere (like a skybox with parallax) with a size and brightness consistent with distance. **Even larger structures** (galaxy-scale) are *backdrop layers* whose parallax is damped. Objects cross the near/far boundary with a **cross-fade** so nothing pops.
4. **Stage transitions (the "scale shift").** At each evolve, run a **zoom transition** (the existing "inhale, flash ring, morph, palette cross-fade, banner"): over about 1.5-3 s, animate the camera distance from 1x to about 2x of the old view, *while simultaneously re-scaling the universe's unit* by the stage's `worldScale` ratio so that what was "far, big structure" becomes "the new near field" and what was "near debris" becomes "dust/distant glitter". Because the generation is hierarchical by scale (§3.3), the layer that was the previous backdrop is now the playfield and is **already loaded**, so it never pops. **Recommendation:** keep the camera at a constant S-relative distance and *change the universe's level index* rather than moving the camera very far. [A]
5. **Gameplay size vs real size.** Real sizes would put the neutron star 10^4x smaller than a supergiant. The game keeps its **compressed ladder** (`radiusScale` per stage in `stages.js`) and the neutron star's compactness. In 3D, show the *relative* radius honestly only where cheap (a neutron star is a tiny bright point with a big bloom); don't try to make the black hole's Schwarzschild radius exact. **ASSUMPTION:** sizes are "symbolic physics".

**Timing the sim.** Use **game-time scaling** (time warp) per stage: planets "feel" slow if shown in real time, so a per-stage `timeScale` multiplies sim time for **visual** motion (orbits, rotation) but **not** for control responsiveness. [A]

---

## 3. A deterministic, procedurally generated, effectively infinite universe

### 3.1 Goals and constraints

- Same seed => same universe, **everywhere, any time, any order of visiting** (so we can regenerate a cell after unloading it, and the player can see the same planet when they return).
- **No edge.** Positions are float64, so the universe is bounded only by float64 precision (about 9 x 10^15 units for integer-exact coordinates [K]), many orders of magnitude beyond what a run can reach.
- **Bounded cost**: memory and CPU independent of how far the player has travelled.
- **Fits the scale ladder**: contents change with the stage (§3.4).

### 3.2 Cell-grid generation (the core algorithm)

**Space is divided into a regular grid of cells; each cell's content is a pure function of `(seed, level, cx, cy[, cz])`.** [K, standard technique]

1. **Hash.** Use an integer hash on 32-bit ints that mixes seed, level and coordinates (e.g. a PCG hash or `xmur3` / `splitmix32` chain; avoid `Math.random`). Pick the hash with good avalanche, and mix coordinates as integers *after* a floor, so negative coordinates and large coordinates work. For float64 positions, convert to cell indices with `Math.floor(pos / cellSize)` then split into high and low 32-bit parts if beyond 2^31 (ASSUMPTION: not needed for the first release, because a run will not reach 2^31 cells at any level).
2. **Per-cell PRNG.** `rng = makePrng(hash(seed, level, cx, cy))`: a small fast PRNG (mulberry32/sfc32). Draw, in a **fixed order**, the number of bodies, then for each body its type, mass, offset within the cell, velocity, spin, orbit, and **its own sub-seed**. A body's sub-seed is what the renderer uses to build its mesh/shader parameters (so the same body always looks the same).
3. **Fixed draw order is critical.** If a code change reorders draws, every existing seed changes. Version the generator (`genVersion`), and record it in the save/seed string.
4. **Density function.** Number of bodies per cell = Poisson-like, with the mean given by `density(level, cx, cy)` = base density x **low-frequency noise** (value/simplex noise over the cell grid, 1-3 octaves) so there are **clusters, filaments and voids**. Rejection-sample a few extra candidates to prevent overlaps (check against bodies of neighbouring cells by generating with a margin, see below).
5. **Cell borders.** A body can overlap a cell edge. Either (a) restrict a body's centre + radius to inside its cell, **or** (b) when loading a cell, also evaluate its 8 (2D) / 26 (3D) neighbours and keep any body whose sphere overlaps the cell. Use (a) for small bodies, (b) for large ones (large bodies live at **coarser levels** where cells are big, §3.3 so (a) holds).
6. **Systems.** A star cell can generate a **system**: a primary, N planets with orbital radii following a **Titius-Bode-like spacing** (a_n = a_0 * k^n, k about 1.4-2 [K]), moons, and a debris belt. The system is generated in **its own local frame** from its sub-seed, then placed at the system's anchor point.

### 3.3 Hierarchical scale levels ("density by scale")

Since the player's size changes by 6-7 orders of magnitude, **one grid cannot serve all stages.** Use **levels** (like octrees or mip levels), each with its own cell size and body population:

| Level | Cell size (S = player radius at that stage) | Typical contents | Stages where it is the playfield |
|---|---|---|---|
| L0 | about 60 S | Dust, pebbles, meteorites | 0-1 |
| L1 | about 120 S | Asteroids, small debris fields, comets | 1-2 |
| L2 | about 250 S | Dwarf planets, belts, moon systems | 2-3 |
| L3 | about 500 S | Planets, planetary systems | 3-5 |
| L4 | about 1000 S | Brown dwarfs, small stars with systems | 5-7 |
| L5 | about 2000 S | Stars, binaries, giant/supergiant | 7-9 |
| L6 | about 4000 S | Neutron stars, stellar remnants, small clusters | 9-10 |
| L7 | about 8000 S | Black holes, star clusters, nebulae | 10-11 |
| L8+ | larger | Galaxy arms, galaxies, clusters (backdrop and finale) | beyond |

(ASSUMPTION: the actual numbers, and having one level per stage or one per two stages, should be tuned in play. The principle: **each level's cell size is a constant multiple of the playfield scale at the stages where that level is the main content**, so *cell count visible* stays constant at every stage.)

- **Per level, per frame** the loader considers a **window of cells around the camera** (e.g. 5x5 in 2D, a few more in the depth axis), and each body's *visibility* depends on its **size vs distance** (apparent-size cull) and on **level-of-detail**: the closest 1-2 levels are real bodies (full simulation), farther levels are **impostors** (billboards/points, no sim), and levels more than ~2 above the player are **backdrop** (parallax layers).
- **The "interesting range" rule.** At stage n, **levels within about -1 to +3 of the player's level** are active; smaller levels are **unloaded** (turned into a "dust" shader overlay), and larger levels are **only as backdrop**. This keeps total body count within the budget (target: about 150-300 near bodies, about 2-5k instanced impostors).

### 3.4 Contents by scale (what the player sees changing)

| Stage band | The playfield looks like | Backdrop / distance | Gameplay flavour |
|---|---|---|---|
| 0-1 (Meteorite, Asteroid) | A **debris field / asteroid belt**: rocks, ice chunks, dust lanes, the odd moon-sized body looming; a distant sun with hard light | A planet (huge, slowly turning) and a sun | Dodge-and-nibble. Gentle orbital drift. First slingshot around a planet |
| 2-3 (Dwarf, Rocky) | **Belts and moon systems**; a sparse planetary system; comets | Gas giant, sun; bright disc stars | First real gravity wells; orbit around a bigger planet |
| 4-5 (Gas Giant, Gas Planet) | **Planetary systems**: star + planets + moons; ring systems | Neighbour stars, a faint nebula | Rings as scoop zones; moons as prey |
| 6-8 (Dwarf star to Giant) | **Star neighbourhoods**: stars, binaries, protoplanetary discs, small planets as prey | Star cluster, a galactic arm | Stars as prey and as threats; stellar winds |
| 9-10 (Supergiant, Neutron) | **Stellar nurseries/clusters**, nebulae, remnants, **supernova remnants** | The **galaxy** as a dense band and bulge | Tidal destruction; pulsar beams |
| 11 (Black hole) | **Galaxy-scale**: star streams, clusters, other black holes, quasar-like jets | **Galaxy clusters** as a cosmic web | Whole stars as prey; TDE flares; the endgame |

- **Voids and structure** come from the density noise at the corresponding level (a filament/void pattern at the big levels; a belt/lane pattern at small ones), so **there is always somewhere to go** but the player can't just run straight (§3.5).
- **Nothing pops.** A body that is a *backdrop impostor* at level L+2 and later becomes a *real body* at L+1 is **the same body** (same sub-seed and position), because levels are generated hierarchically from the parent cell (a parent cell's sub-seed seeds its children). [A]

### 3.5 Replacing the "Event Horizon" boundary death

The current boundary (`CONFIG.boundary`, `checkBoundary`, `state.bounds`, `state.edge`, `edgeDoom`, `ui.warnBoundary`, the `eventHorizon` ending) must go: an infinite universe has no edge. The "Event Horizon" ending name and idea are good though (it is the title of the death ending). Options:

| # | Option | How it works | Pro | Con |
|---|---|---|---|---|
| A | **Cosmic voids** | Density noise creates huge emptier regions. No death, just nothing to eat | Natural; zero rules | Can be boring; the player needs guidance |
| B | **Void + signal beacon** (recommended, with A) | In a void a **HUD "dark-field" indicator** shows direction/distance to the nearest dense region (e.g. "NEAREST MATTER: 1.2 kly, bearing 047") and a faint **gravitational "tide" drift** gently biases motion toward the mass | Guides without a wall; very sci-fi UI | Needs the universe to answer "nearest dense cell" cheaply (a coarse density query) |
| C | **Starvation** | In a void, the player slowly **loses mass** ("evaporation", Hawking-like flavour) at a low rate | Creates pressure to avoid voids without a wall | Punishes exploration; mass loss near a growth threshold can **regress a stage**, so cap it (never below the current stage minimum) |
| D | **Hunter pull** | Giant structures (hungry black holes) have enormous SOI. A player drifting too far from "food" meets one that **captures** them (the "Event Horizon" ending, as a story beat, not a wall) | Keeps the ending name; spatially emergent | Needs fairness: warn early, give an escape, signal via lensing and sound |
| E | **Wrap/teleport** | Toroidal wrap | Trivial | Breaks "infinite" and determinism; **rejected** |
| F | **Soft fog ("deep dark")** | Past a distance with no matter, the screen darkens and the stars fade; at the extreme the player is "lost in the dark" and gets a free respawn at the nearest matter | Gentle | Is effectively a boundary |

**Recommendation (ASSUMPTION; needs playtest):** **A + B + a light D.** No hard edge, no timer death for wandering. Voids exist and are **signalled** by the HUD beacon and a subtle drift. The **"Event Horizon" ending is kept as a death by being captured by a larger black hole** (a *threat*, gameplay-driven, and readable thanks to lensing and the Roche/tidal effect on the player). Starvation (C) is **off by default** and only available as a "Hard mode" flag.

**State/API changes this implies (contract only):** `state.bounds`, `state.edge`, `state.edgeDoom` are removed; add `state.region = { densityHere, nearestMatter: {dist, bearing}, inVoid: boolean }`; `ui.warnBoundary(on)` becomes `ui.setRegionStatus(region)`; the `deathCause: 'boundary'` and `flags.eventHorizon` paths are re-triggered only by `'captured'`. (Legacy names are kept for compatibility during migration, see §6.)

### 3.6 Loading, unloading, determinism and performance

- **Cell cache** keyed by `level:cx:cy[:cz]` -> compact descriptor arrays. LRU eviction beyond the active window plus a margin (hysteresis: load at distance R, unload at 1.5 R, so cells don't thrash).
- **Generation budget:** at most about 2 ms per frame of generation work; **spread across frames** (enqueue cells in distance order). Cells are small (tens of bodies), so generation is a few microseconds each. A Web Worker is optional and unneeded at first. [A]
- **Persistence:** since generation is pure, only **deltas** need to be stored: `consumed` body IDs (a set keyed by `(level, cell, index)`) and any bodies knocked off rails (position/velocity). So the "world state" in a save is tiny and the **seed + deltas** reproduce the world. Absorbed bodies stay absorbed; escaped debris is an ephemeral particle.
- **Stable IDs:** a body ID is `hash(level, cx, cy, index)`; it is stable across load/unload. The ID must fit the engine's number ids; use a 53-bit-safe integer or a string key.
- **Seed UX:** show a short seed code on the title screen ("SEED: VD-7K3Q-9XA2") and a "daily seed" option. [A]
- **Testing:** unit-test determinism (same seed gives byte-identical cell output), a "no overlap" test, and a "same cell loaded from two directions" test. (The existing `tests/stages.test.mjs` shows the repo already has a Node test setup.)

---

## 4. 3D in the browser

### 4.1 Options compared

| Criterion | **Three.js** | **Babylon.js** | **Raw WebGL2** |
|---|---|---|---|
| Size (min+gzip) | about 170-185 kB full import, less with tree-shaking **[V]** | about 1.4-1.8 MB full; about 300 kB minimal scene with modular imports **[V]** | 0 (our own code, maybe 20-40 kB) |
| No-build-step fit | **Excellent**: official ES modules + `importmap` from a CDN **[V]** | Possible via CDN/UMD, bigger download | Perfect (no library) |
| Learning curve / docs / examples | Largest community, many space/planet/shader/post examples | Rich built-ins (GUI, inspector, node materials, particle systems) | Steep; everything hand-written |
| Instancing | `InstancedMesh`, `InstancedBufferAttribute` | Thin instances | Manual `drawArraysInstanced` |
| Post-processing (bloom, tone map) | `EffectComposer` + `UnrealBloomPass`, or the node-based pipeline | Built-in `DefaultRenderingPipeline` (bloom, ACES, etc.) | Write your own (several passes) |
| Custom GLSL | `ShaderMaterial`/`onBeforeCompile`; **TSL** (node shading language) targets both WebGL2 and WebGPU **[V]** | Shader/Node Material Editor | Full control |
| WebGPU readiness | `WebGPURenderer` with automatic **WebGL2 fallback** **[V]** | WebGPU engine supported | Not applicable |
| Risk | API churn between releases; **pin a version** | Heavier, more opinionated | Time sink, bugs, no ecosystem |

Sources for the **[V]** claims: Three.js import maps and the `WebGPURenderer` WebGL2 fallback via CDN/`importmap`, [Utsubo: Migrate Three.js to WebGPU (2026)](https://www.utsubo.com/blog/webgpu-threejs-migration-guide), [ICS MEDIA: Getting Started with the Latest Three.js Release](https://ics.media/en/entry/14771/), [Three.js Shading Language tutorials (sbcode.net)](https://sbcode.net/tsl/getting-started/). Bundle sizes: [Three.js vs Babylon.js (LogRocket)](https://blog.logrocket.com/three-js-vs-babylon-js/), [Babylon.js vs Three.js 360 comparison (DEV)](https://dev.to/devin-rosario/babylonjs-vs-threejs-the-360deg-technical-comparison-for-production-workloads-2fn6), [Three.js vs Babylon.js vs PlayCanvas (Utsubo)](https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison), [Babylon bundle size thread](https://forum.babylonjs.com/t/babylon-bundle-size/48068). Search snippets only; the pages themselves were not opened, so exact kB are approximate.

### 4.2 Recommendation: **Three.js, loaded as ES modules through an `importmap`, WebGL2 renderer, no bundler**

Reasons:

1. **Honours the "no build step, no dependencies to install" constraint** of the repo (`package.json` has no dependencies; `npm start` is just `npx serve`). An importmap pointing at a **pinned** CDN version (or better, **a vendored copy under `vendor/three/`** so the game works offline and does not depend on a CDN at run time) keeps the dev loop identical. **[V]** for the importmap method; the vendoring recommendation is **[A]**.
2. **Lowest size and highest ecosystem** for what we need (custom shaders, instancing, bloom).
3. **Babylon.js** has better built-ins, but it is about 10x larger, and we are writing our own procedural shaders anyway. **Raw WebGL2** gives the most control but spends the entire schedule on infrastructure.
4. **Use the classic WebGL2 `WebGLRenderer` + GLSL for v1.** The WebGPU/TSL path is promising ([V] it falls back to WebGL2) but newer and changing. **Keep it as a later upgrade**; write shaders as isolated GLSL chunks so they can be ported.
5. **Pin the version** (the exact version to be chosen on the day by the engine agent; **do not hard-code a number from this document**) and record it in `docs/engine-notes.md`.

**Alternative if a build step is ever acceptable:** Vite (`npm i three`, `vite`) gives tree-shaking, minification, `import ... from 'three'`, hot reload and shader file imports (`?raw`). It would cost: a `package.json` with dependencies, a `dist/` for deploy, and a change to "no build step". **Recommendation:** do **not** add Vite at first; revisit if bundle size or load time exceeds the budget (§4.5) or shader file organisation hurts. ASSUMPTION.

**Deployment note [A]:** an importmap with a `https://cdn.jsdelivr.net/npm/three@<pinned>/...` URL works on static hosting. Vendoring avoids CDN outages and CORS/offline issues; both work with `npx serve .`.

### 4.3 Procedural bodies via shaders and noise

All visuals are generated at runtime. No texture assets.

- **Noise library (GLSL, in `src/gfx/glsl/`).** 3D simplex/gradient noise, fBm (4-6 octaves), ridged noise, domain warping, **Worley/cellular noise** (craters, granulation, cracks), hash functions that run on the GPU with the body's seed as a uniform offset. [K]
- **Asteroids/meteorites:** one **icosphere** (subdivision 3-4, about 1.3k-5k triangles) instanced; **vertex shader displaces** along the normal by low-frequency 3D noise x per-instance axis scaling (elongation, 'potato'), then the fragment shader adds **crater** normal/albedo detail (Worley, 2-3 scales, power-law sizes) and regolith grain. Per-instance attributes: seed, scale vector (a,b,c), albedo, crater density, spin quaternion (or compute spin in the shader from time + seed).
- **Planets:** a sphere; fragment shader computes **height** (fBm), **biome/palette** (from height and latitude), **ocean mask**, **clouds** (a second fBm, scrolling), and the **atmosphere shell** (a second slightly larger sphere with a fresnel/scatter shader). Normals from analytic noise gradient or screen-space derivatives (`dFdx`/`dFdy`).
- **Gas giants:** bands from latitude + domain-warped noise, vortices from curl-like warping, **ring** as an instanced flat annulus mesh with a radial opacity ramp + shadow. **Animate with a time uniform** (slow).
- **Stars:** sphere with an emissive fragment shader (granulation Worley + fBm, limb darkening, sunspots), colour from **temperature**, plus a **corona/bloom billboard**, plus a **point light** (the key light).
- **Neutron star:** small sphere + two beam cones (additive, scrolling noise) + big halo billboard.
- **Black hole:** a **full-screen / large-quad shader**: samples the background starfield cube/skybox with a **lensing deflection**, draws the disc analytically (blackbody ramp + Doppler brightness), the photon ring, and masks the shadow. Cost is a few hundred ALU ops per pixel on a limited screen area. [A]
- **Starfield/backdrop:** a procedural **skybox** (cube or large sphere shader) with star layers (hash-based, colour by temperature), a **galactic band**, and soft nebula noise; parallax by level (§3.3).
- **Level of detail:** smaller than about 2 px on screen => a coloured **point sprite**; 2-30 px => a low-poly mesh with a cheap shader; above that => full shader. Keeps the cost proportional to the screen area.
- **Seeding:** every shader reads `uSeed` (a float derived from the body's sub-seed), so two asteroids are never identical and a body is always the same.

### 4.4 Instancing for thousands of bodies

- **Instanced meshes** for asteroids/debris (one draw call per mesh variant, thousands of instances): per-instance `mat4`/position+scale+quaternion, plus seed/colour as **instanced attributes**. [K]
- **One shared geometry per class** and the variety from the shader (seed), not from different geometries. 3-4 icosphere variants for silhouette variety.
- **Impostor billboards via `Points` or instanced quads** for far bodies (thousands cost almost nothing).
- **Particle systems** (dust, ejecta, tidal fragments, accretion): GPU-side where possible (position integrated in the vertex shader from a start state and time) or a pooled CPU buffer updated per frame (a few thousand is fine).
- **Frustum culling** per instanced batch is coarse; **cull on the CPU** by distance/size before filling the instance buffer (we need to anyway because of the cell windows).
- **Update the instance buffer** with the camera-relative positions each frame (float32 after float64 subtraction, §2.6).

### 4.5 Post-processing

- **Pipeline (recommended order):** scene to **half-float HDR render target** > **bloom** (thresholded, mip-chain, as in `UnrealBloomPass`, or a dual-Kawase variant that is cheaper) > **tone map** (ACES filmic or AgX) > **colour grade / vignette / very light film grain** > output. [K]
- **Bloom budget:** strong bloom is what sells stars and the black hole's disc; but it must be **thresholded high** so reflected light on rocks does not bloom (rule R2/R9).
- **Optional:** screen-space **lens distortion** for the black hole (done in its shader), **chromatic aberration** on the hit/impact (UI-feel), **motion-blur-lite** (velocity streak) for the speed sense (careful with nausea; respect `prefers-reduced-motion`, which the repo already checks).
- **Anti-aliasing:** MSAA on the HDR target if supported, else FXAA/SMAA post. Avoid very high DPR on weak GPUs: **dynamic resolution scaling** (see budget).

### 4.6 Performance budget (target 60 fps, i.e. 16.6 ms/frame) — all ASSUMPTION, to be profiled

| Item | Budget | Notes |
|---|---|---|
| Total frame | 16.6 ms on a mid laptop integrated GPU (e.g. Intel Iris Xe class); 8 ms on a discrete GPU | Verify on real hardware. Offer a **quality ladder** (low/med/high) like the existing renderer (`QUALITY`) |
| JS: sim + universe + culling | 3-4 ms | Fixed step 120 Hz may run 1-3 steps per frame; keep the simulation O(free bodies x K) |
| JS: render submission | 1-2 ms | Few draw calls |
| GPU draw calls | below 150-300 | Instancing and merged batches |
| Triangles | below 1-1.5 M | LOD, instancing |
| Fragment cost | The expensive procedural shaders (planet, star, black hole) only on **big on-screen bodies**; each limited to about 6 fBm octaves, with LOD to fewer octaves when small | Overdraw from big bloom billboards is the main risk |
| Post-processing | 2-3 ms | Half-resolution bloom; quarter-resolution for the widest blur |
| Resolution | Dynamic: lower the render scale (0.6-1.0) if the frame time exceeds budget for N frames, with hysteresis | Also respects DPR cap of 2 |
| Memory | below 200-300 MB GPU | No textures except small noise tables; render targets dominate |
| Load | Page weight: Three.js about 180 kB (gzip) + our code; first interactive in under 2 s on broadband [A] | |
| Fallbacks | If WebGL2 is missing or the frame time is bad on low quality, **keep the current Canvas 2D renderer as a "lite mode"** | Cheap insurance; the 2D renderer already exists. The renderer interface (below) should keep both possible |

### 4.7 Camera design: keep gameplay readable

The game is about choosing what to eat and what to avoid by **relative size**. A free 3D camera makes size comparison and steering hard. Options:

| Camera | Description | Readability | Realism/drama | Verdict |
|---|---|---|---|---|
| **A. Pure top-down** (as now, rendered in 3D) | Looks straight down the Y axis | Excellent; trivial controls | Flat, loses 3D shapes/lighting drama | Fallback / "tactical" toggle |
| **B. Angled top-down chase** (recommended) | Camera behind-and-above, pitched about 50-65 degrees from the horizontal plane, looking at the player; the **play plane is the XZ plane**; bodies have small Y offsets (a few percent of their radius) for depth and parallax | Good: comparable sizes and a clear ground plane; the player can see the **terminator and 3D form**, lighting looks real | High: shows spheres, craters, rings, discs at an angle (rings and accretion discs read best at about 20-40 degrees of tilt!) | **Recommended** |
| **C. Third-person free chase** | Camera orbits freely, follows the player's heading | Cinematic; risk of disorientation, targets can be hidden behind big bodies | Highest | Optional "cinematic" mode and for title / evolve cutscenes only |
| **D. First-person** | | Poor for size awareness | | No |

**Recommended design details (ASSUMPTIONS to validate in playtest):**

- **Play plane + thin depth.** Simulation stays **2D (x, z) plus a bounded y-offset used only for presentation** (and the ring/disc inclination). The existing 2D physics, controls and collision logic are reused. Fully 3D physics is out of scope: it triples the difficulty of steering, and the gameplay (eat things around you) is planar. Add true 3D later only for decorative layers.
- **Pitch** about 55 degrees by default, with a slow, damped **auto-tilt**: tilts up a few degrees when the player accelerates or when an ring/disc is nearby (to showcase it), tilts toward 70-80 degrees when many threats are near (more readable).
- **Distance** = c x player radius (so the player stays about constant on screen, as today) with a stage-dependent field of view (35-45 degrees; a narrower FOV flattens perspective and makes relative sizes easier to compare).
- **Look-ahead** along velocity (existing `lookAhead`) and a tiny **banking roll** for speed feel.
- **Orientation:** world-aligned (north-up) rather than rotating with the player, so the direction to threats and food is stable and the HUD radar needs no rotation. (A chase cam that yaws with heading is a toggle.)
- **Depth cues for readability:** a subtle **ground grid or "orbital plane" lines** (very faint, sci-fi, can be the UI layer), **drop-lines/altitude ticks** only if bodies have y-offsets, a **relative-size outline** (existing red/neutral/green relation colours) drawn as a thin HUD ring around bodies, **brightness lift for threats** only as UI (not in the lit scene, so realism stays intact).
- **Stage transition:** on evolve, pull back (existing `pullback`), the star backdrop slides in parallax, and the camera pitch eases through ~15 degrees: a cinematic beat.
- **Accessibility:** a "readability mode" toggle that switches to the top-down camera and boosts relation outlines.

### 4.8 Proposed module/file layout (no code, contracts only)

```
index.html                  importmap + canvas + ui root (owner: engine)
vendor/three/               pinned Three.js build (owner: engine)
src/main.js                 loop wiring (engine)
src/gfx/                    renderer, camera, post, scene graph (engine/3D)
  glsl/                     noise + body shaders (engine/3D, specs from creative)
src/universe/               seed, hash, cells, levels, systems, density (universe)
src/sim/                    gravity, orbits, collisions, absorb, tidal (physics)
src/game.js, world.js       game flow; world becomes a thin adapter (physics)
src/audio/                  Web Audio engine + sound set (sound)
src/ui/                     HUD + screens (ui)
src/data/looks.js           data-only per-stage look params (creative)
```

---

## 5. Audio realism

### 5.1 The principle: space is silent; our game is not

- **In vacuum, sound does not propagate** [K]: no engine roar, no explosions heard from outside. Honest approach: **sound is what the player's own body "feels" and what the interface "says"**. Three diegetic categories:
  1. **Felt / structure-borne sound.** Vibration transmitted *through the player body* and its resonance: low rumbles on acceleration, a deep thump on absorption, a grind and crack when something hits. These are **low-frequency (20-200 Hz), low-passed**, no sparkly highs. Sells mass: the bigger the body, the lower the resonance.
  2. **Fields and "instruments" (stylised physics).** Gravity wells as a **tone whose pitch and level follow the field strength and proximity** (like a sonified sensor), pulsar beam as a **rhythmic pulse at the pulsar's rate**, black-hole proximity as a **sub-bass drone with a Doppler-style pitch drop** and time-dilation-like slowing. These are explained as **sensor sonification** (the "instrument panel") so they remain consistent with "no sound in vacuum".
  3. **UI.** Clean, short, sci-fi tones and ticks. These are explicitly **non-diegetic**.
- **Atmosphere exception.** Inside a planet's atmosphere (R6), **sound exists**: wind, a roaring whoosh and crackle for the entry. A nice contrast: a hush > rumble when entering an atmosphere. Because it is physically justified, it is the only place for "whoosh/roar".
- **Music:** a sparse, ambient pad bed per stage, which *is* acceptable as score (non-diegetic). Keep it under the SFX in the mix. (The existing `docs/creative-direction.md` §11 already has a per-stage music direction; reuse it.)

### 5.2 Synthesis vs sampling (Web Audio only, no asset files)

**Recommendation: fully synthesised with the Web Audio API** (no files, tiny download, resolution/tempo independent, parametric by mass and stage). [A]

| Tool | Use |
|---|---|
| `OscillatorNode` (sine/triangle/saw), `GainNode` envelopes (`linearRamp`/`exponentialRamp`/`setTargetAtTime`) | Tones, drones, UI beeps, sub-bass |
| `BiquadFilterNode` (low-pass, band-pass, peaking) | The "heard through the body" muffling; resonance; stage-based tone colour |
| **Noise buffers** (white/pink/brown generated once into an `AudioBuffer`), filtered | Rumble, debris hiss, impact crunch, atmosphere wind |
| `ConvolverNode` with a **synthetic impulse response** (decaying noise) | Reverb for the "huge" feel; different IR per stage |
| `DelayNode` (+ feedback) | Echoing sonar-like pings, UI trails |
| `WaveShaperNode` | Gentle saturation on impacts and the sub-bass |
| `DynamicsCompressorNode` as a master limiter | Keep loud events from clipping |
| `StereoPannerNode` / `PannerNode` | Direction of nearby events (screen-space pan, not full 3D HRTF) |
| `AudioWorklet` (optional) | Only if we need custom DSP (e.g. a granular source); not needed at first |
| `AudioParam` automation, `ConstantSourceNode` | Smooth, click-free continuous controls (speed, proximity) |

- **Why not samples:** the constraint "Web Audio only (no asset files)". Samples would also need licensing and a download budget. Synthesis also allows **continuous parameterisation** (pitch from mass, filter from speed), which matters for a game whose main axis is scale. **Caveat:** the *realistic* organic sound of a crunch or a crowd is harder to synthesise; **layering** (noise burst + sine thump + filtered clicks) is a well-known way to get a convincing result. [K]
- **Autoplay policy** [K]: browsers need a **user gesture** to start an `AudioContext`; create/resume it on the first click/key (the title screen "Start" is natural). Provide **mute and volume** (master, music, SFX) in the UI and persist them (the UI owner supplies the control; the sound owner the API).
- **Voices:** cap polyphony (about 24-32 active voices), steal the oldest/lowest-priority, and throttle repeated events (e.g. 50 absorbs per second should collapse into a rate-limited granular "chewing" texture).
- **Perf:** a few dozen nodes are cheap. Reuse nodes (pooling), schedule with `audioContext.currentTime`, **never create nodes per frame in loops** without cleanup.
- **Accessibility:** captions/visual flashes are not needed for ambient SFX, but UI sounds should have visual equivalents, and **reduced motion/sound** options should respect user settings. (Players with hearing differences should lose nothing: all important info is also visual.)
- **Scaling the sound with mass:** pitch of resonances proportional to 1/radius (bigger = lower), reverb tail length and low-pass cutoff by stage (a continuous function, not 12 hand-made sets). Neutron star: very short, high-frequency, tick-like pulses + enormous sub. Black hole: near-silent except sub-bass and the "reversed" swells.

### 5.3 Sound effects list per event

Names are the proposed **event IDs** for the interface contract (§6.4). "Layer recipe" is a starting point for the sound designer, not a spec.

| Event ID | When | Character | Layer recipe (synth) |
|---|---|---|---|
| `ui.click`, `ui.hover`, `ui.confirm`, `ui.back`, `ui.error` | Menu interactions | Clean, short, sci-fi blips; non-diegetic | Sine/triangle 600-2000 Hz, 30-90 ms, fast attack, light delay |
| `ui.open` / `ui.close` (panels) | Sliding sci-fi panels | Soft sweep | Filtered noise sweep + sine |
| `ui.choice.select` / `ui.choice.confirm` | Milestone choice cards | Warm chord + a "lock" tick | 2-3 sine partials, a click |
| `ui.stagebanner` | Stage name appears | Short rising arpeggio + soft pad swell | Sine chord with a slow attack |
| `ui.warning` | Threat close / low health | Pulsing low tone (felt) | 80-120 Hz sine with a tremolo; **no siren** (keep it relaxing) |
| `ui.region.void` | Entering a void / beacon ping | Sonar-like ping with long delay | Sine ping 900 Hz, feedback delay |
| `ship.thrust` (continuous) | Accelerating | A **felt** rumble proportional to acceleration | Brown noise > low-pass (80-200 Hz) + a faint sub sine; level by thrust; **no hiss/roar** |
| `ship.stabilize` | Auto-brake engaged | Quiet downward sweep | Sine glide 200 > 80 Hz |
| `body.absorb.small` | Eating small prey | Soft low "thup"/gulp, pitched by the prey's size ratio | Sine thump 60-140 Hz + a short noise tick through a low-pass |
| `body.absorb.large` | Eating prey with a large mass | Deeper, longer, resonant swallow | As above + sub (30-50 Hz) + a reverb tail |
| `body.absorb.chain` | Many rapid absorbs | A rate-limited "granular chewing" texture | Grains of the small absorb at varying pitch |
| `body.tidal` | Roche disruption stream (prey is shredded) | Stretching, groaning tone that rises in pitch then breaks into grains | A glide up with a band-pass resonance, then noise granules |
| `body.impact.light` | Bounce / small hit | Dull thud felt through the body | Low-pass noise burst + 80 Hz sine, 100-150 ms |
| `body.impact.heavy` | Damage hit by a threat | Heavy crunch/crack + sub boom | Noise burst (band-pass 200-1500) + 40-60 Hz sine drop + a short convolution tail |
| `body.impact.fragmentation` | Debris generation | A burst of tiny ticks that scatter in pan | 10-30 filtered noise grains, random pan, over 0.3-1 s |
| `hit.invuln.end` | Invulnerability ends | Tiny cue | A soft tick |
| `health.low` | Health below a threshold | Slow heartbeat-like low pulse | 50 Hz thump, 1 Hz |
| `health.regen` | Regeneration | Gentle rising pad | Sine rise |
| `evolve.start` | Stage change begins | The existing "inhale": a downward filter sweep, a hush | Master low-pass closing over 0.4 s; a reversed swell |
| `evolve.flash` | The flash ring | A big bright swell + a sub hit | White-noise swell + 40 Hz sine + a chord |
| `evolve.complete` | Morph complete | A warm resolve chord in the new stage's key | Sine/triangle chord, long reverb |
| `evolve.final` | Reaching the black hole | The long, reversed-bell crescendo (existing direction) | Reversed noise swell + sub drone |
| `gravity.well` (continuous) | Near a heavier body | A tone whose **pitch and level rise as the potential deepens** | Sine 40-200 Hz + a detuned layer, filtered; level by 1/r |
| `orbit.acquired` | A bound orbit is established | A soft lock-in chime | Two sine tones, a fifth apart |
| `orbit.slingshot` | A gravity assist gives speed | A rising whoosh *as a felt sweep*, not a whoosh in vacuum | A band-passed noise sweep, low level, plus a rising sine |
| `atmosphere.enter` / `atmosphere.exit` | Entering/leaving an atmosphere (the **only** time air-sound is realistic) | Air hiss/rumble fade-in or out | Pink noise > band-pass, level by air density |
| `atmosphere.entry.burn` | Re-entry glow (R6) | Crackling roar | Noise + crackle grains + a low rumble |
| `star.proximity` (continuous) | Close to a star | Warm, slowly modulated drone | Detuned saw pair > low-pass, slow LFO; level by proximity |
| `star.flare` | A stellar flare | A brief rising swell | Filtered noise rise |
| `pulsar.pulse` (rhythmic) | Pulsar beam passes | A tick at the pulsar rate (sensor sonification) | A 2-5 ms click, a band-passed ping |
| `blackhole.proximity` (continuous) | Near a black hole | A sub-bass drone that **slows and drops in pitch** as you approach (time dilation flavour) | 25-45 Hz sine + LFO; the pitch falls with proximity |
| `blackhole.feed` / `tde.flare` | The hole eats a star | A huge deep swell, a high shimmering overtone | Sub + noise swell + a shimmering tone |
| `death.start` | Fatal hit | A soft collapse: everything low-passes, a deep boom | Filter close + sub boom |
| `death.end` / `ending.*` | Ending screens | Quiet tonal resolve, per ending flavour | A pad; **Event Horizon** uses a falling tone |
| `ambient.stage[0..11]` | Background bed | One continuous bed per stage; cross-fade at evolve | Pads + a sparse generative melody; mass-dependent pitch |
| `music.stinger.*` | Milestone moments | Short musical stingers | Chords |

**Mix rules.** Master limiter; SFX bus (felt) is low-passed by default and **opens up slightly with the player's "scale" to feel bigger**; UI bus is dry and bright; music below the SFX (about -12 dB); sidechain-style ducking of ambience on big events (simple gain automation). **Silent default start** until the user interacts; remember the volume. [A]

---

## 6. Plan of attack

### 6.1 Principles

- **Interfaces first.** The first deliverable is a small `docs/interfaces.md` (written by the lead/engine agent) that freezes the contracts in §6.4, so streams can build against **stubs** (the repo already uses `src/dev-stubs.js` for the same purpose).
- **Strict file ownership**, no two agents edit the same file. Shared documents are append-only in their own section files.
- **Always runnable.** Keep the current 2D build running until the 3D build passes a smoke test; the engine stream flips a `?renderer=3d` flag, then makes it default.
- **Legacy compatibility.** Existing `state` fields and module exports keep working during migration; new fields are additive.

### 6.2 Workstreams and file ownership

| # | Workstream | Agent / model | Owns (exclusive write) | Reads / consumes |
|---|---|---|---|---|
| **W1** | **Creative direction (3D visual style)** | Creative director (**Opus**) | `docs/visual-direction-3d.md`, `src/data/looks.js` (data only: per-stage/per-body-class palettes, albedo ranges, temperature tables, bloom/exposure presets, camera presets) | This research doc (R1-R10 are binding), `docs/creative-direction.md` |
| **W2** | **Engine and 3D renderer** | Engine/3D agent | `index.html` (importmap), `vendor/three/`, `src/main.js`, `src/gfx/**` (renderer, camera, post, shaders, instancing, LOD, lite-mode fallback to the 2D renderer), `src/camera.js` (replaced/wrapped), `docs/engine-notes.md` (rendering section) | `looks.js`, state/snapshot contract, universe query contract |
| **W3** | **Procedural universe** | Universe agent | `src/universe/**` (hash, PRNG, cells, levels, systems, density, region queries, cache, deltas), `tests/universe.test.mjs` | `src/stages.js` (read only), physics units |
| **W4** | **Physics and gameplay** | Physics agent | `src/sim/**` (gravity, rails/Kepler, collisions, absorb, tidal disruption, debris), `src/physics.js`, `src/game.js`, `src/world.js` (becomes a thin adapter to the universe), `src/stages.js`, `tests/physics.test.mjs`, `tests/stages.test.mjs` | Universe contract, `looks.js` (read only) |
| **W5** | **UI (sci-fi HUD)** | UI designer (**Opus**) | `src/ui/**` (HUD, screens, region/beacon indicator, trajectory/readout widgets as DOM/SVG/CSS overlays), `docs/ui-direction.md` | State contract, event contract, `looks.js` palettes |
| **W6** | **Sound design** | Sound designer | `src/audio/**`, `docs/audio-direction.md`, `tests/audio.test.mjs` (pure-function parts) | Event contract, state snapshot |

**Not owned by any stream** (lead only): `package.json`, `README.md`, `docs/space-realism-research.md`, `docs/interfaces.md`, integration branch merges.

**Conflict hot-spots and rules.**
- `src/game.js` (W4) is the only place that **emits events** and **calls** UI/audio/renderer. Others expose functions; they do not reach into each other's files.
- `src/stages.js` (W4) is the single place for stage numbers; `looks.js` (W1) keys off stage `id`s only, never indices.
- `index.html` has a single owner (W2); it may include the importmap and a `<script type="module">` only. UI CSS lives in `src/ui/ui.css` (W5).

### 6.3 Dependencies and order

```
Phase 0 (lead, 0.5 day):  docs/interfaces.md  (state snapshot, events, universe API, looks schema, audio API, ui API)
                          + delete the flame/heat-rim code path (the bug) behind R1-R4 in the 2D renderer as an immediate hotfix (W2)

Phase 1 (parallel, no cross-dependency, all against stubs):
   W1 visual direction + looks.js ─────────────┐
   W2 Three.js scaffold: importmap, scene, camera B, noise lib, one body class (asteroid) ┐
   W3 universe core: hash/PRNG/cells/levels + determinism tests                          │
   W4 sim core: gravity, rails, collisions, momentum + unit tests                        │
   W5 UI: layout, HUD widgets on a mock state + demo.html                                │
   W6 audio engine: bus graph, voices, 10 core sounds + a demo page                      │

Phase 2 (integration pairs, in this order):
   W3 + W4  : world.js adapter: universe cells > sim bodies; delete the boundary; add region state
   W2 + W1  : all 12 stage looks in 3D (planets, gas, stars), post-processing, black hole shader
   W2 + W3  : instancing and LOD from the cell windows; far-field impostors; scale transitions
   W4 + W6  : event stream drives audio; W4 + W5: state drives HUD; W4 + W2: events drive VFX (impact, tidal, entry)

Phase 3 (lead): full integration, performance pass vs §4.6, playtest, balance (G, absorb efficiency, stabiliser)
Phase 4: polish (WebGPU/TSL evaluation, daily seed, hard mode)
```

Critical path: **interfaces -> (W3 and W4) -> W2 integration -> playtest**. W1, W5 and W6 are mostly off the critical path but must finish their contracts early because W2 depends on the look data and W6 and W5 depend on the event names.

### 6.4 Interface contracts (shape only; names are proposals, the lead freezes them in `docs/interfaces.md`)

**C1. Body descriptor (the universe produces it; sim, renderer and audio consume it).**
```
Body {
  id: string|number,       // stable: hash(level, cell, index)
  seed: number,            // sub-seed for visuals (uint32)
  cls: 'meteorite'|'asteroid'|'comet'|'dwarfPlanet'|'rockyPlanet'|'gasGiant'|'brownDwarf'|
       'star'|'neutronStar'|'blackHole'|'debris'|'ring',
  stageId: string,         // stage whose scale this body matches (looks.js key)
  mass, radius,            // game units (radius = f(mass) per stages.js)
  pos:[x,y,z], vel:[x,y,z] // float64, universe units; y is presentation depth only
  spin:{axis:[x,y,z], rate},
  parentId?: id, orbit?: {a, e, phase, incl},   // rail bodies
  look: { albedo, temperatureK?, atmosphere?:{density, tint}, ring?:{...}, variant, ... }
}
```
**C2. Universe API (W3).**
`createUniverse(seed, genVersion)` > `{ query(center, radius, levelRange) -> Body[], getRegion(pos) -> {density, nearestMatter:{dist, bearing}, inVoid}, consume(id), applyDeltas(deltas), exportDeltas() }`. Pure and deterministic; no globals, no `Math.random`.

**C3. Sim state and snapshot (W4 owns; extends the current `state`).**
Keep: `player, bodies, time, mass, stageIndex, flags, status, effects, health, progress, stats`. Add: `region`, `camera hint {pitch, distance}`, per-body `rel: 'prey'|'neutral'|'threat'`, `atmosphere` flags (`inAtmosphereOf`), `orbitInfo` (for HUD). Remove: `bounds`, `edge`, `edgeDoom`. The renderer treats the state as **read-only**.

**C4. Event bus (W4 emits; W2 VFX, W5 UI, W6 audio subscribe).** Replace the current `spawnEffect(state, type, x, y, opts)` with a superset: `emit(type, payload)`; types: `absorb {bodyId, mass, ratio, relSpeed}`, `impact {pos, normal, energy, relSpeed, bodyIdA, bodyIdB}`, `tidal {bodyId, progress, fragments}`, `entry {bodyId, atmosphereOf, intensity}` (R6), `evolve {from, to}`, `hit`, `death {cause: 'collision'|'captured'}`, `orbitAcquired`, `slingshot {gain}`, `regionChange {inVoid}`, `pulsarBeam {id}`. Keep the old four names working as aliases during the migration.

**C5. Looks API (W1 -> W2, W5).** `getLook(cls, stageId, seed, variantFlags) -> {palette, albedo, temperatureK, roughness, bloom, ...}` plus presets `exposure`, `camera {pitch, fov, distanceFactor}`. Data only; deterministic. Binding rule: any emissive entry carries a `cause` field from R2 (so R10 can be checked automatically).

**C6. Renderer API (W2).** Same shape as today: `init(canvas)`, `resize()`, `drawFrame(snapshot, camera, dt)`, plus `setQuality(level)`, `getStats()`; keeps the legacy 2D renderer selectable as `lite`.

**C7. Audio API (W6).** `audio.unlock()` (on a user gesture), `audio.setMaster/Music/Sfx(volume)`, `audio.event(type, payload)` (consumes C4), `audio.setContinuous({speed, thrust, mass, stageId, gravity, proximity:{star, blackHole}, inAtmosphere, health})` called each frame (smoothing is internal), `audio.setStage(stageId)`.

**C8. UI API (W5).** Existing: `showTitle`, `showChoice`, `showEnd`, `update(state)`, `warnBoundary` (deprecated). New: `setRegionStatus(region)`, `showToast(text)`, trajectory/readout widgets driven from `state`, `ui.onSettings(cb)` (volume, quality, reduced motion, readability mode).

### 6.5 Definition of done per stream

- **W1:** `visual-direction-3d.md` approved with reference sheet descriptions for all 12 stages (+ variants), the emitter table (R2) filled in per stage, `looks.js` lints against the schema.
- **W2:** all 12 stages render in 3D at 60 fps on the reference machine at medium quality; `?debug=emitters` works; the flame/heat-rim bug is gone in both the 2D and 3D renderers; scale transition has no popping.
- **W3:** determinism and no-overlap tests pass; the same seed gives identical cells after unload/reload; memory is flat in a long fly-through test (1e6 units).
- **W4:** energy/momentum conservation tests pass (within tolerance), stable orbits for 1000 simulated orbits, the Roche effect works, no boundary code remains; the balance pass restores a 13-16 min run (see `engine-notes.md`).
- **W5:** HUD works at 1280x720 and mobile widths; every HUD element reads from `state` only; keyboard accessible; `prefers-reduced-motion` honoured.
- **W6:** all events in §5.3 have a sound; peak below -1 dBFS; no clicks; polyphony capped; mute and volume persisted.

### 6.6 Risks and mitigations

| # | Risk | Likelihood / impact | Mitigation |
|---|---|---|---|
| 1 | **Scope** (everything at once) | High / High | Phase gates; the 2D fallback stays playable; ship in slices: (a) fix the fire bug + hard light, (b) 3D asteroid/planet, (c) universe, (d) the rest |
| 2 | **Readability lost in 3D** (size comparison, dark rocks R9) | High / High | Camera B, relation outlines in the UI layer, readability toggle, early playtest at Phase 2 |
| 3 | **Performance** on integrated GPUs (heavy procedural shaders + bloom) | Medium / High | LOD, impostors, dynamic resolution, quality ladder, **budget table §4.6**, measure early (W2 spike in Phase 1) |
| 4 | **Float precision and z-fighting** across scales | Medium / High | Floating origin + camera-relative rendering + reversed-Z/log depth from day one (§2.6); a fly-through stress test |
| 5 | **Determinism drift** (generator edits change all seeds) | Medium / Medium | Versioned generator, golden-file tests, fixed draw order |
| 6 | **Gravity feels bad** (spiralling, uncontrollable, boring) | Medium / High | Softening, SOI-limited, stabiliser assist, a tunable `G`, trajectory predictor, **physics feel is a playtest item**, fallback to the old arcade pull via a flag |
| 7 | **Boundary replacement makes wandering aimless** | Medium / Medium | Void beacon (B) + drift; playtest; Hard-mode starvation optional |
| 8 | **Three.js API churn / CDN dependency** | Low-Medium / Medium | Pin and **vendor** the build; keep the shader code isolated (GLSL chunks) |
| 9 | **Audio unlock / autoplay and "silent space" confusing players** | Medium / Low | Gesture unlock on the title Start; clear UI sounds; explain "sensor sonification" in the codex |
| 10 | **Merge conflicts** | Medium / Medium | Strict file ownership (§6.2), interface doc first, stubs |
| 11 | **Realism vs fun** (physically right but dull) | Medium / Medium | The rules are for **causes of glow and motion**, not for distances or speeds; keep the stabiliser, the prey pull and the tuned absorb efficiency |
| 12 | **Stage mapping choices** (Gas Planet = brown dwarf? "blue dwarf") | Low / Low | Confirm with the user (open questions) |
| 13 | **Hardware/browser coverage** (WebGL2 availability, mobile) | Low-Medium / Medium | Lite 2D mode; feature-detect; mobile gets a reduced quality ladder |
| 14 | **The facts in this document are from memory** | Medium / Low | Tags **[K]**; the creative director and physics agent should spot-check numbers they depend on |

### 6.7 Immediate hotfix (the fire bug), independent of the 3D work

Smallest change that satisfies R1-R4 in the **existing 2D renderer** (owner W2 to implement; described here, not coded): set `thruster:false` for stages 0-3 in `src/render/palette.js`; remove the leading-edge `#FFB067` heat arc; replace the thrust streaks with grey regolith motes (no additive blending, no warm colours) or nothing; remove warm additive glow from airless rocky/asteroid looks in `bodies.js` (`glowsFor`), keeping lava emission only on the lava branch (R2: hot ground). Add the R10 emitter-cause list as a comment table.

### 6.8 Decisions taken (user delegated: "use your best judgment and whatever you recommend")

The questions below were resolved by adopting the recommendation in each case. They are defaults the workstreams can build on; revisit any of them after playtest.

1. Gas Planet = brown dwarf; the "blue dwarf" branch stays as a stylised hot dwarf and is relabelled in UI text only if the creative director asks.
2. Movement is explained as "gravitational steering" (no rockets, no exhaust).
3. Camera B (angled top-down chase), with a top-down readability toggle.
4. Voids plus beacon, no wall; the Event Horizon ending means being captured by a larger black hole.
5. Importmap with a vendored, pinned Three.js; no Vite for now.
6. Quality target: mid-range integrated GPU at 60 fps; mobile gets a reduced quality ladder; 2D lite mode remains.
7. The "which game" confirmation from `docs/game-design.md` is still open and is not blocking.

### 6.9 Original open questions (for the record)

1. **Stage mapping**: is *Gas Planet* a brown dwarf/"failed star" (recommended), or an ice giant? Should *blue dwarf* stay (it is hypothetical) or be relabelled "hot dwarf"?
2. **Controls explanation**: is "gravitational steering" (no rockets) an acceptable in-fiction reason for movement?
3. **Camera**: confirm angled top-down chase (B) with a top-down toggle.
4. **Boundary**: confirm "voids + beacon, no wall; Event Horizon ending = captured by a larger black hole".
5. **Build step**: confirm importmap + vendored Three.js (no Vite) for now.
6. **Quality targets**: minimum supported hardware and whether mobile matters.
7. **Which game?** `docs/game-design.md` already asks the user to confirm *Drifter Star: Evolution* as the reference; unresolved here.

---

## Appendix A. Quick reference: numbers used above (all **[K]** unless noted)

| Quantity | Value |
|---|---|
| Sun surface temperature | 5772 K |
| Betelgeuse temperature (red supergiant) | about 3600 K |
| Rigel temperature (blue supergiant) | about 12,000 K |
| Albedo: C-type asteroid / S-type / Ceres / Moon / Earth / Jupiter | 0.03-0.10 / 0.15-0.25 / about 0.09 / about 0.12 / about 0.3 / about 0.5 |
| Earth escape speed | 11.2 km/s |
| Typical solar-system impact speeds | about 5-30 km/s |
| Fluid Roche limit | 2.44 R_M (rho_M/rho_m)^(1/3) |
| Rigid Roche limit | about 1.26 R_M (rho_M/rho_m)^(1/3) |
| Schwarzschild radius | 2GM/c^2, about 3 km per solar mass |
| Photon sphere / ISCO / shadow radius | 1.5 r_s / 3 r_s / about 2.6 r_s |
| Neutron star | about 1.1-2.2 solar masses, about 20 km diameter |
| Pulsar spin periods | about 1.4 ms to several seconds |
| Sphere of influence radius | about a (m/M)^(2/5) |
| Brown dwarf mass range | about 13 to about 80 Jupiter masses |
| Rayleigh scattering | proportional to wavelength^-4 |
