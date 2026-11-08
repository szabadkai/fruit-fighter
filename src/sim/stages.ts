import { dsin } from './math';

// Stage geometry and hazards. Everything here is a pure function of the stage and the
// frame number, so the renderer can draw moving platforms and hazards without the sim
// having to store them.

export type StageId = 'cutting-board' | 'fruit-bowl' | 'kitchen' | 'blender' | 'market' | 'fridge';

export interface PlatformDef {
  x: number; // center
  y: number; // top surface (y grows downward, main stage top is 0)
  w: number;
  solid?: boolean; // solid = can't drop through (the main stage)
  ice?: boolean; // slippery
  move?: { dx: number; dy: number; period: number; phase?: number };
}

export type HazardKind = 'knife' | 'blades' | 'cart';

export interface StageDef {
  id: StageId;
  name: string;
  platforms: PlatformDef[];
  blast: { left: number; right: number; top: number; bottom: number };
  spawns: { x: number; y: number }[];
  hazard?: HazardKind;
}

const MAIN_SPAWNS = (half: number) => [
  { x: -half * 0.55, y: 0 }, { x: half * 0.55, y: 0 }, { x: -half * 0.2, y: 0 }, { x: half * 0.2, y: 0 },
];

// Layout rules of thumb: fighters are ~200-240 tall and every fruit can reach about
// 280 above the ground with a jump + double jump. The first platform tier sits at
// -250 so you can fight underneath it, the second at ~-480, and main stages leave
// roughly six fighter-widths of floor on each side of the center.
export const STAGES: Record<StageId, StageDef> = {
  'cutting-board': {
    id: 'cutting-board', name: 'Cutting Board',
    platforms: [{ x: 0, y: 0, w: 1240, solid: true }],
    blast: { left: -1180, right: 1180, top: -1000, bottom: 620 },
    spawns: MAIN_SPAWNS(620),
  },
  'fruit-bowl': {
    id: 'fruit-bowl', name: 'Fruit Bowl',
    platforms: [
      { x: 0, y: 0, w: 1100, solid: true },
      { x: -310, y: -250, w: 260 },
      { x: 310, y: -250, w: 260 },
      { x: 0, y: -480, w: 280 },
    ],
    blast: { left: -1110, right: 1110, top: -1060, bottom: 620 },
    spawns: MAIN_SPAWNS(550),
  },
  kitchen: {
    id: 'kitchen', name: 'Kitchen Counter',
    platforms: [
      { x: 0, y: 0, w: 1500, solid: true },
      { x: -470, y: -250, w: 250 },
      { x: 470, y: -250, w: 250 },
      { x: 0, y: -430, w: 340 },
    ],
    blast: { left: -1310, right: 1310, top: -1050, bottom: 640 },
    spawns: MAIN_SPAWNS(750),
    hazard: 'knife',
  },
  blender: {
    id: 'blender', name: 'The Blender',
    platforms: [
      { x: 0, y: 0, w: 820, solid: true },
      { x: -270, y: -260, w: 190, move: { dx: 0, dy: 28, period: 300 } },
      { x: 270, y: -260, w: 190, move: { dx: 0, dy: 28, period: 300, phase: 0.5 } },
      { x: 0, y: -500, w: 210, move: { dx: 40, dy: 18, period: 420 } },
    ],
    blast: { left: -980, right: 980, top: -1020, bottom: 600 },
    spawns: MAIN_SPAWNS(410),
    hazard: 'blades',
  },
  market: {
    id: 'market', name: 'Farmers Market',
    platforms: [
      { x: 0, y: 0, w: 1280, solid: true },
      { x: -390, y: -260, w: 260, move: { dx: 0, dy: 60, period: 360 } },
      { x: 390, y: -260, w: 260, move: { dx: 0, dy: 60, period: 360, phase: 0.5 } },
      { x: 0, y: -500, w: 260, move: { dx: 280, dy: 0, period: 600 } },
    ],
    blast: { left: -1200, right: 1200, top: -1090, bottom: 620 },
    spawns: MAIN_SPAWNS(640),
    hazard: 'cart',
  },
  fridge: {
    id: 'fridge', name: 'The Fridge',
    platforms: [
      { x: 0, y: 0, w: 1200, solid: true, ice: true },
      { x: -390, y: -250, w: 300 },
      { x: 390, y: -250, w: 300 },
      { x: 0, y: -480, w: 360 },
      { x: -420, y: -710, w: 240 },
      { x: 420, y: -710, w: 240 },
    ],
    blast: { left: -1170, right: 1170, top: -1260, bottom: 620 },
    spawns: MAIN_SPAWNS(600),
  },
};

export const STAGE_ORDER: StageId[] = ['cutting-board', 'fruit-bowl', 'kitchen', 'blender', 'market', 'fridge'];

export interface PlatformState { x: number; y: number; w: number; solid: boolean; ice: boolean }

export function platformAt(def: StageDef, i: number, frame: number): PlatformState {
  const p = def.platforms[i];
  let x = p.x;
  let y = p.y;
  if (p.move) {
    const s = dsin(Math.PI * 2 * (frame / p.move.period + (p.move.phase ?? 0)));
    x += p.move.dx * s;
    y += p.move.dy * s;
  }
  return { x, y, w: p.w, solid: !!p.solid, ice: !!p.ice };
}

export interface HazardState {
  kind: HazardKind;
  phase: 'idle' | 'warn' | 'active';
  t: number; // 0..1 progress through the current phase
  x: number; // anchor used by the renderer (knife column, cart position)
  y: number;
  dir: 1 | -1;
  hitboxes: { x: number; y: number; r: number }[];
  damage: number;
  angle: number;
  bkb: number;
  kbg: number;
}

const KNIFE_TARGETS = [-420, 270, -80, 540, -600, 160];

export function hazardAt(def: StageDef, frame: number): HazardState | null {
  if (!def.hazard) return null;
  const phase = (from: number, to: number, f: number) => (f - from) / (to - from);
  switch (def.hazard) {
    case 'knife': {
      const cycle = 540;
      const f = frame % cycle;
      const x = KNIFE_TARGETS[Math.floor(frame / cycle) % KNIFE_TARGETS.length];
      const base = { kind: 'knife' as const, x, y: 0, dir: 1 as const, damage: 14, angle: 60, bkb: 45, kbg: 75 };
      if (f < 420 || f >= 520) return { ...base, phase: 'idle', t: f < 420 ? f / 420 : phase(520, cycle, f), hitboxes: [] };
      if (f < 480) return { ...base, phase: 'warn', t: phase(420, 480, f), hitboxes: [] };
      return { ...base, phase: 'active', t: phase(480, 520, f), hitboxes: f < 492 ? [{ x, y: -40, r: 45 }, { x, y: -120, r: 45 }, { x, y: -200, r: 45 }] : [] };
    }
    case 'blades': {
      const cycle = 600;
      const f = frame % cycle;
      const base = { kind: 'blades' as const, x: 0, y: 0, dir: 1 as const, damage: 10, angle: 90, bkb: 60, kbg: 40 };
      if (f < 470) return { ...base, phase: 'idle', t: f / 470, hitboxes: [] };
      if (f < 540) return { ...base, phase: 'warn', t: phase(470, 540, f), hitboxes: [] };
      const hb = [];
      for (let x = -360; x <= 360; x += 60) hb.push({ x, y: -30, r: 50 });
      return { ...base, phase: 'active', t: phase(540, cycle, f), hitboxes: hb };
    }
    case 'cart': {
      const cycle = 700;
      const f = frame % cycle;
      const dir: 1 | -1 = Math.floor(frame / cycle) % 2 === 0 ? -1 : 1;
      const start = -dir * 760; // enters just past the market stage ends (±640)
      const base = { kind: 'cart' as const, y: -50, dir, damage: 13, angle: 40, bkb: 50, kbg: 70 };
      if (f < 560) return { ...base, phase: 'idle', t: f / 560, x: start, hitboxes: [] };
      if (f < 600) return { ...base, phase: 'warn', t: phase(560, 600, f), x: start, hitboxes: [] };
      const t = phase(600, cycle, f);
      const x = start + dir * 1520 * t;
      return { ...base, phase: 'active', t, x, hitboxes: [{ x, y: -50, r: 60 }] };
    }
  }
}
