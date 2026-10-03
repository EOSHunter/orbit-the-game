// Turns state.bodies (+ player) into draw calls:
//   rock family  -> three InstancedMesh LOD batches (lo / mid / big), shader-driven procedural surfaces
//   terrestrial, gas giant, brown dwarf, star, neutron star -> pooled meshes (few, big, expensive shaders)
//   black hole   -> lensed billboard + optional jets; glow billboards; beams; relation outlines (overlay)
// Emission is written ONLY for causes on the contract's whitelist (util.causeAllowed).
import * as THREE from 'three';
import { rockVert, rockFrag } from './glsl/rock.js';
import { sphereVert, planetFrag, gasFrag, starFrag, atmoVert, atmoFrag, ringVert, ringFrag, glowVert, glowFrag, beamVert, beamFrag } from './glsl/bodies.js';
import { bhVert, bhFrag, outlineVert, outlineFrag } from './glsl/misc.js';
import { causeAllowed, blackbodyRGB, hexLinear, lum, seedFloat, frac01, writeTRS, quatAxisAngle, quatMul } from './util.js';

const SMALL = new Set(['meteorite', 'asteroid', 'debris', 'fragment', 'comet']);
const STAR_CELLS = { dwarf: 9, main: 7, giant: 3.5, supergiant: 2.4 };
const _q1 = [0, 0, 0, 1], _q2 = [0, 0, 0, 1], _q3 = [0, 0, 0, 1];
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _qq = new THREE.Quaternion();
const _rgb = [0, 0, 0], _rgb2 = [0, 0, 0];

export function makeShared() {
  return {
    uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
    uKeyColor: { value: new THREE.Vector3(3, 3, 3) },
    uAmbient: { value: new THREE.Vector3(0.01, 0.015, 0.03) },
    uTime: { value: 0 },
    uViewH: { value: 1080 },
  };
}

class RockBatch {
  constructor(detail, cap, material) {
    this.cap = cap;
    const geo = new THREE.IcosahedronGeometry(1, detail);
    const mk = (n) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    this.a = { seed: mk(1), colA: mk(3), colB: mk(3), P: mk(4), M: mk(4), E: mk(2), O0: mk(4), O1: mk(4), S: mk(4) };
    geo.setAttribute('aSeed', this.a.seed); geo.setAttribute('aColA', this.a.colA); geo.setAttribute('aColB', this.a.colB);
    geo.setAttribute('aP', this.a.P); geo.setAttribute('aM', this.a.M); geo.setAttribute('aE', this.a.E);
    geo.setAttribute('aOcc0', this.a.O0); geo.setAttribute('aOcc1', this.a.O1); geo.setAttribute('aStretch', this.a.S);
    this.mesh = new THREE.InstancedMesh(geo, material, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.count = 0;
  }
  begin() { this.count = 0; }
  end() {
    this.mesh.count = this.count; this.mesh.visible = this.count > 0;
    for (const k in this.a) this.a[k].needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  next() { return this.count < this.cap ? this.count++ : -1; }
}

class InstBatch {            // generic instanced quads (glow, outlines)
  constructor(cap, material, attrs) {
    this.cap = cap; this.count = 0;
    const geo = new THREE.PlaneGeometry(2, 2);
    this.a = {};
    for (const [name, n] of attrs) {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * n), n); a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(name, a); this.a[name] = a;
    }
    this.mesh = new THREE.InstancedMesh(geo, material, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
  }
  begin() { this.count = 0; }
  end() {
    this.mesh.count = this.count; this.mesh.visible = this.count > 0;
    for (const k in this.a) this.a[k].needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  next() { return this.count < this.cap ? this.count++ : -1; }
  setXYZS(i, x, y, z, s) { writeTRS(this.mesh.instanceMatrix.array, i * 16, x, y, z, 0, 0, 0, 1, s); }
}

export class BodyLayer {
  constructor({ scene, overlayScene, shared, getLook, clsList, quality }) {
    this.scene = scene; this.overlayScene = overlayScene; this.shared = shared;
    this.getLookRaw = getLook; this.clsList = clsList;
    this.lookCache = new Map();
    this.emitters = [];                 // for ?debug=emitters: { id, cls, cause, intensity }
    this.counts = { bodies: 0, lo: 0, mid: 0, big: 0 };
    this.quality = quality || 'high';

    const rockMat = new THREE.ShaderMaterial({ uniforms: { ...shared }, vertexShader: rockVert, fragmentShader: rockFrag });
    this.rockMat = rockMat;
    this.batches = {
      lo: new RockBatch(3, 640, rockMat),
      mid: new RockBatch(7, 320, rockMat),
      big: new RockBatch(24, 24, rockMat),
    };
    for (const b of Object.values(this.batches)) scene.add(b.mesh);

    this.pools = { planet: [], gas: [], star: [], bh: [] };
    this.active = new Map();
    this.sphereGeo = new THREE.SphereGeometry(1, 96, 64);
    this.shellGeo = new THREE.SphereGeometry(1, 64, 40);
    this.beamGeo = new THREE.CylinderGeometry(1, 0, 1, 20, 6, true).translate(0, 0.5, 0);
    this.quadGeo = new THREE.PlaneGeometry(2, 2);

    this.glow = new InstBatch(96, new THREE.ShaderMaterial({
      uniforms: { uTime: shared.uTime }, vertexShader: glowVert, fragmentShader: glowFrag,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
    }), [['aGlow', 4], ['aGlow2', 3]]);
    this.glow.mesh.renderOrder = 20;
    scene.add(this.glow.mesh);

    this.outlines = new InstBatch(400, new THREE.ShaderMaterial({
      uniforms: { uViewH: shared.uViewH, uPixelRatio: { value: 1 } }, vertexShader: outlineVert, fragmentShader: outlineFrag,
      transparent: true, depthTest: false, depthWrite: false,
    }), [['aCol', 4]]);
    this.outlines.mesh.renderOrder = 100;
    overlayScene.add(this.outlines.mesh);
    this.outlineMat = this.outlines.mesh.material;

    this.beams = [];
    this.beamUsed = 0;
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(this.beamGeo, new THREE.ShaderMaterial({
        uniforms: { uTime: shared.uTime, uIntensity: { value: 1 }, uSeed: { value: i }, uColor: { value: new THREE.Vector3(1, 1, 1) } },
        vertexShader: beamVert, fragmentShader: beamFrag, transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide,
      }));
      m.visible = false; m.frustumCulled = false; m.renderOrder = 21; scene.add(m); this.beams.push(m);
    }

    this.bigs = new Int32Array(64);
    this.sky = null;                   // set by index.js (cube textures)
  }

  setQuality(q) { this.quality = q; }

  look(b) {
    const key = b.cls + '|' + b.stageId + '|' + b.seed + '|' + b.variant;
    let e = this.lookCache.get(key);
    if (e) return e;
    if (this.lookCache.size > 3000) this.lookCache.clear();
    const look = this.getLookRaw(b.cls, b.stageId, b.seed >>> 0, b.variant);
    e = { look, prep: this._prep(look, b) };
    this.lookCache.set(key, e);
    return e;
  }

  _prep(look, b) {
    const pal = look.palette || {};
    const colA = hexLinear(pal.base, [0, 0, 0]), colB = hexLinear(pal.accent || pal.base, [0, 0, 0]);
    const alb = look.albedo || [0.1, 0.2];
    const mid = alb[0] + (alb[1] - alb[0]) * frac01(b.seed, 3);
    const s = Math.min(1.7, Math.max(0.4, mid / Math.max(lum(colA), 0.02)));
    for (let i = 0; i < 3; i++) { colA[i] *= s; colB[i] *= s; }
    const ex = look.extras || {};
    const kind = ex.kind != null ? ex.kind : (look.emission && look.emission.cause === 'hot-ground' ? 2 : 0);
    return {
      colA, colB,
      P: [look.craters ? look.craters.density : 0, look.craters ? look.craters.sizeExp : 1, look.roughness == null ? 0.8 : look.roughness, ex.elongation == null ? 0.3 : ex.elongation],
      M: [look.metalness || 0, 1, kind, ex.lump == null ? 0.2 : ex.lump],
      terrestrial: !!ex.terrestrial,
    };
  }

  /** Emission actually allowed for this body, or null. Never trusts anything outside the whitelist. */
  _emission(b, ent) {
    const em = b.emissive;
    if (!em) return null;
    if (!causeAllowed(b.cls, em.cause, b.variant, b.entry)) {
      if (!this._warned) this._warned = new Set();
      const k = b.cls + ':' + em.cause;
      if (!this._warned.has(k)) { this._warned.add(k); console.warn('[render3d] emitter cause not allowed, ignored:', k); }
      return null;
    }
    return em;
  }

  _spinQuat(b, t, out) {
    const sp = b.spin;
    const ax = sp ? sp.axis : null;
    if (ax) quatAxisAngle(ax[0], ax[1], ax[2], sp.phase || 0, out); else quatAxisAngle(0, 1, 0, 0, out);
    return out;
  }

  _item(kind, b, build) {
    let it = this.active.get(b.id);
    if (it && (it.kind !== kind || it.owner !== b.id || it.used)) it = null;
    if (!it) {
      const pool = this.pools[kind];
      it = pool.find((p) => !p.used) || null;
      if (!it) { it = build(); pool.push(it); }
      it.kind = kind; it.cfgKey = null; it.owner = b.id;
    }
    it.used = true;
    return it;
  }

  begin() {
    for (const b of Object.values(this.batches)) b.begin();
    this.glow.begin(); this.outlines.begin();
    this.beamUsed = 0;
    this.emitters.length = 0;
    for (const k in this.pools) for (const it of this.pools[k]) it.used = false;
    this.counts.bodies = 0; this.counts.lo = this.counts.mid = this.counts.big = 0;
    this._nextActive = new Map();
  }

  end(dotsOverlayCtx) {
    for (const b of Object.values(this.batches)) b.end();
    this.glow.end(); this.outlines.end();
    for (let i = this.beamUsed; i < this.beams.length; i++) this.beams[i].visible = false;
    for (const k in this.pools) for (const it of this.pools[k]) { if (!it.used) it.root.visible = false; }
    this.active = this._nextActive;
  }

  _mark(b, it) { this._nextActive.set(b.id, it); }

  // ---------- main per-frame entry ----------
  update(state, ctx) {
    this.begin();
    const { camPos, viewMat, proj11, H, frustum, L, opts, hud, dots, time } = ctx;
    const n = state.bodies.length;
    // pass 1: collect big bodies for analytic eclipses
    let nb = 0;
    const consider = (b, i) => {
      if (nb < 64 && b.radius * proj11 * H * 0.5 / Math.max(1e-3, Math.hypot(b.p[0] - camPos[0], b.p[1] - camPos[1], b.p[2] - camPos[2])) > 12 &&
        b.cls !== 'blackHole' && b.cls !== 'debris' && b.cls !== 'fragment') this.bigs[nb++] = i;
    };
    const all = ctx.all;               // preallocated flat list built by index.js (player first)
    const total = all.length;
    for (let i = 0; i < total; i++) consider(all[i], i);
    this.nbig = nb;

    for (let i = 0; i < total; i++) this._drawBody(all[i], state, ctx, i);
    this.counts.bodies = total;
    this.end();
  }

  _occluders(b, ctx, o0, o1) {
    o0[0] = o0[1] = o0[2] = o0[3] = 0; o1[0] = o1[1] = o1[2] = o1[3] = 0;
    const L = ctx.L; const all = ctx.all;
    let best0 = 1e30, best1 = 1e30, i0 = -1, i1 = -1;
    for (let k = 0; k < this.nbig; k++) {
      const c = all[this.bigs[k]];
      if (c === b || c.radius < b.radius * 0.6) continue;
      const dx = c.p[0] - b.p[0], dy = c.p[1] - b.p[1], dz = c.p[2] - b.p[2];
      const t = dx * L[0] + dy * L[1] + dz * L[2];
      if (t <= 0) continue;
      const px = dx - L[0] * t, py = dy - L[1] * t, pz = dz - L[2] * t;
      if (Math.hypot(px, py, pz) > c.radius + b.radius + t * 0.02) continue;
      if (t < best0) { best1 = best0; i1 = i0; best0 = t; i0 = this.bigs[k]; } else if (t < best1) { best1 = t; i1 = this.bigs[k]; }
    }
    const put = (idx, o) => {
      if (idx < 0) return; const c = all[idx];
      _v.set(c.p[0], c.p[1], c.p[2]).applyMatrix4(ctx.viewMatrix4); o[0] = _v.x; o[1] = _v.y; o[2] = _v.z; o[3] = c.radius;
    };
    put(i0, o0); put(i1, o1);
  }

  _drawBody(b, state, ctx, idx) {
    const { camPos, proj11, H, frustum, opts } = ctx;
    const dx = b.p[0] - camPos[0], dy = b.p[1] - camPos[1], dz = b.p[2] - camPos[2];
    const dist = Math.max(1e-3, Math.hypot(dx, dy, dz));
    let R = b.radius;
    if (b.state === 'absorbing' && b.absorbT != null) R *= 1 - 0.7 * b.absorbT;
    const px = R * proj11 * H * 0.5 / dist;
    const cls = b.cls;
    const isSelf = b.rel === 'self';

    // ---- relation outline (overlay, HUD only) ----
    if (!isSelf && b.rel && px > 0.4 && ctx.relation) {
      const col = ctx.relation[b.rel];
      if (col) {
        const i = this.outlines.next();
        if (i >= 0) {
          this.outlines.setXYZS(i, b.p[0], b.p[1], b.p[2], R);
          const a = this.outlines.a.aCol.array, o = i * 4;
          const strong = opts.readability ? 1 : (b.rel === 'neutral' ? 0.0 : 0.55);
          a[o] = col[0]; a[o + 1] = col[1]; a[o + 2] = col[2];
          a[o + 3] = Math.min(1, strong * Math.min(1, px / 6 + 0.3));
        }
      }
    }

    const emitting = cls === 'star' || cls === 'neutronStar' || cls === 'blackHole';
    if (px < 1.25 && !emitting) { ctx.dots.addNear(b, R, ctx); return; }

    // cull (generous margin for glow/atmosphere)
    _v.set(b.p[0], b.p[1], b.p[2]);
    const margin = emitting ? 8 : 1.6;
    if (!frustum.intersectsSphere(ctx.sphere.set(_v, R * margin))) return;

    const ent = this.look(b);
    const em = this._emission(b, ent);
    if (em) this.emitters.push({ id: b.id, cls, cause: em.cause, intensity: em.intensity });

    switch (cls) {
      case 'star': case 'neutronStar': this._star(b, ent, em, R, dist, px, ctx); break;
      case 'blackHole': this._bh(b, ent, em, R, dist, px, ctx); break;
      case 'gasGiant': case 'brownDwarf': this._gas(b, ent, em, R, px, ctx); break;
      case 'rockyPlanet': if (ent.prep.terrestrial) { this._planet(b, ent, R, px, ctx); break; } // else rock path
      // fallthrough
      default: this._rock(b, ent, em, R, px, ctx, idx);
    }
  }

  // ---------- rock family (instanced) ----------
  _rock(b, ent, em, R, px, ctx, idx) {
    const big = px > 60 || ((b.cls === 'dwarfPlanet' || b.cls === 'rockyPlanet') && px > 20);
    const batch = big ? this.batches.big : (px > 14 ? this.batches.mid : this.batches.lo);
    const i = batch.next();
    if (i < 0) return;
    this.counts[big ? 'big' : (px > 14 ? 'mid' : 'lo')]++;
    const a = batch.a, p = ent.prep;
    this._spinQuat(b, ctx.time, _q1);
    if (SMALL.has(b.cls)) {            // tumble: second incommensurate rotation, cheap non-principal-axis look
      const t = ctx.time * 0.43 + frac01(b.seed, 7) * 20;
      quatAxisAngle(0.3, 0.2, 1, 0.5 * Math.sin(t) + 0.6, _q2);
      quatMul(_q1, _q2, _q3); _q1[0] = _q3[0]; _q1[1] = _q3[1]; _q1[2] = _q3[2]; _q1[3] = _q3[3];
    }
    writeTRS(batch.mesh.instanceMatrix.array, i * 16, b.p[0], b.p[1], b.p[2], _q1[0], _q1[1], _q1[2], _q1[3], b.state === 'absorbing' && b.absorbT != null ? b.radius * (1 - 0.7 * b.absorbT) : b.radius);
    a.seed.array[i] = seedFloat(b.seed);
    a.colA.array.set(p.colA, i * 3); a.colB.array.set(p.colB, i * 3);
    a.P.array.set(p.P, i * 4);
    const m = a.M.array, mo = i * 4;
    m[mo] = p.M[0]; m[mo + 1] = p.M[1]; m[mo + 2] = p.M[2]; m[mo + 3] = p.M[3];
    // emission (whitelisted only)
    let eT = 0, eI = 0;
    if (em) {
      const li = ent.look.emission, k = Math.max(0, Math.min(1.6, em.intensity == null ? 1 : em.intensity));
      switch (em.cause) {
        case 'hot-ground': eT = li ? li.temperatureK : 1500; eI = (li ? li.intensity : 1.5) * Math.max(0.3, k); m[mo + 2] = 2; break;
        case 'hot-debris': eT = 900 + 1700 * Math.min(1, k); eI = 2.2 * k; m[mo + 2] = 0; break;
        case 'ablation': case 'atmospheric-entry': eT = 3600; eI = 2.4 * k; break;
        case 'impact-flash': eT = 6000; eI = 3.2 * k; break;
        default: break;
      }
    } else if (m[mo + 2] === 2) m[mo + 2] = 0;           // lava kind without active emission cause stays plain rock
    a.E.array[i * 2] = eT; a.E.array[i * 2 + 1] = eI;
    // eclipses for large receivers only
    if (big || px > 40) { _o0.fill(0); _o1.fill(0); this._occluders(b, ctx, _o0, _o1); a.O0.array.set(_o0, i * 4); a.O1.array.set(_o1, i * 4); }
    else { a.O0.array.fill(0, i * 4, i * 4 + 4); a.O1.array.fill(0, i * 4, i * 4 + 4); }
    // Roche disruption stretch
    if (b.state === 'disrupting' && b.disrupt) {
      const ax = b.disrupt.axis || [1, 0, 0];
      a.S.array[i * 4] = ax[0]; a.S.array[i * 4 + 1] = ax[1]; a.S.array[i * 4 + 2] = ax[2]; a.S.array[i * 4 + 3] = b.disrupt.stretch * (0.3 + 0.7 * b.disrupt.progress);
    } else { a.S.array[i * 4] = 0; a.S.array[i * 4 + 1] = 1; a.S.array[i * 4 + 2] = 0; a.S.array[i * 4 + 3] = 0; }

    this._atmoAndRing(b, ent, R, px, ctx, false);
  }

  // ---------- terrestrial planet ----------
  _planet(b, ent, R, px, ctx) {
    const it = this._item('planet', b, () => {
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...this.shared, uSeed: { value: 0 }, uLand: { value: new THREE.Color() }, uOcean: { value: new THREE.Color() }, uHigh: { value: new THREE.Color() },
          uIce: { value: new THREE.Color() }, uRadius: { value: 1 }, uCloud: { value: .5 }, uWater: { value: .5 }, uOcc0: { value: new THREE.Vector4() }, uOcc1: { value: new THREE.Vector4() }, uStretch: { value: new THREE.Vector4() } },
        vertexShader: sphereVert, fragmentShader: planetFrag,
      });
      const mesh = new THREE.Mesh(this.sphereGeo, mat); mesh.frustumCulled = false; this.scene.add(mesh);
      return { root: mesh, mesh, mat, extras: {} };
    });
    this._mark(b, it);
    const u = it.mat.uniforms, pal = ent.look.palette, ex = ent.look.extras || {};
    if (it.cfgKey !== b.id + ':' + b.seed) {
      it.cfgKey = b.id + ':' + b.seed;
      u.uSeed.value = seedFloat(b.seed) * 0.013;
      u.uLand.value.set(pal.base); u.uOcean.value.set(pal.accent); u.uHigh.value.set(pal.shadow || pal.base); u.uIce.value.set((pal.extra && pal.extra[0]) || '#eef3f6');
      u.uCloud.value = ex.cloud == null ? 0.5 : ex.cloud; u.uWater.value = ex.water == null ? 0.5 : ex.water;
    }
    u.uRadius.value = R;
    this._place(it, b, R, ctx);
    this._occluders(b, ctx, _o0, _o1); u.uOcc0.value.fromArray(_o0); u.uOcc1.value.fromArray(_o1);
    this._stretch(it, b);
    this._atmoAndRing(b, ent, R, px, ctx, true);
  }

  // ---------- gas giant / brown dwarf ----------
  _gas(b, ent, em, R, px, ctx) {
    const it = this._item('gas', b, () => {
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...this.shared, uSeed: { value: 0 }, uBands: { value: 9 }, uWarp: { value: 1 }, uBase: { value: new THREE.Color() }, uAccent: { value: new THREE.Color() },
          uShade: { value: new THREE.Color() }, uStorm: { value: new THREE.Color() }, uHaze: { value: new THREE.Color() }, uHazeAmt: { value: .4 }, uEmit: { value: new THREE.Vector2() },
          uOcc0: { value: new THREE.Vector4() }, uOcc1: { value: new THREE.Vector4() }, uStretch: { value: new THREE.Vector4() } },
        vertexShader: sphereVert, fragmentShader: gasFrag,
      });
      const mesh = new THREE.Mesh(this.sphereGeo, mat); mesh.frustumCulled = false; this.scene.add(mesh);
      return { root: mesh, mesh, mat };
    });
    this._mark(b, it);
    const u = it.mat.uniforms, L = ent.look, pal = L.palette;
    if (it.cfgKey !== b.id + ':' + b.seed) {
      it.cfgKey = b.id + ':' + b.seed;
      u.uSeed.value = seedFloat(b.seed) * 0.017;
      u.uBands.value = L.bands ? L.bands.count : 9; u.uWarp.value = L.bands ? L.bands.warp : 1;
      u.uBase.value.set(pal.base); u.uAccent.value.set(pal.accent); u.uShade.value.set(pal.shadow || pal.base);
      u.uStorm.value.set((pal.extra && pal.extra[0]) || pal.accent);
      u.uHaze.value.set(L.atmosphere ? L.atmosphere.tint : pal.accent);
      u.uHazeAmt.value = L.atmosphere ? Math.min(1, L.atmosphere.thickness * 1.4) : 0.3;
    }
    // brown dwarf: only the whitelisted stellar-remnant cause may emit; gas giants never do
    if (b.cls === 'brownDwarf' && em && em.cause === 'stellar-remnant') {
      const li = L.emission;
      u.uEmit.value.set(li ? li.temperatureK : 1100, (li ? li.intensity : 0.5) * Math.max(0.3, em.intensity == null ? 1 : em.intensity));
    } else u.uEmit.value.set(0, 0);
    this._place(it, b, R, ctx);
    this._occluders(b, ctx, _o0, _o1); u.uOcc0.value.fromArray(_o0); u.uOcc1.value.fromArray(_o1);
    this._stretch(it, b);
    this._atmoAndRing(b, ent, R, px, ctx, false);
  }

  // ---------- star / neutron star ----------
  _star(b, ent, em, R, dist, px, ctx) {
    const it = this._item('star', b, () => {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: this.shared.uTime, uSeed: { value: 0 }, uTemp: { value: 5800 }, uIntensity: { value: 3 }, uCells: { value: 7 }, uSpots: { value: .5 }, uLimbU: { value: .6 }, uStretch: { value: new THREE.Vector4() } },
        vertexShader: sphereVert, fragmentShader: starFrag,
      });
      const mesh = new THREE.Mesh(this.sphereGeo, mat); mesh.frustumCulled = false; this.scene.add(mesh);
      return { root: mesh, mesh, mat };
    });
    this._mark(b, it);
    const L = ent.look, ex = L.extras || {}, u = it.mat.uniforms;
    const isNS = b.cls === 'neutronStar';
    const li = L.emission || { temperatureK: isNS ? 28000 : 5800, intensity: isNS ? 6 : 3 };
    // emission strictly from the whitelisted cause on the body (star / stellar-remnant / pulsar-beam)
    const k = em ? Math.max(0.2, Math.min(2, em.intensity == null ? 1 : em.intensity)) : 0;
    const T = b.temperatureK || li.temperatureK;
    u.uSeed.value = seedFloat(b.seed) * 0.01;
    u.uTemp.value = T; u.uIntensity.value = li.intensity * k;
    u.uCells.value = isNS ? 0 : (ex.cells != null && b.starClass == null ? ex.cells : (STAR_CELLS[b.starClass] || ex.cells || 7));
    u.uSpots.value = isNS ? 0 : (ex.spots == null ? 0.5 : ex.spots); u.uLimbU.value = ex.limbU == null ? 0.6 : ex.limbU;
    this._place(it, b, R, ctx, true);
    this._stretch(it, b);
    if (k <= 0) return;

    // corona / halo billboard (soft scatter sprite, scales with temperature colour)
    blackbodyRGB(T, _rgb); const mx = Math.max(_rgb[0], _rgb[1], _rgb[2], 1e-3);
    const minWorld = dist * 16 * (isNS ? 1 : 0.5) / (ctx.proj11 * ctx.H * 0.5);
    const size = Math.max(R * (isNS ? 6 : 2.6), minWorld);
    const gi = this.glow.next();
    if (gi >= 0) {
      this.glow.setXYZS(gi, b.p[0], b.p[1], b.p[2], size);
      const g = this.glow.a.aGlow.array, g2 = this.glow.a.aGlow2.array;
      g[gi * 4] = _rgb[0] / mx; g[gi * 4 + 1] = _rgb[1] / mx; g[gi * 4 + 2] = _rgb[2] / mx; g[gi * 4 + 3] = isNS ? 2.4 : 4.5;
      g2[gi * 3] = (isNS ? 0.9 : 0.3) * Math.min(1.5, k * 0.8 + 0.2) * (ex.corona == null ? 1 : ex.corona);
      g2[gi * 3 + 1] = Math.min(0.6, (R / size) * 0.92);
      g2[gi * 3 + 2] = frac01(b.seed, 1) * 30;
    }
    if (isNS && b.beam) {
      const pulse = 1 + (ctx.pulse.get(b.id) || 0);
      const ax = b.spin && b.spin.axis ? b.spin.axis : [0, 1, 0];
      _v.set(ax[0], ax[1], ax[2]).normalize();
      _v2.set(1, 0, 0); if (Math.abs(_v.x) > 0.9) _v2.set(0, 0, 1);
      _v2.cross(_v).normalize();                          // perpendicular to spin axis
      _qq.setFromAxisAngle(_v, b.beam.phase || 0);
      _v2.applyQuaternion(_qq);
      const len = Math.max(R * 28, ctx.camDist * 0.7);
      const w = Math.max(0.02, b.beam.width || 0.07);
      const col = _rgb2; blackbodyRGB(Math.max(T, 15000), col);
      const m2 = Math.max(col[0], col[1], col[2], 1e-3);
      for (let s = -1; s <= 1; s += 2) {
        if (this.beamUsed >= this.beams.length) break;
        const m = this.beams[this.beamUsed++];
        m.visible = true;
        m.position.set(b.p[0], b.p[1], b.p[2]);
        _qq.setFromUnitVectors(_v.set(0, 1, 0), _v2.clone().multiplyScalar(s));
        m.quaternion.copy(_qq);
        m.scale.set(len * Math.tan(w), len, len * Math.tan(w));
        const mu = m.material.uniforms;
        mu.uColor.value.set(col[0] / m2, col[1] / m2, col[2] / m2); mu.uIntensity.value = 1.1 * pulse * (ctx.opts.reducedMotion ? 0.6 : 1);
      }
    }
  }

  // ---------- black hole ----------
  _bh(b, ent, em, R, dist, px, ctx) {
    const it = this._item('bh', b, () => {
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...this.shared, uCenter: { value: new THREE.Vector3() }, uR: { value: 1 }, uHalf: { value: 6 }, uDiscN: { value: new THREE.Vector3(0, 1, 0) }, uDiscE1: { value: new THREE.Vector3(1, 0, 0) },
          uDiscT: { value: 7500 }, uDiscI: { value: 1 }, uLens: { value: 1 }, uSteps: { value: 96 },
          uCubeA: { value: null }, uCubeB: { value: null }, uSkyMix: { value: 0 }, uSkyGain: { value: 1 },
          uSkyA: { value: new THREE.Color() }, uSkyB: { value: new THREE.Color() }, uSkySeed: { value: 1 }, uSkyDensity: { value: .5 } },
        vertexShader: bhVert, fragmentShader: bhFrag, transparent: true, depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.quadGeo, mat); mesh.frustumCulled = false; mesh.renderOrder = 10; this.scene.add(mesh);
      return { root: mesh, mesh, mat };
    });
    this._mark(b, it);
    const u = it.mat.uniforms, sky = this.sky;
    if (sky) { u.uCubeA.value = sky.texA; u.uCubeB.value = sky.texB; u.uSkyMix.value = sky.mix; u.uSkyGain.value = sky.gain; u.uSkySeed.value = sky.seed; u.uSkyDensity.value = sky.density; }
    // presentation axis: the disc leans ~62 deg away from the view direction so it reads at any camera pitch
    this._bhAxis(b, ctx, _v, _v2);
    const feeding = b.feeding || 0;
    const lens = 1 + 0.45 * (ctx.captureLevelFor(b.id)) + (ctx.lensPulse || 0);
    u.uCenter.value.set(b.p[0], b.p[1], b.p[2]);
    u.uR.value = R;
    const half = R * 6.2 * Math.min(1.6, lens);
    u.uHalf.value = half; it.mesh.position.set(0, 0, 0);
    u.uDiscN.value.copy(_v).transformDirection(ctx.viewMatrix4);
    u.uDiscE1.value.copy(_v2).transformDirection(ctx.viewMatrix4);
    const li = ent.look.emission || { temperatureK: 7500, intensity: 1.5 };
    const discOn = em && (em.cause === 'accretion' || em.cause === 'jet');
    u.uDiscI.value = discOn ? li.intensity * (0.55 + 0.45 * Math.min(1.5, em.intensity == null ? 1 : em.intensity)) * (1 + feeding * 0.8) : 0;
    u.uDiscT.value = li.temperatureK * (1 + feeding * 0.15);
    u.uLens.value = lens;
    u.uSteps.value = this.quality === 'low' ? 40 : this.quality === 'med' ? 72 : 110;
    // jets: only while feeding, only if the whitelist allows the cause
    if (feeding > 0.02 && em && (em.cause === 'jet' || em.cause === 'accretion') && causeAllowed('blackHole', 'jet')) {
      this.emitters.push({ id: b.id, cls: 'blackHole', cause: 'jet', intensity: feeding });
      const len = R * 14, w = 0.09;
      for (let s = -1; s <= 1; s += 2) {
        if (this.beamUsed >= this.beams.length) break;
        const m = this.beams[this.beamUsed++];
        m.visible = true; m.position.set(b.p[0], b.p[1], b.p[2]);
        m.quaternion.setFromUnitVectors(_v2.set(0, 1, 0), _qq_dir.copy(_v).multiplyScalar(s));
        m.scale.set(len * w, len, len * w);
        const mu = m.material.uniforms; mu.uColor.value.set(0.55, 0.7, 1.0); mu.uIntensity.value = 1.6 * feeding;
      }
    }
  }

  _bhAxis(b, ctx, nOut, e1Out) {
    const cp = ctx.pitch, sp = Math.sin(cp), cc = Math.cos(cp);
    const cam = _v3.set(0, sp, cc), perp = _v4.set(0, cc, -sp);
    const lean = 62 * Math.PI / 180, yaw = frac01(b.seed, 11) * 6.2832;
    nOut.copy(cam).multiplyScalar(Math.cos(lean)).addScaledVector(perp, Math.sin(lean));
    _qq.setFromAxisAngle(cam, yaw); nOut.applyQuaternion(_qq).normalize();
    e1Out.set(1, 0, 0); if (Math.abs(nOut.x) > 0.9) e1Out.set(0, 0, 1);
    e1Out.cross(nOut).normalize();
  }

  _place(it, b, R, ctx, noSpinLights) {
    const m = it.mesh; m.visible = true;
    m.position.set(b.p[0], b.p[1], b.p[2]);
    m.scale.setScalar(R);
    this._spinQuat(b, ctx.time, _q1);
    m.quaternion.set(_q1[0], _q1[1], _q1[2], _q1[3]);
  }
  _stretch(it, b) {
    const s = it.mat.uniforms.uStretch.value;
    if (b.state === 'disrupting' && b.disrupt) { const ax = b.disrupt.axis || [1, 0, 0]; s.set(ax[0], ax[1], ax[2], b.disrupt.stretch * (0.3 + 0.7 * b.disrupt.progress)); }
    else s.set(0, 1, 0, 0);
  }

  // ---------- atmosphere shell + ring (pooled by body id) ----------
  _atmoAndRing(b, ent, R, px, ctx, terrestrial) {
    if (px < 3) return;
    const L = ent.look;
    const wantAtmo = b.atmosphere && b.atmosphere.density > 0 && (L.atmosphere || terrestrial);
    const wantRing = b.ring && (b.cls === 'gasGiant' || b.cls === 'brownDwarf' || b.cls === 'rockyPlanet' || b.cls === 'dwarfPlanet');
    if (!wantAtmo && !wantRing) return;
    let ex = this.extraFor(b.id);
    ex.used = true;
    if (wantAtmo) {
      const at = L.atmosphere || { tint: '#5d9bff', thickness: 1, mie: 0.5 };
      const sh = b.atmosphere.shellHeight;
      const frac = Math.min(0.5, Math.max(0.02, sh <= 0.6 ? sh : sh / R));
      const Rs = R * (1 + frac);
      const m = ex.shell; m.visible = true;
      m.position.set(b.p[0], b.p[1], b.p[2]); m.scale.setScalar(Rs);
      const u = m.material.uniforms;
      _v.set(b.p[0], b.p[1], b.p[2]).applyMatrix4(ctx.viewMatrix4);
      u.uCenter.value.copy(_v); u.uRp.value = R; u.uRs.value = Rs;
      u.uTint.value.set(at.tint); u.uThick.value = at.thickness * (0.4 + 0.6 * Math.min(1, b.atmosphere.density)); u.uMie.value = at.mie;
      this._occluders(b, ctx, _o0, _o1); u.uOcc0.value.fromArray(_o0);
      const inside = ctx.camDistTo(b.p) < Rs;
      m.material.side = inside ? THREE.BackSide : THREE.FrontSide; m.material.depthTest = !inside;
    } else ex.shell.visible = false;
    if (wantRing) {
      const m = ex.ring; m.visible = true;
      const rg = b.ring;
      if (ex.ringKey !== rg.inner + ':' + rg.outer) { ex.ringKey = rg.inner + ':' + rg.outer; this._buildRing(ex, rg); }
      m.position.set(b.p[0], b.p[1], b.p[2]); m.scale.setScalar(R);
      const ax = b.spin && b.spin.axis ? b.spin.axis : [0, 1, 0];
      _v.set(ax[0], ax[1], ax[2]).normalize();
      _qq.setFromAxisAngle(_v2.set(1, 0, 0), rg.tilt || 0); _v.applyQuaternion(_qq);
      m.quaternion.setFromUnitVectors(_v2.set(0, 0, 1), _v);
      const u = m.material.uniforms;
      u.uSeed.value = seedFloat(b.seed) * 0.1;
      const pal = L.palette; u.uColA.value.set(pal.accent); u.uColB.value.set(pal.base);
      u.uNormalView.value.copy(_v).transformDirection(ctx.viewMatrix4);
      _v2.set(b.p[0], b.p[1], b.p[2]).applyMatrix4(ctx.viewMatrix4); u.uPlanet.value.copy(_v2); u.uPlanetR.value = R;
    } else ex.ring.visible = false;
  }
  extraFor(id) {
    if (!this.extras) { this.extras = new Map(); }
    let ex = this.extras.get(id);
    if (!ex) {
      // recycle an unused one
      for (const [k, e] of this.extras) { if (!e.used) { this.extras.delete(k); ex = e; break; } }
      if (!ex) {
        const shell = new THREE.Mesh(this.shellGeo, new THREE.ShaderMaterial({
          uniforms: { ...this.shared, uCenter: { value: new THREE.Vector3() }, uRp: { value: 1 }, uRs: { value: 1.1 }, uTint: { value: new THREE.Color() }, uThick: { value: 1 }, uMie: { value: .5 }, uOcc0: { value: new THREE.Vector4() } },
          vertexShader: atmoVert, fragmentShader: atmoFrag, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        shell.frustumCulled = false; shell.renderOrder = 15; shell.visible = false; this.scene.add(shell);
        const ring = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
          uniforms: { ...this.shared, uSeed: { value: 1 }, uColA: { value: new THREE.Color() }, uColB: { value: new THREE.Color() }, uNormalView: { value: new THREE.Vector3(0, 1, 0) }, uPlanet: { value: new THREE.Vector3() }, uPlanetR: { value: 1 } },
          vertexShader: ringVert, fragmentShader: ringFrag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        }));
        ring.frustumCulled = false; ring.renderOrder = 12; ring.visible = false; this.scene.add(ring);
        ex = { shell, ring, ringKey: null };
      }
      this.extras.set(id, ex);
    }
    return ex;
  }
  _buildRing(ex, rg) {
    const g = new THREE.RingGeometry(rg.inner, rg.outer, 128, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      pos.setZ(i, (r - rg.inner) / (rg.outer - rg.inner));
    }
    ex.ring.geometry.dispose(); ex.ring.geometry = g;
  }
  /** Called once per frame after update(): hide extras whose body is gone/not requested. */
  finishExtras() {
    if (!this.extras) return;
    for (const [id, e] of this.extras) { if (!e.used) { e.shell.visible = false; e.ring.visible = false; } e.used = false; }
  }
}

const _o0 = new Float32Array(4), _o1 = new Float32Array(4);
const _qq_dir = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
