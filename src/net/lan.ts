import { cpuInput } from '../sim/ai';
import { packInput, stateHash, unpackInput, type InputFrame, type MatchConfig, type SimState } from '../sim/engine';
import type { FighterId } from '../sim/types';
import { readDevice, type DeviceId } from '../input/devices';
import type { Driver } from '../scenes/match';

// LAN client + lockstep driver. Every machine runs the full deterministic sim; only
// inputs travel. Local input sampled now is scheduled DELAY frames ahead, and a frame
// is simulated only once every human player's input for it has arrived.

export interface LanPlayer { fighter: FighterId; ready: boolean; cpu?: number }
export interface LanMachine { id: number; name: string; players: LanPlayer[] }
export interface LanSeat { machine: number; local: number; fighter: FighterId; cpu?: number }
export interface StartMsg { t: 'start'; cfg: MatchConfig; seats: LanSeat[] }

type Msg =
  | { t: 'welcome'; id: number }
  | { t: 'lobby'; machines: LanMachine[]; leader: number }
  | StartMsg
  | { t: 'in'; f: number; p: [number, number][] }
  | { t: 'hash'; f: number; h: number; from: number }
  | { t: 'left'; id: number }
  | { t: 'end' };

export class LanClient {
  ws: WebSocket;
  id = 0;
  leader = 0;
  machines: LanMachine[] = [];
  status: 'connecting' | 'open' | 'closed' = 'connecting';
  private listeners = new Set<(m: Msg) => void>();

  constructor() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/lan`);
    this.ws.onopen = () => { this.status = 'open'; };
    this.ws.onclose = () => { this.status = 'closed'; };
    this.ws.onmessage = (e) => {
      const m = JSON.parse(e.data as string) as Msg;
      if (m.t === 'welcome') this.id = m.id;
      if (m.t === 'lobby') {
        this.machines = m.machines;
        this.leader = m.leader;
      }
      for (const l of this.listeners) l(m);
    };
  }

  on(fn: (m: Msg) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  send(m: object) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  get isLeader() {
    return this.id !== 0 && this.id === this.leader;
  }

  close() {
    this.ws.close();
  }
}

const DELAY = 3;
const HASH_EVERY = 120;

export class NetDriver implements Driver {
  canPause = false;
  private frame = 0;
  private buf = new Map<number, (number | undefined)[]>();
  private sent = new Set<number>();
  private humans: number[];
  private mine: { player: number; device: DeviceId }[];
  private hashes = new Map<number, number>();
  private desync = false;
  private left = false;
  private stall = 0;
  private off: () => void;

  constructor(private client: LanClient, private seats: LanSeat[], devices: DeviceId[], private onAbort: () => void) {
    this.humans = seats.map((s, i) => (s.cpu ? -1 : i)).filter((i) => i >= 0);
    this.mine = [];
    seats.forEach((s, i) => {
      if (s.machine === client.id && !s.cpu) this.mine.push({ player: i, device: devices[s.local] ?? 'kb1' });
    });
    for (let f = 0; f < DELAY; f++) this.buf.set(f, seats.map((s) => (s.cpu ? undefined : 0)));
    this.off = client.on((m) => {
      if (m.t === 'in') {
        const row = this.row(m.f);
        for (const [p, bits] of m.p) row[p] = bits;
      } else if (m.t === 'hash') {
        const mine = this.hashes.get(m.f);
        if (mine !== undefined && mine !== m.h) this.desync = true;
        else if (mine === undefined) this.hashes.set(-m.f - 1, m.h); // stash theirs until ours exists
      } else if (m.t === 'left') {
        if (seats.some((s) => s.machine === m.id && !s.cpu)) this.left = true;
      }
    });
  }

  private row(f: number) {
    let r = this.buf.get(f);
    if (!r) {
      r = this.seats.map(() => undefined);
      this.buf.set(f, r);
    }
    return r;
  }

  next(s: SimState): InputFrame[] | null {
    if (this.left) {
      if (++this.stall > 180) this.onAbort();
      return null;
    }
    const target = this.frame + DELAY;
    if (!this.sent.has(target)) {
      this.sent.add(target);
      const row = this.row(target);
      const p: [number, number][] = this.mine.map((m) => [m.player, packInput(readDevice(m.device))]);
      for (const [i, b] of p) row[i] = b;
      this.client.send({ t: 'in', f: target, p });
    }
    const row = this.buf.get(this.frame);
    if (!row || this.humans.some((i) => row[i] === undefined)) {
      this.stall++;
      return null;
    }
    this.stall = 0;
    if (this.frame % HASH_EVERY === 0) {
      const h = stateHash(s);
      this.hashes.set(this.frame, h);
      const theirs = this.hashes.get(-this.frame - 1);
      if (theirs !== undefined && theirs !== h) this.desync = true;
      this.client.send({ t: 'hash', f: this.frame, h, from: this.client.id });
    }
    const inputs = this.seats.map((seat, i) => (seat.cpu ? cpuInput(s, i, seat.cpu) : unpackInput(row[i] ?? 0)));
    this.buf.delete(this.frame);
    this.sent.delete(this.frame);
    this.frame++;
    return inputs;
  }

  status() {
    if (this.left) return 'A PLAYER LEFT THE PARTY…';
    if (this.desync) return 'DESYNC DETECTED!';
    if (this.stall > 20) return 'WAITING FOR OTHER PLAYERS…';
    return '';
  }

  dispose() {
    this.off();
  }
}
