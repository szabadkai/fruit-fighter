import type { FighterId } from '../../sim/types';
import type { FruitArt } from '../art';
import { appleArt } from './apple';
import { bananaArt } from './banana';
import { coconutArt } from './coconut';
import { lemonArt } from './lemon';
import { pineappleArt } from './pineapple';
import { strawberryArt } from './strawberry';
import { watermelonArt } from './watermelon';

// Fruits without their own art yet fall back to the banana.
export const FRUIT_ART: Record<FighterId, FruitArt> = {
  banana: bananaArt,
  watermelon: watermelonArt,
  pineapple: pineappleArt,
  lemon: lemonArt,
  coconut: coconutArt,
  strawberry: strawberryArt,
  apple: appleArt,
};
