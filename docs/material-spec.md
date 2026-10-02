# Material and Shader Spec: *Vesper Drift* 3D

> Owner: Creative Director. Consumer: ENG (`src/render3d/glsl/**`). Contract: `docs/interfaces.md` §2.4 and §8. The look intent is in `docs/art-bible.md`. **Every numeric default lives in `src/data/looks.js`**. This file names the parameters and gives the formulas. The GLSL below is recipe-level pseudo-code for a shader author, not engine code. WebGL2 / GLSL ES 3.00, kept as isolated string modules so a later TSL port is possible.

---

## 1. Inputs

### 1.1 Global uniforms (one set per frame)

| Uniform | Type | Source | Meaning |
|---|---|---|---|
| `uTime` | float | ENG clock (game time × stage `timeScale` for visual motion) | Animation |
| `uKeyDir` | vec3 | `state.key.dir` (normalised, world, pointing **from the surface toward the light**) | The single hard light (L1) |
| `uKeyColor` | vec3 | `kelvinToRgb(state.key.temperatureK)`, converted to linear | |
| `uKeyIntensity` | float | `state.key.intensity` (fallback `PRESETS.stages[id].keyIntensity`) | |
| `uAmbient` | vec3 | `PRESETS.stages[id].ambient` (linear) × `ambientIntensity` × `uKeyIntensity` | Cool fill (L2) |
| `uCameraPos` | vec3 | Camera-relative, so usually near 0 | |
| `uBloomThreshold` | float | `PRESETS.bloom.threshold` | For the specular clamp (L9) |
| `uReducedMotion` | float | 0/1 | Freezes twinkle, grain and flow noise |

### 1.2 Per-body inputs (instanced attributes or per-draw uniforms)

| Name | Type | Source |
|---|---|---|
| `iSeed` | float | `fract(body.seed / 4294967296.0) * 1000.0`. A noise-domain offset; every noise call adds `iSeed * vec3(1.0, 1.7, 2.3)` |
| `iRadius` | float | `body.radius` |
| `iSpin` | vec4 | Quaternion from `body.spin.axis` and `phase` |
| `iBase`, `iAccent`, `iShadow` | vec3 | `look.palette.*` in linear |
| `iAlbedo` | vec2 | `look.albedo` |
| `iRough`, `iMetal` | float | `look.roughness`, `look.metalness` |
| `iCraters` | vec2 | (`density`, `sizeExp`) or (0, 0) |
| `iBands` | vec2 | (`count`, `warp`) or (0, 0) |
| `iEmission` | vec4 | linear `kelvinToRgb(temperatureK)` and `intensity`. **Zero unless the gate in §1.3 passes** |
| `iAtm` | vec4 | tint (rgb) and `thickness` (`mie` as a separate uniform) |
| `iDisrupt` | vec4 | `body.disrupt.axis` and `stretch` (vertex stretch, §4.11) |

Class-specific `extras.*` go into per-class uniform blocks; the names follow the key paths, e.g. `uExtras_granulation_cellsPerRadius`.

### 1.3 The emission gate (R2/R10)

```
emissionOn = (cls in {star, neutronStar, blackHole})
          || (body.emissive != null && body.emissive.cause == look.emission.cause)
emissionScale = emissionOn ? (body.emissive ? body.emissive.intensity : 1.0) : 0.0
```
Brown dwarfs and lava planets glow only when SIM sets `emissive`. The `?debug=emitters` overlay lists every element where `emissionScale > 0`, with its cause.

---

## 2. Noise library (`glsl/noise.glsl`)

All noise is 3D, evaluated on the **unit-sphere object-space position** `p` (rotated by `iSpin`), so it never stretches at the poles and needs no textures.

| Function | Recipe | Use |
|---|---|---|
| `hash31(vec3)`, `hash33(vec3)` | PCG3D or Dave Hoskins' `hash33` (no `sin`, for precision on mobile) | Everything |
| `vnoise(vec3)` | Value noise, quintic fade | Cheap LOD-1 fBm, sky |
| `snoise(vec3)` | Simplex (Ashima/Gustavson), with an analytic-gradient variant `snoiseGrad(p, out vec3 g)` | Main surfaces; gradients for normals |
| `fbm(p, oct, lac=2.0, gain=0.5)` | Σ gain^i · snoise(p·lac^i) | Terrain, clouds, nebula |
| `ridged(p, oct)` | Σ w·(1-|snoise|)², weighted by the previous octave (Musgrave) | Mountains, filaments, fractures |
| `billow(p, oct)` | Σ |snoise| | Puffy clouds, convection |
| `warp(p, amt)` | `p + amt * vec3(fbm(p+a), fbm(p+b), fbm(p+c))`, two levels for the nebula (Quilez) | Bands, clouds, nebula, gas |
| `worley(p) -> vec2(F1, F2)` and cell id | 3×3×3 cell search, jittered feature points from `hash33` | Craters, granulation, cracks, plains |
| `curlish(p)` | Swirl the domain about a centre: rotate `p` around axis `c` by angle `k·exp(-d²/σ²)` | Gas giant storms |

**Octave budget per LOD** (see §9): LOD-3 up to 6 octaves, LOD-2 up to 3, LOD-1 1-2, LOD-0 none.

---

## 3. Shared lighting (`glsl/light.glsl`)

```glsl
// mu0 = dot(N, L), mu = dot(N, V), both clamped >= 0
float lommelSeeliger(float mu0, float mu) { return mu0 / max(mu0 + mu, 1e-4); }
vec3 litAirless(vec3 albedoRGB, vec3 N, vec3 L, vec3 V, float lambertMix, float opp, float oppW) {
  float mu0 = max(dot(N,L),0.), mu = max(dot(N,V),0.);
  float ls = 2.0 * lommelSeeliger(mu0, mu);            // x2 so a full disc matches Lambert energy
  float brdf = mix(ls, mu0, lambertMix);
  float phase = acos(clamp(dot(L, V), -1., 1.));       // 0 = sun behind the camera
  float surge = 1.0 + opp * exp(-phase / oppW);        // opposition surge (L5)
  return albedoRGB * brdf * surge;                     // NO wrap term: hard terminator (L3)
}
float wrapLambert(float ndl, float w) { return max((ndl + w) / (1.0 + w), 0.0); }   // atmospheric bodies only
vec3 blackbody(float K) { /* same Tanner Helland fit as looks.js kelvinToRgb, then sRGB->linear */ }
float limbDark(float mu, float u) { return 1.0 - u * (1.0 - mu); }
```
- Final colour for lit bodies: `radiance = lit * uKeyColor * uKeyIntensity + albedoRGB * uAmbient + emission`.
- **Specular clamp (L9):** for any `cls` with `emissionScale == 0`, use `spec = min(spec, 0.95 * uBloomThreshold - diffuse)`.
- Albedo from palette: `albedoRGB = palette * mix(iAlbedo.x, iAlbedo.y, t) / luminance(palette)`, where `t` is the per-pixel variation (regolith, slope, ice). This keeps the **physical albedo** independent of how saturated the hex colour is.

---

## 4. Per-class recipes

### 4.1 Rocks: `meteorite`, `asteroid`, `debris`, `fragment`, comet nucleus

**Mesh:** a shared icosphere (detail 4 for LOD-3, 3 for LOD-2, 2 for LOD-1), instanced. Use 3-4 base variants for silhouette variety.

**Vertex displacement (shape):**
```
q = p * extras.shape.axes                          // ellipsoid (a, b, c)
if waist > 0:  q.x *= 1.0 - waist * exp(-(p.x*p.x) / 0.08)   // peanut / contact binary neck
h  = extras.shape.lumpAmp * mix(fbm(p*lumpFreq + seed, 4), ridged(p*lumpFreq + seed, 4), shape.ridge)
h += equatorRidge * exp(-(p.y*p.y)/0.01)           // spinning-top ridge (Bennu/Ryugu)
h += craterHeight(p) * craterProfile.depth          // §4.1.1, the large crater layer only in the vertex stage
h += boulders * 0.04 * smoothstep(0.85, 1.0, 1.0 - worley(p*9.0).x)   // rubble piles
pos = normalize(q) * length(q) * (1.0 + h)
```
**Normals:** finite differences of `h` in the vertex shader for LOD-2/3, plus per-fragment bump from small craters and grain.

#### 4.1.1 Craters (power-law sizes)

Use `craterProfile.layers` Worley layers. Layer `i` has frequency `f_i = f0 · 2^i` (f0 = 2.5) and covers cells of size about 1/f_i. A cell holds a crater with probability
```
p_i = craters.density * 2^( i * (craters.sizeExp - 2.0) )
```
so that, with cells per area growing as 4^i, the cumulative count follows **N(>D) ∝ D^-sizeExp** (sizeExp 2 = constant fill per layer). Crater radius `r = 0.35..0.5 / f_i` (jittered by the cell hash), age `a = hash` (old craters are shallower and softer).

Profile, with `d = dist(p, centre) / r`:
```
cavity = d*d - 1.0
rimX   = min(d - 1.0 - rimWidth, 0.0)
rim    = rimHeight * rimX * rimX / (rimWidth*rimWidth)
shape  = smax(cavity, floor, smooth)
shape  = smin(shape, rim, smooth)                    // polynomial smin/smax
shape *= mix(1.0, 0.35, age)                          // erosion
ejecta = craterProfile.ejecta * exp(-(d-1.0)*3.0) * step(1.0, d) * (1.0 - age)   // brighter blanket around fresh craters
```
`craterHeight(p) = Σ_layers shape · r` (depth scales with size). The largest layer is displaced in the vertex stage; the smaller layers are bump-only.

#### 4.1.2 Albedo
```
t  = 0.5 + 0.5 * fbm(p*3.0 + seed, 3)                // broad mottling
t += regolith.slopeBrighten * (1.0 - dot(Nsurf, Nsphere))   // steep, fresh slopes are brighter
t += ejecta                                            // fresh crater blankets and rays
col = mix(palette.base, regolith.fresh, ...) ; mix toward palette.extra[0] for dark patches
grain: normal perturbation from vnoise(p*regolith.grainScale) * regolith.grainAmp (LOD-3 only)
```
- `fusionCrust` (meteorites): blend toward near-black `#141312` with roughness 0.6 over that fraction of the surface (the leading hemisphere).
- `regmaglypts` (iron): shallow Worley dimples `depth * (1 - F1)` at `scale`.
- `icePatches` (comets): where `fbm > 1 - coverage`, use `icePatches.color` with albedo `icePatches.albedo`.

**Lighting:** `litAirless` with `extras.lighting`. Tumble: rotate by `body.spin`, plus a visual wobble `extras.tumble.wobble` around a second axis that precesses at `precession` (two incommensurate rates).

#### 4.1.3 Comet coma and tails (`extras.coma`, only when `body.coma > 0`)
- **Coma:** a camera-facing soft sphere of radius `coma.size × radius`, density `exp(-r²)`, **lit** by the key (`dustTint × keyColor × keyIntensity × 0.15 × body.coma`). It stays below the bloom threshold.
- **Dust tail:** a curved ribbon of particles along `-v` bent toward the anti-sun direction by `dustCurve`, length `dustTailLength × radius`, `dustTint`, lit, fading with distance.
- **Ion tail:** a straight, thin ribbon exactly anti-sun (`-uKeyDir`), length `ionTailLength`, `ionTint` at low intensity × `body.coma` (≤ 0.6 radiance). Treated as lit/fluorescent, not as an emitter.

#### 4.1.4 Fragments (`extras.hotDebris`)
While `emissive.cause == 'hot-debris'`: `T(t) = startK · (1 - t/coolSeconds)^0.7`. Emission = `blackbody(T) · intensity · emissive.intensity` while `T > 800`. After that the fragment is plain lit rock.

### 4.2 `dwarfPlanet`

Sphere mesh (round body). Displacement `extras.displacement.amp` with fBm of `octaves`. Craters as in 4.1.1 with `craterProfile`. Variant features:

| `extras` key | Recipe |
|---|---|
| `saltSpots {count,size,color,albedo}` | `count` hashed centres; bright disc `smoothstep(size, size*0.5, dist)` inside a crater floor |
| `plains {coverage,color,cellScale,smooth}` | Smooth regions where `fbm(p*1.2) > 1-coverage`: suppress craters (× (1-smooth)), add faint Worley polygon cells at `cellScale` (Sputnik Planitia), colour `color` |
| `iceCaps {lat,color,noise}` | `cap = smoothstep(lat, lat+0.08, abs(p.y) + noise*fbm(p*4))`; mix to `color` with albedo near `iAlbedo.y` |
| `fractures {scale,width,color}` | `ridged` lines from Worley `F2-F1 < width` at `scale`; darker `color` |
| `rays {count,brightness}` | For `count` young craters: `brightness * pow(max(0, cos(angle*k)), 8) * exp(-d/0.6)` streaks |
| `basins {count,size,depth}` | Large shallow depressions using the crater profile at `size` |
| `shadowTint` | Ice variant: tint the shadow-side ambient toward this blue (sky-lit ice) |
| `hazeLayers` | Tholin variant: the atmosphere shell (§5) with `hazeLayers` stacked thin bands in the limb |
| `subsurface` | Ice: soften the terminator by `subsurface × 0.1` (allowed: it is lit, not emitted) |

### 4.3 `rockyPlanet`

**Terrestrial:**
```
h = fbm(p*1.4 + seed, heightOctaves) + mountainRidge * ridged(p*3.0 + seed, 4) * smoothstep(seaLevel, seaLevel+0.15, h0)
ocean   = h < seaLevel
oceanCol= mix(ocean.deep, ocean.shallow, smoothstep(seaLevel-0.08, seaLevel, h))
landCol = biome(h, lat): low -> mid -> high, desert where (moisture fbm < 0.35 && |lat| < 0.35)
iceCaps: as 4.2
spec    = ocean ? GGX(ocean.roughness) * ocean.specular : 0      // sun glint, clamped (L9)
clouds  = smoothstep(1-coverage, 1-coverage+0.15, fbm(warp(p*clouds.scale + uTime*clouds.speed, clouds.warp), 5))
cloud shadow: sample the cloud mask at p + uKeyDir*0.02 and darken the ground by clouds.shadow
```
Bump from `h` on land only. Light: `wrapLambert` with `extras.lighting.wrap`. The atmosphere shell is drawn on top (§5). **No city lights**: they have no allowed cause.

**Lava:**
```
crust   = palette.base mottled by fbm; albedo low
w       = worley(p*cracks.scale + seed + flow(uTime*cracks.flowSpeed))
crackD  = (w.y - w.x)                                  // F2-F1: 0 on the cell edges
heat    = pow(clamp(1.0 - crackD / cracks.width, 0., 1.), cracks.falloff)
melt    = smoothstep(meltSeas.level, meltSeas.level-0.05, h) * (1 - crustNoise*fbm(p*12))
T       = mix(800.0, cracks.tempK, heat)  or  meltSeas.tempK in melt areas
emission= blackbody(T) * look.emission.intensity * max(heat, melt) * emissionScale
dayK    = mix(1.0, daySideEmissionScale, smoothstep(0.0, 0.3, dot(N, uKeyDir)))
radiance= lit + emission * dayK                        // emission dominates on the night side (R2)
```
**Metallic:** `iMetal` 0.85, GGX with `iRough`; `fractures` as ridged dark lines; `scarps` as long arcs (great-circle bands with a step in height); `anisotropy` stretches the highlight along latitude. Clamp specular (L9).

**Desert** (Mars): craters, `canyons` (a ridged inverse groove at `scale`), `iceCaps`, a thin butterscotch shell. **Barren** (Mercury): heavy craters and `rays`. **Venusian:** no surface. Full `clouds` (coverage 1) with `bands` and `chevrons` (a V-warp on latitude), and a thick shell.

### 4.4 `gasGiant`

```
lat   = p.y                                           // after spin
lon   = atan(p.z, p.x)
drift = uTime * flowSpeed * (1.0 - 0.6 * lat*lat)     // differential rotation
q     = rotateY(p, drift)
q     = storms(q)                                     // curlish() at each storm centre (count, size); greatSpot = the largest
b     = lat * bands.count * 0.5 + bands.warp * fbm(q*vec3(2.0, 6.0, 2.0) + bandSeed, 5)
zone  = 0.5 + 0.5 * sin(b * PI)                       // zones (light) vs belts (dark)
edge  = abs(cos(b * PI))                              // band boundaries
turb  = shear * edge * fbm(warp(q*8.0, turbulence), 4) // shear eddies at the boundaries
col   = ramp(palette: shadow, extra[0..], base, accent; zone + turb)
col   = mix(col, spotColor, spotMask)
col  *= 1.0 - polarDarken * smoothstep(0.6, 1.0, abs(lat))
limb  = limbDark(mu, limbDarkening)                   // gas bodies darken softly at the limb
```
- Ringed: `polarHexagon` adds a hexagonal band at |lat| ≈ 0.85 (the angle snapped to 6 sectors). Ice: `brightClouds` are thin bright streaks (ridged noise, high frequency in longitude).
- Light: `wrapLambert(ndl, wrap)` × limb, plus the atmosphere shell (§5) with `look.atmosphere`.

**Rings** (`extras.ring`, geometry from `body.ring`; draw only if `body.ring != null`, or if `ringVisibleByDefault` and SIM leaves geometry to ENG):
- A flat annulus mesh in the body's equatorial plane, from `inner` to `outer` × radius.
- Radial density: `x = (r - inner)/(outer - inner)`; `dens = opacity * (0.6 + 0.4*fbm1D(x*40 + seed))`. Add `gaps` thin gaps at hashed `x` (width 0.01-0.02) and the **Cassini division** at `cassini` (width 0.03). `grain` adds fine 1D striation.
- Colour: a ramp across `colors` by `x`.
- Lighting: `lit = dens * colour * keyColor * keyIntensity * (0.25 + forwardScatter * HG(dot(V, L), 0.6))`, so rings brighten when back-lit.
- **Planet shadow on the ring:** ray from the ring point toward `uKeyDir` hits the sphere → multiply by 0.05.
- **Ring shadow on the planet:** in the planet shader, intersect the ray from the surface point toward the light with the ring plane, look up `dens`, and darken by `1 - dens*0.8`.

### 4.5 `brownDwarf`
The gas-giant recipe with its own palette, plus emission:
```
emission = blackbody(T) * intensity * emissionScale * (0.6 + emissionPattern.beltBoost * (1.0 - zone)) * mix(1.0, limbDark(mu, 1.0), emissionPattern.limbFade)
```
Belts (deeper and hotter) leak more glow. The intensity stays far below the bloom threshold (art-bible, stage 5).

### 4.6 `star`
```
mu    = dot(N, V)
q     = p * granulation.cellsPerRadius
t     = uTime * granulation.flowSpeed
w     = worley(q + vec3(0, 0, t)) ; w2 = worley(q*2.1 + 3.7 - t)          // two octaves: granules + sub-granules
lane  = smoothstep(0.0, granulation.laneWidth, w.y - w.x)                 // dark intergranular lanes
cell  = 1.0 - granulation.contrast * (1.0 - lane) - 0.35*granulation.contrast*(1.0 - smoothstep(0.,0.1,w2.y-w2.x))
cell *= 1.0 + granulation.superGranulation * (fbm(p*3.0 + t*0.2, 3) - 0.5)
spot  = fbm(p*spots.scale + seed, 4) ; spotMask = smoothstep(1-spots.coverage, 1-spots.coverage*0.5, spot)
Tloc  = T * mix(1.0, spots.penumbraScale, spotMask) * mix(1.0, spots.umbraScale, smoothstep(0.6, 1.0, spotMask))
Tloc *= 1.0 - limbRedden * (1.0 - mu)                                       // the limb is cooler and redder
fac   = faculae * smoothstep(0.5, 0.0, mu) * lane                           // faculae bright near the limb
I     = intensity * emissionScale * cell * limbDark(mu, limbU) * (1.0 + fac)
col   = blackbody(Tloc) * I
```
- **Giants and supergiants:** the same recipe at a low `cellsPerRadius` (few, huge, high-contrast cells), plus `pulse` scaling the radius by `1 ± amp` over `periodSeconds`.
- **Corona / glow:** a camera-facing billboard of radius `corona.size × radius`: `I = corona.intensity * intensity * pow(max(0., 1.0 - r), 3) / (1.0 + 30.0*(r-1)²)` for r ≥ 1 (radius units), coloured `blackbody(T)`. Additive. Only the inner part crosses the bloom threshold.
- **Prominences / flares:** at `flares.rate` per second, spawn an arc loop at the limb (a tube of particles along a half-ellipse of height `prominenceHeight`), coloured `blackbody(T*0.8)` at intensity 0.6, fading over 4-8 s.
- **Mass loss:** `massLoss` is a faint additive shell to `radius × massLoss.radius`, using noise density in `massLoss.color` at intensity ≤ 0.3, slowly expanding.
- No diffraction spikes on gameplay stars.

### 4.7 `neutronStar`
- **Core:** a small sphere, `blackbody(min(T, 40000))` × `intensity` (40). It is always far over the threshold, so the bloom does the rest.
- **Halo:** a billboard of radius `halo.size × radius`, falling off as `1/(1+(r/0.15)²)`, colour `halo.color`, intensity `halo.intensity`.
- **Beams** (cause `pulsar-beam`): the magnetic axis `m` = the spin axis tilted by `beam.tiltDeg`, rotated by `spin.phase`. Two cones along ±m, length `beam.length × radius`. Cross-section `exp(-(θ/halfAngle)²)`, along-length `pow(1 - s, 1.5)`, with scrolling noise `vnoise(vec3(s*8 - uTime*noiseScroll, θ*20, 0))`. Colour `core` → `color` from the centre outward. Additive. Beam brightness follows `body.beam` from SIM when present.
- **Magnetosphere:** a fresnel rim on a sphere 1.6× the radius at intensity `sheen` (≤ 0.3).
- **Wind nebula:** a soft billboard of radius `windNebula.size`, two-colour filament noise at `intensity` (≤ 0.3).

### 4.8 `blackHole`
A **screen-aligned quad** sized to `max(disc.outer, lensing.haloRadius) × radius` (capped at `lensing.maxScreenFraction` of the screen), drawn after the opaque bodies and sampling the already-rendered **sky plus background colour buffer** (a copy of the HDR target before the hole is drawn).

**Lensing (a thin-lens Schwarzschild approximation):**
```
b      = |uv - centre| in units of radius          // impact parameter
rE     = lensing.einsteinRadius * (1.0 + captureBoost)
beta   = b - rE*rE / b                             // source-plane radius
srcUV  = centre + dir * beta                       // beta < 0 => the opposite side (secondary image)
mag    = clamp(abs(b / beta) * 0.5, 0.0, 4.0)      // brightness magnification
col    = sample(srcUV) * mix(1.0, mag, 0.5)
halo   = 1.0 - lensing.haloDarken * smoothstep(lensing.haloRadius, 1.0, b)   // dark halo around the shadow (ref #4)
col   *= halo ;  stars stretch tangentially by starStretch (sample along the tangent)
if b < 1.0: col = 0                                 // the shadow
```
**Photon ring (always on):** `I = photonRing.intensity * exp(-((b - photonRing.radius)/photonRing.width)²)`, colour `blackbody(photonRing.temperatureK)`, with a slight brightening on the approaching side (`× (1 + 0.3*doppler*cosφ)`). This is the "thin hot rim".

**Accretion disc** (`feed = smoothstep(0, 1, body.feeding)`):
```
opacity  = mix(disc.idleOpacity, disc.feedOpacity, feed)
Ibase    = mix(disc.idleIntensity, disc.feedIntensity, feed)
// project onto the disc plane (equatorial plane, tilted to the camera); r in units of radius
T(r)     = innerTempK * pow(r/inner, -tempExponent) * pow(max(1 - sqrt(inner/r), 0.), 0.25) / norm   // Shakura-Sunyaev
T(r)     = max(T(r), outerTempK) for r <= outer
beta     = disc.doppler * sqrt(inner / r) ; cosφ = dot(orbitTangent, -viewDir)
g        = 1.0 / (gamma(beta) * (1.0 - beta * cosφ))
Tobs     = T * g ; I = Ibase * pow(g, dopplerPower) * turbulenceNoise(r, φ - uTime*flowSpeed/r^1.5, spiralArms)
// lensed far side: for pixels above the shadow (screen space), also add the disc sampled at the mirrored
// position (φ + π), compressed toward the photon ring, × 0.6  ("Interstellar arch")
```
**Jets** (cause `jet`, only while `body.feeding > 0` and `emissive` allows it): two cones along the spin axis, length `jet.length`, `halfAngleDeg`, `knots` bright bands that scroll at `scrollSpeed`, colour `core` → `color`, intensity `jet.intensity × feed`.

### 4.9 `comet`
Nucleus as 4.1 (`rockType: 'icy'`), plus the coma and tails (4.1.3).

### 4.10 `debris`
4.1 at LOD-1/2 only. It never gets the `hot-debris` ramp (not allowed for `debris`). Event ejecta are VFX particles (§8), not bodies.

### 4.11 Roche stretch (any class, `body.state == 'disrupting'`)
In the vertex stage: `a = iDisrupt.xyz`, `s = 1 + (stretchMax-1) * body.disrupt.progress`. Scale the position along `a` by `s` and across it by `1/sqrt(s)` (volume preserving). Add a crack mask from `worley(p*6)`, where `F2-F1 < 0.05*progress` becomes transparent (discard). Fragments take over as particles (§8).

---

## 5. Atmosphere shell (`glsl/atmosphere.glsl`)

A second sphere of radius `R(1 + shellHeight)`, with `shellHeight = body.atmosphere.shellHeight` (fallback 0.025 for terrestrial, 0.06 for gas, 0.012 for desert). Back-faces culled, additive blending over the planet, depth test on.

```
// ray from the camera through the fragment; chord length through the shell, minus the planet occlusion
L_chord = chordLength(rayO, rayD, Rshell) - chordLength(rayO, rayD, R) (if the planet is hit, stop at the planet)
tau     = atmosphere.thickness * L_chord / (R * shellHeight * 2.0)          // normalised optical depth
cosT    = dot(rayD, uKeyDir)
rayleigh= 3.0/(16.0*PI) * (1.0 + cosT*cosT)
mie     = HG(cosT, atmosphere.mie)                                         // Henyey-Greenstein
sunlit  = smoothstep(-0.25, 0.35, dot(normalize(pShell), uKeyDir))        // twilight wrap: dark on the night side
col     = atmosphere.tint * (rayleigh + 0.5*mie) * (1.0 - exp(-tau)) * sunlit * uKeyColor * uKeyIntensity
```
This is **lit scattering** (a thin blue limb on the day side and a sunset-tinted terminator), never emission. Airless bodies have `atmosphere: null`, so the shell is not drawn. Gas giants use a low `thickness` with a high `mie` for a soft haze.

---

## 6. Skybox (`glsl/sky.glsl`)

A large inverted sphere or full-screen pass sampling direction `d`. Parameters come from `PRESETS.stages[stageId].sky` and `skyTint`, with seed `state.sky.seed`. Cross-fade two parameter sets during `evolve`.

```
// 1. Void gradient
g     = smoothstep(-0.2, 1.0, dot(d, nebulaAxis(seed)))
base  = mix(skyTint[0], skyTint[1] * 0.35, g)
// 2. Reflection nebula
q     = warp(warp(d*1.6 + seed, sky.warp), sky.warp*0.6)
neb   = pow(clamp(fbm(q, 6)*0.5 + 0.5, 0., 1.), 2.2) * g
fil   = ridged(q*2.5, 4) * 0.35 * neb
refl  = sky.reflection * (neb + fil) * sky.nebula * 0.35        // peak <= 0.35 radiance (never blooms)
core  = mix(refl, #8FB3D9 linear * 0.35, smoothstep(0.75, 1.0, neb))
// 3. Emission nebula (if emissionA)
e     = ridged(warp(d*3.0 + seed2, 1.2), 5) * regionMask(d, seed3)
em    = (emissionA * e + emissionB * ridged(q*4.0 + 7.1, 4) * (1.0 - e)) * 0.3 ; + filaments (stage 10) as thin ridged lines
// 4. Dust lanes
dust  = smoothstep(0.45, 0.8, fbm(warp(d*2.2 + seed4, 0.8), 5)) * sky.dustAmount
col   = (base + core + em) * (1.0 - dust) + sky.dust * dust
// 5. Galactic band
band  = exp(-pow(dot(d, bandNormal(seed))/0.18, 2.0)) * sky.galaxyBand
col  += band * (0.08 * vec3(0.8, 0.85, 1.0) + starDust(d*400.0)*0.05)
// 6. Stars: cells on the cube-mapped direction at 3 densities; per cell: hash -> exists? (starDensity),
//    magnitude m = -2.5*log10(hash^-1.6) (power law), T from a weighted table, size 0.6-2.0 px,
//    twinkle 1 + 0.03*sin(uTime*(0.3..0.6)+hash) (frozen if uReducedMotion),
//    sparkle cross for the top sparkleFraction: two thin perpendicular gaussians, <= 6 px.
//    Star radiance: faint 0.05-0.5, the brightest few 1.5-3.0 (they may bloom slightly; acceptable).
```
**Cost:** evaluate the static layers (1-5) once into a **cubemap** (512² per face at med quality, 1024² at high) when the stage or seed changes, and draw only the stars and twinkle live. This is the main performance lever for the sky.

---

## 7. LOD tiers (by on-screen radius in pixels)

| Tier | Screen radius | Mesh | Shader |
|---|---|---|---|
| **LOD-0** | < 2 px | Point sprite (far field / impostor) | Colour = `palette.base × mean albedo × key` (lit), or `blackbody` × intensity for emitters. Brightness falls off with distance. Cross-fade to LOD-1 over 2-3 px |
| **LOD-1** | 2-12 px | Icosphere detail 2 / a low sphere | Base colour + 1-2 octave fBm mottling; correct terminator; no craters, clouds or rings (rings as an alpha ellipse); stars without granulation |
| **LOD-2** | 12-60 px | Detail 3 | Large crater layer, 3 octaves, clouds, bands, granulation 1 octave, atmosphere shell |
| **LOD-3** | > 60 px (the player, near giants) | Detail 4 | Full recipe, up to 6 octaves, grain, all extras |

The player is always at least LOD-2 and is normally LOD-3. Hysteresis is ±15% on the thresholds to avoid flicker.

---

## 8. Particles and VFX shaders

All particles are pooled and instanced. Each particle has: position, velocity, birth time, life, size, type, startK.
- **Hot particles** (ejecta, energetic absorb, hot fragments, entry sparks): additive. `T = startK · (1 - age/life)^0.7`; colour `blackbody(T)`; intensity `startIntensity · (T/startK)^4` (Stefan-Boltzmann feel). When `T < minVisibleK`, switch to the lit mode below.
- **Lit particles** (dust, grit, gentle absorb, thrust motes): **normal (non-additive) blending**. Colour = `color × (0.3 + 0.7·max(dot(n_billboard, L), 0)) × keyColor × keyIntensity + ambient`. No emission, so they can never bloom.
- **Absorb shells:** particles start on `shells.count` spherical shells at `radius × (1 + i·shellSpacing)` around the prey and spiral inward along `spiralTurns` with ease-in. Size `sizePx`.
- **Roche stream:** particles move along a logarithmic spiral from the victim to the player, width `streamWidth × victim radius`. A star stream uses the hot mode at `starStreamK`.
- **Entry fireball:** a head billboard plus a tapered tail mesh oriented along `-v_rel(air)`, the head at `headK` and the tail fading to `tailK`, multiplied by the `airTint`.
- **Flash ring (evolve):** a screen-space ring of radius growing to 3 × player radius, width `widthScale`, colour `#EAF0FF`, intensity 6 → 0.

---

## 9. Performance notes

| Item | Cost guidance |
|---|---|
| Rocks | Instanced, one draw per mesh variant. Fragment cost: LOD-2 about 3 Worley + 3 fBm octaves. Keep LOD-3 to ≤ 3 bodies at a time |
| Planets / gas | 1 draw each plus 1 shell. Full recipe only at > 60 px; the 6-octave fBm and 2 warps are the most expensive part |
| Stars | 2 Worley evaluations per pixel plus the billboard. The billboard overdraw is the risk; cap the corona at 2.3 × radius |
| Black hole | One quad, ≤ 45% of the screen, one HDR copy. About 100 ALU ops per pixel plus 2 texture taps |
| Sky | Bake to a cubemap; live stars only. A re-bake on evolve can be spread over 6 frames (one face per frame) |
| Particles | ≤ 2000 live (high), 800 (med), 300 (low) |
| Quality ladder | low: LOD caps at 2, no shells on gas giants, bloom at quarter resolution, no grain. med: defaults. high: LOD-3 everywhere it applies, 1024 sky, MSAA |

---

## 10. Extras key index (what `looks.js` emits per class)

| Class | `extras` keys |
|---|---|
| meteorite / asteroid / debris / comet | `rockType`, `shape{family,axes,lumpAmp,lumpFreq,ridge,waist,equatorRidge,boulders}`, `regolith{grainScale,grainAmp,slopeBrighten,fresh}`, `craterProfile{rimHeight,rimWidth,floor,depth,smooth,ejecta,layers}`, `lighting{model,lambertMix,opposition,oppositionWidth,wrap}`, `tumble{wobble,precession}`, `fusionCrust`, optional `regmaglypts{scale,depth}`, `icePatches{coverage,color,albedo}`, `coma{dustTint,ionTint,size,dustTailLength,ionTailLength,dustCurve,litOnly}` |
| fragment | as rocks + `hotDebris{cause,startK,coolSeconds,intensity}` |
| dwarfPlanet | `variant`, `lighting`, `craterProfile`, `displacement{amp,freq,octaves}`, and per variant: `saltSpots`, `plains`, `iceCaps`, `rays`, `fractures`, `shadowTint`, `subsurface`, `basins`, `hazeLayers` |
| rockyPlanet | `variant`, `lighting`, `displacement`; terrestrial: `seaLevel`, `ocean{deep,shallow,roughness,specular}`, `land{low,mid,high,desert}`, `iceCaps`, `clouds{coverage,scale,warp,speed,color,albedo,shadow}`, `heightOctaves`, `mountainRidge`; lava: `cracks{scale,width,tempK,falloff,flowSpeed}`, `meltSeas{level,tempK,crustNoise}`, `daySideEmissionScale`; metallic: `fractures`, `scarps`, `anisotropy`; desert: `iceCaps`, `dustAlbedo`, `canyons`; barren: `rays`, `scarps`; venusian: `clouds`, `chevrons` |
| gasGiant | `variant`, `lighting`, `limbDarkening`, `bandSeed`, `shear`, `turbulence`, `storms{count,size,greatSpot,spotColor}`, `flowSpeed`, `polarDarken`, `ring{inner,outer,opacity,gaps,cassini,colors,forwardScatter,grain}`, `ringChance`, `ringVisibleByDefault`, optional `polarHexagon`, `brightClouds`, `lightning` |
| brownDwarf | `shear`, `turbulence`, `flowSpeed`, `polarDarken`, `limbDarkening`, `storms`, `emissionPattern{beltBoost,limbFade}`, `lighting` |
| star | `starClass`, `variant`, `granulation{cellsPerRadius,contrast,laneWidth,flowSpeed,octaves,superGranulation}`, `spots{coverage,umbraScale,penumbraScale,scale}`, `faculae`, `limbU`, `limbRedden`, `corona{size,intensity}`, `flares{rate,prominenceHeight}`, `massLoss{shell,radius,color}|null`, `pulse{amp,periodSeconds}|null` |
| neutronStar | `halo{size,intensity,color}`, `beam{cause,color,core,length,halfAngleDeg,intensity,tiltDeg,noiseScroll}`, `magnetosphere{sheen,color}`, `windNebula{size,intensity,colors}` |
| blackHole | `photonRing{radius,width,temperatureK,intensity,softness}`, `disc{inner,outer,innerTempK,outerTempK,tempExponent,idleOpacity,feedOpacity,idleIntensity,feedIntensity,doppler,dopplerPower,turbulence,spiralArms,flowSpeed,thickness}`, `lensing{einsteinRadius,strength,haloRadius,haloDarken,starStretch,maxScreenFraction}`, `jet{cause,color,core,length,halfAngleDeg,intensity,knots,scrollSpeed}` |

Variant ids accepted by `getLook` (aliases resolve from the `stages.js` choice ids): rocks `stony|iron|carbonaceous|silicate|metal|icy`; dwarf `ceres|snowcap|tholin|ice|scarred` (`frozen_fortress→ice`, `cradle_of_life_seed→tholin`, `war_planet→scarred`); rocky `terrestrial|lava|metallic|desert|barren|venusian`; gas `jovian|ringed|storm|ice` (`ringed_giant`, `storm_giant`, `ice_giant`); star `red|yellow|blue` (`red_dwarf`, `yellow_dwarf`, `blue_dwarf`); fragment `star` (star matter). An unknown or `null` variant gets a seed-picked default.
