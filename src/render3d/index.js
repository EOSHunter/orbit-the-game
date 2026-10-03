// Three.js 3D renderer (contract section 5). Imports only `three`, src/data/looks.js (when present)
// and files in this folder. Reads `state`; never writes to it.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as FALLBACK from './fallback-looks.js';
import { BodyLayer, makeShared } from './bodies.js';
import { DotsLayer } from './dots.js';
import { Sky } from './sky.js';
import { Vfx } from './vfx.js';
import { ChaseCamera } from './camera.js';
import { GradeShader } from './glsl/misc.js';
import { CLS_DEFAULT, blackbodyRGB, hexLinear } from './util.js';

// state.key.dir is the unit vector from the scene TOWARD the key light (the star).
const QUALITY = {
  low: { dprCap: 1, bloom: false, samples: 0, sky: 512 },
  med: { dprCap: 1.5, bloom: true, samples: 0, sky: 768 },
  high: { dprCap: 2, bloom: true, samples: 4, sky: 1024 },
};

async function loadLooks(passed) {
  if (passed && passed.getLook && passed.PRESETS) return passed;
  try {
    const m = await import('../data/looks.js');
    if (m.getLook && m.PRESETS) return m;
  } catch (e) { /* CD's file not shipped yet: fallback */ }
  return FALLBACK;
}

const hexRGB255 = (h) => { const n = parseInt((h || '#808080').slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

export function createRenderer(opts = {}) {
  const canvas = opts.canvas;
  const clsList = opts.clsList || CLS_DEFAULT;
  const dbg = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('debug') || '' : '';
  let R = null, scene, overlay, camera, composer, bloom, grade, bodies, dots, sky, vfx, chase, looks, shared;
  let ready = false, bus = null, offs = [];
  let cssW = 1280, cssH = 720, dpr = 1, scale = 1;
  let qMode = 'auto', qTier = 'high';
  let time = 0, exposure = 1, lastNow = 0, frameEma = 16, slow = 0, fast = 0, lastStage = null;
  const options = { reducedMotion: false, topDown: false, readability: false };
  const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const stats = { ms: 0, drawCalls: 0, triangles: 0, bodies: 0, quality: 'auto', backend: 'webgl2' };
  const frustum = new THREE.Frustum(), pv = new THREE.Matrix4(), sphere = new THREE.Sphere();
  const keyW = new THREE.Vector3(), keyV = new THREE.Vector3();
  const all = [];
  let relation = null, curState = null, dbgEl = null, dbgT = 0;

  const ctx = {
    camPos: [0, 0, 0], viewMatrix4: null, proj11: 1, H: 1080, frustum, sphere, L: [0, 1, 0], opts: options, time: 0, all,
    dots: null, bodies: null, pulse: null, relation: null, keyI: 1, camDist: 100, pixelRatio: 1, lensPulse: 0,
    captureLevelFor: (id) => { const c = curState && curState.hud && curState.hud.capture; return c && c.hostId === id ? c.level : 0; },
    camDistTo: (p) => Math.hypot(p[0] - ctx.camPos[0], p[1] - ctx.camPos[1], p[2] - ctx.camPos[2]),
  };

  const effReduced = () => options.reducedMotion || !!(mq && mq.matches);

  function applyQuality() {
    const tier = qMode === 'auto' ? 'high' : qMode;
    qTier = tier;
    const q = QUALITY[tier];
    stats.quality = qMode;
    if (!R) return;
    if (bodies) bodies.setQuality(tier);
    bloom.enabled = q.bloom;
    for (const rt of [composer.renderTarget1, composer.renderTarget2]) { if (rt.samples !== q.samples) { rt.samples = q.samples; rt.dispose(); } }
    applySize();
  }
  function applySize() {
    if (!R) return;
    const q = QUALITY[qTier];
    const pr = Math.max(0.5, Math.min(dpr, q.dprCap) * scale);
    R.setPixelRatio(pr);
    R.setSize(cssW, cssH, false);
    composer.setPixelRatio(pr); composer.setSize(cssW, cssH);
    shared.uViewH.value = cssH * pr; ctx.H = cssH * pr; ctx.pixelRatio = pr;
    camera.aspect = cssW / Math.max(1, cssH); camera.updateProjectionMatrix();
  }

  const api = {
    async init() {
      try {
        looks = await loadLooks(opts.looks);
        R = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
        if (!R.capabilities.isWebGL2) { R.dispose(); R = null; return false; }
        R.setClearColor(0x000000, 1);
        R.autoClear = true;
        R.info.autoReset = false;
        R.toneMapping = THREE.NeutralToneMapping; R.toneMappingExposure = 1;
        shared = makeShared();
        scene = new THREE.Scene(); overlay = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(38, 16 / 9, 1, 1e7);
        chase = new ChaseCamera(camera, looks.PRESETS.camera);
        sky = new Sky(R, scene, QUALITY[qMode === 'auto' ? 'high' : qMode].sky);
        bodies = new BodyLayer({ scene, overlayScene: overlay, shared, getLook: looks.getLook, clsList, quality: 'high' });
        bodies.sky = sky;
        dots = new DotsLayer(scene, shared, clsList);
        vfx = new Vfx(scene, shared);
        vfx.onEvolve = () => chase.onEvolve();
        ctx.dots = dots; ctx.bodies = bodies; ctx.pulse = vfx.pulse;
        const P = looks.PRESETS;
        relation = { prey: hexRGB255(P.relation.prey), neutral: hexRGB255(P.relation.neutral), threat: hexRGB255(P.relation.threat) };
        ctx.relation = relation;

        const rt = new THREE.WebGLRenderTarget(cssW, cssH, { type: THREE.HalfFloatType, samples: 4 });
        composer = new EffectComposer(R, rt);
        composer.addPass(new RenderPass(scene, camera));
        bloom = new UnrealBloomPass(new THREE.Vector2(cssW, cssH), P.bloom.strength, P.bloom.radius, P.bloom.threshold);
        composer.addPass(bloom);
        grade = new ShaderPass(GradeShader);
        composer.addPass(grade);
        composer.addPass(new OutputPass());
        if (dbg.includes('emitters')) {
          dbgEl = document.createElement('pre');
          dbgEl.style.cssText = 'position:fixed;top:8px;right:8px;margin:0;padding:8px 10px;background:rgba(0,0,0,.7);color:#9fe;font:11px/1.35 monospace;z-index:99;max-width:340px;pointer-events:none;white-space:pre';
          document.body.appendChild(dbgEl);
        }
        applyQuality();
        ready = true;
        return true;
      } catch (e) {
        console.error('[render3d] init failed', e);
        try { if (R) R.dispose(); } catch (_) { /* ignore */ }
        R = null; return false;
      }
    },

    attach(b) {
      api.detach(); bus = b;
      if (vfx) vfx.attach(b);
      offs = [
        b.on('run-start', () => { chase.reset(); lastStage = null; }),
        b.on('rebase', (e) => chase.rebase(e.shift)),
        b.on('evolve', () => chase.onEvolve()),
      ];
    },
    detach() { for (const o of offs) if (typeof o === 'function') o(); offs = []; if (vfx) vfx.detach(); bus = null; },

    resize(w, h, d) { cssW = Math.max(1, w | 0); cssH = Math.max(1, h | 0); dpr = d || 1; applySize(); },

    setQuality(q) { qMode = q; if (R) applyQuality(); if (qMode !== 'auto') scale = 1; },
    setOptions(o) { Object.assign(options, o || {}); },

    drawFrame(state, dtIn) {
      if (!ready) return;
      const t0 = performance.now();
      curState = state;
      const dt = Math.min(0.1, Math.max(0, dtIn || 0));
      time += dt; ctx.time = time; shared.uTime.value = time % 3600;
      options.__r = effReduced();
      const o = { reducedMotion: effReduced(), topDown: options.topDown, readability: options.readability, shake: vfx.shake };
      vfx.reduced = o.reducedMotion;
      ctx.opts = { ...options, reducedMotion: o.reducedMotion };

      // ---- presets for this stage ----
      const P = looks.PRESETS;
      const sp = P.stages[state.stageId] || P.stages.star || Object.values(P.stages)[0];

      // ---- camera ----
      chase.setPresets(P.camera);
      chase.update(state, dt, o);
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
      pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(pv);
      ctx.viewMatrix4 = camera.matrixWorldInverse; ctx.proj11 = camera.projectionMatrix.elements[5];
      ctx.camPos = chase.pos; ctx.camDist = chase.dist; ctx.pitch = chase.pitch;

      // ---- sky (re-bakes only when seed/level/stage change; cross-fades on stage change) ----
      const sk = state.sky || { seed: 1, level: 0, density: 0.5 };
      sky.set({ seed: sk.seed >>> 0, level: sk.level, density: sk.density, tintA: sp.skyTint[0], tintB: sp.skyTint[1] }, false);
      sky.update(dt, ctx.H, ctx.pixelRatio);

      // ---- the single hard key light + tiny cool ambient ----
      const key = state.key || { dir: [0.5, 0.7, 0.4], temperatureK: sp.keyColorK, intensity: 1 };
      keyW.set(key.dir[0], key.dir[1], key.dir[2]).normalize();
      ctx.L[0] = keyW.x; ctx.L[1] = keyW.y; ctx.L[2] = keyW.z;
      keyV.copy(keyW).transformDirection(camera.matrixWorldInverse);
      shared.uKeyDir.value.copy(keyV);
      const kI = Math.max(0.005, key.intensity == null ? 1 : key.intensity);
      ctx.keyI = Math.min(1, kI);
      const rgb = blackbodyRGB(key.temperatureK || sp.keyColorK, [0, 0, 0]);
      const m = Math.max(rgb[0], rgb[1], rgb[2], 1e-3);
      const ki = sp.keyIntensity * kI;
      shared.uKeyColor.value.set(rgb[0] / m * ki, rgb[1] / m * ki, rgb[2] / m * ki);
      const amb = hexLinear(sp.ambient, [0, 0, 0]);
      shared.uAmbient.value.set(amb[0] * sp.ambientIntensity, amb[1] * sp.ambientIntensity, amb[2] * sp.ambientIntensity);

      // ---- exposure: slow eye-like adaptation between "near a star" and "deep space" ----
      const lit = Math.min(1, Math.max(0, (kI - 0.02) / 0.5));
      const tgt = P.exposure.deepSpace + (P.exposure.day - P.exposure.deepSpace) * lit;
      exposure += (tgt - exposure) * (1 - Math.exp(-dt / Math.max(0.2, P.exposure.adaptSeconds)));
      R.toneMappingExposure = exposure * (1 - 0.35 * vfx.deathT);

      // ---- draw lists ----
      all.length = 0;
      if (state.player) all.push(state.player);
      const bs = state.bodies; for (let i = 0; i < bs.length; i++) all.push(bs[i]);
      ctx.lensPulse = vfx.lensPulse;
      dots.begin();
      bodies.update(state, ctx);
      bodies.finishExtras();
      dots.addFar(state.far, Math.min(1, kI));
      dots.end(ctx.pixelRatio);
      vfx.update(dt, state, ctx);

      // ---- post parameters ----
      bloom.strength = P.bloom.strength * (o.reducedMotion ? 0.7 : 1) * (1 + 0.5 * vfx.flash);
      bloom.radius = P.bloom.radius; bloom.threshold = P.bloom.threshold;
      const gu = grade.uniforms;
      gu.uVig.value = 0.3 + 0.35 * (state.health != null ? Math.max(0, 0.4 - state.health) : 0) + 0.3 * vfx.deathT;
      gu.uCA.value = o.reducedMotion ? 0 : vfx.ca * 0.006;
      gu.uDesat.value = vfx.deathT * 0.85;
      gu.uFlash.value = vfx.flash * (o.reducedMotion ? 0.3 : 1) * 0.35;

      R.info.reset();
      composer.render(dt);
      R.autoClear = false; R.render(overlay, camera); R.autoClear = true;

      // ---- stats, auto quality (dynamic resolution) ----
      const now = performance.now();
      const real = lastNow ? Math.min(100, now - lastNow) : 16.6; lastNow = now;
      frameEma += (real - frameEma) * 0.08;
      if (qMode === 'auto') {
        if (frameEma > 21) { slow++; fast = 0; } else if (frameEma < 15) { fast++; slow = 0; } else { slow = 0; fast = 0; }
        if (slow > 40 && scale > 0.6) { scale = Math.max(0.6, scale - 0.1); slow = 0; applySize(); }
        else if (fast > 300 && scale < 1) { scale = Math.min(1, scale + 0.05); fast = 0; applySize(); }
      }
      stats.ms = now - t0; stats.drawCalls = R.info.render.calls; stats.triangles = R.info.render.triangles; stats.bodies = bodies.counts.bodies;
      if (dbgEl && now - dbgT > 250) { dbgT = now; updateDebug(); }
    },

    getView() {
      return {
        width: cssW, height: cssH,
        project(p) {
          const v = new THREE.Vector3(p[0], p[1], p[2]).project(camera);
          return { x: (v.x * 0.5 + 0.5) * cssW, y: (-v.y * 0.5 + 0.5) * cssH, visible: v.z < 1 && v.z > -1 && Math.abs(v.x) <= 1.05 && Math.abs(v.y) <= 1.05 };
        },
        unproject(sx, sy) {
          const v = new THREE.Vector3((sx / cssW) * 2 - 1, -(sy / cssH) * 2 + 1, 0.5).unproject(camera);
          const o = camera.position, d = v.sub(o).normalize();
          const t = Math.abs(d.y) < 1e-6 ? 0 : -o.y / d.y;
          return [o.x + d.x * t, 0, o.z + d.z * t];
        },
      };
    },
    getStats() { return stats; },
    /** Test/debug helper: the emissive elements drawn this frame with their causes. */
    getEmitters() { return bodies ? bodies.emitters.concat(vfx.listing) : []; },
    dispose() {
      api.detach();
      if (dbgEl) dbgEl.remove();
      if (sky) sky.dispose();
      if (composer) composer.dispose();
      if (R) { R.dispose(); R = null; }
      ready = false;
    },
  };

  function updateDebug() {
    const list = api.getEmitters();
    let s = 'EMITTERS (cause -> cls)\n';
    if (!list.length) s += '  (none)\n';
    for (const e of list.slice(0, 30)) s += `  #${e.id} ${e.cls || 'entry'}: ${e.cause} ${(e.intensity || 0).toFixed(2)}\n`;
    s += `particles alive: ${vfx.alive | 0}\n`;
    dbgEl.textContent = s;
  }
  return api;
}
