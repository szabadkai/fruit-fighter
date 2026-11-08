import type { Graphics } from 'pixi.js';
import { leanFrame, type BodyAnchors, type FruitArt, type Pose } from '../art';
import { INK, OUTLINE } from '../rig';

// The pineapple: an armoured counter-fighter. A tall golden oval wrapped in a diamond
// lattice that follows the curve of the body, a spiky nub at every crossing, and a big
// swaying crown. Damage bruises the scales and splits the skin so juice leaks out.

const GOLD = 0xf7aa1e;
const LATTICE = 0x8c4206;
const NUB = 0x6a3204;
const SHADOW = 0x6e2800;
const HIGHLIGHT = 0xfff1b8;
const BRUISE = 0x6b3a10;
const JUICE = 0xfff3a6;
const LEAF = 0x41b23a;
const LEAF_SHADE = 0x22762b;
const RX = 50;
const RY = 70;
const CY = -110;
const TILT = 0.22;
const CT = Math.cos(TILT), ST = Math.sin(TILT);
const STEP = 0.44; // lattice spacing, in radians on the surface

type TF = ReturnType<typeof leanFrame>['tf'];
type P2 = [number, number];

const toPts = (tf: TF, pts: P2[]) => pts.flatMap(([x, y]) => { const q = tf(x, y); return [q.x, q.y]; });

// Slightly scalloped oval so the armour reads in silhouette too.
const outlinePts = (): P2[] => Array.from({ length: 64 }, (_, i) => {
  const a = (i / 64) * Math.PI * 2;
  const k = 1 + 0.03 * Math.max(0, Math.sin(a * 16));
  return [Math.cos(a) * RX * k, Math.sin(a) * RY * k] as P2;
});

// Surface point (lat -PI/2 = top); null when it is round the back.
function surf(lon: number, lat: number): P2 | null {
  const X = Math.cos(lat) * Math.sin(lon), Y = Math.sin(lat), Z = Math.cos(lat) * Math.cos(lon);
  if (-Y * ST + Z * CT < 0.05) return null;
  return [X * RX, (Y * CT + Z * ST) * RY];
}

// One diagonal lattice line lat = dir * lon + c, split wherever it goes out of sight.
function latticeLine(g: Graphics, tf: TF, dir: number, c: number) {
  let open = false;
  for (let i = 0; i <= 24; i++) {
    const lon = -Math.PI / 2 + (i / 24) * Math.PI;
    const lat = dir * lon + c;
    const s = Math.abs(lat) < Math.PI / 2 - 0.08 ? surf(lon, lat) : null;
    if (!s) { open = false; continue; }
    const q = tf(...s);
    if (open) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y);
    open = true;
  }
}

// Hard shadow on the back/bottom: the rim from `a0` to `a1`, closed by a terminator curve.
function crescent(a0: number, a1: number, ctrl: P2): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = a0 + ((a1 - a0) * i) / 20;
    pts.push([Math.cos(a) * RX * 1.03, Math.sin(a) * RY * 1.03]);
  }
  const [ex, ey] = pts[20], [sx, sy] = pts[0];
  for (let i = 1; i < 12; i++) {
    const t = i / 12, u = 1 - t;
    pts.push([u * u * ex + 2 * u * t * ctrl[0] + t * t * sx, u * u * ey + 2 * u * t * ctrl[1] + t * t * sy]);
  }
  return pts;
}

const BRUISES: P2[] = [[-0.55, 0.2], [0.35, 0.65], [-0.2, -0.45], [0.75, 0.15], [-0.85, -0.3], [0.1, 0.95]];

// [angle from vertical, length, half-width]; back leaves first.
const LEAVES: [number, number, number][] = [
  [-1.0, 40, 7], [0.95, 38, 7], [-0.55, 56, 8], [0.55, 52, 8],
  [-0.85, 34, 6], [0.25, 66, 9], [-0.2, 62, 9], [0.8, 40, 7],
];

export const pineappleArt: FruitArt = {
  arms: true,
  shoe: 0x7a3f14,
  shoeBack: 0x552a0b,
  glove: 0x16a89b,
  gloveBack: 0x0e7268,

  layout(p: Pose): BodyAnchors {
    const { tf } = leanFrame(p, CY);
    return {
      hipF: tf(14, 60), hipB: tf(-16, 60),
      shF: tf(46, 6), shB: tf(-46, 4),
      eyeA: tf(6, -26), eyeB: tf(30, -27),
      eyeScale: 0.95,
      mouth: tf(22, -2),
    };
  },

  drawBody(g, p, _a, info) {
    const { tf } = leanFrame(p, CY);
    const outline = toPts(tf, outlinePts());
    g.poly(outline).fill(GOLD);

    // bruised scales under the lattice
    const bruises = Math.min(BRUISES.length, Math.floor(info.percent / 25));
    for (let i = 0; i < bruises; i++) {
      const s = surf(BRUISES[i][0], BRUISES[i][1]);
      if (!s) continue;
      const q = tf(...s);
      g.ellipse(q.x, q.y, 9, 7).fill({ color: BRUISE, alpha: 0.8 });
    }

    for (let k = -7; k <= 7; k++) {
      latticeLine(g, tf, 1, k * STEP);
      latticeLine(g, tf, -1, k * STEP + STEP / 2);
    }
    g.stroke({ width: 3, color: LATTICE, cap: 'round', join: 'round' });
    // a spiky nub (dark thorn + lit tip) wherever two lattice lines cross
    for (let i = -7; i <= 7; i++) {
      for (let j = -7; j <= 7; j++) {
        const lon = ((j * STEP + STEP / 2) - i * STEP) / 2, lat = (i * STEP + j * STEP + STEP / 2) / 2;
        if (Math.abs(lat) > 1.35 || Math.abs(lon) > 1.4) continue;
        const s = surf(lon, lat);
        if (!s) continue;
        const a = tf(s[0] - 4, s[1] + 2.5), b = tf(s[0] + 4, s[1] + 2.5), c = tf(s[0] + 2, s[1] - 5.5);
        g.poly([a.x, a.y, b.x, b.y, c.x, c.y]).fill(NUB);
        g.circle(c.x, c.y, 1.6).fill(HIGHLIGHT);
      }
    }

    g.poly(toPts(tf, crescent(1.0, 3.85, [-RX * 0.42, RY * 0.36]))).fill({ color: SHADOW, alpha: 0.42 });

    // a split in the skin that leaks juice
    if (info.percent >= 75) {
      const crack = toPts(tf, [[-30, 10], [-24, 16], [-28, 22], [-20, 28], [-23, 36]]);
      g.poly(crack, false).stroke({ width: 3, color: INK, cap: 'round', join: 'miter' });
      const d = tf(-22, 44 + ((info.t * 0.4) % 10));
      g.moveTo(d.x, d.y - 11).quadraticCurveTo(d.x + 7, d.y, d.x, d.y + 5).quadraticCurveTo(d.x - 7, d.y, d.x, d.y - 11)
        .fill(JUICE).stroke({ width: 2.5, color: INK, join: 'round' });
    }

    // highlight: a slim arc down the front-top rim plus a glint
    const hl = toPts(tf, Array.from({ length: 9 }, (_, i) => {
      const a = -1.2 + i * 0.12;
      return [Math.cos(a) * RX * 0.8, Math.sin(a) * RY * 0.84] as P2;
    }));
    g.poly(hl, false).stroke({ width: 7, color: HIGHLIGHT, cap: 'round', join: 'round' });
    const glint = tf(Math.cos(-1.42) * RX * 0.76, Math.sin(-1.42) * RY * 0.86);
    g.circle(glint.x, glint.y, 3.5).fill(HIGHLIGHT);

    if (p.flash > 0) g.poly(outline).fill({ color: 0xffffff, alpha: p.flash });
    g.poly(outline).stroke({ width: OUTLINE, color: INK, join: 'round' });
  },

  // The crown sways from the top of the head, rotating with the lean.
  drawTop(g, p, _a, info) {
    const { tf } = leanFrame(p, CY);
    const base: P2 = [2, -RY + 9];
    const sway = Math.sin(info.t * 0.045) * 0.07;
    LEAVES.forEach(([ang, len, w], i) => {
      const a = ang + sway + Math.sin(info.t * 0.07 + i * 1.3) * 0.035;
      const dx = Math.sin(a), dy = -Math.cos(a);
      const bx = base[0] + dx * 4, by = base[1] + dy * 4;
      const tip: P2 = [bx + dx * len + dx * len * 0.18 * Math.abs(ang), by + dy * len];
      const l: P2 = [bx - dy * w, by + dx * w], r: P2 = [bx + dy * w, by - dx * w];
      const mid: P2 = [bx + dx * len * 0.5, by + dy * len * 0.5];
      const cl: P2 = [mid[0] - dy * w * 1.1, mid[1] + dx * w * 1.1], cr: P2 = [mid[0] + dy * w * 1.1, mid[1] - dx * w * 1.1];
      const [L, R, T, CL, CR, M] = [l, r, tip, cl, cr, mid].map((q) => tf(...q));
      const back = i < 4;
      g.moveTo(L.x, L.y).quadraticCurveTo(CL.x, CL.y, T.x, T.y).quadraticCurveTo(CR.x, CR.y, R.x, R.y).closePath()
        .fill(back ? LEAF_SHADE : LEAF);
      // shade the trailing half of each front leaf
      if (!back) g.moveTo(L.x, L.y).quadraticCurveTo(CL.x, CL.y, T.x, T.y).quadraticCurveTo(M.x, M.y, (L.x + R.x) / 2, (L.y + R.y) / 2).closePath().fill(LEAF_SHADE);
      g.moveTo(L.x, L.y).quadraticCurveTo(CL.x, CL.y, T.x, T.y).quadraticCurveTo(CR.x, CR.y, R.x, R.y)
        .stroke({ width: 4, color: INK, join: 'round', cap: 'round' });
    });
    const knot = tf(base[0], base[1] + 2);
    g.ellipse(knot.x, knot.y, 13, 6).fill(LEAF_SHADE).stroke({ width: 4, color: INK });
  },
};
