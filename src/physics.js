// Physics + tunables. All gameplay numbers live in CONFIG so they can be tweaked in one place.
// Distances are world units. Speeds/accelerations are expressed in "player radii" (u) per second so
// that the game feels identical at every scale (the camera zooms to keep the player a constant size).

export const CONFIG = {
  radiusUnit: 10,          // radius = radiusUnit * sqrt(mass)  (mass ~ area)
  startMass: 1,
  absorbEfficiency: 0.4,   // fraction of a prey body's mass that is added to the player

  ratio: {
    dominate: 1.2,         // mass ratio at which one body can absorb / hurt the other
    hysteresis: 0.05,      // +-5% so relative-state colours never flicker at the boundary
    lethal: 3.0,           // a body this much heavier kills outright on a hit
  },

  player: {
    accelEarly: 12, accelLate: 6.6,   // u/s^2 (early stages are twitchy, late stages heavy)
    dragEarly: 1.2, dragLate: 0.8,    // 1/s (lower drag = more drift)
    maxSpeed: 14,                      // u/s hard cap
    maxHealth: 1,
    regenDelay: 3,                     // seconds after a hit before health regenerates
    regenRate: 0.07,                   // health per second
    invulnTime: 1.2,                   // seconds of invulnerability after a hit
  },

  absorb: {
    contact: 0.25,         // prey is absorbed when it overlaps this fraction of its radius
    pullBase: 0.6,         // gravity-assist range (in player radii) at stage 0 ...
    pullPerStage: 0.12,    // ... plus this per stage (black hole pulls hardest)
    pullAccel: 7,          // u/s^2 pull on prey inside the range
  },

  collision: {
    grace: 0.85,           // a threat only hurts once centre distance < grace * (rp + rb)
    restitution: 0.6,
    knockback: 9,          // u/s impulse on the player when hurt
  },

  boundary: {
    warnAt: 0.85,          // fraction of bounds radius where the warning starts
    deathDelay: 2.5,       // seconds outside the edge before the Event Horizon ending
    radiiAtStage: 220,     // bounds radius target = this * player radius at the stage's minMass
    easeRate: 0.6,         // 1/s - how fast the bounds grow after an evolution
  },

  // Chase AI for larger bodies (faithful to the original's "conga line"). Every knob is exposed.
  chase: {
    enabled: true,
    minStage: 3,                // chasing starts at this stage index
    chanceStart: 0.35,          // fraction of threats that are chasers at minStage ...
    chanceEnd: 0.95,            // ... rising to this at the last stage
    detectionRadius: 30,        // in player radii
    giveUpDelay: 4,             // seconds outside detection before a chaser gives up
    massRatioCutoff: 1.2,       // chaser must be this much heavier than the player
    speed: 6.5,                 // u/s cap at minStage
    speedLate: 8.5,             // u/s cap at the last stage
    accel: 5,                   // u/s^2
    lead: 0.3,                  // seconds of target-velocity prediction
    heavyDrag: 0.04,            // bigger bodies are slower: speed /= 1 + heavyDrag * (rb / rp)
    separation: 0.2,            // push-apart strength between overlapping chasers
  },

  world: {
    countEarly: 200,       // live body budget at stage 0 ...
    countLate: 60,         // ... falling to this at the last stage
    spawnMin: 1.15,        // spawn annulus, in view radii
    spawnMax: 1.85,
    despawn: 2.8,          // despawn distance, in view radii
    spawnPerStep: 3,
    driftMin: 0.3, driftMax: 2.2, // u/s
    driftRelax: 1.0,       // 1/s - how fast bodies return to their drift after being bumped
  },

  camera: {
    playerScreenRadius: 26, // px at 1280x720
    followLag: 0.15,        // s
    lookAhead: 0.1,         // fraction of velocity
    zoomRate: 2.5,          // 1/s
    pullback: 0.28,         // extra zoom-out on evolve
    maxShake: 8,            // px
  },
};

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);

export const radiusFromMass = (m) => CONFIG.radiusUnit * Math.sqrt(m);
export const massFromRadius = (r) => (r / CONFIG.radiusUnit) ** 2;

let nextId = 1;
export function createBody(props) {
  const radius = props.radius;
  return {
    id: props.id ?? nextId++,
    x: props.x ?? 0,
    y: props.y ?? 0,
    vx: props.vx ?? 0,
    vy: props.vy ?? 0,
    radius,
    mass: props.mass ?? massFromRadius(radius),
    kind: props.kind ?? 'neutral',
    stageIndex: props.stageIndex ?? 0,
    seed: props.seed ?? Math.floor(Math.random() * 2147483647),
    alive: true,
  };
}

// Relative state of `bodyMass` against the player, with hysteresis around the 1.2x boundaries.
export function classify(playerMass, bodyMass, prev) {
  const { dominate, hysteresis } = CONFIG.ratio;
  const prey = prev === 'prey' ? dominate * (1 - hysteresis) : dominate;
  const threat = prev === 'threat' ? dominate * (1 - hysteresis) : dominate;
  if (playerMass >= bodyMass * prey) return 'prey';
  if (bodyMass >= playerMass * threat) return 'threat';
  return 'neutral';
}

export function stageT(stageIndex, stageCount) {
  return clamp(stageIndex / Math.max(1, stageCount - 1), 0, 1);
}

// Drifty momentum: thrust along the steer vector (|steer| <= 1), exponential drag, speed cap.
export function stepPlayer(p, sx, sy, dt, stageIndex, stageCount) {
  const c = CONFIG.player;
  const t = stageT(stageIndex, stageCount);
  const accel = lerp(c.accelEarly, c.accelLate, t) * p.radius;
  const drag = lerp(c.dragEarly, c.dragLate, t);
  p.vx += sx * accel * dt;
  p.vy += sy * accel * dt;
  const k = Math.exp(-drag * dt);
  p.vx *= k;
  p.vy *= k;
  limitSpeed(p, c.maxSpeed * p.radius);
  p.x += p.vx * dt;
  p.y += p.vy * dt;
}

export function limitSpeed(b, max) {
  const s2 = b.vx * b.vx + b.vy * b.vy;
  if (s2 > max * max) {
    const k = max / Math.sqrt(s2);
    b.vx *= k;
    b.vy *= k;
  }
}

// Move velocity toward (tx, ty) by at most maxDelta.
export function approachVelocity(b, tx, ty, maxDelta) {
  const dx = tx - b.vx;
  const dy = ty - b.vy;
  const d = Math.hypot(dx, dy);
  if (d <= maxDelta || d === 0) {
    b.vx = tx;
    b.vy = ty;
  } else {
    b.vx += (dx / d) * maxDelta;
    b.vy += (dy / d) * maxDelta;
  }
}

// Mass-weighted elastic-ish bounce between player and another body. (nx, ny) points player -> body.
export function bounce(p, b, nx, ny, dist, rr) {
  const overlap = rr - dist;
  const inv = 1 / (p.mass + b.mass);
  const pw = b.mass * inv; // share of the correction the player takes
  const bw = p.mass * inv;
  p.x -= nx * overlap * pw;
  p.y -= ny * overlap * pw;
  b.x += nx * overlap * bw;
  b.y += ny * overlap * bw;

  const rvx = b.vx - p.vx;
  const rvy = b.vy - p.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return; // already separating
  const j = (-(1 + CONFIG.collision.restitution) * vn) / (1 / p.mass + 1 / b.mass);
  p.vx -= (j / p.mass) * nx;
  p.vy -= (j / p.mass) * ny;
  b.vx += (j / b.mass) * nx;
  b.vy += (j / b.mass) * ny;
}
