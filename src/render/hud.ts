import { Container, Graphics, Text } from 'pixi.js';
import type { Fighter, SimState } from '../sim/engine';
import { ROSTER } from '../sim/roster';
import { drawPortrait } from './fighterView';
import { COMIC_FONT, comicText } from './fx';
import { FRUIT_COLOR, PLAYER_COLORS, PLAYER_TAGS } from './palette';
import { INK } from './rig';

// Angled MvC-style nameplates with Smash-style percent, stocks and the juice meter.
class Plate {
  readonly root = new Container();
  private pct: Text;
  private stocks = new Graphics();
  private meter = new Graphics();
  private ready: Text;
  private portrait = new Graphics();
  private shown = -1;
  private pop = 0;

  constructor(private f: Fighter, name: string, x: number, y: number) {
    const color = PLAYER_COLORS[f.id % PLAYER_COLORS.length];
    const fruit = FRUIT_COLOR[f.kind];
    const g = new Graphics();
    g.poly([-128, -50, 138, -50, 118, 46, -148, 46]).fill(INK);
    g.poly([-120, -42, 128, -42, 110, 38, -138, 38]).fill(color);
    g.poly([-110, -42, 128, -42, 116, 14, -122, 14]).fill(fruit);
    g.poly([-110, -42, 128, -42, 125, -30, -112, -30]).fill({ color: 0xffffff, alpha: 0.35 });
    const mask = new Graphics().poly([-110, -42, 128, -42, 116, 14, -122, 14]).fill(0xffffff);
    this.portrait.scale.set(0.42 * ROSTER[f.kind].stats.size);
    this.portrait.position.set(-78, 52);
    this.portrait.mask = mask;
    const label = new Text({
      text: name,
      style: { fontFamily: COMIC_FONT, fontSize: 24, fill: 0xffffff, letterSpacing: 1.5, stroke: { color: INK, width: 5, join: 'round' } },
    });
    label.position.set(-118, -74);
    const tag = new Text({ text: PLAYER_TAGS[f.id] ?? '', style: { fontFamily: COMIC_FONT, fontSize: 22, fill: color, stroke: { color: INK, width: 5 } } });
    tag.anchor.set(1, 0);
    tag.position.set(128, -74);
    this.pct = comicText('0%', 64, 0xffffff, INK);
    this.pct.anchor.set(1, 0.5);
    this.pct.position.set(112, -10);
    this.ready = comicText('SUPER!', 22, 0xffe600, 0xe8202a);
    this.ready.position.set(-6, 38);
    this.root.addChild(g, this.portrait, mask, label, tag, this.pct, this.stocks, this.meter, this.ready);
    this.root.position.set(x, y);
  }

  update(f: Fighter, t: number) {
    drawPortrait(this.portrait, f.kind, t, f.action === 'hitstun' ? 'shout' : 'idle');
    const p = Math.floor(f.percent);
    if (p !== this.shown) {
      if (p > this.shown) this.pop = 8;
      this.shown = p;
      this.pct.text = `${p}%`;
      const k = Math.min(1, p / 150);
      const g = Math.round(255 * (1 - k * 0.85));
      const b = Math.round(255 * Math.max(0, 1 - k * 2.2));
      this.pct.style.fill = (255 << 16) | (g << 8) | b;
    }
    this.pct.scale.set(1 + this.pop * 0.04);
    this.pct.x = 112 + (this.pop > 0 ? (this.pop % 2 ? 5 : -5) : 0);
    if (this.pop > 0) this.pop--;

    this.stocks.clear();
    const fruit = FRUIT_COLOR[f.kind];
    const n = Math.max(0, f.stocks);
    for (let i = 0; i < Math.min(n, 6); i++) this.stocks.circle(-110 + i * 20, 26, 7).fill(fruit).stroke({ width: 3, color: INK });
    if (n > 6) this.stocks.circle(-110 + 6 * 20, 26, 3).fill(INK);

    this.meter.clear();
    const w = 150;
    this.meter.poly([-128, 50, -128 + w + 8, 50, -128 + w, 62, -136, 62]).fill(INK);
    const fill = (f.meter / 100) * (w - 4);
    if (fill > 0) this.meter.poly([-126, 52, -126 + fill + 4, 52, -126 + fill, 60, -130, 60]).fill(f.meter >= 100 ? (Math.floor(t / 6) % 2 ? 0xffe600 : 0xff7a1f) : 0x3ec3ff);
    this.ready.visible = f.meter >= 100 && Math.floor(t / 10) % 2 === 0;
    this.ready.x = 70;
    this.ready.y = 56;
    this.root.alpha = f.action === 'out' ? 0.4 : f.action === 'dead' ? 0.7 : 1;
  }
}

export class Hud {
  readonly root = new Container();
  private plates: Plate[];
  private timer: Text;

  constructor(private s: SimState, names: string[]) {
    const n = s.fighters.length;
    const spacing = Math.min(300, 1180 / n);
    this.plates = s.fighters.map((f, i) => new Plate(f, names[i], 640 + (i - (n - 1) / 2) * spacing, 652));
    this.plates.forEach((p) => p.root.scale.set(0.86));
    this.timer = comicText('', 46, 0xffffff, INK);
    this.timer.position.set(640, 40);
    this.timer.visible = s.cfg.timeLimit > 0;
    this.root.addChild(...this.plates.map((p) => p.root), this.timer);
  }

  update(t: number) {
    this.s.fighters.forEach((f, i) => this.plates[i].update(f, t));
    if (this.timer.visible) {
      const sec = Math.max(0, Math.ceil(this.s.timeLeft / 60));
      this.timer.text = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
      this.timer.style.fill = sec <= 10 ? 0xff3b3b : 0xffffff;
    }
  }
}
