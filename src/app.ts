import type { Application, Container } from 'pixi.js';
import type { ComicFilter } from './render/comicFilter';

// The running game: Pixi app, the letterboxed design-space root and the active scene.
// Scenes tick at a fixed 60 Hz and optionally draw once per display frame.

export const W = 1280;
export const H = 720;

export interface Scene {
  root: Container;
  tick(): void;
  frame?(): void;
  destroy?(): void;
}

export interface Game {
  app: Application;
  comic: ComicFilter;
  root: Container;
  scene: Scene | null;
  go(next: Scene): void;
}

export const game = {} as Game;
