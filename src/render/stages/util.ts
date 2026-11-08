import type { Container, Graphics } from 'pixi.js';
import type { CameraInfo } from '../art';
import { INK } from '../rig';

// Small helpers shared by the stage art modules.

export function mix(a: number, b: number, t: number) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
export const shade = (c: number, k: number) => mix(c, 0x000000, k);
export const tint = (c: number, k: number) => mix(c, 0xffffff, k);

// Seeded PRNG (mulberry32) so scattered decoration is identical on every build.
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Backdrop layers are drawn around (0, 0) = the design-space centre. A layer with
// factor f slides by f * camera offset (the gameplay camera sits around y = -320) and
// is drawn at BACK_SCALE so its props stay in proportion with the zoomed-out world,
// growing slightly as the camera zooms in.
export const BACK_SCALE = 0.74;
export function parallax(layer: Container, cam: CameraInfo, f: number, fy = f) {
  layer.position.set(640 - cam.x * f, 360 - (cam.y + 320) * fy);
  layer.scale.set(BACK_SCALE * (1 + (cam.zoom - 0.5) * f * 4));
}

// Chunky disc seen slightly from above (fruit slices, cookies). The walkable line y = 0
// runs through the lit top face; the side band hangs below it. Returns nothing; draw
// top-face details afterwards inside the ellipse (0, 4, rx, ry).
export function puck(g: Graphics, rx: number, ry: number, thick: number, top: number, side: number, ink = 5) {
  g.ellipse(0, 4 + thick, rx, ry).fill(shade(side, 0.25)).stroke({ width: ink, color: INK });
  g.rect(-rx, 4, rx * 2, thick).fill(side);
  g.poly([rx * 0.35, 4, rx, 4, rx, 4 + thick, rx * 0.35, 4 + thick]).fill(shade(side, 0.18));
  g.moveTo(-rx, 4).lineTo(-rx, 4 + thick).moveTo(rx, 4).lineTo(rx, 4 + thick).stroke({ width: ink, color: INK });
  g.ellipse(0, 4, rx, ry).fill(top).stroke({ width: ink, color: INK });
}

// Thick plank / slab: lit top face around y = 0 and a front face `thick` deep.
export function slab(g: Graphics, w: number, thick: number, top: number, front: number, ink = 5, r = 6) {
  const hw = w / 2;
  g.roundRect(-hw, 2, w, thick, r).fill(front).stroke({ width: ink, color: INK });
  g.rect(-hw + ink, 2 + thick - 9, w - ink * 2, 5).fill(shade(front, 0.25));
  g.roundRect(-hw - 4, -9, w + 8, 18, r).fill(top).stroke({ width: ink, color: INK });
  g.moveTo(-hw + 8, -3).lineTo(hw * 0.2, -3).stroke({ width: 3, color: tint(top, 0.5), cap: 'round' });
}

// Darkens the borders in stacked translucent strips so the halftone pass turns them
// into a dot gradient while the box (-hw..hw, top..bottom) stays clean.
export function edgeShade(g: Graphics, hw: number, top: number, bottom: number, steps = 6, step = 55, alpha = 0.07, color = 0x000000) {
  const FX = 1600, FY = 1100;
  for (let i = 0; i < steps; i++) {
    const x = hw + i * step;
    g.rect(-FX, -FY, FX - x, FY * 2).fill({ color, alpha });
    g.rect(x, -FY, FX - x, FY * 2).fill({ color, alpha });
    const t = top - i * step, b = bottom + i * step;
    g.rect(-x, -FY, x * 2, t + FY).fill({ color, alpha });
    g.rect(-x, b, x * 2, FY - b).fill({ color, alpha });
  }
}

// Hard cel shadow: the crescent of an ellipse facing away from the light angle
// (default upper-left light, shadow lower-right).
export function crescent(g: Graphics, x: number, y: number, rx: number, ry: number, color: number, depth = 0.3, light = -2.356, alpha = 1) {
  const d = depth * 2;
  const a = Math.acos(Math.min(1, d / 2));
  const pts: number[] = [];
  const N = 20;
  for (let i = 0; i <= N; i++) {
    const t = light + a + ((Math.PI * 2 - a * 2) * i) / N;
    pts.push(x + Math.cos(t) * rx, y + Math.sin(t) * ry);
  }
  const cx = x + Math.cos(light) * d * rx, cy = y + Math.sin(light) * d * ry, dark = light + Math.PI;
  for (let i = 0; i <= N; i++) {
    const t = dark + a - (a * 2 * i) / N;
    pts.push(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry);
  }
  g.poly(pts).fill({ color, alpha });
}

export type FruitKind = 'apple' | 'orange' | 'lemon' | 'lime' | 'pear' | 'plum' | 'grapes' | 'cherry' | 'peach';

const FRUIT: Record<FruitKind, number> = {
  apple: 0xe0352b, orange: 0xff9824, lemon: 0xffdf3a, lime: 0x86cf3c, pear: 0xc4d84a,
  plum: 0x7b3fa0, grapes: 0x8a4cc2, cherry: 0xc8102e, peach: 0xffab76,
};

// Small inked fruit prop (crates, bowls, tables). `ink` = outline width, `dim` darkens
// for background use.
export function fruit(g: Graphics, kind: FruitKind, x: number, y: number, r: number, ink = 3, dim = 0) {
  const c = shade(FRUIT[kind], dim);
  const line = { width: ink, color: INK };
  const leaf = shade(0x3fa34d, dim);
  if (kind === 'grapes') {
    const rr = r * 0.36;
    const spots = [[0, -0.55], [-0.38, -0.5], [0.38, -0.5], [-0.2, -0.1], [0.2, -0.1], [-0.55, -0.15], [0.55, -0.15], [0, 0.3], [-0.32, 0.28], [0.32, 0.28], [0, 0.68]];
    for (const [dx, dy] of spots) {
      g.circle(x + dx * r, y + dy * r, rr).fill(c).stroke(line);
      crescent(g, x + dx * r, y + dy * r, rr, rr, shade(c, 0.3), 0.3);
      g.circle(x + dx * r - rr * 0.35, y + dy * r - rr * 0.35, rr * 0.25).fill({ color: 0xffffff, alpha: 0.7 });
    }
    g.moveTo(x, y - r * 0.85).lineTo(x + r * 0.1, y - r * 1.15).stroke({ width: ink + 1, color: shade(0x6b4a2a, dim), cap: 'round' });
    return;
  }
  if (kind === 'cherry') {
    for (const dx of [-0.45, 0.45]) {
      g.moveTo(x + dx * r, y).quadraticCurveTo(x + dx * r * 0.3, y - r * 1.2, x + r * 0.2, y - r * 1.6).stroke({ width: ink, color: shade(0x5a7a2a, dim), cap: 'round' });
    }
    for (const dx of [-0.45, 0.45]) {
      g.circle(x + dx * r, y, r * 0.5).fill(c).stroke(line);
      crescent(g, x + dx * r, y, r * 0.5, r * 0.5, shade(c, 0.35), 0.3);
    }
    return;
  }
  let rx = r, ry = r;
  if (kind === 'lemon' || kind === 'lime') rx = r * 1.2, ry = r * 0.88;
  if (kind === 'pear') {
    g.circle(x, y - r * 0.85, r * 0.6).fill(c).stroke(line);
  }
  if (kind === 'lemon') {
    g.ellipse(x - rx, y, r * 0.26, r * 0.18).fill(c).stroke(line);
    g.ellipse(x + rx, y, r * 0.26, r * 0.18).fill(c).stroke(line);
  }
  g.ellipse(x, y, rx, ry).fill(c).stroke(line);
  if (kind === 'pear') {
    g.circle(x, y - r * 0.85, r * 0.6 - ink / 2).fill(c);
    g.ellipse(x, y, rx - ink / 2, ry - ink / 2).fill(c);
  }
  crescent(g, x, y, rx - ink / 2, ry - ink / 2, shade(c, 0.28), 0.28);
  if (kind === 'orange' || kind === 'lemon' || kind === 'lime') {
    for (let i = 0; i < 5; i++) g.circle(x - rx * 0.3 + (i % 3) * rx * 0.3, y - ry * 0.2 + Math.floor(i / 3) * ry * 0.35, Math.max(1, r * 0.04)).fill(shade(c, 0.2));
  }
  if (kind === 'peach') g.moveTo(x - r * 0.1, y - r * 0.9).quadraticCurveTo(x + r * 0.35, y - r * 0.1, x + r * 0.05, y + r * 0.8).stroke({ width: ink * 0.7, color: shade(c, 0.3) });
  g.ellipse(x - rx * 0.38, y - ry * 0.4, rx * 0.2, ry * 0.12).fill({ color: 0xffffff, alpha: 0.75 });
  const top = kind === 'pear' ? y - r * 1.4 : y - ry;
  if (kind !== 'lemon' && kind !== 'lime') {
    g.moveTo(x, top + r * 0.15).lineTo(x + r * 0.12, top - r * 0.35).stroke({ width: ink + 1, color: shade(0x6b4a2a, dim), cap: 'round' });
    g.ellipse(x + r * 0.38, top - r * 0.22, r * 0.3, r * 0.13).fill(leaf).stroke({ width: Math.max(1.5, ink * 0.7), color: INK });
  }
}

// Wobbly comic cloud made of overlapping puffs.
export function cloud(g: Graphics, x: number, y: number, s: number, fill = 0xffffff, shadow = 0xcfe3f5, ink = 3) {
  const puffs = [[-60, 6, 34], [-24, -18, 42], [22, -24, 46], [62, -2, 36], [0, 10, 40], [-40, 16, 26], [42, 16, 28]];
  for (const [dx, dy, r] of puffs) g.circle(x + dx * s, y + dy * s, r * s + ink / 2).fill(INK);
  for (const [dx, dy, r] of puffs) g.circle(x + dx * s, y + dy * s, r * s - ink / 2).fill(fill);
  g.ellipse(x + 4 * s, y + 26 * s, 62 * s, 11 * s).fill(shadow);
}
