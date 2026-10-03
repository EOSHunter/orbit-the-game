# SIM balance report (headless bot)

`node tests/sim.balance.mjs [--runs 12] [--seed 1] [--max 1800] [--dt 60] [--set a.b=1] [--verbose]` plays the real
`createSim` (no DOM, no renderer) with a greedy bot: steer to the best prey (mass / distance), repel from larger bodies,
stay out of black-hole capture zones, hold the stabiliser after a gravity fling, wander when nothing was eaten for 20 s.
It also checks the universe is deterministic and non-empty at 1e6 .. 1e12 units from the origin. Exit code 1 on a miss
(a stage over 4 min, <2 prey on average within 40 radii, a timeout, no ending, >35 % deaths). Takes ~25 s per run.
`npm run test:balance` runs 12 seeds.

## Result (24 seeds, 60 Hz, mortal bot, config unchanged)

| | |
|---|---|
| Finished all 12 stages, ending fired | 18 / 24 (median 14:55; `creator_god` x11, `cradle_of_life` x7) |
| Deaths | 6 / 24: 5 collisions (stages 0, 1, 2, 3, 10), 1 capture (stage 9) |
| Timeouts / stuck runs | 0 |
| Time per stage (median / worst) | 1:11-1:28 / 1:46 for every stage; worst 2:34 (stages 1-2); Black Hole finale 0:17 / 0:29 |
| Prey within 40 player radii | average 95 (Meteorite) rising to 218 (Black Hole); 1-second minimums of 0 occur only transiently while crossing a void |

The pacing governor (`CONFIG.pace`) holds every stage near 95 s regardless of seed, so no stage is close to the ~4 minute limit.
Spawn density, mass thresholds and growth were therefore **not changed**.

## What the runs showed

- **Stuck run (seed 13, first sweep).** A gravity fling past a star pushed the bot to 1700+ units/s (far above the 14 S/s
  thrust cap, which only limits thrust, not gravity). It overshot every small prey and spent 30 minutes in a void. The sim
  recovers (void drift, beacon, stabiliser) once the player brakes, so this was a bot issue: the bot now holds Space above
  1.3x the cap, and the seed finishes in 16:10.
- **Capture deaths (first sweep: 6 of 24, stages 8-10).** The bot only reacted once the HUD warned. With the warning
  (0.25 at ~32 S) and a repulsion from holes inside 1.8 capture radii it escapes, 1 capture in 24. The capture mechanic is
  escapable and was left alone.
- **Early collisions** are a bot weakness (e.g. touching a neutron star while chasing prey at stage 0); a player sees them.

## Universe

Determinism by seed, order independence, no overlap, no edge and flat memory are covered by `tests/sim.universe.test.mjs`;
the balance script adds a spot check far from the origin (1e6, 3e7, 5e9, 1e12) that two universes with one seed agree and
are non-empty.

## Test fixes in this change

Two existing sim tests were failing on `main` because they predate later changes (no sim code was touched):
`tests/sim.util.mjs` `lab()` now disables the pacing governor (it scales absorb gains, which broke the Roche
"mass ends up in the player" check), and `tests/sim.contract.test.mjs` uses masses that match the current stage table
(asteroid 3-12, dwarf planet 12+, finale at the Black Hole minimum mass of 1.8e6).
