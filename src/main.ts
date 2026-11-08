import '@fontsource/bangers';
import { Application, Container } from 'pixi.js';
import { H, W, game, type Scene } from './app';
import { pollMenus } from './input/devices';
import { ComicFilter } from './render/comicFilter';
import { TitleScene } from './scenes/menus';

const STEP_MS = 1000 / 60;

async function main() {
  await document.fonts.load('40px Bangers');
  const resolution = Math.min(window.devicePixelRatio || 1, 2);
  const app = new Application();
  await app.init({ resizeTo: window, resolution, autoDensity: true, antialias: true, background: '#000000', preference: 'webgl' });
  document.body.appendChild(app.canvas);

  const comic = new ComicFilter(resolution);
  app.stage.filters = [comic];
  app.stage.filterArea = app.screen;
  const root = new Container();
  app.stage.addChild(root);

  Object.assign(game, {
    app, comic, root, scene: null,
    go(next: Scene) {
      const old = game.scene;
      if (old) {
        old.destroy?.();
        root.removeChild(old.root);
        old.root.destroy({ children: true });
      }
      game.scene = next;
      root.addChild(next.root);
    },
  });
  game.go(new TitleScene());

  let acc = 0;
  app.ticker.add((t) => {
    acc += Math.min(t.deltaMS, 100);
    while (acc >= STEP_MS) {
      acc -= STEP_MS;
      pollMenus();
      game.scene?.tick();
    }
    const sw = app.screen.width, sh = app.screen.height;
    const scale = Math.min(sw / W, sh / H);
    root.scale.set(scale);
    root.position.set((sw - W * scale) / 2, (sh - H * scale) / 2);
    game.scene?.frame?.();
  });

  // Devtools hook: inspect the running scene, or advance ticks by hand while rAF is paused.
  (window as unknown as { game: unknown }).game = {
    get scene() { return game.scene; },
    advance(ticks: number) {
      for (let i = 0; i < ticks; i++) { pollMenus(); game.scene?.tick(); }
      game.scene?.frame?.();
      app.render();
    },
  };
}

void main();
