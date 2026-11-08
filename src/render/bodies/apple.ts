import type { Graphics } from 'pixi.js';
import { leanFrame, type BodyAnchors, type FruitArt, type Pose } from '../art';
import { INK, OUTLINE, v } from '../rig';

// The training dummy: a bandaged apple with no arms that bruises as its percent climbs.

const RED = 0xe8332a;
const RED_SHADE = 0xa81f1c;
const BRUISE = 0x6b2d12;
const R = 50;
const CY = -78;

const BRUISES = [
  [-22, -18, 9, 6], [18, 14, 7, 5], [-8, 22, 10, 7], [30, -24, 6, 5],
  [-34, 6, 7, 6], [6, -36, 8, 5], [24, 30, 6, 4], [-18, 38, 7, 5],
] as const;

type TF = ReturnType<typeof leanFrame>['tf'];

function applePath(g: Graphics, tf: TF, s: number, ox: number, oy: number) {
  const r = R * s;
  const P = (x: number, y: number) => tf(ox + x, oy + y);
  const pts: [number, number][][] = [
    [[r * 0.5, -r * 1.15], [r * 1.15, -r * 0.8], [r * 1.05, -r * 0.05]],
    [[r * 1.0, r * 0.7], [r * 0.45, r * 1.05], [0, r * 0.88]],
    [[-r * 0.45, r * 1.05], [-r * 1.0, r * 0.7], [-r * 1.05, -r * 0.05]],
    [[-r * 1.15, -r * 0.8], [-r * 0.5, -r * 1.15], [0, -r * 0.78]],
  ];
  const s0 = P(0, -r * 0.78);
  g.moveTo(s0.x, s0.y);
  for (const [c1, c2, e] of pts) {
    const a = P(...c1), b = P(...c2), c = P(...e);
    g.bezierCurveTo(a.x, a.y, b.x, b.y, c.x, c.y);
  }
  g.closePath();
}

function rotRect(g: Graphics, tf: TF, cx: number, cy: number, w: number, h: number, a: number) {
  const c = Math.cos(a), s = Math.sin(a);
  const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].flatMap(([x, y]) => {
    const q = tf(cx + x * c - y * s, cy + x * s + y * c);
    return [q.x, q.y];
  });
  g.poly(pts).fill(0xf3dcae).stroke({ width: 3, color: INK, join: 'round' });
}

export const appleArt: FruitArt = {
  arms: false,
  shoe: 0x5b84ff,
  shoeBack: 0x4a6fd8,
  glove: 0xffffff,
  gloveBack: 0xd9d9d9,

  layout(p: Pose): BodyAnchors {
    const { tf } = leanFrame(p, CY);
    return {
      hipF: tf(10, 44), hipB: tf(-12, 44),
      shF: tf(40, 0), shB: tf(-40, 0),
      eyeA: tf(10, -10), eyeB: tf(32, -11),
      eyeScale: 0.92,
      mouth: tf(22, 16),
    };
  },

  drawBody(g, p, _a, info) {
    const { tf } = leanFrame(p, CY);
    applePath(g, tf, 1, 0, 0);
    g.fill(RED_SHADE);
    applePath(g, tf, 0.86, 7, -5);
    g.fill(RED);
    const bruises = Math.min(BRUISES.length, Math.floor(info.percent / 18));
    for (let i = 0; i < bruises; i++) {
      const [x, y, rx, ry] = BRUISES[i];
      const q = tf(x, y);
      g.ellipse(q.x, q.y, rx, ry).fill({ color: BRUISE, alpha: 0.85 });
    }
    const h1 = tf(R * 0.42, -R * 0.5);
    g.ellipse(h1.x, h1.y, 11, 6).fill(0xffffff);
    const h2 = tf(R * 0.7, -R * 0.3);
    g.circle(h2.x, h2.y, 3.5).fill(0xffffff);
    if (p.flash > 0) {
      applePath(g, tf, 1, 0, 0);
      g.fill({ color: 0xffffff, alpha: p.flash });
    }
    applePath(g, tf, 1, 0, 0);
    g.stroke({ width: OUTLINE, color: INK, join: 'round' });

    // stem + leaf
    const top = tf(0, -R * 0.78 + 4), c = tf(2, -R * 0.78 - 14), e = tf(8, -R * 0.78 - 22);
    g.moveTo(top.x, top.y).quadraticCurveTo(c.x, c.y, e.x, e.y).stroke({ width: 11, color: INK, cap: 'round' });
    g.moveTo(top.x, top.y).quadraticCurveTo(c.x, c.y, e.x, e.y).stroke({ width: 5, color: 0x6b4216, cap: 'round' });
    const sway = Math.sin(info.t * 0.06) * 3;
    const l0 = tf(6, -R * 0.78 - 14), l1 = tf(20, -R * 0.78 - 36 + sway), l2 = tf(40, -R * 0.78 - 26), l3 = tf(24, -R * 0.78 - 10);
    g.moveTo(l0.x, l0.y).quadraticCurveTo(l1.x, l1.y, l2.x, l2.y).quadraticCurveTo(l3.x, l3.y, l0.x, l0.y)
      .fill(0x4bbf3a).stroke({ width: 4, color: INK, join: 'round' });

    rotRect(g, tf, -26, 16, 26, 9, 0.7);
    rotRect(g, tf, -26, 16, 26, 9, -0.7);
  },
};

