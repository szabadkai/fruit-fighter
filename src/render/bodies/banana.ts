import type { Graphics } from 'pixi.js';
import { hipPivot, rot, type BodyAnchors, type FruitArt, type Pose } from '../art';
import { INK, OUTLINE, lerp, lerpV, v, type V } from '../rig';

const YELLOW = 0xffd41f;
const SHADE = 0xe09a12;
const HIGHLIGHT = 0xfff7c2;
const BROWN = 0x5a3510;
const W = 36;
const SAMPLES = 26;

interface Body {
  spine: V[];
  normal: V[];
  width: number[];
}

function bananaBody(p: Pose): Body {
  const y = p.bodyY;
  const h = hipPivot(p);
  const a = rot(v(-4, -38 + y), h, p.lean);
  const c = rot(v(30 + p.bend, -118 + y), h, p.lean);
  const b = rot(v(-14 - p.bend * 0.3, -194 + y), h, p.lean);
  const spine: V[] = [];
  const normal: V[] = [];
  const width: number[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const u = 1 - t;
    spine.push(v(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y));
    const tx = 2 * u * (c.x - a.x) + 2 * t * (b.x - c.x);
    const ty = 2 * u * (c.y - a.y) + 2 * t * (b.y - c.y);
    const l = Math.hypot(tx, ty) || 1;
    normal.push(v(-ty / l, tx / l));
    width.push(Math.max(3, W * Math.pow(Math.sin(Math.PI * t), 0.55)));
  }
  return { spine, normal, width };
}

// Point on the body at spine parameter t, offset `side` widths along the normal (+ = belly).
function at(body: Body, t: number, side: number): V {
  const i = Math.min(SAMPLES - 1, Math.floor(t * SAMPLES));
  const k = t * SAMPLES - i;
  const s = lerpV(body.spine[i], body.spine[i + 1], k);
  const n = lerpV(body.normal[i], body.normal[i + 1], k);
  const w = lerp(body.width[i], body.width[i + 1], k);
  return v(s.x + n.x * w * side, s.y + n.y * w * side);
}

function band(body: Body, from: number, to: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const s = body.spine[i], n = body.normal[i], w = body.width[i];
    pts.push(s.x + n.x * w * from, s.y + n.y * w * from);
  }
  for (let i = SAMPLES; i >= 0; i--) {
    const s = body.spine[i], n = body.normal[i], w = body.width[i];
    pts.push(s.x + n.x * w * to, s.y + n.y * w * to);
  }
  return pts;
}

// The body is a tapered quadratic spine, so bend and lean curl it like a real banana.
let cache: { p: Pose; body: Body } | null = null;
function bodyFor(p: Pose) {
  if (cache?.p !== p) cache = { p, body: bananaBody(p) };
  return cache.body;
}

export const bananaArt: FruitArt = {
  arms: true,
  shoe: 0xe8262e,
  shoeBack: 0xa5161c,
  glove: 0xffffff,
  gloveBack: 0xd9d9d9,

  layout(p: Pose): BodyAnchors {
    const body = bodyFor(p);
    const m = at(body, 0.55, 0.38);
    return {
      hipF: at(body, 0.1, 0.35),
      hipB: at(body, 0.1, -0.35),
      shF: at(body, 0.5, 0.8),
      shB: at(body, 0.48, -0.75),
      eyeA: at(body, 0.68, 0.02),
      eyeB: at(body, 0.69, 0.62),
      eyeScale: 1,
      mouth: v(m.x, m.y + 2),
    };
  },

  drawBody(g: Graphics, p: Pose, _a, info) {
    const body = bodyFor(p);
    const outline = band(body, 1, -1);
    g.poly(outline).fill(YELLOW);
    g.poly(band(body, -1, -0.12)).fill(SHADE);
    const hl: number[] = [];
    for (let t = 0.22; t <= 0.62; t += 0.04) {
      const q = at(body, t, 0.6);
      hl.push(q.x, q.y);
    }
    g.moveTo(hl[0], hl[1]);
    for (let i = 2; i < hl.length; i += 2) g.lineTo(hl[i], hl[i + 1]);
    g.stroke({ width: 6, color: HIGHLIGHT, cap: 'round', join: 'round' });
    // freckles, plus more brown spots as it gets riper (damaged)
    const spots: [number, number, number][] = [[0.28, -0.55, 3.5], [0.34, -0.7, 2.5], [0.82, -0.5, 3]];
    const ripe = Math.min(6, Math.floor(info.percent / 25));
    const extra: [number, number, number][] = [[0.45, 0.3, 4], [0.2, 0.1, 3.5], [0.62, -0.3, 5], [0.38, -0.2, 3], [0.75, 0.2, 4], [0.15, -0.4, 3]];
    for (const [t, s, r] of spots.concat(extra.slice(0, ripe))) {
      const q = at(body, t, s);
      g.circle(q.x, q.y, r).fill(BROWN);
    }
    if (p.flash > 0) g.poly(outline).fill({ color: 0xffffff, alpha: p.flash });
    g.poly(outline).stroke({ width: OUTLINE, color: INK, join: 'round' });

    // stem + bottom tip
    const top = body.spine[SAMPLES];
    const nTop = body.normal[SAMPLES];
    const tan = v(nTop.y, -nTop.x);
    const stemEnd = v(top.x + tan.x * 16, top.y + tan.y * 16);
    g.moveTo(top.x - tan.x * 3, top.y - tan.y * 3).lineTo(stemEnd.x, stemEnd.y).stroke({ width: 14, color: INK, cap: 'butt' });
    g.moveTo(top.x - tan.x * 1, top.y - tan.y * 1).lineTo(stemEnd.x - tan.x * 2.5, stemEnd.y - tan.y * 2.5).stroke({ width: 7, color: 0x7a4f1d, cap: 'butt' });
    const bottom = body.spine[0];
    g.circle(bottom.x, bottom.y + 2, 5).fill(INK);
  },
};
