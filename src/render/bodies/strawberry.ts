import type { Graphics } from 'pixi.js';
import { leanFrame, type BodyAnchors, type FruitArt, type Pose } from '../art';
import { INK, OUTLINE } from '../rig';

// The strawberry: tiny and fast. A chunky red teardrop (wide shoulders, pointed tip)
// dotted with yellow seeds in curved rows, with a leafy cap and stem on top. Damage
// leaves mushy bruises, then red juice starts dripping off the tip.

const RED = 0xf2263a;
const SHADOW = 0x5a0012;
const HIGHLIGHT = 0xffd2d8;
const SEED = 0xffe04a;
const BRUISE = 0x6a0a1c;
const JUICE = 0xd1112c;
const LEAF = 0x3cb043;
const LEAF_SHADE = 0x1f7a2e;
const RX = 52;
const RYT = 42; // top half height
const RYB = 74; // bottom half height, down to the tip
const CY = -114;

type TF = ReturnType<typeof leanFrame>['tf'];
type P2 = [number, number];

const toPts = (tf: TF, pts: P2[]) => pts.flatMap(([x, y]) => { const q = tf(x, y); return [q.x, q.y]; });

// Rim point at angle a (y-down): an elliptical top over a bottom half that tapers to a tip.
function rim(a: number, s = 1): P2 {
  const sn = Math.sin(a);
  const x = Math.cos(a) * RX * (sn > 0 ? Math.pow(1 - sn, 0.35) : 1);
  const y = sn * (sn < 0 ? RYT : RYB);
  return [x * s, y * s];
}

const outlinePts = (): P2[] => Array.from({ length: 72 }, (_, i) => rim((i / 72) * Math.PI * 2));

// Hard shadow on the back/bottom: the rim from `a0` to `a1`, closed by a terminator curve.
function crescent(a0: number, a1: number, ctrl: P2): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i <= 24; i++) pts.push(rim(a0 + ((a1 - a0) * i) / 24, 1.02));
  const [ex, ey] = pts[24], [sx, sy] = pts[0];
  for (let i = 1; i < 12; i++) {
    const t = i / 12, u = 1 - t;
    pts.push([u * u * ex + 2 * u * t * ctrl[0] + t * t * sx, u * u * ey + 2 * u * t * ctrl[1] + t * t * sy]);
  }
  return pts;
}

// Seeds in staggered rows that bow with the surface; none on the face.
const SEEDS: P2[] = [];
for (let r = 0; r < 8; r++) {
  const w = -0.72 + r * 0.24;
  const half = rim(Math.asin(w))[0] * 0.8;
  const y0 = w * (w < 0 ? RYT : RYB);
  const n = Math.max(2, Math.round(half / 9));
  for (let c = 0; c <= n; c++) {
    const u = -1 + (2 * (c + (r % 2) * 0.5)) / (n + 0.5);
    const x = Math.sin((u * Math.PI) / 2) * half, y = y0 + Math.cos((u * Math.PI) / 2) * 4;
    if (Math.hypot(x - 20, y - 3) < 26) continue;
    SEEDS.push([x, y]);
  }
}

const BRUISES: [number, number, number][] = [[-26, 4, 9], [30, 30, 7], [-8, 42, 8], [-36, -18, 6], [14, 56, 5], [40, -2, 6]];

// Cap leaves: [direction (y-down radians), length, half-width]; back ones first.
const LEAVES: [number, number, number][] = [
  [-2.35, 18, 6], [2.0, 24, 7], [2.75, 32, 8], [-0.85, 18, 6], [0.25, 30, 8], [-0.1, 26, 7],
];

export const strawberryArt: FruitArt = {
  arms: true,
  shoe: 0x5b2a86,
  shoeBack: 0x3f1c5e,
  glove: 0xffd21f,
  gloveBack: 0xc99d0d,

  layout(p: Pose): BodyAnchors {
    const { tf } = leanFrame(p, CY);
    return {
      hipF: tf(12, 56), hipB: tf(-12, 56),
      shF: tf(48, -4), shB: tf(-48, -6),
      eyeA: tf(8, -6), eyeB: tf(32, -7),
      eyeScale: 0.9,
      mouth: tf(22, 15),
    };
  },

  drawBody(g, p, _a, info) {
    const { tf } = leanFrame(p, CY);
    const outline = toPts(tf, outlinePts());
    g.poly(outline).fill(RED);
    const bruises = Math.min(BRUISES.length, Math.floor(info.percent / 25));
    for (let i = 0; i < bruises; i++) {
      const [x, y, r] = BRUISES[i];
      const q = tf(x, y);
      g.ellipse(q.x, q.y, r, r * 0.8).fill({ color: BRUISE, alpha: 0.7 });
    }
    for (const [x, y] of SEEDS) {
      const q = tf(x, y);
      g.ellipse(q.x, q.y, 2.6, 3.6).fill(SEED);
    }
    g.poly(toPts(tf, crescent(0.85, 3.85, [-RX * 0.38, RYB * 0.2]))).fill({ color: SHADOW, alpha: 0.5 });

    // highlight: a fat arc on the front shoulder plus a glint
    const hl = toPts(tf, Array.from({ length: 9 }, (_, i) => rim(-0.95 + i * 0.12, 0.8)));
    g.poly(hl, false).stroke({ width: 7, color: HIGHLIGHT, cap: 'round', join: 'round' });
    const glint = tf(...rim(0.45, 0.78));
    g.circle(glint.x, glint.y, 3).fill(HIGHLIGHT);

    if (p.flash > 0) g.poly(outline).fill({ color: 0xffffff, alpha: p.flash });
    g.poly(outline).stroke({ width: OUTLINE, color: INK, join: 'round' });

    // juice drips off the tip once it is properly squashed
    const drips = Math.min(2, Math.floor(info.percent / 60));
    for (let i = 0; i < drips; i++) {
      const d = tf(4 - i * 10, RYB + 4 + ((info.t * 0.4 + i * 7) % 14) - i * 8);
      g.moveTo(d.x, d.y - 8).quadraticCurveTo(d.x + 5, d.y, d.x, d.y + 3).quadraticCurveTo(d.x - 5, d.y, d.x, d.y - 8)
        .fill(JUICE).stroke({ width: 2.5, color: INK, join: 'round' });
    }
  },

  // Leaf cap + stem, swaying a little, over the top of the head.
  drawTop(g, p, _a, info) {
    const { tf } = leanFrame(p, CY);
    const bx = 0, by = -RYT + 4;
    const sway = Math.sin(info.t * 0.06) * 0.08;
    const s0 = tf(bx, by), s1 = tf(bx - 2, by - 14), s2 = tf(bx - 10 + sway * 30, by - 22);
    g.moveTo(s0.x, s0.y).quadraticCurveTo(s1.x, s1.y, s2.x, s2.y).stroke({ width: 10, color: INK, cap: 'round' });
    g.moveTo(s0.x, s0.y).quadraticCurveTo(s1.x, s1.y, s2.x, s2.y).stroke({ width: 4.5, color: 0x6b8a24, cap: 'round' });
    LEAVES.forEach(([ang, len, w], i) => {
      const a = ang + sway * (i % 2 ? 1 : -0.6);
      const dx = Math.cos(a), dy = Math.sin(a);
      const r0 = bx + dx * 4, r1 = by + dy * 4;
      const tip: P2 = [r0 + dx * len, r1 + dy * len + 4];
      const l: P2 = [r0 - dy * w * 0.5, r1 + dx * w * 0.5], r: P2 = [r0 + dy * w * 0.5, r1 - dx * w * 0.5];
      const m: P2 = [r0 + dx * len * 0.5, r1 + dy * len * 0.5];
      const cl: P2 = [m[0] - dy * w, m[1] + dx * w], cr: P2 = [m[0] + dy * w, m[1] - dx * w];
      const [L, R, T, CL, CR, M] = [l, r, tip, cl, cr, m].map((q) => tf(...q));
      g.moveTo(L.x, L.y).quadraticCurveTo(CL.x, CL.y, T.x, T.y).quadraticCurveTo(CR.x, CR.y, R.x, R.y).closePath()
        .fill(i < 3 ? LEAF_SHADE : LEAF);
      if (i >= 3) g.moveTo(R.x, R.y).quadraticCurveTo(CR.x, CR.y, T.x, T.y).quadraticCurveTo(M.x, M.y, R.x, R.y).fill(LEAF_SHADE);
      g.moveTo(L.x, L.y).quadraticCurveTo(CL.x, CL.y, T.x, T.y).quadraticCurveTo(CR.x, CR.y, R.x, R.y)
        .stroke({ width: 4, color: INK, join: 'round', cap: 'round' });
    });
    const knot = tf(bx, by + 1);
    g.circle(knot.x, knot.y, 6).fill(LEAF).stroke({ width: 3.5, color: INK });
  },
};
