// Procedural skybox: nebula + dust baked once to a cubemap (cross-faded between stages via two cubes),
// plus a crisp Points layer of bright stars. Baking is the only expensive step and runs on change only.
import * as THREE from 'three';
import { skyBakeVert, skyBakeFrag, skyVert, skyFrag, starsVert, starsFrag } from './glsl/misc.js';
import { blackbodyRGB } from './util.js';

const STARS = 140;

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class Sky {
  constructor(renderer, scene, size = 1024) {
    this.renderer = renderer;
    const mk = () => new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.rts = [mk(), mk()];
    this.cur = 0; this.fade = 0; this.fadeDur = 2.5; this.fading = false;
    this.mix = 0; this.gain = 0.8; this.seed = 1; this.density = 0.5; this.key = '';
    this.params = { A: new THREE.Color('#04101f'), B: new THREE.Color('#2a6aa8') };

    this.bakeUniforms = { uSkyA: { value: new THREE.Color() }, uSkyB: { value: new THREE.Color() }, uSkySeed: { value: 1 }, uSkyDensity: { value: .5 } };
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
  }

  get texA() { return this.rts[this.cur].texture; }
  get texB() { return this.rts[1 - this.cur].texture; }

  _bake(rt, seed, tintA, tintB, density) {
    const u = this.bakeUniforms;
    u.uSkyA.value.set(tintA); u.uSkyB.value.set(tintB); u.uSkySeed.value = seed; u.uSkyDensity.value = density;
    this.cubeCam.renderTarget = rt;
    this.cubeCam.update(this.renderer, this.bakeScene);
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
      const b = i < n ? 0.04 + 0.35 * mag : 0;
      col[i * 4] = rgb[0] / mx * 0.85 + 0.15; col[i * 4 + 1] = rgb[1] / mx * 0.9 + 0.1; col[i * 4 + 2] = rgb[2] / mx; col[i * 4 + 3] = b;
      px[i] = 1.0 + 0.5 * mag;
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
    this.uniforms.uCubeA.value = this.texA; this.uniforms.uCubeB.value = this.texB;
  }

  update(dt, viewH, pixelRatio) {
    if (this.fading) {
      this.fade += dt / this.fadeDur;
      if (this.fade >= 1) { this.fading = false; this.cur = 1 - this.cur; this.mix = 0; }
      else this.mix = this.fade * this.fade * (3 - 2 * this.fade);
    }
    this.uniforms.uCubeA.value = this.texA; this.uniforms.uCubeB.value = this.texB; this.uniforms.uSkyMix.value = this.mix;
    this.starUniforms.uViewH.value = viewH; this.starUniforms.uPixelRatio.value = pixelRatio;
  }

  dispose() { this.rts.forEach((r) => r.dispose()); this.mesh.geometry.dispose(); this.stars.geometry.dispose(); }
}
