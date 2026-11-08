import type { Graphics } from 'pixi.js';

// Shared drawing helpers for the cutout rigs. Everything is drawn in rig space:
// feet at (0, 0), up is -y, facing right. The view flips x for facing left.

export interface V { x: number; y: number }
export const v = (x: number, y: number): V => ({ x, y });
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpV = (a: V, b: V, t: number): V => v(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
export const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export const INK = 0x14100c;
export const OUTLINE = 6;

// Rubber-hose limb: a thick ink curve that sags perpendicular to its direction.
export function hose(g: Graphics, from: V, to: V, sag: number, width: number) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  let px = -dy / len;
  let py = dx / len;
  if (py < 0 || (Math.abs(py) < 0.2 && px > 0)) {
    px = -px;
    py = -py;
  }
  const s = Math.max(2, sag - len * 0.12);
  const c = v((from.x + to.x) / 2 + px * s, (from.y + to.y) / 2 + py * s);
  g.moveTo(from.x, from.y).quadraticCurveTo(c.x, c.y, to.x, to.y).stroke({ width, color: INK, cap: 'round' });
  return c;
}

// Big white cartoon glove; `from` is the elbow-ish control point so the cuff lines up.
export function glove(g: Graphics, at: V, from: V, scale: number, tint = 0xffffff) {
  const dx = at.x - from.x;
  const dy = at.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const r = 14 * scale;
  g.circle(at.x - ux * r * 0.95, at.y - uy * r * 0.95, r * 0.55).fill(tint).stroke({ width: 4, color: INK });
  g.circle(at.x, at.y, r).fill(tint).stroke({ width: 4.5, color: INK });
  // knuckle crease
  const kx = at.x + ux * r * 0.2;
  const ky = at.y + uy * r * 0.2;
  g.moveTo(kx - uy * r * 0.55, ky + ux * r * 0.55)
    .quadraticCurveTo(kx + ux * r * 0.35, ky + uy * r * 0.35, kx + uy * r * 0.55, ky - ux * r * 0.55)
    .stroke({ width: 3, color: INK, cap: 'round' });
}

export function shoe(g: Graphics, at: V, color: number, scale = 1) {
  g.ellipse(at.x + 7 * scale, at.y - 7 * scale, 16 * scale, 9.5 * scale).fill(color).stroke({ width: 4, color: INK });
  g.ellipse(at.x + 15 * scale, at.y - 8 * scale, 6 * scale, 5 * scale).fill(0xffffff).stroke({ width: 3, color: INK });
  g.moveTo(at.x - 8 * scale, at.y).lineTo(at.x + 22 * scale, at.y).stroke({ width: 4, color: INK, cap: 'round' });
}

export type EyeMode = 'open' | 'squint' | 'x';

export function eye(g: Graphics, c: V, rx: number, ry: number, look: V, mode: EyeMode) {
  if (mode === 'x') {
    const s = rx * 0.9;
    g.moveTo(c.x - s, c.y - s).lineTo(c.x + s, c.y + s).moveTo(c.x + s, c.y - s).lineTo(c.x - s, c.y + s)
      .stroke({ width: 4, color: INK, cap: 'round' });
    return;
  }
  if (mode === 'squint') {
    g.moveTo(c.x - rx, c.y - ry * 0.5).lineTo(c.x + rx * 0.6, c.y).lineTo(c.x - rx, c.y + ry * 0.5)
      .stroke({ width: 4, color: INK, cap: 'round', join: 'round' });
    return;
  }
  g.ellipse(c.x, c.y, rx, ry).fill(0xffffff).stroke({ width: 3.5, color: INK });
  const px = c.x + look.x * rx * 0.35;
  const py = c.y + look.y * ry * 0.3;
  g.ellipse(px, py, rx * 0.5, ry * 0.42).fill(INK);
  g.circle(px + rx * 0.15, py - ry * 0.18, rx * 0.17).fill(0xffffff);
}

export function brow(g: Graphics, a: V, b: V) {
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 5.5, color: INK, cap: 'round' });
}

export type Mouth = 'grin' | 'shout' | 'grit' | 'ouch' | 'o';

export function mouth(g: Graphics, m: V, kind: Mouth, s = 1) {
  switch (kind) {
    case 'grin':
      g.moveTo(m.x - 12 * s, m.y - 4 * s).quadraticCurveTo(m.x + 2 * s, m.y + 10 * s, m.x + 15 * s, m.y - 7 * s)
        .stroke({ width: 4, color: INK, cap: 'round' });
      break;
    case 'shout':
      g.ellipse(m.x + 2 * s, m.y + 3 * s, 10 * s, 12 * s).fill(0x5c0d0d).stroke({ width: 3.5, color: INK });
      g.ellipse(m.x + 3 * s, m.y + 9 * s, 6 * s, 4 * s).fill(0xff5a6a);
      break;
    case 'grit':
      g.roundRect(m.x - 11 * s, m.y - 6 * s, 25 * s, 13 * s, 4 * s).fill(0xffffff).stroke({ width: 3.5, color: INK });
      g.moveTo(m.x - 10 * s, m.y + 0.5 * s).lineTo(m.x + 13 * s, m.y + 0.5 * s)
        .moveTo(m.x - 3 * s, m.y - 6 * s).lineTo(m.x - 3 * s, m.y + 7 * s)
        .moveTo(m.x + 5 * s, m.y - 6 * s).lineTo(m.x + 5 * s, m.y + 7 * s)
        .stroke({ width: 2.5, color: INK });
      break;
    case 'ouch':
      g.moveTo(m.x - 12 * s, m.y).lineTo(m.x - 6 * s, m.y - 5 * s).lineTo(m.x, m.y + 2 * s).lineTo(m.x + 6 * s, m.y - 5 * s)
        .lineTo(m.x + 12 * s, m.y + 1 * s).stroke({ width: 4, color: INK, cap: 'round', join: 'round' });
      break;
    case 'o':
      g.ellipse(m.x, m.y, 5 * s, 6 * s).fill(0x5c0d0d).stroke({ width: 3, color: INK });
      break;
  }
}

// Jagged comic starburst polygon.
export function burstPoints(spikes: number, rOuter: number, rInner: number, jitter: number, seed: number): number[] {
  const pts: number[] = [];
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const base = i % 2 === 0 ? rOuter : rInner;
    const r = base * (1 - jitter / 2 + rnd() * jitter);
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return pts;
}
