// Entry point. ?renderer=2d|3d chooses the stack. Until cutover the default is 2d; at cutover flip
// DEFAULT_RENDERER to '3d'. 3D falls back to 2D automatically when WebGL2 is missing or the renderer
// fails to initialise.
const DEFAULT_RENDERER = '2d';

function hasWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; }
}

// A canvas that already handed out a WebGL context can never give a 2D one: swap in a fresh element.
function freshCanvas() {
  const old = document.getElementById('game');
  if (!old) return;
  const c = old.cloneNode(false);
  old.replaceWith(c);
}

async function boot() {
  const q = new URLSearchParams(location.search).get('renderer');
  let mode = q === '2d' || q === '3d' ? q : DEFAULT_RENDERER;
  if (mode === '3d') {
    if (!hasWebGL2()) { console.warn('[boot] WebGL2 unavailable, using the 2D renderer'); mode = '2d'; }
    else {
      try {
        const m = await import('./main3d.js');
        await m.start3d();
        return;
      } catch (err) {
        console.warn('[boot] 3D failed, falling back to 2D:', err && err.message ? err.message : err);
        freshCanvas();
        mode = '2d';
      }
    }
  }
  await import('./main.js');
}

boot();
