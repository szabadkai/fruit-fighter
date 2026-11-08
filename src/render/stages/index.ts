import type { StageId } from '../../sim/stages';
import type { StageArtFactory } from '../art';
import { blender } from './blender';
import { cuttingBoard } from './cuttingBoard';
import { fridge } from './fridge';
import { fruitBowl } from './fruitBowl';
import { kitchen } from './kitchen';
import { market } from './market';

export const STAGE_ART: Record<StageId, StageArtFactory> = {
  'cutting-board': cuttingBoard,
  'fruit-bowl': fruitBowl,
  kitchen,
  blender,
  market,
  fridge,
};
