// World: state creation, body spawning/despawning around the player, drifting and chase AI.
import {
  CONFIG, clamp, lerp, rand, createBody, classify, stageT, approachVelocity, radiusFromMass,
  massFromRadius,
} from './physics.js';
import { viewRadius } from './camera.js';

export function createState() {
  return {
    player: null,
    bodies: [],
    time: 0,
    mass: CONFIG.startMass,
    stageIndex: 0,
    choices: [],
    flags: {},
    bounds: { radius: 1000 },
    status: 'title',
    effects: [],
    // engine extras (safe for other modules to read)
    health: CONFIG.player.maxHealth,
    progress: 0,        // 0..1 toward the next stage
    edge: 0,            // 0..1 how deep into the boundary warning zone the player is
    stats: { absorbed: 0, hits: 0, elapsed: 0, maxMass: CONFIG.startMass },
    chaseRest: 0,       // seconds before a new chase may start (breather after a chaser gives up)
  };
}

export function createPlayer(mass, stageIndex) {
  const p = createBody({ id: 0, radius: radiusFromMass(mass), mass, kind: 'player', stageIndex, seed: 1 });
  return p;
}

// Arena radius: radiiAtStage player radii, measured at the larger of the stage's minMass and the player's
// current mass, so the arena keeps pace with growth inside a stage (stage 0 alone spans several x in mass).
export function targetBoundsRadius(stages, stageIndex, mass = 0) {
  const m = Math.max(CONFIG.startMass, Number(stages[stageIndex]?.minMass) || 0, mass);
  return CONFIG.boundary.radiiAtStage * radiusFromMass(m);
}

// ---- spawn mix ------------------------------------------------------------------------------
// stage.spawnMix may be {prey, neutral, threat} weights or [prey, neutral, threat]; otherwise a default curve is used.
export function readMix(stage, stageIndex, stageCount) {
  const m = stage && stage.spawnMix;
  let prey, neutral, threat;
  if (Array.isArray(m) && m.length >= 3 && m.every(Number.isFinite)) [prey, neutral, threat] = m;
  else if (m && typeof m === 'object' && ['prey', 'neutral', 'threat'].some((k) => Number.isFinite(m[k]))) {
    prey = Number(m.prey) || 0;
    neutral = Number(m.neutral ?? m.equal) || 0;
    threat = Number(m.threat) || 0;
  }
  if (prey === undefined || prey + neutral + threat <= 0) {
    const t = stageT(stageIndex, stageCount);
    threat = t >= 1 ? 0 : lerp(0.04, 0.32, Math.min(1, t / 0.9));
    neutral = 0.1;
    prey = 1 - threat - neutral;
  }
  const sum = prey + neutral + threat;
  return { prey: prey / sum, neutral: neutral / sum, threat: threat / sum };
}

function pickKind(mix) {
  const r = Math.random();
  if (r < mix.prey) return 'prey';
  if (r < mix.prey + mix.neutral) return 'neutral';
  return 'threat';
}

function chaseChance(stageIndex, stageCount) {
  const c = CONFIG.chase;
  if (!c.enabled || stageIndex < c.minStage) return 0;
  const t = clamp((stageIndex - c.minStage) / Math.max(1, stageCount - 1 - c.minStage), 0, 1);
  return lerp(c.chanceStart, c.chanceEnd, t);
}

// Radius of a new body relative to the player's radius, by intent.
function radiusRatio(kind, stageIndex) {
  if (kind === 'prey') { const u = Math.random(); return 0.12 + 0.73 * u * u; }
  if (kind === 'neutral') return rand(0.93, 1.07);
  const max = 4 + stageIndex * 0.5;
  return 1.15 * Math.exp(Math.random() * Math.log(max / 1.15));
}

function spawnOne(state, ctx, x, y) {
  const p = state.player;
  const { stages } = ctx;
  const stage = stages[state.stageIndex];
  const mix = readMix(stage, state.stageIndex, stages.length);
  const kind = pickKind(mix);
  const radius = p.radius * radiusRatio(kind, state.stageIndex);
  // A body looks like the stage matching its own mass, so the world holds "smaller versions" of what you will become.
  const b = createBody({ x, y, radius, kind, stageIndex: ctx.stageOf ? ctx.stageOf(massFromRadius(radius)) : state.stageIndex });
  const ang = Math.random() * Math.PI * 2;
  const speed = rand(CONFIG.world.driftMin, CONFIG.world.driftMax) * p.radius;
  b.dvx = Math.cos(ang) * speed; // cruise velocity the body relaxes back to
  b.dvy = Math.sin(ang) * speed;
  b.vx = b.dvx;
  b.vy = b.dvy;
  b.chaser = kind === 'threat' && Math.random() < chaseChance(state.stageIndex, stages.length);
  b.chasing = false;
  b.giveUp = 0;
  b.kind = classify(p.mass, b.mass, kind);
  state.bodies.push(b);
  return b;
}

function targetCount(state, ctx) {
  const t = stageT(state.stageIndex, ctx.stages.length);
  return Math.round(lerp(CONFIG.world.countEarly, CONFIG.world.countLate, t));
}

// Fill the whole despawn disc (used at start / restart) so the player never sees an empty sky.
export function populate(state, ctx) {
  state.bodies.length = 0;
  const p = state.player;
  const vr = viewRadius(ctx.camera);
  const maxR = vr * CONFIG.world.despawn * 0.9;
  const n = targetCount(state, ctx);
  for (let i = 0; i < n; i++) {
    for (let tries = 0; tries < 6; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * maxR;
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d;
      if (Math.hypot(x, y) > state.bounds.radius * 0.97) continue;
      const b = spawnOne(state, ctx, x, y);
      if (Math.hypot(b.x - p.x, b.y - p.y) < (p.radius + b.radius) * 1.8) b.alive = false; // keep a safe start
      break;
    }
  }
  state.bodies = state.bodies.filter((b) => b.alive);
}

function trySpawn(state, ctx) {
  const p = state.player;
  const vr = viewRadius(ctx.camera);
  for (let tries = 0; tries < 6; tries++) {
    const a = Math.random() * Math.PI * 2;
    const d = vr * rand(CONFIG.world.spawnMin, CONFIG.world.spawnMax);
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    if (Math.hypot(x, y) > state.bounds.radius * 0.98) continue;
    spawnOne(state, ctx, x, y);
    return;
  }
}

// Advance every non-player body by dt.
export function updateWorld(state, dt, ctx) {
  const p = state.player;
  const { stages } = ctx;
  const c = CONFIG.chase;
  const pr = p.radius;
  const bodies = state.bodies;
  const stageCount = stages.length;
  const t = stageT(state.stageIndex, stageCount);
  const chaseSpeed = lerp(c.speed, c.speedLate, t);
  const relax = 1 - Math.exp(-CONFIG.world.driftRelax * dt);
  const detect = c.detectionRadius * pr;
  const despawnD = viewRadius(ctx.camera) * CONFIG.world.despawn;
  const canChase = ctx.chase !== false && c.enabled && p.alive;
  const chasers = [];
  let active = 0;
  for (let i = 0; i < bodies.length; i++) if (bodies[i].chasing) active++;
  if (state.chaseRest > 0) state.chaseRest -= dt;

  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b.alive) continue;
    b.kind = classify(p.mass, b.mass, b.kind);

    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy);

    const wasChasing = b.chasing;
    if (b.chaser && canChase && b.kind === 'threat' && state.stageIndex >= c.minStage && b.mass >= p.mass * c.massRatioCutoff) {
      if (d < detect) {
        if (b.chasing || (active < c.maxChasers && !(state.chaseRest > 0))) { b.chasing = true; b.giveUp = 0; }
      } else if (b.chasing && (b.giveUp += dt) > c.giveUpDelay) b.chasing = false;
      // Stamina: a body that has hunted long enough gives up for good.
      if (b.chasing && (b.chaseT = (b.chaseT || 0) + dt) > c.maxChaseTime) { b.chasing = false; b.chaser = false; }
    } else {
      b.chasing = false;
    }
    if (b.chasing !== wasChasing) {
      active += b.chasing ? 1 : -1;
      // A chaser that tired or was outrun buys the player a breather before the next one starts.
      if (!b.chasing && canChase && b.alive) state.chaseRest = c.respite;
    }

    if (b.chasing) {
      // Pure pursuit with a little lead on the player's velocity.
      const tx = dx + p.vx * c.lead;
      const ty = dy + p.vy * c.lead;
      const tl = Math.hypot(tx, ty) || 1;
      const speed = (chaseSpeed * pr) / (1 + c.heavyDrag * (b.radius / pr));
      approachVelocity(b, (tx / tl) * speed, (ty / tl) * speed, c.accel * pr * dt);
      chasers.push(b);
    } else {
      // Relax back to the body's cruise velocity (so bumps and gravity pulls wear off).
      b.vx += (b.dvx - b.vx) * relax;
      b.vy += (b.dvy - b.vy) * relax;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Despawn: far away, outside the arena, or too tiny to matter at the current scale.
    if (d > despawnD || Math.hypot(b.x, b.y) > state.bounds.radius || b.radius < pr * 0.05) b.alive = false;
  }

  // Keep the conga line from collapsing into a single dot.
  for (let i = 0; i < chasers.length; i++) {
    for (let j = i + 1; j < chasers.length; j++) {
      const a = chasers[i], b = chasers[j];
      const rr = (a.radius + b.radius) * 0.9;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = ((rr - d) * c.separation) / d;
      const wa = b.mass / (a.mass + b.mass);
      a.x -= dx * push * wa; a.y -= dy * push * wa;
      b.x += dx * push * (1 - wa); b.y += dy * push * (1 - wa);
    }
  }

  // Compact dead bodies, then top up toward the stage's body budget.
  let w = 0;
  for (let i = 0; i < bodies.length; i++) if (bodies[i].alive) bodies[w++] = bodies[i];
  bodies.length = w;
  const want = targetCount(state, ctx);
  for (let n = 0; n < CONFIG.world.spawnPerStep && bodies.length < want; n++) trySpawn(state, ctx);
}

// Called when the player's radius changes so existing bodies keep the same *relative* speed.
export function rescaleWorldSpeeds(state, k) {
  if (k === 1) return;
  for (const b of state.bodies) {
    b.vx *= k; b.vy *= k; b.dvx *= k; b.dvy *= k;
  }
}
