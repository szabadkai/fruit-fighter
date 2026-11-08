import type { Graphics } from 'pixi.js';
import { leanFrame, type BodyAnchors, type FruitArt, type Pose } from '../art';
import { INK, OUTLINE } from '../rig';

// Big Mel: a wide, heavy watermelon brawler. Jagged light stripes run pole to pole over
// a slightly forward-tilted sphere; as the percent climbs the rind cracks and chunks
// break off to show red flesh and black seeds.

const GREEN = 0x1d6b2a;
const STRIPE = 0x6cc94a;
const SHADOW = 0x04210c;
const HIGHLIGHT = 0xe4ffc2;
const RIND = 0xdff5a8;
const FLESH = 0xff3b52;
const RX = 76;
const RY = 62;
const CY = -108;
const TILT = 0.3; // top pole leans toward the viewer
const CT = Math.cos(TILT), ST = Math.sin(TILT);

type TF = ReturnType<typeof leanFrame>['tf'];
type P2 = [number, number];

const toPts = (tf: TF, pts: P2[]) => pts.flatMap(([x, y]) => { const q = tf(x, y); return [q.x, q.y]; });

const ellipse = (s = 1, n = 48): P2[] =>
  Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [Math.cos(a) * RX * s, Math.sin(a) * RY * s] as P2; });

// Point on the melon's surface (lat -PI/2 = top pole). Hidden points slide onto the rim,
// so stripes that wrap around the back hug the silhouette instead of poking out.
function surf(lon: number, lat: number): P2 {
  const X = Math.cos(lat) * Math.sin(lon), Y = Math.sin(lat), Z = Math.cos(lat) * Math.cos(lon);
  let x = X, y = Y * CT + Z * ST;
  if (-Y * ST + Z * CT < 0) { const l = Math.hypot(x, y) || 1; x /= l; y /= l; }
  return [x * RX, y * RY];
}

function stripe(c: number, w: number): P2[] {
  const n = 18, left: P2[] = [], right: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const lat = -Math.PI / 2 + (i / n) * Math.PI;
    const jag = Math.sin(i * 2.1 + c * 5) * 0.05 + (i % 2 ? 0.035 : -0.035);
    const taper = Math.sin((i / n) * Math.PI) * 0.6 + 0.4;
    left.push(surf(c - w * taper + jag, lat));
    right.push(surf(c + w * taper + jag, lat));
  }
  return left.concat(right.reverse());
}

// Hard shadow on the back/bottom: the rim from `a0` to `a1`, closed by a terminator curve.
function crescent(a0: number, a1: number, ctrl: P2): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = a0 + ((a1 - a0) * i) / 20;
    pts.push([Math.cos(a) * RX, Math.sin(a) * RY]);
  }
  const [ex, ey] = pts[20], [sx, sy] = pts[0];
  for (let i = 1; i < 12; i++) {
    const t = i / 12, u = 1 - t;
    pts.push([u * u * ex + 2 * u * t * ctrl[0] + t * t * sx, u * u * ey + 2 * u * t * ctrl[1] + t * t * sy]);
  }
  return pts;
}

// A broken-off chunk of rind: jagged pale rind, red flesh, a few seeds.
function chunk(g: Graphics, tf: TF, cx: number, cy: number, r: number, seed: number) {
  const ring = (s: number): P2[] => Array.from({ length: 13 }, (_, i) => {
    const a = (i / 13) * Math.PI * 2;
    const k = (i % 2 ? 0.8 : 1) * (0.85 + ((seed * (i + 3) * 37) % 10) / 40);
    return [cx + Math.cos(a) * r * k * s, cy + Math.sin(a) * r * 0.75 * k * s] as P2;
  });
  g.poly(toPts(tf, ring(1))).fill(RIND);
  g.poly(toPts(tf, ring(0.72))).fill(FLESH);
  for (const [sx, sy] of [[-0.35, -0.1], [0.2, -0.22], [0.05, 0.25], [0.4, 0.15]]) {
    const q = tf(cx + sx * r, cy + sy * r);
    g.ellipse(q.x, q.y, 2.6, 3.6).fill(INK);
  }
  g.poly(toPts(tf, ring(1))).stroke({ width: 3.5, color: INK, join: 'round' });
}

function crack(g: Graphics, tf: TF, pts: P2[]) {
  g.poly(toPts(tf, pts), false).stroke({ width: 3, color: INK, cap: 'round', join: 'miter' });
}

export const watermelonArt: FruitArt = {
  arms: true,
  shoe: 0x2b2a33,
  shoeBack: 0x1b1a21,
  glove: 0xe8202f,
  gloveBack: 0xa8141f,

  layout(p: Pose): BodyAnchors {
    const { tf } = leanFrame(p, CY);
    return {
      hipF: tf(24, 52), hipB: tf(-26, 52),
      shF: tf(62, -4), shB: tf(-64, -6),
      eyeA: tf(12, -28), eyeB: tf(40, -29),
      eyeScale: 1.05,
      mouth: tf(30, -4),
    };
  },

  drawBody(g, p, _a, info) {
    const { tf } = leanFrame(p, CY);
    const outline = toPts(tf, ellipse());
    g.poly(outline).fill(GREEN);
    for (let i = 0; i < 7; i++) g.poly(toPts(tf, stripe(-1.35 + i * 0.45, 0.13))).fill(STRIPE);
    g.poly(toPts(tf, crescent(0.95, 3.75, [-RX * 0.42, RY * 0.42]))).fill({ color: SHADOW, alpha: 0.5 });

    // damage: hairline cracks first, then chunks break away to show flesh
    const dmg = Math.floor(info.percent / 30);
    if (dmg >= 1) crack(g, tf, [[-52, -30], [-44, -22], [-47, -12], [-38, -6], [-40, 4]]);
    if (dmg >= 2) chunk(g, tf, -42, -22, 20, 3);
    if (dmg >= 3) crack(g, tf, [[30, 26], [40, 32], [36, 40], [48, 44]]);
    if (dmg >= 4) chunk(g, tf, 34, 30, 21, 7);
    if (dmg >= 5) chunk(g, tf, -22, 38, 15, 5);

    // highlight: a fat arc along the front rim plus a glint up top
    const hl = toPts(tf, Array.from({ length: 9 }, (_, i) => {
      const a = -0.95 + i * 0.11;
      return [Math.cos(a) * RX * 0.86, Math.sin(a) * RY * 0.86] as P2;
    }));
    g.poly(hl, false).stroke({ width: 8, color: HIGHLIGHT, cap: 'round', join: 'round' });
    const glint = tf(Math.cos(-1.2) * RX * 0.9, Math.sin(-1.2) * RY * 0.88);
    g.circle(glint.x, glint.y, 4).fill(HIGHLIGHT);

    if (p.flash > 0) g.poly(outline).fill({ color: 0xffffff, alpha: p.flash });
    g.poly(outline).stroke({ width: OUTLINE, color: INK, join: 'round' });

    // curly stem at the top pole
    const [px, py] = surf(0, -Math.PI / 2);
    const s0 = tf(px - 2, py + 2), s1 = tf(px + 2, py - 16), s2 = tf(px + 14, py - 14), s3 = tf(px + 12, py - 6);
    g.moveTo(s0.x, s0.y).quadraticCurveTo(s1.x, s1.y, s2.x, s2.y).quadraticCurveTo(s3.x + 4, s3.y - 2, s3.x, s3.y)
      .stroke({ width: 9, color: INK, cap: 'round', join: 'round' });
    g.moveTo(s0.x, s0.y).quadraticCurveTo(s1.x, s1.y, s2.x, s2.y).quadraticCurveTo(s3.x + 4, s3.y - 2, s3.x, s3.y)
      .stroke({ width: 4, color: 0x7a5a1c, cap: 'round', join: 'round' });
  },
};
