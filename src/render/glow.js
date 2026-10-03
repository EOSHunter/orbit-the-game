// Cached radial-gradient glow sprites. Glow is drawn additively ('lighter') by blitting these
// bitmaps; gradients are never created per entity per frame and shadowBlur is never used.

import { makeCanvas, hexToRgb } from './util.js';

const SIZE = 128;
const cache = new Map();

/** Soft glow bitmap for a colour: bright core easing to transparent at the edge. */
export function getGlow(color) {
  let c = cache.get(color);
  if (c) return c;
  c = makeCanvas(SIZE, SIZE);
  const g = c.getContext('2d');
  const [r, gg, b] = hexToRgb(color);
  const h = SIZE / 2;
  const grad = g.createRadialGradient(h, h, 0, h, h, h);
  grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  grad.addColorStop(0.18, `rgba(${r},${gg},${b},0.62)`);
  grad.addColorStop(0.45, `rgba(${r},${gg},${b},0.2)`);
  grad.addColorStop(0.75, `rgba(${r},${gg},${b},0.045)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, SIZE, SIZE);
  cache.set(color, c);
  return c;
}

/**
 * Blit a glow centred on (x, y) whose visible radius is `radius`.
 * The caller is responsible for `globalCompositeOperation = 'lighter'`.
 */
export function drawGlow(ctx, color, x, y, radius, alpha) {
  if (alpha <= 0.002 || radius <= 0.3) return;
  ctx.globalAlpha = alpha > 1 ? 1 : alpha;
  ctx.drawImage(getGlow(color), x - radius, y - radius, radius * 2, radius * 2);
}
