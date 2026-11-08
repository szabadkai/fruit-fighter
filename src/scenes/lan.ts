import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import QRCode from 'qrcode';
import { H, W, game, type Scene } from '../app';
import { sfxJump, sfxPickup } from '../audio';
import { music } from '../audio/music';
import { connectedDevices, deviceLabel, menuPress, type DeviceId } from '../input/devices';
import { LanClient, NetDriver, type LanPlayer, type LanSeat, type StartMsg } from '../net/lan';
import type { MatchConfig } from '../sim/engine';
import { ROSTER } from '../sim/roster';
import { STAGES, STAGE_ORDER } from '../sim/stages';
import { PLAYABLE } from '../sim/types';
import { drawPortrait } from '../render/fighterView';
import { FRUIT_COLOR, PLAYER_COLORS } from '../render/palette';
import { menuBackdrop, panel, smallText, title } from '../ui/comic';
import { MatchScene } from './match';
import { MainMenuScene, ResultsScene } from './menus';

// LAN lobby: every browser on the party URL joins one room. Each machine adds its
// local players (any keyboard/pad), picks fruits and readies up; the first machine to
// connect is the leader and picks the stage and starts the match.

interface Local { device?: DeviceId; cursor: number; ready: boolean; cpu?: number }

let client: LanClient | null = null;

export class LanScene implements Scene {
  readonly root = new Container();
  private bg = menuBackdrop(0x1fd2ff, 0x101850);
  private t = 0;
  private locals: Local[] = [];
  private devices: DeviceId[] = [];
  private stage = 0;
  private list = new Container();
  private info: Text;
  private qr = new Sprite();
  private urlText: Text;
  private off: () => void;
  private lastSent = '';

  constructor() {
    client ??= new LanClient();
    if (client.status === 'closed') client = new LanClient();
    this.root.addChild(this.bg.root, title('LAN PARTY!', 76, 50));
    this.qr.position.set(1010, 130);
    this.qr.width = this.qr.height = 200;
    this.urlText = smallText('', 18);
    this.urlText.anchor.set(0.5, 0);
    this.urlText.position.set(1110, 340);
    this.info = smallText('', 22, 0xffe600);
    this.info.anchor.set(0.5);
    this.info.position.set(W / 2, H - 50);
    this.root.addChild(this.qr, this.urlText, this.list, this.info);
    const card = panel(236, 296, 0xffffff, 0);
    card.position.set(1110, 235);
    this.root.addChildAt(card, this.root.children.indexOf(this.qr));
    void this.loadQr();
    this.off = client.on((m) => {
      if (m.t === 'start') this.begin(m);
    });
    music.play('menu');
  }

  private async loadQr() {
    try {
      const res = await fetch('/lan-info');
      const { urls } = (await res.json()) as { urls: string[] };
      const url = urls[0] ?? location.href;
      this.urlText.text = `JOIN ON THE SAME WI-FI:\n${urls.join('\n') || location.href}`;
      const data = await QRCode.toDataURL(url, { margin: 1, width: 400, color: { dark: '#14100c', light: '#ffffff' } });
      const img = new Image();
      img.onload = () => {
        this.qr.texture = Texture.from(img);
        this.qr.width = this.qr.height = 200;
      };
      img.src = data;
    } catch {
      this.urlText.text = `JOIN: ${location.href}`;
    }
  }

  tick() {
    this.t++;
    this.bg.update(this.t);
    const c = client!;
    const n = PLAYABLE.length;
    for (const dev of connectedDevices()) {
      const p = menuPress(dev);
      if (!p) continue;
      const me = this.locals.find((l) => l.device === dev);
      if (!me) {
        if (p.confirm && this.locals.length < 4) {
          this.locals.push({ device: dev, cursor: (this.locals.length + c.id) % n, ready: false });
          sfxJump();
        } else if (p.back && !this.locals.some((l) => l.device)) {
          this.off();
          client?.close();
          client = null;
          return game.go(new MainMenuScene());
        }
        continue;
      }
      if (!me.ready) {
        if (p.left) me.cursor = (me.cursor + n - 1) % n;
        if (p.right) me.cursor = (me.cursor + 1) % n;
        if (p.confirm) { me.ready = true; sfxPickup(); }
        if (p.back) this.locals.splice(this.locals.indexOf(me), 1);
      } else {
        if (p.back) me.ready = false;
        if (c.isLeader && p.confirm && this.canStart()) return this.start();
      }
      if (c.isLeader) {
        if (p.extra && this.total() < 4) this.locals.push({ cpu: 5, cursor: (this.t * 7) % n, ready: true });
        if (p.extra2) this.stage = (this.stage + 1) % STAGE_ORDER.length;
      }
    }
    const players: LanPlayer[] = this.locals.map((l) => ({ fighter: PLAYABLE[l.cursor], ready: l.ready, cpu: l.cpu }));
    const key = JSON.stringify(players);
    if (key !== this.lastSent && c.status === 'open') {
      c.send({ t: 'players', players });
      this.lastSent = key;
    }
    this.info.text = c.status === 'connecting' ? 'CONNECTING TO THE PARTY…'
      : c.status === 'closed' ? 'NO LAN SERVER: RUN `npm run host` (OR `npm run dev`) ON ONE MACHINE'
        : c.isLeader
          ? `YOU'RE THE HOST · STAGE: ${STAGES[STAGE_ORDER[this.stage]].name.toUpperCase()} (SHIELD TO CHANGE) · SPECIAL ADDS CPU · ${this.canStart() ? 'OK TO START!' : 'WAITING FOR EVERYONE TO BE READY'}`
          : 'PRESS OK TO JOIN · PICK A FRUIT · OK WHEN READY · THE HOST STARTS THE MATCH';
  }

  private total() {
    return client!.machines.reduce((n, m) => n + m.players.length, 0);
  }

  private canStart() {
    const ms = client!.machines;
    const all = ms.flatMap((m) => m.players);
    return all.length >= 2 && all.every((p) => p.ready);
  }

  private start() {
    const c = client!;
    const seats: LanSeat[] = [];
    for (const m of c.machines) m.players.forEach((p, i) => seats.push({ machine: m.id, local: i, fighter: p.fighter, cpu: p.cpu }));
    const cfg: MatchConfig = {
      stage: STAGE_ORDER[this.stage], stocks: 3, timeLimit: 0, items: true, seed: (Date.now() & 0x7fffffff) | 0,
      players: seats.map((s) => ({ fighter: s.fighter, cpu: s.cpu })),
    };
    c.send({ t: 'start', cfg, seats });
  }

  private begin(m: StartMsg) {
    this.off();
    const c = client!;
    const devices = this.locals.map((l) => l.device ?? 'kb1');
    const names = m.seats.map((s) => {
      const machine = c.machines.find((x) => x.id === s.machine);
      return s.cpu ? `CPU ${s.cpu}` : `${machine?.name ?? 'PLAYER'} ${ROSTER[s.fighter].name.toUpperCase()}`;
    });
    const back = () => game.go(new LanScene());
    const driver = new NetDriver(c, m.seats, devices, back);
    for (const l of this.locals) l.ready = false;
    game.go(new MatchScene(m.cfg, driver, {
      names,
      onEnd: (r) => game.go(new ResultsScene(r, back, back)),
      onQuit: back,
    }));
  }

  frame() {
    this.list.removeChildren().forEach((ch) => ch.destroy({ children: true }));
    const c = client!;
    c.machines.forEach((m, mi) => {
      const row = new Container();
      row.position.set(110, 150 + mi * 130);
      const lbl = smallText(`${m.name}${m.id === c.id ? ' (YOU)' : ''}${m.id === c.leader ? ' · HOST' : ''}`, 22, m.id === c.id ? 0xffe600 : 0xffffff);
      lbl.position.set(0, -18);
      row.addChild(lbl);
      m.players.forEach((p, i) => {
        const card = new Container();
        card.addChild(panel(150, 90, FRUIT_COLOR[p.fighter], 8));
        const g = new Graphics();
        g.scale.set(0.36 * ROSTER[p.fighter].stats.size);
        g.position.set(-40, 44);
        drawPortrait(g, p.fighter, this.t + i * 17, p.ready ? 'win' : 'idle');
        const mask = new Graphics().rect(-75, -45, 150, 90).fill(0xffffff);
        g.mask = mask;
        const name: Text = smallText(`${p.cpu ? 'CPU · ' : ''}${ROSTER[p.fighter].name.toUpperCase()}\n${p.ready ? 'READY!' : '…'}`, 16);
        name.position.set(-8, -30);
        card.addChild(mask, g, name);
        card.position.set(90 + i * 170, 50);
        row.addChild(card);
      });
      if (m.id === c.id) {
        const devs = this.locals.filter((l) => l.device).map((l) => deviceLabel(l.device!)).join(', ');
        const d = smallText(devs ? `YOUR CONTROLLERS: ${devs}` : 'PRESS OK ON A KEYBOARD OR PAD TO ADD A PLAYER', 16, PLAYER_COLORS[0]);
        d.position.set(0, 100);
        row.addChild(d);
      }
      this.list.addChild(row);
    });
  }

  destroy() {
    this.off();
  }
}
