// Follow camera. `camera` is a plain object the renderer reads:
//   x, y     world point at the centre of the viewport (screen shake is applied by the renderer)
//   zoom     CSS pixels per world unit
//   width, height   viewport size in CSS pixels
//   scale    viewport scale factor (min(w/1280, h/720)) for sizing UI-ish things
//   rotation always 0 (reserved)
import { CONFIG, clamp } from './physics.js';

export function createCamera() {
  return {
    x: 0, y: 0, zoom: 1, width: 1280, height: 720, scale: 1, rotation: 0,
    // internal
    fx: 0, fy: 0,            // un-shaken follow position
    pull: 0,                 // evolve pull-back pulse (1 -> 0)
    wide: 1,                 // extra zoom-out multiplier (title screen)
  };
}

export function resizeCamera(cam, width, height) {
  cam.width = Math.max(1, width);
  cam.height = Math.max(1, height);
  cam.scale = clamp(Math.min(cam.width / 1280, cam.height / 720), 0.55, 1.5);
}

export function snapCamera(cam, player) {
  cam.fx = cam.x = player.x;
  cam.fy = cam.y = player.y;
  cam.zoom = targetZoom(cam, player);
  cam.pull = 0;
}

function targetZoom(cam, p) {
  return (CONFIG.camera.playerScreenRadius * cam.scale * cam.wide) / p.radius;
}

export function kickCamera(cam) {
  cam.pull = 1;
}

// Half the viewport diagonal in world units - anything within this distance of the camera may be visible.
export function viewRadius(cam) {
  return Math.hypot(cam.width, cam.height) / 2 / cam.zoom;
}

export function worldToScreen(cam, wx, wy, out = {}) {
  out.x = (wx - cam.x) * cam.zoom + cam.width / 2;
  out.y = (wy - cam.y) * cam.zoom + cam.height / 2;
  return out;
}

export function screenToWorld(cam, sx, sy, out = {}) {
  out.x = (sx - cam.width / 2) / cam.zoom + cam.x;
  out.y = (sy - cam.height / 2) / cam.zoom + cam.y;
  return out;
}

export function updateCamera(cam, player, dt) {
  const c = CONFIG.camera;

  // Zoom: ease in log space so zooming out and in feel symmetric. Evolve adds a pull-back pulse.
  cam.pull = Math.max(0, cam.pull - dt / 1.8);
  const pull = cam.pull * cam.pull * (3 - 2 * cam.pull);
  const target = targetZoom(cam, player) * (1 - c.pullback * pull);
  const kz = 1 - Math.exp(-c.zoomRate * dt);
  cam.zoom = Math.exp(Math.log(cam.zoom) + (Math.log(target) - Math.log(cam.zoom)) * kz);

  // Follow with a short lag plus look-ahead along velocity.
  const tx = player.x + player.vx * c.lookAhead;
  const ty = player.y + player.vy * c.lookAhead;
  const kf = 1 - Math.exp(-dt / c.followLag);
  cam.fx += (tx - cam.fx) * kf;
  cam.fy += (ty - cam.fy) * kf;
  cam.x = cam.fx;
  cam.y = cam.fy;
}
