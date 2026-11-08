// Deterministic math for the simulation. Every client in a LAN match must compute
// bit-identical results, and Math.sin/cos/hypot are not guaranteed to agree across
// browser engines. These use only + - * / and sqrt, which IEEE-754 pins down exactly.

const TAU = Math.PI * 2;

// sin via range reduction to [-pi, pi] then a 11th-order Taylor/minimax polynomial.
export function dsin(x: number): number {
  x = x - TAU * Math.floor((x + Math.PI) / TAU);
  // fold into [-pi/2, pi/2]
  if (x > Math.PI / 2) x = Math.PI - x;
  else if (x < -Math.PI / 2) x = -Math.PI - x;
  const x2 = x * x;
  return x * (1 - x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72 * (1 - x2 / 110)))));
}

export function dcos(x: number): number {
  return dsin(x + Math.PI / 2);
}

export function dlen(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export const DEG = Math.PI / 180;

// Small integer hash -> [0, 1). Pure, so AI and spawn patterns can use it without state.
export function hash01(a: number, b = 0): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// Seeded PRNG stepped inside the sim state (mulberry32).
export function nextRandom(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0;
  let r = Math.imul(t ^ (t >>> 15), 1 | t);
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t];
}
