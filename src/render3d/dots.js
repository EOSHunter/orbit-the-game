// Far-field impostors (state.far) and sub-pixel near bodies as one Points draw call.
import * as THREE from 'three';
import { dotsVert, dotsFrag } from './glsl/misc.js';
import { blackbodyRGB } from './util.js';

const CAP = 30000;

export class DotsLayer {
  constructor(scene, shared, clsList) {
    this.clsList = clsList; this.count = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(CAP * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.size = new THREE.BufferAttribute(new Float32Array(CAP), 1).setUsage(THREE.DynamicDrawUsage);
    this.col = new THREE.BufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos); g.setAttribute('aSize', this.size); g.setAttribute('aColor', this.col);
    this.uniforms = { uViewH: shared.uViewH, uPixelRatio: { value: 1 } };
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: dotsVert, fragmentShader: dotsFrag, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false; this.points.renderOrder = 5;
    scene.add(this.points);
    this._rgb = [0, 0, 0];
  }
  begin() { this.count = 0; }
  _push(x, y, z, size, r, g, b, a) {
    if (this.count >= CAP) return;
    const i = this.count++;
    this.pos.array[i * 3] = x; this.pos.array[i * 3 + 1] = y; this.pos.array[i * 3 + 2] = z;
    this.size.array[i] = size;
    this.col.array[i * 4] = r; this.col.array[i * 4 + 1] = g; this.col.array[i * 4 + 2] = b; this.col.array[i * 4 + 3] = a;
  }
  addFar(far, keyK) {
    if (!far || !far.count) return;
    const k = 0.3 + 0.5 * keyK, rgb = this._rgb, cl = this.clsList;
    for (let i = 0; i < far.count && this.count < CAP; i++) {
      const name = cl[far.cls[i]];
      let r, g, b;
      switch (name) {
        case 'star': { blackbodyRGB(far.temp[i] || 5800, rgb); const m = Math.max(rgb[0], rgb[1], rgb[2], 1e-3); r = rgb[0] / m * 1.3; g = rgb[1] / m * 1.3; b = rgb[2] / m * 1.3; break; }
        case 'neutronStar': r = 1.4; g = 1.8; b = 3; break;
        case 'blackHole': r = g = b = 0; break;
        case 'gasGiant': r = 0.55 * k; g = 0.45 * k; b = 0.32 * k; break;
        case 'brownDwarf': r = 0.18 * k; g = 0.05 * k; b = 0.07 * k; break;
        case 'rockyPlanet': case 'dwarfPlanet': r = 0.34 * k; g = 0.38 * k; b = 0.46 * k; break;
        default: r = 0.4 * k; g = 0.38 * k; b = 0.36 * k;
      }
      this._push(far.p[i * 3], far.p[i * 3 + 1], far.p[i * 3 + 2], far.size[i], r, g, b, 0);
    }
  }
  addNear(b, R, ctx) {
    const ent = ctx.bodies.look(b), c = ent.prep.colA, k = 0.5 * ctx.keyI;
    this._push(b.p[0], b.p[1], b.p[2], R, c[0] * k, c[1] * k, c[2] * k, 1);
  }
  end(pixelRatio) {
    this.uniforms.uPixelRatio.value = pixelRatio;
    const n = this.count;
    for (const [a, s] of [[this.pos, 3], [this.size, 1], [this.col, 4]]) { a.clearUpdateRanges(); if (n) a.addUpdateRange(0, n * s); a.needsUpdate = true; }
    this.points.geometry.setDrawRange(0, n);
    this.points.visible = n > 0;
  }
}
