import { Container, Graphics, Text } from 'pixi.js';
import { statsOf, type Fighter } from '../sim/engine';
import { hipPivot, rot, standPose, type Pose } from './art';
import { FRUIT_ART } from './bodies';
import { drawFighter } from './fighterRig';
import { COMIC_FONT } from './fx';
import { PLAYER_COLORS, PLAYER_TAGS } from './palette';
import { fighterPose, strikingLimb } from './pose';
import { INK, burstPoints, type V } from './rig';

// One fighter on screen: the cutout rig plus shield bubble, dizzy stars, held item
// and the player tag. Everything is cosmetic and derived from the sim state.

export class FighterView {
  readonly root = new Container(); // world space
  private rig = new Container(); // rotates / squashes / flips
  private body = new Graphics();
  private item = new Graphics();
  private trailG = new Graphics(); // speed-line smears behind fast strikes
  private trails: { a: V; b: V; life: number; w: number }[] = [];
  private last: Record<'hF' | 'hB' | 'fF' | 'fB', V> | null = null;
  private extras = new Graphics(); // shield, stars (world space, unflipped)
  private tag: Text;
  private spin = 0;
  private flash = 0;
  private land = 0;

  constructor(readonly f: Fighter, cpu: boolean) {
    this.rig.addChild(this.trailG, this.body, this.item);
    this.rig.pivot.set(0, -110);
    const color = PLAYER_COLORS[f.id % PLAYER_COLORS.length];
    this.tag = new Text({
      text: cpu ? 'CPU' : PLAYER_TAGS[f.id] ?? `P${f.id + 1}`,
      style: { fontFamily: COMIC_FONT, fontSize: 26, fill: color, stroke: { color: INK, width: 6, join: 'round' } },
    });
    this.tag.anchor.set(0.5, 1);
    this.root.addChild(this.rig, this.extras, this.tag);
  }

  onHit() {
    this.flash = 0.9;
  }

  onLand() {
    this.land = 7;
  }

  update(f: Fighter, t: number) {
    const visible = f.action !== 'dead' && f.action !== 'out';
    this.root.visible = visible;
    if (!visible) {
      this.spin = 0;
      return;
    }
    const st = statsOf(f);
    const art = FRUIT_ART[f.kind];
    const p = fighterPose(f, t);
    if (this.land > 0) {
      p.squash *= 1 - 0.18 * (this.land / 7);
      this.land--;
    }
    p.flash = Math.max(p.flash, this.flash);
    this.flash = Math.max(0, this.flash - 0.15);

    // Smash-style tumble: spin with the launch, then settle upright.
    if (f.action === 'hitstun' && f.tumble && !f.grounded) {
      this.spin += Math.hypot(f.lx, f.ly) * 0.03 * Math.sign(f.lx || 1) * f.facing;
    } else {
      const target = Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2;
      this.spin += (target - this.spin) * 0.25;
    }
    p.spin += this.spin;

    drawFighter(this.body, art, p, { percent: f.percent, t });
    this.drawItem(f, p, art.arms);
    this.drawTrails(f, p, art.arms);
    this.drawCharge(f, p, t);

    const sq = p.squash;
    const shake = p.shake ? (Math.random() - 0.5) * 2 * p.shake : 0;
    const jitter = f.hitstop > 0 && f.action === 'hitstun' ? (f.hitstop % 2 === 0 ? 5 : -5) : 0;
    this.rig.scale.set((f.facing * st.size) / Math.sqrt(sq), sq * st.size);
    this.rig.rotation = p.spin * f.facing;
    this.rig.position.set(shake + jitter, -110 * sq * st.size);
    this.root.position.set(f.x, f.y);
    const dodging = f.action === 'dodge' && f.frame >= 3 && f.frame < 20;
    this.rig.alpha = (f.invuln > 0 && Math.floor(t / 4) % 2 === 0) || dodging ? 0.45 : 1;

    this.tag.position.set(0, -215 * st.size - 6);
    this.drawExtras(f, t, st.size);
  }

  // Limbs that jump far in one frame leave a tapered comic smear, which is what sells
  // jabs and kicks as fast.
  private drawTrails(f: Fighter, p: Pose, arms: boolean) {
    const hip = hipPivot(p);
    const now = { hF: rot(p.handF, hip, p.lean), hB: rot(p.handB, hip, p.lean), fF: p.footF, fB: p.footB };
    if (this.last && f.action === 'attack') {
      for (const k of Object.keys(now) as (keyof typeof now)[]) {
        if (!arms && k.startsWith('h')) continue;
        const a = this.last[k], b = now[k];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d > 28) this.trails.push({ a, b, life: 6, w: k.startsWith('h') ? 13 * (k === 'hF' ? p.gloveF : p.gloveB) : 11 });
      }
    }
    this.last = now;
    const g = this.trailG;
    g.clear();
    this.trails = this.trails.filter((tr) => {
      const k = tr.life / 6;
      const dx = tr.b.x - tr.a.x, dy = tr.b.y - tr.a.y;
      const l = Math.hypot(dx, dy) || 1;
      const nx = -dy / l, ny = dx / l;
      const w = tr.w * k;
      g.poly([tr.a.x, tr.a.y, tr.b.x + nx * w, tr.b.y + ny * w, tr.b.x - nx * w, tr.b.y - ny * w])
        .fill({ color: 0xffffff, alpha: 0.85 * k }).stroke({ width: 3, color: INK, alpha: k });
      for (const off of [-0.6, 0.6]) {
        g.moveTo(tr.a.x + nx * w * off * 2, tr.a.y + ny * w * off * 2).lineTo(tr.b.x + nx * w * off * 2.2, tr.b.y + ny * w * off * 2.2)
          .stroke({ width: 2.5, color: INK, alpha: 0.6 * k, cap: 'round' });
      }
      return --tr.life > 0;
    });
  }

  // Charging: a crackling burst grows around the cocked fist or foot.
  private drawCharge(f: Fighter, p: Pose, t: number) {
    if (f.action !== 'attack' || f.charge <= 0) return;
    const limb = strikingLimb(f);
    if (!limb) return;
    const pos = limb.startsWith('hand') ? rot(p[limb], hipPivot(p), p.lean) : p[limb];
    const c = Math.min(1, f.charge / 50);
    const g = this.item;
    const r = 26 + c * 34 + Math.sin(t * 0.8) * 4;
    const burst = burstPoints(12, r, r * 0.55, 0.45, 7 + (t % 5));
    g.poly(burst.map((n, k) => n + (k % 2 ? pos.y : pos.x))).fill({ color: t % 4 < 2 ? 0xffe600 : 0xffffff, alpha: 0.55 + c * 0.3 })
      .stroke({ width: 3, color: INK, alpha: 0.8 });
    for (let i = 0; i < 4; i++) {
      // sparks sucked inward
      const a = t * 0.3 + (i * Math.PI) / 2;
      const d = r * 1.9 * (1 - ((t * 0.08 + i * 0.25) % 1));
      g.moveTo(pos.x + Math.cos(a) * d, pos.y + Math.sin(a) * d).lineTo(pos.x + Math.cos(a) * (d + 14), pos.y + Math.sin(a) * (d + 14))
        .stroke({ width: 4, color: 0xffe600, cap: 'round' });
    }
  }

  private drawItem(f: Fighter, p: Pose, arms: boolean) {
    const g = this.item;
    g.clear();
    if (!f.held || !arms) return;
    const h = rot(p.handF, hipPivot(p), p.lean);
    if (f.held === 'peeler') {
      g.roundRect(h.x - 4, h.y - 52, 10, 44, 4).fill(0xcfd6dd).stroke({ width: 3, color: INK });
      g.roundRect(h.x - 6, h.y - 12, 14, 22, 5).fill(0x2f9e44).stroke({ width: 3, color: INK });
    } else if (f.held === 'salt') {
      g.roundRect(h.x - 10, h.y - 34, 20, 28, 6).fill(0xffffff).stroke({ width: 3, color: INK });
      g.roundRect(h.x - 10, h.y - 40, 20, 9, 3).fill(0xb8c2cc).stroke({ width: 3, color: INK });
    }
  }

  private drawExtras(f: Fighter, t: number, size: number) {
    const g = this.extras;
    g.clear();
    const color = PLAYER_COLORS[f.id % PLAYER_COLORS.length];
    const cy = -108 * size;
    if (f.action === 'shield') {
      const r = (40 + 50 * Math.sqrt(Math.max(0, f.shield) / 50)) * size;
      g.circle(0, cy, r).fill({ color, alpha: 0.14 }).stroke({ width: 4, color, alpha: 0.7 });
      if (f.parry > 0) g.circle(0, cy, r + 8).stroke({ width: 6, color: 0xffffff, alpha: 0.9 });
      g.circle(-r * 0.35, cy - r * 0.4, r * 0.18).fill({ color: 0xffffff, alpha: 0.6 });
    }
    if (f.action === 'dizzy') {
      for (let i = 0; i < 3; i++) {
        const a = t * 0.12 + (i * Math.PI * 2) / 3;
        const x = Math.cos(a) * 44 * size;
        const y = -205 * size + Math.sin(a) * 12;
        const pts = burstPoints(5, 12, 5, 0, 3);
        g.poly(pts.map((n, k) => n + (k % 2 ? y : x))).fill(0xffe600).stroke({ width: 3, color: INK });
      }
    }
    if (f.meter >= 100) {
      // super ready: crackling aura ring
      const r = 96 * size + Math.sin(t * 0.4) * 6;
      g.circle(0, cy, r).stroke({ width: 4, color: 0xffe600, alpha: 0.5 + Math.sin(t * 0.3) * 0.3 });
    }
  }
}

// Static full-body portrait for menus and cut-ins.
export function drawPortrait(g: Graphics, kind: Fighter['kind'], t: number, mood: 'idle' | 'win' | 'shout' = 'idle') {
  const p = standPose();
  if (mood === 'win') Object.assign(p, { handF: { x: 30, y: -220 }, gloveF: 1.4, mouth: 'grin', anger: 0.2, squash: 1.04 });
  if (mood === 'shout') Object.assign(p, { handF: { x: 100, y: -120 }, gloveF: 1.8, lean: 0.2, mouth: 'shout', anger: 1 });
  p.squash += Math.sin(t * 0.09) * 0.02;
  drawFighter(g, FRUIT_ART[kind], p, { percent: 0, t });
}
