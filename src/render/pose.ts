import type { Fighter } from '../sim/engine';
import { getMove } from '../sim/engine';
import type { MoveData } from '../sim/moves';
import { GUARD_B, GUARD_F, crouchPose, hipPivot, rot, standPose, type Pose } from './art';
import { clamp01, easeOut, lerp, lerpV, v, type V } from './rig';

// Turns sim state into a pose for any fruit. Each move animation is two keyframes on
// top of a stance: a windup (reached by the end of startup, or held while charging)
// and a strike (held through the active frames, optionally drifting to strikeEnd).
// For normals the striking limbs are placed on the move's hitbox, so what you see is
// what hits.

type Limb = 'handF' | 'handB' | 'footF' | 'footB';
interface LimbTarget { limb: Limb; dx?: number; dy?: number; mirror?: boolean }
interface Anim {
  stance: 'stand' | 'crouch' | 'air' | 'auto';
  windup: Partial<Pose>;
  strike: Partial<Pose>;
  strikeEnd?: Partial<Pose>;
  spinTo?: number; // recovery finishes the rotation here instead of unwinding
  limbs?: LimbTarget[];
}

const FLIP = -Math.PI * 2;

const ANIMS: Record<string, Anim> = {
  // ground punches
  // jab combo: front-hand stab, back-hand cross, two-fisted flurry, rising finisher
  jab: {
    stance: 'stand',
    windup: { handF: v(30, -106), lean: -0.04, mouth: 'grit' },
    strike: { handB: v(24, -132), gloveF: 1.45, lean: 0.12, bend: 5, mouth: 'shout' },
    limbs: [{ limb: 'handF' }],
  },
  jab2: {
    stance: 'stand',
    windup: { handF: v(30, -118), handB: v(6, -128), lean: -0.06, mouth: 'grit' },
    strike: { handF: v(22, -126), gloveB: 1.6, lean: 0.26, bend: 10, footF: v(30, 0), footB: v(-24, 0), mouth: 'shout', anger: 1 },
    limbs: [{ limb: 'handB' }],
  },
  flurry: {
    stance: 'stand',
    windup: { handF: v(40, -110), handB: v(30, -130), mouth: 'grit', anger: 1 },
    strike: { lean: 0.18, bend: 8, footF: v(32, 0), footB: v(-26, 0), mouth: 'shout', anger: 1 },
  },
  jabfinish: {
    stance: 'stand',
    windup: { handB: v(-10, -80), squash: 0.9, lean: 0.1, mouth: 'grit', anger: 1 },
    strike: { handF: v(20, -130), gloveB: 1.9, squash: 1.08, lean: -0.05, mouth: 'shout', anger: 1, look: v(1, -0.6) },
    limbs: [{ limb: 'handB' }],
  },
  // power cross: cock the back fist way back behind you, front glove up as a shield,
  // then whip the back hand through
  haymaker: {
    stance: 'stand',
    windup: { lean: -0.28, bend: -12, squash: 0.93, handB: v(-64, -122), gloveB: 1.5, handF: v(54, -130), footF: v(32, 0), footB: v(-28, 0), mouth: 'grit', anger: 1 },
    strike: { lean: 0.34, bend: 16, handF: v(18, -138), gloveB: 2.2, footF: v(40, 0), footB: v(-32, 0), mouth: 'shout', anger: 1 },
    limbs: [{ limb: 'handB' }],
  },
  uppercut: {
    stance: 'auto',
    windup: { squash: 0.84, handF: v(34, -40), lean: 0.12, mouth: 'grit' },
    strike: { squash: 1.12, gloveF: 1.7, lean: -0.1, footF: v(18, -8), mouth: 'shout', look: v(0.5, -1) },
    limbs: [{ limb: 'handF' }],
  },
  lowjab: {
    stance: 'crouch',
    windup: { handF: v(18, -78) },
    strike: { gloveF: 1.4, lean: 0.22, mouth: 'shout', look: v(1, 0.6) },
    limbs: [{ limb: 'handF' }],
  },
  // ground kicks
  frontkick: {
    stance: 'stand',
    windup: { footF: v(26, -52), lean: -0.08, handF: v(66, -92), mouth: 'grit' },
    strike: { lean: -0.16, handF: v(-30, -132), handB: v(-48, -108), mouth: 'shout' },
    limbs: [{ limb: 'footF', dx: -6 }],
  },
  roundhouse: {
    stance: 'stand',
    windup: { lean: -0.2, bend: -10, squash: 0.95, footF: v(-8, -56), handF: v(36, -136), handB: v(-30, -124), mouth: 'grit', anger: 1 },
    strike: { lean: -0.3, bend: -14, handF: v(-14, -140), handB: v(-50, -104), mouth: 'shout', anger: 1 },
    limbs: [{ limb: 'footF', dx: -6 }],
  },
  flipkick: {
    stance: 'stand',
    windup: { squash: 0.82, footF: v(20, -6), handF: v(30, -60), handB: v(-10, -64), mouth: 'grit' },
    strike: { spin: -0.6, squash: 1.1, handF: v(-40, -150), handB: v(-50, -120), mouth: 'shout', look: v(0, -1) },
    strikeEnd: { spin: -1.7 },
    spinTo: FLIP,
    limbs: [{ limb: 'footF' }],
  },
  lowkick: {
    stance: 'crouch',
    windup: { footF: v(10, -26), lean: 0.02, mouth: 'grit' },
    strike: { lean: -0.12, handF: v(-6, -116), handB: v(-30, -104), mouth: 'shout', look: v(1, 0.6) },
    limbs: [{ limb: 'footF', dx: -6 }],
  },
  sweep: {
    stance: 'crouch',
    windup: { bodyY: 38, footF: v(8, -6), footB: v(-6, -6), handF: v(30, -140), handB: v(-20, -140), mouth: 'grit' },
    strike: { bodyY: 44, lean: 0, bend: 0, handF: v(46, -150), handB: v(-40, -150), gloveF: 1.2, gloveB: 1.2, mouth: 'shout', look: v(0, 0.6) },
    limbs: [{ limb: 'footF', dx: -8 }, { limb: 'footB', dx: -8, mirror: true }],
  },
  // aerial punches
  airjab: {
    stance: 'air',
    windup: { handF: v(20, -120), mouth: 'grit' },
    strike: { gloveF: 1.5, lean: 0.15, mouth: 'shout' },
    limbs: [{ limb: 'handF' }],
  },
  airfist: {
    stance: 'air',
    windup: { handB: v(-46, -150), handF: v(50, -128), lean: -0.25, gloveB: 1.3, mouth: 'grit', anger: 1 },
    strike: { lean: 0.45, gloveB: 2, handF: v(20, -136), mouth: 'shout', look: v(1, 0.6) },
    limbs: [{ limb: 'handB' }],
  },
  hammer: {
    stance: 'air',
    windup: { handF: v(20, -200), handB: v(2, -206), lean: -0.15, squash: 1.08, mouth: 'grit' },
    strike: { lean: 0.25, squash: 0.95, gloveF: 1.6, gloveB: 1.6, mouth: 'shout', look: v(0.3, 1) },
    limbs: [{ limb: 'handF', dx: 10 }, { limb: 'handB', dx: -10, dy: -6 }],
  },
  backfist: {
    stance: 'air',
    windup: { handB: v(30, -126), lean: 0.12, mouth: 'grit' },
    strike: { lean: -0.2, gloveB: 1.6, mouth: 'shout', look: v(-1, 0) },
    limbs: [{ limb: 'handB' }],
  },
  // aerial kicks
  airkick: {
    stance: 'air',
    windup: { footF: v(20, -32) },
    strike: { lean: -0.15, handF: v(30, -150), handB: v(-30, -140), mouth: 'shout' },
    limbs: [{ limb: 'footF', dx: -6 }],
  },
  dropkick: {
    stance: 'air',
    windup: { footF: v(0, -40), footB: v(-10, -36), lean: -0.3, mouth: 'grit' },
    strike: { lean: -0.5, handF: v(-20, -160), handB: v(-40, -150), mouth: 'shout' },
    limbs: [{ limb: 'footF', dx: -6 }, { limb: 'footB', dx: -18, dy: 16 }],
  },
  bicycle: {
    stance: 'air',
    windup: { footF: v(10, -20), squash: 0.9 },
    strike: { spin: -0.5, handF: v(40, -90), handB: v(-30, -80), mouth: 'shout', look: v(0, -1) },
    strikeEnd: { spin: -1.4 },
    spinTo: FLIP,
    limbs: [{ limb: 'footF' }],
  },
  stomp: {
    stance: 'air',
    windup: { footF: v(14, -40), footB: v(-10, -40), squash: 1.05, handF: v(40, -170), handB: v(-30, -170), mouth: 'grit' },
    strike: { squash: 1.1, handF: v(50, -170), handB: v(-40, -170), mouth: 'shout', look: v(0, 1) },
    limbs: [{ limb: 'footF', dx: 6 }, { limb: 'footB', dx: -16 }],
  },
  backkick: {
    stance: 'air',
    windup: { footB: v(10, -60), lean: 0.15, mouth: 'grit', look: v(-1, 0) },
    strike: { lean: 0.3, handF: v(50, -130), handB: v(20, -140), mouth: 'shout', look: v(-1, 0.2) },
    limbs: [{ limb: 'footB', dx: 6 }],
  },
  // specials
  throw: {
    stance: 'auto',
    windup: { handB: v(-54, -142), handF: v(52, -124), lean: -0.22, gloveB: 1.2, mouth: 'grit', anger: 1 },
    strike: { handB: v(98, -120), handF: v(20, -134), lean: 0.25, gloveB: 1.4, mouth: 'shout' },
  },
  dash: {
    stance: 'auto',
    windup: { lean: -0.18, squash: 0.9, handF: v(30, -116), handB: v(-30, -120), mouth: 'grit', anger: 1 },
    strike: { lean: 0.55, bend: 12, handF: v(112, -112), handB: v(-44, -104), gloveF: 1.9, footF: v(34, -4), footB: v(-44, -8), mouth: 'shout', anger: 1 },
  },
  rise: {
    stance: 'auto',
    windup: { squash: 0.82, handF: v(24, -60), handB: v(-10, -62), mouth: 'grit' },
    strike: { squash: 1.14, handF: v(30, -222), handB: v(-22, -214), gloveF: 1.5, gloveB: 1.5, footF: v(10, -10), footB: v(-10, -4), mouth: 'shout', look: v(0, -1) },
    strikeEnd: { spin: FLIP * 2 },
    spinTo: FLIP * 2,
  },
  drop: {
    stance: 'crouch',
    windup: { handF: v(40, -70) },
    strike: { handF: v(64, -22), mouth: 'grin', look: v(1, 0.8) },
  },
  pound: {
    stance: 'auto',
    windup: { squash: 1.1, footF: v(16, -42), footB: v(-12, -42), handF: v(40, -182), handB: v(-30, -182), mouth: 'grit', anger: 1 },
    strike: { squash: 0.74, footF: v(42, 0), footB: v(-38, 0), handF: v(74, -60), handB: v(-62, -60), gloveF: 1.3, gloveB: 1.3, mouth: 'shout' },
  },
  counter: {
    stance: 'stand',
    windup: { handF: v(30, -150), handB: v(12, -152), lean: -0.12, mouth: 'grit', anger: 1 },
    strike: { handF: v(34, -150), handB: v(14, -150), lean: -0.12, mouth: 'grit', anger: 1, flash: 0.35 },
  },
  guardcounter: {
    stance: 'stand',
    windup: { handF: v(40, -140), handB: v(46, -118), lean: -0.05, squash: 0.94, mouth: 'grit', anger: 1 },
    strike: { gloveF: 1.6, gloveB: 1.6, lean: 0.32, bend: 12, footF: v(36, 0), footB: v(-30, 0), mouth: 'shout', anger: 1 },
    limbs: [{ limb: 'handF', dy: -14 }, { limb: 'handB', dx: -6, dy: 16 }],
  },
  grab: {
    stance: 'stand',
    windup: { handF: v(30, -112), handB: v(22, -112), mouth: 'grin' },
    strike: { lean: 0.12, gloveF: 1.2, gloveB: 1.2, handB: v(70, -94), mouth: 'grin' },
    limbs: [{ limb: 'handF' }],
  },
  fthrow: {
    stance: 'stand',
    windup: {},
    strike: { handF: v(104, -136), handB: v(80, -128), lean: 0.35, gloveF: 1.4, mouth: 'shout' },
  },
  bthrow: {
    stance: 'stand',
    windup: {},
    strike: { handF: v(-90, -150), handB: v(-80, -140), lean: -0.4, mouth: 'shout', look: v(-1, -0.3) },
  },
  uthrow: {
    stance: 'stand',
    windup: {},
    strike: { handF: v(30, -224), handB: v(10, -224), squash: 1.12, mouth: 'shout', look: v(0.3, -1) },
  },
  dthrow: {
    stance: 'stand',
    windup: {},
    strike: { handF: v(70, -24), handB: v(56, -24), squash: 0.82, lean: 0.4, mouth: 'shout', look: v(1, 1) },
  },
  // supers
  'super-rush': {
    stance: 'auto',
    windup: { lean: -0.3, squash: 0.88, handB: v(-60, -126), handF: v(50, -128), gloveB: 1.6, mouth: 'grit', anger: 1, flash: 0.4 },
    strike: { lean: 0.6, bend: 14, handB: v(126, -114), handF: v(30, -132), gloveB: 2.6, footF: v(40, -4), footB: v(-50, -8), mouth: 'shout', anger: 1 },
  },
  'super-barrage': {
    stance: 'auto',
    windup: { handF: v(24, -150), handB: v(-50, -144), lean: -0.25, mouth: 'grit', anger: 1, flash: 0.4 },
    strike: { handF: v(100, -124), handB: v(92, -108), lean: 0.2, gloveF: 1.6, gloveB: 1.6, mouth: 'shout', anger: 1, shake: 2 },
  },
  'super-wave': {
    stance: 'auto',
    windup: { handF: v(30, -230), handB: v(10, -230), squash: 1.12, mouth: 'grit', anger: 1, flash: 0.4 },
    strike: { handF: v(110, -40), handB: v(96, -30), squash: 0.84, lean: 0.4, gloveF: 1.8, gloveB: 1.8, mouth: 'shout' },
  },
};

export function mix(a: Pose, b: Partial<Pose>, k: number): Pose {
  const out = { ...a } as Record<string, unknown>;
  for (const [key, bv] of Object.entries(b)) {
    const av = (a as unknown as Record<string, unknown>)[key];
    if (typeof bv === 'number') out[key] = lerp(av as number, bv, k);
    else if (bv && typeof bv === 'object') out[key] = lerpV(av as V, bv as V, k);
    else if (k >= 0.5) out[key] = bv;
  }
  return out as unknown as Pose;
}

// Inverse of the view + lean transform: the rig-space target that puts a limb on a
// point next to the feet. Hands bend with the lean, feet don't.
function toRig(p: Pose, x: number, y: number, isHand: boolean): V {
  const sq = p.squash;
  const q = rot(v(x, y + 110 * sq), v(0, 0), -p.spin);
  const local = v(q.x * Math.sqrt(sq), q.y / sq - 110);
  return isHand ? rot(local, hipPivot(p), -p.lean) : local;
}

function placeLimbs(p: Pose, m: MoveData, limbs: LimbTarget[] | undefined): Pose {
  if (!m.hitbox || !limbs) return p;
  for (const l of limbs) {
    const x = (m.hitbox.x + (l.dx ?? 0)) * (l.mirror ? -1 : 1);
    p[l.limb] = toRig(p, x, m.hitbox.y + (l.dy ?? 0), l.limb.startsWith('hand'));
  }
  return p;
}

export function airPose(f: Fighter): Pose {
  const p = standPose();
  if (f.vy < 0) Object.assign(p, { squash: 1.06, footF: v(22, -22), footB: v(-4, -12), handF: v(72, -170), handB: v(-36, -158), mouth: 'shout' });
  else Object.assign(p, { squash: 0.98, footF: v(20, -6), footB: v(-14, -2), handF: v(74, -98), handB: v(-38, -102), look: v(0.6, 0.8) });
  return p;
}

function stancePose(stance: Anim['stance'], f: Fighter, t: number): Pose {
  if (stance === 'auto') stance = f.grounded ? 'stand' : 'air';
  return stance === 'crouch' ? crouchPose(t) : stance === 'air' ? airPose(f) : standPose();
}

function attackPose(f: Fighter, t: number): Pose {
  const m = getMove(f.kind, f.move!);
  const an = ANIMS[m.anim] ?? ANIMS.jab;
  const base = stancePose(an.stance, f, t);
  const windup = mix(base, an.windup, 1);
  const strike = placeLimbs(mix(base, an.strike, 1), m, an.limbs);
  const strikeEnd = an.strikeEnd ? placeLimbs(mix(strike, an.strikeEnd, 1), m, an.limbs) : strike;
  const fr = f.frame;
  const activeEnd = m.startup + m.active;

  let p: Pose;
  if (fr < m.startup) {
    const charges = m.chargeFrame !== undefined && !m.holdInto;
    const cf = charges ? m.chargeFrame! : m.startup - 1;
    if (fr <= cf) p = mix(base, an.windup, easeOut(Math.min(1, (fr + 1) / (cf + 1))));
    else p = mix(windup, strike, (fr - cf) / (m.startup - cf));
    if (f.charge > 0) {
      const c = m.maxCharge ? f.charge / m.maxCharge : 0.3;
      p.flash = (Math.sin(t * 0.7) * 0.5 + 0.5) * (0.2 + c * 0.5);
      p.shake = 1 + c * 3;
    }
  } else if (fr < activeEnd) {
    p = mix(strike, strikeEnd, (fr - m.startup) / Math.max(1, m.active - 1));
    if (m.anim === 'flurry' && m.hitbox) {
      // rapid one-two: the fists swap every couple of frames, landing all over the hitbox
      const k = Math.floor((fr - m.startup) / 2);
      const out = (dy: number) => toRig(p, m.hitbox!.x - 4 + (k % 3) * 6, m.hitbox!.y + dy, true);
      if (k % 2 === 0) {
        p.handF = out(-10 + (k % 3) * 8);
        p.handB = v(26, -132);
        p.gloveF = 1.4;
      } else {
        p.handB = out(-24 + (k % 3) * 8);
        p.handF = v(36, -110);
        p.gloveB = 1.4;
      }
      p.shake = 1.2;
    }
    if (m.counter) p.flash = 0.2 + (Math.sin(t * 0.9) * 0.5 + 0.5) * 0.3;
  } else {
    const e = easeOut(clamp01((fr - activeEnd) / m.recovery));
    p = mix(strikeEnd, base, e);
    if (an.spinTo !== undefined) p.spin = lerp(strikeEnd.spin, an.spinTo, e);
  }
  return p;
}

export function fighterPose(f: Fighter, t: number): Pose {
  const breathe = Math.sin(t * 0.09 + f.id);
  switch (f.action) {
    case 'idle': {
      const p = standPose();
      p.squash = 1 + breathe * 0.022;
      p.handF = v(GUARD_F.x, GUARD_F.y + breathe * 3);
      p.handB = v(GUARD_B.x, GUARD_B.y + breathe * 3);
      return p;
    }
    case 'walk': {
      const p = standPose();
      const ph = f.frame * 0.3;
      p.footF = v(12 + Math.sin(ph) * 17, -Math.max(0, Math.cos(ph)) * 12);
      p.footB = v(-8 - Math.sin(ph) * 17, -Math.max(0, -Math.cos(ph)) * 12);
      p.bodyY = Math.abs(Math.sin(ph)) * 5;
      p.lean = 0.12;
      p.handF = v(GUARD_F.x + Math.sin(ph) * 6, GUARD_F.y + p.bodyY);
      p.handB = v(GUARD_B.x - Math.sin(ph) * 6, GUARD_B.y + p.bodyY);
      p.mouth = 'grit';
      return p;
    }
    case 'crouch':
      return mix(standPose(), crouchPose(t), easeOut(Math.min(1, (f.frame + 1) / 5)));
    case 'land':
      return mix(crouchPose(t), standPose(), easeOut(f.frame / Math.max(1, f.landLag)));
    case 'air': {
      const p = airPose(f);
      if (f.helpless) Object.assign(p, { eyes: 'squint', mouth: 'o', handF: v(40, -170 + Math.sin(t * 0.5) * 10), handB: v(-30, -170 - Math.sin(t * 0.5) * 10) });
      if (f.doubleJumped && f.frame < 22) {
        Object.assign(p, { spin: easeOut(f.frame / 22) * Math.PI * 2, footF: v(14, -30), footB: v(-6, -24), handF: v(30, -70), handB: v(-6, -72), squash: 0.9 });
      }
      return p;
    }
    case 'attack':
      return attackPose(f, t);
    case 'shield': {
      // high guard: both gloves stacked in front of the face, peeking over them
      const flinch = f.shieldStun > 0 ? 0.08 : 0;
      return {
        ...standPose(), squash: 0.94, lean: 0.1 - flinch, bend: 6, handF: v(50, -150), handB: v(56, -122),
        gloveF: 1.2, gloveB: 1.2, footF: v(28, 0), footB: v(-22, 0), mouth: 'grit', anger: 1, look: v(1, -0.2),
        eyes: f.shieldStun > 0 ? 'squint' : 'open',
      };
    }
    case 'dodge': {
      const p = f.grounded ? crouchPose(t) : airPose(f);
      if (f.dodge === 'roll') p.spin = -(f.frame / 20) * Math.PI * 2 * Math.sign(f.dodgeX * f.facing || 1);
      else p.lean = -0.25;
      p.mouth = 'o';
      return p;
    }
    case 'dizzy':
      return { ...standPose(), lean: Math.sin(t * 0.15) * 0.25, eyes: 'x', mouth: 'o', handF: v(66, -66), handB: v(-30, -70) };
    case 'ledge': {
      // hanging by the gloves, feet kicking a little
      const k = Math.sin(t * 0.12) * 4;
      return {
        ...standPose(), lean: 0.05, squash: 1.04, handF: v(24, -206), handB: v(10, -202), gloveF: 1.1, gloveB: 1.1,
        footF: v(10 + k, 4), footB: v(-8 - k, 0), look: v(1, -0.6), mouth: f.frame < 10 ? 'shout' : 'grit', anger: 0.8,
      };
    }
    case 'holding':
      return { ...standPose(), lean: 0.1, handF: v(66, -106), handB: v(58, -96), gloveF: 1.2, gloveB: 1.2, mouth: 'grin', anger: 1 };
    case 'grabbed':
    case 'hitstun':
      return {
        ...standPose(), eyes: 'squint', mouth: 'ouch', lean: -0.3,
        handF: v(50, -160 + Math.sin(t * 0.8) * 10), handB: v(-40, -150 - Math.sin(t * 0.8) * 10),
        footF: v(24, f.grounded ? 0 : -14), footB: v(-20, f.grounded ? 0 : -6),
      };
    default:
      return standPose();
  }
}

// The limb that does the hitting for the current move (where the charge aura goes).
export function strikingLimb(f: Fighter): Limb | null {
  if (f.action !== 'attack' || !f.move) return null;
  const an = ANIMS[getMove(f.kind, f.move).anim];
  return an?.limbs?.[0]?.limb ?? null;
}
