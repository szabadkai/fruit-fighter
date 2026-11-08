import type { Graphics } from 'pixi.js';
import { hipPivot, rot, type BodyInfo, type FruitArt, type Pose } from './art';
import { INK, brow, eye, glove, hose, mouth, shoe, v, type V } from './rig';

// Two-bone leg: the knee always bends forward, then the hose curve is drawn through it.
export function leg(g: Graphics, hip: V, foot: V) {
  const L = 30;
  const dx = foot.x - hip.x;
  const dy = foot.y - hip.y;
  const d = Math.hypot(dx, dy) || 1;
  let knee = v((hip.x + foot.x) / 2, (hip.y + foot.y) / 2);
  if (d < L * 2) {
    const a = Math.acos(d / (L * 2));
    const base = Math.atan2(dy, dx);
    const k1 = v(hip.x + Math.cos(base + a) * L, hip.y + Math.sin(base + a) * L);
    const k2 = v(hip.x + Math.cos(base - a) * L, hip.y + Math.sin(base - a) * L);
    knee = k1.x > k2.x ? k1 : k2;
  }
  const cx = 2 * knee.x - (hip.x + foot.x) / 2;
  const cy = 2 * knee.y - (hip.y + foot.y) / 2;
  g.moveTo(hip.x, hip.y).quadraticCurveTo(cx, cy, foot.x, foot.y).stroke({ width: 6.5, color: INK, cap: 'round' });
}

export function drawFace(g: Graphics, p: Pose, eyeA: V, eyeB: V, m: V, s: number) {
  eye(g, eyeA, 8.5 * s, 12.5 * s, p.look, p.eyes);
  eye(g, eyeB, 7 * s, 11.5 * s, p.look, p.eyes);
  const a = p.anger * 5 * s;
  brow(g, v(eyeA.x - 10 * s, eyeA.y - 17 * s), v(eyeA.x + 8 * s, eyeA.y - 13 * s + a));
  brow(g, v(eyeB.x - 6 * s, eyeB.y - 13 * s + a), v(eyeB.x + 8 * s, eyeB.y - 18 * s));
  mouth(g, m, p.mouth, s);
}

// Draws any fruit: back limbs, body, front leg, face, top layer, front arm.
export function drawFighter(g: Graphics, art: FruitArt, p: Pose, info: BodyInfo) {
  g.clear();
  const a = art.layout(p);
  const hip = hipPivot(p);
  const handF = rot(p.handF, hip, p.lean);
  const handB = rot(p.handB, hip, p.lean);

  leg(g, a.hipB, p.footB);
  shoe(g, p.footB, art.shoeBack);
  // The back arm stays behind the body, but its glove pops in front whenever it's
  // forward of the body's center, so both fists always read (cartoon cheat).
  let elB: V | null = null;
  const backGloveInFront = handB.x > hip.x - 6;
  if (art.arms) {
    elB = hose(g, a.shB, handB, 18, 6.5);
    if (!backGloveInFront) glove(g, handB, elB, p.gloveB, art.gloveBack);
  }

  art.drawBody(g, p, a, info);

  leg(g, a.hipF, p.footF);
  shoe(g, p.footF, art.shoe);

  drawFace(g, p, a.eyeA, a.eyeB, a.mouth, a.eyeScale);
  art.drawTop?.(g, p, a, info);
  if (elB && backGloveInFront) glove(g, handB, elB, p.gloveB, art.gloveBack);

  if (art.arms) {
    const elF = hose(g, a.shF, handF, 20, 7);
    glove(g, handF, elF, p.gloveF, art.glove);
  }
}
