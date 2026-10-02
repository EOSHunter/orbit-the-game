# Vesper Drift

A browser game inspired by *Drifter Star: Evolution*. You start as a glowing pebble drifting in space. Absorb anything
smaller, avoid anything bigger, and grow through 12 forms, from Meteorite to Black Hole. At milestone stages you pick
an evolution that changes your speed, toughness or appetite, and decides which ending you earn. A full run takes
about 13-16 minutes.

Everything is drawn procedurally on an HTML5 canvas. Plain JavaScript ES modules, no build step, no dependencies.

## Run

ES modules do not load from `file://`, so serve the folder and open it in a browser:

```
npm start                    # http://localhost:8000/  (needs Node 18+)
# or: python -m http.server 8000
```

## Controls

| Input | Action |
|---|---|
| Mouse | Steer toward the cursor; the farther the cursor, the stronger the thrust |
| WASD / arrow keys | Steer with the keyboard instead |
| 1-4 or click | Pick an evolution card |
| Esc or the pause button | Pause / resume |

Rim colours show what is safe to touch: **mint** = smaller (absorb it), **blue** = about your size (bounces),
**coral with a pulsing ring** = bigger (it hurts, and much bigger kills). From the Rocky Planet stage on, some bigger
bodies chase you. Leaving the arena past the warning ends the run.

## Tests

```
npm test                     # stage/choice/ending unit tests + headless pacing simulation
npm run test:smoke           # end-to-end browser test in headless Chrome/Edge
```

## Docs

- `docs/game-design.md`: research and design spec
- `docs/creative-direction.md`: look, feel and audio direction
- `docs/engine-notes.md`: engine architecture, module contracts, tuning and pacing results
