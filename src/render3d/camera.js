// Angled top-down chase camera (north-up, play plane = x-z) with a top-down toggle.
// Distance is proportional to the player's radius; positions are origin-relative so float32 upload is safe.
import * as THREE from 'three';

const D2R = Math.PI / 180;
const _m = new THREE.Matrix4(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3(), _z = new THREE.Vector3();

export class ChaseCamera {
  constructor(camera, presets) {
    this.camera = camera;
    this.cfg = presets;
    this.target = [0, 0, 0];
    this.dist = 200; this.pitch = (presets.pitchDeg || 58) * D2R;
    this.pull = 0; this.snap = true;
    this.shakeT = 0;
    this.pos = [0, 0, 0];
    this.fov = presets.fovDeg || 38;
  }
  setPresets(p) { this.cfg = p; }
  rebase(s) { this.target[0] -= s[0]; this.target[1] -= s[1]; this.target[2] -= s[2]; }
  onEvolve() { this.pull = 1; }
  reset() { this.snap = true; this.pull = 0; }

  update(state, dt, o) {
    const cfg = this.cfg, pl = state.player;
    if (!pl) return;
    const R = Math.max(pl.radius, 0.5);
    const hud = state.hud;
    // pull-back on evolve (ease in/out), plus a ~15 degree pitch bump
    this.pull = Math.max(0, this.pull - dt / 2.4);
    const pb = Math.sin(Math.min(1, this.pull) * Math.PI);          // 0 -> 1 -> 0
    const pbk = o.reducedMotion ? 0.35 : 1;
    let dTarget = (cfg.distanceFactor || 26) * R * (1 + 0.85 * pb * pbk);
    // pitch: toggle, readability, and a gentle auto-tilt (up when threats are close, down when thrusting)
    let pTarget = (cfg.pitchDeg || 58) * D2R;
    const topDown = o.topDown || o.readability;
    if (topDown) pTarget = (cfg.topDownPitchDeg || 90) * D2R;
    else if (!o.reducedMotion) {
      const thr = hud && hud.thrust ? hud.thrust : 0;
      pTarget -= 3 * D2R * thr;
      const nt = hud && hud.nearestThreat;
      if (nt && nt.dist < R * 14) pTarget += 9 * D2R * (1 - nt.dist / (R * 14));
      pTarget += 15 * D2R * pb * pbk;
    }
    pTarget = Math.min(pTarget, 90 * D2R);
    const kd = this.snap ? 1 : 1 - Math.exp(-dt * 3.2), kp = this.snap ? 1 : 1 - Math.exp(-dt * 4.5), kt = this.snap ? 1 : 1 - Math.exp(-dt * 11);
    this.dist += (dTarget - this.dist) * kd;
    this.pitch += (pTarget - this.pitch) * kp;
    // look-ahead along velocity
    const la = o.reducedMotion ? 0.12 : 0.4;
    let ax = pl.v[0] * la, az = pl.v[2] * la;
    const al = Math.hypot(ax, az), cap = this.dist * 0.32;
    if (al > cap) { ax *= cap / al; az *= cap / al; }
    const tx = pl.p[0] + ax, ty = pl.p[1], tz = pl.p[2] + az;
    this.target[0] += (tx - this.target[0]) * kt; this.target[1] += (ty - this.target[1]) * kt; this.target[2] += (tz - this.target[2]) * kt;
    this.snap = false;

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const px = this.target[0], py = this.target[1] + sp * this.dist, pz = this.target[2] + cp * this.dist;
    _f.set(0, -sp, -cp);                                              // forward
    _r.set(1, 0, 0);
    _u.crossVectors(_r, _f).normalize();
    // screen shake (decays outside); skipped in reduced motion
    let ox = 0, oy = 0;
    if (o.shake > 0 && !o.reducedMotion) {
      this.shakeT += dt * 60;
      const a = o.shake * o.shake * this.dist * 0.012;
      ox = Math.sin(this.shakeT * 1.9) * a; oy = Math.cos(this.shakeT * 2.7) * a;
    }
    _z.copy(_f).multiplyScalar(-1);
    _m.makeBasis(_r, _u, _z);
    const c = this.camera;
    c.quaternion.setFromRotationMatrix(_m);
    c.position.set(px + _r.x * ox + _u.x * oy, py + _u.y * oy, pz + _u.z * oy);
    this.pos[0] = c.position.x; this.pos[1] = c.position.y; this.pos[2] = c.position.z;
    c.fov = cfg.fovDeg || 38;
    c.near = Math.max(this.dist * 0.04, 1e-3); c.far = Math.max(this.dist * 4000, 1e7);
    c.updateProjectionMatrix();
    c.updateMatrixWorld(true);
  }
}
