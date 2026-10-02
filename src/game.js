// Game logic: state machine (title -> playing <-> choice -> ended), collisions, evolution, boundary, endings.
import {
  CONFIG, clamp, stepPlayer, bounce, radiusFromMass,
} from './physics.js';
import {
  createState, createPlayer, populate, updateWorld, rescaleWorldSpeeds, targetBoundsRadius,
} from './world.js';
import { updateCamera, snapCamera, kickCamera, addTrauma } from './camera.js';

const MAX_EFFECTS = 300;
const NO_STEER = { x: 0, y: 0 };

const FALLBACK_ENDINGS = {
  death: {
    id: 'stellar-fragment',
    title: 'Stellar Fragment',
    text: 'Something far larger swept you into countless glittering fragments. They drift on, and one day they will gather again.',
  },
  eventHorizon: {
    id: 'event-horizon',
    title: 'Event Horizon',
    text: 'You drifted past the edge of everything and did not come back. Out there, time forgets you, and you become eternal.',
  },
  finale: {
    id: 'creator-god',
    title: 'Creator God',
    text: 'Nothing is left that can resist you. The sky folds inward, and from the silence something new begins.',
  },
};

export function createGame({ mod, renderer, ui, camera, input }) {
  const { STAGES, getStage, getChoicesFor, applyChoice, getEnding } = mod;
  const state = createState();
  const lastStage = STAGES.length - 1;

  const stageIndexOf = (stage) => {
    let i = STAGES.indexOf(stage);
    if (i < 0 && stage) i = STAGES.findIndex((s) => s.id === stage.id);
    return i < 0 ? 0 : i;
  };
  const stageOf = (mass) => stageIndexOf(getStage(mass));
  const ctx = { stages: STAGES, camera, chase: true, stageOf };

  let hitStop = 0;
  let hitTimer = 0;      // seconds since the player was last hurt
  let invuln = 0;
  let deathTimer = 0;
  let deathReason = null;
  let outsideT = 0;
  let finaleT = 0;
  let boundaryWarn = false;
  let choiceToken = 0;

  function fx(type, x, y, opts) {
    mod.spawnEffect(state, type, x, y, opts);
    if (state.effects.length > MAX_EFFECTS) state.effects.splice(0, state.effects.length - MAX_EFFECTS);
  }

  function setWarn(on) {
    if (on === boundaryWarn) return;
    boundaryWarn = on;
    ui.warnBoundary(on);
  }

  // ---- lifecycle ----------------------------------------------------------------------------
  function reset() {
    choiceToken++;
    state.flags = {};
    state.effects.length = 0;
    state.choices = [];
    state.time = 0;
    state.mass = CONFIG.startMass;
    state.stageIndex = stageOf(state.mass);
    state.player = createPlayer(state.mass, state.stageIndex);
    state.health = CONFIG.player.maxHealth;
    state.edge = 0;
    state.edgeDoom = 0;
    state.stats = { absorbed: 0, hits: 0, elapsed: 0, maxMass: state.mass };
    state.bounds.radius = targetBoundsRadius(STAGES, state.stageIndex);
    hitStop = hitTimer = invuln = deathTimer = outsideT = finaleT = 0;
    deathReason = null;
    setWarn(false);
    snapCamera(camera, state.player);
    updateProgress();
    populate(state, ctx);
  }

  function begin() {
    reset();
    camera.wide = 1;
    state.status = 'playing';
  }

  function showTitle() {
    reset();
    camera.wide = 0.8;
    snapCamera(camera, state.player);
    state.status = 'title';
    ui.showTitle(begin);
  }

  function finish(kind) {
    state.flags.ending = kind;
    let ending = null;
    try { ending = getEnding(state); } catch (e) { console.warn('getEnding failed', e); }
    if (!ending || !ending.title) ending = FALLBACK_ENDINGS[kind];
    state.status = 'ended';
    setWarn(false);
    ui.showEnd(ending, begin);
  }

  // ---- events -------------------------------------------------------------------------------
  function die(reason) {
    const p = state.player;
    if (!p.alive) return;
    p.alive = false;
    deathReason = reason;
    deathTimer = 1.6;
    if (reason === 'death') { state.flags.death = 'stellar-fragment'; state.flags.died = true; }
    if (reason === 'eventHorizon') { state.flags.death = 'event-horizon'; state.flags.eventHorizon = true; }
    p.vx *= 0.2;
    p.vy *= 0.2;
    fx('death', p.x, p.y, { radius: p.radius, reason, stageIndex: state.stageIndex });
    addTrauma(camera, 0.8);
    hitStop = 0.08;
  }

  function absorb(b) {
    const p = state.player;
    b.alive = false;
    p.mass += b.mass * CONFIG.absorbEfficiency;
    state.stats.absorbed++;
    state.stats.maxMass = Math.max(state.stats.maxMass, p.mass);
    fx('absorb', b.x, b.y, { radius: b.radius, mass: b.mass, stageIndex: b.stageIndex, targetId: p.id, dx: p.x - b.x, dy: p.y - b.y });
    addTrauma(camera, 0.04 + 0.2 * clamp((b.mass / p.mass) * 3, 0, 1));
    if (state.stageIndex === lastStage && b.mass > p.mass * 0.05) hitStop = Math.max(hitStop, 0.04);
  }

  function hurt(b, nx, ny, ratio) {
    const p = state.player;
    const cfg = CONFIG.player;
    state.stats.hits++;
    hitTimer = 0;
    fx('hit', p.x + nx * p.radius, p.y + ny * p.radius, { radius: p.radius, strength: ratio, stageIndex: b.stageIndex });
    addTrauma(camera, 0.5);
    hitStop = 0.06;
    const armor = state.flags.armor > 0 ? clamp(state.flags.armor, 0, 0.9) : 0;
    const lethal = ratio >= CONFIG.ratio.lethal && !(state.flags.armor > 0);
    state.health -= (0.35 + 0.12 * Math.min(ratio - CONFIG.ratio.dominate, 4)) * (1 - armor);
    invuln = cfg.invulnTime;
    p.vx -= nx * CONFIG.collision.knockback * p.radius;
    p.vy -= ny * CONFIG.collision.knockback * p.radius;
    if (lethal || state.health <= 0) die('death');
  }

  function evolve(newIndex) {
    const p = state.player;
    state.stageIndex = p.stageIndex = newIndex;
    fx('evolve', p.x, p.y, { radius: p.radius, stageIndex: newIndex, stage: STAGES[newIndex] });
    kickCamera(camera);
    addTrauma(camera, 0.35);
    if (newIndex === lastStage) finaleT = 0;

    let choices = null;
    try { choices = getChoicesFor(newIndex); } catch (e) { console.warn('getChoicesFor failed', e); }
    if (choices && choices.length) {
      const token = ++choiceToken;
      state.choices = choices;
      state.status = 'choice';
      ui.showChoice(choices, (picked) => {
        if (token !== choiceToken || state.status !== 'choice') return;
        const id = picked && typeof picked === 'object' ? picked.id : picked;
        const before = state.mass;
        try { applyChoice(state, id); } catch (e) { console.warn('applyChoice failed', e); }
        // A perk may have edited state.mass directly; honour that.
        if (state.mass !== before && Number.isFinite(state.mass) && state.mass > 0) p.mass = state.mass;
        state.choices = [];
        state.status = 'playing';
      });
    }
  }

  // ---- per-step systems ---------------------------------------------------------------------
  function collide(dt) {
    const p = state.player;
    const flags = state.flags;
    const range = flags.absorbRange > 0 ? flags.absorbRange : 1;
    const pullR = p.radius * (CONFIG.absorb.pullBase + CONFIG.absorb.pullPerStage * state.stageIndex) * range;
    const bodies = state.bodies;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      if (!b.alive) continue;
      let dx = b.x - p.x;
      let dy = b.y - p.y;
      let d = Math.hypot(dx, dy);
      const rr = p.radius + b.radius;

      if (b.kind === 'prey') {
        const reach = rr + pullR;
        if (d < reach && d > 1e-6) {
          const f = (1 - d / reach) * CONFIG.absorb.pullAccel * p.radius * dt;
          b.vx -= (dx / d) * f;
          b.vy -= (dy / d) * f;
        }
        if (d < p.radius + b.radius * CONFIG.absorb.contact + p.radius * (range - 1) * 0.5) {
          absorb(b);
          continue;
        }
      }
      if (d >= rr || !p.alive) continue;
      if (d < 1e-6) { dx = 1; dy = 0; d = 1e-6; }
      const nx = dx / d;
      const ny = dy / d;
      if (b.kind === 'threat' && invuln <= 0 && d < rr * CONFIG.collision.grace) {
        hurt(b, nx, ny, b.mass / p.mass);
        if (!p.alive) return;
      }
      if (b.kind !== 'prey') bounce(p, b, nx, ny, d, rr);
    }
  }

  function updateBounds(dt) {
    const target = targetBoundsRadius(STAGES, state.stageIndex);
    if (target > state.bounds.radius) {
      state.bounds.radius += (target - state.bounds.radius) * (1 - Math.exp(-CONFIG.boundary.easeRate * dt));
    }
  }

  function checkBoundary(dt) {
    const p = state.player;
    const e = Math.hypot(p.x, p.y) / state.bounds.radius;
    const w = CONFIG.boundary.warnAt;
    state.edge = clamp((e - w) / (1 - w), 0, 1);
    setWarn(e > w);
    if (e > 1) {
      outsideT += dt;
      if (outsideT >= CONFIG.boundary.deathDelay) die('eventHorizon');
    } else {
      outsideT = Math.max(0, outsideT - dt * 2);
    }
    state.edgeDoom = clamp(outsideT / CONFIG.boundary.deathDelay, 0, 1);
  }

  function updateProgress() {
    const i = state.stageIndex;
    if (i >= lastStage) { state.progress = 1; return; }
    const base = i === 0 ? CONFIG.startMass : Number(STAGES[i].minMass) || 0;
    const next = Number(STAGES[i + 1].minMass) || base + 1;
    state.progress = clamp((state.mass - base) / Math.max(1e-9, next - base), 0, 1);
  }

  function growPlayer() {
    const p = state.player;
    const oldR = p.radius;
    p.radius = radiusFromMass(p.mass);
    if (p.radius !== oldR) {
      const k = p.radius / oldR; // keep on-screen speeds the same as the player (and camera) scale up
      p.vx *= k; p.vy *= k;
      rescaleWorldSpeeds(state, k);
    }
    state.mass = p.mass;
  }

  function stagesCheck() {
    if (state.stageIndex >= lastStage) return;
    const idx = stageOf(state.player.mass);
    if (idx > state.stageIndex) evolve(state.stageIndex + 1);
  }

  // ---- fixed step ---------------------------------------------------------------------------
  function step(dt) {
    const p = state.player;
    state.time += dt;

    if (state.status === 'playing') {
      let scale = p.alive ? 1 : 0.35;
      if (hitStop > 0) { hitStop -= dt; scale = 0.05; }
      const sdt = dt * scale;

      const steer = p.alive ? input.getSteer(camera, p) : NO_STEER;
      stepPlayer(p, steer.x, steer.y, sdt, state.stageIndex, STAGES.length);
      ctx.chase = true;
      updateWorld(state, sdt, ctx);

      if (p.alive) {
        invuln = Math.max(0, invuln - sdt);
        hitTimer += sdt;
        if (hitTimer > CONFIG.player.regenDelay) {
          state.health = Math.min(CONFIG.player.maxHealth, state.health + CONFIG.player.regenRate * sdt);
        }
        state.stats.elapsed += sdt;
        collide(sdt);
      }
      growPlayer();
      updateBounds(sdt);

      if (p.alive) {
        stagesCheck();
        checkBoundary(sdt);
        if (state.status === 'playing' && state.stageIndex === lastStage) {
          finaleT += sdt;
          const finalMin = Math.max(CONFIG.startMass, Number(STAGES[lastStage].minMass) || 0);
          if (p.mass >= finalMin * 1.6 || finaleT > 30) { state.flags.finale = true; finish('finale'); }
        }
      } else {
        deathTimer -= dt;
        if (deathTimer <= 0 && state.status === 'playing') finish(deathReason === 'eventHorizon' ? 'eventHorizon' : 'death');
      }
    } else {
      // title / choice / ended: the world keeps drifting (slowly during a choice) but nothing can hurt the player.
      const slow = state.status === 'choice' ? 0.15 : state.status === 'ended' ? 0.3 : 1;
      ctx.chase = false;
      stepPlayer(p, 0, 0, dt * slow, state.stageIndex, STAGES.length);
      updateWorld(state, dt * slow, ctx);
      growPlayer();
      if (state.status === 'choice') updateBounds(dt * slow);
    }

    updateProgress();
    updateCamera(camera, p, dt);
  }

  function render(dt) {
    renderer.drawFrame(state, camera, dt);
    ui.update(state);
  }

  return { state, camera, ctx, step, render, showTitle, begin, reset };
}
