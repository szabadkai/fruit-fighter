// Pure fixed-step (60 Hz) match simulation. No rendering, no Math.random, no clocks,
// no engine-dependent trig: the same config + inputs produce bit-identical state on
// every machine, which is what LAN lockstep and replays rely on. The renderer reads
// the state and the returned events and never writes back.

import { DEG, clamp, dcos, dlen, dsin, nextRandom } from './math';
import { GRAB_MOVES, NORMALS, THROW_DAMAGE_PUMMEL, pickNormal, type Circle, type MoveData, type MoveId, type ProjectileSpec, type SpecialSlot, type ThrowId } from './moves';
import { ROSTER, type Stats } from './roster';
import { STAGES, hazardAt, platformAt, type StageDef, type StageId } from './stages';
import type { FighterId } from './types';

export interface InputFrame {
  left: boolean; right: boolean; up: boolean; down: boolean;
  jump: boolean; punch: boolean; kick: boolean; special: boolean; shield: boolean;
}

export const NO_INPUT: InputFrame = {
  left: false, right: false, up: false, down: false, jump: false, punch: false, kick: false, special: false, shield: false,
};

const INPUT_KEYS: (keyof InputFrame)[] = ['left', 'right', 'up', 'down', 'jump', 'punch', 'kick', 'special', 'shield'];

export function packInput(i: InputFrame): number {
  let b = 0;
  INPUT_KEYS.forEach((k, n) => { if (i[k]) b |= 1 << n; });
  return b;
}

export function unpackInput(b: number): InputFrame {
  const i = { ...NO_INPUT };
  INPUT_KEYS.forEach((k, n) => { i[k] = (b & (1 << n)) !== 0; });
  return i;
}

export interface PlayerConfig { fighter: FighterId; cpu?: number; name?: string }

export interface MatchConfig {
  stage: StageId;
  players: PlayerConfig[];
  stocks: number; // 0 = infinite (training)
  timeLimit: number; // frames, 0 = none
  items: boolean;
  seed: number;
  training?: boolean;
}

export type Action =
  | 'idle' | 'walk' | 'crouch' | 'air' | 'land' | 'attack' | 'hitstun' | 'shield' | 'dodge'
  | 'dizzy' | 'grabbed' | 'holding' | 'ledge' | 'dead' | 'out';

export type ItemKind = 'smoothie' | 'salt' | 'peeler';

export interface Fighter {
  id: number;
  kind: FighterId;
  x: number; y: number;
  vx: number; vy: number;
  lx: number; ly: number; // launch velocity, decays separately from movement
  facing: 1 | -1;
  grounded: boolean;
  ground: number; // platform index while grounded
  jumps: number;
  doubleJumped: boolean;
  fastFall: boolean;
  usedRecovery: boolean;
  helpless: boolean;
  usedAirDodge: boolean;
  dropTimer: number;
  lastDown: number;
  action: Action;
  frame: number;
  move: MoveId | null;
  hitMask: number;
  charge: number;
  landLag: number;
  dodge: 'roll' | 'spot' | 'air';
  dodgeX: number; dodgeY: number;
  percent: number;
  stocks: number;
  meter: number;
  hitstun: number;
  hitstop: number;
  lastKb: number;
  tumble: boolean;
  invuln: number;
  respawn: number;
  shield: number;
  shieldStun: number;
  grabbedBy: number;
  holding: number;
  holdTimer: number;
  pummelCd: number;
  held: ItemKind | null;
  heldUses: number;
  hazardCd: number;
  parry: number; // frames left in the parry window after raising the guard
  ledge: number; // ledge id while hanging, else -1
  ledgeTimer: number;
  ledgeCd: number; // can't regrab until this runs out
  cracked: boolean;
  lastAttacker: number;
  lastHitFrame: number;
  lastHitSuper: boolean;
  kos: number;
  falls: number;
  dealt: number;
  prev: InputFrame;
}

export interface Projectile {
  id: number;
  owner: number;
  kind: string;
  x: number; y: number;
  vx: number; vy: number;
  gravity: number;
  age: number;
  life: number;
  r: number;
  damage: number; angle: number; bkb: number; kbg: number;
  heavy: boolean;
  trap: boolean;
  landed: boolean;
  returnAfter: number;
  pierce: boolean;
  hits: number;
  interval: number;
  stun: number;
  superHit: boolean;
  hitMask: number;
  facing: 1 | -1;
}

export interface Item {
  id: number;
  kind: ItemKind;
  x: number; y: number;
  vy: number;
  landed: boolean;
  life: number;
}

export interface SimState {
  frame: number;
  cfg: MatchConfig;
  stage: StageDef;
  fighters: Fighter[];
  projectiles: Projectile[];
  items: Item[];
  nextId: number;
  rng: number;
  freeze: number; // super cinematic: the world pauses
  freezeOwner: number;
  over: boolean;
  winner: number; // -1 = draw
  timeLeft: number;
}

export type SimEvent =
  | { type: 'hit'; x: number; y: number; damage: number; kb: number; heavy: boolean; label: string; angle: number; attacker: number; victim: number; armored?: boolean }
  | { type: 'block'; x: number; y: number; victim: number; damage: number }
  | { type: 'shieldbreak'; id: number }
  | { type: 'parry'; id: number; x: number; y: number }
  | { type: 'ko'; x: number; y: number; victim: number; by: number; bySuper: boolean }
  | { type: 'jump'; x: number; y: number; double: boolean; id: number }
  | { type: 'land'; x: number; y: number; id: number; hard: boolean }
  | { type: 'swing'; id: number; move: MoveId; charge: number }
  | { type: 'dodge'; id: number }
  | { type: 'grab'; id: number; victim: number }
  | { type: 'throw'; id: number; move: ThrowId }
  | { type: 'counter'; id: number; x: number; y: number }
  | { type: 'super'; id: number }
  | { type: 'spawn'; id: number; kind: string; x: number; y: number }
  | { type: 'pop'; kind: string; x: number; y: number }
  | { type: 'pickup'; id: number; kind: ItemKind }
  | { type: 'heal'; id: number; amount: number }
  | { type: 'crack'; id: number }
  | { type: 'respawn'; id: number }
  | { type: 'ledge'; id: number; x: number; y: number }
  | { type: 'game'; winner: number };

const LAUNCH_SCALE = 0.11;
const LAUNCH_DECAY = 0.2;
const HITSTUN_SCALE = 0.42;
const RESPAWN_FRAMES = 80;
const SHIELD_MAX = 50;
const FREEZE_FRAMES = 50;
const PARRY_WINDOW = 6;
const ITEM_EVERY = 600;

// --- setup ---------------------------------------------------------------------

export function createMatch(cfg: MatchConfig): SimState {
  const stage = STAGES[cfg.stage];
  const s: SimState = {
    frame: 0, cfg, stage, fighters: [], projectiles: [], items: [], nextId: 1,
    rng: cfg.seed | 0, freeze: 0, freezeOwner: -1, over: false, winner: -1, timeLeft: cfg.timeLimit,
  };
  cfg.players.forEach((p, i) => {
    const sp = stage.spawns[i % stage.spawns.length];
    s.fighters.push(createFighter(i, p.fighter, sp.x, sp.x > 0 ? -1 : 1, cfg.stocks));
  });
  return s;
}

function createFighter(id: number, kind: FighterId, x: number, facing: 1 | -1, stocks: number): Fighter {
  return {
    id, kind, x, y: 0, vx: 0, vy: 0, lx: 0, ly: 0, facing, grounded: true, ground: 0,
    jumps: ROSTER[kind].stats.jumps, doubleJumped: false, fastFall: false, usedRecovery: false, helpless: false,
    usedAirDodge: false, dropTimer: 0, lastDown: -99,
    action: 'idle', frame: 0, move: null, hitMask: 0, charge: 0, landLag: 0, dodge: 'spot', dodgeX: 0, dodgeY: 0,
    percent: 0, stocks, meter: 0, hitstun: 0, hitstop: 0, lastKb: 0, tumble: false, invuln: 0, respawn: 0,
    shield: SHIELD_MAX, shieldStun: 0, grabbedBy: -1, holding: -1, holdTimer: 0, pummelCd: 0,
    held: null, heldUses: 0, hazardCd: 0, parry: 0, ledge: -1, ledgeTimer: 0, ledgeCd: 0, cracked: false,
    lastAttacker: -1, lastHitFrame: -9999, lastHitSuper: false, kos: 0, falls: 0, dealt: 0,
    prev: NO_INPUT,
  };
}

// --- lookups -------------------------------------------------------------------

export function statsOf(f: Fighter): Stats {
  const def = ROSTER[f.kind];
  return f.cracked && def.cracked ? { ...def.stats, ...def.cracked } : def.stats;
}

export function getMove(kind: FighterId, id: MoveId): MoveData {
  if (id in NORMALS) return NORMALS[id as keyof typeof NORMALS];
  if (id in GRAB_MOVES) return GRAB_MOVES[id as keyof typeof GRAB_MOVES];
  if (id === 'super') return ROSTER[kind].super;
  return ROSTER[kind].specials[id as SpecialSlot];
}

export function hurtbox(f: Fighter): Circle {
  const st = statsOf(f);
  const low = f.action === 'crouch' || (f.action === 'attack' && !!f.move && !!getMove(f.kind, f.move).low);
  const h = low ? st.crouchHurt : st.hurt;
  return { x: h.x * st.size, y: h.y * st.size, r: h.r * st.size };
}

const DODGE_LEN = { roll: 26, spot: 22, air: 34 };
const DODGE_INVULN = { roll: [3, 18], spot: [3, 16], air: [3, 24] };

export function invulnerable(f: Fighter): boolean {
  if (f.invuln > 0) return true;
  if (f.action === 'dodge') {
    const [a, b] = DODGE_INVULN[f.dodge];
    return f.frame >= a && f.frame < b;
  }
  if (f.action === 'attack' && f.move) {
    const m = getMove(f.kind, f.move);
    if (m.invuln) return f.frame >= m.invuln[0] && f.frame < m.invuln[1];
  }
  return false;
}

const alive = (f: Fighter) => f.action !== 'dead' && f.action !== 'out';

// --- step ----------------------------------------------------------------------

export function step(s: SimState, inputs: InputFrame[]): SimEvent[] {
  const ev: SimEvent[] = [];
  if (s.over) return ev;
  if (s.freeze > 0) {
    s.freeze--;
    return ev;
  }
  s.frame++;

  for (const f of s.fighters) {
    const inp = inputs[f.id] ?? NO_INPUT;
    if (f.hazardCd > 0) f.hazardCd--;
    if (f.ledgeCd > 0) f.ledgeCd--;
    if (f.parry > 0 && f.hitstop === 0) f.parry--;
    if (f.action !== 'shield' && f.shield < SHIELD_MAX) f.shield = Math.min(SHIELD_MAX, f.shield + 0.08);
    if (f.hitstop > 0) {
      f.hitstop--;
      continue; // prev input is kept, so presses during hitstop register afterwards
    }
    if (f.action === 'out') continue;
    if (f.action === 'dead') {
      if (--f.respawn <= 0) respawn(s, f, ev);
      f.prev = inp;
      continue;
    }
    if (f.invuln > 0) f.invuln--;
    control(s, f, inp, ev);
    if (f.action !== 'grabbed' && f.action !== 'ledge') {
      physics(s, f, ev);
      tryGrabLedge(s, f, ev);
    }
    f.prev = inp;
    if (s.freeze > 0) break; // a super just started; everyone else waits
  }

  updateProjectiles(s, ev);
  resolveMelee(s, ev);
  resolveHazards(s, ev);
  updateItems(s, ev);
  checkBlastZones(s, ev);
  checkGameOver(s, ev);
  return ev;
}

function setAction(f: Fighter, a: Action) {
  if (f.action !== a) {
    f.action = a;
    f.frame = 0;
  }
}

function rand(s: SimState): number {
  const [r, next] = nextRandom(s.rng);
  s.rng = next;
  return r;
}

function friction(s: SimState, f: Fighter): number {
  if (!f.grounded || f.ground < 0) return 0.97;
  return s.stage.platforms[f.ground]?.ice ? 0.965 : 0.75;
}

// --- control -------------------------------------------------------------------

function control(s: SimState, f: Fighter, inp: InputFrame, ev: SimEvent[]) {
  const pressed = (k: keyof InputFrame) => inp[k] && !f.prev[k];
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const st = statsOf(f);
  if (pressed('down')) {
    // double-tap down on a soft platform drops through it
    if (f.grounded && !s.stage.platforms[f.ground]?.solid && s.frame - f.lastDown < 14 && canAct(f)) return drop(f);
    f.lastDown = s.frame;
  }

  switch (f.action) {
    case 'hitstun':
      f.frame++;
      if (dir !== 0 && !f.grounded) f.vx = clamp(f.vx + dir * 0.08, -2, 2); // a little drift
      if (--f.hitstun <= 0) setAction(f, f.grounded ? 'idle' : 'air');
      return;
    case 'dizzy':
      f.frame++;
      f.vx *= friction(s, f);
      if (f.frame >= 150) setAction(f, f.grounded ? 'idle' : 'air');
      return;
    case 'grabbed': {
      const g = s.fighters[f.grabbedBy];
      if (!g || g.action !== 'holding') {
        f.grabbedBy = -1;
        setAction(f, 'idle');
        return;
      }
      if (pressed('punch') || pressed('kick') || pressed('jump') || pressed('special') || pressed('left') || pressed('right')) g.holdTimer -= 6;
      return;
    }
    case 'holding':
      return holding(s, f, inp, dir, ev);
    case 'ledge':
      return onLedge(s, f, inp, pressed, dir, ev);
    case 'land':
      f.frame++;
      f.vx *= friction(s, f);
      if (f.frame >= f.landLag) setAction(f, 'idle');
      return;
    case 'shield':
      return shielding(s, f, inp, pressed, dir, ev);
    case 'dodge':
      return dodging(s, f);
    case 'attack':
      return attacking(s, f, inp, dir, ev);
    default:
      break;
  }

  // free states: idle / walk / crouch / air
  f.frame++;
  if (st.walk === 0) {
    // training dummy
    if (f.grounded) {
      f.vx *= friction(s, f);
      setAction(f, 'idle');
    }
    return;
  }

  if (f.helpless && !f.grounded) {
    drift(f, st, dir, 0.6);
    return;
  }

  if (pressed('special') && inp.shield && f.meter >= 100) {
    f.meter = 0;
    startMove(f, 'super');
    s.freeze = FREEZE_FRAMES;
    s.freezeOwner = f.id;
    ev.push({ type: 'super', id: f.id });
    return;
  }

  if (f.grounded && inp.shield && !pressed('special')) {
    if (pressed('punch')) return startMove(f, 'grab');
    if (pressed('kick')) return startMove(f, 'guardcounter');
    // raising the guard at the last moment parries
    if (pressed('shield')) f.parry = PARRY_WINDOW;
    f.vx = 0;
    setAction(f, 'shield');
    return;
  }
  if (!f.grounded && pressed('shield') && !f.usedAirDodge) {
    const ux = dir, uy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    const l = dlen(ux, uy) || 1;
    f.usedAirDodge = true;
    f.dodge = 'air';
    f.dodgeX = ux / l;
    f.dodgeY = uy / l;
    if (ux === 0 && uy === 0) f.dodgeX = f.dodgeY = 0;
    f.fastFall = false;
    setAction(f, 'dodge');
    ev.push({ type: 'dodge', id: f.id });
    return;
  }

  if (pressed('special')) {
    if (f.grounded && dir !== 0) f.facing = dir as 1 | -1;
    let slot: SpecialSlot = inp.up ? 'uspecial' : inp.down ? 'dspecial' : dir !== 0 ? 'sspecial' : 'nspecial';
    if (slot === 'sspecial' && dir !== 0) f.facing = dir as 1 | -1;
    if (slot === 'uspecial' && f.usedRecovery) slot = 'nspecial';
    return startMove(f, slot);
  }

  if (pressed('punch') || pressed('kick')) {
    if (f.grounded && dir !== 0) f.facing = dir as 1 | -1;
    if (pressed('punch') && f.held === 'salt') {
      f.held = null;
      return startMove(f, 'itemthrow');
    }
    const button = pressed('punch') ? 'punch' : 'kick';
    const id = pickNormal(f.grounded, button, inp.up, inp.down, dir !== 0 && dir === f.facing, dir !== 0 && dir === -f.facing);
    if (button === 'punch' && f.held === 'peeler' && --f.heldUses <= 0) f.held = null;
    startMove(f, id);
    // aerial uppercut doubles as a recovery boost, once per airtime
    if (id === 'uppercut' && !f.grounded && !f.usedRecovery) {
      f.usedRecovery = true;
      f.vy = -14.5;
      f.fastFall = false;
    }
    return;
  }

  if (pressed('jump')) {
    if (f.grounded && inp.down && !s.stage.platforms[f.ground]?.solid) return drop(f);
    if (f.grounded) {
      f.vy = st.jump;
      f.grounded = false;
      f.ground = -1;
      f.jumps = st.jumps;
      f.doubleJumped = false;
      f.fastFall = false;
      setAction(f, 'air');
      f.frame = 0;
      ev.push({ type: 'jump', x: f.x, y: f.y, double: false, id: f.id });
      return;
    }
    if (f.jumps > 0) {
      f.jumps--;
      f.vy = st.djump;
      f.vx = dir * st.air;
      f.doubleJumped = true;
      f.fastFall = false;
      f.action = 'air';
      f.frame = 0;
      if (dir !== 0) f.facing = dir as 1 | -1;
      ev.push({ type: 'jump', x: f.x, y: f.y, double: true, id: f.id });
      return;
    }
  }

  if (f.grounded) {
    if (inp.down) {
      f.vx *= friction(s, f);
      setAction(f, 'crouch');
    } else if (dir !== 0) {
      f.vx = clamp(f.vx + dir * st.accel, -st.walk, st.walk);
      f.facing = dir as 1 | -1;
      setAction(f, 'walk');
    } else {
      f.vx *= friction(s, f);
      if (Math.abs(f.vx) < 0.1) f.vx = 0;
      setAction(f, 'idle');
    }
  } else {
    drift(f, st, dir, 1);
    if (pressed('down') && f.vy > -2) f.fastFall = true;
  }
}

function canAct(f: Fighter) {
  return f.action === 'idle' || f.action === 'walk' || f.action === 'crouch';
}

function drop(f: Fighter) {
  f.grounded = false;
  f.ground = -1;
  f.dropTimer = 12;
  f.y += 2;
  f.vy = 1;
  setAction(f, 'air');
}

function drift(f: Fighter, st: Stats, dir: number, mult: number) {
  if (dir !== 0) f.vx = clamp(f.vx + dir * st.airAccel * mult, -st.air, st.air);
  else f.vx *= 0.97;
}

function startMove(f: Fighter, id: MoveId) {
  f.move = id;
  f.action = 'attack';
  f.frame = 0;
  f.hitMask = 0;
  f.charge = 0;
  const m = getMove(f.kind, id);
  if (m.upRecovery) f.usedRecovery = true;
}

function attacking(s: SimState, f: Fighter, inp: InputFrame, dir: number, ev: SimEvent[]) {
  let m = getMove(f.kind, f.move!);
  // combos: tap the same button again (no direction) to continue
  if (m.chain && inp[m.button] && !f.prev[m.button] && f.frame >= m.chain.from && dir === 0 && !inp.up && !inp.down) {
    startMove(f, m.chain.into);
    return;
  }
  const held = inp[m.button];
  const holding = m.chargeFrame !== undefined && f.frame === m.chargeFrame && held;
  const st = statsOf(f);
  if (holding && m.holdInto && ++f.charge >= m.holdFrames!) {
    f.move = m.holdInto;
    m = getMove(f.kind, f.move);
    f.frame = m.chargeFrame ?? 0;
    f.charge = 0;
  } else if (holding && m.maxCharge && f.charge < m.maxCharge) {
    f.charge++;
  } else if (m.pound && !f.grounded && f.frame === m.startup - 1) {
    f.vy = 20; // plunge; the active frames start on landing
    f.vx *= 0.8;
  } else if (!(holding && m.holdInto)) {
    f.frame++;
    if (m.chargeFrame !== undefined && !m.holdInto && f.frame === m.chargeFrame + 1) ev.push({ type: 'swing', id: f.id, move: f.move!, charge: f.charge });
    if ((m.chargeFrame === undefined || m.holdInto) && f.frame === m.startup) ev.push({ type: 'swing', id: f.id, move: f.move!, charge: 0 });
  }

  if (m.multi && f.frame > m.startup && (f.frame - m.startup) % m.multi === 0) f.hitMask = 0;

  if (m.spawn) {
    const sp = m.spawn;
    const n = sp.count ?? 1;
    for (let k = 0; k < n; k++) {
      if (f.frame === sp.frame + k * (sp.every ?? 0) && (k === 0 || sp.every)) spawnProjectile(s, f, sp, k, n, !!m.superMove, ev);
    }
  }

  const im = m.impulse;
  const impulsing = im && f.frame >= im.from && f.frame < im.to;
  if (impulsing) {
    if (im.vx !== undefined) f.vx = im.vx * f.facing;
    if (im.vy !== undefined) {
      f.vy = im.vy;
      f.grounded = false;
      f.ground = -1;
    }
    if (im.vx !== undefined && im.vy === undefined && !f.grounded) f.vy = Math.min(f.vy, 2);
  } else if (f.grounded) {
    f.vx *= m.superMove ? 0.85 : f.ground >= 0 && s.stage.platforms[f.ground]?.ice ? 0.97 : 0.8;
  } else {
    drift(f, st, dir, 0.5);
  }

  if (f.frame >= m.startup + m.active + m.recovery) {
    if (m.then) return startMove(f, m.then);
    f.move = null;
    if (m.upRecovery && !f.grounded) f.helpless = true;
    setAction(f, !f.grounded ? 'air' : inp.down ? 'crouch' : 'idle');
  }
}

function shielding(s: SimState, f: Fighter, inp: InputFrame, pressed: (k: keyof InputFrame) => boolean, dir: number, ev: SimEvent[]) {
  f.frame++;
  f.vx *= friction(s, f);
  if (f.shieldStun > 0) {
    f.shieldStun--;
    return;
  }
  if (!inp.shield) return setAction(f, 'idle');
  if (pressed('punch')) return startMove(f, 'grab');
  if (pressed('kick')) return startMove(f, 'guardcounter');
  if (pressed('jump')) {
    setAction(f, 'idle');
    f.vy = statsOf(f).jump;
    f.grounded = false;
    f.ground = -1;
    f.action = 'air';
    ev.push({ type: 'jump', x: f.x, y: f.y, double: false, id: f.id });
    return;
  }
  if (pressed('left') || pressed('right') || pressed('down')) {
    f.dodge = pressed('down') ? 'spot' : 'roll';
    f.dodgeX = f.dodge === 'roll' ? dir : 0;
    setAction(f, 'dodge');
    ev.push({ type: 'dodge', id: f.id });
    return;
  }
  f.shield -= 0.16;
  if (f.shield <= 0) shieldBreak(f, ev);
}

function dodging(s: SimState, f: Fighter) {
  f.frame++;
  if (f.dodge === 'roll') {
    f.vx = f.frame < 20 ? f.dodgeX * 6.5 : f.vx * 0.6;
  } else if (f.dodge === 'spot') {
    f.vx *= friction(s, f);
  } else if (f.frame < 12) {
    f.vx = f.dodgeX * 9;
    f.vy = f.dodgeY * 9;
  }
  if (f.frame >= DODGE_LEN[f.dodge]) setAction(f, f.grounded ? 'idle' : 'air');
}

function holding(s: SimState, f: Fighter, inp: InputFrame, dir: number, ev: SimEvent[]) {
  const v = s.fighters[f.holding];
  if (!v || v.action !== 'grabbed') {
    f.holding = -1;
    return setAction(f, 'idle');
  }
  const pressed = (k: keyof InputFrame) => inp[k] && !f.prev[k];
  f.frame++;
  f.holdTimer--;
  if (f.pummelCd > 0) f.pummelCd--;
  v.x = f.x + 62 * statsOf(f).size * f.facing;
  v.y = f.y;
  v.facing = -f.facing as 1 | -1;
  if (pressed('punch') && f.pummelCd === 0) {
    v.percent += THROW_DAMAGE_PUMMEL;
    f.meter = Math.min(100, f.meter + 1);
    f.pummelCd = 16;
    f.hitstop = v.hitstop = 4;
    ev.push({ type: 'hit', x: v.x, y: v.y - 90, damage: THROW_DAMAGE_PUMMEL, kb: 0, heavy: false, label: 'pummel', angle: 0, attacker: f.id, victim: v.id });
    return;
  }
  let t: ThrowId | null = null;
  if (pressed('up')) t = 'uthrow';
  else if (pressed('down')) t = 'dthrow';
  else if ((pressed('left') || pressed('right')) && dir !== 0) t = dir === f.facing ? 'fthrow' : 'bthrow';
  if (t) {
    const m = GRAB_MOVES[t];
    f.holding = -1;
    v.grabbedBy = -1;
    f.move = t;
    f.action = 'attack';
    f.frame = 0;
    ev.push({ type: 'throw', id: f.id, move: t });
    applyHit(s, f, v, { damage: m.damage * statsOf(f).power, angle: m.angle, bkb: m.bkb, kbg: m.kbg, heavy: false }, f.facing, v.x, v.y - 90, t, true, ev);
    return;
  }
  if (f.holdTimer <= 0) {
    f.holding = -1;
    v.grabbedBy = -1;
    setAction(f, 'idle');
    setAction(v, 'idle');
    f.vx = -4 * f.facing;
    v.vx = 4 * f.facing;
  }
}

function shieldBreak(f: Fighter, ev: SimEvent[]) {
  f.shield = 30;
  f.shieldStun = 0;
  setAction(f, 'dizzy');
  f.ly = -9;
  f.grounded = false;
  f.ground = -1;
  ev.push({ type: 'shieldbreak', id: f.id });
}

// --- ledges --------------------------------------------------------------------
//
// Both ends of every solid platform are ledges. Falling fighters near one snap to it
// and hang with a moment of invincibility, then climb, roll, attack, jump or drop.

interface Ledge { id: number; x: number; y: number; dir: 1 | -1; platform: number } // dir: which way the stage is

function ledgesOf(s: SimState): Ledge[] {
  const out: Ledge[] = [];
  s.stage.platforms.forEach((p, i) => {
    if (!p.solid) return;
    const at = platformAt(s.stage, i, s.frame);
    out.push({ id: i * 2, x: at.x - at.w / 2, y: at.y, dir: 1, platform: i });
    out.push({ id: i * 2 + 1, x: at.x + at.w / 2, y: at.y, dir: -1, platform: i });
  });
  return out;
}

const HANG_X = 28; // how far outside the edge the body hangs
const HANG_Y = 200; // hands reach up this far above the feet

function tryGrabLedge(s: SimState, f: Fighter, ev: SimEvent[]) {
  if (f.grounded || f.ledgeCd > 0 || !alive(f)) return;
  const st = statsOf(f);
  if (st.walk === 0) return;
  const recovering = f.action === 'attack' && !!f.move && !!getMove(f.kind, f.move).upRecovery;
  if (f.action !== 'air' && !recovering) return;
  if (f.vy < -4 && !recovering) return;
  for (const L of ledgesOf(s)) {
    const dx = (f.x - L.x) * L.dir; // < 0 means outside the stage
    if (dx > 12 || dx < -80 * st.size) continue;
    const hands = f.y - HANG_Y * st.size;
    if (hands < L.y - 60 || hands > L.y + 70) continue;
    if (s.fighters.some((o) => o !== f && o.action === 'ledge' && o.ledge === L.id)) continue;
    f.action = 'ledge';
    f.frame = 0;
    f.move = null;
    f.ledge = L.id;
    f.ledgeTimer = 0;
    f.facing = L.dir;
    f.x = L.x - L.dir * HANG_X * st.size;
    f.y = L.y + HANG_Y * st.size;
    f.vx = f.vy = f.lx = f.ly = 0;
    f.jumps = st.jumps;
    f.usedRecovery = false;
    f.helpless = false;
    f.usedAirDodge = false;
    f.fastFall = false;
    f.invuln = Math.max(f.invuln, 40);
    ev.push({ type: 'ledge', id: f.id, x: L.x, y: L.y });
    return;
  }
}

function leaveLedge(f: Fighter, cd: number) {
  f.ledge = -1;
  f.ledgeCd = cd;
  f.grounded = false;
  f.ground = -1;
}

function climbTo(f: Fighter, L: Ledge, inset: number) {
  f.x = L.x + L.dir * inset * statsOf(f).size;
  f.y = L.y;
  f.vx = f.vy = 0;
  f.grounded = true;
  f.ground = L.platform;
  f.ledge = -1;
  f.ledgeCd = 20;
}

function onLedge(s: SimState, f: Fighter, inp: InputFrame, pressed: (k: keyof InputFrame) => boolean, dir: number, ev: SimEvent[]) {
  const L = ledgesOf(s).find((l) => l.id === f.ledge);
  const st = statsOf(f);
  if (!L) {
    leaveLedge(f, 30);
    return setAction(f, 'air');
  }
  f.frame++;
  f.x = L.x - L.dir * HANG_X * st.size;
  f.y = L.y + HANG_Y * st.size;
  if (f.frame < 8) return; // grab lag
  const toward = (L.dir > 0 ? pressed('right') : pressed('left'));
  const away = (L.dir > 0 ? pressed('left') : pressed('right'));
  if (pressed('jump') || pressed('up')) {
    leaveLedge(f, 20);
    f.y = L.y - 4;
    f.vy = st.jump * 1.05;
    f.vx = L.dir * 2;
    setAction(f, 'air');
    ev.push({ type: 'jump', x: f.x, y: f.y, double: false, id: f.id });
  } else if (pressed('punch') || pressed('kick')) {
    climbTo(f, L, 34);
    startMove(f, 'ledgeattack');
    f.invuln = 10;
  } else if (pressed('shield')) {
    climbTo(f, L, 30);
    f.dodge = 'roll';
    f.dodgeX = L.dir;
    setAction(f, 'dodge');
    ev.push({ type: 'dodge', id: f.id });
  } else if (toward) {
    climbTo(f, L, 36);
    f.landLag = 12;
    f.invuln = 12;
    setAction(f, 'land');
  } else if (pressed('down') || away || ++f.ledgeTimer > 300) {
    leaveLedge(f, f.ledgeTimer > 300 ? 60 : 30);
    f.vy = 1;
    setAction(f, 'air');
  }
  void dir;
}

// --- physics -------------------------------------------------------------------

function physics(s: SimState, f: Fighter, ev: SimEvent[]) {
  const st = statsOf(f);
  const airDodgeHold = f.action === 'dodge' && f.dodge === 'air' && f.frame < 12;
  if (!f.grounded && !airDodgeHold) f.vy = Math.min(f.vy + st.gravity, f.fastFall ? st.fastFall : st.fall);

  const sp = dlen(f.lx, f.ly);
  if (sp > 0) {
    const ns = Math.max(0, sp - LAUNCH_DECAY);
    f.lx *= ns / sp;
    f.ly *= ns / sp;
  }

  if (f.grounded && f.ground >= 0) {
    const p0 = platformAt(s.stage, f.ground, s.frame - 1);
    const p1 = platformAt(s.stage, f.ground, s.frame);
    f.x += p1.x - p0.x;
  }

  const prevY = f.y;
  f.x += f.vx + f.lx;
  f.y += f.vy + f.ly;
  if (f.dropTimer > 0) f.dropTimer--;

  if (f.grounded) {
    const p = platformAt(s.stage, f.ground, s.frame);
    if (Math.abs(f.x - p.x) > p.w / 2 || f.ly < -0.5) {
      f.grounded = false;
      f.ground = -1;
      f.jumps = st.jumps;
      if (f.action === 'idle' || f.action === 'walk' || f.action === 'crouch' || f.action === 'land') setAction(f, 'air');
    } else {
      f.y = p.y;
    }
    return;
  }

  if (f.vy + f.ly < 0) return;
  for (let i = 0; i < s.stage.platforms.length; i++) {
    const p1 = platformAt(s.stage, i, s.frame);
    if (!p1.solid && f.dropTimer > 0) continue;
    if (Math.abs(f.x - p1.x) > p1.w / 2) continue;
    const p0 = platformAt(s.stage, i, s.frame - 1);
    if (prevY <= p0.y + 0.5 && f.y >= p1.y) {
      land(s, f, i, p1.y, ev);
      return;
    }
  }
}

function land(s: SimState, f: Fighter, i: number, y: number, ev: SimEvent[]) {
  const impact = f.vy + f.ly;
  const st = statsOf(f);
  f.y = y;
  f.vy = 0;
  f.ly = 0;
  f.grounded = true;
  f.ground = i;
  f.jumps = st.jumps;
  f.fastFall = false;
  f.doubleJumped = false;
  f.usedRecovery = false;
  f.usedAirDodge = false;
  const wasHelpless = f.helpless;
  f.helpless = false;
  if (f.action === 'air') {
    if (wasHelpless) {
      f.landLag = 14;
      setAction(f, 'land');
    } else setAction(f, 'idle');
  } else if (f.action === 'dodge' && f.dodge === 'air') {
    f.landLag = 8;
    setAction(f, 'land');
  } else if (f.action === 'attack' && f.move) {
    const m = getMove(f.kind, f.move);
    if (m.aerial) {
      f.move = null;
      f.landLag = 8;
      setAction(f, 'land');
    }
  }
  ev.push({ type: 'land', x: f.x, y, id: f.id, hard: impact > 9 });
  void s;
}

// --- hits ----------------------------------------------------------------------

interface HitSpec { damage: number; angle: number; bkb: number; kbg: number; heavy: boolean; stun?: number; superHit?: boolean }

// Simplified Smash knockback: grows with the victim's percent, shrinks with weight.
export function knockback(percentAfter: number, damage: number, weight: number, kbg: number, bkb: number): number {
  const p = percentAfter;
  return ((p / 10 + (p * damage) / 20) * (200 / (weight + 100)) * 1.4 + 18) * (kbg / 100) + bkb;
}

function applyHit(s: SimState, a: Fighter | null, v: Fighter, h: HitSpec, dir: number, x: number, y: number, label: string, melee: boolean, ev: SimEvent[]) {
  const d = h.damage;
  v.percent = Math.min(999, v.percent + d);
  const st = statsOf(v);
  const kb = knockback(v.percent, d, st.weight, h.kbg, h.bkb);
  if (a) {
    a.dealt += d;
    if (!h.superHit) a.meter = Math.min(100, a.meter + d);
  }
  v.meter = Math.min(100, v.meter + d * 0.5);

  // super armor: shrug off light hits during the move
  if (v.action === 'attack' && v.move) {
    const vm = getMove(v.kind, v.move);
    if (vm.armor && d <= vm.armor && v.frame < vm.startup + vm.active) {
      v.hitstop = Math.floor(d * 0.3 + 4);
      if (a && melee) a.hitstop = v.hitstop;
      ev.push({ type: 'hit', x, y, damage: d, kb: 0, heavy: false, label, angle: 0, attacker: a?.id ?? -1, victim: v.id, armored: true });
      return;
    }
  }

  const ang = h.angle * DEG;
  const speed = kb * LAUNCH_SCALE;
  v.lx = dcos(ang) * speed * dir;
  v.ly = -dsin(ang) * speed;
  v.vx = 0;
  v.vy = 0;
  if (v.grounded && v.ly > 0) v.ly = -v.ly * 0.6; // spiked into the floor: bounce
  if (v.grounded && v.ly < 0) {
    v.grounded = false;
    v.ground = -1;
    v.y -= 1;
  }
  if (v.holding >= 0) {
    const held = s.fighters[v.holding];
    if (held) {
      held.grabbedBy = -1;
      setAction(held, 'idle');
    }
    v.holding = -1;
  }
  v.grabbedBy = -1;
  v.ledge = -1;
  v.move = null;
  v.action = 'hitstun';
  v.frame = 0;
  v.hitstun = h.stun ?? Math.floor(kb * HITSTUN_SCALE);
  v.lastKb = kb;
  v.tumble = kb > 80;
  v.helpless = false;
  v.usedRecovery = false;
  v.fastFall = false;
  v.facing = (dir > 0 ? -1 : 1) as 1 | -1;
  v.lastAttacker = a?.id ?? -1;
  v.lastHitFrame = s.frame;
  v.lastHitSuper = !!h.superHit;
  const stop = Math.floor((d * 0.3846 + 5) * (h.heavy ? 1.6 : 1));
  if (a && melee) a.hitstop = stop;
  v.hitstop = stop;
  if (v.kind === 'coconut' && !v.cracked && v.percent >= 100) {
    v.cracked = true;
    ev.push({ type: 'crack', id: v.id });
  }
  ev.push({ type: 'hit', x, y, damage: d, kb, heavy: h.heavy, label, angle: Math.atan2(v.ly, v.lx), attacker: a?.id ?? -1, victim: v.id });
}

function blockHit(v: Fighter, d: number, dir: number, x: number, y: number, ev: SimEvent[], a?: Fighter) {
  if (v.parry > 0) {
    // perfect guard: no shield damage, the defender recovers first, the attacker is frozen
    v.parry = 0;
    v.shieldStun = 0;
    v.hitstop = 6;
    if (a) a.hitstop = 26;
    ev.push({ type: 'parry', id: v.id, x, y });
    return;
  }
  v.shield -= d * 1.2;
  v.shieldStun = Math.floor(d * 0.6) + 3;
  v.vx = 3.5 * dir;
  v.hitstop = Math.floor(d * 0.25 + 3);
  ev.push({ type: 'block', x, y, victim: v.id, damage: d });
  if (v.shield <= 0) shieldBreak(v, ev);
}

function countering(v: Fighter): boolean {
  if (v.action !== 'attack' || !v.move) return false;
  const c = getMove(v.kind, v.move).counter;
  return !!c && v.frame >= c.from && v.frame < c.to;
}

function resolveMelee(s: SimState, ev: SimEvent[]) {
  for (const a of s.fighters) {
    if (a.action !== 'attack' || !a.move || a.hitstop > 0) continue;
    const m = getMove(a.kind, a.move);
    if (!m.hitbox || a.frame < m.startup || a.frame >= m.startup + m.active) continue;
    if (m.pound && !a.grounded) continue;
    const st = statsOf(a);
    const peeler = a.held === 'peeler' && m.button === 'punch' && !m.grab;
    const chargeMul = m.maxCharge ? 1 + (a.charge / m.maxCharge) * 0.4 : 1;
    const dmg = m.damage * chargeMul * (m.superMove ? 1 : st.power) * (peeler ? 1.6 : 1);
    const r = m.hitbox.r * st.size * (peeler ? 1.3 : 1);
    for (const side of m.both ? [1, -1] : [1]) {
      const hx = a.x + m.hitbox.x * st.size * a.facing * side;
      const hy = a.y + m.hitbox.y * st.size;
      for (const v of s.fighters) {
        if (v === a || !alive(v) || invulnerable(v) || (a.hitMask & (1 << v.id)) || v.grabbedBy === a.id) continue;
        const hb = hurtbox(v);
        const vx = v.x + hb.x * v.facing;
        const vy = v.y + hb.y;
        if (dlen(hx - vx, hy - vy) > r + hb.r) continue;
        a.hitMask |= 1 << v.id;
        const x = (hx + vx) / 2, y = (hy + vy) / 2;
        const dir = a.facing * side;
        if (m.grab) {
          if (v.action === 'grabbed' || v.action === 'holding') continue;
          a.action = 'holding';
          a.frame = 0;
          a.move = null;
          a.holding = v.id;
          a.holdTimer = 90 + Math.floor(v.percent * 0.5);
          v.grabbedBy = a.id;
          v.move = null;
          v.vx = v.vy = v.lx = v.ly = 0;
          setAction(v, 'grabbed');
          ev.push({ type: 'grab', id: a.id, victim: v.id });
          break;
        }
        if (v.action === 'shield') {
          const parried = v.parry > 0;
          blockHit(v, dmg, dir, x, y, ev, a);
          if (!parried) a.hitstop = v.hitstop;
          continue;
        }
        if (countering(v)) {
          v.frame = getMove(v.kind, v.move!).counter!.to;
          ev.push({ type: 'counter', id: v.id, x, y });
          applyHit(s, v, a, { damage: Math.max(10, dmg * 1.4), angle: 40, bkb: 60, kbg: 85, heavy: true }, -dir, x, y, 'counter', true, ev);
          continue;
        }
        applyHit(s, a, v, { damage: dmg, angle: m.angle, bkb: m.bkb, kbg: m.kbg, heavy: !!m.heavy, stun: m.stun, superHit: m.superMove }, dir, x, y, a.move!, true, ev);
        if (a.hitstop > 0) break;
      }
    }
  }
}

// --- projectiles ---------------------------------------------------------------

function spawnProjectile(s: SimState, f: Fighter, sp: ProjectileSpec, k: number, n: number, superHit: boolean, ev: SimEvent[]) {
  const size = statsOf(f).size;
  let x = f.x + sp.x * size * f.facing;
  let y = f.y + sp.y * size;
  let vy = sp.vy;
  if (sp.spread) vy += sp.spread * ((((k * 7) % 5) / 2) - 1);
  if (sp.rain) {
    x = sp.rain.from + ((sp.rain.to - sp.rain.from) * ((k * 7) % n)) / Math.max(1, n - 1);
    y = sp.rain.y;
  }
  if (sp.target) {
    let best: Fighter | null = null;
    for (const o of s.fighters) if (o !== f && alive(o) && (!best || Math.abs(o.x - f.x) < Math.abs(best.x - f.x))) best = o;
    x = best ? best.x : f.x;
    y = sp.y;
  }
  if (sp.max) {
    const mine = s.projectiles.filter((p) => p.owner === f.id && p.kind === sp.kind);
    if (mine.length >= sp.max) s.projectiles.splice(s.projectiles.indexOf(mine[0]), 1);
  }
  s.projectiles.push({
    id: s.nextId++, owner: f.id, kind: sp.kind, x, y, vx: sp.rain || sp.target ? 0 : sp.vx * f.facing, vy,
    gravity: sp.gravity, age: 0, life: sp.life, r: sp.r, damage: sp.damage, angle: sp.angle, bkb: sp.bkb, kbg: sp.kbg,
    heavy: !!sp.heavy, trap: !!sp.trap, landed: false, returnAfter: sp.returnAfter ?? 0, pierce: !!sp.pierce,
    hits: sp.hits ?? 1, interval: sp.interval ?? 0, stun: sp.stun ?? 0, superHit, hitMask: 0, facing: f.facing,
  });
  ev.push({ type: 'spawn', id: f.id, kind: sp.kind, x, y });
}

function updateProjectiles(s: SimState, ev: SimEvent[]) {
  const keep: Projectile[] = [];
  for (const p of s.projectiles) {
    p.age++;
    if (p.interval && p.age % p.interval === 0) p.hitMask = 0;
    if (!(p.trap && p.landed)) {
      if (p.returnAfter && p.age > p.returnAfter) p.vx -= p.facing * 0.9;
      p.vy += p.gravity;
      const prevY = p.y;
      p.x += p.vx;
      p.y += p.vy;
      if (p.gravity > 0 && p.vy > 0) {
        for (let i = 0; i < s.stage.platforms.length; i++) {
          const pl = platformAt(s.stage, i, s.frame);
          if (Math.abs(p.x - pl.x) <= pl.w / 2 && prevY <= pl.y && p.y >= pl.y) {
            if (p.trap) {
              p.y = pl.y;
              p.vy = 0;
              p.vx = 0;
              p.landed = true;
            } else if (!p.pierce || p.kind !== 'bigcoconut') {
              p.life = 0;
              ev.push({ type: 'pop', kind: p.kind, x: p.x, y: pl.y });
            } else {
              p.y = pl.y - p.r * 0.5;
              p.vy = -p.vy * 0.35;
            }
            break;
          }
        }
      }
    }
    // boomerang caught
    const owner = s.fighters[p.owner];
    if (p.returnAfter && p.age > p.returnAfter + 4 && owner && alive(owner) && dlen(owner.x - p.x, owner.y - 110 - p.y) < 70) p.life = 0;

    let gone = --p.life <= 0;
    const b = s.stage.blast;
    if (p.x < b.left || p.x > b.right || p.y > b.bottom || p.y < b.top - 200) gone = true;
    if (!gone) {
      for (const v of s.fighters) {
        if (v.id === p.owner || !alive(v) || invulnerable(v) || (p.hitMask & (1 << v.id))) continue;
        const hb = hurtbox(v);
        const vx = v.x + hb.x * v.facing, vy = v.y + hb.y;
        if (dlen(p.x - vx, p.y - vy) > p.r + hb.r) continue;
        p.hitMask |= 1 << v.id;
        const dir = p.vx !== 0 ? Math.sign(p.vx) : v.x >= p.x ? 1 : -1;
        if (countering(v)) {
          // reflect it back
          p.owner = v.id;
          p.vx = -p.vx * 1.2 || dir * -8;
          p.facing = -p.facing as 1 | -1;
          p.hitMask = 0;
          p.returnAfter = 0;
          ev.push({ type: 'counter', id: v.id, x: p.x, y: p.y });
          continue;
        }
        if (v.action === 'shield') blockHit(v, p.damage, dir, p.x, p.y, ev);
        else applyHit(s, s.fighters[p.owner] ?? null, v, { damage: p.damage, angle: p.angle, bkb: p.bkb, kbg: p.kbg, heavy: p.heavy, stun: p.stun || undefined, superHit: p.superHit }, dir, p.x, p.y, p.kind, false, ev);
        if (--p.hits <= 0 && !p.pierce) {
          gone = true;
          ev.push({ type: 'pop', kind: p.kind, x: p.x, y: p.y });
          break;
        }
        if (p.hits <= 0) {
          gone = true;
          break;
        }
      }
    }
    if (!gone) keep.push(p);
  }
  s.projectiles = keep;
}

// --- hazards, items, blast zones -----------------------------------------------

function resolveHazards(s: SimState, ev: SimEvent[]) {
  const hz = hazardAt(s.stage, s.frame);
  if (!hz || hz.phase !== 'active') return;
  for (const f of s.fighters) {
    if (!alive(f) || invulnerable(f) || f.hazardCd > 0) continue;
    const hb = hurtbox(f);
    for (const b of hz.hitboxes) {
      if (dlen(f.x + hb.x * f.facing - b.x, f.y + hb.y - b.y) > b.r + hb.r) continue;
      f.hazardCd = 45;
      const dir = hz.kind === 'cart' ? hz.dir : f.x >= b.x ? 1 : -1;
      applyHit(s, null, f, { damage: hz.damage, angle: hz.angle, bkb: hz.bkb, kbg: hz.kbg, heavy: true }, dir, b.x, b.y, hz.kind, false, ev);
      break;
    }
  }
}

function updateItems(s: SimState, ev: SimEvent[]) {
  if (s.cfg.items && s.frame % ITEM_EVERY === 0 && s.items.length < 2) {
    const r = rand(s);
    const kind: ItemKind = r < 0.34 ? 'smoothie' : r < 0.67 ? 'salt' : 'peeler';
    const i = Math.floor(rand(s) * s.stage.platforms.length);
    const pl = platformAt(s.stage, i, s.frame);
    s.items.push({ id: s.nextId++, kind, x: pl.x + (rand(s) - 0.5) * pl.w * 0.7, y: pl.y - 600, vy: 0, landed: false, life: 900 });
  }
  s.items = s.items.filter((it) => {
    if (--it.life <= 0) return false;
    if (!it.landed) {
      const prevY = it.y;
      it.vy = Math.min(it.vy + 0.5, 10);
      it.y += it.vy;
      for (let i = 0; i < s.stage.platforms.length; i++) {
        const pl = platformAt(s.stage, i, s.frame);
        if (Math.abs(it.x - pl.x) <= pl.w / 2 && prevY <= pl.y && it.y >= pl.y) {
          it.y = pl.y;
          it.landed = true;
        }
      }
      if (it.y > s.stage.blast.bottom) return false;
    }
    for (const f of s.fighters) {
      if (!alive(f) || f.action === 'hitstun' || f.action === 'grabbed' || statsOf(f).walk === 0) continue;
      if (Math.abs(f.x - it.x) > 56 || it.y - f.y > 40 || f.y - it.y > 200) continue;
      if (it.kind === 'smoothie') {
        const amount = Math.min(30, f.percent);
        f.percent -= amount;
        ev.push({ type: 'heal', id: f.id, amount });
      } else {
        if (f.held) continue;
        f.held = it.kind;
        f.heldUses = it.kind === 'peeler' ? 6 : 1;
      }
      ev.push({ type: 'pickup', id: f.id, kind: it.kind });
      return false;
    }
    return true;
  });
}

function checkBlastZones(s: SimState, ev: SimEvent[]) {
  const b = s.stage.blast;
  for (const f of s.fighters) {
    if (!alive(f)) continue;
    if (f.x < b.left || f.x > b.right || f.y < b.top || f.y > b.bottom) {
      const by = s.frame - f.lastHitFrame < 600 ? f.lastAttacker : -1;
      if (by >= 0 && s.fighters[by]) s.fighters[by].kos++;
      f.falls++;
      ev.push({ type: 'ko', x: f.x, y: f.y, victim: f.id, by, bySuper: f.lastHitSuper && s.frame - f.lastHitFrame < 240 });
      if (f.holding >= 0 && s.fighters[f.holding]) setAction(s.fighters[f.holding], 'idle');
      f.holding = -1;
      f.grabbedBy = -1;
      f.ledge = -1;
      f.lx = f.ly = f.vx = f.vy = 0;
      f.held = null;
      if (s.cfg.stocks > 0) f.stocks--;
      f.action = s.cfg.stocks > 0 && f.stocks <= 0 ? 'out' : 'dead';
      f.respawn = RESPAWN_FRAMES;
    }
  }
}

function respawn(s: SimState, f: Fighter, ev: SimEvent[]) {
  const sp = s.stage.spawns[f.id % s.stage.spawns.length];
  f.x = sp.x;
  f.y = sp.y - 460;
  f.vx = f.vy = f.lx = f.ly = 0;
  f.percent = 0;
  f.cracked = false;
  f.grounded = false;
  f.ground = -1;
  f.jumps = statsOf(f).jumps;
  f.invuln = 120;
  f.action = 'air';
  f.frame = 0;
  f.move = null;
  f.helpless = false;
  f.usedRecovery = false;
  f.usedAirDodge = false;
  f.shield = SHIELD_MAX;
  f.ledge = -1;
  ev.push({ type: 'respawn', id: f.id });
}

function checkGameOver(s: SimState, ev: SimEvent[]) {
  if (s.cfg.training || s.fighters.length < 2) return;
  if (s.cfg.timeLimit > 0 && --s.timeLeft <= 0) {
    const ranked = [...s.fighters].sort((a, b) => b.stocks - a.stocks || a.percent - b.percent);
    const tie = ranked[1] && ranked[0].stocks === ranked[1].stocks && ranked[0].percent === ranked[1].percent;
    s.over = true;
    s.winner = tie ? -1 : ranked[0].id;
    ev.push({ type: 'game', winner: s.winner });
    return;
  }
  if (s.cfg.stocks <= 0) return;
  const left = s.fighters.filter((f) => f.action !== 'out');
  if (left.length <= 1) {
    s.over = true;
    s.winner = left[0]?.id ?? -1;
    ev.push({ type: 'game', winner: s.winner });
  }
}

// Cheap state fingerprint for LAN desync detection.
export function stateHash(s: SimState): number {
  let h = s.frame | 0;
  const mixIn = (n: number) => {
    h = Math.imul(h ^ (Math.round(n * 100) | 0), 0x9e3779b1);
    h ^= h >>> 15;
  };
  for (const f of s.fighters) {
    mixIn(f.x); mixIn(f.y); mixIn(f.percent); mixIn(f.stocks); mixIn(f.frame); mixIn(f.meter);
  }
  mixIn(s.projectiles.length);
  mixIn(s.rng);
  return h >>> 0;
}
