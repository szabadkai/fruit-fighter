import { BlurFilter, Container, Graphics } from 'pixi.js';
import { hazardAt, platformAt, type StageDef } from '../../sim/stages';
import type { CameraInfo, StageView } from '../art';
import { INK } from '../rig';
import { edgeShade, fruit, parallax, rng, shade, type FruitKind } from './util';

// Inside a giant blender jar: the blade base is the stage, ice cubes float above, a
// blurry teal-tinted kitchen shows through the glass, and the jar walls sit in front.

const STEEL = 0xcfd6de;
const BERRY = 0xc2368f;

function blurryKitchen(): Container {
  const c = new Container();
  const g = new Graphics();
  g.rect(-1500, -1000, 3000, 2000).fill(0xc9eaec);
  g.rect(-1500, 260, 3000, 800).fill(0x9fcbd0);
  g.rect(-1500, 230, 3000, 40).fill(0xe6f7f7);
  g.roundRect(-700, -420, 420, 330, 20).fill(0xf4ffff);
  g.rect(-500, -420, 20, 330).fill(0xd2eef0);
  g.circle(-380, -330, 50).fill(0xfffbd8);
  for (const x of [-1300, -1020, 380, 660]) g.rect(x, -560, 260, 300).fill(0x7fb0bc);
  g.rect(950, -500, 360, 760).fill(0xe6f4f6);
  g.rect(950, -80, 360, 14).fill(0xb7d4da);
  g.rect(980, -300, 18, 120).fill(0xb7d4da);
  for (const [x, y, r, col] of [[-260, 190, 40, 0xf2b4a8], [-200, 170, 46, 0xf7d58a], [-140, 196, 38, 0xd6a6e0], [520, 180, 50, 0xb9e08f]] as const) g.circle(x, y, r).fill(col);
  g.ellipse(-200, 226, 130, 30).fill(0x8fbcc8);
  g.rect(300, 120, 70, 110).fill(0xe7c49a);
  // open shelves with jars and a plant, a toaster on the counter
  for (const y of [-160, 0]) {
    g.rect(-1300, y, 520, 16).fill(0x8fb0b8);
    for (let i = 0; i < 6; i++) g.roundRect(-1270 + i * 82, y - 70 - (i % 2) * 20, 56, 70 + (i % 2) * 20, 10).fill([0xf2b4a8, 0xf7d58a, 0xa8d8b0, 0xd6a6e0, 0xf7c49a, 0xa9cbe8][i]);
  }
  g.roundRect(720, 110, 200, 120, 30).fill(0xe0eef2);
  g.rect(760, 96, 40, 18).fill(0x6f8f98);
  g.rect(840, 96, 40, 18).fill(0x6f8f98);
  g.poly([-820, 230, -720, 230, -740, 150, -800, 150]).fill(0xd99a7a);
  for (const [dx, dy] of [[-60, -40], [-20, -70], [20, -50], [-40, -100], [10, -110]] as const) g.ellipse(-770 + dx, 150 + dy, 34, 18).fill(0x7fbf8f);
  g.rect(-1500, 500, 3000, 600).fill(0x86b4bc);
  for (let x = -1500; x < 1500; x += 120) g.rect(x, 500, 60, 600).fill(0x7aa8b0);
  c.addChild(g);
  c.filters = [new BlurFilter({ strength: 10, quality: 3, resolution: 0.5 })];
  return c;
}

function glassTint(): Graphics {
  const g = new Graphics();
  for (const s of [-1, 1]) {
    g.poly([s * 380, -1000, s * 520, -1000, s * 470, 1000, s * 340, 1000]).fill({ color: 0xffffff, alpha: 0.22 });
    g.poly([s * 560, -1000, s * 600, -1000, s * 540, 1000, s * 500, 1000]).fill({ color: 0xffffff, alpha: 0.3 });
  }
  edgeShade(g, 520, -320, 380, 7, 55, 0.08, 0x0b4a5a);
  return g;
}

function base(w: number): Graphics {
  const g = new Graphics();
  const hw = w / 2;
  // motor housing
  g.poly([-hw - 40, 110, hw + 40, 110, hw + 140, 1100, -hw - 140, 1100]).fill(0x2d3142).stroke({ width: 6, color: INK });
  g.poly([hw - 40, 110, hw + 40, 110, hw + 140, 1100, hw + 20, 1100]).fill(0x232634);
  g.rect(-hw - 60, 170, w + 120, 24).fill(0xb8c0ca).stroke({ width: 5, color: INK });
  g.roundRect(-150, 240, 300, 120, 20).fill(0x1d2030).stroke({ width: 5, color: INK });
  for (const [x, c] of [[-100, 0xe0352b], [-35, 0xffd23a], [30, 0x3fa34d]] as const) {
    g.roundRect(x - 24, 270, 48, 30, 8).fill(c).stroke({ width: 4, color: INK });
    g.rect(x - 16, 274, 32, 6).fill({ color: 0xffffff, alpha: 0.5 });
  }
  g.circle(105, 300, 34).fill(STEEL).stroke({ width: 5, color: INK });
  g.moveTo(105, 300).lineTo(122, 276).stroke({ width: 5, color: INK, cap: 'round' });
  // jar bottom collar
  g.poly([-hw - 10, 24, hw + 10, 24, hw + 40, 110, -hw - 40, 110]).fill(0x3a3f4f).stroke({ width: 6, color: INK });
  for (let x = -hw + 20; x < hw; x += 40) g.moveTo(x, 34).lineTo(x * 1.08, 100).stroke({ width: 4, color: 0x2a2e3c });
  // gasket + blade plate (walkable top runs through the plate)
  g.roundRect(-hw + 4, 10, w - 8, 22, 10).fill(0x23252c).stroke({ width: 6, color: INK });
  g.roundRect(-hw, -8, w, 22, 9).fill(STEEL).stroke({ width: 6, color: INK });
  g.rect(-hw + 14, 4, w - 28, 5).fill(0x9aa6b4);
  g.moveTo(-hw + 20, -2).lineTo(-60, -2).stroke({ width: 3, color: 0xffffff, cap: 'round' });
  for (const x of [-hw + 30, hw - 30]) g.circle(x, 3, 5).fill(0x9aa6b4).stroke({ width: 2, color: INK });
  return g;
}

function iceCube(w: number, seed: number): Graphics {
  const g = new Graphics();
  const hw = w / 2;
  const r = rng(seed);
  g.ellipse(-hw * 0.3, 48, 6, 9).fill(0xb7e6fb).stroke({ width: 3, color: INK });
  g.roundRect(-hw, 0, w, 42, 9).fill({ color: 0xbfe9fb, alpha: 0.94 }).stroke({ width: 5, color: INK });
  g.poly([hw * 0.35, 6, hw - 4, 6, hw - 4, 36, hw * 0.25, 36]).fill({ color: 0x8fd2ee, alpha: 0.8 });
  for (let i = 0; i < 3; i++) {
    const x = -hw + 26 + r() * (w - 52);
    g.moveTo(x, 12).lineTo(x + 12, 20).lineTo(x + 5, 30).stroke({ width: 2.5, color: 0x7fc4e2 });
  }
  for (let i = 0; i < 5; i++) g.circle(-hw + 18 + r() * (w - 36), 16 + r() * 16, 2 + r() * 3).fill(0xffffff).stroke({ width: 1.5, color: 0x7fc4e2 });
  g.moveTo(-hw + 10, 12).lineTo(-hw + 10, 32).stroke({ width: 5, color: 0xffffff, cap: 'round' });
  // lit top face
  g.roundRect(-hw - 2, -10, w + 4, 18, 7).fill(0xf2fcff).stroke({ width: 5, color: INK });
  g.moveTo(-hw + 12, -3).lineTo(-hw + w * 0.45, -3).stroke({ width: 3, color: 0xffffff, cap: 'round' });
  g.poly([hw - 30, -6, hw - 18, -6, hw - 26, 4, hw - 38, 4]).fill(0xd2f2ff);
  return g;
}

function jarFront(): Graphics {
  const g = new Graphics();
  for (const s of [-1, 1]) {
    const inner = [s * 420, 30, s * 780, -1100];
    const outer = [s * 456, 30, s * 822, -1100];
    g.poly([inner[0], inner[1], inner[2], inner[3], outer[2], outer[3], outer[0], outer[1]]).fill({ color: 0xbff0ff, alpha: 0.4 }).stroke({ width: 5, color: INK });
    g.moveTo(s * 436, 0).lineTo(s * 776, -1000).stroke({ width: 5, color: 0xffffff, alpha: 0.8, cap: 'round' });
    // broad soft reflection on the glass face
    g.poly([s * 470, -40, s * 540, -40, s * 830, -1000, s * 760, -1000]).fill({ color: 0xffffff, alpha: 0.1 });
  }
  // measuring marks on the right wall
  for (let i = 1; i < 15; i++) {
    const y = -i * 70;
    const x = 420 + (-y / 1130) * 360;
    g.moveTo(x - (i % 3 === 0 ? 46 : 24), y).lineTo(x, y).stroke({ width: 4, color: 0xffffff, alpha: 0.7, cap: 'round' });
  }
  // handle
  g.moveTo(800, -960).bezierCurveTo(1060, -940, 1040, -380, 680, -340).lineTo(680, -420).bezierCurveTo(950, -450, 950, -860, 780, -880).closePath().fill({ color: 0x9fe4f7, alpha: 0.45 }).stroke({ width: 6, color: INK });
  // lid
  g.roundRect(-860, -1170, 1720, 80, 24).fill(0x2d3142).stroke({ width: 6, color: INK });
  g.roundRect(-140, -1214, 280, 56, 14).fill(0x3a3f4f).stroke({ width: 6, color: INK });
  g.rect(-830, -1106, 1660, 10).fill(0x1d2030);
  return g;
}

function drawBlades(g: Graphics, ang: number, spinning: number) {
  g.clear();
  const blades = [[380, -40], [380, -40], [290, -8], [290, -8]];
  blades.forEach(([L, lift], k) => {
    const a = ang + (k * Math.PI) / 2 + (k > 1 ? Math.PI / 4 : 0);
    const cx = Math.cos(a) * L, face = Math.abs(Math.sin(a));
    const tipY = -12 + lift * Math.abs(Math.cos(a));
    const th = 5 + 13 * face;
    g.poly([0, -18, cx * 0.35, -16 - th * 0.6, cx, tipY, cx * 0.35, -10 + th * 0.3, 0, -6]).fill(face > 0.5 ? STEEL : 0xa8b4c2).stroke({ width: 4, color: INK, join: 'round' });
  });
  if (spinning > 0) {
    g.ellipse(0, -22, 392, 32).fill({ color: 0xffffff, alpha: 0.35 * spinning }).stroke({ width: 4, color: INK, alpha: spinning });
    for (const s of [-1, 1]) g.moveTo(s * 200, -52).quadraticCurveTo(s * 350, -48, s * 400, -22).stroke({ width: 4, color: 0xffffff, cap: 'round', alpha: spinning });
  }
  g.ellipse(0, -8, 30, 13).fill(0x9aa6b4).stroke({ width: 4, color: INK });
  g.ellipse(-8, -12, 10, 4).fill(0xffffff);
}

export function blender(def: StageDef): StageView {
  const backdrop = new Container();
  const far = blurryKitchen();
  const tint = glassTint();
  backdrop.addChild(far, tint);

  const world = new Container();
  const baseG = base(def.platforms[0].w);
  const bubbles = new Graphics();
  world.addChild(bubbles, baseG);
  const soft: Graphics[] = [];
  for (let i = 1; i < def.platforms.length; i++) {
    soft[i] = iceCube(def.platforms[i].w, 11 + i * 7);
    world.addChild(soft[i]);
  }

  // ingredients floating near the glass, waiting to be blended
  const bits: { g: Graphics; x: number; y: number; ph: number }[] = [];
  const kinds: [FruitKind, number, number, number][] = [['cherry', -470, -420, 26], ['grapes', 480, -500, 40], ['lime', -560, -700, 34], ['plum', 540, -260, 30], ['peach', -400, -160, 30], ['lemon', 600, -720, 32]];
  kinds.forEach(([k, x, y, r], i) => {
    const g = new Graphics();
    fruit(g, k, 0, 0, r, 4, 0.12);
    g.rotation = (i - 2.5) * 0.3;
    bits.push({ g, x: x * 1.3, y: y * 1.25, ph: i * 1.7 });
    world.addChild(g);
  });

  const front = new Container();
  const blades = new Graphics();
  const splash = new Graphics();
  const jar = jarFront();
  front.addChild(splash, blades, jar);
  const bub = rng(5);
  const seeds = Array.from({ length: 26 }, () => ({ x: (bub() - 0.5) * 780, s: 0.6 + bub(), r: 5 + bub() * 9, o: bub() }));

  return {
    backdrop,
    world,
    front,
    update(frame: number, cam: CameraInfo) {
      const h = hazardAt(def, frame);
      const warn = h?.phase === 'warn' ? h.t : 0;
      const active = h?.phase === 'active' ? h.t : -1;
      const rumble = active >= 0 ? 4 : warn * 5;
      const sx = Math.sin(frame * 2.7) * rumble, sy = Math.cos(frame * 3.1) * rumble * 0.6;
      parallax(far, cam, 0.05);
      far.position.x += sx;
      tint.position.set(640 + sx * 0.5, 360);
      jar.position.set(sx * 0.6, sy * 0.6);
      baseG.position.set(0, sy * 0.3);
      for (let i = 1; i < def.platforms.length; i++) {
        const p = platformAt(def, i, frame);
        soft[i].position.set(p.x, p.y);
      }

      for (const b of bits) {
        const wob = 1 + warn * 4 + (active >= 0 ? 6 : 0);
        b.g.position.set(b.x + Math.sin(frame * 0.013 + b.ph) * 10 * wob, b.y + Math.sin(frame * 0.021 + b.ph) * 14);
        b.g.rotation += 0.002 * wob;
      }
      bubbles.clear();
      if (warn > 0 || active >= 0) {
        const n = active >= 0 ? seeds.length : Math.floor(seeds.length * warn);
        for (let i = 0; i < n; i++) {
          const b = seeds[i];
          const k = (frame * 0.012 * b.s + b.o) % 1;
          const y = -k * 520;
          const x = b.x + Math.sin(frame * 0.1 + i) * 8;
          bubbles.circle(x, y, b.r * (0.6 + k * 0.6)).fill({ color: 0xeafcff, alpha: 0.6 }).stroke({ width: 3, color: INK, alpha: 0.8 });
          bubbles.circle(x - b.r * 0.3, y - b.r * 0.3, b.r * 0.25).fill(0xffffff);
        }
      }

      const spin = active >= 0 ? frame * 0.9 : 0.4 + warn * warn * frame * 0.08;
      drawBlades(blades, spin, active >= 0 ? 1 : 0);
      blades.position.set(sx * 0.3, 0);

      splash.clear();
      if (active >= 0) {
        const rise = Math.min(1, active / 0.15) * (active > 0.8 ? (1 - active) / 0.2 : 1);
        const top = -30 - 70 * rise;
        const pts: number[] = [-430, 30];
        for (let x = -430; x <= 430; x += 30) pts.push(x, top + Math.sin(x * 0.03 + frame * 0.5) * 18 * rise - (Math.abs(x) < 60 ? 30 * rise : 0));
        pts.push(430, 30);
        splash.poly(pts).fill({ color: BERRY, alpha: 0.92 }).stroke({ width: 5, color: INK, join: 'round' });
        for (let x = -400; x <= 400; x += 60) splash.ellipse(x, top + 14 + Math.sin(x + frame * 0.4) * 6, 16, 5).fill({ color: 0xf08cc8, alpha: 0.9 });
        for (let i = 0; i < 14; i++) {
          const a = i * 2.4 + frame * 0.05;
          const life = (frame * 0.03 + i * 0.37) % 1;
          const dx = Math.cos(a) * 420 * life;
          const dy = top - 40 - 260 * life + 300 * life * life;
          splash.circle(dx, dy, 10 * (1 - life) + 3).fill(i % 3 ? BERRY : shade(BERRY, 0.25)).stroke({ width: 3, color: INK });
        }
      }
    },
  };
}
