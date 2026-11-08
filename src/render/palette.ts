import type { FighterId } from '../sim/types';

export const PLAYER_COLORS = [0xff3b3b, 0x3b8bff, 0xffc61f, 0x37d16b];
export const PLAYER_TAGS = ['P1', 'P2', 'P3', 'P4'];

export const FRUIT_COLOR: Record<FighterId, number> = {
  banana: 0xffd41f,
  watermelon: 0x2f9e44,
  pineapple: 0xf2a516,
  lemon: 0xfff23a,
  coconut: 0x7a4a24,
  strawberry: 0xe8283a,
  apple: 0xe8332a,
};

// Juice droplet colors when the fruit gets hit.
export const JUICE: Record<FighterId, number[]> = {
  banana: [0xfff7c2, 0xffd41f],
  watermelon: [0xff4d5e, 0xff8a94, 0x1a1a1a],
  pineapple: [0xffe066, 0xffc21f],
  lemon: [0xfffbb0, 0xf2ff5c],
  coconut: [0xffffff, 0xf2efe6],
  strawberry: [0xff2f4f, 0xff7a8c],
  apple: [0xfff3c4, 0xffe08a, 0xe8332a],
};
