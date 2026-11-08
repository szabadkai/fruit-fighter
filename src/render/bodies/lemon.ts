import type { Graphics } from 'pixi.js';
import { leanFrame, type BodyAnchors, type FruitArt, type Pose } from '../art';
import { INK, OUTLINE } from '../rig';

// The lemon: a zoner. A pale, sharp lemon-yellow ellipse with a pointed nub at each end,
// tipped back a little, with peel pores, a cool green-yellow shadow and a perky leaf.
// It bruises olive and starts to drip juice as the percent climbs.

const LEMON = 0xfcf14e;
const SHADE = 0xb4c42c;
const HIGHLIGHT = 0xffffe6;
const PORE = 0x7d7a0a;
const BRUISE = 0x8a7a1c;
const JUICE = 0xfaffb0;
const LEAF = 0x4fc23a;
const LEAF_SHADE = 0x2b8a2a;
const RX = 48;
const RY = 62;
const NUB = 13;
const CY = -112;
const TILT = -0.2; // top tips toward the back
const CT = Math.cos(TILT), ST = Math.sin(TILT);

type TF = ReturnType<typeof leanFrame>['tf'];
type P2 = [number, number];

const toPts = (tf: TF, pts: P2[]) => pts.flatMap(([x, y]) => { const q = tf(x, y); return [q.x, q.y]; });
const tilt = (x: number, y: number): P2 => [x * CT - y * ST, x * ST + y * CT];

// Rim point at angle a (y-down, -PI/2 = top), scaled by s: an ellipse pinched into a nub at each pole.
function rim(a: number, s = 1): P2 {
  const sn = Math.sin(a), k = Math.pow(Math.abs(sn), 30);
  const x = Math.cos(a) * RX * (1 - 0.12 * Math.pow(Math.abs(sn), 4));
  const y = sn * RY + Math.sign(sn) * NUB * k;
  return tilt(x * s, y * s);
}

const outlinePts = (): P2[] => Array.from({ length: 72 }, (_, i) => rim((i / 72) * Math.PI * 2));

// Hard shadow on the back/bottom: the rim from `a0` to `a1`, closed by a terminator curve.
function crescent(a0: number, a1: number, ctrl: P2): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i <= 24; i++) pts.push(rim(a0 + ((a1 - a0) * i) / 24));
  const [ex, ey] = pts[24], [sx, sy] = pts[0];
  for (let i = 1; i < 12; i++) {
    const t = i / 12, u = 1 - t;
    pts.push([u * u * ex + 2 * u * t * ctrl[0] + t * t * sx, u * u * ey + 2 * u * t * ctrl[1] + t * t * sy]);
  }
  return pts;
}

// Peel pores, scattered over the surface but kept off the face.
const PORES: P2[] = [];
for (let i = 0, s = 7; PORES.length < 30 && i < 200; i++) {
  s = (s * 16807) % 2147483647;
  const u = (s / 2147483647) * 2 - 1;
  s = (s * 16807) % 2147483647;
  const w = (s / 2147483647) * 1.7 - 0.85;
  const x = u * RX * 0.86 * Math.sqrt(1 - w * w), y = w * RY * 0.9;
  if (Math.hypot(x - 18, y + 14) < 30) continue;
  PORES.push(tilt(x, y));
}

const BRUISES: [number, number, number][] = [[-24, 18, 8], [26, 30, 7], [-12, -40, 7], [-34, -8, 6], [8, 44, 8], [34, -36, 5]];

export const lemonArt: FruitArt = {
  arms: true,
  shoe: 0xe0338a,
  shoeBack: 0xa3205f,
  glove: 0x2f6dff,
  gloveBack: 0x1f4bbf,

  layout(p: Pose): BodyAnchors {
    const { tf } = leanFrame(p, CY);
    return {
      hipF: tf(14, 54), hipB: tf(-14, 54),
      shF: tf(44, 6), shB: tf(-44, 2),
      eyeA: tf(6, -26), eyeB: tf(30, -27),
      eyeScale: 0.95,
      mouth: tf(22, -2),
    };
  },

  drawBody(g, p, _a, info) {
    const { tf } = leanFrame(p, CY);
    const outline = toPts(tf, outlinePts());
    g.poly(outline).fill(LEMON);
    g.poly(toPts(tf, crescent(0.95, 3.8, [-RX * 0.4, RY * 0.32]))).fill(SHADE);
    for (const [x, y] of PORES) {
      const q = tf(x, y);
      g.circle(q.x, q.y, 1.8).fill({ color: PORE, alpha: 0.45 });
    }

    const bruises = Math.min(BRUISES.length, Math.floor(info.percent / 25));
    for (let i = 0; i < bruises; i++) {
      const [x, y, r] = BRUISES[i];
      const q = tf(...tilt(x, y));
      g.ellipse(q.x, q.y, r, r * 0.75).fill({ color: BRUISE, alpha: 0.75 });
    }

    // highlight: a fat arc on the front-top plus a glint
    const hl = toPts(tf, Array.from({ length: 9 }, (_, i) => rim(-1.15 + i * 0.11, 0.8)));
    g.poly(hl, false).stroke({ width: 7, color: HIGHLIGHT, cap: 'round', join: 'round' });
    const glint = tf(...rim(-1.38, 0.74));
    g.circle(glint.x, glint.y, 3.5).fill(HIGHLIGHT);

    if (p.flash > 0) g.poly(outline).fill({ color: 0xffffff, alpha: p.flash });
    g.poly(outline).stroke({ width: OUTLINE, color: INK, join: 'round' });

    // juice drips off the bottom nub once it is hurt
    const drips = Math.min(2, Math.floor(info.percent / 75));
    for (let i = 0; i < drips; i++) {
      const [bx, by] = rim(Math.PI / 2 - 0.35 + i * 0.5, 0.96);
      const d = tf(bx, by + 6 + ((info.t * 0.35 + i * 6) % 12));
      g.moveTo(d.x, d.y - 8).quadraticCurveTo(d.x + 5, d.y, d.x, d.y + 3).quadraticCurveTo(d.x - 5, d.y, d.x, d.y - 8)
        .fill(JUICE).stroke({ width: 2.5, color: INK, join: 'round' });
    }

    // stem stub + leaf on the top nub
    const [tx, ty] = rim(-Math.PI / 2);
    const s0 = tf(tx + 1, ty + 3), s1 = tf(tx - 1, ty - 7);
    g.moveTo(s0.x, s0.y).lineTo(s1.x, s1.y).stroke({ width: 10, color: INK, cap: 'round' });
    g.moveTo(s0.x, s0.y).lineTo(s1.x, s1.y).stroke({ width: 4.5, color: 0x6b7a1a, cap: 'round' });
    const sway = Math.sin(info.t * 0.06) * 3;
    const l0 = tf(tx - 1, ty - 6), l1 = tf(tx - 16, ty - 26 + sway), l2 = tf(tx - 38, ty - 18 + sway);
    const l3 = tf(tx - 20, ty - 2), mid = tf(tx - 20, ty - 13 + sway * 0.5);
    g.moveTo(l0.x, l0.y).quadraticCurveTo(l1.x, l1.y, l2.x, l2.y).quadraticCurveTo(l3.x, l3.y, l0.x, l0.y).fill(LEAF);
    g.moveTo(l0.x, l0.y).quadraticCurveTo(mid.x, mid.y + 4, l2.x, l2.y).quadraticCurveTo(l3.x, l3.y, l0.x, l0.y).fill(LEAF_SHADE);
    g.moveTo(l0.x, l0.y).quadraticCurveTo(l1.x, l1.y, l2.x, l2.y).quadraticCurveTo(l3.x, l3.y, l0.x, l0.y)
      .stroke({ width: 4, color: INK, join: 'round' });
    g.moveTo(l0.x, l0.y).quadraticCurveTo(mid.x, mid.y, l2.x, l2.y).stroke({ width: 2.5, color: INK, cap: 'round' });
  },
};
