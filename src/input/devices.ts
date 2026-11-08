import { NO_INPUT, type InputFrame } from '../sim/engine';

// Input devices: two keyboard layouts (one solo-friendly, one for a second player on
// the same keyboard) and up to four gamepads with the standard mapping.

export type DeviceId = 'kb1' | 'kb2' | 'pad0' | 'pad1' | 'pad2' | 'pad3';
export type KeyboardId = 'kb1' | 'kb2';
export type Control = keyof InputFrame;

export const CONTROLS: Control[] = ['left', 'right', 'up', 'down', 'jump', 'punch', 'kick', 'special', 'shield'];

export const DEFAULT_BINDINGS: Record<KeyboardId, Record<Control, string[]>> = {
  kb1: {
    left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], jump: ['Space'],
    punch: ['KeyJ', 'KeyF'], kick: ['KeyK', 'KeyG'], special: ['KeyL', 'KeyH'], shield: ['KeyI', 'ShiftLeft'],
  },
  kb2: {
    left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], jump: ['ShiftRight', 'Numpad0'],
    punch: ['Comma', 'Numpad1'], kick: ['Period', 'Numpad2'], special: ['Slash', 'Numpad3'], shield: ['Enter', 'NumpadEnter'],
  },
};

const STORE = 'fruitpunch.bindings.v1';
let bindings: Record<KeyboardId, Record<Control, string[]>> = load();

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return { ...structuredClone(DEFAULT_BINDINGS), ...JSON.parse(raw) };
  } catch { /* storage blocked */ }
  return structuredClone(DEFAULT_BINDINGS);
}

export function getBindings() {
  return bindings;
}

export function setBinding(kb: KeyboardId, c: Control, code: string) {
  bindings[kb][c] = [code];
  try { localStorage.setItem(STORE, JSON.stringify(bindings)); } catch { /* ignore */ }
}

export function resetBindings() {
  bindings = structuredClone(DEFAULT_BINDINGS);
  try { localStorage.removeItem(STORE); } catch { /* ignore */ }
}

const held = new Set<string>();
let captureNext: ((code: string) => void) | null = null;
window.addEventListener('keydown', (e) => {
  if (captureNext) {
    const cb = captureNext;
    captureNext = null;
    cb(e.code);
    e.preventDefault();
    return;
  }
  held.add(e.code);
  if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Slash' || e.code === 'Quote') e.preventDefault();
});
window.addEventListener('keyup', (e) => held.delete(e.code));
window.addEventListener('blur', () => held.clear());

// Remapping: the next key press goes to `cb` instead of the game.
export function captureKey(cb: (code: string) => void) {
  captureNext = cb;
}

export const keyDown = (code: string) => held.has(code);

function pads(): (Gamepad | null)[] {
  return navigator.getGamepads ? Array.from(navigator.getGamepads()) : [];
}

function pad(id: DeviceId): Gamepad | null {
  const i = Number(id.slice(3));
  const p = pads()[i];
  return p && p.connected ? p : null;
}

export function connectedDevices(): DeviceId[] {
  const out: DeviceId[] = ['kb1', 'kb2'];
  pads().forEach((p, i) => { if (p?.connected && i < 4) out.push(`pad${i}` as DeviceId); });
  return out;
}

export function deviceLabel(id: DeviceId): string {
  if (id === 'kb1') return 'KEYS 1';
  if (id === 'kb2') return 'KEYS 2';
  return `PAD ${Number(id.slice(3)) + 1}`;
}

export function readDevice(id: DeviceId): InputFrame {
  if (id === 'kb1' || id === 'kb2') {
    const b = bindings[id];
    const inp = { ...NO_INPUT };
    for (const c of CONTROLS) inp[c] = b[c].some((k) => held.has(k));
    return inp;
  }
  const p = pad(id);
  if (!p) return { ...NO_INPUT };
  const ax = p.axes[0] ?? 0, ay = p.axes[1] ?? 0;
  const btn = (i: number) => !!p.buttons[i]?.pressed;
  return {
    left: ax < -0.4 || btn(14),
    right: ax > 0.4 || btn(15),
    up: ay < -0.5 || btn(12),
    down: ay > 0.5 || btn(13),
    jump: btn(0),
    special: btn(1),
    punch: btn(2),
    kick: btn(3),
    shield: btn(4) || btn(5) || btn(6) || btn(7),
  };
}

// --- menus ---------------------------------------------------------------------

export interface MenuPress {
  up: boolean; down: boolean; left: boolean; right: boolean;
  confirm: boolean; back: boolean; extra: boolean; extra2: boolean; start: boolean;
}

type MenuHeld = MenuPress;

function menuHeld(id: DeviceId): MenuHeld {
  const i = readDevice(id);
  if (id === 'kb1' || id === 'kb2') {
    const kb1 = id === 'kb1';
    return {
      up: i.up, down: i.down, left: i.left, right: i.right,
      confirm: i.punch || i.jump || (kb1 && (held.has('Enter') || held.has('NumpadEnter'))),
      back: i.kick || (kb1 && (held.has('Escape') || held.has('Backspace'))),
      extra: i.special,
      extra2: kb1 ? i.shield && !held.has('Enter') : false,
      start: kb1 && (held.has('Escape') || held.has('KeyP')),
    };
  }
  const p = pad(id);
  const btn = (n: number) => !!p?.buttons[n]?.pressed;
  return {
    up: i.up, down: i.down, left: i.left, right: i.right,
    confirm: btn(0), back: btn(1), extra: btn(3), extra2: btn(2), start: btn(9),
  };
}

const prevMenu = new Map<DeviceId, MenuHeld>();
let menuFrame = new Map<DeviceId, MenuPress>();

// Call once per tick; then menuPress()/anyPress() read the edges for this tick.
export function pollMenus() {
  const next = new Map<DeviceId, MenuPress>();
  for (const id of connectedDevices()) {
    const h = menuHeld(id);
    const p = prevMenu.get(id);
    const e = {} as MenuPress;
    for (const k of Object.keys(h) as (keyof MenuPress)[]) e[k] = h[k] && !(p?.[k] ?? false);
    next.set(id, e);
    prevMenu.set(id, h);
  }
  menuFrame = next;
}

export function menuPress(id: DeviceId): MenuPress | undefined {
  return menuFrame.get(id);
}

// Merged edges from every device (for single-cursor menus).
export function anyPress(): MenuPress {
  const out: MenuPress = { up: false, down: false, left: false, right: false, confirm: false, back: false, extra: false, extra2: false, start: false };
  for (const e of menuFrame.values()) for (const k of Object.keys(out) as (keyof MenuPress)[]) out[k] ||= e[k];
  return out;
}

export function keyLabel(code: string): string {
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Arrow/, '').replace('Numpad', 'NUM ').replace('Left', ' L').replace('Right', ' R')
    .replace('Comma', ',').replace('Period', '.').replace('Slash', '/').toUpperCase();
}
