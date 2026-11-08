// Move data shared by every fruit: the punch/kick normals, grab and throws.
// Per-fruit specials and supers live in roster.ts.

export interface Circle { x: number; y: number; r: number }

export type Button = 'punch' | 'kick' | 'special' | 'shield';

export type NormalId =
  // ground punches / kicks: neutral, forward, up, down
  | 'jab' | 'haymaker' | 'uppercut' | 'lowjab'
  // jab combo: jab -> cross -> rapid flurry -> finisher (keep tapping punch)
  | 'jab2' | 'flurry' | 'jabfinish'
  | 'frontkick' | 'roundhouse' | 'flipkick' | 'lowkick' | 'sweep'
  // aerial punches / kicks: neutral, forward, down, back (up-punch is the uppercut)
  | 'airjab' | 'airfist' | 'hammer' | 'backfist'
  | 'airkick' | 'dropkick' | 'bicycle' | 'stomp' | 'backkick';

export type SpecialSlot = 'nspecial' | 'sspecial' | 'uspecial' | 'dspecial';
export type ThrowId = 'fthrow' | 'bthrow' | 'uthrow' | 'dthrow';
export type MoveId = NormalId | SpecialSlot | ThrowId | 'grab' | 'itemthrow' | 'ledgeattack' | 'guardcounter' | 'super';

export interface ProjectileSpec {
  kind: string; // renderer key
  x: number; y: number; // spawn offset from the feet, facing right
  vx: number; vy: number;
  gravity: number;
  life: number;
  r: number;
  damage: number; angle: number; bkb: number; kbg: number;
  heavy?: boolean;
  trap?: boolean; // lands and waits until touched
  returnAfter?: number; // boomerangs back toward the thrower after this many frames
  pierce?: boolean; // keeps going after a hit
  hits?: number; // total hits before it vanishes (default 1)
  interval?: number; // multi-hit: can hit the same fighter again after this many frames
  stun?: number; // fixed hitstun instead of knockback-based
  max?: number; // max alive per owner of this kind (oldest removed)
  count?: number; // spawn several, `every` frames apart
  every?: number;
  spread?: number; // vertical speed spread across a volley
  rain?: { from: number; to: number; y: number }; // spawn across the stage from the sky
  target?: boolean; // spawn above the nearest opponent
}

export interface MoveData {
  button: Button;
  anim: string; // renderer animation key
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  angle: number; // degrees, 0 = forward, 90 = up, negative = spike, >90 = backward
  bkb: number; // base knockback
  kbg: number; // knockback growth
  hitbox: Circle | null; // relative to the feet, facing right, before size scaling
  name?: string;
  heavy?: boolean;
  aerial?: boolean; // landing cancels it (with landing lag)
  low?: boolean; // performed crouched: uses the crouch hurtbox
  both?: boolean; // hitbox is mirrored behind the fighter too
  chargeFrame?: number; // frame the move holds on while its button is held
  maxCharge?: number;
  holdInto?: MoveId; // holding the button past holdFrames turns it into this move
  holdFrames?: number;
  spawn?: ProjectileSpec & { frame: number };
  impulse?: { from: number; to: number; vx?: number; vy?: number }; // velocity set each frame in [from, to)
  multi?: number; // can re-hit the same fighter every N active frames
  armor?: number; // hits up to this damage don't interrupt it
  upRecovery?: boolean; // up-special: once per airtime, helpless afterwards
  counter?: { from: number; to: number };
  pound?: boolean; // in the air: plunge until landing, then the active frames start
  stun?: number;
  grab?: boolean;
  invuln?: [number, number];
  superMove?: boolean;
  chain?: { into: MoveId; from: number }; // pressing the same button from this frame on continues the combo
  then?: MoveId; // flows straight into this move when it ends
}

const P = 'punch', K = 'kick';

export const NORMALS: Record<NormalId, MoveData> = {
  jab: { button: P, anim: 'jab', startup: 2, active: 2, recovery: 10, damage: 2.5, angle: 50, bkb: 10, kbg: 25, hitbox: { x: 92, y: -104, r: 30 }, stun: 14, chain: { into: 'jab2', from: 3 } },
  jab2: { button: P, anim: 'jab2', startup: 3, active: 2, recovery: 12, damage: 3, angle: 45, bkb: 12, kbg: 25, hitbox: { x: 100, y: -112, r: 32 }, stun: 16, chain: { into: 'flurry', from: 4 } },
  flurry: { button: P, anim: 'flurry', startup: 2, active: 26, recovery: 0, damage: 1.2, angle: 80, bkb: 4, kbg: 4, hitbox: { x: 96, y: -108, r: 42 }, multi: 4, stun: 9, then: 'jabfinish' },
  jabfinish: { button: P, anim: 'jabfinish', startup: 3, active: 3, recovery: 18, damage: 4, angle: 42, bkb: 45, kbg: 70, hitbox: { x: 104, y: -120, r: 40 } },
  haymaker: { button: P, anim: 'haymaker', startup: 12, active: 4, recovery: 24, damage: 15, angle: 38, bkb: 32, kbg: 105, hitbox: { x: 120, y: -112, r: 40 }, heavy: true, chargeFrame: 8, maxCharge: 50 },
  uppercut: { button: P, anim: 'uppercut', startup: 5, active: 5, recovery: 18, damage: 9, angle: 86, bkb: 42, kbg: 95, hitbox: { x: 36, y: -196, r: 44 } },
  lowjab: { button: P, anim: 'lowjab', startup: 3, active: 3, recovery: 10, damage: 4, angle: 20, bkb: 16, kbg: 55, hitbox: { x: 88, y: -44, r: 28 }, low: true },

  frontkick: { button: K, anim: 'frontkick', startup: 5, active: 3, recovery: 14, damage: 6, angle: 35, bkb: 24, kbg: 70, hitbox: { x: 98, y: -70, r: 32 } },
  roundhouse: { button: K, anim: 'roundhouse', startup: 12, active: 4, recovery: 26, damage: 16, angle: 32, bkb: 30, kbg: 108, hitbox: { x: 120, y: -118, r: 40 }, heavy: true, chargeFrame: 8, maxCharge: 50 },
  flipkick: { button: K, anim: 'flipkick', startup: 6, active: 6, recovery: 20, damage: 10, angle: 80, bkb: 40, kbg: 92, hitbox: { x: 30, y: -204, r: 46 } },
  lowkick: { button: K, anim: 'lowkick', startup: 4, active: 3, recovery: 12, damage: 5, angle: 30, bkb: 22, kbg: 55, hitbox: { x: 96, y: -20, r: 28 }, low: true, chargeFrame: 2, holdInto: 'sweep', holdFrames: 10 },
  sweep: { button: K, anim: 'sweep', startup: 10, active: 5, recovery: 22, damage: 13, angle: 25, bkb: 34, kbg: 95, hitbox: { x: 102, y: -18, r: 34 }, heavy: true, low: true, both: true, chargeFrame: 6, maxCharge: 50 },

  airjab: { button: P, anim: 'airjab', startup: 4, active: 4, recovery: 12, damage: 5, angle: 45, bkb: 18, kbg: 70, hitbox: { x: 90, y: -118, r: 30 }, aerial: true },
  airfist: { button: P, anim: 'airfist', startup: 8, active: 4, recovery: 16, damage: 11, angle: 30, bkb: 30, kbg: 90, hitbox: { x: 104, y: -76, r: 36 }, aerial: true },
  hammer: { button: P, anim: 'hammer', startup: 10, active: 4, recovery: 20, damage: 12, angle: -75, bkb: 20, kbg: 80, hitbox: { x: 64, y: -34, r: 40 }, aerial: true },
  backfist: { button: P, anim: 'backfist', startup: 6, active: 4, recovery: 14, damage: 9, angle: 145, bkb: 28, kbg: 90, hitbox: { x: -96, y: -112, r: 34 }, aerial: true },

  airkick: { button: K, anim: 'airkick', startup: 3, active: 8, recovery: 14, damage: 8, angle: 40, bkb: 20, kbg: 80, hitbox: { x: 72, y: -48, r: 38 }, aerial: true },
  dropkick: { button: K, anim: 'dropkick', startup: 7, active: 5, recovery: 18, damage: 12, angle: 35, bkb: 30, kbg: 95, hitbox: { x: 100, y: -60, r: 38 }, aerial: true },
  bicycle: { button: K, anim: 'bicycle', startup: 5, active: 6, recovery: 16, damage: 9, angle: 85, bkb: 34, kbg: 85, hitbox: { x: 16, y: -204, r: 44 }, aerial: true },
  stomp: { button: K, anim: 'stomp', startup: 12, active: 5, recovery: 22, damage: 14, angle: -88, bkb: 24, kbg: 85, hitbox: { x: 10, y: 8, r: 40 }, aerial: true },
  backkick: { button: K, anim: 'backkick', startup: 7, active: 4, recovery: 18, damage: 13, angle: 150, bkb: 32, kbg: 100, hitbox: { x: -106, y: -70, r: 38 }, aerial: true },
};

export const GRAB_MOVES: Record<ThrowId | 'grab' | 'itemthrow' | 'ledgeattack' | 'guardcounter', MoveData> = {
  // out-of-guard two-handed shove: quick, little damage, pushes them away
  guardcounter: { button: K, anim: 'guardcounter', startup: 4, active: 3, recovery: 16, damage: 5, angle: 25, bkb: 55, kbg: 30, hitbox: { x: 82, y: -104, r: 42 } },
  ledgeattack: { button: K, anim: 'frontkick', startup: 8, active: 4, recovery: 14, damage: 8, angle: 30, bkb: 40, kbg: 50, hitbox: { x: 98, y: -70, r: 40 } },
  grab: { button: 'shield', anim: 'grab', startup: 6, active: 3, recovery: 22, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: { x: 66, y: -100, r: 36 }, grab: true },
  fthrow: { button: P, anim: 'fthrow', startup: 0, active: 1, recovery: 16, damage: 9, angle: 40, bkb: 55, kbg: 70, hitbox: null },
  bthrow: { button: P, anim: 'bthrow', startup: 0, active: 1, recovery: 18, damage: 10, angle: 140, bkb: 60, kbg: 75, hitbox: null },
  uthrow: { button: P, anim: 'uthrow', startup: 0, active: 1, recovery: 16, damage: 8, angle: 90, bkb: 62, kbg: 65, hitbox: null },
  dthrow: { button: P, anim: 'dthrow', startup: 0, active: 1, recovery: 14, damage: 7, angle: 75, bkb: 40, kbg: 45, hitbox: null },
  itemthrow: {
    button: P, anim: 'throw', startup: 5, active: 1, recovery: 14, damage: 0, angle: 0, bkb: 0, kbg: 0, hitbox: null,
    spawn: { frame: 5, kind: 'salt', x: 60, y: -120, vx: 13, vy: -5, gravity: 0.35, life: 90, r: 22, damage: 11, angle: 45, bkb: 30, kbg: 85 },
  },
};

export const THROW_DAMAGE_PUMMEL = 1.5;

// Which normal a button press makes, from stance and stick direction. `fwd`/`back`
// are relative to facing; on the ground holding back turns you around first.
export function pickNormal(grounded: boolean, button: 'punch' | 'kick', up: boolean, down: boolean, fwd: boolean, back: boolean): NormalId {
  if (grounded) {
    if (button === 'punch') return up ? 'uppercut' : down ? 'lowjab' : fwd ? 'haymaker' : 'jab';
    return up ? 'flipkick' : down ? 'lowkick' : fwd ? 'roundhouse' : 'frontkick';
  }
  if (button === 'punch') return up ? 'uppercut' : down ? 'hammer' : back ? 'backfist' : fwd ? 'airfist' : 'airjab';
  return up ? 'bicycle' : down ? 'stomp' : back ? 'backkick' : fwd ? 'dropkick' : 'airkick';
}
