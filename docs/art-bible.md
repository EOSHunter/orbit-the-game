# Art Bible: *Vesper Drift* 3D

> Owner: Creative Director. Contract: `docs/interfaces.md` v1 (§2.1 emitters, §2.4 looks, §8 CD). Physics basis: `docs/space-realism-research.md` (rules **R1-R10 are binding**). Numbers live in `src/data/looks.js`; shader recipes live in `docs/material-spec.md`. This document is the *why* and the *what*. Those two files are the *how much* and the *how*.
>
> This supersedes the 2D "Luminous Vector Dusk" style in `docs/creative-direction.md`. That doc stays as the 2D legacy reference (the lite renderer). Its relation colours, typography and music direction still apply. Its flame trail, heat rim, "player is the warmest thing" rule and flat vector rendering are **retired**.

---

## 1. Style pillars

**Style name: "Lit Realism on a Blue Nebula".** Real materials under one hard sun, set against a cool painted nebula. The game should read like a calm astrophotograph you can play.

1. **Light tells the truth.** One hard key light per scene, a sharp terminator, black shadows with only a faint cool fill. Crescents and half-lit worlds are the main "this is real" signal. Nothing is evenly lit, and nothing glows without a cause (R2).
2. **Matter has weight and grain.** Rocks are lumpy, cratered and dusty. Planets have relief, oceans, clouds and bands. Stars are *granulated* boiling surfaces, not flat discs. The look is never flat vector shapes, flat fills or outlines baked into materials.
3. **Darkness is a colour.** The void is a deep blue-black, not pure black. The nebula is cool and soft. Bright things are rare, so they matter: stars, impact flashes and the black hole's hot rim.
4. **Glow only with a cause.** Stars, remnants, lava cracks, impact flashes, cooling ejecta, accretion, jets and pulsar beams may glow. **Rocks never burn.** There is no fire, smoke or thruster flame in vacuum (R1, R4).
5. **Scale is the story.** Every stage changes the sky, the light and what fills the field. The camera keeps the player at a constant size, and the universe changes around it.
6. **Readability lives in the HUD layer.** Prey, neutral and threat are shown by thin overlay rings drawn *over* the lit scene, never by tinting or brightening materials (R9).

**Tone** (kept from the 2D direction): calm, awe-struck, slightly melancholic. Relaxing on the surface, with tension coming from scale.

---

## 2. Reference board: what to take, what not to copy

All 12 screenshots in `docs/references/` show another game (*Drifter Star: Evolution*). We study them for look and feel only. **We do not trace them or reuse their layout, icons, text, numbers or compositions.** Our art is 100% procedural and original.

| # | File | What it shows | Take | Do NOT copy |
|---|---|---|---|---|
| 1 | `193446` Meteorite | Grey lit rocks, blue wispy nebula, dense fine starfield | The **mood**: cool blue nebula with a bright cloud core and dark corners; small, *realistically lit* grey rocks with hard shadows; very fine star dust; a few bright stars with tiny 4-point sparkles | Their nebula's exact shape and placement (ours is procedural and per stage); the HUD panel placement and icons |
| 2 | `193456` Dwarf Planet (absorb) | Concentric gold spark rings around an absorb; green planet; yellow "109" | The **structure** of the absorb: particles arranged in concentric shells spiralling in | **Gold firework sparks** (reads as fire). Ours are cool lit dust or blackbody-cooling debris (§9). No yellow world-space numbers (UI owns toasts) |
| 3 | `193527` Star | Yellow, red and blue granulated stars; thin white orbit rings; a comet with a grey dust tail and a faint blue tail | **Granulated stars** with soft bloom and blackbody colour; **thin white orbit lines** around the current system; a comet with a curved dust tail and a straight blue ion tail | Their saturated pure-cyan star (ours is blackbody blue-white); their bottom hint bar and the Chinese labels |
| 4 | `193550` Black Hole | Black disc with a thin red-orange rim and a soft dark halo; small red star | The **thin hot rim** and the **dark lensing halo** around the shadow; keep the hole quiet at rest | A flat disc with no lensing. Ours bends the sky and grows a Doppler disc when feeding |
| 5 | `193613` Dwarf Star | Magenta and teal emission nebula with dark dust; red-dwarf system with orbits | The **emission nebula** palette (H-alpha magenta-red `#C8456E`, O-III teal `#3FB8B0`, dark dust lanes) used for the star-era skies; a red star with a soft bloom | The exact nebula composition and position |
| 6 | `193618` Rocky Planet | Planetary system with many orbits; absorb burst; blue and green planets | **Multiple faint concentric orbit lines**; small planets with visible day and night sides | The burst colours (see #2); their over-saturated planet colours |
| 7 | `193622` Neutron Star | Two pink-white bloomed stars, an orange mass stream, a violet pulsar with two beams, a cyan star | The **Roche/TDE stream** from a star (hot stellar matter, allowed with cause `star`); **pulsar beams** as two thin tapering cones; strong bloom on stellar cores | The pink bloom halo on every star (ours is blackbody-tinted); the green "+7466" world text |
| 8 | `193625` Star (absorb) | Granulated yellow star; butterfly-shaped spark burst; a meteor streak | Granulation scale and contrast at play size: about 20 cells across, clearly visible | Gold sparks; a streak trail in open space (a streak is only allowed during atmospheric entry, R6) |
| 9 | `193628` Dwarf Planet | Snow-capped icy worlds, red marbled world with a faint ring, irregular rocks | **Polar ice caps** on dwarf worlds; **lumpy, irregular** asteroids; thin faint rings at an angle | Ringed dwarf planets as a default (rare at most) |
| 10 | `193631` Star (target) | A bracket reticle around a targeted planet; orbit lines | The **target bracket** idea as an overlay (`PRESETS.overlay.targetBracket`) | Their exact reticle drawing; the UI panel at the bottom |
| 11 | `193635` Black Hole | Lone black hole on the nebula | The **restraint**: the black hole is a hole in the sky, with a hot thin rim and nothing more at rest | Video-player chrome |
| 12 | `193639` | Duplicate of #5 | n/a | n/a |

**The HUD in the references** sits upper left: a stage icon, the stage name, an italic mass value, a cyan progress bar on a black track, and round icon buttons. UI owns the HUD (`docs/ui-direction.md`). The art direction for it is: a sci-fi glass panel at the upper left, a cyan accent `#22D3EE` on a near-black track `#05080F`, Moon White text `#EAF0FF`, and no fire or ember imagery. UI must not copy the reference's icons or panel geometry.

---

## 3. Lighting rules (binding)

| Rule | Spec |
|---|---|
| **L1 One key** | A single hard directional key from `state.key` (`dir`, `temperatureK`, `intensity`). Colour = `kelvinToRgb(temperatureK)`. No second key and no fill lights. |
| **L2 Cool, tiny ambient** | `PRESETS.stages[id].ambient` at `ambientIntensity` 0.025-0.045 of the key. It is always blue-grey and **never warm**. |
| **L3 Hard terminator on airless bodies** | No wrap lighting (`extras.lighting.wrap = 0`). Use Lommel-Seeliger blended with Lambert (`lambertMix`) so the Moon-like flat full disc and the sharp terminator come from the BRDF, not from tricks. |
| **L4 Atmospheric bodies** | A small wrap (≤ 0.1) plus the atmosphere shell, which brightens the **twilight limb on the lit side only**. The night side stays dark. |
| **L5 Opposition surge** | Airless bodies brighten slightly when the sun is behind the camera (`opposition`, `oppositionWidth`). |
| **L6 Self-shadow and eclipses** | Normals give self-shadowing for free. Analytic sphere-sphere shadows are used only for the important pairs: a moon on a planet, a planet on its ring, a ring on its planet. Shadow maps are optional and near the player only. |
| **L7 Stars light others** | When the player is a star (stages 6-9), SIM's `state.key` points from the player to others. Other bodies show their lit side facing the player. |
| **L8 Planet-shine (optional, high quality)** | A big lit planet within 6 radii adds ≤ 0.03 of key, tinted by its `palette.base`, as a second ambient term. |
| **L9 Bloom ceiling** | `max albedo × max keyIntensity < bloom.threshold`. This is enforced by the data: 0.85 × 2.2 = 1.87 < 2.2. Specular highlights on non-emitters are clamped to 0.95 × threshold. **Lit rocks and planets never bloom.** |
| **L10 Deep space** | With no star host, use the stage's `keyColorK`/`keyIntensity` as a dim "galactic glow" key, and let auto-exposure lift toward `exposure.deepSpace`. |

---

## 4. Colour palettes

### 4.1 Core

| Role | Hex | Use |
|---|---|---|
| Void deep | `#05080F` | Darkest sky corners, HUD track |
| Void blue | `#0A1530` | Default sky between nebula clouds |
| Nebula body | `#2E5F8C` | Main reflection-nebula blue (early stages) |
| Nebula core | `#8FB3D9` | Bright cloud core (kept below the bloom threshold) |
| Dust lane | `#060B14` | Dark absorbing dust (multiplied over the nebula) |
| H-alpha | `#C8456E` | Emission nebula, star era |
| O-III | `#3FB8B0` | Emission nebula, star era |
| Ambient fill | `#1A2B42` | L2 |
| Moon White (UI text) | `#EAF0FF` | HUD |
| HUD cyan | `#22D3EE` | Progress bars, accents |
| Overlay line | `#DCE6F5` | Orbit lines, trajectory, brackets |

### 4.2 Relation (overlay only)

| State | Hex | High contrast | Treatment |
|---|---|---|---|
| Prey | `#5FF0C0` | `#7CFFD4` | Thin ring, gentle inward pulse |
| Neutral | `#A9BCD9` | `#E6EEFA` | Thin ring, steady, low alpha |
| Threat | `#FF5E73` | `#FF9F1C` | Thicker ring (2.5 px) with a slow outward pulse |

### 4.3 Materials (sRGB; the full sets are in `looks.js`)

| Family | Base | Accent | Shadow | Albedo |
|---|---|---|---|---|
| Stony meteorite | `#6E6862` | `#8C857C` | `#1C1A18` | 0.10-0.22 |
| Iron meteorite | `#6C6E72` | `#9EA2A8` | `#17181A` | 0.14-0.28, metal 0.8 |
| C-type asteroid | `#3A3734` | `#4E4A45` | `#0C0B0A` | 0.03-0.08 |
| S-type asteroid | `#7E7368` | `#A39684` | `#1E1A16` | 0.15-0.25 |
| M-type asteroid | `#76787C` | `#A7ABB2` | `#18191B` | 0.10-0.20, metal 0.7 |
| Comet nucleus | `#2E2C2B` | ice `#C9D6E2` | `#0A0A0B` | 0.03-0.06 |
| Ceres-like dwarf | `#5E5A55` | salt `#E8ECEF` | `#151413` | 0.08-0.12 |
| Pluto-like (tholin) | `#9A6F55` | N2 ice `#EDE6DC` | `#1C130F` | 0.35-0.6 |
| Eris-like ice | `#C9D3DC` | `#F4F7FA` | blue shadow `#2A3442` | 0.55-0.85 |
| Terrestrial | land `#3D6B37`, ocean `#0A2347` | cloud `#F4F6F8` | `#0A1420` | 0.06-0.8 |
| Lava | crust `#1E1A19` | cracks: blackbody 1100-1450 K | `#070606` | 0.04-0.09 |
| Metallic | `#7C8087` | `#B9BEC6` | `#121315` | 0.12-0.3, metal 0.85 |
| Jovian | `#C9A27A` | `#EFE2CC` | `#2B1C12` | 0.45-0.55 |
| Saturnian / ringed | `#D9C59A` | `#F3EAD3` | `#2E2516` | 0.45-0.55 |
| Ice giant | `#4C7FC4` | `#BFD9F2` | `#0B1A33` | 0.28-0.42 |
| Brown dwarf | `#4A1F2E` | `#8A3A4C` | `#12070C` | 0.02-0.06 + 0.55 IR glow |
| Stars | blackbody from `temperatureK` | blackbody(T × 1.25) | blackbody(T × 0.6) | n/a |
| Black hole | `#000000` | rim `#FF6A2B` | `#000000` | n/a |

**Blackbody anchors:** 1250 K `#FF5A00` (lava cracks), 3300 K `#FFBB81` (red dwarf), 5772 K `#FFF2E6` (Sun), 12000 K `#BFD3FF` (blue supergiant), 10⁶ K clamped to `#98BAFF` (neutron star). Stars are **never** pure saturated hues and never green (research §1.9).

---

## 5. Per-stage visual spec (all 12 stages)

The player and the world use the **same** generators (`getLook`). The player gets no special glow, rim or trail. It reads as "you" because it is centred, because the HUD marks it, and because of the motion. The "Field" column lists what SIM spawns; the look follows each body's `cls`.

| # | Stage (`stageId`) | Player look | Variants | Field and scale feel | Sky (`PRESETS.stages`) | Key / ambient | Glow allowed (cause) |
|---|---|---|---|---|---|---|---|
| 0 | Meteorite (`meteorite`) | A small lumpy rock, a potato or shard, metre scale. Grey-brown regolith, fine grain, a few tiny craters, fast tumble. Some carry a black glassy fusion crust | stony / iron (regmaglypt thumbprints, metallic sheen) / carbonaceous (charcoal dark) | Dense debris: dust motes, pebbles, many prey. Everything is close and twitchy | Cool blue reflection nebula with a bright core and dark corners (ref #1) | 5800 K, 2.2 / `#1B2C44` @ 0.035 | **None at rest.** `impact-flash` on hits. `ablation` only inside an atmosphere |
| 1 | Asteroid (`asteroid`) | A km-scale body: potato, peanut, spinning-top or contact binary. Clear power-law craters and brighter fresh slopes | C (dark, about 55%), S (warm grey), M (metallic) | A belt: lanes of rocks, a looming moon-sized body, a distant planet as a backdrop. Comets near stars show a coma | Same blue nebula, slightly denser dust | 5800 K, 2.2 | As stage 0. Comets: **non-emissive** dust and ion tails, lit by the key |
| 2 | Dwarf Planet (`dwarf_planet`) | The first round body. A cratered sphere with low relief | `frozen_fortress` → ice (Eris-like, blue shadows, fractures); `cradle_of_life_seed` → tholin (Pluto-like plains, red-brown tholins, thin blue haze); `war_planet` → scarred (crater-saturated, bright ejecta rays). Non-player dwarfs: ceres (salt spots), snowcap (polar ice, ref #9) | Belts and moon systems. The first gravity wells. Comets | Blue nebula, a faint galactic band begins | 5700 K, 2.15 | `impact-flash` only. Only the tholin variant has a haze limb (lit scatter, not glow) |
| 3 | Rocky Planet (`rocky_planet`) | A planet with relief, a terminator and (by variant) an atmosphere | `terrestrial`: oceans with sun-glint, continents, ice caps, scrolling clouds with shadows, thin blue limb. `lava`: dark basalt with **blackbody cracks and melt seas**, which dominate on the night side. `metallic`: bare, specular grey, fracture lines, no atmosphere. Non-player: desert (Mars), barren (Mercury), venusian (cloud-shrouded) | Sparse planetary system: moons, dwarfs, a gas giant looming | Blue nebula, wider band | 5772 K, 2.2 | Lava: `hot-ground` (1100-1450 K). `impact-flash`. Terrestrial and venusian bodies host the entry fireball for things falling in (R6) |
| 4 | Gas Giant (`gas_giant`) | Banded, domain-warped zones and belts with shear eddies at the boundaries, storms and slow differential flow. Soft haze limb | `ringed_giant` → ringed (Saturn: pale gold, wide rings with a Cassini gap and the planet's shadow on the rings); `storm_giant` → storm (high-contrast belts, big red spot, many vortices); `ice_giant` → ice (Neptune blue, a few bright cloud streaks). Non-player: jovian | Systems: star, planets, moons. Rings as scoop zones | Blue nebula with a first violet emission tint `#7A5BB0` | 5772 K, 2.15 | **None.** The haze limb is scatter |
| 5 | Gas Planet = brown dwarf (`gas_planet`) | A dark magenta-brown banded sphere that is **barely self-luminous** (deep red, below the bloom threshold) | (none) | Systems and neighbour stars. The player is now darker than the prey around it, which is a deliberate eerie beat | Blue-violet nebula `#3A4683`, violet emission `#8A4E9E` | 5400 K, 2.0 | `stellar-remnant` at 1100-1600 K, intensity 0.55 |
| 6 | Dwarf Star (`dwarf_star`) | **Granulated** sphere (22-30 cells per radius), limb darkening, a few spots, a soft corona and bloom | `red_dwarf` → red (3000-3500 K); `yellow_dwarf` → yellow (5300-5900 K); `blue_dwarf` → blue (9500-12000 K, a stylised hot dwarf) | Star neighbourhood: planets orbit **you**, with orbit lines (ref #5). Other stars as threats | **Emission nebula** arrives: H-alpha magenta and O-III teal filaments with dark dust (ref #5) | Player is the key for others; fallback 6000 K, 2.0 | `star` |
| 7 | Star (`star`) | A Sun-like granulated star (18-26 cells), sunspots, faculae near the limb, small prominences | yellow (default), red (K-type), blue (F/A-type) by seed | Binaries and multiples (ref #3); systems with orbit lines | Emission nebula, galactic band 0.4 | 6000 K, 2.2 | `star` |
| 8 | Giant Star (`giant_star`) | Bloated, cool and red-orange. **A few huge convection cells** (6-10 per radius), stronger contrast, a slow 9 s breathing pulse, and a faint mass-loss shell | red (default), yellow (K-giant), rare blue | Star cluster; stars as prey | Warmer, dustier sky: `#463F6C`, a red emission `#B8475A`, a dust-brown `#C98A5A` | 4600 K, 2.0 | `star` |
| 9 | Supergiant (`supergiant_star`) | Red (Betelgeuse: 3-6 giant cells, a mottled surface, a wide mass-loss shell) or blue (Rigel: 11000-20000 K, finer cells, blue-white) | red / blue (about 50/50 for non-players) | Stellar nursery; nebula filaments everywhere; few, huge bodies | The densest emission nebula, galactic band 0.6 | 7000 K, 2.1 | `star` |
| 10 | Neutron Star (`neutron_star`) | **Tiny**, blinding blue-white sphere with a big bloom halo, two thin **pulsar beams** tilted from the spin axis and sweeping (ref #7), a faint magnetosphere sheen, and a dim pulsar-wind nebula | (none) | Remnants, supernova filaments, other neutron stars and black holes as threats | Darker sky `#1F2E55`, **supernova-remnant filaments** (red and teal) | 8000 K, 1.6 | `stellar-remnant`, `pulsar-beam` |
| 11 | Black Hole (`black_hole`) | At rest: a **black shadow with a thin hot rim** (photon ring, about 4200 K) and a **dark lensing halo** that bends the starfield (ref #4, #11). When feeding, a Doppler-beamed **accretion disc** flares (hot blue-white inside, red outside, the approaching side brighter) and **twin jets** appear | (none) | Galaxy scale: star streams, clusters, other black holes (capture danger) | Darkest sky `#1C2B4E`, a strong galactic band, lensed star streaks | 6500 K, 1.4 | `accretion`; `jet` only while `feeding > 0` |

**Scale-feel rules**
- Early stages (0-2): many small bodies, fast tumble, quick shake. Late stages (8-11): few huge bodies, slow rotation, long eases.
- Visual rotation uses game time (research §1.4): small bodies spin fast, big bodies slowly, and **the neutron star spins fastest of all**.
- The previous stage's body type stays in the field as prey, so the world visibly contains "smaller versions of what you were."

---

## 6. Emitter table by stage (R2, contract §2.1)

| Stage | Player emits | Others in the field that may emit | Forbidden (fails review) |
|---|---|---|---|
| 0 Meteorite | nothing; `impact-flash` (event), `ablation` (only with `entry`) | stars in the backdrop; lava planets (`hot-ground`) | thruster flame, heat rim, halo, warm trail, gold sparks |
| 1 Asteroid | as 0 | comets: **no** emission (lit tails only) | as 0; glowing comet tails |
| 2 Dwarf Planet | `impact-flash` | as 1 | rim glow on airless variants |
| 3 Rocky Planet | lava: `hot-ground`; `impact-flash` | entry fireballs for bodies falling into the player's atmosphere | halo on bare rock; emissive city lights (no cause in the table) |
| 4 Gas Giant | none | lava moons | an ember-coloured rim |
| 5 Brown dwarf | `stellar-remnant` (dim) | | bright yellow-white star colours |
| 6-9 Stars | `star` | star streams from Roche events (`star`), `hot-debris` fragments | pure saturated hues, green stars, diffraction spikes on gameplay stars |
| 10 Neutron | `stellar-remnant`, `pulsar-beam` | | |
| 11 Black Hole | `accretion`; `jet` only while feeding | TDE flare on star absorb | a flat 2D ring with no lensing; jets at rest |

Event-driven VFX (allowed for any class, rendered from events only): `impact-flash`, `hot-debris` ejecta, and the `atmospheric-entry` fireball (only while `body.entry != null`).

> **Contract note for the lead:** §2.1's per-class table lists `ablation` (not `atmospheric-entry`) for meteorite, asteroid and debris, while the enum note says `atmospheric-entry` is "the only cause that may produce a fireball". `looks.js` mirrors the table exactly (`ALLOWED_CAUSES`). The fireball is tagged `atmospheric-entry` as an entry-driven VFX in `PRESETS.vfx.entry`, and `ablation` covers the body's own glow while `entry != null`. Please confirm in the next contract revision.

---

## 7. Nebula and skybox direction

The sky is the biggest single contributor to the reference look. It is procedural, seeded by `state.sky.seed`, and changes per stage through `PRESETS.stages[id].sky`.

**Layers, back to front**
1. **Void gradient:** `skyTint[0]` in the corners to `skyTint[1]` behind the nebula. Use a large, soft, off-centre radial falloff, never a uniform fill.
2. **Reflection nebula** (all stages): broad, wispy, domain-warped fBm clouds in `sky.reflection` blue, with a brighter core (ref #1) and soft ridged filaments at the edges. `sky.nebula` scales brightness. **Peak radiance ≤ 0.35**, so the nebula never blooms.
3. **Emission nebula** (stages 4-10, where `emissionA`/`emissionB` are set): filamentary ridged noise in H-alpha magenta-red and O-III teal, interleaved and **cut by dark dust** (ref #5). It occupies one region of the sky, not the whole sky. Stage 10 adds thin **supernova-remnant filaments** (`filaments`).
4. **Dust lanes:** dark, ragged absorbing clouds multiplied over layers 2-3 (`dust`, `dustAmount`), including small dark Bok-globule clumps (ref #1, lower right).
5. **Galactic band** (`galaxyBand`): a faint diagonal band of unresolved stars and dust that strengthens toward the black hole.
6. **Stars:** hashed per sky cell. Many faint, few bright (power law). Colours from blackbody 2800-30000 K, weighted to 4000-6500 K, so most are white with slight warm or cool tints. A very slow twinkle (≤ 3% amplitude, 2-4 s), disabled under reduced motion. **Sparkles:** only the brightest `sparkleFraction` (about 0.4%) get a tiny 4-point cross, ≤ 6 px, as in the references. This is allowed **only in the skybox**, never on gameplay stars.
7. **Parallax dust** (optional, med and high quality): one or two sparse layers of dim motes in front of the skybox at 0.05-0.15 parallax, which sell motion in empty space.

**Behaviour:** the sky cross-fades over 1.5 s on `evolve` (palette and density), and its pattern scrolls with very low parallax. Under capture warnings, the black hole's lensing stretches the stars around the threat.

**What NOT to do:** neon or rainbow nebulas, saturated purple everywhere, nebula brighter than lit planets, the same nebula for all 12 stages, or a photographic texture (it must be procedural; no assets).

---

## 8. Post-processing recipe

Order: **HDR half-float scene → bloom → tone map → grade → vignette → grain → output** (values in `PRESETS.post`, `PRESETS.bloom`, `PRESETS.exposure`).

| Step | Recipe | Why |
|---|---|---|
| Exposure | `toneMappingExposure` adapts between `exposure.day` (1.0, a star in view or key from a host) and `exposure.deepSpace` (1.55) over `adaptSeconds` (1.6 s), eye-like. Drive it from `hud.proximity.star` and whether `key.hostId` is null | Space next to a sun is bright; deep space is dim |
| Bloom | Thresholded mip-chain bloom: threshold **2.2** (linear), strength 0.85, radius 0.55, 5 mips, at half resolution | Only real emitters bloom: stars, flashes, hot debris, the disc. Lit rock cannot reach 2.2 (L9) |
| Tone map | **AgX** (fallback ACES Filmic) | AgX desaturates over-bright cores to white with tinted edges, which matches the bloomed star cores in the references and keeps stars from going neon |
| Grade | Slight contrast 1.04, saturation 0.95, a cool shadow tint `#0A1424` at 8%, lift to `#05080F` (no crushed pure black in the sky) | Unifies the scene into the blue palette |
| Vignette | Darkness 0.32, offset 1.05, a gentle falloff | Frames the centre (the player) and matches the darker reference corners |
| Grain | Intensity 0.035, size 1.4 px, animated, weighted toward the mid-tones (`lumaWeight` 0.6). Static under reduced motion | An astrophoto and film feel; breaks gradient banding in the nebula |
| Hit FX | Chromatic aberration 0.0025 decaying in 0.25 s, and a desaturation of 0.35 decaying in 0.4 s, on `hit` only | Feel, not physics. Off or halved under reduced motion |
| AA | MSAA on the HDR target if available, else SMAA/FXAA. DPR capped at 2 | |

Not used: lens flares, diffraction spikes on gameplay bodies, heavy chromatic aberration, motion blur by default, or a depth-of-field blur on gameplay.

---

## 9. VFX: impacts, absorb, Roche disruption and the no-fire rule

**The no-fire rule (restated for VFX):** in vacuum there are no flames, no smoke, no billowing, no buoyant plumes, no mushroom clouds and no orange "fire palette". Heat is shown only by **blackbody colour that cools over time** (white → yellow → orange → red → dark, R5). Dust and debris fly in straight ballistic lines and are lit by the key light like any other matter.

| Effect | Trigger | Look (values in `PRESETS.vfx`) |
|---|---|---|
| **Impact flash** | `hit`, `impact` | A white-hot point (7000 K, intensity 9) for 80 ms, scaled by `energy`/`strength`. A small bloom, and nothing else that glows |
| **Ejecta** | `hit`, `impact` (`ejecta` count) | Ballistic particles in a cone about the `normal` (wider when oblique). Each cools 5500 → 900 K over 0.3-2 s, then becomes **dark lit grit** that tumbles away. Small bodies lose ejecta to space; big ones pull it back |
| **Dust puff** | Any impact or bounce | A grey (`#8C8F96`) **lit, non-additive** sphere of fine dust that expands 2.2× and thins out. No buoyancy and no curling |
| **Absorb (gentle)** | `absorb` with low `relSpeed` | The prey breaks into lit dust and grit arranged in **2-4 concentric shells** that spiral in over 0.7 s (the ref #2 structure, but in cool grey-white `#B9BEC8`) plus a faint 6500 K contact flash. `chain` raises the shell count |
| **Absorb (energetic)** | `absorb` with high `relSpeed` or large `ratio` | As gentle, but the particles start as hot debris (4500 K) and cool as they fall in |
| **Roche disruption** | `roche-disruption` start → end, `body.disrupt` | The victim's mesh **stretches** along `disrupt.axis` up to 2.6× and compresses across it. It sheds `fragment` bodies into a thin **stream** that winds 1.75 turns into the player. A rock stream is lit matter; a **star stream** is emissive star plasma (`star`, 6000 → 3800 K, ref #7). When `victim: 'player'`, the player's own mesh stretches and sheds grit: a readable danger |
| **TDE flare** | `absorb` with `tde: true` (stage 11) | A 1.4 s flare at 18000 K, intensity 22; the disc goes to `feedIntensity` and the jets fire |
| **Atmospheric entry** | `atmosphere-entry` until `atmosphere-exit` | Only inside the shell: a bright head (5200 K), a short tapered tail **opposite the air-relative velocity** (2400 K), sparks, and a bow glow tinted by the host's air (`airTint`). It ends the instant the body exits the shell. The only allowed "fireball" |
| **Thrust** | `player.thrust` | Optional faint **grey regolith motes** (`#7D7F86`, non-additive, 18/s) shed opposite the thrust. Off for stage 4 and up. No flame, ever |
| **Evolve** | `evolve` | 0.4 s inhale (the world dims slightly and exposure dips), a **cool-white** flash ring `#EAF0FF` (not gold), a 0.8 s morph, a 1.5 s palette and sky cross-fade, a camera pull-back of 1.9× and a pitch swing of 14° |
| **Capture** | `capture-warning` level | Lensing of the threatening black hole strengthens by steps (`capture.lensingBoost`), the stars around it smear, and a dark vignette closes from that side |
| **Death** | `death` | Slow motion at 0.25×. Collision: the player breaks into lit fragments that drift apart. Captured: the player is stretched and redshifted into the rim |

**Ref #2/#6/#8 "gold spark fireworks" are explicitly rejected.** They read as fire and break pillar 4.

---

## 10. Camera feel

- **Angled top-down chase** (`PRESETS.camera`): pitch 58°, vertical FOV 38-42° (per stage, `stages[id].fovDeg`), distance = 54 × player radius, which keeps the player at about 26-30 px radius on a 1080 px view. A narrow FOV flattens perspective so sizes compare honestly.
- North-up and world-aligned. A critically damped follow (about 0.15 s), with look-ahead along velocity (about 10% of speed).
- **Auto-tilt:** a few degrees steeper when many threats are near, and a few degrees shallower near rings or discs to show them off. Rings and discs read best at 20-40° of tilt.
- **Top-down toggle** (`topDownPitchDeg` 90): the same scene seen straight down, for readability.
- **Shake:** trauma-based (`vfx.shake`), small (≤ 0.8% of the screen), with roll ≤ 1.2°. It is felt, not shown. Zero under reduced motion.
- **Evolve pull-back** is the signature beat: the camera eases out, the old sky slides away, and the new one fades in.
- **Composition:** keep the middle 60% of the screen free of HUD. The player sits at the centre, slightly behind the look-ahead.

---

## 11. Relation readability without breaking realism

- A dark C-type asteroid stays dark (R9). Readability comes from **overlay rings** drawn by ENG in a separate pass after tone mapping, at a screen-constant width:
  - Prey: a thin mint ring with a gentle inward pulse. Neutral: a faint steady ring. Threat: a thicker coral ring with a slow outward pulse and a gap so it does not read as a halo.
  - Rings appear only for bodies ≥ 4 px on screen and within a relevance radius, and they cross-fade over 250 ms on `rel` changes (hysteresis is SIM's).
- **Orbit lines** (`overlay.orbitLine`, ref #3/#5/#6): thin `#DCE6F5` ellipses for rail bodies of the current dominant system, fading with distance. The **trajectory** is dashed.
- **Target bracket** (ref #10 idea, our own drawing): four arc segments around `hud.nearestPrey` when the player steers toward it.
- **Readability mode:** the top-down camera, ring alpha 0.9, ring widths × 1.6.

---

## 12. Accessibility pass

| Item | Rule |
|---|---|
| Colour independence | Threat = thick ring + outward pulse + gap; prey = thin ring + inward pulse; neutral = no pulse. These cues work in greyscale |
| High contrast | `relationHighContrast` swaps threat to amber `#FF9F1C` and lifts the neutral ring |
| Contrast | HUD text `#EAF0FF` on a glass panel over `#0A1530` is ≥ 7:1. Overlay rings at alpha ≥ 0.55 over the brightest nebula core (`#8FB3D9`) still meet 3:1 for the threat colour |
| Reduced motion | `PRESETS.post.reducedMotion`: no shake, flashes at half intensity, static grain, no chromatic aberration, no sky twinkle, a slower evolve |
| Flashing | Nothing above 3 Hz. Pulsar beams that sweep faster than 3 Hz are drawn as a steady double fan at reduced intensity under reduced motion |
| Dark bodies | Never brightened. Rings and the top-down toggle carry readability |

---

## 13. Transitions between stages (per stage pair)

| From → To | Visual beat |
|---|---|
| 0 → 1 | Same rock grows craters and a shape family; the field thins out |
| 1 → 2 | The lumpy shape relaxes into a sphere during the morph (displacement amplitude eases down) |
| 2 → 3 | An atmosphere fades in for the terrestrial variant; lava cracks ignite from dark to 1250 K |
| 3 → 4 | The surface melts into bands; a ring unfolds for the ringed variant |
| 4 → 5 | The bands darken, and a dim deep-red glow comes up from inside |
| 5 → 6 | **Ignition:** granulation fades in, the temperature ramps to the variant's colour and bloom rises. The player becomes the key light |
| 6 → 9 | Size and temperature cross-fade; the granulation cells grow larger and fewer |
| 9 → 10 | **Collapse:** a brief flash, the body shrinks hard, the beams switch on, the sky darkens |
| 10 → 11 | The disc goes dark, lensing opens around the player, and the thin hot rim appears |

---

## 14. Visual QA checklist (for step C2)

1. `?debug=emitters`: every emissive element lists a cause from §6; no airless body appears.
2. At any speed, a stage 0-3 player shows **no** warm pixel that is not lava cracks, an impact flash or cooling ejecta.
3. Lit rocks and planets never bloom (check with exposure at `deepSpace`).
4. Terminators are hard on airless bodies; crescents are visible at the default pitch.
5. Stars show granulation at play size; colours match blackbody (no green, no pure cyan).
6. The black hole at rest shows a thin rim and a lensing halo; the disc and jets appear only when `feeding > 0`.
7. The sky differs per stage (blue → emission → dusty → remnant → dark), and the nebula never blooms.
8. Relation colours appear only in the overlay pass.
9. Reduced motion removes shake and twinkle and halves flashes.
10. No reference composition, icon or text is reproduced.
