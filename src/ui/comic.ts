import { Container, Graphics, Text } from 'pixi.js';
import { H, W } from '../app';
import { COMIC_FONT, comicText } from '../render/fx';
import { INK, burstPoints } from '../render/rig';

// Shared comic-book UI pieces for the menu scenes.

export function menuBackdrop(c1 = 0xff7a1f, c2 = 0x7a1fd8): { root: Container; update(t: number): void } {
  const root = new Container();
  const tones = new Graphics();
  for (let i = 14; i >= 0; i--) {
    const k = i / 14;
    tones.circle(0, 0, 200 + k * 1500).fill(mixColor(c1, c2, Math.pow(k, 0.7)));
  }
  const rays = new Graphics();
  for (let i = 0; i < 32; i += 2) {
    const a0 = (i / 32) * Math.PI * 2, a1 = ((i + 1) / 32) * Math.PI * 2;
    rays.poly([0, 0, Math.cos(a0) * 2400, Math.sin(a0) * 2400, Math.cos(a1) * 2400, Math.sin(a1) * 2400]).fill({ color: 0xffffff, alpha: 0.12 });
  }
  root.addChild(tones, rays);
  root.position.set(W / 2, H / 2);
  return { root, update: (t) => { rays.rotation = t * 0.002; } };
}

export function mixColor(a: number, b: number, t: number) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export function title(text: string, size = 90, y = 70): Text {
  const t = comicText(text, size);
  t.position.set(W / 2, y);
  t.rotation = -0.03;
  return t;
}

export function smallText(text: string, size = 22, color = 0xffffff): Text {
  return new Text({ text, style: { fontFamily: COMIC_FONT, fontSize: size, fill: color, letterSpacing: 1.2, align: 'center', stroke: { color: INK, width: Math.max(4, size * 0.22), join: 'round' } } });
}

// Skewed comic panel.
export function panel(w: number, h: number, fill: number, skew = 14, g = new Graphics()): Graphics {
  g.poly([-w / 2 + skew, -h / 2 - 6, w / 2 + skew + 6, -h / 2 - 6, w / 2 - skew + 6, h / 2 + 6, -w / 2 - skew, h / 2 + 6]).fill(INK);
  g.poly([-w / 2 + skew, -h / 2, w / 2 + skew, -h / 2, w / 2 - skew, h / 2, -w / 2 - skew, h / 2]).fill(fill);
  return g;
}

// A vertical list of comic buttons; the selected one is bigger with a burst behind it.
export class MenuList {
  readonly root = new Container();
  sel = 0;
  private rows: { c: Container; label: Text; burst: Graphics }[] = [];

  constructor(private items: string[], x: number, y: number, private gap = 78, private colors = [0xffe600, 0xff3b3b]) {
    items.forEach((it, i) => {
      const c = new Container();
      const burst = new Graphics().poly(burstPoints(14, 40, 26, 0.3, i + 3)).fill(0xff3b3b).stroke({ width: 4, color: INK });
      burst.scale.set(3.4, 1.05);
      const label = comicText(it, 54, 0xffffff, INK);
      c.addChild(burst, label);
      c.position.set(x, y + i * gap);
      this.root.addChild(c);
      this.rows.push({ c, label, burst });
    });
  }

  setItems(items: string[]) {
    items.forEach((it, i) => { if (this.rows[i]) this.rows[i].label.text = it; });
  }

  move(d: number) {
    this.sel = (this.sel + d + this.items.length) % this.items.length;
  }

  update(t: number) {
    this.rows.forEach((r, i) => {
      const on = i === this.sel;
      r.burst.visible = on;
      r.burst.rotation = Math.sin(t * 0.05) * 0.03;
      r.label.style.fill = on ? this.colors[0] : 0xffffff;
      r.c.scale.set(on ? 1.08 + Math.sin(t * 0.15) * 0.02 : 0.86);
    });
  }
}
