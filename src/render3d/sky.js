// Procedural skybox: nebula + dust baked once to a cubemap (cross-faded between stages via two cubes),
// plus a crisp Points layer of bright stars. Baking is the only expensive step and runs on change only.
import * as THREE from 'three';
import { skyBakeVert, skyBakeFrag, skyVert, skyFrag, starsVert, starsFrag, speckVert, speckFrag } from './glsl/misc.js';
import { blackbodyRGB } from './util.js';

// ---- tunables: deep-space look ----
const NEBULA_COLORS = ['#5b2a9a', '#1f8c9a', '#2a4fb0', '#b04a8a'];  // deep purple, teal, blue, warm magenta
const NEBULA_STRENGTH = 0.12;        // overall cloud brightness (keep low so small bodies stay readable)
const NEBULA_SCALE = 1.5;            // cloud size: lower = larger clouds
const NEBULA_COVERAGE = 0.14;        // 0..0.4, higher = more of the sky covered by cloud
const BAND_STRENGTH = 1.0;           // faint galactic band tint (0 = off)
const GALAXY_COUNT = 9;              // max 12
const GALAXY_SIZE = [0.014, 0.045];  // angular radius range, radians
const GALAXY_BRIGHTNESS = [0.5, 1.1];
const STARS = 700;
const SPECKS = 6000;
const PLANE = [0.3, 0.9, 0.35];

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Sky {
  constructor(renderer, scene, size = 1024) {
    this.renderer = renderer;
    const mk = () => new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.rts = [mk(), mk()];
    this.cur = 0; this.fade = 0; this.fadeDur = 2.5; this.fading = false;
    this.mix = 0; this.gain = 1.3; this.seed = 1; this.density = 0.5; this.key = '';
    this.params = { A: new THREE.Color('#04101f'), B: new THREE.Color('#2a6aa8') };

    this.bakeUniforms = { uSkyA: { value: new THREE.Color() }, uSkyB: { value: new THREE.Color() }, uSkySeed: { value: 1 }, uSkyDensity: { value: .5 },
      uNebCol: { value: NEBULA_COLORS.map((c) => new THREE.Color(c)) },
      uNebCfg: { value: new THREE.Vector4(NEBULA_STRENGTH, NEBULA_SCALE, NEBULA_COVERAGE, BAND_STRENGTH) },
      uGalA: { value: Array.from({ length: 12 }, () => new THREE.Vector4(0, 1, 0, 0.02)) },
      uGalB: { value: Array.from({ length: 12 }, () => new THREE.Vector4()) } };
    this.bakeScene = new THREE.Scene();
    this.bakeScene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.ShaderMaterial({ uniforms: this.bakeUniforms, vertexShader: skyBakeVert, fragmentShader: skyBakeFrag, side: THREE.BackSide, depthTest: false })));
    this.cubeCam = new THREE.CubeCamera(0.1, 10, this.rts[0]);

    this.uniforms = { uCubeA: { value: this.rts[0].texture }, uCubeB: { value: this.rts[1].texture }, uSkyMix: { value: 0 }, uSkyGain: { value: this.gain } };
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: skyVert, fragmentShader: skyFrag, depthTest: false, depthWrite: false, side: THREE.BackSide }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -100;
    scene.add(this.mesh);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STARS * 3), 3));
    g.setAttribute('aStar', new THREE.BufferAttribute(new Float32Array(STARS * 4), 4));
    g.setAttribute('aPx', new THREE.BufferAttribute(new Float32Array(STARS), 1));
    this.starUniforms = { uSkyGain: this.uniforms.uSkyGain, uViewH: { value: 1080 }, uPixelRatio: { value: 1 } };
    this.stars = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.starUniforms, vertexShader: starsVert, fragmentShader: starsFrag, transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.stars.frustumCulled = false; this.stars.renderOrder = -99;
    scene.add(this.stars);

    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPECKS * 3), 3));
    sg.setAttribute('aStar', new THREE.BufferAttribute(new Float32Array(SPECKS * 4), 4));
    this.speckUniforms = { uSkyGain: this.uniforms.uSkyGain, uPixelRatio: { value: 1 } };
    this.specks = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: this.speckUniforms, vertexShader: speckVert, fragmentShader: speckFrag, transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.specks.frustumCulled = false; this.specks.renderOrder = -101;
    scene.add(this.specks);
  }

  // thousands of dim flat dots, denser toward a galactic plane
  _fillSpecks(seed) {
    const r = mulberry((seed * 104729 + 17) | 0);
    const pos = this.specks.geometry.attributes.position.array, col = this.specks.geometry.attributes.aStar.array;
    const pl = Math.hypot(...PLANE), nx = PLANE[0] / pl, ny = PLANE[1] / pl, nz = PLANE[2] / pl;
    for (let i = 0; i < SPECKS; i++) {
      let x, y, z;
      for (;;) {
        z = r() * 2 - 1; const a = r() * Math.PI * 2, s = Math.sqrt(1 - z * z);
        x = s * Math.cos(a); y = z; z = s * Math.sin(a);
        const h = x * nx + y * ny + z * nz;
        if (r() < 0.22 + 0.78 * Math.exp(-(h * 2.8) * (h * 2.8))) break;
      }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const t = r(), m = r();
      col[i * 4] = 0.8 + 0.2 * t; col[i * 4 + 1] = 0.9; col[i * 4 + 2] = 1.0 - 0.2 * t;
      col[i * 4 + 3] = 0.22 + 0.55 * m * m;
    }
    for (const k of ['position', 'aStar']) this.specks.geometry.attributes[k].needsUpdate = true;
  }

  get texA() { return this.rts[this.cur].texture; }
  get texB() { return this.rts[1 - this.cur].texture; }

  _bake(rt, seed, tintA, tintB, density) {
    const u = this.bakeUniforms;
    this._layoutGalaxies(seed);
    u.uSkyA.value.set(tintA); u.uSkyB.value.set(tintB); u.uSkySeed.value = seed; u.uSkyDensity.value = density;
    this.cubeCam.renderTarget = rt;
    this.cubeCam.update(this.renderer, this.bakeScene);
  }

  _layoutGalaxies(seed) {
    const r = mulberry((seed * 15485863) | 0 || 7), A = this.bakeUniforms.uGalA.value, B = this.bakeUniforms.uGalB.value;
    for (let i = 0; i < 12; i++) {
      if (i >= GALAXY_COUNT) { B[i].set(0, 0, 0, 0); continue; }
      // spread by stratifying latitude so galaxies are placed around the whole sky, not clumped
      const z = -1 + 2 * ((i + r()) / GALAXY_COUNT), a = r() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      const sz = GALAXY_SIZE[0] + (GALAXY_SIZE[1] - GALAXY_SIZE[0]) * r() * r();
      A[i].set(s * Math.cos(a), z, s * Math.sin(a), sz);
      B[i].set(r() * Math.PI, 0.15 + 0.7 * r(), GALAXY_BRIGHTNESS[0] + (GALAXY_BRIGHTNESS[1] - GALAXY_BRIGHTNESS[0]) * r(), r() < 0.5 ? 0.9 : 0.2);
    }
  }

  _fillStars(seed, density) {
    const r = mulberry((seed * 7919) | 0);
    const pos = this.stars.geometry.attributes.position.array, col = this.stars.geometry.attributes.aStar.array, px = this.stars.geometry.attributes.aPx.array;
    const rgb = [0, 0, 0];
    const n = Math.floor(STARS * (0.5 + 0.5 * Math.min(1, density + 0.2)));
    for (let i = 0; i < STARS; i++) {
      const z = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      pos[i * 3] = s * Math.cos(a); pos[i * 3 + 1] = z; pos[i * 3 + 2] = s * Math.sin(a);
      const m = r(), K = 3200 + 9000 * r() * r();
      blackbodyRGB(K, rgb); const mx = Math.max(rgb[0], rgb[1], rgb[2], 1e-3);
      const mag = Math.pow(m, 6);                       // few bright, many faint
      const b = i < n ? 0.9 + 4 * mag : 0;
      col[i * 4] = rgb[0] / mx * 0.85 + 0.15; col[i * 4 + 1] = rgb[1] / mx * 0.9 + 0.1; col[i * 4 + 2] = rgb[2] / mx; col[i * 4 + 3] = b;
      px[i] = 2.0 + 2.2 * mag;
    }
    for (const k of ['position', 'aStar', 'aPx']) this.stars.geometry.attributes[k].needsUpdate = true;
  }

  /** params: { seed, level, density, tintA, tintB }. Bakes lazily; cross-fades on change. */
  set(p, instant) {
    const key = [p.seed, p.level, p.tintA, p.tintB, Math.round(p.density * 20)].join('|');
    if (key === this.key) return;
    const first = this.key === '';
    this.key = key;
    this.seed = (p.seed % 997) * 0.01 + 0.3; this.density = p.density;
    if (first || instant) {
      this._bake(this.rts[this.cur], this.seed, p.tintA, p.tintB, p.density);
      this.fading = false; this.mix = 0;
    } else {
      this._bake(this.rts[1 - this.cur], this.seed, p.tintA, p.tintB, p.density);
      this.fading = true; this.fade = 0;
    }
    this._fillStars(p.seed, p.density);
    this._fillSpecks(p.seed);
    this.uniforms.uCubeA.value = this.texA; this.uniforms.uCubeB.value = this.texB;
  }

  update(dt, viewH, pixelRatio) {
    if (this.fading) {
      this.fade += dt / this.fadeDur;
      if (this.fade >= 1) { this.fading = false; this.cur = 1 - this.cur; this.mix = 0; }
      else this.mix = this.fade * this.fade * (3 - 2 * this.fade);
    }
    this.uniforms.uCubeA.value = this.texA; this.uniforms.uCubeB.value = this.texB; this.uniforms.uSkyMix.value = this.mix;
    this.starUniforms.uViewH.value = viewH; this.starUniforms.uPixelRatio.value = pixelRatio; this.speckUniforms.uPixelRatio.value = pixelRatio;
  }

  dispose() { this.rts.forEach((r) => r.dispose()); this.mesh.geometry.dispose(); this.stars.geometry.dispose(); this.specks.geometry.dispose(); }
}
