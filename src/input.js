// Keyboard (WASD / arrows) + pointer steering. Pointer steers toward the cursor, with thrust that grows
// with distance from the player's on-screen position (mouse-only play is fully supported).
import { clamp } from './physics.js';

const KEYS = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
};

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false };
  const pointer = { x: 0, y: 0, active: false, down: false, type: 'mouse' };
  const scratch = { x: 0, y: 0 };
  const steer = { x: 0, y: 0 };

  const onKey = (down) => (e) => {
    const dir = KEYS[e.code];
    if (!dir) return;
    held[dir] = down;
    e.preventDefault();
  };
  const onKeyDown = onKey(true);
  const onKeyUp = onKey(false);
  const onMove = (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.type = e.pointerType || 'mouse';
    pointer.active = pointer.type === 'mouse' ? true : pointer.down;
  };
  const onDown = (e) => {
    onMove(e);
    pointer.down = true;
    pointer.active = true;
  };
  const onUp = (e) => {
    pointer.down = false;
    if ((e.pointerType || 'mouse') !== 'mouse') pointer.active = false;
  };
  const onLeave = () => { pointer.active = false; };
  const onBlur = () => {
    held.up = held.down = held.left = held.right = false;
    pointer.down = false;
    pointer.active = false;
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerdown', onDown);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  document.documentElement.addEventListener('pointerleave', onLeave);
  window.addEventListener('blur', onBlur);

  // Returns a steer vector with length <= 1. Keys win over the pointer when both are used.
  function getSteer(camera, player) {
    let x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    let y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
    if (x !== 0 || y !== 0) {
      const l = Math.hypot(x, y);
      steer.x = x / l;
      steer.y = y / l;
      return steer;
    }
    steer.x = steer.y = 0;
    if (!pointer.active) return steer;

    const rect = canvas.getBoundingClientRect();
    // Use the un-shaken follow point so camera shake does not wobble the steering.
    const p = scratch;
    p.x = (player.x - camera.fx) * camera.zoom + camera.width / 2;
    p.y = (player.y - camera.fy) * camera.zoom + camera.height / 2;
    const dx = pointer.x - rect.left - p.x;
    const dy = pointer.y - rect.top - p.y;
    const d = Math.hypot(dx, dy);
    const dead = 14 * camera.scale;
    const full = 220 * camera.scale;
    if (d <= dead) return steer;
    const mag = clamp((d - dead) / (full - dead), 0, 1);
    steer.x = (dx / d) * mag;
    steer.y = (dy / d) * mag;
    return steer;
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('blur', onBlur);
  }

  return { getSteer, dispose, held, pointer };
}
