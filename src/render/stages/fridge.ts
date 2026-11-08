import { Container, Graphics } from 'pixi.js';
import { platformAt, type StageDef } from '../../sim/stages';
import type { CameraInfo, StageView } from '../art';
import { INK } from '../rig';
import { crescent, edgeShade, mix, parallax, rng, shade } from './util';

// Inside the fridge: a frosty glass shelf over the crisper drawer is the (icy) main
// stage, glass shelves float above, and groceries line the back wall.

const GLASS = 0xd6f3ff;
const FROST = 0xf6fcff;

function jar(g: Graphics, x: number, y: number, w: number, h: number, fill: number, lid: number) {
  g.roundRect(x - w / 2, y - h, w, h, 12).fill(0xe8f6fc).stroke({ width: 3, color: INK });
  g.roundRect(x - w / 2 + 5, y - h * 0.75, w - 10, h * 0.7, 8).fill(fill);
  g.roundRect(x - w / 2 - 3, y - h - 16, w + 6, 20, 5).fill(lid).stroke({ width: 3, color: INK });
  g.rect(x - w / 2 + 8, y - h + 10, 7, h * 0.6).fill({ color: 0xffffff, alpha: 0.6 });
}

function milk(g: Graphics, x: number, y: number, band = 0x3c6fd4) {
  g.rect(x - 40, y - 150, 80, 150).fill(0xffffff).stroke({ width: 3, color: INK });
  g.poly([x - 40, y - 150, x, y - 190, x + 40, y - 150]).fill(0xf0f4f8).stroke({ width: 3, color: INK });
  g.rect(x - 8, y - 204, 16, 20).fill(0xffffff).stroke({ width: 3, color: INK });
  g.rect(x - 40, y - 110, 80, 50).fill(band);
  g.ellipse(x, y - 85, 22, 14).fill(0xffffff);
  g.rect(x + 20, y - 150, 20, 150).fill({ color: 0x9fb4c4, alpha: 0.4 });
}

function eggs(g: Graphics, x: number, y: number) {
  for (let i = 0; i < 5; i++) {
    const ex = x - 72 + i * 36;
    g.ellipse(ex, y - 40, 16, 21).fill(0xfff4e0).stroke({ width: 3, color: INK });
    crescent(g, ex, y - 40, 14.5, 19.5, 0xf0d8b8, 0.3);
  }
  g.poly([x - 96, y - 34, x + 96, y - 34, x + 86, y, x - 86, y]).fill(0xc9b8a0).stroke({ width: 3, color: INK });
  for (let i = 0; i < 5; i++) g.moveTo(x - 72 + i * 36 + 18, y - 30).lineTo(x - 72 + i * 36 + 18, y - 4).stroke({ width: 2, color: 0x9a8870 });
}

function interior(): Graphics {
  const g = new Graphics();
  const BW = 420, BT = -340, BB = 300;
  g.rect(-1500, -1000, 3000, 2000).fill(0x9cc6de);
  // side walls in perspective, ceiling and floor
  for (const s of [-1, 1]) {
    g.poly([s * BW, BT, s * 1500, -1000, s * 1500, 1000, s * BW, BB]).fill(0xb7d9ea);
    for (const y of [-200, 40, 250]) g.poly([s * BW, y, s * 1500, y + (y - 0) * 0.9, s * 1500, y + (y - 0) * 0.9 + 24, s * BW, y + 10]).fill(0xd8edf6).stroke({ width: 3, color: shade(0xb7d9ea, 0.4) });
  }
  g.poly([-BW, BT, BW, BT, 1500, -1000, -1500, -1000]).fill(0xd2e9f4);
  g.poly([-BW, BB, BW, BB, 1500, 1000, -1500, 1000]).fill(0x8fb8d0);
  // back wall with ribs, brightest in the middle
  for (let x = -BW; x < BW; x += 40) {
    const k = Math.abs(x + 20) / BW;
    g.rect(x, BT, 40, BB - BT).fill(mix(0xf4fbff, 0xd2e8f4, k));
    g.rect(x + 36, BT, 4, BB - BT).fill(mix(0xe2f0f8, 0xbcd8e8, k));
  }
  g.rect(-BW, BT, BW * 2, BB - BT).stroke({ width: 4, color: shade(0xb7d9ea, 0.45) });
  // back shelves with groceries (kept to the sides)
  for (const y of [-110, 150]) {
    g.rect(-BW, y, BW * 2, 12).fill({ color: 0xffffff, alpha: 0.8 }).stroke({ width: 3, color: shade(0xb7d9ea, 0.45) });
  }
  jar(g, -350, -110, 60, 90, 0x7fae4a, 0xd94a3a);
  jar(g, -275, -110, 52, 70, 0x8a3f9a, 0xe8b64a);
  milk(g, 340, -110);
  g.roundRect(240, -170, 60, 60, 8).fill(0xf6d84a).stroke({ width: 3, color: INK });
  for (const [cx, cy] of [[255, -154], [278, -136]] as const) g.circle(cx, cy, 6).fill(0xd8b830);
  eggs(g, -300, 150);
  // ketchup + butter
  g.roundRect(250, 10, 56, 140, 18).fill(0xd8392b).stroke({ width: 3, color: INK });
  g.roundRect(264, -20, 28, 34, 6).fill(0xf6f2ea).stroke({ width: 3, color: INK });
  g.rect(256, 50, 44, 30).fill(0xf6f2ea);
  g.roundRect(320, 110, 90, 40, 6).fill(0xfff2b0).stroke({ width: 3, color: INK });
  // frosted haze pushes the back groceries behind the real shelves
  g.rect(-BW, BT, BW * 2, BB - BT).fill({ color: 0xeaf6fc, alpha: 0.5 });
  // lamp housing with light cone
  g.poly([-120, BT + 40, 120, BT + 40, 400, BB, -400, BB]).fill({ color: 0xffffff, alpha: 0.22 });
  g.roundRect(-140, BT - 10, 280, 56, 18).fill(0xe8f6fc).stroke({ width: 4, color: INK });
  g.roundRect(-110, BT + 20, 220, 22, 10).fill(0xfffbe6).stroke({ width: 3, color: INK });
  return g;
}

function frost(): Graphics {
  const g = new Graphics();
  const r = rng(31);
  // frost banks in the corners
  for (const [cx, cy] of [[-620, -340], [620, -340], [-640, 380], [640, 380]] as const) {
    for (let i = 0; i < 14; i++) {
      const x = cx + (r() - 0.5) * 420, y = cy + (r() - 0.5) * 200;
      g.circle(x, y, 40 + r() * 70).fill({ color: FROST, alpha: 0.55 });
    }
  }
  // icicles along the ceiling edge
  for (let x = -1300; x < 1300; x += 36 + r() * 30) {
    if (Math.abs(x) < 170) continue;
    const L = 24 + r() * 60;
    const y = Math.abs(x) < 420 ? -346 : -346 - (Math.abs(x) - 420) * 0.6;
    g.poly([x - 12, y, x + 12, y, x + 2, y + L]).fill(FROST).stroke({ width: 3, color: shade(0x9cc6de, 0.5) });
  }
  // snowflakes
  for (let i = 0; i < 18; i++) {
    const x = (r() - 0.5) * 2400, y = (r() - 0.5) * 1400;
    if (Math.abs(x) < 520 && Math.abs(y) < 380) continue;
    const s = 10 + r() * 14;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI;
      g.moveTo(x - Math.cos(a) * s, y - Math.sin(a) * s).lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s).stroke({ width: 3, color: 0xffffff, cap: 'round' });
    }
  }
  return g;
}

function crisper(w: number): Graphics {
  const g = new Graphics();
  const hw = w / 2 + 14;
  g.rect(-2300, 330, 4600, 1000).fill(0x7fa9c4);
  g.rect(-2300, 330, 4600, 12).fill(0xa8cde0);
  // vegetables behind the frosted drawer front
  g.circle(-250, 170, 80).fill(0x7a3f9a).stroke({ width: 5, color: INK });
  for (const a of [-0.6, 0, 0.6]) g.moveTo(-250, 170).quadraticCurveTo(-250 + Math.sin(a) * 90, 170 - 40, -250 + Math.sin(a) * 60, 110).stroke({ width: 3, color: 0xb88ad0 });
  for (const [x, rot] of [[-60, -0.3], [-10, 0.2], [30, -0.1]] as const) {
    const dx = Math.sin(rot) * 140;
    g.poly([x - 16, 100, x + 16, 100, x + dx, 250]).fill(0xff8a2a).stroke({ width: 4, color: INK });
    g.ellipse(x, 92, 20, 14).fill(0x4fa34d).stroke({ width: 3, color: INK });
  }
  g.ellipse(220, 180, 90, 70).fill(0x8fcf5a).stroke({ width: 5, color: INK });
  g.ellipse(200, 150, 60, 34).fill(0xb4e07a);
  g.roundRect(320, 140, 70, 90, 26).fill(0xd8392b).stroke({ width: 4, color: INK });
  g.circle(470, 180, 74).fill(0x7a3f9a).stroke({ width: 5, color: INK });
  g.ellipse(-470, 190, 84, 62).fill(0x8fcf5a).stroke({ width: 5, color: INK });
  g.ellipse(-490, 160, 54, 30).fill(0xb4e07a);
  for (const x of [-380, -340]) {
    g.poly([x - 14, 120, x + 14, 120, x + 20, 270]).fill(0xff8a2a).stroke({ width: 4, color: INK });
    g.ellipse(x, 112, 18, 12).fill(0x4fa34d).stroke({ width: 3, color: INK });
  }
  // drawer front
  g.roundRect(-hw + 30, 34, hw * 2 - 60, 280, 16).fill({ color: 0xd2ecf8, alpha: 0.62 }).stroke({ width: 6, color: INK });
  for (let x = -hw + 80; x < hw - 60; x += 60) g.moveTo(x, 60).lineTo(x - 30, 300).stroke({ width: 8, color: 0xffffff, alpha: 0.25 });
  g.roundRect(-110, 50, 220, 30, 15).fill(0x6f9ab4).stroke({ width: 4, color: INK });
  g.rect(-hw + 30, 280, hw * 2 - 60, 34).fill({ color: 0x3f6f8f, alpha: 0.4 });
  // glass shelf (walkable, icy), with metal trim, frost lip and icicles
  g.rect(-hw + 4, 12, hw * 2 - 8, 16).fill(0x9fb4c4).stroke({ width: 5, color: INK });
  g.roundRect(-hw, -8, hw * 2, 22, 6).fill(GLASS).stroke({ width: 6, color: INK });
  g.moveTo(-hw + 10, 7).lineTo(hw - 10, 7).stroke({ width: 3, color: 0x9ed8f2 });
  const r = rng(8);
  for (let x = -hw + 20; x < hw - 20; x += 40 + r() * 50) {
    const L = 14 + r() * 26;
    g.poly([x - 8, 26, x + 8, 26, x + 1, 26 + L]).fill(FROST).stroke({ width: 3, color: INK, join: 'round' });
  }
  for (let x = -hw + 30; x < hw - 30; x += 110) g.moveTo(x, 4).lineTo(x + 50, -4).stroke({ width: 4, color: 0xffffff, cap: 'round' });
  return g;
}

// Glass shelf with a chrome rim; groceries stand on it behind the walkable edge.
function glassShelf(w: number, items: (g: Graphics) => void): Graphics {
  const g = new Graphics();
  const hw = w / 2;
  items(g);
  const r = rng(w);
  for (let x = -hw + 24; x < hw - 24; x += 46 + r() * 40) {
    const L = 12 + r() * 20;
    g.poly([x - 7, 28, x + 7, 28, x + 1, 28 + L]).fill(FROST).stroke({ width: 3, color: INK, join: 'round' });
  }
  g.roundRect(-hw - 4, 2, w + 8, 28, 7).fill(0xb8c4ce).stroke({ width: 5, color: INK });
  g.rect(-hw + 4, 8, w - 8, 5).fill(0xffffff);
  g.rect(-hw + 4, 21, w - 8, 4).fill(0x7f8f9c);
  g.roundRect(-hw - 2, -10, w + 4, 16, 5).fill({ color: GLASS, alpha: 0.92 }).stroke({ width: 4, color: INK });
  g.moveTo(-hw + 12, -4).lineTo(-hw * 0.1, -4).stroke({ width: 3, color: 0xffffff, cap: 'round' });
  g.ellipse(hw * 0.4, -2, 26, 3).fill(FROST);
  for (const x of [-hw - 16, hw - 4]) g.roundRect(x, -14, 20, 48, 6).fill(0xd8e0e8).stroke({ width: 4, color: INK });
  return g;
}

function yogurt(g: Graphics, x: number, y: number, c: number) {
  g.poly([x - 26, y - 56, x + 26, y - 56, x + 20, y, x - 20, y]).fill(0xffffff).stroke({ width: 4, color: INK });
  g.rect(x - 22, y - 40, 44, 18).fill(c);
  g.ellipse(x, y - 56, 28, 7).fill(0xd8e0e8).stroke({ width: 3, color: INK });
}

function cheese(g: Graphics, x: number, y: number) {
  g.poly([x - 50, y, x + 50, y, x + 50, y - 46, x - 50, y - 16]).fill(0xffd84a).stroke({ width: 4, color: INK });
  g.poly([x - 50, y - 16, x + 50, y - 46, x + 34, y - 56, x - 60, y - 22]).fill(0xfff0a0).stroke({ width: 4, color: INK });
  for (const [cx, cy, cr] of [[-20, -8, 7], [18, -18, 9], [36, -8, 5]] as const) g.circle(x + cx, y + cy, cr).fill(0xe0b830);
}

const SHELF_ITEMS: ((g: Graphics) => void)[] = [
  () => {},
  (g) => { eggs(g, -30, 2); yogurt(g, 100, 2, 0xf26aa0); },
  (g) => { jar(g, -70, 2, 64, 84, 0x8a3f9a, 0xe8b64a); yogurt(g, 20, 2, 0x3c6fd4); jar(g, 100, 2, 50, 60, 0xd94a3a, 0xf6f2ea); },
  (g) => { milk(g, -90, 2); cheese(g, 50, 2); },
  (g) => { jar(g, 30, 2, 72, 104, 0x7fae4a, 0xd94a3a); },
  (g) => { milk(g, -30, 2, 0x7b3fa0); yogurt(g, 60, 2, 0x6aa84f); },
];

function sparkle(g: Graphics, x: number, y: number, s: number) {
  g.poly([x, y - s, x + s * 0.25, y - s * 0.25, x + s, y, x + s * 0.25, y + s * 0.25, x, y + s, x - s * 0.25, y + s * 0.25, x - s, y, x - s * 0.25, y - s * 0.25]).fill(0xffffff).stroke({ width: 2, color: INK });
}

export function fridge(def: StageDef): StageView {
  const backdrop = new Container();
  const far = interior();
  const mid = frost();
  const vignette = new Graphics();
  edgeShade(vignette, 540, -320, 360, 7, 55, 0.07, 0x0b2a4a);
  vignette.position.set(640, 360);
  backdrop.addChild(far, mid, vignette);

  const world = new Container();
  const main = def.platforms[0];
  world.addChild(crisper(main.w));
  const soft: Graphics[] = [];
  for (let i = 1; i < def.platforms.length; i++) {
    soft[i] = glassShelf(def.platforms[i].w, SHELF_ITEMS[i] ?? SHELF_ITEMS[0]);
    world.addChild(soft[i]);
  }
  const twinkle = new Graphics();
  world.addChild(twinkle);

  const front = new Container();
  const mist = new Graphics();
  front.addChild(mist);

  return {
    backdrop,
    world,
    front,
    update(frame: number, cam: CameraInfo) {
      parallax(far, cam, 0.04);
      parallax(mid, cam, 0.12);
      for (let i = 1; i < def.platforms.length; i++) {
        const p = platformAt(def, i, frame);
        soft[i].position.set(p.x, p.y);
      }
      // glints sliding along the icy top
      twinkle.clear();
      for (let i = 0; i < 4; i++) {
        const k = ((frame * 0.004 + i * 0.27) % 1);
        const s = Math.sin(k * Math.PI) * 11;
        if (s > 2) sparkle(twinkle, -main.w / 2 + k * main.w, 2 + (i % 2) * 6, s);
      }
      // cold mist over the drawer front
      mist.clear();
      for (let i = 0; i < 7; i++) {
        const x = ((frame * (0.3 + i * 0.05) + i * 260) % 1600) - 800;
        mist.ellipse(x, 70 + (i % 3) * 40, 150, 26).fill({ color: 0xffffff, alpha: 0.22 });
      }
    },
  };
}
