import { Container, Graphics } from 'pixi.js';
import { hazardAt, platformAt, type StageDef } from '../../sim/stages';
import type { CameraInfo, StageView } from '../art';
import { burstPoints, INK } from '../rig';
import { crescent, edgeShade, mix, parallax, shade, slab } from './util';

// Kitchen counter: marble top over teal cabinets and an oven, a tiled backsplash and a
// sunny window behind, floating shelves with mugs, and the chef's knife hazard.

const TEAL = 0x2a7390;
const WOOD = 0xc98a4f;
const STEEL = 0xdfe6ee;

function wall(): Graphics {
  const g = new Graphics();
  g.rect(-1500, -1000, 3000, 2000).fill(0xf3ead4);
  // backsplash tiles, darker toward the sides
  const T = 52;
  for (let y = -40; y < 700; y += T) {
    for (let x = -1404; x < 1404; x += T) {
      const k = Math.min(1, Math.abs(x + T / 2) / 1150);
      const c = mix(0xeaf6fc, 0x8db6cc, k * k);
      g.rect(x + 2, y + 2, T - 4, T - 4).fill((x / T + y / T) % 2 === 0 ? c : shade(c, 0.04));
      g.rect(x + 6, y + 6, 10, 4).fill({ color: 0xffffff, alpha: 0.7 });
    }
  }
  g.rect(-1500, -48, 3000, 12).fill(0xc8b89a).stroke({ width: 3, color: INK });
  // window with sun
  g.roundRect(-250, -360, 500, 300, 14).fill(0xffffff).stroke({ width: 5, color: INK });
  g.rect(-226, -336, 452, 252).fill(0xbfeaff);
  g.rect(-226, -160, 452, 76).fill(0xa6dff5);
  g.circle(120, -250, 50).fill(0xfff0a0);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.moveTo(120 + Math.cos(a) * 62, -250 + Math.sin(a) * 62).lineTo(120 + Math.cos(a) * 82, -250 + Math.sin(a) * 82).stroke({ width: 6, color: 0xfff0a0, cap: 'round' });
  }
  g.ellipse(-110, -150, 140, 40).fill(0x9bd6a8);
  g.ellipse(80, -120, 180, 40).fill(0x8acb98);
  g.ellipse(-120, -270, 54, 16).fill(0xffffff);
  g.ellipse(-90, -282, 30, 14).fill(0xffffff);
  g.rect(-226, -336, 452, 252).stroke({ width: 5, color: INK });
  g.rect(-5, -336, 10, 252).fill(0xffffff).stroke({ width: 3, color: INK });
  g.roundRect(-270, -70, 540, 22, 6).fill(0xffffff).stroke({ width: 5, color: INK });
  // gingham valance
  g.rect(-270, -380, 540, 56).fill(0xf6f2ea).stroke({ width: 4, color: INK });
  for (let x = -270; x < 270; x += 24) g.rect(x, -380, 12, 56).fill({ color: 0x4f82d6, alpha: 0.5 });
  for (let y = -380; y < -324; y += 24) g.rect(-270, y, 540, 12).fill({ color: 0x4f82d6, alpha: 0.5 });
  for (let x = -270; x < 270; x += 45) g.moveTo(x, -324).quadraticCurveTo(x + 22, -306, x + 45, -324).fill(0xf6f2ea).stroke({ width: 3, color: INK });
  // upper cabinets
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const x0 = s > 0 ? 360 + i * 240 : -360 - (i + 1) * 240;
      const c = mix(0x3f93ad, 0x1d4d64, i / 3);
      g.rect(x0, -480, 240, 330).fill(c).stroke({ width: 5, color: INK });
      g.roundRect(x0 + 20, -456, 200, 282, 8).fill(shade(c, 0.12)).stroke({ width: 3, color: shade(c, 0.5) });
      const hx = s > 0 ? x0 + 30 : x0 + 210;
      g.roundRect(hx - 5, -240, 10, 50, 5).fill(0xe8b64a).stroke({ width: 3, color: INK });
    }
    g.rect(s > 0 ? 340 : -1340, -500, 1000, 26).fill(0x1d4d64).stroke({ width: 5, color: INK });
  }
  return g;
}

function pan(g: Graphics, x: number, y: number, r: number) {
  g.moveTo(x, y - r - 50).lineTo(x, y - r - 20).stroke({ width: 4, color: INK });
  g.roundRect(x - 8, y - r - 26, 16, 34, 6).fill(0x5a3a26).stroke({ width: 3, color: INK });
  g.circle(x, y, r).fill(0xd9733a).stroke({ width: 5, color: INK });
  crescent(g, x, y, r - 2.5, r - 2.5, 0xa84f22, 0.28);
  g.circle(x, y, r * 0.72).stroke({ width: 3, color: 0xa84f22 });
  g.moveTo(x - r * 0.5, y - r * 0.35).quadraticCurveTo(x - r * 0.3, y - r * 0.62, x, y - r * 0.66).stroke({ width: 5, color: 0xffd0a0, cap: 'round' });
}

function decor(): Graphics {
  const g = new Graphics();
  // pan rail on the left
  g.roundRect(-900, -120, 380, 12, 6).fill(0xc0c8d0).stroke({ width: 4, color: INK });
  pan(g, -840, 20, 54);
  pan(g, -720, 0, 40);
  pan(g, -620, 30, 62);
  // ladle + whisk
  g.moveTo(-560, -108).lineTo(-560, 40).stroke({ width: 6, color: INK });
  g.moveTo(-560, -108).lineTo(-560, 40).stroke({ width: 2, color: 0xe0e6ec });
  g.moveTo(-582, 40).quadraticCurveTo(-560, 80, -538, 40).closePath().fill(0xc0c8d0).stroke({ width: 4, color: INK });
  // clock + spice shelf on the right
  g.circle(620, -330, 58).fill(0xf8f4ea).stroke({ width: 6, color: INK });
  g.circle(620, -330, 48).stroke({ width: 3, color: 0xd9733a });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.circle(620 + Math.cos(a) * 38, -330 + Math.sin(a) * 38, 3).fill(INK);
  }
  g.moveTo(620, -330).lineTo(620, -362).stroke({ width: 5, color: INK, cap: 'round' });
  g.moveTo(620, -330).lineTo(644, -318).stroke({ width: 4, color: INK, cap: 'round' });
  return g;
}

function counter(w: number): Graphics {
  const g = new Graphics();
  const hw = w / 2 + 16;
  // base cabinets
  g.rect(-hw + 10, 30, hw * 2 - 20, 900).fill(TEAL).stroke({ width: 6, color: INK });
  const doors: [number, number][] = [[-hw + 30, -420], [-400, -200], [200, 400], [420, hw - 30]];
  for (const [a, b] of doors) {
    g.rect(a, 104, b - a, 36).fill(shade(TEAL, 0.08)).stroke({ width: 4, color: INK });
    g.roundRect((a + b) / 2 - 30, 116, 60, 10, 5).fill(0xe8b64a).stroke({ width: 3, color: INK });
    g.rect(a, 160, b - a, 380).fill(shade(TEAL, 0.06)).stroke({ width: 4, color: INK });
    g.rect(a + 18, 178, b - a - 36, 344).stroke({ width: 3, color: shade(TEAL, 0.45) });
    g.roundRect((a + b) / 2 - 5, 200, 10, 60, 5).fill(0xe8b64a).stroke({ width: 3, color: INK });
  }
  g.rect(-hw + 10, 560, hw * 2 - 20, 400).fill(shade(TEAL, 0.5));
  // oven
  g.rect(-190, 40, 380, 520).fill(0xd8dee6).stroke({ width: 6, color: INK });
  g.rect(-190, 40, 380, 56).fill(0xb8c0ca).stroke({ width: 5, color: INK });
  for (let i = 0; i < 5; i++) {
    const kx = -140 + i * 70;
    g.circle(kx, 68, 15).fill(0x2c2c34).stroke({ width: 3, color: INK });
    g.moveTo(kx, 68).lineTo(kx + 8, 58).stroke({ width: 3, color: 0xffffff });
  }
  g.roundRect(-150, 118, 300, 22, 11).fill(0xb8c0ca).stroke({ width: 4, color: INK });
  g.roundRect(-150, 170, 300, 220, 14).fill(0x2a2230).stroke({ width: 5, color: INK });
  g.roundRect(-130, 190, 260, 180, 10).fill(0x4a2a28);
  g.rect(-120, 330, 240, 8).fill(0xff8a3a);
  g.moveTo(-110, 205).lineTo(-60, 205).lineTo(-120, 280).closePath().fill({ color: 0xffffff, alpha: 0.18 });
  g.rect(-190, 410, 380, 150).fill(0xc4ccd6).stroke({ width: 5, color: INK });
  // countertop: walkable top face (y = 0 runs through it) and front edge
  g.rect(-hw + 6, 14, hw * 2 - 12, 22).fill(0x97a3b3).stroke({ width: 6, color: INK });
  g.roundRect(-hw, -8, hw * 2, 26, 8).fill(0xf1f4f7).stroke({ width: 6, color: INK });
  for (const [x0, x1, y] of [[-480, -260, 2], [-120, 60, 8], [180, 420, 4], [-380, -320, 10], [300, 340, 10]] as const) {
    g.moveTo(x0, y).bezierCurveTo(x0 + 50, y - 6, x1 - 50, y + 6, x1, y).stroke({ width: 2, color: 0xb6c2d0 });
  }
  g.moveTo(-hw + 20, 26).lineTo(hw - 20, 26).stroke({ width: 3, color: 0xc8d0da });
  return g;
}

function bracket(g: Graphics, x: number, y: number, s: number) {
  g.poly([x, y, x + s * 14, y, x + s * 14, y + 14, x + s * 4, y + 56, x, y + 56]).fill(0x3a3a44).stroke({ width: 4, color: INK, join: 'round' });
  g.circle(x + s * 7, y + 9, 3).fill(0x9aa6b4);
}

// Cutting board resting on two brackets, handle hole on the outer end.
function boardShelf(w: number, outer: number): Graphics {
  const g = new Graphics();
  const hw = w / 2;
  bracket(g, -hw + 30, 34, 1);
  bracket(g, hw - 30, 34, -1);
  slab(g, w, 34, 0xe2a466, 0xb8763e, 5, 10);
  const hx = outer * (hw - 34);
  g.roundRect(hx - 20, 12, 40, 14, 7).fill(0x3a2414).stroke({ width: 3, color: INK });
  for (const [x0, x1, y] of [[-hw + 30, -20, -2], [10, hw - 40, 3]] as const) g.moveTo(x0, y).bezierCurveTo(x0 + 40, y - 3, x1 - 40, y + 3, x1, y).stroke({ width: 2, color: 0xc08048 });
  g.moveTo(-hw + 10, 28).lineTo(hw - 10, 28).stroke({ width: 2.5, color: 0x8a5426 });
  return g;
}

// Wall shelf with plates and a teapot standing behind the walkable edge.
function plateShelf(w: number): Graphics {
  const g = new Graphics();
  const hw = w / 2;
  const plates = [0x3f6fd1, 0xf6f2ea, 0x3f6fd1, 0xf6f2ea];
  plates.forEach((c, i) => {
    const x = -hw + 44 + i * 30;
    g.circle(x, -40, 44).fill(c).stroke({ width: 4, color: INK });
    g.circle(x, -40, 30).stroke({ width: 3, color: c === 0xf6f2ea ? 0x3f6fd1 : 0xf6f2ea });
  });
  g.ellipse(hw - 70, -42, 46, 38).fill(0xd9733a).stroke({ width: 4, color: INK });
  crescent(g, hw - 70, -42, 44, 36, 0xa84f22, 0.28);
  g.moveTo(hw - 116, -50).quadraticCurveTo(hw - 140, -60, hw - 146, -80).stroke({ width: 8, color: INK, cap: 'round' });
  g.ellipse(hw - 70, -80, 20, 7).fill(0xa84f22).stroke({ width: 3, color: INK });
  g.circle(hw - 70, -88, 6).fill(0xf6f2ea).stroke({ width: 2, color: INK });
  bracket(g, -hw + 26, 36, 1);
  bracket(g, hw - 26, 36, -1);
  slab(g, w, 36, 0xf6f2ea, 0x2f8fa8, 5, 6);
  g.rect(-hw + 6, 12, w - 12, 6).fill(0xe8b64a);
  return g;
}

// Spice shelf: jars behind the edge, mugs hanging below on hooks.
function jarShelf(w: number): Graphics {
  const g = new Graphics();
  const hw = w / 2;
  const jars = [0xd94a3a, 0xe8b64a, 0x6aa84f, 0x8a5a3a, 0x7b3fa0];
  jars.forEach((c, i) => {
    const x = -hw + 40 + i * ((w - 80) / 4);
    const h = 56 + (i % 2) * 18;
    g.roundRect(x - 20, -h, 40, h + 4, 8).fill(0xf6f8fa).stroke({ width: 4, color: INK });
    g.rect(x - 15, -h + 18, 30, h - 22).fill(c);
    g.roundRect(x - 23, -h - 12, 46, 16, 5).fill(0x4a4a52).stroke({ width: 3, color: INK });
    g.rect(x - 13, -h + 6, 6, h - 14).fill({ color: 0xffffff, alpha: 0.6 });
  });
  const mugs = [0x3f6fd1, 0xf6f2ea, 0x7b3fa0, 0x2f8fa8];
  mugs.forEach((c, i) => {
    const x = -hw + 60 + i * ((w - 120) / 3);
    g.moveTo(x, 36).lineTo(x, 50).stroke({ width: 3, color: INK });
    g.roundRect(x - 20, 50, 40, 42, 7).fill(c).stroke({ width: 4, color: INK });
    g.circle(x + 22, 68, 10).stroke({ width: 8, color: INK });
    g.circle(x + 22, 68, 10).stroke({ width: 3, color: c });
    g.rect(x - 14, 55, 7, 30).fill({ color: 0xffffff, alpha: 0.4 });
  });
  slab(g, w, 36, WOOD, shade(WOOD, 0.28), 5, 8);
  g.moveTo(-hw + 20, 14).lineTo(hw - 20, 14).stroke({ width: 2.5, color: shade(WOOD, 0.45) });
  return g;
}

function knife(): Graphics {
  const g = new Graphics();
  // tip at (0, 0), blade up to y = -300, handle above
  const blade = () => g.moveTo(-42, -300).lineTo(48, -300).lineTo(48, -130).quadraticCurveTo(46, -30, 4, 0).quadraticCurveTo(-30, -36, -42, -90).closePath();
  blade().fill(STEEL);
  g.moveTo(-42, -300).lineTo(-22, -300).lineTo(-22, -100).quadraticCurveTo(-24, -60, -8, -24).quadraticCurveTo(-30, -40, -42, -90).closePath().fill(0xa8b4c2);
  g.moveTo(34, -300).lineTo(48, -300).lineTo(48, -130).quadraticCurveTo(46, -30, 4, 0).quadraticCurveTo(32, -40, 34, -130).closePath().fill(0xffffff);
  g.moveTo(-6, -270).lineTo(-6, -120).stroke({ width: 6, color: 0xffffff, alpha: 0.8, cap: 'round' });
  blade().stroke({ width: 6, color: INK, join: 'round' });
  g.roundRect(-50, -326, 106, 30, 8).fill(0x9aa6b4).stroke({ width: 6, color: INK });
  g.roundRect(-36, -470, 78, 150, 26).fill(0x2a2a34).stroke({ width: 6, color: INK });
  g.rect(-24, -456, 12, 124).fill(0x44444f);
  for (const ry of [-440, -395, -350]) g.circle(3, ry, 7).fill(0xd8dee6).stroke({ width: 3, color: INK });
  return g;
}

export function kitchen(def: StageDef): StageView {
  const backdrop = new Container();
  const far = wall();
  const mid = decor();
  const vignette = new Graphics();
  edgeShade(vignette, 500, -300, 360, 7, 60, 0.06, 0x0a1a30);
  vignette.position.set(640, 360);
  backdrop.addChild(far, mid, vignette);

  const world = new Container();
  world.addChild(counter(def.platforms[0].w));
  const soft: Graphics[] = [];
  for (let i = 1; i < def.platforms.length; i++) {
    const p = def.platforms[i];
    soft[i] = p.y < -350 ? jarShelf(p.w) : p.x < 0 ? boardShelf(p.w, -1) : plateShelf(p.w);
    world.addChild(soft[i]);
  }
  const target = new Graphics();
  world.addChild(target);

  const front = new Container();
  const blade = knife();
  const burst = new Graphics();
  burst.poly(burstPoints(14, 120, 60, 0.2, 7)).fill(0xffffff).stroke({ width: 5, color: INK });
  burst.poly(burstPoints(10, 70, 36, 0.2, 3)).fill(0xffe14a);
  front.addChild(blade, burst);

  return {
    backdrop,
    world,
    front,
    update(frame: number, cam: CameraInfo) {
      parallax(far, cam, 0.04);
      parallax(mid, cam, 0.1);
      for (let i = 1; i < def.platforms.length; i++) {
        const p = platformAt(def, i, frame);
        soft[i].position.set(p.x, p.y);
      }
      const h = hazardAt(def, frame);
      target.clear();
      blade.visible = false;
      burst.visible = false;
      if (!h || h.phase === 'idle') return;
      blade.visible = true;
      blade.x = h.x;
      if (h.phase === 'warn') {
        const drop = Math.min(1, h.t / 0.4);
        const raised = -290;
        blade.y = -1300 + (raised + 1300) * (1 - (1 - drop) * (1 - drop)) + (drop >= 1 ? Math.sin(frame * 1.7) * 3 : 0);
        blade.rotation = Math.sin(frame * 0.9) * 0.01 * h.t;
        const blink = Math.floor(frame / 6) % 2 === 0;
        target.ellipse(h.x, 4, 30 + 40 * h.t, 8 + 4 * h.t).fill({ color: 0x0a1020, alpha: 0.18 + 0.3 * h.t });
        target.ellipse(h.x, 4, 56, 14).stroke({ width: 4, color: blink ? 0xff2a2a : 0xffffff });
        target.moveTo(h.x - 70, 4).lineTo(h.x + 70, 4).stroke({ width: 3, color: 0xff2a2a });
      } else {
        const t = h.t;
        blade.rotation = 0;
        if (t < 0.1) blade.y = -290 + 294 * (t / 0.1);
        else if (t < 0.45) blade.y = 4 + (t < 0.2 ? Math.sin(frame * 3) * 3 : 0);
        else {
          const k = (t - 0.45) / 0.55;
          blade.y = 4 - 1300 * k * k;
        }
        if (t >= 0.08 && t < 0.35) {
          burst.visible = true;
          burst.position.set(h.x, 0);
          const s = 0.7 + (t - 0.08) * 2;
          burst.scale.set(s, s * 0.45);
          burst.alpha = 1 - (t - 0.08) / 0.27;
        }
        target.ellipse(h.x, 4, 64, 10).fill({ color: 0x0a1020, alpha: 0.35 * (1 - t) });
      }
    },
  };
}
