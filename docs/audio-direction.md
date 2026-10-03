# Audio direction (SND)

Everything is synthesised with the Web Audio API (no asset files). Code lives in `src/audio/`.
Demo: serve the repo root (`npx serve .`) and open `/src/audio/demo.html`. Tests: `node tests/audio.test.mjs`.

## Principle
Space is silent, the game is not. Three honest categories:
1. **Felt** (player body, low-passed 20-200 Hz): thrust rumble, absorb thump, hits, tearing, near-miss sweeps. The body's resonance falls as mass grows (`resonanceHz`, 190 Hz down to 24 Hz); the SFX bus low-pass opens slightly with scale.
2. **Sensor sonification**: gravity-well tone, star bed, black-hole sub-bass (slows and falls with proximity), pulsar ticks, beacon ping, capture alarm.
3. **UI**: dry, bright, non-diegetic blips on their own bus. **Air sounds exist only in atmosphere** (`hud.inAtmosphere`, `atmosphere-entry`).

## API (contract section 7)
`createAudio({context?, debug?})` -> `unlock() attach(bus) detach() update(state, dt) playUi(name) setVolume({master,music,sfx}) setMuted(m) setStage(id) getStats() dispose()`.
Extras: `event(type, payload)`, `getVolume()`, `autoUnlock(target?)`. Volumes and mute persist in `localStorage['vd.audio']`. Every method is a no-op until `unlock()` has a running context; nothing throws.

## Event table (every section 3 event is covered or explicitly silent)
| Event | Sound |
|---|---|
| `run-start` | reset: restore filters, clear layers, set stage bed |
| `status` | silent itself; `update` gates continuous layers to `playing`, tucks ambience down on `paused`/`choice` |
| `rebase`, `orbit-lost`, `choice-open` | **silent by decision** (no audible meaning; UI plays `ui.open` through `playUi`) |
| `absorb` | thump + sub + low-passed tick + gulp glide, scaled by `ratio`; `chain > 1` collapses to a quiet granular chew; `tde` adds a huge swell |
| `hit` | saturated thud + crunch + grind + debris ticks; ducks ambience |
| `bounce` | soft thud |
| `impact` | only if `nearPlayer`: muffled thud + ticks from `ejecta` |
| `roche-disruption` | start: tearing (noise with flutter, groaning saws, cracks), longer for the player; end: relief thump + debris shower |
| `near-miss` | Doppler-like downward band-pass sweep + falling sine, longer/lower for bigger classes, panned |
| `atmosphere-entry/exit` | entry roar layer (noise + crackle grains + rumble) and hush/air swell; ignored for other bodies |
| `orbit-acquired` | two sines a fifth apart |
| `slingshot` | rising band-pass sweep + rising sines, scaled by `speedGain` |
| `choice-picked` | `ui.choice.confirm` |
| `evolve` | swell + sub boom + chord; cross-fades the stage bed over 4 s, ducks ambience, swaps the reverb IR |
| `health-low`, `invuln-end` | two low pulses; faint rising tick |
| `region-change` | hush (void) / reopen; ambience low-pass closes in voids |
| `beacon-ping` | sonar ping with decaying echoes, panned by bearing |
| `capture-warning` | low pulsing pairs (count and level rise with `level`), never a siren; `hud.capture` drives a continuous tremolo bed |
| `capture-clear` | rising relief sweep |
| `pulsar-beam` | 2-5 ms band-passed tick |
| `death` | sub boom, SFX and ambience low-pass close, ambience ducked; `captured` adds a falling tone |
| `ending` | quiet tonal resolve per kind (falling tone for `eventHorizon`, major chord for `finale`) |

Continuous layers (30 Hz smoothed targets, persistent nodes): `thrust`, `gravity.well`, `star.proximity`, `blackhole.proximity`, atmosphere air, capture bed. Ambience bed per stage from `stageParams(i)` (continuous in the index): root falls from A3 to B1, cut-off and reverb grow, heartbeat from the Dwarf Star, tick-like pulses over a huge sub for the Neutron Star, near-silent sub plus reversed swells for the Black Hole.

## Mix and performance
Master limiter (compressor, -8 dB threshold, 20:1) then a 0.85 trim (measured peak about -3.6 dBFS in the demo self-test). Music about -8 dB under SFX. Polyphony cap 28 pooled voices, stolen by priority then age; per-event rate gates (absorb 50 ms, chew 70 ms, hit 80 ms, near-miss 250 ms, UI 30 ms). One-shots free their nodes on `ended`; per-frame `update` creates no nodes (only sparse scheduled bells/heartbeats do).

## UI sound names
`ui.click ui.hover ui.confirm ui.back ui.error ui.open ui.close ui.choice.select ui.choice.confirm ui.stagebanner` (the `ui.` prefix is optional).
