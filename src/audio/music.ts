import { ac } from '../audio';

// A tiny procedural funk sequencer (drums, slap bass, chord stabs) so the game has
// MvC-ish energy without audio assets. Scheduled ahead with a lookahead timer.

type Track = 'menu' | 'battle';

interface Song {
  bpm: number;
  // per 16th step (32 steps = 2 bars)
  kick: string; snare: string; hat: string;
  bass: (number | null)[]; // semitone offsets from root, null = rest
  chords: number[][]; // one chord per bar (semitones from root)
  stab: string;
  root: number; // MIDI note
}

const n = (s: string) => s.split('').map((c) => c === 'x');

const SONGS: Record<Track, Song> = {
  menu: {
    bpm: 108, root: 45,
    kick: 'x.......x.x.....x.......x.......',
    snare: '....x.......x.......x.......x..x',
    hat: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.',
    bass: [0, null, null, 0, null, null, 7, null, 10, null, 12, null, 10, null, 7, null, 5, null, null, 5, null, null, 3, null, 5, null, 7, null, 3, null, 0, null],
    chords: [[0, 3, 7, 10], [5, 9, 12, 15]],
    stab: '..x.......x...x...x.......x.....',
  },
  battle: {
    bpm: 142, root: 40,
    kick: 'x...x...x...x...x...x...x..xx...',
    snare: '....x.......x.......x.......x.xx',
    hat: 'xxx.xxx.xxx.xxx.xxx.xxx.xxx.xxxx',
    bass: [0, null, 0, 12, null, 0, 10, null, 0, null, 7, null, 10, 12, null, 0, 3, null, 3, 15, null, 3, 12, null, 5, null, 7, null, 10, null, 12, 10],
    chords: [[0, 7, 10, 15], [3, 10, 14, 17]],
    stab: 'x.....x...x.....x.....x...x.x...',
  },
};

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class Music {
  private timer = 0;
  private step = 0;
  private nextTime = 0;
  private song: Song | null = null;
  private bus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  current: Track | null = null;
  volume = 0.55;

  play(track: Track) {
    if (this.current === track) return;
    this.stop();
    const c = ac();
    if (!c) return;
    this.current = track;
    this.song = SONGS[track];
    this.bus = c.createGain();
    this.bus.gain.value = 0.16 * this.volume;
    this.bus.connect(c.destination);
    if (!this.noise) {
      this.noise = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    this.step = 0;
    this.nextTime = c.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  stop() {
    window.clearInterval(this.timer);
    this.timer = 0;
    if (this.bus) {
      const c = ac();
      if (c) this.bus.gain.setTargetAtTime(0, c.currentTime, 0.1);
    }
    this.bus = null;
    this.current = null;
  }

  private schedule() {
    const c = ac();
    if (!c || !this.song || !this.bus) return;
    if (c.state !== 'running') {
      this.nextTime = c.currentTime + 0.1;
      return;
    }
    const sixteenth = 60 / this.song.bpm / 4;
    while (this.nextTime < c.currentTime + 0.15) {
      this.playStep(c, this.step, this.nextTime);
      this.nextTime += sixteenth;
      this.step = (this.step + 1) % 32;
    }
  }

  private playStep(c: AudioContext, i: number, t: number) {
    const s = this.song!;
    const bus = this.bus!;
    const on = (pat: string) => n(pat)[i];
    if (on(s.kick)) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g).connect(bus);
      o.start(t);
      o.stop(t + 0.2);
    }
    if (on(s.snare)) this.noiseHit(c, t, 1800, 0.5, 0.12, 'bandpass');
    if (on(s.hat)) this.noiseHit(c, t, 8000, 0.15, 0.03, 'highpass');
    const b = s.bass[i];
    if (b !== null && b !== undefined) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(s.root + b);
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(1400, t);
      f.frequency.exponentialRampToValueAtTime(200, t + 0.12);
      const g = c.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(f).connect(g).connect(bus);
      o.start(t);
      o.stop(t + 0.18);
    }
    if (on(s.stab)) {
      const chord = s.chords[Math.floor(i / 16) % s.chords.length];
      for (const semi of chord) {
        const o = c.createOscillator();
        o.type = 'square';
        o.frequency.value = midi(s.root + 24 + semi);
        const g = c.createGain();
        g.gain.setValueAtTime(0.07, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.connect(g).connect(bus);
        o.start(t);
        o.stop(t + 0.12);
      }
    }
  }

  private noiseHit(c: AudioContext, t: number, freq: number, vol: number, dur: number, type: BiquadFilterType) {
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.bus!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}

export const music = new Music();
