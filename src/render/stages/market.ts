import { Container, Graphics } from 'pixi.js';
import { hazardAt, platformAt, type StageDef } from '../../sim/stages';
import type { CameraInfo, StageView } from '../art';
import { INK } from '../rig';
import { cloud, edgeShade, fruit, mix, parallax, rng, shade, type FruitKind } from './util';

// Outdoor farmers market: a wooden stage, striped awnings that drift up and down,
// a town and bunting behind, and a runaway fruit cart.

const WOOD = 0xdca468;
const DARK_WOOD = 0x9a5f34;
const AWNINGS = [0x2a9bb0, 0x2a9bb0, 0x7a4fb8, 0x3c6fd4];
const KINDS: FruitKind[] = ['apple', 'orange', 'lemon', 'plum', 'pear', 'lime', 'peach'];

function sky(): Graphics {
  const g = new Graphics();
  for (let y = -1000; y < 1000; y += 50) {
    const k = Math.min(1, Math.max(0, (260 - y) / 900));
    g.rect(-1500, y, 3000, 50).fill(mix(0xe4f6ff, 0x4f9be0, k * k));
  }
  g.circle(-560, -300, 70).fill(0xfff6c0).stroke({ width: 4, color: INK });
  return g;
}

function town(): Graphics {
  const g = new Graphics();
  g.ellipse(-700, 230, 700, 180).fill(0xa9c6ea);
  g.ellipse(600, 240, 800, 170).fill(0x9bb8e0);
  const r = rng(21);
  for (let x = -1400; x < 1400; x += 130 + Math.floor(r() * 40)) {
    if (Math.abs(x) < 300) continue;
    const h = 120 + r() * 120, w = 100 + r() * 30;
    const wall = [0xf2e3c6, 0xe8d2e8, 0xd6e8f0, 0xf6d8c0][Math.floor(r() * 4)];
    const roof = [0x5a6fc0, 0x8a4fa8, 0x3f8f9d, 0xb8573e][Math.floor(r() * 4)];
    const base = 300;
    g.rect(x, base - h, w, h).fill(wall).stroke({ width: 3, color: INK });
    g.poly([x - 10, base - h, x + w / 2, base - h - 60, x + w + 10, base - h]).fill(roof).stroke({ width: 3, color: INK });
    for (let wy = base - h + 24; wy < base - 30; wy += 44) {
      g.rect(x + 18, wy, 22, 26).fill(0x8fb6d8).stroke({ width: 2, color: INK });
      g.rect(x + w - 40, wy, 22, 26).fill(0x8fb6d8).stroke({ width: 2, color: INK });
    }
  }
  // clock tower in the centre, kept pale
  g.rect(-50, -40, 100, 340).fill(0xf4ead6).stroke({ width: 3, color: INK });
  g.poly([-66, -40, 0, -150, 66, -40]).fill(0x6f86d0).stroke({ width: 3, color: INK });
  g.circle(0, 20, 30).fill(0xffffff).stroke({ width: 3, color: INK });
  g.moveTo(0, 20).lineTo(0, 0).moveTo(0, 20).lineTo(14, 26).stroke({ width: 3, color: INK });
  g.rect(-1500, 300, 3000, 700).fill(0x9ccf8a);
  g.rect(-1500, 300, 3000, 10).fill(0x7fb070);
  return g;
}

function stall(g: Graphics, x: number, color: number) {
  g.rect(x - 4, -150, 10, 450).fill(0x6b4024).stroke({ width: 3, color: INK });
  g.rect(x + 300, -150, 10, 450).fill(0x6b4024).stroke({ width: 3, color: INK });
  g.poly([x - 30, -120, x + 340, -120, x + 310, -200, x, -200]).fill(color).stroke({ width: 4, color: INK });
  for (let i = 0; i < 6; i++) {
    const a = x - 30 + i * 62;
    g.poly([a, -120, a + 31, -120, a + 26 + 4, -200, a + 10 + i * -1, -200]).fill(0xffffff);
  }
  for (let i = 0; i < 12; i++) g.moveTo(x - 30 + i * 31, -120).arc(x - 14 + i * 31, -120, 16, Math.PI, 0, false).fill(i % 2 ? 0xffffff : color).stroke({ width: 3, color: INK });
  g.rect(x - 20, 150, 340, 30).fill(DARK_WOOD).stroke({ width: 4, color: INK });
  g.rect(x - 10, 180, 320, 120).fill(shade(DARK_WOOD, 0.25)).stroke({ width: 4, color: INK });
  const r = rng(x | 0);
  for (let i = 0; i < 9; i++) fruit(g, KINDS[Math.floor(r() * KINDS.length)], x + 10 + i * 36, 140 - (i % 2) * 8, 18, 3, 0.15);
}

function bunting(g: Graphics, x0: number, x1: number, y: number, sag: number, seed: number) {
  const cols = [0x2a9bb0, 0xffffff, 0x7a4fb8, 0xf2a0c8, 0x3c6fd4];
  const at = (t: number) => [x0 + (x1 - x0) * t, y + sag * 4 * t * (1 - t)];
  g.moveTo(x0, y);
  for (let i = 1; i <= 30; i++) { const [px, py] = at(i / 30); g.lineTo(px, py); }
  g.stroke({ width: 3, color: INK });
  const n = Math.floor((x1 - x0) / 60);
  for (let i = 0; i < n; i++) {
    const [ax, ay] = at(i / n), [bx, by] = at((i + 0.8) / n);
    g.poly([ax, ay, bx, by, (ax + bx) / 2, (ay + by) / 2 + 46]).fill(cols[(i + seed) % cols.length]).stroke({ width: 3, color: INK });
  }
}

function stalls(): Graphics {
  const g = new Graphics();
  stall(g, -1160, 0x3c6fd4);
  stall(g, -800, 0x7a4fb8);
  stall(g, 520, 0x2a9bb0);
  stall(g, 880, 0x3c6fd4);
  bunting(g, -1300, 0, -380, 120, 0);
  bunting(g, 0, 1300, -380, 120, 2);
  bunting(g, -700, 700, -290, 90, 4);
  return g;
}

function crate(g: Graphics, x: number, y: number, seed: number) {
  const r = rng(seed);
  for (let i = 0; i < 6; i++) fruit(g, KINDS[Math.floor(r() * KINDS.length)], x - 60 + i * 24, y - 6 - (i % 2) * 10, 20, 4);
  g.rect(x - 80, y, 160, 90).fill(0xc98a4f).stroke({ width: 5, color: INK });
  for (const sy of [y + 28, y + 58]) g.rect(x - 80, sy, 160, 6).fill(0x9a5f34);
  g.rect(x - 80, y, 16, 90).fill(0xb07440).stroke({ width: 3, color: INK });
  g.rect(x + 64, y, 16, 90).fill(0xb07440).stroke({ width: 3, color: INK });
}

function stage(w: number): Graphics {
  const g = new Graphics();
  const hw = w / 2 + 20;
  // cobbles
  g.rect(-2300, 420, 4600, 900).fill(0xb8b0a4);
  const r = rng(3);
  for (let y = 430; y < 1000; y += 34) for (let x = -2300 + ((y / 34) % 2) * 30; x < 2300; x += 60) g.roundRect(x, y, 54 + r() * 4, 28, 10).fill(mix(0xd0c8bc, 0xa49a8e, r())).stroke({ width: 2, color: 0x7a7066 });
  g.rect(-2300, 416, 4600, 8).fill(0x7a7066);
  // legs + cross bracing
  for (const x of [-hw + 30, -150, 150, hw - 30]) g.rect(x - 16, 110, 32, 320).fill(DARK_WOOD).stroke({ width: 5, color: INK });
  for (const [a, b] of [[-hw + 30, -150], [150, hw - 30]]) {
    g.moveTo(a, 130).lineTo(b, 400).moveTo(b, 130).lineTo(a, 400).stroke({ width: 14, color: INK });
    g.moveTo(a, 130).lineTo(b, 400).moveTo(b, 130).lineTo(a, 400).stroke({ width: 8, color: shade(DARK_WOOD, 0.15) });
  }
  g.rect(-150, 110, 300, 310).fill(shade(DARK_WOOD, 0.45)).stroke({ width: 5, color: INK });
  crate(g, -60, 330, 4);
  crate(g, 80, 330, 9);
  // fascia boards + banner
  g.rect(-hw + 6, 14, hw * 2 - 12, 100).fill(DARK_WOOD).stroke({ width: 6, color: INK });
  for (const y of [46, 80]) g.moveTo(-hw + 10, y).lineTo(hw - 10, y).stroke({ width: 3, color: shade(DARK_WOOD, 0.35) });
  for (let x = -hw + 30; x < hw; x += 120) for (const y of [30, 62, 96]) g.circle(x, y, 3).fill(0x3a2a20);
  g.poly([-180, 20, 180, 20, 160, 110, 0, 96, -160, 110]).fill(0xf6f2ea).stroke({ width: 5, color: INK });
  for (let x = -160; x < 160; x += 40) g.rect(x, 20, 20, 82).fill({ color: 0x2a9bb0, alpha: 0.85 });
  g.circle(0, 58, 30).fill(0xffffff).stroke({ width: 4, color: INK });
  fruit(g, 'apple', 0, 62, 18, 3);
  // deck: walkable top face, y = 0 runs through it
  g.roundRect(-hw, -8, hw * 2, 26, 6).fill(WOOD).stroke({ width: 6, color: INK });
  for (let x = -hw + 90; x < hw; x += 90) g.moveTo(x, -4).lineTo(x, 14).stroke({ width: 3, color: shade(WOOD, 0.3) });
  g.moveTo(-hw + 12, 12).lineTo(hw - 12, 12).stroke({ width: 3, color: shade(WOOD, 0.22) });
  // side crates on the ground
  crate(g, -hw - 170, 330, 12);
  crate(g, -hw - 120, 240, 17);
  crate(g, hw + 160, 330, 23);
  crate(g, hw + 340, 330, 31);
  crate(g, hw + 250, 240, 37);
  crate(g, -hw - 360, 330, 41);
  // a parked barrow and a sack of potatoes further out
  g.ellipse(-hw - 640, 360, 70, 60).fill(0xc8a070).stroke({ width: 5, color: INK });
  g.moveTo(-hw - 680, 310).quadraticCurveTo(-hw - 640, 290, -hw - 600, 310).stroke({ width: 4, color: 0x8a6440 });
  g.roundRect(hw + 520, 300, 220, 90, 10).fill(0x3f8f9d).stroke({ width: 5, color: INK });
  g.circle(hw + 560, 400, 26).fill(DARK_WOOD).stroke({ width: 5, color: INK });
  g.circle(hw + 700, 400, 26).fill(DARK_WOOD).stroke({ width: 5, color: INK });
  for (let i = 0; i < 5; i++) fruit(g, KINDS[i], hw + 550 + i * 40, 292, 22, 4);
  return g;
}

function awning(w: number, color: number): Graphics {
  const g = new Graphics();
  const hw = w / 2;
  for (const x of [-hw + 18, hw - 18]) g.moveTo(x, 0).lineTo(x * 0.8, -1500).stroke({ width: 4, color: 0x5a4030 });
  const n = 6, sw = w / n, top = 12, bot = 52, rr = sw / 2;
  for (let i = 0; i < n; i++) {
    const x = -hw + i * sw, c = i % 2 ? 0xffffff : color;
    g.rect(x, top, sw, bot - top).fill(c);
    g.moveTo(x, bot).arc(x + rr, bot, rr, Math.PI, 0, false).fill(c);
  }
  g.rect(-hw, top, w, 9).fill({ color: 0x000000, alpha: 0.2 });
  g.poly([hw * 0.4, top, hw, top, hw, bot, hw * 0.4, bot]).fill({ color: 0x000000, alpha: 0.1 });
  for (let i = 0; i < n; i++) g.moveTo(-hw + i * sw + sw * 0.3, bot + 4).arc(-hw + i * sw + rr, bot + 2, rr * 0.55, Math.PI * 0.85, Math.PI * 0.15, true).stroke({ width: 3, color: 0x000000, alpha: 0.15 });
  g.moveTo(-hw, top).lineTo(-hw, bot);
  for (let i = 0; i < n; i++) g.arc(-hw + i * sw + rr, bot, rr, Math.PI, 0, false);
  g.lineTo(hw, top).stroke({ width: 5, color: INK, join: 'round' });
  // wooden pelmet: lit top, darker front
  g.roundRect(-hw - 12, -9, w + 24, 24, 7).fill(0x8a5a34).stroke({ width: 5, color: INK });
  g.roundRect(-hw - 12, -9, w + 24, 11, 6).fill(0xd09a5e).stroke({ width: 4, color: INK });
  g.moveTo(-hw, -5).lineTo(-hw * 0.2, -5).stroke({ width: 3, color: 0xf2c890, cap: 'round' });
  for (const x of [-hw + 18, hw - 18]) g.circle(x, 8, 4).fill(0xe8b64a).stroke({ width: 2, color: INK });
  return g;
}

function cart(): { root: Container; wheels: Graphics[] } {
  const root = new Container();
  const g = new Graphics();
  // handles trail behind (local -x), cart faces +x
  g.moveTo(-70, -96).lineTo(-170, -130).stroke({ width: 14, color: INK, cap: 'round' });
  g.moveTo(-70, -96).lineTo(-170, -130).stroke({ width: 7, color: DARK_WOOD, cap: 'round' });
  const r = rng(77);
  for (let i = 0; i < 7; i++) fruit(g, KINDS[Math.floor(r() * KINDS.length)], -60 + i * 20, -124 - (i % 2) * 12, 18, 4);
  fruit(g, 'grapes', 30, -142, 22, 4);
  g.roundRect(-84, -126, 168, 74, 8).fill(0xc0473a).stroke({ width: 6, color: INK });
  g.rect(-76, -96, 152, 6).fill(shade(0xc0473a, 0.3));
  g.rect(-76, -74, 152, 6).fill(shade(0xc0473a, 0.3));
  g.roundRect(-92, -132, 184, 16, 6).fill(WOOD).stroke({ width: 5, color: INK });
  root.addChild(g);
  const wheels: Graphics[] = [];
  for (const x of [-46, 46]) {
    const w = new Graphics();
    w.circle(0, 0, 30).fill(DARK_WOOD).stroke({ width: 6, color: INK });
    w.circle(0, 0, 21).fill(WOOD).stroke({ width: 3, color: INK });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      w.moveTo(0, 0).lineTo(Math.cos(a) * 21, Math.sin(a) * 21).stroke({ width: 4, color: INK });
    }
    w.circle(0, 0, 6).fill(0x3a3a44);
    w.position.set(x, -30);
    wheels.push(w);
    root.addChild(w);
  }
  return { root, wheels };
}

function warnSign(): Graphics {
  const g = new Graphics();
  g.poly([0, -70, 66, 46, -66, 46]).fill(0xffd23a).stroke({ width: 7, color: INK, join: 'round' });
  g.roundRect(-9, -34, 18, 50, 8).fill(INK);
  g.circle(0, 30, 9).fill(INK);
  g.poly([90, -20, 130, 6, 90, 32]).fill(0xff3b2a).stroke({ width: 5, color: INK, join: 'round' });
  g.rect(70, -2, 22, 16).fill(0xff3b2a).stroke({ width: 4, color: INK });
  return g;
}

export function market(def: StageDef): StageView {
  const backdrop = new Container();
  const skyL = sky();
  const clouds = new Graphics();
  for (const off of [0, -2600]) for (const [x, y, s] of [[-900, -420, 1.2], [-300, -250, 0.8], [300, -440, 1], [900, -300, 1.3], [1500, -400, 0.9]] as const) cloud(clouds, x + off, y, s);
  const townL = town();
  const stallL = stalls();
  const vignette = new Graphics();
  edgeShade(vignette, 520, -330, 360, 6, 60, 0.06, 0x10204a);
  vignette.position.set(640, 360);
  backdrop.addChild(skyL, clouds, townL, stallL, vignette);

  const world = new Container();
  world.addChild(stage(def.platforms[0].w));
  const soft: Graphics[] = [];
  for (let i = 1; i < def.platforms.length; i++) {
    soft[i] = awning(def.platforms[i].w, AWNINGS[i]);
    world.addChild(soft[i]);
  }

  const front = new Container();
  const c = cart();
  const speed = new Graphics();
  const sign = warnSign();
  front.addChild(speed, c.root, sign);

  return {
    backdrop,
    world,
    front,
    update(frame: number, cam: CameraInfo) {
      parallax(skyL, cam, 0.02);
      parallax(townL, cam, 0.05);
      parallax(stallL, cam, 0.11);
      parallax(clouds, cam, 0.03);
      clouds.x += (frame * 0.25) % 2600;
      for (let i = 1; i < def.platforms.length; i++) {
        const p = platformAt(def, i, frame);
        soft[i].position.set(p.x, p.y);
      }
      const h = hazardAt(def, frame);
      c.root.visible = h?.phase === 'active';
      sign.visible = h?.phase === 'warn';
      speed.clear();
      if (!h) return;
      if (h.phase === 'warn') {
        const edge = -h.dir * (def.platforms[0].w / 2 - 70);
        const pulse = 1 + Math.sin(frame * 0.5) * 0.08;
        sign.position.set(edge, -230 + Math.sin(frame * 0.3) * 6);
        sign.scale.set(pulse * h.dir, pulse);
        sign.alpha = Math.floor(frame / 8) % 2 === 0 ? 1 : 0.75;
      } else if (h.phase === 'active') {
        const bounce = Math.abs(Math.sin(frame * 0.45)) * -5;
        c.root.position.set(h.x, bounce);
        c.root.scale.x = h.dir;
        for (const w of c.wheels) w.rotation = (h.x * h.dir) / 30;
        for (let i = 0; i < 5; i++) {
          const y = -130 + i * 26;
          const x0 = h.x - h.dir * (110 + (i % 2) * 30);
          speed.moveTo(x0, y).lineTo(x0 - h.dir * (90 + i * 14), y).stroke({ width: 5, color: 0xffffff, cap: 'round' });
        }
        for (let i = 0; i < 3; i++) speed.circle(h.x - h.dir * (90 + i * 40), -12 - i * 6, 14 + i * 6).fill({ color: 0xe8dcc8, alpha: 0.8 - i * 0.2 });
      }
    },
  };
}
