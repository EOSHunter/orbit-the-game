// Offscreen single-body preview (used by the evolution choice cards). Draws one body with the real BodyLayer
// shaders, the stage's key light and the same bloom + tone-map chain as the game, into a small 2D canvas.
// It owns its own scene and render targets and shares only the WebGLRenderer; it never touches the game scene.
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BodyLayer, makeShared } from './bodies.js';
import { blackbodyRGB, hexLinear } from './util.js';

const FOV = 38, PITCH = 58 * Math.PI / 180;
const KEY_DIR = new THREE.Vector3(-0.6, 0.55, -0.45).normalize();   // from the upper left, like a lit-from-the-side product shot

/** Half-width of the framed region in body radii: leaves room for rings, atmosphere shell, corona and the black-hole disc. */
function frameExtent(b) {
  if (b.ring) return b.ring.outer * 1.1;
  if (b.cls === 'blackHole') return 3.4;
  if (b.cls === 'star' || b.cls === 'neutronStar') return 2.1;
  if (b.atmosphere) return 1.4;
  return 1.18;
}

export class PreviewRenderer {
  constructor({ renderer, looks, clsList, sky, size = 256 }) {
    this.R = renderer; this.looks = looks; this.size = size;
    this.scene = new THREE.Scene(); this.overlay = new THREE.Scene();
    this.shared = makeShared();
    this.layer = new BodyLayer({ scene: this.scene, overlayScene: this.overlay, shared: this.shared, getLook: looks.getLook, clsList, quality: 'high' });
    this.layer.sky = sky;
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 1e9);
    this.frustum = new THREE.Frustum(); this.sphere = new THREE.Sphere(); this.pv = new THREE.Matrix4();
    this.rt = new THREE.WebGLRenderTarget(size, size, { type: THREE.HalfFloatType, samples: 4 });
    this.rtOut = new THREE.WebGLRenderTarget(size, size, { type: THREE.UnsignedByteType });
    const P = looks.PRESETS;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size, size), P.bloom.strength, P.bloom.radius, P.bloom.threshold);
    this.output = new OutputPass();
    this.pixels = new Uint8Array(size * size * 4);
    this.noDots = { addNear() {} };
    this.pulse = new Map();
  }

  /** Render `body` (a detached sim body) to a new size x size canvas. Black background: blend it with `screen`. */
  render(body) {
    const { R, size, camera, shared, layer } = this;
    const P = this.looks.PRESETS;
    const sp = P.stages[body.stageId] || P.stages.star || Object.values(P.stages)[0];
    const b = { ...body, p: [0, 0, 0], v: [0, 0, 0] };

    const dist = (b.radius * frameExtent(b)) / Math.tan(FOV * Math.PI / 360);
    const cam = [0, Math.sin(PITCH) * dist, Math.cos(PITCH) * dist];
    camera.position.set(cam[0], cam[1], cam[2]); camera.lookAt(0, 0, 0);
    camera.near = dist * 0.01; camera.far = dist * 1e3; camera.updateProjectionMatrix();
    camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    this.pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); this.frustum.setFromProjectionMatrix(this.pv);

    // key light + ambient exactly as the game derives them from the stage preset
    const rgb = blackbodyRGB(sp.keyColorK, [0, 0, 0]);
    const m = Math.max(rgb[0], rgb[1], rgb[2], 1e-3);
    shared.uKeyDir.value.copy(KEY_DIR).transformDirection(camera.matrixWorldInverse);
    shared.uKeyColor.value.set(rgb[0] / m * sp.keyIntensity, rgb[1] / m * sp.keyIntensity, rgb[2] / m * sp.keyIntensity);
    const amb = hexLinear(sp.ambient, [0, 0, 0]);
    shared.uAmbient.value.set(amb[0] * sp.ambientIntensity, amb[1] * sp.ambientIntensity, amb[2] * sp.ambientIntensity);
    shared.uViewH.value = size;

    const ctx = {
      camPos: cam, viewMatrix4: camera.matrixWorldInverse, proj11: camera.projectionMatrix.elements[5], H: size,
      frustum: this.frustum, sphere: this.sphere, L: [KEY_DIR.x, KEY_DIR.y, KEY_DIR.z], opts: { reducedMotion: true, readability: false, topDown: false },
      time: 0, all: [b], dots: this.noDots, pulse: this.pulse, relation: null, keyI: 1, camDist: dist, pixelRatio: 1, lensPulse: 0, pitch: PITCH,
      captureLevelFor: () => 0, camDistTo: (p) => Math.hypot(p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]),
    };
    layer.update({ bodies: [] }, ctx);
    layer.finishExtras();

    const prevTarget = R.getRenderTarget(), prevExposure = R.toneMappingExposure;
    try {
      R.toneMappingExposure = P.exposure.day;
      R.setRenderTarget(this.rt); R.clear(); R.render(this.scene, camera);
      this.bloom.render(R, null, this.rt, 0, false);
      this.output.render(R, this.rtOut, this.rt);
      R.readRenderTargetPixels(this.rtOut, 0, 0, size, size, this.pixels);
    } finally {
      R.setRenderTarget(prevTarget); R.toneMappingExposure = prevExposure;
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const img = new ImageData(size, size), row = size * 4;
    for (let y = 0; y < size; y++) img.data.set(this.pixels.subarray((size - 1 - y) * row, (size - y) * row), y * row);   // GL rows are bottom-up
    canvas.getContext('2d').putImageData(img, 0, 0);
    return canvas;
  }

  dispose() { this.rt.dispose(); this.rtOut.dispose(); this.bloom.dispose(); this.output.dispose(); }
}
