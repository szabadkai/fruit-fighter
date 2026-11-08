import { Container, Graphics } from 'pixi.js';
import { platformAt, type StageDef } from '../../sim/stages';
import type { CameraInfo, StageView } from '../art';
import { INK } from '../rig';
import { crescent, edgeShade, fruit, mix, parallax, puck, rng, shade } from './util';

// A giant blue ceramic bowl on a gingham-covered dining table. Wooden spoons and an
// orange slice float above as the pass-through platforms.

const COBALT = 0x2c64b8;
const GLAZE = 0xf6f1e4;

function wall(): Graphics {
  const g = new Graphics();
  // wallpaper: soft mint stripes, slightly darker away from the centre
  for (let x = -1400; x < 1400; x += 40) {
    const k = Math.min(1, Math.abs(x + 20) / 1100);
    const base = mix(0xd3efe6, 0x8fc4b6, k * k);
    g.rect(x, -900, 40, 1800).fill((x / 40) % 2 === 0 ? base : shade(base, 0.05));
  }
  for (let y = -880; y < 300; y += 80) {
    for (let x = -1380; x < 1400; x += 80) {
      const ox = (Math.round(y / 80) % 2) * 40;
      const k = Math.min(1, Math.abs(x + ox) / 1100);
      const c = mix(0x9fd0c2, 0x5f9c8e, k);
      const cx = x + ox, cy = y;
      g.poly([cx, cy - 9, cx + 6, cy, cx, cy + 9, cx - 6, cy]).fill(c);
      g.circle(cx, cy - 14, 2.5).fill(c);
    }
  }
  // chair rail + wainscot panels
  g.rect(-1400, 250, 2800, 700).fill(0x3d7c8c);
  for (let x = -1380; x < 1400; x += 180) g.roundRect(x + 14, 290, 150, 220, 8).fill(0x356d7b).stroke({ width: 3, color: shade(0x3d7c8c, 0.45) });
  g.rect(-1400, 236, 2800, 22).fill(0xf2e6c8).stroke({ width: 4, color: INK });

  // window with garden view
  g.roundRect(-232, -322, 464, 470, 18).fill(0xf2e6c8).stroke({ width: 5, color: INK });
  g.rect(-200, -290, 400, 406).fill(0xd4f1ff);
  g.rect(-200, -10, 400, 126).fill(0xbfe8f7);
  g.ellipse(-90, 40, 190, 70).fill(0xa6dcb4);
  g.ellipse(130, 60, 200, 60).fill(0x93d0a4);
  g.rect(-200, 80, 400, 36).fill(0x86c597);
  g.circle(110, -40, 46).fill(0x7fbf8f).stroke({ width: 3, color: 0x4f8c63 });
  g.rect(104, -2, 12, 60).fill(0x8a6448);
  g.circle(-120, -200, 30).fill(0xfff6c8);
  for (const [cx, cy] of [[60, -220], [-30, -160]] as const) {
    g.ellipse(cx, cy, 60, 16).fill(0xffffff);
    g.ellipse(cx + 18, cy - 10, 30, 14).fill(0xffffff);
  }
  g.rect(-200, -290, 400, 406).stroke({ width: 5, color: INK });
  for (const mx of [-72, 72]) g.rect(mx - 5, -290, 10, 406).fill(0xf2e6c8).stroke({ width: 3, color: INK });
  g.rect(-200, -96, 400, 12).fill(0xf2e6c8).stroke({ width: 3, color: INK });
  g.roundRect(-250, 140, 500, 24, 6).fill(0xf2e6c8).stroke({ width: 5, color: INK });

  // curtains + rod
  for (const s of [-1, 1]) {
    const x0 = s * 196, x1 = s * 300;
    g.poly([x0, -340, x1, -340, x1 + s * 10, 160, s * 250, 170, s * 230, 20, s * 214, -120]).fill(0x7c4fa8).stroke({ width: 5, color: INK });
    for (const f of [0.3, 0.55, 0.8]) {
      const fx = x0 + (x1 - x0) * f;
      g.moveTo(fx, -330).quadraticCurveTo(fx + s * 8, -100, fx + s * 18, 150).stroke({ width: 3, color: 0x5a3480 });
    }
    g.roundRect(s * 262 - 24, -10, 48, 16, 8).fill(0xe8b64a).stroke({ width: 3, color: INK });
  }
  g.roundRect(-330, -356, 660, 16, 8).fill(0xb8863a).stroke({ width: 4, color: INK });
  g.circle(-336, -348, 12).fill(0xe8b64a).stroke({ width: 3, color: INK });
  g.circle(336, -348, 12).fill(0xe8b64a).stroke({ width: 3, color: INK });

  // framed pictures
  g.ellipse(-560, -140, 92, 116).fill(0xd8a440).stroke({ width: 5, color: INK });
  g.ellipse(-560, -140, 74, 98).fill(0xf7e8c4).stroke({ width: 3, color: INK });
  fruit(g, 'pear', -560, -110, 34, 3, 0.1);
  g.roundRect(450, -250, 230, 170, 6).fill(0xd8a440).stroke({ width: 5, color: INK });
  g.rect(468, -232, 194, 134).fill(0xcfe6f2).stroke({ width: 3, color: INK });
  g.poly([468, -98, 530, -170, 580, -130, 620, -180, 662, -120, 662, -98]).fill(0x7aa7c7);
  g.circle(620, -205, 12).fill(0xfff1b8);
  return g;
}

function furniture(): Graphics {
  const g = new Graphics();
  // china hutch on the left
  const hx = -1180, hw = 330;
  g.rect(hx, -420, hw, 1000).fill(0x5d3423).stroke({ width: 5, color: INK });
  g.rect(hx - 20, -440, hw + 40, 34).fill(0x6e4029).stroke({ width: 5, color: INK });
  for (const row of [0, 1]) {
    const y = -380 + row * 220;
    g.rect(hx + 26, y, hw - 52, 190).fill(0x2f4f63).stroke({ width: 4, color: INK });
    g.rect(hx + 26, y + 150, hw - 52, 10).fill(0x7a4b30);
    for (let i = 0; i < 4; i++) {
      const px = hx + 66 + i * 66, py = y + 100;
      g.circle(px, py, 30).fill(0xe9eef6).stroke({ width: 3, color: INK });
      g.circle(px, py, 18).fill(0x5a86c8);
      g.circle(px, py, 9).fill(0xe9eef6);
    }
    g.moveTo(hx + 50, y + 20).lineTo(hx + 90, y + 170).stroke({ width: 6, color: 0xffffff, alpha: 0.25 });
  }
  g.rect(hx, 70, hw, 30).fill(0x7a4b30).stroke({ width: 4, color: INK });
  // sideboard with a flower vase on the right
  const sx = 860;
  g.rect(sx, 40, 400, 600).fill(0x5d3423).stroke({ width: 5, color: INK });
  g.rect(sx - 16, 24, 432, 28).fill(0x6e4029).stroke({ width: 5, color: INK });
  for (const dx of [30, 210]) {
    g.rect(sx + dx, 80, 160, 200).fill(0x6e4029).stroke({ width: 4, color: INK });
    g.circle(sx + dx + (dx === 30 ? 140 : 20), 180, 7).fill(0xe8b64a).stroke({ width: 2, color: INK });
  }
  g.moveTo(sx + 90, 20).lineTo(sx + 70, -140).stroke({ width: 5, color: 0x2f7a3e });
  g.moveTo(sx + 100, 20).lineTo(sx + 130, -170).stroke({ width: 5, color: 0x2f7a3e });
  g.moveTo(sx + 110, 20).lineTo(sx + 180, -120).stroke({ width: 5, color: 0x2f7a3e });
  for (const [fx, fy, c] of [[sx + 70, -150, 0xf26aa0], [sx + 130, -180, 0xffffff], [sx + 182, -128, 0xf26aa0]] as const) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.circle(fx + Math.cos(a) * 14, fy + Math.sin(a) * 14, 11).fill(c).stroke({ width: 2.5, color: INK });
    }
    g.circle(fx, fy, 8).fill(0xffd23a).stroke({ width: 2.5, color: INK });
  }
  g.poly([sx + 60, 24, sx + 150, 24, sx + 140, -40, sx + 120, -50, sx + 90, -50, sx + 70, -40]).fill(0x3a6fb0).stroke({ width: 4, color: INK });
  return g;
}

function lamp(): Container {
  const c = new Container();
  const g = new Graphics();
  g.poly([-70, -6, 70, -6, 330, 520, -330, 520]).fill({ color: 0xfff6d8, alpha: 0.18 });
  g.moveTo(0, -800).lineTo(0, -70).stroke({ width: 4, color: INK });
  g.roundRect(-14, -86, 28, 26, 6).fill(0xc99a3e).stroke({ width: 3, color: INK });
  g.moveTo(-110, 0).quadraticCurveTo(-100, -64, 0, -66).quadraticCurveTo(100, -64, 110, 0).closePath().fill(0x2f7d6e).stroke({ width: 5, color: INK });
  g.moveTo(40, -62).quadraticCurveTo(96, -50, 108, -4).lineTo(70, -4).quadraticCurveTo(66, -40, 30, -60).closePath().fill(0x23604f);
  g.ellipse(0, 0, 110, 12).fill(0xfff2b0).stroke({ width: 4, color: INK });
  g.circle(0, 6, 16).fill(0xfffbe6).stroke({ width: 3, color: INK });
  c.addChild(g);
  c.position.set(0, -300);
  return c;
}

function table(): Graphics {
  const g = new Graphics();
  const TOP = 320, EDGE = 410, X = 2200, VY = -900;
  g.rect(-X, TOP, X * 2, EDGE - TOP).fill(0xf6f2ea);
  // gingham on the table top: rows grow toward the viewer, columns converge upward
  let y = TOP, h = 9;
  let row = 0;
  while (y < EDGE) {
    if (row % 2 === 0) g.rect(-X, y, X * 2, Math.min(h, EDGE - y)).fill({ color: 0x4f82d6, alpha: 0.45 });
    y += h; h *= 1.18; row++;
  }
  const k = (TOP - VY) / (EDGE - VY);
  for (let x = -X - 60; x < X; x += 120) {
    g.poly([x * k, TOP, (x + 60) * k, TOP, x + 60, EDGE, x, EDGE]).fill({ color: 0x4f82d6, alpha: 0.45 });
  }
  // hanging cloth with folds
  g.rect(-X, EDGE, X * 2, 900).fill(0xf6f2ea);
  for (let r = 0; r * 48 < 900; r++) {
    if (r % 2 === 0) g.rect(-X, EDGE + r * 48, X * 2, 48).fill({ color: 0x4f82d6, alpha: 0.45 });
  }
  for (let x = -X; x < X; x += 96) g.rect(x, EDGE, 48, 900).fill({ color: 0x4f82d6, alpha: 0.45 });
  for (let x = -X + 70; x < X; x += 210) g.rect(x, EDGE, 40, 900).fill({ color: 0x0a1840, alpha: 0.16 });
  g.moveTo(-X, TOP).lineTo(X, TOP).stroke({ width: 4, color: shade(0x4f82d6, 0.4) });
  g.moveTo(-X, EDGE).lineTo(X, EDGE).stroke({ width: 6, color: INK });
  return g;
}

function bowl(w: number): Graphics {
  const g = new Graphics();
  const hw = w / 2 + 14;
  g.ellipse(0, 340, 250, 20).fill({ color: 0x0a1840, alpha: 0.3 });
  // foot ring
  g.roundRect(-150, 286, 300, 48, 12).fill(shade(COBALT, 0.2)).stroke({ width: 6, color: INK });
  g.rect(-140, 296, 280, 8).fill(GLAZE);
  // body
  const body = () => g.moveTo(-hw + 4, 20).bezierCurveTo(-hw + 20, 200, -240, 292, -160, 296).lineTo(160, 296).bezierCurveTo(240, 292, hw - 20, 200, hw - 4, 20).closePath();
  body().fill(COBALT);
  // cel shadow on the right
  g.moveTo(hw - 4, 20).bezierCurveTo(hw - 20, 200, 240, 292, 160, 296).lineTo(90, 296).bezierCurveTo(200, 270, hw - 90, 180, hw - 70, 20).closePath().fill(shade(COBALT, 0.3));
  // painted glaze band with scallops and dots
  g.moveTo(-hw + 8, 56).lineTo(hw - 8, 56).lineTo(hw - 16, 108).lineTo(-hw + 16, 108).closePath().fill(GLAZE);
  for (let x = -hw + 30; x < hw - 20; x += 44) {
    g.moveTo(x - 18, 108).quadraticCurveTo(x, 84, x + 18, 108).closePath().fill(COBALT);
    g.circle(x + 22, 70, 5).fill(COBALT);
  }
  g.rect(-hw + 14, 108, hw * 2 - 28, 6).fill(shade(COBALT, 0.35));
  // painted flowers on the belly
  for (const [fx, fy] of [[-hw * 0.58, 160], [-hw * 0.2, 196], [hw * 0.2, 196], [hw * 0.58, 160]] as const) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      g.ellipse(fx + Math.cos(a) * 16, fy + Math.sin(a) * 16, 11, 11).fill(GLAZE);
    }
    g.circle(fx, fy, 8).fill(0x8fb6ea);
    g.moveTo(fx - 70, fy + 10).quadraticCurveTo(fx - 40, fy - 20, fx - 22, fy + 4).stroke({ width: 4, color: GLAZE, cap: 'round' });
    g.moveTo(fx + 70, fy + 10).quadraticCurveTo(fx + 40, fy - 20, fx + 22, fy + 4).stroke({ width: 4, color: GLAZE, cap: 'round' });
  }
  // shine
  g.moveTo(-hw + 40, 130).quadraticCurveTo(-hw + 60, 220, -230, 260).stroke({ width: 10, color: 0xffffff, alpha: 0.55, cap: 'round' });
  body().stroke({ width: 6, color: INK, join: 'round' });
  // rim: top face (walkable, y = 0 runs through it) and rolled lip
  g.roundRect(-hw - 4, 6, hw * 2 + 8, 22, 11).fill(shade(GLAZE, 0.12)).stroke({ width: 6, color: INK });
  g.roundRect(-hw, -8, hw * 2, 20, 10).fill(GLAZE).stroke({ width: 6, color: INK });
  g.moveTo(-hw + 30, -1).lineTo(hw - 30, -1).stroke({ width: 3, color: 0x8fb6ea });
  g.moveTo(-hw + 20, 17).lineTo(hw - 20, 17).stroke({ width: 4, color: COBALT });
  return g;
}

function tableProps(): Graphics {
  const g = new Graphics();
  fruit(g, 'apple', -700, 350, 34, 5);
  fruit(g, 'pear', -790, 360, 30, 5);
  fruit(g, 'grapes', 740, 330, 46, 4);
  fruit(g, 'plum', 820, 362, 26, 5);
  // teapot
  g.moveTo(-980, 270).quadraticCurveTo(-1060, 250, -1070, 210).stroke({ width: 14, color: INK, cap: 'round' });
  g.moveTo(-980, 270).quadraticCurveTo(-1060, 250, -1070, 210).stroke({ width: 7, color: COBALT, cap: 'round' });
  g.moveTo(-860, 250).bezierCurveTo(-800, 240, -790, 320, -850, 330).stroke({ width: 12, color: INK });
  g.moveTo(-860, 250).bezierCurveTo(-800, 240, -790, 320, -850, 330).stroke({ width: 5, color: COBALT });
  g.ellipse(-920, 290, 80, 66).fill(COBALT).stroke({ width: 6, color: INK });
  crescent(g, -920, 290, 77, 63, shade(COBALT, 0.3), 0.25);
  g.rect(-990, 270, 140, 18).fill(GLAZE);
  g.ellipse(-920, 226, 46, 12).fill(GLAZE).stroke({ width: 4, color: INK });
  g.circle(-920, 206, 12).fill(COBALT).stroke({ width: 4, color: INK });
  // candlestick
  g.ellipse(940, 356, 54, 14).fill(0xc99a3e).stroke({ width: 5, color: INK });
  g.rect(928, 200, 24, 156).fill(0xe8b64a).stroke({ width: 5, color: INK });
  g.rect(922, 90, 36, 112).fill(0xfff6e8).stroke({ width: 5, color: INK });
  g.moveTo(940, 88).quadraticCurveTo(924, 60, 940, 40).quadraticCurveTo(956, 60, 940, 88).fill(0xffb02e).stroke({ width: 3, color: INK });
  return g;
}

function orangeWheel(w: number): Graphics {
  const g = new Graphics();
  const rx = w / 2 + 6, ry = 15;
  puck(g, rx, ry, 30, 0xff8a18, 0xf07a10);
  for (let i = 0; i < 9; i++) g.circle(-rx * 0.8 + i * rx * 0.2, 22 + (i % 2) * 8, 2).fill(0xc85a08);
  g.ellipse(0, 4, rx - 7, ry - 3).fill(0xffe2a8);
  g.ellipse(0, 4, rx - 12, ry - 5).fill(0xff9418);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.moveTo(0, 4).lineTo(Math.cos(a) * (rx - 12), 4 + Math.sin(a) * (ry - 5)).stroke({ width: 2.5, color: 0xffe2a8 });
  }
  g.ellipse(0, 4, 8, 3).fill(0xfff1c9);
  g.ellipse(-rx * 0.45, 0, rx * 0.25, 3).fill({ color: 0xffffff, alpha: 0.6 });
  return g;
}

function cookie(w: number): Graphics {
  const g = new Graphics();
  const rx = w / 2 + 8, ry = 16;
  // crumbly underside bumps
  for (let x = -rx + 20; x < rx - 10; x += 34) g.circle(x, 40 + ry * 0.6, 14).fill(0x8a5426).stroke({ width: 4, color: INK });
  puck(g, rx, ry, 30, 0xe2a456, 0xb8783a);
  const r = rng(99);
  for (let i = 0; i < 10; i++) {
    const x = (r() - 0.5) * (rx * 1.6), y = 4 + (r() - 0.5) * (ry * 1.1);
    g.ellipse(x, y, 9 + r() * 5, 5 + r() * 2).fill(0x4a2a18).stroke({ width: 2, color: INK });
  }
  for (let i = 0; i < 4; i++) {
    const x = (r() - 0.5) * rx * 1.4;
    g.moveTo(x, -2).lineTo(x + 14, 4).lineTo(x + 6, 10).stroke({ width: 2.5, color: 0xb8783a });
  }
  for (let i = 0; i < 6; i++) g.ellipse(-rx * 0.7 + i * rx * 0.28, 22 + (i % 2) * 6, 7, 4).fill(0x4a2a18);
  g.ellipse(-rx * 0.4, -1, rx * 0.28, 3.5).fill({ color: 0xffffff, alpha: 0.45 });
  return g;
}

export function fruitBowl(def: StageDef): StageView {
  const backdrop = new Container();
  const far = wall();
  const mid = furniture();
  const hang = lamp();
  const midLayer = new Container();
  midLayer.addChild(mid, hang);
  const vignette = new Graphics();
  edgeShade(vignette, 470, -280, 330, 7, 60, 0.06, 0x0a2030);
  vignette.position.set(640, 360);
  backdrop.addChild(far, midLayer, vignette);

  const world = new Container();
  world.addChild(table(), tableProps(), bowl(def.platforms[0].w));
  const soft: Graphics[] = [];
  def.platforms.forEach((p, i) => {
    if (i === 0) return;
    const g = p.y < -350 ? cookie(p.w) : orangeWheel(p.w);
    soft[i] = g;
    world.addChild(g);
  });

  return {
    backdrop,
    world,
    update(frame: number, cam: CameraInfo) {
      parallax(far, cam, 0.04);
      parallax(midLayer, cam, 0.1);
      hang.rotation = Math.sin(frame * 0.012) * 0.025;
      for (let i = 1; i < def.platforms.length; i++) {
        const p = platformAt(def, i, frame);
        soft[i].position.set(p.x, p.y);
      }
    },
  };
}
