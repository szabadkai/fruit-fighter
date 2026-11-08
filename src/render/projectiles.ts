import { Container, Graphics } from 'pixi.js';
import type { Item, Projectile } from '../sim/engine';
import { INK, burstPoints } from './rig';

// Projectiles and items, keyed by sim id. Each is drawn once and then moved/rotated.

function drawProjectile(g: Graphics, p: Projectile) {
  const r = p.r;
  switch (p.kind) {
    case 'peel':
    case 'peeltrap': {
      for (const a of [-0.9, 0, 0.9]) {
        const x = Math.sin(a) * r * 0.9, y = -Math.cos(a) * r * 0.9;
        g.poly([0, 0, x - 8, y + 4, x, y - 6, x + 8, y + 4]).fill(0xffd41f).stroke({ width: 3, color: INK, join: 'round' });
      }
      g.circle(0, 0, r * 0.35).fill(0xfff2a8).stroke({ width: 3, color: INK });
      g.rect(-3, -r * 0.6, 6, 8).fill(0x5a3510);
      break;
    }
    case 'seed':
      g.ellipse(0, 0, r, r * 0.65).fill(0x1a1410).stroke({ width: 2.5, color: 0xffffff, alpha: 0.6 });
      g.circle(-r * 0.3, -r * 0.2, r * 0.22).fill(0xffffff);
      break;
    case 'spike':
      g.poly([r * 1.6, 0, -r, -r * 0.6, -r * 0.5, 0, -r, r * 0.6]).fill(0x5fbf3a).stroke({ width: 3, color: INK, join: 'round' });
      break;
    case 'acid':
      g.ellipse(-r * 0.8, 0, r * 1.6, r * 0.55).fill({ color: 0xeaff5c, alpha: 0.5 });
      g.circle(0, 0, r).fill(0xf6ff3a).stroke({ width: 3, color: INK });
      g.circle(r * 0.3, -r * 0.35, r * 0.25).fill(0xffffff);
      break;
    case 'cloud':
      for (const [x, y, s] of [[-30, 8, 0.55], [0, -14, 0.7], [30, 6, 0.55], [0, 20, 0.5]] as const) {
        g.circle(x, y, r * s).fill({ color: 0xc9f25a, alpha: 0.55 }).stroke({ width: 3, color: 0x5e7a12, alpha: 0.8 });
      }
      g.circle(-12, -8, 5).fill(INK);
      g.circle(10, -8, 5).fill(INK);
      g.moveTo(-10, 8).quadraticCurveTo(0, 2, 10, 8).stroke({ width: 3, color: INK });
      break;
    case 'coconut':
    case 'bigcoconut':
      g.circle(0, 0, r).fill(0x6e4220).stroke({ width: p.kind === 'bigcoconut' ? 7 : 4, color: INK });
      g.circle(-r * 0.3, -r * 0.4, r * 0.25).fill({ color: 0xa8743f, alpha: 0.8 });
      for (const [x, y] of [[-0.2, 0.1], [0.15, 0.1], [0, 0.35]]) g.circle(x * r, y * r, r * 0.09).fill(0x2a1608);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        g.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8).lineTo(Math.cos(a + 0.2) * r * 1.02, Math.sin(a + 0.2) * r * 1.02)
          .stroke({ width: 2, color: 0x3a2210 });
      }
      break;
    case 'shuriken':
      g.poly(burstPoints(4, r * 1.3, r * 0.45, 0, 1)).fill(0xff2f4f).stroke({ width: 3, color: INK, join: 'miter' });
      g.circle(0, 0, r * 0.3).fill(0xffe066).stroke({ width: 2, color: INK });
      break;
    case 'jam':
      g.ellipse(0, -6, r * 1.2, r * 0.45).fill(0xc8102e).stroke({ width: 3, color: INK });
      g.ellipse(-r * 0.3, -10, r * 0.35, r * 0.12).fill({ color: 0xffffff, alpha: 0.6 });
      break;
    case 'wave': {
      g.moveTo(-r * 1.2, r * 0.6).bezierCurveTo(-r, -r * 0.6, r * 0.2, -r * 1.3, r, -r * 0.4)
        .bezierCurveTo(r * 0.6, -r * 0.2, r * 0.4, r * 0.1, r * 1.1, r * 0.6).closePath()
        .fill(0x3ec3ff).stroke({ width: 6, color: INK, join: 'round' });
      g.moveTo(-r * 0.8, r * 0.3).bezierCurveTo(-r * 0.5, -r * 0.4, r * 0.1, -r * 0.8, r * 0.6, -r * 0.4)
        .stroke({ width: 8, color: 0xffffff, alpha: 0.8, cap: 'round' });
      for (const [x, y] of [[-0.3, 0.2], [0.2, -0.1], [0.5, 0.3]]) g.rect(x * r - 9, y * r - 9, 18, 18).fill(0xffd23f).stroke({ width: 3, color: INK });
      break;
    }
    case 'lemondrop':
      g.ellipse(0, 0, r * 0.75, r).fill(0xfff23a).stroke({ width: 4, color: INK });
      g.ellipse(-r * 0.25, -r * 0.35, r * 0.18, r * 0.3).fill(0xffffff);
      break;
    case 'salt':
      g.roundRect(-r * 0.5, -r * 0.7, r, r * 1.3, 6).fill(0xffffff).stroke({ width: 3, color: INK });
      g.roundRect(-r * 0.5, -r * 0.95, r, r * 0.35, 4).fill(0xb8c2cc).stroke({ width: 3, color: INK });
      break;
    default:
      g.circle(0, 0, r).fill(0xffffff).stroke({ width: 3, color: INK });
  }
}

const SPINS = new Set(['peel', 'shuriken', 'salt', 'coconut', 'bigcoconut']);

export class ProjectileLayer {
  readonly root = new Container();
  private views = new Map<number, Graphics>();

  update(list: Projectile[], t: number) {
    const seen = new Set<number>();
    for (const p of list) {
      seen.add(p.id);
      let g = this.views.get(p.id);
      if (!g) {
        g = new Graphics();
        drawProjectile(g, p);
        this.views.set(p.id, g);
        this.root.addChild(g);
      }
      g.position.set(p.x, p.y);
      if (SPINS.has(p.kind)) g.rotation += 0.35 * p.facing;
      else if (p.kind === 'cloud') g.scale.set(1 + Math.sin(t * 0.1) * 0.05);
      else if (p.kind === 'spike' || p.kind === 'acid') g.rotation = Math.atan2(p.vy, p.vx);
      else if (p.kind === 'wave') g.scale.x = p.facing;
      g.alpha = p.life < 30 && p.trap ? (Math.floor(t / 4) % 2 ? 0.4 : 1) : 1;
    }
    for (const [id, g] of this.views) {
      if (!seen.has(id)) {
        g.destroy();
        this.views.delete(id);
      }
    }
  }
}

function drawItem(g: Graphics, kind: Item['kind']) {
  if (kind === 'smoothie') {
    g.poly([-18, -50, 18, -50, 13, 0, -13, 0]).fill(0xff6fa8).stroke({ width: 4, color: INK, join: 'round' });
    g.rect(-18, -54, 36, 8).fill(0xffffff).stroke({ width: 3, color: INK });
    g.moveTo(6, -54).lineTo(14, -78).stroke({ width: 5, color: INK });
    g.moveTo(6, -54).lineTo(14, -78).stroke({ width: 2.5, color: 0x3ec3ff });
    g.ellipse(-6, -30, 4, 9).fill({ color: 0xffffff, alpha: 0.6 });
  } else if (kind === 'salt') {
    g.roundRect(-14, -44, 28, 44, 8).fill(0xffffff).stroke({ width: 4, color: INK });
    g.roundRect(-14, -52, 28, 12, 4).fill(0xb8c2cc).stroke({ width: 3, color: INK });
    for (const x of [-6, 0, 6]) g.circle(x, -47, 1.6).fill(INK);
  } else {
    g.roundRect(-6, -70, 12, 46, 4).fill(0xcfd6dd).stroke({ width: 3, color: INK });
    g.roundRect(-9, -26, 18, 26, 6).fill(0x2f9e44).stroke({ width: 3, color: INK });
  }
}

export class ItemLayer {
  readonly root = new Container();
  private views = new Map<number, Graphics>();

  update(list: Item[], t: number) {
    const seen = new Set<number>();
    for (const it of list) {
      seen.add(it.id);
      let g = this.views.get(it.id);
      if (!g) {
        g = new Graphics();
        drawItem(g, it.kind);
        this.views.set(it.id, g);
        this.root.addChild(g);
      }
      g.position.set(it.x, it.y - (it.landed ? Math.abs(Math.sin(t * 0.08)) * 8 : 0));
      g.alpha = it.life < 120 && Math.floor(t / 5) % 2 ? 0.4 : 1;
    }
    for (const [id, g] of this.views) {
      if (!seen.has(id)) {
        g.destroy();
        this.views.delete(id);
      }
    }
  }
}
