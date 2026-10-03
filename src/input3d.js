// Input for the 3D build. poll() -> { x, z, stabilize } in world-aligned axes (right = +x, toward the
// viewer = +z, so "up/north" on screen is -z), magnitude = thrust fraction 0..1.
//   mouse/touch: hold to thrust toward the pointer; thrust grows with distance from the player's screen position
//   keyboard:    WASD / arrows;  Space (or Shift) = stabilise
export function createInput(canvas, getView, getPlayerPos) {
  const keys = new Set();
  let ptr = null;            // { x, y } in CSS px while pressed
  const out = { x: 0, z: 0, stabilize: false };
  const norm = (e) => ({ x: e.clientX, y: e.clientY });

  const onKeyDown = (e) => {
    if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
    keys.add(e.code);
    // Only stop page scrolling; a focused UI control keeps Space (press) and arrows (card/segment navigation).
    const onControl = e.target && e.target.closest && e.target.closest('button, a[href], [role="radio"], [role="switch"]');
    if (!onControl && (e.code === 'Space' || e.code.startsWith('Arrow'))) e.preventDefault();
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onDown = (e) => { if (e.button > 0) return; ptr = norm(e); try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } };
  const onMove = (e) => { if (ptr) ptr = norm(e); };
  const onUp = () => { ptr = null; };
  const onBlur = () => { keys.clear(); ptr = null; };

  addEventListener('keydown', onKeyDown); addEventListener('keyup', onKeyUp); addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp);

  return {
    poll() {
      let x = 0, z = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1;
      if (x || z) { const l = Math.hypot(x, z); x /= l; z /= l; }
      else if (ptr) {
        const view = getView();
        const pp = getPlayerPos ? getPlayerPos() : [0, 0, 0];
        const s = view.project(pp);
        const dx = ptr.x - s.x, dy = ptr.y - s.y;
        const d = Math.hypot(dx, dy), full = Math.min(view.width, view.height) * 0.3;
        if (d > 6) {
          // direction on the play plane: unproject the pointer and subtract the player position
          const w = view.unproject(ptr.x, ptr.y);
          let wx = w[0] - pp[0], wz = w[2] - pp[2];
          const wl = Math.hypot(wx, wz) || 1; wx /= wl; wz /= wl;
          const mag = Math.min(1, d / full);
          x = wx * mag; z = wz * mag;
        }
      }
      out.x = x; out.z = z; out.stabilize = keys.has('Space') || keys.has('ShiftLeft') || keys.has('ShiftRight');
      return out;
    },
    dispose() {
      removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp); removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
    },
  };
}
