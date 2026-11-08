import { Container, Graphics } from 'pixi.js';
import type { StageDef } from '../../sim/stages';
import type { CameraInfo, StageView } from '../art';
import { INK } from '../rig';
import { crescent, fruit, mix, parallax, rng, shade } from './util';

// Comic sunburst behind a kitchen in silhouette, and a butcher-block board on a wooden
// table with prep props around it.

const RIM = 0x7fe8ff;
const SIL = 0x2a1a6a;

function sunburst(): { root: Container; rays: Graphics } {
  const root = new Container();
  const tones = new Graphics();
  const steps = 14;
  for (let i = steps; i >= 0; i--) {
    const k = i / steps;
    tones.circle(0, 0, 260 + k * 1500).fill(mix(0x6fe0ff, 0x2a1580, Math.pow(k, 0.7)));
  }
  const rays = new Graphics();
  const n = 28;
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    rays.poly([0, 0, Math.cos(a0) * 2400, Math.sin(a0) * 2400, Math.cos(a1) * 2400, Math.sin(a1) * 2400]).fill({ color: 0xffffff, alpha: 0.13 });
  }
  root.addChild(tones, rays);
  return { root, rays };
}

// Kitchen silhouettes with a cyan rim light on the edges facing the burst.
function silhouettes(): Graphics {
  const g = new Graphics();
  const block = (pts: number[]) => g.poly(pts).fill(SIL).stroke({ width: 4, color: INK });
  for (const s of [-1, 1]) {
    // upper cabinets
    block([s * 560, -520, s * 1500, -520, s * 1500, -250, s * 560, -250]);
    for (let x = 580; x < 1500; x += 200) g.rect(s > 0 ? x : -x - 180, -500, 180, 230).stroke({ width: 3, color: 0x4a36a0 });
    g.moveTo(s * 560, -520).lineTo(s * 560, -250).stroke({ width: 5, color: RIM });
    // base counter
    block([s * 520, 150, s * 1500, 150, s * 1500, 1000, s * 520, 1000]);
    g.rect(s > 0 ? 500 : -1500, 130, 1000, 26).fill(0x3a2a8a).stroke({ width: 4, color: INK });
    g.moveTo(s * 520, 130).lineTo(s * 1500, 130).stroke({ width: 4, color: RIM });
  }
  // utensil crock on the left
  g.moveTo(-660, 130).lineTo(-650, 20).lineTo(-560, 20).lineTo(-550, 130).closePath().fill(SIL).stroke({ width: 4, color: INK });
  g.moveTo(-560, 20).lineTo(-550, 130).stroke({ width: 4, color: RIM });
  g.moveTo(-620, 20).lineTo(-660, -150).stroke({ width: 12, color: SIL, cap: 'round' });
  g.ellipse(-666, -170, 26, 34).fill(SIL).stroke({ width: 4, color: INK });
  g.moveTo(-600, 20).lineTo(-590, -190).stroke({ width: 10, color: SIL, cap: 'round' });
  for (let i = 0; i < 4; i++) g.ellipse(-588, -230, 10 + i * 6, 44).stroke({ width: 3, color: i === 3 ? RIM : 0x4a36a0 });
  g.moveTo(-580, 20).lineTo(-520, -130).stroke({ width: 10, color: SIL, cap: 'round' });
  g.roundRect(-540, -170, 40, 60, 10).fill(SIL).stroke({ width: 4, color: INK });
  // bottles + pepper mill + plant on the right
  for (const [x, h, w] of [[600, 220, 50], [670, 170, 44]] as const) {
    g.roundRect(x - w / 2, 130 - h, w, h, 14).fill(SIL).stroke({ width: 4, color: INK });
    g.rect(x - 9, 130 - h - 50, 18, 54).fill(SIL).stroke({ width: 4, color: INK });
    g.moveTo(x - w / 2 + 6, 130 - h + 20).lineTo(x - w / 2 + 6, 110).stroke({ width: 3, color: RIM });
  }
  g.poly([760, 130, 860, 130, 840, 50, 780, 50]).fill(SIL).stroke({ width: 4, color: INK });
  for (const [dx, dy] of [[-40, -60], [0, -90], [40, -60], [-20, -120], [25, -125]] as const) {
    g.ellipse(810 + dx, 50 + dy, 22, 50).fill(SIL).stroke({ width: 3, color: INK });
    g.moveTo(810, 50).lineTo(810 + dx * 0.8, 50 + dy * 0.6).stroke({ width: 3, color: 0x4a36a0 });
  }
  // hanging utensil rail
  g.roundRect(-460, -560, 920, 14, 7).fill(SIL).stroke({ width: 4, color: INK });
  for (let i = 0; i < 6; i++) {
    const x = -380 + i * 150;
    if (Math.abs(x) < 200) continue;
    g.moveTo(x, -546).lineTo(x, -470).stroke({ width: 6, color: SIL });
    if (i % 2) g.circle(x, -440, 34).fill(SIL).stroke({ width: 4, color: INK });
    else g.ellipse(x, -440, 18, 30).fill(SIL).stroke({ width: 4, color: INK });
  }
  return g;
}

function table(): Graphics {
  const g = new Graphics();
  const X = 2300;
  g.rect(-X, 96, X * 2, 1000).fill(0x3a2240);
  for (const x of [-1000, 1000]) {
    g.rect(x - 34, 140, 68, 900).fill(0x6b3e20).stroke({ width: 6, color: INK });
    g.rect(x + 8, 140, 18, 900).fill(0x5a3218);
  }
  g.rect(-X, 96, X * 2, 50).fill(0x1a4a50).stroke({ width: 6, color: INK });
  g.rect(-X, 20, X * 2, 44).fill(0x2f7f86);
  for (const [y, x0, x1] of [[30, -2100, -900], [44, -800, 200], [36, 500, 1900], [52, -1700, -700]] as const) {
    g.moveTo(x0, y).bezierCurveTo(x0 + 200, y - 4, x1 - 200, y + 4, x1, y).stroke({ width: 2.5, color: 0x276a70 });
  }
  g.rect(-X, 62, X * 2, 36).fill(0x1f5a60).stroke({ width: 6, color: INK });
  g.moveTo(-X, 22).lineTo(X, 22).stroke({ width: 4, color: shade(0x2f7f86, 0.35) });
  return g;
}

// Prep props on the table, pushed out past the board ends by `shift`.
function props(shift: number): Container {
  const root = new Container();
  let g = new Graphics();
  g.x = -shift;
  root.addChild(g);
  // chef's knife lying on the table
  g.moveTo(-860, 40).lineTo(-640, 40).quadraticCurveTo(-600, 40, -580, 54).lineTo(-860, 54).closePath().fill(0xdfe6ee).stroke({ width: 4, color: INK });
  g.moveTo(-850, 44).lineTo(-650, 44).stroke({ width: 3, color: 0xffffff });
  g.roundRect(-990, 38, 134, 20, 8).fill(0x2a2a34).stroke({ width: 4, color: INK });
  for (const x of [-960, -920, -880]) g.circle(x, 48, 4).fill(0xd8dee6);
  // half lemon + garlic
  g.ellipse(-520, 46, 52, 26).fill(0xffd23a).stroke({ width: 5, color: INK });
  g.ellipse(-520, 40, 42, 16).fill(0xfff6c0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.moveTo(-520, 40).lineTo(-520 + Math.cos(a) * 38, 40 + Math.sin(a) * 14).stroke({ width: 2, color: 0xffd23a });
  }
  g.moveTo(-1130, 54).bezierCurveTo(-1180, 54, -1170, -10, -1130, -24).bezierCurveTo(-1090, -10, -1080, 54, -1130, 54).fill(0xf6f0e4).stroke({ width: 5, color: INK });
  g.moveTo(-1130, 50).lineTo(-1130, -14).stroke({ width: 2.5, color: 0xc8bca8 });
  // tomato, salt shaker, herb bowl
  g = new Graphics();
  g.x = shift;
  root.addChild(g);
  fruit(g, 'cherry', 580, 40, 30, 4);
  g.circle(680, 20, 34).fill(0xe0352b).stroke({ width: 5, color: INK });
  crescent(g, 680, 20, 31.5, 31.5, shade(0xe0352b, 0.3), 0.3);
  g.poly([664, -12, 680, -4, 696, -12, 688, -18, 680, -22, 672, -18]).fill(0x3fa34d).stroke({ width: 3, color: INK });
  g.ellipse(668, 8, 8, 5).fill({ color: 0xffffff, alpha: 0.7 });
  g.roundRect(780, -40, 52, 96, 14).fill(0xf6f8fa).stroke({ width: 5, color: INK });
  g.roundRect(782, -56, 48, 22, 8).fill(0xb8c0ca).stroke({ width: 4, color: INK });
  for (const x of [798, 814]) g.circle(x, -45, 3).fill(INK);
  const r = rng(4);
  for (let i = 0; i < 9; i++) g.ellipse(960 + (r() - 0.5) * 120, -10 - r() * 30, 16, 9).fill(i % 2 ? 0x3fa34d : 0x2f8a3e).stroke({ width: 2.5, color: INK });
  g.moveTo(880, 0).quadraticCurveTo(960, 90, 1040, 0).closePath().fill(0x3c6fd4).stroke({ width: 5, color: INK });
  return root;
}

function board(w: number): Graphics {
  const g = new Graphics();
  const bw = w + 20;
  const x = -bw / 2;
  g.ellipse(0, 60, w * 0.5, 12).fill({ color: 0x000000, alpha: 0.3 });
  for (const fx of [x + 50, -x - 90]) g.roundRect(fx, 44, 40, 16, 5).fill(0x2a2a34).stroke({ width: 4, color: INK });
  // end-grain side
  g.roundRect(x, 0, bw, 54, 18).fill(0x8a5426).stroke({ width: 6, color: INK });
  const r = rng(12);
  for (let bx = x + 16; bx < -x - 30; bx += 34 + r() * 20) {
    g.rect(bx, 26, 14 + r() * 12, 22).fill(mix(0x7a4620, 0xa0642e, r()));
  }
  g.moveTo(x + 14, 26).lineTo(-x - 14, 26).stroke({ width: 3, color: 0x6b3a18 });
  // top face with juice groove, grain and knife scores
  g.roundRect(x, -6, bw, 30, 14).fill(0xd69455).stroke({ width: 6, color: INK });
  g.roundRect(x + 14, -1, bw - 28, 20, 10).stroke({ width: 3, color: 0xa86a34 });
  for (const [y, x0, x1] of [[4, -380, -60], [10, -200, 140], [6, 40, 360], [14, -320, -180], [15, 190, 400]] as const) {
    g.moveTo(x0, y).bezierCurveTo(x0 + 60, y - 4, x1 - 60, y + 4, x1, y).stroke({ width: 2.5, color: 0xb87a40, cap: 'round' });
  }
  for (let i = 0; i < 9; i++) {
    const sx = -320 + r() * 640;
    g.moveTo(sx, 2 + r() * 4).lineTo(sx + 14 + r() * 20, 8 + r() * 8).stroke({ width: 2, color: 0xe8b07a, cap: 'round' });
  }
  g.ellipse(-130, 34, 14, 7).fill(0x6b3e18).stroke({ width: 3, color: INK });
  g.roundRect(x + 22, 20, 46, 18, 9).fill(0x2a1a0d).stroke({ width: 4, color: INK });
  g.moveTo(x + 30, 3).lineTo(x + 200, 3).stroke({ width: 3, color: 0xf2c08a, cap: 'round' });
  return g;
}

export function cuttingBoard(def: StageDef): StageView {
  const backdrop = new Container();
  const burst = sunburst();
  const kitchen = silhouettes();
  backdrop.addChild(burst.root, kitchen);

  const world = new Container();
  world.addChild(table(), props(def.platforms[0].w / 2 - 440), board(def.platforms[0].w));

  return {
    backdrop,
    world,
    update(frame: number, cam: CameraInfo) {
      parallax(burst.root, cam, 0.04);
      burst.root.y -= 60;
      parallax(kitchen, cam, 0.1);
      burst.rays.rotation = frame * 0.0015;
    },
  };
}
