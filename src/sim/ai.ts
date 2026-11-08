import { NO_INPUT, getMove, type Fighter, type InputFrame, type SimState } from './engine';
import { hash01 } from './math';
import { platformAt } from './stages';

// CPU players. A pure function of the sim state (randomness comes from hashing the
// frame), so every LAN peer computes the same CPU inputs without sending them.
// Level 1-9 shortens reaction time and raises aggression/defense.

export function cpuInput(s: SimState, id: number, level: number): InputFrame {
  const me = s.fighters[id];
  if (!me || me.action === 'dead' || me.action === 'out') return NO_INPUT;
  const inp: InputFrame = { ...NO_INPUT };
  const react = Math.max(3, 16 - level * 1.5) | 0;
  const tick = Math.floor(s.frame / react);
  const phase = s.frame % react;
  const r = hash01(tick, id * 31 + 7);
  const r2 = hash01(tick, id * 31 + 13);
  const tap = phase < 2; // buttons are pressed briefly so the sim sees an edge

  if (me.action === 'grabbed') {
    inp.punch = s.frame % 4 < 2;
    inp.left = s.frame % 8 < 4;
    inp.right = !inp.left;
    return inp;
  }

  if (me.action === 'ledge') {
    // hang a moment, then pick a getup option
    if (me.frame < 10 + ((hash01(id, Math.floor(s.frame / 60)) * 30) | 0)) return inp;
    const toward = me.facing > 0 ? 'right' : 'left';
    if (r < 0.4) inp[toward] = tap;
    else if (r < 0.6) inp.jump = tap;
    else if (r < 0.8) inp.punch = tap;
    else inp.shield = tap;
    return inp;
  }

  const main = platformAt(s.stage, 0, s.frame);
  const edgeL = main.x - main.w / 2, edgeR = main.x + main.w / 2;

  // recover toward the stage
  const offstage = me.x < edgeL - 10 || me.x > edgeR + 10 || me.y > 30;
  if (offstage && !me.grounded) {
    const toward = me.x < main.x ? 1 : -1;
    if (toward > 0) inp.right = true;
    else inp.left = true;
    const below = me.y > main.y - 40;
    if (below && me.vy > -2) {
      if (me.jumps > 0) inp.jump = s.frame % 6 < 3;
      else if (!me.usedRecovery && !me.helpless) {
        inp.up = true;
        inp.special = s.frame % 6 < 3;
      }
    }
    return inp;
  }

  const target = nearestOpponent(s, me);
  if (!target) return inp;
  const dx = target.x - me.x;
  const dy = target.y - me.y;
  const adx = Math.abs(dx);
  const toward = dx > 0 ? 1 : -1;

  if (me.action === 'holding') {
    // throw toward the closer blast zone
    const outward = me.x > main.x ? 1 : -1;
    if (phase === 0) {
      if (target.percent > 90 && r < 0.5) inp.up = true;
      else if (outward === me.facing) inp[me.facing > 0 ? 'right' : 'left'] = true;
      else inp[me.facing > 0 ? 'left' : 'right'] = true;
    }
    return inp;
  }

  // defend: shield or dodge an incoming active attack
  const threat = target.action === 'attack' && target.move && adx < 220 && Math.abs(dy) < 160;
  if (threat && me.grounded && r < 0.06 * level) {
    const m = getMove(target.kind, target.move!);
    if (target.frame < m.startup + m.active) {
      inp.shield = true;
      if (r2 < 0.3 && level >= 6) inp[toward > 0 ? 'left' : 'right'] = phase === 0; // roll away
      return inp;
    }
  }

  const wantAttack = r < 0.25 + level * 0.06;

  if (adx > 130 || Math.abs(dy) > 140) {
    // approach, jumping up to platforms when the target is above
    const nearEdge = me.grounded && ((toward < 0 && me.x < edgeL + 40) || (toward > 0 && me.x > edgeR - 40));
    if (!nearEdge || dy < -60) inp[toward > 0 ? 'right' : 'left'] = true;
    if (dy < -140 && me.grounded && r2 < 0.5) inp.jump = tap;
    if (dy < -140 && !me.grounded && me.vy > 0 && me.jumps > 0) inp.jump = tap;
    // zone with the projectile special at mid range
    if (adx > 260 && adx < 620 && Math.abs(dy) < 120 && wantAttack && r2 < 0.25 && me.grounded) {
      inp.left = inp.right = false;
      inp[toward > 0 ? 'right' : 'left'] = phase < 1;
      inp.special = tap;
    }
    if (dy > 120 && me.grounded && !s.stage.platforms[me.ground]?.solid) inp.down = s.frame % 6 < 2; // drop down
    return inp;
  }

  // in range: pick a move that fits where the target is
  if (!wantAttack) {
    if (r2 < 0.3) inp[toward > 0 ? 'left' : 'right'] = true; // space out
    else if (r2 > 0.8 && me.grounded) inp.jump = tap; // hop up to a platform and play the space
    return inp;
  }
  const facingTarget = Math.sign(dx) === me.facing;
  if (!facingTarget && me.grounded) inp[toward > 0 ? 'right' : 'left'] = phase < 1;
  const k = r2;
  if (dy < -90) {
    inp.up = true;
    if (k < 0.5) inp.punch = tap;
    else inp.kick = tap;
  } else if (!me.grounded && dy > 40) {
    inp.down = true;
    inp[k < 0.5 ? 'punch' : 'kick'] = tap;
  } else if (target.action === 'shield' && level >= 4 && k < 0.5) {
    inp.shield = true;
    inp.punch = tap;
  } else if (k < 0.18 && target.percent > 80) {
    inp[toward > 0 ? 'right' : 'left'] = true;
    inp.kick = phase < Math.min(react, 8); // hold for a short charge
  } else if (k < 0.3 && me.meter >= 100) {
    inp.shield = true;
    inp.special = tap;
  } else if (k < 0.45) {
    inp.down = me.grounded;
    inp.kick = tap;
  } else if (k < 0.6 && !me.grounded) {
    inp.kick = tap;
  } else if (k < 0.72) {
    inp[toward > 0 ? 'right' : 'left'] = true;
    inp.special = tap;
  } else if (k < 0.85) {
    inp.punch = tap;
  } else {
    inp.kick = tap;
  }
  return inp;
}

function nearestOpponent(s: SimState, me: Fighter): Fighter | null {
  let best: Fighter | null = null;
  let bd = Infinity;
  for (const f of s.fighters) {
    if (f === me || f.action === 'dead' || f.action === 'out') continue;
    const d = Math.abs(f.x - me.x) + Math.abs(f.y - me.y) * 0.5;
    if (d < bd) {
      bd = d;
      best = f;
    }
  }
  return best;
}
