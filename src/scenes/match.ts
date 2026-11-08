import { Container, Graphics, Text } from 'pixi.js';
import { H, W, game, type Scene } from '../app';
import { sfxBlock, sfxHit, sfxJump, sfxKo, sfxPickup, sfxSuper, sfxSwing, announce } from '../audio';
import { music } from '../audio/music';
import { anyPress, keyDown } from '../input/devices';
import { createMatch, getMove, hurtbox, packInput, statsOf, step, type InputFrame, type MatchConfig, type SimEvent, type SimState } from '../sim/engine';
import { ROSTER } from '../sim/roster';
import { STAGES, platformAt } from '../sim/stages';
import type { StageView } from '../render/art';
import { FighterView, drawPortrait } from '../render/fighterView';
import { COMIC_FONT, Fx, comicText } from '../render/fx';
import { Hud } from '../render/hud';
import { FRUIT_COLOR, JUICE, PLAYER_COLORS } from '../render/palette';
import { ItemLayer, ProjectileLayer } from '../render/projectiles';
import { INK } from '../render/rig';
import { STAGE_ART } from '../render/stages';

// A match on screen. Where the inputs come from is the driver's business: local
// devices + CPUs, LAN lockstep, or a replay. The scene only steps the sim and draws.

export interface Driver {
  // Inputs for the next sim frame, or null to wait (LAN: peers' inputs not here yet).
  next(s: SimState): InputFrame[] | null;
  status?(): string; // e.g. "WAITING FOR PLAYER 2…"
  canPause: boolean;
  dispose?(): void;
}

export interface MatchResult {
  cfg: MatchConfig;
  state: SimState;
  replay: number[][];
  names: string[];
}

export interface MatchOptions {
  names: string[];
  onEnd(result: MatchResult): void;
  onQuit(): void;
  training?: boolean;
  replay?: boolean;
}

const COUNTDOWN = 150;

export class MatchScene implements Scene {
  readonly root = new Container();
  readonly state: SimState;
  private stageView: StageView;
  private world = new Container();
  private shadows = new Graphics();
  private views: FighterView[];
  private projectiles = new ProjectileLayer();
  private items = new ItemLayer();
  private fxWorld = new Container();
  private fxScreen = new Container();
  private debug = new Graphics();
  private fx: Fx;
  private hud: Hud;
  private cutin = new Container();
  private overlay = new Container();
  private statusText: Text;
  private cam = { x: 0, y: -120, zoom: 0.8, shake: 0, kick: 0 };
  private impact: number[] = [];
  private t = 0;
  private countdown = COUNTDOWN;
  private endTimer = 0;
  private paused = false;
  private pauseSel = 0;
  private pauseText: Text;
  private recording: number[][] = [];
  private showHitboxes = false;
  private trainingText?: Text;
  private combo = { count: 0, damage: 0, victim: -1, last: 0 };

  constructor(readonly cfg: MatchConfig, private driver: Driver, private opts: MatchOptions) {
    this.state = createMatch(cfg);
    this.stageView = STAGE_ART[cfg.stage](STAGES[cfg.stage]);
    this.views = this.state.fighters.map((f, i) => new FighterView(f, !!cfg.players[i].cpu));
    this.fx = new Fx(this.fxWorld, this.fxScreen);
    this.hud = new Hud(this.state, opts.names);
    this.world.addChild(this.stageView.world, this.shadows, this.items.root, ...this.views.map((v) => v.root), this.projectiles.root, this.fxWorld);
    if (this.stageView.front) this.world.addChild(this.stageView.front);
    this.world.addChild(this.debug);
    this.statusText = comicText('', 34, 0xffffff, INK);
    this.statusText.position.set(W / 2, 120);
    this.pauseText = new Text({ text: '', style: { fontFamily: COMIC_FONT, fontSize: 54, fill: 0xffffff, align: 'center', stroke: { color: INK, width: 8 } } });
    this.pauseText.anchor.set(0.5);
    this.pauseText.position.set(W / 2, H / 2);
    this.overlay.addChild(new Graphics().rect(-W, -H, W * 3, H * 3).fill({ color: 0x000000, alpha: 0.55 }), this.pauseText);
    this.overlay.visible = false;
    this.root.addChild(this.stageView.backdrop, this.world, this.fxScreen, this.cutin, this.hud.root, this.statusText, this.overlay);
    if (opts.training) {
      this.trainingText = new Text({ text: '', style: { fontFamily: COMIC_FONT, fontSize: 20, fill: 0xffffff, lineHeight: 26, stroke: { color: INK, width: 5 } } });
      this.trainingText.position.set(20, 20);
      this.root.addChild(this.trainingText);
      this.countdown = 0;
      this.showHitboxes = true;
    }
    if (opts.replay) {
      const r = comicText('REPLAY', 40, 0xff3b3b, INK);
      r.position.set(W - 110, 40);
      this.root.addChild(r);
    }
    music.play('battle');
  }

  tick() {
    this.t++;
    const press = anyPress();
    if (this.paused) return this.pauseMenu(press);
    if (press.start && this.driver.canPause && !this.state.over) {
      this.paused = true;
      this.pauseSel = 0;
      return;
    }
    if (this.trainingText) this.trainingKeys();

    if (this.countdown > 0) {
      this.countdown--;
      if (this.countdown === 120) this.fx.banner('3', W / 2, H / 2 - 40, 200);
      if (this.countdown === 85) this.fx.banner('2', W / 2, H / 2 - 40, 200);
      if (this.countdown === 50) this.fx.banner('1', W / 2, H / 2 - 40, 200);
      if (this.countdown === 15) {
        this.fx.banner('FIGHT!', W / 2, H / 2 - 40, 200, 0xffe600, 0xe8202a);
        announce('Fight!');
      }
      this.fx.update();
      this.updateCamera();
      return;
    }

    if (this.state.over) {
      this.endTimer++;
      this.fx.update();
      if (this.endTimer === 150) {
        this.driver.dispose?.();
        this.opts.onEnd({ cfg: this.cfg, state: this.state, replay: this.recording, names: this.opts.names });
      }
      return;
    }

    this.animateCutin();
    const inputs = this.driver.next(this.state);
    this.statusText.text = this.driver.status?.() ?? '';
    if (!inputs) return;
    this.recording.push(inputs.map(packInput));
    const wasFrozen = this.state.freeze > 0;
    const events = step(this.state, inputs);
    for (const e of events) this.handle(e);
    if (wasFrozen && this.state.freeze === 0) {
      this.cutin.removeChildren().forEach((c) => c.destroy({ children: true }));
      this.cutinAnim = null;
    }

    for (const f of this.state.fighters) {
      const sp = Math.hypot(f.lx, f.ly);
      if (f.action === 'hitstun' && f.hitstop === 0 && sp > 8 && this.t % 2 === 0) this.fx.trail(f.x, f.y - 70 * statsOf(f).size, f.lx, f.ly);
    }
    if (this.combo.victim >= 0 && this.state.fighters[this.combo.victim]?.action !== 'hitstun') this.combo.count = 0;
    this.fx.update();
    this.updateCamera();
    game.comic.impact = this.impact.length ? this.impact.shift()! : 0;
  }

  private pauseMenu(press: ReturnType<typeof anyPress>) {
    const items = this.trainingText ? ['RESUME', 'RESET', 'QUIT'] : ['RESUME', 'QUIT'];
    if (press.up) this.pauseSel = (this.pauseSel + items.length - 1) % items.length;
    if (press.down) this.pauseSel = (this.pauseSel + 1) % items.length;
    if (press.start || press.back) this.paused = false;
    if (press.confirm) {
      const it = items[this.pauseSel];
      if (it === 'RESUME') this.paused = false;
      if (it === 'RESET') {
        this.paused = false;
        this.resetTraining();
      }
      if (it === 'QUIT') {
        this.driver.dispose?.();
        this.opts.onQuit();
      }
    }
    this.pauseText.text = 'PAUSED\n\n' + items.map((it, i) => (i === this.pauseSel ? `▶ ${it} ◀` : it)).join('\n');
  }

  private prevKeys = { h: false, r: false };
  private trainingKeys() {
    const h = keyDown('KeyH'), r = keyDown('KeyR');
    if (h && !this.prevKeys.h) this.showHitboxes = !this.showHitboxes;
    if (r && !this.prevKeys.r) this.resetTraining();
    this.prevKeys = { h, r };
  }

  private resetTraining() {
    const fresh = createMatch(this.cfg);
    this.state.fighters.forEach((f, i) => Object.assign(f, fresh.fighters[i]));
    this.state.projectiles = [];
    this.state.items = [];
  }

  private toScreen(x: number, y: number) {
    return { x: (x - this.cam.x) * this.cam.zoom + W / 2, y: (y - this.cam.y) * this.cam.zoom + H / 2 };
  }

  private handle(e: SimEvent) {
    const fs = this.state.fighters;
    switch (e.type) {
      case 'hit': {
        const victim = fs[e.victim];
        if (e.label === 'pummel') {
          this.fx.spark(e.x, e.y, false);
          sfxHit(0.1);
          break;
        }
        this.fx.hit(e.x, e.y, e.angle, e.heavy, e.kb, e.armored ? 'armor' : e.label, JUICE[victim.kind]);
        sfxHit(e.kb / 200);
        this.views[e.victim].onHit();
        this.cam.shake = Math.max(this.cam.shake, e.heavy ? 18 : 4 + e.kb * 0.05);
        this.cam.kick = e.heavy ? 0.09 : 0.025;
        if (e.heavy || e.kb > 140) this.impact = e.kb > 190 ? [1, 1, 2, 2] : [1, 2];
        // training combo counter
        if (e.victim === this.combo.victim && victim.action === 'hitstun' && this.combo.count > 0) {
          this.combo.count++;
          this.combo.damage += e.damage;
        } else {
          this.combo = { count: 1, damage: e.damage, victim: e.victim, last: this.t };
        }
        if (this.combo.count >= 3) this.fx.label(victim.x, victim.y - 260, `${this.combo.count} HIT COMBO!`, 0xffe600);
        break;
      }
      case 'block':
        this.fx.block(e.x, e.y, PLAYER_COLORS[e.victim % 4]);
        sfxBlock();
        break;
      case 'parry':
        this.fx.word(e.x, e.y - 110, 'PARRY!!', 96, -0.08, true);
        this.fx.ring(e.x, e.y, 180);
        this.impact = [2];
        sfxSuper();
        break;
      case 'shieldbreak': {
        const f = fs[e.id];
        this.fx.word(f.x, f.y - 240, 'SHIELD BREAK!!', 70, -0.1, true);
        this.cam.shake = 16;
        sfxKo();
        break;
      }
      case 'ko': {
        const s = this.toScreen(e.x, e.y);
        const sx = Math.max(0, Math.min(W, s.x));
        const sy = Math.max(0, Math.min(H, s.y));
        this.fx.koBlast(sx, sy, Math.atan2(H / 2 - sy, W / 2 - sx));
        const f = fs[e.victim];
        const out = f.action === 'out';
        if (e.bySuper) {
          this.fx.banner('FRESH SQUEEZED!', W / 2, H / 2 - 40, 130, 0xffe600, 0xe8202a);
          announce('Fresh squeezed!');
        } else this.fx.banner(out ? 'PULPED OUT!' : "PULP'D!", W / 2, H / 2 - 40);
        this.fx.flash(W, H, 0.7);
        this.cam.shake = 28;
        sfxKo();
        break;
      }
      case 'jump':
        sfxJump();
        this.fx.dust(e.x, e.double ? e.y - 10 : e.y, false);
        break;
      case 'land':
        if (e.hard) this.fx.dust(e.x, e.y, true);
        this.views[e.id].onLand();
        break;
      case 'swing':
        sfxSwing(!!getMove(fs[e.id].kind, e.move).heavy);
        if (e.move === 'sweep') this.fx.dust(fs[e.id].x, fs[e.id].y, true);
        break;
      case 'dodge':
        sfxSwing(false);
        break;
      case 'grab':
        this.fx.word(fs[e.victim].x, fs[e.victim].y - 230, 'GOTCHA!', 52, 0.1, false);
        break;
      case 'counter':
        this.fx.word(e.x, e.y - 120, 'COUNTER!!', 90, -0.1, true);
        this.impact = [1, 2];
        sfxKo();
        break;
      case 'super':
        this.superCutin(e.id);
        break;
      case 'ledge':
        this.fx.dust(e.x, e.y, false);
        sfxBlock();
        break;
      case 'pop':
        this.fx.poof(e.x, e.y, 0xffffff, 5);
        break;
      case 'pickup': {
        const f = fs[e.id];
        sfxPickup();
        this.fx.label(f.x, f.y - 240, e.kind === 'smoothie' ? 'SMOOTHIE!' : e.kind === 'salt' ? 'SALT SHAKER!' : 'PEELER!', 0x3ec3ff);
        break;
      }
      case 'heal': {
        const f = fs[e.id];
        this.fx.label(f.x, f.y - 200, `-${Math.round(e.amount)}%`, 0x37d16b);
        this.fx.poof(f.x, f.y - 100, 0xff6fa8, 8);
        break;
      }
      case 'crack': {
        const f = fs[e.id];
        this.fx.word(f.x, f.y - 240, 'CRACK!!', 80, 0.1, true);
        this.fx.label(f.x, f.y - 160, 'SHELL BROKEN: FASTER!', 0xffe600);
        break;
      }
      case 'game': {
        this.fx.banner('GAME!', W / 2, H / 2 - 40, 220, 0xffffff, 0xe8202a);
        this.fx.flash(W, H, 0.9);
        announce('Game!');
        music.stop();
        break;
      }
      default:
        break;
    }
  }

  // MvC-style hyper cut-in: the world freezes and a diagonal comic panel slides past.
  private superCutin(id: number) {
    const f = this.state.fighters[id];
    const name = ROSTER[f.kind].super.name ?? 'SUPER!!';
    sfxSuper();
    announce(name.replace(/!/g, ''));
    this.cutin.removeChildren();
    const dim = new Graphics().rect(-W, -H, W * 3, H * 3).fill({ color: 0x000000, alpha: 0.5 });
    const panel = new Container();
    const band = new Graphics()
      .poly([-200, 210, W + 200, 140, W + 200, 470, -200, 540]).fill(INK)
      .poly([-200, 222, W + 200, 152, W + 200, 458, -200, 528]).fill(FRUIT_COLOR[f.kind])
      .poly([-200, 222, W + 200, 152, W + 200, 190, -200, 260]).fill({ color: 0xffffff, alpha: 0.3 });
    const rays = new Graphics();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      rays.poly([300, 340, 300 + Math.cos(a) * 900, 340 + Math.sin(a) * 900, 300 + Math.cos(a + 0.12) * 900, 340 + Math.sin(a + 0.12) * 900]).fill({ color: 0xffffff, alpha: 0.18 });
    }
    const mask = new Graphics().poly([-200, 222, W + 200, 152, W + 200, 458, -200, 528]).fill(0xffffff);
    rays.mask = mask;
    const portrait = new Graphics();
    drawPortrait(portrait, f.kind, this.t, 'shout');
    portrait.scale.set(2.3 * ROSTER[f.kind].stats.size);
    portrait.position.set(300, 600);
    portrait.mask = mask;
    const title = comicText(name, 96, 0xffe600, 0xe8202a);
    title.position.set(820, 300);
    title.rotation = -0.06;
    panel.addChild(band, rays, mask, portrait, title);
    this.cutin.addChild(dim, panel);
    this.cutinAnim = { panel, title, age: 0 };
    this.animateCutin();
  }

  private cutinAnim: { panel: Container; title: Text; age: number } | null = null;

  private animateCutin() {
    const a = this.cutinAnim;
    if (!a) return;
    a.panel.x = a.age < 8 ? (1 - a.age / 8) * -W : a.age > 40 ? ((a.age - 40) / 10) * W : 0;
    a.title.scale.set(a.age < 12 ? 1.6 - a.age * 0.05 : 1);
    a.age++;
  }

  private updateCamera() {
    const fs = this.state.fighters.filter((f) => f.action !== 'dead' && f.action !== 'out');
    const main = platformAt(this.state.stage, 0, this.state.frame);
    // always keep most of the main stage and the first platform tier in view
    let minX = main.x - main.w * 0.45, maxX = main.x + main.w * 0.45, minY = -470, maxY = 90;
    for (const f of fs) {
      minX = Math.min(minX, f.x);
      maxX = Math.max(maxX, f.x);
      minY = Math.min(minY, f.y - 200);
      maxY = Math.max(maxY, f.y + 30);
    }
    // frame the action in the area above the HUD plates (the top ~80% of the screen)
    const zoom = Math.max(0.36, Math.min(0.62, (W * 0.88) / (maxX - minX + 360), (H * 0.68) / (maxY - minY + 200)));
    const cam = this.cam;
    cam.x += ((minX + maxX) / 2 - cam.x) * 0.1;
    cam.y += ((minY + maxY) / 2 + (H * 0.1) / zoom - cam.y) * 0.1;
    cam.zoom += (zoom - cam.zoom) * 0.08;
    cam.shake *= 0.84;
    cam.kick *= 0.82;
  }

  frame() {
    const cam = this.cam;
    const z = cam.zoom * (1 + cam.kick);
    const shx = (Math.random() - 0.5) * 2 * cam.shake;
    const shy = (Math.random() - 0.5) * 2 * cam.shake;
    this.world.pivot.set(cam.x, cam.y);
    this.world.scale.set(z);
    this.world.position.set(W / 2 + shx, H / 2 + shy);
    this.stageView.backdrop.visible = game.comic.resources.comicUniforms.uniforms.uImpact === 0;
    this.stageView.update(this.state.frame, { x: cam.x, y: cam.y, zoom: z });

    const s = this.state;
    this.shadows.clear();
    for (const f of s.fighters) {
      if (f.action === 'dead' || f.action === 'out') continue;
      let best: number | null = null;
      for (let i = 0; i < s.stage.platforms.length; i++) {
        const p = platformAt(s.stage, i, s.frame);
        if (Math.abs(f.x - p.x) <= p.w / 2 && p.y >= f.y - 1 && (best === null || p.y < best)) best = p.y;
      }
      if (best === null) continue;
      const k = Math.max(0.2, 1 - (best - f.y) / 420);
      const size = statsOf(f).size;
      this.shadows.ellipse(f.x, best + 2, 44 * k * size, 9 * k).fill({ color: 0x000000, alpha: 0.32 * k });
    }

    s.fighters.forEach((f, i) => this.views[i].update(f, this.t));
    this.projectiles.update(s.projectiles, this.t);
    this.items.update(s.items, this.t);
    this.hud.update(this.t);
    this.overlay.visible = this.paused;

    if (this.trainingText) {
      const d = s.fighters[1];
      this.trainingText.text = [
        'TRAINING  ·  H HITBOXES  ·  R RESET  ·  ESC MENU',
        d ? `DUMMY ${d.percent.toFixed(1)}%   LAST COMBO ${this.combo.count} HITS / ${this.combo.damage.toFixed(1)}%` : '',
        s.fighters[0].move ? `${s.fighters[0].move?.toUpperCase()}  FRAME ${s.fighters[0].frame}` : '',
      ].join('\n');
    }

    this.debug.clear();
    if (this.showHitboxes) {
      for (const f of s.fighters) {
        if (f.action === 'dead' || f.action === 'out') continue;
        const h = hurtbox(f);
        this.debug.circle(f.x + h.x * f.facing, f.y + h.y, h.r).stroke({ width: 3, color: 0x2f7bff });
        if (f.action === 'attack' && f.move) {
          const m = getMove(f.kind, f.move);
          if (!m.hitbox) continue;
          const size = statsOf(f).size;
          const active = f.frame >= m.startup && f.frame < m.startup + m.active;
          for (const side of m.both ? [1, -1] : [1]) {
            this.debug.circle(f.x + m.hitbox.x * size * f.facing * side, f.y + m.hitbox.y * size, m.hitbox.r * size)
              .fill({ color: 0xff2020, alpha: active ? 0.45 : 0.1 }).stroke({ width: 2, color: 0xff2020 });
          }
        }
      }
      for (const p of s.projectiles) this.debug.circle(p.x, p.y, p.r).stroke({ width: 2, color: 0xff00ff });
    }
  }

  destroy() {
    game.comic.impact = 0;
    this.driver.dispose?.();
  }
}
