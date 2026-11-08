import { Container, Graphics, Text } from 'pixi.js';
import { H, W, game, type Scene } from '../app';
import { music } from '../audio/music';
import { sfxJump, sfxPickup, sfxSwing } from '../audio';
import {
  CONTROLS, anyPress, captureKey, connectedDevices, deviceLabel, getBindings, keyLabel, menuPress, resetBindings, setBinding,
  type DeviceId, type KeyboardId,
} from '../input/devices';
import { cpuInput } from '../sim/ai';
import { readDevice } from '../input/devices';
import { NO_INPUT, unpackInput, type MatchConfig, type SimState } from '../sim/engine';
import { ROSTER } from '../sim/roster';
import { STAGES, STAGE_ORDER, type StageId } from '../sim/stages';
import { PLAYABLE, type FighterId } from '../sim/types';
import { drawPortrait } from '../render/fighterView';
import { comicText } from '../render/fx';
import { FRUIT_COLOR, PLAYER_COLORS, PLAYER_TAGS } from '../render/palette';
import { INK } from '../render/rig';
import { STAGE_ART } from '../render/stages';
import { MenuList, menuBackdrop, panel, smallText, title } from '../ui/comic';
import { MatchScene, type Driver, type MatchResult } from './match';
import { LanScene } from './lan';

// --- title ---------------------------------------------------------------------

export class TitleScene implements Scene {
  readonly root = new Container();
  private bg = menuBackdrop();
  private t = 0;
  private fruits: Graphics[] = [];
  private prompt: Text;

  constructor() {
    this.root.addChild(this.bg.root);
    PLAYABLE.forEach((id, i) => {
      const g = new Graphics();
      g.position.set(160 + i * 192, 600);
      g.scale.set(1.05 * ROSTER[id].stats.size * (i % 2 ? -1 : 1), 1.05 * ROSTER[id].stats.size);
      this.fruits.push(g);
      this.root.addChild(g);
    });
    const logo = comicText('FRUIT PUNCH!', 170, 0xffe600, 0xe8202a);
    logo.position.set(W / 2, 200);
    logo.rotation = -0.05;
    const sub = smallText('A JUICY PLATFORM FIGHTER', 30, 0xffffff);
    sub.anchor.set(0.5);
    sub.position.set(W / 2, 300);
    this.prompt = smallText('PRESS ANY BUTTON', 40, 0xffffff);
    this.prompt.anchor.set(0.5);
    this.prompt.position.set(W / 2, 390);
    this.root.addChild(logo, sub, this.prompt);
    music.play('menu');
  }

  tick() {
    this.t++;
    this.bg.update(this.t);
    this.prompt.visible = Math.floor(this.t / 30) % 2 === 0;
    const p = anyPress();
    if (p.confirm || p.start || p.back || p.extra) {
      sfxPickup();
      game.go(new MainMenuScene());
    }
  }

  frame() {
    this.fruits.forEach((g, i) => drawPortrait(g, PLAYABLE[i], this.t + i * 20, Math.floor((this.t + i * 40) / 90) % 3 === 0 ? 'win' : 'idle'));
  }
}

// --- main menu -----------------------------------------------------------------

export class MainMenuScene implements Scene {
  readonly root = new Container();
  private bg = menuBackdrop(0x3ec3ff, 0x2a1580);
  private list: MenuList;
  private t = 0;
  private items: string[];

  constructor() {
    this.items = ['VERSUS', 'LAN PARTY', 'TRAINING', 'CONTROLS'];
    if (loadReplay()) this.items.push('LAST REPLAY');
    this.list = new MenuList(this.items, W / 2, 250);
    const hint = smallText('MOVE: W/S · ARROWS · STICK      OK: SPACE / J / ENTER / (A)      BACK: K / ESC / (B)', 18);
    hint.anchor.set(0.5);
    hint.position.set(W / 2, H - 40);
    this.root.addChild(this.bg.root, title('FRUIT PUNCH!', 96), this.list.root, hint);
    music.play('menu');
  }

  tick() {
    this.t++;
    this.bg.update(this.t);
    this.list.update(this.t);
    const p = anyPress();
    if (p.up) { this.list.move(-1); sfxSwing(false); }
    if (p.down) { this.list.move(1); sfxSwing(false); }
    if (p.back) game.go(new TitleScene());
    if (p.confirm) {
      sfxPickup();
      const it = this.items[this.list.sel];
      if (it === 'VERSUS') game.go(new CharSelectScene('versus'));
      if (it === 'TRAINING') game.go(new CharSelectScene('training'));
      if (it === 'LAN PARTY') game.go(new LanScene());
      if (it === 'CONTROLS') game.go(new ControlsScene());
      if (it === 'LAST REPLAY') {
        const r = loadReplay();
        if (r) startReplay(r, () => game.go(new MainMenuScene()));
      }
    }
  }
}

// --- character select ----------------------------------------------------------

interface Slot {
  device?: DeviceId;
  cpu?: number;
  cursor: number; // index into PLAYABLE, PLAYABLE.length = random
  locked: boolean;
}

export interface Seat { fighter: FighterId; device?: DeviceId; cpu?: number }

export class CharSelectScene implements Scene {
  readonly root = new Container();
  private bg = menuBackdrop(0xff3b6b, 0x1f2a80);
  private t = 0;
  private slots: Slot[] = [];
  private cards: Container[] = [];
  private cardPortraits: Graphics[] = [];
  private slotViews: { c: Container; portrait: Graphics; name: Text; info: Text; bg: Graphics }[] = [];
  private cursorLayer = new Graphics();
  private cursorTags: Text[] = [];
  private prompt: Text;
  private cpuLevel = 5;

  constructor(private mode: 'versus' | 'training', keep?: Slot[]) {
    this.root.addChild(this.bg.root, title(mode === 'training' ? 'TRAINING: PICK YOUR FRUIT' : 'CHOOSE YOUR FRUIT!', 64, 50));
    const n = PLAYABLE.length + 1;
    for (let i = 0; i < n; i++) {
      const c = new Container();
      const id = PLAYABLE[i];
      c.addChild(panel(150, 190, id ? FRUIT_COLOR[id] : 0x555566, 10));
      const g = new Graphics();
      g.position.set(0, 78);
      if (id) g.scale.set(0.62 * ROSTER[id].stats.size);
      c.addChild(g);
      const label = comicText(id ? ROSTER[id].name.toUpperCase() : 'RANDOM', 24, 0xffffff, INK);
      label.position.set(0, -78);
      c.addChild(label);
      if (!id) {
        const q = comicText('?', 120, 0xffffff, INK);
        q.position.set(0, 10);
        c.addChild(q);
      }
      c.position.set(140 + i * 167, 210);
      this.cards.push(c);
      this.cardPortraits.push(g);
      this.root.addChild(c);
    }
    this.root.addChild(this.cursorLayer);
    for (let i = 0; i < 4; i++) {
      const c = new Container();
      const bg = new Graphics();
      const portrait = new Graphics();
      portrait.position.set(-60, 110);
      const name = comicText('', 30, 0xffffff, INK);
      name.position.set(40, -48);
      const info = smallText('', 18);
      info.anchor.set(0.5, 0);
      info.position.set(40, -24);
      c.addChild(bg, portrait, name, info);
      c.position.set(170 + i * 313, 500);
      this.slotViews.push({ c, portrait, name, info, bg });
      this.root.addChild(c);
      const tag = smallText(PLAYER_TAGS[i], 22, PLAYER_COLORS[i]);
      tag.anchor.set(0.5);
      this.cursorTags.push(tag);
      this.root.addChild(tag);
    }
    this.prompt = smallText('', 28, 0xffe600);
    this.prompt.anchor.set(0.5);
    this.prompt.position.set(W / 2, H - 34);
    this.root.addChild(this.prompt);
    if (keep) this.slots = keep.map((s) => ({ ...s, locked: false }));
    music.play('menu');
  }

  private seatCount() {
    return this.slots.length;
  }

  tick() {
    this.t++;
    this.bg.update(this.t);
    const max = this.mode === 'training' ? 1 : 4;
    const n = PLAYABLE.length + 1;
    for (const dev of connectedDevices()) {
      const p = menuPress(dev);
      if (!p) continue;
      const slot = this.slots.find((s) => s.device === dev);
      if (!slot) {
        if (p.confirm && this.seatCount() < max) {
          this.slots.push({ device: dev, cursor: this.slots.length % PLAYABLE.length, locked: false });
          sfxJump();
        } else if (p.back && this.slots.every((s) => s.cpu !== undefined || !s.device)) {
          game.go(new MainMenuScene());
          return;
        }
        continue;
      }
      if (p.extra && this.mode === 'versus' && this.seatCount() < 4) {
        this.slots.push({ cpu: this.cpuLevel, cursor: (this.t * 7 + this.slots.length * 3) % PLAYABLE.length, locked: true });
        sfxPickup();
      }
      if (p.extra2 && this.slots.some((s) => s.cpu !== undefined)) {
        this.cpuLevel = (this.cpuLevel % 9) + 1;
        this.slots.forEach((s) => { if (s.cpu !== undefined) s.cpu = this.cpuLevel; });
      }
      if (!slot.locked) {
        if (p.left) slot.cursor = (slot.cursor + n - 1) % n;
        if (p.right) slot.cursor = (slot.cursor + 1) % n;
        if (p.confirm) {
          if (slot.cursor === PLAYABLE.length) slot.cursor = (this.t * 13) % PLAYABLE.length;
          slot.locked = true;
          sfxPickup();
        }
        if (p.back) {
          this.slots.splice(this.slots.indexOf(slot), 1);
          // removing a human also drops CPUs added after them if no humans remain
          if (!this.slots.some((s) => s.device)) this.slots = [];
        }
      } else {
        if (p.back) {
          // the last CPU goes first, then your own lock
          const lastCpu = [...this.slots].reverse().find((s) => s.cpu !== undefined);
          if (lastCpu && this.slots.indexOf(lastCpu) > this.slots.indexOf(slot)) this.slots.splice(this.slots.indexOf(lastCpu), 1);
          else slot.locked = false;
        }
        if (p.confirm && this.ready()) return this.next();
      }
    }
    this.prompt.text = this.ready()
      ? 'READY! PRESS OK TO CONTINUE'
      : this.slots.length === 0
        ? 'PRESS OK ON ANY KEYBOARD OR PAD TO JOIN'
        : this.mode === 'versus' && this.slots.length < 2
          ? 'NEED 2+ FIGHTERS · SPECIAL (L / Y) ADDS A CPU'
          : 'PICK WITH LEFT/RIGHT · OK TO LOCK IN';
  }

  private ready() {
    const need = this.mode === 'training' ? 1 : 2;
    return this.slots.length >= need && this.slots.every((s) => s.locked);
  }

  private next() {
    const seats: Seat[] = this.slots.map((s) => ({ fighter: PLAYABLE[s.cursor], device: s.device, cpu: s.cpu }));
    if (this.mode === 'training') {
      const cfg: MatchConfig = {
        stage: 'cutting-board', stocks: 0, timeLimit: 0, items: false, seed: Date.now() | 0, training: true,
        players: [{ fighter: seats[0].fighter }, { fighter: 'apple' }],
      };
      const driver = localDriver([seats[0], { fighter: 'apple' }]);
      game.go(new MatchScene(cfg, driver, {
        names: [ROSTER[seats[0].fighter].name.toUpperCase(), 'DUMMY'], training: true,
        onEnd: () => game.go(new MainMenuScene()), onQuit: () => game.go(new CharSelectScene('training')),
      }));
      return;
    }
    game.go(new StageSelectScene(seats, this.slots));
  }

  frame() {
    const n = PLAYABLE.length + 1;
    this.cardPortraits.forEach((g, i) => { if (PLAYABLE[i]) drawPortrait(g, PLAYABLE[i], this.t + i * 11); });
    this.cursorLayer.clear();
    this.slots.forEach((s, i) => {
      if (s.cpu !== undefined) return;
      const card = this.cards[s.cursor % n];
      const off = (i - 1.5) * 26;
      const color = PLAYER_COLORS[i];
      const grow = s.locked ? 0 : 3 + Math.sin(this.t * 0.25) * 3;
      const x = card.x - 86 - grow + i * 3, y = card.y - 108 - grow + i * 3;
      this.cursorLayer.roundRect(x, y, 172 + grow * 2, 216 + grow * 2, 12).stroke({ width: 15, color: INK });
      this.cursorLayer.roundRect(x, y, 172 + grow * 2, 216 + grow * 2, 12).stroke({ width: 8, color: s.locked ? 0xffffff : color });
      this.cursorTags[i].position.set(card.x + off, card.y + 120);
    });
    this.cursorTags.forEach((tg, i) => { tg.visible = !!this.slots[i] && this.slots[i].cpu === undefined; });
    this.slotViews.forEach((v, i) => {
      const s = this.slots[i];
      v.bg.clear();
      const color = PLAYER_COLORS[i];
      if (!s) {
        panel(280, 150, 0x333344, 12, v.bg);
        v.portrait.clear();
        v.name.text = this.mode === 'training' && i > 0 ? '' : 'PRESS OK';
        v.info.text = this.mode === 'training' && i > 0 ? '' : 'TO JOIN';
        v.c.alpha = this.mode === 'training' && i > 0 ? 0 : 0.7;
        return;
      }
      v.c.alpha = 1;
      const id = PLAYABLE[s.cursor];
      panel(280, 150, id ? FRUIT_COLOR[id] : 0x555566, 12, v.bg);
      v.bg.poly([-126, -75, -100, -75, -126, 75, -152, 75]).fill(color);
      if (id) {
        v.portrait.scale.set(0.62 * ROSTER[id].stats.size);
        drawPortrait(v.portrait, id, this.t, s.locked ? 'win' : 'idle');
      } else v.portrait.clear();
      v.name.text = id ? ROSTER[id].name.toUpperCase() : 'RANDOM';
      v.info.text = s.cpu !== undefined
        ? `CPU · LEVEL ${s.cpu}\n(SHIELD: CHANGE LEVEL)`
        : `${PLAYER_TAGS[i]} · ${deviceLabel(s.device!)}\n${s.locked ? 'READY!' : id ? `"${ROSTER[id].nick}"` : ''}`;
    });
  }
}

export function localDriver(seats: { fighter: FighterId; device?: DeviceId; cpu?: number }[]): Driver {
  return {
    canPause: true,
    next: (s: SimState) => seats.map((seat, i) => (seat.device ? readDevice(seat.device) : seat.cpu ? cpuInput(s, i, seat.cpu) : NO_INPUT)),
  };
}

// --- stage + rules -------------------------------------------------------------

const TIMES = [0, 3, 5, 8];

export class StageSelectScene implements Scene {
  readonly root = new Container();
  private bg = menuBackdrop(0x37d16b, 0x14306b);
  private t = 0;
  private sel = 0;
  private row = 0; // 0 = stages, 1 = rules
  private rule = 0;
  private stocks = 3;
  private time = 0;
  private items = true;
  private cards: Container[] = [];
  private frameG = new Graphics();
  private rulesText: Text;

  constructor(private seats: Seat[], private slots: Slot[]) {
    this.root.addChild(this.bg.root, title('PICK A STAGE!', 72, 50));
    const ids = [...STAGE_ORDER, 'random' as const];
    ids.forEach((id, i) => {
      const c = new Container();
      const w = 250, h = 150;
      c.addChild(panel(w, h, 0x222233, 8));
      if (id !== 'random') {
        const view = STAGE_ART[id](STAGES[id]);
        const inner = new Container();
        const bd = view.backdrop;
        const world = view.world;
        inner.addChild(bd, world);
        view.update(0, { x: 0, y: -150, zoom: 0.72 });
        bd.scale.set(0.2);
        bd.position.set((bd.x - 640) * 0.2, (bd.y - 360) * 0.2);
        world.pivot.set(0, -150);
        world.scale.set(0.2 * 0.72);
        world.position.set(0, 0);
        const mask = new Graphics().poly([-117, -75, 133, -75, 117, 75, -133, 75]).fill(0xffffff);
        inner.mask = mask;
        c.addChild(inner, mask);
      } else {
        const q = comicText('?', 110, 0xffffff, INK);
        c.addChild(q);
      }
      const label = comicText(id === 'random' ? 'RANDOM' : STAGES[id].name.toUpperCase(), 26, 0xffffff, INK);
      label.position.set(0, 58);
      c.addChild(label);
      c.position.set(180 + (i % 4) * 306, 200 + Math.floor(i / 4) * 196);
      this.cards.push(c);
      this.root.addChild(c);
    });
    this.root.addChild(this.frameG);
    this.rulesText = smallText('', 30);
    this.rulesText.anchor.set(0.5);
    this.rulesText.position.set(W / 2, 600);
    const hint = smallText('UP/DOWN: STAGES ↔ RULES · LEFT/RIGHT: CHANGE · OK: FIGHT! · BACK: CHARACTERS', 18);
    hint.anchor.set(0.5);
    hint.position.set(W / 2, H - 30);
    this.root.addChild(this.rulesText, hint);
  }

  tick() {
    this.t++;
    this.bg.update(this.t);
    const p = anyPress();
    const n = this.cards.length;
    if (p.back) return game.go(new CharSelectScene('versus', this.slots));
    if (this.row === 0) {
      if (p.left) this.sel = (this.sel + n - 1) % n;
      if (p.right) this.sel = (this.sel + 1) % n;
      if (p.up && this.sel >= 4) this.sel -= 4;
      else if (p.down) {
        if (this.sel < 4 && this.sel + 4 < n) this.sel += 4;
        else this.row = 1;
      }
    } else {
      if (p.up) this.row = 0;
      if (p.left || p.right) {
        const d = p.left ? -1 : 1;
        if (this.rule === 0) this.stocks = Math.max(1, Math.min(5, this.stocks + d));
        if (this.rule === 1) this.time = (this.time + d + TIMES.length) % TIMES.length;
        if (this.rule === 2) this.items = !this.items;
      }
      if (p.extra || p.down) this.rule = (this.rule + 1) % 3;
    }
    if (p.confirm) {
      sfxPickup();
      const id: StageId = this.sel < STAGE_ORDER.length ? STAGE_ORDER[this.sel] : STAGE_ORDER[this.t % STAGE_ORDER.length];
      const cfg: MatchConfig = {
        stage: id, stocks: this.stocks, timeLimit: TIMES[this.time] * 3600, items: this.items, seed: (Date.now() & 0x7fffffff) | 0,
        players: this.seats.map((s) => ({ fighter: s.fighter, cpu: s.cpu })),
      };
      return startLocalMatch(cfg, this.seats, this.slots);
    }
    const r = (i: number, s: string) => (this.row === 1 && this.rule === i ? `▶ ${s} ◀` : s);
    this.rulesText.text = [
      r(0, `STOCKS: ${this.stocks}`), r(1, `TIME: ${TIMES[this.time] ? TIMES[this.time] + ' MIN' : 'NONE'}`), r(2, `ITEMS: ${this.items ? 'ON' : 'OFF'}`),
    ].join('      ');
  }

  frame() {
    const c = this.cards[this.sel];
    this.frameG.clear();
    if (this.row === 0) this.frameG.roundRect(c.x - 140, c.y - 84, 280, 168, 12).stroke({ width: 8, color: Math.floor(this.t / 8) % 2 ? 0xffe600 : 0xff3b3b });
  }
}

export function startLocalMatch(cfg: MatchConfig, seats: Seat[], slots: Slot[]) {
  const names = seats.map((s, i) => (s.cpu ? `CPU ${s.cpu}` : `${PLAYER_TAGS[i]} ${ROSTER[s.fighter].name.toUpperCase()}`));
  game.go(new MatchScene(cfg, localDriver(seats), {
    names,
    onEnd: (r) => game.go(new ResultsScene(r, () => startLocalMatch({ ...cfg, seed: (cfg.seed * 1103515245 + 12345) | 0 }, seats, slots), () => game.go(new CharSelectScene('versus', slots)))),
    onQuit: () => game.go(new CharSelectScene('versus', slots)),
  }));
}

// --- results -------------------------------------------------------------------

const REPLAY_KEY = 'fruitpunch.lastReplay.v1';

function saveReplay(r: MatchResult) {
  try { localStorage.setItem(REPLAY_KEY, JSON.stringify({ cfg: r.cfg, replay: r.replay, names: r.names })); } catch { /* too big or blocked */ }
}

function loadReplay(): { cfg: MatchConfig; replay: number[][]; names: string[] } | null {
  try {
    const raw = localStorage.getItem(REPLAY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function startReplay(r: { cfg: MatchConfig; replay: number[][]; names: string[] }, done: () => void) {
  let i = 0;
  const driver: Driver = {
    canPause: true,
    next: () => (i < r.replay.length ? r.replay[i++].map(unpackInput) : null),
    status: () => (i >= r.replay.length ? 'END OF REPLAY · ESC TO EXIT' : ''),
  };
  game.go(new MatchScene(r.cfg, driver, { names: r.names, replay: true, onEnd: done, onQuit: done }));
}

export class ResultsScene implements Scene {
  readonly root = new Container();
  private bg = menuBackdrop(0xffe600, 0xe8202a);
  private t = 0;
  private list: MenuList;
  private portrait = new Graphics();
  private items = ['REMATCH', 'CHARACTERS', 'WATCH REPLAY', 'MAIN MENU'];

  constructor(private r: MatchResult, private rematch: () => void, private chars: () => void) {
    saveReplay(r);
    const s = r.state;
    const w = s.winner >= 0 ? s.fighters[s.winner] : null;
    this.root.addChild(this.bg.root);
    if (w) {
      this.portrait.position.set(260, 560);
      this.portrait.scale.set(2 * ROSTER[w.kind].stats.size);
      this.root.addChild(this.portrait);
    }
    const head = comicText(w ? `${r.names[w.id]} WINS!` : 'DRAW!', 84, 0xffffff, 0xe8202a);
    head.position.set(w ? 780 : W / 2, 80);
    head.rotation = -0.04;
    this.root.addChild(head);
    const rows = s.fighters.map((f, i) => `${r.names[i]}   KOs ${f.kos}   FALLS ${f.falls}   DAMAGE ${Math.round(f.dealt)}%`);
    const stats = smallText(rows.join('\n'), 24);
    stats.anchor.set(0.5, 0);
    stats.position.set(w ? 780 : W / 2, 150);
    this.root.addChild(stats);
    this.list = new MenuList(this.items, w ? 780 : W / 2, 380, 70);
    this.root.addChild(this.list.root);
    music.play('menu');
  }

  tick() {
    this.t++;
    this.bg.update(this.t);
    this.list.update(this.t);
    const p = anyPress();
    if (p.up) this.list.move(-1);
    if (p.down) this.list.move(1);
    if (p.confirm && this.t > 30) {
      const it = this.items[this.list.sel];
      if (it === 'REMATCH') this.rematch();
      if (it === 'CHARACTERS') this.chars();
      if (it === 'WATCH REPLAY') startReplay(this.r, () => game.go(new ResultsScene(this.r, this.rematch, this.chars)));
      if (it === 'MAIN MENU') game.go(new MainMenuScene());
    }
  }

  frame() {
    const s = this.r.state;
    if (s.winner >= 0) drawPortrait(this.portrait, s.fighters[s.winner].kind, this.t, Math.floor(this.t / 60) % 2 ? 'win' : 'idle');
  }
}

// --- controls ------------------------------------------------------------------

export class ControlsScene implements Scene {
  readonly root = new Container();
  private bg = menuBackdrop(0x9b5cff, 0x101840);
  private t = 0;
  private col: KeyboardId = 'kb1';
  private row = 0;
  private table: Text;
  private waiting = false;

  constructor() {
    this.table = smallText('', 24);
    this.table.anchor.set(0.5, 0);
    this.table.position.set(W / 2, 120);
    const pads = smallText('GAMEPAD: STICK/D-PAD MOVE · (A) JUMP · (X) PUNCH · (Y) KICK · (B) SPECIAL · BUMPERS/TRIGGERS SHIELD · START PAUSE', 18, 0xffe600);
    pads.anchor.set(0.5);
    pads.position.set(W / 2, 620);
    const help = smallText('UP/DOWN PICK · LEFT/RIGHT SWITCH LAYOUT · OK REBIND (THEN PRESS A KEY) · SPECIAL RESET ALL · BACK EXIT', 18);
    help.anchor.set(0.5);
    help.position.set(W / 2, H - 40);
    this.root.addChild(this.bg.root, title('CONTROLS', 72, 56), this.table, pads, help);
  }

  tick() {
    this.t++;
    this.bg.update(this.t);
    if (this.waiting) return this.render();
    const p = anyPress();
    if (p.back) return game.go(new MainMenuScene());
    if (p.up) this.row = (this.row + CONTROLS.length - 1) % CONTROLS.length;
    if (p.down) this.row = (this.row + 1) % CONTROLS.length;
    if (p.left || p.right) this.col = this.col === 'kb1' ? 'kb2' : 'kb1';
    if (p.extra) resetBindings();
    if (p.confirm) {
      this.waiting = true;
      const c = CONTROLS[this.row];
      const kb = this.col;
      captureKey((code) => {
        if (code !== 'Escape') setBinding(kb, c, code);
        this.waiting = false;
      });
    }
    this.render();
  }

  private render() {
    const b = getBindings();
    const lines = ['ACTION            KEYS 1                 KEYS 2'];
    CONTROLS.forEach((c, i) => {
      const k1 = b.kb1[c].map(keyLabel).join(' / ');
      const k2 = b.kb2[c].map(keyLabel).join(' / ');
      const mark = (kb: KeyboardId, s: string) => (i === this.row && this.col === kb ? (this.waiting ? '[ PRESS A KEY ]' : `▶ ${s} ◀`) : s);
      lines.push(`${c.toUpperCase().padEnd(10)}    ${mark('kb1', k1).padEnd(22)}    ${mark('kb2', k2)}`);
    });
    this.table.text = lines.join('\n');
  }
}
