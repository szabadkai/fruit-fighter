import type { Graphics } from 'pixi.js';
import { leanFrame, type BodyAnchors, type FruitArt, type Pose } from '../art';
import { INK, OUTLINE } from '../rig';

// The coconut: a tank. A hairy brown ball with shaggy fibre strokes and the three
// coconut "eyes" on top. Hairline cracks creep in with damage, and from 100% the shell
// splits open across the belly to show white flesh (cracked coconuts are fast but fragile).

const BROWN = 0x7f4b22;
const SHADE = 0x4a2710;
const FIBRE_DARK = 0x3a1e0a;
const FIBRE_LIGHT = 0xc4884c;
const HIGHLIGHT = 0xe8b77a;
const FLESH = 0xfffaf0;
const SHELL = 0x3a1d08;
const MILK = 0xf4f1e6;
const RX = 60;
const RY = 56;
const CY = -106;

type TF = ReturnType<typeof leanFrame>['tf'];
type P2 = [number, number];

const toPts = (tf: TF, pts: P2[]) => pts.flatMap(([x, y]) => { const q = tf(x, y); return [q.x, q.y]; });

// Shaggy rim: every other sample pokes out a little, like tufts of husk.
const outlinePts = (): P2[] => Array.from({ length: 84 }, (_, i) => {
  const a = (i / 84) * Math.PI * 2;
  const k = i % 2 ? 1.035 + ((i * 7) % 5) * 0.008 : 0.995;
  return [Math.cos(a) * RX * k, Math.sin(a) * RY * k] as P2;
});

const surf = (lon: number, lat: number): P2 => [Math.cos(lat) * Math.sin(lon) * RX, Math.sin(lat) * RY];

// Hard shadow on the back/bottom: the rim from `a0` to `a1`, closed by a terminator curve.
function crescent(a0: number, a1: number, ctrl: P2): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = a0 + ((a1 - a0) * i) / 20;
    pts.push([Math.cos(a) * RX * 1.04, Math.sin(a) * RY * 1.04]);
  }
  const [ex, ey] = pts[20], [sx, sy] = pts[0];
  for (let i = 1; i < 12; i++) {
    const t = i / 12, u = 1 - t;
    pts.push([u * u * ex + 2 * u * t * ctrl[0] + t * t * sx, u * u * ey + 2 * u * t * ctrl[1] + t * t * sy]);
  }
  return pts;
}

// Fibre strokes run pole to pole along the surface: [lon, lat, light?].
const FIBRES: [number, number, boolean][] = [];
for (let i = 0, s = 11; i < 46; i++) {
  s = (s * 16807) % 2147483647;
  const lon = (s / 2147483647) * 2.9 - 1.45;
  s = (s * 16807) % 2147483647;
  const lat = (s / 2147483647) * 2.4 - 1.2;
  FIBRES.push([lon, lat, lon - lat * 0.8 > 0.1]);
}

function fibre(g: Graphics, tf: TF, lon: number, lat: number) {
  const a = tf(...surf(lon, lat)), b = tf(...surf(lon + 0.16, lat + 0.18)), c = tf(...surf(lon + 0.08, lat + 0.4));
  g.moveTo(a.x, a.y).quadraticCurveTo(b.x, b.y, c.x, c.y);
}

// Zigzag split across the belly, edge to edge; returns the gap polygon.
function split(h: number): P2[] {
  const top: P2[] = [], bot: P2[] = [];
  for (let i = 0; i <= 12; i++) {
    const x = -RX * 1.02 + (i / 12) * RX * 2.04;
    const y = 16 + (i % 2 ? -5 : 4) - x * 0.08;
    const w = h * (0.45 + 0.55 * Math.sin((i / 12) * Math.PI));
    top.push([x, y - w / 2]);
    bot.push([x + (i % 2 ? 2 : -2), y + w / 2]);
  }
  return top.concat(bot.reverse());
}

export const coconutArt: FruitArt = {
  arms: true,
  shoe: 0x2f8f3e,
  shoeBack: 0x1f662b,
  glove: 0xff7a1a,
  gloveBack: 0xc25610,

  layout(p: Pose): BodyAnchors {
    const { tf } = leanFrame(p, CY);
    return {
      hipF: tf(16, 48), hipB: tf(-18, 48),
      shF: tf(52, 0), shB: tf(-52, -2),
      eyeA: tf(12, -24), eyeB: tf(37, -25),
      eyeScale: 0.95,
      mouth: tf(28, -2),
    };
  },

  drawBody(g, p, _a, info) {
    const { tf } = leanFrame(p, CY);
    const outline = toPts(tf, outlinePts());
    g.poly(outline).fill(BROWN);
    g.poly(toPts(tf, crescent(0.9, 3.85, [-RX * 0.4, RY * 0.4]))).fill(SHADE);

    for (const [lon, lat, light] of FIBRES) if (light) fibre(g, tf, lon, lat);
    g.stroke({ width: 3, color: FIBRE_LIGHT, cap: 'round' });
    for (const [lon, lat, light] of FIBRES) if (!light) fibre(g, tf, lon, lat);
    g.stroke({ width: 3, color: FIBRE_DARK, cap: 'round' });

    // the three "eyes", up top behind the face
    for (const [x, y, r] of [[-30, -32, 5.5], [-16, -42, 5], [-17, -27, 4.5]]) {
      const q = tf(x, y);
      g.ellipse(q.x, q.y, r + 2.5, r + 1.5).fill(FIBRE_LIGHT);
      g.ellipse(q.x, q.y, r, r * 0.8).fill(FIBRE_DARK).stroke({ width: 2, color: INK });
    }

    // hairy highlight: a few parallel tufts on the front-top
    for (let i = 0; i < 4; i++) {
      const a = -1.05 + i * 0.17;
      const q0 = tf(Math.cos(a) * RX * 0.86, Math.sin(a) * RY * 0.86);
      const q1 = tf(Math.cos(a + 0.12) * RX * 0.66, Math.sin(a + 0.12) * RY * 0.66);
      g.moveTo(q0.x, q0.y).lineTo(q1.x, q1.y);
    }
    g.stroke({ width: 4, color: HIGHLIGHT, cap: 'round' });
    const glint = tf(Math.cos(-0.7) * RX * 0.7, Math.sin(-0.7) * RY * 0.7);
    g.circle(glint.x, glint.y, 3).fill(HIGHLIGHT);

    // hairline cracks first, then the shell splits open across the belly
    if (info.percent >= 35) {
      g.poly(toPts(tf, [[-6, -56], [-10, -46], [-4, -40], [-12, -30], [-8, -22]]), false);
      if (info.percent >= 70) g.poly(toPts(tf, [[44, 34], [36, 28], [40, 20], [30, 14]]), false);
      g.stroke({ width: 3, color: INK, cap: 'round', join: 'miter' });
    }
    if (info.percent >= 100) {
      // shell edge (dark brown) around the white flesh, inked
      const h = info.percent >= 150 ? 22 : 16;
      g.poly(toPts(tf, split(h))).fill(SHELL).stroke({ width: 3.5, color: INK, join: 'miter' });
      g.poly(toPts(tf, split(h * 0.62))).fill(FLESH);
      const lip = toPts(tf, split(h * 0.62).slice(0, 13).map(([x, y]) => [x, y + 2.5] as P2));
      g.poly(lip, false).stroke({ width: 2, color: 0xd8cbb0, cap: 'round' });
      if (info.percent >= 150) {
        const d = tf(18, 30 + ((info.t * 0.4) % 14));
        g.moveTo(d.x, d.y - 9).quadraticCurveTo(d.x + 6, d.y, d.x, d.y + 4).quadraticCurveTo(d.x - 6, d.y, d.x, d.y - 9)
          .fill(MILK).stroke({ width: 2.5, color: INK, join: 'round' });
      }
    }

    if (p.flash > 0) g.poly(outline).fill({ color: 0xffffff, alpha: p.flash });
    g.poly(outline).stroke({ width: OUTLINE, color: INK, join: 'miter' });
  },
};
