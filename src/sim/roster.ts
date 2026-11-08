import type { Circle, MoveData, SpecialSlot } from './moves';
import type { FighterId } from './types';

export interface Stats {
  size: number; // visual + hitbox scale
  weight: number;
  walk: number; accel: number;
  air: number; airAccel: number;
  jump: number; djump: number; jumps: number; // jumps = mid-air jumps
  gravity: number; fall: number; fastFall: number;
  power: number; // damage multiplier on normals
  hurt: Circle; crouchHurt: Circle; // before size scaling
}

export interface FighterDef {
  id: FighterId;
  name: string;
  nick: string;
  stats: Stats;
  specials: Record<SpecialSlot, MoveData>;
  super: MoveData;
  cracked?: Partial<Stats>; // coconut above 100%
}

const HURT = { x: 4, y: -112, r: 46 };
const CROUCH = { x: 6, y: -82, r: 42 };
const S = 'special';

// Jumps are tuned so every fruit clears the first platform tier (-250) with a jump +
// double jump; JUMP_BOOST scales the per-fruit values below.
const JUMP_BOOST = 1.15;

const base = (s: Partial<Stats>): Stats => {
  const st: Stats = {
    size: 1, weight: 100, walk: 5.5, accel: 1, air: 4.8, airAccel: 0.42,
    jump: -14, djump: -12.6, jumps: 1, gravity: 0.64, fall: 11.5, fastFall: 16.5,
    power: 1, hurt: HURT, crouchHurt: CROUCH, ...s,
  };
  st.jump *= JUMP_BOOST;
  st.djump *= JUMP_BOOST;
  return st;
};

const SUPER = { button: S, startup: 6, superMove: true, invuln: [0, 40] as [number, number] } as const;

export const ROSTER: Record<FighterId, FighterDef> = {
  banana: {
    id: 'banana', name: 'Banana', nick: 'PEEL',
    stats: base({ weight: 90, walk: 6, accel: 1.1, air: 5, airAccel: 0.45, jump: -14.2, djump: -12.8, gravity: 0.62, fall: 11, fastFall: 16 }),
    specials: {
      nspecial: { button: S, anim: 'throw', name: 'Peelerang', startup: 10, active: 1, recovery: 20, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: null,
        spawn: { frame: 10, kind: 'peel', x: 60, y: -110, vx: 12, vy: 0, gravity: 0, life: 80, r: 26, damage: 6, angle: 40, bkb: 22, kbg: 60, returnAfter: 26, max: 1 } },
      sspecial: { button: S, anim: 'dash', name: 'Banana Rush', startup: 8, active: 14, recovery: 18, damage: 10, angle: 35, bkb: 30, kbg: 85, hitbox: { x: 70, y: -100, r: 44 }, impulse: { from: 8, to: 22, vx: 13 } },
      uspecial: { button: S, anim: 'rise', name: 'Split Spin', startup: 4, active: 22, recovery: 16, damage: 4, angle: 80, bkb: 32, kbg: 40, hitbox: { x: 0, y: -110, r: 62 }, impulse: { from: 4, to: 16, vy: -15 }, multi: 6, upRecovery: true },
      dspecial: { button: S, anim: 'drop', name: 'Peel Trap', startup: 8, active: 1, recovery: 16, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: null,
        spawn: { frame: 8, kind: 'peeltrap', x: 46, y: -10, vx: 0, vy: 0, gravity: 0.6, life: 720, r: 28, damage: 5, angle: 85, bkb: 55, kbg: 30, trap: true, max: 1 } },
    },
    super: { ...SUPER, anim: 'super-rush', name: 'BANANA SPLIT!!', active: 26, recovery: 24, damage: 28, angle: 40, bkb: 72, kbg: 100, hitbox: { x: 40, y: -110, r: 80 }, both: true, heavy: true, impulse: { from: 6, to: 30, vx: 17 } },
  },
  watermelon: {
    id: 'watermelon', name: 'Watermelon', nick: 'BIG MEL',
    stats: base({ size: 1.2, weight: 125, walk: 4.4, accel: 0.8, air: 3.8, airAccel: 0.32, jump: -13.6, djump: -12.2, gravity: 0.7, fall: 12.5, fastFall: 17, power: 1.25, hurt: { x: 0, y: -110, r: 52 }, crouchHurt: { x: 4, y: -82, r: 48 } }),
    specials: {
      nspecial: { button: S, anim: 'throw', name: 'Seed Gun', startup: 6, active: 30, recovery: 14, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: null,
        spawn: { frame: 6, kind: 'seed', x: 60, y: -120, vx: 15, vy: 0, gravity: 0.05, life: 45, r: 12, damage: 2, angle: 30, bkb: 8, kbg: 20, count: 8, every: 4, spread: 1.2 } },
      sspecial: { button: S, anim: 'dash', name: 'Rind Roll', startup: 10, active: 20, recovery: 20, damage: 13, angle: 40, bkb: 35, kbg: 90, hitbox: { x: 40, y: -90, r: 60 }, impulse: { from: 10, to: 30, vx: 11 }, armor: 8 },
      uspecial: { button: S, anim: 'rise', name: 'Melon Bounce', startup: 6, active: 12, recovery: 24, damage: 9, angle: 85, bkb: 40, kbg: 60, hitbox: { x: 0, y: -170, r: 56 }, impulse: { from: 6, to: 14, vy: -16 }, upRecovery: true },
      dspecial: { button: S, anim: 'pound', name: 'Ground Pound', startup: 10, active: 6, recovery: 24, damage: 16, angle: 45, bkb: 40, kbg: 85, hitbox: { x: 0, y: -10, r: 110 }, pound: true, both: true },
    },
    super: { ...SUPER, anim: 'super-barrage', name: 'SEED STORM!!', active: 60, recovery: 20, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: null,
      spawn: { frame: 6, kind: 'seed', x: 60, y: -120, vx: 17, vy: 0, gravity: 0.03, life: 60, r: 16, damage: 3, angle: 35, bkb: 18, kbg: 30, count: 26, every: 2, spread: 4 } },
  },
  pineapple: {
    id: 'pineapple', name: 'Pineapple', nick: 'SPIKE',
    stats: base({ size: 1.08, weight: 108, walk: 5, accel: 0.9, air: 4.4, airAccel: 0.38, jump: -13.6, djump: -12, gravity: 0.66, power: 1.1 }),
    specials: {
      nspecial: { button: S, anim: 'throw', name: 'Spike Shot', startup: 10, active: 1, recovery: 18, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: null,
        spawn: { frame: 10, kind: 'spike', x: 60, y: -150, vx: 14, vy: -2, gravity: 0.15, life: 60, r: 16, damage: 8, angle: 45, bkb: 25, kbg: 70 } },
      sspecial: { button: S, anim: 'dash', name: 'Crown Spin', startup: 8, active: 18, recovery: 18, damage: 3, angle: 60, bkb: 22, kbg: 30, hitbox: { x: 30, y: -110, r: 56 }, impulse: { from: 8, to: 26, vx: 8 }, multi: 4 },
      uspecial: { button: S, anim: 'rise', name: 'Helicopter', startup: 4, active: 40, recovery: 16, damage: 3, angle: 85, bkb: 22, kbg: 30, hitbox: { x: 0, y: -210, r: 50 }, impulse: { from: 4, to: 44, vy: -9 }, multi: 8, upRecovery: true },
      dspecial: { button: S, anim: 'counter', name: 'Spike Counter', startup: 4, active: 24, recovery: 20, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: null, counter: { from: 4, to: 28 } },
    },
    super: { ...SUPER, anim: 'super-wave', name: 'PIÑA COLADA!!', active: 10, recovery: 30, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: null,
      spawn: { frame: 8, kind: 'wave', x: 70, y: -70, vx: 10, vy: 0, gravity: 0, life: 130, r: 90, damage: 25, angle: 50, bkb: 62, kbg: 100, heavy: true, pierce: true, hits: 4 } },
  },
  lemon: {
    id: 'lemon', name: 'Lemon', nick: 'ZEST',
    stats: base({ size: 0.95, weight: 85, walk: 5.6, accel: 1, air: 5.2, airAccel: 0.5, jump: -14.6, djump: -13.2, gravity: 0.6, fall: 10.5, fastFall: 15, power: 0.9 }),
    specials: {
      nspecial: { button: S, anim: 'throw', name: 'Acid Squirt', startup: 6, active: 1, recovery: 12, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: null,
        spawn: { frame: 6, kind: 'acid', x: 60, y: -110, vx: 18, vy: 0, gravity: 0, life: 40, r: 14, damage: 4, angle: 20, bkb: 10, kbg: 40 } },
      sspecial: { button: S, anim: 'throw', name: 'Sour Cloud', startup: 12, active: 1, recovery: 20, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: null,
        spawn: { frame: 12, kind: 'cloud', x: 120, y: -100, vx: 1.5, vy: 0, gravity: 0, life: 180, r: 60, damage: 2, angle: 70, bkb: 10, kbg: 10, hits: 8, interval: 20, pierce: true, max: 1 } },
      uspecial: { button: S, anim: 'rise', name: 'Zest Jet', startup: 6, active: 16, recovery: 18, damage: 6, angle: 70, bkb: 30, kbg: 60, hitbox: { x: 0, y: 10, r: 40 }, impulse: { from: 6, to: 18, vy: -17 }, upRecovery: true },
      dspecial: { button: S, anim: 'pound', name: 'Lemon Drop', startup: 8, active: 5, recovery: 18, damage: 11, angle: 60, bkb: 30, kbg: 80, hitbox: { x: 0, y: -10, r: 80 }, pound: true, both: true },
    },
    super: { ...SUPER, anim: 'super-barrage', name: 'LEMON RAIN!!', active: 40, recovery: 20, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: null,
      spawn: { frame: 6, kind: 'lemondrop', x: 0, y: 0, vx: 0, vy: 13, gravity: 0.2, life: 100, r: 28, damage: 7, angle: 60, bkb: 30, kbg: 70, count: 16, every: 2, rain: { from: -480, to: 480, y: -820 } } },
  },
  coconut: {
    id: 'coconut', name: 'Coconut', nick: 'HARDHEAD',
    stats: base({ size: 1.05, weight: 135, walk: 4.2, accel: 0.75, air: 3.6, airAccel: 0.3, jump: -13.4, djump: -11.8, gravity: 0.75, fall: 13, fastFall: 18, power: 1.2, hurt: { x: 0, y: -108, r: 50 } }),
    cracked: { weight: 80, walk: 6.2, accel: 1.2, air: 5, airAccel: 0.48, power: 1.35 },
    specials: {
      nspecial: { button: S, anim: 'throw', name: 'Shell Toss', startup: 14, active: 1, recovery: 22, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: null,
        spawn: { frame: 14, kind: 'coconut', x: 60, y: -130, vx: 9, vy: -9, gravity: 0.5, life: 90, r: 24, damage: 14, angle: 45, bkb: 35, kbg: 90, heavy: true } },
      sspecial: { button: S, anim: 'dash', name: 'Shell Roll', startup: 10, active: 26, recovery: 20, damage: 12, angle: 35, bkb: 30, kbg: 90, hitbox: { x: 0, y: -80, r: 60 }, impulse: { from: 10, to: 36, vx: 12 }, armor: 10 },
      uspecial: { button: S, anim: 'rise', name: 'Palm Rocket', startup: 8, active: 14, recovery: 26, damage: 10, angle: 88, bkb: 40, kbg: 70, hitbox: { x: 0, y: -190, r: 50 }, impulse: { from: 8, to: 18, vy: -17 }, upRecovery: true },
      dspecial: { button: S, anim: 'pound', name: 'Coconut Bonk', startup: 12, active: 6, recovery: 28, damage: 18, angle: 80, bkb: 45, kbg: 85, hitbox: { x: 0, y: -10, r: 100 }, pound: true, both: true, heavy: true },
    },
    super: { ...SUPER, anim: 'super-barrage', name: 'COCONUT BONK!!', active: 30, recovery: 20, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: null,
      spawn: { frame: 8, kind: 'bigcoconut', x: 0, y: -900, vx: 0, vy: 16, gravity: 0.3, life: 120, r: 95, damage: 30, angle: 70, bkb: 72, kbg: 100, heavy: true, target: true, pierce: true, hits: 3 } },
  },
  strawberry: {
    id: 'strawberry', name: 'Strawberry', nick: 'JAM',
    stats: base({ size: 0.85, weight: 75, walk: 6.6, accel: 1.3, air: 5.6, airAccel: 0.55, jump: -14.8, djump: -13.4, jumps: 2, gravity: 0.6, fall: 10, fastFall: 15, power: 0.85 }),
    specials: {
      nspecial: { button: S, anim: 'throw', name: 'Seed Shuriken', startup: 5, active: 1, recovery: 10, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: null,
        spawn: { frame: 5, kind: 'shuriken', x: 56, y: -110, vx: 17, vy: 0, gravity: 0, life: 36, r: 13, damage: 3, angle: 30, bkb: 12, kbg: 40 } },
      sspecial: { button: S, anim: 'dash', name: 'Berry Dash', startup: 4, active: 10, recovery: 14, damage: 7, angle: 50, bkb: 25, kbg: 70, hitbox: { x: 50, y: -90, r: 40 }, impulse: { from: 4, to: 14, vx: 16 } },
      uspecial: { button: S, anim: 'rise', name: 'Leaf-copter', startup: 4, active: 36, recovery: 14, damage: 2, angle: 80, bkb: 20, kbg: 20, hitbox: { x: 0, y: -200, r: 46 }, impulse: { from: 4, to: 40, vy: -8 }, multi: 6, upRecovery: true },
      dspecial: { button: S, anim: 'drop', name: 'Jam Trap', startup: 10, active: 1, recovery: 16, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: null,
        spawn: { frame: 10, kind: 'jam', x: 44, y: -10, vx: 0, vy: 0, gravity: 0.6, life: 720, r: 30, damage: 4, angle: 90, bkb: 6, kbg: 0, trap: true, stun: 70, max: 1 } },
    },
    super: { ...SUPER, anim: 'super-rush', name: 'BERRY BLITZ!!', active: 24, recovery: 22, damage: 26, angle: 45, bkb: 70, kbg: 100, hitbox: { x: 50, y: -100, r: 70 }, heavy: true, impulse: { from: 6, to: 26, vx: 20 } },
  },
  apple: {
    id: 'apple', name: 'Training Apple', nick: 'DUMMY',
    stats: base({ weight: 100, walk: 0, air: 0, power: 0, hurt: { x: 0, y: -76, r: 50 }, crouchHurt: { x: 0, y: -76, r: 50 } }),
    specials: {} as Record<SpecialSlot, MoveData>,
    super: { button: S, anim: 'jab', startup: 1, active: 1, recovery: 1, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: null },
  },
};
