import { Container, Graphics, Text } from 'pixi.js';
import { NORMALS } from '../sim/moves';
import { INK, burstPoints, easeOut } from './rig';

// Cosmetic effects. They tick at the sim rate but keep animating through hitstop,
// which is what makes hitstop read as "impact" instead of "lag".

interface Effect {
  obj: Container;
  age: number;
  life: number;
  tick: (e: Effect, k: number) => void; // k = age / life
  vx?: number;
  vy?: number;
}

const PUNCH_WORDS = ['POW!', 'BOP!', 'WHAP!', 'BIFF!'];
const KICK_WORDS = ['WHAM!', 'THWACK!', 'KAPOW!', 'WHUMP!'];
const UPPER_WORDS = ['BONK!', 'UPPA!', 'SKYBOP!'];
const LOW_WORDS = ['THWAP!', 'TRIP!', 'SHIN!', 'KIK!'];
const SPIKE_WORDS = ['KRUNCH!', 'STOMP!', 'SPIKED!'];
const HEAVY_WORDS = ['SPLAT!!', 'KA-SQUISH!!', 'PULP!!', 'KRAKOOM!!'];

const BLOCK_WORDS = ['BLOCK!', 'TINK!', 'CLANG!'];
const PROJECTILE_WORDS: Record<string, string[]> = {
  seed: ['PTOO!', 'PIT!'], peel: ['WHIP!', 'FWAP!'], peeltrap: ['SLIP!', 'WHOOPS!'], jam: ['STUCK!', 'SPLOTCH!'],
  acid: ['SSSS!', 'SOUR!'], cloud: ['PEE-YEW!', 'COUGH!'], spike: ['THUNK!', 'PRICK!'], shuriken: ['SHNK!', 'TSING!'],
  coconut: ['BONK!', 'KLONK!'], bigcoconut: ['KA-BONK!!', 'KRAKOOM!!'], wave: ['SPLOOSH!!', 'SPLASH!!'],
  lemondrop: ['PLIP!', 'SPLIT!'], salt: ['SALTED!', 'PSHH!'],
  knife: ['CHOP!!', 'SHUNK!!'], blades: ['WHIRRR!!', 'BLENDED!!'], cart: ['RUN OVER!!', 'KA-RUNCH!!'],
  counter: ['COUNTER!!', 'NOPE!!'], pummel: ['SQUEEZE!', 'PINCH!'],
};

function wordsFor(label: string, heavy: boolean) {
  if (label in PROJECTILE_WORDS) return PROJECTILE_WORDS[label];
  if (heavy) return HEAVY_WORDS;
  const m = NORMALS[label as keyof typeof NORMALS];
  if (!m) return label.endsWith('throw') ? KICK_WORDS : PUNCH_WORDS;
  if (m.angle < 0) return SPIKE_WORDS;
  if (m.angle >= 75 && m.angle <= 95) return UPPER_WORDS;
  if (m.low) return LOW_WORDS;
  return m.button === 'kick' ? KICK_WORDS : PUNCH_WORDS;
}

export const COMIC_FONT = 'Bangers';

export function comicText(text: string, size: number, fill = 0xffe600, shadow = 0xe8202a): Text {
  const t = new Text({
    text,
    style: {
      fontFamily: COMIC_FONT,
      fontSize: size,
      fill,
      letterSpacing: size * 0.04,
      stroke: { color: INK, width: Math.max(6, size * 0.12), join: 'round' },
      dropShadow: { color: shadow, distance: Math.max(4, size * 0.07), angle: Math.PI * 0.3, blur: 0, alpha: 1 },
      padding: size * 0.2,
    },
  });
  t.anchor.set(0.5);
  return t;
}

export class Fx {
  private effects: Effect[] = [];
  private seed = 7;

  constructor(private world: Container, private screen: Container) {}

  private rnd() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  private add(layer: Container, obj: Container, life: number, tick: Effect['tick'], vx = 0, vy = 0) {
    layer.addChild(obj);
    const e: Effect = { obj, age: 0, life, tick, vx, vy };
    tick(e, 0);
    this.effects.push(e);
    return e;
  }

  update() {
    this.effects = this.effects.filter((e) => {
      e.age++;
      if (e.age >= e.life) {
        e.obj.destroy({ children: true });
        return false;
      }
      e.tick(e, e.age / e.life);
      return true;
    });
  }

  hit(x: number, y: number, angle: number, heavy: boolean, kb: number, move: string, juice: number[]) {
    const big = heavy || kb > 120;
    this.spark(x, y, big);
    this.ring(x, y, big ? 150 : 70);
    this.streaks(x, y, angle, big ? 9 : 5, big ? 220 : 120);
    this.juice(x, y, angle, big ? 22 : 9, juice);
    const pool = wordsFor(move, heavy);
    const word = pool[Math.floor(this.rnd() * pool.length)];
    const size = heavy ? 92 : big ? 76 : 58;
    const side = Math.cos(angle) >= 0 ? -1 : 1;
    this.word(x + side * (heavy ? 60 : 30), y - (heavy ? 160 : 90), word, size, (this.rnd() - 0.5) * 0.4, heavy);
  }

  block(x: number, y: number, color: number) {
    this.ring(x, y, 60);
    const g = new Graphics().poly(burstPoints(8, 36, 18, 0.3, 5)).fill(color).stroke({ width: 4, color: INK });
    g.position.set(x, y);
    this.add(this.world, g, 10, (e, k) => {
      e.obj.scale.set(1.2 - k * 0.6);
      e.obj.alpha = 1 - k;
    });
    this.word(x, y - 70, BLOCK_WORDS[Math.floor(this.rnd() * BLOCK_WORDS.length)], 46, (this.rnd() - 0.5) * 0.4, false);
  }

  // Generic poof for items, pickups, projectile pops.
  poof(x: number, y: number, color: number, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const g = new Graphics().circle(0, 0, 10 + this.rnd() * 8).fill(color).stroke({ width: 3, color: INK });
      g.position.set(x, y);
      this.add(this.world, g, 18, (e, k) => {
        e.obj.position.set(x + Math.cos(a) * easeOut(k) * 50, y + Math.sin(a) * easeOut(k) * 50);
        e.obj.scale.set(1 - k * 0.8);
      });
    }
  }

  // Floating label: "+30% HEALED", "SUPER READY", item names.
  label(x: number, y: number, text: string, color = 0xffffff) {
    const t = comicText(text, 40, color, INK);
    t.position.set(x, y);
    this.add(this.world, t, 50, (e, k) => {
      e.obj.y = y - easeOut(k) * 60;
      e.obj.alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    });
  }

  spark(x: number, y: number, big: boolean) {
    const c = new Container();
    const outer = new Graphics().poly(burstPoints(big ? 14 : 10, big ? 110 : 60, big ? 46 : 26, 0.5, 1 + Math.floor(this.rnd() * 9999)))
      .fill(0xffe600).stroke({ width: 5, color: INK, join: 'miter' });
    const inner = new Graphics().poly(burstPoints(big ? 12 : 8, big ? 64 : 36, big ? 26 : 16, 0.4, 3 + Math.floor(this.rnd() * 9999))).fill(0xffffff);
    c.addChild(outer, inner);
    c.position.set(x, y);
    c.rotation = this.rnd() * Math.PI;
    this.add(this.world, c, big ? 16 : 10, (e, k) => {
      const s = e.age === 0 ? 0.6 : e.age === 1 ? 1.2 : 1.05 - k * 0.7;
      e.obj.scale.set(s);
      e.obj.alpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      inner.tint = e.age < 2 ? 0xffffff : 0xfff7c2;
    });
  }

  ring(x: number, y: number, radius: number) {
    const g = new Graphics();
    g.position.set(x, y);
    this.add(this.world, g, 14, (e, k) => {
      const r = 20 + easeOut(k) * radius;
      g.clear().circle(0, 0, r).stroke({ width: 12 * (1 - k) + 1, color: 0xffffff, alpha: 1 - k });
    });
  }

  streaks(x: number, y: number, angle: number, n: number, len: number) {
    for (let i = 0; i < n; i++) {
      const a = angle + (this.rnd() - 0.5) * 1.1;
      const g = new Graphics();
      const l = len * (0.5 + this.rnd() * 0.6);
      g.poly([0, -4, l, 0, 0, 4]).fill(0xffffff).stroke({ width: 3, color: INK, join: 'miter' });
      g.position.set(x, y);
      g.rotation = a;
      this.add(this.world, g, 9, (e, k) => {
        e.obj.position.set(x + Math.cos(a) * k * 60, y + Math.sin(a) * k * 60);
        e.obj.scale.set(0.4 + easeOut(k) * 0.8, 1 - k);
      });
    }
  }

  juice(x: number, y: number, angle: number, n: number, colors: number[]) {
    for (let i = 0; i < n; i++) {
      const a = angle + (this.rnd() - 0.5) * 1.6;
      const sp = 4 + this.rnd() * 9;
      const r = 4 + this.rnd() * 6;
      const g = new Graphics().circle(0, 0, r).fill(colors[i % colors.length]).stroke({ width: 2.5, color: INK });
      g.position.set(x, y);
      this.add(this.world, g, 30 + Math.floor(this.rnd() * 20), (e, k) => {
        e.vy! += 0.45;
        e.obj.x += e.vx!;
        e.obj.y += e.vy!;
        e.obj.scale.set(1 - k * 0.7);
      }, Math.cos(a) * sp, Math.sin(a) * sp - 3);
    }
  }

  word(x: number, y: number, text: string, size: number, rot: number, balloon: boolean) {
    const c = new Container();
    if (balloon) {
      const b = new Graphics()
        .poly(burstPoints(16, size * 1.55, size * 1.05, 0.35, 11 + Math.floor(this.rnd() * 9999)))
        .fill(0xe8202a).stroke({ width: 6, color: INK, join: 'miter' });
      b.scale.set(1.15, 0.62);
      c.addChild(b);
    }
    c.addChild(comicText(text, size));
    c.position.set(x, y);
    c.rotation = rot;
    this.add(this.world, c, 44, (e, k) => {
      const a = e.age;
      const s = a < 3 ? 0.3 + a * 0.45 : a < 6 ? 1.35 - (a - 3) * 0.12 : 1 - Math.max(0, k - 0.7) * 1.2;
      e.obj.scale.set(s);
      e.obj.y = y - easeOut(k) * 24;
      e.obj.alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
    });
  }

  // Speed line left behind a launched fighter.
  trail(x: number, y: number, vx: number, vy: number) {
    const sp = Math.hypot(vx, vy);
    const g = new Graphics();
    const l = sp * 5;
    g.poly([0, -7, -l, 0, 0, 7]).fill(0xffffff).stroke({ width: 3, color: INK, join: 'miter' });
    g.position.set(x + (this.rnd() - 0.5) * 50, y + (this.rnd() - 0.5) * 50);
    g.rotation = Math.atan2(vy, vx);
    this.add(this.world, g, 10, (e, k) => {
      e.obj.alpha = 1 - k;
      e.obj.scale.set(1, 1 - k);
    });
  }

  dust(x: number, y: number, big: boolean) {
    for (const dir of [-1, 1]) {
      const g = new Graphics().circle(0, 0, big ? 16 : 10).fill(0xfff2d9).stroke({ width: 3, color: INK });
      g.position.set(x + dir * 20, y - 8);
      this.add(this.world, g, 18, (e, k) => {
        e.obj.x = x + dir * (20 + easeOut(k) * (big ? 70 : 40));
        e.obj.scale.set(1 - k * 0.8);
      });
    }
  }

  // KO blast in screen space: a jagged wedge of rays shooting in from the edge.
  koBlast(sx: number, sy: number, inward: number) {
    const c = new Container();
    const colors = [0xffe600, 0xff3b1f, 0xffffff, 0x1fd2ff];
    for (let i = 0; i < 9; i++) {
      const a = (this.rnd() - 0.5) * 0.9;
      const len = 500 + this.rnd() * 500;
      const w = 30 + this.rnd() * 60;
      const g = new Graphics().poly([0, -w / 2, len, 0, 0, w / 2]).fill(colors[i % colors.length]).stroke({ width: 4, color: INK });
      g.rotation = a;
      c.addChild(g);
    }
    c.addChild(new Graphics().poly(burstPoints(14, 160, 80, 0.4, 5)).fill(0xffffff).stroke({ width: 6, color: INK }));
    c.position.set(sx, sy);
    c.rotation = inward;
    this.add(this.screen, c, 40, (e, k) => {
      e.obj.scale.set(e.age < 3 ? 0.4 + e.age * 0.3 : 1 + k * 0.2, e.age < 3 ? 0.4 + e.age * 0.3 : 1 - k * 0.9);
      e.obj.alpha = 1 - Math.max(0, k - 0.5) * 2;
    });
  }

  banner(text: string, x: number, y: number, size = 170, color = 0xffffff, shadow = 0x1f5cff) {
    const c = new Container();
    c.addChild(comicText(text, size, color, shadow));
    c.position.set(x, y);
    c.rotation = -0.08;
    this.add(this.screen, c, 80, (e, k) => {
      const a = e.age;
      e.obj.scale.set(a < 4 ? 2.4 - a * 0.38 : 1 + k * 0.08);
      e.obj.alpha = k < 0.8 ? 1 : 1 - (k - 0.8) / 0.2;
    });
  }

  flash(w: number, h: number, alpha: number) {
    const g = new Graphics().rect(-w, -h, w * 3, h * 3).fill(0xffffff);
    this.add(this.screen, g, 10, (e, k) => {
      e.obj.alpha = alpha * (1 - k);
    });
  }
}
