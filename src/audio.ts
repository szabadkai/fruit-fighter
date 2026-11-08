// Tiny synthesized SFX so the spike has punch without any sound assets.

let ctx: AudioContext | null = null;

export function ac(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

window.addEventListener('keydown', () => ac(), { once: true });
window.addEventListener('pointerdown', () => ac(), { once: true });

function noise(c: AudioContext, dur: number) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

function env(c: AudioContext, peak: number, attack: number, decay: number) {
  const g = c.createGain();
  const t = c.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(c.destination);
  return g;
}

export function sfxHit(power: number) {
  const c = ac();
  if (!c) return;
  const k = Math.min(1, power);
  // thump
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(180 - k * 70, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.18 + k * 0.2);
  o.connect(env(c, 0.5 + k * 0.4, 0.004, 0.2 + k * 0.25));
  o.start();
  o.stop(c.currentTime + 0.6);
  // splat
  const n = noise(c, 0.4);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(2400 - k * 1400, c.currentTime);
  f.frequency.exponentialRampToValueAtTime(300, c.currentTime + 0.25);
  f.Q.value = 0.9;
  n.connect(f).connect(env(c, 0.35 + k * 0.35, 0.002, 0.12 + k * 0.2));
  n.start();
}

export function sfxSwing(heavy: boolean) {
  const c = ac();
  if (!c) return;
  const n = noise(c, 0.3);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 3;
  f.frequency.setValueAtTime(400, c.currentTime);
  f.frequency.exponentialRampToValueAtTime(heavy ? 2600 : 3400, c.currentTime + (heavy ? 0.18 : 0.08));
  n.connect(f).connect(env(c, heavy ? 0.25 : 0.12, 0.02, heavy ? 0.18 : 0.08));
  n.start();
}

export function sfxJump() {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(260, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(620, c.currentTime + 0.1);
  o.connect(env(c, 0.12, 0.005, 0.1));
  o.start();
  o.stop(c.currentTime + 0.2);
}

export function sfxKo() {
  const c = ac();
  if (!c) return;
  sfxHit(1);
  const n = noise(c, 1.2);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(3000, c.currentTime);
  f.frequency.exponentialRampToValueAtTime(120, c.currentTime + 1);
  n.connect(f).connect(env(c, 0.6, 0.01, 1));
  n.start();
}

export function sfxBlock() {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(1400, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(900, c.currentTime + 0.12);
  o.connect(env(c, 0.18, 0.002, 0.15));
  o.start();
  o.stop(c.currentTime + 0.2);
}

export function sfxPickup() {
  const c = ac();
  if (!c) return;
  [523, 659, 784, 1046].forEach((f, i) => {
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    const g = c.createGain();
    const t = c.currentTime + i * 0.05;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + 0.15);
  });
}

export function sfxSuper() {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(110, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(880, c.currentTime + 0.5);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 2500;
  o.connect(f).connect(env(c, 0.25, 0.05, 0.6));
  o.start();
  o.stop(c.currentTime + 0.8);
  sfxHit(0.6);
}

// Cheesy fighting-game announcer via the browser's speech synthesis.
export function announce(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = 0.5;
    u.rate = 1.05;
    u.volume = 0.9;
    synth.speak(u);
  } catch { /* not available */ }
}
