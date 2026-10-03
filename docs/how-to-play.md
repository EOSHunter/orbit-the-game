# How to play Vesper Drift

You are a drifting body in a sea of other bodies. **Eat what is smaller, avoid what is bigger.** Everything you eat adds
to your mass. Enough mass and you evolve into the next form. Twelve forms later you are a black hole.

## The mass rules

Everything comes down to comparing your mass with the other body's mass.

| The other body is... | What happens on contact |
|---|---|
| **Smaller** (you are at least 1.2x heavier) | You absorb it and gain a share of its mass. Shown **mint**. |
| **About your size** (within 1.2x either way) | You bounce off each other. Shown **blue**. |
| **Bigger** (it is at least 1.2x heavier) | It damages you. Shown **coral**. At about 3x your mass it is lethal. |

- There is a small grace margin: a bigger body only hurts once you overlap it noticeably, not on a graze.
- You only gain part of a victim's mass (roughly 40% in the simulation build), so growth takes work.
- Pacing is gently rubber-banded so a run lasts about 13-16 minutes whatever your skill.
- From the Rocky Planet stage on, some bigger bodies **chase** you if they notice you. Break line of sight and out-run them.
- Far bigger black holes can **capture** you with gravity. A warning meter fills as you are pulled in; steer away before it
  passes 75%.
- Perks you pick at milestones change your speed, damage resistance or mass gained per absorb (resistance is capped at 75%).

## The 12 stages

Each stage is a bigger form, a bigger world and bigger prey. Stages marked **choice** pause for an evolution card.

| # | Stage | Notes |
|---|---|---|
| 1 | Meteorite | Tutorial scale: dust and pebbles are prey |
| 2 | Asteroid | Asteroid belts appear |
| 3 | Dwarf Planet | **Choice:** Frozen Fortress (tougher, slower), Cradle of Life (more mass per absorb), War Planet (faster) |
| 4 | Rocky Planet | **Choice:** Terrestrial, Lava (faster), Metallic (tougher). Chasers appear |
| 5 | Gas Giant | **Choice:** Ringed Giant (more mass), Storm Giant (faster), Ice Giant (tougher) |
| 6 | Gas Planet | Transitional stage |
| 7 | Dwarf Star | **Choice:** Yellow Dwarf (balanced), Red Dwarf (faster), Blue Dwarf (more mass) |
| 8 | Star | Gravity wells become meaningful |
| 9 | Giant Star | Only large threats remain |
| 10 | Supergiant Star | **Choice:** Giant Killer (heavy resistance), Material Universe (much more mass per absorb) |
| 11 | Neutron Star | Compact, fast, dense |
| 12 | Black Hole | Final form: devour everything |

Every card menu also offers **Abandon evolution**: no perk, but it counts toward a secret ending.

## Endings

| Ending | How |
|---|---|
| **Stellar Fragment** | A bigger body destroys you |
| **Event Horizon** | You are captured by a vastly larger black hole (or leave the map in the 2D build) |
| **Cradle of Life** | Reach Black Hole after picking Terrestrial Planet and Yellow Dwarf |
| **Creator God** | Reach Black Hole after picking a real evolution every time (no abandons) |
| **Quantum Cosmos** | Reach Black Hole choosing only Abandon evolution every time |
| **Black Hole** | Reach Black Hole with any other mix of choices |

## Tips

- Watch the rim colours, not the sizes. Circle prey, and let near-equals bounce past you.
- Pick a stage's perk for how you play: speed to escape chasers, resistance to take risks, absorb bonus to evolve sooner.
- Press **T** in the 3D build for a top-down view, **Space** to stabilise, **Esc** to pause.

Controls and URLs are in the [README](../README.md). The full design rationale is in [game-design.md](game-design.md).
